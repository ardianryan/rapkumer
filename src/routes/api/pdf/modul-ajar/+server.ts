import { error } from '@sveltejs/kit';
import db from '$lib/server/db';
import { getModulAjarById } from '$lib/server/db/modul-ajar-db';
import {
	tableAuthUser,
	tableKelas,
	tablePegawai,
	tableSekolah,
	tableSemester,
	tableTahunAjaran
} from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { renderPDF } from '$lib/server/pdf/pagedpdf';
import { renderModulAjarHTML } from '$lib/server/pdf/templates/modul-ajar';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => {
	const sekolahId = locals.sekolah?.id;
	const user = locals.user;

	if (!sekolahId || !user?.id) {
		throw error(401, 'Unauthorized');
	}

	const idParam = url.searchParams.get('id');
	const id = Number(idParam);
	if (!id) {
		throw error(400, 'Parameter id wajib diisi');
	}

	const modulAjar = await getModulAjarById(id, sekolahId);
	if (!modulAjar) {
		throw error(404, 'Modul ajar tidak ditemukan');
	}

	// Ambil data sekolah
	const sekolah = await db.query.tableSekolah.findFirst({
		where: eq(tableSekolah.id, sekolahId),
		columns: {
			nama: true,
			kepalaSekolahId: true,
			lokasiTandaTangan: true,
			statusKepalaSekolah: true
		}
	});

	// Ambil data kepala sekolah
	let kepalaSekolahNama = '';
	let kepalaSekolahNip: string | null = null;
	if (sekolah?.kepalaSekolahId) {
		const kepala = await db.query.tablePegawai.findFirst({
			where: eq(tablePegawai.id, sekolah.kepalaSekolahId),
			columns: { nama: true, nip: true }
		});
		kepalaSekolahNama = kepala?.nama ?? '';
		kepalaSekolahNip = kepala?.nip ?? null;
	}

	// Ambil data guru pembuat
	let guruNip: string | null = null;
	const guruUser = await db.query.tableAuthUser.findFirst({
		where: eq(tableAuthUser.id, modulAjar.authUserId),
		columns: { username: true, pegawaiId: true }
	});
	if (guruUser?.pegawaiId) {
		const peg = await db.query.tablePegawai.findFirst({
			where: eq(tablePegawai.id, guruUser.pegawaiId),
			columns: { nama: true, nip: true }
		});
		guruNip = peg?.nip ?? null;
	}

	// Ambil kelas, semester, tahun ajaran
	const kelas = await db.query.tableKelas.findFirst({
		where: eq(tableKelas.id, modulAjar.kelasId),
		columns: { nama: true, fase: true, tahunAjaranId: true, semesterId: true }
	});

	let tahunAjaranNama = '2024/2025';
	let semesterNama = 'Ganjil';
	if (kelas?.tahunAjaranId) {
		const ta = await db.query.tableTahunAjaran.findFirst({
			where: eq(tableTahunAjaran.id, kelas.tahunAjaranId),
			columns: { nama: true }
		});
		if (ta?.nama) tahunAjaranNama = ta.nama;
	}
	if (kelas?.semesterId) {
		const sem = await db.query.tableSemester.findFirst({
			where: eq(tableSemester.id, kelas.semesterId),
			columns: { nama: true }
		});
		if (sem?.nama) semesterNama = sem.nama;
	}

	const tempatTtd = sekolah?.lokasiTandaTangan || 'Tempat';
	const tanggalTtd = new Date().toLocaleDateString('id-ID', {
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	});

	const html = renderModulAjarHTML({
		identitas: {
			sekolah: sekolah?.nama || 'Sekolah',
			guru: modulAjar.guruNama || guruUser?.username || 'Guru Mata Pelajaran',
			nipGuru: guruNip,
			mataPelajaran: modulAjar.mapelNama || 'Mata Pelajaran',
			fase: kelas?.fase || 'E',
			kelas: modulAjar.kelasNama || kelas?.nama || 'X',
			semester: semesterNama,
			tahunPelajaran: tahunAjaranNama,
			materiPokok: modulAjar.materiPokok,
			alokasiWaktu: modulAjar.alokasiWaktu,
			jumlahPertemuan: modulAjar.jumlahPertemuan
		},
		konten: modulAjar.konten,
		kepalaSekolah: {
			nama: kepalaSekolahNama,
			nip: kepalaSekolahNip,
			statusKepalaSekolah: sekolah?.statusKepalaSekolah
		},
		ttd: {
			tempat: tempatTtd,
			tanggal: tanggalTtd
		}
	});

	const pdf = await renderPDF(html);
	const pdfBuffer = Buffer.from(pdf);
	const safeFilename = `Modul_Ajar_${modulAjar.materiPokok.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;

	return new Response(new Blob([pdfBuffer], { type: 'application/pdf' }), {
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': `inline; filename="${safeFilename}"`
		}
	});
};
