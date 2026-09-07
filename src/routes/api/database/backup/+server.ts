import { error } from '@sveltejs/kit';
import { readFile, stat } from 'node:fs/promises';
import db from '$lib/server/db';
import { resolveDatabasePath } from '$lib/server/db-url';

export async function GET() {
	// Handle PostgreSQL
	if (db.$client?.isPostgres) {
		try {
			const client = db.$client;
			const tablesRes = await client.execute(
				`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';`
			);
			const backupData: Record<string, unknown[]> = {};
			for (const row of tablesRes.rows as Array<{ table_name: string }>) {
				const tableName = row.table_name;
				const dataRes = await client.execute(`SELECT * FROM "${tableName}"`);
				backupData[tableName] = dataRes.rows;
			}
			const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
			const filename = `rapkumer-backup-${timestamp}.json`;
			const jsonStr = JSON.stringify(backupData, null, 2);
			return new Response(jsonStr, {
				headers: {
					'Content-Type': 'application/json',
					'Content-Disposition': `attachment; filename="${filename}"`
				}
			});
		} catch (e: unknown) {
			const err = e as { message?: string } | undefined;
			console.error('[backup] PostgreSQL backup failed:', e);
			throw error(500, 'Gagal membuat backup database PostgreSQL: ' + (err?.message || String(e)));
		}
	}

	// Handle SQLite
	const dbPath = resolveDatabasePath();

	try {
		await stat(dbPath);
	} catch (cause) {
		console.error('Database file not found', cause);
		throw error(404, 'Berkas database tidak ditemukan');
	}

	// Checkpoint WAL on the main server client to flush all changes to the main DB file
	try {
		await db.$client.execute({
			sql: 'PRAGMA wal_checkpoint(FULL)'
		});
	} catch (err) {
		console.warn('[backup] WAL checkpoint warning:', err);
	}

	const fileBuffer = await readFile(dbPath);
	const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
	const filename = `rapkumer-backup-${timestamp}.sqlite3`;
	const body = new Uint8Array(fileBuffer);

	return new Response(body, {
		headers: {
			'Content-Type': 'application/vnd.sqlite3',
			'Content-Disposition': `attachment; filename="${filename}"`,
			'Content-Length': fileBuffer.length.toString()
		}
	});
}
