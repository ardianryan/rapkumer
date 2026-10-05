import db from '$lib/server/db';

const TABLE = 'presensi_settings';

export async function ensureAkasSettingsSchema() {
	const isPg = db.$client?.isPostgres;

	if (isPg) {
		try {
			await db.$client.execute(
				`ALTER TABLE "${TABLE}" ADD COLUMN IF NOT EXISTS "sumber_presensi" text NOT NULL DEFAULT 'lokal'`
			);
		} catch {
			// column already exists
		}
		try {
			await db.$client.execute(
				`ALTER TABLE "${TABLE}" ADD COLUMN IF NOT EXISTS "akas_base_url" text DEFAULT 'https://akas.smage.my.id'`
			);
		} catch {
			// column already exists
		}
		try {
			await db.$client.execute(
				`ALTER TABLE "${TABLE}" ADD COLUMN IF NOT EXISTS "akas_api_key" text`
			);
		} catch {
			// column already exists
		}
	} else {
		try {
			await db.$client.execute(
				`ALTER TABLE "${TABLE}" ADD COLUMN "sumber_presensi" text NOT NULL DEFAULT 'lokal'`
			);
		} catch {
			// column already exists
		}
		try {
			await db.$client.execute(
				`ALTER TABLE "${TABLE}" ADD COLUMN "akas_base_url" text DEFAULT 'https://akas.smage.my.id'`
			);
		} catch {
			// column already exists
		}
		try {
			await db.$client.execute(`ALTER TABLE "${TABLE}" ADD COLUMN "akas_api_key" text`);
		} catch {
			// column already exists
		}
	}
}
