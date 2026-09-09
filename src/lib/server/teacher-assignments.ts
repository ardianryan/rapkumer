import db from '$lib/server/db';
import {
	tableAuthUser,
	tableAuthUserKelas,
	tableAuthUserMataPelajaran,
	tableAuthUserPembelajaran,
	tableMataPelajaran
} from '$lib/server/db/schema';
import { and, eq, inArray, sql } from 'drizzle-orm';

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
 */
export async function getTeacherAssignments(
	authUserId: number,
	pegawaiId?: number | null
): Promise<GuruMapelAssignment[]> {
	if (!authUserId || authUserId <= 0) return [];

	// 1. Ambil dari tableAuthUserPembelajaran (penugasan presisi)
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

	// 2. Ambil dari pengampuId pada tableMataPelajaran jika ada pegawaiId
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

	// Kelompokkan berdasarkan normalized nama mata pelajaran
	const mapelGroup = new Map<string, { displayNama: string; kelasIds: Set<number> }>();

	for (const row of [...pembelajaranRows, ...pengampuRows]) {
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

	// 3. Fallback jika belum pernah ada pembelajaran / pengampu
	if (mapelGroup.size === 0) {
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

		for (const m of userMapel) {
			const rawName = (m.nama ?? '').trim();
			const key = norm(rawName);
			if (!key) continue;

			if (!mapelGroup.has(key)) {
				// Hubungkan ke kelas-kelas yang di-assign ke guru ini
				const kIds = new Set<number>(assignedKelasIds);
				if (m.kelasId) kIds.add(m.kelasId);
				mapelGroup.set(key, { displayNama: rawName, kelasIds: kIds });
			}
		}
	}

	// Format ke Array of GuruMapelAssignment
	const result: GuruMapelAssignment[] = [];
	for (const group of mapelGroup.values()) {
		if (group.kelasIds.size > 0) {
			result.push({
				mapelNama: group.displayNama,
				kelasIds: Array.from(group.kelasIds).sort((a, b) => a - b)
			});
		}
	}

	return result;
}

/**
 * Menyimpan pemetaan multi-kelas multi-mapel secara transaksional dan presisi.
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
	const { authUserId, pegawaiId, assignments } = params;
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

	// 2. Cari atau buat entri tableMataPelajaran untuk setiap pasangan (kelasId, mapelNama)
	const matchedPembelajaran: Array<{ kelasId: number; mataPelajaranId: number }> = [];
	const resolvedMapelIds = new Set<number>();
	const resolvedKelasIds = new Set<number>();

	for (const assignment of finalAssignments) {
		const mapelNameKey = norm(assignment.mapelNama);

		for (const kelasId of assignment.kelasIds) {
			resolvedKelasIds.add(kelasId);

			// Cek apakah mata pelajaran sudah ada di kelas ini
			const existingMp = await client.query.tableMataPelajaran.findFirst({
				where: and(
					eq(tableMataPelajaran.kelasId, kelasId),
					sql`LOWER(TRIM(${tableMataPelajaran.nama})) = ${mapelNameKey}`
				)
			});

			let targetMapelId: number | null = existingMp?.id ?? null;

			// Jika belum ada di kelas ini, cari template dari kelas lain di sekolah ini untuk dicopy datanya
			if (!targetMapelId) {
				const templateMp = await client.query.tableMataPelajaran.findFirst({
					where: sql`LOWER(TRIM(${tableMataPelajaran.nama})) = ${mapelNameKey}`
				});

				const [inserted] = await client
					.insert(tableMataPelajaran)
					.values({
						kelasId,
						nama: assignment.mapelNama.trim(),
						namaLokal: templateMp?.namaLokal ?? null,
						kode: templateMp?.kode ?? null,
						jenis: templateMp?.jenis ?? 'belum_dipetakan',
						kkm: templateMp?.kkm ?? 0,
						pengampuId: pegawaiId ?? null
					})
					.returning({ id: tableMataPelajaran.id });

				if (inserted?.id) {
					targetMapelId = inserted.id;
				}
			}

			if (targetMapelId) {
				resolvedMapelIds.add(targetMapelId);
				matchedPembelajaran.push({
					kelasId,
					mataPelajaranId: targetMapelId
				});
			}
		}
	}

	const allMataPelajaranIds = Array.from(resolvedMapelIds);
	const allKelasIds = Array.from(resolvedKelasIds);

	// 3. Update tableAuthUserPembelajaran (penugasan presisi)
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

	// 6. Sinkronisasi pengampuId pada tableMataPelajaran (agar Distribusi Guru & Dapodik sinkron)
	if (pegawaiId) {
		// A. Mapel yang tidak lagi diajar oleh pegawai ini -> lepaskan pengampu
		if (allMataPelajaranIds.length > 0) {
			await client
				.update(tableMataPelajaran)
				.set({ pengampuId: null })
				.where(
					and(
						eq(tableMataPelajaran.pengampuId, pegawaiId),
						sql`${tableMataPelajaran.id} NOT IN (${sql.join(
							allMataPelajaranIds.map((id) => sql`${id}`),
							sql`, `
						)})`
					)
				);
		} else {
			await client
				.update(tableMataPelajaran)
				.set({ pengampuId: null })
				.where(eq(tableMataPelajaran.pengampuId, pegawaiId));
		}

		// B. Set pengampuId untuk semua mapel yang baru di-assign
		if (allMataPelajaranIds.length > 0) {
			await client
				.update(tableMataPelajaran)
				.set({ pengampuId: pegawaiId })
				.where(inArray(tableMataPelajaran.id, allMataPelajaranIds));
		}
	}

	// 7. Update tableAuthUser: primary mapel, primary kelas, dan permission kelas_pindah
	const currentUser = await client.query.tableAuthUser.findFirst({
		where: eq(tableAuthUser.id, authUserId),
		columns: { permissions: true, type: true }
	});

	if (currentUser) {
		const perms = Array.isArray(currentUser.permissions)
			? [...(currentUser.permissions as UserPermission[])]
			: [];

		// Jika guru mengajar lebih dari 1 kelas, berikan izin pindah kelas
		if (allKelasIds.length > 1 && !perms.includes('kelas_pindah' as UserPermission)) {
			perms.push('kelas_pindah' as UserPermission);
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
