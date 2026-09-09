import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import db from '$lib/server/db';
import {
	tableAuthZitadelUser,
	tableKelas,
	tableMataPelajaran,
	tablePegawai
} from '$lib/server/db/schema';
import { eq, inArray } from 'drizzle-orm';
import {
	getTeacherAssignments,
	syncTeacherAssignments,
	type GuruMapelAssignment
} from '$lib/server/teacher-assignments';

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

	// Ambil penugasan presisi guru saat ini (multi-mapel multi-kelas)
	const assignedAssignments = await getTeacherAssignments(userId, locals.user.pegawaiId);

	// Ambil seluruh daftar kelas aktif di sekolah ini
	let availableKelas: { id: number; nama: string; fase: string | null }[] = [];
	let availableMapel: { id: number; nama: string; kode: string | null }[] = [];

	if (sekolahId) {
		availableKelas = await db.query.tableKelas.findMany({
			where: eq(tableKelas.sekolahId, sekolahId),
			columns: { id: true, nama: true, fase: true },
			orderBy: (table, { asc }) => [asc(table.nama)]
		});

		const rawMapel = await db
			.select({
				id: tableMataPelajaran.id,
				nama: tableMataPelajaran.nama,
				kode: tableMataPelajaran.kode
			})
			.from(tableMataPelajaran)
			.innerJoin(tableKelas, eq(tableKelas.id, tableMataPelajaran.kelasId))
			.where(eq(tableKelas.sekolahId, sekolahId));

		// Deduplikasi nama mata pelajaran
		const mapelMap = new Map<string, (typeof rawMapel)[0]>();
		for (const m of rawMapel) {
			const cleanName = (m.nama ?? '').trim();
			if (cleanName && !mapelMap.has(cleanName.toLowerCase())) {
				mapelMap.set(cleanName.toLowerCase(), m);
			}
		}
		availableMapel = Array.from(mapelMap.values());
	}

	// Ambil informasi detail kelas yang saat ini ditugaskan untuk ringkasan UI
	const allAssignedKelasIds = Array.from(new Set(assignedAssignments.flatMap((a) => a.kelasIds)));

	const assignedKelasDetails =
		allAssignedKelasIds.length > 0
			? await db.query.tableKelas.findMany({
					where: inArray(tableKelas.id, allAssignedKelasIds),
					columns: { id: true, nama: true, fase: true },
					orderBy: (table, { asc }) => [asc(table.nama)]
				})
			: [];

	return {
		user: locals.user,
		pegawai,
		zitadelUser,
		assignedAssignments,
		assignedKelasDetails,
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
		const userId = locals.user.id;
		const sekolahId = locals.user.sekolahId ?? locals.sekolah?.id ?? null;

		let assignments: GuruMapelAssignment[] = [];

		// 1. Coba parse dari format terstruktur JSON multi-mapel
		const assignmentsRaw = formData.get('assignments');
		if (assignmentsRaw && typeof assignmentsRaw === 'string') {
			try {
				const parsed = JSON.parse(assignmentsRaw);
				if (Array.isArray(parsed)) {
					assignments = parsed
						.map((item: { mapelNama?: string; kelasIds?: number[] }) => ({
							mapelNama: String(item.mapelNama ?? '').trim(),
							kelasIds: Array.isArray(item.kelasIds)
								? item.kelasIds.map(Number).filter((n) => !isNaN(n) && n > 0)
								: []
						}))
						.filter((a) => a.mapelNama.length > 0 && a.kelasIds.length > 0);
				}
			} catch (err) {
				console.warn('[onboarding] Gagal parse assignments JSON:', err);
			}
		}

		// 2. Fallback jika dikirim lewat format legacy terpisah
		if (assignments.length === 0) {
			const mapelIds = formData
				.getAll('mapelIds')
				.map((v) => Number(v))
				.filter((n) => !Number.isNaN(n) && n > 0);
			const kelasIds = formData
				.getAll('kelasIds')
				.map((v) => Number(v))
				.filter((n) => !Number.isNaN(n) && n > 0);

			if (mapelIds.length > 0 && kelasIds.length > 0) {
				for (const mapelId of mapelIds) {
					const mp = await db.query.tableMataPelajaran.findFirst({
						where: eq(tableMataPelajaran.id, mapelId),
						columns: { nama: true }
					});
					if (mp?.nama) {
						assignments.push({
							mapelNama: mp.nama,
							kelasIds
						});
					}
				}
			}
		}

		try {
			// Simpan pemetaan presisi
			await syncTeacherAssignments(db, {
				authUserId: userId,
				pegawaiId: locals.user.pegawaiId,
				assignments,
				sekolahId
			});

			// Tandai onboarding selesai
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
