import { getAiSettings } from '$lib/server/ai';

export type ModulAjarKonten = {
	identifikasi: {
		karakteristikPesertaDidik: string;
		karakteristikMateri: string;
		dimensiProfilLulusan: Array<{ dimensi: string; penjelasan: string }>;
	};
	desain: {
		capaianPembelajaran: string;
		tujuanPembelajaran: {
			memahami: string[];
			mengaplikasi: string[];
			merefleksi: string[];
		};
		topikEsensial: string[];
		pertanyaanPemantik: string[];
		praktikPedagogis: {
			model: string;
			alasanPemilihan: string;
		};
		kemitraanPembelajaran: string;
		lingkunganPembelajaran: {
			fisik: string;
			digital: string;
			psikososial: string;
		};
		pemanfaatanTeknologiDigital: string;
	};
	tahapMemahami: {
		kegiatanAwal: {
			aktivitasGuru: string;
			aktivitasMurid: string;
			penerapanPrinsip: string;
			alokasiWaktu: string;
		};
		kegiatanInti: Array<{
			langkah: string;
			peranGuru: string;
			aktivitasMurid: string;
			alokasiWaktu: string;
		}>;
	};
	tahapMengaplikasi: {
		konteksMasalahAutentik: string;
		tugasTantangan: string;
		langkahKerja: string[];
		produkSolusiNyata: string;
		keterkaitanKehidupanNyata: string;
	};
	tahapMerefleksi: {
		pertanyaanRefleksi: string[];
		kesimpulanPembelajaran: string;
	};
	asesmen: {
		diagnostik: string;
		formatif: Array<{
			teknik: string;
			instrumen: string;
			waktu: string;
			tindakLanjut: string;
		}>;
		sumatif: string;
	};
	rubrik: Array<{
		kriteria: string;
		sangatBaik: string;
		baik: string;
		cukup: string;
		perluBimbingan: string;
	}>;
	diferensiasi: {
		konten: string;
		proses: string;
		produk: string;
		dukunganKhusus: string;
	};
	remedialDanPengayaan: {
		remedial: string;
		pengayaan: string;
	};
	refleksiGuru: string[];
	lampiran: {
		bahanAjarRingkas: string;
		petunjukLkpd: string;
		mediaDanSumber: string;
		glosarium: Array<{ istilah: string; definisi: string }>;
		daftarPustaka: string[];
	};
};

export type GenerateModulAjarInput = {
	user: { id: number; type: string };
	sekolahNama: string;
	guruNama: string;
	mapelNama: string;
	fase: string;
	tingkat: string;
	semester: string;
	tahunAjaran: string;
	materiPokok: string;
	alokasiWaktu: string;
	jumlahPertemuan: string;
	modelPembelajaran: string;
	dimensiProfil: string[];
	capaianPembelajaran: string;
	tujuanPembelajaranList: string[];
};

const DEFAULT_FALLBACK_API = {
	baseUrl: 'https://openai.ppti.me/v1',
	apiKey: 'sk-a2af36cf21b28688-6a47fa-1f589413',
	model: 'gemini/gemini-3.5-flash-lite'
};

const REQUEST_TIMEOUT_MS = 180_000;

