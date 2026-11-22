import db from '$lib/server/db';
import { ensureEraporSchema } from '$lib/server/db/ensure-erapor';
import { tableEraporConfig, tableEraporSyncLogs } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export interface EraporConfig {
	apiUrl: string;
	apiKey: string;
	activeSemesterId: string;
	timeoutMs: number;
}

export interface EraporSemester {
	semester_id: string;
	tahun_ajaran_id?: string;
	nama_semester: string;
	semester?: string;
	periode_aktif?: string;
}

export interface EraporRombel {
	rombongan_belajar_id: string;
	nm_kelas: string;
	semester_id: string;
	tingkat_pendidikan_id?: string;
	jenis_rombel?: string;
	wali_ptk_id?: string | null;
}

export interface EraporMapel {
	mata_pelajaran_id: number | string;
	nm_mapel: string;
	kelompok?: string;
	nm_ringkas?: string;
}

export interface EraporPtk {
	ptk_id: string;
	nama: string;
	nip?: string | null;
	nuptk?: string | null;
}

export interface EraporKegiatanKokurikuler {
	id_kegiatan: string;
	nama_kegiatan: string;
	id_tema?: string;
	nama_tema?: string;
	fase?: string;
	tujuan_akhir?: string | null;
}

export interface EraporKelompokKokurikuler {
	kelompok_id: string;
	semester_id: string;
	nm_kelompok: string;
	tingkat_pendidikan_id?: string;
	fase?: string;
	id_kegiatan?: string;
	nama_kegiatan?: string;
	nama_tema?: string;
	jumlah_anggota?: number;
}

export interface EraporP5Subdimensi {
	id_subdimensi: string;
	id_dimensi: string;
	nama_dimensi: string;
	nama_subdimensi: string;
	urut?: number;
}

/**
 * Normalizes e-Rapor Bridge base URL so both `https://host` and `https://host/bridge`
 * resolve to `https://host/bridge`.
 */
export function normalizeEraporBridgeUrl(rawUrl: string): string {
	const cleaned = rawUrl.trim().replace(/\/+$/, '');
	if (!cleaned) return '';
	if (cleaned.endsWith('/bridge')) return cleaned;
	return `${cleaned}/bridge`;
}

/**
 * Masks API key for safe display in browser (e.g. `erapo••••••••92b85`).
 */
export function maskEraporApiKey(key: string): string {
	const trimmed = key.trim();
	if (!trimmed) return '';
	if (trimmed.length <= 10) return '••••••••';
	return `${trimmed.slice(0, 6)}••••••••${trimmed.slice(-5)}`;
}

/**
 * Loads e-Rapor Bridge configuration for a school with env fallback (no hardcoded credentials).
 */
export async function getEraporConfig(sekolahId: number): Promise<EraporConfig> {
	await ensureEraporSchema();

	const row = await db.query.tableEraporConfig.findFirst({
		where: eq(tableEraporConfig.sekolahId, sekolahId)
	});

	const rawUrl = row?.apiUrl?.trim() || process.env.ERAPOR_BASE_URL?.trim() || '';
	const apiKey = row?.apiKey?.trim() || process.env.ERAPOR_API_KEY?.trim() || '';
	const activeSemesterId = row?.activeSemesterId?.trim() || '';
	const timeoutMs =
		row?.timeoutMs && Number.isFinite(row.timeoutMs) && row.timeoutMs >= 3000
			? row.timeoutMs
			: 30000;

	return {
		apiUrl: normalizeEraporBridgeUrl(rawUrl),
		apiKey,
		activeSemesterId,
		timeoutMs
	};
}

function formatBridgeHttpError(status: number, bodyText: string, statusText: string): string {
	if (status === 401) {
		return 'Kunci API Bridge e-Rapor tidak valid atau belum terdaftar. Periksa konfigurasi di menu [3] KONFIGURASI setup-erapor-sso.cmd e-Rapor.';
	}
	if (status === 403) {
		return 'Kunci API ini berstatus read-only atau tidak memiliki izin menulis. Perbarui kunci dengan scope read,write.';
	}
	try {
		const parsed = JSON.parse(bodyText) as { error?: string; message?: string };
		const detail = parsed.error || parsed.message;
		if (detail) return `HTTP ${status}: ${detail}`;
	} catch {
		// ignore JSON parse error
	}
	return `HTTP ${status} ${statusText}`;
}

export async function eraporFetch<T = unknown>(
	config: Pick<EraporConfig, 'apiUrl' | 'apiKey' | 'timeoutMs'>,
	endpointPath: string,
	init: RequestInit = {}
): Promise<T> {
	const base = normalizeEraporBridgeUrl(config.apiUrl);
	if (!base) {
		throw new Error('URL Server Bridge e-Rapor belum dikonfigurasi.');
	}
	if (!config.apiKey.trim()) {
		throw new Error('API Key Bridge e-Rapor belum dikonfigurasi.');
	}

	const path = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
	const headers = new Headers(init.headers);
	headers.set('Accept', 'application/json');
	headers.set('X-API-Key', config.apiKey.trim());
	if (init.body && !headers.has('Content-Type')) {
		headers.set('Content-Type', 'application/json');
	}

	const res = await fetch(`${base}${path}`, {
		...init,
		headers,
		signal: AbortSignal.timeout(config.timeoutMs || 30000)
	});

	const rawText = await res.text();
	if (!res.ok) {
		throw new Error(formatBridgeHttpError(res.status, rawText, res.statusText));
	}

	try {
		return JSON.parse(rawText) as T;
	} catch {
		throw new Error('Respons server e-Rapor bukan JSON yang valid.');
	}
}

