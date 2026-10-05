import { escHtml, getTutwuriBwDataUri } from './shared';

export interface RaporSisipanMapelItem {
	no: number;
	mataPelajaran: string;
	guruPengampu?: string | null;
	formatifDetail?: string | null;
	rataFormatif?: number | null;
	sumatifDetail?: string | null;
	rataSumatif?: number | null;
	sts?: number | null;
	nilaiAkhirRts?: number | null;
	catatanGuru?: string | null;
}

export interface RaporSisipanStudentData {
	sekolah: {
		nama: string;
		alamat: string;
		npsn?: string | null;
		kabupatenKota?: string | null;
		provinsi?: string | null;
		bgLogoSrc?: string | null;
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
	.ttd-section {
		width: 100%;
		margin-top: 6px;
	}
	.ttd-section td {
		vertical-align: top;
		text-align: center;
		font-size: 8.5pt;
		width: 33.33%;
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
			<th rowspan="2" style="width: 28px;">No</th>
			<th rowspan="2" style="width: 200px;">Mata Pelajaran</th>
			<th colspan="2">Asesmen Formatif (Tugas)</th>
			<th colspan="2">Sumatif Lingkup Materi</th>
			<th rowspan="2" style="width: 48px;">STS</th>
			<th rowspan="2" style="width: 54px;">NA STS</th>
		</tr>
		<tr>
			<th style="width: 120px;">Rincian Nilai</th>
			<th style="width: 42px;">Rata</th>
			<th style="width: 120px;">Rincian Nilai</th>
			<th style="width: 42px;">Rata</th>
		</tr>
	</thead>
	<tbody>
		${data.mapelList
			.map(
				(m) => `
		<tr>
			<td class="text-center">${m.no}</td>
			<td>
				<div class="font-bold">${escHtml(m.mataPelajaran)}</div>
			</td>
			<td class="text-center" style="font-size: 7.5pt;">${m.formatifDetail || '-'}</td>
			<td class="text-center font-bold">${m.rataFormatif != null ? m.rataFormatif : '-'}</td>
			<td class="text-center" style="font-size: 7.5pt;">${m.sumatifDetail || '-'}</td>
			<td class="text-center font-bold">${m.rataSumatif != null ? m.rataSumatif : '-'}</td>
			<td class="text-center font-bold">${m.sts != null ? m.sts : '-'}</td>
			<td class="text-center font-bold" style="background-color: #f8fafc; font-size: 8.5pt;">
				${m.nilaiAkhirRts != null ? m.nilaiAkhirRts : '-'}
			</td>
		</tr>`
			)
			.join('')}
	</tbody>
</table>

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
<table class="ttd-section">
	<tr>
		<td>
			<p>Mengetahui,</p>
			<p>Orang Tua / Wali Murid</p>
			<div style="height: 48px;"></div>
			<p>( .................................................... )</p>
		</td>
		<td>
			<p>${escHtml(data.ttdTempat || 'Tempat')}, ${escHtml(data.tanggalCetak)}</p>
			<p>Wali Kelas</p>
			<div style="height: 48px;"></div>
			<p class="font-bold" style="text-decoration: underline;">${escHtml(data.waliKelas.nama)}</p>
			<p>${data.waliKelas.nip ? 'NIP. ' + escHtml(data.waliKelas.nip) : 'NIP. -'}</p>
		</td>
		<td>
			<p>&nbsp;</p>
			<p>${escHtml(data.kepalaSekolah.statusKepalaSekolah || 'Kepala Sekolah')}</p>
			<div style="height: 48px;"></div>
			<p class="font-bold" style="text-decoration: underline;">${escHtml(data.kepalaSekolah.nama)}</p>
			<p>${data.kepalaSekolah.nip ? 'NIP. ' + escHtml(data.kepalaSekolah.nip) : 'NIP. -'}</p>
		</td>
	</tr>
</table>

</body>
</html>`;
}
