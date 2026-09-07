/**
 * AUTO-GENERATED FILE — JANGAN EDIT LANGSUNG!
 * File ini dihasilkan secara otomatis dari 'src/lib/server/db/schema.ts'
 * oleh skrip 'scripts/sync-pg-schema.mjs'.
 *
 * Jalankan 'pnpm db:pg:sync' setelah melakukan perubahan atau git pull dari upstream.
 */

import { relations } from 'drizzle-orm';
import {
	boolean,
	customType,
	index,
	integer,
	jsonb,
	pgTable,
	real,
	serial,
	text,
	unique,
	uniqueIndex
} from 'drizzle-orm/pg-core';

// Custom bytea type for binary blobs (e.g. logos)
const bytea = customType<{ data: Buffer | Uint8Array; driverData: Buffer }>({
	dataType() {
		return 'bytea';
	}
});

const audit = {
	createdAt: text()
		.$defaultFn(() => new Date().toISOString())
		.notNull(),
	updatedAt: text()
};

export const tableAuthUser = pgTable(
	'auth_user',
	{
		id: serial().primaryKey(),
		username: text().notNull(),
		usernameNormalized: text().notNull(),
		passwordHash: text().notNull(),
		passwordSalt: text().notNull(),
		passwordUpdatedAt: text(),
		// Sementara true saat akun masih memakai kata sandi default (mis. Admin/Admin123).
		// Login dipaksa untuk mengganti sandi lewat /pengaturan sebelum akses lain.
		mustChangePassword: boolean().default(false).notNull(),
		permissions: jsonb().notNull().default('[]').$type<UserPermission[]>(),
		// tipe user: admin (penuh), kepala_sekolah (penuh, per sekolah aktif), wali_kelas (terbatas ke kelas_id), wali_asuh (terbatas ke keasramaan), atau user (default/other)
		type: text({ enum: ['admin', 'kepala_sekolah', 'wali_kelas', 'wali_asuh', 'user'] })
			.notNull()
			.default('admin'),
		// optional: directly associate a user to a sekolah so login can pick it reliably
		sekolahId: integer().references(() => tableSekolah.id),
		// referensi opsional ke pegawai (nama wali kelas disimpan di tablePegawai)
		pegawaiId: integer().references(() => tablePegawai.id),
		// untuk wali_kelas kita bisa menyimpan kelas_id yang diijinkan
		kelasId: integer().references(() => tableKelas.id),
		// untuk akun tipe 'user' kita simpan pilihan mata pelajaran yang diassign saat pembuatan akun
		mataPelajaranId: integer().references(() => tableMataPelajaran.id),
		// Kunci API AI pribadi (wali_kelas/wali_asuh). Server-side only — jangan
		// pernah ikut payload locals.user; klien hanya melihat versi ter-mask.
		aiApiKey: text(),
		aiModel: text(),
		aiBaseUrl: text(),
		// Profil pribadi pengguna (diisi via /pengaturan/profil)
		namaLengkap: text(),
		tempatLahir: text(),
		tanggalLahir: text(),
		jenisKelamin: text({ enum: ['L', 'P'] }),
		ijazah: text(),
		tahunIjazah: integer(),
		statusKepegawaian: text({
			enum: ['CPNS', 'PNS', 'PPPK', 'Honor Pemda', 'Honorer Sekolah']
		}),
		golongan: text(),
		jabatan: text(),
		pangkat: text(),
		tanggalPangkat: text(),
		tanggalDiangkat: text(),
		tanggalBekerja: text(),
		tanggalGajiBerkala: text(),
		...audit
	},
	(table) => [unique().on(table.usernameNormalized)]
);

export const tableAuthSession = pgTable(
	'auth_session',
	{
		id: serial().primaryKey(),
		userId: integer()
			.references(() => tableAuthUser.id, { onDelete: 'cascade' })
			.notNull(),
		tokenHash: text().notNull(),
		userAgent: text(),
		ipAddress: text(),
		expiresAt: text().notNull(),
		...audit
	},
	(table) => [unique().on(table.tokenHash), index('auth_session_user_id_idx').on(table.userId)]
);

export const tableAuthZitadelUser = pgTable(
	'auth_zitadel_user',
	{
		id: serial().primaryKey(),
		userId: integer()
			.references(() => tableAuthUser.id, { onDelete: 'cascade' })
			.notNull(),
		zitadelUuid: text().notNull(),
		ptkId: text(),
		nip: text(),
		nik: text(),
		role: text(),
		isOnboarded: boolean().default(false).notNull(),
		rawMetadata: jsonb().$type<{
			ptk_id?: string;
			dapodik_id?: string;
			source?: string;
			academic_year_id?: string;
			role?: string;
			nik?: string;
			nip?: string;
			uuid?: string;
			[key: string]: unknown;
		}>(),
		lastLoginAt: text(),
		...audit
	},
	(table) => [
		unique().on(table.zitadelUuid),
		unique().on(table.userId),
		index('auth_zitadel_ptk_id_idx').on(table.ptkId),
		index('auth_zitadel_user_id_idx').on(table.userId)
	]
);

export const tableAlamat = pgTable('alamat', {
	id: serial().primaryKey(),
	jalan: text().notNull(),
	desa: text().notNull(),
	kecamatan: text().notNull(),
	kabupaten: text().notNull(),
	provinsi: text(),
	kodePos: text(),
	...audit
});

export const tablePegawai = pgTable('pegawai', {
	id: serial().primaryKey(),
	nama: text().notNull(),
	nip: text().notNull(),
	// Sekolah pemilik pegawai (null utk placeholder/belum ditetapkan). Dipakai
	// dapodik sync utk memisahkan data GTK antar sekolah.
	sekolahId: integer().references(() => tableSekolah.id),
	// Referensi Dapodik
	dapodikPtkId: text(),
	nuptk: text(),
	...audit
});

export const tableSekolah = pgTable('sekolah', {
	id: serial().primaryKey(),
	// include 'slb' and 'srt' as supported jenjang pendidikan
	jenjangPendidikan: text({ enum: ['sd', 'smp', 'sma', 'slb', 'pkbm', 'srt'] }).notNull(),
	// optional variant (e.g. mi, mts, smk, ma, mak, slb-dasar) stored as text
	jenjangVariant: text(),
	nama: text().notNull(),
	npsn: text().notNull(),
	alamatId: integer()
		.references(() => tableAlamat.id)
		.notNull(),
	logo: bytea().$type<Uint8Array>(),
	logoType: text(),
	logoDinas: bytea().$type<Uint8Array>(),
	logoDinasType: text(),
	website: text(),
	email: text().notNull(),
	kepalaSekolahId: integer()
		.references(() => tablePegawai.id)
		.notNull(),
	lokasiTandaTangan: text(),
	// Referensi Dapodik
	dapodikSekolahId: text(),
	// Naungan (organisasi pengelola sekolah)
	naungan: text({ enum: ['kemendikbud', 'kemsos', 'kemenag'] })
		.default('kemendikbud')
		.notNull(),
	// Default weight distribution for sumatif: lingkup 60%, STS 20%, SAS 20%
	sumatifBobotLingkup: integer().default(60).notNull(),
	sumatifBobotSts: integer().default(20).notNull(),
	sumatifBobotSas: integer().default(20).notNull(),
	// Rapor Tengah Semester weight distribution: lingkup 70%, STS 30%
	sumatifBobotRtsLingkup: integer().default(70).notNull(),
	sumatifBobotRtsSts: integer().default(30).notNull(),
	// Rapor: kriteria intrakurikuler (batas atas untuk kategori Cukup / Baik)
	raporKriteriaCukup: integer().default(85).notNull(),
	raporKriteriaBaik: integer().default(95).notNull(),
	// Status kepala sekolah: definitif atau PLT (Pelaksana Tugas)
	statusKepalaSekolah: text({ enum: ['definitif', 'plt'] })
		.default('definitif')
		.notNull(),
	...audit
});

