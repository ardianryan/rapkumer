import db from '$lib/server/db';
import {
	tableRtsMapelSetup,
	tableRtsNilaiSiswa,
	tableRtsCatatanWali,
	tableAsesmenSumatif,
	type RtsKomponenFormatifItem,
	type RtsKomponenSumatifItem
} from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';

export interface RtsSetupData {
	id?: number;
	sekolahId: number;
	kelasId: number;
	mataPelajaranId: number;
	komponenFormatif: RtsKomponenFormatifItem[];
	komponenSumatif: RtsKomponenSumatifItem[];
	adaStsTes: boolean;
	adaStsNonTes: boolean;
	bobotSumatifTp: number;
	bobotSts: number;
}

export interface RtsNilaiInputItem {
	muridId: number;
	nilaiFormatif: Record<string, number | null>;
	nilaiSumatif: Record<string, number | null>;
	stsTes?: number | null;
	stsNonTes?: number | null;
	catatanGuru?: string | null;
}

/**
 * Hitung rata-rata angka dari sebuah record nilai key-value
 */
function hitungRataRecord(rec?: Record<string, number | null> | null): number | null {
	if (!rec) return null;
	const values = Object.values(rec).filter((v): v is number => v != null && !Number.isNaN(v));
	if (values.length === 0) return null;
	const sum = values.reduce((acc, curr) => acc + curr, 0);
	return Math.round((sum / values.length) * 100) / 100;
}

/**
 * Hitung Nilai STS (Tes & Non-Tes)
 */
function hitungNilaiSts(
	adaTes: boolean,
	adaNonTes: boolean,
	stsTes?: number | null,
	stsNonTes?: number | null
): number | null {
	const validTes = adaTes && stsTes != null && !Number.isNaN(stsTes);
	const validNonTes = adaNonTes && stsNonTes != null && !Number.isNaN(stsNonTes);

	if (validTes && validNonTes) {
		return Math.round(((stsTes! + stsNonTes!) / 2) * 100) / 100;
	}
	if (validTes) return Math.round(stsTes! * 100) / 100;
	if (validNonTes) return Math.round(stsNonTes! * 100) / 100;
	return null;
}

/**
 * Hitung Nilai Akhir RTS (Tengah Semester) berbobot
 */
function hitungNilaiAkhirRts(
	rataSumatif: number | null,
	nilaiSts: number | null,
	bobotSumatif: number = 70,
	bobotSts: number = 30
): number | null {
	if (rataSumatif == null && nilaiSts == null) return null;
	if (rataSumatif != null && nilaiSts == null) return rataSumatif;
	if (rataSumatif == null && nilaiSts != null) return nilaiSts;

	const totalBobot = (bobotSumatif || 0) + (bobotSts || 0);
	if (totalBobot <= 0) return rataSumatif;

	const weighted = rataSumatif! * bobotSumatif + nilaiSts! * bobotSts;
	return Math.round((weighted / totalBobot) * 100) / 100;
}

/**
 * Dapatkan konfigurasi komponen asesmen RTS untuk kelas & mapel
 */
export async function getRtsSetup(
	kelasId: number,
	mataPelajaranId: number
): Promise<RtsSetupData | null> {
	const record = await db.query.tableRtsMapelSetup.findFirst({
		where: and(
			eq(tableRtsMapelSetup.kelasId, kelasId),
			eq(tableRtsMapelSetup.mataPelajaranId, mataPelajaranId)
		)
	});

	if (!record) return null;

	return {
		id: record.id,
		sekolahId: record.sekolahId,
		kelasId: record.kelasId,
		mataPelajaranId: record.mataPelajaranId,
		komponenFormatif: (record.komponenFormatif as RtsKomponenFormatifItem[]) || [],
		komponenSumatif: (record.komponenSumatif as RtsKomponenSumatifItem[]) || [],
		adaStsTes: Boolean(record.adaStsTes),
		adaStsNonTes: Boolean(record.adaStsNonTes),
		bobotSumatifTp: record.bobotSumatifTp ?? 70,
		bobotSts: record.bobotSts ?? 30
	};
}

/**
 * Simpan konfigurasi komponen asesmen RTS
 */
