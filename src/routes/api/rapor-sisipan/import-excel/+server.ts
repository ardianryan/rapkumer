import { json, type RequestHandler } from '@sveltejs/kit';
import { getRtsSetup, saveRtsNilaiKolektif } from '$lib/server/rapor-sisipan/rts-service';
import { parseRtsExcel } from '$lib/server/rapor-sisipan/excel';

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user) {
		return json({ error: 'Tidak terotentikasi' }, { status: 401 });
	}

	const sekolah = locals.sekolah;
	if (!sekolah?.id) {
		return json({ error: 'Sekolah tidak ditemukan' }, { status: 400 });
	}

	try {
		const formData = await request.formData();
		const file = formData.get('file') as File | null;
		const kelasId = Number(formData.get('kelasId'));
		const mataPelajaranId = Number(formData.get('mapelId'));
		const autoSave = formData.get('autoSave') === 'true';

		if (!file) {
			return json({ error: 'Berkas Excel wajib diunggah.' }, { status: 400 });
		}
		if (!kelasId || !mataPelajaranId) {
			return json({ error: 'Kelas dan Mata Pelajaran tidak valid.' }, { status: 400 });
		}

		const setup = await getRtsSetup(kelasId, mataPelajaranId);
		if (!setup) {
			return json(
				{ error: 'Komponen asesmen belum diatur. Lakukan pengaturan terlebih dahulu.' },
				{ status: 400 }
			);
		}

		const arrayBuffer = await file.arrayBuffer();
		const items = await parseRtsExcel(arrayBuffer, {
			komponenFormatif: setup.komponenFormatif,
			komponenSumatif: setup.komponenSumatif,
			adaStsTes: setup.adaStsTes,
			adaStsNonTes: setup.adaStsNonTes
		});

		if (items.length === 0) {
			return json(
				{ error: 'Tidak ditemukan data nilai yang valid di dalam file Excel.' },
				{ status: 400 }
			);
		}

		if (autoSave) {
			await saveRtsNilaiKolektif(sekolah.id, kelasId, mataPelajaranId, items);
		}

		return json({
			success: true,
			count: items.length,
			items,
			message: `Berhasil memproses nilai untuk ${items.length} murid.${autoSave ? ' Data tersimpan.' : ''}`
		});
	} catch (err) {
		console.error('Error importing RTS Excel:', err);
		return json(
			{ error: (err as Error)?.message || 'Gagal memproses berkas Excel.' },
			{ status: 500 }
		);
	}
};
