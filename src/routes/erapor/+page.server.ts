import { getEraporConfig, maskEraporApiKey } from '$lib/server/erapor/client';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const sekolahId = locals.sekolah?.id;
	if (!sekolahId) {
		return {
			config: {
				apiUrl: '',
				maskedKey: '',
				keySet: false,
				activeSemesterId: '',
				timeoutMs: 30000
			}
		};
	}

	const config = await getEraporConfig(sekolahId);
	return {
		config: {
			apiUrl: config.apiUrl,
			maskedKey: config.apiKey ? maskEraporApiKey(config.apiKey) : '',
			keySet: Boolean(config.apiKey),
			activeSemesterId: config.activeSemesterId,
			timeoutMs: config.timeoutMs
		}
	};
};