export async function testEraporConnection(
	rawUrl: string,
	apiKey: string,
	timeoutMs = 15000
): Promise<{
	success: boolean;
	message: string;
	appVersion?: string;
	activeSemester?: EraporSemester | null;
	semesters?: EraporSemester[];
	totalTables?: number;
}> {
	const apiUrl = normalizeEraporBridgeUrl(rawUrl);
	const cleanKey = apiKey.trim();

	if (!apiUrl) {
		return { success: false, message: 'URL Server e-Rapor tidak boleh kosong.' };
	}
	if (!cleanKey) {
		return { success: false, message: 'API Key Bridge e-Rapor tidak boleh kosong.' };
	}

	try {
		const health = await eraporFetch<{
			ok?: boolean;
			app_version?: string;
			active_semester?: EraporSemester;
			entitas?: number;
			tabel?: Record<string, string>;
			semester?: EraporSemester[];
		}>({ apiUrl, apiKey: cleanKey, timeoutMs }, '/health');

		if (!health.ok) {
			return { success: false, message: 'Health check e-Rapor mengembalikan status tidak sehat.' };
		}

		// Verify semester endpoint as well
		const semRes = await eraporFetch<{ ok?: boolean; data?: EraporSemester[] }>(
			{ apiUrl, apiKey: cleanKey, timeoutMs },
			'/semester?limit=50'
		);

		const semesters = Array.isArray(semRes.data)
			? semRes.data
			: Array.isArray(health.semester)
				? health.semester
				: [];

		const totalTables = health.tabel ? Object.keys(health.tabel).length : (health.entitas ?? 0);
		const semLabel = health.active_semester
			? `${health.active_semester.nama_semester} (${health.active_semester.semester_id})`
			: 'Tidak diketahui';

		return {
			success: true,
			message: `Terhubung ke e-Rapor SMA v${health.app_version ?? '-'} | Semester Aktif: ${semLabel}`,
			appVersion: health.app_version,
			activeSemester: health.active_semester ?? null,
			semesters,
			totalTables
		};
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		return { success: false, message: msg };
	}
}

async function fetchAllPaginated<T>(
	config: EraporConfig,
	basePath: string,
	extraQuery: Record<string, string> = {}
): Promise<T[]> {
	const results: T[] = [];
	let page = 1;

	while (page <= 20) {
		const params = new URLSearchParams({
			...extraQuery,
			page: String(page),
			limit: '500'
		});
		const res = await eraporFetch<{
			ok?: boolean;
			data?: T[];
			pagination?: { totalPages?: number };
		}>(config, `${basePath}?${params.toString()}`);

		if (Array.isArray(res.data)) {
			results.push(...res.data);
		}
		const totalPages = res.pagination?.totalPages ?? 1;
		if (page >= totalPages) break;
		page += 1;
	}

	return results;
}

export function fetchEraporSemesters(config: EraporConfig) {
	return fetchAllPaginated<EraporSemester>(config, '/semester');
}

export function fetchEraporRombels(config: EraporConfig, semesterId?: string) {
	return fetchAllPaginated<EraporRombel>(
		config,
		'/rombel',
		semesterId ? { semester: semesterId } : {}
	);
}

export function fetchEraporMapels(config: EraporConfig) {
	return fetchAllPaginated<EraporMapel>(config, '/mapel');
}

export function fetchEraporPtk(config: EraporConfig) {
	return fetchAllPaginated<EraporPtk>(config, '/ptk');
}

export function fetchEraporKegiatanKokurikuler(config: EraporConfig) {
	return fetchAllPaginated<EraporKegiatanKokurikuler>(config, '/kegiatan-kokurikuler');
}

export function fetchEraporKelompokKokurikuler(config: EraporConfig, semesterId?: string) {
	return fetchAllPaginated<EraporKelompokKokurikuler>(
		config,
		'/kelompok-kokurikuler',
		semesterId ? { semester: semesterId } : {}
	);
}

export function fetchEraporP5Subdimensi(config: EraporConfig) {
	return fetchAllPaginated<EraporP5Subdimensi>(config, '/p5-subdimensi');
}

export async function logEraporSync(params: {
	sekolahId: number;
	syncType: string;
	targetInfo: string;
	totalData: number;
	totalSuccess: number;
	totalFailed: number;
	requestPayload?: unknown;
	responseBody?: unknown;
	status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
	executedBy: string;
}) {
	await ensureEraporSchema();

	const truncate = (val: unknown) => {
		if (val == null) return null;
		const str = typeof val === 'string' ? val : JSON.stringify(val);
		return str.length > 60000 ? `${str.slice(0, 60000)}... [truncated]` : str;
	};

	await db.insert(tableEraporSyncLogs).values({
		sekolahId: params.sekolahId,
		syncType: params.syncType,
		targetInfo: params.targetInfo,
		totalData: params.totalData,
		totalSuccess: params.totalSuccess,
		totalFailed: params.totalFailed,
		requestPayload: truncate(params.requestPayload),
		responseBody: truncate(params.responseBody),
		status: params.status,
		executedBy: params.executedBy
	});
}
