import db from '$lib/server/db';
import { ensureEraporSchema } from '$lib/server/db/ensure-erapor';
import { tableEraporSyncLogs } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	await ensureEraporSchema();
	const sekolahId = locals.sekolah!.id;

	const logs = await db.query.tableEraporSyncLogs.findMany({
		where: eq(tableEraporSyncLogs.sekolahId, sekolahId),
		orderBy: desc(tableEraporSyncLogs.id),
		limit: 50
	});

	return { logs };
};
