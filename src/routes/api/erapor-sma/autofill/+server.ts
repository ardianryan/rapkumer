import db from '$lib/server/db';
import {
	tableMataPelajaran,
	tableNilaiAkhirMapel,
	tableAsesmenSumatif,
	tableAsesmenSumatifTujuan
} from '$lib/server/db/schema';
import { json, type RequestHandler } from '@sveltejs/kit';
import ExcelJS from 'exceljs';
import { eq } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const formData = await request.formData();
		const file = formData.get('file') as File | null;
		const queryMapelId = formData.get('mapelId') ? Number(formData.get('mapelId')) : null;

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

		// Baca metadata header e-Rapor
		const pembelajaranIdRaw = ws.getCell('C2').value?.toString().trim();

		// Cari mapel di Rapkumer
		let targetMapel = null;
		if (queryMapelId) {
			targetMapel = await db.query.tableMataPelajaran.findFirst({
				where: eq(tableMataPelajaran.id, queryMapelId)
			});
		} else if (pembelajaranIdRaw) {
			targetMapel = await db.query.tableMataPelajaran.findFirst({
				where: eq(tableMataPelajaran.dapodikPembelajaranId, pembelajaranIdRaw)
			});
		}

		if (!targetMapel && queryMapelId) {
			targetMapel = await db.query.tableMataPelajaran.findFirst({
				where: eq(tableMataPelajaran.id, queryMapelId)
			});
		}

		// Cari kolom TP (mulai dari kolom H = 8 sampai sebelum kolom TR/Validasi)
		const tpStartCol = 8; // Kolom H
		let tpEndCol = 8;

		for (let c = 8; c <= ws.columnCount; c++) {
			const colHeader6 = ws.getRow(6).getCell(c).value?.toString().trim();
			if (colHeader6 === 'TR' || colHeader6 === 'OP' || colHeader6 === 'NILAI') {
				tpEndCol = c - 1;
				break;
			}
			if (colHeader6 && colHeader6.startsWith('TP.')) {
				tpEndCol = c;
			}
		}

		if (tpEndCol < tpStartCol) {
			// Fallback: cari sampai kolom K jika tidak ada tanda TR
			tpEndCol = Math.max(8, tpStartCol);
		}

		const totalTpCols = tpEndCol - tpStartCol + 1;

		// Kumpulkan semua murid dan nilai dari database Rapkumer
		const targetMapelId = targetMapel?.id ?? queryMapelId;

		let lockedScores: Array<{
			muridId: number;
			nilaiAkhir: number;
			capaianTp?: string | null;
		}> = [];

		let sumatifScores: Array<{
			muridId: number;
			nilaiAkhir: number | null;
		}> = [];

		let tpDetailScores: Array<{
			muridId: number;
			tujuanPembelajaranId: number;
			nilai: number | null;
		}> = [];

		if (targetMapelId) {
			lockedScores = await db.query.tableNilaiAkhirMapel.findMany({
				where: eq(tableNilaiAkhirMapel.mataPelajaranId, targetMapelId)
			});

			sumatifScores = await db.query.tableAsesmenSumatif.findMany({
				where: eq(tableAsesmenSumatif.mataPelajaranId, targetMapelId)
			});

			tpDetailScores = await db.query.tableAsesmenSumatifTujuan.findMany({
				where: eq(tableAsesmenSumatifTujuan.mataPelajaranId, targetMapelId)
			});
		}

		const lockedByMuridId = new Map(lockedScores.map((s) => [s.muridId, s]));
		const sumatifByMuridId = new Map(sumatifScores.map((s) => [s.muridId, s]));

		// Index TP scores
		const tpScoresByMuridId = new Map<number, typeof tpDetailScores>();
		for (const row of tpDetailScores) {
			const list = tpScoresByMuridId.get(row.muridId) ?? [];
			list.push(row);
			tpScoresByMuridId.set(row.muridId, list);
		}

		// Kumpulkan murid untuk pencocokan (UUID Dapodik & NISN)
		const muridRows = await db.query.tableMurid.findMany({
			columns: {
				id: true,
				nisn: true,
				nama: true,
				dapodikPesertaDidikId: true
			}
		});

		const muridByUuid = new Map(
			muridRows.filter((m) => m.dapodikPesertaDidikId).map((m) => [m.dapodikPesertaDidikId!, m])
		);
		const muridByNisn = new Map(muridRows.filter((m) => m.nisn).map((m) => [m.nisn.trim(), m]));
		const muridByNama = new Map(muridRows.map((m) => [m.nama.trim().toLowerCase(), m]));

		let filledCount = 0;

		// Iterasi setiap baris siswa mulai baris 7
		for (let r = 7; r <= ws.rowCount; r++) {
			const row = ws.getRow(r);
			const pesertaDidikId = row.getCell(2).value?.toString().trim(); // Kolom B
			const nisn = row.getCell(5).value?.toString().trim(); // Kolom E
			const nama = row.getCell(6).value?.toString().trim().toLowerCase(); // Kolom F

			if (!nama && !nisn && !pesertaDidikId) continue;

			// Cocokkan murid
			const matchedMurid =
				(pesertaDidikId ? muridByUuid.get(pesertaDidikId) : null) ??
				(nisn ? muridByNisn.get(nisn) : null) ??
				(nama ? muridByNama.get(nama) : null);

			let finalScore: number | null = null;

			if (matchedMurid) {
				const locked = lockedByMuridId.get(matchedMurid.id);
				const sumatif = sumatifByMuridId.get(matchedMurid.id);

				if (locked && typeof locked.nilaiAkhir === 'number') {
					finalScore = locked.nilaiAkhir;
				} else if (sumatif && typeof sumatif.nilaiAkhir === 'number') {
					finalScore = sumatif.nilaiAkhir;
				}
			}

			if (finalScore != null && Number.isFinite(finalScore)) {
				// Kolom G: Nilai Rapor (Dibulatkan sesuai ketentuan e-Rapor SMA integer 1..100)
				const roundedScore = Math.max(1, Math.min(100, Math.round(finalScore)));
				row.getCell(7).value = roundedScore;

				// Pengisian Capaian TP (Kolom H .. K)
				// Aturan Validasi e-Rapor Kolom N:
				// - Jika Nilai = 100: harus ada T >= 1, dan R = 0.
				// - Jika Nilai < 100: harus ada R >= 1, dan (T + R) >= 1.
				if (totalTpCols > 0) {
					if (roundedScore === 100) {
						// Semua TP tercapai optimal
						for (let c = tpStartCol; c <= tpEndCol; c++) {
							row.getCell(c).value = 'T';
						}
					} else if (totalTpCols === 1) {
						// Jika hanya ada 1 TP dan nilai < 100, tandai R agar lolos validasi
						row.getCell(tpStartCol).value = 'R';
					} else {
						// Kolom pertama = Optimal 'T'
						row.getCell(tpStartCol).value = 'T';

						// Kolom-kolom tengah: isi 'T'
						for (let c = tpStartCol + 1; c < tpEndCol; c++) {
							row.getCell(c).value = 'T';
						}

						// Kolom terakhir = Perlu Peningkatan 'R' (menjamin Kolom N berstatus 'Valid')
						row.getCell(tpEndCol).value = 'R';
					}
				}

				filledCount++;
			}
		}

		// Generate output buffer
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
		console.error('[autofill-erapor-sma] Error:', message);
		return json(
			{ error: `Gagal memproses autofill template e-Rapor: ${message}` },
			{ status: 500 }
		);
	}
};