export const tableFeatureUnlock = pgTable(
	'feature_unlock',
	{
		id: serial().primaryKey(),
		sekolahId: integer()
			.references(() => tableSekolah.id, { onDelete: 'cascade' })
			.notNull(),
		featureKey: text().notNull(),
		unlockedAt: text()
			.$defaultFn(() => new Date().toISOString())
			.notNull(),
		...audit
	},
	(table) => [unique().on(table.sekolahId, table.featureKey)]
);

export const tableTahunAjaran = pgTable(
	'tahun_ajaran',
	{
		id: serial().primaryKey(),
		sekolahId: integer()
			.references(() => tableSekolah.id)
			.notNull(),
		nama: text().notNull(),
		tanggalMulai: text(),
		tanggalSelesai: text(),
		isAktif: boolean().default(false).notNull(),
		// Referensi Dapodik (tahun_ajaran_id, mis. '2025')
		dapodikTahunAjaranId: text(),
		...audit
	},
	(table) => [unique().on(table.sekolahId, table.nama)]
);

export const tableSemester = pgTable(
	'semester',
	{
		id: serial().primaryKey(),
		tahunAjaranId: integer()
			.references(() => tableTahunAjaran.id, { onDelete: 'cascade' })
			.notNull(),
		tipe: text({ enum: ['ganjil', 'genap'] }).notNull(),
		nama: text().notNull(),
		tanggalMulai: text(),
		tanggalSelesai: text(),
		tanggalBagiRaport: text(),
		tanggalMasuk: text(),
		isAktif: boolean().default(false).notNull(),
		// Referensi Dapodik (semester_id, mis. '20251')
		dapodikSemesterId: text(),
		...audit
	},
	(table) => [unique().on(table.tahunAjaranId, table.tipe)]
);

export const tableKelas = pgTable(
	'kelas',
	{
		id: serial().primaryKey(),
		sekolahId: integer()
			.references(() => tableSekolah.id, { onDelete: 'cascade' })
			.notNull(),
		tahunAjaranId: integer()
			.references(() => tableTahunAjaran.id, { onDelete: 'cascade' })
			.notNull(),
		semesterId: integer()
			.references(() => tableSemester.id, { onDelete: 'cascade' })
			.notNull(),
		nama: text().notNull(),
		fase: text(),
		waliKelasId: integer().references(() => tablePegawai.id, { onDelete: 'set null' }),
		waliAsramaId: integer().references(() => tablePegawai.id, { onDelete: 'set null' }),
		waliAsuhId: integer().references(() => tablePegawai.id, { onDelete: 'set null' }),
		// Per-class rapor criteria. NULL = fall back to school-level values.
		raporKriteriaCukup: integer(),
		raporKriteriaBaik: integer(),
		// Referensi Dapodik (rombongan_belajar_id jenis_rombel 1, UUID)
		dapodikRombonganBelajarId: text(),
		...audit
	},
	(table) => [unique().on(table.sekolahId, table.semesterId, table.nama)]
);

export const tableTasks = pgTable('tasks', {
	id: serial().primaryKey(),
	sekolahId: integer()
		.references(() => tableSekolah.id, { onDelete: 'cascade' })
		.notNull(),
	kelasId: integer().references(() => tableKelas.id, { onDelete: 'cascade' }),
	title: text().notNull(),
	status: text({ enum: ['active', 'completed'] })
		.default('active')
		.notNull(),
	...audit
});

export const tableSekolahRelations = relations(tableSekolah, ({ one, many }) => ({
	alamat: one(tableAlamat, { fields: [tableSekolah.alamatId], references: [tableAlamat.id] }),
	kepalaSekolah: one(tablePegawai, {
		fields: [tableSekolah.kepalaSekolahId],
		references: [tablePegawai.id]
	}),
	tahunAjaran: many(tableTahunAjaran),
	tasks: many(tableTasks),
	featureUnlocks: many(tableFeatureUnlock),
	presensiSettings: one(tablePresensiSettings)
}));

export const tableFeatureUnlockRelations = relations(tableFeatureUnlock, ({ one }) => ({
	sekolah: one(tableSekolah, {
		fields: [tableFeatureUnlock.sekolahId],
		references: [tableSekolah.id]
	})
}));

export const tableTahunAjaranRelations = relations(tableTahunAjaran, ({ one, many }) => ({
	sekolah: one(tableSekolah, {
		fields: [tableTahunAjaran.sekolahId],
		references: [tableSekolah.id]
	}),
	semester: many(tableSemester)
}));

export const tableSemesterRelations = relations(tableSemester, ({ one }) => ({
	tahunAjaran: one(tableTahunAjaran, {
		fields: [tableSemester.tahunAjaranId],
		references: [tableTahunAjaran.id]
	})
}));

export const tableTasksRelations = relations(tableTasks, ({ one }) => ({
	sekolah: one(tableSekolah, {
		fields: [tableTasks.sekolahId],
		references: [tableSekolah.id]
	}),
	kelas: one(tableKelas, {
		fields: [tableTasks.kelasId],
		references: [tableKelas.id]
	})
}));

export const tableAuthUserRelations = relations(tableAuthUser, ({ many, one }) => ({
	sessions: many(tableAuthSession),
	// optional relation to pegawai (teacher/staff)
	pegawai: one(tablePegawai, { fields: [tableAuthUser.pegawaiId], references: [tablePegawai.id] }),
	// optional relation to kelas (for wali_kelas users)
	kelas: one(tableKelas, { fields: [tableAuthUser.kelasId], references: [tableKelas.id] }),
	// optional relation to a preferred mata pelajaran for 'user' accounts
	mataPelajaran: one(tableMataPelajaran, {
		fields: [tableAuthUser.mataPelajaranId],
		references: [tableMataPelajaran.id]
	}),
	// many-to-many: guru bisa mengajar multiple mata pelajaran
	mataPelajaranList: many(tableAuthUserMataPelajaran),
	// many-to-many: guru bisa mengakses multiple kelas
	kelasList: many(tableAuthUserKelas),
	// optional relation to a sekolah (when user was created for a specific sekolah)
	sekolah: one(tableSekolah, {
		fields: [tableAuthUser.sekolahId],
		references: [tableSekolah.id]
	}),
	// optional relation to zitadel sso account
	zitadelUser: one(tableAuthZitadelUser, {
		fields: [tableAuthUser.id],
		references: [tableAuthZitadelUser.userId]
	})
}));

export const tableAuthSessionRelations = relations(tableAuthSession, ({ one }) => ({
	user: one(tableAuthUser, {
		fields: [tableAuthSession.userId],
		references: [tableAuthUser.id]
	})
}));

export const tableAuthZitadelUserRelations = relations(tableAuthZitadelUser, ({ one }) => ({
	user: one(tableAuthUser, {
		fields: [tableAuthZitadelUser.userId],
		references: [tableAuthUser.id]
	})
}));

export const tableLoginAttempt = pgTable(
	'login_attempt',
	{
		id: serial().primaryKey(),
		// username normalized (lowercase); NULL saat percobaan tanpa username
		username: text(),
		ipAddress: text().notNull(),
		succeeded: boolean().default(false).notNull(),
		...audit
	},
	(table) => [
		index('login_attempt_username_idx').on(table.username),
		index('login_attempt_ip_idx').on(table.ipAddress),
		index('login_attempt_created_idx').on(table.createdAt)
	]
);

