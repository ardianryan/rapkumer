import db from '$lib/server/db';
import { tableKelas, tableMurid } from '$lib/server/db/schema';
import { and, asc, eq } from 'drizzle-orm';
import { getRaporSisipanDataForStudent } from '$lib/server/pdf/rapor-sisipan-preview';
import { renderRaporSisipanHTML } from '$lib/server/pdf/templates/rapor-sisipan';
import { isWaliOfKelas } from '$lib/server/kelas-akses';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, url, locals }) => {
	if (!locals.user) {
		throw redirect(303, '/login');
	}

	const { kelasAktif, daftarKelas, user: parentUser } = await parent();
	const user = parentUser ?? locals.user;
	const typedUser = user as {
		type?: string;
		id?: number;
		pegawaiId?: number | null;
		kelasId?: number | null;
		ownKelasIds?: number[] | null;
	};

	// Hanya wali kelas, kepala sekolah, atau admin yang berhak mencetak rapor
	if (
		typedUser.type !== 'admin' &&
		typedUser.type !== 'kepala_sekolah' &&
		typedUser.type !== 'wali_kelas'
	) {
		throw redirect(303, '/forbidden?required=wali_kelas');
	}

	const sekolah = locals.sekolah;
	const meta: PageMeta = { title: 'Cetak Rapor Sisipan (STS)' };

	if (!sekolah?.id) {
		return {
			meta,
			kelas: null,
			daftarKelas: [],
			muridList: [],
			selectedMuridId: null,
			previewHtml: null,
			studentMapelNotes: []
		};
	}

	// Filter daftar kelas agar wali kelas hanya melihat kelas binaannya sendiri
	const filteredDaftarKelas =
		typedUser.type === 'admin' || typedUser.type === 'kepala_sekolah'
			? (daftarKelas ?? [])
			: (daftarKelas ?? []).filter(
					(k) =>
						k.id === typedUser.kelasId ||
						typedUser.ownKelasIds?.includes(k.id) ||
						(typedUser.pegawaiId && k.waliKelas?.id === typedUser.pegawaiId)
				);

	const requestedKelasId = Number(url.searchParams.get('kelas_id'));
	const targetKelasId =
		requestedKelasId ||
		(typedUser.type === 'wali_kelas'
			? (typedUser.kelasId ?? filteredDaftarKelas[0]?.id ?? null)
			: (kelasAktif?.id ?? null));

	if (!targetKelasId) {
		return {
			meta,
			kelas: null,
			daftarKelas: filteredDaftarKelas,
			muridList: [],
			selectedMuridId: null,
			previewHtml: null,
			studentMapelNotes: []
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
			daftarKelas: filteredDaftarKelas,
			muridList: [],
			selectedMuridId: null,
			previewHtml: null,
			studentMapelNotes: []
		};
	}

	// Pastikan bila wali_kelas, memang wali dari kelas target ini
	const isWaliKelasOwn =
		typedUser.type === 'wali_kelas' &&
		(typedUser.kelasId === kelas.id ||
			typedUser.ownKelasIds?.includes(kelas.id) ||
			kelas.waliKelasId === typedUser.pegawaiId ||
			(await isWaliOfKelas(typedUser, kelas.id)));
	const isAllowed =
		typedUser.type === 'admin' || typedUser.type === 'kepala_sekolah' || isWaliKelasOwn;

	if (!isAllowed) {
		throw redirect(303, '/forbidden?required=wali_kelas');
	}

	const muridListRaw = await db.query.tableMurid.findMany({
		where: eq(tableMurid.kelasId, kelas.id),
		orderBy: asc(tableMurid.nama)
	});
	const muridList = muridListRaw.sort((a, b) =>
		a.nama.localeCompare(b.nama, 'id', { sensitivity: 'base' })
	);

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
