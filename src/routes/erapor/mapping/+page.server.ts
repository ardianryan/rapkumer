import db from '$lib/server/db';
import {
	tableEraporMapKokurikuler,
	tableEraporMapMapel,
	tableEraporMapRombel,
	tableKelas,
	tableKokurikuler,
	tableMataPelajaran,
	tablePegawai
} from '$lib/server/db/schema';
import { resolveSekolahAcademicContext } from '$lib/server/db/academic';
import { getEraporConfig } from '$lib/server/erapor/client';
import { profilPelajarPancasilaDimensions } from '$lib/statics';
import { and, asc, eq, inArray } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const sekolahId = locals.sekolah!.id;
	const config = await getEraporConfig(sekolahId);
	const semesterId = config.activeSemesterId || '20261';
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

	const [mapelRows, kokurikulerRows, pegawaiRows, mapRombels, mapMapels, mapKokurikulers] =
		await Promise.all([
			kelasIds.length > 0
				? db.query.tableMataPelajaran.findMany({
						columns: { id: true, nama: true, kode: true },
						where: inArray(tableMataPelajaran.kelasId, kelasIds),
						orderBy: asc(tableMataPelajaran.nama)
					})
				: Promise.resolve([]),
			kelasIds.length > 0
				? db.query.tableKokurikuler.findMany({
						columns: { id: true, kode: true, tujuan: true, dimensi: true },
						where: inArray(tableKokurikuler.kelasId, kelasIds)
					})
				: Promise.resolve([]),
			db.query.tablePegawai.findMany({
				columns: { id: true, nama: true, nip: true },
				where: eq(tablePegawai.sekolahId, sekolahId),
				orderBy: asc(tablePegawai.nama)
			}),
			db.query.tableEraporMapRombel.findMany({
				where: and(
					eq(tableEraporMapRombel.sekolahId, sekolahId),
					eq(tableEraporMapRombel.semesterId, semesterId)
				)
			}),
			db.query.tableEraporMapMapel.findMany({
				where: eq(tableEraporMapMapel.sekolahId, sekolahId)
			}),
			db.query.tableEraporMapKokurikuler.findMany({
				where: and(
					eq(tableEraporMapKokurikuler.sekolahId, sekolahId),
					eq(tableEraporMapKokurikuler.semesterId, semesterId)
				)
			})
		]);

	// Deduplicate mapel by trimmed nama
	const uniqueMapelsMap = new Map<string, { nama: string; kode: string | null }>();
	for (const m of mapelRows) {
		const nama = m.nama.trim();
		if (!nama || uniqueMapelsMap.has(nama)) continue;
		uniqueMapelsMap.set(nama, { nama, kode: m.kode ?? null });
	}

	// Deduplicate kokurikuler by kode
	const uniqueKokMap = new Map<string, { kode: string; tujuan: string; dimensi: string[] }>();
	for (const k of kokurikulerRows) {
		const kode = k.kode.trim().toUpperCase();
		if (!kode) continue;
		const existing = uniqueKokMap.get(kode);
		const dims = Array.isArray(k.dimensi) ? k.dimensi : [];
		if (!existing) {
			uniqueKokMap.set(kode, { kode, tujuan: k.tujuan, dimensi: [...dims] });
		} else {
			existing.dimensi = Array.from(new Set([...existing.dimensi, ...dims]));
		}
	}

	return {
		semesterId,
		kelasList: kelasRows,
		mapelList: Array.from(uniqueMapelsMap.values()),
		kokurikulerList: Array.from(uniqueKokMap.values()),
		pegawaiList: pegawaiRows,
		dimensiPilihan: profilPelajarPancasilaDimensions,
		existingMappings: {
			rombels: mapRombels,
			mapels: mapMapels,
			kokurikulers: mapKokurikulers
		}
	};
};
