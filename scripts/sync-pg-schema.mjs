#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const schemaSqlitePath = path.join(projectRoot, 'src', 'lib', 'server', 'db', 'schema.ts');
const schemaPgPath = path.join(projectRoot, 'src', 'lib', 'server', 'db', 'schema.pg.ts');

console.info('[sync-pg-schema] Reading', schemaSqlitePath);
const source = fs.readFileSync(schemaSqlitePath, 'utf8');

// Transform SQLite schema to PostgreSQL schema
let pgCode = source;

// 1. Replace imports from drizzle-orm/sqlite-core
const sqliteImportRegex = /import\s*\{([^}]+)\}\s*from\s*['"]drizzle-orm\/sqlite-core['"];?/;
if (sqliteImportRegex.test(pgCode)) {
	const replacement = `import {
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
});`;
	pgCode = pgCode.replace(sqliteImportRegex, replacement);
}

// 2. Convert table definition
pgCode = pgCode.replace(/\bsqliteTable\s*\(/g, 'pgTable(');

// 3. Convert primary key with autoIncrement
pgCode = pgCode.replace(
	/\bint\(\)\.primaryKey\(\s*\{\s*autoIncrement:\s*true\s*\}\s*\)/g,
	'serial().primaryKey()'
);

// 4. Convert boolean mode int
pgCode = pgCode.replace(/\bint\(\s*\{\s*mode:\s*['"]boolean['"]\s*\}\s*\)/g, 'boolean()');

// 5. Convert JSON mode text
pgCode = pgCode.replace(/\btext\(\s*\{\s*mode:\s*['"]json['"]\s*\}\s*\)/g, 'jsonb()');

// 6. Convert blob
pgCode = pgCode.replace(/\bblob\(\)/g, 'bytea()');

// 7. Convert remaining int() calls to integer()
pgCode = pgCode.replace(/\bint\(\)/g, 'integer()');

// 8. Add header comment explaining this file is auto-generated
const header = `/**
 * AUTO-GENERATED FILE — JANGAN EDIT LANGSUNG!
 * File ini dihasilkan secara otomatis dari 'src/lib/server/db/schema.ts'
 * oleh skrip 'scripts/sync-pg-schema.mjs'.
 * 
 * Jalankan 'pnpm db:pg:sync' setelah melakukan perubahan atau git pull dari upstream.
 */\n\n`;

pgCode = header + pgCode;

fs.writeFileSync(schemaPgPath, pgCode, 'utf8');
console.info('[sync-pg-schema] Successfully generated', schemaPgPath);
