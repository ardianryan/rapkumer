<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import Icon from '$lib/components/icon.svelte';
	import GridMatriks from '$lib/components/rapor-sisipan/grid-matriks.svelte';
	import SetupModal from '$lib/components/rapor-sisipan/setup-modal.svelte';
	import CatatanWaliTab from '$lib/components/rapor-sisipan/catatan-wali-tab.svelte';
	import ProgressTab from '$lib/components/rapor-sisipan/progress-tab.svelte';

	let { data } = $props();

	let activeTab = $state<'nilai' | 'catatan' | 'monitoring'>('nilai');
	let setupOpen = $state(false);

	const kelasAktif = $derived(data.kelasAktif);
	const selectedMapel = $derived(data.selectedMapel);
	const setup = $derived(data.setup);
	const hasMapel = $derived(data.mapelList.length > 0);
	const isSetupDone = $derived(
		Boolean(
			setup &&
			setup.komponenFormatif &&
			setup.komponenFormatif.length > 0 &&
			setup.komponenSumatif &&
			setup.komponenSumatif.length > 0
		)
	);

	function handleKelasChange(event: Event) {
		const targetKelasId = (event.target as HTMLSelectElement).value;
		const params = new URLSearchParams(page.url.search);
		params.set('kelas_id', targetKelasId);
		params.delete('mapel_id');
		void goto(`${page.url.pathname}?${params.toString()}`);
	}

	function handleMapelChange(event: Event) {
		const targetMapelId = (event.target as HTMLSelectElement).value;
		const params = new URLSearchParams(page.url.search);
		params.set('mapel_id', targetMapelId);
		void goto(`${page.url.pathname}?${params.toString()}`);
	}

	function handleSelectMapelFromProgress(mapelId: number) {
		const params = new URLSearchParams(page.url.search);
		params.set('mapel_id', String(mapelId));
		activeTab = 'nilai';
		void goto(`${page.url.pathname}?${params.toString()}`);
	}

	async function reloadData() {
		await invalidate('app:rapor-sisipan');
	}
</script>

