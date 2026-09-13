import { escHtml, formatValue, sharedStyles } from './shared';
import type { ModulAjarKonten } from '$lib/server/ai-modul-ajar';

export interface ModulAjarPrintData {
	identitas: {
		sekolah: string;
		guru: string;
		nipGuru?: string | null;
		mataPelajaran: string;
		fase: string;
		kelas: string;
		semester: string;
		tahunPelajaran: string;
		materiPokok: string;
		alokasiWaktu: string;
		jumlahPertemuan: string;
	};
	konten: ModulAjarKonten;
	kepalaSekolah: {
		nama: string;
		nip?: string | null;
		statusKepalaSekolah?: string | null;
	};
	ttd: {
		tempat: string;
		tanggal: string;
	};
}

export function renderModulAjarHTML(data: ModulAjarPrintData): string {
	const { identitas, konten, kepalaSekolah, ttd } = data;
	const jabatanKepala =
		kepalaSekolah.statusKepalaSekolah === 'plt' ? 'Plt. Kepala Sekolah' : 'Kepala Sekolah';

	const dimensiRows = (konten.identifikasi?.dimensiProfilLulusan || [])
		.map(
			(d, i) => `
			<tr>
				<td class="text-center" style="width: 35px;">${i + 1}</td>
				<td style="width: 200px;" class="font-bold">${escHtml(d.dimensi)}</td>
				<td>${escHtml(d.penjelasan)}</td>
			</tr>`
		)
		.join('');

	const formatifRows = (konten.asesmen?.formatif || [])
		.map(
			(f, i) => `
			<tr>
				<td class="text-center" style="width: 35px;">${i + 1}</td>
				<td>${escHtml(f.teknik)}</td>
				<td>${escHtml(f.instrumen)}</td>
				<td class="text-center">${escHtml(f.waktu)}</td>
				<td>${escHtml(f.tindakLanjut)}</td>
			</tr>`
		)
		.join('');

	const rubrikRows = (konten.rubrik || [])
		.map(
			(r, i) => `
			<tr>
				<td class="text-center" style="width: 30px;">${i + 1}</td>
				<td class="font-bold" style="width: 140px;">${escHtml(r.kriteria)}</td>
				<td style="width: 22%; font-size: 8.5pt;">${escHtml(r.sangatBaik)}</td>
				<td style="width: 22%; font-size: 8.5pt;">${escHtml(r.baik)}</td>
				<td style="width: 22%; font-size: 8.5pt;">${escHtml(r.cukup)}</td>
				<td style="width: 22%; font-size: 8.5pt;">${escHtml(r.perluBimbingan)}</td>
			</tr>`
		)
		.join('');

	const kegiatanIntiRows = (konten.tahapMemahami?.kegiatanInti || [])
		.map(
			(k, i) => `
			<tr>
				<td class="text-center" style="width: 35px;">${i + 1}</td>
				<td class="font-bold" style="width: 150px;">${escHtml(k.langkah)}</td>
				<td>${escHtml(k.peranGuru)}</td>
				<td>${escHtml(k.aktivitasMurid)}</td>
				<td class="text-center" style="width: 70px;">${escHtml(k.alokasiWaktu)}</td>
			</tr>`
		)
		.join('');

	const glosariumRows = (konten.lampiran?.glosarium || [])
		.map(
			(g) => `
			<li style="margin-bottom: 4px;">
				<strong>${escHtml(g.istilah)}:</strong> ${escHtml(g.definisi)}
			</li>`
		)
		.join('');

	const pustakaRows = (konten.lampiran?.daftarPustaka || [])
		.map((p) => `<li style="margin-bottom: 4px;">${escHtml(p)}</li>`)
		.join('');

	return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>Modul Ajar - ${escHtml(identitas.materiPokok)}</title>
<style>
${sharedStyles()}

@page {
	size: A4 portrait;
	margin: 20mm 15mm 20mm 15mm;
	@bottom-right {
		content: counter(page);
		font-size: 9pt;
		font-family: Helvetica, Arial, sans-serif;
	}
}

body {
	font-family: 'Times New Roman', Times, serif;
	font-size: 10.5pt;
	line-height: 1.45;
	color: #111;
}

.title-box {
	text-align: center;
	border-bottom: 2px solid #000;
	padding-bottom: 8px;
	margin-bottom: 18px;
}

.title-box h1 {
	font-size: 14pt;
	font-weight: bold;
	text-transform: uppercase;
	margin-bottom: 4px;
}

.title-box h2 {
	font-size: 12pt;
	font-weight: bold;
	text-transform: uppercase;
	margin-bottom: 2px;
}

.section-header {
	font-size: 11pt;
	font-weight: bold;
	background-color: #f0f0f0;
	border: 1px solid #333;
	padding: 4px 8px;
	margin-top: 14px;
	margin-bottom: 8px;
	text-transform: uppercase;
}

.sub-header {
	font-weight: bold;
	margin-top: 8px;
	margin-bottom: 4px;
	font-size: 10.5pt;
}

table.doc-table {
	width: 100%;
	border-collapse: collapse;
	margin-bottom: 10px;
}

table.doc-table th,
table.doc-table td {
	border: 1px solid #444;
	padding: 5px 7px;
	vertical-align: top;
}

table.doc-table th {
	background-color: #f4f4f4;
	font-weight: bold;
	text-align: center;
}

table.identitas-table {
	width: 100%;
	border-collapse: collapse;
	margin-bottom: 12px;
}

table.identitas-table td {
	padding: 3px 6px;
	vertical-align: top;
}

ul, ol {
	margin-left: 20px;
	margin-top: 4px;
	margin-bottom: 8px;
}

.ttd-container {
	margin-top: 30px;
	width: 100%;
	page-break-inside: avoid;
}

.ttd-table {
	width: 100%;
	border: none;
}

.ttd-table td {
	border: none;
	width: 50%;
	text-align: center;
	vertical-align: top;
	padding: 10px;
}

.ttd-space {
	height: 60px;
}
</style>
</head>
<body>

<div class="title-box">
	<h1>MODUL AJAR PEMBELAJARAN MENDALAM</h1>
	<h2>(DEEP LEARNING)</h2>
	<p style="font-size: 10pt; margin-top: 4px;">${escHtml(identitas.sekolah)}</p>
</div>

<!-- A. IDENTITAS MODUL -->
<div class="section-header">A. IDENTITAS MODUL</div>
<table class="identitas-table">
	<tr>
		<td style="width: 25%;">1. Nama Sekolah</td>
		<td style="width: 2%;">:</td>
		<td style="width: 73%;" class="font-bold">${formatValue(identitas.sekolah)}</td>
	</tr>
	<tr>
		<td>2. Nama Guru / Penyusun</td>
		<td>:</td>
		<td>${formatValue(identitas.guru)}</td>
	</tr>
	<tr>
		<td>3. Mata Pelajaran</td>
		<td>:</td>
		<td>${formatValue(identitas.mataPelajaran)}</td>
	</tr>
	<tr>
		<td>4. Fase / Kelas</td>
		<td>:</td>
		<td>Fase ${formatValue(identitas.fase)} / Kelas ${formatValue(identitas.kelas)}</td>
	</tr>
	<tr>
		<td>5. Semester</td>
		<td>:</td>
		<td>${formatValue(identitas.semester)}</td>
	</tr>
	<tr>
		<td>6. Tahun Pelajaran</td>
		<td>:</td>
		<td>${formatValue(identitas.tahunPelajaran)}</td>
	</tr>
	<tr>
		<td>7. Materi Pokok / Topik</td>
		<td>:</td>
		<td class="font-bold">${formatValue(identitas.materiPokok)}</td>
	</tr>
	<tr>
		<td>8. Alokasi Waktu</td>
		<td>:</td>
		<td>${formatValue(identitas.alokasiWaktu)}</td>
	</tr>
	<tr>
		<td>9. Jumlah Pertemuan</td>
		<td>:</td>
		<td>${formatValue(identitas.jumlahPertemuan)}</td>
	</tr>
</table>

<!-- B. IDENTIFIKASI -->
<div class="section-header">B. IDENTIFIKASI</div>
<div class="sub-header">1. Karakteristik Peserta Didik</div>
<p style="text-align: justify; margin-bottom: 8px;">${escHtml(konten.identifikasi?.karakteristikPesertaDidik)}</p>

<div class="sub-header">2. Karakteristik Materi</div>
<p style="text-align: justify; margin-bottom: 8px;">${escHtml(konten.identifikasi?.karakteristikMateri)}</p>

<div class="sub-header">3. Dimensi Profil Lulusan / Pelajar</div>
<table class="doc-table">
	<thead>
		<tr>
			<th>No</th>
			<th>Dimensi</th>
			<th>Penjelasan dan Integrasi dalam Pembelajaran</th>
		</tr>
	</thead>
	<tbody>
		${dimensiRows}
	</tbody>
</table>

<!-- C. DESAIN PEMBELAJARAN -->
<div class="section-header">C. DESAIN PEMBELAJARAN</div>
<div class="sub-header">1. Capaian Pembelajaran</div>
<p style="text-align: justify; margin-bottom: 8px;">${escHtml(konten.desain?.capaianPembelajaran)}</p>

<div class="sub-header">2. Tujuan Pembelajaran Berjenjang (Taksonomi SOLO)</div>
<div style="margin-left: 10px; margin-bottom: 8px;">
	<p><strong>a. Tahap Memahami (Understanding):</strong></p>
	<ul>
		${(konten.desain?.tujuanPembelajaran?.memahami || []).map((t) => `<li>${escHtml(t)}</li>`).join('')}
	</ul>
	<p><strong>b. Tahap Mengaplikasi (Applying):</strong></p>
	<ul>
		${(konten.desain?.tujuanPembelajaran?.mengaplikasi || []).map((t) => `<li>${escHtml(t)}</li>`).join('')}
	</ul>
	<p><strong>c. Tahap Merefleksi (Reflecting):</strong></p>
	<ul>
		${(konten.desain?.tujuanPembelajaran?.merefleksi || []).map((t) => `<li>${escHtml(t)}</li>`).join('')}
	</ul>
</div>

<div class="sub-header">3. Topik dan Konsep Esensial</div>
<ul>
	${(konten.desain?.topikEsensial || []).map((t) => `<li>${escHtml(t)}</li>`).join('')}
</ul>

<div class="sub-header">4. Pertanyaan Pemantik</div>
<ol>
	${(konten.desain?.pertanyaanPemantik || []).map((p) => `<li>${escHtml(p)}</li>`).join('')}
</ol>

<div class="sub-header">5. Praktik Pedagogis (Model Pembelajaran)</div>
<p><strong>Model:</strong> ${escHtml(konten.desain?.praktikPedagogis?.model)}</p>
<p style="text-align: justify;"><strong>Alasan Pemilihan:</strong> ${escHtml(konten.desain?.praktikPedagogis?.alasanPemilihan)}</p>

<div class="sub-header" style="margin-top: 8px;">6. Kemitraan Pembelajaran</div>
<p style="text-align: justify;">${escHtml(konten.desain?.kemitraanPembelajaran)}</p>

<div class="sub-header">7. Lingkungan Pembelajaran</div>
<ul style="margin-top: 2px;">
	<li><strong>Fisik:</strong> ${escHtml(konten.desain?.lingkunganPembelajaran?.fisik)}</li>
	<li><strong>Digital:</strong> ${escHtml(konten.desain?.lingkunganPembelajaran?.digital)}</li>
	<li><strong>Psikologis dan Sosial:</strong> ${escHtml(konten.desain?.lingkunganPembelajaran?.psikososial)}</li>
</ul>

<div class="sub-header">8. Pemanfaatan Teknologi Digital</div>
<p style="text-align: justify;">${escHtml(konten.desain?.pemanfaatanTeknologiDigital)}</p>

<!-- D. PENGALAMAN BELAJAR (Tahap 1: Memahami) -->
<div class="section-header">D. PENGALAMAN BELAJAR (TAHAP 1: MEMAHAMI)</div>
<div class="sub-header">1. Kegiatan Awal (${escHtml(konten.tahapMemahami?.kegiatanAwal?.alokasiWaktu)})</div>
<table class="doc-table">
	<tr>
		<td style="width: 30%;" class="font-bold">Aktivitas Guru</td>
		<td>${escHtml(konten.tahapMemahami?.kegiatanAwal?.aktivitasGuru)}</td>
	</tr>
	<tr>
		<td class="font-bold">Aktivitas Murid</td>
		<td>${escHtml(konten.tahapMemahami?.kegiatanAwal?.aktivitasMurid)}</td>
	</tr>
	<tr>
		<td class="font-bold">Penerapan Prinsip (Mindful, Meaningful, Joyful)</td>
		<td>${escHtml(konten.tahapMemahami?.kegiatanAwal?.penerapanPrinsip)}</td>
	</tr>
</table>

<div class="sub-header">2. Kegiatan Inti Tahap Memahami</div>
<table class="doc-table">
	<thead>
		<tr>
			<th>No</th>
			<th>Langkah Pembelajaran</th>
			<th>Peran Guru</th>
			<th>Aktivitas Murid</th>
			<th>Waktu</th>
		</tr>
	</thead>
	<tbody>
		${kegiatanIntiRows}
	</tbody>
</table>

<!-- E. TAHAP 2: MENGAPLIKASI -->
<div class="section-header">E. PENGALAMAN BELAJAR (TAHAP 2: MENGAPLIKASI)</div>
<table class="identitas-table">
	<tr>
		<td style="width: 30%;" class="font-bold">1. Konteks Masalah Autentik</td>
		<td style="width: 2%;">:</td>
		<td>${escHtml(konten.tahapMengaplikasi?.konteksMasalahAutentik)}</td>
	</tr>
	<tr>
		<td class="font-bold">2. Tugas dan Tantangan Murid</td>
		<td>:</td>
		<td>${escHtml(konten.tahapMengaplikasi?.tugasTantangan)}</td>
	</tr>
	<tr>
		<td class="font-bold">3. Langkah Kerja Terstruktur</td>
		<td>:</td>
		<td>
			<ol style="margin-left: 15px; margin-top: 0;">
				${(konten.tahapMengaplikasi?.langkahKerja || []).map((l) => `<li>${escHtml(l)}</li>`).join('')}
			</ol>
		</td>
	</tr>
	<tr>
		<td class="font-bold">4. Produk / Solusi Nyata</td>
		<td>:</td>
		<td class="font-bold">${escHtml(konten.tahapMengaplikasi?.produkSolusiNyata)}</td>
	</tr>
	<tr>
		<td class="font-bold">5. Keterkaitan Kehidupan Nyata</td>
		<td>:</td>
		<td>${escHtml(konten.tahapMengaplikasi?.keterkaitanKehidupanNyata)}</td>
	</tr>
</table>

<!-- F. TAHAP 3: MEREFLEKSI -->
<div class="section-header">F. PENGALAMAN BELAJAR (TAHAP 3: MEREFLEKSI)</div>
<div class="sub-header">1. Pertanyaan Refleksi Peserta Didik</div>
<ol>
	${(konten.tahapMerefleksi?.pertanyaanRefleksi || []).map((p) => `<li>${escHtml(p)}</li>`).join('')}
</ol>
<div class="sub-header">2. Kesimpulan Bersama Pembelajaran</div>
<p style="text-align: justify;">${escHtml(konten.tahapMerefleksi?.kesimpulanPembelajaran)}</p>

<!-- G. ASESMEN PEMBELAJARAN -->
<div class="section-header">G. ASESMEN PEMBELAJARAN</div>
<div class="sub-header">1. Asesmen Diagnostik (Awal)</div>
<p style="text-align: justify; margin-bottom: 8px;">${escHtml(konten.asesmen?.diagnostik)}</p>

<div class="sub-header">2. Asesmen Formatif (Proses)</div>
<table class="doc-table">
	<thead>
		<tr>
			<th>No</th>
			<th>Teknik Asesmen</th>
			<th>Instrumen</th>
			<th>Waktu Pelaksanaan</th>
			<th>Tindak Lanjut</th>
		</tr>
	</thead>
	<tbody>
		${formatifRows}
	</tbody>
</table>

<div class="sub-header">3. Asesmen Sumatif (Akhir)</div>
<p style="text-align: justify;">${escHtml(konten.asesmen?.sumatif)}</p>

<!-- H. RUBRIK ASESMEN -->
<div class="section-header">H. RUBRIK ASESMEN PEMBELAJARAN MENDALAM</div>
<table class="doc-table" style="font-size: 8.5pt;">
	<thead>
		<tr>
			<th>No</th>
			<th>Kriteria</th>
			<th>Sangat Baik (Skala 4)</th>
			<th>Baik (Skala 3)</th>
			<th>Cukup (Skala 2)</th>
			<th>Perlu Bimbingan (Skala 1)</th>
		</tr>
	</thead>
	<tbody>
		${rubrikRows}
	</tbody>
</table>

<!-- I. DIFERENSIASI PEMBELAJARAN -->
<div class="section-header">I. DIFERENSIASI PEMBELAJARAN</div>
<table class="doc-table">
	<tr>
		<td style="width: 25%;" class="font-bold">Diferensiasi Konten</td>
		<td>${escHtml(konten.diferensiasi?.konten)}</td>
	</tr>
	<tr>
		<td class="font-bold">Diferensiasi Proses</td>
		<td>${escHtml(konten.diferensiasi?.proses)}</td>
	</tr>
	<tr>
		<td class="font-bold">Diferensiasi Produk</td>
		<td>${escHtml(konten.diferensiasi?.produk)}</td>
	</tr>
	<tr>
		<td class="font-bold">Dukungan Khusus</td>
		<td>${escHtml(konten.diferensiasi?.dukunganKhusus)}</td>
	</tr>
</table>

<!-- J. REMEDIAL DAN PENGAYAAN -->
<div class="section-header">J. REMEDIAL DAN PENGAYAAN</div>
<div class="sub-header">1. Program Remedial</div>
<p style="text-align: justify; margin-bottom: 6px;">${escHtml(konten.remedialDanPengayaan?.remedial)}</p>
<div class="sub-header">2. Program Pengayaan</div>
<p style="text-align: justify;">${escHtml(konten.remedialDanPengayaan?.pengayaan)}</p>

<!-- K. REFLEKSI GURU -->
<div class="section-header">K. REFLEKSI GURU</div>
<ol>
	${(konten.refleksiGuru || []).map((r) => `<li>${escHtml(r)}</li>`).join('')}
</ol>

<!-- L. LAMPIRAN -->
<div class="section-header">L. LAMPIRAN</div>
<div class="sub-header">1. Ringkasan Bahan Ajar</div>
<p style="text-align: justify; margin-bottom: 8px;">${escHtml(konten.lampiran?.bahanAjarRingkas)}</p>

<div class="sub-header">2. Petunjuk LKPD (Lembar Kerja Peserta Didik)</div>
<p style="text-align: justify; margin-bottom: 8px;">${escHtml(konten.lampiran?.petunjukLkpd)}</p>

<div class="sub-header">3. Media, Alat, dan Sumber Belajar</div>
<p style="text-align: justify; margin-bottom: 8px;">${escHtml(konten.lampiran?.mediaDanSumber)}</p>

<div class="sub-header">4. Glosarium</div>
<ul style="margin-bottom: 8px;">
	${glosariumRows}
</ul>

<div class="sub-header">5. Daftar Pustaka</div>
<ol>
	${pustakaRows}
</ol>

<!-- TANDA TANGAN -->
<div class="ttd-container">
	<table class="ttd-table">
		<tr>
			<td>
				<p>Mengetahui,</p>
				<p>${escHtml(jabatanKepala)}</p>
				<div class="ttd-space"></div>
				<p class="font-bold" style="text-decoration: underline;">${formatValue(kepalaSekolah.nama)}</p>
				<p>NIP. ${formatValue(kepalaSekolah.nip)}</p>
			</td>
			<td>
				<p>${escHtml(ttd.tempat)}, ${escHtml(ttd.tanggal)}</p>
				<p>Guru Mata Pelajaran,</p>
				<div class="ttd-space"></div>
				<p class="font-bold" style="text-decoration: underline;">${formatValue(identitas.guru)}</p>
				<p>NIP. ${formatValue(identitas.nipGuru)}</p>
			</td>
		</tr>
	</table>
</div>

</body>
</html>`;
}
