<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- file uses internal navigation and modal links */
	import { goto, invalidate } from '$app/navigation';
	import { enhance } from '$app/forms';
	import Icon from '$lib/components/icon.svelte';
	import { toast } from '$lib/components/toast.svelte';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	let selectedMapel = $state(data.selectedMapelNama ?? '');
	let filterJenjang = $state('semua');
	let isSaving = $state(false);
	let isDistributingTp = $state(false);
	let tpDistributeModalOpen = $state(false);
	let tpSourceMapelId = $state<number | null>(null);
	let tpDistributeMode = $state<'replace' | 'merge'>('replace');

	// Bulk fill state
	let bulkKode = $state('');
	let bulkKkm = $state<number | ''>('');
	let bulkJenis = $state<'wajib' | 'pilihan' | 'mulok' | ''>('');

	// Local copy of rows for inline editing
	let rows = $state<
		Array<{
			mapelId: number;
			kelasId: number;
			namaKelas: string;
			jenjang: string;
			jenis: string;
			kode: string;
			kkm: number;
			pengampuId: number | null;
			pengampuNama: string;
			totalTp: number;
		}>
	>([]);

	// Sync local rows when data changes
	$effect(() => {
		rows = (data.kelasRows ?? []).map((r) => ({ ...r }));
		selectedMapel = data.selectedMapelNama ?? '';
	});

	const displayedRows = $derived.by(() => {
		if (filterJenjang === 'semua') return rows;
		return rows.filter((r) => r.jenjang === filterJenjang);
	});

	const jenjangList = $derived.by(() => {
		const set = new Set<string>();
		for (const r of rows) {
			if (r.jenjang) set.add(r.jenjang);
		}
		return Array.from(set).sort();
	});

	function handleMapelChange(e: Event) {
		const select = e.currentTarget as HTMLSelectElement;
		const mapel = select.value;
		selectedMapel = mapel;
		goto(`/intrakurikuler/distribusi?mapel=${encodeURIComponent(mapel)}`);
	}

	function applyBulkSettings() {
		for (const r of displayedRows) {
			if (bulkKode) r.kode = bulkKode;
			if (typeof bulkKkm === 'number' && Number.isFinite(bulkKkm)) r.kkm = bulkKkm;
			if (bulkJenis) r.jenis = bulkJenis;
		}
		toast({
			message: `Pengaturan diterapkan ke ${displayedRows.length} kelas yang tampil. Klik "Simpan Perubahan" untuk menyimpan permanen.`,
			type: 'info'
		});
	}

	const sourceRowForTp = $derived.by(() => {
		if (!tpSourceMapelId) return null;
		return rows.find((r) => r.mapelId === tpSourceMapelId) ?? null;
	});
</script>

