import db from '$lib/server/db';
import {
	tableAsesmenFormatif,
	tableAsesmenSumatif,
	tableAsesmenSumatifTujuan,
	tableBobotNilaiAkhirMapel,
	tableMataPelajaran,
	tableMurid,
	tableMuridMataPelajaran,
	tableNilaiAkhirMapel,
	tableTujuanPembelajaran
} from '$lib/server/db/schema';
import { ensureNilaiAkhirMapelSchema } from '$lib/server/db/ensure-nilai-akhir-mapel';
import { fail, redirect } from '@sveltejs/kit';
import { getAksesMapelUser, needsMapelFilter } from '$lib/server/mapel-access';
import { labelVarianUntukMurid, muridAgamaKey } from '$lib/server/mapel-picker';
import { agamaMapelOptions, pksMapelOptions } from '$lib/statics';
import { and, asc, eq, inArray } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

const AGAMA_BASE_SUBJECT = 'Pendidikan Agama dan Budi Pekerti';
const PKS_BASE_SUBJECT = 'Pendalaman Kitab Suci';
const AGAMA_MAPEL_VALUE = 'agama';
const PKS_MAPEL_VALUE = 'pks';

function normalizeText(value: string | null | undefined) {
	return value?.trim().toLowerCase() ?? '';
}

function isAgamaSubject(name: string) {
	return /^pendidikan (agama|kepercayaan)/i.test(normalizeText(name));
}

function isPksSubject(name: string) {
	return normalizeText(name).startsWith('pendalaman kitab suci');
}

function resolveAgamaVariantName(agama: string | null | undefined) {
	const key = muridAgamaKey(agama);
	return agamaMapelOptions.find((option) => option.key === key)?.name ?? null;
}

function resolvePksVariantName(agama: string | null | undefined) {
	const key = muridAgamaKey(agama);
	return pksMapelOptions.find((option) => option.key === key)?.name ?? null;
}

