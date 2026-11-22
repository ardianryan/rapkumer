import { redirect } from '@sveltejs/kit';
import { getEraporConfig } from '$lib/server/erapor/client';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	const user = locals.user;
	if (!user) throw redirect(302, '/login');
	if (user.type !== 'admin' && user.type !== 'kepala_sekolah') {
		throw redirect(302, '/forbidden');
	}
	const sekolah = locals.sekolah;
	if (!sekolah?.id) throw redirect(302, '/sekolah');

	const config = await getEraporConfig(sekolah.id);
	return {
		eraporConfigured: Boolean(config.apiUrl && config.apiKey),
		eraporSemesterId: config.activeSemesterId
	};
};
