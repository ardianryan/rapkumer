import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	buildZitadelAuthUrl,
	generatePkce,
	generateState,
	getZitadelConfig
} from '$lib/server/zitadel';
import { isSecureRequest } from '$lib/server/http';

export const GET: RequestHandler = async ({ url, cookies, request }) => {
	const config = getZitadelConfig();
	if (!config.isConfigured) {
		throw redirect(303, '/login?error=sso_unconfigured');
	}

	const { verifier, challenge } = generatePkce();
	const state = generateState();
	const isSecure = isSecureRequest(request, url);

	// Simpan verifier dan state di cookie sementara (TTL 10 menit)
	cookies.set('zitadel_oauth_verifier', verifier, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: isSecure,
		maxAge: 600
	});

	cookies.set('zitadel_oauth_state', state, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: isSecure,
		maxAge: 600
	});

	const redirectUri = `${url.origin}/api/auth/zitadel/callback`;

	const authUrl = buildZitadelAuthUrl({
		issuer: config.issuer,
		clientId: config.clientId,
		redirectUri,
		state,
		codeChallenge: challenge
	});

	throw redirect(302, authUrl);
};
