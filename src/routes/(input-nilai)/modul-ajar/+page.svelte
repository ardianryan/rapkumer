<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	import { toast } from '$lib/components/toast.svelte';
	import { invalidate } from '$app/navigation';
	import type { PageData } from './$types';
	import type { ModulAjarKonten } from '$lib/server/ai-modul-ajar';
	import type { ModulAjarRecord } from '$lib/server/db/modul-ajar-db';

	const { data }: { data: PageData } = $props();

	// State daftar modul ajar
	let filterMapelId = $state<number | null>(null);

	// State modal editor
	let showModal = $state(false);
	let isGenerating = $state(false);
	let isSaving = $state(false);
	let activeTab = $state<
		| 'identitas'
		| 'identifikasi'
		| 'desain'
		| 'memahami'
		| 'mengaplikasi'
		| 'merefleksi'
		| 'asesmen'
		| 'rubrik'
		| 'diferensiasi'
		| 'remedial'
		| 'refleksi'
		| 'lampiran'
	>('identitas');

	// Model form fields
	let editId = $state(0);
	let selectedMapelId = $state<number | null>(null);
	let materiPokok = $state('');
	let alokasiWaktu = $state('2 x 45 Menit');
	let jumlahPertemuan = $state('Pertemuan Ke-1 dari 2 Pertemuan');
	let modelPembelajaran = $state('Problem-Based Learning');
	let selectedDimensi = $state<string[]>([
		'Penalaran Kritis',
		'Kreativitas',
		'Kolaborasi',
		'Kemandirian'
	]);
	let selectedTpIds = $state<number[]>([]);
	let statusModul = $state<'draf' | 'final'>('draf');

	// Default empty 12 sections content
	const defaultKonten = (): ModulAjarKonten => ({
		identifikasi: {
			karakteristikPesertaDidik: '',
			karakteristikMateri: '',
			dimensiProfilLulusan: []
		},
		desain: {
			capaianPembelajaran: '',
			tujuanPembelajaran: { memahami: [], mengaplikasi: [], merefleksi: [] },
			topikEsensial: [],
			pertanyaanPemantik: [],
			praktikPedagogis: { model: 'Problem-Based Learning', alasanPemilihan: '' },
			kemitraanPembelajaran: '',
			lingkunganPembelajaran: { fisik: '', digital: '', psikososial: '' },
			pemanfaatanTeknologiDigital: ''
		},
		tahapMemahami: {
			kegiatanAwal: {
				aktivitasGuru: '',
				aktivitasMurid: '',
				penerapanPrinsip: '',
				alokasiWaktu: '15 Menit'
			},
			kegiatanInti: []
		},
		tahapMengaplikasi: {
			konteksMasalahAutentik: '',
			tugasTantangan: '',
			langkahKerja: [],
			produkSolusiNyata: '',
			keterkaitanKehidupanNyata: ''
		},
		tahapMerefleksi: {
			pertanyaanRefleksi: [
				'Apa hal paling bermakna yang Anda pelajari hari ini?',
				'Bagian mana yang paling menantang dan bagaimana Anda mengatasinya?',
				'Bagaimana pemahaman ini dapat Anda terapkan dalam kehidupan sehari-hari?',
				'Apa yang akan Anda lakukan secara berbeda jika mengerjakan tugas serupa lagi?',
				'Nilai-nilai Profil Pelajar apa yang berkembang selama proses pembelajaran ini?'
			],
			kesimpulanPembelajaran: ''
		},
		asesmen: {
			diagnostik: '',
			formatif: [],
			sumatif: ''
		},
		rubrik: [],
		diferensiasi: {
			konten: '',
			proses: '',
			produk: '',
			dukunganKhusus: ''
		},
		remedialDanPengayaan: {
			remedial: '',
			pengayaan: ''
		},
		refleksiGuru: [
			'Apakah tujuan pembelajaran tercapai oleh seluruh peserta didik?',
			'Bagian kegiatan mana yang paling menarik perhatian peserta didik?',
			'Kendala apa yang dihadapi selama proses pembelajaran berlangsung?',
			'Apakah alokasi waktu mencukupi untuk setiap tahapan pengalaman belajar?',
			'Langkah perbaikan apa yang perlu dilakukan untuk pertemuan pembelajaran berikutnya?'
		],
		lampiran: {
			bahanAjarRingkas: '',
			petunjukLkpd: '',
			mediaDanSumber: '',
			glosarium: [],
			daftarPustaka: []
		}
	});

	let konten = $state<ModulAjarKonten>(defaultKonten());

	// Dimensi opsi
	const dimensiPilihan = [
		'Keimanan & Ketakwaan',
		'Kewargaan & Kebangsaan',
		'Penalaran Kritis',
		'Kreativitas',
		'Kolaborasi',
		'Kemandirian',
		'Kesehatan & Kebugaran',
		'Komunikasi'
	];

	// Filtered modul ajar
	const listModul = $derived(
		(data.daftarModulAjar || []).filter((m) =>
			filterMapelId ? m.mataPelajaranId === filterMapelId : true
		)
	);

	// Tujuan Pembelajaran untuk mapel terpilih
	const availableTps = $derived(
		(data.tujuanPembelajaranList || []).filter((tp) => tp.mataPelajaranId === selectedMapelId)
	);

	function openCreateModal() {
		editId = 0;
		selectedMapelId = data.mataPelajaranList?.[0]?.id ?? null;
		materiPokok = '';
		alokasiWaktu = '2 x 45 Menit';
		jumlahPertemuan = 'Pertemuan Ke-1 dari 2 Pertemuan';
		modelPembelajaran = 'Problem-Based Learning';
		selectedDimensi = ['Penalaran Kritis', 'Kreativitas', 'Kolaborasi', 'Kemandirian'];
		selectedTpIds = [];
		statusModul = 'draf';
		konten = defaultKonten();
		activeTab = 'identitas';
		showModal = true;
	}

	function openEditModal(item: ModulAjarRecord) {
		editId = item.id;
		selectedMapelId = item.mataPelajaranId;
		materiPokok = item.materiPokok;
		alokasiWaktu = item.alokasiWaktu;
		jumlahPertemuan = item.jumlahPertemuan;
		modelPembelajaran = item.modelPembelajaran;
		selectedDimensi = item.dimensiProfil || [];
		selectedTpIds = item.tujuanPembelajaranIds || [];
		statusModul = item.status || 'draf';
		konten = item.konten || defaultKonten();
		activeTab = 'identitas';
		showModal = true;
	}

	function toggleDimensi(d: string) {
		if (selectedDimensi.includes(d)) {
			selectedDimensi = selectedDimensi.filter((item) => item !== d);
		} else {
			selectedDimensi = [...selectedDimensi, d];
		}
	}

	function toggleTp(id: number) {
		if (selectedTpIds.includes(id)) {
			selectedTpIds = selectedTpIds.filter((item) => item !== id);
		} else {
			selectedTpIds = [...selectedTpIds, id];
		}
	}

	async function handleGenerateAi() {
		if (!selectedMapelId) {
			toast('Pilih mata pelajaran terlebih dahulu.', 'error');
			return;
		}
		if (!materiPokok.trim()) {
			toast('Isi materi pokok / topik terlebih dahulu.', 'error');
			return;
		}

		isGenerating = true;
		try {
			const res = await fetch('/api/ai/modul-ajar', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					mapelId: selectedMapelId,
					kelasId: data.selectedKelasId,
					materiPokok,
					alokasiWaktu,
					jumlahPertemuan,
					modelPembelajaran,
					dimensiProfil: selectedDimensi,
					tujuanPembelajaranIds: selectedTpIds
				})
			});

			const json = await res.json();
			if (!res.ok || json.error) {
				throw new Error(json.error || 'Gagal generate modul ajar');
			}

			konten = json.konten;
			toast('✨ Modul ajar berhasil dibuat otomatis oleh AI!', 'success');
			activeTab = 'identifikasi';
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem';
			toast(msg, 'error');
		} finally {
			isGenerating = false;
		}
	}

	async function handleSave(statusToSave: 'draf' | 'final') {
		if (!selectedMapelId) {
			toast('Pilih mata pelajaran.', 'error');
			return;
		}
		if (!materiPokok.trim()) {
			toast('Isi materi pokok.', 'error');
			return;
		}

		isSaving = true;
		const formData = new FormData();
		if (editId > 0) formData.append('id', String(editId));
		formData.append('kelasId', String(data.selectedKelasId));
		formData.append('mataPelajaranId', String(selectedMapelId));
		formData.append('materiPokok', materiPokok);
		formData.append('alokasiWaktu', alokasiWaktu);
		formData.append('jumlahPertemuan', jumlahPertemuan);
		formData.append('modelPembelajaran', modelPembelajaran);
		formData.append('status', statusToSave);
		formData.append('dimensiProfil', JSON.stringify(selectedDimensi));
		formData.append('tujuanPembelajaranIds', JSON.stringify(selectedTpIds));
		formData.append('konten', JSON.stringify(konten));

		try {
			const res = await fetch('?/simpan', {
				method: 'POST',
				body: formData
			});
			const result = await res.json();
			if (result.type === 'success' || result.status === 200) {
				toast(
					statusToSave === 'final'
						? 'Modul ajar berhasil difinalkan!'
						: 'Draf modul ajar berhasil disimpan.',
					'success'
				);
				showModal = false;
				await invalidate('app:modul-ajar');
			} else {
				throw new Error(result.data?.message || 'Gagal menyimpan');
			}
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Gagal menyimpan modul ajar';
			toast(msg, 'error');
		} finally {
			isSaving = false;
		}
	}

	async function handleDelete(id: number) {
		if (!confirm('Apakah Anda yakin ingin menghapus modul ajar ini?')) return;
		const formData = new FormData();
		formData.append('id', String(id));

		try {
			const res = await fetch('?/hapus', {
				method: 'POST',
				body: formData
			});
			const result = await res.json();
			if (result.type === 'success' || result.status === 200) {
				toast('Modul ajar berhasil dihapus.', 'success');
				await invalidate('app:modul-ajar');
			} else {
				throw new Error(result.data?.message || 'Gagal menghapus');
			}
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Gagal menghapus modul ajar';
			toast(msg, 'error');
		}
	}

	async function handleDuplicate(id: number) {
		const formData = new FormData();
		formData.append('id', String(id));

		try {
			const res = await fetch('?/duplikasi', {
				method: 'POST',
				body: formData
			});
			const result = await res.json();
			if (result.type === 'success' || result.status === 200) {
				toast('Modul ajar berhasil diduplikasi sebagai draf.', 'success');
				await invalidate('app:modul-ajar');
			} else {
				throw new Error(result.data?.message || 'Gagal menduplikasi');
			}
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Gagal menduplikasi modul ajar';
			toast(msg, 'error');
		}
	}
