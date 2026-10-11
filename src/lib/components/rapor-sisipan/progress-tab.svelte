<script lang="ts">
	import Icon from '$lib/components/icon.svelte';

	interface MapelProgressItem {
		id: number;
		nama: string;
		guruNama?: string | null;
		isSetup: boolean;
		totalMurid: number;
		muridDinilai: number;
		persentase: number;
		canEdit?: boolean;
	}

	interface Props {
		kelasNama: string;
		progressList: MapelProgressItem[];
		onSelectMapel: (mapelId: number) => void;
	}

	let { kelasNama, progressList, onSelectMapel }: Props = $props();

	const totalMapel = $derived(progressList.length);
	const totalSelesai = $derived(progressList.filter((p) => p.persentase === 100).length);
	const overallPersentase = $derived(
		totalMapel > 0
			? Math.round(
					(progressList.reduce((acc, curr) => acc + curr.persentase, 0) / totalMapel) * 10
				) / 10
			: 0
	);
</script>

<div class="space-y-4">
	<!-- RINGKASAN PROGRESS KELAS -->
	<div
		class="card bg-base-100 p-5 rounded-xl border border-base-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4"
	>
		<div>
			<h3 class="text-base font-bold text-base-content">
				Monitoring Pengisian Nilai Rapor Sisipan (STS)
			</h3>
			<p class="text-xs text-base-content/70 mt-0.5">
				Kelas: <strong class="text-primary">{kelasNama}</strong> | Total: {totalMapel} mapel (<strong
					>{totalSelesai}</strong
				> selesai dinilai)
			</p>
		</div>

		<div class="flex items-center gap-4">
			<div class="text-right">
				<div class="text-xs text-base-content/70 font-semibold">Capaian Kelas:</div>
				<div class="text-xl font-black text-primary">{overallPersentase}%</div>
			</div>
			<div
				class="radial-progress text-primary bg-primary/10 border-primary/20 text-xs font-bold"
				style="--value:{overallPersentase}; --size:3rem; --thickness: 4px;"
				role="progressbar"
			>
				{Math.round(overallPersentase)}%
			</div>
		</div>
	</div>

	<!-- DAFTAR MATA PELAJARAN -->
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
		{#each progressList as mapel (mapel.id)}
			<div
				class="card bg-base-100 p-4 rounded-xl border border-base-200 shadow-sm hover:border-primary/40 transition-all flex flex-col justify-between"
			>
				<div>
					<div class="flex items-start justify-between gap-2 mb-1.5">
						<h4 class="font-bold text-sm text-base-content line-clamp-1" title={mapel.nama}>
							{mapel.nama}
						</h4>
						{#if mapel.persentase === 100}
							<span class="badge badge-xs badge-success text-white font-bold shrink-0"
								>100% Selesai</span
							>
						{:else if mapel.isSetup}
							<span class="badge badge-xs badge-warning font-bold shrink-0"
								>{mapel.persentase}%</span
							>
						{:else}
							<span class="badge badge-xs badge-neutral font-semibold shrink-0">Belum Setup</span>
						{/if}
					</div>

					<p class="text-xs text-base-content/60 mb-3 flex items-center gap-1">
						<Icon name="user" class="h-3 w-3" />
						<span class="truncate">{mapel.guruNama || 'Belum ada guru pengampu'}</span>
					</p>

					<div class="space-y-1 mb-4">
						<div class="flex justify-between text-[11px] text-base-content/70">
							<span>Status Pengisian:</span>
							<span class="font-bold text-base-content">
								{mapel.muridDinilai} / {mapel.totalMurid} murid
							</span>
						</div>
						<progress
							class="progress progress-primary w-full h-1.5"
							value={mapel.persentase}
							max="100"
						></progress>
					</div>
				</div>

				<div class="pt-2 border-t border-base-200 flex justify-end">
					<button
						type="button"
						class="btn btn-xs btn-soft {mapel.canEdit
							? 'btn-primary'
							: 'btn-secondary'} w-full font-semibold"
						onclick={() => onSelectMapel(mapel.id)}
					>
						<Icon name={mapel.canEdit ? 'pen' : 'book'} />
						{mapel.canEdit ? 'Buka / Isi Nilai Mapel' : 'Lihat Rekap Nilai'}
					</button>
				</div>
			</div>
		{/each}
	</div>
</div>
