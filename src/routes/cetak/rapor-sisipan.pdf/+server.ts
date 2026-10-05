import { error, redirect, type RequestHandler } from '@sveltejs/kit';
import db from '$lib/server/db';
import { tableKelas, tableMurid } from '$lib/server/db/schema';
import { and, asc, eq } from 'drizzle-orm';
import { getRaporSisipanDataForStudent } from '$lib/server/pdf/rapor-sisipan-preview';
import { generatePDF, generateBulkPDF } from '$lib/server/pdf/generate';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) throw redirect(303, '/login');

	const sekolah = locals.sekolah;
	if (!sekolah?.id) throw error(400, 'Sekolah tidak ditemukan');

	const kelasId = Number(url.searchParams.get('kelas_id'));
	if (!kelasId) throw error(400, 'Parameter kelas_id wajib disertakan');

	const kelas = await db.query.tableKelas.findFirst({
		where: and(eq(tableKelas.id, kelasId), eq(tableKelas.sekolahId, sekolah.id))
	});
	if (!kelas) throw error(404, 'Kelas tidak ditemukan');

	const user = locals.user;
	const typedUser = user as {
		type?: string;
		id?: number;
		kelasId?: number | null;
		ownKelasIds?: number[] | null;
	};

	const isWaliKelasOwn =
		typedUser.type === 'wali_kelas' &&
		(typedUser.kelasId === kelas.id ||
			typedUser.ownKelasIds?.includes(kelas.id) ||
			kelas.waliKelasId === typedUser.id);
	const isAllowed =
		typedUser.type === 'admin' || typedUser.type === 'kepala_sekolah' || isWaliKelasOwn;

	if (!isAllowed) {
		throw error(
			403,
			'Akses ditolak. Hanya Wali Kelas atau Administrator yang dapat mencetak rapor sisipan.'
		);
	}

	const isBulk = url.searchParams.get('bulk') === 'true';
	const muridIdParam = url.searchParams.get('murid_id');

	if (isBulk || muridIdParam === 'all') {
		// Cetak seluruh siswa di kelas
		const muridList = await db.query.tableMurid.findMany({
			where: eq(tableMurid.kelasId, kelas.id),
			orderBy: asc(tableMurid.nama)
		});

		if (muridList.length === 0) {
			throw error(400, 'Tidak ada peserta didik di kelas ini.');
		}

		const items = [];
		for (const m of muridList) {
			const studentData = await getRaporSisipanDataForStudent({
				sekolahId: sekolah.id,
				kelasId: kelas.id,
				muridId: m.id
			});
			items.push({
				docType: 'rapor-sisipan' as const,
				data: studentData as unknown as Record<string, unknown>
			});
		}

		const pdfBuffer = await generateBulkPDF(items);
		const safeKelas = kelas.nama.replace(/[^a-zA-Z0-9_-]/g, '_');
		const filename = `Rapor_Sisipan_Kelas_${safeKelas}.pdf`;

		return new Response(new Blob([pdfBuffer as BlobPart], { type: 'application/pdf' }), {
			headers: {
				'Content-Disposition': `inline; filename="${filename}"`,
				'Content-Type': 'application/pdf',
				'Cache-Control': 'no-store, no-cache, must-revalidate'
			}
		});
	}

	// Cetak satu siswa
	const muridId = Number(muridIdParam);
	if (!muridId) throw error(400, 'Parameter murid_id wajib disertakan');

	const studentData = await getRaporSisipanDataForStudent({
		sekolahId: sekolah.id,
		kelasId: kelas.id,
		muridId
	});

	const pdfBuffer = await generatePDF(
		'rapor-sisipan',
		studentData as unknown as Record<string, unknown>
	);

	const safeName = studentData.murid.nama.replace(/[^a-zA-Z0-9_-]/g, '_');
	const safeKelas = kelas.nama.replace(/[^a-zA-Z0-9_-]/g, '_');
	const filename = `Rapor_Sisipan_${safeName}_${safeKelas}.pdf`;

	return new Response(new Blob([pdfBuffer as BlobPart], { type: 'application/pdf' }), {
		headers: {
			'Content-Disposition': `inline; filename="${filename}"`,
			'Content-Type': 'application/pdf',
			'Cache-Control': 'no-store, no-cache, must-revalidate'
		}
	});
};
