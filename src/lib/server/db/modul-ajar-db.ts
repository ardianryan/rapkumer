import db from '$lib/server/db';
import { tableModulAjar as tableModulAjarSqlite } from './schema-modul-ajar';
import { tableModulAjar as tableModulAjarPg } from './schema-modul-ajar.pg';
import { tableMataPelajaran, tableKelas, tableAuthUser, tablePegawai } from './schema';
import { and, desc, eq, type SQL } from 'drizzle-orm';
import type { ModulAjarKonten } from '$lib/server/ai-modul-ajar';

export function getModulAjarTable() {
	const isPg = db.$client?.isPostgres;
	return (isPg ? tableModulAjarPg : tableModulAjarSqlite) as unknown as typeof tableModulAjarSqlite;
}

export type ModulAjarRecord = {
	id: number;
	sekolahId: number;
	kelasId: number;
	mataPelajaranId: number;
	authUserId: number;
	materiPokok: string;
	alokasiWaktu: string;
	jumlahPertemuan: string;
	modelPembelajaran: string;
	dimensiProfil: string[];
	tujuanPembelajaranIds: number[];
	konten: ModulAjarKonten;
	status: 'draf' | 'final';
	createdAt: string;
	updatedAt: string | null;
	mapelNama?: string;
	kelasNama?: string;
	guruNama?: string;
};

function safeParseJson<T>(val: unknown, fallback: T): T {
	if (typeof val === 'object' && val !== null) return val as T;
	if (typeof val !== 'string') return fallback;
	try {
		return JSON.parse(val) as T;
	} catch {
		return fallback;
	}
}

export async function listModulAjar(params: {
	sekolahId: number;
	kelasId?: number | null;
	authUserId?: number | null;
	mataPelajaranId?: number | null;
	status?: string | null;
}): Promise<ModulAjarRecord[]> {
	const table = getModulAjarTable();
	const conditions: SQL[] = [eq(table.sekolahId, params.sekolahId)];

	if (params.kelasId) {
		conditions.push(eq(table.kelasId, params.kelasId));
	}
	if (params.authUserId) {
		conditions.push(eq(table.authUserId, params.authUserId));
	}
	if (params.mataPelajaranId) {
		conditions.push(eq(table.mataPelajaranId, params.mataPelajaranId));
	}
	if (params.status) {
		conditions.push(eq(table.status, params.status as 'draf' | 'final'));
	}

	const rows = (await db
		.select({
			id: table.id,
			sekolahId: table.sekolahId,
			kelasId: table.kelasId,
			mataPelajaranId: table.mataPelajaranId,
			authUserId: table.authUserId,
			materiPokok: table.materiPokok,
			alokasiWaktu: table.alokasiWaktu,
			jumlahPertemuan: table.jumlahPertemuan,
			modelPembelajaran: table.modelPembelajaran,
			dimensiProfil: table.dimensiProfil,
			tujuanPembelajaranIds: table.tujuanPembelajaranIds,
			konten: table.konten,
			status: table.status,
			createdAt: table.createdAt,
			updatedAt: table.updatedAt,
			mapelNama: tableMataPelajaran.nama,
			kelasNama: tableKelas.nama,
			guruPegawaiNama: tablePegawai.nama,
			guruUsername: tableAuthUser.username
		})
		.from(table)
		.leftJoin(tableMataPelajaran, eq(table.mataPelajaranId, tableMataPelajaran.id))
		.leftJoin(tableKelas, eq(table.kelasId, tableKelas.id))
		.leftJoin(tableAuthUser, eq(table.authUserId, tableAuthUser.id))
		.leftJoin(tablePegawai, eq(tableAuthUser.pegawaiId, tablePegawai.id))
		.where(and(...conditions))
		.orderBy(desc(table.id))) as unknown as Array<Record<string, unknown>>;

	return rows.map((r) => ({
		id: Number(r.id),
		sekolahId: Number(r.sekolahId),
		kelasId: Number(r.kelasId),
		mataPelajaranId: Number(r.mataPelajaranId),
		authUserId: Number(r.authUserId),
		materiPokok: String(r.materiPokok || ''),
		alokasiWaktu: String(r.alokasiWaktu || ''),
		jumlahPertemuan: String(r.jumlahPertemuan || ''),
		modelPembelajaran: String(r.modelPembelajaran || ''),
		dimensiProfil: safeParseJson<string[]>(r.dimensiProfil, []),
		tujuanPembelajaranIds: safeParseJson<number[]>(r.tujuanPembelajaranIds, []),
		konten: safeParseJson<ModulAjarKonten>(r.konten, {} as ModulAjarKonten),
		status: (r.status as 'draf' | 'final') || 'draf',
		createdAt: String(r.createdAt || ''),
		updatedAt: r.updatedAt ? String(r.updatedAt) : null,
		mapelNama: r.mapelNama ? String(r.mapelNama) : undefined,
		kelasNama: r.kelasNama ? String(r.kelasNama) : undefined,
		guruNama:
			r.guruPegawaiNama || r.guruUsername ? String(r.guruPegawaiNama || r.guruUsername) : undefined
	}));
}

