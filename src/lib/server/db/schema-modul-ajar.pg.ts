import { integer, pgTable, serial, text, index } from 'drizzle-orm/pg-core';
import { tableAuthUser, tableKelas, tableMataPelajaran, tableSekolah } from './schema.pg';

export const tableModulAjar = pgTable(
	'modul_ajar',
	{
		id: serial().primaryKey(),
		sekolahId: integer()
			.references(() => tableSekolah.id, { onDelete: 'cascade' })
			.notNull(),
		kelasId: integer()
			.references(() => tableKelas.id, { onDelete: 'cascade' })
			.notNull(),
		mataPelajaranId: integer()
			.references(() => tableMataPelajaran.id, { onDelete: 'cascade' })
			.notNull(),
		authUserId: integer()
			.references(() => tableAuthUser.id, { onDelete: 'cascade' })
			.notNull(),
		materiPokok: text().notNull(),
		alokasiWaktu: text().notNull(),
		jumlahPertemuan: text().notNull(),
		modelPembelajaran: text().notNull(),
		dimensiProfil: text().notNull().default('[]').$type<string[]>(),
		tujuanPembelajaranIds: text().notNull().default('[]').$type<number[]>(),
		konten: text().notNull(),
		status: text().notNull().default('draf'),
		createdAt: text().notNull(),
		updatedAt: text()
	},
	(table) => [
		index('idx_modul_ajar_lookup').on(table.sekolahId, table.kelasId, table.mataPelajaranId),
		index('idx_modul_ajar_user').on(table.authUserId)
	]
);

export type ModulAjarPgSelect = typeof tableModulAjar.$inferSelect;
export type ModulAjarPgInsert = typeof tableModulAjar.$inferInsert;
