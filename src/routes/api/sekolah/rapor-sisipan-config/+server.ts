import { json, type RequestHandler } from '@sveltejs/kit';
import db from '$lib/server/db';
import { tableSekolah } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { isAdminUser } from '../../../pengguna/permissions';

export const GET: RequestHandler = async ({ locals }) => {
	const sekolah = locals.sekolah;
	if (!sekolah?.id) {
		return json({ error: 'Sekolah aktif tidak ditemukan.' }, { status: 400 });
	}

	const s = await db.query.tableSekolah.findFirst({
		where: eq(tableSekolah.id, sekolah.id),
		columns: {
			rtsMaxFormatif: true,
			rtsMaxSumatif: true
		}
	});

	return json({
		maxFormatif: Number(s?.rtsMaxFormatif ?? 4),
		maxSumatif: Number(s?.rtsMaxSumatif ?? 3)
	});
};

export const PUT: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user) {
		return json({ error: 'Tidak terotentikasi.' }, { status: 401 });
	}

	if (!isAdminUser(user)) {
		return json({ error: 'Hanya admin yang dapat mengubah pengaturan ini.' }, { status: 403 });
	}

	const sekolah = locals.sekolah;
	if (!sekolah?.id) {
		return json({ error: 'Sekolah aktif tidak ditemukan.' }, { status: 400 });
	}

	try {
		const payload = await request.json();
		const maxFormatif = Math.max(1, Math.min(10, Math.round(Number(payload.maxFormatif) || 4)));
		const maxSumatif = Math.max(1, Math.min(10, Math.round(Number(payload.maxSumatif) || 3)));

		await db
			.update(tableSekolah)
			.set({
				rtsMaxFormatif: maxFormatif,
				rtsMaxSumatif: maxSumatif,
				updatedAt: new Date().toISOString()
			})
			.where(eq(tableSekolah.id, sekolah.id));

		return json({
			success: true,
			message: 'Aturan maksimal komponen rapor sisipan berhasil disimpan.',
			maxFormatif,
			maxSumatif
		});
	} catch (err) {
		console.error('Error updating RTS config:', err);
		return json({ error: (err as Error)?.message || 'Terjadi kesalahan sistem' }, { status: 500 });
	}
};
