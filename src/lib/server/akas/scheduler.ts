import db from '$lib/server/db';
import { tableKelas } from '$lib/server/db/schema';
import { syncViolationsFromAkas } from './sync';
import { eq } from 'drizzle-orm';

let schedulerInterval: ReturnType<typeof setInterval> | null = null;
let lastSyncedDateStr: string | null = null;

function getTodayDateStr(): string {
	const now = new Date();
	const y = now.getFullYear();
	const m = String(now.getMonth() + 1).padStart(2, '0');
	const d = String(now.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

/**
 * Menjalankan sinkronisasi rekap pelanggaran AKAS harian untuk seluruh kelas aktif.
 */
export async function runDailyAkasViolationSync(): Promise<void> {
	try {
		console.log('[AKAS Scheduler] Memulai sinkronisasi rekap pelanggaran tengah malam (00:00)...');
		const settings = await db.query.tablePresensiSettings.findMany();

		for (const setting of settings) {
			if (!setting.akasApiKey?.trim()) continue;

			const classes = await db.query.tableKelas.findMany({
				where: eq(tableKelas.sekolahId, setting.sekolahId)
			});

			let syncedClasses = 0;
			for (const k of classes) {
				try {
					await syncViolationsFromAkas({
						sekolahId: setting.sekolahId,
						kelasId: k.id
					});
					syncedClasses++;
				} catch (err) {
					console.warn(
						`[AKAS Scheduler] Gagal menyinkronkan pelanggaran untuk kelas ${k.nama} (ID: ${k.id}):`,
						err
					);
				}
			}

			console.log(
				`[AKAS Scheduler] Selesai sinkronisasi untuk sekolah ID ${setting.sekolahId} (${syncedClasses}/${classes.length} kelas berhasil).`
			);
		}
	} catch (err) {
		console.error('[AKAS Scheduler] Error pada proses sinkronisasi harian:', err);
	}
}

/**
 * Memulai timer pengecekan jam 00:00 setiap hari.
 */
export function startAkasDailyScheduler(): void {
	if (schedulerInterval) return;

	// Periksa setiap 30 detik
	schedulerInterval = setInterval(() => {
		const now = new Date();
		const hours = now.getHours();
		const minutes = now.getMinutes();
		const todayStr = getTodayDateStr();

		// Trigger pada jam 00:00 (rentang menit ke-0) sekali sehari
		if (hours === 0 && minutes === 0 && lastSyncedDateStr !== todayStr) {
			lastSyncedDateStr = todayStr;
			runDailyAkasViolationSync().catch((e) => {
				console.error('[AKAS Scheduler] Unhandled error during scheduled run:', e);
			});
		}
	}, 30_000);

	console.log('[AKAS Scheduler] Daily 00:00 violation sync scheduler aktif.');
}

/**
 * Menghentikan scheduler jika service dimatikan.
 */
export function stopAkasDailyScheduler(): void {
	if (schedulerInterval) {
		clearInterval(schedulerInterval);
		schedulerInterval = null;
		console.log('[AKAS Scheduler] Scheduler dihentikan.');
	}
}
