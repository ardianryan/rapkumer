#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';
import postgres from 'postgres';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function loadDotEnv() {
	try {
		const envPath = path.join(projectRoot, '.env');
		if (!fs.existsSync(envPath)) return;
		const raw = fs.readFileSync(envPath, 'utf8');
		for (const line of raw.split(/\r?\n/)) {
			const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
			if (!m) continue;
			const key = m[1];
			let val = m[2] ?? '';
			if (
				(val.startsWith('"') && val.endsWith('"')) ||
				(val.startsWith("'") && val.endsWith("'"))
			) {
				val = val.slice(1, -1);
			}
			if (process.env[key] === undefined) {
				process.env[key] = val;
			}
		}
	} catch (e) {
		console.warn('[env] warning reading .env:', e.message);
	}
}

loadDotEnv();

// Parse CLI arguments:
// node scripts/migrate-sqlite-to-pg.mjs [--sqlite <path>] [--pg <url>]
const args = process.argv.slice(2);
let sqlitePath = path.join(projectRoot, 'data', 'database.sqlite3');
let pgUrl =
	process.env.PG_URL || (process.env.DB_URL?.startsWith('postgres') ? process.env.DB_URL : '');

for (let i = 0; i < args.length; i++) {
	if (args[i] === '--sqlite' && args[i + 1]) {
		sqlitePath = path.resolve(args[++i]);
	} else if (args[i] === '--pg' && args[i + 1]) {
		pgUrl = args[++i];
	}
}

console.info('\n════════════════════════════════════════════════════════════');
console.info('       Rapkumer: Migrasi Database SQLite ke PostgreSQL      ');
console.info('════════════════════════════════════════════════════════════\n');

if (!pgUrl) {
	console.error('❌ Error: URL PostgreSQL tidak ditemukan.');
	console.error('Silakan sediakan via argumen:');
	console.error('  pnpm db:migrate:to-pg -- --pg "postgresql://user:pass@host:5432/dbname"');
	console.error('atau atur DB_URL / PG_URL di file .env');
	process.exit(1);
}

if (!fs.existsSync(sqlitePath)) {
	console.error(`❌ Error: Berkas SQLite tidak ditemukan di: ${sqlitePath}`);
	process.exit(1);
}

console.info(`📦 Berkas SQLite : ${sqlitePath}`);
console.info(`🐘 PostgreSQL    : ${pgUrl.replace(/:[^:@]+@/, ':****@')}\n`);

