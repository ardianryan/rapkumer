import db from '$lib/server/db';
import { tableKelas, tableKokurikuler } from '$lib/server/db/schema';
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
	const kokRows =
		kelasIds.length > 0
			? await db.query.tableKokurikuler.findMany({
					columns: { kode: true, tujuan: true },
					where: inArray(tableKokurikuler.kelasId, kelasIds)
				})
			: [];

	const kegiatanMap = new Map<string, string>();
	for (const k of kokRows) {
		const kode = k.kode.trim().toUpperCase();
		if (kode && !kegiatanMap.has(kode)) {
			kegiatanMap.set(kode, k.tujuan);
		}
	}

	return {
		semesterId: config.activeSemesterId || '20261',
		kelasList: kelasRows,
		kegiatanList: Array.from(kegiatanMap.entries()).map(([kode, tujuan]) => ({ kode, tujuan }))
	};
};
