import db from '$lib/server/db';
import {
	tableSekolah,
	tableKelas,
	tableMurid,
	tableMataPelajaran,
	tableRtsMapelSetup,
	tableRtsNilaiSiswa,
	tableRtsCatatanWali
} from '$lib/server/db/schema';
import { and, asc, eq } from 'drizzle-orm';
import { resolveSekolahAcademicContext } from '$lib/server/db/academic';
import { computeRaporAttendance } from '$lib/server/pdf/attendance-utils';
import {
	composeAlamat,
	fallbackTempat,
	formatTanggal,
	getLogoSrc
} from '$lib/server/pdf/preview-utils';
import { isKeluargaAgama, isKeluargaPks, muridAgamaKey } from '$lib/server/mapel-picker';
import { agamaMapelOptions, agamaParentName, pksMapelOptions, pksParentName } from '$lib/statics';
import type { RaporSisipanStudentData, RaporSisipanMapelItem } from './templates/rapor-sisipan';

function normalizeText(value: string | null | undefined) {
	return value?.trim().toLowerCase() ?? '';
}

export async function getRaporSisipanDataForStudent(params: {
	sekolahId: number;
	kelasId: number;
	muridId: number;
}): Promise<RaporSisipanStudentData> {
	const { sekolahId, kelasId, muridId } = params;

	const sekolah = await db.query.tableSekolah.findFirst({
		where: eq(tableSekolah.id, sekolahId),
		with: {
			alamat: true,
			kepalaSekolah: true
		}
	});
	if (!sekolah) throw new Error('Sekolah tidak ditemukan');

	const kelas = await db.query.tableKelas.findFirst({
		where: and(eq(tableKelas.id, kelasId), eq(tableKelas.sekolahId, sekolahId)),
		with: {
			waliKelas: true
		}
	});
	if (!kelas) throw new Error('Kelas tidak ditemukan');

	const murid = await db.query.tableMurid.findFirst({
		where: and(eq(tableMurid.id, muridId), eq(tableMurid.kelasId, kelasId))
	});
	if (!murid) throw new Error('Murid tidak ditemukan');

	const academicContext = await resolveSekolahAcademicContext(sekolahId);
	const activeTahun = academicContext.tahunAjaranList.find(
		(t) => t.id === academicContext.activeTahunAjaranId
	);
	const activeSemesterTipe = academicContext.activeSemesterTipe ?? 'ganjil';
	const semesterId = academicContext.activeSemesterId;

	const tahunPelajaran = activeTahun?.nama ?? new Date().getFullYear().toString();
	const semester = activeSemesterTipe === 'genap' ? 'Genap' : 'Ganjil';

	const rawTanggalBagi = academicContext.tanggalBagiRaport?.[activeSemesterTipe];
	const tanggalCetak = rawTanggalBagi
		? formatTanggal(rawTanggalBagi)
		: formatTanggal(new Date().toISOString().slice(0, 10));

	const bgLogoSrc = await getLogoSrc(sekolah.id);

	// Ambil semua mapel di kelas ini
	const allClassMapels = await db.query.tableMataPelajaran.findMany({
		where: eq(tableMataPelajaran.kelasId, kelasId),
		orderBy: [asc(tableMataPelajaran.urutan), asc(tableMataPelajaran.nama)],
		with: {
			pengampu: true
		}
	});

	// Smart deteksi Pendidikan Agama & PKS sesuai agama murid
	const muridKey = muridAgamaKey(murid.agama);
	const expectedAgamaName =
		(muridKey ? agamaMapelOptions.find((o: { key: string }) => o.key === muridKey)?.name : null) ??
		agamaParentName;
	const expectedAgamaNormalized = normalizeText(expectedAgamaName);
	const agamaParentNormalized = normalizeText(agamaParentName);

	const expectedPksDbName =
		(muridKey ? pksMapelOptions.find((o: { key: string }) => o.key === muridKey)?.name : null) ??
		pksParentName;
	const expectedPksDbNormalized = normalizeText(expectedPksDbName);
	const pksParentNormalized = normalizeText(pksParentName);
	const pksOption = muridKey
		? pksMapelOptions.find((o: { key: string; label: string }) => o.key === muridKey)
		: null;
	const expectedPksDisplayName = pksOption
		? `Pendalaman Kitab Suci Agama ${pksOption.label}`
		: pksParentName;

	const hasSpecificAgamaInClass = allClassMapels.some(
		(m) => normalizeText(m.nama) === expectedAgamaNormalized
	);
	const hasSpecificPksInClass = allClassMapels.some(
		(m) => normalizeText(m.nama) === expectedPksDbNormalized
	);

	const filteredMapels = allClassMapels.filter((m) => {
		// Mapel belum dipetakan tidak ditampilkan
		if (m.jenis === 'belum_dipetakan') return false;

		// Mapel tanpa kode singkat tidak ditampilkan di rapor cetak
		const isAgama = isKeluargaAgama(m.nama);
		const effectiveKode = m.kode?.trim() || (isAgama ? 'PAPB' : null);
		if (!effectiveKode) return false;

		const normName = normalizeText(m.nama);

		// Filter Pendidikan Agama
		if (isKeluargaAgama(m.nama)) {
			if (hasSpecificAgamaInClass) {
				return normName === expectedAgamaNormalized;
			}
			return normName === agamaParentNormalized;
		}

		// Filter Pendalaman Kitab Suci
		if (isKeluargaPks(m.nama)) {
			if (hasSpecificPksInClass) {
				return normName === expectedPksDbNormalized;
			}
			return normName === pksParentNormalized;
		}

		return true;
	});

	// Urutkan mapel berdasarkan urutan manual -> kelompok jenis -> prioritas agama -> alfabetis
	const mapelJenisOrder: Record<string, number> = {
		wajib: 1,
		pilihan: 2,
		kejuruan: 3,
		pemberdayaan: 4,
		mulok: 5,
		belum_dipetakan: 6
	};

	filteredMapels.sort((a, b) => {
		const urutanA = a.urutan ?? Number.POSITIVE_INFINITY;
		const urutanB = b.urutan ?? Number.POSITIVE_INFINITY;
		if (urutanA !== urutanB) return urutanA - urutanB;

		const orderA = mapelJenisOrder[a.jenis] ?? Number.POSITIVE_INFINITY;
		const orderB = mapelJenisOrder[b.jenis] ?? Number.POSITIVE_INFINITY;
		if (orderA !== orderB) return orderA - orderB;

		if (a.jenis === 'wajib' && b.jenis === 'wajib') {
			const isAgamaA = isKeluargaAgama(a.nama) ? 0 : 1;
			const isAgamaB = isKeluargaAgama(b.nama) ? 0 : 1;
			if (isAgamaA !== isAgamaB) return isAgamaA - isAgamaB;
		}

		return a.nama.localeCompare(b.nama, 'id');
	});

	// Ambil semua setup RTS di kelas ini
	const setupList = await db.query.tableRtsMapelSetup.findMany({
		where: eq(tableRtsMapelSetup.kelasId, kelasId)
	});
	const setupMap = new Map(setupList.map((s) => [s.mataPelajaranId, s]));

	// Ambil semua nilai RTS untuk murid ini di kelas ini
	const nilaiList = await db.query.tableRtsNilaiSiswa.findMany({
		where: and(eq(tableRtsNilaiSiswa.kelasId, kelasId), eq(tableRtsNilaiSiswa.muridId, muridId))
	});
	const nilaiMap = new Map(nilaiList.map((n) => [n.mataPelajaranId, n]));

	const maxFormatif = sekolah.rtsMaxFormatif ?? 4;
	const maxSumatif = sekolah.rtsMaxSumatif ?? 3;

	// Format baris nilai tiap mapel
	const rtsMapelItems: RaporSisipanMapelItem[] = filteredMapels.map((m, idx) => {
		const s = setupMap.get(m.id);
		const n = nilaiMap.get(m.id);

		// Array nilai formatif sejumlah maxFormatif
		const formatifValues: Array<number | string> = [];
		const sFormatif = s?.komponenFormatif ?? [];
		const nFormatif = (n?.nilaiFormatif ?? {}) as Record<string, number | null>;
		for (let i = 0; i < maxFormatif; i++) {
			if (i < sFormatif.length) {
				const f = sFormatif[i];
				const val = nFormatif[f.kode];
				formatifValues.push(val != null ? val : '-');
			} else {
				// Guru tidak melaksanakan asesmen ini
				formatifValues.push(sFormatif.length > 0 ? 'X' : '-');
			}
		}

		// Array nilai sumatif sejumlah maxSumatif
		const sumatifValues: Array<number | string> = [];
		const sSumatif = s?.komponenSumatif ?? [];
		const nSumatif = (n?.nilaiSumatif ?? {}) as Record<string, number | null>;
		for (let i = 0; i < maxSumatif; i++) {
			if (i < sSumatif.length) {
				const sum = sSumatif[i];
				const val = nSumatif[sum.kode];
				sumatifValues.push(val != null ? val : '-');
			} else {
				// Guru tidak melaksanakan asesmen ini
				sumatifValues.push(sSumatif.length > 0 ? 'X' : '-');
			}
		}

		let displayName = m.namaLokal?.trim() || m.nama;
		const normName = normalizeText(m.nama);

		// Jika mapel agama induk, tampilkan varian spesifik agama murid
		if (isKeluargaAgama(m.nama) && normName === agamaParentNormalized) {
			displayName = expectedAgamaName;
		}

		// Jika PKS, sesuaikan display name
		if (isKeluargaPks(m.nama)) {
			displayName = expectedPksDisplayName;
		}

		return {
			no: idx + 1,
			mataPelajaran: displayName,
			guruPengampu: null,
			tugasValues: formatifValues,
			rataTugas: n?.rataFormatif ?? null,
			formatifValues,
			rataFormatif: n?.rataFormatif ?? null,
			sumatifValues,
			rataSumatif: n?.rataSumatifTp ?? null,
			sts: n?.nilaiSts ?? null,
			nilaiAkhirRts: n?.nilaiAkhirRts ?? null,
			catatanGuru: n?.catatanGuru ?? null,
			jenis: m.jenis,
			kode: m.kode
		};
	});

	// Ambil catatan wali & presensi
	const catatanWaliRecord = await db.query.tableRtsCatatanWali.findFirst({
		where: and(eq(tableRtsCatatanWali.kelasId, kelasId), eq(tableRtsCatatanWali.muridId, muridId))
	});

	let sakit = catatanWaliRecord?.sakit ?? 0;
	let izin = catatanWaliRecord?.izin ?? 0;
	let tanpaKeterangan = catatanWaliRecord?.alfa ?? 0;

	// Jika belum ada override catatan, hitung dari presensi harian paruh semester
	if (!catatanWaliRecord && semesterId && activeTahun?.id) {
		try {
			const att = await computeRaporAttendance(sekolahId, activeTahun.id, muridId, {
				id: semesterId,
				tanggalMasuk: academicContext.tanggalMasuk?.[activeSemesterTipe] ?? null,
				tanggalBagiRaport: rawTanggalBagi ?? null
			});
			sakit = att.sakit;
			izin = att.izin;
			tanpaKeterangan = att.alfa;
		} catch {
			// fallback to 0
		}
	}

	const tempat = fallbackTempat(sekolah as unknown as NonNullable<App.Locals['sekolah']>);

	return {
		sekolah: {
			nama: sekolah.nama,
			alamat: composeAlamat(sekolah as unknown as NonNullable<App.Locals['sekolah']>),
			npsn: sekolah.npsn,
			kabupatenKota: sekolah.alamat?.kabupaten ?? null,
			provinsi: sekolah.alamat?.provinsi ?? null,
			jenjangVariant: sekolah.jenjangVariant,
			bgLogoSrc
		},
		murid: {
			nama: murid.nama,
			nisn: murid.nisn || '',
			nis: murid.nis || ''
		},
		rombel: {
			nama: kelas.nama,
			fase: kelas.fase || 'E'
		},
		periode: {
			tahunPelajaran,
			semester
		},
		waliKelas: {
			nama: kelas.waliKelas?.nama || 'Wali Kelas',
			nip: kelas.waliKelas?.nip || null
		},
		kepalaSekolah: {
			nama: sekolah.kepalaSekolah?.nama || 'Kepala Sekolah',
			nip: sekolah.kepalaSekolah?.nip || null,
			statusKepalaSekolah: sekolah.statusKepalaSekolah
		},
		maxFormatif,
		maxSumatif,
		maxTugas: maxFormatif,
		showRataTugas: (sekolah.rtsShowRataTugas ?? 1) === 1,
		showRataFormatif: (sekolah.rtsShowRataFormatif ?? 1) === 1,
		showSts: (sekolah.rtsShowSts ?? 1) === 1,
		showNaSts: (sekolah.rtsShowNaSts ?? 1) === 1,
		tanggalCetak,
		mapelList: rtsMapelItems,
		ketidakhadiran: {
			sakit,
			izin,
			tanpaKeterangan
		},
		catatanWali: catatanWaliRecord?.catatanWali || null,
		ttdTempat: tempat
	};
}
