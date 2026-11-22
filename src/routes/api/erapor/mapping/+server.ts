import { json, type RequestHandler } from '@sveltejs/kit';
import db from '$lib/server/db';
import { ensureEraporSchema } from '$lib/server/db/ensure-erapor';
import {
	tableEraporMapKokurikuler,
	tableEraporMapMapel,
	tableEraporMapRombel
} from '$lib/server/db/schema';
import { requireEraporAdmin } from '$lib/server/erapor/auth';
import { and, eq } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request, locals }) => {
	const auth = requireEraporAdmin(locals);
	if (auth.error) return auth.error;

	try {
		await ensureEraporSchema();
		const body = (await request.json()) as
			| {
					type: 'rombel';
					semesterId: string;
					items: Array<{
						siakadKelasId: number;
						eraporRombelId: string;
						eraporNmKelas?: string | null;
					}>;
			  }
			| {
					type: 'mapel';
					items: Array<{
						siakadMapelNama: string;
						eraporMapelId: string;
						eraporNmMapel?: string | null;
					}>;
			  }
			| {
					type: 'kokurikuler';
					semesterId: string;
					items: Array<{
						siakadKode: string;
						eraporKelompokId?: string;
						eraporKegiatanId?: string | null;
						eraporKegiatanNama?: string | null;
						dimensiMap?: Record<string, string>;
					}>;
			  };

		const sekolahId = auth.sekolah.id;
		const now = new Date().toISOString();

		if (body.type === 'rombel') {
			const semesterId = body.semesterId?.trim();
			if (!semesterId) {
				return json({ error: 'Semester target e-Rapor wajib dipilih.' }, { status: 400 });
			}
			let saved = 0;
			for (const item of body.items ?? []) {
				if (!item.siakadKelasId) continue;
				const existing = await db.query.tableEraporMapRombel.findFirst({
					where: and(
						eq(tableEraporMapRombel.sekolahId, sekolahId),
						eq(tableEraporMapRombel.siakadKelasId, item.siakadKelasId),
						eq(tableEraporMapRombel.semesterId, semesterId)
					)
				});
				if (!item.eraporRombelId?.trim()) {
					if (existing) {
						await db.delete(tableEraporMapRombel).where(eq(tableEraporMapRombel.id, existing.id));
					}
					continue;
				}
				if (existing) {
					await db
						.update(tableEraporMapRombel)
						.set({
							eraporRombelId: item.eraporRombelId.trim(),
							eraporNmKelas: item.eraporNmKelas ?? null,
							updatedAt: now
						})
						.where(eq(tableEraporMapRombel.id, existing.id));
				} else {
					await db.insert(tableEraporMapRombel).values({
						sekolahId,
						siakadKelasId: item.siakadKelasId,
						eraporRombelId: item.eraporRombelId.trim(),
						eraporNmKelas: item.eraporNmKelas ?? null,
						semesterId
					});
				}
				saved += 1;
			}
			return json({ success: true, message: `${saved} pemetaan rombel disimpan.` });
		}

		if (body.type === 'mapel') {
			let saved = 0;
			for (const item of body.items ?? []) {
				const nama = item.siakadMapelNama?.trim();
				if (!nama) continue;
				const existing = await db.query.tableEraporMapMapel.findFirst({
					where: and(
						eq(tableEraporMapMapel.sekolahId, sekolahId),
						eq(tableEraporMapMapel.siakadMapelNama, nama)
					)
				});
				if (!item.eraporMapelId?.trim()) {
					if (existing) {
						await db.delete(tableEraporMapMapel).where(eq(tableEraporMapMapel.id, existing.id));
					}
					continue;
				}
				if (existing) {
					await db
						.update(tableEraporMapMapel)
						.set({
							eraporMapelId: item.eraporMapelId.trim(),
							eraporNmMapel: item.eraporNmMapel ?? null,
							updatedAt: now
						})
						.where(eq(tableEraporMapMapel.id, existing.id));
				} else {
					await db.insert(tableEraporMapMapel).values({
						sekolahId,
						siakadMapelNama: nama,
						eraporMapelId: item.eraporMapelId.trim(),
						eraporNmMapel: item.eraporNmMapel ?? null
					});
				}
				saved += 1;
			}
			return json({ success: true, message: `${saved} pemetaan mata pelajaran disimpan.` });
		}

		if (body.type === 'kokurikuler') {
			const semesterId = body.semesterId?.trim();
			if (!semesterId) {
				return json({ error: 'Semester target e-Rapor wajib dipilih.' }, { status: 400 });
			}
			let saved = 0;
			for (const item of body.items ?? []) {
				const kode = item.siakadKode?.trim().toUpperCase();
				if (!kode) continue;
				const existing = await db.query.tableEraporMapKokurikuler.findFirst({
					where: and(
						eq(tableEraporMapKokurikuler.sekolahId, sekolahId),
						eq(tableEraporMapKokurikuler.siakadKode, kode),
						eq(tableEraporMapKokurikuler.semesterId, semesterId)
					)
				});
				const payload = {
					eraporKelompokId: item.eraporKelompokId?.trim() ?? '',
					eraporKegiatanId: item.eraporKegiatanId ?? null,
					eraporKegiatanNama: item.eraporKegiatanNama ?? null,
					dimensiMap: item.dimensiMap ?? {},
					updatedAt: now
				};
				if (existing) {
					await db
						.update(tableEraporMapKokurikuler)
						.set(payload)
						.where(eq(tableEraporMapKokurikuler.id, existing.id));
				} else {
					await db.insert(tableEraporMapKokurikuler).values({
						sekolahId,
						siakadKode: kode,
						semesterId,
						...payload
					});
				}
				saved += 1;
			}
			return json({ success: true, message: `${saved} pemetaan kokurikuler disimpan.` });
		}

		return json({ error: 'Tipe pemetaan tidak dikenal.' }, { status: 400 });
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		return json({ error: `Gagal menyimpan pemetaan: ${msg}` }, { status: 500 });
	}
};
