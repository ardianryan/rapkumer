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
			rtsMaxSumatif: true,
			rtsShowRataTugas: true,
			rtsShowRataFormatif: true,
			rtsShowSts: true,
			rtsShowNaSts: true
		}
	});

	return json({
		maxFormatif: Number(s?.rtsMaxFormatif ?? 4),
		maxSumatif: Number(s?.rtsMaxSumatif ?? 3),
		maxTugas: Number(s?.rtsMaxFormatif ?? 4),
		showRataTugas: (s?.rtsShowRataTugas ?? 1) === 1,
		showRataFormatif: (s?.rtsShowRataFormatif ?? 1) === 1,
		showSts: (s?.rtsShowSts ?? 1) === 1,
		showNaSts: (s?.rtsShowNaSts ?? 1) === 1
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
		const maxFormatif = Math.max(
			1,
			Math.min(10, Math.round(Number(payload.maxFormatif ?? payload.maxTugas) || 4))
		);
		const maxSumatif = Math.max(1, Math.min(10, Math.round(Number(payload.maxSumatif) || 3)));

		const showRataTugas = payload.showRataTugas !== undefined ? (payload.showRataTugas ? 1 : 0) : 1;
		const showRataFormatif =
			payload.showRataFormatif !== undefined ? (payload.showRataFormatif ? 1 : 0) : 1;
		const showSts = payload.showSts !== undefined ? (payload.showSts ? 1 : 0) : 1;
		const showNaSts = payload.showNaSts !== undefined ? (payload.showNaSts ? 1 : 0) : 1;

		await db
			.update(tableSekolah)
			.set({
				rtsMaxFormatif: maxFormatif,
				rtsMaxSumatif: maxSumatif,
				rtsShowRataTugas: showRataTugas,
				rtsShowRataFormatif: showRataFormatif,
				rtsShowSts: showSts,
				rtsShowNaSts: showNaSts,
				updatedAt: new Date().toISOString()
			})
			.where(eq(tableSekolah.id, sekolah.id));

		return json({
			success: true,
			message: 'Pengaturan aturan cetak rapor sisipan berhasil disimpan.',
			maxFormatif,
			maxSumatif,
			maxTugas: maxFormatif,
			showRataTugas: showRataTugas === 1,
			showRataFormatif: showRataFormatif === 1,
			showSts: showSts === 1,
			showNaSts: showNaSts === 1
		});
	} catch (err) {
		console.error('Error updating RTS config:', err);
		return json({ error: (err as Error)?.message || 'Terjadi kesalahan sistem' }, { status: 500 });
	}
};
