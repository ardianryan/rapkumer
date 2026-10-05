import db from '$lib/server/db';
import {
	tableMurid,
	tableKelas,
	tableKetidakhadiranHarian,
	tableAbsensi,
	tableKetidakhadiranRapor,
	tableRtsCatatanWali
} from '$lib/server/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import {
	getAkasConfig,
	fetchAkasStudents,
	fetchAkasAttendanceRecap,
	fetchAkasAttendanceDaily
} from './client';

export interface SyncAkasParams {
	sekolahId: number;
	tahunAjaranId?: number;
	semesterId?: number;
	kelasId?: number; // jika null maka sync semua kelas
	mode: 'daily' | 'range' | 'recap';
	date?: string; // YYYY-MM-DD jika mode daily
	startDate?: string; // YYYY-MM-DD jika mode range / recap
	endDate?: string; // YYYY-MM-DD jika mode range / recap
	month?: string; // YYYY-MM jika mode recap bulanan
}

export interface SyncAkasResult {
	success: boolean;
	message: string;
	kelasNama: string;
	totalMuridRapkumer: number;
	matchedByNisn: number;
	unmatchedStudents: Array<{ nama: string; nisn: string | null }>;
	stats: {
		hadir: number;
		sakit: number;
		izin: number;
		alfa: number;
		terlambat: number;
		totalRecords: number;
	};
}

/**
 * Normalisasi nama kelas agar format "X-1" dan "X 1" bisa saling cocok.
 */
function normalizeClassName(name: string): string {
	return name
		.trim()
		.replace(/[-_ ]+/g, ' ')
		.toUpperCase();
}

/**
 * Rekonsiliasi dan sinkronisasi presensi dari AKAS ke Rapkumer berbasis NISN.
 */