<div class="card bg-base-100 rounded-box border border-none p-4 shadow-md">
	<!-- Tab Switch Header -->
	<div
		class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-base-200 pb-4"
	>
		<div>
			<h2 class="text-xl font-bold">Pengelolaan Pembelajaran Terpadu</h2>
			<p class="text-base-content/70 text-sm">
				Distribusi guru pengampu, kode singkat, KKM, dan Tujuan Pembelajaran se-sekolah
			</p>
		</div>

		<!-- Navigasi Tab -->
		<div class="tabs tabs-boxed bg-base-200/80 p-1">
			<a class="tab text-xs sm:text-sm" href="/intrakurikuler"> 📋 Per Rombel Aktif </a>
			<a class="tab tab-active text-xs sm:text-sm font-semibold" href="/intrakurikuler/distribusi">
				🌐 Per Mata Pelajaran (Gaya AIO)
			</a>
		</div>
	</div>

	<!-- Filter Pemilih Mata Pelajaran -->
	<div class="rounded-2xl border border-base-300 bg-base-200/40 p-4 space-y-3">
		<div class="flex flex-col sm:flex-row sm:items-center gap-3">
			<label
				for="select-mapel-distribusi"
				class="text-sm font-bold min-w-36 flex items-center gap-2"
			>
				<Icon name="book" class="text-primary h-4 w-4" />
				Mata Pelajaran:
			</label>
			<select
				id="select-mapel-distribusi"
				class="select select-bordered bg-base-100 w-full sm:max-w-md font-semibold text-sm shadow-sm"
				value={selectedMapel}
				onchange={handleMapelChange}
			>
				<option value="" disabled>Pilih Mata Pelajaran...</option>
				{#each data.mapelList as m (m)}
					<option value={m}>{m}</option>
				{/each}
			</select>

			{#if jenjangList.length > 1}
				<div class="flex items-center gap-1 overflow-x-auto sm:ml-auto">
					<span class="text-xs text-base-content/60 mr-1">Tingkat:</span>
					<button
						type="button"
						class="btn btn-xs {filterJenjang === 'semua' ? 'btn-primary' : 'btn-ghost'}"
						onclick={() => (filterJenjang = 'semua')}
					>
						Semua
					</button>
					{#each jenjangList as j (j)}
						<button
							type="button"
							class="btn btn-xs {filterJenjang === j ? 'btn-primary' : 'btn-ghost'}"
							onclick={() => (filterJenjang = j)}
						>
							Kelas {j}
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Bilah Aksi Cepat (Bulk Action Toolbar) -->
		{#if rows.length > 0}
			<div
				class="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-base-300/60 text-xs"
			>
				<div class="flex flex-wrap items-center gap-2">
					<span class="font-bold text-base-content/70">Atur Massal:</span>
					<input
						type="text"
						placeholder="Kode Singkat (cth: MAT)"
						bind:value={bulkKode}
						class="input input-xs input-bordered w-36 bg-base-100 uppercase"
					/>
					<input
						type="number"
						placeholder="KKM (cth: 75)"
						bind:value={bulkKkm}
						class="input input-xs input-bordered w-24 bg-base-100"
						min="0"
					/>
					<select bind:value={bulkJenis} class="select select-xs select-bordered bg-base-100">
						<option value="">Jenis Mapel...</option>
						<option value="wajib">Wajib</option>
						<option value="pilihan">Pilihan</option>
						<option value="mulok">Muatan Lokal</option>
					</select>
					<button
						type="button"
						class="btn btn-xs btn-outline btn-primary gap-1"
						onclick={applyBulkSettings}
					>
						<Icon name="check" class="h-3 w-3" />
						Terapkan ke Baris Tampil
					</button>
				</div>

				<div class="flex items-center gap-2">
					<button
						type="button"
						class="btn btn-xs btn-soft btn-secondary gap-1"
						onclick={() => {
							if (rows.length > 0) {
								tpSourceMapelId = rows.find((r) => r.totalTp > 0)?.mapelId ?? rows[0].mapelId;
								tpDistributeModalOpen = true;
							}
						}}
					>
						<Icon name="copy" class="h-3 w-3" />
						Distribusi TP Massal
					</button>
				</div>
			</div>
		{/if}
	</div>

	<!-- Tabel Matriks Pembelajaran -->
	{#if !selectedMapel}
		<div class="alert alert-info alert-soft mt-6 text-sm">
			<Icon name="info" />
			<span
				>Silakan pilih mata pelajaran di atas untuk mulai mengelola rombel dan guru pengampu.</span
			>
		</div>
	{:else if rows.length === 0}
		<div class="alert alert-warning alert-soft mt-6 text-sm">
			<Icon name="info" />
			<span
				>Mata pelajaran &ldquo;{selectedMapel}&rdquo; belum ditambahkan pada kelas mana pun di
				sekolah ini.</span
			>
		</div>
	{:else}
		<form
			method="POST"
			action="?/save_assignments"
			class="mt-4"
			use:enhance={() => {
				isSaving = true;
				return async ({ result }) => {
					isSaving = false;
					if (result.type === 'success') {
						toast({
							message:
								(result.data as { success?: string } | undefined)?.success ??
								'Perubahan penugasan dan data pembelajaran berhasil disimpan.',
							type: 'success'
						});
						await invalidate('app:mapel');
					} else if (result.type === 'failure') {
						toast({
							message:
								(result.data as { fail?: string } | undefined)?.fail ??
								'Gagal menyimpan penugasan.',
							type: 'error'
						});
					}
				};
			}}
		>
			<input type="hidden" name="assignments" value={JSON.stringify(rows)} />

			<div class="overflow-x-auto rounded-xl border border-base-200 shadow-sm bg-base-100">
				<table class="table table-sm">
					<thead>
						<tr class="bg-base-200/80 font-bold text-xs">
							<th style="width: 45px;">No</th>
							<th style="min-width: 110px;">Kelas</th>
							<th style="min-width: 70px;">Tingkat</th>
							<th style="min-width: 240px;">Guru Pengampu</th>
							<th style="min-width: 140px;">Jenis Mapel</th>
							<th style="width: 110px;">Kode Singkat</th>
							<th style="width: 85px;">KKM</th>
							<th style="width: 130px;" class="text-center">Tujuan Pembelajaran</th>
							<th style="width: 80px;" class="text-center">Aksi TP</th>
						</tr>
					</thead>
					<tbody>
						{#each displayedRows as r, idx (r.mapelId)}
							<tr class="hover:bg-base-200/40 transition-colors">
								<td class="font-mono text-xs opacity-60">{idx + 1}</td>
								<td class="font-bold text-sm">{r.namaKelas}</td>
								<td>
									<span class="badge badge-outline badge-xs">{r.jenjang}</span>
								</td>
								<td>
									<select
										bind:value={r.pengampuId}
										class="select select-xs select-bordered w-full bg-base-100 font-medium {r.pengampuId
											? 'border-primary/40 text-primary'
											: 'border-base-300 text-base-content/50'}"
									>
										<option value={null}>-- Belum Ditugaskan --</option>
										{#each data.pegawaiList as p (p.id)}
											<option value={p.id}>{p.nama}{p.nip ? ` (${p.nip})` : ''}</option>
										{/each}
									</select>
								</td>
								<td>
									<select
										bind:value={r.jenis}
										class="select select-xs select-bordered w-full bg-base-100"
									>
										<option value="wajib">Wajib</option>
										<option value="pilihan">Pilihan</option>
										<option value="mulok">Muatan Lokal</option>
									</select>
								</td>
								<td>
									<input
										type="text"
										bind:value={r.kode}
										placeholder="cth: MAT"
										class="input input-xs input-bordered w-full font-mono uppercase bg-base-100"
									/>
								</td>
								<td>
									<input
										type="number"
										bind:value={r.kkm}
										min="0"
										class="input input-xs input-bordered w-full bg-base-100 text-center font-semibold"
									/>
								</td>
								<td class="text-center">
									{#if r.totalTp > 0}
										<span class="badge badge-success badge-sm font-semibold gap-1">
											<Icon name="check" class="h-3 w-3" />
											{r.totalTp} TP Terisi
										</span>
									{:else}
										<span class="badge badge-error badge-sm font-medium gap-1 opacity-80">
											<Icon name="alert" class="h-3 w-3" />
											0 TP
										</span>
									{/if}
								</td>
								<td class="text-center">
									<a
										href="/intrakurikuler/{r.mapelId}/tp-rl"
										class="btn btn-ghost btn-xs text-primary"
										title="Buka pengisian TP kelas {r.namaKelas}"
									>
										<Icon name="edit" class="h-3.5 w-3.5" />
										Atur TP
									</a>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<!-- Tombol Simpan Sticky Bawah -->
			<div
				class="mt-4 flex items-center justify-between p-3 bg-base-200/60 rounded-xl border border-base-300"
			>
				<div class="text-xs text-base-content/70">
					Menampilkan <strong>{displayedRows.length}</strong> dari <strong>{rows.length}</strong> rombel
					kelas.
				</div>
				<button
					type="submit"
					class="btn btn-primary btn-sm gap-2"
					disabled={isSaving || rows.length === 0}
				>
					{#if isSaving}
						<span class="loading loading-spinner loading-xs"></span>
						Menyimpan...
					{:else}
						<Icon name="save" class="h-4 w-4" />
						Simpan Seluruh Penugasan & Data
					{/if}
				</button>
			</div>
		</form>
	{/if}
</div>

<!-- Modal Distribusi TP Massal -->
{#if tpDistributeModalOpen}
	<div class="modal modal-open modal-bottom sm:modal-middle z-50">
		<div class="modal-box max-w-xl border border-base-300 shadow-2xl">
			<div class="flex items-center justify-between border-b border-base-200 pb-3">
				<div class="flex items-center gap-2">
					<span class="p-2 rounded-xl bg-secondary/10 text-secondary">
						<Icon name="copy" class="h-5 w-5" />
					</span>
					<div>
						<h3 class="font-bold text-lg leading-tight">Distribusi TP Massal</h3>
						<p class="text-xs text-base-content/60">
							Salin Tujuan Pembelajaran ({selectedMapel}) ke seluruh rombel paralel
						</p>
					</div>
				</div>
				<button
					type="button"
					class="btn btn-ghost btn-circle btn-sm"
					onclick={() => (tpDistributeModalOpen = false)}
				>
					<Icon name="close" class="h-4 w-4" />
				</button>
			</div>

			<form
				method="POST"
				action="?/bulk_distribute_tp"
				class="mt-4 space-y-3"
				use:enhance={() => {
					isDistributingTp = true;
					return async ({ result }) => {
						isDistributingTp = false;
						if (result.type === 'success') {
							toast({
								message:
									(result.data as { success?: string } | undefined)?.success ??
									'TP berhasil didistribusikan ke seluruh kelas.',
								type: 'success'
							});
							await invalidate('app:mapel');
							tpDistributeModalOpen = false;
						} else if (result.type === 'failure') {
							toast({
								message:
									(result.data as { fail?: string } | undefined)?.fail ??
									'Gagal mendistribusikan TP.',
								type: 'error'
							});
						}
					};
				}}
			>
				<div>
					<label for="select-tp-source" class="label-text font-bold text-xs"
						>Pilih Kelas Sumber (yang TP-nya sudah lengkap):</label
					>
					<select
						id="select-tp-source"
						name="sourceMapelId"
						bind:value={tpSourceMapelId}
						class="select select-bordered select-sm w-full mt-1 bg-base-100"
					>
						{#each rows as r (r.mapelId)}
							<option value={r.mapelId}>
								{r.namaKelas} ({r.totalTp} TP) {r.pengampuNama ? `– ${r.pengampuNama}` : ''}
							</option>
						{/each}
					</select>
				</div>

				{#if sourceRowForTp}
					<div class="p-2.5 rounded-lg bg-base-200 text-xs flex justify-between items-center">
						<span>TP yang akan disalin:</span>
						<strong class="text-primary">{sourceRowForTp.totalTp} Tujuan Pembelajaran</strong>
					</div>
				{/if}

				<!-- Pilihan Mode -->
				<div class="space-y-1.5 pt-1">
					<div class="label-text font-bold text-xs">Metode Distribusi:</div>
					<div class="grid grid-cols-2 gap-2 text-xs">
						<label
							class="flex items-center gap-2 p-2 rounded-lg border border-base-300 bg-base-100 cursor-pointer"
						>
							<input
								type="radio"
								name="mode"
								value="replace"
								checked={tpDistributeMode === 'replace'}
								onchange={() => (tpDistributeMode = 'replace')}
								class="radio radio-primary radio-xs"
							/>
							<span>Timpa Bersih (Replace)</span>
						</label>
						<label
							class="flex items-center gap-2 p-2 rounded-lg border border-base-300 bg-base-100 cursor-pointer"
						>
							<input
								type="radio"
								name="mode"
								value="merge"
								checked={tpDistributeMode === 'merge'}
								onchange={() => (tpDistributeMode = 'merge')}
								class="radio radio-primary radio-xs"
							/>
							<span>Gabungkan (Merge)</span>
						</label>
					</div>
				</div>

				<!-- Hidden Target IDs (all other rows) -->
				{#each rows as r (r.mapelId)}
					{#if r.mapelId !== tpSourceMapelId}
						<input type="hidden" name="targetMapelIds" value={r.mapelId} />
					{/if}
				{/each}

				<div class="modal-action border-t border-base-200 pt-3 flex justify-between items-center">
					<span class="text-xs text-base-content/60">
						Target: <strong>{rows.filter((r) => r.mapelId !== tpSourceMapelId).length}</strong> kelas
						lainnya
					</span>
					<div class="flex gap-2">
						<button
							type="button"
							class="btn btn-ghost btn-sm"
							onclick={() => (tpDistributeModalOpen = false)}
						>
							Batal
						</button>
						<button
							type="submit"
							class="btn btn-secondary btn-sm gap-2"
							disabled={isDistributingTp ||
								!tpSourceMapelId ||
								(sourceRowForTp?.totalTp ?? 0) === 0}
						>
							{#if isDistributingTp}
								<span class="loading loading-spinner loading-xs"></span>
								Mendistribusikan...
							{:else}
								<Icon name="copy" class="h-4 w-4" />
								Salin ke Semua Rombel
							{/if}
						</button>
					</div>
				</div>
			</form>
		</div>
	</div>
{/if}
