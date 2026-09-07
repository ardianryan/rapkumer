import db from '$lib/server/db';
import { translateSqliteToPostgres } from './sql-translate';

export { translateSqliteToPostgres };

const ensured = new Map<string, boolean>();

export async function ensureSchema(name: string, statements: string[]) {
	if (ensured.get(name)) return;
	const client = db.$client;
	const isPg = client?.isPostgres;

	for (const rawStatement of statements) {
		const statement = isPg ? translateSqliteToPostgres(rawStatement) : rawStatement;
		try {
			await client.execute(statement);
		} catch (e: unknown) {
			// Ignore "already exists" or duplicate errors gracefully
			const err = e as { message?: string } | undefined;
			const msg = String(err?.message || e || '').toLowerCase();
			if (
				msg.includes('already exists') ||
				msg.includes('duplicate') ||
				(msg.includes('relation') && msg.includes('exists'))
			) {
				continue;
			}
			console.warn(`[ensureSchema:${name}] statement error:`, err?.message || e);
		}
	}
	ensured.set(name, true);
}

// Force every ensure-* schema helper to re-run against the current database.
// Called after a database import/restore so tables/columns added by newer
// versions are re-created (the helpers are idempotent).
export function resetEnsuredSchemas() {
	ensured.clear();
}
