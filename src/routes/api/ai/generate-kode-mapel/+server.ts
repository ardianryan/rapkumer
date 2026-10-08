import { json, type RequestHandler } from '@sveltejs/kit';
import db from '$lib/server/db';
import { tableKelas, tableMataPelajaran } from '$lib/server/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { getAiSettings } from '$lib/server/ai';

// Kamus singkatan standar kurikulum nasional Indonesia (fallback cerdas & akurat)
const DEFAULT_MAPEL_CODES: Record<string, string> = {
	'pendidikan agama islam dan budi pekerti': 'PAIBP',
	'pendidikan agama kristen dan budi pekerti': 'PAKR',
	'pendidikan agama katolik dan budi pekerti': 'PAKT',
	'pendidikan agama hindu dan budi pekerti': 'PAHD',
	'pendidikan agama buddha dan budi pekerti': 'PABD',
	'pendidikan agama khonghucu dan budi pekerti': 'PAKH',
	'pendidikan kepercayaan terhadap tuhan yme dan budi pekerti': 'PKTY',
	'pendidikan agama dan budi pekerti': 'PAPB',
	'pendidikan pancasila': 'PP',
	'pendidikan pancasila dan kewarganegaraan': 'PPKN',
	'bahasa indonesia': 'BIND',
	matematika: 'MTK',
	'matematika tingkat lanjut': 'MTK-TL',
	'bahasa inggris': 'BING',
	'bahasa inggris tingkat lanjut': 'BING-TL',
	'pendidikan jasmani, olahraga, dan kesehatan': 'PJOK',
	'pendidikan jasmani olahraga dan kesehatan': 'PJOK',
	sejarah: 'SEJ',
	'sejarah tingkat lanjut': 'SEJ-TL',
	'sejarah indonesia': 'SEJIN',
	'seni budaya': 'SBD',
	'seni musik': 'SMUS',
	'seni rupa': 'SRUP',
	'seni tari': 'STAR',
	'seni teater': 'STET',
	'prakarya dan kewirausahaan': 'PKWU',
	prakarya: 'PKY',
	informatika: 'INF',
	'ilmu pengetahuan alam': 'IPA',
	'ilmu pengetahuan sosial': 'IPS',
	biologi: 'BIO',
	fisika: 'FIS',
	kimia: 'KIM',
	sosiologi: 'SOS',
	ekonomi: 'EKO',
	geografi: 'GEO',
	antropologi: 'ANT',
	'bahasa daerah': 'BD',
	'bahasa jawa': 'BJAW',
	'bahasa sunda': 'BSUN',
	'bahasa arab': 'BARB',
	'bahasa jepang': 'BJEP',
	'bahasa mandarin': 'BMND',
	'bahasa jerman': 'BJRM',
	'bahasa prancis': 'BPRC',
	'bahasa korea': 'BKOR',
	'projek penguatan profil pelajar pancasila': 'P5',
	'projek ilmu pengetahuan alam dan sosial': 'PIPAS',
	'dasar-dasar program keahlian': 'DPK',
	'konsentrasi keahlian': 'KK'
};

function normalizeName(name: string): string {
	return name
		.trim()
		.toLowerCase()
		.replace(/[\s\-_]+/g, ' ');
}

function isNonRaporSubject(name: string): boolean {
	const norm = normalizeName(name);
	return (
		norm.includes('bimbingan konseling') ||
		norm.includes('bimbingan dan konseling') ||
		norm.includes('konseling') ||
		norm.includes('bimbingan karir') ||
		norm.startsWith('bk ') ||
		norm.endsWith(' bk') ||
		norm === 'bk'
	);
}

function generateSmartFallbackCode(name: string): string | null {
	if (isNonRaporSubject(name)) return null;

	const norm = normalizeName(name);
	if (DEFAULT_MAPEL_CODES[norm]) return DEFAULT_MAPEL_CODES[norm];

	// Cek kata kunci umum
	for (const [key, code] of Object.entries(DEFAULT_MAPEL_CODES)) {
		if (norm === key || norm.startsWith(key + ' ') || norm.endsWith(' ' + key)) {
			return code;
		}
	}

	// Buat akronim dari huruf depan tiap kata penting
	const words = norm
		.split(' ')
		.filter((w) => !['dan', 'yang', 'untuk', 'pada', 'di', 'ke', 'dari'].includes(w));
	if (words.length >= 2) {
		const acronym = words.map((w) => w[0].toUpperCase()).join('');
		return acronym.slice(0, 6);
	}

	// Ambil 3-4 huruf konsonan pertama atau potongan kata
	const clean = name.replace(/[^a-zA-Z]/g, '').toUpperCase();
	return clean.slice(0, 4) || 'MPL';
}

