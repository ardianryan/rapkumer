import { int, sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
import { tableAuthUser, tableKelas, tableMataPelajaran, tableSekolah } from './schema';

export const tableModulAjar = sqliteTable(
	'modul_ajar',
	{
		id: int().primaryKey({ autoIncrement: true }),
		sekolahId: int()
			.references(() => tableSekolah.id, { onDelete: 'cascade' })
			.notNull(),
		kelasId: int()
			.references(() => tableKelas.id, { onDelete: 'cascade' })
			.notNull(),
		mataPelajaranId: int()
			.references(() => tableMataPelajaran.id, { onDelete: 'cascade' })
			.notNull(),
		authUserId: int()
			.references(() => tableAuthUser.id, { onDelete: 'cascade' })
			.notNull(),
		materiPokok: text().notNull(),
		alokasiWaktu: text().notNull(),
		jumlahPertemuan: text().notNull(),
		modelPembelajaran: text().notNull(),
		dimensiProfil: text({ mode: 'json' }).notNull().default('[]').$type<string[]>(),
		tujuanPembelajaranIds: text({ mode: 'json' }).notNull().default('[]').$type<number[]>(),
		// Seluruh detail 12 bab (A s/d L) disimpan terstruktur dalam format JSON
		konten: text({ mode: 'json' }).notNull(),
		status: text({ enum: ['draf', 'final'] })
			.notNull()
			.default('draf'),
		createdAt: text().notNull(),
		updatedAt: text()
	},
	(table) => [
		index('idx_modul_ajar_lookup').on(table.sekolahId, table.kelasId, table.mataPelajaranId),
		index('idx_modul_ajar_user').on(table.authUserId)
	]
);

export type ModulAjarSelect = typeof tableModulAjar.$inferSelect;
export type ModulAjarInsert = typeof tableModulAjar.$inferInsert;
