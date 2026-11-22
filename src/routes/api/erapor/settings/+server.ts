import { json, type RequestHandler } from '@sveltejs/kit';
import db from '$lib/server/db';
import { ensureEraporSchema } from '$lib/server/db/ensure-erapor';
import { tableEraporConfig } from '$lib/server/db/schema';
import { requireEraporAdmin } from '$lib/server/erapor/auth';
import { maskEraporApiKey, normalizeEraporBridgeUrl } from '$lib/server/erapor/client';
import { eq } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request, locals }) => {
	const auth = requireEraporAdmin(locals);
	if (auth.error) return auth.error;

	try {
		await ensureEraporSchema();
		const body = (await request.json()) as {
			apiUrl?: string;
			apiKey?: string;
			activeSemesterId?: string;
			timeoutMs?: number;
		};

		const normalizedUrl =
			typeof body.apiUrl === 'string' ? normalizeEraporBridgeUrl(body.apiUrl) : '';
		const existing = await db.query.tableEraporConfig.findFirst({
			where: eq(tableEraporConfig.sekolahId, auth.sekolah.id)
		});

		const timeoutMs =
			typeof body.timeoutMs === 'number' &&
			Number.isFinite(body.timeoutMs) &&
			body.timeoutMs >= 3000
				? Math.min(120000, Math.round(body.timeoutMs))
				: (existing?.timeoutMs ?? 30000);

		const nextData: {
			apiUrl: string;
			apiKey?: string;
			activeSemesterId: string | null;
			timeoutMs: number;
			updatedAt: string;
		} = {
			apiUrl: normalizedUrl,
			activeSemesterId:
				typeof body.activeSemesterId === 'string' && body.activeSemesterId.trim()
					? body.activeSemesterId.trim()
					: (existing?.activeSemesterId ?? null),
			timeoutMs,
			updatedAt: new Date().toISOString()
		};

		// Do not overwrite existing API key when the browser sends back a masked value
		if (typeof body.apiKey === 'string' && body.apiKey.trim() && !body.apiKey.includes('•')) {
			nextData.apiKey = body.apiKey.trim();
		}

		if (existing) {
			await db.update(tableEraporConfig).set(nextData).where(eq(tableEraporConfig.id, existing.id));
		} else {
			await db.insert(tableEraporConfig).values({
				sekolahId: auth.sekolah.id,
				apiUrl: nextData.apiUrl,
				apiKey: nextData.apiKey ?? '',
				activeSemesterId: nextData.activeSemesterId,
				timeoutMs: nextData.timeoutMs
			});
		}

		const finalKey = nextData.apiKey ?? existing?.apiKey ?? '';
		return json({
			success: true,
			message: 'Pengaturan koneksi e-Rapor SMA berhasil disimpan.',
			apiUrl: normalizedUrl,
			maskedKey: finalKey ? maskEraporApiKey(finalKey) : null,
			keySet: Boolean(finalKey)
		});
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		return json({ error: `Gagal menyimpan pengaturan e-Rapor: ${msg}` }, { status: 500 });
	}
};
