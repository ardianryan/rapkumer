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

	// Format baris nilai tiap mapel
	const rtsMapelItems: RaporSisipanMapelItem[] = filteredMapels.map((m, idx) => {
		const s = setupMap.get(m.id);
		const n = nilaiMap.get(m.id);

		// Format string formatif e.g. "F1: 85, F2: 90"
		let formatifDetail: string | null = null;
		if (s?.komponenFormatif && n?.nilaiFormatif) {
			const rec = n.nilaiFormatif as Record<string, number | null>;
			const parts: string[] = [];
			for (const f of s.komponenFormatif) {
				if (rec[f.kode] != null) parts.push(`${f.kode}: ${rec[f.kode]}`);
			}
			if (parts.length > 0) formatifDetail = parts.join(', ');
		}

		// Format string sumatif e.g. "S1: 88, S2: 82"
		let sumatifDetail: string | null = null;
		if (s?.komponenSumatif && n?.nilaiSumatif) {
			const rec = n.nilaiSumatif as Record<string, number | null>;
			const parts: string[] = [];
			for (const sum of s.komponenSumatif) {
				if (rec[sum.kode] != null) parts.push(`${sum.kode}: ${rec[sum.kode]}`);
			}
			if (parts.length > 0) sumatifDetail = parts.join(', ');
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
			formatifDetail,
			rataFormatif: n?.rataFormatif ?? null,
			sumatifDetail,
			rataSumatif: n?.rataSumatifTp ?? null,
			sts: n?.nilaiSts ?? null,
			nilaiAkhirRts: n?.nilaiAkhirRts ?? null,
			catatanGuru: n?.catatanGuru ?? null
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
