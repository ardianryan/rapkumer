import db from '$lib/server/db/index.js';
import { tableKelas, tableMataPelajaran, tableTujuanPembelajaran } from '$lib/server/db/schema.js';
import { isWaliOfKelas } from '$lib/server/kelas-akses';
import { eq, inArray, and, like } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import { parseJenjangKelas } from '$lib/utils.js';
import { isAdminUser } from '../../../../pengguna/permissions.js';

export async function load({ locals }) {
	const user = locals.user;
	return {
		isAdmin: isAdminUser(user as Parameters<typeof isAdminUser>[0]),
		meta: { title: 'Hapus Mata Pelajaran' }
	};
}

export const actions = {
	async delete({ params, request, locals }) {
		const form = await request.formData();
		if (!form.get('confirm')) {
			return fail(400, { fail: 'Konfirmasi penghapusan diperlukan.' });
		}

		const id = +params.id;
		const scopeDelete = form.get('scope_delete')?.toString() || 'kelas'; // 'kelas' | 'sejenjang' | 'sekolah'
		const user = locals.user;
		const isAdmin = isAdminUser(user as Parameters<typeof isAdminUser>[0]);

		try {
			// Get the mapel being deleted
			const mapel = await db.query.tableMataPelajaran.findFirst({
				columns: { id: true, nama: true, kelasId: true },
				with: {
					kelas: {
						columns: { id: true, nama: true, semesterId: true, sekolahId: true }
					}
				},
				where: eq(tableMataPelajaran.id, id)
			});

			if (!mapel) {
				return fail(404, { fail: 'Mata pelajaran tidak ditemukan.' });
			}

			// Wali kelas hanya boleh menghapus mapel di kelas miliknya
			const userObj = locals.user as { type?: string; pegawaiId?: number | null } | null;
			if (userObj?.type === 'wali_kelas' && !(await isWaliOfKelas(userObj, mapel.kelasId))) {
				return fail(403, { fail: 'Anda tidak memiliki izin untuk menghapus di kelas ini.' });
			}

			const sekolahId = locals.sekolah?.id;
			let targetKelasIds: number[] = [mapel.kelasId];

			if (isAdmin && sekolahId && (scopeDelete === 'sejenjang' || scopeDelete === 'sekolah')) {
				const allClasses = await db.query.tableKelas.findMany({
					where: and(
						eq(tableKelas.sekolahId, sekolahId),
						mapel.kelas?.semesterId ? eq(tableKelas.semesterId, mapel.kelas.semesterId) : undefined
					),
					columns: { id: true, nama: true }
				});

				if (scopeDelete === 'sejenjang' && mapel.kelas?.nama) {
					const currentJenjang = parseJenjangKelas(mapel.kelas.nama);
					targetKelasIds = allClasses
						.filter((k) => parseJenjangKelas(k.nama) === currentJenjang)
						.map((k) => k.id);
				} else if (scopeDelete === 'sekolah') {
					targetKelasIds = allClasses.map((k) => k.id);
				}
			}

			// Ambil semua mapel bernama sama di target kelas
			const targetMapels = await db.query.tableMataPelajaran.findMany({
				columns: { id: true, kelasId: true },
				where: and(
					inArray(tableMataPelajaran.kelasId, targetKelasIds),
					eq(tableMataPelajaran.nama, mapel.nama)
				)
			});
			const isPksParent = mapel.nama === 'Pendalaman Kitab Suci';
			const isAgamaParent = mapel.nama === 'Pendidikan Agama dan Budi Pekerti';

			const idsToDelete: number[] = targetMapels.map((m) => m.id);

			// If deleting parent PKS or Agama, also delete all variants in the same classes
			if (isPksParent || isAgamaParent) {
				const pattern = isPksParent ? 'Pendalaman Kitab Suci%' : 'Pendidikan Agama%';
				const variants = await db.query.tableMataPelajaran.findMany({
					columns: { id: true },
					where: and(
						inArray(tableMataPelajaran.kelasId, targetKelasIds),
						like(tableMataPelajaran.nama, pattern)
					)
				});
				idsToDelete.push(...variants.map((v) => v.id));
			}

			const uniqueIds = Array.from(new Set(idsToDelete));

			if (uniqueIds.length > 0) {
				// Hapus Tujuan Pembelajaran yang terkait dulu agar tidak menabrak constraint
				await db
					.delete(tableTujuanPembelajaran)
					.where(inArray(tableTujuanPembelajaran.mataPelajaranId, uniqueIds));

				// lalu hapus mata pelajaran
				await db.delete(tableMataPelajaran).where(inArray(tableMataPelajaran.id, uniqueIds));
			}

			const deletedMapelCount = targetMapels.length;
			let message = `Data mata pelajaran telah dihapus.`;
			if (scopeDelete === 'sejenjang') {
				message = `Mata pelajaran "${mapel.nama}" berhasil dihapus dari ${deletedMapelCount} kelas se-jenjang.`;
			} else if (scopeDelete === 'sekolah') {
				message = `Mata pelajaran "${mapel.nama}" berhasil dihapus dari ${deletedMapelCount} kelas di seluruh sekolah.`;
			} else if (uniqueIds.length > 1) {
				message = `Data mata pelajaran beserta ${uniqueIds.length - 1} varian telah dihapus.`;
			}

			return { message };
		} catch (error) {
			console.error('Gagal menghapus mata pelajaran:', error);
			return fail(500, { fail: 'Gagal menghapus mata pelajaran.' });
		}
	}
};
