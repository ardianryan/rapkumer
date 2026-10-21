import db from './index';
import { ensureSchema } from './ensure-helper';

export async function ensureRaporSisipanSchema() {
	try {
		await db.$client.execute(
			`ALTER TABLE "sekolah" ADD COLUMN "rts_max_formatif" integer NOT NULL DEFAULT 4`
		);
	} catch {
		// column already exists
	}
	try {
		await db.$client.execute(
			`ALTER TABLE "sekolah" ADD COLUMN "rts_max_sumatif" integer NOT NULL DEFAULT 3`
		);
	} catch {
		// column already exists
	}
	try {
		await db.$client.execute(
			`ALTER TABLE "sekolah" ADD COLUMN "rts_show_rata_tugas" integer NOT NULL DEFAULT 1`
		);
	} catch {
		// column already exists
	}
	try {
		await db.$client.execute(
			`ALTER TABLE "sekolah" ADD COLUMN "rts_show_rata_formatif" integer NOT NULL DEFAULT 1`
		);
	} catch {
		// column already exists
	}
	try {
		await db.$client.execute(
			`ALTER TABLE "sekolah" ADD COLUMN "rts_show_sts" integer NOT NULL DEFAULT 1`
		);
	} catch {
		// column already exists
	}
	try {
		await db.$client.execute(
			`ALTER TABLE "sekolah" ADD COLUMN "rts_show_na_sts" integer NOT NULL DEFAULT 1`
		);
	} catch {
		// column already exists
	}
	try {
		await db.$client.execute(
			`ALTER TABLE "sekolah" ADD COLUMN "rts_show_ttd_kepala" integer NOT NULL DEFAULT 1`
		);
	} catch {
		// column already exists
	}

	await ensureSchema('rts_mapel_setup', [
		`CREATE TABLE IF NOT EXISTS "rts_mapel_setup" (
			"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
			"sekolah_id" integer NOT NULL,
			"kelas_id" integer NOT NULL,
			"mata_pelajaran_id" integer NOT NULL,
			"komponen_formatif" text NOT NULL,
			"komponen_sumatif" text NOT NULL,
			"ada_sts_tes" integer DEFAULT 1 NOT NULL,
			"ada_sts_non_tes" integer DEFAULT 0 NOT NULL,
			"bobot_sumatif_tp" real DEFAULT 70,
			"bobot_sts" real DEFAULT 30,
			"created_at" text NOT NULL,
			"updated_at" text,
			CONSTRAINT "rts_mapel_setup_sekolah_id_sekolah_id_fk" FOREIGN KEY ("sekolah_id") REFERENCES "sekolah" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
			CONSTRAINT "rts_mapel_setup_kelas_id_kelas_id_fk" FOREIGN KEY ("kelas_id") REFERENCES "kelas" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
			CONSTRAINT "rts_mapel_setup_mata_pelajaran_id_mata_pelajaran_id_fk" FOREIGN KEY ("mata_pelajaran_id") REFERENCES "mata_pelajaran" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
		)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS "rts_mapel_setup_kelas_mapel_unique" ON "rts_mapel_setup" ("kelas_id", "mata_pelajaran_id")`,
		`CREATE INDEX IF NOT EXISTS "rts_setup_kelas_mapel_idx" ON "rts_mapel_setup" ("kelas_id", "mata_pelajaran_id")`
	]);

	await ensureSchema('rts_nilai_siswa', [
		`CREATE TABLE IF NOT EXISTS "rts_nilai_siswa" (
			"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
			"sekolah_id" integer NOT NULL,
			"kelas_id" integer NOT NULL,
			"mata_pelajaran_id" integer NOT NULL,
			"murid_id" integer NOT NULL,
			"nilai_formatif" text,
			"rata_formatif" real,
			"nilai_sumatif" text,
			"rata_sumatif_tp" real,
			"sts_tes" real,
			"sts_non_tes" real,
			"nilai_sts" real,
			"nilai_akhir_rts" real,
			"catatan_guru" text,
			"created_at" text NOT NULL,
			"updated_at" text,
			CONSTRAINT "rts_nilai_siswa_sekolah_id_sekolah_id_fk" FOREIGN KEY ("sekolah_id") REFERENCES "sekolah" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
			CONSTRAINT "rts_nilai_siswa_kelas_id_kelas_id_fk" FOREIGN KEY ("kelas_id") REFERENCES "kelas" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
			CONSTRAINT "rts_nilai_siswa_mata_pelajaran_id_mata_pelajaran_id_fk" FOREIGN KEY ("mata_pelajaran_id") REFERENCES "mata_pelajaran" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
			CONSTRAINT "rts_nilai_siswa_murid_id_murid_id_fk" FOREIGN KEY ("murid_id") REFERENCES "murid" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
		)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS "rts_nilai_siswa_unique" ON "rts_nilai_siswa" ("kelas_id", "mata_pelajaran_id", "murid_id")`,
		`CREATE INDEX IF NOT EXISTS "rts_nilai_murid_idx" ON "rts_nilai_siswa" ("murid_id")`,
		`CREATE INDEX IF NOT EXISTS "rts_nilai_kelas_mapel_idx" ON "rts_nilai_siswa" ("kelas_id", "mata_pelajaran_id")`
	]);

	await ensureSchema('rts_catatan_wali', [
		`CREATE TABLE IF NOT EXISTS "rts_catatan_wali" (
			"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
			"sekolah_id" integer NOT NULL,
			"kelas_id" integer NOT NULL,
			"murid_id" integer NOT NULL,
			"catatan_wali" text,
			"sakit" integer,
			"izin" integer,
			"alfa" integer,
			"jumlah_pelanggaran" integer DEFAULT 0,
			"poin_pelanggaran" integer DEFAULT 0,
			"akas_violations_synced_at" text,
			"created_at" text NOT NULL,
			"updated_at" text,
			CONSTRAINT "rts_catatan_wali_sekolah_id_sekolah_id_fk" FOREIGN KEY ("sekolah_id") REFERENCES "sekolah" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
			CONSTRAINT "rts_catatan_wali_kelas_id_kelas_id_fk" FOREIGN KEY ("kelas_id") REFERENCES "kelas" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
			CONSTRAINT "rts_catatan_wali_murid_id_murid_id_fk" FOREIGN KEY ("murid_id") REFERENCES "murid" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
		)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS "rts_catatan_wali_unique" ON "rts_catatan_wali" ("kelas_id", "murid_id")`,
		`CREATE INDEX IF NOT EXISTS "rts_catatan_wali_murid_idx" ON "rts_catatan_wali" ("murid_id")`
	]);

	try {
		await db.$client.execute(
			`ALTER TABLE "rts_catatan_wali" ADD COLUMN "jumlah_pelanggaran" integer DEFAULT 0`
		);
	} catch {
		// column already exists
	}
	try {
		await db.$client.execute(
			`ALTER TABLE "rts_catatan_wali" ADD COLUMN "poin_pelanggaran" integer DEFAULT 0`
		);
	} catch {
		// column already exists
	}
	try {
		await db.$client.execute(
			`ALTER TABLE "rts_catatan_wali" ADD COLUMN "akas_violations_synced_at" text`
		);
	} catch {
		// column already exists
	}
}
