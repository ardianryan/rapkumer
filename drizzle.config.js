import { defineConfig } from 'drizzle-kit';

// Use process.env directly so this config works both in development and on
// installed target machines where dev dependencies (like vite) are not present.
const env = process.env || {};
const dbUrl = env['DB_URL'] || 'file:./data/database.sqlite3';
const isPg = dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://');

export default defineConfig({
	out: './drizzle',
	schema: isPg ? './src/lib/server/db/schema.pg.ts' : './src/lib/server/db/schema.ts',
	dialect: isPg ? 'postgresql' : 'sqlite',
	casing: 'snake_case',
	dbCredentials: { url: dbUrl }
});
