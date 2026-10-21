<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import Icon from '$lib/components/icon.svelte';
	import GridMatriks from '$lib/components/rapor-sisipan/grid-matriks.svelte';
	import SetupModal from '$lib/components/rapor-sisipan/setup-modal.svelte';
	import CopyMapelModal from '$lib/components/rapor-sisipan/copy-mapel-modal.svelte';
	import CatatanWaliTab from '$lib/components/rapor-sisipan/catatan-wali-tab.svelte';
	import ProgressTab from '$lib/components/rapor-sisipan/progress-tab.svelte';
	import { toast } from '$lib/components/toast.svelte';

	let { data } = $props();

	let activeTab = $state<'nilai' | 'catatan' | 'monitoring'>('nilai');
	let setupOpen = $state(false);
	let copyModalOpen = $state(false);
	let adminConfigOpen = $state(false);
	let adminMaxFormatif = $state(4);
	let adminMaxSumatif = $state(3);
	let adminShowRataTugas = $state(true);
	let adminShowRataFormatif = $state(true);
	let adminShowSts = $state(true);
	let adminShowNaSts = $state(true);
	let adminShowTtdKepala = $state(true);
	let isSavingAdminConfig = $state(false);

	$effect(() => {
		if (data.maxFormatif) adminMaxFormatif = data.maxFormatif;
		if (data.maxSumatif) adminMaxSumatif = data.maxSumatif;
		if (data.showRataTugas !== undefined) adminShowRataTugas = data.showRataTugas;
		if (data.showRataFormatif !== undefined) adminShowRataFormatif = data.showRataFormatif;
		if (data.showSts !== undefined) adminShowSts = data.showSts;
		if (data.showNaSts !== undefined) adminShowNaSts = data.showNaSts;
		if (data.showTtdKepala !== undefined) adminShowTtdKepala = data.showTtdKepala;
	});

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

	async function handleSaveAdminConfig(e: SubmitEvent) {
		e.preventDefault();
		isSavingAdminConfig = true;
		try {
			const res = await fetch('/api/sekolah/rapor-sisipan-config', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					maxFormatif: adminMaxFormatif,
					maxSumatif: adminMaxSumatif,
					maxTugas: adminMaxFormatif,
					showRataTugas: adminShowRataTugas,
					showRataFormatif: adminShowRataFormatif,
					showSts: adminShowSts,
					showNaSts: adminShowNaSts,
					showTtdKepala: adminShowTtdKepala
				})
			});
			const json = await res.json();
			if (!res.ok) throw new Error(json.error || 'Gagal menyimpan konfigurasi');
			toast('Aturan asesmen dan format cetak rapor berhasil diperbarui', 'success');
			adminConfigOpen = false;
			await reloadData();
		} catch (err) {
			toast((err as Error).message, 'error');
		} finally {
			isSavingAdminConfig = false;
		}
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
					Pengisian asesmen tugas harian & formatif lingkup materi dinamis per mata pelajaran,
					matriks kelas terpadu, dan cetak laporan paruh semester.
				</p>
			</div>

			<!-- ACTION BUTTONS & SHORTCUTS -->
			<div class="flex flex-wrap items-center gap-2">
				{#if data.isAdmin}
					<button
						type="button"
						class="btn btn-sm btn-ghost border border-base-300"
						onclick={() => {
							adminMaxFormatif = data.maxFormatif ?? 4;
							adminMaxSumatif = data.maxSumatif ?? 3;
							adminShowRataTugas = data.showRataTugas ?? true;
							adminShowRataFormatif = data.showRataFormatif ?? true;
							adminShowSts = data.showSts ?? true;
							adminShowNaSts = data.showNaSts ?? true;
							adminShowTtdKepala = data.showTtdKepala ?? true;
							adminConfigOpen = true;
						}}
						title="Atur batas maksimal asesmen & kebijakan tampilan cetak rapor sisipan untuk sekolah"
					>
						<Icon name="gear" />
						Aturan Asesmen & Cetak (Admin)
					</button>
				{/if}
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
				<div>
					<h4 class="font-bold text-sm">Tidak Ada Mata Pelajaran yang Diampu di Kelas Ini</h4>
					<p class="text-xs text-base-content/70 mt-0.5">
						{#if data.isWaliKelasOrAdmin}
							Sebagai Wali Kelas, Anda tidak tercatat mengajar mata pelajaran di kelas ini, namun
							Anda dapat memantau progres pengisian nilai guru lain melalui tab <strong
								>Monitoring Capaian</strong
							>
							atau mengisi kehadiran di tab <strong>Catatan Wali & Presensi</strong>.
						{:else}
							Anda belum tercatat sebagai guru pengampu mata pelajaran di kelas ini. Hubungi
							administrator jika penugasan belum sesuai.
						{/if}
					</p>
				</div>
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
							{#if data.canEditSelectedMapel}
								<button
									type="button"
									class="btn btn-sm btn-soft btn-secondary font-semibold"
									onclick={() => (setupOpen = true)}
								>
									<Icon name="gear" />
									Atur Komponen Asesmen
								</button>
							{:else}
								<span class="badge badge-sm badge-ghost text-base-content/70 font-medium">
									Mode Pantau (Pengampu: {selectedMapel.guruNama || 'Belum ada pengampu'})
								</span>
							{/if}
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
						<div class="flex flex-wrap items-center justify-center gap-2">
							{#if data.canEditSelectedMapel}
								<button type="button" class="btn btn-primary" onclick={() => (setupOpen = true)}>
									<Icon name="gear" />
									Mulai Atur Komponen Asesmen
								</button>
							{:else}
								<span class="badge badge-neutral text-xs">
									Menunggu guru pengampu ({selectedMapel.guruNama || 'Guru'}) mengatur asesmen
								</span>
							{/if}
							{#if data.isAdmin}
								<button
									type="button"
									class="btn btn-outline btn-primary"
									onclick={() => (copyModalOpen = true)}
								>
									<Icon name="copy" />
									Salin dari Mapel Lain
								</button>
							{/if}
						</div>
					</div>
				{:else if selectedMapel && setup}
					{#if !data.canEditSelectedMapel}
						<div
							class="alert alert-soft alert-info text-xs py-2 px-3 rounded-lg flex items-center justify-between"
						>
							<div class="flex items-center gap-2">
								<Icon name="info" class="h-4 w-4 shrink-0 text-info" />
								<span>
									<strong>Mode Pantau:</strong> Anda melihat rekap nilai mata pelajaran ini.
									Penginputan dan perubahan nilai hanya dapat dilakukan oleh guru pengampu ({selectedMapel.guruNama ||
										'Pengampu'}).
								</span>
							</div>
						</div>
					{/if}

					<!-- GRID MATRIKS SPREADSHEET PENUH -->
					{#key `${selectedMapel.id}-${kelasAktif.id}`}
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
							allowSts={data.showSts}
							canEdit={data.canEditSelectedMapel}
							isAdmin={data.isAdmin}
							daftarKelas={data.daftarKelas}
							kelasNama={kelasAktif.nama}
							onSaved={reloadData}
							onOpenSetup={() => (setupOpen = true)}
						/>
					{/key}
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
			akasBaseUrl={data.akasBaseUrl}
			isAkasMode={data.isAkasMode}
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
				maxFormatif={data.maxFormatif}
				maxSumatif={data.maxSumatif}
				allowSts={data.showSts}
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

<!-- MODAL ATURAN BATAS ASESMEN (ADMIN) -->
{#if data.isAdmin}
	<dialog class="modal" open={adminConfigOpen} onclose={() => (adminConfigOpen = false)}>
		<div class="modal-box max-w-md">
			<div class="flex items-center justify-between pb-3 border-b border-base-200 mb-4">
				<div class="flex items-center gap-2">
					<div class="p-2 rounded-lg bg-primary/10 text-primary">
						<Icon name="gear" />
					</div>
					<div>
						<h3 class="text-base font-bold text-base-content">Aturan Batas Asesmen</h3>
						<p class="text-xs text-base-content/60">
							Pengaturan maksimal kolom rapor sisipan sekolah
						</p>
					</div>
				</div>
				<button
					type="button"
					class="btn btn-sm btn-circle btn-ghost"
					onclick={() => (adminConfigOpen = false)}
				>
					<Icon name="close" />
				</button>
			</div>

			<form onsubmit={handleSaveAdminConfig} class="space-y-4">
				<div class="space-y-3">
					<div
						class="text-xs font-bold uppercase tracking-wider text-primary border-b border-base-200 pb-1"
					>
						1. Batas Maksimal Kolom Asesmen
					</div>
					<div>
						<label class="label text-xs font-semibold text-base-content" for="input-max-formatif">
							Maksimal Kolom Tugas (T1 - Tn)
						</label>
						<input
							id="input-max-formatif"
							type="number"
							min="1"
							max="10"
							class="input input-sm bg-base-200 dark:bg-base-300 w-full font-bold"
							bind:value={adminMaxFormatif}
							required
						/>
						<span class="text-[11px] text-base-content/60 mt-1 block">
							Jumlah kolom tugas harian pada format cetak rapor sisipan (default: 4).
						</span>
					</div>

					<div>
						<label class="label text-xs font-semibold text-base-content" for="input-max-sumatif">
							Maksimal Kolom Formatif (F1 - Fn)
						</label>
						<input
							id="input-max-sumatif"
							type="number"
							min="1"
							max="10"
							class="input input-sm bg-base-200 dark:bg-base-300 w-full font-bold"
							bind:value={adminMaxSumatif}
							required
						/>
						<span class="text-[11px] text-base-content/60 mt-1 block">
							Jumlah kolom asesmen formatif materi sebelum STS pada cetak rapor (default: 3).
						</span>
					</div>
				</div>

				<div class="space-y-3 pt-2">
					<div
						class="text-xs font-bold uppercase tracking-wider text-primary border-b border-base-200 pb-1"
					>
						2. Kebijakan Tampilan Cetak Rapor Sisipan
					</div>
					<div class="space-y-2 text-xs">
						<label
							class="label cursor-pointer justify-start gap-3 p-1 rounded-lg hover:bg-base-200/50"
						>
							<input
								type="checkbox"
								class="checkbox checkbox-sm checkbox-primary"
								bind:checked={adminShowRataTugas}
							/>
							<div>
								<span class="font-semibold text-base-content"
									>Tampilkan Kolom Rata-rata Tugas (Rata T)</span
								>
								<p class="text-[11px] text-base-content/60">
									Sertakan kolom rata-rata tugas harian di lembar rapor.
								</p>
							</div>
						</label>

						<label
							class="label cursor-pointer justify-start gap-3 p-1 rounded-lg hover:bg-base-200/50"
						>
							<input
								type="checkbox"
								class="checkbox checkbox-sm checkbox-primary"
								bind:checked={adminShowRataFormatif}
							/>
							<div>
								<span class="font-semibold text-base-content"
									>Tampilkan Kolom Rata-rata Formatif (Rata F)</span
								>
								<p class="text-[11px] text-base-content/60">
									Sertakan kolom rata-rata nilai formatif materi di lembar rapor.
								</p>
							</div>
						</label>

						<label
							class="label cursor-pointer justify-start gap-3 p-1 rounded-lg hover:bg-base-200/50"
						>
							<input
								type="checkbox"
								class="checkbox checkbox-sm checkbox-primary"
								bind:checked={adminShowSts}
							/>
							<div>
								<span class="font-semibold text-base-content">Tampilkan Kolom Nilai STS</span>
								<p class="text-[11px] text-base-content/60">
									Matikan jika sekolah memiliki kebijakan tidak melaksanakan tes STS.
								</p>
							</div>
						</label>

						<label
							class="label cursor-pointer justify-start gap-3 p-1 rounded-lg hover:bg-base-200/50"
						>
							<input
								type="checkbox"
								class="checkbox checkbox-sm checkbox-primary"
								bind:checked={adminShowNaSts}
							/>
							<div>
								<span class="font-semibold text-base-content"
									>Tampilkan Kolom NA STS (Nilai Akhir)</span
								>
								<p class="text-[11px] text-base-content/60">
									Matikan jika sekolah hanya menghendaki nilai capaian murni tanpa nilai akhir.
								</p>
							</div>
						</label>

						<label
							class="label cursor-pointer justify-start gap-3 p-1 rounded-lg hover:bg-base-200/50"
						>
							<input
								type="checkbox"
								class="checkbox checkbox-sm checkbox-primary"
								bind:checked={adminShowTtdKepala}
							/>
							<div>
								<span class="font-semibold text-base-content"
									>Tampilkan Kolom Tanda Tangan Kepala Sekolah</span
								>
								<p class="text-[11px] text-base-content/60">
									Sertakan kolom tanda tangan Kepala Sekolah di bagian bawah lembar rapor tengah
									semester.
								</p>
							</div>
						</label>
					</div>
				</div>

				<div class="alert alert-info text-xs py-2 px-3 rounded-lg flex items-start gap-2">
					<Icon name="info" />
					<span>
						Kebijakan ini dikunci oleh Administrator dan berlaku untuk seluruh kelas saat mencetak
						rapor sisipan. Jika guru melaksanakan asesmen kurang dari batas maksimal, kolom kosong
						akan otomatis bertanda (<strong>X</strong>).
					</span>
				</div>

				<div class="flex justify-end gap-2 pt-3 border-t border-base-200">
					<button
						type="button"
						class="btn btn-sm btn-ghost"
						onclick={() => (adminConfigOpen = false)}
						disabled={isSavingAdminConfig}
					>
						Batal
					</button>
					<button type="submit" class="btn btn-sm btn-primary" disabled={isSavingAdminConfig}>
						{#if isSavingAdminConfig}
							<span class="loading loading-spinner loading-xs"></span>
						{/if}
						Simpan Aturan
					</button>
				</div>
			</form>
		</div>
		<form method="dialog" class="modal-backdrop">
			<button onclick={() => (adminConfigOpen = false)}>tutup</button>
		</form>
	</dialog>
{/if}

<!-- MODAL SALIN KOMPONEN & NILAI DARI MAPEL LAIN (ADMIN) -->
{#if data.isAdmin && selectedMapel && kelasAktif}
	<CopyMapelModal
		bind:open={copyModalOpen}
		targetKelasId={kelasAktif.id}
		targetKelasNama={kelasAktif.nama}
		targetMapelId={selectedMapel.id}
		targetMapelNama={selectedMapel.nama}
		daftarKelas={data.daftarKelas}
		onSuccess={reloadData}
	/>
{/if}
