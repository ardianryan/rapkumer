import { json, type RequestHandler } from '@sveltejs/kit';
import { saveRtsCatatanWaliMassal } from '$lib/server/rapor-sisipan/rts-service';

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user) return json({ error: 'Tidak terotentikasi' }, { status: 401 });

	const sekolah = locals.sekolah;
	if (!sekolah?.id) return json({ error: 'Sekolah tidak ditemukan' }, { status: 400 });

	try {
		const payload = await request.json();
		const { kelasId, items } = payload as {
			kelasId: number;
			items: Array<{
				muridId: number;
				catatanWali?: string | null;
				sakit?: number | null;
				izin?: number | null;
				alfa?: number | null;
			}>;
		};

		if (!kelasId || !Array.isArray(items)) {
			return json({ error: 'Data kelas atau catatan tidak valid.' }, { status: 400 });
		}

		await saveRtsCatatanWaliMassal(sekolah.id, Number(kelasId), items);

		return json({
			success: true,
			message: 'Catatan wali kelas dan data presensi tengah semester berhasil disimpan.'
		});
	} catch (err) {
		console.error('Error saving RTS catatan wali:', err);
		return json(
			{ error: (err as Error)?.message || 'Gagal menyimpan catatan wali kelas.' },
			{ status: 500 }
		);
	}
};
