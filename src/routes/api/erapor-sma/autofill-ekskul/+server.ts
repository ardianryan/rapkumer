import db from '$lib/server/db';
import {
	tableAsesmenEkstrakurikuler,
	tableEkstrakurikuler,
	tableEkstrakurikulerTujuan,
	tableKelas,
	tableMurid
} from '$lib/server/db/schema';
import {
	buildEkstrakurikulerDeskripsi,
	type EkstrakurikulerNilaiKategori
} from '$lib/ekstrakurikuler';
import { json, type RequestHandler } from '@sveltejs/kit';
import ExcelJS from 'exceljs';
import { eq, inArray } from 'drizzle-orm';

const scoreMap: Record<string, number> = {
	'sangat-baik': 4,
	baik: 3,
	cukup: 2,
	'perlu-bimbingan': 1
};

const defaultDescByScore: Record<number, string> = {
	4: 'Menunjukkan partisipasi dan penguasaan yang sangat baik dalam kegiatan ekstrakurikuler.',
	3: 'Menunjukkan partisipasi dan penguasaan yang baik dalam kegiatan ekstrakurikuler.',
	2: 'Menunjukkan partisipasi yang cukup dalam kegiatan ekstrakurikuler.',
	1: 'Perlu bimbingan dan peningkatan keaktifan dalam kegiatan ekstrakurikuler.'
};

