import { json, type RequestHandler } from '@sveltejs/kit';
import { requireEraporAdmin } from '$lib/server/erapor/auth';
import {
	fetchEraporKegiatanKokurikuler,
	fetchEraporKelompokKokurikuler,
	fetchEraporMapels,
	fetchEraporP5Subdimensi,
	fetchEraporPtk,
	fetchEraporRombels,
	fetchEraporSemesters,
	getEraporConfig
} from '$lib/server/erapor/client';

export const GET: RequestHandler = async ({ url, locals }) => {
	const auth = requireEraporAdmin(locals);
	if (auth.error) return auth.error;

	const entity = url.searchParams.get('entity') ?? '';
	const semesterParam = url.searchParams.get('semester') ?? '';

	try {
		const config = await getEraporConfig(auth.sekolah.id);
		if (!config.apiUrl || !config.apiKey) {
			return json(
				{ error: 'Koneksi e-Rapor belum dikonfigurasi. Lengkapi URL dan API Key terlebih dahulu.' },
				{ status: 400 }
			);
		}

		const semester = semesterParam || config.activeSemesterId || undefined;

		switch (entity) {
			case 'semester':
				return json({ ok: true, data: await fetchEraporSemesters(config) });
			case 'rombel':
				return json({ ok: true, data: await fetchEraporRombels(config, semester) });
			case 'mapel':
				return json({ ok: true, data: await fetchEraporMapels(config) });
			case 'ptk':
				return json({ ok: true, data: await fetchEraporPtk(config) });
			case 'kegiatan':
				return json({ ok: true, data: await fetchEraporKegiatanKokurikuler(config) });
			case 'kelompok':
				return json({ ok: true, data: await fetchEraporKelompokKokurikuler(config, semester) });
			case 'subdimensi':
				return json({ ok: true, data: await fetchEraporP5Subdimensi(config) });
			default:
				return json({ error: `Entitas referensi '${entity}' tidak dikenal.` }, { status: 400 });
		}
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		return json({ error: msg }, { status: 500 });
	}
};
