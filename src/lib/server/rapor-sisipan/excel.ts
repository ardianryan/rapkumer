import ExcelJS from 'exceljs';
import type { RtsKomponenFormatifItem, RtsKomponenSumatifItem } from '$lib/server/db/schema';
import type { RtsNilaiInputItem } from './rts-service';

export interface GenerateTemplateParams {
	namaSekolah: string;
	namaKelas: string;
	namaMapel: string;
	komponenFormatif: RtsKomponenFormatifItem[];
	komponenSumatif: RtsKomponenSumatifItem[];
	adaStsTes: boolean;
	adaStsNonTes: boolean;
	daftarMurid: Array<{
		id: number;
		no: number;
		nama: string;
		nisn?: string | null;
		nis?: string | null;
		nilaiFormatif?: Record<string, number | null> | null;
		nilaiSumatif?: Record<string, number | null> | null;
		stsTes?: number | null;
		stsNonTes?: number | null;
		catatanGuru?: string | null;
	}>;
}

/**
 * Buat template spreadsheet Excel (.xlsx) untuk penilaian Rapor Sisipan
 */
export async function generateRtsExcelTemplate(params: GenerateTemplateParams): Promise<Buffer> {
	const workbook = new ExcelJS.Workbook();
	workbook.creator = 'Rapkumer';
	workbook.created = new Date();

	const sheet = workbook.addWorksheet('Nilai Tengah Semester', {
		views: [{ state: 'frozen', xSplit: 4, ySplit: 5 }]
	});

	// Header Informasi
	sheet.getCell('A1').value = `FORMAT NILAI TENGAH SEMESTER (STS / PTS)`;
	sheet.getCell('A1').font = { bold: true, size: 14 };
	sheet.getCell('A2').value =
		`Sekolah: ${params.namaSekolah} | Kelas: ${params.namaKelas} | Mata Pelajaran: ${params.namaMapel}`;
	sheet.getCell('A2').font = { italic: true, size: 11 };

	sheet.getCell('A3').value =
		'Petunjuk: Isikan nilai antara 0-100 pada kolom Formatif dan Sumatif. Jangan mengubah urutan kolom ID, NISN, NIS, dan Nama.';
	sheet.getCell('A3').font = { color: { argb: 'FF666666' }, size: 9 };

	// Setup Baris Header Tabel pada Row 5
	const headerRow = sheet.getRow(5);
	const headers: string[] = ['ID Murid', 'No', 'NISN', 'Nama Peserta Didik'];

	for (const f of params.komponenFormatif) {
		headers.push(`[${f.kode}] ${f.nama}`);
	}
	for (const s of params.komponenSumatif) {
		headers.push(`[${s.kode}] ${s.lingkupMateri || s.tpDeskripsi}`);
	}
	if (params.adaStsTes) headers.push('STS Tes');
	if (params.adaStsNonTes) headers.push('STS Non-Tes');
	headers.push('Catatan Guru Mapel');

	headerRow.values = headers;
	headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
	headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
	headerRow.height = 32;

	// Pewarnaan Header:
	// A-D: Dark slate
	// Formatif: Indigo
	// Sumatif: Emerald
	// STS: Amber
	// Catatan: Blue
	let colIdx = 1;
	for (let i = 0; i < 4; i++) {
		const cell = headerRow.getCell(colIdx++);
		cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
	}
	for (let i = 0; i < params.komponenFormatif.length; i++) {
		const cell = headerRow.getCell(colIdx++);
		cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }; // Indigo
	}
	for (let i = 0; i < params.komponenSumatif.length; i++) {
		const cell = headerRow.getCell(colIdx++);
		cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } }; // Emerald
	}
	if (params.adaStsTes) {
		const cell = headerRow.getCell(colIdx++);
		cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD97706' } }; // Amber
	}
	if (params.adaStsNonTes) {
		const cell = headerRow.getCell(colIdx++);
		cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD97706' } }; // Amber
	}
	const catatanCell = headerRow.getCell(colIdx);
	catatanCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0284C7' } }; // Sky blue

	// Set lebar kolom
	sheet.getColumn(1).width = 10; // ID (tersembunyi/kecil)
	sheet.getColumn(2).width = 6; // No
	sheet.getColumn(3).width = 16; // NISN
	sheet.getColumn(4).width = 30; // Nama

	let c = 5;
	for (let i = 0; i < params.komponenFormatif.length; i++) {
		sheet.getColumn(c++).width = 14;
	}
	for (let i = 0; i < params.komponenSumatif.length; i++) {
		sheet.getColumn(c++).width = 18;
	}
	if (params.adaStsTes) sheet.getColumn(c++).width = 12;
	if (params.adaStsNonTes) sheet.getColumn(c++).width = 14;
	sheet.getColumn(c++).width = 35; // Catatan

	// Masukkan baris data murid
	let currentRowNum = 6;
	for (const m of params.daftarMurid) {
		const row = sheet.getRow(currentRowNum);
		const rowData: Array<string | number> = [m.id, m.no, m.nisn || m.nis || '', m.nama];

		for (const f of params.komponenFormatif) {
			const val = m.nilaiFormatif?.[f.kode];
			rowData.push(val != null ? val : '');
		}
		for (const s of params.komponenSumatif) {
			const val = m.nilaiSumatif?.[s.kode];
			rowData.push(val != null ? val : '');
		}
		if (params.adaStsTes) {
			rowData.push(m.stsTes != null ? m.stsTes : '');
		}
		if (params.adaStsNonTes) {
			rowData.push(m.stsNonTes != null ? m.stsNonTes : '');
		}
		rowData.push(m.catatanGuru || '');

		row.values = rowData;
		row.alignment = { vertical: 'middle' };
		// Format border halus
		row.eachCell((cell, colNumber) => {
			cell.border = {
				top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
				left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
				bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
				right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
			};
			if (colNumber === 2 || colNumber === 3) {
				cell.alignment = { vertical: 'middle', horizontal: 'center' };
			}
			if (colNumber >= 5 && colNumber < c - 1) {
				cell.alignment = { vertical: 'middle', horizontal: 'center' };
			}
		});

		currentRowNum++;
	}

	const buffer = await workbook.xlsx.writeBuffer();
	return Buffer.from(buffer as ArrayBuffer);
}

