import crypto from 'node:crypto';
import db from '$lib/server/db';
import {
	tableAuthUser,
	tableAuthZitadelUser,
	tablePegawai,
	tableSekolah
} from '$lib/server/db/schema';
import { eq, or, sql } from 'drizzle-orm';

export interface ZitadelLiveMetadata {
	ptk_id?: string;
	dapodik_id?: string;
	source?: string;
	academic_year_id?: string;
	role?: string;
	nik?: string;
	nip?: string;
	uuid?: string;
	email?: string;
	username?: string;
	name?: string;
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
	url.searchParams.set(
		'scope',
		'openid profile email urn:zitadel:iam:org:project:roles urn:zitadel:iam:user:metadata urn:zitadel:iam:user:resourceowner'
	);
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
 * Helper untuk decode metadata ZITADEL yang mungkin di-base64 encode
 */
function decodeMetadataValue(val: unknown): string {
	if (typeof val !== 'string') return val != null ? String(val) : '';
	const trimmed = val.trim();
	if (!trimmed) return '';
	try {
		const base64Clean = trimmed.replace(/-/g, '+').replace(/_/g, '/');
		const padded = base64Clean.padEnd(
			base64Clean.length + ((4 - (base64Clean.length % 4)) % 4),
			'='
		);
		if (/^[A-Za-z0-9+/=]+$/.test(padded)) {
			const decoded = Buffer.from(padded, 'base64').toString('utf-8');
			if (
				/^[\x20-\x7E\s]+$/.test(decoded) &&
				Buffer.from(decoded, 'utf-8').toString('base64').replace(/=+$/, '') ===
					base64Clean.replace(/=+$/, '')
			) {
				return decoded.trim();
			}
		}
	} catch {
		// Nilai bukan base64 valid, kembalikan teks asli
	}
	return trimmed;
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

	// 2. Decode user metadata dari standard claims ZITADEL: 'urn:zitadel:iam:user:metadata'
	const rawUserMetadata = (merged['urn:zitadel:iam:user:metadata'] ??
		merged['urn:zitadel:iam:action:user:metadata'] ??
		merged.metadata ??
		{}) as Record<string, unknown>;

	const metaMap: Record<string, string> = {};
	if (typeof rawUserMetadata === 'object' && rawUserMetadata !== null) {
		for (const [k, v] of Object.entries(rawUserMetadata)) {
			metaMap[k.toLowerCase().trim()] = decodeMetadataValue(v);
		}
	}

	// 3. Extract role dari ZITADEL project roles: 'urn:zitadel:iam:org:project:roles'
	let extractedRole: string | undefined = undefined;
	const projectRoles = (merged['urn:zitadel:iam:org:project:roles'] ??
		merged['urn:zitadel:iam:project:roles']) as Record<string, unknown> | string[] | undefined;

	if (projectRoles) {
		if (Array.isArray(projectRoles)) {
			extractedRole = projectRoles[0];
		} else if (typeof projectRoles === 'object' && projectRoles !== null) {
			const roleKeys = Object.keys(projectRoles);
			for (const k of roleKeys) {
				const norm = k.toLowerCase().trim();
				if (
					norm === 'guru' ||
					norm === 'tendik' ||
					norm === 'admin' ||
					norm === 'teacher' ||
					norm === 'staff'
				) {
					extractedRole = norm === 'teacher' ? 'guru' : norm === 'staff' ? 'tendik' : norm;
					break;
				}
			}
			if (!extractedRole && roleKeys.length > 0) {
				extractedRole = roleKeys[0];
			}
		}
	}

	if (!extractedRole && Array.isArray(merged.roles) && merged.roles.length > 0) {
		extractedRole = String(merged.roles[0]);
	}
	if (!extractedRole && typeof merged.role === 'string') {
		extractedRole = merged.role;
	}

	const rawRole =
		metaMap['role'] || extractedRole || (merged.role ? String(merged.role).trim() : undefined);
	let role: string | undefined = undefined;
	if (rawRole) {
		const norm = rawRole.trim().toLowerCase();
		if (norm === 'guru' || norm === 'teacher') role = 'guru';
		else if (norm === 'tendik' || norm === 'staff' || norm === 'pegawai') role = 'tendik';
		else if (norm === 'admin' || norm === 'administrator') role = 'admin';
		else role = norm;
	}

	const ptk_id =
		metaMap['ptk_id'] ||
		metaMap['dapodik_id'] ||
		metaMap['ptkid'] ||
		metaMap['dapodikptkid'] ||
		(merged.ptk_id ? String(merged.ptk_id).trim() : '') ||
		(merged.dapodik_id ? String(merged.dapodik_id).trim() : '');

	const nip = metaMap['nip'] || (merged.nip ? String(merged.nip).trim() : undefined);

	const nik = metaMap['nik'] || (merged.nik ? String(merged.nik).trim() : undefined);

	const email = merged.email ? String(merged.email).trim().toLowerCase() : undefined;
	const username = (
		merged.preferred_username
			? String(merged.preferred_username)
			: merged.name
				? String(merged.name)
				: ''
	).trim();

	const metadata: ZitadelLiveMetadata = {
		uuid: String(merged.sub ?? merged.uuid ?? ''),
		ptk_id: ptk_id || undefined,
		dapodik_id: ptk_id || undefined,
		nip: nip || undefined,
		nik: nik || undefined,
		role: role || undefined,
		email: email || undefined,
		username: username || undefined,
		name: merged.name ? String(merged.name).trim() : undefined,
		source: metaMap['source'] || (merged.source ? String(merged.source) : undefined),
		academic_year_id:
			metaMap['academic_year_id'] ||
			(merged.academic_year_id ? String(merged.academic_year_id) : undefined)
	};

	return metadata;
}

/**
 * Validasi Role: Kunci metadata ketat, HANYA peran 'guru', 'tendik', dan 'admin'
 * yang diizinkan masuk portal.
 */
export function isAllowedZitadelRole(role: string | null | undefined): boolean {
	if (!role) return false;
	const normalized = role.trim().toLowerCase();
	return (
		normalized === 'guru' ||
		normalized === 'tendik' ||
		normalized === 'admin' ||
		normalized === 'teacher' ||
		normalized === 'staff' ||
		normalized === 'pegawai' ||
		normalized === 'administrator'
	);
}

export type MatchResult =
	| {
			success: true;
			userId: number;
			isNewLink: boolean;
			isOnboarded: boolean;
			pegawai: { id: number; nama: string; nip: string } | null;
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
	// 1. Pemeriksaan Guard Role: Hanya guru dan tendik (serta admin) yang boleh masuk
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

	// 2. PENCOCOKAN UTAMA DAPODIK: Cocokkan langsung ptk_id dari ZITADEL dengan dapodikPtkId di tablePegawai
	let matchedPegawai: typeof tablePegawai.$inferSelect | undefined;
	let matchedAuthUser: typeof tableAuthUser.$inferSelect | undefined;

	if (ptkId) {
		// a. Cari di tablePegawai berdasarkan dapodikPtkId (case-insensitive)
		matchedPegawai = await db.query.tablePegawai.findFirst({
			where: sql`lower(${tablePegawai.dapodikPtkId}) = lower(${ptkId})`
		});

		// b. Cari di tableAuthZitadelUser berdasarkan ptkId yang diinput admin
		if (!matchedPegawai) {
			const existingByPtk = await db.query.tableAuthZitadelUser.findFirst({
				where: sql`lower(${tableAuthZitadelUser.ptkId}) = lower(${ptkId})`
			});
			if (existingByPtk) {
				matchedAuthUser = await db.query.tableAuthUser.findFirst({
					where: eq(tableAuthUser.id, existingByPtk.userId)
				});
				if (matchedAuthUser?.pegawaiId) {
					matchedPegawai = await db.query.tablePegawai.findFirst({
						where: eq(tablePegawai.id, matchedAuthUser.pegawaiId)
					});
				}
			}
		}
	}

	// 3. Cadangan: Pencocokan via NIP Pegawai jika PTK ID belum diset di ZITADEL
	if (!matchedPegawai && !matchedAuthUser && nip) {
		matchedPegawai = await db.query.tablePegawai.findFirst({
			where: eq(tablePegawai.nip, nip)
		});
	}

	// 4. Cadangan: Pencocokan via zitadelUuid jika akun ini sudah pernah berhasil login sebelumnya
	if (!matchedPegawai && !matchedAuthUser && zitadelUuid) {
		const existingZitadelUser = await db.query.tableAuthZitadelUser.findFirst({
			where: eq(tableAuthZitadelUser.zitadelUuid, zitadelUuid)
		});
		if (existingZitadelUser) {
			matchedAuthUser = await db.query.tableAuthUser.findFirst({
				where: eq(tableAuthUser.id, existingZitadelUser.userId)
			});
			if (matchedAuthUser?.pegawaiId) {
				matchedPegawai = await db.query.tablePegawai.findFirst({
					where: eq(tablePegawai.id, matchedAuthUser.pegawaiId)
				});
			}
		}
	}

	// 5. Cari akun auth_user jika pegawai ditemukan tapi authUser belum ditentukan
	if (matchedPegawai && !matchedAuthUser) {
		matchedAuthUser = await db.query.tableAuthUser.findFirst({
			where: eq(tableAuthUser.pegawaiId, matchedPegawai.id)
		});
	} else if (!matchedPegawai && !matchedAuthUser) {
		// c. Jika pegawai belum ditemukan lewat PTK ID / NIP, cari lewat username atau email
		const usernameCandidates = [
			metadata.username?.toLowerCase().trim(),
			metadata.email ? metadata.email.split('@')[0].toLowerCase().trim() : null
		].filter((u): u is string => Boolean(u));

		for (const u of usernameCandidates) {
			const found = await db.query.tableAuthUser.findFirst({
				where: or(eq(tableAuthUser.username, u), eq(tableAuthUser.usernameNormalized, u))
			});
			if (found) {
				matchedAuthUser = found;
				if (found.pegawaiId) {
					matchedPegawai = await db.query.tablePegawai.findFirst({
						where: eq(tablePegawai.id, found.pegawaiId)
					});
				}
				break;
			}
		}
	}

	// Jika dapodikPtkId di tablePegawai belum ada atau berbeda, sinkronkan sekarang
	if (
		matchedPegawai &&
		ptkId &&
		(!matchedPegawai.dapodikPtkId || matchedPegawai.dapodikPtkId !== ptkId)
	) {
		await db
			.update(tablePegawai)
			.set({ dapodikPtkId: ptkId })
			.where(eq(tablePegawai.id, matchedPegawai.id));
	}

	// 6. Pastikan Akun auth_user tersedia: Jika tidak ditemukan di Dapodik/database sekolah,
	// JANGAN TOLAK akun guru/tendik tersebut, buatkan akun auth_user secara mandiri!
	let authUserId: number;
	if (matchedAuthUser) {
		authUserId = matchedAuthUser.id;
	} else if (matchedPegawai) {
		// Buat akun auth_user otomatis dari matchedPegawai
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
				type: 'user',
				sekolahId: matchedPegawai.sekolahId,
				pegawaiId: matchedPegawai.id,
				namaLengkap: matchedPegawai.nama
			})
			.returning();

