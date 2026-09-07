import fs from 'node:fs/promises';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import db from '$lib/server/db';
import { dataRoot } from '$lib/server/data-dirs';
import { tableAuthUser, tablePegawai } from '$lib/server/db/schema';
import {
	isR2Configured,
	buildR2Key,
	uploadBufferToR2,
	deleteFromR2,
	fetchR2Buffer,
	isPublicUrl
} from '$lib/server/storage-r2';

// Dinas luar files live under the user-data root (dataRoot()):
//   - undangan PDFs:   <root>/dinas-luar/undangan/
//   - SPPD bukti PDFs: <root>/dinas-luar/sppd/<sppdId>/
//   - bukti foto:      <root>/dinas-luar/<nama-akun>/<sppdId>/
// Or in Cloudflare R2 / S3 when configured.
const DINAS_LUAR_DIR = path.join(dataRoot(), 'dinas-luar');
const UNDANGAN_DIR = path.join(DINAS_LUAR_DIR, 'undangan');
const SPPD_DIR = path.join(DINAS_LUAR_DIR, 'sppd');

const REL_PREFIX = 'undangan/';
const SAFE_NAME = /^[A-Za-z0-9._-]+$/;

/** Write an undangan PDF to Cloudflare R2 or local disk. Returns the URL or relative path. */
export async function saveUndanganFile(filename: string, buffer: Buffer): Promise<string> {
	if (!SAFE_NAME.test(filename)) {
		throw new Error('Nama file undangan tidak valid.');
	}
	if (!buffer.length) {
		throw new Error('File undangan kosong.');
	}

	if (isR2Configured()) {
		const key = buildR2Key('dinas-luar/undangan', filename);
		const { publicUrl } = await uploadBufferToR2(key, buffer, 'application/pdf');
		return publicUrl;
	}

	await fs.mkdir(UNDANGAN_DIR, { recursive: true });
	await fs.writeFile(path.join(UNDANGAN_DIR, filename), buffer);
	return `${REL_PREFIX}${filename}`;
}

/** Read an undangan PDF by its stored relative path or R2 public URL. */
export async function readUndanganFile(relPath: string): Promise<Buffer | null> {
	if (!relPath) return null;
	if (isPublicUrl(relPath)) {
		return fetchR2Buffer(relPath);
	}
	if (relPath.includes('..') || relPath.includes('\\')) return null;
	if (!relPath.startsWith(REL_PREFIX)) return null;
	const filename = relPath.slice(REL_PREFIX.length);
	if (!SAFE_NAME.test(filename)) return null;
	try {
		return await fs.readFile(path.join(UNDANGAN_DIR, filename));
	} catch {
		return null;
	}
}

export async function deleteUndanganFile(relPath: string | null): Promise<void> {
	if (!relPath) return;
	if (isPublicUrl(relPath)) {
		await deleteFromR2(relPath);
		return;
	}
	if (relPath.includes('..') || relPath.includes('\\')) return;
	if (!relPath.startsWith(REL_PREFIX)) return;
	const filename = relPath.slice(REL_PREFIX.length);
	if (!SAFE_NAME.test(filename)) return;
	await fs.rm(path.join(UNDANGAN_DIR, filename), { force: true }).catch(() => {});
}

// --- Bukti perjalanan dinas (SPPD) ---

const ACCOUNT_SEGMENT = /^[A-Za-z0-9._-]+$/;

/** Turn an account name (username) into a safe folder segment. */
export function sanitizeAccountName(namaAkun: string): string {
	const clean = namaAkun
		.trim()
		.replace(/[^A-Za-z0-9._-]+/g, '_')
		.replace(/^[._-]+|[._-]+$/g, '')
		.replace(/_+/g, '_');
	return clean || 'akun';
}

/**
 * Write an SPPD bukti PDF to R2 or local disk and return the public URL or relative path.
 */
