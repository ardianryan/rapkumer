import db from './index';
import { ensureSchema } from './ensure-helper';

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
}
