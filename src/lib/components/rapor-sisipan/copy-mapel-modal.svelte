<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	import { toast } from '$lib/components/toast.svelte';

	interface Props {
		open?: boolean;
		targetKelasId: number;
		targetKelasNama: string;
		targetMapelId: number;
		targetMapelNama: string;
		daftarKelas: Array<{ id: number; nama: string; fase?: string | null }>;
		onSuccess?: () => void;
	}

	let {
		open = $bindable(false),
		targetKelasId,
		targetKelasNama,
		targetMapelId,
		targetMapelNama,
		daftarKelas = [],
		onSuccess
	}: Props = $props();

	interface SourceMapelItem {
		id: number;
		nama: string;
		hasSetup: boolean;
		formatifCount: number;
		sumatifCount: number;
		studentCount: number;
	}

	// svelte-ignore state_referenced_locally
	let selectedSourceKelasId = $state<number>(targetKelasId);
	let selectedSourceMapelId = $state<number | null>(null);
	let sourceMapelList = $state<SourceMapelItem[]>([]);
	let isLoadingMapel = $state(false);
	let isCopying = $state(false);

	// Reset ke kelas target saat modal dibuka
	$effect(() => {
		if (open) {
			selectedSourceKelasId = targetKelasId;
			selectedSourceMapelId = null;
			void loadSourceMapels(targetKelasId);
		}
	});

	async function loadSourceMapels(kelasId: number) {
		isLoadingMapel = true;
		try {
			const res = await fetch(`/api/rapor-sisipan/source-mapel?kelasId=${kelasId}`);
			if (!res.ok) throw new Error('Gagal memuat daftar mata pelajaran.');
			const data = await res.json();
			const list: SourceMapelItem[] = data.mapelList || [];

			// Jika di kelas yang sama, jangan izinkan menyalin dari mapel yang sama
			sourceMapelList = list.filter((m) => {
				if (kelasId === targetKelasId && m.id === targetMapelId) return false;
				return true;
			});

			// Pilih mapel pertama yang sudah punya setup sebagai default
			const firstWithSetup = sourceMapelList.find((m) => m.hasSetup);
			selectedSourceMapelId = firstWithSetup ? firstWithSetup.id : (sourceMapelList[0]?.id ?? null);
		} catch (err) {
			toast((err as Error).message, 'error');
			sourceMapelList = [];
			selectedSourceMapelId = null;
		} finally {
			isLoadingMapel = false;
		}
	}

	function handleSourceKelasChange(event: Event) {
		const newKelasId = Number((event.target as HTMLSelectElement).value);
		selectedSourceKelasId = newKelasId;
		selectedSourceMapelId = null;
		void loadSourceMapels(newKelasId);
	}

	const selectedSourceMapel = $derived(
		sourceMapelList.find((m) => m.id === selectedSourceMapelId) ?? null
	);

	const isSameKelas = $derived(selectedSourceKelasId === targetKelasId);

	async function handleExecuteCopy() {
		if (!selectedSourceMapelId) {
			toast('Silakan pilih mata pelajaran sumber.', 'error');
			return;
		}

		if (isSameKelas && selectedSourceMapelId === targetMapelId) {
			toast('Mata pelajaran sumber dan target tidak boleh sama.', 'error');
			return;
		}

		isCopying = true;
		try {
			const res = await fetch('/api/rapor-sisipan/copy', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sourceKelasId: selectedSourceKelasId,
					sourceMapelId: selectedSourceMapelId,
					targetKelasId,
					targetMapelId
				})
			});

			const json = await res.json();
			if (!res.ok) throw new Error(json.error || 'Gagal menyalin data');

			toast(json.message || 'Komponen asesmen dan nilai berhasil disalin.', 'success');
			open = false;
			onSuccess?.();
		} catch (err) {
			toast((err as Error).message, 'error');
		} finally {
			isCopying = false;
		}
	}
</script>

