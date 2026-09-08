<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import Icon from '$lib/components/icon.svelte';
	import { toast } from '$lib/components/toast.svelte';

	let { data } = $props();

	// State pencarian & bobot
	let searchTerm = $state('');
	// svelte-ignore state_referenced_locally
	let bobotFormatif = $state(data.bobot?.formatif ?? 30);
	// svelte-ignore state_referenced_locally
	let bobotSumatif = $state(data.bobot?.sumatif ?? 70);
	let isSubmitting = $state(false);

	// State Auto-fill e-Rapor
	let selectedFile: File | null = $state(null);
	let isAutofilling = $state(false);
	let autofillError = $state<string | null>(null);

	// Hitung total bobot
	const totalBobot = $derived(Number(bobotFormatif || 0) + Number(bobotSumatif || 0));
	const isBobotValid = $derived(totalBobot === 100);

	// Sinkronisasi data saat mapel berubah
	$effect(() => {
		bobotFormatif = data.bobot?.formatif ?? 30;
		bobotSumatif = data.bobot?.sumatif ?? 70;
	});

	// Daftar siswa dengan preview kalkulasi bobot
	const daftarSiswaProcessed = $derived.by(() => {
		const list = data.daftarSiswa ?? [];
		return list.map((siswa: (typeof list)[number]) => {
			let previewNilai = siswa.nilaiAkhir;

			// Jika belum terkunci, hitung preview live berdasarkan input bobot
			if (!siswa.isLocked) {
				const fVal = siswa.formatifScore ?? siswa.sumatifScore ?? 0;
				const sVal = siswa.sumatifScore ?? siswa.formatifScore ?? 0;
				if (totalBobot > 0) {
					previewNilai =
						Math.round(((fVal * bobotFormatif + sVal * bobotSumatif) / totalBobot) * 100) / 100;
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

	// Handler ganti mapel
	function onSelectMapel(e: Event) {
		const select = e.target as HTMLSelectElement;
		const val = select.value;
		if (val) {
			goto(`?mapel_id=${val}`, { keepFocus: true, noScroll: true });
		}
	}

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

<div class="space-y-6 pb-12">
	<!-- Header Section -->
	<div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
		<div>
			<h1 class="text-2xl font-bold tracking-tight text-base-content">
				Nilai Akhir Intrakurikuler
			</h1>
			<p class="text-sm text-base-content/70">
				Kalkulasi nilai gabungan Formatif & Sumatif berbobot, penguncian resmi, dan Smart Auto-Fill
				ke e-Rapor SMA.
			</p>
		</div>

		<!-- Status Badge -->
		{#if data.isLocked}
			<div class="badge badge-success gap-2 py-3.5 px-4 font-semibold shadow-sm">
				<Icon name="check" class="size-4" />
				<span>Nilai Akhir Terkunci</span>
			</div>
		{:else}
			<div class="badge badge-warning gap-2 py-3.5 px-4 font-semibold shadow-sm">
				<Icon name="alert" class="size-4" />
				<span>Belum Dikunci (Draft)</span>
			</div>
		{/if}
	</div>

	<!-- Filter & Selector Bar -->
	<div class="card bg-base-100 shadow-sm border border-base-200">
		<div class="card-body p-4 md:p-6">
			<div class="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
				<!-- Mapel Dropdown -->
				<div class="flex flex-col sm:flex-row sm:items-center gap-2 flex-1 max-w-xl">
					<label for="select-mapel" class="text-sm font-semibold shrink-0 text-base-content/80">
						Pilih Mata Pelajaran:
					</label>
					<select
						id="select-mapel"
						class="select select-bordered w-full font-medium"
						value={data.selectedMapelValue}
						onchange={onSelectMapel}
					>
						{#if !data.mapelList?.length}
							<option value="">Belum ada mata pelajaran</option>
						{:else}
							{#each data.mapelList as mapel (mapel.value)}
								<option value={mapel.value}>{mapel.nama}</option>
							{/each}
						{/if}
					</select>
				</div>

				<!-- Search Filter -->
				<div class="relative min-w-[240px]">
					<input
						type="search"
						placeholder="Cari nama atau NISN..."
						class="input input-bordered w-full pl-9"
						bind:value={searchTerm}
					/>
					<span
						class="absolute inset-y-0 left-3 flex items-center pointer-events-none text-base-content/50"
					>
						<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
							/>
						</svg>
					</span>
				</div>
			</div>
		</div>
	</div>

	<!-- Grid Aksi 2-Tahap -->
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
		<!-- KARTU TAHAP 1: Konfigurasi Bobot & Kunci Nilai -->
		<div class="card bg-base-100 shadow-sm border border-base-200">
			<div class="card-body p-5 md:p-6 flex flex-col justify-between">
				<div>
					<div class="flex items-center gap-2 mb-2">
						<span class="badge badge-primary font-bold">Tahap 1</span>
						<h2 class="font-bold text-lg text-base-content">Konfigurasi Bobot & Kunci Nilai</h2>
					</div>
					<p class="text-xs text-base-content/70 mb-4">
						Tentukan persentase kontribusi Formatif dan Sumatif. Klik Generate untuk mengunci nilai
						akhir resmi ke database.
					</p>

					<!-- Form Bobot -->
					<div
						class="grid grid-cols-2 gap-4 bg-base-200/50 p-4 rounded-xl border border-base-200 mb-4"
					>
						<div>
							<label
								for="bobot-formatif-input"
								class="label p-0 pb-1 text-xs font-semibold text-base-content/80"
							>
								Bobot Formatif (%)
							</label>
							<input
								id="bobot-formatif-input"
								type="number"
								min="0"
								max="100"
								class="input input-bordered input-sm w-full font-bold"
								bind:value={bobotFormatif}
							/>
						</div>
						<div>
							<label
								for="bobot-sumatif-input"
								class="label p-0 pb-1 text-xs font-semibold text-base-content/80"
							>
								Bobot Sumatif (%)
							</label>
							<input
								id="bobot-sumatif-input"
								type="number"
								min="0"
								max="100"
								class="input input-bordered input-sm w-full font-bold"
								bind:value={bobotSumatif}
							/>
						</div>
						<div class="col-span-2 flex items-center justify-between pt-1">
							<span class="text-xs text-base-content/70">
								Total Bobot: <span
									class="font-bold"
									class:text-error={!isBobotValid}
									class:text-success={isBobotValid}>{totalBobot}%</span
								>
							</span>
							{#if !isBobotValid}
								<span class="text-xs text-error font-medium">Harus berjumlah tepat 100%</span>
							{/if}
						</div>
					</div>
				</div>

				<!-- Tombol Aksi Kunci / Buka Kunci -->
				<div class="flex items-center gap-3 pt-2">
					<form
						action="?/generateDanKunci"
						method="POST"
						use:enhance={() => {
							isSubmitting = true;
							return async ({ result, update }) => {
								isSubmitting = false;
								if (result.type === 'success') {
									toast('Nilai akhir berhasil di-generate dan dikunci ke database!', 'success');
								}
								await update();
							};
						}}
						class="flex-1"
					>
						<input type="hidden" name="selectedMapelValue" value={data.selectedMapelValue} />
						<input type="hidden" name="bobotFormatif" value={bobotFormatif} />
						<input type="hidden" name="bobotSumatif" value={bobotSumatif} />
						<input type="hidden" name="payload" value={generatePayload} />

						<button
							type="submit"
							class="btn btn-primary w-full gap-2 shadow-sm"
							disabled={!isBobotValid || isSubmitting || !data.daftarSiswa?.length}
						>
							<Icon name="save" class="size-4" />
							<span>{isSubmitting ? 'Mengunci...' : 'Generate & Kunci Nilai Akhir'}</span>
						</button>
					</form>

					{#if data.isLocked}
						<form
							action="?/bukaKunci"
							method="POST"
							use:enhance={() => {
								return async ({ update }) => {
									toast('Kunci nilai dibuka.', 'info');
									await update();
								};
							}}
						>
							<input type="hidden" name="mapelId" value={data.selectedMapelId} />
							<button
								type="submit"
								class="btn btn-ghost border-base-300 text-error hover:bg-error/10 gap-1.5"
								title="Buka kunci nilai untuk diedit ulang"
							>
								<span>Buka Kunci</span>
							</button>
						</form>
					{/if}
				</div>
			</div>
		</div>

		<!-- KARTU TAHAP 2: Auto-Fill Format e-Rapor SMA -->
		<div
			class="card bg-base-100 shadow-sm border border-base-200"
			class:opacity-60={!data.isLocked}
		>
			<div class="card-body p-5 md:p-6 flex flex-col justify-between">
				<div>
					<div class="flex items-center gap-2 mb-2">
						<span class="badge badge-secondary font-bold">Tahap 2</span>
						<h2 class="font-bold text-lg text-base-content">Auto-Fill Format e-Rapor SMA</h2>
					</div>
					<p class="text-xs text-base-content/70 mb-4">
						Unggah file template kosongan dari e-Rapor SMA (<code
							class="text-primary font-mono text-[11px]">f_nilai_...xlsx</code
						>). Sistem akan menyuntikkan nilai terkunci beserta status TP Valid.
					</p>

					<!-- File Dropzone -->
					<form onsubmit={handleAutofillSubmit} class="space-y-4">
						<div
							class="border-2 border-dashed border-base-300 hover:border-primary rounded-xl p-4 text-center transition-colors bg-base-200/30"
						>
							<input
								id="erapor-file"
								type="file"
								accept=".xlsx"
								class="file-input file-input-bordered file-input-sm w-full max-w-xs"
								disabled={!data.isLocked || isAutofilling}
								onchange={(e) => {
									const target = e.target as HTMLInputElement;
									if (target.files && target.files.length > 0) {
										selectedFile = target.files[0];
									}
								}}
							/>
							<div class="text-[11px] text-base-content/60 mt-2">
								Format template resmi e-Rapor SMA Kemendikdasmen (.xlsx)
							</div>
						</div>

						{#if autofillError}
							<div class="alert alert-error text-xs py-2">
								<span>{autofillError}</span>
							</div>
						{/if}

						<button
							type="submit"
							class="btn btn-secondary w-full gap-2 shadow-sm"
							disabled={!data.isLocked || !selectedFile || isAutofilling}
						>
							{#if isAutofilling}
								<span class="loading loading-spinner loading-xs"></span>
								<span>Memproses Auto-Fill...</span>
							{:else}
								<Icon name="download" class="size-4" />
								<span>Auto-Fill & Unduh Template e-Rapor</span>
							{/if}
						</button>
					</form>
				</div>

				<div class="text-[11px] text-base-content/60 pt-2 flex items-center gap-1">
					<Icon name="check" class="size-3.5 text-success inline" />
					<span>Hasil unduhan 100% valid dan langsung dapat diunggah ke e-Rapor SMA.</span>
				</div>
			</div>
		</div>
	</div>

	<!-- Tabel Rincian Nilai Siswa -->
	<div class="card bg-base-100 shadow-sm border border-base-200">
		<div
			class="card-header p-4 md:p-5 border-b border-base-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
		>
			<div>
				<h3 class="font-bold text-base text-base-content">Daftar Nilai Akhir Siswa</h3>
				<p class="text-xs text-base-content/60">
					Menampilkan {filteredSiswa.length} siswa • Mata Pelajaran:
					<span class="font-semibold text-primary">{data.targetMapelNama || '-'}</span>
				</p>
			</div>
		</div>

		<div class="overflow-x-auto">
			<table class="table table-sm md:table-md w-full">
				<thead>
					<tr class="bg-base-200/50 text-base-content/70">
						<th class="w-12 text-center">No</th>
						<th>NISN</th>
						<th>Nama Siswa</th>
						<th class="text-center">Skor Formatif</th>
						<th class="text-center">Skor Sumatif</th>
						<th class="text-center font-bold text-primary">Nilai Akhir (NA)</th>
						<th>Capaian Tertinggi (Optimal 'T')</th>
						<th>Capaian Terendah (Perlu Peningkatan 'R')</th>
					</tr>
				</thead>
				<tbody>
					{#if !filteredSiswa.length}
						<tr>
							<td colspan="8" class="text-center py-8 text-base-content/50">
								Tidak ada data siswa ditemukan.
							</td>
						</tr>
					{:else}
						{#each filteredSiswa as siswa (siswa.muridId)}
							<tr class="hover:bg-base-200/30 transition-colors">
								<td class="text-center font-mono text-xs">{siswa.no}</td>
								<td class="font-mono text-xs text-base-content/80">{siswa.nisn || '-'}</td>
								<td>
									<div class="font-semibold text-sm text-base-content">{siswa.nama}</div>
									{#if siswa.agamaLabel}
										<span class="text-[10px] text-base-content/50">{siswa.agamaLabel}</span>
									{/if}
								</td>
								<td class="text-center font-mono">
									{siswa.formatifScore != null ? siswa.formatifScore : '—'}
								</td>
								<td class="text-center font-mono">
									{siswa.sumatifScore != null ? siswa.sumatifScore : '—'}
								</td>
								<td
									class="text-center font-mono font-bold text-base"
									class:text-primary={siswa.isLocked}
									class:text-warning={!siswa.isLocked}
								>
									{siswa.previewNilai != null ? siswa.previewNilai : '—'}
								</td>
								<td
									class="text-xs text-base-content/80 max-w-xs truncate"
									title={siswa.tpOptimal ?? '-'}
								>
									{#if siswa.tpOptimal}
										<span
											class="badge badge-success/15 text-success border-success/30 badge-xs font-semibold mr-1"
											>T</span
										>
										<span>{siswa.tpOptimal}</span>
									{:else}
										<span class="text-base-content/40">—</span>
									{/if}
								</td>
								<td
									class="text-xs text-base-content/80 max-w-xs truncate"
									title={siswa.tpPerluPeningkatan ?? '-'}
								>
									{#if siswa.tpPerluPeningkatan}
										<span
											class="badge badge-warning/15 text-warning border-warning/30 badge-xs font-semibold mr-1"
											>R</span
										>
										<span>{siswa.tpPerluPeningkatan}</span>
									{:else}
										<span class="text-base-content/40">—</span>
									{/if}
								</td>
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>
	</div>
</div>
