<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidate } from '$app/navigation';
	import Icon from '$lib/components/icon.svelte';
	import { toast } from '$lib/components/toast.svelte';

	let {
		open = $bindable(false),
		mapelNama = '',
		currentKelasNama = '',
		currentJenjang = '',
		totalTp = 0,
		kelasList = [],
		onClose
	}: {
		open: boolean;
		mapelNama: string;
		currentKelasNama: string;
		currentJenjang: string;
		totalTp: number;
		kelasList: Array<{
			kelasId: number;
			namaKelas: string;
			mapelId: number;
			totalTp: number;
			jenjang: string;
			isSameJenjang: boolean;
		}>;
		onClose?: () => void;
	} = $props();

	let selectedMapelIds = $state<number[]>([]);
	let copyMode = $state<'replace' | 'merge'>('replace');
	let isSubmitting = $state(false);
	// svelte-ignore state_referenced_locally
	let filterJenjang = $state<string>(currentJenjang || 'semua');

	const displayedClasses = $derived.by(() => {
		if (filterJenjang === 'semua') return kelasList;
		return kelasList.filter((k) => k.jenjang === filterJenjang);
	});

	function selectAllDisplayed() {
		const displayedIds = displayedClasses.map((k) => k.mapelId);
		const currentSet = new Set(selectedMapelIds);
		for (const id of displayedIds) currentSet.add(id);
		selectedMapelIds = Array.from(currentSet);
	}

	function unselectAllDisplayed() {
		const displayedSet = new Set(displayedClasses.map((k) => k.mapelId));
		selectedMapelIds = selectedMapelIds.filter((id) => !displayedSet.has(id));
	}

	function handleClose() {
		open = false;
		if (onClose) onClose();
	}

	// Auto-select parallel classes of the same jenjang on first open
	$effect(() => {
		if (open && selectedMapelIds.length === 0 && kelasList.length > 0) {
			selectedMapelIds = kelasList.filter((k) => k.isSameJenjang).map((k) => k.mapelId);
		}
	});
</script>

