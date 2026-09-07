export type UnifiedDatabaseClient = {
	isPostgres: boolean;
	execute: (statement: string | { sql: string; args?: unknown[] }) => Promise<{ rows: unknown[] }>;
	close: () => Promise<void>;
};