		authUserId = createdUser.id;
	} else {
		// Kasus: PTK ID belum ada di data Dapodik sekolah.
		// Buat akun mandiri dengan pegawaiId null agar guru/tendik tetap dapat login.
		const firstSekolah = await db.query.tableSekolah.findFirst({ columns: { id: true } });
		const displayName = (metadata.name || metadata.username || 'Pengguna SSO').trim();
		const baseSlug = (
			metadata.username?.toLowerCase().replace(/[^a-z0-9]/g, '') ||
			displayName.toLowerCase().replace(/[^a-z0-9]/g, '') ||
			'sso'
		).slice(0, 20);
		const cleanUsername = `${baseSlug}_${crypto.randomBytes(3).toString('hex')}`;
		const randomPass = crypto.randomBytes(16).toString('hex');

		const [createdUser] = await db
			.insert(tableAuthUser)
			.values({
				username: cleanUsername,
				usernameNormalized: cleanUsername.toLowerCase(),
				passwordHash: randomPass,
				passwordSalt: 'sso-managed',
				type: 'user',
				sekolahId: firstSekolah?.id ?? null,
				pegawaiId: null,
				namaLengkap: displayName
			})
			.returning();

		authUserId = createdUser.id;
	}

	// 7. Tautkan atau perbarui tableAuthZitadelUser (Upsert aman)
	const existingLink = await db.query.tableAuthZitadelUser.findFirst({
		where: eq(tableAuthZitadelUser.userId, authUserId)
	});

	if (existingLink) {
		await db
			.update(tableAuthZitadelUser)
			.set({
				zitadelUuid,
				ptkId: ptkId ?? existingLink.ptkId,
				nip: nip ?? existingLink.nip,
				nik: metadata.nik?.trim() || existingLink.nik,
				role: metadata.role?.trim() || existingLink.role,
				rawMetadata: metadata,
				lastLoginAt: new Date().toISOString()
			})
			.where(eq(tableAuthZitadelUser.id, existingLink.id));
	} else {
		await db.insert(tableAuthZitadelUser).values({
			userId: authUserId,
			zitadelUuid,
			ptkId,
			nip,
			nik: metadata.nik?.trim() || null,
			role: metadata.role?.trim() || null,
			isOnboarded: false,
			rawMetadata: metadata,
			lastLoginAt: new Date().toISOString()
		});
	}

	return {
		success: true,
		userId: authUserId,
		isNewLink: !existingLink,
		isOnboarded: Boolean(existingLink?.isOnboarded),
		pegawai: matchedPegawai
			? {
					id: matchedPegawai.id,
					nama: matchedPegawai.nama,
					nip: matchedPegawai.nip ?? nip ?? ''
				}
			: null
	};
}
