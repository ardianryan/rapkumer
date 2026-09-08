import db from '$lib/server/db';
import {
	tableAuthUser,
	tableAuthUserPembelajaran,
	tableKelas,
	tableMataPelajaran,
	tablePegawai,
	tableTujuanPembelajaran
} from '$lib/server/db/schema';
import { parseJenjangKelas, sortKelasNatural } from '$lib/utils';
import { fail, redirect, type RequestEvent, type ServerLoadEvent } from '@sveltejs/kit';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { authority } from '../../../pengguna/utils.server';

export async function load({ parent, url, locals }: ServerLoadEvent) {
	const { user } = await parent();
	const userType = (user as { type?: string } | null)?.type;

	// Hanya admin, kepala_sekolah, atau user dengan izin yang dapat mengelola distribusi
	if (userType !== 'admin' && userType !== 'kepala_sekolah') {
		authority('mata_pelajaran_intrakurikuler');
	}

	const sekolahId = locals.sekolah?.id;
	if (!sekolahId) {
		throw redirect(303, '/login');
	}

	// Ambil semua kelas di sekolah ini
	const allSchoolClasses = await db.query.tableKelas.findMany({
		where: eq(tableKelas.sekolahId, sekolahId),
		columns: { id: true, nama: true, semesterId: true }
	});
	const schoolClassIds = allSchoolClasses.map((k) => k.id);

	if (schoolClassIds.length === 0) {
		return {
			mapelList: [],
			selectedMapelNama: '',
			kelasRows: [],
			pegawaiList: [],
			meta: { title: 'Distribusi Mata Pelajaran' }
		};
	}

	const distinctMapels = await db
		.selectDistinct({ nama: tableMataPelajaran.nama })
		.from(tableMataPelajaran)
		.where(inArray(tableMataPelajaran.kelasId, schoolClassIds))
		.orderBy(asc(tableMataPelajaran.nama));

	const mapelList = distinctMapels.map((m) => m.nama).filter(Boolean);

	const selectedMapelNama = url.searchParams.get('mapel') ?? mapelList[0] ?? '';

	// Ambil semua guru / pegawai di sekolah ini
	const pegawaiList = await db.query.tablePegawai.findMany({
		where: eq(tablePegawai.sekolahId, sekolahId),
		columns: { id: true, nama: true, nip: true },
		orderBy: asc(tablePegawai.nama)
	});

	if (!selectedMapelNama) {
		return {
			mapelList,
			selectedMapelNama: '',
			kelasRows: [],
			pegawaiList,
			meta: { title: 'Distribusi Mata Pelajaran' }
		};
	}

	const kelasMap = new Map(allSchoolClasses.map((k) => [k.id, k]));
	const pegawaiMap = new Map(pegawaiList.map((p) => [p.id, p]));

	// Ambil semua entri mata pelajaran dengan nama ini di semua kelas
	const mapelEntries = await db.query.tableMataPelajaran.findMany({
		where: and(
			inArray(tableMataPelajaran.kelasId, schoolClassIds),
			eq(tableMataPelajaran.nama, selectedMapelNama)
		)
	});

	const mapelIds = mapelEntries.map((m) => m.id);
	const tpCounts = new Map<number, number>();
	if (mapelIds.length > 0) {
		const tps = await db.query.tableTujuanPembelajaran.findMany({
			where: inArray(tableTujuanPembelajaran.mataPelajaranId, mapelIds),
			columns: { id: true, mataPelajaranId: true }
		});
		for (const tp of tps) {
			tpCounts.set(tp.mataPelajaranId, (tpCounts.get(tp.mataPelajaranId) ?? 0) + 1);
		}
	}

	// Urutkan berdasarkan urutan kelas alami (natural sort: X-1 s.d. XII-12)
	const sortedEntries = [...mapelEntries].sort((a, b) => {
		const namaA = kelasMap.get(a.kelasId)?.nama ?? '';
		const namaB = kelasMap.get(b.kelasId)?.nama ?? '';
		return sortKelasNatural(namaA, namaB);
	});

	const kelasRows = sortedEntries.map((m) => {
		const k = kelasMap.get(m.kelasId);
		const p = m.pengampuId ? pegawaiMap.get(m.pengampuId) : null;
		const jenjang = parseJenjangKelas(k?.nama ?? '');
		return {
			mapelId: m.id,
			kelasId: m.kelasId,
			namaKelas: k?.nama ?? '',
			jenjang: jenjang || '',
			jenis: m.jenis ?? 'wajib',
			kode: m.kode ?? '',
			kkm: m.kkm ?? 0,
			pengampuId: m.pengampuId ?? null,
			pengampuNama: p?.nama ?? '',
			totalTp: tpCounts.get(m.id) ?? 0
		};
	});

	return {
		mapelList,
		selectedMapelNama,
		kelasRows,
		pegawaiList,
		meta: { title: `Kelola ${selectedMapelNama} – Distribusi Pembelajaran` }
	};
}