/**
 * Parsing file Excel yang diunggah guru
 */
export async function parseRtsExcel(
	fileBuffer: Buffer | ArrayBuffer,
	params: {
		komponenFormatif: RtsKomponenFormatifItem[];
		komponenSumatif: RtsKomponenSumatifItem[];
		adaStsTes: boolean;
		adaStsNonTes: boolean;
		daftarMuridKelas?: Array<{ id: number; nama: string; nisn?: string | null }>;
	}
): Promise<RtsNilaiInputItem[]> {
	const workbook = new ExcelJS.Workbook();
	const buf = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);
	await workbook.xlsx.load(buf);

	const sheet = workbook.worksheets[0];
	if (!sheet) throw new Error('Lembar kerja (sheet) tidak ditemukan di file Excel.');

	// Header ada di row 5
	const headerRow = sheet.getRow(5);
	const colMapping: Record<string, number> = {};

	headerRow.eachCell((cell, colNumber) => {
		const val = String(cell.value || '').trim();
		if (val.toLowerCase().includes('id')) {
			colMapping['id'] = colNumber;
		} else if (val.toLowerCase().includes('nama')) {
			colMapping['nama'] = colNumber;
		} else if (val.toLowerCase().includes('nisn')) {
			colMapping['nisn'] = colNumber;
		}

		for (const f of params.komponenFormatif) {
			if (val.includes(`[${f.kode}]`) || val.toLowerCase().startsWith(f.kode.toLowerCase())) {
				colMapping[`F_${f.kode}`] = colNumber;
			}
		}
		for (const s of params.komponenSumatif) {
			if (val.includes(`[${s.kode}]`) || val.toLowerCase().startsWith(s.kode.toLowerCase())) {
				colMapping[`S_${s.kode}`] = colNumber;
			}
		}
		if (val.toLowerCase().includes('sts tes')) {
			colMapping['stsTes'] = colNumber;
		} else if (val.toLowerCase().includes('sts non-tes')) {
			colMapping['stsNonTes'] = colNumber;
		} else if (val.toLowerCase().includes('catatan')) {
			colMapping['catatan'] = colNumber;
		}
	});

	const muridById = new Map((params.daftarMuridKelas || []).map((m) => [m.id, m]));
	const muridByNisn = new Map(
		(params.daftarMuridKelas || []).filter((m) => m.nisn?.trim()).map((m) => [m.nisn!.trim(), m])
	);
	const muridByNama = new Map(
		(params.daftarMuridKelas || [])
			.filter((m) => m.nama?.trim())
			.map((m) => [m.nama.trim().toLowerCase(), m])
	);

	const results: RtsNilaiInputItem[] = [];

	sheet.eachRow((row, rowNumber) => {
		if (rowNumber <= 5) return; // Lewati header

		const muridIdRaw = colMapping['id'] ? row.getCell(colMapping['id']).value : null;
		let muridId = Number(muridIdRaw);

		const namaVal = colMapping['nama']
			? String(row.getCell(colMapping['nama']).value || '').trim()
			: '';
		const nisnVal = colMapping['nisn']
			? String(row.getCell(colMapping['nisn']).value || '').trim()
			: '';

		if (params.daftarMuridKelas && params.daftarMuridKelas.length > 0) {
			if (!muridById.has(muridId)) {
				if (nisnVal && muridByNisn.has(nisnVal)) {
					muridId = muridByNisn.get(nisnVal)!.id;
				} else if (namaVal && muridByNama.has(namaVal.toLowerCase())) {
					muridId = muridByNama.get(namaVal.toLowerCase())!.id;
				}
			}
		}

		if (!Number.isInteger(muridId) || muridId <= 0) return;

		const nilaiFormatif: Record<string, number | null> = {};
		for (const f of params.komponenFormatif) {
			const cIdx = colMapping[`F_${f.kode}`];
			if (cIdx) {
				const val = row.getCell(cIdx).value;
				const num = Number(val);
				nilaiFormatif[f.kode] =
					val !== null && val !== '' && !Number.isNaN(num) && num >= 0 && num <= 100
						? Math.round(num * 100) / 100
						: null;
			}
		}

		const nilaiSumatif: Record<string, number | null> = {};
		for (const s of params.komponenSumatif) {
			const cIdx = colMapping[`S_${s.kode}`];
			if (cIdx) {
				const val = row.getCell(cIdx).value;
				const num = Number(val);
				nilaiSumatif[s.kode] =
					val !== null && val !== '' && !Number.isNaN(num) && num >= 0 && num <= 100
						? Math.round(num * 100) / 100
						: null;
			}
		}

		let stsTes: number | null = null;
		if (colMapping['stsTes']) {
			const val = row.getCell(colMapping['stsTes']).value;
			const num = Number(val);
			if (val !== null && val !== '' && !Number.isNaN(num) && num >= 0 && num <= 100) {
				stsTes = Math.round(num * 100) / 100;
			}
		}

		let stsNonTes: number | null = null;
		if (colMapping['stsNonTes']) {
			const val = row.getCell(colMapping['stsNonTes']).value;
			const num = Number(val);
			if (val !== null && val !== '' && !Number.isNaN(num) && num >= 0 && num <= 100) {
				stsNonTes = Math.round(num * 100) / 100;
			}
		}

		let catatanGuru: string | null = null;
		if (colMapping['catatan']) {
			const val = row.getCell(colMapping['catatan']).value;
			if (val) catatanGuru = String(val).trim();
		}

		results.push({
			muridId,
			nilaiFormatif,
			nilaiSumatif,
			stsTes,
			stsNonTes,
			catatanGuru
		});
	});

	return results;
}