export async function generateModulAjarContent(
	input: GenerateModulAjarInput
): Promise<ModulAjarKonten> {
	const userAi = await getAiSettings(input.user);

	const apiKey = userAi?.apiKey || DEFAULT_FALLBACK_API.apiKey;
	const model = userAi?.model || DEFAULT_FALLBACK_API.model;
	const baseUrl = (userAi?.baseUrl || DEFAULT_FALLBACK_API.baseUrl).replace(/\/+$/, '');

	const promptSystem = `Anda adalah asisten perancang kurikulum dan pakar pedagogi pendidikan menengah (SMA) terkemuka di Indonesia.
Tugas Anda adalah merancang Modul Ajar Pembelajaran Mendalam (Deep Learning) standar pengawas sekolah dengan 12 Bagian (B sampai L).

PEDOMAN WAJIB BAHASA & PEDAGOGI (EYD V & ANTI-SLOP):
1. Terapkan secara ketat Pedoman Ejaan Bahasa Indonesia yang Disempurnakan Edisi V (EYD V Kemendikdasmen RI).
   - Penulisan kata depan 'di' dan 'ke' terpisah jika menunjukkan tempat/posisi (di mana, di sekolah, ke depan).
   - Penggabungan imbuhan ditulis serangkai (diterapkan, dikembangkan, mengoordinasikan, mengubah).
   - Kata majemuk ditulis terpisah jika dasar (tanda tangan, kerja sama, tanggung jawab), serangkai jika berkonfiks (menandatangani, mempertanggungjawabkan).
   - Partikel 'pun' terpisah untuk makna 'juga' (apa pun, murid pun), kecuali 12 konjungsi baku (walaupun, meskipun, adapun).
2. Bahasa Kependidikan yang Operasional & Nyata (Bebas AI-Slop):
   - Gunakan Kata Kerja Operasional (KKO) Taksonomi SOLO & Bloom Revisi yang jelas dan terukur.
   - HINDARI kalimat klise AI kosong (misalnya: "menyelami samudra ilmu", "dalam era globalisasi yang serba cepat ini", "membuka cakrawala berpikir yang tak bertepi").
   - Deskripsi kegiatan harus realistis, operasional, dan siap diterapkan langsung oleh guru di ruang kelas.
3. Desain Pembelajaran Mendalam (Deep Learning):
   - Mengintegrasikan prinsip Mindful (berkesadaran penuh), Meaningful (bermakna dan kontekstual), dan Joyful (menggembirakan).
   - Terbagi dalam 3 tahap pengalaman belajar yang jelas: Memahami (Understanding), Mengaplikasi (Applying), dan Merefleksi (Reflecting).
   - Rubrik asesmen memuat 4 skala deskriptif yang jelas (4: Sangat Baik, 3: Baik, 2: Cukup, 1: Perlu Bimbingan).

Format output HARUS HANYA berupa JSON valid sesuai skema yang diminta, tanpa awalan markdown seperti \`\`\`json atau teks pengantar lainnya.`;

	const promptUser = `Rancanglah Modul Ajar Pembelajaran Mendalam untuk data berikut:
- Sekolah: ${input.sekolahNama}
- Guru: ${input.guruNama}
- Mata Pelajaran: ${input.mapelNama}
- Fase/Kelas: Fase ${input.fase} / Kelas ${input.tingkat}
- Semester: ${input.semester}
- Tahun Pelajaran: ${input.tahunAjaran}
- Materi Pokok / Topik: ${input.materiPokok}
- Alokasi Waktu: ${input.alokasiWaktu}
- Jumlah Pertemuan: ${input.jumlahPertemuan}
- Model Pembelajaran: ${input.modelPembelajaran}
- Dimensi Profil Lulusan / Pelajar: ${input.dimensiProfil.join(', ') || 'Penalaran Kritis, Kreativitas, Kolaborasi, Kemandirian'}
- Capaian Pembelajaran: ${input.capaianPembelajaran || 'Sesuai kurikulum nasional mapel terkait'}
- Tujuan Pembelajaran Dasar:
${input.tujuanPembelajaranList.map((tp, idx) => `  ${idx + 1}. ${tp}`).join('\n') || '  1. Menguasai konsep dan aplikasi materi'}

Kembalikan HANYA objek JSON dengan format struktur berikut:
{
  "identifikasi": {
    "karakteristikPesertaDidik": "...",
    "karakteristikMateri": "...",
    "dimensiProfilLulusan": [
      { "dimensi": "...", "penjelasan": "..." }
    ]
  },
  "desain": {
    "capaianPembelajaran": "...",
    "tujuanPembelajaran": {
      "memahami": ["..."],
      "mengaplikasi": ["..."],
      "merefleksi": ["..."]
    },
    "topikEsensial": ["..."],
    "pertanyaanPemantik": ["..."],
    "praktikPedagogis": {
      "model": "${input.modelPembelajaran}",
      "alasanPemilihan": "..."
    },
    "kemitraanPembelajaran": "...",
    "lingkunganPembelajaran": {
      "fisik": "...",
      "digital": "...",
      "psikososial": "..."
    },
    "pemanfaatanTeknologiDigital": "..."
  },
  "tahapMemahami": {
    "kegiatanAwal": {
      "aktivitasGuru": "...",
      "aktivitasMurid": "...",
      "penerapanPrinsip": "...",
      "alokasiWaktu": "15 Menit"
    },
    "kegiatanInti": [
      { "langkah": "Eksplorasi Konsep", "peranGuru": "...", "aktivitasMurid": "...", "alokasiWaktu": "25 Menit" },
      { "langkah": "Diskusi dan Pengorganisasian Ide", "peranGuru": "...", "aktivitasMurid": "...", "alokasiWaktu": "25 Menit" }
    ]
  },
  "tahapMengaplikasi": {
    "konteksMasalahAutentik": "...",
    "tugasTantangan": "...",
    "langkahKerja": ["..."],
    "produkSolusiNyata": "...",
    "keterkaitanKehidupanNyata": "..."
  },
  "tahapMerefleksi": {
    "pertanyaanRefleksi": [
      "Apa hal paling bermakna yang Anda pelajari hari ini?",
      "Bagian mana yang paling menantang dan bagaimana Anda mengatasinya?",
      "Bagaimana pemahaman ini dapat Anda terapkan dalam kehidupan sehari-hari?",
      "Apa yang akan Anda lakukan secara berbeda jika mengerjakan tugas serupa lagi?",
      "Nilai-nilai Profil Pelajar apa yang berkembang selama proses pembelajaran ini?"
    ],
    "kesimpulanPembelajaran": "..."
  },
  "asesmen": {
    "diagnostik": "...",
    "formatif": [
      { "teknik": "...", "instrumen": "...", "waktu": "...", "tindakLanjut": "..." }
    ],
    "sumatif": "..."
  },
  "rubrik": [
    { "kriteria": "Pemahaman Konsep Esensial", "sangatBaik": "...", "baik": "...", "cukup": "...", "perluBimbingan": "..." },
    { "kriteria": "Aplikasi dan Pemecahan Masalah", "sangatBaik": "...", "baik": "...", "cukup": "...", "perluBimbingan": "..." },
    { "kriteria": "Kreativitas Produk / Solusi", "sangatBaik": "...", "baik": "...", "cukup": "...", "perluBimbingan": "..." },
    { "kriteria": "Kolaborasi dan Komunikasi", "sangatBaik": "...", "baik": "...", "cukup": "...", "perluBimbingan": "..." },
    { "kriteria": "Refleksi Kritis", "sangatBaik": "...", "baik": "...", "cukup": "...", "perluBimbingan": "..." }
  ],
  "diferensiasi": {
    "konten": "...",
    "proses": "...",
    "produk": "...",
    "dukunganKhusus": "..."
  },
  "remedialDanPengayaan": {
    "remedial": "...",
    "pengayaan": "..."
  },
  "refleksiGuru": [
    "Apakah tujuan pembelajaran tercapai oleh seluruh peserta didik?",
    "Bagian kegiatan mana yang paling menarik perhatian peserta didik?",
    "Kendala apa yang dihadapi selama proses pembelajaran berlangsung?",
    "Apakah alokasi waktu mencukupi untuk setiap tahapan pengalaman belajar?",
    "Langkah perbaikan apa yang perlu dilakukan untuk pertemuan pembelajaran berikutnya?"
  ],
  "lampiran": {
    "bahanAjarRingkas": "...",
    "petunjukLkpd": "...",
    "mediaDanSumber": "...",
    "glosarium": [
      { "istilah": "...", "definisi": "..." }
    ],
    "daftarPustaka": ["..."]
  }
}`;

	const isGeminiNative = baseUrl.includes('generativelanguage.googleapis.com');
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

	let rawText: string;
	try {
		if (isGeminiNative) {
			const endpoint = `${baseUrl}/v1beta/models/${model}:generateContent`;
			const res = await fetch(endpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-goog-api-key': apiKey
				},
				signal: controller.signal,
				body: JSON.stringify({
					contents: [{ parts: [{ text: `${promptSystem}\n\n${promptUser}` }] }],
					generationConfig: {
						responseMimeType: 'application/json',
						maxOutputTokens: 8192
					}
				})
			});
			if (!res.ok) {
				const errBody = await res.text().catch(() => '');
				throw new Error(`AI API error (${res.status}): ${errBody || res.statusText}`);
			}
			const data = (await res.json()) as {
				candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
			};
			rawText = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
		} else {
			const endpoint = `${baseUrl}/chat/completions`;
			const res = await fetch(endpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${apiKey}`
				},
				signal: controller.signal,
				body: JSON.stringify({
					model,
					messages: [
						{ role: 'system', content: promptSystem },
						{ role: 'user', content: promptUser }
					],
					max_tokens: 8192,
					temperature: 0.7
				})
			});
			if (!res.ok) {
				const errBody = await res.text().catch(() => '');
				throw new Error(`AI API error (${res.status}): ${errBody || res.statusText}`);
			}
			const data = (await res.json()) as {
				choices?: Array<{ message?: { content?: string } }>;
			};
			rawText = data.choices?.[0]?.message?.content ?? '';
		}
	} catch (e: unknown) {
		clearTimeout(timer);
		if (e instanceof Error && e.name === 'AbortError') {
			throw new Error(
				'Permintaan pembuatan modul ajar oleh AI melebihi batas waktu (timeout). Coba sederhanakan lingkup materi.',
				{ cause: e }
			);
		}
		throw e;
	} finally {
		clearTimeout(timer);
	}

	if (!rawText.trim()) {
		throw new Error('AI tidak menghasilkan konten modul ajar.');
	}

	return parseModulAjarJson(rawText);
}

function parseModulAjarJson(text: string): ModulAjarKonten {
	let cleaned = text.trim();
	// Bersihkan markdown code block jika ada
	if (cleaned.startsWith('```')) {
		cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
	}

	// Cari indeks kurung kurawal pembuka pertama dan penutup terakhir
	const startIdx = cleaned.indexOf('{');
	const endIdx = cleaned.lastIndexOf('}');
	if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
		cleaned = cleaned.substring(startIdx, endIdx + 1);
	}

	try {
		const parsed = JSON.parse(cleaned) as Partial<ModulAjarKonten>;
		return sanitizeModulAjarKonten(parsed);
	} catch (e) {
		console.error('[parseModulAjarJson] Gagal parse JSON:', cleaned, e);
		throw new Error(
			'AI menghasilkan teks yang tidak dapat diurai sebagai JSON valid. Silakan coba kembali.',
			{ cause: e }
		);
	}
}

