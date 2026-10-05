<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Icon from '$lib/components/icon.svelte';

	let { data } = $props();

	let searchQuery = $state('');

	const kelas = $derived(data.kelas);
	const selectedMuridId = $derived(data.selectedMuridId);
	const filteredMuridList = $derived(
		data.muridList.filter(
			(m) =>
				!searchQuery ||
				m.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
				(m.nisn && m.nisn.includes(searchQuery))
		)
	);

	function handleKelasChange(event: Event) {
		const targetKelasId = (event.target as HTMLSelectElement).value;
		const params = new URLSearchParams(page.url.search);
		params.set('kelas_id', targetKelasId);
		params.delete('murid_id');
		void goto(`${page.url.pathname}?${params.toString()}`);
	}

	function selectMurid(muridId: number) {
		const params = new URLSearchParams(page.url.search);
		params.set('murid_id', String(muridId));
		void goto(`${page.url.pathname}?${params.toString()}`);
	}
</script>

<div class="space-y-4">
	<!-- HEADER KONTROL CETAK -->
	<div class="card bg-base-100 p-4 rounded-xl border-none shadow-md">
		<div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
			<div>
				<div class="flex items-center gap-2">
					<a href="/rapor-sisipan?kelas_id={kelas?.id}" class="btn btn-xs btn-ghost btn-square">
						<Icon name="left" />
					</a>
					<h2 class="text-lg font-bold text-base-content">
						Cetak Rapor Sisipan Tengah Semester (STS)
					</h2>
				</div>
				{#if kelas}
					<p class="text-xs text-base-content/70 ml-7">
						Kelas: <strong class="text-primary">{kelas.nama}</strong> ({kelas.fase})
						{#if kelas.waliKelasNama}
							| Wali Kelas: <strong>{kelas.waliKelasNama}</strong>
						{/if}
					</p>
				{/if}
			</div>

			<div class="flex flex-wrap items-center gap-2">
				{#if data.daftarKelas && data.daftarKelas.length > 0}
					<select
						class="select select-sm bg-base-200 dark:bg-base-300 font-bold"
						value={kelas?.id ?? ''}
						onchange={handleKelasChange}
					>
						{#each data.daftarKelas as k (k.id)}
							<option value={k.id}>{k.nama}</option>
						{/each}
					</select>
				{/if}

				{#if kelas && selectedMuridId}
					<a
						href="/cetak/rapor-sisipan.pdf?kelas_id={kelas.id}&murid_id={selectedMuridId}"
						target="_blank"
						class="btn btn-sm btn-soft btn-primary"
					>
						<Icon name="print" />
						Unduh PDF Siswa Ini
					</a>
				{/if}

				{#if kelas}
					<a
						href="/cetak/rapor-sisipan.pdf?kelas_id={kelas.id}&bulk=true"
						target="_blank"
						class="btn btn-sm btn-primary"
					>
						<Icon name="print" />
						Cetak Seluruh Kelas (1 File)
					</a>
				{/if}
			</div>
		</div>
	</div>

	<!-- SPLIT PREVIEW LAYOUT: LIST MURID DI KIRI, PREVIEW DI KANAN -->
	<div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
		<!-- PANEL DAFTAR SISWA (LEBAR 4/12) -->
		<div class="lg:col-span-4 space-y-3">
			<div class="card bg-base-100 p-3 rounded-xl border border-base-200 shadow-xs">
				<label class="input input-sm bg-base-200 w-full mb-2 flex items-center gap-2">
					<Icon name="search" class="h-3.5 w-3.5 text-base-content/50" />
					<input
						type="search"
						class="grow text-xs"
						placeholder="Cari nama murid..."
						bind:value={searchQuery}
					/>
				</label>

				<div class="max-h-[calc(100vh-18rem)] overflow-y-auto space-y-1 pr-1">
					{#each filteredMuridList as m (m.id)}
						<button
							type="button"
							class="w-full text-left p-2.5 rounded-lg text-xs transition-all flex items-center justify-between {selectedMuridId ===
							m.id
								? 'bg-primary text-primary-content font-bold shadow-xs'
								: 'bg-base-200/50 hover:bg-base-200 text-base-content'}"
							onclick={() => selectMurid(m.id)}
						>
							<div class="truncate mr-2">
								<span class="opacity-70 mr-1.5">{m.no}.</span>
								{m.nama}
							</div>
							{#if m.nisn}
								<span class="text-[10px] opacity-75 shrink-0">{m.nisn}</span>
							{/if}
						</button>
					{:else}
						<div class="text-xs text-base-content/50 text-center py-4 italic">
							Tidak ada murid yang cocok
						</div>
					{/each}
				</div>
			</div>
		</div>

		<!-- PANEL PREVIEW DOKUMEN RAPOR (LEBAR 8/12) -->
		<div class="lg:col-span-8">
			<div class="card bg-base-100 p-3 rounded-xl border border-base-200 shadow-md">
				{#if data.previewHtml}
					{#if data.studentMapelNotes && data.studentMapelNotes.length > 0}
						<div class="mb-3 p-3 bg-base-200/60 rounded-xl border border-base-200">
							<div class="flex items-center gap-1.5 text-xs font-bold text-base-content mb-2">
								<Icon name="info" class="w-4 h-4 text-info" />
								<span
									>Catatan Guru Mata Pelajaran (Hanya Tampil di Layar Ini, Tidak Dicetak di Rapor):</span
								>
							</div>
							<div class="space-y-1.5">
								{#each data.studentMapelNotes as note (note.mataPelajaran)}
									<div class="text-xs bg-base-100 p-2 rounded-lg border border-base-200">
										<span class="font-semibold text-primary">{note.mataPelajaran}:</span>
										<span class="text-base-content/80 italic">"{note.catatan}"</span>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					<div
						class="w-full overflow-x-auto bg-slate-200 dark:bg-slate-900 p-3 rounded-lg flex justify-center"
					>
						<iframe
							srcdoc={data.previewHtml}
							title="Pratinjau Rapor Sisipan"
							class="w-[210mm] min-h-[297mm] bg-white shadow-xl rounded border-none"
						></iframe>
					</div>
				{:else}
					<div class="p-12 text-center text-base-content/60 text-sm">
						Silakan pilih peserta didik untuk melihat pratinjau lembar rapor sisipan.
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
