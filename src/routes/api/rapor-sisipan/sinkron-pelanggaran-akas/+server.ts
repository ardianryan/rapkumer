import { json, type RequestHandler } from '@sveltejs/kit';
import { isWaliOfKelas } from '$lib/server/kelas-akses';
import { syncViolationsFromAkas } from '$lib/server/akas/sync';

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user) return json({ error: 'Tidak terotentikasi' }, { status: 401 });

	const sekolah = locals.sekolah;
	if (!sekolah?.id) return json({ error: 'Sekolah tidak ditemukan' }, { status: 400 });

	try {
		const payload = await request.json();
		const kelasId = Number(payload.kelasId);
		if (!kelasId) return json({ error: 'Kelas ID tidak valid' }, { status: 400 });

		const typedUser = user as {
			type?: string;
			id?: number;
			pegawaiId?: number | null;
			kelasId?: number | null;
			ownKelasIds?: number[] | null;
		};

		const isWali = await isWaliOfKelas(typedUser, kelasId);
		const isAllowed = typedUser.type === 'admin' || typedUser.type === 'kepala_sekolah' || isWali;
		if (!isAllowed) {
			return json(
				{
					error:
						'Akses ditolak. Hanya Wali Kelas atau Administrator yang dapat menyinkronkan data AKAS.'
				},
				{ status: 403 }
			);
		}

		const result = await syncViolationsFromAkas({
			sekolahId: sekolah.id,
			kelasId
		});

		return json({
			success: true,
			message: result.message,
			data: result
		});
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return json({ error: msg }, { status: 500 });
	}
};
