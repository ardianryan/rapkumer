import crypto from 'node:crypto';
import db from '$lib/server/db';
import { tableAuthUser, tableAuthZitadelUser, tablePegawai } from '$lib/server/db/schema';
import { eq, or } from 'drizzle-orm';

export interface ZitadelLiveMetadata {
	ptk_id?: string;
	dapodik_id?: string;
	source?: string;
	academic_year_id?: string;
	role?: string;
	nik?: string;
	nip?: string;
	uuid?: string;
	[key: string]: unknown;
}

export interface ZitadelConfig {
	isConfigured: boolean;
	issuer: string;
	clientId: string;
	clientSecret?: string;
	buttonText: string;
	redirectUri?: string;
	postLogoutRedirectUri?: string;
}

/**
 * Membaca konfigurasi ZITADEL dari environment variables
 */
export function getZitadelConfig(): ZitadelConfig {
	const issuer = (process.env.ZITADEL_ISSUER ?? '').trim().replace(/\/+$/, '');
	const clientId = (process.env.ZITADEL_CLIENT_ID ?? '').trim();
	const clientSecret = (process.env.ZITADEL_CLIENT_SECRET ?? '').trim() || undefined;
	const buttonText = (process.env.SSO_BUTTON_TEXT ?? 'Masuk dengan SSO').trim();
	const redirectUri = (process.env.ZITADEL_REDIRECT_URI ?? '').trim() || undefined;
	const postLogoutRedirectUri =
		(process.env.ZITADEL_POST_LOGOUT_REDIRECT_URI ?? '').trim() || undefined;

	const isConfigured = Boolean(issuer && clientId);
	return {
		isConfigured,
		issuer,
		clientId,
		clientSecret,
		buttonText,
		redirectUri,
		postLogoutRedirectUri
	};
}

/**
 * Generate PKCE pair (code_verifier dan code_challenge S256)
 */
export function generatePkce() {
	const verifier = crypto.randomBytes(32).toString('base64url');
	const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
	return { verifier, challenge };
}

/**
 * Generate random state string untuk pencegahan CSRF
 */
export function generateState() {
	return crypto.randomBytes(24).toString('base64url');
}

/**
 * Membangun URL Login / Authorize ZITADEL
 */
export function buildZitadelAuthUrl(params: {
	issuer: string;
	clientId: string;
	redirectUri: string;
	state: string;
	codeChallenge: string;
}): string {
	const url = new URL(`${params.issuer}/oauth/v2/authorize`);
	url.searchParams.set('client_id', params.clientId);
	url.searchParams.set('response_type', 'code');
	url.searchParams.set('scope', 'openid profile email urn:zitadel:iam:org:project:roles');
	url.searchParams.set('redirect_uri', params.redirectUri);
	url.searchParams.set('state', params.state);
	url.searchParams.set('code_challenge', params.codeChallenge);
	url.searchParams.set('code_challenge_method', 'S256');
	return url.toString();
}

/**
 * Menukar authorization code dengan token ZITADEL
 */
export async function exchangeZitadelCode(params: {
	issuer: string;
	clientId: string;
	clientSecret?: string;
	redirectUri: string;
	code: string;
	codeVerifier: string;
}): Promise<{
	accessToken: string;
	idToken: string;
	idClaims: Record<string, unknown>;
	userInfo?: Record<string, unknown>;
}> {
	const tokenEndpoint = `${params.issuer}/oauth/v2/token`;

	const body = new URLSearchParams({
		grant_type: 'authorization_code',
		client_id: params.clientId,
		redirect_uri: params.redirectUri,
		code: params.code,
		code_verifier: params.codeVerifier
	});

	if (params.clientSecret) {
		body.set('client_secret', params.clientSecret);
	}

	const res = await fetch(tokenEndpoint, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body
	});

	if (!res.ok) {
		const errText = await res.text();
		throw new Error(`Gagal menukar authorization code ZITADEL (${res.status}): ${errText}`);
	}

	const data = (await res.json()) as {
		access_token: string;
		id_token: string;
		[key: string]: unknown;
	};

	// Parse ID Token JWT Payload (base64 decode)
	let idClaims: Record<string, unknown> = {};
	try {
		const parts = data.id_token.split('.');
		if (parts.length === 3) {
			const decoded = Buffer.from(parts[1], 'base64url').toString('utf-8');
			idClaims = JSON.parse(decoded);
		}
	} catch (e) {
		console.warn('[zitadel] Gagal mem-parse payload ID Token:', e);
	}

	// Ambil data UserInfo jika tersedia
	let userInfo: Record<string, unknown> | undefined;
	try {
		const userinfoRes = await fetch(`${params.issuer}/oidc/v1/userinfo`, {
			headers: { Authorization: `Bearer ${data.access_token}` }
		});
		if (userinfoRes.ok) {
			userInfo = await userinfoRes.json();
		}
	} catch (e) {
		console.warn('[zitadel] Gagal mengambil userinfo endpoint:', e);
	}

	return {
		accessToken: data.access_token,
		idToken: data.id_token,
		idClaims,
		userInfo
	};
}

