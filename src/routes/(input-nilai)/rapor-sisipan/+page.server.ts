import db from '$lib/server/db';
import {
	tableKelas,
	tableMataPelajaran,
	tableMurid,
	tableTujuanPembelajaran,
	tableRtsMapelSetup,
	tableRtsNilaiSiswa,
	tableSekolah
} from '$lib/server/db/schema';
import { getAksesMapelUser } from '$lib/server/mapel-access';
import { isWaliOfKelas } from '$lib/server/kelas-akses';
import { and, asc, eq } from 'drizzle-orm';
import {
	getRtsSetup,
	getRtsNilaiList,
	getRtsCatatanWaliList
} from '$lib/server/rapor-sisipan/rts-service';
import { getAkasConfig } from '$lib/server/akas/client';
import { syncViolationsFromAkas } from '$lib/server/akas/sync';
import { resolveFaseKelas } from '$lib/tingkat';
import type { PageServerLoad } from './$types';

interface MuridGridItem {
	id: number;
	no: number;
	nama: string;
	nisn: string | null;
	nis: string | null;
	nilaiFormatif: Record<string, number | null> | null;
	rataFormatif: number | null;
	nilaiSumatif: Record<string, number | null> | null;
	rataSumatifTp: number | null;
	stsTes: number | null;
	stsNonTes: number | null;
	nilaiSts: number | null;
	nilaiAkhirRts: number | null;
	catatanGuru: string | null;
}

interface AvailableTpItem {
	id: number;
	deskripsi: string;
	lingkupMateri: string | null;
}

interface ProgressItem {
	id: number;
	nama: string;
	guruNama: string | null;
	isSetup: boolean;
	totalMurid: number;
	muridDinilai: number;
	persentase: number;
}

interface CatatanWaliItem {
	muridId: number;
	no: number;
	nama: string;
	nisn: string | null;
	catatanWali: string;
	sakit: number;
	izin: number;
	alfa: number;
	jumlahPelanggaran: number;
	poinPelanggaran: number;
	akasViolationsSyncedAt: string | null;
}

