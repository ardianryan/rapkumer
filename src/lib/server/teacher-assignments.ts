import db from '$lib/server/db';
import {
	tableAuthUser,
	tableAuthUserKelas,
	tableAuthUserMataPelajaran,
	tableAuthUserPembelajaran,
	tableMataPelajaran
} from '$lib/server/db/schema';
import { and, eq, sql } from 'drizzle-orm';

export type GuruMapelAssignment = {
	mapelNama: string;
	kelasIds: number[];
};

function norm(str: string | null | undefined): string {
	return (str ?? '').trim().toLowerCase();
}

/**
 * Mengambil penugasan mapel & kelas seorang guru dari database,
 * dikelompokkan berdasarkan nama mata pelajaran -> daftar ID kelas yang diajar.
 *
 * Kebijakan Data Bersih (Safe & Clean):
 * 1. Jika guru sudah memiliki penugasan di auth_user_pembelajaran (hasil mapping mandiri/admin),
 *    maka HANYA data tersebut yang digunakan (tidak mencampur atau merusak data Dapodik).
 * 2. Jika belum ada di auth_user_pembelajaran, gunakan data pengampu bawaan tarikan Dapodik
 *    sebagai default awal sebelum guru/admin melakukan mapping mandiri.
 */
export async function getTeacherAssignments(
	authUserId: number,
	pegawaiId?: number | null
): Promise<GuruMapelAssignment[]> {
	if (!authUserId || authUserId <= 0) return [];

	// 1. Ambil dari tableAuthUserPembelajaran (penugasan presisi tingkat pengguna)
	const pembelajaranRows = await db
		.select({
			kelasId: tableAuthUserPembelajaran.kelasId,
			mataPelajaranId: tableAuthUserPembelajaran.mataPelajaranId,
			mapelNama: tableMataPelajaran.nama
		})
		.from(tableAuthUserPembelajaran)
		.innerJoin(
			tableMataPelajaran,
			eq(tableMataPelajaran.id, tableAuthUserPembelajaran.mataPelajaranId)
		)
		.where(eq(tableAuthUserPembelajaran.authUserId, authUserId));

	// Jika guru sudah memiliki data penugasan presisi, gunakan data ini sepenuhnya
	if (pembelajaranRows.length > 0) {
		const mapelGroup = new Map<string, { displayNama: string; kelasIds: Set<number> }>();
		for (const row of pembelajaranRows) {
			const rawName = (row.mapelNama ?? '').trim();
			const key = norm(rawName);
			if (!key) continue;

			if (!mapelGroup.has(key)) {
				mapelGroup.set(key, { displayNama: rawName, kelasIds: new Set<number>() });
			}
			if (row.kelasId && row.kelasId > 0) {
				mapelGroup.get(key)!.kelasIds.add(row.kelasId);
			}
		}

		return Array.from(mapelGroup.values()).map((g) => ({
			mapelNama: g.displayNama,
			kelasIds: Array.from(g.kelasIds).sort((a, b) => a - b)
		}));
	}

	// 2. Default awal: Jika belum pernah dikonfigurasi mandiri, ambil dari pengampuId bawaan Dapodik
	const pengampuRows = pegawaiId
		? await db
				.select({
					kelasId: tableMataPelajaran.kelasId,
					mataPelajaranId: tableMataPelajaran.id,
					mapelNama: tableMataPelajaran.nama
				})
				.from(tableMataPelajaran)
				.where(eq(tableMataPelajaran.pengampuId, pegawaiId))
		: [];

	if (pengampuRows.length > 0) {
		const mapelGroup = new Map<string, { displayNama: string; kelasIds: Set<number> }>();
		for (const row of pengampuRows) {
			const rawName = (row.mapelNama ?? '').trim();
			const key = norm(rawName);
			if (!key) continue;

			if (!mapelGroup.has(key)) {
				mapelGroup.set(key, { displayNama: rawName, kelasIds: new Set<number>() });
			}
			if (row.kelasId && row.kelasId > 0) {
				mapelGroup.get(key)!.kelasIds.add(row.kelasId);
			}
		}

		return Array.from(mapelGroup.values()).map((g) => ({
			mapelNama: g.displayNama,
			kelasIds: Array.from(g.kelasIds).sort((a, b) => a - b)
		}));
	}

	// 3. Fallback jika belum pernah ada pembelajaran / pengampu
	const userMapel = await db
		.select({
			id: tableMataPelajaran.id,
			nama: tableMataPelajaran.nama,
			kelasId: tableMataPelajaran.kelasId
		})
		.from(tableAuthUserMataPelajaran)
		.innerJoin(
			tableMataPelajaran,
			eq(tableMataPelajaran.id, tableAuthUserMataPelajaran.mataPelajaranId)
		)
		.where(eq(tableAuthUserMataPelajaran.authUserId, authUserId));

	const userKelas = await db
		.select({ kelasId: tableAuthUserKelas.kelasId })
		.from(tableAuthUserKelas)
		.where(eq(tableAuthUserKelas.authUserId, authUserId));

	const assignedKelasIds = userKelas.map((k) => k.kelasId).filter(Boolean);

	const mapelGroup = new Map<string, { displayNama: string; kelasIds: Set<number> }>();
	for (const m of userMapel) {
		const rawName = (m.nama ?? '').trim();
		const key = norm(rawName);
		if (!key) continue;

		if (!mapelGroup.has(key)) {
			const kIds = new Set<number>(assignedKelasIds);
			if (m.kelasId) kIds.add(m.kelasId);
			mapelGroup.set(key, { displayNama: rawName, kelasIds: kIds });
		}
	}

	return Array.from(mapelGroup.values())
		.filter((g) => g.kelasIds.size > 0)
		.map((g) => ({
			mapelNama: g.displayNama,
			kelasIds: Array.from(g.kelasIds).sort((a, b) => a - b)
		}));
}

