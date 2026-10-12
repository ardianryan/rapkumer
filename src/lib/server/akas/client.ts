import db from '$lib/server/db';
import { tablePresensiSettings } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';

export interface AkasConfig {
	baseUrl: string;
	apiKey: string;
	sumberPresensi: 'lokal' | 'akas';
}

/**
 * Mengambil konfigurasi AKAS dari database sekolah (tanpa hardcode credentials).
 * Mendukung fallback ke variabel lingkungan jika belum disetel di database.
 */
export async function getAkasConfig(
	sekolahId: number,
	tahunAjaranId?: number
): Promise<AkasConfig> {
	let dbSetting = null;

	if (tahunAjaranId) {
		dbSetting = await db.query.tablePresensiSettings.findFirst({
			where: and(
				eq(tablePresensiSettings.sekolahId, sekolahId),
				eq(tablePresensiSettings.tahunAjaranId, tahunAjaranId)
			)
		});
	}

	if (!dbSetting) {
		dbSetting = await db.query.tablePresensiSettings.findFirst({
			where: eq(tablePresensiSettings.sekolahId, sekolahId)
		});
	}

	const baseUrl =
		dbSetting?.akasBaseUrl?.trim() ||
		process.env.AKAS_BASE_URL?.trim() ||
		'https://akas.smage.my.id';

	const apiKey = dbSetting?.akasApiKey?.trim() || process.env.AKAS_API_KEY?.trim() || '';

	const sumberPresensi = (dbSetting?.sumberPresensi as 'lokal' | 'akas') || 'lokal';

	return {
		baseUrl: baseUrl.replace(/\/+$/, ''),
		apiKey,
		sumberPresensi
	};
}

/**
 * Mask API key untuk tampilan aman di browser (misal akas_••••••••nbvS).
 */
export function maskAkasApiKey(key: string): string {
	const trimmed = key.trim();
	if (!trimmed) return '';
	if (trimmed.length <= 8) return '••••••••';
	const prefix = trimmed.slice(0, 5);
	const suffix = trimmed.slice(-4);
	return `${prefix}••••••••${suffix}`;
}

/**
 * Uji koneksi ke server AKAS menggunakan API Key.
 */
export async function testAkasConnection(baseUrl: string, apiKey: string) {
	const cleanBase = baseUrl.trim().replace(/\/+$/, '');
	const cleanKey = apiKey.trim();

	if (!cleanBase) {
		return { success: false, message: 'URL Base AKAS tidak boleh kosong.' };
	}
	if (!cleanKey) {
		return { success: false, message: 'API Key AKAS tidak boleh kosong.' };
	}

	try {
		// 1. Health check
		const healthRes = await fetch(`${cleanBase}/api/v1/health`, {
			method: 'GET',
			headers: { Accept: 'application/json' },
			signal: AbortSignal.timeout(8000)
		});

		if (!healthRes.ok) {
			return {
				success: false,
				message: `Health check gagal (HTTP ${healthRes.status} ${healthRes.statusText})`
			};
		}

		// 2. Auth check via classes endpoint
		const classesRes = await fetch(`${cleanBase}/api/v1/classes`, {
			method: 'GET',
			headers: {
				Accept: 'application/json',
				'X-API-Key': cleanKey
			},
			signal: AbortSignal.timeout(8000)
		});

		if (!classesRes.ok) {
			const errBody = await classesRes.json().catch(() => ({}));
			return {
				success: false,
				message:
					classesRes.status === 401 || classesRes.status === 403
						? 'API Key tidak valid atau tidak memiliki scope yang diizinkan.'
						: `Validasi gagal (HTTP ${classesRes.status}): ${errBody.message || classesRes.statusText}`
			};
		}

		const classesData = await classesRes.json();
		const totalClasses = Array.isArray(classesData.data) ? classesData.data.length : 0;

		return {
			success: true,
			message: `Koneksi berhasil! Terhubung ke AKAS (${totalClasses} kelas terdeteksi).`,
			totalClasses
		};
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		return {
			success: false,
			message: `Gagal terhubung ke AKAS: ${msg}`
		};
	}
}

/**
 * Tarik rekapitulasi kehadiran dari AKAS (GET /api/v1/attendance/recap).
 */
export async function fetchAkasAttendanceRecap(
	baseUrl: string,
	apiKey: string,
	params: {
		kelas?: string;
		start_date?: string;
		end_date?: string;
		month?: string;
	}
) {
	const cleanBase = baseUrl.trim().replace(/\/+$/, '');
	const query = new URLSearchParams();
	if (params.kelas) query.set('kelas', params.kelas);
	if (params.start_date) query.set('start_date', params.start_date);
	if (params.end_date) query.set('end_date', params.end_date);
	if (params.month) query.set('month', params.month);

	const url = `${cleanBase}/api/v1/attendance/recap?${query.toString()}`;
	const res = await fetch(url, {
		method: 'GET',
		headers: {
			Accept: 'application/json',
			'X-API-Key': apiKey.trim()
		},
		signal: AbortSignal.timeout(15000)
	});

	if (!res.ok) {
		const errBody = await res.json().catch(() => ({}));
		throw new Error(errBody.message || `HTTP ${res.status} saat menarik rekap presensi AKAS`);
	}

	return await res.json();
}