<dialog class="modal {open ? 'modal-open' : ''} modal-bottom sm:modal-middle">
	<div class="modal-box max-w-lg p-6 space-y-4">
		<!-- HEADER -->
		<div class="flex items-center justify-between pb-3 border-b border-base-200">
			<div class="flex items-center gap-2">
				<div
					class="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0"
				>
					<Icon name="copy" class="w-4 h-4" />
				</div>
				<div>
					<h3 class="font-bold text-base text-base-content">Salin Komponen Asesmen & Nilai</h3>
					<p class="text-xs text-base-content/60">
						Khusus Administrator: Salin antarmapel di kelas yang sama atau kelas lain.
					</p>
				</div>
			</div>
			<button
				type="button"
				class="btn btn-sm btn-ghost btn-circle"
				onclick={() => (open = false)}
				disabled={isCopying}
			>
				✕
			</button>
		</div>

		<!-- CONTENT -->
		<div class="space-y-4 text-xs">
			<!-- TARGET INFO -->
			<div class="bg-base-200/60 p-3 rounded-xl space-y-1.5 border border-base-300/50">
				<div class="font-semibold text-base-content/70">Mata Pelajaran Tujuan (Target):</div>
				<div class="flex items-center gap-2 font-bold text-sm text-primary">
					<Icon name="book" class="w-4 h-4" />
					<span>{targetKelasNama} &bull; {targetMapelNama}</span>
				</div>
			</div>

			<!-- SOURCE SELECTION -->
			<div class="space-y-3">
				<div>
					<label class="label font-bold py-1 text-xs" for="source-kelas-select">
						Pilih Kelas Sumber:
					</label>
					<select
						id="source-kelas-select"
						class="select select-sm select-bordered w-full bg-base-100"
						value={selectedSourceKelasId}
						onchange={handleSourceKelasChange}
						disabled={isCopying}
					>
						{#each daftarKelas as k (k.id)}
							<option value={k.id}>
								{k.nama}
								{k.id === targetKelasId ? '(Kelas yang sama)' : ''}
							</option>
						{/each}
					</select>
				</div>

				<div>
					<label
						class="label font-bold py-1 text-xs flex justify-between"
						for="source-mapel-select"
					>
						<span>Pilih Mata Pelajaran Sumber:</span>
						{#if isLoadingMapel}
							<span class="loading loading-spinner loading-xs text-primary"></span>
						{/if}
					</label>

					<select
						id="source-mapel-select"
						class="select select-sm select-bordered w-full bg-base-100 font-medium"
						bind:value={selectedSourceMapelId}
						disabled={isCopying || isLoadingMapel || sourceMapelList.length === 0}
					>
						{#if sourceMapelList.length === 0}
							<option value={null}>Tidak ada mata pelajaran lain di kelas ini</option>
						{:else}
							{#each sourceMapelList as sm (sm.id)}
								<option value={sm.id}>
									{sm.nama}
									{#if sm.hasSetup}
										({sm.formatifCount} Tugas, {sm.sumatifCount} Formatif &bull; {sm.studentCount} Nilai)
									{:else}
										(Belum disetup)
									{/if}
								</option>
							{/each}
						{/if}
					</select>
				</div>
			</div>

			<!-- DETAILS & METODE SALIN -->
			{#if selectedSourceMapel}
				<div class="alert alert-soft alert-info text-xs p-3 rounded-xl flex items-start gap-2">
					<Icon name="info" class="w-4 h-4 shrink-0 mt-0.5 text-info" />
					<div class="space-y-1">
						<div class="font-bold">
							Metode Penyalinan: {isSameKelas ? 'Kelas yang Sama' : 'Antar Kelas Berbeda'}
						</div>
						<p class="text-[11px] leading-relaxed">
							{#if isSameKelas}
								Komponen asesmen akan diperbarui dan nilai siswa akan disalin langsung ke siswa yang
								sama.
							{:else}
								Komponen asesmen akan diperbarui dan nilai siswa akan dipetakan berurutan sesuai
								nomor urut (absen 1 ke 1, 2 ke 2, dst).
							{/if}
						</p>
					</div>
				</div>
			{/if}

			{#if selectedSourceMapel && !selectedSourceMapel.hasSetup}
				<div
					class="alert alert-soft alert-warning text-xs p-2.5 rounded-lg flex items-center gap-2"
				>
					<Icon name="warning" class="w-4 h-4 shrink-0 text-warning" />
					<span>Mapel sumber belum dikonfigurasi komponen asesmennya.</span>
				</div>
			{/if}
		</div>

		<!-- ACTIONS -->
		<div class="flex items-center justify-end gap-2 pt-3 border-t border-base-200">
			<button
				type="button"
				class="btn btn-sm btn-ghost"
				onclick={() => (open = false)}
				disabled={isCopying}
			>
				Batal
			</button>

			<button
				type="button"
				class="btn btn-sm btn-primary"
				onclick={handleExecuteCopy}
				disabled={isCopying || !selectedSourceMapelId || !selectedSourceMapel?.hasSetup}
			>
				{#if isCopying}
					<span class="loading loading-spinner loading-xs"></span>
					Menyalin...
				{:else}
					<Icon name="copy" />
					Salin Asesmen & Nilai
				{/if}
			</button>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button onclick={() => (open = false)} disabled={isCopying}>close</button>
	</form>
</dialog>
