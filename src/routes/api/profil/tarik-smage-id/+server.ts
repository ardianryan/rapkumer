import { json, type RequestHandler } from '@sveltejs/kit';
import { syncGuruProfileFromScholargate } from '$lib/server/scholargate/sync';

export const POST: RequestHandler = async ({ locals }) => {
	const user = locals.user;
	if (!user) {
		return json({ error: 'Tidak terotentikasi. Silakan login terlebih dahulu.' }, { status: 401 });
	}

	const sekolah = locals.sekolah;
	if (!sekolah?.id) {
		return json({ error: 'Sekolah aktif tidak ditemukan.' }, { status: 400 });
	}

	try {
		// Tarik dan langsung simpan ke database (guru tidak perlu admin dan tidak perlu simpan manual lagi)
		const updatedProfile = await syncGuruProfileFromScholargate(user.id, sekolah.id);

		return json({
			success: true,
			message: 'Identitas berhasil ditarik dan diperbarui langsung dari SMAGE ID.',
			profile: updatedProfile
		});
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error('[API profil/tarik-smage-id error]:', msg);
		return json({ error: msg }, { status: 400 });
	}
};
