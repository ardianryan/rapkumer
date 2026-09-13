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
	type TabKey =
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
		| 'lampiran';

	let activeTab = $state<TabKey>('identitas');

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

	// Dimensi opsi (8 Dimensi Profil Lulusan / Pelajar)
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

	// Kelompok Navigasi Menu Vertikal Modal
	const navGroups = [
		{
			title: 'Persiapan & Desain',
			items: [
				{ id: 'identitas' as TabKey, label: 'A. Identitas & AI', icon: 'sparkles', badge: 'AI' },
				{ id: 'identifikasi' as TabKey, label: 'B. Identifikasi', icon: 'user' },
				{ id: 'desain' as TabKey, label: 'C. Desain Pembelajaran', icon: 'book' }
			]
		},
		{
			title: 'Pengalaman Belajar',
			items: [
				{ id: 'memahami' as TabKey, label: 'D. Tahap 1: Memahami', icon: 'layers' },
				{ id: 'mengaplikasi' as TabKey, label: 'E. Tahap 2: Mengaplikasi', icon: 'activity' },
				{ id: 'merefleksi' as TabKey, label: 'F. Tahap 3: Merefleksi', icon: 'star' }
			]
		},
		{
			title: 'Penilaian & Rubrik',
			items: [
				{ id: 'asesmen' as TabKey, label: 'G. Asesmen Pembelajaran', icon: 'check-square' },
				{ id: 'rubrik' as TabKey, label: 'H. Rubrik 4 Skala', icon: 'table' }
			]
		},
		{
			title: 'Tindak Lanjut & Dokumen',
			items: [
				{ id: 'diferensiasi' as TabKey, label: 'I. Diferensiasi Belajar', icon: 'grid' },
				{ id: 'remedial' as TabKey, label: 'J. Remedial & Pengayaan', icon: 'repeat' },
				{ id: 'refleksi' as TabKey, label: 'K. Refleksi Guru', icon: 'coffee' },
				{ id: 'lampiran' as TabKey, label: 'L. Lampiran & Glosarium', icon: 'folder' }
			]
		}
	];

	const allTabs = [
		{ id: 'identitas' as TabKey, label: 'A. Identitas & AI', shortLabel: 'A. Identitas' },
		{ id: 'identifikasi' as TabKey, label: 'B. Identifikasi', shortLabel: 'B. Identifikasi' },
		{ id: 'desain' as TabKey, label: 'C. Desain Pembelajaran', shortLabel: 'C. Desain' },
		{ id: 'memahami' as TabKey, label: 'D. Tahap 1: Memahami', shortLabel: 'D. Memahami' },
		{
			id: 'mengaplikasi' as TabKey,
			label: 'E. Tahap 2: Mengaplikasi',
			shortLabel: 'E. Mengaplikasi'
		},
		{ id: 'merefleksi' as TabKey, label: 'F. Tahap 3: Merefleksi', shortLabel: 'F. Merefleksi' },
		{ id: 'asesmen' as TabKey, label: 'G. Asesmen Pembelajaran', shortLabel: 'G. Asesmen' },
		{ id: 'rubrik' as TabKey, label: 'H. Rubrik 4 Skala', shortLabel: 'H. Rubrik' },
		{
			id: 'diferensiasi' as TabKey,
			label: 'I. Diferensiasi Belajar',
			shortLabel: 'I. Diferensiasi'
		},
		{ id: 'remedial' as TabKey, label: 'J. Remedial & Pengayaan', shortLabel: 'J. Remedial' },
		{ id: 'refleksi' as TabKey, label: 'K. Refleksi Guru', shortLabel: 'K. Refleksi' },
		{ id: 'lampiran' as TabKey, label: 'L. Lampiran & Glosarium', shortLabel: 'L. Lampiran' }
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

	// Nama Mapel Terpilih di modal
	const selectedMapelNama = $derived(
		(data.mataPelajaranList || []).find((m) => m.id === selectedMapelId)?.nama || 'Mata Pelajaran'
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
			toast('Isi materi pokok / topik bahasan terlebih dahulu.', 'error');
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
			toast('✨ Modul ajar berhasil disusun lengkap oleh AI!', 'success');
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
			toast('Isi materi pokok / topik bahasan.', 'error');
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
			<div class="flex items-center gap-3">
				<span class="p-3 rounded-2xl bg-primary/10 text-primary">
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
			<button
				type="button"
				class="btn btn-primary gap-2 shadow-sm rounded-xl"
				onclick={openCreateModal}
			>
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
				class="select select-sm select-bordered w-64 rounded-xl"
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
			<button
				type="button"
				class="btn btn-primary btn-sm gap-2 rounded-xl"
				onclick={openCreateModal}
			>
				<Icon name="plus" />
				Buat Sekarang
			</button>
		</div>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
			{#each listModul as m (m.id)}
				<div
					class="card bg-base-100 border border-base-200 hover:border-primary/40 hover:shadow-md transition-all flex flex-col justify-between rounded-2xl overflow-hidden"
				>
					<div class="card-body p-5">
						<!-- Badge status & waktu -->
						<div class="flex items-center justify-between gap-2 mb-2">
							<span
								class="badge badge-sm {m.status === 'final'
									? 'badge-success text-white'
									: 'badge-warning text-warning-content'} font-medium rounded-lg"
							>
								{m.status === 'final' ? 'Final' : 'Draf'}
							</span>
							<span class="text-xs text-base-content/50 font-medium">
								{m.alokasiWaktu}
							</span>
						</div>

						<!-- Materi Pokok -->
						<h3
							class="font-bold text-lg line-clamp-2 text-base-content hover:text-primary transition-colors"
						>
							{m.materiPokok}
						</h3>

						<!-- Info Detail -->
						<div class="space-y-1.5 mt-3 text-xs text-base-content/70">
							<div class="flex items-center gap-2">
								<span class="font-semibold text-base-content/90 w-20 shrink-0">Mapel:</span>
								<span class="truncate font-medium text-primary"
									>{m.mapelNama || 'Mata Pelajaran'}</span
								>
							</div>
							<div class="flex items-center gap-2">
								<span class="font-semibold text-base-content/90 w-20 shrink-0">Pertemuan:</span>
								<span>{m.jumlahPertemuan}</span>
							</div>
							<div class="flex items-center gap-2">
								<span class="font-semibold text-base-content/90 w-20 shrink-0">Model:</span>
								<span class="truncate">{m.modelPembelajaran}</span>
							</div>
						</div>

						<!-- Dimensi Profil Tags -->
						{#if m.dimensiProfil && m.dimensiProfil.length > 0}
							<div class="flex flex-wrap gap-1 mt-3">
								{#each m.dimensiProfil.slice(0, 3) as dim, dIdx (dIdx)}
									<span class="badge badge-xs bg-base-200 border-none text-[10px] py-1 rounded-md">
										{dim}
									</span>
								{/each}
								{#if m.dimensiProfil.length > 3}
									<span class="text-[10px] text-base-content/50 self-center">
										+{m.dimensiProfil.length - 3} lainnya
									</span>
								{/if}
							</div>
						{/if}
					</div>

					<!-- Card Actions -->
					<div
						class="border-t border-base-200 px-5 py-3 bg-base-200/30 flex items-center justify-between"
					>
						<div class="flex items-center gap-1.5">
							<button
								type="button"
								class="btn btn-xs btn-outline btn-primary gap-1 rounded-lg"
								onclick={() => openEditModal(m)}
								title="Edit Modul"
							>
								<Icon name="edit" />
								Edit
							</button>
							<button
								type="button"
								class="btn btn-xs btn-outline gap-1 rounded-lg"
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

<!-- MODAL EDITOR & AI GENERATOR (RESPONSIVE SPLIT-WORKSPACE) -->
{#if showModal}
	<dialog class="modal modal-open modal-bottom sm:modal-middle z-50 p-0 sm:p-4" open>
		<div
			class="modal-box w-full max-w-6xl h-[92dvh] sm:h-[90vh] max-h-[92dvh] sm:max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl rounded-t-2xl sm:rounded-2xl border border-base-300 bg-base-100"
		>
			<!-- Modal Top Header -->
			<div
				class="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-3.5 border-b border-base-200 bg-base-100 shrink-0"
			>
				<div class="flex items-center gap-2.5 sm:gap-3 min-w-0">
					<div class="p-2 sm:p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
						<Icon name={editId > 0 ? 'edit' : 'book'} />
					</div>
					<div class="min-w-0">
						<div class="flex items-center gap-2">
							<h2 class="text-sm sm:text-lg font-bold truncate">
								{editId > 0 ? 'Edit Modul Ajar' : 'Buat Modul Ajar'}
							</h2>
							<span
								class="badge badge-xs {statusModul === 'final'
									? 'badge-success text-white'
									: 'badge-warning'} font-medium uppercase text-[10px]"
							>
								{statusModul}
							</span>
						</div>
						<p class="text-[11px] sm:text-xs text-base-content/60 truncate">
							{selectedMapelNama} • Format 12 Bagian Pembelajaran Mendalam
						</p>
					</div>
				</div>

				<button
					type="button"
					class="btn btn-xs sm:btn-sm btn-ghost btn-circle shrink-0"
					onclick={() => (showModal = false)}
					aria-label="Tutup"
				>
					✕
				</button>
			</div>

			<!-- Mobile Tab Selector (Visible only on mobile <md) -->
			<div class="md:hidden border-b border-base-200 bg-base-200/50 p-2.5 shrink-0 space-y-2">
				<div class="flex items-center gap-2">
					<span class="text-[11px] font-bold text-base-content/70 shrink-0">Bagian:</span>
					<select
						bind:value={activeTab}
						class="select select-bordered select-xs w-full text-xs font-semibold rounded-lg bg-base-100"
					>
						{#each navGroups as group (group.title)}
							<optgroup label={group.title}>
								{#each group.items as item (item.id)}
									<option value={item.id}>{item.label}</option>
								{/each}
							</optgroup>
						{/each}
					</select>
				</div>
				<div
					class="flex items-center gap-1.5 overflow-x-auto pb-0.5"
					style="scrollbar-width: none;"
				>
					{#each allTabs as item (item.id)}
						<button
							type="button"
							class="btn btn-xs whitespace-nowrap rounded-lg {activeTab === item.id
								? 'btn-primary shadow-xs'
								: 'btn-ghost bg-base-100 border border-base-300/60 text-base-content/70'}"
							onclick={() => (activeTab = item.id)}
						>
							{item.shortLabel}
						</button>
					{/each}
				</div>
			</div>

			<!-- Modal Body Split Workspace: Left Vertical Nav (Desktop) + Right Main Panel -->
			<div class="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
				<!-- Left Sidebar Navigation (Desktop only) -->
				<aside
					class="hidden md:block w-64 border-r border-base-200 bg-base-200/40 p-3 overflow-y-auto shrink-0 space-y-4"
				>
					{#each navGroups as group (group.title)}
						<div>
							<div
								class="px-2 py-1 text-[10px] font-bold tracking-wider text-base-content/50 uppercase"
							>
								{group.title}
							</div>
							<nav class="space-y-1 mt-1">
								{#each group.items as item (item.id)}
									<button
										type="button"
										class="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-medium text-left transition-all duration-150 {activeTab ===
										item.id
											? 'bg-primary text-primary-content font-bold shadow-xs'
											: 'hover:bg-base-200 text-base-content/80'}"
										onclick={() => (activeTab = item.id)}
									>
										<span class="truncate">{item.label}</span>
										{#if item.badge}
											<span
												class="badge badge-xs {activeTab === item.id
													? 'badge-secondary text-secondary-content'
													: 'badge-primary text-white'} text-[9px] font-bold px-1.5 py-0.5"
											>
												{item.badge}
											</span>
										{/if}
									</button>
								{/each}
							</nav>
						</div>
					{/each}
				</aside>

				<!-- Right Main Workspace Content Area -->
				<main class="flex-1 overflow-y-auto p-6 lg:p-8 bg-base-100 min-h-0 space-y-6">
					<!-- TAB A: IDENTITAS & ASISTENSI AI -->
					{#if activeTab === 'identitas'}
						<div class="space-y-6 max-w-4xl">
							<!-- Section Header -->
							<div class="border-b border-base-200 pb-3">
								<h3 class="text-base font-bold text-base-content">
									A. Identitas Modul & Generator AI
								</h3>
								<p class="text-xs text-base-content/60 mt-0.5">
									Atur data identitas kurikulum dan manfaatkan kecerdasan buatan untuk menyusun draf
									12 bagian pembelajaran mendalam secara otomatis.
								</p>
							</div>

							<!-- AI Action Card -->
							<div
								class="p-5 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-secondary/10 border border-primary/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs"
							>
								<div class="space-y-1">
									<div class="flex items-center gap-2 text-primary font-bold text-sm">
										<Icon name="sparkles" />
										<span>Asistensi AI Pembuat Modul Ajar</span>
									</div>
									<p class="text-xs text-base-content/70 leading-relaxed max-w-xl">
										Lengkapi mata pelajaran, topik bahasan, dan tujuan pembelajaran. AI akan
										merumuskan seluruh 12 bab (B s/d L) dengan kaidah pedagogi pembelajaran mendalam
										& kaidah ejaan EYD V.
									</p>
								</div>
								<button
									type="button"
									class="btn btn-primary bg-gradient-to-r from-primary to-secondary hover:opacity-95 text-white border-none gap-2 shrink-0 shadow-sm rounded-xl px-4"
									onclick={handleGenerateAi}
									disabled={isGenerating || !materiPokok.trim()}
								>
									{#if isGenerating}
										<span class="loading loading-spinner loading-xs"></span>
										<span>Sedang Menyusun...</span>
									{:else}
										<Icon name="sparkles" />
										<span>Generate dengan AI</span>
									{/if}
								</button>
							</div>

							<!-- Form Grid Identitas -->
							<div
								class="card bg-base-100 border border-base-200 p-5 rounded-2xl space-y-5 shadow-xs"
							>
								<div class="grid grid-cols-1 md:grid-cols-2 gap-5">
									<div>
										<label
											for="form-mapel"
											class="text-xs font-bold text-base-content/80 flex items-center justify-between mb-1.5"
										>
											<span>Mata Pelajaran</span>
											<span class="text-[10px] text-error font-medium">Wajib</span>
										</label>
										<select
											id="form-mapel"
											class="select select-bordered select-sm w-full rounded-xl h-10 text-sm"
											bind:value={selectedMapelId}
										>
											{#each data.mataPelajaranList || [] as mapel (mapel.id)}
												<option value={mapel.id}>{mapel.nama}</option>
											{/each}
										</select>
									</div>

									<div>
										<label
											for="form-materi"
											class="text-xs font-bold text-base-content/80 flex items-center justify-between mb-1.5"
										>
											<span>Materi Pokok / Topik Bahasan</span>
											<span class="text-[10px] text-error font-medium">Wajib</span>
										</label>
										<input
											id="form-materi"
											type="text"
											class="input input-bordered input-sm w-full rounded-xl h-10 text-sm"
											placeholder="Contoh: Reaksi Redoks dan Elektrokimia"
											bind:value={materiPokok}
										/>
									</div>

									<div>
										<label
											for="form-alokasi"
											class="text-xs font-bold text-base-content/80 block mb-1.5"
										>
											Alokasi Waktu
										</label>
										<input
											id="form-alokasi"
											type="text"
											class="input input-bordered input-sm w-full rounded-xl h-10 text-sm"
											placeholder="Contoh: 2 x 45 Menit"
											bind:value={alokasiWaktu}
										/>
									</div>

									<div>
										<label
											for="form-pertemuan"
											class="text-xs font-bold text-base-content/80 block mb-1.5"
										>
											Jumlah Pertemuan
										</label>
										<input
											id="form-pertemuan"
											type="text"
											class="input input-bordered input-sm w-full rounded-xl h-10 text-sm"
											placeholder="Contoh: Pertemuan Ke-1 dari 2 Pertemuan"
											bind:value={jumlahPertemuan}
										/>
									</div>

									<div>
										<label
											for="form-model"
											class="text-xs font-bold text-base-content/80 block mb-1.5"
										>
											Model Pembelajaran
										</label>
										<select
											id="form-model"
											class="select select-bordered select-sm w-full rounded-xl h-10 text-sm"
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

									<div>
										<label
											for="form-status"
											class="text-xs font-bold text-base-content/80 block mb-1.5"
										>
											Status Dokumen
										</label>
										<select
											id="form-status"
											class="select select-bordered select-sm w-full rounded-xl h-10 text-sm"
											bind:value={statusModul}
										>
											<option value="draf">Draf (Masih Dapat Diedit)</option>
											<option value="final">Final (Siap Disahkan & Dicetak)</option>
										</select>
									</div>
								</div>

								<!-- Dimensi Profil Pelajar Selection -->
								<div class="border-t border-base-200 pt-4">
									<div class="flex items-center justify-between mb-2">
										<span class="text-xs font-bold text-base-content/80">
											8 Dimensi Profil Lulusan / Pelajar yang Disasar:
										</span>
										<span class="text-[11px] text-base-content/50">
											{selectedDimensi.length} dimensi dipilih
										</span>
									</div>
									<div class="flex flex-wrap gap-2">
										{#each dimensiPilihan as dim (dim)}
											<button
												type="button"
												class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer select-none {selectedDimensi.includes(
													dim
												)
													? 'bg-primary text-primary-content shadow-xs font-semibold'
													: 'bg-base-200/80 hover:bg-base-300 text-base-content/70 border border-base-300/60'}"
												onclick={() => toggleDimensi(dim)}
											>
												{#if selectedDimensi.includes(dim)}
													<span>✓</span>
												{:else}
													<span class="text-base-content/40">+</span>
												{/if}
												<span>{dim}</span>
											</button>
										{/each}
									</div>
								</div>

								<!-- TP Checklist dari Database -->
								<div class="border-t border-base-200 pt-4">
									<div class="flex items-center justify-between mb-2">
										<span class="text-xs font-bold text-base-content/80">
											Tujuan Pembelajaran Tersimpan di Database:
										</span>
										<span class="text-[11px] text-base-content/50">
											{selectedTpIds.length} TP dipilih untuk memandu AI
										</span>
									</div>

									{#if availableTps.length === 0}
										<div
											class="p-4 bg-base-200/40 rounded-xl border border-dashed border-base-300 text-xs text-base-content/60 italic text-center"
										>
											Belum ada Tujuan Pembelajaran yang diinput untuk mata pelajaran ini. AI akan
											merumuskan TP berjenjang secara mandiri.
										</div>
									{:else}
										<div
											class="max-h-48 overflow-y-auto space-y-2 p-3 bg-base-200/30 rounded-xl border border-base-200"
										>
											{#each availableTps as tp (tp.id)}
												<label
													class="flex items-start gap-3 p-2.5 rounded-xl border transition-all cursor-pointer {selectedTpIds.includes(
														tp.id
													)
														? 'border-primary/40 bg-primary/5'
														: 'border-base-200 hover:bg-base-200/60 bg-base-100'}"
												>
													<input
														type="checkbox"
														class="checkbox checkbox-xs checkbox-primary rounded mt-0.5"
														checked={selectedTpIds.includes(tp.id)}
														onchange={() => toggleTp(tp.id)}
													/>
													<span class="text-xs text-base-content/80 leading-relaxed font-medium">
														{tp.deskripsi}
													</span>
												</label>
											{/each}
										</div>
									{/if}
								</div>
							</div>
						</div>
					{/if}

					<!-- TAB B: IDENTIFIKASI -->
					{#if activeTab === 'identifikasi'}
						<div class="space-y-6 max-w-4xl">
							<div class="border-b border-base-200 pb-3">
								<h3 class="text-base font-bold text-base-content">
									B. Identifikasi Peserta Didik & Materi
								</h3>
								<p class="text-xs text-base-content/60 mt-0.5">
									Analisis karakteristik murid, materi pelajaran, dan integrasi dimensi Profil
									Pelajar.
								</p>
							</div>

							<div
								class="card bg-base-100 border border-base-200 p-5 rounded-2xl space-y-4 shadow-xs"
							>
								<div>
									<label
										for="karakteristik-murid"
										class="text-xs font-bold text-base-content/80 block mb-1.5"
									>
										1. Karakteristik Peserta Didik
									</label>
									<textarea
										id="karakteristik-murid"
										class="textarea textarea-bordered text-xs h-28 w-full rounded-xl leading-relaxed"
										placeholder="Analisis kesiapan belajar, profil belajar, dan minat peserta didik..."
										bind:value={konten.identifikasi.karakteristikPesertaDidik}></textarea>
								</div>

								<div>
									<label
										for="karakteristik-materi"
										class="text-xs font-bold text-base-content/80 block mb-1.5"
									>
										2. Karakteristik Materi Pelajaran
									</label>
									<textarea
										id="karakteristik-materi"
										class="textarea textarea-bordered text-xs h-28 w-full rounded-xl leading-relaxed"
										placeholder="Tingkat kedalaman materi, konsep esensial (faktual, konseptual, prosedural, metakognitif)..."
										bind:value={konten.identifikasi.karakteristikMateri}></textarea>
								</div>

								<div>
									<div class="flex items-center justify-between mb-2">
										<span class="text-xs font-bold text-base-content/80"
											>3. Dimensi Profil Lulusan & Integrasinya</span
										>
										<button
											type="button"
											class="btn btn-xs btn-outline btn-primary rounded-lg"
											onclick={() =>
												(konten.identifikasi.dimensiProfilLulusan = [
													...konten.identifikasi.dimensiProfilLulusan,
													{ dimensi: 'Penalaran Kritis', penjelasan: '' }
												])}
										>
											+ Tambah Dimensi
										</button>
									</div>

									<div class="space-y-2.5">
										{#each konten.identifikasi.dimensiProfilLulusan as item, idx (idx)}
											<div
												class="flex items-center gap-2 p-2 bg-base-200/40 rounded-xl border border-base-200"
											>
												<input
													type="text"
													class="input input-bordered input-xs w-48 font-bold rounded-lg"
													bind:value={item.dimensi}
													placeholder="Nama Dimensi"
												/>
												<input
													type="text"
													class="input input-bordered input-xs flex-1 rounded-lg"
													bind:value={item.penjelasan}
													placeholder="Penjelasan integrasi dalam pembelajaran"
												/>
												<button
													type="button"
													class="btn btn-xs btn-ghost text-error btn-square"
													onclick={() =>
														(konten.identifikasi.dimensiProfilLulusan =
															konten.identifikasi.dimensiProfilLulusan.filter((_, i) => i !== idx))}
												>
													✕
												</button>
											</div>
										{/each}
									</div>
								</div>
							</div>
						</div>
					{/if}

					<!-- TAB C: DESAIN PEMBELAJARAN -->
					{#if activeTab === 'desain'}
						<div class="space-y-6 max-w-4xl">
							<div class="border-b border-base-200 pb-3">
								<h3 class="text-base font-bold text-base-content">
									C. Desain Pembelajaran (Framework SOLO)
								</h3>
								<p class="text-xs text-base-content/60 mt-0.5">
									Capaian Pembelajaran, tujuan berjenjang, topik esensial, pertanyaan pemantik, dan
									ekosistem belajar.
								</p>
							</div>

							<div
								class="card bg-base-100 border border-base-200 p-5 rounded-2xl space-y-4 shadow-xs"
							>
								<div>
									<label
										for="desain-cp"
										class="text-xs font-bold text-base-content/80 block mb-1.5"
									>
										1. Capaian Pembelajaran (CP)
									</label>
									<textarea
										id="desain-cp"
										class="textarea textarea-bordered text-xs h-20 w-full rounded-xl leading-relaxed"
										placeholder="Rumusan Capaian Pembelajaran fase terkait..."
										bind:value={konten.desain.capaianPembelajaran}></textarea>
								</div>

								<div>
									<span class="text-xs font-bold text-base-content/80 block mb-2">
										2. Tujuan Pembelajaran Berjenjang (Taksonomi SOLO)
									</span>
									<div class="grid grid-cols-1 md:grid-cols-3 gap-3">
										<div class="p-3.5 bg-primary/5 rounded-xl border border-primary/20">
											<span class="text-xs font-bold text-primary">a. Tahap Memahami:</span>
											<textarea
												class="textarea textarea-bordered text-xs w-full h-28 mt-2 rounded-lg"
												placeholder="1 baris 1 poin..."
												value={(konten.desain.tujuanPembelajaran?.memahami || []).join('\n')}
												oninput={(e) =>
													(konten.desain.tujuanPembelajaran.memahami = (e.currentTarget.value || '')
														.split('\n')
														.filter(Boolean))}></textarea>
										</div>
										<div class="p-3.5 bg-secondary/5 rounded-xl border border-secondary/20">
											<span class="text-xs font-bold text-secondary">b. Tahap Mengaplikasi:</span>
											<textarea
												class="textarea textarea-bordered text-xs w-full h-28 mt-2 rounded-lg"
												placeholder="1 baris 1 poin..."
												value={(konten.desain.tujuanPembelajaran?.mengaplikasi || []).join('\n')}
												oninput={(e) =>
													(konten.desain.tujuanPembelajaran.mengaplikasi = (
														e.currentTarget.value || ''
													)
														.split('\n')
														.filter(Boolean))}></textarea>
										</div>
										<div class="p-3.5 bg-accent/5 rounded-xl border border-accent/20">
											<span class="text-xs font-bold text-accent">c. Tahap Merefleksi:</span>
											<textarea
												class="textarea textarea-bordered text-xs w-full h-28 mt-2 rounded-lg"
												placeholder="1 baris 1 poin..."
												value={(konten.desain.tujuanPembelajaran?.merefleksi || []).join('\n')}
												oninput={(e) =>
													(konten.desain.tujuanPembelajaran.merefleksi = (
														e.currentTarget.value || ''
													)
														.split('\n')
														.filter(Boolean))}></textarea>
										</div>
									</div>
								</div>

								<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div>
										<label
											for="topik-esensial"
											class="text-xs font-bold text-base-content/80 block mb-1.5"
										>
											3. Topik & Konsep Esensial (1 baris 1 poin)
										</label>
										<textarea
											id="topik-esensial"
											class="textarea textarea-bordered text-xs h-24 w-full rounded-xl"
											value={(konten.desain.topikEsensial || []).join('\n')}
											oninput={(e) =>
												(konten.desain.topikEsensial = (e.currentTarget.value || '')
													.split('\n')
													.filter(Boolean))}></textarea>
									</div>

									<div>
										<label
											for="pertanyaan-pemantik"
											class="text-xs font-bold text-base-content/80 block mb-1.5"
										>
											4. Pertanyaan Pemantik (1 baris 1 pertanyaan)
										</label>
										<textarea
											id="pertanyaan-pemantik"
											class="textarea textarea-bordered text-xs h-24 w-full rounded-xl"
											value={(konten.desain.pertanyaanPemantik || []).join('\n')}
											oninput={(e) =>
												(konten.desain.pertanyaanPemantik = (e.currentTarget.value || '')
													.split('\n')
													.filter(Boolean))}></textarea>
									</div>
								</div>

								<div>
									<label
										for="pedagogis-alasan"
										class="text-xs font-bold text-base-content/80 block mb-1.5"
									>
										5. Alasan Pemilihan Praktik Pedagogis ({konten.desain.praktikPedagogis.model})
									</label>
									<textarea
										id="pedagogis-alasan"
										class="textarea textarea-bordered text-xs h-16 w-full rounded-xl"
										bind:value={konten.desain.praktikPedagogis.alasanPemilihan}></textarea>
								</div>

								<div class="grid grid-cols-1 md:grid-cols-3 gap-3">
									<div>
										<label
											for="lingk-fisik"
											class="text-xs font-bold text-base-content/80 block mb-1.5"
											>Lingkungan Fisik</label
										>
										<input
											id="lingk-fisik"
											type="text"
											class="input input-bordered input-xs w-full rounded-lg"
											bind:value={konten.desain.lingkunganPembelajaran.fisik}
										/>
									</div>
									<div>
										<label
											for="lingk-digital"
											class="text-xs font-bold text-base-content/80 block mb-1.5"
											>Lingkungan Digital</label
										>
										<input
											id="lingk-digital"
											type="text"
											class="input input-bordered input-xs w-full rounded-lg"
											bind:value={konten.desain.lingkunganPembelajaran.digital}
										/>
									</div>
									<div>
										<label
											for="lingk-psiko"
											class="text-xs font-bold text-base-content/80 block mb-1.5"
											>Lingkungan Psikososial</label
										>
										<input
											id="lingk-psiko"
											type="text"
											class="input input-bordered input-xs w-full rounded-lg"
											bind:value={konten.desain.lingkunganPembelajaran.psikososial}
										/>
									</div>
								</div>

								<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div>
										<label
											for="kemitraan"
											class="text-xs font-bold text-base-content/80 block mb-1.5"
											>6. Kemitraan Pembelajaran</label
										>
										<input
											id="kemitraan"
											type="text"
											class="input input-bordered input-xs w-full rounded-lg"
											bind:value={konten.desain.kemitraanPembelajaran}
										/>
									</div>
									<div>
										<label
											for="pemanfaatan-tek"
											class="text-xs font-bold text-base-content/80 block mb-1.5"
											>7. Pemanfaatan Teknologi Digital</label
										>
										<input
											id="pemanfaatan-tek"
											type="text"
											class="input input-bordered input-xs w-full rounded-lg"
											bind:value={konten.desain.pemanfaatanTeknologiDigital}
										/>
									</div>
								</div>
							</div>
						</div>
					{/if}

					<!-- TAB D: TAHAP 1 MEMAHAMI -->
					{#if activeTab === 'memahami'}
						<div class="space-y-6 max-w-4xl">
							<div class="border-b border-base-200 pb-3">
								<h3 class="text-base font-bold text-base-content">
									D. Pengalaman Belajar: Tahap 1 Memahami
								</h3>
								<p class="text-xs text-base-content/60 mt-0.5">
									Apersepsi, motivasi, penerapan prinsip Mindful/Meaningful/Joyful, serta rincian
									kegiatan inti pemahaman konsep.
								</p>
							</div>

							<div
								class="card bg-base-100 border border-base-200 p-5 rounded-2xl space-y-5 shadow-xs"
							>
								<!-- Kegiatan Awal -->
								<div class="p-4 bg-base-200/40 rounded-xl border border-base-200 space-y-3">
									<div class="flex items-center justify-between">
										<span class="font-bold text-xs text-primary"
											>Kegiatan Awal (Apersepsi & Motivasi)</span
										>
										<input
											type="text"
											class="input input-bordered input-xs w-32 rounded-lg text-center"
											placeholder="Alokasi Waktu"
											bind:value={konten.tahapMemahami.kegiatanAwal.alokasiWaktu}
										/>
									</div>
									<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
										<div>
											<label
												for="awal-guru"
												class="text-xs font-semibold text-base-content/80 block mb-1"
												>Aktivitas Guru</label
											>
											<textarea
												id="awal-guru"
												class="textarea textarea-bordered text-xs h-20 w-full rounded-lg"
												bind:value={konten.tahapMemahami.kegiatanAwal.aktivitasGuru}></textarea>
										</div>
										<div>
											<label
												for="awal-murid"
												class="text-xs font-semibold text-base-content/80 block mb-1"
												>Aktivitas Murid</label
											>
											<textarea
												id="awal-murid"
												class="textarea textarea-bordered text-xs h-20 w-full rounded-lg"
												bind:value={konten.tahapMemahami.kegiatanAwal.aktivitasMurid}></textarea>
										</div>
									</div>
									<div>
										<label
											for="awal-prinsip"
											class="text-xs font-semibold text-base-content/80 block mb-1"
										>
											Penerapan Prinsip Pembelajaran (Mindful, Meaningful, Joyful)
										</label>
										<input
											id="awal-prinsip"
											type="text"
											class="input input-bordered input-xs w-full rounded-lg"
											bind:value={konten.tahapMemahami.kegiatanAwal.penerapanPrinsip}
										/>
									</div>
								</div>

								<!-- Kegiatan Inti -->
								<div class="space-y-3">
									<div class="flex items-center justify-between">
										<span class="font-bold text-xs text-base-content/80"
											>Langkah Kegiatan Inti Memahami</span
										>
										<button
											type="button"
											class="btn btn-xs btn-outline btn-primary rounded-lg"
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
										<div class="p-3.5 bg-base-200/30 rounded-xl border border-base-200 space-y-2.5">
											<div class="flex items-center justify-between gap-2">
												<input
													type="text"
													class="input input-bordered input-xs font-bold w-52 rounded-lg"
													placeholder="Nama Langkah"
													bind:value={k.langkah}
												/>
												<input
													type="text"
													class="input input-bordered input-xs w-28 text-center rounded-lg"
													placeholder="Waktu"
													bind:value={k.alokasiWaktu}
												/>
												<button
													type="button"
													class="btn btn-xs btn-ghost text-error btn-square"
													onclick={() =>
														(konten.tahapMemahami.kegiatanInti =
															konten.tahapMemahami.kegiatanInti.filter((_, i) => i !== idx))}
												>
													✕
												</button>
											</div>
											<div class="grid grid-cols-1 md:grid-cols-2 gap-2.5">
												<textarea
													class="textarea textarea-bordered text-xs h-16 rounded-lg"
													placeholder="Peran Guru (pendampingan & instruksi)"
													bind:value={k.peranGuru}></textarea>
												<textarea
													class="textarea textarea-bordered text-xs h-16 rounded-lg"
													placeholder="Aktivitas Murid (diskusi, eksplorasi)"
													bind:value={k.aktivitasMurid}></textarea>
											</div>
										</div>
									{/each}
								</div>
							</div>
						</div>
					{/if}

					<!-- TAB E: TAHAP 2 MENGAPLIKASI -->
					{#if activeTab === 'mengaplikasi'}
						<div class="space-y-6 max-w-4xl">
							<div class="border-b border-base-200 pb-3">
								<h3 class="text-base font-bold text-base-content">
									E. Pengalaman Belajar: Tahap 2 Mengaplikasi
								</h3>
								<p class="text-xs text-base-content/60 mt-0.5">
									Penyelesaian masalah autentik dunia nyata, tugas tantangan, dan karya nyata murid.
								</p>
							</div>

							<div
								class="card bg-base-100 border border-base-200 p-5 rounded-2xl space-y-4 shadow-xs"
							>
								<div>
									<label
										for="app-konteks"
										class="text-xs font-bold text-base-content/80 block mb-1.5"
									>
										1. Konteks Masalah Autentik (Dunia Nyata)
									</label>
									<textarea
										id="app-konteks"
										class="textarea textarea-bordered text-xs h-20 w-full rounded-xl leading-relaxed"
										bind:value={konten.tahapMengaplikasi.konteksMasalahAutentik}></textarea>
								</div>

								<div>
									<label
										for="app-tugas"
										class="text-xs font-bold text-base-content/80 block mb-1.5"
									>
										2. Tugas & Tantangan Murid
									</label>
									<textarea
										id="app-tugas"
										class="textarea textarea-bordered text-xs h-20 w-full rounded-xl leading-relaxed"
										bind:value={konten.tahapMengaplikasi.tugasTantangan}></textarea>
								</div>

								<div>
									<label
										for="app-langkah"
										class="text-xs font-bold text-base-content/80 block mb-1.5"
									>
										3. Langkah Kerja Sistematis (1 baris 1 langkah)
									</label>
									<textarea
										id="app-langkah"
										class="textarea textarea-bordered text-xs h-24 w-full rounded-xl leading-relaxed"
										value={(konten.tahapMengaplikasi.langkahKerja || []).join('\n')}
										oninput={(e) =>
											(konten.tahapMengaplikasi.langkahKerja = (e.currentTarget.value || '')
												.split('\n')
												.filter(Boolean))}></textarea>
								</div>

								<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div>
										<label
											for="app-produk"
											class="text-xs font-bold text-base-content/80 block mb-1.5"
										>
											4. Produk / Solusi Nyata
										</label>
										<input
											id="app-produk"
											type="text"
											class="input input-bordered input-xs w-full rounded-lg"
											bind:value={konten.tahapMengaplikasi.produkSolusiNyata}
										/>
									</div>
									<div>
										<label
											for="app-kaitan"
											class="text-xs font-bold text-base-content/80 block mb-1.5"
										>
											5. Keterkaitan Kehidupan Nyata
										</label>
										<input
											id="app-kaitan"
											type="text"
											class="input input-bordered input-xs w-full rounded-lg"
											bind:value={konten.tahapMengaplikasi.keterkaitanKehidupanNyata}
										/>
									</div>
								</div>
							</div>
						</div>
					{/if}

					<!-- TAB F: TAHAP 3 MEREFLEKSI -->
					{#if activeTab === 'merefleksi'}
						<div class="space-y-6 max-w-4xl">
							<div class="border-b border-base-200 pb-3">
								<h3 class="text-base font-bold text-base-content">
									F. Pengalaman Belajar: Tahap 3 Merefleksi
								</h3>
								<p class="text-xs text-base-content/60 mt-0.5">
									Refleksi bermakna peserta didik serta sintesis kesimpulan bersama di akhir sesi.
								</p>
							</div>

							<div
								class="card bg-base-100 border border-base-200 p-5 rounded-2xl space-y-4 shadow-xs"
							>
								<div>
									<label
										for="refleksi-tanya"
										class="text-xs font-bold text-base-content/80 block mb-1.5"
									>
										1. Pertanyaan Refleksi Peserta Didik (1 baris 1 pertanyaan)
									</label>
									<textarea
										id="refleksi-tanya"
										class="textarea textarea-bordered text-xs h-36 w-full rounded-xl leading-relaxed"
										value={(konten.tahapMerefleksi.pertanyaanRefleksi || []).join('\n')}
										oninput={(e) =>
											(konten.tahapMerefleksi.pertanyaanRefleksi = (e.currentTarget.value || '')
												.split('\n')
												.filter(Boolean))}></textarea>
								</div>

								<div>
									<label
										for="refleksi-kesimpulan"
										class="text-xs font-bold text-base-content/80 block mb-1.5"
									>
										2. Kesimpulan Bersama Pembelajaran
									</label>
									<textarea
										id="refleksi-kesimpulan"
										class="textarea textarea-bordered text-xs h-28 w-full rounded-xl leading-relaxed"
										bind:value={konten.tahapMerefleksi.kesimpulanPembelajaran}></textarea>
								</div>
							</div>
						</div>
					{/if}

					<!-- TAB G: ASESMEN -->
					{#if activeTab === 'asesmen'}
						<div class="space-y-6 max-w-4xl">
							<div class="border-b border-base-200 pb-3">
								<h3 class="text-base font-bold text-base-content">G. Asesmen Pembelajaran</h3>
								<p class="text-xs text-base-content/60 mt-0.5">
									Asesmen awal (diagnostik), asesmen proses (formatif), dan asesmen akhir (sumatif).
								</p>
							</div>

							<div
								class="card bg-base-100 border border-base-200 p-5 rounded-2xl space-y-5 shadow-xs"
							>
								<div>
									<label
										for="asesmen-diag"
										class="text-xs font-bold text-base-content/80 block mb-1.5"
									>
										1. Asesmen Diagnostik (Awal)
									</label>
									<textarea
										id="asesmen-diag"
										class="textarea textarea-bordered text-xs h-16 w-full rounded-xl"
										bind:value={konten.asesmen.diagnostik}></textarea>
								</div>

								<div>
									<div class="flex items-center justify-between mb-2">
										<span class="text-xs font-bold text-base-content/80"
											>2. Asesmen Formatif (Proses)</span
										>
										<button
											type="button"
											class="btn btn-xs btn-outline btn-primary rounded-lg"
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
									<div class="space-y-2">
										{#each konten.asesmen.formatif as f, idx (idx)}
											<div
												class="grid grid-cols-1 md:grid-cols-4 gap-2 items-center p-2.5 bg-base-200/40 rounded-xl border border-base-200"
											>
												<input
													type="text"
													class="input input-bordered input-xs rounded-lg"
													placeholder="Teknik Asesmen"
													bind:value={f.teknik}
												/>
												<input
													type="text"
													class="input input-bordered input-xs rounded-lg"
													placeholder="Instrumen"
													bind:value={f.instrumen}
												/>
												<input
													type="text"
													class="input input-bordered input-xs rounded-lg"
													placeholder="Waktu Pelaksanaan"
													bind:value={f.waktu}
												/>
												<div class="flex items-center gap-1.5">
													<input
														type="text"
														class="input input-bordered input-xs flex-1 rounded-lg"
														placeholder="Tindak Lanjut"
														bind:value={f.tindakLanjut}
													/>
													<button
														type="button"
														class="btn btn-xs btn-ghost text-error btn-square"
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
								</div>

								<div>
									<label
										for="asesmen-sumatif"
										class="text-xs font-bold text-base-content/80 block mb-1.5"
									>
										3. Asesmen Sumatif (Akhir)
									</label>
									<textarea
										id="asesmen-sumatif"
										class="textarea textarea-bordered text-xs h-20 w-full rounded-xl"
										bind:value={konten.asesmen.sumatif}></textarea>
								</div>
							</div>
						</div>
					{/if}

					<!-- TAB H: RUBRIK ASESMEN -->
					{#if activeTab === 'rubrik'}
						<div class="space-y-6 max-w-4xl">
							<div class="border-b border-base-200 pb-3 flex items-center justify-between">
								<div>
									<h3 class="text-base font-bold text-base-content">
										H. Rubrik Asesmen Pembelajaran Mendalam
									</h3>
									<p class="text-xs text-base-content/60 mt-0.5">
										Matriks penilaian 4 skala deskriptif (Sangat Baik, Baik, Cukup, Perlu
										Bimbingan).
									</p>
								</div>
								<button
									type="button"
									class="btn btn-xs btn-outline btn-primary rounded-lg"
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

							<div class="space-y-4">
								{#each konten.rubrik as r, idx (idx)}
									<div
										class="card bg-base-100 border border-base-200 p-4 rounded-2xl shadow-xs space-y-3"
									>
										<div class="flex items-center justify-between border-b border-base-200 pb-2">
											<input
												type="text"
												class="input input-bordered input-xs font-bold w-72 rounded-lg"
												placeholder="Nama Kriteria Penilaian"
												bind:value={r.kriteria}
											/>
											<button
												type="button"
												class="btn btn-xs btn-ghost text-error"
												onclick={() => (konten.rubrik = konten.rubrik.filter((_, i) => i !== idx))}
											>
												✕ Hapus Kriteria
											</button>
										</div>
										<div class="grid grid-cols-1 md:grid-cols-4 gap-2.5">
											<div class="p-2 bg-success/5 rounded-xl border border-success/20">
												<span class="text-[11px] font-bold text-success block mb-1">
													Sangat Baik (Skala 4)
												</span>
												<textarea
													class="textarea textarea-bordered text-xs w-full h-20 rounded-lg"
													bind:value={r.sangatBaik}></textarea>
											</div>
											<div class="p-2 bg-info/5 rounded-xl border border-info/20">
												<span class="text-[11px] font-bold text-info block mb-1">
													Baik (Skala 3)
												</span>
												<textarea
													class="textarea textarea-bordered text-xs w-full h-20 rounded-lg"
													bind:value={r.baik}></textarea>
											</div>
											<div class="p-2 bg-warning/5 rounded-xl border border-warning/20">
												<span class="text-[11px] font-bold text-warning block mb-1">
													Cukup (Skala 2)
												</span>
												<textarea
													class="textarea textarea-bordered text-xs w-full h-20 rounded-lg"
													bind:value={r.cukup}></textarea>
											</div>
											<div class="p-2 bg-error/5 rounded-xl border border-error/20">
												<span class="text-[11px] font-bold text-error block mb-1">
													Perlu Bimbingan (Skala 1)
												</span>
												<textarea
													class="textarea textarea-bordered text-xs w-full h-20 rounded-lg"
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
						<div class="space-y-6 max-w-4xl">
							<div class="border-b border-base-200 pb-3">
								<h3 class="text-base font-bold text-base-content">I. Diferensiasi Pembelajaran</h3>
								<p class="text-xs text-base-content/60 mt-0.5">
									Strategi diferensiasi konten, proses, produk, dan dukungan khusus peserta didik.
								</p>
							</div>

							<div
								class="card bg-base-100 border border-base-200 p-5 rounded-2xl space-y-4 shadow-xs"
							>
								<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div>
										<label
											for="dif-konten"
											class="text-xs font-bold text-base-content/80 block mb-1.5"
										>
											1. Diferensiasi Konten
										</label>
										<textarea
											id="dif-konten"
											class="textarea textarea-bordered text-xs h-28 w-full rounded-xl leading-relaxed"
											bind:value={konten.diferensiasi.konten}></textarea>
									</div>
									<div>
										<label
											for="dif-proses"
											class="text-xs font-bold text-base-content/80 block mb-1.5"
										>
											2. Diferensiasi Proses
										</label>
										<textarea
											id="dif-proses"
											class="textarea textarea-bordered text-xs h-28 w-full rounded-xl leading-relaxed"
											bind:value={konten.diferensiasi.proses}></textarea>
									</div>
									<div>
										<label
											for="dif-produk"
											class="text-xs font-bold text-base-content/80 block mb-1.5"
										>
											3. Diferensiasi Produk
										</label>
										<textarea
											id="dif-produk"
											class="textarea textarea-bordered text-xs h-28 w-full rounded-xl leading-relaxed"
											bind:value={konten.diferensiasi.produk}></textarea>
									</div>
									<div>
										<label
											for="dif-khusus"
											class="text-xs font-bold text-base-content/80 block mb-1.5"
										>
											4. Dukungan Khusus (Bimbingan Tambahan)
										</label>
										<textarea
											id="dif-khusus"
											class="textarea textarea-bordered text-xs h-28 w-full rounded-xl leading-relaxed"
											bind:value={konten.diferensiasi.dukunganKhusus}></textarea>
									</div>
								</div>
							</div>
						</div>
					{/if}

					<!-- TAB J: REMEDIAL & PENGAYAAN -->
					{#if activeTab === 'remedial'}
						<div class="space-y-6 max-w-4xl">
							<div class="border-b border-base-200 pb-3">
								<h3 class="text-base font-bold text-base-content">J. Remedial dan Pengayaan</h3>
								<p class="text-xs text-base-content/60 mt-0.5">
									Rancangan program penguatan konsep belum tuntas dan tugas pengayaan HOTS.
								</p>
							</div>

							<div
								class="card bg-base-100 border border-base-200 p-5 rounded-2xl space-y-4 shadow-xs"
							>
								<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div>
										<label
											for="rem-remedial"
											class="text-xs font-bold text-base-content/80 block mb-1.5"
										>
											1. Program Remedial
										</label>
										<textarea
											id="rem-remedial"
											class="textarea textarea-bordered text-xs h-36 w-full rounded-xl leading-relaxed"
											bind:value={konten.remedialDanPengayaan.remedial}></textarea>
									</div>
									<div>
										<label
											for="rem-pengayaan"
											class="text-xs font-bold text-base-content/80 block mb-1.5"
										>
											2. Program Pengayaan
										</label>
										<textarea
											id="rem-pengayaan"
											class="textarea textarea-bordered text-xs h-36 w-full rounded-xl leading-relaxed"
											bind:value={konten.remedialDanPengayaan.pengayaan}></textarea>
									</div>
								</div>
							</div>
						</div>
					{/if}

					<!-- TAB K: REFLEKSI GURU -->
					{#if activeTab === 'refleksi'}
						<div class="space-y-6 max-w-4xl">
							<div class="border-b border-base-200 pb-3">
								<h3 class="text-base font-bold text-base-content">K. Refleksi Guru</h3>
								<p class="text-xs text-base-content/60 mt-0.5">
									5 Panduan pertanyaan reflektif untuk evaluasi diri guru terhadap efektivitas
									pembelajaran.
								</p>
							</div>

							<div
								class="card bg-base-100 border border-base-200 p-5 rounded-2xl space-y-4 shadow-xs"
							>
								<label
									for="guru-refleksi"
									class="text-xs font-bold text-base-content/80 block mb-1"
								>
									Daftar Pertanyaan Evaluasi Diri (1 baris 1 pertanyaan):
								</label>
								<textarea
									id="guru-refleksi"
									class="textarea textarea-bordered text-xs h-44 w-full rounded-xl leading-relaxed"
									value={(konten.refleksiGuru || []).join('\n')}
									oninput={(e) =>
										(konten.refleksiGuru = (e.currentTarget.value || '')
											.split('\n')
											.filter(Boolean))}></textarea>
							</div>
						</div>
					{/if}

					<!-- TAB L: LAMPIRAN -->
					{#if activeTab === 'lampiran'}
						<div class="space-y-6 max-w-4xl">
							<div class="border-b border-base-200 pb-3">
								<h3 class="text-base font-bold text-base-content">L. Lampiran Dokumen</h3>
								<p class="text-xs text-base-content/60 mt-0.5">
									Ringkasan bahan ajar, petunjuk LKPD, media belajar, glosarium istilah, dan pustaka
									rujukan.
								</p>
							</div>

							<div
								class="card bg-base-100 border border-base-200 p-5 rounded-2xl space-y-4 shadow-xs"
							>
								<div>
									<label
										for="lamp-bahan"
										class="text-xs font-bold text-base-content/80 block mb-1.5"
									>
										1. Ringkasan Bahan Ajar
									</label>
									<textarea
										id="lamp-bahan"
										class="textarea textarea-bordered text-xs h-28 w-full rounded-xl leading-relaxed"
										bind:value={konten.lampiran.bahanAjarRingkas}></textarea>
								</div>

								<div>
									<label
										for="lamp-lkpd"
										class="text-xs font-bold text-base-content/80 block mb-1.5"
									>
										2. Petunjuk LKPD (Lembar Kerja Peserta Didik)
									</label>
									<textarea
										id="lamp-lkpd"
										class="textarea textarea-bordered text-xs h-28 w-full rounded-xl leading-relaxed"
										bind:value={konten.lampiran.petunjukLkpd}></textarea>
								</div>

								<div>
									<label
										for="lamp-media"
										class="text-xs font-bold text-base-content/80 block mb-1.5"
									>
										3. Media, Alat, dan Sumber Belajar
									</label>
									<textarea
										id="lamp-media"
										class="textarea textarea-bordered text-xs h-20 w-full rounded-xl leading-relaxed"
										bind:value={konten.lampiran.mediaDanSumber}></textarea>
								</div>

								<div>
									<div class="flex items-center justify-between mb-2">
										<span class="text-xs font-bold text-base-content/80">4. Glosarium Istilah</span>
										<button
											type="button"
											class="btn btn-xs btn-outline btn-primary rounded-lg"
											onclick={() =>
												(konten.lampiran.glosarium = [
													...konten.lampiran.glosarium,
													{ istilah: '', definisi: '' }
												])}
										>
											+ Tambah Istilah
										</button>
									</div>
									<div class="space-y-2">
										{#each konten.lampiran.glosarium as g, idx (idx)}
											<div
												class="flex items-center gap-2 p-2 bg-base-200/40 rounded-xl border border-base-200"
											>
												<input
													type="text"
													class="input input-bordered input-xs w-48 font-bold rounded-lg"
													placeholder="Istilah"
													bind:value={g.istilah}
												/>
												<input
													type="text"
													class="input input-bordered input-xs flex-1 rounded-lg"
													placeholder="Definisi"
													bind:value={g.definisi}
												/>
												<button
													type="button"
													class="btn btn-xs btn-ghost text-error btn-square"
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
								</div>

								<div>
									<label
										for="lamp-pustaka"
										class="text-xs font-bold text-base-content/80 block mb-1.5"
									>
										5. Daftar Pustaka (1 baris 1 referensi)
									</label>
									<textarea
										id="lamp-pustaka"
										class="textarea textarea-bordered text-xs h-24 w-full rounded-xl leading-relaxed"
										value={(konten.lampiran.daftarPustaka || []).join('\n')}
										oninput={(e) =>
											(konten.lampiran.daftarPustaka = (e.currentTarget.value || '')
												.split('\n')
												.filter(Boolean))}></textarea>
								</div>
							</div>
						</div>
					{/if}
				</main>
			</div>

			<!-- Modal Bottom Footer -->
			<div
				class="flex items-center justify-between px-3.5 sm:px-6 py-2.5 sm:py-3.5 border-t border-base-200 bg-base-100 shrink-0 gap-2"
			>
				<div class="flex items-center gap-1.5 sm:gap-2">
					<button
						type="button"
						class="btn btn-xs sm:btn-sm btn-ghost rounded-xl"
						onclick={() => (showModal = false)}
					>
						Tutup
					</button>
					{#if editId > 0}
						<button
							type="button"
							class="btn btn-xs sm:btn-sm btn-outline gap-1 sm:gap-1.5 rounded-xl"
							onclick={() => window.open('/api/pdf/modul-ajar?id=' + editId, '_blank')}
						>
							<Icon name="print" />
							<span class="hidden sm:inline">Cetak</span> PDF
						</button>
					{/if}
				</div>

				<div class="flex items-center gap-1.5 sm:gap-2">
					<button
						type="button"
						class="btn btn-xs sm:btn-sm btn-outline rounded-xl"
						onclick={() => handleSave('draf')}
						disabled={isSaving || !materiPokok.trim()}
					>
						{isSaving ? 'Menyimpan...' : 'Simpan Draf'}
					</button>
					<button
						type="button"
						class="btn btn-xs sm:btn-sm btn-primary shadow-sm rounded-xl"
						onclick={() => handleSave('final')}
						disabled={isSaving || !materiPokok.trim()}
					>
						{isSaving ? 'Menyimpan...' : 'Finalkan'}
					</button>
				</div>
			</div>
		</div>
		<form method="dialog" class="modal-backdrop">
			<button type="button" onclick={() => (showModal = false)}>close</button>
		</form>
	</dialog>
{/if}