<div class="space-y-5">
	<!-- HEADER UTAMA -->
	<div class="card bg-base-100 cursor-default rounded-xl border-none p-5 shadow-md">
		<div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
			<div>
				<div class="flex items-center gap-2">
					<h2 class="text-xl font-black text-base-content tracking-tight">
						Rapor Sisipan Tengah Semester (STS / PTS)
					</h2>
				</div>
				<p class="text-xs text-base-content/70 mt-1">
					Pengisian asesmen formatif (tugas harian) & sumatif (ulangan materi) dinamis per mata
					pelajaran, matriks kelas terpadu, dan cetak laporan paruh semester.
				</p>
			</div>

			<!-- ACTION BUTTONS & SHORTCUTS -->
			<div class="flex flex-wrap items-center gap-2">
				{#if kelasAktif && data.isWaliKelasOrAdmin}
					<a
						href="/cetak/rapor-sisipan?kelas_id={kelasAktif.id}"
						class="btn btn-sm btn-soft btn-primary shadow-xs"
					>
						<Icon name="print" />
						Cetak Rapor Sisipan
					</a>
				{/if}
			</div>
		</div>

		<!-- FILTER KELAS & NAVIGASI TAB -->
		<div
			class="mt-5 pt-4 border-t border-base-200 flex flex-col md:flex-row md:items-center justify-between gap-3"
		>
			<div class="flex flex-wrap items-center gap-2">
				<!-- PEMILIH KELAS -->
				{#if data.daftarKelas && data.daftarKelas.length > 0}
					<div class="flex items-center gap-1.5">
						<span class="text-xs text-base-content/60 font-semibold">Kelas:</span>
						<select
							class="select select-sm bg-base-200 dark:bg-base-300 font-bold"
							value={kelasAktif?.id ?? ''}
							onchange={handleKelasChange}
						>
							{#each data.daftarKelas as k (k.id)}
								<option value={k.id}>{k.nama}</option>
							{/each}
						</select>
					</div>
				{/if}

				<!-- TAB SWITCHER -->
				<div class="tabs tabs-box bg-base-200/80 p-0.5 rounded-lg">
					<button
						type="button"
						class="tab tab-sm font-semibold {activeTab === 'nilai'
							? 'tab-active text-primary font-bold'
							: ''}"
						onclick={() => (activeTab = 'nilai')}
					>
						<Icon name="pen" class="h-3.5 w-3.5 mr-1" />
						Input Nilai Mapel
					</button>

					{#if data.isWaliKelasOrAdmin}
						<button
							type="button"
							class="tab tab-sm font-semibold {activeTab === 'catatan'
								? 'tab-active text-primary font-bold'
								: ''}"
							onclick={() => (activeTab = 'catatan')}
						>
							<Icon name="user" class="h-3.5 w-3.5 mr-1" />
							Catatan Wali & Presensi
						</button>

						<button
							type="button"
							class="tab tab-sm font-semibold {activeTab === 'monitoring'
								? 'tab-active text-primary font-bold'
								: ''}"
							onclick={() => (activeTab = 'monitoring')}
						>
							<Icon name="chart" class="h-3.5 w-3.5 mr-1" />
							Monitoring Capaian
						</button>
					{/if}
				</div>
			</div>

			<!-- INFO WALI KELAS -->
			{#if kelasAktif?.waliKelasNama}
				<div class="text-xs text-base-content/60">
					Wali Kelas: <strong class="text-base-content">{kelasAktif.waliKelasNama}</strong>
				</div>
			{/if}
		</div>
	</div>

	<!-- KONTEN TAB 1: INPUT NILAI MAPEL -->
	{#if activeTab === 'nilai'}
		{#if !kelasAktif}
			<div class="alert alert-soft alert-warning">
				<Icon name="alert" />
				<span>Silakan pilih kelas terlebih dahulu untuk memulai pengisian nilai.</span>
			</div>
		{:else if !hasMapel}
			<div class="alert alert-soft alert-info">
				<Icon name="info" />
				<span>
					Belum ada mata pelajaran yang diampu atau ditugaskan untuk kelas ini. Hubungi admin
					kurikulum jika Anda belum diplot sebagai guru pengampu mapel.
				</span>
			</div>
		{:else}
			<div class="space-y-4">
				<!-- DROPDOWN PEMILIH MATA PELAJARAN -->
				<div
					class="card bg-base-100 p-4 rounded-xl border border-base-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
				>
					<div class="flex items-center gap-2 grow max-w-md">
						<span class="text-xs text-base-content/70 font-bold shrink-0">Pilih Mapel:</span>
						<select
							class="select select-sm bg-base-200 dark:bg-base-300 w-full font-bold"
							value={selectedMapel?.id ?? ''}
							onchange={handleMapelChange}
						>
							{#each data.mapelList as m (m.id)}
								<option value={m.id}>{m.nama}</option>
							{/each}
						</select>
					</div>

					{#if selectedMapel}
						<div class="flex items-center gap-2">
							<button
								type="button"
								class="btn btn-sm btn-soft btn-secondary"
								onclick={() => (setupOpen = true)}
							>
								<Icon name="gear" />
								Atur Komponen Asesmen
							</button>
						</div>
					{/if}
				</div>

				<!-- JIKA BELUM SETUP -->
				{#if !isSetupDone && selectedMapel}
					<div
						class="card bg-base-100 p-8 rounded-xl border border-base-200 shadow-md text-center space-y-4"
					>
						<div
							class="w-16 h-16 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center"
						>
							<Icon name="book" class="h-8 w-8" />
						</div>
						<div class="max-w-md mx-auto space-y-1">
							<h3 class="text-lg font-bold text-base-content">
								Komponen Asesmen Belum Dikonfigurasi
							</h3>
							<p class="text-xs text-base-content/70">
								Untuk mata pelajaran <strong>{selectedMapel.nama}</strong>, silakan tentukan berapa
								kali tugas formatif & ulangan sumatif materi yang telah dilaksanakan sebelum
								memasukkan nilai.
							</p>
						</div>
						<div>
							<button type="button" class="btn btn-primary" onclick={() => (setupOpen = true)}>
								<Icon name="gear" />
								Mulai Atur Komponen Asesmen
							</button>
						</div>
					</div>
				{:else if selectedMapel && setup}
					<!-- GRID MATRIKS SPREADSHEET PENUH -->
					<GridMatriks
						kelasId={kelasAktif.id}
						mapelId={selectedMapel.id}
						mapelNama={selectedMapel.nama}
						komponenFormatif={setup.komponenFormatif}
						komponenSumatif={setup.komponenSumatif}
						adaStsTes={setup.adaStsTes}
						adaStsNonTes={setup.adaStsNonTes}
						bobotSumatif={setup.bobotSumatifTp}
						bobotSts={setup.bobotSts}
						muridList={data.daftarMurid}
						canEdit={true}
						onSaved={reloadData}
						onOpenSetup={() => (setupOpen = true)}
					/>
				{/if}
			</div>
		{/if}
	{/if}

	<!-- KONTEN TAB 2: CATATAN WALI KELAS -->
	{#if activeTab === 'catatan' && data.isWaliKelasOrAdmin && kelasAktif}
		<CatatanWaliTab
			kelasId={kelasAktif.id}
			kelasNama={kelasAktif.nama}
			items={data.catatanWaliList}
			canEdit={true}
			onSaved={reloadData}
		/>
	{/if}

	<!-- KONTEN TAB 3: MONITORING PROGRES KELAS -->
	{#if activeTab === 'monitoring' && data.isWaliKelasOrAdmin && kelasAktif}
		<ProgressTab
			kelasNama={kelasAktif.nama}
			progressList={data.progressList}
			onSelectMapel={handleSelectMapelFromProgress}
		/>
	{/if}
</div>

<!-- MODAL PENGATURAN KOMPONEN ASESMEN -->
<dialog class="modal" open={setupOpen} onclose={() => (setupOpen = false)}>
	<div class="modal-box max-w-2xl max-h-[90vh] overflow-y-auto">
		{#if selectedMapel && kelasAktif}
			<SetupModal
				kelasId={kelasAktif.id}
				mapelId={selectedMapel.id}
				mapelNama={selectedMapel.nama}
				isConfigured={isSetupDone}
				initialKomponenFormatif={setup?.komponenFormatif}
				initialKomponenSumatif={setup?.komponenSumatif}
				initialAdaStsTes={setup?.adaStsTes ?? true}
				initialAdaStsNonTes={setup?.adaStsNonTes ?? false}
				initialBobotSumatif={setup?.bobotSumatifTp ?? 70}
				initialBobotSts={setup?.bobotSts ?? 30}
				availableTps={data.availableTps}
				availableLingkupMateri={data.availableLingkupMateri}
				onSaved={async () => {
					setupOpen = false;
					await reloadData();
				}}
				onClose={() => (setupOpen = false)}
			/>
		{/if}
	</div>
	<form method="dialog" class="modal-backdrop">
		<button onclick={() => (setupOpen = false)}>tutup</button>
	</form>
</dialog>
