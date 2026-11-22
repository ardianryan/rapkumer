import db from '$lib/server/db';
import { isWaliOfKelas, ownedKelasIdSet } from '$lib/server/kelas-akses';
import {
	tableAsesmenKokurikuler,
	tableKelas,
	tableKokurikuler,
	tableMurid
} from '$lib/server/db/schema';
import { isNilaiKategori, isProfilDimensionKey } from '$lib/kokurikuler';
import { profilPelajarPancasilaDimensions, type DimensiProfilLulusanKey } from '$lib/statics';
import { fail } from '@sveltejs/kit';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { readBufferToAoA } from '$lib/utils/excel.js';
import { cookieNames } from '$lib/utils';

const DIMENSION_KEY_SET = new Set<DimensiProfilLulusanKey>(
	profilPelajarPancasilaDimensions.map((dimension) => dimension.key)
);

const TABLE_MISSING_MESSAGE =
	'Tabel kokurikuler belum tersedia. Jalankan "pnpm db:push" untuk menerapkan migrasi terbaru.';

function sanitizeDimensions(values: string[]): DimensiProfilLulusanKey[] {
	const unique = new Set<DimensiProfilLulusanKey>();
	for (const value of values) {
		if (DIMENSION_KEY_SET.has(value as DimensiProfilLulusanKey)) {
			unique.add(value as DimensiProfilLulusanKey);
		}
	}
	return Array.from(unique);
}

function isTableMissingError(error: unknown) {
	return (
		error instanceof Error &&
		error.message.includes('no such table') &&
		error.message.includes('kokurikuler')
	);
}

function parseDimensiList(raw: unknown): DimensiProfilLulusanKey[] {
	if (Array.isArray(raw)) {
		return sanitizeDimensions(raw.map((item) => String(item ?? '')));
	}
	if (typeof raw === 'string') {
		try {
			const parsed = JSON.parse(raw);
			return Array.isArray(parsed)
				? sanitizeDimensions(parsed.map((item) => String(item ?? '')))
				: [];
		} catch (error) {
			console.error('Gagal mengurai dimensi kokurikuler', error);
			return [];
		}
	}
	return [];
}

type DaftarKelasItem = {
	id: number;
	nama: string;
	fase?: string | null;
	waliKelas?: { id: number; nama: string } | null;
};