export async function getModulAjarById(
	id: number,
	sekolahId?: number
): Promise<ModulAjarRecord | null> {
	const table = getModulAjarTable();
	const conditions: SQL[] = [eq(table.id, id)];
	if (sekolahId) {
		conditions.push(eq(table.sekolahId, sekolahId));
	}

	const rows = (await db
		.select({
			id: table.id,
			sekolahId: table.sekolahId,
			kelasId: table.kelasId,
			mataPelajaranId: table.mataPelajaranId,
			authUserId: table.authUserId,
			materiPokok: table.materiPokok,
			alokasiWaktu: table.alokasiWaktu,
			jumlahPertemuan: table.jumlahPertemuan,
			modelPembelajaran: table.modelPembelajaran,
			dimensiProfil: table.dimensiProfil,
			tujuanPembelajaranIds: table.tujuanPembelajaranIds,
			konten: table.konten,
			status: table.status,
			createdAt: table.createdAt,
			updatedAt: table.updatedAt,
			mapelNama: tableMataPelajaran.nama,
			kelasNama: tableKelas.nama,
			guruPegawaiNama: tablePegawai.nama,
			guruUsername: tableAuthUser.username
		})
		.from(table)
		.leftJoin(tableMataPelajaran, eq(table.mataPelajaranId, tableMataPelajaran.id))
		.leftJoin(tableKelas, eq(table.kelasId, tableKelas.id))
		.leftJoin(tableAuthUser, eq(table.authUserId, tableAuthUser.id))
		.leftJoin(tablePegawai, eq(tableAuthUser.pegawaiId, tablePegawai.id))
		.where(and(...conditions))
		.limit(1)) as unknown as Array<Record<string, unknown>>;

	if (!rows.length) return null;
	const r = rows[0];

	return {
		id: Number(r.id),
		sekolahId: Number(r.sekolahId),
		kelasId: Number(r.kelasId),
		mataPelajaranId: Number(r.mataPelajaranId),
		authUserId: Number(r.authUserId),
		materiPokok: String(r.materiPokok || ''),
		alokasiWaktu: String(r.alokasiWaktu || ''),
		jumlahPertemuan: String(r.jumlahPertemuan || ''),
		modelPembelajaran: String(r.modelPembelajaran || ''),
		dimensiProfil: safeParseJson<string[]>(r.dimensiProfil, []),
		tujuanPembelajaranIds: safeParseJson<number[]>(r.tujuanPembelajaranIds, []),
		konten: safeParseJson<ModulAjarKonten>(r.konten, {} as ModulAjarKonten),
		status: (r.status as 'draf' | 'final') || 'draf',
		createdAt: String(r.createdAt || ''),
		updatedAt: r.updatedAt ? String(r.updatedAt) : null,
		mapelNama: r.mapelNama ? String(r.mapelNama) : undefined,
		kelasNama: r.kelasNama ? String(r.kelasNama) : undefined,
		guruNama:
			r.guruPegawaiNama || r.guruUsername ? String(r.guruPegawaiNama || r.guruUsername) : undefined
	};
}

