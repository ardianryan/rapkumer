// Runtime translator from SQLite DDL/DML to PostgreSQL syntax
export function translateSqliteToPostgres(sql: string): string {
	let res = sql;

	// 1. Primary key auto-increment conversion
	res = res.replace(
		/(?:integer|int)\s+primary\s+key\s+autoincrement(?:\s+not\s+null)?/gi,
		'SERIAL PRIMARY KEY'
	);

	// 2. Fallback: any standalone AUTOINCREMENT
	res = res.replace(/\bAUTOINCREMENT\b/gi, '');

	// 3. Binary blob conversion
	res = res.replace(/\bBLOB\b/gi, 'BYTEA');

	// 4. Convert DATETIME to TEXT
	res = res.replace(/\bDATETIME\b/gi, 'TEXT');

	// 5. Strip table-level FOREIGN KEY definitions (with or without CONSTRAINT)
	res = res.replace(
		/,?\s*(?:CONSTRAINT\s+["\w]+\s+)?FOREIGN\s+KEY\s*\([^)]+\)\s+REFERENCES\s+["\w]+\s*(?:\([^)]+\))?(?:\s+ON\s+(?:DELETE|UPDATE)\s+[\w\s]+)*/gi,
		''
	);

	// 6. Strip inline column-level REFERENCES
	res = res.replace(
		/\s+REFERENCES\s+["\w]+(?:\([^)]+\))?(?:\s+ON\s+(?:DELETE|UPDATE)\s+[\w\s]+)?/gi,
		''
	);

	// 7. Clean up trailing comma before closing parenthesis
	res = res.replace(/,\s*\)/g, ')');

	return res;
}
