import { json, type RequestHandler } from '@sveltejs/kit';
import { testAkasConnection } from '$lib/server/akas/client';

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user) {
		return json({ error: 'Tidak terotentikasi' }, { status: 401 });
	}

	try {
		const payload = await request.json();
		const { baseUrl, apiKey } = payload;

		if (!baseUrl || !apiKey) {
			return json(
				{ error: 'URL Base AKAS dan API Key wajib diisi untuk menguji koneksi.' },
				{ status: 400 }
			);
		}

		const result = await testAkasConnection(baseUrl, apiKey);
		return json(result);
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		return json({ success: false, message: `Error test connection: ${msg}` }, { status: 500 });
	}
};
