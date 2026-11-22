import { json, type RequestHandler } from '@sveltejs/kit';
import db from '$lib/server/db';
import {
	tableCatatanWaliKelas,
	tableEraporMapRombel,
	tableKehadiranMurid,
	tableKelas,
	tableKetidakhadiranRapor,
	tableMurid
} from '$lib/server/db/schema';
import { resolveSekolahAcademicContext } from '$lib/server/db/academic';
import { requireEraporAdmin } from '$lib/server/erapor/auth';
import { eraporFetch, getEraporConfig, logEraporSync } from '$lib/server/erapor/client';
import { and, eq, inArray } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request, locals }) => {
	const auth = requireEraporAdmin(locals);
	if (auth.error) return auth.error;

	try {
		const body = (await request.json()) as {
			mode: 'dry-run' | 'push';
			type: 'kehadiran' | 'catatan' | 'both';
			kelasId: number;
			semesterId?: string;
		};

		if (!body.kelasId) {
			return json({ error: 'Kelas wajib dipilih.' }, { status: 400 });
		}

		const config = await getEraporConfig(auth.sekolah.id);
		const semesterId = body.semesterId?.trim() || config.activeSemesterId;
		if (!semesterId) {
			return json({ error: 'Semester target e-Rapor belum disetel.' }, { status: 400 });
		}

		const kelas = await db.query.tableKelas.findFirst({
			where: and(eq(tableKelas.id, body.kelasId), eq(tableKelas.sekolahId, auth.sekolah.id))
		});
		if (!kelas) {
			return json({ error: 'Kelas tidak ditemukan.' }, { status: 404 });
		}

		const mapRombel = await db.query.tableEraporMapRombel.findFirst({
			where: and(
				eq(tableEraporMapRombel.sekolahId, auth.sekolah.id),
				eq(tableEraporMapRombel.siakadKelasId, kelas.id),
				eq(tableEraporMapRombel.semesterId, semesterId)
			)
		});

		const muridRows = await db.query.tableMurid.findMany({
			columns: { id: true, nama: true, nisn: true },
			where: eq(tableMurid.kelasId, kelas.id)
		});
		const muridIds = muridRows.map((m) => m.id);
		const academic = await resolveSekolahAcademicContext(auth.sekolah.id);

		const [catatanRows, raporAbsenRows, legacyAbsenRows] = await Promise.all([
			muridIds.length > 0
				? db.query.tableCatatanWaliKelas.findMany({
						where: inArray(tableCatatanWaliKelas.muridId, muridIds)
					})
				: Promise.resolve([]),
			muridIds.length > 0 && academic?.activeSemesterId
				? db.query.tableKetidakhadiranRapor.findMany({
						where: and(
							inArray(tableKetidakhadiranRapor.muridId, muridIds),
							eq(tableKetidakhadiranRapor.semesterId, academic.activeSemesterId)
						)
					})
				: Promise.resolve([]),
			muridIds.length > 0
				? db.query.tableKehadiranMurid.findMany({
						where: inArray(tableKehadiranMurid.muridId, muridIds)
					})
				: Promise.resolve([])
		]);

		const catatanByMurid = new Map(catatanRows.map((c) => [c.muridId, c.catatan?.trim() ?? '']));
		const raporAbsenByMurid = new Map(raporAbsenRows.map((r) => [r.muridId, r]));
		const legacyAbsenByMurid = new Map(legacyAbsenRows.map((r) => [r.muridId, r]));

		const items = muridRows.map((m) => {
			const nisn = m.nisn?.trim() ?? '';
			const absenRapor = raporAbsenByMurid.get(m.id);
			const absenLegacy = legacyAbsenByMurid.get(m.id);
			const sakit = absenRapor?.sakit ?? absenLegacy?.sakit ?? 0;
			const izin = absenRapor?.izin ?? absenLegacy?.izin ?? 0;
			const alfa = absenRapor?.alfa ?? absenLegacy?.alfa ?? 0;
			const catatan = catatanByMurid.get(m.id) ?? '';

			return {
				muridId: m.id,
				nama: m.nama,
				nisn,
				sakit,
				izin,
				alfa,
				catatan,
				skipReason: !nisn ? 'NISN kosong' : null
			};
		});

		const readyItems = items.filter((i) => i.skipReason === null);

		if (body.mode === 'dry-run') {
			return json({
				ok: true,
				mode: 'dry-run',
				mappingReady: Boolean(mapRombel?.eraporRombelId),
				eraporRombelId: mapRombel?.eraporRombelId ?? null,
				summary: {
					totalMurid: items.length,
					readyCount: readyItems.length,
					skippedCount: items.length - readyItems.length
				},
				items
			});
		}

		if (!mapRombel?.eraporRombelId) {
			return json(
				{ error: 'Kelas ini belum dipetakan ke Rombel e-Rapor. Lengkapi di Pemetaan Data.' },
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
				if (body.type === 'kehadiran' || body.type === 'both') {
					await eraporFetch(config, '/kehadiran', {
						method: 'POST',
						body: JSON.stringify({
							semester_id: semesterId,
							rombongan_belajar_id: mapRombel.eraporRombelId,
							nisn: item.nisn,
							sakit: item.sakit,
							izin: item.izin,
							tanpa_keterangan: item.alfa
						})
					});
				}
				if ((body.type === 'catatan' || body.type === 'both') && item.catatan) {
					await eraporFetch(config, '/catatan-wali', {
						method: 'POST',
						body: JSON.stringify({
							semester_id: semesterId,
							rombongan_belajar_id: mapRombel.eraporRombelId,
							nisn: item.nisn,
							catatan: item.catatan
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
			syncType: body.type === 'catatan' ? 'catatan_wali' : 'kehadiran',
			targetInfo: `${kelas.nama} (Semester ${semesterId})`,
			totalData: readyItems.length,
			totalSuccess,
			totalFailed,
			requestPayload: { kelas: kelas.nama, type: body.type, count: readyItems.length },
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
