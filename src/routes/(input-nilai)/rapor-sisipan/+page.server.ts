import db from '$lib/server/db';
import {
	tableKelas,
	tableMataPelajaran,
	tableMurid,
	tableTujuanPembelajaran,
	tableRtsMapelSetup,
	tableRtsNilaiSiswa
} from '$lib/server/db/schema';
import { getAksesMapelUser, needsMapelFilter } from '$lib/server/mapel-access';
import { and, asc, eq } from 'drizzle-orm';
import {
	getRtsSetup,
	getRtsNilaiList,
	getRtsCatatanWaliList
} from '$lib/server/rapor-sisipan/rts-service';
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
}

export const load: PageServerLoad = async ({ parent, url, depends, locals }) => {
	depends('app:rapor-sisipan');

	const { kelasAktif, user, daftarKelas } = await parent();
	const meta: PageMeta = { title: 'Rapor Sisipan Tengah Semester (STS)' };

	const sekolah = locals.sekolah;
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
			isWaliKelasOrAdmin: false
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
			isWaliKelasOrAdmin: false
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
			isWaliKelasOrAdmin: false
		};
	}

	const typedUser = user as {
		type?: string;
		id?: number;
		kelasId?: number | null;
		ownKelasIds?: number[] | null;
	} | null;

	const isWaliKelasOwn =
		typedUser?.type === 'wali_kelas' &&
		(typedUser.kelasId === kelas.id || typedUser.ownKelasIds?.includes(kelas.id));
	const isWaliKelasOrAdmin =
		typedUser?.type === 'admin' || typedUser?.type === 'kepala_sekolah' || isWaliKelasOwn;

	// Ambil seluruh mapel di kelas ini
	const allMapelRecords = await db.query.tableMataPelajaran.findMany({
		where: eq(tableMataPelajaran.kelasId, kelas.id),
		orderBy: asc(tableMataPelajaran.nama),
		with: {
			pengampu: true
		}
	});

	// Filter mapel sesuai hak akses guru jika tipe akun "user" (guru mapel)
	let accessibleMapels = allMapelRecords;
	if (needsMapelFilter(user, kelas.id) && user?.id) {
		const userAkses = await getAksesMapelUser(user as { id: number }, kelas.id);
		accessibleMapels = allMapelRecords.filter(
			(m) =>
				userAkses.ids.has(m.id) ||
				userAkses.names.has(m.nama.trim().toLowerCase()) ||
				(m.namaLokal && userAkses.names.has(m.namaLokal.trim().toLowerCase()))
		);
	}

	const mapelOptions = accessibleMapels.map((m) => ({
		id: m.id,
		nama: m.namaLokal?.trim() || m.nama,
		guruNama: m.pengampu?.nama ?? null
	}));

	// Tentukan mapel yang sedang dipilih
	const requestedMapelId = Number(url.searchParams.get('mapel_id'));
	let selectedMapelRecord = requestedMapelId
		? accessibleMapels.find((m) => m.id === requestedMapelId)
		: (accessibleMapels[0] ?? null);

	// Jika requested mapel tidak ditemukan di accessible, gunakan fallback pertama
	if (!selectedMapelRecord && accessibleMapels.length > 0) {
		selectedMapelRecord = accessibleMapels[0];
	}

	// Ambil daftar murid di kelas ini
	const muridRecords = await db.query.tableMurid.findMany({
		where: eq(tableMurid.kelasId, kelas.id),
		orderBy: asc(tableMurid.nama)
	});

	// Ambil data untuk mapel terpilih
	let setup = null;
	let daftarMurid: MuridGridItem[] = [];
	let availableTps: AvailableTpItem[] = [];

	if (selectedMapelRecord) {
		setup = await getRtsSetup(kelas.id, selectedMapelRecord.id);

		// TP yang tersimpan di intrakurikuler
		const tpRecords = await db.query.tableTujuanPembelajaran.findMany({
			where: eq(tableTujuanPembelajaran.mataPelajaranId, selectedMapelRecord.id),
			orderBy: asc(tableTujuanPembelajaran.id)
		});
		availableTps = tpRecords.map((t) => ({
			id: t.id,
			deskripsi: t.deskripsi,
			lingkupMateri: t.lingkupMateri
		}));

		// Nilai siswa untuk mapel ini
		const nilaiRecords = await getRtsNilaiList(kelas.id, selectedMapelRecord.id);
		const nilaiMap = new Map(nilaiRecords.map((n) => [n.muridId, n]));

		daftarMurid = muridRecords.map((m, idx) => {
			const n = nilaiMap.get(m.id);
			return {
				id: m.id,
				no: idx + 1,
				nama: m.nama,
				nisn: m.nisn,
				nis: m.nis,
				nilaiFormatif: (n?.nilaiFormatif as Record<string, number | null>) || null,
				rataFormatif: n?.rataFormatif ?? null,
				nilaiSumatif: (n?.nilaiSumatif as Record<string, number | null>) || null,
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

	if (isWaliKelasOrAdmin) {
		// Catatan wali kelas
		const catatanRecords = await getRtsCatatanWaliList(kelas.id);
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
				alfa: c?.alfa ?? 0
			};
		});

		// Progress pengisian per mapel
		const allNilaiInKelas = await db.query.tableRtsNilaiSiswa.findMany({
			where: eq(tableRtsNilaiSiswa.kelasId, kelas.id)
		});
		const allSetupsInKelas = await db.query.tableRtsMapelSetup.findMany({
			where: eq(tableRtsMapelSetup.kelasId, kelas.id)
		});
		const setupSet = new Set(allSetupsInKelas.map((s) => s.mataPelajaranId));

		progressList = allMapelRecords.map((m) => {
			const gradedCount = allNilaiInKelas.filter(
				(n) => n.mataPelajaranId === m.id && n.nilaiAkhirRts != null
			).length;
			const totalMurid = muridRecords.length;
			const persentase = totalMurid > 0 ? Math.round((gradedCount / totalMurid) * 1000) / 10 : 0;

			return {
				id: m.id,
				nama: m.namaLokal?.trim() || m.nama,
				guruNama: m.pengampu?.nama ?? null,
				isSetup: setupSet.has(m.id),
				totalMurid,
				muridDinilai: gradedCount,
				persentase
			};
		});
	}

	return {
		meta,
		kelasAktif: {
			id: kelas.id,
			nama: kelas.nama,
			fase: kelas.fase,
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
		progressList,
		catatanWaliList,
		isWaliKelasOrAdmin
	};
};