async function runMigration() {
	const sqliteClient = createClient({ url: `file:${sqlitePath}` });
	const pg = postgres(pgUrl, { max: 10, idle_timeout: 30, onnotice: () => {} });

	try {
		console.info('1. Memverifikasi koneksi PostgreSQL...');
		await pg`SELECT 1`;
		console.info('   ✓ Terhubung ke PostgreSQL');

		// Inisialisasi collation nocase
		try {
			await pg.unsafe(
				`CREATE COLLATION IF NOT EXISTS nocase (provider = icu, locale = 'und-u-ks-level2', deterministic = false)`
			);
		} catch {
			try {
				await pg.unsafe(`CREATE COLLATION IF NOT EXISTS nocase (provider = libc, locale = 'C')`);
			} catch {
				// Ignore collation creation error if not supported
			}
		}

		console.info('\n2. Mengambil daftar tabel dari SQLite...');
		const tablesRes = await sqliteClient.execute(
			`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_litestream_%' AND name NOT LIKE '__drizzle_%' ORDER BY name;`
		);
		const sqliteTables = tablesRes.rows.map((r) => String(r.name || r[0]));
		console.info(`   Ditemukan ${sqliteTables.length} tabel di SQLite.`);

		// Disable triggers and foreign keys during bulk transfer
		console.info('\n3. Menyiapkan sesi PostgreSQL (bypassing foreign keys temporarily)...');
		await pg.unsafe("SET session_replication_role = 'replica';");

		const prioritizedTables = [
			'alamat',
			'pegawai',
			'sekolah',
			'feature_unlock',
			'tahun_ajaran',
			'semester',
			'kelas',
			'tasks',
			'auth_user',
			'auth_session',
			'login_attempt',
			'mata_pelajaran',
			'tujuan_pembelajaran',
			'murid',
			'wali_murid',
			'murid_mata_pelajaran',
			'auth_user_mata_pelajaran',
			'auth_user_kelas',
			'catatan_wali_kelas',
			'kehadiran_murid',
			'keputusan_murid',
			'ekstrakurikuler',
			'ekstrakurikuler_tujuan',
			'murid_ekstrakurikuler',
			'asesmen_ekstrakurikuler',
			'kokurikuler',
			'kokurikuler_dimensi',
			'kokurikuler_elemen',
			'kokurikuler_sub_elemen',
			'kokurikuler_target',
			'murid_kokurikuler',
			'asesmen_kokurikuler',
			'keasramaan',
			'keasramaan_tujuan',
			'murid_keasramaan',
			'asesmen_keasramaan',
			'asesmen_formatif',
			'asesmen_sumatif',
			'asesmen_sumatif_tujuan',
			'absensi',
			'ketidakhadiran_harian',
			'ketidakhadiran_rapor',
			'presensi_guru',
			'presensi_guru_detail',
			'presensi_settings',
			'jadwal_bell',
			'bell_task',
			'buku_tamu',
			'buku_tamu_settings',
			'dinas_luar',
			'sppd',
			'sppd_pegawai',
			'sppd_pengikut',
			'jurnal_mengajar',
			'ai_settings',
			'user_ai_settings',
			'dapodik_log'
		];

		const orderedTables = [
			...prioritizedTables.filter((t) => sqliteTables.includes(t)),
			...sqliteTables.filter((t) => !prioritizedTables.includes(t))
		];

		console.info('\n4. Mentransfer data tabel...');
		let totalMigratedRows = 0;

		for (const table of orderedTables) {
			// Periksa apakah tabel ada di PostgreSQL
			const checkPgTable = await pg`
				SELECT column_name, data_type 
				FROM information_schema.columns 
				WHERE table_name = ${table};
			`;
			if (checkPgTable.length === 0) {
				console.warn(`   ⚠️  Tabel '${table}' belum ada di PostgreSQL, melewati...`);
				continue;
			}

			const pgColTypes = new Map();
			for (const col of checkPgTable) {
				pgColTypes.set(col.column_name, col.data_type);
			}

			// Ambil baris dari SQLite
			const rowsRes = await sqliteClient.execute(`SELECT * FROM "${table}"`);
			const rows = rowsRes.rows;

			if (rows.length === 0) {
				console.info(`   • ${table.padEnd(30)} : 0 baris`);
				continue;
			}

			// Kosongkan tabel target di PostgreSQL agar fresh
			await pg.unsafe(`TRUNCATE TABLE "${table}" CASCADE;`);

			// Insert dalam batch 500
			const BATCH_SIZE = 500;
			for (let i = 0; i < rows.length; i += BATCH_SIZE) {
				const batch = rows.slice(i, i + BATCH_SIZE);
				const formattedBatch = batch.map((rawRow) => {
					const obj = {};
					for (const [key, rawVal] of Object.entries(rawRow)) {
						if (!pgColTypes.has(key)) continue;
						const pgType = pgColTypes.get(key);

						if (rawVal === null || rawVal === undefined) {
							obj[key] = null;
						} else if (pgType === 'boolean') {
							obj[key] = Boolean(rawVal);
						} else if (pgType === 'jsonb' || pgType === 'json') {
							if (typeof rawVal === 'string') {
								try {
									obj[key] = JSON.parse(rawVal);
								} catch {
									obj[key] = rawVal;
								}
							} else {
								obj[key] = rawVal;
							}
						} else {
							obj[key] = rawVal;
						}
					}
					return obj;
				});

				if (formattedBatch.length > 0) {
					await pg`${pg(formattedBatch)}`;
				}
			}

			// Sinkronkan sequence ID jika tabel memiliki kolom id
			if (pgColTypes.has('id')) {
				try {
					await pg.unsafe(`
						SELECT setval(
							pg_get_serial_sequence('${table}', 'id'),
							coalesce((SELECT max(id) FROM "${table}"), 1)
						);
					`);
				} catch {
					// Table might not use a sequence
				}
			}

			totalMigratedRows += rows.length;
			console.info(`   ✓ ${table.padEnd(30)} : ${rows.length} baris berhasil ditransfer`);
		}

		// Restore session replication role
		await pg.unsafe("SET session_replication_role = 'origin';");

		console.info('\n════════════════════════════════════════════════════════════');
		console.info(`✨ Migrasi Selesai! Total ${totalMigratedRows} baris data berhasil disalin.`);
		console.info('════════════════════════════════════════════════════════════\n');
	} catch (err) {
		console.error('\n❌ Terjadi kesalahan saat migrasi:', err);
		process.exitCode = 1;
	} finally {
		try {
			await pg.end();
		} catch {
			// Ignore connection closing errors
		}
	}
}

runMigration();