async function loadAdminKokurikulerMonitoring(daftarKelas: DaftarKelasItem[]) {
	if (daftarKelas.length === 0) {
		return { activities: [] };
	}

	const kelasIds = daftarKelas.map((k) => k.id);
	const [allKokurikuler, allMurid] = await Promise.all([
		db.query.tableKokurikuler.findMany({
			columns: {
				id: true,
				kelasId: true,
				kode: true,
				tujuan: true,
				dimensi: true,
				createdAt: true
			},
			where: inArray(tableKokurikuler.kelasId, kelasIds),
			orderBy: [asc(tableKokurikuler.kode), asc(tableKokurikuler.createdAt)]
		}),
		db.query.tableMurid.findMany({
			columns: { id: true, kelasId: true },
			where: inArray(tableMurid.kelasId, kelasIds)
		})
	]);

	if (allKokurikuler.length === 0) {
		return { activities: [] };
	}

	const muridIdsByKelas = new Map<number, Set<number>>();
	for (const m of allMurid) {
		if (m.kelasId == null) continue;
		let set = muridIdsByKelas.get(m.kelasId);
		if (!set) {
			set = new Set<number>();
			muridIdsByKelas.set(m.kelasId, set);
		}
		set.add(m.id);
	}

	const kokurikulerIds = allKokurikuler.map((k) => k.id);
	const allAsesmen = await db.query.tableAsesmenKokurikuler.findMany({
		columns: {
			muridId: true,
			kokurikulerId: true,
			dimensi: true,
			kategori: true
		},
		where: inArray(tableAsesmenKokurikuler.kokurikulerId, kokurikulerIds)
	});

	// Map: kokurikulerId -> muridId -> Set<dimensiKey>
	const assessedByKokurikuler = new Map<number, Map<number, Set<string>>>();
	for (const row of allAsesmen) {
		if (!isProfilDimensionKey(row.dimensi) || !isNilaiKategori(row.kategori)) {
			continue;
		}
		let muridMap = assessedByKokurikuler.get(row.kokurikulerId);
		if (!muridMap) {
			muridMap = new Map();
			assessedByKokurikuler.set(row.kokurikulerId, muridMap);
		}
		let dimSet = muridMap.get(row.muridId);
		if (!dimSet) {
			dimSet = new Set();
			muridMap.set(row.muridId, dimSet);
		}
		dimSet.add(row.dimensi);
	}

	// Group kokurikuler records by normalized kode across classes
	const activityByKode = new Map<
		string,
		{
			kode: string;
			tujuan: string;
			byKelasId: Map<number, { id: number; dimensiKeys: DimensiProfilLulusanKey[] }>;
		}
	>();

	for (const row of allKokurikuler) {
		const kodeKey = row.kode.trim().toUpperCase();
		if (!kodeKey) continue;
		let group = activityByKode.get(kodeKey);
		if (!group) {
			group = {
				kode: kodeKey,
				tujuan: row.tujuan,
				byKelasId: new Map()
			};
			activityByKode.set(kodeKey, group);
		}
		if (!group.byKelasId.has(row.kelasId)) {
			group.byKelasId.set(row.kelasId, {
				id: row.id,
				dimensiKeys: parseDimensiList(row.dimensi)
			});
		}
	}

	const sortedKelas = [...daftarKelas].sort((a, b) =>
		a.nama.localeCompare(b.nama, 'id', { numeric: true, sensitivity: 'base' })
	);

	const activities = Array.from(activityByKode.values()).map((group) => ({
		kode: group.kode,
		tujuan: group.tujuan,
		classes: sortedKelas.map((kelas) => {
			const muridSet = muridIdsByKelas.get(kelas.id);
			const totalMurid = muridSet?.size ?? 0;
			const entry = group.byKelasId.get(kelas.id);

			if (!entry) {
				return {
					kelasId: kelas.id,
					kelasNama: kelas.nama,
					fase: kelas.fase ?? null,
					waliKelasNama: kelas.waliKelas?.nama ?? null,
					kokurikulerId: null,
					dimensiCount: 0,
					totalMurid,
					muridLengkap: 0,
					persentase: 0,
					status: 'no_activity' as const
				};
			}

			const expectedDims = entry.dimensiKeys;
			const muridAssessments = assessedByKokurikuler.get(entry.id);
			let muridLengkap = 0;

			if (totalMurid > 0 && expectedDims.length > 0 && muridSet && muridAssessments) {
				for (const muridId of muridSet) {
					const filledDims = muridAssessments.get(muridId);
					if (filledDims && expectedDims.every((d) => filledDims.has(d))) {
						muridLengkap += 1;
					}
				}
			}

			const persentase = totalMurid > 0 ? Math.round((muridLengkap / totalMurid) * 100) : 0;
			const status: 'complete' | 'incomplete' =
				totalMurid > 0 && muridLengkap === totalMurid ? 'complete' : 'incomplete';

			return {
				kelasId: kelas.id,
				kelasNama: kelas.nama,
				fase: kelas.fase ?? null,
				waliKelasNama: kelas.waliKelas?.nama ?? null,
				kokurikulerId: entry.id,
				dimensiCount: expectedDims.length,
				totalMurid,
				muridLengkap,
				persentase,
				status
			};
		})
	}));

	return { activities };
}

export async function load({ depends, parent, locals }) {
	depends('app:kokurikuler');
	const { kelasAktif, daftarKelas } = await parent();
	const kelasId = kelasAktif?.id ?? null;
	const isAdmin = (locals.user as { type?: string } | null)?.type === 'admin';

	let kokurikulerRaw: Awaited<ReturnType<typeof db.query.tableKokurikuler.findMany>> = [];
	let tableReady = true;

	if (kelasId) {
		try {
			kokurikulerRaw = await db.query.tableKokurikuler.findMany({
				where: eq(tableKokurikuler.kelasId, kelasId),
				orderBy: asc(tableKokurikuler.createdAt)
			});
		} catch (error) {
			if (isTableMissingError(error)) {
				tableReady = false;
				kokurikulerRaw = [];
			} else {
				throw error;
			}
		}
	}

	const typedDaftarKelas = (daftarKelas ?? []) as DaftarKelasItem[];
	let adminMonitoring: Awaited<ReturnType<typeof loadAdminKokurikulerMonitoring>> | null = null;
	if (isAdmin && tableReady) {
		try {
			adminMonitoring = await loadAdminKokurikulerMonitoring(typedDaftarKelas);
		} catch (error) {
			if (!isTableMissingError(error)) {
				throw error;
			}
		}
	}

	return {
		kelasId,
		isAdmin,
		tableReady,
		adminMonitoring,
		availableKelas: typedDaftarKelas.map((k) => ({
			id: k.id,
			nama: k.nama,
			fase: k.fase ?? null
		})),
		kokurikuler: kokurikulerRaw.map((item) => ({
			...item,
			dimensi: parseDimensiList(item.dimensi)
		})),
		dimensiPilihan: profilPelajarPancasilaDimensions
	};
}

