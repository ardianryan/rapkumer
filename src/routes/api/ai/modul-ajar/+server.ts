import { json } from '@sveltejs/kit';
import db from '$lib/server/db';
import {
	tableKelas,
	tableMataPelajaran,
	tablePegawai,
	tableSekolah,
	tableSemester,
	tableTahunAjaran,
	tableTujuanPembelajaran
} from '$lib/server/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { generateModulAjarContent } from '$lib/server/ai-modul-ajar';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user) {
		return json({ error: 'Tidak terotentikasi' }, { status: 401 });
	}

	const sekolah = locals.sekolah;
	if (!sekolah?.id) {
		return json({ error: 'Sekolah belum dipilih' }, { status: 400 });
	}

	let body: {
		mapelId?: number;
		kelasId?: number;
		materiPokok?: string;
		alokasiWaktu?: string;
		jumlahPertemuan?: string;
		modelPembelajaran?: string;
		dimensiProfil?: string[];
		tujuanPembelajaranIds?: number[];
	};

	try {
		body = await request.json();
	} catch {
		return json({ error: 'Payload tidak valid' }, { status: 400 });
	}

	const {
		mapelId,
		kelasId,
		materiPokok,
		alokasiWaktu = '2 x 45 Menit',
		jumlahPertemuan = 'Pertemuan Ke-1 dari 2 Pertemuan',
		modelPembelajaran = 'Problem-Based Learning',
		dimensiProfil = ['Penalaran Kritis', 'Kreativitas', 'Kolaborasi'],
		tujuanPembelajaranIds = []
	} = body;

	if (!mapelId || !kelasId || !materiPokok?.trim()) {
		return json(
			{ error: 'Mata pelajaran, kelas, dan materi pokok/topik wajib diisi.' },
			{ status: 400 }
		);
	}

	// Ambil data sekolah
	const sekolahRow = await db.query.tableSekolah.findFirst({
		where: eq(tableSekolah.id, sekolah.id),
		columns: { nama: true }
	});

	// Ambil data kelas
	const kelasRow = await db.query.tableKelas.findFirst({
		where: eq(tableKelas.id, kelasId),
		columns: {
			nama: true,
			fase: true,
			tahunAjaranId: true,
			semesterId: true
		}
	});

	// Ambil data mapel
	const mapelRow = await db.query.tableMataPelajaran.findFirst({
		where: eq(tableMataPelajaran.id, mapelId),
		columns: { nama: true }
	});

	if (!mapelRow || !kelasRow) {
		return json({ error: 'Data kelas atau mata pelajaran tidak ditemukan.' }, { status: 404 });
	}

	// Ambil nama tahun ajaran & semester
	let tahunAjaranNama = '2024/2025';
	let semesterNama = 'Ganjil';
	if (kelasRow.tahunAjaranId) {
		const ta = await db.query.tableTahunAjaran.findFirst({
			where: eq(tableTahunAjaran.id, kelasRow.tahunAjaranId),
			columns: { nama: true }
		});
		if (ta?.nama) tahunAjaranNama = ta.nama;
	}
	if (kelasRow.semesterId) {
		const sem = await db.query.tableSemester.findFirst({
			where: eq(tableSemester.id, kelasRow.semesterId),
			columns: { nama: true }
		});
		if (sem?.nama) semesterNama = sem.nama;
	}

	// Ambil capaian dan tujuan pembelajaran jika ada
	let tujuanPembelajaranList: string[] = [];
	if (tujuanPembelajaranIds.length > 0) {
		const tpRows = await db.query.tableTujuanPembelajaran.findMany({
			where: inArray(tableTujuanPembelajaran.id, tujuanPembelajaranIds),
			columns: { deskripsi: true }
		});
		tujuanPembelajaranList = tpRows.map((t) => t.deskripsi).filter(Boolean);
	}

	try {
		let guruNama = user.username || 'Guru Mata Pelajaran';
		if (user.pegawaiId) {
			const peg = await db.query.tablePegawai.findFirst({
				where: eq(tablePegawai.id, user.pegawaiId),
				columns: { nama: true }
			});
			if (peg?.nama) guruNama = peg.nama;
		}

		const konten = await generateModulAjarContent({
			user: { id: user.id, type: user.type },
			sekolahNama: sekolahRow?.nama || 'SMA Negeri',
			guruNama,
			mapelNama: mapelRow.nama || 'Mata Pelajaran',
			fase: kelasRow.fase || 'E',
			tingkat: kelasRow.nama || 'X',
			semester: semesterNama,
			tahunAjaran: tahunAjaranNama,
			materiPokok: materiPokok.trim(),
			alokasiWaktu: alokasiWaktu.trim(),
			jumlahPertemuan: jumlahPertemuan.trim(),
			modelPembelajaran: modelPembelajaran.trim(),
			dimensiProfil: Array.isArray(dimensiProfil) ? dimensiProfil : [],
			capaianPembelajaran: '',
			tujuanPembelajaranList
		});

		return json({ success: true, konten });
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : 'Gagal menghasilkan modul ajar dengan AI.';
		console.error('[API /api/ai/modul-ajar] Error:', err);
		return json({ error: msg }, { status: 500 });
	}
};