</script>

<svelte:head>
	<title>Modul Ajar Pembelajaran Mendalam - Rapkumer</title>
</svelte:head>

<div class="space-y-6">
	<!-- Page Header -->
	<div
		class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-base-100 p-6 rounded-2xl shadow-sm border border-base-200"
	>
		<div>
			<div class="flex items-center gap-2">
				<span class="p-2.5 rounded-xl bg-primary/10 text-primary">
					<Icon name="book" />
				</span>
				<div>
					<h1 class="text-2xl font-bold tracking-tight">Modul Ajar Pembelajaran Mendalam</h1>
					<p class="text-sm text-base-content/70 mt-0.5">
						Format 12 Bab Resmi Standar Pengawas dengan Asistensi AI & Ejaan EYD Edisi V
					</p>
				</div>
			</div>
		</div>

		<div class="flex items-center gap-3">
			<button type="button" class="btn btn-primary gap-2 shadow-sm" onclick={openCreateModal}>
				<Icon name="plus" />
				<span>Buat Modul Ajar</span>
			</button>
		</div>
	</div>

	<!-- Filter & Stat Bar -->
	<div
		class="flex flex-wrap items-center justify-between gap-4 bg-base-100 p-4 rounded-xl border border-base-200"
	>
		<div class="flex items-center gap-3">
			<label
				for="filter-mapel"
				class="text-xs font-semibold text-base-content/60 uppercase tracking-wider"
				>Filter Mapel:</label
			>
			<select
				id="filter-mapel"
				class="select select-sm select-bordered w-64"
				bind:value={filterMapelId}
			>
				<option value={null}>Semua Mata Pelajaran</option>
				{#each data.mataPelajaranList || [] as mapel (mapel.id)}
					<option value={mapel.id}>{mapel.nama}</option>
				{/each}
			</select>
		</div>

		<div class="text-xs font-medium text-base-content/60">
			Total Modul: <span class="font-bold text-base-content">{listModul.length}</span> modul tersimpan
		</div>
	</div>

	<!-- Card List View -->
	{#if listModul.length === 0}
		<div
			class="flex flex-col items-center justify-center p-12 bg-base-100 rounded-2xl border border-dashed border-base-300 text-center"
		>
			<div class="p-4 rounded-full bg-base-200 text-base-content/50 mb-3">
				<Icon name="book" />
			</div>
			<h3 class="text-lg font-semibold">Belum Ada Modul Ajar</h3>
			<p class="text-sm text-base-content/60 max-w-md mt-1 mb-5">
				Mulai buat modul ajar pembelajaran mendalam Anda dengan bantuan AI sesuai standar pengawas
				dan kaidah EYD V.
			</p>
			<button type="button" class="btn btn-primary btn-sm gap-2" onclick={openCreateModal}>
				<Icon name="plus" />
				Buat Sekarang
			</button>
		</div>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
			{#each listModul as m (m.id)}
				<div
					class="card bg-base-100 border border-base-200 hover:border-primary/40 hover:shadow-md transition-all flex flex-col justify-between"
				>
					<div class="card-body p-5">
						<!-- Badge status & waktu -->
						<div class="flex items-center justify-between gap-2 mb-2">
							<span
								class="badge badge-sm {m.status === 'final'
									? 'badge-success text-white'
									: 'badge-warning text-warning-content'} font-medium"
							>
								{m.status === 'final' ? 'Final' : 'Draf'}
							</span>
							<span class="text-xs text-base-content/50">
								{m.alokasiWaktu}
							</span>
						</div>

						<!-- Materi Pokok -->
						<h3 class="font-bold text-lg line-clamp-2 text-base-content hover:text-primary">
							{m.materiPokok}
						</h3>

						<!-- Info Detail -->
						<div class="space-y-1.5 mt-3 text-xs text-base-content/70">
							<div class="flex items-center gap-1.5">
								<span class="font-medium text-base-content/90">Mapel:</span>
								<span class="truncate">{m.mapelNama || 'Mata Pelajaran'}</span>
							</div>
							<div class="flex items-center gap-1.5">
								<span class="font-medium text-base-content/90">Pertemuan:</span>
								<span>{m.jumlahPertemuan}</span>
							</div>
							<div class="flex items-center gap-1.5">
								<span class="font-medium text-base-content/90">Model:</span>
								<span class="truncate">{m.modelPembelajaran}</span>
							</div>
						</div>

						<!-- Dimensi Profil Tags -->
						{#if m.dimensiProfil && m.dimensiProfil.length > 0}
							<div class="flex flex-wrap gap-1 mt-3">
								{#each m.dimensiProfil.slice(0, 3) as dim, dIdx (dIdx)}
									<span class="badge badge-xs badge-ghost text-[10px] py-1">
										{dim}
									</span>
								{/each}
								{#if m.dimensiProfil.length > 3}
									<span class="text-[10px] text-base-content/50">
										+{m.dimensiProfil.length - 3} lainnya
									</span>
								{/if}
							</div>
						{/if}
					</div>

					<!-- Card Actions -->
					<div
						class="border-t border-base-200 px-5 py-3 bg-base-200/30 flex items-center justify-between rounded-b-2xl"
					>
						<div class="flex items-center gap-1.5">
							<button
								type="button"
								class="btn btn-xs btn-outline btn-primary gap-1"
								onclick={() => openEditModal(m)}
								title="Edit Modul"
							>
								<Icon name="edit" />
								Edit
							</button>
							<button
								type="button"
								class="btn btn-xs btn-outline gap-1"
								onclick={() => window.open('/api/pdf/modul-ajar?id=' + m.id, '_blank')}
								title="Cetak PDF Resmi"
							>
								<Icon name="print" />
								PDF
							</button>
						</div>

						<div class="flex items-center gap-1">
							<button
								type="button"
								class="btn btn-xs btn-ghost btn-square"
								onclick={() => handleDuplicate(m.id)}
								title="Salin / Duplikasi Modul"
							>
								<Icon name="copy" />
							</button>
							<button
								type="button"
								class="btn btn-xs btn-ghost btn-square text-error"
								onclick={() => handleDelete(m.id)}
								title="Hapus Modul"
							>
								<Icon name="del" />
							</button>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- MODAL EDITOR & AI GENERATOR -->
{#if showModal}
	<div class="modal modal-open z-50">
		<div
			class="modal-box w-11/12 max-w-6xl max-h-[92vh] flex flex-col p-0 overflow-hidden shadow-2xl rounded-2xl"
		>
			<!-- Modal Header -->
			<div
				class="flex items-center justify-between px-6 py-4 border-b border-base-200 bg-base-100 sticky top-0 z-10"
			>
				<div>
					<h2 class="text-xl font-bold flex items-center gap-2">
						{#if editId > 0}
							<Icon name="edit" />
							Edit Modul Ajar Pembelajaran Mendalam
						{:else}
							<Icon name="plus" />
							Buat Modul Ajar Pembelajaran Mendalam
						{/if}
					</h2>
					<p class="text-xs text-base-content/60 mt-0.5">
						Sesuai Format 12 Bagian Pengawas & Standar Kaidah EYD V Kemendikdasmen
					</p>
				</div>
				<button
					type="button"
					class="btn btn-sm btn-ghost btn-circle"
					onclick={() => (showModal = false)}
				>
					✕
				</button>
			</div>

			<!-- Navigation Tabs -->
			<div
				class="flex items-center gap-1 overflow-x-auto px-6 py-2 bg-base-200/50 border-b border-base-200 text-xs font-medium no-scrollbar"
			>
				<button
					type="button"
					class="px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors {activeTab ===
					'identitas'
						? 'bg-primary text-primary-content font-bold shadow-sm'
						: 'hover:bg-base-200 text-base-content/70'}"
					onclick={() => (activeTab = 'identitas')}
				>
					A. Identitas & AI
				</button>
				<button
					type="button"
					class="px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors {activeTab ===
					'identifikasi'
						? 'bg-primary text-primary-content font-bold shadow-sm'
						: 'hover:bg-base-200 text-base-content/70'}"
					onclick={() => (activeTab = 'identifikasi')}
				>
					B. Identifikasi
				</button>
				<button
					type="button"
					class="px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors {activeTab === 'desain'
						? 'bg-primary text-primary-content font-bold shadow-sm'
						: 'hover:bg-base-200 text-base-content/70'}"
					onclick={() => (activeTab = 'desain')}
				>
					C. Desain
				</button>
				<button
					type="button"
					class="px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors {activeTab ===
					'memahami'
						? 'bg-primary text-primary-content font-bold shadow-sm'
						: 'hover:bg-base-200 text-base-content/70'}"
					onclick={() => (activeTab = 'memahami')}
				>
					D. Tahap Memahami
				</button>
				<button
					type="button"
					class="px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors {activeTab ===
					'mengaplikasi'
						? 'bg-primary text-primary-content font-bold shadow-sm'
						: 'hover:bg-base-200 text-base-content/70'}"
					onclick={() => (activeTab = 'mengaplikasi')}
				>
					E. Mengaplikasi
				</button>
				<button
					type="button"
					class="px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors {activeTab ===
					'merefleksi'
						? 'bg-primary text-primary-content font-bold shadow-sm'
						: 'hover:bg-base-200 text-base-content/70'}"
					onclick={() => (activeTab = 'merefleksi')}
				>
					F. Merefleksi
				</button>
				<button
					type="button"
					class="px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors {activeTab === 'asesmen'
						? 'bg-primary text-primary-content font-bold shadow-sm'
						: 'hover:bg-base-200 text-base-content/70'}"
					onclick={() => (activeTab = 'asesmen')}
				>
					G. Asesmen
				</button>
				<button
					type="button"
					class="px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors {activeTab === 'rubrik'
						? 'bg-primary text-primary-content font-bold shadow-sm'
						: 'hover:bg-base-200 text-base-content/70'}"
					onclick={() => (activeTab = 'rubrik')}
				>
					H. Rubrik
				</button>
				<button
					type="button"
					class="px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors {activeTab ===
					'diferensiasi'
						? 'bg-primary text-primary-content font-bold shadow-sm'
						: 'hover:bg-base-200 text-base-content/70'}"
					onclick={() => (activeTab = 'diferensiasi')}
				>
					I. Diferensiasi
				</button>
				<button
					type="button"
					class="px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors {activeTab ===
					'remedial'
						? 'bg-primary text-primary-content font-bold shadow-sm'
						: 'hover:bg-base-200 text-base-content/70'}"
					onclick={() => (activeTab = 'remedial')}
				>
					J. Remedial
				</button>
				<button
					type="button"
					class="px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors {activeTab ===
					'refleksi'
						? 'bg-primary text-primary-content font-bold shadow-sm'
						: 'hover:bg-base-200 text-base-content/70'}"
					onclick={() => (activeTab = 'refleksi')}
				>
					K. Refleksi Guru
				</button>
				<button
					type="button"
					class="px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors {activeTab ===
					'lampiran'
						? 'bg-primary text-primary-content font-bold shadow-sm'
						: 'hover:bg-base-200 text-base-content/70'}"
					onclick={() => (activeTab = 'lampiran')}
				>
					L. Lampiran
				</button>
			</div>

			<!-- Modal Body (Scrollable) -->
			<div class="flex-1 overflow-y-auto p-6 space-y-6">
				<!-- TAB A: IDENTITAS & AI PROMPT -->
				{#if activeTab === 'identitas'}
					<div class="space-y-6">
						<!-- AI Action Banner -->
						<div
							class="p-5 rounded-2xl bg-gradient-to-r from-primary/10 via-secondary/10 to-primary/5 border border-primary/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
						>
							<div>
								<h3 class="font-bold text-base flex items-center gap-2">
									<Icon name="sparkles" />
									<span>Asistensi AI Pembuat Modul Ajar</span>
								</h3>
								<p class="text-xs text-base-content/70 mt-1 max-w-xl">
									Lengkapi mata pelajaran, topik/materi, dan tujuan pembelajaran di bawah ini. AI
									akan merumuskan seluruh 12 bagian (B sampai L) dengan kaidah pedagogi pembelajaran
									mendalam & EYD V secara otomatis.
								</p>
							</div>
							<button
								type="button"
								class="btn btn-primary gap-2 shrink-0 shadow-md"
								onclick={handleGenerateAi}
								disabled={isGenerating || !materiPokok.trim()}
							>
								{#if isGenerating}
									<span class="loading loading-spinner loading-xs"></span>
									<span>Sedang Merancang...</span>
								{:else}
									<Icon name="sparkles" />
									<span>Generate Lengkap dengan AI</span>
								{/if}
							</button>
						</div>

						<!-- Identitas Form Grid -->
						<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div class="form-control">
								<label for="form-mapel" class="label text-xs font-semibold"
									>Mata Pelajaran <span class="text-error">*</span></label
								>
								<select
									id="form-mapel"
									class="select select-bordered select-sm"
									bind:value={selectedMapelId}
								>
									{#each data.mataPelajaranList || [] as mapel (mapel.id)}
										<option value={mapel.id}>{mapel.nama}</option>
									{/each}
								</select>
							</div>

							<div class="form-control">
								<label for="form-materi" class="label text-xs font-semibold"
									>Materi Pokok / Topik Bahasan <span class="text-error">*</span></label
								>
								<input
									id="form-materi"
									type="text"
									class="input input-bordered input-sm"
									placeholder="Contoh: Reaksi Redoks dan Elektrokimia"
									bind:value={materiPokok}
								/>
							</div>

							<div class="form-control">
								<label for="form-alokasi" class="label text-xs font-semibold">Alokasi Waktu</label>
								<input
									id="form-alokasi"
									type="text"
									class="input input-bordered input-sm"
									placeholder="Contoh: 2 x 45 Menit"
									bind:value={alokasiWaktu}
								/>
							</div>

							<div class="form-control">
								<label for="form-pertemuan" class="label text-xs font-semibold"
									>Jumlah Pertemuan</label
								>
								<input
									id="form-pertemuan"
									type="text"
									class="input input-bordered input-sm"
									placeholder="Contoh: Pertemuan Ke-1 dari 2 Pertemuan"
									bind:value={jumlahPertemuan}
								/>
							</div>

							<div class="form-control">
								<label for="form-model" class="label text-xs font-semibold"
									>Model Pembelajaran</label
								>
								<select
									id="form-model"
									class="select select-bordered select-sm"
									bind:value={modelPembelajaran}
								>
									<option value="Problem-Based Learning">Problem-Based Learning (PBL)</option>
									<option value="Project-Based Learning">Project-Based Learning (PjBL)</option>
									<option value="Discovery Learning">Discovery Learning</option>
									<option value="Inquiry Learning">Inquiry Learning</option>
									<option value="Pembelajaran Berbasis Tantangan"
										>Pembelajaran Berbasis Tantangan</option
									>
								</select>
							</div>

							<div class="form-control">
								<label for="form-status" class="label text-xs font-semibold">Status Dokumen</label>
								<select
									id="form-status"
									class="select select-bordered select-sm"
									bind:value={statusModul}
								>
									<option value="draf">Draf (Dapat Diedit Kembali)</option>
									<option value="final">Final (Siap Disahkan & Dicetak)</option>
								</select>
							</div>
						</div>

						<!-- Dimensi Profil Pelajar Selection -->
						<div class="form-control">
							<span class="label text-xs font-semibold">
								8 Dimensi Profil Lulusan / Pelajar yang Disasar:
							</span>
							<div class="flex flex-wrap gap-2">
								{#each dimensiPilihan as dim (dim)}
									<button
										type="button"
										class="btn btn-xs rounded-lg {selectedDimensi.includes(dim)
											? 'btn-primary'
											: 'btn-outline text-base-content/70'}"
										onclick={() => toggleDimensi(dim)}
									>
										{selectedDimensi.includes(dim) ? '✓ ' : '+ '}
										{dim}
									</button>
								{/each}
							</div>
						</div>

						<!-- TP Checklist dari Database -->
						<div class="form-control">
							<span class="label text-xs font-semibold">
								Tujuan Pembelajaran Tersimpan di Database (Opsional untuk Memandu AI):
							</span>
							{#if availableTps.length === 0}
								<p class="text-xs text-base-content/50 italic">
									Belum ada Tujuan Pembelajaran yang diinput untuk mata pelajaran ini. AI akan
									merumuskan TP berjenjang secara otomatis.
								</p>
							{:else}
								<div
									class="max-h-40 overflow-y-auto space-y-1.5 p-3 bg-base-200/50 rounded-xl border border-base-200"
								>
									{#each availableTps as tp (tp.id)}
										<label
											class="flex items-start gap-2 text-xs cursor-pointer hover:bg-base-200 p-1.5 rounded"
										>
											<input
												type="checkbox"
												class="checkbox checkbox-xs checkbox-primary mt-0.5"
												checked={selectedTpIds.includes(tp.id)}
												onchange={() => toggleTp(tp.id)}
											/>
											<span class="text-base-content/80 leading-relaxed">{tp.deskripsi}</span>
										</label>
									{/each}
								</div>
							{/if}
						</div>
					</div>
				{/if}

				<!-- TAB B: IDENTIFIKASI -->
				{#if activeTab === 'identifikasi'}
					<div class="space-y-4">
						<div class="form-control">
							<label for="karakteristik-murid" class="label text-xs font-semibold"
								>1. Karakteristik Peserta Didik</label
							>
							<textarea
								id="karakteristik-murid"
								class="textarea textarea-bordered text-xs h-24"
								placeholder="Analisis kesiapan belajar, gaya belajar, dan minat peserta didik..."
								bind:value={konten.identifikasi.karakteristikPesertaDidik}></textarea>
						</div>

						<div class="form-control">
							<label for="karakteristik-materi" class="label text-xs font-semibold"
								>2. Karakteristik Materi Pelajaran</label
							>
							<textarea
								id="karakteristik-materi"
								class="textarea textarea-bordered text-xs h-24"
								placeholder="Tingkat kedalaman, jenis konsep (faktual, konseptual, prosedural, metakognitif)..."
								bind:value={konten.identifikasi.karakteristikMateri}></textarea>
						</div>

						<div class="form-control">
							<span class="label text-xs font-semibold">3. Dimensi Profil Lulusan & Integrasi</span>
							<div class="space-y-2">
								{#each konten.identifikasi.dimensiProfilLulusan as item, idx (idx)}
									<div class="flex items-center gap-2">
										<input
											type="text"
											class="input input-bordered input-xs w-48 font-bold"
											bind:value={item.dimensi}
										/>
										<input
											type="text"
											class="input input-bordered input-xs flex-1"
											bind:value={item.penjelasan}
										/>
										<button
											type="button"
											class="btn btn-xs btn-ghost text-error"
											onclick={() =>
												(konten.identifikasi.dimensiProfilLulusan =
													konten.identifikasi.dimensiProfilLulusan.filter((_, i) => i !== idx))}
										>
											✕
										</button>
									</div>
								{/each}
								<button
									type="button"
									class="btn btn-xs btn-outline btn-primary mt-1"
									onclick={() =>
										(konten.identifikasi.dimensiProfilLulusan = [
											...konten.identifikasi.dimensiProfilLulusan,
											{ dimensi: 'Penalaran Kritis', penjelasan: '' }
										])}
								>
									+ Tambah Dimensi
								</button>
							</div>
						</div>
					</div>
				{/if}

				<!-- TAB C: DESAIN PEMBELAJARAN -->
				{#if activeTab === 'desain'}
					<div class="space-y-4">
						<div class="form-control">
							<label for="desain-cp" class="label text-xs font-semibold"
								>1. Capaian Pembelajaran (CP)</label
							>
							<textarea
								id="desain-cp"
								class="textarea textarea-bordered text-xs h-20"
								placeholder="Rumusan Capaian Pembelajaran fase terkait..."
								bind:value={konten.desain.capaianPembelajaran}></textarea>
						</div>

						<div class="form-control">
							<span class="label text-xs font-semibold"
								>2. Tujuan Pembelajaran Berjenjang (Taksonomi SOLO)</span
							>
							<div class="grid grid-cols-1 md:grid-cols-3 gap-3">
								<div class="p-3 bg-base-200/40 rounded-xl">
									<span class="text-xs font-bold text-primary">a. Tahap Memahami:</span>
									<textarea
										class="textarea textarea-bordered text-xs w-full h-24 mt-1.5"
										placeholder="TP pemahaman konsep..."
										value={(konten.desain.tujuanPembelajaran?.memahami || []).join('\n')}
										oninput={(e) =>
											(konten.desain.tujuanPembelajaran.memahami = (e.currentTarget.value || '')
												.split('\n')
												.filter(Boolean))}></textarea>
								</div>
								<div class="p-3 bg-base-200/40 rounded-xl">
									<span class="text-xs font-bold text-secondary">b. Tahap Mengaplikasi:</span>
									<textarea
										class="textarea textarea-bordered text-xs w-full h-24 mt-1.5"
										placeholder="TP aplikasi nyata..."
										value={(konten.desain.tujuanPembelajaran?.mengaplikasi || []).join('\n')}
										oninput={(e) =>
											(konten.desain.tujuanPembelajaran.mengaplikasi = (e.currentTarget.value || '')
												.split('\n')
												.filter(Boolean))}></textarea>
								</div>
								<div class="p-3 bg-base-200/40 rounded-xl">
									<span class="text-xs font-bold text-accent">c. Tahap Merefleksi:</span>
									<textarea
										class="textarea textarea-bordered text-xs w-full h-24 mt-1.5"
										placeholder="TP evaluasi & refleksi..."
										value={(konten.desain.tujuanPembelajaran?.merefleksi || []).join('\n')}
										oninput={(e) =>
											(konten.desain.tujuanPembelajaran.merefleksi = (e.currentTarget.value || '')
												.split('\n')
												.filter(Boolean))}></textarea>
								</div>
							</div>
						</div>

						<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div class="form-control">
								<label for="topik-esensial" class="label text-xs font-semibold"
									>3. Topik & Konsep Esensial (1 baris 1 poin)</label
								>
								<textarea
									id="topik-esensial"
									class="textarea textarea-bordered text-xs h-20"
									value={(konten.desain.topikEsensial || []).join('\n')}
									oninput={(e) =>
										(konten.desain.topikEsensial = (e.currentTarget.value || '')
											.split('\n')
											.filter(Boolean))}></textarea>
							</div>

							<div class="form-control">
								<label for="pertanyaan-pemantik" class="label text-xs font-semibold"
									>4. Pertanyaan Pemantik (1 baris 1 pertanyaan)</label
								>
								<textarea
									id="pertanyaan-pemantik"
									class="textarea textarea-bordered text-xs h-20"
									value={(konten.desain.pertanyaanPemantik || []).join('\n')}
									oninput={(e) =>
										(konten.desain.pertanyaanPemantik = (e.currentTarget.value || '')
											.split('\n')
											.filter(Boolean))}></textarea>
							</div>
						</div>

						<div class="form-control">
							<label for="pedagogis-alasan" class="label text-xs font-semibold"
								>5. Alasan Pemilihan Praktik Pedagogis ({konten.desain.praktikPedagogis
									.model})</label
							>
							<textarea
								id="pedagogis-alasan"
								class="textarea textarea-bordered text-xs h-16"
								bind:value={konten.desain.praktikPedagogis.alasanPemilihan}></textarea>
						</div>

						<div class="grid grid-cols-1 md:grid-cols-3 gap-3">
							<div class="form-control">
								<label for="lingk-fisik" class="label text-xs font-semibold">Lingkungan Fisik</label
								>
								<input
									id="lingk-fisik"
									type="text"
									class="input input-bordered input-xs"
									bind:value={konten.desain.lingkunganPembelajaran.fisik}
								/>
							</div>
							<div class="form-control">
								<label for="lingk-digital" class="label text-xs font-semibold"
									>Lingkungan Digital</label
								>
								<input
									id="lingk-digital"
									type="text"
									class="input input-bordered input-xs"
									bind:value={konten.desain.lingkunganPembelajaran.digital}
								/>
							</div>
							<div class="form-control">
								<label for="lingk-psiko" class="label text-xs font-semibold"
									>Lingkungan Psikososial</label
								>
								<input
									id="lingk-psiko"
									type="text"
									class="input input-bordered input-xs"
									bind:value={konten.desain.lingkunganPembelajaran.psikososial}
								/>
							</div>
						</div>

						<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div class="form-control">
								<label for="kemitraan" class="label text-xs font-semibold"
									>6. Kemitraan Pembelajaran</label
								>
								<input
									id="kemitraan"
									type="text"
									class="input input-bordered input-xs"
									bind:value={konten.desain.kemitraanPembelajaran}
								/>
							</div>
							<div class="form-control">
								<label for="pemanfaatan-tek" class="label text-xs font-semibold"
									>7. Pemanfaatan Teknologi Digital</label
								>
								<input
									id="pemanfaatan-tek"
									type="text"
									class="input input-bordered input-xs"
									bind:value={konten.desain.pemanfaatanTeknologiDigital}
								/>
							</div>
						</div>
					</div>
				{/if}

				<!-- TAB D: TAHAP 1 MEMAHAMI -->
				{#if activeTab === 'memahami'}
					<div class="space-y-4">
						<div class="p-4 bg-base-200/40 rounded-xl border border-base-200 space-y-3">
							<div class="flex items-center justify-between">
								<span class="font-bold text-xs">Kegiatan Awal (Apersepsi & Motivasi)</span>
								<input
									type="text"
									class="input input-bordered input-xs w-32"
									placeholder="Waktu"
									bind:value={konten.tahapMemahami.kegiatanAwal.alokasiWaktu}
								/>
							</div>
							<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
								<div class="form-control">
									<label for="awal-guru" class="label text-xs font-semibold">Aktivitas Guru</label>
									<textarea
										id="awal-guru"
										class="textarea textarea-bordered text-xs h-20"
										bind:value={konten.tahapMemahami.kegiatanAwal.aktivitasGuru}></textarea>
								</div>
								<div class="form-control">
									<label for="awal-murid" class="label text-xs font-semibold">Aktivitas Murid</label
									>
									<textarea
										id="awal-murid"
										class="textarea textarea-bordered text-xs h-20"
										bind:value={konten.tahapMemahami.kegiatanAwal.aktivitasMurid}></textarea>
								</div>
							</div>
							<div class="form-control">
								<label for="awal-prinsip" class="label text-xs font-semibold"
									>Penerapan Prinsip (Mindful, Meaningful, Joyful)</label
								>
								<input
									id="awal-prinsip"
									type="text"
									class="input input-bordered input-xs"
									bind:value={konten.tahapMemahami.kegiatanAwal.penerapanPrinsip}
								/>
							</div>
						</div>

						<div class="space-y-3">
							<div class="flex items-center justify-between">
								<span class="font-bold text-xs">Langkah Kegiatan Inti Tahap Memahami</span>
								<button
									type="button"
									class="btn btn-xs btn-outline btn-primary"
									onclick={() =>
										(konten.tahapMemahami.kegiatanInti = [
											...konten.tahapMemahami.kegiatanInti,
											{
												langkah: 'Eksplorasi Konsep',
												peranGuru: '',
												aktivitasMurid: '',
												alokasiWaktu: '20 Menit'
											}
										])}
								>
									+ Tambah Langkah
								</button>
							</div>

							{#each konten.tahapMemahami.kegiatanInti as k, idx (idx)}
								<div class="p-3 bg-base-100 rounded-xl border border-base-200 space-y-2">
									<div class="flex items-center justify-between gap-2">
										<input
											type="text"
											class="input input-bordered input-xs font-bold w-48"
											placeholder="Nama Langkah"
											bind:value={k.langkah}
										/>
										<input
											type="text"
											class="input input-bordered input-xs w-28 text-center"
											placeholder="Waktu"
											bind:value={k.alokasiWaktu}
										/>
										<button
											type="button"
											class="btn btn-xs btn-ghost text-error"
											onclick={() =>
												(konten.tahapMemahami.kegiatanInti =
													konten.tahapMemahami.kegiatanInti.filter((_, i) => i !== idx))}
										>
											✕
										</button>
									</div>
									<div class="grid grid-cols-1 md:grid-cols-2 gap-2">
										<textarea
											class="textarea textarea-bordered text-xs h-16"
											placeholder="Peran Guru"
											bind:value={k.peranGuru}></textarea>
										<textarea
											class="textarea textarea-bordered text-xs h-16"
											placeholder="Aktivitas Murid"
											bind:value={k.aktivitasMurid}></textarea>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- TAB E: TAHAP 2 MENGAPLIKASI -->
				{#if activeTab === 'mengaplikasi'}
					<div class="space-y-4">
						<div class="form-control">
							<label for="app-konteks" class="label text-xs font-semibold"
								>1. Konteks Masalah Autentik (Dunia Nyata)</label
							>
							<textarea
								id="app-konteks"
								class="textarea textarea-bordered text-xs h-20"
								bind:value={konten.tahapMengaplikasi.konteksMasalahAutentik}></textarea>
						</div>

						<div class="form-control">
							<label for="app-tugas" class="label text-xs font-semibold"
								>2. Tugas & Tantangan Murid</label
							>
							<textarea
								id="app-tugas"
								class="textarea textarea-bordered text-xs h-20"
								bind:value={konten.tahapMengaplikasi.tugasTantangan}></textarea>
						</div>

						<div class="form-control">
							<label for="app-langkah" class="label text-xs font-semibold"
								>3. Langkah Kerja Sistematis (1 baris 1 langkah)</label
							>
							<textarea
								id="app-langkah"
								class="textarea textarea-bordered text-xs h-24"
								value={(konten.tahapMengaplikasi.langkahKerja || []).join('\n')}
								oninput={(e) =>
									(konten.tahapMengaplikasi.langkahKerja = (e.currentTarget.value || '')
										.split('\n')
										.filter(Boolean))}></textarea>
						</div>

						<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div class="form-control">
								<label for="app-produk" class="label text-xs font-semibold"
									>4. Produk / Solusi Nyata</label
								>
								<input
									id="app-produk"
									type="text"
									class="input input-bordered input-xs"
									bind:value={konten.tahapMengaplikasi.produkSolusiNyata}
								/>
							</div>
							<div class="form-control">
								<label for="app-kaitan" class="label text-xs font-semibold"
									>5. Keterkaitan Kehidupan Nyata</label
								>
								<input
									id="app-kaitan"
									type="text"
									class="input input-bordered input-xs"
									bind:value={konten.tahapMengaplikasi.keterkaitanKehidupanNyata}
								/>
							</div>
						</div>
					</div>
				{/if}

				<!-- TAB F: TAHAP 3 MEREFLEKSI -->
				{#if activeTab === 'merefleksi'}
					<div class="space-y-4">
						<div class="form-control">
							<label for="refleksi-tanya" class="label text-xs font-semibold"
								>1. Pertanyaan Refleksi Peserta Didik (1 baris 1 pertanyaan)</label
							>
							<textarea
								id="refleksi-tanya"
								class="textarea textarea-bordered text-xs h-32"
								value={(konten.tahapMerefleksi.pertanyaanRefleksi || []).join('\n')}
								oninput={(e) =>
									(konten.tahapMerefleksi.pertanyaanRefleksi = (e.currentTarget.value || '')
										.split('\n')
										.filter(Boolean))}></textarea>
						</div>

						<div class="form-control">
							<label for="refleksi-kesimpulan" class="label text-xs font-semibold"
								>2. Kesimpulan Bersama Pembelajaran</label
							>
							<textarea
								id="refleksi-kesimpulan"
								class="textarea textarea-bordered text-xs h-24"
								bind:value={konten.tahapMerefleksi.kesimpulanPembelajaran}></textarea>
						</div>
					</div>
				{/if}

				<!-- TAB G: ASESMEN -->
				{#if activeTab === 'asesmen'}
					<div class="space-y-4">
						<div class="form-control">
							<label for="asesmen-diag" class="label text-xs font-semibold"
								>1. Asesmen Diagnostik (Awal)</label
							>
							<textarea
								id="asesmen-diag"
								class="textarea textarea-bordered text-xs h-16"
								bind:value={konten.asesmen.diagnostik}></textarea>
						</div>

						<div class="space-y-2">
							<div class="flex items-center justify-between">
								<span class="font-bold text-xs">2. Asesmen Formatif (Proses)</span>
								<button
									type="button"
									class="btn btn-xs btn-outline btn-primary"
									onclick={() =>
										(konten.asesmen.formatif = [
											...konten.asesmen.formatif,
											{
												teknik: 'Diskusi Kelompok',
												instrumen: 'Lembar Observasi',
												waktu: 'Selama Proses',
												tindakLanjut: 'Umpan balik langsung'
											}
										])}
								>
									+ Tambah Formatif
								</button>
							</div>
							{#each konten.asesmen.formatif as f, idx (idx)}
								<div class="grid grid-cols-4 gap-2 items-center p-2 bg-base-200/40 rounded-lg">
									<input
										type="text"
										class="input input-bordered input-xs"
										placeholder="Teknik"
										bind:value={f.teknik}
									/>
									<input
										type="text"
										class="input input-bordered input-xs"
										placeholder="Instrumen"
										bind:value={f.instrumen}
									/>
									<input
										type="text"
										class="input input-bordered input-xs"
										placeholder="Waktu"
										bind:value={f.waktu}
									/>
									<div class="flex items-center gap-1">
										<input
											type="text"
											class="input input-bordered input-xs flex-1"
											placeholder="Tindak Lanjut"
											bind:value={f.tindakLanjut}
										/>
										<button
											type="button"
											class="btn btn-xs btn-ghost text-error"
											onclick={() =>
												(konten.asesmen.formatif = konten.asesmen.formatif.filter(
													(_, i) => i !== idx
												))}
										>
											✕
										</button>
									</div>
								</div>
							{/each}
						</div>

						<div class="form-control">
							<label for="asesmen-sumatif" class="label text-xs font-semibold"
								>3. Asesmen Sumatif (Akhir)</label
							>
							<textarea
								id="asesmen-sumatif"
								class="textarea textarea-bordered text-xs h-16"
								bind:value={konten.asesmen.sumatif}></textarea>
						</div>
					</div>
				{/if}

				<!-- TAB H: RUBRIK ASESMEN -->
				{#if activeTab === 'rubrik'}
					<div class="space-y-4">
						<div class="flex items-center justify-between">
							<span class="font-bold text-xs">Matriks Rubrik 4 Skala Deskriptif</span>
							<button
								type="button"
								class="btn btn-xs btn-outline btn-primary"
								onclick={() =>
									(konten.rubrik = [
										...konten.rubrik,
										{
											kriteria: 'Kriteria Baru',
											sangatBaik: '',
											baik: '',
											cukup: '',
											perluBimbingan: ''
										}
									])}
							>
								+ Tambah Kriteria
							</button>
						</div>

						<div class="space-y-3">
							{#each konten.rubrik as r, idx (idx)}
								<div class="p-3 bg-base-100 rounded-xl border border-base-200 space-y-2">
									<div class="flex items-center justify-between">
										<input
											type="text"
											class="input input-bordered input-xs font-bold w-64"
											placeholder="Kriteria Penilaian"
											bind:value={r.kriteria}
										/>
										<button
											type="button"
											class="btn btn-xs btn-ghost text-error"
											onclick={() => (konten.rubrik = konten.rubrik.filter((_, i) => i !== idx))}
										>
											✕ Hapus
										</button>
									</div>
									<div class="grid grid-cols-1 md:grid-cols-4 gap-2">
										<div>
											<span class="text-[10px] font-bold text-success">Sangat Baik (Skala 4):</span>
											<textarea
												class="textarea textarea-bordered text-xs w-full h-16 mt-0.5"
												bind:value={r.sangatBaik}></textarea>
										</div>
										<div>
											<span class="text-[10px] font-bold text-info">Baik (Skala 3):</span>
											<textarea
												class="textarea textarea-bordered text-xs w-full h-16 mt-0.5"
												bind:value={r.baik}></textarea>
										</div>
										<div>
											<span class="text-[10px] font-bold text-warning">Cukup (Skala 2):</span>
											<textarea
												class="textarea textarea-bordered text-xs w-full h-16 mt-0.5"
												bind:value={r.cukup}></textarea>
										</div>
										<div>
											<span class="text-[10px] font-bold text-error"
												>Perlu Bimbingan (Skala 1):</span
											>
											<textarea
												class="textarea textarea-bordered text-xs w-full h-16 mt-0.5"
												bind:value={r.perluBimbingan}></textarea>
										</div>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- TAB I: DIFERENSIASI -->
				{#if activeTab === 'diferensiasi'}
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div class="form-control">
							<label for="dif-konten" class="label text-xs font-semibold"
								>1. Diferensiasi Konten</label
							>
							<textarea
								id="dif-konten"
								class="textarea textarea-bordered text-xs h-24"
								bind:value={konten.diferensiasi.konten}></textarea>
						</div>
						<div class="form-control">
							<label for="dif-proses" class="label text-xs font-semibold"
								>2. Diferensiasi Proses</label
							>
							<textarea
								id="dif-proses"
								class="textarea textarea-bordered text-xs h-24"
								bind:value={konten.diferensiasi.proses}></textarea>
						</div>
						<div class="form-control">
							<label for="dif-produk" class="label text-xs font-semibold"
								>3. Diferensiasi Produk</label
							>
							<textarea
								id="dif-produk"
								class="textarea textarea-bordered text-xs h-24"
								bind:value={konten.diferensiasi.produk}></textarea>
						</div>
						<div class="form-control">
							<label for="dif-khusus" class="label text-xs font-semibold"
								>4. Dukungan Khusus (Siswa Memerlukan Bimbingan)</label
							>
							<textarea
								id="dif-khusus"
								class="textarea textarea-bordered text-xs h-24"
								bind:value={konten.diferensiasi.dukunganKhusus}></textarea>
						</div>
					</div>
				{/if}

				<!-- TAB J: REMEDIAL & PENGAYAAN -->
				{#if activeTab === 'remedial'}
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div class="form-control">
							<label for="rem-remedial" class="label text-xs font-semibold"
								>1. Program Remedial</label
							>
							<textarea
								id="rem-remedial"
								class="textarea textarea-bordered text-xs h-32"
								bind:value={konten.remedialDanPengayaan.remedial}></textarea>
						</div>
						<div class="form-control">
							<label for="rem-pengayaan" class="label text-xs font-semibold"
								>2. Program Pengayaan</label
							>
							<textarea
								id="rem-pengayaan"
								class="textarea textarea-bordered text-xs h-32"
								bind:value={konten.remedialDanPengayaan.pengayaan}></textarea>
						</div>
					</div>
				{/if}

				<!-- TAB K: REFLEKSI GURU -->
				{#if activeTab === 'refleksi'}
					<div class="space-y-4">
						<label for="guru-refleksi" class="label text-xs font-semibold"
							>5 Panduan Evaluasi Diri Guru (1 baris 1 pertanyaan):</label
						>
						<textarea
							id="guru-refleksi"
							class="textarea textarea-bordered text-xs h-40"
							value={(konten.refleksiGuru || []).join('\n')}
							oninput={(e) =>
								(konten.refleksiGuru = (e.currentTarget.value || '').split('\n').filter(Boolean))}
						></textarea>
					</div>
				{/if}

				<!-- TAB L: LAMPIRAN -->
				{#if activeTab === 'lampiran'}
					<div class="space-y-4">
						<div class="form-control">
							<label for="lamp-bahan" class="label text-xs font-semibold"
								>1. Ringkasan Bahan Ajar</label
							>
							<textarea
								id="lamp-bahan"
								class="textarea textarea-bordered text-xs h-24"
								bind:value={konten.lampiran.bahanAjarRingkas}></textarea>
						</div>

						<div class="form-control">
							<label for="lamp-lkpd" class="label text-xs font-semibold"
								>2. Petunjuk LKPD (Lembar Kerja Peserta Didik)</label
							>
							<textarea
								id="lamp-lkpd"
								class="textarea textarea-bordered text-xs h-24"
								bind:value={konten.lampiran.petunjukLkpd}></textarea>
						</div>

						<div class="form-control">
							<label for="lamp-media" class="label text-xs font-semibold"
								>3. Media, Alat, dan Sumber Belajar</label
							>
							<textarea
								id="lamp-media"
								class="textarea textarea-bordered text-xs h-20"
								bind:value={konten.lampiran.mediaDanSumber}></textarea>
						</div>

						<div class="space-y-2">
							<div class="flex items-center justify-between">
								<span class="font-bold text-xs">4. Glosarium Istilah</span>
								<button
									type="button"
									class="btn btn-xs btn-outline btn-primary"
									onclick={() =>
										(konten.lampiran.glosarium = [
											...konten.lampiran.glosarium,
											{ istilah: '', definisi: '' }
										])}
								>
									+ Tambah Istilah
								</button>
							</div>
							{#each konten.lampiran.glosarium as g, idx (idx)}
								<div class="flex items-center gap-2">
									<input
										type="text"
										class="input input-bordered input-xs w-48 font-bold"
										placeholder="Istilah"
										bind:value={g.istilah}
									/>
									<input
										type="text"
										class="input input-bordered input-xs flex-1"
										placeholder="Definisi"
										bind:value={g.definisi}
									/>
									<button
										type="button"
										class="btn btn-xs btn-ghost text-error"
										onclick={() =>
											(konten.lampiran.glosarium = konten.lampiran.glosarium.filter(
												(_, i) => i !== idx
											))}
									>
										✕
									</button>
								</div>
							{/each}
						</div>

						<div class="form-control">
							<label for="lamp-pustaka" class="label text-xs font-semibold"
								>5. Daftar Pustaka (1 baris 1 referensi)</label
							>
							<textarea
								id="lamp-pustaka"
								class="textarea textarea-bordered text-xs h-24"
								value={(konten.lampiran.daftarPustaka || []).join('\n')}
								oninput={(e) =>
									(konten.lampiran.daftarPustaka = (e.currentTarget.value || '')
										.split('\n')
										.filter(Boolean))}></textarea>
						</div>
					</div>
				{/if}
			</div>

			<!-- Modal Footer -->
			<div
				class="flex items-center justify-between px-6 py-4 border-t border-base-200 bg-base-100 sticky bottom-0 z-10"
			>
				<div class="flex items-center gap-2">
					<button type="button" class="btn btn-sm btn-ghost" onclick={() => (showModal = false)}>
						Tutup
					</button>
					{#if editId > 0}
						<button
							type="button"
							class="btn btn-sm btn-outline gap-1"
							onclick={() => window.open('/api/pdf/modul-ajar?id=' + editId, '_blank')}
						>
							<Icon name="print" />
							Cetak PDF
						</button>
					{/if}
				</div>

				<div class="flex items-center gap-2">
					<button
						type="button"
						class="btn btn-sm btn-outline"
						onclick={() => handleSave('draf')}
						disabled={isSaving || !materiPokok.trim()}
					>
						{isSaving ? 'Menyimpan...' : 'Simpan Draf'}
					</button>
					<button
						type="button"
						class="btn btn-sm btn-primary shadow-sm"
						onclick={() => handleSave('final')}
						disabled={isSaving || !materiPokok.trim()}
					>
						{isSaving ? 'Menyimpan...' : 'Simpan & Finalkan'}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
