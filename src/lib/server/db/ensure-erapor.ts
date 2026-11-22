import { ensureSchema } from './ensure-helper';

export async function ensureEraporSchema() {
	await ensureSchema('erapor', [
		`CREATE TABLE IF NOT EXISTS erapor_config (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			sekolah_id INTEGER NOT NULL UNIQUE REFERENCES sekolah(id) ON DELETE CASCADE,
			api_url TEXT NOT NULL DEFAULT '',
			api_key TEXT NOT NULL DEFAULT '',
			active_semester_id TEXT,
			timeout_ms INTEGER NOT NULL DEFAULT 30000,
			created_at TEXT DEFAULT CURRENT_TIMESTAMP,
			updated_at TEXT DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS erapor_map_rombel (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			sekolah_id INTEGER NOT NULL REFERENCES sekolah(id) ON DELETE CASCADE,
			siakad_kelas_id INTEGER NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
			erapor_rombel_id TEXT NOT NULL,
			erapor_nm_kelas TEXT,
			semester_id TEXT NOT NULL,
			created_at TEXT DEFAULT CURRENT_TIMESTAMP,
			updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(sekolah_id, siakad_kelas_id, semester_id)
		)`,
		`CREATE INDEX IF NOT EXISTS erapor_map_rombel_sekolah_idx ON erapor_map_rombel(sekolah_id, semester_id)`,
		`CREATE TABLE IF NOT EXISTS erapor_map_mapel (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			sekolah_id INTEGER NOT NULL REFERENCES sekolah(id) ON DELETE CASCADE,
			siakad_mapel_nama TEXT NOT NULL,
			erapor_mapel_id TEXT NOT NULL,
			erapor_nm_mapel TEXT,
			created_at TEXT DEFAULT CURRENT_TIMESTAMP,
			updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(sekolah_id, siakad_mapel_nama)
		)`,
		`CREATE INDEX IF NOT EXISTS erapor_map_mapel_sekolah_idx ON erapor_map_mapel(sekolah_id)`,
		`CREATE TABLE IF NOT EXISTS erapor_map_kokurikuler (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			sekolah_id INTEGER NOT NULL REFERENCES sekolah(id) ON DELETE CASCADE,
			siakad_kode TEXT NOT NULL,
			erapor_kelompok_id TEXT NOT NULL DEFAULT '',
			erapor_kegiatan_id TEXT,
			erapor_kegiatan_nama TEXT,
			dimensi_map TEXT,
			semester_id TEXT NOT NULL,
			created_at TEXT DEFAULT CURRENT_TIMESTAMP,
			updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(sekolah_id, siakad_kode, semester_id)
		)`,
		`CREATE INDEX IF NOT EXISTS erapor_map_kokurikuler_sekolah_idx ON erapor_map_kokurikuler(sekolah_id, semester_id)`,
		`CREATE TABLE IF NOT EXISTS erapor_sync_logs (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			sekolah_id INTEGER NOT NULL REFERENCES sekolah(id) ON DELETE CASCADE,
			sync_type TEXT NOT NULL,
			target_info TEXT,
			total_data INTEGER NOT NULL DEFAULT 0,
			total_success INTEGER NOT NULL DEFAULT 0,
			total_failed INTEGER NOT NULL DEFAULT 0,
			request_payload TEXT,
			response_body TEXT,
			status TEXT NOT NULL,
			executed_by TEXT,
			created_at TEXT DEFAULT CURRENT_TIMESTAMP,
			updated_at TEXT DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS erapor_sync_logs_sekolah_idx ON erapor_sync_logs(sekolah_id)`
	]);
}
