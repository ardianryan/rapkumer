import db from '$lib/server/db';
import { tableKelas, tableMataPelajaran } from '$lib/server/db/schema';
import { resolveSekolahAcademicContext } from '$lib/server/db/academic';
import { getEraporConfig } from '$lib/server/erapor/client';
import { and, asc, eq, inArray } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const sekolahId = locals.sekolah!.id;
	const config = await getEraporConfig(sekolahId);
	const academic = await resolveSekolahAcademicContext(sekolahId);

	const kelasRows = await db.query.tableKelas.findMany({
		columns: { id: true, nama: true, fase: true },
		where: academic?.activeSemesterId
			? and(
					eq(tableKelas.sekolahId, sekolahId),
					eq(tableKelas.semesterId, academic.activeSemesterId)
				)
			: eq(tableKelas.sekolahId, sekolahId),
		orderBy: asc(tableKelas.nama)
	});

	const kelasIds = kelasRows.map((k) => k.id);
	const mapelRows =
		kelasIds.length > 0
			? await db.query.tableMataPelajaran.findMany({
					columns: { id: true, kelasId: true, nama: true, kode: true },
					where: inArray(tableMataPelajaran.kelasId, kelasIds),
					orderBy: asc(tableMataPelajaran.nama)
				})
			: [];

	return {
		semesterId: config.activeSemesterId || '20261',
		kelasList: kelasRows,
		mapelList: mapelRows
	};
};
