import { json, type RequestHandler } from '@sveltejs/kit';
import db from '$lib/server/db';
import { tablePresensiSettings } from '$lib/server/db/schema';
import { resolveSekolahAcademicContext } from '$lib/server/db/academic';
import { and, eq } from 'drizzle-orm';

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
		const { sumberPresensi = 'lokal', akasBaseUrl, akasApiKey } = payload;

		const academicContext = await resolveSekolahAcademicContext(sekolah.id);
		const tahunAjaranId = academicContext?.activeTahunAjaranId;

		if (!tahunAjaranId) {
			return json({ error: 'Tahun ajaran aktif tidak ditemukan.' }, { status: 400 });
		}

		const existing = await db.query.tablePresensiSettings.findFirst({
			where: and(
				eq(tablePresensiSettings.sekolahId, sekolah.id),
				eq(tablePresensiSettings.tahunAjaranId, tahunAjaranId)
			)
		});

		const updateData: {
			sumberPresensi: 'lokal' | 'akas';
			akasBaseUrl?: string;
			akasApiKey?: string;
			updatedAt: string;
		} = {
			sumberPresensi: sumberPresensi === 'akas' ? 'akas' : 'lokal',
			updatedAt: new Date().toISOString()
		};

		if (typeof akasBaseUrl === 'string') {
			updateData.akasBaseUrl = akasBaseUrl.trim();
		}

		// Jangan timpa jika input apiKey berupa masked (mengandung bullet •) atau kosong
		if (typeof akasApiKey === 'string' && akasApiKey.trim() && !akasApiKey.includes('•')) {
			updateData.akasApiKey = akasApiKey.trim();
		}

		if (existing) {
			await db
				.update(tablePresensiSettings)
				.set(updateData)
				.where(eq(tablePresensiSettings.id, existing.id));
		} else {
			await db.insert(tablePresensiSettings).values({
				sekolahId: sekolah.id,
				tahunAjaranId,
				...updateData
			});
		}

		return json({
			success: true,
			message: 'Pengaturan integrasi presensi AKAS berhasil disimpan.'
		});
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error('[API pengaturan/akas error]:', msg);
		return json({ error: `Gagal menyimpan pengaturan AKAS: ${msg}` }, { status: 500 });
	}
};