/**
 * Mengekstrak zitadel_live_metadata dari payload klaim ID token atau userinfo
 */
export function extractZitadelMetadata(
	idClaims: Record<string, unknown>,
	userInfo?: Record<string, unknown>
): ZitadelLiveMetadata {
	const merged = { ...idClaims, ...(userInfo ?? {}) };

	// 1. Cek langsung objek zitadel_live_metadata
	if (merged.zitadel_live_metadata && typeof merged.zitadel_live_metadata === 'object') {
		return merged.zitadel_live_metadata as ZitadelLiveMetadata;
	}

	// 2. Cek klaim ber-prefix atau custom claims
	const metadata: ZitadelLiveMetadata = {
		uuid: String(merged.sub ?? merged.uuid ?? ''),
		ptk_id: String(merged.ptk_id ?? merged.dapodik_id ?? ''),
		dapodik_id: String(merged.dapodik_id ?? merged.ptk_id ?? ''),
		nip: merged.nip ? String(merged.nip) : undefined,
		nik: merged.nik ? String(merged.nik) : undefined,
		role: merged.role ? String(merged.role) : undefined,
		source: merged.source ? String(merged.source) : undefined,
		academic_year_id: merged.academic_year_id ? String(merged.academic_year_id) : undefined
	};

	return metadata;
}

/**
 * Validasi Role: Hanya 'guru' dan 'tendik' yang diperbolehkan masuk.
 */
export function isAllowedZitadelRole(role: string | null | undefined): boolean {
	if (!role) return false;
	const normalized = role.trim().toLowerCase();
	return normalized === 'guru' || normalized === 'tendik';
}

export type MatchResult =
	| {
			success: true;
			userId: number;
			isNewLink: boolean;
			isOnboarded: boolean;
			pegawai: { id: number; nama: string; nip: string };
	  }
	| {
			success: false;
			code: 'ROLE_NOT_ALLOWED' | 'PTK_NOT_FOUND';
			message: string;
			metadata: ZitadelLiveMetadata;
	  };

/**
 * Mencocokkan metadata ZITADEL dengan Pegawai dan Akun Rapkumer
 */
