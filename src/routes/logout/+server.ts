import { deleteSessionByToken } from '$lib/server/auth';
import { cookieNames } from '$lib/utils';
import { redirect, type RequestHandler } from '@sveltejs/kit';
import { getZitadelConfig } from '$lib/server/zitadel';

export const POST: RequestHandler = async ({ cookies, locals }) => {
	const token = cookies.get(cookieNames.AUTH_SESSION);
	if (token) {
		await deleteSessionByToken(token);
		const secure = locals.requestIsSecure ?? false;
		cookies.delete(cookieNames.AUTH_SESSION, { path: '/', secure });
	}

	const config = getZitadelConfig();
	if (config.isConfigured && config.postLogoutRedirectUri) {
		const endSessionUrl = new URL(`${config.issuer}/oidc/v1/end_session`);
		endSessionUrl.searchParams.set('post_logout_redirect_uri', config.postLogoutRedirectUri);
		throw redirect(303, endSessionUrl.toString());
	}

	throw redirect(303, '/login');
};
