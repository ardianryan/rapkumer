import fs from 'node:fs/promises';
import path from 'node:path';
import { eq, like } from 'drizzle-orm';
import db from '$lib/server/db';
import { dataRoot } from '$lib/server/data-dirs';
import { tableBukuTamu, tablePresensiGuru } from '$lib/server/db/schema';
import {
	isR2Configured,
	buildR2Key,
	uploadBufferToR2,
	deleteFromR2,
	fetchR2Buffer,
	isPublicUrl
} from '$lib/server/storage-r2';

export type TtdKategori = 'guru' | 'tamu';

// Signatures are stored as transparent PNG files under <root>/ttd/<kategori>/,
// alongside the other user data (database, uploads, dinas-luar).
const DATA_DIR = path.join(dataRoot(), 'ttd');

const SAFE_REL = /^[a-z]+\/[A-Za-z0-9._-]+$/;
const SAFE_NAME = /^[A-Za-z0-9._-]+$/;
const DATA_URL_PREFIX = 'data:image/png;base64,';

export function isDataUrlSignature(value: string): boolean {
	return value.startsWith('data:image/');
}

function safeRelPath(relPath: string): string | null {
	if (!relPath || relPath.includes('..') || relPath.includes('\\')) return null;
	if (!SAFE_REL.test(relPath)) return null;
	return relPath;
}

/**
 * Write a data-URL PNG to data/ttd/<kategori>/<filename>.
 * Returns the relative path to store in the DB.
 */
export async function saveSignatureFile(
	kategori: TtdKategori,
	filename: string,
	dataUrl: string
): Promise<string> {
	if (!SAFE_NAME.test(filename)) {
		throw new Error('Nama file tanda tangan tidak valid.');
	}
	if (!dataUrl.startsWith(DATA_URL_PREFIX)) {
		throw new Error('Format tanda tangan tidak valid.');
	}
	const buf = Buffer.from(dataUrl.slice(DATA_URL_PREFIX.length), 'base64');
	if (!buf.length) {
		throw new Error('Tanda tangan kosong.');
	}

	if (isR2Configured()) {
		const key = buildR2Key(`ttd/${kategori}`, filename);
		const { publicUrl } = await uploadBufferToR2(key, buf, 'image/png');
		return publicUrl;
	}

	const dir = path.join(DATA_DIR, kategori);
	await fs.mkdir(dir, { recursive: true });
	await fs.writeFile(path.join(dir, filename), buf);
	return `${kategori}/${filename}`;
}

export async function readSignatureFile(relPath: string): Promise<Buffer | null> {
	if (!relPath) return null;
	if (isPublicUrl(relPath)) {
		return fetchR2Buffer(relPath);
	}
	const safe = safeRelPath(relPath);
	if (!safe) return null;
	try {
		return await fs.readFile(path.join(DATA_DIR, safe));
	} catch {
		return null;
	}
}

export async function deleteSignatureFile(relPath: string): Promise<void> {
	if (!relPath) return;
	if (isPublicUrl(relPath)) {
		await deleteFromR2(relPath);
		return;
	}
	const safe = safeRelPath(relPath);
	if (!safe) return;
	await fs.rm(path.join(DATA_DIR, safe), { force: true }).catch(() => {});
}

/** Resolve a stored value (rel path or legacy data URL) into a data URL for PDF embedding. */
export async function signatureToDataUrl(value: string | null | undefined): Promise<string | null> {
	if (!value) return null;
	if (isDataUrlSignature(value)) return value;
	const buf = await readSignatureFile(value);
	return buf ? `${DATA_URL_PREFIX}${buf.toString('base64')}` : null;
}

// One-time migration: move legacy inline data-URL signatures out of the DB into files.
let legacyMigrated = false;

async function tableExists(name: string): Promise<boolean> {
	const result = await db.$client.execute({
		sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
		args: [name]
	});
	return result.rows.length > 0;
}

export async function migrateLegacySignatures(): Promise<void> {
	if (legacyMigrated) return;

	try {
		// Each branch is guarded on table existence: on a fresh install only one of
		// the two tables may exist yet (they are created by separate ensure-* scripts).
		if (await tableExists('presensi_guru')) {
			const guruRows = await db.query.tablePresensiGuru.findMany({
				columns: { id: true, authUserId: true, tanggal: true, tandaTangan: true },
				where: like(tablePresensiGuru.tandaTangan, 'data:image%')
			});
			for (const row of guruRows) {
				if (!row.tandaTangan) continue;
				const rel = await saveSignatureFile(
					'guru',
					`${row.authUserId}_${row.tanggal}.png`,
					row.tandaTangan
				);
				await db
					.update(tablePresensiGuru)
					.set({ tandaTangan: rel })
					.where(eq(tablePresensiGuru.id, row.id));
			}
		}

		if (await tableExists('buku_tamu')) {
			const tamuRows = await db.query.tableBukuTamu.findMany({
				columns: { id: true, tandaTangan: true },
				where: like(tableBukuTamu.tandaTangan, 'data:image%')
			});
			for (const row of tamuRows) {
				if (!row.tandaTangan) continue;
				const rel = await saveSignatureFile('tamu', `tamu_${row.id}.png`, row.tandaTangan);
				await db
					.update(tableBukuTamu)
					.set({ tandaTangan: rel })
					.where(eq(tableBukuTamu.id, row.id));
			}
		}
	} catch (e) {
		console.warn('[ttd] failed to migrate legacy signatures:', e);
		return;
	}

	legacyMigrated = true;
}