export async function insertModulAjar(data: {
	sekolahId: number;
	kelasId: number;
	mataPelajaranId: number;
	authUserId: number;
	materiPokok: string;
	alokasiWaktu: string;
	jumlahPertemuan: string;
	modelPembelajaran: string;
	dimensiProfil: string[];
	tujuanPembelajaranIds: number[];
	konten: ModulAjarKonten;
	status?: 'draf' | 'final';
}): Promise<number> {
	const table = getModulAjarTable();
	const isPg = db.$client?.isPostgres;
	const now = new Date().toISOString();

	const values: Record<string, unknown> = {
		sekolahId: data.sekolahId,
		kelasId: data.kelasId,
		mataPelajaranId: data.mataPelajaranId,
		authUserId: data.authUserId,
		materiPokok: data.materiPokok,
		alokasiWaktu: data.alokasiWaktu,
		jumlahPertemuan: data.jumlahPertemuan,
		modelPembelajaran: data.modelPembelajaran,
		dimensiProfil: isPg ? JSON.stringify(data.dimensiProfil) : data.dimensiProfil,
		tujuanPembelajaranIds: isPg
			? JSON.stringify(data.tujuanPembelajaranIds)
			: data.tujuanPembelajaranIds,
		konten: isPg ? JSON.stringify(data.konten) : data.konten,
		status: data.status || 'draf',
		createdAt: now,
		updatedAt: now
	};

	const res = (await db
		.insert(table)
		.values(values as typeof table.$inferInsert)
		.returning({ id: table.id })) as Array<{ id: number }>;
	return Number(res[0]?.id);
}

export async function updateModulAjar(
	id: number,
	data: {
		materiPokok?: string;
		alokasiWaktu?: string;
		jumlahPertemuan?: string;
		modelPembelajaran?: string;
		dimensiProfil?: string[];
		tujuanPembelajaranIds?: number[];
		konten?: ModulAjarKonten;
		status?: 'draf' | 'final';
	},
	sekolahId?: number
): Promise<boolean> {
	const table = getModulAjarTable();
	const isPg = db.$client?.isPostgres;
	const now = new Date().toISOString();

	const values: Record<string, unknown> = {
		updatedAt: now
	};

	if (data.materiPokok !== undefined) values.materiPokok = data.materiPokok;
	if (data.alokasiWaktu !== undefined) values.alokasiWaktu = data.alokasiWaktu;
	if (data.jumlahPertemuan !== undefined) values.jumlahPertemuan = data.jumlahPertemuan;
	if (data.modelPembelajaran !== undefined) values.modelPembelajaran = data.modelPembelajaran;
	if (data.dimensiProfil !== undefined) {
		values.dimensiProfil = isPg ? JSON.stringify(data.dimensiProfil) : data.dimensiProfil;
	}
	if (data.tujuanPembelajaranIds !== undefined) {
		values.tujuanPembelajaranIds = isPg
			? JSON.stringify(data.tujuanPembelajaranIds)
			: data.tujuanPembelajaranIds;
	}
	if (data.konten !== undefined) {
		values.konten = isPg ? JSON.stringify(data.konten) : data.konten;
	}
	if (data.status !== undefined) values.status = data.status;

	const conditions: SQL[] = [eq(table.id, id)];
	if (sekolahId) {
		conditions.push(eq(table.sekolahId, sekolahId));
	}

	await db
		.update(table)
		.set(values as typeof table.$inferInsert)
		.where(and(...conditions));
	return true;
}

export async function deleteModulAjar(id: number, sekolahId?: number): Promise<boolean> {
	const table = getModulAjarTable();
	const conditions: SQL[] = [eq(table.id, id)];
	if (sekolahId) {
		conditions.push(eq(table.sekolahId, sekolahId));
	}

	await db.delete(table).where(and(...conditions));
	return true;
}