export async function saveSppdFile(
	sppdId: number,
	filename: string,
	buffer: Buffer
): Promise<string> {
	if (!SAFE_NAME.test(filename)) {
		throw new Error('Nama file bukti tidak valid.');
	}
	if (!buffer.length) {
		throw new Error('File bukti kosong.');
	}

	if (isR2Configured()) {
		const key = buildR2Key('dinas-luar/sppd', `${sppdId}_${filename}`);
		const { publicUrl } = await uploadBufferToR2(key, buffer, 'application/pdf');
		return publicUrl;
	}

	const dir = path.join(SPPD_DIR, String(sppdId));
	await fs.mkdir(dir, { recursive: true });
	await fs.writeFile(path.join(dir, filename), buffer);
	return `sppd/${sppdId}/${filename}`;
}

/**
 * Write a bukti foto to R2 or local disk and return the public URL or relative path.
 */
export async function saveGambarFile(
	namaAkun: string,
	sppdId: number,
	filename: string,
	buffer: Buffer
): Promise<string> {
	if (!SAFE_NAME.test(filename)) {
		throw new Error('Nama file bukti tidak valid.');
	}
	if (!buffer.length) {
		throw new Error('File bukti kosong.');
	}

	if (isR2Configured()) {
		const ext = filename.toLowerCase().endsWith('.png')
			? 'image/png'
			: filename.toLowerCase().endsWith('.webp')
				? 'image/webp'
				: 'image/jpeg';
		const key = buildR2Key('dinas-luar/bukti', `${sppdId}_${filename}`);
		const { publicUrl } = await uploadBufferToR2(key, buffer, ext);
		return publicUrl;
	}

	const account = sanitizeAccountName(namaAkun);
	const dir = path.join(DINAS_LUAR_DIR, account, String(sppdId));
	await fs.mkdir(dir, { recursive: true });
	await fs.writeFile(path.join(dir, filename), buffer);
	return `${account}/${sppdId}/${filename}`;
}

/**
 * Resolve a stored bukti relative path to an absolute file path, or null when
 * the path is malformed/unsafe. Accepts `sppd/<id>/<file>`, `<akun>/<id>/<file>`
 * and the legacy `bukti/<id>/<file>` layout.
 */
function resolveBuktiPath(relPath: string): string | null {
	if (!relPath || relPath.includes('..') || relPath.includes('\\')) return null;
	const segments = relPath.split('/');
	if (segments.length !== 3) return null;
	const [dir, idStr, filename] = segments;
	if (!/^\d+$/.test(idStr) || !SAFE_NAME.test(filename)) return null;
	if (dir === 'sppd') return path.join(SPPD_DIR, idStr, filename);
	if (dir === 'bukti') return path.join(DINAS_LUAR_DIR, 'bukti', idStr, filename);
	if (ACCOUNT_SEGMENT.test(dir)) return path.join(DINAS_LUAR_DIR, dir, idStr, filename);
	return null;
}

/** Read a bukti file by its stored relative path or R2 public URL. */
export async function readBuktiFile(relPath: string): Promise<Buffer | null> {
	if (!relPath) return null;
	if (isPublicUrl(relPath)) {
		return fetchR2Buffer(relPath);
	}
	const abs = resolveBuktiPath(relPath);
	if (!abs) return null;
	try {
		return await fs.readFile(abs);
	} catch {
		return null;
	}
}

export async function deleteBuktiFile(relPath: string | null): Promise<void> {
	if (!relPath) return;
	if (isPublicUrl(relPath)) {
		await deleteFromR2(relPath);
		return;
	}
	const abs = resolveBuktiPath(relPath);
	if (!abs) return;
	await fs.rm(abs, { force: true }).catch(() => {});
}

/** Resolve the human-readable name of the logged-in user for display/storage. */
export async function resolveUserName(
	user: Pick<AuthUser, 'id' | 'username' | 'pegawaiId'> | undefined | null
): Promise<string> {
	if (!user) return 'Pengguna';
	if (user.pegawaiId) {
		const peg = await db.query.tablePegawai.findFirst({
			columns: { nama: true },
			where: eq(tablePegawai.id, Number(user.pegawaiId))
		});
		if (peg?.nama) return peg.nama;
	}
	const auth = await db.query.tableAuthUser.findFirst({
		columns: { namaLengkap: true, username: true },
		where: eq(tableAuthUser.id, Number(user.id))
	});
	return auth?.namaLengkap?.trim() || auth?.username || 'Pengguna';
}
