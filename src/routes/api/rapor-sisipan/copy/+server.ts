import { json, type RequestHandler } from '@sveltejs/kit';
import { copyRtsSetupAndScores } from '$lib/server/rapor-sisipan/rts-service';
import { isAdminUser } from '../../../pengguna/permissions';

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user) {
		return json({ error: 'Tidak terotentikasi.' }, { status: 401 });
	}

	// Fitur copy mapel komponen & nilai khusus saat mode admin
	if (!isAdminUser(user)) {
		return json(
			{
				error:
					'Hanya administrator yang diizinkan menyalin komponen asesmen dan nilai antar mata pelajaran.'
			},
			{ status: 403 }
		);
	}

	const sekolah = locals.sekolah;
	if (!sekolah?.id) {
		return json({ error: 'Sekolah aktif tidak ditemukan.' }, { status: 400 });
	}

	try {
		const body = await request.json();
		const sourceKelasId = Number(body.sourceKelasId);
		const sourceMapelId = Number(body.sourceMapelId);
		const targetKelasId = Number(body.targetKelasId);
		const targetMapelId = Number(body.targetMapelId);

		if (!sourceKelasId || !sourceMapelId || !targetKelasId || !targetMapelId) {
			return json(
				{
					error:
						'Parameter sourceKelasId, sourceMapelId, targetKelasId, dan targetMapelId harus valid.'
				},
				{ status: 400 }
			);
		}

		const result = await copyRtsSetupAndScores({
			sekolahId: sekolah.id,
			sourceKelasId,
			sourceMapelId,
			targetKelasId,
			targetMapelId
		});

		return json(result);
	} catch (err) {
		console.error('[API copyRtsSetupAndScores] error:', err);
		return json(
			{ error: (err as Error)?.message || 'Gagal menyalin komponen asesmen dan nilai.' },
			{ status: 400 }
		);
	}
};
