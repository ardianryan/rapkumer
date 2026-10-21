import { json, type RequestHandler } from '@sveltejs/kit';
import db from '$lib/server/db';
import {
	tableMataPelajaran,
	tableRtsMapelSetup,
	tableRtsNilaiSiswa,
	type RtsKomponenFormatifItem,
	type RtsKomponenSumatifItem
} from '$lib/server/db/schema';
import { asc, eq, sql } from 'drizzle-orm';
import { isAdminUser } from '../../../pengguna/permissions';

export const GET: RequestHandler = async ({ url, locals }) => {
	const user = locals.user;
	if (!user || !isAdminUser(user)) {
		return json({ error: 'Hanya administrator yang dapat mengakses data ini.' }, { status: 403 });
	}

	const kelasId = Number(url.searchParams.get('kelasId'));
	if (!kelasId) {
		return json({ error: 'Parameter kelasId diperlukan.' }, { status: 400 });
	}

	const mapelList = await db.query.tableMataPelajaran.findMany({
		where: eq(tableMataPelajaran.kelasId, kelasId),
		orderBy: asc(tableMataPelajaran.nama)
	});

	const setups = await db.query.tableRtsMapelSetup.findMany({
		where: eq(tableRtsMapelSetup.kelasId, kelasId)
	});
	const setupMap = new Map(setups.map((s) => [s.mataPelajaranId, s]));

	// Hitung siswa yang sudah dinilai per mapel
	const studentCounts = await db
		.select({
			mataPelajaranId: tableRtsNilaiSiswa.mataPelajaranId,
			count: sql<number>`count(${tableRtsNilaiSiswa.id})`
		})
		.from(tableRtsNilaiSiswa)
		.where(eq(tableRtsNilaiSiswa.kelasId, kelasId))
		.groupBy(tableRtsNilaiSiswa.mataPelajaranId);

	const countMap = new Map(studentCounts.map((sc) => [sc.mataPelajaranId, Number(sc.count)]));

	const results = mapelList.map((m) => {
		const s = setupMap.get(m.id);
		const fCount = s ? ((s.komponenFormatif as RtsKomponenFormatifItem[]) || []).length : 0;
		const sCount = s ? ((s.komponenSumatif as RtsKomponenSumatifItem[]) || []).length : 0;
		const studentCount = countMap.get(m.id) ?? 0;

		return {
			id: m.id,
			nama: m.namaLokal?.trim() || m.nama,
			hasSetup: Boolean(s),
			formatifCount: fCount,
			sumatifCount: sCount,
			studentCount
		};
	});

	return json({ mapelList: results });
};
