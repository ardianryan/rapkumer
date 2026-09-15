import db from './index';
import { ensureSchema } from './ensure-helper';
import { eq, inArray } from 'drizzle-orm';
import {
	tableAuthUser,
	tableAuthUserKelas,
	tableAuthUserPembelajaran,
	tableKelas,
	tableSemester
} from './schema';

const PEMBELAJARAN_SCHEMA = 'auth_user_pembelajaran';

export async function ensurePembelajaranSchema() {
	const isPg = db.$client?.isPostgres;

	if (isPg) {
		await ensureSchema(PEMBELAJARAN_SCHEMA, [
			`CREATE TABLE IF NOT EXISTS "auth_user_pembelajaran" (
				"id" SERIAL PRIMARY KEY NOT NULL,
				"auth_user_id" INTEGER NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
				"kelas_id" INTEGER NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
				"mata_pelajaran_id" INTEGER NOT NULL REFERENCES mata_pelajaran(id) ON DELETE CASCADE,
				"created_at" TEXT NOT NULL,
				"updated_at" TEXT,
				UNIQUE("auth_user_id", "kelas_id", "mata_pelajaran_id")
			)`,
			`CREATE INDEX IF NOT EXISTS "auth_user_pembelajaran_user_idx" ON "auth_user_pembelajaran" ("auth_user_id")`,
			`CREATE INDEX IF NOT EXISTS "auth_user_pembelajaran_kelas_idx" ON "auth_user_pembelajaran" ("kelas_id")`,
			`CREATE INDEX IF NOT EXISTS "auth_user_pembelajaran_mapel_idx" ON "auth_user_pembelajaran" ("mata_pelajaran_id")`,
			// Relaksasi unik kode kokurikuler agar unik per rombel (kelas), bukan unik global
			`ALTER TABLE "kokurikuler" DROP CONSTRAINT IF EXISTS "kokurikuler_kode_key"`,
			`CREATE UNIQUE INDEX IF NOT EXISTS "kokurikuler_kelas_kode_uniq_idx" ON "kokurikuler" ("kelas_id", "kode")`
		]);
	} else {
		await ensureSchema(PEMBELAJARAN_SCHEMA, [
			`CREATE TABLE IF NOT EXISTS "auth_user_pembelajaran" (
				"id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
				"auth_user_id" INTEGER NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
				"kelas_id" INTEGER NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
				"mata_pelajaran_id" INTEGER NOT NULL REFERENCES mata_pelajaran(id) ON DELETE CASCADE,
				"created_at" TEXT NOT NULL,
				"updated_at" TEXT,
				UNIQUE("auth_user_id", "kelas_id", "mata_pelajaran_id")
			)`,
			`CREATE INDEX IF NOT EXISTS "auth_user_pembelajaran_user_idx" ON "auth_user_pembelajaran" ("auth_user_id")`,
			`CREATE INDEX IF NOT EXISTS "auth_user_pembelajaran_kelas_idx" ON "auth_user_pembelajaran" ("kelas_id")`,
			`CREATE INDEX IF NOT EXISTS "auth_user_pembelajaran_mapel_idx" ON "auth_user_pembelajaran" ("mata_pelajaran_id")`,
			`CREATE UNIQUE INDEX IF NOT EXISTS "kokurikuler_kelas_kode_uniq_idx" ON "kokurikuler" ("kelas_id", "kode")`
		]);

		// Penanganan migrasi tabel kokurikuler di SQLite lama jika ada constraint UNIQUE tunggal pada kode
		try {
			const client = db.$client;
			const idxListRes = await client.execute("PRAGMA index_list('kokurikuler')");
			const rows = idxListRes.rows || [];
			let hasSingleKodeUnique = false;
			for (const r of rows as Array<Record<string, unknown>>) {
				const isUnique = Number(r.unique ?? r['2'] ?? 0) === 1;
				const name = String(r.name ?? r['1'] ?? '');
				if (!isUnique || !name) continue;
				const infoRes = await client.execute(`PRAGMA index_info('${name.replace(/'/g, "''")}')`);
				const cols = ((infoRes.rows || []) as Array<Record<string, unknown>>).map((c) =>
					String(c.name ?? c['2'] ?? '')
				);
				if (cols.length === 1 && cols[0].toLowerCase() === 'kode') {
					hasSingleKodeUnique = true;
					break;
				}
			}

			if (hasSingleKodeUnique) {
				await client.execute('PRAGMA foreign_keys = OFF;');
				await client.execute('ALTER TABLE "kokurikuler" RENAME TO "_kokurikuler_old";');
				await client.execute(`
					CREATE TABLE "kokurikuler" (
						"id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
						"kelas_id" INTEGER NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
						"kode" TEXT NOT NULL,
						"dimensi" TEXT NOT NULL,
						"tujuan" TEXT NOT NULL,
						"created_at" TEXT NOT NULL,
						"updated_at" TEXT,
						UNIQUE("kelas_id", "kode")
					);
				`);
				await client.execute(`
					INSERT INTO "kokurikuler" ("id", "kelas_id", "kode", "dimensi", "tujuan", "created_at", "updated_at")
					SELECT "id", "kelas_id", "kode", "dimensi", "tujuan", "created_at", "updated_at"
					FROM "_kokurikuler_old";
				`);
				await client.execute('DROP TABLE "_kokurikuler_old";');
				await client.execute('PRAGMA foreign_keys = ON;');
				console.info(
					'[ensurePembelajaranSchema] Migrated SQLite kokurikuler to composite UNIQUE(kelas_id, kode)'
				);
			}
		} catch (e) {
			console.warn('[ensurePembelajaranSchema] SQLite kokurikuler migration notice:', e);
		}
	}

	// Migrasi otomatis non-destruktif dari data lama (auth_user_mata_pelajaran -> auth_user_pembelajaran)
	try {
		const client = db.$client;
		const now = new Date().toISOString();
		if (isPg) {
			await client.execute(`
				INSERT INTO "auth_user_pembelajaran" ("auth_user_id", "kelas_id", "mata_pelajaran_id", "created_at")
				SELECT aump.auth_user_id, mp.kelas_id, mp.id, '${now}'
				FROM auth_user_mata_pelajaran aump
				JOIN mata_pelajaran mp ON mp.id = aump.mata_pelajaran_id
				WHERE mp.kelas_id IS NOT NULL
				ON CONFLICT ("auth_user_id", "kelas_id", "mata_pelajaran_id") DO NOTHING
			`);
		} else {
			await client.execute(`
				INSERT OR IGNORE INTO "auth_user_pembelajaran" ("auth_user_id", "kelas_id", "mata_pelajaran_id", "created_at")
				SELECT aump.auth_user_id, mp.kelas_id, mp.id, '${now}'
				FROM auth_user_mata_pelajaran aump
				JOIN mata_pelajaran mp ON mp.id = aump.mata_pelajaran_id
				WHERE mp.kelas_id IS NOT NULL
			`);
		}
	} catch (e) {
		console.warn('[ensurePembelajaranSchema] Backfill migration notice:', e);
	}

	// Normalisasi otomatis: kunci Wali Kelas hanya pada 1 kelas perwalian resminya
	await normalizeWaliKelasSingleClass();
}

