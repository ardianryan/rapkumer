import { json, type RequestHandler } from '@sveltejs/kit';
import db from '$lib/server/db';
import { tableScholargateSettings } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user) {
		return json({ error: 'Tidak terotentikasi' }, { status: 401 });
	}

	if (user.type !== 'admin' && user.type !== 'kepala_sekolah') {
		return json(
			{ error: 'Akses ditolak. Hanya administrator yang dapat mengubah pengaturan ini.' },
			{ status: 403 }
		);
	}

	const sekolah = locals.sekolah;
	if (!sekolah?.id) {
		return json({ error: 'Sekolah aktif tidak ditemukan.' }, { status: 400 });
	}

	try {
		const payload = await request.json();
		const { baseUrl, apiKey, referer } = payload;

		const existing = await db.query.tableScholargateSettings.findFirst({
			where: eq(tableScholargateSettings.sekolahId, sekolah.id)
		});

		const updateData: {
			baseUrl?: string;
			apiKey?: string;
			referer?: string;
			updatedAt: string;
		} = {
			updatedAt: new Date().toISOString()
		};

		if (typeof baseUrl === 'string') {
			updateData.baseUrl = baseUrl.trim();
		}

		if (typeof referer === 'string') {
			updateData.referer = referer.trim();
		}

		// Jangan timpa jika input apiKey berupa masked (mengandung bullet •) atau kosong
		if (typeof apiKey === 'string' && apiKey.trim() && !apiKey.includes('•')) {
			updateData.apiKey = apiKey.trim();
		}

		if (existing) {
			await db
				.update(tableScholargateSettings)
				.set(updateData)
				.where(eq(tableScholargateSettings.id, existing.id));
		} else {
			await db.insert(tableScholargateSettings).values({
				sekolahId: sekolah.id,
				baseUrl: updateData.baseUrl || '',
				apiKey: updateData.apiKey || '',
				referer: updateData.referer || '',
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			});
		}

		return json({
			success: true,
			message: 'Pengaturan integrasi SMAGE ID (ScholarGate) berhasil disimpan.'
		});
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error('[API pengaturan/scholargate error]:', msg);
		return json({ error: `Gagal menyimpan pengaturan SMAGE ID: ${msg}` }, { status: 500 });
	}
};