export async function matchAndLinkZitadelUser(
	metadata: ZitadelLiveMetadata,
	zitadelSubject: string
): Promise<MatchResult> {
	// 1. Pemeriksaan Guard Role
	const userRole = metadata.role?.trim().toLowerCase();
	if (!isAllowedZitadelRole(userRole)) {
		return {
			success: false,
			code: 'ROLE_NOT_ALLOWED',
			message: `Akses Ditolak: Peran akun Anda (${userRole || 'tidak terdefinisi'}) belum diizinkan masuk. Portal Rapkumer saat ini hanya dibuka untuk Guru dan Tenaga Kependidikan (Tendik).`,
			metadata
		};
	}

	const zitadelUuid = String(metadata.uuid || zitadelSubject || '').trim();
	const ptkId = metadata.ptk_id?.trim() || null;
	const nip = metadata.nip?.trim() || null;

	// 2. Cek apakah sudah pernah tertaut di tableAuthZitadelUser
	if (zitadelUuid) {
		const existingZitadelUser = await db.query.tableAuthZitadelUser.findFirst({
			where: eq(tableAuthZitadelUser.zitadelUuid, zitadelUuid)
		});

		if (existingZitadelUser) {
			const authUser = await db.query.tableAuthUser.findFirst({
				where: eq(tableAuthUser.id, existingZitadelUser.userId)
			});

			let peg: typeof tablePegawai.$inferSelect | undefined;
			if (authUser?.pegawaiId) {
				peg = await db.query.tablePegawai.findFirst({
					where: eq(tablePegawai.id, authUser.pegawaiId)
				});
			}

			// Update waktu login terakhir
			await db
				.update(tableAuthZitadelUser)
				.set({
					lastLoginAt: new Date().toISOString(),
					rawMetadata: metadata
				})
				.where(eq(tableAuthZitadelUser.id, existingZitadelUser.id));

			return {
				success: true,
				userId: existingZitadelUser.userId,
				isNewLink: false,
				isOnboarded: Boolean(existingZitadelUser.isOnboarded),
				pegawai: {
					id: peg?.id ?? 0,
					nama: peg?.nama ?? authUser?.namaLengkap ?? '',
					nip: peg?.nip ?? ''
				}
			};
		}
	}

	// 3. Pencocokan Pertama Kali: Cari di tablePegawai berdasarkan dapodikPtkId atau NIP
	let matchedPegawai: typeof tablePegawai.$inferSelect | undefined;

	if (ptkId && nip) {
		matchedPegawai = await db.query.tablePegawai.findFirst({
			where: or(eq(tablePegawai.dapodikPtkId, ptkId), eq(tablePegawai.nip, nip))
		});
	} else if (ptkId) {
		matchedPegawai = await db.query.tablePegawai.findFirst({
			where: eq(tablePegawai.dapodikPtkId, ptkId)
		});
	} else if (nip) {
		matchedPegawai = await db.query.tablePegawai.findFirst({
			where: eq(tablePegawai.nip, nip)
		});
	}

	// Jika pegawai tidak ditemukan di Rapkumer
	if (!matchedPegawai) {
		return {
			success: false,
			code: 'PTK_NOT_FOUND',
			message:
				'PTK ID Dapodik tidak ditemukan. Akun Anda belum terdaftar pada data Dapodik sekolah di Rapkumer. Silakan hubungi Admin Sekolah untuk melakukan sinkronisasi Dapodik atau pemetaan profil manual.',
			metadata
		};
	}

	// Jika dapodikPtkId di DB belum ada atau berbeda, sinkronkan sekarang
	if (ptkId && (!matchedPegawai.dapodikPtkId || matchedPegawai.dapodikPtkId !== ptkId)) {
		await db
			.update(tablePegawai)
			.set({ dapodikPtkId: ptkId })
			.where(eq(tablePegawai.id, matchedPegawai.id));
	}

	// 4. Cari atau Buat Akun auth_user untuk Pegawai ini
	let authUser = await db.query.tableAuthUser.findFirst({
		where: eq(tableAuthUser.pegawaiId, matchedPegawai.id)
	});

	if (!authUser) {
		// Buat akun auth_user otomatis jika belum dibuat admin
		const cleanUsername = (
			matchedPegawai.nama.toLowerCase().replace(/[^a-z0-9]/g, '') || `user${matchedPegawai.id}`
		).slice(0, 30);
		const randomPass = crypto.randomBytes(16).toString('hex');

		const [createdUser] = await db
			.insert(tableAuthUser)
			.values({
				username: cleanUsername,
				usernameNormalized: cleanUsername,
				passwordHash: randomPass,
				passwordSalt: 'sso-managed',
				type: userRole === 'guru' ? 'user' : 'user',
				sekolahId: matchedPegawai.sekolahId,
				pegawaiId: matchedPegawai.id,
				namaLengkap: matchedPegawai.nama
			})
			.returning();

		authUser = createdUser;
	}

	// 5. Tautkan ke tableAuthZitadelUser
	await db.insert(tableAuthZitadelUser).values({
		userId: authUser.id,
		zitadelUuid,
		ptkId,
		nip,
		nik: metadata.nik?.trim() || null,
		role: metadata.role?.trim() || null,
		isOnboarded: false, // Perlu onboarding konfirmasi penugasan
		rawMetadata: metadata,
		lastLoginAt: new Date().toISOString()
	});

	return {
		success: true,
		userId: authUser.id,
		isNewLink: true,
		isOnboarded: false,
		pegawai: {
			id: matchedPegawai.id,
			nama: matchedPegawai.nama,
			nip: matchedPegawai.nip
		}
	};
}
