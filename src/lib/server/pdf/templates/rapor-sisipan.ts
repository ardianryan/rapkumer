import { escHtml, getTutwuriBwDataUri } from './shared';

export interface RaporSisipanMapelItem {
	no: number;
	mataPelajaran: string;
	guruPengampu?: string | null;
	// Istilah Baru: Tugas (T1..Tn) & Rata-rata Tugas
	tugasValues?: Array<number | string>;
	rataTugas?: number | null;
	// Istilah Baru: Formatif (F1..Fn) & Rata-rata Formatif
	formatifValues: Array<number | string>;
	rataFormatif?: number | null;
	// Kompatibilitas field lama (Sumatif)
	sumatifValues?: Array<number | string>;
	rataSumatif?: number | null;
	sts?: number | null;
	nilaiAkhirRts?: number | null;
	catatanGuru?: string | null;
	jenis?: string;
	kode?: string | null;
}

export interface RaporSisipanStudentData {
	sekolah: {
		nama: string;
		alamat: string;
		npsn?: string | null;
		kabupatenKota?: string | null;
		provinsi?: string | null;
		bgLogoSrc?: string | null;
		jenjangVariant?: string | null;
	};
	murid: {
		nama: string;
		nisn: string;
		nis: string;
	};
	rombel: {
		nama: string;
		fase: string;
	};
	periode: {
		tahunPelajaran: string;
		semester: string;
	};
	waliKelas: {
		nama: string;
		nip?: string | null;
	};
	kepalaSekolah: {
		nama: string;
		nip?: string | null;
		statusKepalaSekolah?: string | null;
	};
	maxFormatif: number;
	maxSumatif: number;
	maxTugas?: number;
	// Kebijakan visibilitas kolom cetak sekolah (Admin)
	showRataTugas?: boolean;
	showRataFormatif?: boolean;
	showSts?: boolean;
	showNaSts?: boolean;
	tanggalCetak: string;
	mapelList: RaporSisipanMapelItem[];
	ketidakhadiran: {
		sakit: number;
		izin: number;
		tanpaKeterangan: number;
	};
	catatanWali?: string | null;
	ttdTempat?: string | null;
}

