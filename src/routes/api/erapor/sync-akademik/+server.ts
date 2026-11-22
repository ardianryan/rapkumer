import { json, type RequestHandler } from '@sveltejs/kit';
import db from '$lib/server/db';
import {
	tableAsesmenSumatif,
	tableEraporMapMapel,
	tableEraporMapRombel,
	tableKelas,
	tableMataPelajaran,
	tableMurid,
	tableNilaiAkhirMapel
} from '$lib/server/db/schema';
import { requireEraporAdmin } from '$lib/server/erapor/auth';
import { eraporFetch, getEraporConfig, logEraporSync } from '$lib/server/erapor/client';
import { and, eq } from 'drizzle-orm';

interface CapaianTpEntry {
	kode?: string;
	deskripsi?: string;
	status?: 'T' | 'R' | string;
}

function parseCapaianDeskripsi(raw: string | null | undefined): {
	tinggi: string;
	rendah: string;
} {
	if (!raw) return { tinggi: '', rendah: '' };
	try {
		const parsed = JSON.parse(raw) as CapaianTpEntry[];
		if (!Array.isArray(parsed)) return { tinggi: '', rendah: '' };
		const tList = parsed
			.filter((item) => item.status === 'T' && item.deskripsi)
			.map((item) => item.deskripsi!.trim());
		const rList = parsed
			.filter((item) => item.status === 'R' && item.deskripsi)
			.map((item) => item.deskripsi!.trim());
		return {
			tinggi: tList.length > 0 ? `Menunjukkan penguasaan yang baik dalam ${tList.join('; ')}.` : '',
			rendah: rList.length > 0 ? `Perlu bimbingan lebih lanjut dalam ${rList.join('; ')}.` : ''
		};
	} catch {
		return { tinggi: '', rendah: '' };
	}
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const auth = requireEraporAdmin(locals);
	if (auth.error) return auth.error;

	try {
		const body = (await request.json()) as {
			mode: 'dry-run' | 'push';
			type: 'nilai' | 'deskripsi' | 'both';
			kelasId: number;
			mataPelajaranId: number;
			semesterId?: string;
		};

		if (!body.kelasId || !body.mataPelajaranId) {
			return json({ error: 'Kelas dan mata pelajaran wajib dipilih.' }, { status: 400 });
		}

		const config = await getEraporConfig(auth.sekolah.id);
		const semesterId = body.semesterId?.trim() || config.activeSemesterId;
		if (!semesterId) {
			return json({ error: 'Semester target e-Rapor belum disetel.' }, { status: 400 });
		}

		const [kelas, mapel] = await Promise.all([
			db.query.tableKelas.findFirst({
				where: and(eq(tableKelas.id, body.kelasId), eq(tableKelas.sekolahId, auth.sekolah.id))
			}),
			db.query.tableMataPelajaran.findFirst({
				where: and(
					eq(tableMataPelajaran.id, body.mataPelajaranId),
					eq(tableMataPelajaran.kelasId, body.kelasId)
				)
			})
		]);

		if (!kelas || !mapel) {
			return json({ error: 'Kelas atau mata pelajaran tidak ditemukan.' }, { status: 404 });
		}

		const [mapRombel, mapMapel] = await Promise.all([
			db.query.tableEraporMapRombel.findFirst({
				where: and(
					eq(tableEraporMapRombel.sekolahId, auth.sekolah.id),
					eq(tableEraporMapRombel.siakadKelasId, kelas.id),
					eq(tableEraporMapRombel.semesterId, semesterId)
				)
			}),
			db.query.tableEraporMapMapel.findFirst({
				where: and(
					eq(tableEraporMapMapel.sekolahId, auth.sekolah.id),
					eq(tableEraporMapMapel.siakadMapelNama, mapel.nama.trim())
				)
			})
		]);

		const [muridRows, lockedRows, sumatifRows] = await Promise.all([
			db.query.tableMurid.findMany({
				columns: { id: true, nama: true, nisn: true },
				where: eq(tableMurid.kelasId, kelas.id)
			}),
			db.query.tableNilaiAkhirMapel.findMany({
				where: eq(tableNilaiAkhirMapel.mataPelajaranId, mapel.id)
			}),
			db.query.tableAsesmenSumatif.findMany({
				where: eq(tableAsesmenSumatif.mataPelajaranId, mapel.id)
			})
		]);

		const lockedByMurid = new Map(lockedRows.map((r) => [r.muridId, r]));
		const sumatifByMurid = new Map(sumatifRows.map((r) => [r.muridId, r]));

		const previewItems: Array<{
			muridId: number;
			nama: string;
			nisn: string;
			nilaiRapor: number | null;
			deskripsiTinggi: string;
			deskripsiRendah: string;
			skipReason: string | null;
		}> = [];

		for (const murid of muridRows) {
			const nisn = murid.nisn?.trim() ?? '';
			const locked = lockedByMurid.get(murid.id);
			const sumatif = sumatifByMurid.get(murid.id);
			const rawScore =
				typeof locked?.nilaiAkhir === 'number'
					? locked.nilaiAkhir
					: typeof sumatif?.nilaiAkhir === 'number'
						? sumatif.nilaiAkhir
						: null;

			const nilaiRapor = rawScore !== null ? Math.round(rawScore) : null;
			const { tinggi, rendah } = parseCapaianDeskripsi(locked?.capaianTp);

			let skipReason: string | null = null;
			if (!nisn) skipReason = 'NISN kosong';
			else if (nilaiRapor === null) skipReason = 'Belum ada nilai akhir';

			previewItems.push({
				muridId: murid.id,
				nama: murid.nama,
				nisn,
				nilaiRapor,
				deskripsiTinggi: tinggi,
				deskripsiRendah: rendah,
				skipReason
			});
		}

		const readyItems = previewItems.filter((item) => item.skipReason === null);

		if (body.mode === 'dry-run') {
			return json({
				ok: true,
				mode: 'dry-run',
				mappingReady: Boolean(mapRombel?.eraporRombelId && mapMapel?.eraporMapelId),
				eraporRombelId: mapRombel?.eraporRombelId ?? null,
				eraporMapelId: mapMapel?.eraporMapelId ?? null,
				summary: {
					totalMurid: previewItems.length,
					readyCount: readyItems.length,
					skippedCount: previewItems.length - readyItems.length
				},
				items: previewItems
			});
		}

		if (!mapRombel?.eraporRombelId || !mapMapel?.eraporMapelId) {
			return json(
				{
					error:
						'Rombel atau Mata Pelajaran belum dipetakan ke e-Rapor. Lengkapi di menu Pemetaan Data.'
				},
				{ status: 400 }
			);
		}
		if (!config.apiUrl || !config.apiKey) {
			return json({ error: 'Koneksi Bridge e-Rapor belum dikonfigurasi.' }, { status: 400 });
		}

		let totalSuccess = 0;
		let totalFailed = 0;
		const errors: string[] = [];

		for (const item of readyItems) {
			try {
				if (body.type === 'nilai' || body.type === 'both') {
					await eraporFetch(config, '/nilai-rapor', {
						method: 'POST',
						body: JSON.stringify({
							semester_id: semesterId,
							rombongan_belajar_id: mapRombel.eraporRombelId,
							mata_pelajaran_id: mapMapel.eraporMapelId,
							nisn: item.nisn,
							nilai_rapor: item.nilaiRapor
						})
					});
				}
				if (
					(body.type === 'deskripsi' || body.type === 'both') &&
					(item.deskripsiTinggi || item.deskripsiRendah)
				) {
					await eraporFetch(config, '/deskripsi', {
						method: 'POST',
						body: JSON.stringify({
							semester_id: semesterId,
							rombongan_belajar_id: mapRombel.eraporRombelId,
							mata_pelajaran_id: mapMapel.eraporMapelId,
							nisn: item.nisn,
							deskripsi_tinggi: item.deskripsiTinggi,
							deskripsi_rendah: item.deskripsiRendah
						})
					});
				}
				totalSuccess += 1;
			} catch (err: unknown) {
				totalFailed += 1;
				const msg = err instanceof Error ? err.message : String(err);
				errors.push(`${item.nama} (${item.nisn}): ${msg}`);
			}
		}

		const status: 'SUCCESS' | 'PARTIAL' | 'FAILED' =
			totalFailed === 0 ? 'SUCCESS' : totalSuccess > 0 ? 'PARTIAL' : 'FAILED';

		await logEraporSync({
			sekolahId: auth.sekolah.id,
			syncType: body.type === 'deskripsi' ? 'deskripsi' : 'nilai_rapor',
			targetInfo: `${kelas.nama} — ${mapel.nama} (Semester ${semesterId})`,
			totalData: readyItems.length,
			totalSuccess,
			totalFailed,
			requestPayload: {
				kelas: kelas.nama,
				mapel: mapel.nama,
				type: body.type,
				count: readyItems.length
			},
			responseBody: errors.length > 0 ? { errors: errors.slice(0, 20) } : { ok: true },
			status,
			executedBy: auth.user.username || 'admin'
		});

		return json({
			ok: status !== 'FAILED',
			mode: 'push',
			status,
			totalData: readyItems.length,
			totalSuccess,
			totalFailed,
			errors: errors.slice(0, 20)
		});
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		return json({ error: msg }, { status: 500 });
	}
};