export const POST: RequestHandler = async ({ locals }) => {
	const user = locals.user;
	if (!user) {
		return json({ error: 'Tidak terotentikasi.' }, { status: 401 });
	}

	// Hanya admin, kepala sekolah, atau pengguna berwenang yang dapat menjalankan
	const allowedRoles = ['admin', 'kepala_sekolah'];
	if (!allowedRoles.includes(user.type)) {
		return json(
			{ error: 'Hanya administrator yang dapat men-generate kode mata pelajaran se-sekolah.' },
			{ status: 403 }
		);
	}

	const sekolah = locals.sekolah;
	if (!sekolah?.id) {
		return json({ error: 'Sekolah aktif tidak ditemukan.' }, { status: 400 });
	}

	// Ambil seluruh kelas di sekolah aktif
	const kelasList = await db.query.tableKelas.findMany({
		where: eq(tableKelas.sekolahId, sekolah.id),
		columns: { id: true }
	});

	if (kelasList.length === 0) {
		return json({ error: 'Belum ada data rombel/kelas di sekolah ini.' }, { status: 400 });
	}

	const kelasIds = kelasList.map((k) => k.id);

	// Ambil seluruh mapel di sekolah ini
	const mapelList = await db.query.tableMataPelajaran.findMany({
		where: inArray(tableMataPelajaran.kelasId, kelasIds)
	});

	if (mapelList.length === 0) {
		return json({ error: 'Tidak ada mata pelajaran yang ditemukan.' }, { status: 400 });
	}

	// Kumpulkan nama-nama mapel unik
	const uniqueNames = Array.from(new Set(mapelList.map((m) => m.nama.trim()))).filter(Boolean);

	// Coba panggil AI jika API key tersedia
	const nameToCodeMap = new Map<string, string | null>();
	let aiSuccess = false;

	try {
		const aiSettings = await getAiSettings(user);
		if (aiSettings?.apiKey) {
			const prompt = `Anda adalah pakar kurikulum dan sistem administrasi sekolah Indonesia.
Berikan singkatan atau kode mapel resmi/standar (2 sampai 6 karakter huruf kapital, unik untuk tiap nama) yang umum digunakan pada jadwal/rapor di Indonesia untuk daftar mata pelajaran berikut:
${JSON.stringify(uniqueNames)}

PENTING:
- Untuk mata pelajaran layanan/non-akademik seperti Bimbingan dan Konseling (BK), Bimbingan Konseling, konseling dsb. yang TIDAK dinilai dengan angka rapor intrakurikuler, WAJIB beri null ("kode": null) agar tidak tampil di cetakan rapor.

Format keluaran WAJIB JSON murni tanpa format lain:
{"codes": [{"nama": "...", "kode": "..." | null}]}`;

			const base = (aiSettings.baseUrl || 'https://generativelanguage.googleapis.com').replace(
				/\/+$/,
				''
			);
			const isGemini = base.includes('generativelanguage.googleapis.com');
			const endpoint = isGemini
				? `${base}/v1beta/models/${aiSettings.model}:generateContent`
				: `${base}/chat/completions`;

			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), 30_000);

			let res: Response;
			if (isGemini) {
				res = await fetch(endpoint, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'x-goog-api-key': aiSettings.apiKey
					},
					signal: controller.signal,
					body: JSON.stringify({
						contents: [{ parts: [{ text: prompt }] }],
						generationConfig: { responseMimeType: 'application/json' }
					})
				});
			} else {
				res = await fetch(endpoint, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${aiSettings.apiKey}`
					},
					signal: controller.signal,
					body: JSON.stringify({
						model: aiSettings.model,
						messages: [{ role: 'user', content: prompt }],
						response_format: { type: 'json_object' }
					})
				});
			}
			clearTimeout(timeout);

			if (res.ok) {
				const body = await res.json();
				const text = isGemini
					? body?.candidates?.[0]?.content?.parts?.[0]?.text
					: body?.choices?.[0]?.message?.content;
				if (text) {
					const cleaned = text
						.trim()
						.replace(/^```(?:json)?/i, '')
						.replace(/```$/, '')
						.trim();
					const parsed = JSON.parse(cleaned);
					const items = parsed.codes || parsed;
					if (Array.isArray(items)) {
						for (const it of items) {
							if (it.nama) {
								if (it.kode && !isNonRaporSubject(it.nama)) {
									nameToCodeMap.set(it.nama.trim(), String(it.kode).trim().toUpperCase());
								} else {
									nameToCodeMap.set(it.nama.trim(), null);
								}
							}
						}
						aiSuccess = true;
					}
				}
			}
		}
	} catch (e) {
		console.warn('[AI generate-kode-mapel] Gagal memanggil AI, menggunakan smart fallback:', e);
	}

	// Lengkapi dengan fallback cerdas untuk setiap nama yang belum terpetakan
	for (const name of uniqueNames) {
		if (!nameToCodeMap.has(name)) {
			nameToCodeMap.set(name, generateSmartFallbackCode(name));
		}
	}

	// Lakukan update massal pada database
	let updatedCount = 0;
	for (const [name, kode] of nameToCodeMap.entries()) {
		const isNonRapor = isNonRaporSubject(name);
		const effectiveKode = isNonRapor ? null : kode?.trim() ? kode.trim().toUpperCase() : null;

		// Update seluruh mapel dengan nama ini pada kelas-kelas di sekolah ini
		await db
			.update(tableMataPelajaran)
			.set({
				kode: effectiveKode,
				updatedAt: new Date().toISOString()
			})
			.where(and(inArray(tableMataPelajaran.kelasId, kelasIds), eq(tableMataPelajaran.nama, name)));
		updatedCount++;
	}

	return json({
		success: true,
		message: `Berhasil mengisi kode singkatan untuk ${nameToCodeMap.size} mata pelajaran di seluruh kelas (${updatedCount} baris diperbarui).`,
		method: aiSuccess ? 'ai' : 'smart-dictionary',
		totalUniqueMapel: nameToCodeMap.size,
		updatedRows: updatedCount,
		generatedCodes: Object.fromEntries(nameToCodeMap)
	});
};
