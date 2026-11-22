import { json, type RequestHandler } from '@sveltejs/kit';
import db from '$lib/server/db';
import {
	tableAsesmenKokurikuler,
	tableEraporMapKokurikuler,
	tableKelas,
	tableKokurikuler,
	tableMurid
} from '$lib/server/db/schema';
import { resolveSekolahAcademicContext } from '$lib/server/db/academic';
import { requireEraporAdmin } from '$lib/server/erapor/auth';
import { eraporFetch, getEraporConfig, logEraporSync } from '$lib/server/erapor/client';
import { and, eq, inArray } from 'drizzle-orm';

const KATEGORI_TO_SCORE: Record<string, number> = {
	'perlu-bimbingan': 1,
	cukup: 2,
	baik: 3,
	'sangat-baik': 4
};

function chunkArray<T>(arr: T[], size: number): T[][] {
	const chunks: T[][] = [];
	for (let i = 0; i < arr.length; i += size) {
		chunks.push(arr.slice(i, i + size));
	}
	return chunks;
}

function buildPreviewNarrative(
	kegiatanNama: string,
	studentName: string,
	nilaiList: Array<{ subdimensiName: string; nilai: number }>
): string {
	const best = nilaiList.filter((n) => n.nilai >= 4).map((n) => n.subdimensiName);
	const good = nilaiList.filter((n) => n.nilai === 3).map((n) => n.subdimensiName);
	const parts = [
		`Melalui kegiatan kokurikuler "${kegiatanNama}", ${studentName} menunjukkan capaian yang baik dalam penguatan profil pelajar.`
	];
	if (best.length > 0) {
		parts.push(`Ananda sangat mahir dan konsisten dalam ${best.join(', ')}.`);
	}
	if (good.length > 0) {
		parts.push(`Menunjukkan kecakapan yang baik pada ${good.join(', ')}.`);
	}
	parts.push(
		'Ananda mampu berkolaborasi aktif, berpikir kritis, serta menginternalisasi nilai-nilai karakter dengan penuh tanggung jawab.'
	);
	let text = parts.join(' ');
	if (text.length > 495) {
		text = `${text.slice(0, 492)}...`;
	}
	return text;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const auth = requireEraporAdmin(locals);
	if (auth.error) return auth.error;

	try {
		const body = (await request.json()) as {
			mode: 'dry-run' | 'push';
			siakadKode: string;
			kelasId?: number | null;
			semesterId?: string;
		};

		const siakadKode = body.siakadKode?.trim().toUpperCase();
		if (!siakadKode) {
			return json({ error: 'Kode kegiatan kokurikuler wajib dipilih.' }, { status: 400 });
		}

		const config = await getEraporConfig(auth.sekolah.id);
		const semesterId = body.semesterId?.trim() || config.activeSemesterId;
		if (!semesterId) {
			return json({ error: 'Semester target e-Rapor belum disetel.' }, { status: 400 });
		}

		const mapping = await db.query.tableEraporMapKokurikuler.findFirst({
			where: and(
				eq(tableEraporMapKokurikuler.sekolahId, auth.sekolah.id),
				eq(tableEraporMapKokurikuler.siakadKode, siakadKode),
				eq(tableEraporMapKokurikuler.semesterId, semesterId)
			)
		});

		const dimensiMap = mapping?.dimensiMap ?? {};
		const academic = await resolveSekolahAcademicContext(auth.sekolah.id);

		const kelasRows = await db.query.tableKelas.findMany({
			columns: { id: true, nama: true },
			where: academic?.activeSemesterId
				? and(
						eq(tableKelas.sekolahId, auth.sekolah.id),
						eq(tableKelas.semesterId, academic.activeSemesterId)
					)
				: eq(tableKelas.sekolahId, auth.sekolah.id)
		});

		const targetKelasIds = body.kelasId
			? kelasRows.filter((k) => k.id === body.kelasId).map((k) => k.id)
			: kelasRows.map((k) => k.id);

		if (targetKelasIds.length === 0) {
			return json({ error: 'Tidak ada kelas target pada semester aktif.' }, { status: 400 });
		}

		const kelasNameById = new Map(kelasRows.map((k) => [k.id, k.nama]));
		const kokurikulerRows = await db.query.tableKokurikuler.findMany({
			where: and(
				inArray(tableKokurikuler.kelasId, targetKelasIds),
				eq(tableKokurikuler.kode, siakadKode)
			)
		});

		if (kokurikulerRows.length === 0) {
			return json(
				{ error: `Kegiatan kokurikuler '${siakadKode}' tidak ditemukan di kelas target.` },
				{ status: 404 }
			);
		}

		const kokurikulerByKelasId = new Map(kokurikulerRows.map((k) => [k.kelasId, k]));
		const kokurikulerIds = kokurikulerRows.map((k) => k.id);

		const muridRows = await db.query.tableMurid.findMany({
			columns: { id: true, nama: true, nisn: true, kelasId: true },
			where: inArray(tableMurid.kelasId, targetKelasIds)
		});

		const asesmenRows = await db.query.tableAsesmenKokurikuler.findMany({
			where: inArray(tableAsesmenKokurikuler.kokurikulerId, kokurikulerIds)
		});

		// Index assessments: kokurikulerId -> muridId -> dimensi -> score
		const scoreMap = new Map<number, Map<number, Map<string, number>>>();
		for (const row of asesmenRows) {
			const score = KATEGORI_TO_SCORE[row.kategori];
			if (!score) continue;
			let mMap = scoreMap.get(row.kokurikulerId);
			if (!mMap) {
				mMap = new Map();
				scoreMap.set(row.kokurikulerId, mMap);
			}
			let dMap = mMap.get(row.muridId);
			if (!dMap) {
				dMap = new Map();
				mMap.set(row.muridId, dMap);
			}
			dMap.set(row.dimensi, score);
		}

		const unmappedDimensi = new Set<string>();
		const readyPayloads: Array<{
			semester_id: string;
			nisn: string;
			nilai: Array<{ id_subdimensi: string; nilai: number }>;
			_meta: { nama: string; kelasNama: string };
		}> = [];
		const skippedStudents: Array<{ nama: string; kelasNama: string; reason: string }> = [];

		for (const murid of muridRows) {
			if (!murid.kelasId) continue;
			const kelasNama = kelasNameById.get(murid.kelasId) ?? '-';
			const kok = kokurikulerByKelasId.get(murid.kelasId);
			if (!kok) continue;

			const dims = Array.isArray(kok.dimensi) ? kok.dimensi : [];
			for (const d of dims) {
				if (!dimensiMap[d]) unmappedDimensi.add(d);
			}

			const nisn = murid.nisn?.trim() ?? '';
			if (!nisn) {
				skippedStudents.push({ nama: murid.nama, kelasNama, reason: 'NISN kosong' });
				continue;
			}

			const muridScores = scoreMap.get(kok.id)?.get(murid.id);
			if (!muridScores || muridScores.size === 0) {
				skippedStudents.push({
					nama: murid.nama,
					kelasNama,
					reason: 'Belum ada nilai kokurikuler'
				});
				continue;
			}

			const nilaiItems: Array<{ id_subdimensi: string; nilai: number }> = [];
			for (const [dimKey, score] of muridScores.entries()) {
				const subId = dimensiMap[dimKey];
				if (subId) {
					nilaiItems.push({ id_subdimensi: subId, nilai: score });
				}
			}

			if (nilaiItems.length === 0) {
				skippedStudents.push({
					nama: murid.nama,
					kelasNama,
					reason: 'Dimensi belum dipetakan ke subdimensi e-Rapor'
				});
				continue;
			}

			readyPayloads.push({
				semester_id: semesterId,
				nisn,
				nilai: nilaiItems,
				_meta: { nama: murid.nama, kelasNama }
			});
		}

		const sampleItem = readyPayloads[0];
		const previewNarrative = sampleItem
			? buildPreviewNarrative(
					mapping?.eraporKegiatanNama || kokurikulerRows[0].tujuan,
					sampleItem._meta.nama,
					sampleItem.nilai.map((n, idx) => ({
						subdimensiName: `Subdimensi ${idx + 1}`,
						nilai: n.nilai
					}))
				)
			: null;

		if (body.mode === 'dry-run') {
			return json({
				ok: true,
				mode: 'dry-run',
				siakadKode,
				semesterId,
				isMapped: unmappedDimensi.size === 0 && readyPayloads.length > 0,
				unmappedDimensi: Array.from(unmappedDimensi),
				summary: {
					totalMurid: muridRows.length,
					readyCount: readyPayloads.length,
					skippedCount: skippedStudents.length
				},
				previewNarrative,
				skippedSample: skippedStudents.slice(0, 30)
			});
		}

		if (!config.apiUrl || !config.apiKey) {
			return json({ error: 'Koneksi Bridge e-Rapor belum dikonfigurasi.' }, { status: 400 });
		}
		if (readyPayloads.length === 0) {
			return json(
				{ error: 'Tidak ada data siswa yang siap dikirim (periksa mapping subdimensi & nilai).' },
				{ status: 400 }
			);
		}

		// Push in chunks of 50 students
		const chunks = chunkArray(readyPayloads, 50);
		let totalSuccess = 0;
		let totalFailed = 0;
		const errors: string[] = [];
		const responses: unknown[] = [];

		for (const chunk of chunks) {
			const cleanBatch = chunk.map((item) => ({
				semester_id: item.semester_id,
				nisn: item.nisn,
				nilai: item.nilai
			}));

			try {
				const res = await eraporFetch<{
					ok?: boolean;
					total_siswa?: number;
					error?: string;
				}>(config, '/nilai-kokurikuler', {
					method: 'POST',
					body: JSON.stringify(cleanBatch)
				});
				responses.push(res);
				totalSuccess += chunk.length;
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				totalFailed += chunk.length;
				errors.push(msg);
				responses.push({ error: msg });
			}
		}

		const status: 'SUCCESS' | 'PARTIAL' | 'FAILED' =
			totalFailed === 0 ? 'SUCCESS' : totalSuccess > 0 ? 'PARTIAL' : 'FAILED';

		await logEraporSync({
			sekolahId: auth.sekolah.id,
			syncType: 'kokurikuler',
			targetInfo: `${siakadKode} (Semester ${semesterId})`,
			totalData: readyPayloads.length,
			totalSuccess,
			totalFailed,
			requestPayload: {
				sample: readyPayloads.slice(0, 3).map((p) => ({
					semester_id: p.semester_id,
					nisn: p.nisn,
					nilai: p.nilai
				})),
				totalBatches: chunks.length
			},
			responseBody: responses,
			status,
			executedBy: auth.user.username || 'admin'
		});

		return json({
			ok: status !== 'FAILED',
			mode: 'push',
			status,
			totalData: readyPayloads.length,
			totalSuccess,
			totalFailed,
			errors
		});
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		return json({ error: msg }, { status: 500 });
	}
};
