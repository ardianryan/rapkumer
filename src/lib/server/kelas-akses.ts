import { and, eq, sql } from 'drizzle-orm';
import db from './db';
import {
	tableAuthUserKelas,
	tableAuthUserPembelajaran,
	tableKelas,
	tableMataPelajaran,
	tableMurid,
	tablePegawai
} from './db/schema';

/**
 * Memeriksa apakah `user` memiliki izin untuk mengakses `kelasId` pada `sekolahId` yang aktif.
 * Mencerminkan pembatasan kelas per peran di src/routes/+layout.server.ts agar pemanggilan
 * API yang membaca kelas dari cookie active-kelas-id tidak dapat menembus batas otorisasi kelas.
 */
export async function canAccessKelas(
	user: NonNullable<App.Locals['user']> | null | undefined,
	sekolahId: number,
	kelasId: number
): Promise<boolean> {
	if (!user) return false;

	const kelasInSekolah = await db.query.tableKelas.findFirst({
		columns: { id: true },
		where: and(eq(tableKelas.id, kelasId), eq(tableKelas.sekolahId, sekolahId))
	});
	if (!kelasInSekolah) return false;

	if (user.type === 'admin' || user.type === 'kepala_sekolah') return true;

	if (user.type === 'wali_kelas') {
		// Kelas milik sendiri via waliKelasId atau user.kelasId
		if (user.pegawaiId) {
			const own = await db.query.tableKelas.findFirst({
				columns: { id: true },
				where: and(eq(tableKelas.id, kelasId), eq(tableKelas.waliKelasId, user.pegawaiId))
			});
			if (own) return true;
		} else if (user.kelasId && user.kelasId === kelasId) {
			return true;
		}

		// Kelas lintas hanya dengan izin kelas_pindah via tableAuthUserKelas
		const hasPindah = Array.isArray(user.permissions) && user.permissions.includes('kelas_pindah');
		if (!hasPindah) return false;

		return !!(await db.query.tableAuthUserKelas.findFirst({
			columns: { id: true },
			where: and(
				eq(tableAuthUserKelas.authUserId, user.id),
				eq(tableAuthUserKelas.kelasId, kelasId)
			)
		}));
	}

	if (user.type === 'wali_asuh') {
		if (!user.pegawaiId) return false;
		const peg = await db.query.tablePegawai.findFirst({
			columns: { nama: true },
			where: eq(tablePegawai.id, user.pegawaiId)
		});
		if (!peg?.nama) return false;
		const namaLower = peg.nama.trim().toLowerCase();
		const rows = await db
			.selectDistinct({ kelasId: tableMurid.kelasId })
			.from(tableMurid)
			.where(
				and(
					sql`LOWER(trim(${tableMurid.waliAsuhNama})) = ${namaLower}`,
					eq(tableMurid.kelasId, kelasId)
				)
			);
		return rows.length > 0;
	}

	if (user.type === 'user') {
		// Guru mapel:
		// 1. Cek di tableAuthUserKelas
		const inAuthKelas = await db.query.tableAuthUserKelas.findFirst({
			columns: { id: true },
			where: and(
				eq(tableAuthUserKelas.authUserId, user.id),
				eq(tableAuthUserKelas.kelasId, kelasId)
			)
		});
		if (inAuthKelas) return true;

		// 2. Cek di tableAuthUserPembelajaran (penugasan presisi multi-kelas multi-mapel)
		const inAuthPembelajaran = await db.query.tableAuthUserPembelajaran.findFirst({
			columns: { id: true },
			where: and(
				eq(tableAuthUserPembelajaran.authUserId, user.id),
				eq(tableAuthUserPembelajaran.kelasId, kelasId)
			)
		});
		if (inAuthPembelajaran) return true;

		// 3. Fallback ke pengampu Dapodik HANYA jika guru belum pernah memiliki mapping khusus
		if (user.pegawaiId) {
			const hasCustom = await db.query.tableAuthUserPembelajaran.findFirst({
				columns: { id: true },
				where: eq(tableAuthUserPembelajaran.authUserId, user.id)
			});
			if (!hasCustom) {
				const pengampu = await db.query.tableMataPelajaran.findFirst({
					columns: { id: true },
					where: and(
						eq(tableMataPelajaran.kelasId, kelasId),
						eq(tableMataPelajaran.pengampuId, user.pegawaiId)
					)
				});
				if (pengampu) return true;
			}
		}

		return false;
	}

	return false;
}
