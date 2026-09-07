import db from '$lib/server/db';
import { ensureSchema } from './ensure-helper';

const ZITADEL_SCHEMA = 'auth_zitadel_user';

export async function ensureZitadelSchema() {
	const isPg = db.$client?.isPostgres;

	if (isPg) {
		await ensureSchema(ZITADEL_SCHEMA, [
			`CREATE TABLE IF NOT EXISTS "auth_zitadel_user" (
				"id" SERIAL PRIMARY KEY NOT NULL,
				"user_id" INTEGER NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
				"zitadel_uuid" TEXT NOT NULL,
				"ptk_id" TEXT,
				"nip" TEXT,
				"nik" TEXT,
				"role" TEXT,
				"is_onboarded" BOOLEAN DEFAULT FALSE NOT NULL,
				"raw_metadata" JSONB,
				"last_login_at" TEXT,
				"created_at" TEXT NOT NULL,
				"updated_at" TEXT,
				UNIQUE("zitadel_uuid"),
				UNIQUE("user_id")
			)`,
			`CREATE INDEX IF NOT EXISTS "auth_zitadel_ptk_id_idx" ON "auth_zitadel_user" ("ptk_id")`,
			`CREATE INDEX IF NOT EXISTS "auth_zitadel_user_id_idx" ON "auth_zitadel_user" ("user_id")`
		]);
	} else {
		await ensureSchema(ZITADEL_SCHEMA, [
			`CREATE TABLE IF NOT EXISTS "auth_zitadel_user" (
				"id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
				"user_id" INTEGER NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
				"zitadel_uuid" TEXT NOT NULL,
				"ptk_id" TEXT,
				"nip" TEXT,
				"nik" TEXT,
				"role" TEXT,
				"is_onboarded" INTEGER DEFAULT 0 NOT NULL,
				"raw_metadata" TEXT,
				"last_login_at" TEXT,
				"created_at" TEXT NOT NULL,
				"updated_at" TEXT,
				UNIQUE("zitadel_uuid"),
				UNIQUE("user_id")
			)`,
			`CREATE INDEX IF NOT EXISTS "auth_zitadel_ptk_id_idx" ON "auth_zitadel_user" ("ptk_id")`,
			`CREATE INDEX IF NOT EXISTS "auth_zitadel_user_id_idx" ON "auth_zitadel_user" ("user_id")`
		]);
	}
}
