import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	exchangeZitadelCode,
	extractZitadelMetadata,
	getZitadelConfig,
	matchAndLinkZitadelUser
} from '$lib/server/zitadel';
import { applySessionCookie, createSession } from '$lib/server/auth';
import { isSecureRequest } from '$lib/server/http';

export const GET: RequestHandler = async ({ url, cookies, request, getClientAddress }) => {
	const config = getZitadelConfig();
	if (!config.isConfigured) {
		throw redirect(303, '/login?error=sso_unconfigured');
	}

	const errorParam = url.searchParams.get('error');
	if (errorParam) {
		const desc = url.searchParams.get('error_description') ?? errorParam;
		console.warn('[zitadel callback] Error dari ZITADEL:', desc);
		throw redirect(303, `/login?error=${encodeURIComponent(desc)}`);
	}

	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');

	if (!code || !state) {
		throw redirect(303, '/login?error=missing_code_or_state');
	}

	const savedState = cookies.get('zitadel_oauth_state');
	const codeVerifier = cookies.get('zitadel_oauth_verifier');

	// Hapus cookie verifier & state setelah digunakan
	cookies.delete('zitadel_oauth_state', { path: '/' });
	cookies.delete('zitadel_oauth_verifier', { path: '/' });

	if (!savedState || savedState !== state || !codeVerifier) {
		console.warn('[zitadel callback] State mismatch atau code verifier hilang.');
		throw redirect(303, '/login?error=invalid_state');
	}

	const redirectUri = config.redirectUri || `${url.origin}/api/auth/zitadel/callback`;

	let tokenResult;
	try {
		tokenResult = await exchangeZitadelCode({
			issuer: config.issuer,
			clientId: config.clientId,
			clientSecret: config.clientSecret,
			redirectUri,
			code,
			codeVerifier
		});
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : 'Token exchange failed';
		console.error('[zitadel callback] Gagal menukar token:', err);
		throw redirect(303, `/login?error=${encodeURIComponent(message)}`);
	}

	const metadata = extractZitadelMetadata(tokenResult.idClaims, tokenResult.userInfo);
	const subject = String(tokenResult.idClaims.sub ?? metadata.uuid ?? '');

	console.info('[zitadel callback] Metadata terbaca:', {
		ptk_id: metadata.ptk_id,
		nip: metadata.nip,
		role: metadata.role,
		uuid: metadata.uuid,
		email: metadata.email,
		username: metadata.username
	});

	const match = await matchAndLinkZitadelUser(metadata, subject);

	if (!match.success) {
		if (match.code === 'ROLE_NOT_ALLOWED') {
			const role = metadata.role ? encodeURIComponent(metadata.role) : 'unknown';
			throw redirect(303, `/auth/unlinked-ptk?error=role_not_allowed&role=${role}`);
		}

		const ptkId = metadata.ptk_id ? encodeURIComponent(metadata.ptk_id) : '';
		const nip = metadata.nip ? encodeURIComponent(metadata.nip) : '';
		throw redirect(303, `/auth/unlinked-ptk?error=ptk_not_found&ptk_id=${ptkId}&nip=${nip}`);
	}

	// Buat session Rapkumer bawaan
	const session = await createSession(match.userId, {
		userAgent: request.headers.get('user-agent'),
		ipAddress: getClientAddress()
	});

	const isSecure = isSecureRequest(request, url);
	applySessionCookie(cookies, session.token, session.expiresAt, isSecure);

	if (tokenResult.idToken) {
		cookies.set('zitadel_id_token', tokenResult.idToken, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: isSecure,
			maxAge: 86400
		});
	}

	// Jika pengguna belum melakukan konfirmasi/onboarding penugasan
	if (!match.isOnboarded) {
		throw redirect(303, '/onboarding/penugasan');
	}

	throw redirect(303, '/');
};
