import { json, type RequestHandler } from '@sveltejs/kit';
import db from '$lib/server/db';
import { tableSekolah } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user) {
		return json({ error: 'Tidak terotentikasi' }, { status: 401 });
	}

	if (user.type !== 'admin' && user.type !== 'kepala_sekolah') {
		return json(
			{ error: 'Akses ditolak. Hanya administrator yang dapat mengubah visibilitas menu.' },
			{ status: 403 }
		);
	}

	const sekolah = locals.sekolah;
	if (!sekolah?.id) {
		return json({ error: 'Sekolah aktif tidak ditemukan' }, { status: 400 });
	}

	try {
		const payload = await request.json();
		const { hiddenMenuPaths } = payload;

		if (!Array.isArray(hiddenMenuPaths)) {
			return json({ error: 'Data hiddenMenuPaths harus berupa array.' }, { status: 400 });
		}

		// Sanitasi hanya string valid yang diawali dengan slash /
		const sanitizedPaths = hiddenMenuPaths.filter(
			(p): p is string => typeof p === 'string' && p.startsWith('/')
		);

		await db
			.update(tableSekolah)
			.set({
				hiddenMenuPaths: sanitizedPaths,
				updatedAt: new Date().toISOString()
			})
			.where(eq(tableSekolah.id, sekolah.id));

		return json({
			success: true,
			message: 'Pengaturan visibilitas menu berhasil disimpan.',
			hiddenMenuPaths: sanitizedPaths
		});
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error('[API menu-visibility error]:', msg);
		return json({ error: 'Gagal menyimpan pengaturan visibilitas menu: ' + msg }, { status: 500 });
	}
};
