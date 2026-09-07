import { deleteSessionByToken } from '$lib/server/auth';
import { cookieNames } from '$lib/utils';
import { type RequestHandler } from '@sveltejs/kit';
import { getZitadelConfig } from '$lib/server/zitadel';

export const POST: RequestHandler = async ({ cookies, locals }) => {
	const token = cookies.get(cookieNames.AUTH_SESSION);
	const secure = locals.requestIsSecure ?? false;
	if (token) {
		await deleteSessionByToken(token);
		cookies.delete(cookieNames.AUTH_SESSION, { path: '/', secure });
	}

	const idToken = cookies.get('zitadel_id_token');
	cookies.delete('zitadel_id_token', { path: '/', secure });

	const config = getZitadelConfig();
	if (config.isConfigured && config.postLogoutRedirectUri) {
		const endSessionUrl = new URL(`${config.issuer}/oidc/v1/end_session`);
		if (idToken) {
			endSessionUrl.searchParams.set('id_token_hint', idToken);
		}
		if (config.clientId) {
			endSessionUrl.searchParams.set('client_id', config.clientId);
		}
		endSessionUrl.searchParams.set('post_logout_redirect_uri', config.postLogoutRedirectUri);

		return new Response(JSON.stringify({ redirectUrl: endSessionUrl.toString() }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	return new Response(JSON.stringify({ redirectUrl: '/login' }), {
		status: 200,
		headers: { 'Content-Type': 'application/json' }
	});
};

export const GET: RequestHandler = async ({ cookies, locals }) => {
	const token = cookies.get(cookieNames.AUTH_SESSION);
	const secure = locals.requestIsSecure ?? false;
	if (token) {
		await deleteSessionByToken(token);
		cookies.delete(cookieNames.AUTH_SESSION, { path: '/', secure });
	}

	const idToken = cookies.get('zitadel_id_token');
	cookies.delete('zitadel_id_token', { path: '/', secure });

	const config = getZitadelConfig();
	if (config.isConfigured && config.postLogoutRedirectUri) {
		const endSessionUrl = new URL(`${config.issuer}/oidc/v1/end_session`);
		if (idToken) {
			endSessionUrl.searchParams.set('id_token_hint', idToken);
		}
		if (config.clientId) {
			endSessionUrl.searchParams.set('client_id', config.clientId);
		}
		endSessionUrl.searchParams.set('post_logout_redirect_uri', config.postLogoutRedirectUri);
		return Response.redirect(endSessionUrl.toString(), 303);
	}

	return Response.redirect('/login', 303);
};