export async function syncAttendanceFromAkas(params: SyncAkasParams): Promise<SyncAkasResult> {
	const config = await getAkasConfig(params.sekolahId, params.tahunAjaranId);

	if (!config.apiKey) {
		throw new Error(
			'API Key AKAS belum disetel. Buka Pengaturan -> Sistem & Database -> Integrasi AKAS untuk menyetel API Key.'
		);
	}

	// 1. Ambil data kelas target dari Rapkumer
	const targetKelasList = await db.query.tableKelas.findMany({
		where: params.kelasId
			? eq(tableKelas.id, params.kelasId)
			: eq(tableKelas.sekolahId, params.sekolahId)
	});

	if (targetKelasList.length === 0) {
		throw new Error('Kelas target tidak ditemukan di Rapkumer.');
	}

	let totalMurid = 0;
	let totalMatched = 0;
	const unmatched: Array<{ nama: string; nisn: string | null }> = [];
	const stats = {
		hadir: 0,
		sakit: 0,
		izin: 0,
		alfa: 0,
		terlambat: 0,
		totalRecords: 0
	};

	// 2. Iterasi per kelas target
	for (const kelas of targetKelasList) {
		const muridList = await db.query.tableMurid.findMany({
			where: eq(tableMurid.kelasId, kelas.id)
		});
		totalMurid += muridList.length;

		// Buat Map NISN -> Murid Rapkumer
		const nisnToMurid = new Map<string, (typeof muridList)[0]>();
		for (const m of muridList) {
			if (m.nisn && m.nisn.trim()) {
				nisnToMurid.set(m.nisn.trim(), m);
			}
		}

		const akasKelasName = normalizeClassName(kelas.nama);

		// 3. Tarik data siswa AKAS untuk kelas ini (untuk mapping user_id -> NISN)
		let akasStudents: Awaited<ReturnType<typeof fetchAkasStudents>> = [];
		try {
			akasStudents = await fetchAkasStudents(config.baseUrl, config.apiKey, akasKelasName);
		} catch (err: unknown) {
			console.warn(`[AKAS Sync] Gagal tarik siswa untuk kelas ${akasKelasName}:`, err);
		}

		// Map AKAS user_id -> NISN
		const akasUserIdToNisn = new Map<string, string>();
		for (const s of akasStudents) {
			if (s.nisn && s.nisn.trim()) {
				akasUserIdToNisn.set(s.id, s.nisn.trim());
			}
		}

		// 4. Jika mode RECAP (rekapitulasi semester / bulanan)
		if (params.mode === 'recap') {
			try {
				const recapResponse = await fetchAkasAttendanceRecap(config.baseUrl, config.apiKey, {
					kelas: akasKelasName,
					start_date: params.startDate,
					end_date: params.endDate,
					month: params.month
				});

				const recapStudents = Array.isArray(recapResponse.data) ? recapResponse.data : [];

				for (const r of recapStudents) {
					const nisn = (r.nisn || akasUserIdToNisn.get(r.user_id) || '').trim();
					const murid = nisn ? nisnToMurid.get(nisn) : undefined;

					if (!murid) continue;

					totalMatched++;
					const hadirCount = Number(r.hadir) || 0;
					const sakitCount = Number(r.sakit) || 0;
					const izinCount = Number(r.izin) || 0;
					const alfaCount = Number(r.alfa) || 0;
					const terlambatCount = Number(r.terlambat) || 0;

					stats.hadir += hadirCount;
					stats.sakit += sakitCount;
					stats.izin += izinCount;
					stats.alfa += alfaCount;
					stats.terlambat += terlambatCount;
					stats.totalRecords += hadirCount + sakitCount + izinCount + alfaCount;

					// Update ke tableKetidakhadiranRapor jika semesterId tersedia
					if (params.semesterId) {
						const existingRapor = await db.query.tableKetidakhadiranRapor.findFirst({
							where: and(
								eq(tableKetidakhadiranRapor.muridId, murid.id),
								eq(tableKetidakhadiranRapor.semesterId, params.semesterId)
							)
						});

						if (existingRapor) {
							await db
								.update(tableKetidakhadiranRapor)
								.set({
									sakit: sakitCount,
									izin: izinCount,
									alfa: alfaCount,
									updatedAt: new Date().toISOString()
								})
								.where(eq(tableKetidakhadiranRapor.id, existingRapor.id));
						} else {
							await db.insert(tableKetidakhadiranRapor).values({
								muridId: murid.id,
								semesterId: params.semesterId,
								sakit: sakitCount,
								izin: izinCount,
								alfa: alfaCount
							});
						}
					}

					// Update juga ke tableRtsCatatanWali (Rapor Sisipan)
					const existingRtsWali = await db.query.tableRtsCatatanWali.findFirst({
						where: and(
							eq(tableRtsCatatanWali.kelasId, kelas.id),
							eq(tableRtsCatatanWali.muridId, murid.id)
						)
					});

					if (existingRtsWali) {
						await db
							.update(tableRtsCatatanWali)
							.set({
								sakit: sakitCount,
								izin: izinCount,
								alfa: alfaCount,
								updatedAt: new Date().toISOString()
							})
							.where(eq(tableRtsCatatanWali.id, existingRtsWali.id));
					} else {
						await db.insert(tableRtsCatatanWali).values({
							sekolahId: params.sekolahId,
							kelasId: kelas.id,
							muridId: murid.id,
							sakit: sakitCount,
							izin: izinCount,
							alfa: alfaCount
						});
					}
				}
			} catch (err: unknown) {
				console.error('[AKAS Sync] Error recap sync:', err);
				throw err;
			}
		}

		// 5. Jika mode DAILY atau RANGE (presensi harian detail)
		if (params.mode === 'daily' || params.mode === 'range') {
			// Generate daftar tanggal yang akan ditarik
			const dates: string[] = [];
			if (params.mode === 'daily' && params.date) {
				dates.push(params.date);
			} else if (params.startDate && params.endDate) {
				const cur = new Date(params.startDate);
				const stop = new Date(params.endDate);
				while (cur <= stop) {
					dates.push(cur.toISOString().slice(0, 10));
					cur.setDate(cur.getDate() + 1);
				}
			}

			for (const tgl of dates) {
				try {
					const dailyRes = await fetchAkasAttendanceDaily(config.baseUrl, config.apiKey, {
						kelas: akasKelasName,
						date: tgl,
						per_page: 100
					});

					const entries = Array.isArray(dailyRes.data) ? dailyRes.data : [];

					for (const entry of entries) {
						// Ambil NISN dari entry atau mapping user_id
						const nisn = (entry.nisn || akasUserIdToNisn.get(entry.user_id) || '').trim();
						const murid = nisn ? nisnToMurid.get(nisn) : undefined;

						if (!murid) continue;

						totalMatched++;
						const st = String(entry.status || '')
							.trim()
							.toUpperCase();

						// Hadir atau Terlambat
						if (st === 'HADIR' || st === 'H' || st === 'TERLAMBAT' || st === 'T') {
							if (st === 'T' || st === 'TERLAMBAT') {
								stats.terlambat++;
							}
							stats.hadir++;
							stats.totalRecords++;

							// Hapus dari ketidakhadiran_harian jika ada
							await db
								.delete(tableKetidakhadiranHarian)
								.where(
									and(
										eq(tableKetidakhadiranHarian.muridId, murid.id),
										eq(tableKetidakhadiranHarian.tanggal, tgl),
										isNull(tableKetidakhadiranHarian.mataPelajaranId)
									)
								);

							// Catat ke absensi (kehadiran)
							const existingAbsensi = await db.query.tableAbsensi.findFirst({
								where: and(
									eq(tableAbsensi.muridId, murid.id),
									eq(tableAbsensi.waktu, `${tgl} 07:00:00`),
									isNull(tableAbsensi.mataPelajaranId)
								)
							});

							if (!existingAbsensi) {
								await db.insert(tableAbsensi).values({
									muridId: murid.id,
									waktu: `${tgl} 07:00:00`
								});
							}
						}
						// Sakit (S)
						else if (st === 'SAKIT' || st === 'S') {
							stats.sakit++;
							stats.totalRecords++;
							await upsertKetidakhadiran(murid.id, tgl, 'S');
						}
						// Izin (I)
						else if (st === 'IZIN' || st === 'I') {
							stats.izin++;
							stats.totalRecords++;
							await upsertKetidakhadiran(murid.id, tgl, 'I');
						}
						// Alfa (A)
						else if (st === 'ALFA' || st === 'A') {
							stats.alfa++;
							stats.totalRecords++;
							await upsertKetidakhadiran(murid.id, tgl, 'A');
						}
					}
				} catch (err: unknown) {
					console.warn(`[AKAS Sync] Error daily sync untuk tanggal ${tgl}:`, err);
				}
			}
		}

		// Kumpulkan siswa yang tidak ter-match NISN-nya
		for (const m of muridList) {
			if (!m.nisn || !nisnToMurid.has(m.nisn.trim())) {
				unmatched.push({ nama: m.nama, nisn: m.nisn });
			}
		}
	}

	const kelasLabel =
		targetKelasList.length === 1 ? targetKelasList[0].nama : `${targetKelasList.length} Rombel`;

	return {
		success: true,
		message: `Berhasil menyinkronkan presensi dari AKAS untuk ${kelasLabel}.`,
		kelasNama: kelasLabel,
		totalMuridRapkumer: totalMurid,
		matchedByNisn: totalMatched,
		unmatchedStudents: unmatched,
		stats
	};
}

async function upsertKetidakhadiran(muridId: number, tanggal: string, keterangan: 'S' | 'I' | 'A') {
	const existing = await db.query.tableKetidakhadiranHarian.findFirst({
		where: and(
			eq(tableKetidakhadiranHarian.muridId, muridId),
			eq(tableKetidakhadiranHarian.tanggal, tanggal),
			isNull(tableKetidakhadiranHarian.mataPelajaranId)
		)
	});

	if (existing) {
		await db
			.update(tableKetidakhadiranHarian)
			.set({
				keterangan,
				updatedAt: new Date().toISOString()
			})
			.where(eq(tableKetidakhadiranHarian.id, existing.id));
	} else {
		await db.insert(tableKetidakhadiranHarian).values({
			muridId,
			tanggal,
			keterangan
		});
	}

	// Hapus rekaman absensi hadir jika berubah menjadi Sakit/Izin/Alfa
	await db
		.delete(tableAbsensi)
		.where(
			and(
				eq(tableAbsensi.muridId, muridId),
				eq(tableAbsensi.waktu, `${tanggal} 07:00:00`),
				isNull(tableAbsensi.mataPelajaranId)
			)
		);
}