export const tableKelasRelations = relations(tableKelas, ({ one, many }) => ({
	sekolah: one(tableSekolah, { fields: [tableKelas.sekolahId], references: [tableSekolah.id] }),
	tahunAjaran: one(tableTahunAjaran, {
		fields: [tableKelas.tahunAjaranId],
		references: [tableTahunAjaran.id]
	}),
	semester: one(tableSemester, {
		fields: [tableKelas.semesterId],
		references: [tableSemester.id]
	}),
	waliKelas: one(tablePegawai, { fields: [tableKelas.waliKelasId], references: [tablePegawai.id] }),
	waliAsrama: one(tablePegawai, {
		fields: [tableKelas.waliAsramaId],
		references: [tablePegawai.id]
	}),
	waliAsuh: one(tablePegawai, {
		fields: [tableKelas.waliAsuhId],
		references: [tablePegawai.id]
	}),
	// many-to-many: kelas bisa diakses oleh multiple guru
	authUsers: many(tableAuthUserKelas)
}));

export const tableWaliMurid = pgTable('wali_murid', {
	id: serial().primaryKey(),
	nama: text().notNull(),
	pekerjaan: text().notNull(),
	kontak: text(),
	alamat: text(),
	...audit
});

export const tableMurid = pgTable(
	'murid',
	{
		id: serial().primaryKey(),
		nis: text().notNull(),
		nisn: text().notNull(),
		sekolahId: integer()
			.references(() => tableSekolah.id)
			.notNull(),
		semesterId: integer()
			.references(() => tableSemester.id, { onDelete: 'cascade' })
			.notNull(),
		kelasId: integer()
			.references(() => tableKelas.id)
			.notNull(),
		nama: text().notNull(),
		tempatLahir: text().notNull(),
		tanggalLahir: text().notNull(),
		jenisKelamin: text({ enum: ['L', 'P'] }).notNull(),
		agama: text().notNull(),
		pendidikanSebelumnya: text().notNull(),
		tanggalMasuk: text().notNull(),
		alamatId: integer()
			.references(() => tableAlamat.id)
			.notNull(),
		ibuId: integer().references(() => tableWaliMurid.id),
		ayahId: integer().references(() => tableWaliMurid.id),
		waliId: integer().references(() => tableWaliMurid.id),
		// optional: path/filename (or url) ke foto murid
		foto: text(),
		// wali asuh (nama + nip) per murid, bukan per kelas
		waliAsuhNama: text(),
		waliAsuhNip: text(),
		// Referensi Dapodik
		dapodikPesertaDidikId: text(),
		dapodikAnggotaRombelId: text(),
		nik: text(),
		anakKe: integer(),
		...audit
	},
	(t) => [unique().on(t.sekolahId, t.semesterId, t.nis)]
);

export const tableCatatanWaliKelas = pgTable(
	'catatan_wali_kelas',
	{
		id: serial().primaryKey(),
		muridId: integer()
			.references(() => tableMurid.id, { onDelete: 'cascade' })
			.notNull(),
		catatan: text(),
		...audit
	},
	(table) => [unique().on(table.muridId), index('catatan_wali_kelas_murid_idx').on(table.muridId)]
);

export const tableKehadiranMurid = pgTable(
	'kehadiran_murid',
	{
		id: serial().primaryKey(),
		muridId: integer()
			.references(() => tableMurid.id, { onDelete: 'cascade' })
			.notNull(),
		sakit: integer().default(0).notNull(),
		izin: integer().default(0).notNull(),
		alfa: integer().default(0).notNull(),
		...audit
	},
	(table) => [unique().on(table.muridId), index('kehadiran_murid_murid_idx').on(table.muridId)]
);

export const tableMuridRelations = relations(tableMurid, ({ one, many }) => ({
	kelas: one(tableKelas, { fields: [tableMurid.kelasId], references: [tableKelas.id] }),
	semester: one(tableSemester, { fields: [tableMurid.semesterId], references: [tableSemester.id] }),
	alamat: one(tableAlamat, { fields: [tableMurid.alamatId], references: [tableAlamat.id] }),
	ibu: one(tableWaliMurid, { fields: [tableMurid.ibuId], references: [tableWaliMurid.id] }),
	ayah: one(tableWaliMurid, { fields: [tableMurid.ayahId], references: [tableWaliMurid.id] }),
	wali: one(tableWaliMurid, { fields: [tableMurid.waliId], references: [tableWaliMurid.id] }),
	kehadiran: one(tableKehadiranMurid, {
		fields: [tableMurid.id],
		references: [tableKehadiranMurid.muridId]
	}),
	catatanWali: one(tableCatatanWaliKelas, {
		fields: [tableMurid.id],
		references: [tableCatatanWaliKelas.muridId]
	}),
	keputusan: one(tableKeputusanMurid, {
		fields: [tableMurid.id],
		references: [tableKeputusanMurid.muridId]
	}),
	muridMataPelajaran: many(tableMuridMataPelajaran),
	absensi: many(tableAbsensi),
	ketidakhadiranHarian: many(tableKetidakhadiranHarian)
}));

export const tableCatatanWaliKelasRelations = relations(tableCatatanWaliKelas, ({ one }) => ({
	murid: one(tableMurid, {
		fields: [tableCatatanWaliKelas.muridId],
		references: [tableMurid.id]
	})
}));

export const tableKehadiranMuridRelations = relations(tableKehadiranMurid, ({ one }) => ({
	murid: one(tableMurid, {
		fields: [tableKehadiranMurid.muridId],
		references: [tableMurid.id]
	})
}));

export const tableKeputusanMurid = pgTable(
	'keputusan_murid',
	{
		id: serial().primaryKey(),
		muridId: integer()
			.references(() => tableMurid.id, { onDelete: 'cascade' })
			.notNull(),
		naik: boolean().default(true).notNull(),
		...audit
	},
	(table) => [unique().on(table.muridId), index('keputusan_murid_murid_idx').on(table.muridId)]
);

export const tableKeputusanMuridRelations = relations(tableKeputusanMurid, ({ one }) => ({
	murid: one(tableMurid, {
		fields: [tableKeputusanMurid.muridId],
		references: [tableMurid.id]
	})
}));

// Join table untuk many-to-many relationship antara auth_user dan mata_pelajaran
// Memungkinkan satu guru mengajar multiple mata pelajaran
export const tableAuthUserMataPelajaran = pgTable(
	'auth_user_mata_pelajaran',
	{
		id: serial().primaryKey(),
		authUserId: integer()
			.references(() => tableAuthUser.id, { onDelete: 'cascade' })
			.notNull(),
		mataPelajaranId: integer()
			.references(() => tableMataPelajaran.id, { onDelete: 'cascade' })
			.notNull(),
		...audit
	},
	(table) => [
		unique().on(table.authUserId, table.mataPelajaranId),
		index('auth_user_mata_pelajaran_user_idx').on(table.authUserId),
		index('auth_user_mata_pelajaran_mapel_idx').on(table.mataPelajaranId)
	]
);

// Join table untuk many-to-many relationship antara auth_user dan kelas
// Memungkinkan satu guru mengakses multiple kelas (dengan permission kelas_pindah)
export const tableAuthUserKelas = pgTable(
	'auth_user_kelas',
	{
		id: serial().primaryKey(),
		authUserId: integer()
			.references(() => tableAuthUser.id, { onDelete: 'cascade' })
			.notNull(),
		kelasId: integer()
			.references(() => tableKelas.id, { onDelete: 'cascade' })
			.notNull(),
		...audit
	},
	(table) => [
		unique().on(table.authUserId, table.kelasId),
		index('auth_user_kelas_user_idx').on(table.authUserId),
		index('auth_user_kelas_kelas_idx').on(table.kelasId)
	]
);

