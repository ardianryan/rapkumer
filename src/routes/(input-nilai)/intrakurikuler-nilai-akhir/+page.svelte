<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import Icon from '$lib/components/icon.svelte';
	import { toast } from '$lib/components/toast.svelte';
	import { autoSubmit, searchQueryMarker } from '$lib/utils';

	let { data } = $props();

	// State pencarian & bobot
	let searchTerm = $state('');
	// svelte-ignore state_referenced_locally
	let selectedMapelValue = $state(data.selectedMapelValue ?? '');
	// svelte-ignore state_referenced_locally
	let bobotFormatif = $state(data.bobot?.formatif ?? 30);
	// svelte-ignore state_referenced_locally
	let bobotSumatif = $state(data.bobot?.sumatif ?? 70);

	let isSubmitting = $state(false);
	let bobotSaving = $state(false);

	// Modals
	let showBobotModal = $state(false);
	let showAutofillModal = $state(false);

	// State Auto-fill e-Rapor
	let selectedFile: File | null = $state(null);
	let isAutofilling = $state(false);
	let autofillError = $state<string | null>(null);

	// Hitung total bobot
	const totalBobot = $derived(Number(bobotFormatif || 0) + Number(bobotSumatif || 0));
	const isBobotValid = $derived(totalBobot === 100);

	const hasMapel = $derived((data.mapelList?.length ?? 0) > 0);

	const kelasAktifLabel = $derived.by(() => {
		const kelas = page.data.kelasAktif ?? null;
		if (!kelas) return null;
		return kelas.fase ? `${kelas.nama} - ${kelas.fase}` : kelas.nama;
	});

	// Restriksi hak akses wali_asuh
	const canEdit = $derived.by(() => {
		const u = page.data.user as { type?: string } | null | undefined;
		return u?.type !== 'wali_asuh';
	});

	// Sinkronisasi data saat mapel berubah
	$effect(() => {
		selectedMapelValue = data.selectedMapelValue ?? '';
		bobotFormatif = data.bobot?.formatif ?? 30;
		bobotSumatif = data.bobot?.sumatif ?? 70;
	});

	function formatScore(value: number | null | undefined) {
		if (value == null || Number.isNaN(value)) return '—';
		return Number(value).toFixed(2);
	}

	// Daftar siswa dengan preview kalkulasi bobot
	const daftarSiswaProcessed = $derived.by(() => {
		const list = data.daftarSiswa ?? [];
		return list.map((siswa: (typeof list)[number]) => {
			let previewNilai = siswa.nilaiAkhir;

			// Jika belum terkunci, hitung preview live berdasarkan input bobot
			if (!siswa.isLocked) {
				if (siswa.formatifScore == null && siswa.sumatifScore == null) {
					previewNilai = null;
				} else {
					const fVal = siswa.formatifScore ?? siswa.sumatifScore ?? 0;
					const sVal = siswa.sumatifScore ?? siswa.formatifScore ?? 0;
					if (totalBobot > 0) {
						previewNilai =
							Math.round(((fVal * bobotFormatif + sVal * bobotSumatif) / totalBobot) * 100) / 100;
					}
				}
			}

			return {
				...siswa,
				previewNilai
			};
		});
	});

	// Filter pencarian
	const filteredSiswa = $derived.by(() => {
		const term = searchTerm.trim().toLowerCase();
		if (!term) return daftarSiswaProcessed;
		return daftarSiswaProcessed.filter(
			(s: (typeof daftarSiswaProcessed)[number]) =>
				s.nama.toLowerCase().includes(term) || (s.nisn && s.nisn.includes(term))
		);
	});

	// Payload untuk generate & kunci
	const generatePayload = $derived.by(() => {
		return JSON.stringify(
			daftarSiswaProcessed.map((s: (typeof daftarSiswaProcessed)[number]) => ({
				muridId: s.muridId,
				mapelId: s.mapelId,
				formatifScore: s.formatifScore,
				sumatifScore: s.sumatifScore,
				nilaiAkhir: s.previewNilai ?? 0,
				capaianTp: {
					optimal: s.tpOptimal,
					perluPeningkatan: s.tpPerluPeningkatan
				}
			}))
		);
	});

	// Handler upload & autofill e-Rapor
	async function handleAutofillSubmit(e: Event) {
		e.preventDefault();
		if (!selectedFile) {
			toast('Pilih file Excel template e-Rapor SMA terlebih dahulu.', 'error');
			return;
		}

		isAutofilling = true;
		autofillError = null;

		try {
			const formData = new FormData();
			formData.append('file', selectedFile);
			if (data.selectedMapelId) {
				formData.append('mapelId', String(data.selectedMapelId));
			}

			const res = await fetch('/api/erapor-sma/autofill', {
				method: 'POST',
				body: formData
			});

			if (!res.ok) {
				const errJson = await res.json().catch(() => ({}));
				throw new Error(errJson.error || 'Gagal memproses autofill template e-Rapor.');
			}

			const blob = await res.blob();
			const downloadUrl = window.URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = downloadUrl;

			// Dapatkan nama file dari header
			const disposition = res.headers.get('Content-Disposition');
			let filename = `${selectedFile.name.replace(/\.[^/.]+$/, '')}_terisi.xlsx`;
			if (disposition && disposition.includes('filename=')) {
				const match = disposition.match(/filename="?([^"]+)"?/);
				if (match && match[1]) filename = match[1];
			}

			link.download = filename;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			window.URL.revokeObjectURL(downloadUrl);

			showAutofillModal = false;
			selectedFile = null;
			toast('File template e-Rapor SMA berhasil diisi dan diunduh!', 'success');
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			autofillError = msg;
			toast(msg, 'error');
		} finally {
			isAutofilling = false;
		}
	}
