import db from '$lib/server/db';
import { tableScholargateSettings } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export interface ScholargateConfig {
	baseUrl: string;
	apiKey: string;
	referer: string;
}

export interface ScholargateMember {
	id: string;
	nama: string;
	role: string;
	dapodik_id?: string | null;
	ptk_id?: string | null;
	peserta_didik_id?: string | null;
	jenis_kelamin?: 'L' | 'P' | null;
	nik?: string | null;
	nomor_kk?: string | null;
	nisn?: string | null;
	nis?: string | null;
	nip?: string | null;
	tempat_lahir?: string | null;
	tanggal_lahir?: string | null;
	agama?: string | null;
	google_email?: string | null;
	google_name?: string | null;
	email_pribadi?: string | null;
	no_telepon?: string | null;
	alamat?: string | null;
	[key: string]: unknown;
}

/**
 * Mengambil konfigurasi ScholarGate (SMAGE ID) dari database sekolah.
 * Seluruh URL, API key, dan Referer diketik oleh admin di UI dan disimpan di database (tanpa hardcode).
 */
export async function getScholargateConfig(sekolahId: number): Promise<ScholargateConfig> {
	let dbSetting = null;

	try {
		dbSetting = await db.query.tableScholargateSettings.findFirst({
			where: eq(tableScholargateSettings.sekolahId, sekolahId)
		});
	} catch (e) {
		console.warn('[Scholargate] Gagal membaca tabel scholargate_settings:', e);
	}

	const baseUrl = dbSetting?.baseUrl?.trim() || '';
	const apiKey = dbSetting?.apiKey?.trim() || '';
	const referer = dbSetting?.referer?.trim() || '';

	return {
		baseUrl: baseUrl.replace(/\/+$/, ''),
		apiKey,
		referer
	};
}

/**
 * Mask API key untuk tampilan aman di browser (misal sg_••••••••abc).
 */
export function maskScholargateApiKey(key: string): string {
	const trimmed = key.trim();
	if (!trimmed) return '';
	if (trimmed.length <= 8) return '••••••••';
	const prefix = trimmed.slice(0, 5);
	const suffix = trimmed.slice(-4);
	return `${prefix}••••••••${suffix}`;
}

export function buildHeaders(apiKey: string, referer: string): Record<string, string> {
	const headers: Record<string, string> = {
		'X-API-Key': apiKey.trim(),
		Accept: 'application/json'
	};

	const ref = referer.trim();
	if (ref) {
		headers['Referer'] = ref;
		try {
			const parsed = new URL(ref);
			headers['Origin'] = `${parsed.protocol}//${parsed.host}`;
		} catch {
			headers['Origin'] = ref;
		}
	}

	return headers;
}

/**
 * Uji koneksi ke server ScholarGate (SMAGE ID) menggunakan parameter yang diisi dari UI/DB.
 */
export async function testScholargateConnection(baseUrl: string, apiKey: string, referer?: string) {
	const cleanBase = baseUrl.trim().replace(/\/+$/, '');
	const cleanKey = apiKey.trim();
	const cleanRef = (referer ?? '').trim();

	if (!cleanBase) {
		return { success: false, message: 'URL Base ScholarGate (SMAGE ID) belum diisi.' };
	}
	if (!cleanKey) {
		return { success: false, message: 'API Key ScholarGate (SMAGE ID) belum diisi.' };
	}
	if (!cleanRef) {
		return { success: false, message: 'Domain / URL Referer aplikasi belum diisi.' };
	}

	try {
		const headers = buildHeaders(cleanKey, cleanRef);

		// Coba endpoint /api/v1/test
		const res = await fetch(`${cleanBase}/api/v1/test`, {
			method: 'GET',
			headers
		});

		if (res.ok) {
			const json = (await res.json()) as {
				success?: boolean;
				message?: string;
				meta?: { app_name?: string };
			};
			return {
				success: true,
				message: `Koneksi berhasil! Terhubung ke aplikasi ${json.meta?.app_name || 'SMAGE ID / ScholarGate'}.`
			};
		}

		// Fallback cek /api/v1/academic-year/active
		const resAy = await fetch(`${cleanBase}/api/v1/academic-year/active`, {
			method: 'GET',
			headers
		});

		if (resAy.ok) {
			return {
				success: true,
				message: 'Koneksi ke ScholarGate (SMAGE ID) berhasil terverifikasi.'
			};
		}

		const errText = await res.text();
		try {
			const errJson = JSON.parse(errText);
			return {
				success: false,
				message: errJson.message || `Gagal terhubung (${res.status}): ${errText.slice(0, 150)}`
			};
		} catch {
			return {
				success: false,
				message: `Server merespon status ${res.status}: ${errText.slice(0, 150)}`
			};
		}
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		return {
			success: false,
			message: `Gagal menghubungi server ScholarGate (SMAGE ID): ${msg}`
		};
	}
}

/**
 * Melakukan pencarian (lookup) satu data guru/member di ScholarGate.
 * Endpoint: GET /api/v1/members/lookup
 */
export async function lookupScholargateMember(
	baseUrl: string,
	apiKey: string,
	referer: string,
	criteria: {
		dapodik_id?: string;
		ptk_id?: string;
		username?: string;
		email?: string;
		nip?: string;
		nik?: string;
	}
): Promise<ScholargateMember | null> {
	const cleanBase = baseUrl.trim().replace(/\/+$/, '');
	const cleanKey = apiKey.trim();
	const cleanRef = referer.trim();

	if (!cleanBase) {
		throw new Error('URL Base ScholarGate (SMAGE ID) belum disetel di Pengaturan.');
	}
	if (!cleanKey) {
		throw new Error('API Key ScholarGate (SMAGE ID) belum disetel di Pengaturan.');
	}
	if (!cleanRef) {
		throw new Error('Domain / Referer ScholarGate belum disetel di Pengaturan.');
	}

	const url = new URL(`${cleanBase}/api/v1/members/lookup`);
	let hasParam = false;

	if (criteria.dapodik_id) {
		url.searchParams.set('dapodik_id', criteria.dapodik_id);
		hasParam = true;
	} else if (criteria.ptk_id) {
		url.searchParams.set('ptk_id', criteria.ptk_id);
		hasParam = true;
	} else if (criteria.nip) {
		url.searchParams.set('nip', criteria.nip);
		hasParam = true;
	} else if (criteria.nik) {
		url.searchParams.set('nik', criteria.nik);
		hasParam = true;
	} else if (criteria.username) {
		url.searchParams.set('username', criteria.username);
		hasParam = true;
	} else if (criteria.email) {
		url.searchParams.set('email', criteria.email);
		hasParam = true;
	}

	if (!hasParam) {
		return null;
	}

	const headers = buildHeaders(cleanKey, cleanRef);
	const res = await fetch(url.toString(), {
		method: 'GET',
		headers
	});

	if (res.status === 404) {
		return null;
	}

	if (!res.ok) {
		const errText = await res.text();
		throw new Error(`Lookup SMAGE ID gagal (${res.status}): ${errText.slice(0, 150)}`);
	}

	const json = (await res.json()) as {
		success?: boolean;
		found?: boolean;
		data?: ScholargateMember;
	};
	if (json.success && json.data) {
		return json.data;
	}

	return null;
}
