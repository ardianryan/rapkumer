import { json, type RequestHandler } from '@sveltejs/kit';
import { requireEraporAdmin } from '$lib/server/erapor/auth';
import { getEraporConfig, testEraporConnection } from '$lib/server/erapor/client';

export const POST: RequestHandler = async ({ request, locals }) => {
	const auth = requireEraporAdmin(locals);
	if (auth.error) return auth.error;

	try {
		const body = (await request.json().catch(() => ({}))) as {
			apiUrl?: string;
			apiKey?: string;
			timeoutMs?: number;
		};

		const stored = await getEraporConfig(auth.sekolah.id);
		const rawUrl =
			typeof body.apiUrl === 'string' && body.apiUrl.trim() ? body.apiUrl : stored.apiUrl;
		const rawKey =
			typeof body.apiKey === 'string' && body.apiKey.trim() && !body.apiKey.includes('•')
				? body.apiKey.trim()
				: stored.apiKey;
		const timeoutMs =
			typeof body.timeoutMs === 'number' && body.timeoutMs >= 3000
				? body.timeoutMs
				: stored.timeoutMs;

		const result = await testEraporConnection(rawUrl, rawKey, timeoutMs);
		return json(result, { status: result.success ? 200 : 400 });
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		return json({ success: false, message: msg }, { status: 500 });
	}
};
