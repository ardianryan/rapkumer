import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import db from '$lib/server/db';
import {
	tableAuthUser,
	tableAuthUserKelas,
	tableAuthUserMataPelajaran,
	tableAuthUserPembelajaran,
	tableAuthZitadelUser,
	tableKelas,
	tableMataPelajaran,
	tablePegawai
} from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/login');
	}

	const userId = locals.user.id;

	// Cek apakah akun ini terhubung dengan ZITADEL
	const zitadelUser = await db.query.tableAuthZitadelUser.findFirst({
		where: eq(tableAuthZitadelUser.userId, userId)
	});

	// Ambil data profil pegawai
	let pegawai: typeof tablePegawai.$inferSelect | undefined;
	if (locals.user.pegawaiId) {
		pegawai = await db.query.tablePegawai.findFirst({
			where: eq(tablePegawai.id, locals.user.pegawaiId)
		});
	}

	// Sekolah aktif pengguna
	let sekolahId = locals.user.sekolahId ?? locals.sekolah?.id;
	if (!sekolahId) {
		const firstSekolah = await db.query.tableSekolah.findFirst({ columns: { id: true } });
		sekolahId = firstSekolah?.id;
	}

	// Ambil mata pelajaran yang saat ini ditugaskan ke guru ini
	const assignedMapelRows = await db
		.select({
			id: tableMataPelajaran.id,
			nama: tableMataPelajaran.nama,
			kode: tableMataPelajaran.kode,
			kelasId: tableMataPelajaran.kelasId
		})
		.from(tableAuthUserMataPelajaran)
		.innerJoin(
			tableMataPelajaran,
			eq(tableMataPelajaran.id, tableAuthUserMataPelajaran.mataPelajaranId)
		)
		.where(eq(tableAuthUserMataPelajaran.authUserId, userId));

	// Ambil kelas yang saat ini ditugaskan ke guru ini
	const assignedKelasRows = await db
		.select({
			id: tableKelas.id,
			nama: tableKelas.nama,
			fase: tableKelas.fase
		})
		.from(tableAuthUserKelas)
		.innerJoin(tableKelas, eq(tableKelas.id, tableAuthUserKelas.kelasId))
		.where(eq(tableAuthUserKelas.authUserId, userId));

	// Ambil seluruh daftar mata pelajaran aktif di sekolah (dari Dapodik/Rapkumer)
	let availableMapel: { id: number; nama: string; kode: string | null }[] = [];
	let availableKelas: { id: number; nama: string; fase: string | null }[] = [];

	if (sekolahId) {
		const rawMapel = await db
			.select({
				id: tableMataPelajaran.id,
				nama: tableMataPelajaran.nama,
				kode: tableMataPelajaran.kode
			})
			.from(tableMataPelajaran)
			.innerJoin(tableKelas, eq(tableKelas.id, tableMataPelajaran.kelasId))
			.where(eq(tableKelas.sekolahId, sekolahId));

		// Deduplikasi nama mata pelajaran untuk pilihan yang bersih
		const mapelMap = new Map<string, (typeof rawMapel)[0]>();
		for (const m of rawMapel) {
			const cleanName = (m.nama ?? '').trim();
			if (cleanName && !mapelMap.has(cleanName.toLowerCase())) {
				mapelMap.set(cleanName.toLowerCase(), m);
			}
		}
		availableMapel = Array.from(mapelMap.values());

		availableKelas = await db.query.tableKelas.findMany({
			where: eq(tableKelas.sekolahId, sekolahId),
			columns: { id: true, nama: true, fase: true },
			orderBy: (table, { asc }) => [asc(table.nama)]
		});
	}

	return {
		user: locals.user,
		pegawai,
		zitadelUser,
		assignedMapel: assignedMapelRows,
		assignedKelas: assignedKelasRows,
		availableMapel,
		availableKelas
	};
};

export const actions: Actions = {
	/**
	 * Guru menyatakan penugasan saat ini SUDAH SESUAI
	 */
	confirmCurrent: async ({ locals }) => {
		if (!locals.user) throw redirect(303, '/login');

		await db
			.update(tableAuthZitadelUser)
			.set({ isOnboarded: true })
			.where(eq(tableAuthZitadelUser.userId, locals.user.id));

		throw redirect(303, '/');
	},

	/**
	 * Guru melakukan penyesuaian (mapping mandiri) kelas dan mata pelajaran
	 */
	updateMapping: async ({ request, locals }) => {
		if (!locals.user) throw redirect(303, '/login');

		const formData = await request.formData();
		const mapelIds = formData
			.getAll('mapelIds')
			.map((v) => Number(v))
			.filter((n) => !Number.isNaN(n) && n > 0);
		const kelasIds = formData
			.getAll('kelasIds')
			.map((v) => Number(v))
			.filter((n) => !Number.isNaN(n) && n > 0);

		const userId = locals.user.id;

		try {
			// 1. Update relasi mata pelajaran
			await db
				.delete(tableAuthUserMataPelajaran)
				.where(eq(tableAuthUserMataPelajaran.authUserId, userId));

			for (const mapelId of mapelIds) {
				await db.insert(tableAuthUserMataPelajaran).values({
					authUserId: userId,
					mataPelajaranId: mapelId
				});
			}

			// 2. Update relasi kelas
			await db.delete(tableAuthUserKelas).where(eq(tableAuthUserKelas.authUserId, userId));

			for (const kelasId of kelasIds) {
				await db.insert(tableAuthUserKelas).values({
					authUserId: userId,
					kelasId
				});
			}

			// 3. Update relasi presisi pembelajaran (auth_user_pembelajaran)
			await db
				.delete(tableAuthUserPembelajaran)
				.where(eq(tableAuthUserPembelajaran.authUserId, userId));

			for (const mapelId of mapelIds) {
				const mp = await db.query.tableMataPelajaran.findFirst({
					where: eq(tableMataPelajaran.id, mapelId),
					columns: { id: true, kelasId: true }
				});
				if (mp?.kelasId) {
					try {
						await db.insert(tableAuthUserPembelajaran).values({
							authUserId: userId,
							kelasId: mp.kelasId,
							mataPelajaranId: mp.id
						});
					} catch {
						// ignore duplicate
					}
				}
			}

			// Set primary mapel jika ada
			if (mapelIds.length > 0) {
				await db
					.update(tableAuthUser)
					.set({ mataPelajaranId: mapelIds[0] })
					.where(eq(tableAuthUser.id, userId));
			}

			// 3. Tandai onboarding selesai
			await db
				.update(tableAuthZitadelUser)
				.set({ isOnboarded: true })
				.where(eq(tableAuthZitadelUser.userId, userId));
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Terjadi kesalahan';
			console.error('[onboarding action] Gagal menyimpan mapping mandiri:', err);
			return fail(500, {
				message: `Gagal menyimpan pemetaan penugasan: ${message}`
			});
		}

		throw redirect(303, '/');
	}
};
