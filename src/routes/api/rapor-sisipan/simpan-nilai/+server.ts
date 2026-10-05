import { json, type RequestHandler } from '@sveltejs/kit';
import {
	saveRtsNilaiKolektif,
	type RtsNilaiInputItem
} from '$lib/server/rapor-sisipan/rts-service';

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
		const { kelasId, mataPelajaranId, items } = payload as {
			kelasId: number;
			mataPelajaranId: number;
			items: RtsNilaiInputItem[];
		};

		if (!kelasId || !mataPelajaranId) {
			return json({ error: 'Kelas dan Mata Pelajaran tidak valid.' }, { status: 400 });
		}

		if (!Array.isArray(items)) {
			return json({ error: 'Data nilai tidak valid.' }, { status: 400 });
		}

		await saveRtsNilaiKolektif(sekolah.id, Number(kelasId), Number(mataPelajaranId), items);

		return json({
			success: true,
			message: `Berhasil menyimpan nilai untuk ${items.length} murid.`
		});
	} catch (err) {
		console.error('Error saving RTS nilai:', err);
		return json({ error: (err as Error)?.message || 'Gagal menyimpan nilai' }, { status: 500 });
	}
};
