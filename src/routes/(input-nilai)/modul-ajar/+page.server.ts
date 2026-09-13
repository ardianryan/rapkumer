import db from '$lib/server/db';
import { ensureModulAjarSchema } from '$lib/server/db/ensure-modul-ajar';
import {
	listModulAjar,
	getModulAjarById,
	insertModulAjar,
	updateModulAjar,
	deleteModulAjar
} from '$lib/server/db/modul-ajar-db';
import { tableKelas, tableMataPelajaran, tableTujuanPembelajaran } from '$lib/server/db/schema';
import { fail, redirect } from '@sveltejs/kit';
import { eq, inArray } from 'drizzle-orm';
import { buildKelasContext } from '$lib/server/route-utils';
import { getAksesMapelUser, needsMapelFilter } from '$lib/server/mapel-access';
import type { PageServerLoad, Actions } from './$types';
import type { ModulAjarKonten } from '$lib/server/ai-modul-ajar';

export const load: PageServerLoad = async ({ locals, url, depends, parent }) => {
	depends('app:modul-ajar');
	await ensureModulAjarSchema();

	const parentData = await parent();
	const { sekolahId, kelasId, kelasIds, academicContext } = await buildKelasContext(
		locals,
		parentData,
		url
	);

	const user = locals.user;
	if (!user?.id) {
		throw redirect(302, '/login');
	}

	if (!sekolahId || !kelasIds.length) {
		return {
			meta: { title: 'Modul Ajar' },
			academicContext,
			daftarModulAjar: [],
			mataPelajaranList: [],
			tujuanPembelajaranList: [],
			selectedKelasId: null
		};
	}

	const selectedKelasId = Number(kelasId || kelasIds[0]);

	// Ambil daftar mapel di kelas terpilih
	const mapelRows = await db
		.select({
			id: tableMataPelajaran.id,
			nama: tableMataPelajaran.nama,
			kode: tableMataPelajaran.kode
		})
		.from(tableMataPelajaran)
		.where(eq(tableMataPelajaran.kelasId, selectedKelasId));

	// Filter mapel untuk guru yang dibatasi
	let mataPelajaranList = mapelRows;
	if (needsMapelFilter(user, selectedKelasId)) {
		const akses = await getAksesMapelUser(
			{
				id: user.id,
				mataPelajaranId: user.mataPelajaranId
			},
			selectedKelasId
		);
		mataPelajaranList = mapelRows.filter(
			(m) => akses.ids.has(m.id) || (m.nama && akses.names.has(m.nama.trim().toLowerCase()))
		);
	}

	// Ambil tujuan pembelajaran untuk mapel-mapel tersebut
	const mapelIds = mataPelajaranList.map((m) => m.id);
	const tujuanPembelajaranList =
		mapelIds.length > 0
			? await db
					.select({
						id: tableTujuanPembelajaran.id,
						mataPelajaranId: tableTujuanPembelajaran.mataPelajaranId,
						deskripsi: tableTujuanPembelajaran.deskripsi,
						lingkupMateri: tableTujuanPembelajaran.lingkupMateri
					})
					.from(tableTujuanPembelajaran)
					.where(inArray(tableTujuanPembelajaran.mataPelajaranId, mapelIds))
			: [];

	// Ambil daftar modul ajar
	const isAdmin = user.type === 'admin' || user.type === 'kepala_sekolah';
	const daftarModulAjar = await listModulAjar({
		sekolahId,
		kelasId: selectedKelasId,
		authUserId: isAdmin ? null : user.id
	});

	// Ambil data kelas aktif untuk referensi fase dan tingkat
	const activeKelas = await db.query.tableKelas.findFirst({
		where: eq(tableKelas.id, selectedKelasId),
		columns: { nama: true, fase: true }
	});

	return {
		meta: { title: 'Modul Ajar Pembelajaran Mendalam' },
		academicContext,
		daftarModulAjar,
		mataPelajaranList,
		tujuanPembelajaranList,
		selectedKelasId,
		activeKelas
	};
};