function normalizeText(val: unknown): string {
	return String(val ?? '')
		.trim()
		.toLowerCase();
}

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const sekolahId = locals.sekolah?.id;
		if (!sekolahId) {
			return json({ error: 'Sesi sekolah tidak aktif.' }, { status: 401 });
		}

		const formData = await request.formData();
		const file = formData.get('file') as File | null;

		if (!file || !(file instanceof File)) {
			return json({ error: 'File Excel template tidak ditemukan.' }, { status: 400 });
		}

		const fileBuffer = await file.arrayBuffer();
		const wb = new ExcelJS.Workbook();
		await wb.xlsx.load(Buffer.from(fileBuffer));

		const ws = wb.worksheets[0];
		if (!ws) {
			return json({ error: 'Sheet di dalam template Excel kosong.' }, { status: 400 });
		}

		// Cari baris header (biasanya baris 3)
		let headerRowIndex = 3;
		let colPesertaDidikId = 6;
		let colNisn = 9;
		let colNamaSiswa = 2;
		let colNamaEkskul = 11;
		let colNilai = 12;
		let colDeskripsi = 13;

		// Deteksi kolom secara dinamis dari baris 3 (atau baris lain jika bergeser)
		for (let r = 1; r <= Math.min(10, ws.rowCount); r++) {
			const row = ws.getRow(r);
			let foundEkskulHeader = false;

			for (let c = 1; c <= ws.columnCount; c++) {
				const headerText = normalizeText(row.getCell(c).value);
				if (headerText.includes('peserta_didik_id')) colPesertaDidikId = c;
				else if (headerText === 'nisn') colNisn = c;
				else if (headerText.includes('nama siswa')) colNamaSiswa = c;
				else if (headerText.includes('nama ekskul') || headerText === 'ekskul') {
					colNamaEkskul = c;
					foundEkskulHeader = true;
				} else if (headerText === 'nilai') colNilai = c;
				else if (headerText === 'deskripsi') colDeskripsi = c;
			}

			if (foundEkskulHeader) {
				headerRowIndex = r;
				break;
			}
		}

		// Ambil seluruh data murid, ekskul, tujuan, dan asesmen dari sekolah aktif
		const muridRows = await db.query.tableMurid.findMany({
			where: eq(tableMurid.sekolahId, sekolahId),
			columns: {
				id: true,
				nisn: true,
				nama: true,
				dapodikPesertaDidikId: true,
				kelasId: true
			}
		});

		const kelasRows = await db.query.tableKelas.findMany({
			where: eq(tableKelas.sekolahId, sekolahId),
			columns: { id: true }
		});
		const kelasIds = kelasRows.map((k) => k.id);

		const ekskulRows = kelasIds.length
			? await db.query.tableEkstrakurikuler.findMany({
					where: inArray(tableEkstrakurikuler.kelasId, kelasIds)
				})
			: [];

		const ekskulIds = ekskulRows.map((e) => e.id);

		const tujuanRows = ekskulIds.length
			? await db.query.tableEkstrakurikulerTujuan.findMany({
					where: inArray(tableEkstrakurikulerTujuan.ekstrakurikulerId, ekskulIds)
				})
			: [];

		const asesmenRows = ekskulIds.length
			? await db.query.tableAsesmenEkstrakurikuler.findMany({
					where: inArray(tableAsesmenEkstrakurikuler.ekstrakurikulerId, ekskulIds)
				})
			: [];

		// Map indexes
		const muridByUuid = new Map(
			muridRows.filter((m) => m.dapodikPesertaDidikId).map((m) => [m.dapodikPesertaDidikId!, m])
		);
		const muridByNisn = new Map(muridRows.filter((m) => m.nisn).map((m) => [m.nisn.trim(), m]));
		const muridByNama = new Map(muridRows.map((m) => [normalizeText(m.nama), m]));

		const ekskulByName = new Map<string, typeof ekskulRows>();
		for (const e of ekskulRows) {
			const key = normalizeText(e.nama);
			const list = ekskulByName.get(key) ?? [];
			list.push(e);
			ekskulByName.set(key, list);
		}

		const tujuanById = new Map(tujuanRows.map((t) => [t.id, t]));

		const asesmenByMuridAndEkskul = new Map<string, typeof asesmenRows>();
		for (const a of asesmenRows) {
			const key = `${a.muridId}|${a.ekstrakurikulerId}`;
			const list = asesmenByMuridAndEkskul.get(key) ?? [];
			list.push(a);
			asesmenByMuridAndEkskul.set(key, list);
		}

		let filledCount = 0;

		// Iterasi tiap baris data siswa mulai setelah baris header
		for (let r = headerRowIndex + 1; r <= ws.rowCount; r++) {
			const row = ws.getRow(r);
			const pesertaDidikId = row.getCell(colPesertaDidikId).value?.toString().trim();
			const nisn = row.getCell(colNisn).value?.toString().trim();
			const nama = normalizeText(row.getCell(colNamaSiswa).value);
			const namaEkskul = normalizeText(row.getCell(colNamaEkskul).value);

			if (!nama && !nisn && !pesertaDidikId) continue;
			if (!namaEkskul) continue;

			// Cocokkan murid
			const matchedMurid =
				(pesertaDidikId ? muridByUuid.get(pesertaDidikId) : null) ??
				(nisn ? muridByNisn.get(nisn) : null) ??
				(nama ? muridByNama.get(nama) : null);

			if (!matchedMurid) continue;

			// Cocokkan ekskul
			const matchedEkskulList = ekskulByName.get(namaEkskul);
			if (!matchedEkskulList || matchedEkskulList.length === 0) continue;

			// Utamakan ekskul yang kelasnya sesuai dengan kelas murid
			const targetEkskul =
				matchedEkskulList.find((e) => e.kelasId === matchedMurid.kelasId) ?? matchedEkskulList[0];

			const assessments =
				asesmenByMuridAndEkskul.get(`${matchedMurid.id}|${targetEkskul.id}`) ?? [];
			if (assessments.length === 0) continue;

			// Konversi predikat asesmen ke angka 1..4
			const scoreNums = assessments
				.map((a) => scoreMap[a.kategori])
				.filter((n): n is number => typeof n === 'number');

			if (scoreNums.length > 0) {
				const avgScore = Math.max(
					1,
					Math.min(4, Math.round(scoreNums.reduce((a, b) => a + b, 0) / scoreNums.length))
				);
				row.getCell(colNilai).value = avgScore;

				// Buat kalimat deskripsi otomatis
				const parts = assessments.map((a) => {
					const tujuan = tujuanById.get(a.tujuanId);
					return {
						kategori: a.kategori as EkstrakurikulerNilaiKategori,
						tujuan: tujuan?.deskripsi ?? ''
					};
				});

				const deskripsi = buildEkstrakurikulerDeskripsi(parts, matchedMurid.nama);
				row.getCell(colDeskripsi).value = deskripsi || defaultDescByScore[avgScore] || '';

				filledCount++;
			}
		}

		// Kembalikan file Excel terisi
		const outputBuffer = await wb.xlsx.writeBuffer();
		const originalName = file.name.replace(/\.[^/.]+$/, '');
		const exportFilename = `${originalName}_terisi.xlsx`;

		return new Response(outputBuffer as unknown as BodyInit, {
			headers: {
				'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
				'Content-Disposition': `attachment; filename="${exportFilename}"`,
				'X-Filled-Count': String(filledCount)
			}
		});
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		console.error('[autofill-ekskul] Error:', message);
		return json(
			{ error: `Gagal memproses Auto-Fill e-Rapor Ekstrakurikuler: ${message}` },
			{ status: 500 }
		);
	}
};