export const actions = {
	add: async ({ request, locals }) => {
		const formData = await request.formData();
		const kelasIdRaw = formData.get('kelasId');
		const kode = formData.get('kode')?.toString().trim().toUpperCase() ?? '';
		const tujuan = formData.get('kokurikuler')?.toString().trim() ?? '';
		const dimensi = sanitizeDimensions(
			formData.getAll('dimensi').map((value) => value?.toString() ?? '')
		);
		const targetKelasIdsRaw = formData.getAll('targetKelasIds');
		const extraKelasIds = targetKelasIdsRaw.map(Number).filter((n) => Number.isInteger(n) && n > 0);

		if (!kelasIdRaw) {
			return fail(400, { fail: 'Kelas aktif tidak ditemukan' });
		}

		const kelasId = Number(kelasIdRaw);
		if (!Number.isInteger(kelasId)) {
			return fail(400, { fail: 'Kelas tidak valid' });
		}

		const allTargetKelasIds = Array.from(new Set([kelasId, ...extraKelasIds]));

		// Server-side permission: wali_kelas may only add for their own kelas
		if (locals?.user && (locals.user as unknown as { type?: string }).type === 'wali_kelas') {
			const u = locals.user as { pegawaiId?: number | null };

			const owned = u.pegawaiId
				? await db.query.tableKelas.findFirst({
						columns: { id: true },
						where: and(eq(tableKelas.id, kelasId), eq(tableKelas.waliKelasId, u.pegawaiId))
					})
				: null;
			if (!owned) {
				return fail(403, {
					fail: 'Anda tidak memiliki izin untuk menambah kokurikuler di kelas ini.'
				});
			}
		}

		if (!dimensi.length) {
			return fail(400, { fail: 'Pilih minimal satu dimensi profil lulusan' });
		}

		if (!kode) {
			return fail(400, { fail: 'Kode kokurikuler wajib diisi' });
		}

		if (!tujuan) {
			return fail(400, { fail: 'Kegiatan kokurikuler wajib diisi' });
		}

		try {
			const existing = await db.query.tableKokurikuler.findFirst({
				columns: { id: true },
				where: and(eq(tableKokurikuler.kelasId, kelasId), eq(tableKokurikuler.kode, kode))
			});
			if (existing) {
				return fail(400, { fail: 'Kode sudah digunakan di kelas ini' });
			}

			for (const targetId of allTargetKelasIds) {
				const existInTarget = await db.query.tableKokurikuler.findFirst({
					columns: { id: true },
					where: and(eq(tableKokurikuler.kelasId, targetId), eq(tableKokurikuler.kode, kode))
				});
				if (!existInTarget) {
					await db.insert(tableKokurikuler).values({
						kelasId: targetId,
						kode,
						dimensi,
						tujuan
					});
				}
			}

			return { message: 'Kokurikuler berhasil ditambahkan', kode };
		} catch (error) {
			if (isTableMissingError(error)) {
				return fail(500, { fail: TABLE_MISSING_MESSAGE });
			}
			throw error;
		}
	},

	delete: async ({ request, locals }) => {
		const formData = await request.formData();
		const idsRaw = formData.get('ids');
		const singleIdRaw = formData.get('id');

		let ids: number[] = [];
		if (idsRaw) {
			try {
				const parsed = JSON.parse(idsRaw.toString());
				if (Array.isArray(parsed))
					ids = parsed.map(Number).filter((n) => Number.isInteger(n) && n > 0);
			} catch {
				ids = idsRaw
					.toString()
					.split(',')
					.map((v) => Number(v.trim()))
					.filter((n) => Number.isInteger(n) && n > 0);
			}
		} else if (singleIdRaw) {
			const id = Number(singleIdRaw);
			if (Number.isInteger(id) && id > 0) ids = [id];
		}

		if (!ids.length) {
			return fail(400, { fail: 'Pilih kokurikuler yang ingin dihapus' });
		}

		try {
			// wali_kelas hanya boleh menghapus data di kelas yang dia wali
			const deleteUser = locals.user as { type?: string; pegawaiId?: number | null } | null;
			if (deleteUser?.type === 'wali_kelas') {
				const ownedIds = await ownedKelasIdSet(deleteUser);
				const rows = await db.query.tableKokurikuler.findMany({
					columns: { id: true, kelasId: true },
					where: inArray(tableKokurikuler.id, ids)
				});
				if (rows.some((r) => !ownedIds.has(r.kelasId))) {
					return fail(403, {
						fail: 'Anda tidak memiliki izin untuk menghapus di kelas ini.'
					});
				}
			}
			await db.delete(tableKokurikuler).where(inArray(tableKokurikuler.id, ids));
		} catch (error) {
			if (isTableMissingError(error)) {
				return fail(500, { fail: TABLE_MISSING_MESSAGE });
			}
			throw error;
		}

		return { message: `${ids.length} kokurikuler berhasil dihapus` };
	},
	update: async ({ request, locals }) => {
		const formData = await request.formData();
		const idRaw = formData.get('id');
		const kelasIdRaw = formData.get('kelasId');
		const kode = formData.get('kode')?.toString().trim().toUpperCase() ?? '';
		const tujuan = formData.get('kokurikuler')?.toString().trim() ?? '';
		const dimensi = sanitizeDimensions(
			formData.getAll('dimensi').map((value) => value?.toString() ?? '')
		);

		if (!idRaw) {
			return fail(400, { fail: 'ID kokurikuler tidak ditemukan' });
		}

		const id = Number(idRaw);
		if (!Number.isInteger(id) || id <= 0) {
			return fail(400, { fail: 'ID kokurikuler tidak valid' });
		}

		if (!kelasIdRaw) {
			return fail(400, { fail: 'Kelas aktif tidak ditemukan' });
		}

		const kelasId = Number(kelasIdRaw);
		if (!Number.isInteger(kelasId)) {
			return fail(400, { fail: 'Kelas tidak valid' });
		}

		// Server-side permission: wali_kelas may only update for their own kelas
		const updateUser = locals.user as { type?: string; pegawaiId?: number | null } | null;
		if (updateUser?.type === 'wali_kelas' && !(await isWaliOfKelas(updateUser, kelasId))) {
			return fail(403, {
				fail: 'Anda tidak memiliki izin untuk mengubah di kelas ini.'
			});
		}

		if (!dimensi.length) {
			return fail(400, { fail: 'Pilih minimal satu dimensi profil lulusan' });
		}

		if (!kode) {
			return fail(400, { fail: 'Kode kokurikuler wajib diisi' });
		}

		if (!tujuan) {
			return fail(400, { fail: 'Kegiatan kokurikuler wajib diisi' });
		}

		try {
			const existing = await db.query.tableKokurikuler.findFirst({
				columns: { id: true },
				where: and(eq(tableKokurikuler.kelasId, kelasId), eq(tableKokurikuler.kode, kode))
			});
			if (existing && existing.id !== id) {
				return fail(400, { fail: 'Kode sudah digunakan di kelas ini' });
			}

			const updated = await db
				.update(tableKokurikuler)
				.set({ kode, dimensi, tujuan, updatedAt: new Date().toISOString() })
				.where(and(eq(tableKokurikuler.id, id), eq(tableKokurikuler.kelasId, kelasId)))
				.returning({ id: tableKokurikuler.id });

			if (!updated.length) {
				return fail(404, { fail: 'Kokurikuler tidak ditemukan atau sudah dihapus' });
			}

			return { message: 'Kokurikuler berhasil diperbarui', id };
		} catch (error) {
			if (isTableMissingError(error)) {
				return fail(500, { fail: TABLE_MISSING_MESSAGE });
			}
			throw error;
		}
	},

	import_kokurikuler: async ({ request, cookies, locals }) => {
		const kelasIdCookie = cookies.get(cookieNames.ACTIVE_KELAS_ID) || null;
		const kelasId = kelasIdCookie ? Number(kelasIdCookie) : null;
		if (!kelasId || !Number.isFinite(kelasId)) {
			return fail(400, { fail: 'Pilih kelas aktif terlebih dahulu.' });
		}

		// Server-side permission: wali_kelas may only import for their own kelas
		const importUser = locals.user as { type?: string; pegawaiId?: number | null } | null;
		if (importUser?.type === 'wali_kelas' && !(await isWaliOfKelas(importUser, kelasId))) {
			return fail(403, { fail: 'Anda tidak memiliki izin untuk mengimpor di kelas ini.' });
		}

		const MAX_IMPORT_FILE_SIZE = 2 * 1024 * 1024; // 2MB

		function normalizeCell(value: unknown) {
			if (value == null) return '';
			if (typeof value === 'string') return value.trim();
			if (typeof value === 'number') return value.toString().trim();
			return String(value).trim();
		}

		function isXlsxMime(type: string | null | undefined) {
			if (!type) return false;
			return type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
		}

		const formData = await request.formData();
		const file = formData.get('file');
		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { fail: 'File Excel belum dipilih.' });
		}

		if (file.size > MAX_IMPORT_FILE_SIZE) {
			return fail(400, { fail: 'Ukuran file melebihi 2MB.' });
		}

		const filename = (file.name ?? '').toLowerCase();
		if (!filename.endsWith('.xlsx') && !isXlsxMime(file.type)) {
			return fail(400, { fail: 'Format file harus .xlsx.' });
		}

		let rawRows;
		try {
			const buffer = Buffer.from(await file.arrayBuffer());
			rawRows = await readBufferToAoA(buffer);
		} catch (error) {
			console.error('Gagal membaca file Excel', error);
			return fail(400, { fail: 'Gagal membaca file Excel. Pastikan format sesuai.' });
		}

		if (!Array.isArray(rawRows) || rawRows.length === 0) {
			return fail(400, { fail: 'File Excel tidak berisi data.' });
		}

		// Expect header row containing: Kode, Dimensi, Kegiatan
		const headerIndex = rawRows.findIndex((row) => {
			const cols = (row ?? []).map((c) => normalizeCell(c).toLowerCase());
			return cols.some((c) => c.includes('kode')) && cols.some((c) => c.includes('kegiatan'));
		});

		if (headerIndex === -1) {
			return fail(400, {
				fail: 'Template tidak valid. Pastikan kolom Kode dan Kegiatan tersedia.'
			});
		}

		const dataRows = rawRows.slice(headerIndex + 1).filter(Boolean);
		if (!dataRows.length) return fail(400, { fail: 'Tidak ada data pada file.' });

		const dimensionKeyByLabel = new Map<string, DimensiProfilLulusanKey>();
		for (const dimension of profilPelajarPancasilaDimensions) {
			dimensionKeyByLabel.set(dimension.key.toLowerCase(), dimension.key);
			dimensionKeyByLabel.set(dimension.label.toLowerCase(), dimension.key);
		}

		function parseDimensions(value: string): DimensiProfilLulusanKey[] {
			const result: DimensiProfilLulusanKey[] = [];
			for (const part of value.split(',')) {
				const key = dimensionKeyByLabel.get(normalizeCell(part).toLowerCase());
				if (key && !result.includes(key)) result.push(key);
			}
			return result;
		}

		type ParsedEntry = { kode: string; dimensi: DimensiProfilLulusanKey[]; tujuan: string };
		const parsed: ParsedEntry[] = [];

		for (const row of dataRows as (string | number | null | undefined)[][]) {
			const rawKode = normalizeCell(row?.[0] ?? '');
			const rawDimensi = normalizeCell(row?.[1] ?? '');
			const rawTujuan = normalizeCell(row?.[2] ?? '');

			if (!rawKode) continue; // skip rows without kode
			const dimensi = parseDimensions(rawDimensi || '');
			if (dimensi.length === 0) continue; // skip rows without valid dimensi
			parsed.push({
				kode: rawKode.toUpperCase(),
				dimensi,
				tujuan: rawTujuan
			});
		}

		if (parsed.length === 0) return fail(400, { fail: 'Tidak ada data yang valid pada file.' });

		// Persist: insert new kokurikuler, skip existing kode per kelas
		let inserted = 0;
		let skipped = 0;

		try {
			const existing = await db.query.tableKokurikuler.findMany({
				columns: { kode: true },
				where: eq(tableKokurikuler.kelasId, kelasId)
			});
			const existingCodes = new Set(existing.map((row) => row.kode.toLowerCase()));

			const unique = new Map<string, ParsedEntry>();
			for (const entry of parsed) {
				const key = entry.kode.toLowerCase();
				if (existingCodes.has(key) || unique.has(key)) {
					skipped += 1;
					continue;
				}
				unique.set(key, entry);
			}

			if (unique.size > 0) {
				await db.insert(tableKokurikuler).values(
					Array.from(unique.values()).map((entry) => ({
						kelasId,
						kode: entry.kode,
						dimensi: entry.dimensi,
						tujuan: entry.tujuan
					}))
				);
				inserted = unique.size;
			}
		} catch (error) {
			if (isTableMissingError(error)) {
				return fail(500, { fail: TABLE_MISSING_MESSAGE });
			}
			throw error;
		}

		const parts = [`Impor selesai: ${inserted} kokurikuler baru ditambahkan.`];
		if (skipped > 0) {
			parts.push(`${skipped} diabaikan karena kode sudah ada di kelas ini.`);
		}
		return { message: parts.join(' ') };
	}
};
