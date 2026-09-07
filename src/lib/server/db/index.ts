import { env } from '$env/dynamic/private';
import path from 'node:path';
import fs from 'node:fs';
import { createClient, type Client as LibsqlClient } from '@libsql/client';
import { drizzle as drizzleLibsql } from 'drizzle-orm/libsql/node';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import postgres, { type Sql as PgClient } from 'postgres';
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import * as schemaSqlite from './schema';
import * as schemaPg from './schema.pg';
import type { UnifiedDatabaseClient } from './client-types';
import { translateSqliteToPostgres } from './sql-translate';

const defaultDbUrl = 'file:./data/database.sqlite3';

// Try to read a local `.env` file at runtime (dependency-free) so a built `node` run
// can pick up `DB_URL` / `DB_AUTH_TOKEN` without requiring an external loader.
function loadDotEnvIfPresent() {
	if (process.env.DB_URL || process.env.DB_AUTH_TOKEN) return;

	try {
		const envPath = path.resolve(process.cwd(), '.env');
		if (!fs.existsSync(envPath)) return;
		const raw = fs.readFileSync(envPath, 'utf8');
		for (const line of raw.split(/\r?\n/)) {
			const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
			if (!m) continue;
			const key = m[1];
			let val = m[2] ?? '';
			// Remove surrounding quotes if present
			if (
				(val.startsWith('"') && val.endsWith('"')) ||
				(val.startsWith("'") && val.endsWith("'"))
			) {
				val = val.slice(1, -1);
			}
			if (key === 'DB_URL' || key === 'DB_AUTH_TOKEN') {
				process.env[key] = val;
			}
		}
	} catch (e) {
		// Non-fatal: if reading fails, just continue and fall back to other heuristics
		console.warn('[db] failed to read .env file:', e);
	}
}

loadDotEnvIfPresent();

export function resolveInstalledDbUrl() {
	// Prefer an explicit runtime `process.env.DB_URL` first (allows .env or env vars at node runtime),
	// then SvelteKit's dynamic `env.DB_URL`.
	if (process.env.DB_URL) return process.env.DB_URL;
	if (env.DB_URL) return env.DB_URL;

	// If user didn't set DB_URL, prefer the repository-local database file so
	// local development and packaged runs default to `data/database.sqlite3`.
	return defaultDbUrl;
}

export function isPostgresUrl(url: string) {
	return url.startsWith('postgres://') || url.startsWith('postgresql://');
}

const clientKey = '__rapkumerActiveClient';

async function enableWAL(client: LibsqlClient) {
	try {
		await client.execute('PRAGMA journal_mode=WAL');
		await client.execute('PRAGMA synchronous=NORMAL');
		await client.execute('PRAGMA busy_timeout=30000');
	} catch (e) {
		console.warn('[db] failed to enable WAL mode, concurrency may be limited:', e);
	}
}

async function initPostgresCollation(client: PgClient) {
	try {
		await client.unsafe(
			`CREATE COLLATION IF NOT EXISTS nocase (provider = icu, locale = 'und-u-ks-level2', deterministic = false)`
		);
	} catch {
		try {
			await client.unsafe(`CREATE COLLATION IF NOT EXISTS nocase (provider = libc, locale = 'C')`);
		} catch (e) {
			console.warn('[db] could not register nocase collation in PostgreSQL:', e);
		}
	}
}