export const tableMataPelajaran = pgTable(
	'mata_pelajaran',
	{
		id: serial().primaryKey(),
		kelasId: integer()
			.references(() => tableKelas.id)
			.notNull(),
		nama: text().notNull(),
		// Nama lokal tampilan (mis. nama mapel lokal Dapodik). NULL = pakai `nama`.
		namaLokal: text(),
		// optional short code for subjects (e.g. PAPB for Pendidikan Agama dan Budi Pekerti)
		kode: text(),
		kkm: integer().notNull().default(0),
		jenis: text({
			enum: ['belum_dipetakan', 'wajib', 'pilihan', 'mulok', 'kejuruan', 'pemberdayaan']
		}).notNull(),
		// Guru pengampu (hasil sinkronisasi pembelajaran Dapodik)
		pengampuId: integer().references(() => tablePegawai.id, { onDelete: 'set null' }),
		// Nomor urut tampil mapel (tabel intrakurikuler & cetak rapor). NULL = belum diatur → tampil terakhir.
		urutan: integer(),
		// Referensi Dapodik
		dapodikPembelajaranId: text(),
		dapodikMataPelajaranId: text(),
		// Pembelajaran induk pilihan (Sub Pembelajaran) saat kirim matev ke Dapodik.
		dapodikIndukPembelajaranId: text(),
		...audit
	},
	(table) => [unique().on(table.kelasId, table.nama)]
);

export const tableTujuanPembelajaran = pgTable('tujuan_pembelajaran', {
	id: serial().primaryKey(),
	mataPelajaranId: integer()
		.references(() => tableMataPelajaran.id)
		.notNull(),
	deskripsi: text().notNull(),
	lingkupMateri: text().notNull(),
	bobot: real().default(0).notNull(),
	...audit
});

export const tableAsesmenSumatif = pgTable(
	'asesmen_sumatif',
	{
		id: serial().primaryKey(),
		muridId: integer()
			.references(() => tableMurid.id, { onDelete: 'cascade' })
			.notNull(),
		mataPelajaranId: integer()
			.references(() => tableMataPelajaran.id, { onDelete: 'cascade' })
			.notNull(),
		naLingkup: real(),
		stsTes: real(),
		stsNonTes: real(),
		sts: real(),
		sasTes: real(),
		sasNonTes: real(),
		sas: real(),
		nilaiAkhir: real(),
		nilaiAkhirRts: real(),
		...audit
	},
	(table) => [
		unique().on(table.muridId, table.mataPelajaranId),
		index('asesmen_sumatif_murid_idx').on(table.muridId),
		index('asesmen_sumatif_mapel_idx').on(table.mataPelajaranId)
	]
);

export const tableAsesmenSumatifTujuan = pgTable(
	'asesmen_sumatif_tujuan',
	{
		id: serial().primaryKey(),
		muridId: integer()
			.references(() => tableMurid.id, { onDelete: 'cascade' })
			.notNull(),
		mataPelajaranId: integer()
			.references(() => tableMataPelajaran.id, { onDelete: 'cascade' })
			.notNull(),
		tujuanPembelajaranId: integer()
			.references(() => tableTujuanPembelajaran.id, { onDelete: 'cascade' })
			.notNull(),
		nilai: real(),
		...audit
	},
	(table) => [
		unique().on(table.muridId, table.tujuanPembelajaranId),
		index('asesmen_sumatif_tujuan_murid_idx').on(table.muridId),
		index('asesmen_sumatif_tujuan_mapel_idx').on(table.mataPelajaranId),
		index('asesmen_sumatif_tujuan_tp_idx').on(table.tujuanPembelajaranId)
	]
);

export const tableAsesmenFormatif = pgTable(
	'asesmen_formatif',
	{
		id: serial().primaryKey(),
		muridId: integer()
			.references(() => tableMurid.id, { onDelete: 'cascade' })
			.notNull(),
		mataPelajaranId: integer()
			.references(() => tableMataPelajaran.id, { onDelete: 'cascade' })
			.notNull(),
		tujuanPembelajaranId: integer()
			.references(() => tableTujuanPembelajaran.id, { onDelete: 'cascade' })
			.notNull(),
		tuntas: boolean().default(false).notNull(),
		catatan: text(),
		dinilaiPada: text(),
		...audit
	},
	(table) => [unique().on(table.muridId, table.tujuanPembelajaranId)]
);

export const tableMataPelajaranRelations = relations(tableMataPelajaran, ({ one, many }) => ({
	tujuanPembelajaran: many(tableTujuanPembelajaran),
	asesmenFormatif: many(tableAsesmenFormatif),
	asesmenSumatif: many(tableAsesmenSumatif),
	asesmenSumatifTujuan: many(tableAsesmenSumatifTujuan),
	kelas: one(tableKelas, { fields: [tableMataPelajaran.kelasId], references: [tableKelas.id] }),
	pengampu: one(tablePegawai, {
		fields: [tableMataPelajaran.pengampuId],
		references: [tablePegawai.id]
	}),
	// many-to-many: mata pelajaran bisa diajar oleh multiple guru
	authUsers: many(tableAuthUserMataPelajaran),
	muridMataPelajaran: many(tableMuridMataPelajaran)
}));

export const tableTujuanPembelajaranRelations = relations(tableTujuanPembelajaran, ({ one }) => ({
	mataPelajaran: one(tableMataPelajaran, {
		fields: [tableTujuanPembelajaran.mataPelajaranId],
		references: [tableMataPelajaran.id]
	})
}));

export const tableAuthUserMataPelajaranRelations = relations(
	tableAuthUserMataPelajaran,
	({ one }) => ({
		authUser: one(tableAuthUser, {
			fields: [tableAuthUserMataPelajaran.authUserId],
			references: [tableAuthUser.id]
		}),
		mataPelajaran: one(tableMataPelajaran, {
			fields: [tableAuthUserMataPelajaran.mataPelajaranId],
			references: [tableMataPelajaran.id]
		})
	})
);

export const tableAuthUserKelasRelations = relations(tableAuthUserKelas, ({ one }) => ({
	authUser: one(tableAuthUser, {
		fields: [tableAuthUserKelas.authUserId],
		references: [tableAuthUser.id]
	}),
	kelas: one(tableKelas, {
		fields: [tableAuthUserKelas.kelasId],
		references: [tableKelas.id]
	})
}));

export const tableAsesmenFormatifRelations = relations(tableAsesmenFormatif, ({ one }) => ({
	murid: one(tableMurid, {
		fields: [tableAsesmenFormatif.muridId],
		references: [tableMurid.id]
	}),
	mataPelajaran: one(tableMataPelajaran, {
		fields: [tableAsesmenFormatif.mataPelajaranId],
		references: [tableMataPelajaran.id]
	}),
	tujuanPembelajaran: one(tableTujuanPembelajaran, {
		fields: [tableAsesmenFormatif.tujuanPembelajaranId],
		references: [tableTujuanPembelajaran.id]
	})
}));

export const tableAsesmenSumatifRelations = relations(tableAsesmenSumatif, ({ one }) => ({
	murid: one(tableMurid, {
		fields: [tableAsesmenSumatif.muridId],
		references: [tableMurid.id]
	}),
	mataPelajaran: one(tableMataPelajaran, {
		fields: [tableAsesmenSumatif.mataPelajaranId],
		references: [tableMataPelajaran.id]
	})
}));

export const tableAsesmenSumatifTujuanRelations = relations(
	tableAsesmenSumatifTujuan,
	({ one }) => ({
		murid: one(tableMurid, {
			fields: [tableAsesmenSumatifTujuan.muridId],
			references: [tableMurid.id]
		}),
		mataPelajaran: one(tableMataPelajaran, {
			fields: [tableAsesmenSumatifTujuan.mataPelajaranId],
			references: [tableMataPelajaran.id]
		}),
		tujuanPembelajaran: one(tableTujuanPembelajaran, {
			fields: [tableAsesmenSumatifTujuan.tujuanPembelajaranId],
			references: [tableTujuanPembelajaran.id]
		})
	})
);

export const tableEkstrakurikuler = pgTable(
	'ekstrakurikuler',
	{
		id: serial().primaryKey(),
		nama: text().notNull(),
		kelasId: integer()
			.references(() => tableKelas.id)
			.notNull(),
		...audit
	},
	(table) => [unique().on(table.kelasId, table.nama)]
);

