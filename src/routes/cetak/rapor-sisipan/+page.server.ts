import db from '$lib/server/db';
import { tableKelas, tableMurid } from '$lib/server/db/schema';
import { and, asc, eq } from 'drizzle-orm';
import { getRaporSisipanDataForStudent } from '$lib/server/pdf/rapor-sisipan-preview';
import { renderRaporSisipanHTML } from '$lib/server/pdf/templates/rapor-sisipan';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, url, locals }) => {
	const { kelasAktif, daftarKelas } = await parent();
	const sekolah = locals.sekolah;
	const meta: PageMeta = { title: 'Cetak Rapor Sisipan (STS)' };

	if (!sekolah?.id) {
		return {
			meta,
			kelas: null,
			daftarKelas: [],
			muridList: [],
			selectedMuridId: null,
			previewHtml: null
		};
	}

	const requestedKelasId = Number(url.searchParams.get('kelas_id'));
	const targetKelasId = requestedKelasId || (kelasAktif?.id ?? null);

	if (!targetKelasId) {
		return {
			meta,
			kelas: null,
			daftarKelas: daftarKelas ?? [],
			muridList: [],
			selectedMuridId: null,
			previewHtml: null
		};
	}

	const kelas = await db.query.tableKelas.findFirst({
		where: and(eq(tableKelas.id, targetKelasId), eq(tableKelas.sekolahId, sekolah.id)),
		with: { waliKelas: true }
	});

	if (!kelas) {
		return {
			meta,
			kelas: null,
			daftarKelas: daftarKelas ?? [],
			muridList: [],
			selectedMuridId: null,
			previewHtml: null
		};
	}

	const muridList = await db.query.tableMurid.findMany({
		where: eq(tableMurid.kelasId, kelas.id),
		orderBy: asc(tableMurid.nama)
	});

	const requestedMuridId = Number(url.searchParams.get('murid_id'));
	const selectedMuridId =
		requestedMuridId && muridList.some((m) => m.id === requestedMuridId)
			? requestedMuridId
			: (muridList[0]?.id ?? null);

	let previewHtml: string | null = null;
	let studentMapelNotes: Array<{ mataPelajaran: string; catatan: string }> = [];
	if (selectedMuridId) {
		try {
			const studentData = await getRaporSisipanDataForStudent({
				sekolahId: sekolah.id,
				kelasId: kelas.id,
				muridId: selectedMuridId
			});
			previewHtml = renderRaporSisipanHTML(studentData);
			studentMapelNotes = studentData.mapelList
				.filter((m) => Boolean(m.catatanGuru && m.catatanGuru.trim().length > 0))
				.map((m) => ({
					mataPelajaran: m.mataPelajaran,
					catatan: m.catatanGuru!
				}));
		} catch (err) {
			console.error('Error generating preview HTML:', err);
		}
	}

	return {
		meta,
		kelas: {
			id: kelas.id,
			nama: kelas.nama,
			fase: kelas.fase,
			waliKelasNama: kelas.waliKelas?.nama ?? null
		},
		daftarKelas: daftarKelas ?? [],
		muridList: muridList.map((m, idx) => ({
			id: m.id,
			no: idx + 1,
			nama: m.nama,
			nisn: m.nisn
		})),
		selectedMuridId,
		previewHtml,
		studentMapelNotes
	};
};