function sanitizeModulAjarKonten(data: Partial<ModulAjarKonten>): ModulAjarKonten {
	return {
		identifikasi: {
			karakteristikPesertaDidik: data.identifikasi?.karakteristikPesertaDidik ?? '',
			karakteristikMateri: data.identifikasi?.karakteristikMateri ?? '',
			dimensiProfilLulusan: Array.isArray(data.identifikasi?.dimensiProfilLulusan)
				? data.identifikasi.dimensiProfilLulusan
				: []
		},
		desain: {
			capaianPembelajaran: data.desain?.capaianPembelajaran ?? '',
			tujuanPembelajaran: {
				memahami: Array.isArray(data.desain?.tujuanPembelajaran?.memahami)
					? data.desain.tujuanPembelajaran.memahami
					: [],
				mengaplikasi: Array.isArray(data.desain?.tujuanPembelajaran?.mengaplikasi)
					? data.desain.tujuanPembelajaran.mengaplikasi
					: [],
				merefleksi: Array.isArray(data.desain?.tujuanPembelajaran?.merefleksi)
					? data.desain.tujuanPembelajaran.merefleksi
					: []
			},
			topikEsensial: Array.isArray(data.desain?.topikEsensial) ? data.desain.topikEsensial : [],
			pertanyaanPemantik: Array.isArray(data.desain?.pertanyaanPemantik)
				? data.desain.pertanyaanPemantik
				: [],
			praktikPedagogis: {
				model: data.desain?.praktikPedagogis?.model ?? '',
				alasanPemilihan: data.desain?.praktikPedagogis?.alasanPemilihan ?? ''
			},
			kemitraanPembelajaran: data.desain?.kemitraanPembelajaran ?? '',
			lingkunganPembelajaran: {
				fisik: data.desain?.lingkunganPembelajaran?.fisik ?? '',
				digital: data.desain?.lingkunganPembelajaran?.digital ?? '',
				psikososial: data.desain?.lingkunganPembelajaran?.psikososial ?? ''
			},
			pemanfaatanTeknologiDigital: data.desain?.pemanfaatanTeknologiDigital ?? ''
		},
		tahapMemahami: {
			kegiatanAwal: {
				aktivitasGuru: data.tahapMemahami?.kegiatanAwal?.aktivitasGuru ?? '',
				aktivitasMurid: data.tahapMemahami?.kegiatanAwal?.aktivitasMurid ?? '',
				penerapanPrinsip: data.tahapMemahami?.kegiatanAwal?.penerapanPrinsip ?? '',
				alokasiWaktu: data.tahapMemahami?.kegiatanAwal?.alokasiWaktu ?? '15 Menit'
			},
			kegiatanInti: Array.isArray(data.tahapMemahami?.kegiatanInti)
				? data.tahapMemahami.kegiatanInti
				: []
		},
		tahapMengaplikasi: {
			konteksMasalahAutentik: data.tahapMengaplikasi?.konteksMasalahAutentik ?? '',
			tugasTantangan: data.tahapMengaplikasi?.tugasTantangan ?? '',
			langkahKerja: Array.isArray(data.tahapMengaplikasi?.langkahKerja)
				? data.tahapMengaplikasi.langkahKerja
				: [],
			produkSolusiNyata: data.tahapMengaplikasi?.produkSolusiNyata ?? '',
			keterkaitanKehidupanNyata: data.tahapMengaplikasi?.keterkaitanKehidupanNyata ?? ''
		},
		tahapMerefleksi: {
			pertanyaanRefleksi: Array.isArray(data.tahapMerefleksi?.pertanyaanRefleksi)
				? data.tahapMerefleksi.pertanyaanRefleksi
				: [],
			kesimpulanPembelajaran: data.tahapMerefleksi?.kesimpulanPembelajaran ?? ''
		},
		asesmen: {
			diagnostik: data.asesmen?.diagnostik ?? '',
			formatif: Array.isArray(data.asesmen?.formatif) ? data.asesmen.formatif : [],
			sumatif: data.asesmen?.sumatif ?? ''
		},
		rubrik: Array.isArray(data.rubrik) ? data.rubrik : [],
		diferensiasi: {
			konten: data.diferensiasi?.konten ?? '',
			proses: data.diferensiasi?.proses ?? '',
			produk: data.diferensiasi?.produk ?? '',
			dukunganKhusus: data.diferensiasi?.dukunganKhusus ?? ''
		},
		remedialDanPengayaan: {
			remedial: data.remedialDanPengayaan?.remedial ?? '',
			pengayaan: data.remedialDanPengayaan?.pengayaan ?? ''
		},
		refleksiGuru: Array.isArray(data.refleksiGuru) ? data.refleksiGuru : [],
		lampiran: {
			bahanAjarRingkas: data.lampiran?.bahanAjarRingkas ?? '',
			petunjukLkpd: data.lampiran?.petunjukLkpd ?? '',
			mediaDanSumber: data.lampiran?.mediaDanSumber ?? '',
			glosarium: Array.isArray(data.lampiran?.glosarium) ? data.lampiran.glosarium : [],
			daftarPustaka: Array.isArray(data.lampiran?.daftarPustaka) ? data.lampiran.daftarPustaka : []
		}
	};
}