export const load: PageServerLoad = async ({ parent, url, depends, locals }) => {
	depends('app:rapor-sisipan');

	const { kelasAktif, user, daftarKelas } = await parent();
	const meta: PageMeta = { title: 'Rapor Sisipan Tengah Semester (STS)' };

	const typedUser = user as {
		type?: string;
		id?: number;
		pegawaiId?: number | null;
		kelasId?: number | null;
		ownKelasIds?: number[] | null;
	} | null;
	const isAdmin = typedUser?.type === 'admin';

	const sekolah = locals.sekolah;
	const currentSekolah = sekolah?.id
		? await db.query.tableSekolah.findFirst({
				where: eq(tableSekolah.id, sekolah.id)
			})
		: null;
	const maxFormatif = currentSekolah?.rtsMaxFormatif ?? 4;
	const maxSumatif = currentSekolah?.rtsMaxSumatif ?? 3;
	const showRataTugas = (currentSekolah?.rtsShowRataTugas ?? 1) === 1;
	const showRataFormatif = (currentSekolah?.rtsShowRataFormatif ?? 1) === 1;
	const showSts = (currentSekolah?.rtsShowSts ?? 1) === 1;
	const showNaSts = (currentSekolah?.rtsShowNaSts ?? 1) === 1;
	const showTtdKepala = (currentSekolah?.rtsShowTtdKepala ?? 1) === 1;

	if (!sekolah?.id) {
		return {
			meta,
			kelasAktif: null,
			daftarKelas: [],
			mapelList: [],
			selectedMapel: null,
			setup: null,
			daftarMurid: [],
			availableTps: [],
			progressList: [],
			catatanWaliList: [],
			isWaliKelasOrAdmin: false,
			maxFormatif,
			maxSumatif,
			maxTugas: maxFormatif,
			showRataTugas,
			showRataFormatif,
			showSts,
			showNaSts,
			showTtdKepala,
			isAdmin,
			akasBaseUrl: 'https://akas.smage.my.id'
		};
	}

	// Tentukan kelas yang aktif
	const requestedKelasId = Number(url.searchParams.get('kelas_id'));
	const targetKelasId =
		requestedKelasId && Number.isInteger(requestedKelasId)
			? requestedKelasId
			: (kelasAktif?.id ?? null);

	if (!targetKelasId) {
		return {
			meta,
			kelasAktif: null,
			daftarKelas: daftarKelas ?? [],
			mapelList: [],
			selectedMapel: null,
			setup: null,
			daftarMurid: [],
			availableTps: [],
			progressList: [],
			catatanWaliList: [],
			isWaliKelasOrAdmin: false,
			maxFormatif,
			maxSumatif,
			maxTugas: maxFormatif,
			showRataTugas,
			showRataFormatif,
			showSts,
			showNaSts,
			isAdmin,
			akasBaseUrl: 'https://akas.smage.my.id'
		};
	}

	const kelas = await db.query.tableKelas.findFirst({
		where: and(eq(tableKelas.id, targetKelasId), eq(tableKelas.sekolahId, sekolah.id)),
		with: {
			waliKelas: true
		}
	});

	if (!kelas) {
		return {
			meta,
			kelasAktif: null,
			daftarKelas: daftarKelas ?? [],
			mapelList: [],
			selectedMapel: null,
			setup: null,
			daftarMurid: [],
			availableTps: [],
			progressList: [],
			catatanWaliList: [],
			isWaliKelasOrAdmin: false,
			maxFormatif,
			maxSumatif,
			maxTugas: maxFormatif,
			showRataTugas,
			showRataFormatif,
			showSts,
			showNaSts,
			availableLingkupMateri: [],
			canEditSelectedMapel: false,
			isUserPengampuAny: false,
			isAdmin,
			akasBaseUrl: 'https://akas.smage.my.id'
		};
	}

	const isWaliKelasOwn =
		typedUser?.type === 'wali_kelas' &&
		(typedUser.kelasId === kelas.id ||
			typedUser.ownKelasIds?.includes(kelas.id) ||
			kelas.waliKelasId === typedUser.pegawaiId ||
			(await isWaliOfKelas(typedUser, kelas.id)));
	const isWaliKelasOrAdmin = isAdmin || typedUser?.type === 'kepala_sekolah' || isWaliKelasOwn;

	// Ambil daftar murid di kelas ini terlebih dahulu untuk deteksi agama murid (urut abjad)
	const muridRecordsRaw = await db.query.tableMurid.findMany({
		where: eq(tableMurid.kelasId, kelas.id),
		orderBy: asc(tableMurid.nama)
	});
	const muridRecords = muridRecordsRaw.sort((a, b) =>
		a.nama.localeCompare(b.nama, 'id', { sensitivity: 'base' })
	);

	function muridAgamaKey(agama: string | null | undefined): string | null {
		const a = (agama ?? '').trim().toLowerCase();
		if (a.includes('islam')) return 'islam';
		if (a.includes('kristen') || a.includes('protestan')) return 'kristen';
		if (a.includes('katolik')) return 'katolik';
		if (a.includes('hindu')) return 'hindu';
		if (a.includes('buddha') || a.includes('budha')) return 'buddha';
		if (a.includes('konghuchu') || a.includes('khonghucu')) return 'konghuchu';
		if (a.includes('kepercayaan')) return 'kepercayaan';
		return null;
	}

	function isNonRaporSubject(name: string): boolean {
		const norm = (name ?? '').trim().toLowerCase();
		return (
			norm.includes('bimbingan konseling') ||
			norm.includes('bimbingan dan konseling') ||
			norm.includes('konseling') ||
			norm.includes('bimbingan karir') ||
			norm.startsWith('bk ') ||
			norm.endsWith(' bk') ||
			norm === 'bk' ||
			norm.includes('pembelajaran berbasis project') ||
			norm.includes('pembelajaran berbasis proyek') ||
			norm.includes('project based learning') ||
			norm.includes('proyek based learning') ||
			norm.includes('berbasis project') ||
			norm.includes('berbasis proyek') ||
			norm.includes('pembelajaran berbasis riset') ||
			norm === 'pjbl' ||
			norm === 'pbl'
		);
	}

	function mapelAgamaKey(nama: string | null | undefined): string | null {
		const n = (nama ?? '').trim().toLowerCase();
		if (n.includes('islam')) return 'islam';
		if (n.includes('kristen') || n.includes('protestan')) return 'kristen';
		if (n.includes('katolik')) return 'katolik';
		if (n.includes('hindu')) return 'hindu';
		if (n.includes('buddha') || n.includes('budha')) return 'buddha';
		if (n.includes('konghuchu') || n.includes('khonghucu')) return 'konghuchu';
		if (n.includes('kepercayaan')) return 'kepercayaan';
		if (n === 'pendidikan agama dan budi pekerti' || n === 'pendidikan agama') return 'umum';
		return null;
	}

	function isKeluargaAgama(nama: string | null | undefined): boolean {
		const n = (nama ?? '').trim().toLowerCase();
		return n.startsWith('pendidikan agama') || n.startsWith('pendidikan kepercayaan');
	}

	const classAgamaKeys = new Set(
		muridRecords.map((m) => muridAgamaKey(m.agama)).filter((k): k is string => Boolean(k))
	);

	// Ambil seluruh mapel di kelas ini
	const allMapelRecords = await db.query.tableMataPelajaran.findMany({
		where: eq(tableMataPelajaran.kelasId, kelas.id),
		orderBy: asc(tableMataPelajaran.nama),
		with: {
			pengampu: true
		}
	});

	// Ambil seluruh data nilai & setup untuk cek apakah mapel pernah memiliki data
	const allNilaiInKelas = await db.query.tableRtsNilaiSiswa.findMany({
		where: eq(tableRtsNilaiSiswa.kelasId, kelas.id)
	});
	const mapelWithNilaiSet = new Set(allNilaiInKelas.map((n) => n.mataPelajaranId));
	const allSetupsInKelas = await db.query.tableRtsMapelSetup.findMany({
		where: eq(tableRtsMapelSetup.kelasId, kelas.id)
	});
	const setupSet = new Set(allSetupsInKelas.map((s) => s.mataPelajaranId));

	// Filter mapel yang aktif dan relevan di kelas ini (hilangkan mapel non-rapor & varian agama tanpa murid)
	const activeClassMapels = allMapelRecords.filter((m) => {
		if (isNonRaporSubject(m.nama)) return false;

		if (isKeluargaAgama(m.nama)) {
			const agKey = mapelAgamaKey(m.nama);
			const hasDataOrPengampu = Boolean(
				m.pengampuId || setupSet.has(m.id) || mapelWithNilaiSet.has(m.id)
			);
			if (agKey && agKey !== 'umum') {
				if (!classAgamaKeys.has(agKey) && !hasDataOrPengampu) {
					return false;
				}
			} else if (agKey === 'umum' && !hasDataOrPengampu) {
				return false;
			}
		}

		return true;
	});

	// Ambil hak akses mapel pengguna
	let assignedMapelIds = new Set<number>();
	if (user?.id) {
		const userAkses = await getAksesMapelUser(
			{
				id: user.id,
				mataPelajaranId: (user as { mataPelajaranId?: number | null }).mataPelajaranId,
				pegawaiId: (user as { pegawaiId?: number | null }).pegawaiId
			},
			kelas.id
		);
		assignedMapelIds = userAkses.ids;
	}

	const isFullAdmin = isAdmin || typedUser?.type === 'kepala_sekolah';

	// Untuk dropdown di tab "Input Nilai Mapel":
	// - Jika Admin / Kepala Sekolah: bisa memilih semua activeClassMapels
	// - Jika Guru / Wali Kelas: HANYA mapel yang dia ampu di kelas ini!
	const inputMapelOptions = isFullAdmin
		? activeClassMapels
		: activeClassMapels.filter((m) => assignedMapelIds.has(m.id));

	const mapelOptions = inputMapelOptions.map((m) => ({
		id: m.id,
		nama: m.namaLokal?.trim() || m.nama,
		guruNama: m.pengampu?.nama ?? null
	}));

	// Tentukan mapel yang sedang dipilih
	const requestedMapelId = Number(url.searchParams.get('mapel_id'));
	let selectedMapelRecord: (typeof activeClassMapels)[number] | null = null;
	if (requestedMapelId) {
		selectedMapelRecord = activeClassMapels.find((m) => m.id === requestedMapelId) ?? null;
	}
	if (!selectedMapelRecord) {
		selectedMapelRecord = inputMapelOptions[0] ?? activeClassMapels[0] ?? null;
	}

	// Cek apakah user berhak mengedit mapel terpilih ini
	const canEditSelectedMapel =
		isFullAdmin || (Boolean(selectedMapelRecord) && assignedMapelIds.has(selectedMapelRecord!.id));

	// Ambil data untuk mapel terpilih
	let setup = null;
	let daftarMurid: MuridGridItem[] = [];
	let availableTps: AvailableTpItem[] = [];
	let availableLingkupMateri: string[] = [];

	if (selectedMapelRecord) {
		setup = await getRtsSetup(kelas.id, selectedMapelRecord.id);

		// TP yang tersimpan di intrakurikuler
		const tpRecords = await db.query.tableTujuanPembelajaran.findMany({
			where: eq(tableTujuanPembelajaran.mataPelajaranId, selectedMapelRecord.id),
			orderBy: asc(tableTujuanPembelajaran.id)
		});
		const lmSet = new Set<string>();
		for (const t of tpRecords) {
			const lm = t.lingkupMateri?.trim();
			if (lm) lmSet.add(lm);
		}
		availableLingkupMateri = Array.from(lmSet);

		availableTps = tpRecords.map((t) => ({
			id: t.id,
			deskripsi: t.deskripsi,
			lingkupMateri: t.lingkupMateri
		}));

		function parseJsonScoreRecord(val: unknown): Record<string, number | null> {
			if (!val) return {};
			if (typeof val === 'string') {
				try {
					const parsed = JSON.parse(val);
					if (typeof parsed === 'object' && parsed !== null) {
						return parsed as Record<string, number | null>;
					}
				} catch {
					return {};
				}
			}
			if (typeof val === 'object' && val !== null) {
				return val as Record<string, number | null>;
			}
			return {};
		}

		// Nilai siswa untuk mapel ini (jika keluarga agama, ambil juga varian/induk terkait di kelas)
		const targetMapelIds = isKeluargaAgama(selectedMapelRecord.nama)
			? allMapelRecords.filter((m) => isKeluargaAgama(m.nama)).map((m) => m.id)
			: [selectedMapelRecord.id];

		const nilaiRecords = await getRtsNilaiList(kelas.id, targetMapelIds);

		// Bangun map multi-kunci untuk mencocokkan murid secara akurat
		const byMuridId = new Map<number, (typeof nilaiRecords)[0]>();
		const byNisn = new Map<string, (typeof nilaiRecords)[0]>();
		const byNama = new Map<string, (typeof nilaiRecords)[0]>();

		// Urutkan nilai: utamakan yang cocok persis dengan selectedMapelRecord.id
		const sortedNilaiRecords = [...nilaiRecords].sort((a, b) => {
			const aMatch = a.mataPelajaranId === selectedMapelRecord!.id ? 1 : 0;
			const bMatch = b.mataPelajaranId === selectedMapelRecord!.id ? 1 : 0;
			return bMatch - aMatch;
		});

		for (const n of sortedNilaiRecords) {
			if (n.muridId && !byMuridId.has(n.muridId)) {
				byMuridId.set(n.muridId, n);
			}
			const nisn = n.murid?.nisn?.trim();
			if (nisn && !byNisn.has(nisn)) {
				byNisn.set(nisn, n);
			}
			const nama = n.murid?.nama?.trim().toLowerCase();
			if (nama && !byNama.has(nama)) {
				byNama.set(nama, n);
			}
		}

		daftarMurid = muridRecords.map((m, idx) => {
			// 1. Coba cocokkan via ID murid
			let n = byMuridId.get(m.id);
			// 2. Fallback via NISN
			if (!n && m.nisn?.trim()) {
				n = byNisn.get(m.nisn.trim());
			}
			// 3. Fallback via Nama
			if (!n && m.nama?.trim()) {
				n = byNama.get(m.nama.trim().toLowerCase());
			}
			// 4. Fallback via nomor urut (jika data terimpor dengan nomor absen 1..N)
			if (!n && byMuridId.has(idx + 1)) {
				const candidate = byMuridId.get(idx + 1);
				if (candidate && !muridRecords.some((other) => other.id === idx + 1)) {
					n = candidate;
				}
			}

			const formatifObj = parseJsonScoreRecord(n?.nilaiFormatif);
			const sumatifObj = parseJsonScoreRecord(n?.nilaiSumatif);

			return {
				id: m.id,
				no: idx + 1,
				nama: m.nama,
				nisn: m.nisn,
				nis: m.nis,
				nilaiFormatif: Object.keys(formatifObj).length > 0 ? formatifObj : null,
				rataFormatif: n?.rataFormatif ?? null,
				nilaiSumatif: Object.keys(sumatifObj).length > 0 ? sumatifObj : null,
				rataSumatifTp: n?.rataSumatifTp ?? null,
				stsTes: n?.stsTes ?? null,
				stsNonTes: n?.stsNonTes ?? null,
				nilaiSts: n?.nilaiSts ?? null,
				nilaiAkhirRts: n?.nilaiAkhirRts ?? null,
				catatanGuru: n?.catatanGuru ?? null
			};
		});
	}

	// Ambil data monitoring progress & catatan wali kelas jika wali kelas atau admin
	let progressList: ProgressItem[] = [];
	let catatanWaliList: CatatanWaliItem[] = [];

	// Ambil konfigurasi AKAS sekolah
	const akasConfig = sekolah?.id ? await getAkasConfig(sekolah.id) : null;

	if (isWaliKelasOrAdmin) {
		// Catatan wali kelas
		let catatanRecords = await getRtsCatatanWaliList(kelas.id);

		// Inisialisasi awal: jika data rekap AKAS belum pernah ditarik (akasViolationsSyncedAt null),
		// dan AKAS API key tersedia, lakukan auto-pull otomatis!
		const hasSyncedAkas = catatanRecords.some((c) => Boolean(c.akasViolationsSyncedAt));
		if (!hasSyncedAkas && muridRecords.length > 0 && akasConfig?.apiKey) {
			try {
				await syncViolationsFromAkas({
					sekolahId: sekolah.id,
					kelasId: kelas.id
				});
				catatanRecords = await getRtsCatatanWaliList(kelas.id);
			} catch (err) {
				console.warn('[RTS AKAS Initial Sync Error]:', err);
			}
		}

		const catatanMap = new Map(catatanRecords.map((c) => [c.muridId, c]));

		catatanWaliList = muridRecords.map((m, idx) => {
			const c = catatanMap.get(m.id);
			return {
				muridId: m.id,
				no: idx + 1,
				nama: m.nama,
				nisn: m.nisn,
				catatanWali: c?.catatanWali || '',
				sakit: c?.sakit ?? 0,
				izin: c?.izin ?? 0,
				alfa: c?.alfa ?? 0,
				jumlahPelanggaran: c?.jumlahPelanggaran ?? 0,
				poinPelanggaran: c?.poinPelanggaran ?? 0,
				akasViolationsSyncedAt: c?.akasViolationsSyncedAt ?? null
			};
		});

		// Progress pengisian per mapel (menggunakan activeClassMapels yang sudah disaring)
		const classMuridIdSet = new Set(muridRecords.map((m) => m.id));
		progressList = activeClassMapels.map((m) => {
			const relatedMapelIds = isKeluargaAgama(m.nama)
				? new Set(allMapelRecords.filter((rec) => isKeluargaAgama(rec.nama)).map((rec) => rec.id))
				: new Set([m.id]);

			const gradedCount = allNilaiInKelas.filter(
				(n) =>
					relatedMapelIds.has(n.mataPelajaranId) &&
					n.nilaiAkhirRts != null &&
					classMuridIdSet.has(n.muridId)
			).length;
			const totalMurid = muridRecords.length;
			const validGraded = Math.min(gradedCount, totalMurid);
			const persentase = totalMurid > 0 ? Math.round((validGraded / totalMurid) * 1000) / 10 : 0;

			return {
				id: m.id,
				nama: m.namaLokal?.trim() || m.nama,
				guruNama: m.pengampu?.nama ?? null,
				isSetup: setupSet.has(m.id),
				totalMurid,
				muridDinilai: validGraded,
				persentase,
				canEdit: isFullAdmin || assignedMapelIds.has(m.id)
			};
		});
	}

	return {
		meta,
		kelasAktif: {
			id: kelas.id,
			nama: kelas.nama,
			fase: resolveFaseKelas(kelas),
			waliKelasNama: kelas.waliKelas?.nama ?? null
		},
		daftarKelas: daftarKelas ?? [],
		mapelList: mapelOptions,
		selectedMapel: selectedMapelRecord
			? {
					id: selectedMapelRecord.id,
					nama: selectedMapelRecord.namaLokal?.trim() || selectedMapelRecord.nama,
					guruNama: selectedMapelRecord.pengampu?.nama ?? null
				}
			: null,
		setup,
		daftarMurid,
		availableTps,
		availableLingkupMateri,
		progressList,
		catatanWaliList,
		isWaliKelasOrAdmin,
		canEditSelectedMapel,
		isUserPengampuAny: isFullAdmin || assignedMapelIds.size > 0,
		maxFormatif,
		maxSumatif,
		maxTugas: maxFormatif,
		showRataTugas,
		showRataFormatif,
		showSts,
		showNaSts,
		showTtdKepala,
		isAdmin,
		akasBaseUrl: akasConfig?.baseUrl || 'https://akas.smage.my.id',
		isAkasMode: akasConfig?.sumberPresensi === 'akas'
	};
};