export async function saveRtsSetup(data: {
	sekolahId: number;
	kelasId: number;
	mataPelajaranId: number;
	komponenFormatif: RtsKomponenFormatifItem[];
	komponenSumatif: RtsKomponenSumatifItem[];
	adaStsTes: boolean;
	adaStsNonTes: boolean;
	bobotSumatifTp?: number;
	bobotSts?: number;
}) {
	const existing = await getRtsSetup(data.kelasId, data.mataPelajaranId);
	const now = new Date().toISOString();

	const payload = {
		sekolahId: data.sekolahId,
		kelasId: data.kelasId,
		mataPelajaranId: data.mataPelajaranId,
		komponenFormatif: data.komponenFormatif,
		komponenSumatif: data.komponenSumatif,
		adaStsTes: data.adaStsTes,
		adaStsNonTes: data.adaStsNonTes,
		bobotSumatifTp: data.bobotSumatifTp ?? 70,
		bobotSts: data.bobotSts ?? 30,
		updatedAt: now
	};

	if (existing?.id) {
		await db.update(tableRtsMapelSetup).set(payload).where(eq(tableRtsMapelSetup.id, existing.id));
		return existing.id;
	} else {
		const insertResult = await db.insert(tableRtsMapelSetup).values({
			...payload,
			createdAt: now
		});
		return Number(insertResult.lastInsertRowid ?? 0);
	}
}

/**
 * Hapus / reset konfigurasi komponen asesmen RTS beserta nilai yang tersimpan untuk mapel tersebut
 */
export async function deleteRtsSetup(kelasId: number, mataPelajaranId: number, sekolahId?: number) {
	const setupCondition = sekolahId
		? and(
				eq(tableRtsMapelSetup.kelasId, kelasId),
				eq(tableRtsMapelSetup.mataPelajaranId, mataPelajaranId),
				eq(tableRtsMapelSetup.sekolahId, sekolahId)
			)
		: and(
				eq(tableRtsMapelSetup.kelasId, kelasId),
				eq(tableRtsMapelSetup.mataPelajaranId, mataPelajaranId)
			);

	const nilaiCondition = sekolahId
		? and(
				eq(tableRtsNilaiSiswa.kelasId, kelasId),
				eq(tableRtsNilaiSiswa.mataPelajaranId, mataPelajaranId),
				eq(tableRtsNilaiSiswa.sekolahId, sekolahId)
			)
		: and(
				eq(tableRtsNilaiSiswa.kelasId, kelasId),
				eq(tableRtsNilaiSiswa.mataPelajaranId, mataPelajaranId)
			);

	await db.delete(tableRtsMapelSetup).where(setupCondition);
	await db.delete(tableRtsNilaiSiswa).where(nilaiCondition);
}

/**
 * Ambil seluruh nilai siswa RTS untuk rombel & mapel
 */
export async function getRtsNilaiList(kelasId: number, mataPelajaranId: number) {
	return db.query.tableRtsNilaiSiswa.findMany({
		where: and(
			eq(tableRtsNilaiSiswa.kelasId, kelasId),
			eq(tableRtsNilaiSiswa.mataPelajaranId, mataPelajaranId)
		)
	});
}

/**
 * Simpan kolektif nilai siswa RTS (bulk save)
 */