{#if open}
	<div class="modal modal-open modal-bottom sm:modal-middle z-50">
		<div class="modal-box max-w-2xl border border-base-300 shadow-2xl">
			<div class="flex items-center justify-between border-b border-base-200 pb-3">
				<div class="flex items-center gap-2">
					<span class="p-2 rounded-xl bg-primary/10 text-primary">
						<Icon name="copy" class="h-5 w-5" />
					</span>
					<div>
						<h3 class="font-bold text-lg leading-tight">Salin TP ke Kelas Paralel</h3>
						<p class="text-xs text-base-content/60">
							Duplikasi Tujuan Pembelajaran ({mapelNama}) ke rombel se-jenjang
						</p>
					</div>
				</div>
				<button type="button" class="btn btn-ghost btn-circle btn-sm" onclick={handleClose}>
					<Icon name="close" class="h-4 w-4" />
				</button>
			</div>

			<!-- Info Box Sumber -->
			<div
				class="mt-4 p-3 rounded-xl bg-base-200/60 border border-base-300/80 flex flex-wrap items-center justify-between gap-2 text-xs"
			>
				<div>
					<span class="text-base-content/60">Kelas Sumber:</span>
					<strong class="ml-1 text-sm font-semibold">{currentKelasNama}</strong>
				</div>
				<div>
					<span class="text-base-content/60">Jumlah TP Sumber:</span>
					<span class="badge badge-primary badge-sm ml-1 font-bold">{totalTp} TP</span>
				</div>
			</div>

			{#if kelasList.length === 0}
				<div class="alert alert-warning alert-soft my-6 text-sm">
					<Icon name="info" />
					<span
						>Tidak ditemukan kelas lain yang memiliki mata pelajaran &ldquo;{mapelNama}&rdquo;.</span
					>
				</div>
			{:else}
				<form
					method="POST"
					action="?/salin_tp"
					use:enhance={() => {
						isSubmitting = true;
						return async ({ result }) => {
							isSubmitting = false;
							if (result.type === 'success') {
								toast({
									message:
										(result.data as { message?: string } | undefined)?.message ??
										'TP berhasil disalin ke kelas paralel.',
									type: 'success'
								});
								await invalidate('app:mapel_tp-rl');
								handleClose();
							} else if (result.type === 'failure') {
								toast({
									message:
										(result.data as { fail?: string } | undefined)?.fail ?? 'Gagal menyalin TP.',
									type: 'error'
								});
							}
						};
					}}
				>
					<input type="hidden" name="mode" value={copyMode} />

					<!-- Pilihan Filter & Tombol Cepat -->
					<div class="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
						<div class="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
							<span class="text-xs text-base-content/60 mr-1">Filter:</span>
							{#if currentJenjang}
								<button
									type="button"
									class="btn btn-xs {filterJenjang === currentJenjang
										? 'btn-primary'
										: 'btn-ghost'}"
									onclick={() => (filterJenjang = currentJenjang)}
								>
									Jenjang {currentJenjang} Saja
								</button>
							{/if}
							<button
								type="button"
								class="btn btn-xs {filterJenjang === 'semua' ? 'btn-primary' : 'btn-ghost'}"
								onclick={() => (filterJenjang = 'semua')}
							>
								Semua Kelas
							</button>
						</div>

						<div class="flex items-center gap-1">
							<button
								type="button"
								class="btn btn-xs btn-outline btn-primary"
								onclick={selectAllDisplayed}
							>
								Pilih Semua ({displayedClasses.length})
							</button>
							<button
								type="button"
								class="btn btn-xs btn-ghost text-error"
								onclick={unselectAllDisplayed}
							>
								Batal Pilih
							</button>
						</div>
					</div>

					<!-- Daftar Kelas Target -->
					<div
						class="mt-3 max-h-56 overflow-y-auto rounded-xl border border-base-300 p-2 space-y-1.5"
					>
						{#each displayedClasses as k (k.mapelId)}
							<label
								class="flex items-center justify-between p-2.5 rounded-lg border border-base-200 hover:bg-base-200/50 cursor-pointer transition-colors"
							>
								<div class="flex items-center gap-2.5">
									<input
										type="checkbox"
										name="targetMapelIds"
										value={k.mapelId}
										bind:group={selectedMapelIds}
										class="checkbox checkbox-primary checkbox-sm"
									/>
									<span class="font-semibold text-sm">{k.namaKelas}</span>
									{#if k.isSameJenjang}
										<span class="badge badge-outline badge-xs text-[10px] opacity-70">Paralel</span>
									{/if}
								</div>
								<div class="flex items-center gap-1.5 text-xs">
									{#if k.totalTp > 0}
										<span class="badge badge-warning badge-sm font-medium"
											>{k.totalTp} TP Terisi</span
										>
									{:else}
										<span class="badge badge-ghost badge-sm text-base-content/50"
											>0 TP (Kosong)</span
										>
									{/if}
								</div>
							</label>
						{/each}
					</div>

					<!-- Opsi Mode Penggandaan -->
					<div class="mt-4 p-3 rounded-xl bg-base-200/40 border border-base-300 space-y-2">
						<div class="text-xs font-bold text-base-content/80">Metode Penggandaan:</div>
						<div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
							<label
								class="flex items-start gap-2 p-2 rounded-lg border border-base-300 bg-base-100 cursor-pointer"
							>
								<input
									type="radio"
									name="optCopyMode"
									value="replace"
									checked={copyMode === 'replace'}
									onchange={() => (copyMode = 'replace')}
									class="radio radio-primary radio-xs mt-0.5"
								/>
								<div>
									<div class="font-semibold">Timpa Bersih (Replace)</div>
									<div class="text-base-content/60 text-[11px] leading-tight mt-0.5">
										Hapus TP lama di kelas tujuan, ganti dengan {totalTp} TP dari kelas sumber.
									</div>
								</div>
							</label>
							<label
								class="flex items-start gap-2 p-2 rounded-lg border border-base-300 bg-base-100 cursor-pointer"
							>
								<input
									type="radio"
									name="optCopyMode"
									value="merge"
									checked={copyMode === 'merge'}
									onchange={() => (copyMode = 'merge')}
									class="radio radio-primary radio-xs mt-0.5"
								/>
								<div>
									<div class="font-semibold">Gabungkan (Merge)</div>
									<div class="text-base-content/60 text-[11px] leading-tight mt-0.5">
										Tambahkan TP sumber ke kelas tujuan tanpa menghapus data TP yang sudah ada.
									</div>
								</div>
							</label>
						</div>
					</div>

					<!-- Modal Actions -->
					<div
						class="modal-action mt-4 flex items-center justify-between border-t border-base-200 pt-3"
					>
						<div class="text-xs text-base-content/60">
							<strong>{selectedMapelIds.length}</strong> kelas tujuan dipilih
						</div>
						<div class="flex items-center gap-2">
							<button type="button" class="btn btn-ghost btn-sm" onclick={handleClose}>
								Batal
							</button>
							<button
								type="submit"
								class="btn btn-primary btn-sm gap-2"
								disabled={selectedMapelIds.length === 0 || isSubmitting || totalTp === 0}
							>
								{#if isSubmitting}
									<span class="loading loading-spinner loading-xs"></span>
									Menyalin...
								{:else}
									<Icon name="copy" class="h-4 w-4" />
									Salin TP ke {selectedMapelIds.length} Kelas
								{/if}
							</button>
						</div>
					</div>
				</form>
			{/if}
		</div>
	</div>
{/if}