export const actions: Actions = {
	simpan: async ({ request, locals }) => {
		const user = locals.user;
		const sekolahId = locals.sekolah?.id;
		if (!user || !sekolahId) {
			return fail(401, { message: 'Tidak terotentikasi' });
		}

		const formData = await request.formData();
		const id = Number(formData.get('id')) || 0;
		const kelasId = Number(formData.get('kelasId'));
		const mataPelajaranId = Number(formData.get('mataPelajaranId'));
		const materiPokok = String(formData.get('materiPokok') || '').trim();
		const alokasiWaktu = String(formData.get('alokasiWaktu') || '2 x 45 Menit').trim();
		const jumlahPertemuan = String(
			formData.get('jumlahPertemuan') || 'Pertemuan Ke-1 dari 2 Pertemuan'
		).trim();
		const modelPembelajaran = String(
			formData.get('modelPembelajaran') || 'Problem-Based Learning'
		).trim();
		const status = (formData.get('status') as 'draf' | 'final') || 'draf';

		const dimensiProfilRaw = String(formData.get('dimensiProfil') || '[]');
		const tpIdsRaw = String(formData.get('tujuanPembelajaranIds') || '[]');
		const kontenRaw = String(formData.get('konten') || '{}');

		if (!kelasId || !mataPelajaranId || !materiPokok) {
			return fail(400, { message: 'Kelas, mata pelajaran, dan materi pokok wajib diisi.' });
		}

		let dimensiProfil: string[];
		let tujuanPembelajaranIds: number[];
		let konten: ModulAjarKonten;

		try {
			dimensiProfil = JSON.parse(dimensiProfilRaw);
			tujuanPembelajaranIds = JSON.parse(tpIdsRaw);
			konten = JSON.parse(kontenRaw);
		} catch {
			return fail(400, { message: 'Data format JSON modul ajar tidak valid.' });
		}

		try {
			if (id > 0) {
				// Cek kepemilikan jika bukan admin
				const existing = await getModulAjarById(id, sekolahId);
				if (!existing) {
					return fail(404, { message: 'Modul ajar tidak ditemukan.' });
				}
				const isAdmin = user.type === 'admin' || user.type === 'kepala_sekolah';
				if (!isAdmin && existing.authUserId !== user.id) {
					return fail(403, { message: 'Anda tidak memiliki hak akses mengubah modul ajar ini.' });
				}

				await updateModulAjar(
					id,
					{
						materiPokok,
						alokasiWaktu,
						jumlahPertemuan,
						modelPembelajaran,
						dimensiProfil,
						tujuanPembelajaranIds,
						konten,
						status
					},
					sekolahId
				);
				return { success: true, message: 'Modul ajar berhasil diperbarui.' };
			} else {
				await insertModulAjar({
					sekolahId,
					kelasId,
					mataPelajaranId,
					authUserId: user.id,
					materiPokok,
					alokasiWaktu,
					jumlahPertemuan,
					modelPembelajaran,
					dimensiProfil,
					tujuanPembelajaranIds,
					konten,
					status
				});
				return { success: true, message: 'Modul ajar berhasil dibuat.' };
			}
		} catch (err: unknown) {
			console.error('[Action simpan Modul Ajar] Error:', err);
			return fail(500, { message: 'Gagal menyimpan modul ajar ke basis data.' });
		}
	},

	hapus: async ({ request, locals }) => {
		const user = locals.user;
		const sekolahId = locals.sekolah?.id;
		if (!user || !sekolahId) {
			return fail(401, { message: 'Tidak terotentikasi' });
		}

		const formData = await request.formData();
		const id = Number(formData.get('id'));
		if (!id) {
			return fail(400, { message: 'ID modul ajar tidak valid.' });
		}

		const existing = await getModulAjarById(id, sekolahId);
		if (!existing) {
			return fail(404, { message: 'Modul ajar tidak ditemukan.' });
		}

		const isAdmin = user.type === 'admin' || user.type === 'kepala_sekolah';
		if (!isAdmin && existing.authUserId !== user.id) {
			return fail(403, { message: 'Anda tidak memiliki hak akses menghapus modul ajar ini.' });
		}

		try {
			await deleteModulAjar(id, sekolahId);
			return { success: true, message: 'Modul ajar berhasil dihapus.' };
		} catch (err: unknown) {
			console.error('[Action hapus Modul Ajar] Error:', err);
			return fail(500, { message: 'Gagal menghapus modul ajar.' });
		}
	},

	duplikasi: async ({ request, locals }) => {
		const user = locals.user;
		const sekolahId = locals.sekolah?.id;
		if (!user || !sekolahId) {
			return fail(401, { message: 'Tidak terotentikasi' });
		}

		const formData = await request.formData();
		const id = Number(formData.get('id'));
		if (!id) {
			return fail(400, { message: 'ID modul ajar tidak valid.' });
		}

		const existing = await getModulAjarById(id, sekolahId);
		if (!existing) {
			return fail(404, { message: 'Modul ajar tidak ditemukan.' });
		}

		try {
			await insertModulAjar({
				sekolahId,
				kelasId: existing.kelasId,
				mataPelajaranId: existing.mataPelajaranId,
				authUserId: user.id,
				materiPokok: `${existing.materiPokok} (Salinan)`,
				alokasiWaktu: existing.alokasiWaktu,
				jumlahPertemuan: existing.jumlahPertemuan,
				modelPembelajaran: existing.modelPembelajaran,
				dimensiProfil: existing.dimensiProfil,
				tujuanPembelajaranIds: existing.tujuanPembelajaranIds,
				konten: existing.konten,
				status: 'draf'
			});
			return { success: true, message: 'Modul ajar berhasil disalin sebagai draf baru.' };
		} catch (err: unknown) {
			console.error('[Action duplikasi Modul Ajar] Error:', err);
			return fail(500, { message: 'Gagal menduplikasi modul ajar.' });
		}
	}
};