export const tableMuridEkstrakurikuler = pgTable(
	'murid_ekstrakurikuler',
	{
		id: serial().primaryKey(),
		muridId: integer()
			.references(() => tableMurid.id, { onDelete: 'cascade' })
			.notNull(),
		ekstrakurikulerId: integer()
			.references(() => tableEkstrakurikuler.id, { onDelete: 'cascade' })
			.notNull(),
		nilaiKosong: integer().notNull().default(0),
		...audit
	},
	(table) => [
		unique().on(table.muridId, table.ekstrakurikulerId),
		index('murid_ekstrakurikuler_murid_idx').on(table.muridId),
		index('murid_ekstrakurikuler_ekstrak_idx').on(table.ekstrakurikulerId)
	]
);

export const tableMuridMataPelajaran = pgTable(
	'murid_mata_pelajaran',
	{
		id: serial().primaryKey(),
		muridId: integer()
			.references(() => tableMurid.id, { onDelete: 'cascade' })
			.notNull(),
		mataPelajaranId: integer()
			.references(() => tableMataPelajaran.id, { onDelete: 'cascade' })
			.notNull(),
		nilaiKosong: integer().notNull().default(0),
		...audit
	},
	(table) => [
		unique().on(table.muridId, table.mataPelajaranId),
		index('murid_mata_pelajaran_murid_idx').on(table.muridId),
		index('murid_mata_pelajaran_mapel_idx').on(table.mataPelajaranId)
	]
);

export const tableEkstrakurikulerTujuan = pgTable('ekstrakurikuler_tujuan', {
	id: serial().primaryKey(),
	ekstrakurikulerId: integer()
		.references(() => tableEkstrakurikuler.id, { onDelete: 'cascade' })
		.notNull(),
	deskripsi: text().notNull(),
	...audit
});

export const tableAsesmenEkstrakurikuler = pgTable(
	'asesmen_ekstrakurikuler',
	{
		id: serial().primaryKey(),
		muridId: integer()
			.references(() => tableMurid.id, { onDelete: 'cascade' })
			.notNull(),
		ekstrakurikulerId: integer()
			.references(() => tableEkstrakurikuler.id, { onDelete: 'cascade' })
			.notNull(),
		tujuanId: integer()
			.references(() => tableEkstrakurikulerTujuan.id, { onDelete: 'cascade' })
			.notNull(),
		kategori: text({ enum: ['sangat-baik', 'baik', 'cukup', 'perlu-bimbingan'] }).notNull(),
		dinilaiPada: text(),
		...audit
	},
	(table) => [
		unique().on(table.muridId, table.ekstrakurikulerId, table.tujuanId),
		index('asesmen_ekstrakurikuler_murid_idx').on(table.muridId),
		index('asesmen_ekstrakurikuler_ekstrak_idx').on(table.ekstrakurikulerId),
		index('asesmen_ekstrakurikuler_tujuan_idx').on(table.tujuanId)
	]
);

export const tableKokurikuler = pgTable('kokurikuler', {
	id: serial().primaryKey(),
	kelasId: integer()
		.references(() => tableKelas.id)
		.notNull(),
	kode: text().notNull().unique(),
	dimensi: jsonb().$type<string[]>().notNull(),
	tujuan: text().notNull(),
	...audit
});

export const tableEkstrakurikulerRelations = relations(tableEkstrakurikuler, ({ one, many }) => ({
	kelas: one(tableKelas, {
		fields: [tableEkstrakurikuler.kelasId],
		references: [tableKelas.id]
	}),
	tujuan: many(tableEkstrakurikulerTujuan),
	asesmen: many(tableAsesmenEkstrakurikuler),
	muridEkstrakurikuler: many(tableMuridEkstrakurikuler)
}));

export const tableMuridEkstrakurikulerRelations = relations(
	tableMuridEkstrakurikuler,
	({ one }) => ({
		murid: one(tableMurid, {
			fields: [tableMuridEkstrakurikuler.muridId],
			references: [tableMurid.id]
		}),
		ekstrakurikuler: one(tableEkstrakurikuler, {
			fields: [tableMuridEkstrakurikuler.ekstrakurikulerId],
			references: [tableEkstrakurikuler.id]
		})
	})
);

export const tableMuridMataPelajaranRelations = relations(tableMuridMataPelajaran, ({ one }) => ({
	murid: one(tableMurid, {
		fields: [tableMuridMataPelajaran.muridId],
		references: [tableMurid.id]
	}),
	mataPelajaran: one(tableMataPelajaran, {
		fields: [tableMuridMataPelajaran.mataPelajaranId],
		references: [tableMataPelajaran.id]
	})
}));

export const tableEkstrakurikulerTujuanRelations = relations(
	tableEkstrakurikulerTujuan,
	({ one, many }) => ({
		ekstrakurikuler: one(tableEkstrakurikuler, {
			fields: [tableEkstrakurikulerTujuan.ekstrakurikulerId],
			references: [tableEkstrakurikuler.id]
		}),
		asesmen: many(tableAsesmenEkstrakurikuler)
	})
);

export const tableAsesmenEkstrakurikulerRelations = relations(
	tableAsesmenEkstrakurikuler,
	({ one }) => ({
		murid: one(tableMurid, {
			fields: [tableAsesmenEkstrakurikuler.muridId],
			references: [tableMurid.id]
		}),
		ekstrakurikuler: one(tableEkstrakurikuler, {
			fields: [tableAsesmenEkstrakurikuler.ekstrakurikulerId],
			references: [tableEkstrakurikuler.id]
		}),
		tujuan: one(tableEkstrakurikulerTujuan, {
			fields: [tableAsesmenEkstrakurikuler.tujuanId],
			references: [tableEkstrakurikulerTujuan.id]
		})
	})
);

export const tableKokurikulerRelations = relations(tableKokurikuler, ({ one }) => ({
	kelas: one(tableKelas, {
		fields: [tableKokurikuler.kelasId],
		references: [tableKelas.id]
	})
}));

export const tableAsesmenKokurikuler = pgTable(
	'asesmen_kokurikuler',
	{
		id: serial().primaryKey(),
		muridId: integer()
			.references(() => tableMurid.id, { onDelete: 'cascade' })
			.notNull(),
		kokurikulerId: integer()
			.references(() => tableKokurikuler.id, { onDelete: 'cascade' })
			.notNull(),
		dimensi: text().notNull(),
		kategori: text({ enum: ['sangat-baik', 'baik', 'cukup', 'perlu-bimbingan'] }).notNull(),
		dinilaiPada: text(),
		...audit
	},
	(table) => [
		unique().on(table.muridId, table.kokurikulerId, table.dimensi),
		index('asesmen_kokurikuler_murid_idx').on(table.muridId),
		index('asesmen_kokurikuler_kokurikuler_idx').on(table.kokurikulerId)
	]
);

export const tableAsesmenKokurikulerRelations = relations(tableAsesmenKokurikuler, ({ one }) => ({
	murid: one(tableMurid, {
		fields: [tableAsesmenKokurikuler.muridId],
		references: [tableMurid.id]
	}),
	kokurikuler: one(tableKokurikuler, {
		fields: [tableAsesmenKokurikuler.kokurikulerId],
		references: [tableKokurikuler.id]
	})
}));

