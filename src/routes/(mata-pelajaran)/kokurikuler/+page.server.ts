import db from '$lib/server/db';
import { tableKelas, tableKokurikuler } from '$lib/server/db/schema';
import { profilPelajarPancasilaDimensions, type DimensiProfilLulusanKey } from '$lib/statics';
import { fail, redirect } from '@sveltejs/kit';
import { and, asc, eq } from 'drizzle-orm';

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

export async function load({ depends, parent }) {
	depends('app:kokurikuler');
	const { kelasAktif, daftarKelas } = await parent();
	const kelasId = kelasAktif?.id ?? null;

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

	return {
		kelasId,
		tableReady,
		availableKelas: (daftarKelas ?? []).map((k) => ({
			id: k.id,
			nama: k.nama,
			fase: k.fase ?? null
		})),
		kokurikuler: kokurikulerRaw.map((item) => ({
			...item,
			dimensi: Array.isArray(item.dimensi)
				? (item.dimensi as DimensiProfilLulusanKey[])
				: sanitizeDimensions(
						typeof item.dimensi === 'string'
							? (() => {
									try {
										return JSON.parse(item.dimensi) as string[];
									} catch (error) {
										console.error('Gagal mengurai dimensi kokurikuler', error);
										return [];
									}
								})()
							: []
					)
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
			const u = locals.user as { kelasId?: number; permissions?: string[]; pegawaiId?: number };
			const hasAccessOther = Array.isArray(u.permissions)
				? u.permissions.includes('kelas_pindah')
				: false;

			let isOwnClass = false;
			const userKelasId = u.kelasId;
			if (userKelasId != null && Number.isInteger(Number(userKelasId))) {
				isOwnClass = Number(userKelasId) === kelasId;
			} else if (u.pegawaiId) {
				const owned = await db.query.tableKelas.findFirst({
					columns: { id: true },
					where: and(eq(tableKelas.id, kelasId), eq(tableKelas.waliKelasId, u.pegawaiId))
				});
				isOwnClass = !!owned;
			}

			if (!isOwnClass && !hasAccessOther) {
				throw redirect(303, `/forbidden?required=kelas_id`);
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
		const idRaw = formData.get('id');
		const kelasIdRaw = formData.get('kelasId');

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

		// Server-side permission: wali_kelas may only delete from their own kelas
		if (locals?.user && (locals.user as unknown as { type?: string }).type === 'wali_kelas') {
			const u = locals.user as { kelasId?: number; permissions?: string[]; pegawaiId?: number };
			const hasAccessOther = Array.isArray(u.permissions)
				? u.permissions.includes('kelas_pindah')
				: false;

			let isOwnClass = false;
			const userKelasId = u.kelasId;
			if (userKelasId != null && Number.isInteger(Number(userKelasId))) {
				isOwnClass = Number(userKelasId) === kelasId;
			} else if (u.pegawaiId) {
				const owned = await db.query.tableKelas.findFirst({
					columns: { id: true },
					where: and(eq(tableKelas.id, kelasId), eq(tableKelas.waliKelasId, u.pegawaiId))
				});
				isOwnClass = !!owned;
			}

			if (!isOwnClass && !hasAccessOther) {
				throw redirect(303, `/forbidden?required=kelas_id`);
			}
		}

		try {
			const deleted = await db
				.delete(tableKokurikuler)
				.where(and(eq(tableKokurikuler.id, id), eq(tableKokurikuler.kelasId, kelasId)))
				.returning({ id: tableKokurikuler.id });

			if (!deleted.length) {
				return fail(404, { fail: 'Kokurikuler tidak ditemukan atau sudah dihapus' });
			}

			return { message: 'Kokurikuler berhasil dihapus', id };
		} catch (error) {
			if (isTableMissingError(error)) {
				return fail(500, { fail: TABLE_MISSING_MESSAGE });
			}
			throw error;
		}
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
		if (locals?.user && (locals.user as unknown as { type?: string }).type === 'wali_kelas') {
			const u = locals.user as { kelasId?: number; permissions?: string[]; pegawaiId?: number };
			const hasAccessOther = Array.isArray(u.permissions)
				? u.permissions.includes('kelas_pindah')
				: false;

			let isOwnClass = false;
			const userKelasId = u.kelasId;
			if (userKelasId != null && Number.isInteger(Number(userKelasId))) {
				isOwnClass = Number(userKelasId) === kelasId;
			} else if (u.pegawaiId) {
				const owned = await db.query.tableKelas.findFirst({
					columns: { id: true },
					where: and(eq(tableKelas.id, kelasId), eq(tableKelas.waliKelasId, u.pegawaiId))
				});
				isOwnClass = !!owned;
			}

			if (!isOwnClass && !hasAccessOther) {
				throw redirect(303, `/forbidden?required=kelas_id`);
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
	}
};