export function renderRaporSisipanHTML(data: RaporSisipanStudentData): string {
	const logoSrc = data.sekolah.bgLogoSrc || getTutwuriBwDataUri();
	const semesterLabel =
		data.periode.semester.toLowerCase().includes('genap') || data.periode.semester.includes('2')
			? '2 (Genap)'
			: '1 (Ganjil)';

	const kepalaStatus =
		data.kepalaSekolah.statusKepalaSekolah === 'plt' ? 'Plt. Kepala Sekolah' : 'Kepala Sekolah';

	// Nomenklatur baru:
	// - Tugas = maxTugas / maxFormatif lama (default 4)
	// - Formatif = maxSumatif lama (default 3)
	const maxT = Math.max(1, data.maxTugas ?? data.maxFormatif ?? 4);
	const maxF = Math.max(1, data.maxSumatif ?? 3);

	const showRataTugas = data.showRataTugas !== false;
	const showRataFormatif = data.showRataFormatif !== false;
	const showSts = data.showSts !== false;
	const showNaSts = data.showNaSts !== false;

	const colTugas = maxT + (showRataTugas ? 1 : 0);
	const colFormatif = maxF + (showRataFormatif ? 1 : 0);
	const totalTableCols = 2 + colTugas + colFormatif + (showSts ? 1 : 0) + (showNaSts ? 1 : 0);

	const kelompokMap: Record<string, RaporSisipanMapelItem[]> = {};
	for (const m of data.mapelList) {
		const jenis = m.jenis || 'wajib';
		if (!kelompokMap[jenis]) kelompokMap[jenis] = [];
		kelompokMap[jenis].push(m);
	}

	const isSMK = data.sekolah.jenjangVariant === 'SMK';
	const jenisLabelText: Record<string, string> = {
		wajib: isSMK ? 'Mata Pelajaran Umum' : 'Mata Pelajaran Wajib',
		pilihan: 'Mata Pelajaran Pilihan',
		kejuruan: 'Mata Pelajaran Kejuruan',
		mulok: 'Muatan Lokal',
		pemberdayaan: 'Muatan Pemberdayaan dan Keterampilan'
	};
	const jenisOrder = ['wajib', 'pilihan', 'kejuruan', 'pemberdayaan', 'mulok'];

	return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<title>Rapor Sisipan - ${escHtml(data.murid.nama)}</title>
<style>
	* {
		margin: 0;
		padding: 0;
		box-sizing: border-box;
	}
	@page {
		size: A4 portrait;
		margin: 12mm 14mm 12mm 14mm;
	}
	body {
		font-family: Arial, Helvetica, sans-serif;
		font-size: 8.5pt;
		color: #111;
		line-height: 1.25;
	}
	.header-kop {
		display: flex;
		align-items: center;
		border-bottom: 2px solid #000;
		padding-bottom: 6px;
		margin-bottom: 8px;
	}
	.header-logo {
		width: 50px;
		height: 50px;
		object-fit: contain;
		margin-right: 12px;
	}
	.header-text {
		flex: 1;
		text-align: center;
	}
	.header-text h1 {
		font-size: 11.5pt;
		font-weight: bold;
		text-transform: uppercase;
		margin-bottom: 1px;
	}
	.header-text h2 {
		font-size: 10.5pt;
		font-weight: bold;
		text-transform: uppercase;
		margin-bottom: 2px;
	}
	.header-text p {
		font-size: 7.5pt;
		color: #333;
	}
	.doc-title {
		text-align: center;
		margin-bottom: 8px;
	}
	.doc-title h3 {
		font-size: 10.5pt;
		font-weight: bold;
		text-decoration: underline;
		letter-spacing: 0.5px;
	}
	.doc-title p {
		font-size: 8.5pt;
		font-weight: 600;
		margin-top: 1px;
	}
	.info-grid {
		width: 100%;
		margin-bottom: 8px;
		font-size: 8.5pt;
	}
	.info-grid td {
		padding: 1px 4px;
		vertical-align: top;
	}
	table.nilai-table {
		width: 100%;
		border-collapse: collapse;
		margin-bottom: 8px;
	}
	table.nilai-table th, table.nilai-table td {
		border: 1px solid #333;
		padding: 3px 4px;
		font-size: 7.5pt;
		vertical-align: middle;
	}
	table.nilai-table th {
		background-color: #f1f5f9;
		font-weight: bold;
		text-align: center;
	}
	.text-center { text-align: center; }
	.text-left { text-align: left; }
	.text-right { text-align: right; }
	.font-bold { font-weight: bold; }
	.cell-x {
		color: #94a3b8;
		font-weight: bold;
		background-color: #f8fafc;
	}
	.bottom-section {
		display: flex;
		gap: 10px;
		margin-bottom: 10px;
	}
	.absen-box {
		width: 38%;
		border: 1px solid #333;
		padding: 5px 8px;
	}
	.catatan-box {
		flex: 1;
		border: 1px solid #333;
		padding: 5px 8px;
	}
	.box-title {
		font-weight: bold;
		font-size: 8pt;
		border-bottom: 1px dashed #999;
		padding-bottom: 2px;
		margin-bottom: 4px;
		text-transform: uppercase;
	}
	.no-break {
		page-break-inside: avoid;
		break-inside: avoid;
	}
	.ttd-section {
		width: 100%;
		border-collapse: collapse;
		margin-top: 10px;
	}
	.ttd-section td {
		vertical-align: top;
		text-align: center;
		font-size: 8.5pt;
	}
	.spacer-ttd {
		height: 48px;
	}
</style>
</head>
<body>

<!-- KOP SURAT -->
<div class="header-kop">
	${logoSrc ? `<img src="${logoSrc}" class="header-logo" alt="Logo">` : ''}
	<div class="header-text">
		<h1>${escHtml(data.sekolah.nama)}</h1>
		<p>${escHtml(data.sekolah.alamat)}${data.sekolah.kabupatenKota ? ' - ' + escHtml(data.sekolah.kabupatenKota) : ''}</p>
		${data.sekolah.npsn ? `<p>NPSN: ${escHtml(data.sekolah.npsn)}</p>` : ''}
	</div>
</div>

<!-- JUDUL RAPOR -->
<div class="doc-title">
	<h3>LAPORAN CAPAIAN HASIL BELAJAR SISIPAN</h3>
	<p>TENGAH SEMESTER ${escHtml(semesterLabel.toUpperCase())} - TAHUN AJARAN ${escHtml(data.periode.tahunPelajaran)}</p>
</div>

<!-- IDENTITAS PESERTA DIDIK -->
<table class="info-grid">
	<tr>
		<td style="width: 16%;">Nama Peserta Didik</td>
		<td style="width: 2%;">:</td>
		<td style="width: 36%; font-weight: bold;">${escHtml(data.murid.nama)}</td>
		<td style="width: 16%;">Kelas / Fase</td>
		<td style="width: 2%;">:</td>
		<td style="width: 28%;">${escHtml(data.rombel.nama)} / ${escHtml(data.rombel.fase)}</td>
	</tr>
	<tr>
		<td>NISN / NIS</td>
		<td>:</td>
		<td>${escHtml(data.murid.nisn || '-')} / ${escHtml(data.murid.nis || '-')}</td>
		<td>Semester</td>
		<td>:</td>
		<td>${escHtml(semesterLabel)}</td>
	</tr>
</table>

<!-- TABEL DAFTAR NILAI -->
<table class="nilai-table">
	<thead>
		<tr>
			<th rowspan="2" style="width: 24px;">No</th>
			<th rowspan="2" style="width: 175px;">Mata Pelajaran</th>
			<th colspan="${colTugas}">Tugas</th>
			<th colspan="${colFormatif}">Formatif</th>
			${showSts ? `<th rowspan="2" style="width: 42px;">STS</th>` : ''}
			${showNaSts ? `<th rowspan="2" style="width: 48px;">NA STS</th>` : ''}
		</tr>
		<tr>
			${Array.from({ length: maxT }, (_, i) => `<th style="width: 28px;">T${i + 1}</th>`).join('')}
			${showRataTugas ? `<th style="width: 36px;">Rata</th>` : ''}
			${Array.from({ length: maxF }, (_, i) => `<th style="width: 28px;">F${i + 1}</th>`).join('')}
			${showRataFormatif ? `<th style="width: 36px;">Rata</th>` : ''}
		</tr>
	</thead>
	<tbody>
		${jenisOrder
			.filter((j) => kelompokMap[j]?.length)
			.map((jenis, gIdx) => {
				const group = kelompokMap[jenis];
				const letter = String.fromCharCode(65 + gIdx);
				const groupHeader = `
		<tr class="group-header">
			<td colspan="${totalTableCols}" style="font-weight: bold; background-color: #f1f5f9; text-align: left; padding: 3px 6px; font-size: 8pt; text-transform: uppercase;">
				${letter}. ${escHtml(jenisLabelText[jenis] || jenis)}
			</td>
		</tr>`;
				const items = group
					.map((m, i) => {
						const tugasList = m.tugasValues ?? m.formatifValues ?? [];
						const formatifList = m.sumatifValues ?? [];
						const rataTugasVal = m.rataTugas ?? m.rataFormatif;
						const rataFormatifVal = m.rataSumatif;

						return `
		<tr>
			<td class="text-center">${i + 1}</td>
			<td>
				<div class="font-bold">${escHtml(m.mataPelajaran)}</div>
			</td>
			${tugasList
				.map(
					(v) =>
						`<td class="text-center ${v === 'X' ? 'cell-x' : ''}">${v != null && v !== '' ? v : '-'}</td>`
				)
				.join('')}
			${showRataTugas ? `<td class="text-center font-bold">${rataTugasVal != null ? rataTugasVal : '-'}</td>` : ''}
			${formatifList
				.map(
					(v) =>
						`<td class="text-center ${v === 'X' ? 'cell-x' : ''}">${v != null && v !== '' ? v : '-'}</td>`
				)
				.join('')}
			${showRataFormatif ? `<td class="text-center font-bold">${rataFormatifVal != null ? rataFormatifVal : '-'}</td>` : ''}
			${showSts ? `<td class="text-center font-bold">${m.sts != null ? m.sts : '-'}</td>` : ''}
			${showNaSts ? `<td class="text-center font-bold" style="background-color: #f8fafc; font-size: 8.5pt;">${m.nilaiAkhirRts != null ? m.nilaiAkhirRts : '-'}</td>` : ''}
		</tr>`;
					})
					.join('');
				return groupHeader + items;
			})
			.join('')}
	</tbody>
</table>
<div style="font-size: 7pt; color: #475569; margin-top: 1px; margin-bottom: 8px;">
	* Keterangan: Kolom bertanda <strong>X</strong> menunjukkan asesmen tidak dilaksanakan oleh guru mata pelajaran.
</div>

<!-- REKAPITULASI PRESENSI & CATATAN WALI KELAS -->
<div class="bottom-section">
	<div class="absen-box">
		<div class="box-title">Ketidakhadiran Paruh Semester</div>
		<table style="width: 100%; font-size: 7.5pt;">
			<tr>
				<td style="width: 65%;">1. Sakit</td>
				<td>: <strong>${data.ketidakhadiran.sakit}</strong> hari</td>
			</tr>
			<tr>
				<td>2. Izin</td>
				<td>: <strong>${data.ketidakhadiran.izin}</strong> hari</td>
			</tr>
			<tr>
				<td>3. Tanpa Keterangan</td>
				<td>: <strong>${data.ketidakhadiran.tanpaKeterangan}</strong> hari</td>
			</tr>
		</table>
	</div>

	<div class="catatan-box">
		<div class="box-title">Catatan Wali Kelas</div>
		<p style="font-size: 7.5pt; font-style: italic; line-height: 1.35;">
			"${escHtml(
				data.catatanWali ||
					'Pertahankan prestasi belajar dan tingkatkan kedisiplinan serta keaktifan dalam setiap mata pelajaran.'
			)}"
		</p>
	</div>
