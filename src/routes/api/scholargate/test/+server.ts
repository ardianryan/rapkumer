import { json, type RequestHandler } from '@sveltejs/kit';
import { testScholargateConnection } from '$lib/server/scholargate/client';

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user) {
		return json({ error: 'Tidak terotentikasi' }, { status: 401 });
	}

	if (user.type !== 'admin' && user.type !== 'kepala_sekolah') {
		return json(
			{ error: 'Akses ditolak. Hanya administrator yang dapat menguji koneksi ini.' },
			{ status: 403 }
		);
	}

	try {
		const payload = await request.json();
		const { baseUrl, apiKey, referer } = payload;

		const result = await testScholargateConnection(baseUrl, apiKey, referer);
		return json(result);
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		return json(
			{ success: false, message: `Kesalahan saat menguji koneksi: ${msg}` },
			{ status: 500 }
		);
	}
};
