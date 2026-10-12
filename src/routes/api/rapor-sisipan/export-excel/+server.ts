import { error, type RequestHandler } from '@sveltejs/kit';
import db from '$lib/server/db';
import { tableKelas, tableMataPelajaran, tableMurid } from '$lib/server/db/schema';
import { and, asc, eq } from 'drizzle-orm';
import { getRtsSetup, getRtsNilaiList } from '$lib/server/rapor-sisipan/rts-service';
import { generateRtsExcelTemplate } from '$lib/server/rapor-sisipan/excel';

export const GET: RequestHandler = async ({ url, locals }) => {
	const user = locals.user;
	if (!user) throw error(401, 'Tidak terotentikasi');

	const sekolah = locals.sekolah;
	if (!sekolah?.id) throw error(400, 'Sekolah tidak ditemukan');

	const kelasId = Number(url.searchParams.get('kelasId'));
	const mataPelajaranId = Number(url.searchParams.get('mapelId'));

	if (!kelasId || !mataPelajaranId) {
		throw error(400, 'Parameter kelasId dan mapelId wajib disertakan');
	}

	const kelas = await db.query.tableKelas.findFirst({
		where: and(eq(tableKelas.id, kelasId), eq(tableKelas.sekolahId, sekolah.id))
	});
	if (!kelas) throw error(404, 'Kelas tidak ditemukan');

	const mapel = await db.query.tableMataPelajaran.findFirst({
		where: and(eq(tableMataPelajaran.id, mataPelajaranId), eq(tableMataPelajaran.kelasId, kelasId))
	});
	if (!mapel) throw error(404, 'Mata pelajaran tidak ditemukan');

	const setup = await getRtsSetup(kelasId, mataPelajaranId);
	if (!setup || setup.komponenFormatif.length === 0 || setup.komponenSumatif.length === 0) {
		throw error(
			400,
			'Harap lakukan pengaturan komponen asesmen terlebih dahulu sebelum mengunduh format Excel.'
		);
	}

	const muridListRaw = await db.query.tableMurid.findMany({
		where: eq(tableMurid.kelasId, kelasId),
		orderBy: asc(tableMurid.nama)
	});
	const muridList = muridListRaw.sort((a, b) =>
		a.nama.localeCompare(b.nama, 'id', { sensitivity: 'base' })
	);

	const nilaiList = await getRtsNilaiList(kelasId, mataPelajaranId);
	const nilaiMap = new Map(nilaiList.map((n) => [n.muridId, n]));

	const daftarMurid = muridList.map((m, idx) => {
		const n = nilaiMap.get(m.id);
		return {
			id: m.id,
			no: idx + 1,
			nama: m.nama,
			nisn: m.nisn,
			nis: m.nis,
			nilaiFormatif: (n?.nilaiFormatif as Record<string, number | null>) || null,
			nilaiSumatif: (n?.nilaiSumatif as Record<string, number | null>) || null,
			stsTes: n?.stsTes ?? null,
			stsNonTes: n?.stsNonTes ?? null,
			catatanGuru: n?.catatanGuru ?? null
		};
	});

	const buffer = await generateRtsExcelTemplate({
		namaSekolah: sekolah.nama,
		namaKelas: kelas.nama,
		namaMapel: mapel.namaLokal?.trim() || mapel.nama,
		komponenFormatif: setup.komponenFormatif,
		komponenSumatif: setup.komponenSumatif,
		adaStsTes: setup.adaStsTes,
		adaStsNonTes: setup.adaStsNonTes,
		daftarMurid
	});

	const safeKelas = kelas.nama.replace(/[^a-zA-Z0-9_-]/g, '_');
	const safeMapel = (mapel.namaLokal || mapel.nama).replace(/[^a-zA-Z0-9_-]/g, '_');
	const filename = `Nilai_STS_${safeKelas}_${safeMapel}.xlsx`;

	return new Response(buffer as unknown as BodyInit, {
		headers: {
			'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'Content-Disposition': `attachment; filename="${filename}"`
		}
	});
};
