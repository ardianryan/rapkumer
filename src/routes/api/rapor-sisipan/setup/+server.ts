import { json, type RequestHandler } from '@sveltejs/kit';
import { saveRtsSetup } from '$lib/server/rapor-sisipan/rts-service';

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user) {
		return json({ error: 'Tidak terotentikasi' }, { status: 401 });
	}

	const sekolah = locals.sekolah;
	if (!sekolah?.id) {
		return json({ error: 'Sekolah aktif tidak ditemukan' }, { status: 400 });
	}

	try {
		const payload = await request.json();
		const {
			kelasId,
			mataPelajaranId,
			komponenFormatif,
			komponenSumatif,
			adaStsTes,
			adaStsNonTes,
			bobotSumatifTp,
			bobotSts
		} = payload;

		if (!kelasId || !mataPelajaranId) {
			return json({ error: 'Kelas dan Mata Pelajaran harus dipilih.' }, { status: 400 });
		}

		if (!Array.isArray(komponenFormatif) || komponenFormatif.length === 0) {
			return json(
				{ error: 'Minimal harus ada 1 komponen Asesmen Formatif (Tugas Harian).' },
				{ status: 400 }
			);
		}

		if (!Array.isArray(komponenSumatif) || komponenSumatif.length === 0) {
			return json(
				{ error: 'Minimal harus ada 1 komponen Asesmen Sumatif (Ulangan TP).' },
				{ status: 400 }
			);
		}

		await saveRtsSetup({
			sekolahId: sekolah.id,
			kelasId: Number(kelasId),
			mataPelajaranId: Number(mataPelajaranId),
			komponenFormatif,
			komponenSumatif,
			adaStsTes: Boolean(adaStsTes),
			adaStsNonTes: Boolean(adaStsNonTes),
			bobotSumatifTp: Number(bobotSumatifTp) || 70,
			bobotSts: Number(bobotSts) || 30
		});

		return json({ success: true, message: 'Pengaturan asesmen berhasil disimpan.' });
	} catch (err) {
		console.error('Error saving RTS setup:', err);
		return json({ error: (err as Error)?.message || 'Terjadi kesalahan sistem' }, { status: 500 });
	}
};
