import { json, type RequestHandler } from '@sveltejs/kit';
import { saveRtsSetup, deleteRtsSetup } from '$lib/server/rapor-sisipan/rts-service';
import db from '$lib/server/db';
import { tableSekolah } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { canUserEditMapel } from '$lib/server/mapel-access';

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user) {
		return json({ error: 'Tidak terotentikasi' }, { status: 401 });
	}

	const sekolah = locals.sekolah;
	if (!sekolah?.id) {
		return json({ error: 'Sekolah aktif tidak ditemukan' }, { status: 400 });
	}

	try {
		const payload = await request.json();
		const {
			kelasId,
			mataPelajaranId,
			komponenFormatif,
			komponenSumatif,
			adaStsTes,
			adaStsNonTes,
			bobotSumatifTp,
			bobotSts
		} = payload;

		if (!kelasId || !mataPelajaranId) {
			return json({ error: 'Kelas dan Mata Pelajaran harus dipilih.' }, { status: 400 });
		}

		const isAllowed = await canUserEditMapel(user, Number(kelasId), Number(mataPelajaranId));
		if (!isAllowed) {
			return json(
				{ error: 'Akses ditolak. Anda bukan guru pengampu mata pelajaran ini.' },
				{ status: 403 }
			);
		}

		if (!Array.isArray(komponenFormatif) || komponenFormatif.length === 0) {
			return json({ error: 'Minimal harus ada 1 komponen Tugas.' }, { status: 400 });
		}

		if (!Array.isArray(komponenSumatif) || komponenSumatif.length === 0) {
			return json(
				{ error: 'Minimal harus ada 1 komponen Asesmen Formatif Lingkup Materi.' },
				{ status: 400 }
			);
		}

		// Cek apakah kebijakan sekolah mengizinkan STS
		const currentSekolah = await db.query.tableSekolah.findFirst({
			where: eq(tableSekolah.id, sekolah.id),
			columns: { rtsShowSts: true }
		});
		const isStsAllowed = (currentSekolah?.rtsShowSts ?? 1) === 1;

		const finalAdaStsTes = isStsAllowed ? Boolean(adaStsTes) : false;
		const finalAdaStsNonTes = isStsAllowed ? Boolean(adaStsNonTes) : false;
		const finalBobotSumatifTp = isStsAllowed ? Number(bobotSumatifTp) || 70 : 100;
		const finalBobotSts = isStsAllowed ? Number(bobotSts) || 30 : 0;

		await saveRtsSetup({
			sekolahId: sekolah.id,
			kelasId: Number(kelasId),
			mataPelajaranId: Number(mataPelajaranId),
			komponenFormatif,
			komponenSumatif,
			adaStsTes: finalAdaStsTes,
			adaStsNonTes: finalAdaStsNonTes,
			bobotSumatifTp: finalBobotSumatifTp,
			bobotSts: finalBobotSts
		});

		return json({ success: true, message: 'Pengaturan asesmen berhasil disimpan.' });
	} catch (err) {
		console.error('Error saving RTS setup:', err);
		return json({ error: (err as Error)?.message || 'Terjadi kesalahan sistem' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user) {
		return json({ error: 'Tidak terotentikasi' }, { status: 401 });
	}

	const sekolah = locals.sekolah;
	if (!sekolah?.id) {
		return json({ error: 'Sekolah aktif tidak ditemukan' }, { status: 400 });
	}

	try {
		const payload = await request.json();
		const { kelasId, mataPelajaranId } = payload;

		if (!kelasId || !mataPelajaranId) {
			return json({ error: 'Kelas dan Mata Pelajaran harus dipilih.' }, { status: 400 });
		}

		const isAllowed = await canUserEditMapel(user, Number(kelasId), Number(mataPelajaranId));
		if (!isAllowed) {
			return json(
				{ error: 'Akses ditolak. Anda bukan guru pengampu mata pelajaran ini.' },
				{ status: 403 }
			);
		}

		await deleteRtsSetup(Number(kelasId), Number(mataPelajaranId), sekolah.id);

		return json({ success: true, message: 'Konfigurasi asesmen berhasil direset ke default.' });
	} catch (err) {
		console.error('Error deleting RTS setup:', err);
		return json({ error: (err as Error)?.message || 'Terjadi kesalahan sistem' }, { status: 500 });
	}
};
