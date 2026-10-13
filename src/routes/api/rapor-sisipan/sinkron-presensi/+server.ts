import { json, type RequestHandler } from '@sveltejs/kit';
import db from '$lib/server/db';
import { tableMurid } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { resolveSekolahAcademicContext } from '$lib/server/db/academic';
import { computeRaporAttendance } from '$lib/server/pdf/attendance-utils';
import { saveRtsCatatanWaliMurid } from '$lib/server/rapor-sisipan/rts-service';
import { getAkasConfig } from '$lib/server/akas/client';
import { syncAttendanceFromAkas, syncViolationsFromAkas } from '$lib/server/akas/sync';

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user) return json({ error: 'Tidak terotentikasi' }, { status: 401 });

	const sekolah = locals.sekolah;
	if (!sekolah?.id) return json({ error: 'Sekolah tidak ditemukan' }, { status: 400 });

	try {
		const payload = await request.json();
		const kelasId = Number(payload.kelasId);
		if (!kelasId) return json({ error: 'Kelas tidak valid' }, { status: 400 });

		const academicContext = await resolveSekolahAcademicContext(sekolah.id);
		const tahunAjaranId = academicContext?.activeTahunAjaranId;
		const semesterId = academicContext?.activeSemesterId;
		const semesterTipe = academicContext?.activeSemesterTipe ?? 'ganjil';

		if (!tahunAjaranId || !semesterId) {
			return json(
				{ error: 'Tahun ajaran atau semester aktif belum disetel di pengaturan akademik.' },
				{ status: 400 }
			);
		}

		const tanggalMasuk = academicContext.tanggalMasuk?.[semesterTipe] ?? null;
		const tanggalBagiRaport = academicContext.tanggalBagiRaport?.[semesterTipe] ?? null;

		const muridList = await db.query.tableMurid.findMany({
			where: eq(tableMurid.kelasId, kelasId)
		});

		const akasConfig = await getAkasConfig(sekolah.id, tahunAjaranId);
		const isAkasMode = akasConfig?.sumberPresensi === 'akas';

		let syncedCount = 0;

		if (isAkasMode && akasConfig?.apiKey) {
			// Mode AKAS: Tarik presensi dan pelanggaran langsung dari server AKAS
			try {
				await syncAttendanceFromAkas({
					sekolahId: sekolah.id,
					kelasId,
					tahunAjaranId,
					semesterId,
					mode: 'recap',
					startDate: tanggalMasuk ?? undefined,
					endDate: tanggalBagiRaport ?? undefined
				});
			} catch (aErr) {
				console.warn('[Sync RTS] Gagal tarik presensi dari AKAS:', aErr);
			}

			try {
				await syncViolationsFromAkas({
					sekolahId: sekolah.id,
					kelasId,
					tahunAjaranId
				});
			} catch (vErr) {
				console.warn('[Sync RTS] Gagal tarik pelanggaran dari AKAS:', vErr);
			}

			syncedCount = muridList.length;
		} else {
			// Mode Lokal: Rekap presensi dari absensi harian lokal Rapkumer
			for (const m of muridList) {
				const att = await computeRaporAttendance(sekolah.id, tahunAjaranId, m.id, {
					id: semesterId,
					tanggalMasuk,
					tanggalBagiRaport
				});

				await saveRtsCatatanWaliMurid({
					sekolahId: sekolah.id,
					kelasId,
					muridId: m.id,
					sakit: att.sakit,
					izin: att.izin,
					alfa: att.alfa
				});
				syncedCount++;
			}

			// Jika ada API Key AKAS, tetap tarik pelanggaran jika tersedia
			if (akasConfig?.apiKey) {
				try {
					await syncViolationsFromAkas({
						sekolahId: sekolah.id,
						kelasId,
						tahunAjaranId
					});
				} catch (vErr) {
					console.warn('[Sync RTS] Gagal sinkron pelanggaran AKAS:', vErr);
				}
			}
		}

		return json({
			success: true,
			count: syncedCount,
			message: isAkasMode
				? `Berhasil menyinkronkan data kehadiran dan pelanggaran dari AKAS untuk ${syncedCount} peserta didik.`
				: `Berhasil menyinkronkan data presensi untuk ${syncedCount} peserta didik.`
		});
	} catch (err) {
		console.error('Error syncing RTS presensi:', err);
		return json(
			{ error: (err as Error)?.message || 'Gagal menyinkronkan presensi.' },
			{ status: 500 }
		);
	}
};
