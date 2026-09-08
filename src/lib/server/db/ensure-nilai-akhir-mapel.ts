import { ensureSchema } from './ensure-helper';

export async function ensureNilaiAkhirMapelSchema() {
	await ensureSchema('nilai_akhir_mapel', [
		`CREATE TABLE IF NOT EXISTS "bobot_nilai_akhir_mapel" (
			"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
			"mata_pelajaran_id" integer NOT NULL,
			"bobot_formatif" integer DEFAULT 30 NOT NULL,
			"bobot_sumatif" integer DEFAULT 70 NOT NULL,
			"created_at" text NOT NULL,
			"updated_at" text,
			CONSTRAINT "bobot_nam_mapel_id_fk" FOREIGN KEY ("mata_pelajaran_id") REFERENCES "mata_pelajaran" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
		)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS "bobot_nilai_akhir_mapel_unique" ON "bobot_nilai_akhir_mapel" ("mata_pelajaran_id")`,
		`CREATE TABLE IF NOT EXISTS "nilai_akhir_mapel" (
			"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
			"murid_id" integer NOT NULL,
			"mata_pelajaran_id" integer NOT NULL,
			"nilai_formatif" real,
			"nilai_sumatif" real,
			"bobot_formatif" integer NOT NULL,
			"bobot_sumatif" integer NOT NULL,
			"nilai_akhir" real NOT NULL,
			"capaian_tp" text,
			"status" text DEFAULT 'terkunci' NOT NULL,
			"dikunci_pada" text,
			"dikunci_oleh_id" integer,
			"created_at" text NOT NULL,
			"updated_at" text,
			CONSTRAINT "nam_murid_id_fk" FOREIGN KEY ("murid_id") REFERENCES "murid" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
			CONSTRAINT "nam_mapel_id_fk" FOREIGN KEY ("mata_pelajaran_id") REFERENCES "mata_pelajaran" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
			CONSTRAINT "nam_user_id_fk" FOREIGN KEY ("dikunci_oleh_id") REFERENCES "auth_user" ("id") ON UPDATE NO ACTION ON DELETE SET NULL
		)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS "nilai_akhir_mapel_unique" ON "nilai_akhir_mapel" ("murid_id", "mata_pelajaran_id")`,
		`CREATE INDEX IF NOT EXISTS "idx_nilai_akhir_mapel_lookup" ON "nilai_akhir_mapel" ("mata_pelajaran_id", "murid_id")`,
		`CREATE INDEX IF NOT EXISTS "idx_nilai_akhir_mapel_murid" ON "nilai_akhir_mapel" ("murid_id")`
	]);
}