export const load: PageServerLoad = async ({ parent, url, locals }) => {
	await ensureNilaiAkhirMapelSchema();

	const { user, kelasAktif } = await parent();
	if (!user) throw redirect(303, '/login');
	if (!kelasAktif) {
		return {
			status: 'no_class',
			mapelList: [],
			selectedMapelValue: null,
			daftarSiswa: [],
			bobot: { formatif: 30, sumatif: 70 },
			isLocked: false,
			lockedAt: null
		};
	}

	const sekolahId = locals.sekolah?.id;
	if (!sekolahId) throw redirect(303, '/login');

	// Ambil semua mapel di kelas aktif
	const allClassMapel = await db.query.tableMataPelajaran.findMany({
		where: eq(tableMataPelajaran.kelasId, kelasAktif.id),
		orderBy: [asc(tableMataPelajaran.nama)]
	});

	// Filter hak akses guru
	let allowedMapel = allClassMapel;
	if (needsMapelFilter(user, kelasAktif.id)) {
		const akses = await getAksesMapelUser(user, kelasAktif.id);
		allowedMapel = allClassMapel.filter(
			(m) => akses.ids.has(m.id) || akses.names.has(normalizeText(m.nama))
		);
	}

	// Bangun opsi dropdown mapel (termasuk grup varian Agama & PKS)
	const mapelList: Array<{ value: string; nama: string }> = [];
	let hasAgama = false;
	let hasPks = false;

	for (const m of allowedMapel) {
		if (isAgamaSubject(m.nama)) {
			hasAgama = true;
		} else if (isPksSubject(m.nama)) {
			hasPks = true;
		} else {
			mapelList.push({ value: String(m.id), nama: m.nama });
		}
	}

	if (hasAgama) {
		mapelList.unshift({ value: AGAMA_MAPEL_VALUE, nama: AGAMA_BASE_SUBJECT });
	}
	if (hasPks) {
		mapelList.push({ value: PKS_MAPEL_VALUE, nama: PKS_BASE_SUBJECT });
	}

	const rawMapelParam = url.searchParams.get('mapel_id');
	let selectedMapelValue = rawMapelParam ?? (mapelList.length > 0 ? mapelList[0].value : null);

	// Validasi mapel terpilih ada di list
	if (selectedMapelValue && !mapelList.some((item) => item.value === selectedMapelValue)) {
		selectedMapelValue = mapelList.length > 0 ? mapelList[0].value : null;
	}

	if (!selectedMapelValue) {
		return {
			status: 'no_mapel',
			mapelList,
			selectedMapelValue: null,
			daftarSiswa: [],
			bobot: { formatif: 30, sumatif: 70 },
			isLocked: false,
			lockedAt: null
		};
	}

	// Resolve mapel ID riil (jika agama/pks, kita resolve per varian nanti)
	const isAgama = selectedMapelValue === AGAMA_MAPEL_VALUE;
	const isPks = selectedMapelValue === PKS_MAPEL_VALUE;
	const singleMapelId = !isAgama && !isPks ? Number(selectedMapelValue) : null;

	const targetMapel = singleMapelId
		? (allClassMapel.find((m) => m.id === singleMapelId) ?? null)
		: null;

	// Ambil konfigurasi bobot (jika single mapel)
	let bobotFormatif = 30;
	let bobotSumatif = 70;

	if (singleMapelId) {
		const bobotRecord = await db.query.tableBobotNilaiAkhirMapel.findFirst({
			where: eq(tableBobotNilaiAkhirMapel.mataPelajaranId, singleMapelId)
		});
		if (bobotRecord) {
			bobotFormatif = bobotRecord.bobotFormatif;
			bobotSumatif = bobotRecord.bobotSumatif;
		}
	}

	// Ambil semua murid di kelas
	const allMurid = await db.query.tableMurid.findMany({
		where: and(eq(tableMurid.kelasId, kelasAktif.id), eq(tableMurid.sekolahId, sekolahId)),
		orderBy: [asc(tableMurid.nama)]
	});

	// Filter jika mapel pilihan
	let muridFilterIds: Set<number> | null = null;
	if (targetMapel && targetMapel.jenis === 'pilihan') {
		const enrolled = await db.query.tableMuridMataPelajaran.findMany({
			where: eq(tableMuridMataPelajaran.mataPelajaranId, targetMapel.id)
		});
		muridFilterIds = new Set(enrolled.map((e) => e.muridId));
	}

	const relevantMurid = allMurid.filter((m) => {
		if (muridFilterIds && !muridFilterIds.has(m.id)) return false;
		return true;
	});

	const muridIds = relevantMurid.map((m) => m.id);

	// Resolve target mapel ID per murid (untuk varian agama/pks)
	const mapelIdByMurid = new Map<number, number>();
	for (const m of relevantMurid) {
		if (isAgama) {
			const expectedName = resolveAgamaVariantName(m.agama) ?? AGAMA_BASE_SUBJECT;
			const found = allClassMapel.find(
				(x) => normalizeText(x.nama) === normalizeText(expectedName)
			);
			if (found) mapelIdByMurid.set(m.id, found.id);
		} else if (isPks) {
			const expectedName = resolvePksVariantName(m.agama) ?? PKS_BASE_SUBJECT;
			const found = allClassMapel.find(
				(x) => normalizeText(x.nama) === normalizeText(expectedName)
			);
			if (found) mapelIdByMurid.set(m.id, found.id);
		} else if (singleMapelId) {
			mapelIdByMurid.set(m.id, singleMapelId);
		}
	}

	const distinctMapelIds = Array.from(new Set(Array.from(mapelIdByMurid.values())));

	// Ambil TP per mapel
	const tpRows = distinctMapelIds.length
		? await db.query.tableTujuanPembelajaran.findMany({
				where: inArray(tableTujuanPembelajaran.mataPelajaranId, distinctMapelIds),
				orderBy: [asc(tableTujuanPembelajaran.id)]
			})
		: [];

	const tpByMapel = new Map<number, typeof tpRows>();
	for (const tp of tpRows) {
		const list = tpByMapel.get(tp.mataPelajaranId) ?? [];
		list.push(tp);
		tpByMapel.set(tp.mataPelajaranId, list);
	}

	// Ambil Asesmen Formatif (ketuntasan TP per murid)
	const formatifRows =
		muridIds.length && distinctMapelIds.length
			? await db.query.tableAsesmenFormatif.findMany({
					where: and(
						inArray(tableAsesmenFormatif.muridId, muridIds),
						inArray(tableAsesmenFormatif.mataPelajaranId, distinctMapelIds)
					)
				})
			: [];

	const formatifByMuridMapel = new Map<string, typeof formatifRows>();
	for (const f of formatifRows) {
		const key = `${f.muridId}|${f.mataPelajaranId}`;
		const list = formatifByMuridMapel.get(key) ?? [];
		list.push(f);
		formatifByMuridMapel.set(key, list);
	}

	// Ambil Asesmen Sumatif (nilai sumatif per murid)
	const sumatifRows =
		muridIds.length && distinctMapelIds.length
			? await db.query.tableAsesmenSumatif.findMany({
					where: and(
						inArray(tableAsesmenSumatif.muridId, muridIds),
						inArray(tableAsesmenSumatif.mataPelajaranId, distinctMapelIds)
					)
				})
			: [];

	const sumatifByMuridMapel = new Map<string, (typeof sumatifRows)[0]>();
	for (const s of sumatifRows) {
		sumatifByMuridMapel.set(`${s.muridId}|${s.mataPelajaranId}`, s);
	}

	// Ambil Asesmen Sumatif Tujuan (nilai per TP untuk status capaian)
	const sumatifTpRows =
		muridIds.length && distinctMapelIds.length
			? await db.query.tableAsesmenSumatifTujuan.findMany({
					where: and(
						inArray(tableAsesmenSumatifTujuan.muridId, muridIds),
						inArray(tableAsesmenSumatifTujuan.mataPelajaranId, distinctMapelIds)
					)
				})
			: [];

	const sumatifTpByMuridMapel = new Map<string, typeof sumatifTpRows>();
	for (const row of sumatifTpRows) {
		const key = `${row.muridId}|${row.mataPelajaranId}`;
		const list = sumatifTpByMuridMapel.get(key) ?? [];
		list.push(row);
		sumatifTpByMuridMapel.set(key, list);
	}

	// Ambil data yang SUDAH DIKUNCI di tableNilaiAkhirMapel
	const lockedRows =
		muridIds.length && distinctMapelIds.length
			? await db.query.tableNilaiAkhirMapel.findMany({
					where: and(
						inArray(tableNilaiAkhirMapel.muridId, muridIds),
						inArray(tableNilaiAkhirMapel.mataPelajaranId, distinctMapelIds)
					)
				})
			: [];

	const lockedByMuridMapel = new Map<string, (typeof lockedRows)[0]>();
	for (const l of lockedRows) {
		lockedByMuridMapel.set(`${l.muridId}|${l.mataPelajaranId}`, l);
	}

	// Susun baris siswa
	let allLocked = lockedRows.length > 0 && lockedRows.length >= relevantMurid.length;
	let lastLockedAt: string | null = null;

	const daftarSiswa = relevantMurid.map((murid, idx) => {
		const mapelId = mapelIdByMurid.get(murid.id) ?? singleMapelId ?? 0;
		const mmKey = `${murid.id}|${mapelId}`;
		const locked = lockedByMuridMapel.get(mmKey);

		if (locked?.dikunciPada && (!lastLockedAt || locked.dikunciPada > lastLockedAt)) {
			lastLockedAt = locked.dikunciPada;
		}

		// Hitung Formatif Score
		const tps = tpByMapel.get(mapelId) ?? [];
		const formatifs = formatifByMuridMapel.get(mmKey) ?? [];
		const tuntasCount = formatifs.filter((f) => f.tuntas).length;
		const formatifScore =
			tps.length > 0 ? Math.round((tuntasCount / tps.length) * 100 * 100) / 100 : null;

		// Ambil Sumatif Score
		const sumatif = sumatifByMuridMapel.get(mmKey);
		const sumatifScore = sumatif?.nilaiAkhir != null ? Number(sumatif.nilaiAkhir) : null;

		// Hitung preview Nilai Akhir
		let nilaiAkhirCalculated: number | null = null;
		if (sumatifScore != null || formatifScore != null) {
			const fVal = formatifScore ?? sumatifScore ?? 0;
			const sVal = sumatifScore ?? formatifScore ?? 0;
			const bTotal = bobotFormatif + bobotSumatif;
			if (bTotal > 0) {
				nilaiAkhirCalculated =
					Math.round(((fVal * bobotFormatif + sVal * bobotSumatif) / bTotal) * 100) / 100;
			}
		}

		// Capaian TP
		const tpScores = sumatifTpByMuridMapel.get(mmKey) ?? [];
		let tpOptimal: string | null = null;
		let tpPerluPeningkatan: string | null = null;

		if (tpScores.length > 0) {
			const sorted = [...tpScores]
				.filter((s) => s.nilai != null)
				.sort((a, b) => (b.nilai ?? 0) - (a.nilai ?? 0));

			if (sorted.length > 0) {
				const best = sorted[0];
				const worst = sorted[sorted.length - 1];
				const bestTp = tps.find((t) => t.id === best.tujuanPembelajaranId);
				const worstTp = tps.find((t) => t.id === worst.tujuanPembelajaranId);
				tpOptimal = bestTp?.deskripsi ?? `TP #${best.tujuanPembelajaranId}`;
				if (sorted.length > 1 && worst.nilai! < best.nilai!) {
					tpPerluPeningkatan = worstTp?.deskripsi ?? `TP #${worst.tujuanPembelajaranId}`;
				}
			}
		}

		return {
			no: idx + 1,
			muridId: murid.id,
			nisn: murid.nisn,
			nama: murid.nama.trim(),
			agamaLabel: labelVarianUntukMurid(
				targetMapel?.nama ?? (isAgama ? AGAMA_BASE_SUBJECT : isPks ? PKS_BASE_SUBJECT : ''),
				murid.agama
			),
			formatifScore,
			sumatifScore,
			nilaiAkhir: locked ? locked.nilaiAkhir : nilaiAkhirCalculated,
			isLocked: Boolean(locked && locked.status === 'terkunci'),
			tpOptimal,
			tpPerluPeningkatan
		};
	});

	if (daftarSiswa.some((s) => !s.isLocked)) {
		allLocked = false;
	}

	return {
		status: 'ready',
		mapelList,
		selectedMapelValue,
		targetMapelNama:
			targetMapel?.nama ?? (isAgama ? AGAMA_BASE_SUBJECT : isPks ? PKS_BASE_SUBJECT : ''),
		selectedMapelId: singleMapelId,
		daftarSiswa,
		bobot: { formatif: bobotFormatif, sumatif: bobotSumatif },
		isLocked: allLocked,
		lockedAt: lastLockedAt,
		totalMurid: relevantMurid.length,
		totalTp: tpRows.length
	};
};

