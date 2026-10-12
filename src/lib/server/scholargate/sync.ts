import db from '$lib/server/db';
import {
	tableAuthUser,
	tableAuthZitadelUser,
	tableMurid,
	tablePegawai
} from '$lib/server/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { getScholargateConfig, lookupScholargateMember, type ScholargateMember } from './client';

export interface SyncGuruProfileResult {
	namaLengkap: string;
	nip: string;
	tempatLahir: string;
	tanggalLahir: string;
	jenisKelamin: string;
	dapodikPtkId: string;
}

/**
 * Menarik data identitas guru dari SMAGE ID (ScholarGate) dan langsung
 * memperbarui serta menyimpan perubahan ke database Rapkumer secara otomatis.
 *
 * Prioritas pencocokan:
 * 1. Dapodik UUID (PTK ID) dari profil akun / pegawai / Zitadel
 * 2. NIP pegawai
 * 3. Username / Email akun
 */
export async function syncGuruProfileFromScholargate(
	userId: number,
	sekolahId: number
): Promise<SyncGuruProfileResult> {
	// 1. Ambil konfigurasi SMAGE ID dari database sekolah
	const config = await getScholargateConfig(sekolahId);
	if (!config.baseUrl) {
		throw new Error(
			'URL Base SMAGE ID belum disetel di menu Pengaturan. Silakan minta Administrator untuk mengaturnya.'
		);
	}
	if (!config.apiKey) {
		throw new Error(
			'API Key SMAGE ID belum disetel di menu Pengaturan. Silakan minta Administrator untuk mengaturnya.'
		);
	}
	if (!config.referer) {
		throw new Error(
			'Domain / Referer SMAGE ID belum disetel di menu Pengaturan. Silakan minta Administrator untuk mengaturnya.'
		);
	}

	// 2. Baca data user lokal saat ini
	const currentUser = await db.query.tableAuthUser.findFirst({
		where: eq(tableAuthUser.id, userId),
		with: {
			pegawai: true
		}
	});

	if (!currentUser) {
		throw new Error('Data pengguna tidak ditemukan di database.');
	}

	const zitadelUser = await db.query.tableAuthZitadelUser.findFirst({
		where: eq(tableAuthZitadelUser.userId, userId)
	});

	// Tentukan parameter pencocokan
	const dapodikUuid =
		zitadelUser?.ptkId ||
		currentUser.pegawai?.dapodikPtkId ||
		zitadelUser?.rawMetadata?.dapodik_id ||
		zitadelUser?.rawMetadata?.ptk_id ||
		'';

	const nip = currentUser.pegawai?.nip || zitadelUser?.nip || '';
	const nik = zitadelUser?.nik || '';
	const username = currentUser.username || '';

	let member: ScholargateMember | null = null;

	// Coba 1: Berdasarkan Dapodik UUID (PTK ID)
	if (dapodikUuid) {
		try {
			member = await lookupScholargateMember(config.baseUrl, config.apiKey, config.referer, {
				dapodik_id: dapodikUuid
			});
		} catch (e) {
			console.warn('[SMAGE ID Sync] Lookup by dapodik_id failed:', e);
		}
	}

	// Coba 2: Berdasarkan NIP (jika cara 1 belum menemukan)
	if (!member && nip) {
		try {
			member = await lookupScholargateMember(config.baseUrl, config.apiKey, config.referer, {
				nip
			});
		} catch (e) {
			console.warn('[SMAGE ID Sync] Lookup by nip failed:', e);
		}
	}

	// Coba 3: Berdasarkan NIK
	if (!member && nik) {
		try {
			member = await lookupScholargateMember(config.baseUrl, config.apiKey, config.referer, {
				nik
			});
		} catch (e) {
			console.warn('[SMAGE ID Sync] Lookup by nik failed:', e);
		}
	}

	// Coba 4: Berdasarkan Username / Email
	if (!member && username) {
		try {
			member = await lookupScholargateMember(config.baseUrl, config.apiKey, config.referer, {
				username
			});
		} catch (e) {
			console.warn('[SMAGE ID Sync] Lookup by username failed:', e);
		}
	}

	if (!member) {
		throw new Error(
			`Data guru tidak ditemukan di direktori SMAGE ID. Pastikan akun atau Dapodik UUID (${dapodikUuid || nip || username || '-'}) sudah terdaftar di SMAGE ID.`
		);
	}

	const namaBaru = (member.nama || currentUser.namaLengkap || '').trim();
	const nipBaru = (member.nip || currentUser.pegawai?.nip || '').trim();
	const tempatLahirBaru = (member.tempat_lahir || currentUser.tempatLahir || '').trim();
	const tanggalLahirBaru = (member.tanggal_lahir || currentUser.tanggalLahir || '').trim();
	const jenisKelaminBaru = (member.jenis_kelamin || currentUser.jenisKelamin || '') as
		'L' | 'P' | '';
	const ptkIdBaru = (member.ptk_id || member.dapodik_id || dapodikUuid || '').trim();
	const nikBaru = (member.nik || zitadelUser?.nik || '').trim();

	const timestamp = new Date().toISOString();

	// 3. Simpan perubahan langsung ke database dalam satu transaksi
	await db.transaction(async (tx) => {
		let pegawaiId = currentUser.pegawaiId;

		// Update / buat data pegawai
		if (pegawaiId) {
			await tx
				.update(tablePegawai)
				.set({
					nama: namaBaru,
					nip: nipBaru,
					dapodikPtkId: ptkIdBaru || undefined,
					updatedAt: timestamp
				})
				.where(eq(tablePegawai.id, pegawaiId));
		} else {
			// Jika belum terhubung ke data pegawai, cari atau buat
			const existingPegawai = await tx.query.tablePegawai.findFirst({
				where: sql`LOWER(trim(${tablePegawai.nama})) = ${namaBaru.toLowerCase()}`
			});

			if (existingPegawai) {
				pegawaiId = existingPegawai.id;
				await tx
					.update(tablePegawai)
					.set({
						nama: namaBaru,
						nip: nipBaru || existingPegawai.nip,
						dapodikPtkId: ptkIdBaru || existingPegawai.dapodikPtkId || undefined,
						updatedAt: timestamp
					})
					.where(eq(tablePegawai.id, pegawaiId));
			} else {
				const [p] = await tx
					.insert(tablePegawai)
					.values({
						nama: namaBaru,
						nip: nipBaru,
						sekolahId,
						dapodikPtkId: ptkIdBaru || null,
						createdAt: timestamp,
						updatedAt: timestamp
					})
					.returning({ id: tablePegawai.id });
				pegawaiId = p?.id ?? null;
			}
		}

		// Update data auth_user
		await tx
			.update(tableAuthUser)
			.set({
				namaLengkap: namaBaru,
				pegawaiId: pegawaiId ?? undefined,
				tempatLahir: tempatLahirBaru || null,
				tanggalLahir: tanggalLahirBaru || null,
				jenisKelamin:
					jenisKelaminBaru === 'L' || jenisKelaminBaru === 'P' ? jenisKelaminBaru : null,
				updatedAt: timestamp
			})
			.where(eq(tableAuthUser.id, userId));

		// Update data auth_zitadel_user jika ada
		if (zitadelUser) {
			await tx
				.update(tableAuthZitadelUser)
				.set({
					ptkId: ptkIdBaru || zitadelUser.ptkId,
					nip: nipBaru || zitadelUser.nip,
					nik: nikBaru || zitadelUser.nik,
					updatedAt: timestamp
				})
				.where(eq(tableAuthZitadelUser.userId, userId));
		}

		// Propagasi nama/NIP ke salinan denormalisasi wali asuh jika user adalah wali asuh
		const oldNamaKey = (currentUser.namaLengkap || currentUser.pegawai?.nama || '')
			.trim()
			.toLowerCase();
		const newNamaKey = namaBaru.toLowerCase();

		if (sekolahId && oldNamaKey && oldNamaKey !== newNamaKey) {
			await tx
				.update(tableMurid)
				.set({
					waliAsuhNama: namaBaru,
					waliAsuhNip: nipBaru || null
				})
				.where(
					and(
						sql`LOWER(trim(${tableMurid.waliAsuhNama})) = ${oldNamaKey}`,
						eq(tableMurid.sekolahId, sekolahId)
					)
				);
		} else if (sekolahId && (currentUser.pegawai?.nip || '') !== nipBaru) {
			await tx
				.update(tableMurid)
				.set({
					waliAsuhNip: nipBaru || null
				})
				.where(
					and(
						sql`LOWER(trim(${tableMurid.waliAsuhNama})) = ${newNamaKey}`,
						eq(tableMurid.sekolahId, sekolahId)
					)
				);
		}
	});

	return {
		namaLengkap: namaBaru,
		nip: nipBaru,
		tempatLahir: tempatLahirBaru,
		tanggalLahir: tanggalLahirBaru,
		jenisKelamin: jenisKelaminBaru,
		dapodikPtkId: ptkIdBaru
	};
}
