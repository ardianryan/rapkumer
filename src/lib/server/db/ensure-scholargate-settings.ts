import { ensureSchema } from './ensure-helper';

const TABLE = 'scholargate_settings';

export async function ensureScholargateSettingsSchema() {
	await ensureSchema(TABLE, [
		`CREATE TABLE IF NOT EXISTS "${TABLE}" (
			"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
			"sekolah_id" integer NOT NULL,
			"base_url" text,
			"api_key" text,
			"referer" text,
			"created_at" text NOT NULL,
			"updated_at" text,
			FOREIGN KEY ("sekolah_id") REFERENCES "sekolah" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
			CONSTRAINT "scholargate_settings_sekolah_id_unique" UNIQUE("sekolah_id")
		)`
	]);
}