export const tablePresensiSettings = pgTable(
	'presensi_settings',
	{
		id: serial().primaryKey(),
		sekolahId: integer()
			.references(() => tableSekolah.id, { onDelete: 'cascade' })
			.notNull(),
		tahunAjaranId: integer()
			.references(() => tableTahunAjaran.id, { onDelete: 'cascade' })
			.notNull(),
		jamMasuk: text().notNull().default('07:30'),
		jamPulang: text().notNull().default('15:00'),
		hariSekolah: integer().notNull().default(6),
		hariSekolahCustom: text(),
		tipePresensi: text({ enum: ['masuk_pulang', 'masuk_saja', 'awal_mapel', 'awal_akhir_mapel'] })
			.notNull()
			.default('masuk_pulang'),
		liburNasional: text().notNull().default('[]'),
		liburSemester: text().notNull().default('[]'),
		jenisPresensi: text({ enum: ['wali_kelas_saja', 'tiap_mapel'] })
			.notNull()
			.default('wali_kelas_saja'),
		presensiGuruEnabled: boolean().notNull().default(true),
		...audit
	},
	(table) => [unique().on(table.sekolahId, table.tahunAjaranId)]
);

export const tablePresensiSettingsRelations = relations(tablePresensiSettings, ({ one }) => ({
	sekolah: one(tableSekolah, {
		fields: [tablePresensiSettings.sekolahId],
		references: [tableSekolah.id]
	}),
	tahunAjaran: one(tableTahunAjaran, {
		fields: [tablePresensiSettings.tahunAjaranId],
		references: [tableTahunAjaran.id]
	})
}));

export const tableKeasramaan = pgTable(
	'keasramaan',
	{
		id: serial().primaryKey(),
		nama: text().notNull(),
		kelasId: integer()
			.references(() => tableKelas.id)
			.notNull(),
		...audit
	},
	(table) => [unique().on(table.kelasId, table.nama)]
);

export const tableKeasramaanIndikator = pgTable('keasramaan_indikator', {
	id: serial().primaryKey(),
	keasramaanId: integer()
		.references(() => tableKeasramaan.id, { onDelete: 'cascade' })
		.notNull(),
	deskripsi: text().notNull(),
	...audit
});

export const tableKeasramaanRelations = relations(tableKeasramaan, ({ one, many }) => ({
	kelas: one(tableKelas, {
		fields: [tableKeasramaan.kelasId],
		references: [tableKelas.id]
	}),
	indikator: many(tableKeasramaanIndikator),
	asesmen: many(tableAsesmenKeasramaan)
}));

export const tableKeasramaanIndikatorRelations = relations(
	tableKeasramaanIndikator,
	({ one, many }) => ({
		keasramaan: one(tableKeasramaan, {
			fields: [tableKeasramaanIndikator.keasramaanId],
			references: [tableKeasramaan.id]
		}),
		tujuan: many(tableKeasramaanTujuan)
	})
);

export const tableKeasramaanTujuan = pgTable('keasramaan_tujuan', {
	id: serial().primaryKey(),
	indikatorId: integer()
		.references(() => tableKeasramaanIndikator.id, { onDelete: 'cascade' })
		.notNull(),
	deskripsi: text().notNull(),
	...audit
});

export const tableKeasramaanTujuanRelations = relations(tableKeasramaanTujuan, ({ one, many }) => ({
	indikator: one(tableKeasramaanIndikator, {
		fields: [tableKeasramaanTujuan.indikatorId],
		references: [tableKeasramaanIndikator.id]
	}),
	asesmen: many(tableAsesmenKeasramaan)
}));

export const tableAsesmenKeasramaan = pgTable(
	'asesmen_keasramaan',
	{
		id: serial().primaryKey(),
		muridId: integer()
			.references(() => tableMurid.id, { onDelete: 'cascade' })
			.notNull(),
		keasramaanId: integer()
			.references(() => tableKeasramaan.id, { onDelete: 'cascade' })
			.notNull(),
		tujuanId: integer()
			.references(() => tableKeasramaanTujuan.id, { onDelete: 'cascade' })
			.notNull(),
		kategori: text({ enum: ['sangat-baik', 'baik', 'cukup', 'perlu-bimbingan'] }).notNull(),
		dinilaiPada: text(),
		...audit
	},
	(table) => [
		unique().on(table.muridId, table.keasramaanId, table.tujuanId),
		index('asesmen_keasramaan_murid_idx').on(table.muridId),
		index('asesmen_keasramaan_keasramaan_idx').on(table.keasramaanId),
		index('asesmen_keasramaan_tujuan_idx').on(table.tujuanId)
	]
);

export const tableAsesmenKeasramaanRelations = relations(tableAsesmenKeasramaan, ({ one }) => ({
	murid: one(tableMurid, {
		fields: [tableAsesmenKeasramaan.muridId],
		references: [tableMurid.id]
	}),
	keasramaan: one(tableKeasramaan, {
		fields: [tableAsesmenKeasramaan.keasramaanId],
		references: [tableKeasramaan.id]
	}),
	tujuan: one(tableKeasramaanTujuan, {
		fields: [tableAsesmenKeasramaan.tujuanId],
		references: [tableKeasramaanTujuan.id]
	})
}));

export const tableAbsensi = pgTable(
	'absensi',
	{
		id: serial().primaryKey(),
		muridId: integer()
			.references(() => tableMurid.id, { onDelete: 'cascade' })
			.notNull(),
		mataPelajaranId: integer().references(() => tableMataPelajaran.id, { onDelete: 'set null' }),
		waktu: text().notNull(),
		...audit
	},
	(table) => [index('absensi_murid_waktu_idx').on(table.muridId, table.waktu)]
);

export const tableAbsensiRelations = relations(tableAbsensi, ({ one }) => ({
	murid: one(tableMurid, {
		fields: [tableAbsensi.muridId],
		references: [tableMurid.id]
	})
}));

export const tableKetidakhadiranHarian = pgTable(
	'ketidakhadiran_harian',
	{
		id: serial().primaryKey(),
		muridId: integer()
			.references(() => tableMurid.id, { onDelete: 'cascade' })
			.notNull(),
		tanggal: text().notNull(),
		mataPelajaranId: integer().references(() => tableMataPelajaran.id, { onDelete: 'set null' }),
		keterangan: text(),
		keteranganPulang: text(),
		...audit
	},
	(table) => [
		uniqueIndex('ketidakhadiran_murid_tanggal_mapel_idx').on(
			table.muridId,
			table.tanggal,
			table.mataPelajaranId
		)
	]
);

export const tableKetidakhadiranHarianRelations = relations(
	tableKetidakhadiranHarian,
	({ one }) => ({
		murid: one(tableMurid, {
			fields: [tableKetidakhadiranHarian.muridId],
			references: [tableMurid.id]
		})
	})
);

export const tableKetidakhadiranRapor = pgTable(
	'ketidakhadiran_rapor',
	{
		id: serial().primaryKey(),
		muridId: integer()
			.references(() => tableMurid.id, { onDelete: 'cascade' })
			.notNull(),
		semesterId: integer()
			.references(() => tableSemester.id, { onDelete: 'cascade' })
			.notNull(),
		sakit: integer(),
		izin: integer(),
		alfa: integer(),
		...audit
	},
	(table) => [
		uniqueIndex('ketidakhadiran_rapor_murid_semester_idx').on(table.muridId, table.semesterId)
	]
);

export const tableKetidakhadiranRaporRelations = relations(tableKetidakhadiranRapor, ({ one }) => ({
	murid: one(tableMurid, {
		fields: [tableKetidakhadiranRapor.muridId],
		references: [tableMurid.id]
	}),
	semester: one(tableSemester, {
		fields: [tableKetidakhadiranRapor.semesterId],
		references: [tableSemester.id]
	})
}));

export const tableBellSettings = pgTable(
	'bell_settings',
	{
		id: serial().primaryKey(),
		sekolahId: integer()
			.notNull()
			.references(() => tableSekolah.id),
		jamPelajaranMenit: integer().notNull().default(35),
		durasiIstirahat: integer().notNull().default(30),
		durasiUpacara: integer().notNull().default(70),
		jamMulai: text().notNull().default('07:00'),
		isActive: integer().notNull().default(0),
		...audit
	},
	(table) => [uniqueIndex('bell_settings_sekolah_idx').on(table.sekolahId)]
);

