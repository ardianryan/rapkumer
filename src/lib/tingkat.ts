const ROMAN_MAP: Record<string, number> = {
	I: 1,
	II: 2,
	III: 3,
	IV: 4,
	V: 5,
	VI: 6,
	VII: 7,
	VIII: 8,
	IX: 9,
	X: 10,
	XI: 11,
	XII: 12
};

export const lastGradeOfFase: Record<string, number> = {
	'Fase A': 2,
	'Fase B': 4,
	'Fase C': 6,
	'Fase D': 9,
	'Fase E': 10,
	'Fase F': 12
};

const GRADUATING_FASES = ['Fase C', 'Fase D', 'Fase F'];
const GRADUATING_GRADES = [6, 9, 12];

function parseToken(token: string): number | null {
	if (!token) return null;
	const arab = parseInt(token, 10);
	if (Number.isFinite(arab) && arab >= 1 && arab <= 12 && String(arab) === token) {
		return arab;
	}
	const roman = ROMAN_MAP[token.toUpperCase()];
	if (roman !== undefined) return roman;

	// Handle format rapat tanpa spasi/simbol seperti "11A", "10B", "12MIPA"
	const matchArabPrefix = token.match(/^(1[0-2]|[1-9])[a-zA-Z]/);
	if (matchArabPrefix) {
		return parseInt(matchArabPrefix[1], 10);
	}

	// Handle format rapat Romawi seperti "XIA", "XB", "XIIMIPA"
	const matchRomanPrefix = token.match(/^(XII|XI|VIII|VII|III|VI|IV|IX|II|X|I)[a-zA-Z]/i);
	if (matchRomanPrefix) {
		const r = ROMAN_MAP[matchRomanPrefix[1].toUpperCase()];
		if (r !== undefined) return r;
	}

	return null;
}

export function parseTingkat(namaKelas: string): number | null {
	if (!namaKelas || typeof namaKelas !== 'string') return null;

	const clean = namaKelas.replace(/^(kelas|rombel|tingkat|ruang)\s+/i, '').trim();
	if (!clean) return null;

	// Pisahkan token utama berdasarkan spasi atau pemisah umum (misal: "XI-10" -> ["XI", "10"])
	const tokens = clean.split(/[\s\-._/]+/).filter(Boolean);
	if (!tokens.length) return null;

	const first = parseToken(tokens[0]);
	if (first !== null) return first;

	// Handle "Kelas X IPA 1" jika kata "Kelas" belum ter-strip
	if (tokens.length > 1 && /^kelas$/i.test(tokens[0])) {
		return parseToken(tokens[1]);
	}

	return null;
}

export function getFaseByTingkat(tingkat: number | null): string | null {
	if (tingkat === null || tingkat === undefined) return null;
	if (tingkat >= 1 && tingkat <= 2) return 'Fase A';
	if (tingkat >= 3 && tingkat <= 4) return 'Fase B';
	if (tingkat >= 5 && tingkat <= 6) return 'Fase C';
	if (tingkat >= 7 && tingkat <= 9) return 'Fase D';
	if (tingkat === 10) return 'Fase E';
	if (tingkat >= 11 && tingkat <= 12) return 'Fase F';
	return null;
}

export function resolveFaseKelas(
	kelas?: { nama?: string | null; fase?: string | null } | null,
	options?: { short?: boolean }
): string {
	const nama = kelas?.nama?.trim() ?? '';
	const currentFase = kelas?.fase?.trim();

	// 1. Deteksi tingkat dari nama kelas (misal: "XI-10" -> 11 -> "Fase F")
	const tingkat = parseTingkat(nama);
	let faseLengkap: string | null = null;

	if (tingkat !== null) {
		faseLengkap = getFaseByTingkat(tingkat);
	}

	// 2. Jika tidak terdeteksi dari nama, gunakan fase yang sudah tercatat di kelas
	if (!faseLengkap && currentFase) {
		faseLengkap = currentFase.startsWith('Fase ')
			? currentFase
			: `Fase ${currentFase.replace(/^fase\s*/i, '').trim()}`;
	}

	// 3. Fallback jika sama sekali tidak terdeteksi
	if (!faseLengkap) {
		faseLengkap = 'Fase E';
	}

	if (options?.short) {
		return faseLengkap.replace(/^Fase\s+/i, '').trim();
	}

	return faseLengkap;
}

export function isGraduatingFase(fase: string): boolean {
	return GRADUATING_FASES.includes(fase);
}

export function isGraduatingGrade(tingkat: number | null): boolean {
	return tingkat !== null && GRADUATING_GRADES.includes(tingkat);
}