export const actions: Actions = {
	simpanBobot: async ({ request }) => {
		const form = await request.formData();
		const mapelId = Number(form.get('mapelId'));
		const formatif = Number(form.get('bobotFormatif'));
		const sumatif = Number(form.get('bobotSumatif'));

		if (!mapelId || Number.isNaN(formatif) || Number.isNaN(sumatif)) {
			return fail(400, { message: 'Parameter bobot tidak valid.' });
		}
		if (formatif + sumatif !== 100) {
			return fail(400, { message: 'Total bobot harus tepat 100%.' });
		}

		await ensureNilaiAkhirMapelSchema();

		const now = new Date().toISOString();
		await db
			.insert(tableBobotNilaiAkhirMapel)
			.values({
				mataPelajaranId: mapelId,
				bobotFormatif: formatif,
				bobotSumatif: sumatif,
				createdAt: now,
				updatedAt: now
			})
			.onConflictDoUpdate({
				target: tableBobotNilaiAkhirMapel.mataPelajaranId,
				set: {
					bobotFormatif: formatif,
					bobotSumatif: sumatif,
					updatedAt: now
				}
			});

		return { success: true, message: 'Bobot nilai akhir berhasil disimpan.' };
	},

	generateDanKunci: async ({ request, locals }) => {
		const form = await request.formData();
		const mapelValue = String(form.get('selectedMapelValue') ?? '');
		const bobotFormatif = Number(form.get('bobotFormatif') ?? 30);
		const bobotSumatif = Number(form.get('bobotSumatif') ?? 70);

		if (!mapelValue) {
			return fail(400, { message: 'Mata pelajaran belum dipilih.' });
		}

		await ensureNilaiAkhirMapelSchema();

		const payloadStr = String(form.get('payload') ?? '[]');
		let items: Array<{
			muridId: number;
			formatifScore: number | null;
			sumatifScore: number | null;
			nilaiAkhir: number;
			capaianTp: unknown;
		}> = [];

		try {
			items = JSON.parse(payloadStr);
		} catch {
			return fail(400, { message: 'Format data siswa tidak valid.' });
		}

		if (!items.length) {
			return fail(400, { message: 'Tidak ada data siswa untuk digenerate.' });
		}

		const singleMapelId =
			mapelValue !== AGAMA_MAPEL_VALUE && mapelValue !== PKS_MAPEL_VALUE
				? Number(mapelValue)
				: null;

		const now = new Date().toISOString();
		const userId = locals.user?.id ?? null;

		await db.transaction(async (tx) => {
			for (const item of items) {
				const mapelId = singleMapelId ?? 0;
				if (!mapelId) continue;

				await tx
					.insert(tableNilaiAkhirMapel)
					.values({
						muridId: item.muridId,
						mataPelajaranId: mapelId,
						nilaiFormatif: item.formatifScore,
						nilaiSumatif: item.sumatifScore,
						bobotFormatif,
						bobotSumatif,
						nilaiAkhir: item.nilaiAkhir,
						capaianTp: JSON.stringify(item.capaianTp ?? []),
						status: 'terkunci',
						dikunciPada: now,
						dikunciOlehId: userId,
						createdAt: now,
						updatedAt: now
					})
					.onConflictDoUpdate({
						target: [tableNilaiAkhirMapel.muridId, tableNilaiAkhirMapel.mataPelajaranId],
						set: {
							nilaiFormatif: item.formatifScore,
							nilaiSumatif: item.sumatifScore,
							bobotFormatif,
							bobotSumatif,
							nilaiAkhir: item.nilaiAkhir,
							capaianTp: JSON.stringify(item.capaianTp ?? []),
							status: 'terkunci',
							dikunciPada: now,
							dikunciOlehId: userId,
							updatedAt: now
						}
					});
			}
		});

		return {
			success: true,
			message: `Berhasil meng-generate dan mengunci nilai akhir untuk ${items.length} siswa.`
		};
	},

	bukaKunci: async ({ request }) => {
		const form = await request.formData();
		const mapelId = Number(form.get('mapelId'));
		if (!mapelId) return fail(400, { message: 'Mata pelajaran tidak valid.' });

		await db.delete(tableNilaiAkhirMapel).where(eq(tableNilaiAkhirMapel.mataPelajaranId, mapelId));

		return { success: true, message: 'Kunci nilai akhir berhasil dibuka.' };
	}
};