export async function saveRtsNilaiKolektif(
	sekolahId: number,
	kelasId: number,
	mataPelajaranId: number,
	items: RtsNilaiInputItem[]
) {
	const setup = await getRtsSetup(kelasId, mataPelajaranId);
	const adaTes = setup ? setup.adaStsTes : true;
	const adaNonTes = setup ? setup.adaStsNonTes : false;
	const bobotSumatif = setup?.bobotSumatifTp ?? 70;
	const bobotSts = setup?.bobotSts ?? 30;

	const existingList = await getRtsNilaiList(kelasId, mataPelajaranId);
	const existingMap = new Map(existingList.map((e) => [e.muridId, e]));
	const now = new Date().toISOString();

	for (const item of items) {
		const rataFormatif = hitungRataRecord(item.nilaiFormatif);
		const rataSumatifTp = hitungRataRecord(item.nilaiSumatif);
		const nilaiSts = hitungNilaiSts(adaTes, adaNonTes, item.stsTes, item.stsNonTes);
		const nilaiAkhirRts = hitungNilaiAkhirRts(rataSumatifTp, nilaiSts, bobotSumatif, bobotSts);

		const recordData = {
			sekolahId,
			kelasId,
			mataPelajaranId,
			muridId: item.muridId,
			nilaiFormatif: item.nilaiFormatif,
			rataFormatif,
			nilaiSumatif: item.nilaiSumatif,
			rataSumatifTp,
			stsTes: item.stsTes ?? null,
			stsNonTes: item.stsNonTes ?? null,
			nilaiSts,
			nilaiAkhirRts,
			catatanGuru: item.catatanGuru ? item.catatanGuru.trim() : null,
			updatedAt: now
		};

		const exist = existingMap.get(item.muridId);
		if (exist) {
			await db
				.update(tableRtsNilaiSiswa)
				.set(recordData)
				.where(eq(tableRtsNilaiSiswa.id, exist.id));
		} else {
			await db.insert(tableRtsNilaiSiswa).values({
				...recordData,
				createdAt: now
			});
		}

		// Sinkronisasi dengan tableAsesmenSumatif jika ada record sumatif
		try {
			const sumatifRecord = await db.query.tableAsesmenSumatif.findFirst({
				where: and(
					eq(tableAsesmenSumatif.muridId, item.muridId),
					eq(tableAsesmenSumatif.mataPelajaranId, mataPelajaranId)
				)
			});

			if (sumatifRecord) {
				await db
					.update(tableAsesmenSumatif)
					.set({
						stsTes: item.stsTes ?? null,
						stsNonTes: item.stsNonTes ?? null,
						sts: nilaiSts,
						nilaiAkhirRts,
						updatedAt: now
					})
					.where(eq(tableAsesmenSumatif.id, sumatifRecord.id));
			}
		} catch {
			// ignore optional legacy sync error
		}
	}
}

/**
 * Ambil catatan wali kelas untuk sebuah rombel
 */
export async function getRtsCatatanWaliList(kelasId: number) {
	return db.query.tableRtsCatatanWali.findMany({
		where: eq(tableRtsCatatanWali.kelasId, kelasId)
	});
}

/**
 * Simpan catatan wali kelas untuk satu murid
 */
export async function saveRtsCatatanWaliMurid(data: {
	sekolahId: number;
	kelasId: number;
	muridId: number;
	catatanWali?: string | null;
	sakit?: number | null;
	izin?: number | null;
	alfa?: number | null;
}) {
	const existing = await db.query.tableRtsCatatanWali.findFirst({
		where: and(
			eq(tableRtsCatatanWali.kelasId, data.kelasId),
			eq(tableRtsCatatanWali.muridId, data.muridId)
		)
	});
	const now = new Date().toISOString();
	const payload = {
		sekolahId: data.sekolahId,
		kelasId: data.kelasId,
		muridId: data.muridId,
		catatanWali: data.catatanWali ? data.catatanWali.trim() : null,
		sakit: data.sakit ?? 0,
		izin: data.izin ?? 0,
		alfa: data.alfa ?? 0,
		updatedAt: now
	};

	if (existing) {
		await db
			.update(tableRtsCatatanWali)
			.set(payload)
			.where(eq(tableRtsCatatanWali.id, existing.id));
	} else {
		await db.insert(tableRtsCatatanWali).values({
			...payload,
			createdAt: now
		});
	}
}

/**
 * Simpan massal catatan wali kelas untuk seluruh murid di kelas
 */
export async function saveRtsCatatanWaliMassal(
	sekolahId: number,
	kelasId: number,
	items: Array<{
		muridId: number;
		catatanWali?: string | null;
		sakit?: number | null;
		izin?: number | null;
		alfa?: number | null;
	}>
) {
	for (const item of items) {
		await saveRtsCatatanWaliMurid({
			sekolahId,
			kelasId,
			muridId: item.muridId,
			catatanWali: item.catatanWali,
			sakit: item.sakit,
			izin: item.izin,
			alfa: item.alfa
		});
	}
}