/**
 * Tarik data kehadiran harian dari AKAS (GET /api/v1/attendance).
 */
export async function fetchAkasAttendanceDaily(
	baseUrl: string,
	apiKey: string,
	params: {
		kelas?: string;
		date?: string;
		page?: number;
		per_page?: number;
	}
) {
	const cleanBase = baseUrl.trim().replace(/\/+$/, '');
	const query = new URLSearchParams();
	if (params.kelas) query.set('kelas', params.kelas);
	if (params.date) query.set('date', params.date);
	if (params.page) query.set('page', String(params.page));
	query.set('per_page', String(params.per_page || 100));

	const url = `${cleanBase}/api/v1/attendance?${query.toString()}`;
	const res = await fetch(url, {
		method: 'GET',
		headers: {
			Accept: 'application/json',
			'X-API-Key': apiKey.trim()
		},
		signal: AbortSignal.timeout(15000)
	});

	if (!res.ok) {
		const errBody = await res.json().catch(() => ({}));
		throw new Error(errBody.message || `HTTP ${res.status} saat menarik data harian AKAS`);
	}

	return await res.json();
}

/**
 * Tarik daftar siswa dari AKAS (GET /api/v1/students) untuk memetakan user_id ke NISN.
 */
export async function fetchAkasStudents(baseUrl: string, apiKey: string, kelas?: string) {
	const cleanBase = baseUrl.trim().replace(/\/+$/, '');
	const allStudents: Array<{
		id: string;
		nama: string;
		nis: string | null;
		nisn: string | null;
		kelas: string;
	}> = [];

	let page = 1;
	let lastPage: number;

	do {
		const query = new URLSearchParams({
			page: String(page),
			per_page: '100'
		});
		if (kelas) query.set('kelas', kelas);

		const url = `${cleanBase}/api/v1/students?${query.toString()}`;
		const res = await fetch(url, {
			method: 'GET',
			headers: {
				Accept: 'application/json',
				'X-API-Key': apiKey.trim()
			},
			signal: AbortSignal.timeout(15000)
		});

		if (!res.ok) {
			const errBody = await res.json().catch(() => ({}));
			throw new Error(errBody.message || `HTTP ${res.status} saat menarik siswa AKAS`);
		}

		const data = await res.json();
		if (Array.isArray(data.data)) {
			allStudents.push(...data.data);
		}
		lastPage = data.last_page || 1;
		page++;
	} while (page <= lastPage);

	return allStudents;
}

export interface AkasViolationItem {
	id: string;
	user_id: string;
	violation_type_id?: string;
	violationTypeId?: string;
	date: string;
	description?: string | null;
	evidence_url?: string | null;
	kelas?: string | null;
	type?: {
		id: string;
		name: string;
		category?: string;
		points: number;
	} | null;
	student?: {
		id: string;
		nama: string;
		nis?: string | null;
		nisn?: string | null;
		kelas?: string | null;
	} | null;
}

/**
 * Tarik data riwayat pelanggaran dari AKAS (GET /api/v1/violations).
 */
export async function fetchAkasViolations(
	baseUrl: string,
	apiKey: string,
	params: {
		kelas?: string;
		user_id?: string;
	}
): Promise<AkasViolationItem[]> {
	const cleanBase = baseUrl.trim().replace(/\/+$/, '');
	const allViolations: AkasViolationItem[] = [];

	let page = 1;
	let lastPage: number;

	do {
		const query = new URLSearchParams({
			page: String(page),
			per_page: '100'
		});
		if (params.kelas) query.set('kelas', params.kelas);
		if (params.user_id) query.set('user_id', params.user_id);

		const url = `${cleanBase}/api/v1/violations?${query.toString()}`;
		const res = await fetch(url, {
			method: 'GET',
			headers: {
				Accept: 'application/json',
				'X-API-Key': apiKey.trim()
			},
			signal: AbortSignal.timeout(15000)
		});

		if (!res.ok) {
			const errBody = await res.json().catch(() => ({}));
			throw new Error(errBody.message || `HTTP ${res.status} saat menarik pelanggaran AKAS`);
		}

		const data = await res.json();
		if (Array.isArray(data.data)) {
			allViolations.push(...data.data);
		}
		lastPage = data.last_page || 1;
		page++;
	} while (page <= lastPage);

	return allViolations;
}