export const actions = {
	async save_assignments({ request, locals }: RequestEvent) {
		const userType = (locals.user as { type?: string } | null)?.type;
		if (userType !== 'admin' && userType !== 'kepala_sekolah') {
			authority('mata_pelajaran_intrakurikuler');
		}

		const formData = await request.formData();
		const rawPayload = formData.get('assignments')?.toString();
		if (!rawPayload) {
			return fail(400, { fail: 'Tidak ada data penugasan yang dikirim.' });
		}

		let assignments: Array<{
			mapelId: number;
			kelasId: number;
			pengampuId: number | null;
			jenis: string;
			kode: string;
			kkm: number;
		}>;

		try {
			assignments = JSON.parse(rawPayload);
		} catch {
			return fail(400, { fail: 'Format data penugasan tidak valid.' });
		}

		const now = new Date().toISOString();

		await db.transaction(async (tx) => {
			for (const item of assignments) {
				const mapelId = Number(item.mapelId);
				const pengampuId = item.pengampuId ? Number(item.pengampuId) : null;
				const kkm = Number(item.kkm) || 0;
				const kode = (item.kode ?? '').trim();
				const jenis = item.jenis ?? 'wajib';

				await tx
					.update(tableMataPelajaran)
					.set({
						pengampuId: pengampuId || null,
						kkm,
						kode: kode || null,
						jenis: jenis as
							'wajib' | 'pilihan' | 'mulok' | 'kejuruan' | 'pemberdayaan' | 'belum_dipetakan',
						updatedAt: now
					})
					.where(eq(tableMataPelajaran.id, mapelId));

				// Otomatis sinkronkan penugasan ke akun guru
				if (pengampuId) {
					const teacherUser = await tx.query.tableAuthUser.findFirst({
						where: eq(tableAuthUser.pegawaiId, pengampuId)
					});
					if (teacherUser) {
						const existsP = await tx.query.tableAuthUserPembelajaran.findFirst({
							where: and(
								eq(tableAuthUserPembelajaran.authUserId, teacherUser.id),
								eq(tableAuthUserPembelajaran.kelasId, item.kelasId),
								eq(tableAuthUserPembelajaran.mataPelajaranId, mapelId)
							)
						});
						if (!existsP) {
							await tx.insert(tableAuthUserPembelajaran).values({
								authUserId: teacherUser.id,
								kelasId: item.kelasId,
								mataPelajaranId: mapelId,
								createdAt: now,
								updatedAt: now
							});
						}
					}
				}
			}
		});

		return {
			success: `Berhasil memperbarui data pembelajaran dan hak akses untuk ${assignments.length} kelas.`
		};
	},

	async bulk_distribute_tp({ request, locals }: RequestEvent) {
		const userType = (locals.user as { type?: string } | null)?.type;
		if (userType !== 'admin' && userType !== 'kepala_sekolah') {
			authority('mata_pelajaran_intrakurikuler');
		}

		const formData = await request.formData();
		const sourceMapelId = Number(formData.get('sourceMapelId'));
		const mode = formData.get('mode') === 'merge' ? 'merge' : 'replace';
		const targetMapelIds = formData.getAll('targetMapelIds').map(Number).filter(Number.isFinite);

		if (!sourceMapelId || targetMapelIds.length === 0) {
			return fail(400, { fail: 'Pilih kelas sumber dan minimal satu kelas tujuan.' });
		}

		const sourceTps = await db.query.tableTujuanPembelajaran.findMany({
			where: eq(tableTujuanPembelajaran.mataPelajaranId, sourceMapelId),
			orderBy: asc(tableTujuanPembelajaran.id)
		});

		if (sourceTps.length === 0) {
			return fail(400, { fail: 'Kelas sumber belum memiliki Tujuan Pembelajaran.' });
		}

		await db.transaction(async (tx) => {
			for (const targetId of targetMapelIds) {
				if (mode === 'replace') {
					await tx
						.delete(tableTujuanPembelajaran)
						.where(eq(tableTujuanPembelajaran.mataPelajaranId, targetId));
				}
				await tx.insert(tableTujuanPembelajaran).values(
					sourceTps.map((tp) => ({
						mataPelajaranId: targetId,
						lingkupMateri: tp.lingkupMateri,
						deskripsi: tp.deskripsi
					}))
				);
			}
		});

		return {
			success: `Berhasil mendistribusikan ${sourceTps.length} TP ke ${targetMapelIds.length} kelas.`
		};
	}
};
