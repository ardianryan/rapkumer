import db from '$lib/server/db';
import {
	tableAuthUser,
	tableAuthUserKelas,
	tableAuthUserMataPelajaran,
	tableAuthZitadelUser,
	tableKelas,
	tableMataPelajaran,
	tableMurid,
	tablePegawai,
	tableSekolah
} from '$lib/server/db/schema';
import { ensureZitadelSchema } from '$lib/server/db/ensure-zitadel';
import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import { authority } from './utils.server';
import { defaultPermissionsByType } from './permissions';
import { ensurePegawaiConsolidation } from './consolidation.server';
import { hashPassword } from '$lib/server/auth';
import { validatePasswordStrength } from '$lib/server/password-policy';

const u = tableAuthUser;

export async function load() {
	authority('user_list');

	// Pastikan konsolidasi akun wali kelas/wali asuh & dedup pegawai berjalan sekali per proses
	await ensurePegawaiConsolidation();

	// Pastikan tabel SSO Zitadel siap
	await ensureZitadelSchema();

	// Ambil semua akun pengguna beserta pegawai terkait
	const rawUsers = await db
		.select({
			id: u.id,
			username: u.username,
			usernameNormalized: u.usernameNormalized,
			type: u.type,
			pegawaiId: u.pegawaiId,
			pegawaiName: tablePegawai.nama,
			dapodikPtkId: tablePegawai.dapodikPtkId,
			sekolahId: u.sekolahId,
			kelasId: u.kelasId,
			createdAt: u.createdAt,
			updatedAt: u.updatedAt,
			passwordUpdatedAt: u.passwordUpdatedAt
		})
		.from(u)
		.leftJoin(tablePegawai, eq(u.pegawaiId, tablePegawai.id));

	// Deduplikasi tampilan list jika ada id yang berulang
	const dedupedUsers: typeof rawUsers = [];
	const seenIds = new Set<number>();
	for (const row of rawUsers) {
		if (typeof row.id === 'number' && !seenIds.has(row.id)) {
			seenIds.add(row.id);
			dedupedUsers.push(row);
		}
	}

	// Ambil data wali kelas, kepala sekolah, dan wali asuh
	const [kelasBerwali, sekolahBerkepala, asuhCounts] = await Promise.all([
		db
			.select({
				id: tableKelas.id,
				nama: tableKelas.nama,
				waliKelasId: tableKelas.waliKelasId
			})
			.from(tableKelas)
			.where(isNotNull(tableKelas.waliKelasId)),
		db
			.select({
				id: tableSekolah.id,
				nama: tableSekolah.nama,
				pegawaiId: tableSekolah.kepalaSekolahId
			})
			.from(tableSekolah)
			.where(isNotNull(tableSekolah.kepalaSekolahId)),
		db
			.select({
				nama: tableMurid.waliAsuhNama,
				count: sql`count(${tableMurid.id})`
			})
			.from(tableMurid)
			.where(and(isNotNull(tableMurid.waliAsuhNama), sql`trim(${tableMurid.waliAsuhNama}) != ''`))
			.groupBy(tableMurid.waliAsuhNama)
	]);

	const waliKelasByPegawai = new Map<number, string[]>();
	const waliKelasIdsByPegawai = new Map<number, number[]>();
	for (const k of kelasBerwali) {
		if (!k.waliKelasId) continue;
		const arr = waliKelasByPegawai.get(k.waliKelasId) ?? [];
		arr.push(k.nama);
		waliKelasByPegawai.set(k.waliKelasId, arr);
		const idArr = waliKelasIdsByPegawai.get(k.waliKelasId) ?? [];
		idArr.push(k.id);
		waliKelasIdsByPegawai.set(k.waliKelasId, idArr);
	}

	const kepalaPegawaiIds = new Set(
		sekolahBerkepala.map((s) => s.pegawaiId).filter((id): id is number => id != null)
	);

	const asuhCountByName = new Map<string, number>();
	for (const r of asuhCounts) {
		const key = (r.nama ?? '').trim().toLowerCase();
		if (!key) continue;
		asuhCountByName.set(key, (asuhCountByName.get(key) ?? 0) + Number(r.count));
	}

	const typeLabel: Record<string, string> = {
		admin: 'Admin',
		kepala_sekolah: 'Kepala Sekolah',
		wali_kelas: 'Wali Kelas',
		wali_asuh: 'Wali Asuh',
		user: 'Guru'
	};

	// Ambil penugasan mapel, kelas, dan akun SSO Zitadel
	const allUserIds = dedupedUsers
		.map((r) => r.id)
		.filter((id): id is number => typeof id === 'number' && id > 0);

	const [mataPelajaran, userMapelRows, userKelasRows, userZitadelRows] = allUserIds.length
		? await Promise.all([
				db
					.select({
						id: tableMataPelajaran.id,
						nama: tableMataPelajaran.nama,
						kelasId: tableMataPelajaran.kelasId
					})
					.from(tableMataPelajaran)
					.limit(1000),
				db
					.select({
						userId: tableAuthUserMataPelajaran.authUserId,
						mataPelajaranId: tableAuthUserMataPelajaran.mataPelajaranId
					})
					.from(tableAuthUserMataPelajaran)
					.where(inArray(tableAuthUserMataPelajaran.authUserId, allUserIds)),
				db
					.select({
						userId: tableAuthUserKelas.authUserId,
						kelasId: tableAuthUserKelas.kelasId
					})
					.from(tableAuthUserKelas)
					.where(inArray(tableAuthUserKelas.authUserId, allUserIds)),
				db
					.select({
						userId: tableAuthZitadelUser.userId,
						zitadelUuid: tableAuthZitadelUser.zitadelUuid,
						ptkId: tableAuthZitadelUser.ptkId,
						nip: tableAuthZitadelUser.nip,
						role: tableAuthZitadelUser.role,
						isOnboarded: tableAuthZitadelUser.isOnboarded,
						lastLoginAt: tableAuthZitadelUser.lastLoginAt
					})
					.from(tableAuthZitadelUser)
					.where(inArray(tableAuthZitadelUser.userId, allUserIds))
					.catch((err) => {
						console.warn('[pengguna] Failed to query auth_zitadel_user:', err);
						return [];
					})
			])
		: [[], [], [], []];

	const mapelKelasMap = new Map<number, number>();
	for (const m of mataPelajaran) {
		if (m.kelasId != null) mapelKelasMap.set(m.id, m.kelasId);
	}
	const userMapelMap = new Map<number, number[]>();
	for (const row of userMapelRows) {
		const arr = userMapelMap.get(row.userId) ?? [];
		arr.push(row.mataPelajaranId);
		userMapelMap.set(row.userId, arr);
	}
	const userKelasMap = new Map<number, number[]>();
	for (const row of userKelasRows) {
		const arr = userKelasMap.get(row.userId) ?? [];
		arr.push(row.kelasId);
		userKelasMap.set(row.userId, arr);
	}
	const userZitadelMap = new Map<number, (typeof userZitadelRows)[0]>();
	for (const row of userZitadelRows) {
		userZitadelMap.set(row.userId, row);
	}

	const users = dedupedUsers.map((row) => {
		const roles: string[] = [];
		if (row.pegawaiId && kepalaPegawaiIds.has(row.pegawaiId)) roles.push('Kepala Sekolah');
		if (row.pegawaiId) {
			for (const nama of waliKelasByPegawai.get(row.pegawaiId) ?? []) roles.push(`Wali ${nama}`);
		}
		// Wali kelas sekaligus guru mapel di kelas LAIN dari kelas perwaliannya
		if (row.type === 'wali_kelas' && row.pegawaiId != null) {
			const ownKelas = new Set(waliKelasIdsByPegawai.get(row.pegawaiId) ?? []);
			const arr = userMapelMap.get(row.id);
			if (arr && arr.length > 0) {
				const teachesOutsideOwn = arr.some((mpId) => {
					const kId = mapelKelasMap.get(mpId);
					return kId != null && !ownKelas.has(kId);
				});
				if (teachesOutsideOwn) roles.push('Guru');
			}
		}
		const asuhCount = asuhCountByName.get((row.pegawaiName ?? '').trim().toLowerCase()) ?? 0;
		if (asuhCount > 0 || row.type === 'wali_asuh') {
			roles.push(asuhCount > 0 ? `Wali Asuh (${asuhCount} murid)` : 'Wali Asuh');
		}
		if (!roles.length) roles.push(typeLabel[row.type] ?? row.type);

		// Lampirkan status SSO Zitadel
		const sso = userZitadelMap.get(row.id) ?? null;

		return { ...row, roles, sso };
	});

	// Attach mapelIds/kelasIds/waliKelasIds to each user for form navigation
	for (const user of users) {
		const uid = user.id as number;
		if (uid > 0) {
			const ids = new Set(userKelasMap.get(uid) ?? []);
			if (user.kelasId != null) ids.add(user.kelasId);
			if (user.pegawaiId != null) {
				for (const kid of waliKelasIdsByPegawai.get(user.pegawaiId) ?? []) ids.add(kid);
			}
			(user as Record<string, unknown>).mataPelajaranIds = userMapelMap.get(uid) ?? [];
			(user as Record<string, unknown>).kelasIds = Array.from(ids);
			(user as Record<string, unknown>).waliKelasIds =
				user.pegawaiId != null ? (waliKelasIdsByPegawai.get(user.pegawaiId) ?? []) : [];
		}
	}

	return { meta: { title: 'Manajemen Pengguna' }, users };
}

