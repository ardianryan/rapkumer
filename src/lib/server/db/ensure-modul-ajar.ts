import { ensureSchema } from './ensure-helper';

export async function ensureModulAjarSchema() {
	await ensureSchema('modul_ajar', [
		`CREATE TABLE IF NOT EXISTS "modul_ajar" (
			"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
			"sekolah_id" integer NOT NULL,
			"kelas_id" integer NOT NULL,
			"mata_pelajaran_id" integer NOT NULL,
			"auth_user_id" integer NOT NULL,
			"materi_pokok" text NOT NULL,
			"alokasi_waktu" text NOT NULL,
			"jumlah_pertemuan" text NOT NULL,
			"model_pembelajaran" text NOT NULL,
			"dimensi_profil" text DEFAULT '[]' NOT NULL,
			"tujuan_pembelajaran_ids" text DEFAULT '[]' NOT NULL,
			"konten" text NOT NULL,
			"status" text DEFAULT 'draf' NOT NULL,
			"created_at" text NOT NULL,
			"updated_at" text,
			CONSTRAINT "modul_ajar_sekolah_id_fk" FOREIGN KEY ("sekolah_id") REFERENCES "sekolah" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
			CONSTRAINT "modul_ajar_kelas_id_fk" FOREIGN KEY ("kelas_id") REFERENCES "kelas" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
			CONSTRAINT "modul_ajar_mapel_id_fk" FOREIGN KEY ("mata_pelajaran_id") REFERENCES "mata_pelajaran" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
			CONSTRAINT "modul_ajar_user_id_fk" FOREIGN KEY ("auth_user_id") REFERENCES "auth_user" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
		)`,
		`CREATE INDEX IF NOT EXISTS "idx_modul_ajar_lookup" ON "modul_ajar" ("sekolah_id", "kelas_id", "mata_pelajaran_id")`,
		`CREATE INDEX IF NOT EXISTS "idx_modul_ajar_user" ON "modul_ajar" ("auth_user_id")`
	]);
}
