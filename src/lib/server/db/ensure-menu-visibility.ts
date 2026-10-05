import db from '$lib/server/db';

export async function ensureMenuVisibilitySchema() {
	const isPg = db.$client?.isPostgres;
	try {
		if (isPg) {
			await db.$client.execute(
				`ALTER TABLE "sekolah" ADD COLUMN IF NOT EXISTS "hidden_menu_paths" jsonb NOT NULL DEFAULT '[]'::jsonb`
			);
		} else {
			await db.$client.execute(
				`ALTER TABLE "sekolah" ADD COLUMN "hidden_menu_paths" text NOT NULL DEFAULT '[]'`
			);
		}
	} catch {
		// Kolom sudah ada di database, abaikan error
	}
}