/**
 * Normalisasi akun Wali Kelas hasil tarikan Dapodik:
 * Memastikan akun wali_kelas benar-benar hanya terkunci pada 1 kelas perwalian resminya.
 * Membersihkan relasi kelas berlebih di tableAuthUserKelas akibat sync Dapodik lama.
 */
export async function normalizeWaliKelasSingleClass() {
	try {
		// 1. Ambil seluruh akun wali_kelas yang terhubung ke pegawai
		const waliAccounts = await db.query.tableAuthUser.findMany({
			where: eq(tableAuthUser.type, 'wali_kelas'),
			columns: { id: true, pegawaiId: true, kelasId: true, sekolahId: true }
		});

		for (const acc of waliAccounts) {
			if (!acc.pegawaiId) continue;

			// Cari kelas perwalian resmi dari tableKelas.waliKelasId
			// Utamakan kelas di semester aktif jika ada
			const kelasRows = await db
				.select({
					id: tableKelas.id,
					isSemesterAktif: tableSemester.isAktif
				})
				.from(tableKelas)
				.leftJoin(tableSemester, eq(tableKelas.semesterId, tableSemester.id))
				.where(eq(tableKelas.waliKelasId, acc.pegawaiId));

			let officialKelasId: number | null = null;
			if (kelasRows.length > 0) {
				const activeK = kelasRows.find((k) => k.isSemesterAktif);
				officialKelasId = activeK ? activeK.id : kelasRows[0].id;
			} else if (acc.kelasId) {
				officialKelasId = acc.kelasId;
			}

			if (officialKelasId) {
				// Pastikan auth_user.kelasId menunjuk ke officialKelasId
				if (acc.kelasId !== officialKelasId) {
					await db
						.update(tableAuthUser)
						.set({ kelasId: officialKelasId })
						.where(eq(tableAuthUser.id, acc.id));
				}

				// Cari kelas-kelas pembelajaran resmi guru ini
				const pembelajarans = await db.query.tableAuthUserPembelajaran.findMany({
					where: eq(tableAuthUserPembelajaran.authUserId, acc.id),
					columns: { kelasId: true }
				});
				const learningKelasIds = new Set(pembelajarans.map((p) => p.kelasId));
				learningKelasIds.add(officialKelasId);

				// Hapus relasi tableAuthUserKelas yang bukan kelas perwalian dan bukan kelas pembelajaran
				const allUserKelas = await db.query.tableAuthUserKelas.findMany({
					where: eq(tableAuthUserKelas.authUserId, acc.id),
					columns: { id: true, kelasId: true }
				});

				const staleIds = allUserKelas
					.filter((uk) => !learningKelasIds.has(uk.kelasId))
					.map((uk) => uk.id);

				if (staleIds.length > 0) {
					await db.delete(tableAuthUserKelas).where(inArray(tableAuthUserKelas.id, staleIds));
				}

				// Pastikan officialKelasId ada di tableAuthUserKelas
				const hasOfficial = allUserKelas.some((uk) => uk.kelasId === officialKelasId);
				if (!hasOfficial) {
					try {
						await db.insert(tableAuthUserKelas).values({
							authUserId: acc.id,
							kelasId: officialKelasId
						});
					} catch {
						// ignore duplicate
					}
				}
			}
		}
	} catch (e) {
		console.warn('[normalizeWaliKelasSingleClass] Notice:', e);
	}
}