function createClientBundle(): { client: UnifiedDatabaseClient; dbInstance: unknown } {
	const url = resolveInstalledDbUrl();
	const isPg = isPostgresUrl(url);

	if (isPg) {
		console.info(`[db] connecting to PostgreSQL: ${url.replace(/:[^:@]+@/, ':****@')}`);
		const maxConnections = Number(process.env.PG_MAX_CONNECTIONS || 20);
		const pgClient = postgres(url, {
			max: maxConnections,
			idle_timeout: 30,
			connect_timeout: 10,
			onnotice: () => {}
		});

		// Asynchronously ensure nocase collation exists
		initPostgresCollation(pgClient).catch((e) => {
			console.warn('[db] background nocase collation check failed:', e);
		});

		const dbInstance = drizzlePg(pgClient, { casing: 'snake_case', schema: schemaPg });

		const unifiedClient: UnifiedDatabaseClient = {
			isPostgres: true,
			execute: async (statement: string | { sql: string; args?: unknown[] }) => {
				const sqlStr = (typeof statement === 'string' ? statement : statement.sql).trim();
				// Intercept SQLite PRAGMAs gracefully
				if (/^pragma\s+/i.test(sqlStr)) {
					const tableInfoMatch = sqlStr.match(
						/pragma\s+table_info\s*\(\s*["']?([^"')]+)["']?\s*\)/i
					);
					if (tableInfoMatch) {
						const table = tableInfoMatch[1].toLowerCase();
						const cols = await pgClient.unsafe(
							`SELECT column_name AS name FROM information_schema.columns WHERE table_name = '${table}'`
						);
						return { rows: cols as unknown as unknown[] };
					}
					// Other pragmas (wal, synchronous, timeout) are no-ops on PG
					return { rows: [] };
				}
				// Intercept SQLite sqlite_master table existence queries
				if (/sqlite_master/i.test(sqlStr)) {
					const args = typeof statement === 'object' && statement.args ? statement.args : [];
					const tableMatch = sqlStr.match(/name\s*=\s*['"]?([^'")\s]+)['"]?/i);
					const tableName = (
						args[0] ? String(args[0]) : tableMatch ? tableMatch[1] : ''
					).toLowerCase();
					const tables = await pgClient.unsafe(
						`SELECT table_name AS name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '${tableName}'`
					);
					return { rows: tables as unknown as unknown[] };
				}

				const translatedSql = translateSqliteToPostgres(sqlStr);
				try {
					const res = await pgClient.unsafe(translatedSql);
					return { rows: res as unknown as unknown[] };
				} catch (e: unknown) {
					const msg = String(e || '').toLowerCase();
					if (
						msg.includes('already exists') ||
						msg.includes('duplicate') ||
						(msg.includes('relation') && msg.includes('exists'))
					) {
						return { rows: [] };
					}
					throw e;
				}
			},
			close: async () => {
				await pgClient.end();
			}
		};

		Object.assign(dbInstance as object, { $client: unifiedClient });
		return { client: unifiedClient, dbInstance };
	}

	// Default: LibSQL / SQLite
	const authToken = env.DB_AUTH_TOKEN;
	console.info(
		`[db] creating libsql client; DB_URL=${url ? url : '(none)'}${authToken ? ' (auth token present)' : ''}`
	);
	if (url.startsWith('file:')) {
		const filePath = path.resolve(process.cwd(), url.replace(/^file:/, ''));
		const dir = path.dirname(filePath);
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}
	}
	const libsqlClient = createClient({ url, authToken });
	enableWAL(libsqlClient);

	const dbInstance = drizzleLibsql(libsqlClient, { casing: 'snake_case', schema: schemaSqlite });

	const unifiedClient: UnifiedDatabaseClient = {
		isPostgres: false,
		execute: async (statement: string | { sql: string }) => {
			const res = await libsqlClient.execute(statement);
			return { rows: res.rows as unknown as unknown[] };
		},
		close: async () => {
			libsqlClient.close();
		}
	};

	Object.assign(dbInstance as object, { $client: unifiedClient });
	return { client: unifiedClient, dbInstance };
}

function initClientAndDb() {
	const store = globalThis as unknown as Record<string, UnifiedDatabaseClient | undefined>;
	const bundle = createClientBundle();
	store[clientKey] = bundle.client;
	return bundle;
}

let { dbInstance: currentDb } = initClientAndDb();

export async function closeDbClient() {
	const store = globalThis as unknown as Record<string, UnifiedDatabaseClient | undefined>;
	const existing = store[clientKey];
	if (existing) {
		try {
			await existing.close();
		} catch (e) {
			console.warn('[db] error closing existing client:', e);
		}
	}
	delete store[clientKey];
}

export async function reloadDbClient() {
	try {
		await closeDbClient();
		const bundle = createClientBundle();
		const store = globalThis as unknown as Record<string, UnifiedDatabaseClient | undefined>;
		store[clientKey] = bundle.client;
		currentDb = bundle.dbInstance;
		console.info('[db] reloaded database client and drizzle instance');
	} catch (e) {
		console.error('[db] failed to reload client', e);
	}
}

// Export a proxy that forwards calls to the current drizzle instance so callers can keep
// the same imported object while we swap the underlying instance on import/reset.
const dbProxy = new Proxy(
	{},
	{
		get(_t, prop) {
			const target = currentDb as Record<string, unknown>;
			const v = target[String(prop)];
			if (typeof v === 'function') return (v as (...args: unknown[]) => unknown).bind(target);
			return v;
		},
		set(_t, prop, value) {
			(currentDb as Record<string, unknown>)[String(prop)] = value;
			return true;
		}
	}
);

export type AppDatabase = LibSQLDatabase<typeof schemaSqlite> & {
	$client: UnifiedDatabaseClient;
};

export default dbProxy as unknown as AppDatabase;