export const tableKegiatanCustom = pgTable(
	'kegiatan_custom',
	{
		id: serial().primaryKey(),
		sekolahId: integer()
			.notNull()
			.references(() => tableSekolah.id),
		nama: text().notNull(),
		kode: text().notNull(),
		durasi: integer(),
		soundFileName: text(),
		soundMimeType: text(),
		...audit
	},
	(table) => [uniqueIndex('kegiatan_custom_sekolah_kode_idx').on(table.sekolahId, table.kode)]
);

export const tableBellSounds = pgTable(
	'bell_sounds',
	{
		id: serial().primaryKey(),
		sekolahId: integer()
			.notNull()
			.references(() => tableSekolah.id),
		tipe: text().notNull(),
		fileName: text().notNull(),
		mimeType: text().notNull().default('audio/mpeg'),
		ttsMessage: text(),
		...audit
	},
	(table) => [uniqueIndex('bell_sounds_sekolah_tipe_idx').on(table.sekolahId, table.tipe)]
);

export const tableUserFavorites = pgTable(
	'user_favorites',
	{
		id: serial().primaryKey(),
		userId: integer()
			.references(() => tableAuthUser.id, { onDelete: 'cascade' })
			.notNull(),
		path: text().notNull(),
		title: text().notNull(),
		...audit
	},
	(table) => [
		unique().on(table.userId, table.path),
		index('user_favorites_user_idx').on(table.userId)
	]
);

export const tableUserFavoritesRelations = relations(tableUserFavorites, ({ one }) => ({
	user: one(tableAuthUser, {
		fields: [tableUserFavorites.userId],
		references: [tableAuthUser.id]
	})
}));

export const tableJurnalMengajar = pgTable(
	'jurnal_mengajar',
	{
		id: serial().primaryKey(),
		authUserId: integer()
			.references(() => tableAuthUser.id, { onDelete: 'cascade' })
			.notNull(),
		kelasId: integer()
			.references(() => tableKelas.id, { onDelete: 'cascade' })
			.notNull(),
		mataPelajaranId: integer()
			.references(() => tableMataPelajaran.id, { onDelete: 'cascade' })
			.notNull(),
		tanggal: text().notNull(),
		jamPelajaran: text().notNull(),
		lingkupMateri: text().notNull(),
		tujuanPembelajaranId: integer().references(() => tableTujuanPembelajaran.id, {
			onDelete: 'set null'
		}),
		catatan: text(),
		...audit
	},
	(table) => [index('jurnal_mengajar_auth_user_idx').on(table.authUserId)]
);

export const tableJurnalMengajarRelations = relations(tableJurnalMengajar, ({ one }) => ({
	authUser: one(tableAuthUser, {
		fields: [tableJurnalMengajar.authUserId],
		references: [tableAuthUser.id]
	}),
	kelas: one(tableKelas, {
		fields: [tableJurnalMengajar.kelasId],
		references: [tableKelas.id]
	}),
	mataPelajaran: one(tableMataPelajaran, {
		fields: [tableJurnalMengajar.mataPelajaranId],
		references: [tableMataPelajaran.id]
	}),
	tujuanPembelajaran: one(tableTujuanPembelajaran, {
		fields: [tableJurnalMengajar.tujuanPembelajaranId],
		references: [tableTujuanPembelajaran.id]
	})
}));

export const tableJadwalPelajaran = pgTable(
	'jadwal_pelajaran',
	{
		id: serial().primaryKey(),
		sekolahId: integer()
			.notNull()
			.references(() => tableSekolah.id),
		hari: text().notNull(),
		jamKe: integer().notNull(),
		kodeKegiatan: text().notNull(),
		kelasId: integer()
			.notNull()
			.references(() => tableKelas.id),
		...audit
	},
	(table) => [
		uniqueIndex('jadwal_pelajaran_uniq_idx').on(
			table.sekolahId,
			table.hari,
			table.jamKe,
			table.kelasId
		)
	]
);

export const tablePresensiGuru = pgTable(
	'presensi_guru',
	{
		id: serial().primaryKey(),
		sekolahId: integer()
			.references(() => tableSekolah.id, { onDelete: 'cascade' })
			.notNull(),
		tahunAjaranId: integer()
			.references(() => tableTahunAjaran.id, { onDelete: 'cascade' })
			.notNull(),
		semesterId: integer()
			.references(() => tableSemester.id, { onDelete: 'cascade' })
			.notNull(),
		authUserId: integer()
			.references(() => tableAuthUser.id, { onDelete: 'cascade' })
			.notNull(),
		tanggal: text().notNull(),
		status: text({ enum: ['hadir', 'izin', 'sakit', 'dinas_luar', 'cuti'] }).notNull(),
		// ISO timestamp saat presensi dicatat
		waktu: text()
			.$defaultFn(() => new Date().toISOString())
			.notNull(),
		tandaTangan: text(),
		keterangan: text(),
		...audit
	},
	(table) => [
		uniqueIndex('presensi_guru_sekolah_user_tanggal_idx').on(
			table.sekolahId,
			table.authUserId,
			table.tanggal
		),
		index('presensi_guru_sekolah_tanggal_idx').on(table.sekolahId, table.tanggal)
	]
);

export const tablePresensiGuruRelations = relations(tablePresensiGuru, ({ one }) => ({
	sekolah: one(tableSekolah, {
		fields: [tablePresensiGuru.sekolahId],
		references: [tableSekolah.id]
	}),
	tahunAjaran: one(tableTahunAjaran, {
		fields: [tablePresensiGuru.tahunAjaranId],
		references: [tableTahunAjaran.id]
	}),
	semester: one(tableSemester, {
		fields: [tablePresensiGuru.semesterId],
		references: [tableSemester.id]
	}),
	authUser: one(tableAuthUser, {
		fields: [tablePresensiGuru.authUserId],
		references: [tableAuthUser.id]
	})
}));

export const tableBukuTamu = pgTable(
	'buku_tamu',
	{
		id: serial().primaryKey(),
		sekolahId: integer()
			.references(() => tableSekolah.id, { onDelete: 'cascade' })
			.notNull(),
		tahunAjaranId: integer().references(() => tableTahunAjaran.id, { onDelete: 'set null' }),
		semesterId: integer().references(() => tableSemester.id, { onDelete: 'set null' }),
		nama: text().notNull(),
		asalInstansi: text().notNull(),
		nip: text(),
		keperluan: text().notNull(),
		pesanKesan: text(),
		tandaTangan: text(),
		...audit
	},
	(table) => [
		index('buku_tamu_sekolah_idx').on(table.sekolahId),
		index('buku_tamu_tanggal_idx').on(table.createdAt)
	]
);

export const tableBukuTamuSettings = pgTable(
	'buku_tamu_settings',
	{
		id: serial().primaryKey(),
		sekolahId: integer()
			.references(() => tableSekolah.id, { onDelete: 'cascade' })
			.notNull(),
		passkeyHash: text(),
		passkeySalt: text(),
		unlockToken: text(),
		...audit
	},
	(table) => [unique().on(table.sekolahId)]
);

// Global AI settings (single row, not per-sekolah). Admin/kepala_sekolah set the
// Gemini API key via /pengaturan; the key is read server-side only, never sent to the client.
export const tableAiSettings = pgTable('ai_settings', {
	id: serial().primaryKey(),
	provider: text({ enum: ['gemini'] })
		.default('gemini')
		.notNull(),
	apiKey: text().notNull(),
	model: text().default('gemini-3.6-flash').notNull(),
	baseUrl: text(),
	...audit
});