</div>

<!-- TANDA TANGAN -->
<div class="no-break" style="margin-top: 10pt;">
	<table class="ttd-section">
		<colgroup>
			<col style="width: 50%;">
			<col style="width: 50%;">
		</colgroup>
		<tbody>
			<tr>
				<td></td>
				<td class="text-center" style="padding-bottom: 6pt;">
					${escHtml(data.ttdTempat || 'Tempat')}, ${escHtml(data.tanggalCetak)}
				</td>
			</tr>
			<tr>
				<td class="text-center font-bold">Orang Tua / Wali Murid</td>
				<td class="text-center font-bold">Wali Kelas</td>
			</tr>
			<tr>
				<td class="spacer-ttd"></td>
				<td class="spacer-ttd"></td>
			</tr>
			<tr>
				<td class="text-center">( .................................................... )</td>
				<td class="text-center font-bold" style="text-decoration: underline;">
					${escHtml(data.waliKelas.nama)}
				</td>
			</tr>
			<tr>
				<td></td>
				<td class="text-center">
					${data.waliKelas.nip ? 'NIP. ' + escHtml(data.waliKelas.nip) : 'NIP. -'}
				</td>
			</tr>
		</tbody>
		<tbody>
			<tr>
				<td colspan="2" class="text-center font-bold" style="padding-top: 10pt;">
					${kepalaStatus}
				</td>
			</tr>
			<tr>
				<td colspan="2" class="spacer-ttd"></td>
			</tr>
			<tr>
				<td colspan="2" class="text-center font-bold" style="text-decoration: underline;">
					${escHtml(data.kepalaSekolah.nama)}
				</td>
			</tr>
			<tr>
				<td colspan="2" class="text-center">
					${data.kepalaSekolah.nip ? 'NIP. ' + escHtml(data.kepalaSekolah.nip) : 'NIP. -'}
				</td>
			</tr>
		</tbody>
	</table>
</div>

</body>
</html>`;
}