</script>

<div class="card bg-base-100 cursor-default rounded-lg border-none p-4 shadow-md">
	<!-- Top Header Section -->
	<div class="mb-4 flex flex-wrap items-center justify-between gap-2">
		<div>
			<h2 class="text-xl font-bold">
				Daftar Nilai Akhir
				{#if data.targetMapelNama}
					- {data.targetMapelNama}
				{/if}
			</h2>

			{#if kelasAktifLabel}
				<p class="text-base-content/70 text-sm">Kelas aktif: {kelasAktifLabel}</p>
			{:else}
				<p class="text-base-content/60 text-sm">
					Pilih kelas di navbar untuk melihat mata pelajaran intrakurikuler.
				</p>
			{/if}
		</div>

		<div class="flex items-center gap-2 max-sm:w-full">
			<button
				type="button"
				class="btn btn-soft shadow-none max-sm:flex-1"
				onclick={() => (showBobotModal = true)}
				disabled={!canEdit || !hasMapel}
				title={!canEdit ? 'Anda tidak memiliki izin' : ''}
			>
				<Icon name="gear" />
				Atur Bobot
			</button>

			{#if data.isLocked}
				<form
					action="?/bukaKunci"
					method="POST"
					use:enhance={() => {
						isSubmitting = true;
						return async ({ result, update }) => {
							isSubmitting = false;
							await update();
							if (result.type === 'success') {
								toast('Kunci nilai akhir berhasil dibuka.', 'info');
							}
						};
					}}
				>
					<input type="hidden" name="mapelId" value={data.selectedMapelId ?? ''} />
					<input type="hidden" name="mapelIds" value={data.distinctMapelIds?.join(',') ?? ''} />
					<button
						type="submit"
						class="btn btn-soft btn-warning shadow-none"
						disabled={isSubmitting || !canEdit}
					>
						<Icon name="lock" />
						Buka Kunci
					</button>
				</form>
			{:else}
				<form
					action="?/generateDanKunci"
					method="POST"
					use:enhance={() => {
						isSubmitting = true;
						return async ({ result, update }) => {
							isSubmitting = false;
							await update();
							if (result.type === 'success') {
								toast('Nilai akhir berhasil dihitung dan dikunci.', 'success');
							}
						};
					}}
				>
					<input type="hidden" name="selectedMapelValue" value={selectedMapelValue} />
					<input type="hidden" name="bobotFormatif" value={bobotFormatif} />
					<input type="hidden" name="bobotSumatif" value={bobotSumatif} />
					<input type="hidden" name="payload" value={generatePayload} />
					<button
						type="submit"
						class="btn btn-soft btn-primary shadow-none"
						disabled={isSubmitting || !isBobotValid || !filteredSiswa.length || !canEdit}
						title={!isBobotValid ? 'Total bobot harus tepat 100%' : ''}
					>
						<Icon name="save" />
						Generate & Kunci
					</button>
				</form>
			{/if}

			<button
				type="button"
				class="btn btn-soft shadow-none max-sm:flex-1"
				onclick={() => (showAutofillModal = true)}
				disabled={!data.isLocked}
				title={!data.isLocked ? 'Kunci nilai akhir terlebih dahulu untuk auto-fill e-Rapor' : ''}
			>
				<Icon name="export" />
				Auto-Fill e-Rapor
			</button>
		</div>
	</div>

	<!-- Filter & Status Bar -->
	<div class="flex flex-col justify-between gap-2 sm:flex-row sm:flex-wrap">
		<form class="w-full sm:max-w-80 md:max-w-80" method="get" use:autoSubmit>
			<select
				class="select bg-base-200 w-full truncate dark:border-none"
				title="Pilih mata pelajaran"
				name="mapel_id"
				bind:value={selectedMapelValue}
				disabled={!hasMapel}
			>
				{#if !hasMapel}
					<option value="">Belum ada mata pelajaran</option>
				{:else}
					<option value="" disabled selected={selectedMapelValue === ''}>
						Pilih Mata Pelajaran
					</option>
					{#each data.mapelList as mapel (mapel.value)}
						<option value={mapel.value}>{mapel.nama}</option>
					{/each}
				{/if}
			</select>
			{#if searchTerm.trim().length}
				<input type="hidden" name="q" value={searchTerm.trim()} />
			{/if}
		</form>

		<div class="flex items-center gap-2">
			{#if data.isLocked}
				<span class="badge badge-soft badge-success gap-1.5 py-3 px-3">
					<Icon name="check" /> Terkunci (Bobot F: {data.bobot?.formatif}%, S: {data.bobot
						?.sumatif}%)
				</span>
			{:else}
				<span
					class="badge badge-soft badge-warning text-amber-900 dark:text-amber-200 gap-1.5 py-3 px-3 font-medium"
				>
					<Icon name="alert" /> Belum Dikunci (Draft Bobot F: {bobotFormatif}%, S: {bobotSumatif}%)
				</span>
			{/if}
		</div>
	</div>

	<!-- Search Input -->
	<form
		class="mt-2 w-full"
		data-sveltekit-keepfocus
		data-sveltekit-replacestate
		onsubmit={(e) => e.preventDefault()}
	>
		<label class="input bg-base-200 dark:bg-base-300 w-full dark:border-none">
			<Icon name="search" />
			<input
				type="search"
				name="q"
				bind:value={searchTerm}
				spellcheck="false"
				autocomplete="name"
				placeholder="Cari nama murid atau NISN..."
			/>
		</label>
	</form>

	<!-- Table or Alert States -->
	{#if !hasMapel}
		<div class="alert alert-soft alert-info mt-6">
			<Icon name="info" />
			<span>
				Belum ada mata pelajaran intrakurikuler untuk kelas ini. Tambahkan terlebih dahulu di menu
				<strong>Intrakurikuler</strong>.
			</span>
		</div>
	{:else if !filteredSiswa.length}
		<div class="alert alert-soft alert-warning mt-6">
			<Icon name="alert" />
			<span>
				{#if searchTerm}
					Tidak ditemukan murid dengan kata kunci <strong>"{searchTerm}"</strong>. Coba gunakan nama
					lain atau bersihkan pencarian.
				{:else}
					Belum ada data murid untuk kelas ini. Silakan tambah murid di menu <strong>Murid</strong>.
				{/if}
			</span>
		</div>
	{:else}
		<div
			class="bg-base-100 dark:bg-base-200 mt-4 overflow-x-auto rounded-md shadow-md dark:shadow-none"
		>
			<table class="border-base-200 table min-w-140 border dark:border-none">
				<thead>
					<tr class="bg-base-200 dark:bg-base-300 text-base-content text-left font-bold">
						<th style="width: 50px; min-width: 40px;">No</th>
						<th class="min-w-48">Nama</th>
						<th class="min-w-28 text-center">Formatif</th>
						<th class="min-w-28 text-center">Sumatif</th>
						<th class="min-w-32 text-center">Nilai Akhir (NA)</th>
						<th class="min-w-64">Capaian Kompetensi Tertinggi (T)</th>
						<th class="min-w-64">Capaian Kompetensi Terendah (R)</th>
						<th class="min-w-24 text-center">Status</th>
					</tr>
				</thead>
				<tbody>
					{#each filteredSiswa as siswa (siswa.muridId)}
						<tr>
							<td>{siswa.no}</td>
							<td>
								{@html searchQueryMarker(searchTerm, siswa.nama)}
								{#if siswa.nisn}
									<div class="text-[11px] font-normal opacity-70">NISN: {siswa.nisn}</div>
								{/if}
								{#if siswa.agamaLabel}
									<div class="text-[11px] font-normal opacity-70">{siswa.agamaLabel}</div>
								{/if}
							</td>
							<td class="text-center font-semibold">
								{formatScore(siswa.formatifScore)}
							</td>
							<td class="text-center font-semibold">
								{formatScore(siswa.sumatifScore)}
							</td>
							<td class="text-center">
								{#if siswa.previewNilai != null}
									<span
										class="font-bold text-base {siswa.isLocked
											? 'text-primary'
											: 'text-base-content'}"
									>
										{formatScore(siswa.previewNilai)}
									</span>
								{:else}
									<span class="text-base-content/40 font-normal">—</span>
								{/if}
							</td>
							<td class="text-xs max-w-xs">
								{#if siswa.tpOptimal}
									<span class="badge badge-soft badge-success badge-xs font-semibold mr-1">T</span>
									<span>{siswa.tpOptimal}</span>
								{:else}
									<span class="text-base-content/40">—</span>
								{/if}
							</td>
							<td class="text-xs max-w-xs">
								{#if siswa.tpPerluPeningkatan}
									<span
										class="badge badge-soft badge-warning text-amber-900 dark:text-amber-200 badge-xs font-semibold mr-1"
										>R</span
									>
									<span>{siswa.tpPerluPeningkatan}</span>
								{:else}
									<span class="text-base-content/40">—</span>
								{/if}
							</td>
							<td class="text-center">
								{#if siswa.isLocked}
									<span class="badge badge-soft badge-success badge-sm font-medium">Terkunci</span>
								{:else}
									<span class="badge badge-soft badge-neutral badge-sm font-medium">Draft</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<!-- MODAL: ATUR BOBOT -->
<input
	id="nilai-akhir-bobot-modal"
	type="checkbox"
	class="modal-toggle"
	bind:checked={showBobotModal}
	hidden
/>
<div
	class="modal"
	aria-hidden={!showBobotModal}
	onclick={(e) => {
		if (e.target === e.currentTarget && !bobotSaving) showBobotModal = false;
	}}
>
	<div class="modal-box max-w-lg">
		<h3 class="text-lg font-bold">Atur Bobot Nilai Akhir</h3>
		<p class="text-base-content/70 text-sm">
			Tentukan proporsi kontribusi nilai Formatif dan Sumatif untuk mata pelajaran <strong
				>{data.targetMapelNama || 'ini'}</strong
			>.
		</p>

		<form
			action="?/simpanBobot"
			method="POST"
			class="mt-4 grid grid-cols-1 gap-3"
			use:enhance={() => {
				bobotSaving = true;
				return async ({ result, update }) => {
					bobotSaving = false;
					await update();
					if (result.type === 'success') {
						showBobotModal = false;
						toast('Bobot nilai akhir berhasil disimpan.', 'success');
					} else if (result.type === 'failure') {
						toast(String(result.data?.message ?? 'Gagal menyimpan bobot.'), 'error');
					}
				};
			}}
		>
			<input type="hidden" name="mapelId" value={data.selectedMapelId ?? ''} />
			<fieldset class="fieldset">
				<legend class="fieldset-legend font-semibold">Bobot Formatif (%)</legend>
				<input
					type="number"
					name="formatif"
					min="0"
					max="100"
					class="input bg-base-200 dark:bg-base-300 w-full dark:border-none"
					bind:value={bobotFormatif}
					disabled={bobotSaving}
				/>
			</fieldset>
			<fieldset class="fieldset">
				<legend class="fieldset-legend font-semibold">Bobot Sumatif (%)</legend>
				<input
					type="number"
					name="sumatif"
					min="0"
					max="100"
					class="input bg-base-200 dark:bg-base-300 w-full dark:border-none"
					bind:value={bobotSumatif}
					disabled={bobotSaving}
				/>
			</fieldset>

			<div class="flex items-center justify-between pt-1 text-sm">
				<span class="text-base-content/70">
					Total Bobot: <strong class={isBobotValid ? 'text-success' : 'text-error'}
						>{totalBobot}%</strong
					>
				</span>
				{#if !isBobotValid}
					<span class="text-xs font-semibold text-error">Harus berjumlah tepat 100%</span>
				{/if}
			</div>

			<div class="modal-action mt-6 flex justify-end gap-2">
				<button
					type="button"
					class="btn btn-ghost"
					onclick={() => (showBobotModal = false)}
					disabled={bobotSaving}
				>
					Batal
				</button>
				<button type="submit" class="btn btn-primary" disabled={!isBobotValid || bobotSaving}>
					{#if bobotSaving}
						<span class="loading loading-spinner loading-xs"></span>
					{/if}
					Simpan Bobot
				</button>
			</div>
		</form>
	</div>
</div>

<!-- MODAL: AUTO-FILL E-RAPOR SMA -->
<input
	id="autofill-modal"
	type="checkbox"
	class="modal-toggle"
	bind:checked={showAutofillModal}
	hidden
/>
<div
	class="modal"
	aria-hidden={!showAutofillModal}
	onclick={(e) => {
		if (e.target === e.currentTarget && !isAutofilling) showAutofillModal = false;
	}}
>
	<div class="modal-box max-w-lg">
		<h3 class="text-lg font-bold">Auto-Fill Format e-Rapor SMA</h3>
		<p class="text-base-content/70 text-sm">
			Unggah file template kosongan dari aplikasi e-Rapor SMA (<code
				class="text-primary font-mono text-xs">f_nilai_...xlsx</code
			>). Sistem Rapkumer akan otomatis menyuntikkan Nilai Akhir yang terkunci beserta status
			capaian TP.
		</p>

		<form onsubmit={handleAutofillSubmit} class="mt-4 space-y-4">
			<fieldset class="fieldset">
				<legend class="fieldset-legend font-semibold"
					>Pilih File Template e-Rapor SMA (.xlsx)</legend
				>
				<input
					type="file"
					accept=".xlsx"
					class="file-input bg-base-200 dark:bg-base-300 w-full dark:border-none"
					disabled={isAutofilling}
					onchange={(e) => {
						const target = e.target as HTMLInputElement;
						if (target.files && target.files.length > 0) {
							selectedFile = target.files[0];
						}
					}}
				/>
			</fieldset>

			{#if autofillError}
				<div class="alert alert-soft alert-error text-xs">
					<Icon name="error" />
					<span>{autofillError}</span>
				</div>
			{/if}

			<div class="modal-action mt-6 flex justify-end gap-2">
				<button
					type="button"
					class="btn btn-ghost"
					onclick={() => (showAutofillModal = false)}
					disabled={isAutofilling}
				>
					Batal
				</button>
				<button
					type="submit"
					class="btn btn-primary gap-2"
					disabled={!selectedFile || isAutofilling}
				>
					{#if isAutofilling}
						<span class="loading loading-spinner loading-xs"></span>
						<span>Memproses...</span>
					{:else}
						<Icon name="download" />
						<span>Isi & Unduh Excel</span>
					{/if}
				</button>
			</div>
		</form>
	</div>
</div>