export const actions = {
	update_credentials: async ({ request }: { request: Request }) => {
		authority('user_set_permissions');
		const form = await request.formData();
		const id = Number(form.get('id'));
		const username = String(form.get('username') ?? '').trim();
		const password = String(form.get('password') ?? '').trim();

		const updateData: Record<string, unknown> = {};
		if (username) {
			updateData.username = username;
			updateData.usernameNormalized = username.toLowerCase();
		}
		if (password) {
			const passwordError = validatePasswordStrength(password);
			if (passwordError) {
				return fail(400, { message: passwordError });
			}
			const { hash, salt } = hashPassword(password);
			updateData.passwordHash = hash;
			updateData.passwordSalt = salt;
			updateData.passwordUpdatedAt = new Date().toISOString();
		}

		if (Object.keys(updateData).length === 0) {
			return fail(400, { message: 'Tidak ada perubahan' });
		}

		try {
			await db.update(u).set(updateData).where(eq(u.id, id));
			const [updated] = await db
				.select({
					id: u.id,
					username: u.username,
					usernameNormalized: u.usernameNormalized,
					passwordUpdatedAt: u.passwordUpdatedAt
				})
				.from(u)
				.where(eq(u.id, id));
			return { success: true, user: updated };
		} catch (err) {
			console.error('Failed to update user credentials', err);
			return fail(500, { message: 'Internal Error' });
		}
	},

	delete_users: async ({ request }: { request: Request }) => {
		authority('user_delete');
		let ids: number[];
		try {
			const contentType = request.headers.get('content-type') || '';
			if (contentType.includes('application/json')) {
				const body = await request.json();
				ids = Array.isArray(body.ids) ? body.ids.map(Number) : [];
			} else {
				const form = await request.formData();
				const raw = String(form.get('ids') ?? '');
				ids = raw
					.split(',')
					.map((s) => Number(s))
					.filter(Boolean);
			}
		} catch (err) {
			console.warn('Failed to parse ids for deletion', err);
			return new Response('Invalid request', { status: 400 });
		}

		ids = ids.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0);
		if (!ids.length) return new Response('No ids provided', { status: 400 });

		try {
			const candidates = await db
				.select({
					id: tableAuthUser.id,
					type: tableAuthUser.type,
					username: tableAuthUser.username,
					pegawaiName: tablePegawai.nama,
					kelasName: tableKelas.nama
				})
				.from(tableAuthUser)
				.leftJoin(tablePegawai, eq(tableAuthUser.pegawaiId, tablePegawai.id))
				.leftJoin(tableKelas, eq(tableAuthUser.kelasId, tableKelas.id))
				.where(inArray(tableAuthUser.id, ids));

			const blocked = candidates.filter((c) => c.type === 'wali_kelas' || c.type === 'wali_asuh');
			if (blocked.length) {
				const messages = blocked.map((b) => {
					const name = b.pegawaiName || b.username || 'Pengguna';
					const kelas = b.kelasName || '';
					const role = b.type === 'wali_asuh' ? 'Wali Asuh' : 'Wali Kelas';
					if (b.type === 'wali_asuh') {
						return `${name} adalah ${role}, tidak dapat dihapus. Ubah wali asuh melalui menu Data Murid`;
					}
					return `${name} adalah ${role} ${kelas}, tidak dapat dihapus. Untuk menggantinya buka menu Data Kelas`;
				});
				return new Response(JSON.stringify({ type: 'warning', message: messages.join(' | ') }), {
					status: 400,
					headers: { 'Content-Type': 'application/json' }
				});
			}

			await db.delete(tableAuthUser).where(inArray(tableAuthUser.id, ids));
			return { success: true, deleted: ids };
		} catch (err) {
			console.error('Failed to delete users', err);
			return new Response(String(err), { status: 500 });
		}
	},

	unlinkSso: async ({ request }: { request: Request }) => {
		authority('user_set_permissions');
		const formData = await request.formData();
		const userId = Number(formData.get('userId'));
		if (!userId) {
			return fail(400, { message: 'ID pengguna tidak valid.' });
		}

		await db.delete(tableAuthZitadelUser).where(eq(tableAuthZitadelUser.userId, userId));
		return { success: true, message: 'Tautan akun SSO berhasil diputuskan.' };
	},

	bulk_reset_permissions: async ({ request }: { request: Request }) => {
		authority('user_set_permissions');
		const formData = await request.formData();
		const userIdsRaw = formData.get('userIds');
		let userIds: number[];
		try {
			userIds = JSON.parse(String(userIdsRaw || '[]'));
		} catch {
			return fail(400, { message: 'Data user tidak valid.' });
		}
		if (!Array.isArray(userIds) || !userIds.length) {
			return fail(400, { message: 'Pilih setidaknya satu pengguna.' });
		}

		const targetUsers = await db.query.tableAuthUser.findMany({
			where: inArray(tableAuthUser.id, userIds),
			columns: { id: true, type: true }
		});

		const ts = new Date().toISOString();
		for (const usr of targetUsers) {
			if (usr.type === 'admin') continue;
			const defaults = defaultPermissionsByType[usr.type] ?? [];
			await db
				.update(tableAuthUser)
				.set({ permissions: defaults, updatedAt: ts })
				.where(eq(tableAuthUser.id, usr.id));
		}

		return { success: true, count: targetUsers.length };
	}
};