/**
 * Menyimpan pemetaan multi-kelas multi-mapel guru secara transaksional dan presisi.
 *
 * PENTING:
 * Fungsi ini HANYA mengelola hak akses akun guru (auth_user_pembelajaran, auth_user_kelas,
 * auth_user_mata_pelajaran, dan izin akun).
 * Fungsi ini TIDAK MENGUBAH tabel mata_pelajaran atau kolom pengampu_id Dapodik sama sekali,
 * sehingga data dan aturan tarikan Dapodik tetap 100% aman, asli, dan bersih.
 */
export async function syncTeacherAssignments(
	client: typeof db,
	params: {
		authUserId: number;
		pegawaiId?: number | null;
		assignments: GuruMapelAssignment[];
		sekolahId?: number | null;
	}
): Promise<{
	allMataPelajaranIds: number[];
	allKelasIds: number[];
	pembelajaranList: Array<{ kelasId: number; mataPelajaranId: number }>;
}> {
	const { authUserId, assignments } = params;
	const timestamp = new Date().toISOString();

	// 1. Bersihkan dan normalisasi input assignments
	const normalizedAssignments: Array<{ mapelNama: string; kelasIds: number[] }> = [];
	const seenMapel = new Map<string, number[]>();

	for (const a of assignments) {
		const rawNama = (a.mapelNama ?? '').trim();
		const key = norm(rawNama);
		if (!key) continue;

		const validKelasIds = Array.from(
			new Set((a.kelasIds ?? []).map(Number).filter((n) => !isNaN(n) && n > 0))
		);
		if (validKelasIds.length === 0) continue;

		if (seenMapel.has(key)) {
			// Gabungkan kelasIds jika mapel yang sama dicantumkan lebih dari sekali
			const existing = seenMapel.get(key)!;
			const merged = Array.from(new Set([...existing, ...validKelasIds]));
			seenMapel.set(key, merged);
		} else {
			seenMapel.set(key, validKelasIds);
			normalizedAssignments.push({ mapelNama: rawNama, kelasIds: validKelasIds });
		}
	}

	// Update list with merged
	const finalAssignments = normalizedAssignments.map((a) => ({
		mapelNama: a.mapelNama,
		kelasIds: seenMapel.get(norm(a.mapelNama)) ?? a.kelasIds
	}));

	// 2. Hubungkan ke data riil tableMataPelajaran yang sudah ada di sekolah/kelas
	// (Tidak membuat mapel buatan di tableMataPelajaran agar data Dapodik tetap bersih)
	const matchedPembelajaran: Array<{ kelasId: number; mataPelajaranId: number }> = [];
	const resolvedMapelIds = new Set<number>();
	const resolvedKelasIds = new Set<number>();

	for (const assignment of finalAssignments) {
		const mapelNameKey = norm(assignment.mapelNama);

		for (const kelasId of assignment.kelasIds) {
			resolvedKelasIds.add(kelasId);

			// Cocokkan dengan entri mata pelajaran yang ada di kelas ini
			const existingMp = await client.query.tableMataPelajaran.findFirst({
				where: and(
					eq(tableMataPelajaran.kelasId, kelasId),
					sql`LOWER(TRIM(${tableMataPelajaran.nama})) = ${mapelNameKey}`
				)
			});

			if (existingMp?.id) {
				resolvedMapelIds.add(existingMp.id);
				matchedPembelajaran.push({
					kelasId,
					mataPelajaranId: existingMp.id
				});
			}
		}
	}

	const allMataPelajaranIds = Array.from(resolvedMapelIds);
	const allKelasIds = Array.from(resolvedKelasIds);

	// 3. Update tableAuthUserPembelajaran (penugasan presisi tingkat pengguna)
	await client
		.delete(tableAuthUserPembelajaran)
		.where(eq(tableAuthUserPembelajaran.authUserId, authUserId));

	for (const p of matchedPembelajaran) {
		try {
			await client.insert(tableAuthUserPembelajaran).values({
				authUserId,
				kelasId: p.kelasId,
				mataPelajaranId: p.mataPelajaranId,
				createdAt: timestamp,
				updatedAt: timestamp
			});
		} catch (err) {
			const msg = String(err).toLowerCase();
			if (!msg.includes('unique') && !msg.includes('duplicate')) throw err;
		}
	}

	// 4. Update tableAuthUserKelas (hak akses kelas)
	await client.delete(tableAuthUserKelas).where(eq(tableAuthUserKelas.authUserId, authUserId));

	for (const kId of allKelasIds) {
		try {
			await client.insert(tableAuthUserKelas).values({
				authUserId,
				kelasId: kId,
				createdAt: timestamp,
				updatedAt: timestamp
			});
		} catch (err) {
			const msg = String(err).toLowerCase();
			if (!msg.includes('unique') && !msg.includes('duplicate')) throw err;
		}
	}

	// 5. Update tableAuthUserMataPelajaran (hak akses mapel)
	await client
		.delete(tableAuthUserMataPelajaran)
		.where(eq(tableAuthUserMataPelajaran.authUserId, authUserId));

	for (const mId of allMataPelajaranIds) {
		try {
			await client.insert(tableAuthUserMataPelajaran).values({
				authUserId,
				mataPelajaranId: mId,
				createdAt: timestamp,
				updatedAt: timestamp
			});
		} catch (err) {
			const msg = String(err).toLowerCase();
			if (!msg.includes('unique') && !msg.includes('duplicate')) throw err;
		}
	}

	// 6. Update tableAuthUser: primary mapel, primary kelas, dan permission kelas_pindah
	const currentUser = await client.query.tableAuthUser.findFirst({
		where: eq(tableAuthUser.id, authUserId),
		columns: { permissions: true, type: true }
	});

	if (currentUser) {
		const perms = Array.isArray(currentUser.permissions)
			? [...(currentUser.permissions as UserPermission[])]
			: [];

		// Jika guru mengajar lebih dari 1 kelas, berikan izin pindah kelas
		if (allKelasIds.length > 1 && !perms.includes('kelas_pindah')) {
			perms.push('kelas_pindah');
		}

		await client
			.update(tableAuthUser)
			.set({
				mataPelajaranId: allMataPelajaranIds.length === 1 ? allMataPelajaranIds[0] : null,
				kelasId: allKelasIds.length > 0 ? allKelasIds[0] : null,
				permissions: perms,
				updatedAt: timestamp
			})
			.where(eq(tableAuthUser.id, authUserId));
	}

	return {
		allMataPelajaranIds,
		allKelasIds,
		pembelajaranList: matchedPembelajaran
	};
}
