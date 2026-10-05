import { json, type RequestHandler } from '@sveltejs/kit';
import { syncAttendanceFromAkas } from '$lib/server/akas/sync';
import { resolveSekolahAcademicContext } from '$lib/server/db/academic';

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user) {
		return json({ error: 'Tidak terotentikasi' }, { status: 401 });
	}

	const sekolah = locals.sekolah;
	if (!sekolah?.id) {
		return json({ error: 'Sekolah aktif tidak ditemukan.' }, { status: 400 });
	}

	try {
		const payload = await request.json();
		const { kelasId, mode = 'daily', date, startDate, endDate, month } = payload;

		const academicContext = await resolveSekolahAcademicContext(sekolah.id);

		const result = await syncAttendanceFromAkas({
			sekolahId: sekolah.id,
			tahunAjaranId: academicContext?.activeTahunAjaranId ?? undefined,
			semesterId: academicContext?.activeSemesterId ?? undefined,
			kelasId: kelasId ? Number(kelasId) : undefined,
			mode,
			date,
			startDate,
			endDate,
			month
		});

		return json(result);
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error('[API akas/sync error]:', msg);
		return json(
			{
				success: false,
				message: `Gagal menyinkronkan presensi dari AKAS: ${msg}`
			},
			{ status: 500 }
		);
	}
};