export const tableSppd = pgTable(
	'sppd',
	{
		id: serial().primaryKey(),
		sekolahId: integer()
			.references(() => tableSekolah.id, { onDelete: 'cascade' })
			.notNull(),
		tahunAjaranId: integer().references(() => tableTahunAjaran.id, { onDelete: 'set null' }),
		semesterId: integer().references(() => tableSemester.id, { onDelete: 'set null' }),
		maksud: text().notNull(),
		nomorSuratTugas: text(),
		tanggalSuratTugas: text(),
		dasarSuratTugas: text(),
		alatAngkut: text(),
		tempatBerangkat: text(),
		tempatTujuan: text(),
		lamanya: text(),
		tanggalBerangkat: text().notNull(),
		tanggalKembali: text().notNull(),
		keteranganPengikut: text(),
		kodeRekening: text(),
		tingkatBiaya: text(),
		keteranganLain: text(),
		undanganFile: text(),
		...audit
	},
	(table) => [
		index('sppd_sekolah_idx').on(table.sekolahId),
		index('sppd_tanggal_berangkat_idx').on(table.tanggalBerangkat)
	]
);

export const tableSppdPegawai = pgTable(
	'sppd_pegawai',
	{
		id: serial().primaryKey(),
		sppdId: integer()
			.references(() => tableSppd.id, { onDelete: 'cascade' })
			.notNull(),
		authUserId: integer().references(() => tableAuthUser.id, { onDelete: 'set null' }),
		nama: text().notNull(),
		urutan: integer().notNull().default(0),
		...audit
	},
	(table) => [
		index('sppd_pegawai_sppd_idx').on(table.sppdId),
		index('sppd_pegawai_user_idx').on(table.authUserId)
	]
);

export const tableSppdPengikut = pgTable(
	'sppd_pengikut',
	{
		id: serial().primaryKey(),
		sppdId: integer()
			.references(() => tableSppd.id, { onDelete: 'cascade' })
			.notNull(),
		nama: text().notNull(),
		tempatLahir: text().notNull(),
		tanggalLahir: text().notNull(),
		...audit
	},
	(table) => [index('sppd_pengikut_sppd_idx').on(table.sppdId)]
);

export const tableSppdRelations = relations(tableSppd, ({ one, many }) => ({
	sekolah: one(tableSekolah, {
		fields: [tableSppd.sekolahId],
		references: [tableSekolah.id]
	}),
	tahunAjaran: one(tableTahunAjaran, {
		fields: [tableSppd.tahunAjaranId],
		references: [tableTahunAjaran.id]
	}),
	semester: one(tableSemester, {
		fields: [tableSppd.semesterId],
		references: [tableSemester.id]
	}),
	pegawai: many(tableSppdPegawai),
	pengikut: many(tableSppdPengikut)
}));

export const tableSppdPegawaiRelations = relations(tableSppdPegawai, ({ one }) => ({
	sppd: one(tableSppd, {
		fields: [tableSppdPegawai.sppdId],
		references: [tableSppd.id]
	}),
	authUser: one(tableAuthUser, {
		fields: [tableSppdPegawai.authUserId],
		references: [tableAuthUser.id]
	})
}));

export const tableSppdPengikutRelations = relations(tableSppdPengikut, ({ one }) => ({
	sppd: one(tableSppd, {
		fields: [tableSppdPengikut.sppdId],
		references: [tableSppd.id]
	})
}));

export const tableDinasLuarPermohonan = pgTable(
	'dinas_luar_permohonan',
	{
		id: serial().primaryKey(),
		sekolahId: integer()
			.references(() => tableSekolah.id, { onDelete: 'cascade' })
			.notNull(),
		authUserId: integer()
			.references(() => tableAuthUser.id, { onDelete: 'cascade' })
			.notNull(),
		nama: text().notNull(),
		maksud: text().notNull(),
		undanganFile: text(),
		...audit
	},
	(table) => [
		index('dinas_luar_permohonan_sekolah_idx').on(table.sekolahId),
		index('dinas_luar_permohonan_auth_user_idx').on(table.authUserId)
	]
);

export const tableDinasLuarPermohonanRelations = relations(tableDinasLuarPermohonan, ({ one }) => ({
	sekolah: one(tableSekolah, {
		fields: [tableDinasLuarPermohonan.sekolahId],
		references: [tableSekolah.id]
	}),
	authUser: one(tableAuthUser, {
		fields: [tableDinasLuarPermohonan.authUserId],
		references: [tableAuthUser.id]
	})
}));

export const tableDinasLuarBukti = pgTable(
	'dinas_luar_bukti',
	{
		id: serial().primaryKey(),
		sppdId: integer()
			.references(() => tableSppd.id, { onDelete: 'cascade' })
			.notNull(),
		authUserId: integer().references(() => tableAuthUser.id, { onDelete: 'set null' }),
		jenis: text({ enum: ['pdf', 'foto'] }).notNull(),
		namaFile: text().notNull(),
		...audit
	},
	(table) => [
		index('dinas_luar_bukti_sppd_idx').on(table.sppdId),
		index('dinas_luar_bukti_auth_user_idx').on(table.authUserId)
	]
);

export const tableDinasLuarBuktiRelations = relations(tableDinasLuarBukti, ({ one }) => ({
	sppd: one(tableSppd, {
		fields: [tableDinasLuarBukti.sppdId],
		references: [tableSppd.id]
	}),
	authUser: one(tableAuthUser, {
		fields: [tableDinasLuarBukti.authUserId],
		references: [tableAuthUser.id]
	})
}));

export const tableAppMeta = pgTable('app_meta', {
	key: text().primaryKey(),
	value: text().notNull(),
	...audit
});

// Kredensial WebService Dapodik desktop per sekolah (Bearer token, lihat docs/erapor.md §5.2).
export const tableDapodikSettings = pgTable(
	'dapodik_settings',
	{
		id: serial().primaryKey(),
		sekolahId: integer()
			.references(() => tableSekolah.id, { onDelete: 'cascade' })
			.notNull(),
		// Base URL WebService Dapodik, mis. http://192.168.8.114:5774/WebService
		url: text().notNull(),
		token: text().notNull(),
		npsn: text(),
		semesterIdDapodikTerakhir: text(),
		lastSyncAt: text(),
		...audit
	},
	(table) => [unique().on(table.sekolahId)]
);

export const tableDapodikSettingsRelations = relations(tableDapodikSettings, ({ one }) => ({
	sekolah: one(tableSekolah, {
		fields: [tableDapodikSettings.sekolahId],
		references: [tableSekolah.id]
	})
}));

/**
 * Referensi mata pelajaran nasional Dapodik (endpoint getMataPelajaran).
 * Primary key = ID referensi Dapodik (mis. 400200000 = "Guru Kelas SD/MI/SLB") sehingga
 * mapel lokal yang dipetakan ke ID ini bisa dirujuk saat posting nilai balik ke Dapodik.
 */
export const tableDapodikMataPelajaran = pgTable('dapodik_mata_pelajaran', {
	mataPelajaranId: integer().primaryKey(),
	nama: text().notNull(),
	jurusanId: text(),
	pilihanSekolah: boolean().default(false).notNull(),
	pilihanBuku: boolean().default(false).notNull(),
	pilihanKepengawasan: boolean().default(false).notNull(),
	pilihanEvaluasi: boolean().default(false).notNull(),
	...audit
});

/**
 * Cermin pembelajaran Dapodik per rombel (nested pada getRombonganBelajar).
 * Tidak otomatis menjadi baris mata_pelajaran — dipakai sebagai daftar pilihan
 * nama mapel (sesuai rombel kelasnya) pada form "Tambah Mata Pelajaran".
 */
export const tableDapodikPembelajaran = pgTable(
	'dapodik_pembelajaran',
	{
		id: serial().primaryKey(),
		kelasId: integer()
			.references(() => tableKelas.id, { onDelete: 'cascade' })
			.notNull(),
		pembelajaranId: text().notNull(),
		// ID referensi dapodik_mata_pelajaran (bila ada).
		mataPelajaranId: text(),
		nama: text().notNull(),
		...audit
	},
	(table) => [unique().on(table.pembelajaranId)]
);
