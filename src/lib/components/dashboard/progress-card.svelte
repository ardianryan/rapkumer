<script lang="ts">
	import Icon from '$lib/components/icon.svelte';

	type ProgressItem = {
		percentage: number;
		completed: number;
		total: number;
	};

	let { progress } = $props<{
		progress: {
			akademik: ProgressItem;
			ekstrakurikuler: ProgressItem;
			kokurikuler: ProgressItem;
		};
	}>();
</script>

<div class="card-clean p-5 sm:p-6">
	<div
		class="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800"
	>
		<div class="flex items-center gap-2.5">
			<div
				class="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-2xs"
			>
				<Icon name="bar-chart" class="h-4.5 w-4.5" />
			</div>
			<div>
				<h2 class="font-display text-base font-bold text-slate-800 dark:text-slate-100">
					Progres Penilaian
				</h2>
				<p class="text-xs text-base-content/60">Rekapitulasi kelengkapan data nilai semester ini</p>
			</div>
		</div>
	</div>

	<div class="space-y-5 pt-4">
		<!-- Progress Akademik -->
		<div class="space-y-1.5">
			<div class="flex items-center justify-between text-xs">
				<span class="font-semibold text-slate-700 dark:text-slate-200">
					Nilai Intrakurikuler (TP)
				</span>
				<span class="badge badge-sm badge-soft badge-success font-mono font-bold">
					{progress.akademik.percentage}%
				</span>
			</div>
			<div class="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
				<div
					class="h-full rounded-full bg-emerald-500 transition-all duration-500"
					style="width: {Math.min(100, Math.max(0, progress.akademik.percentage))}%;"
				></div>
			</div>
			<p class="text-xs text-base-content/60">
				<strong class="text-slate-700 dark:text-slate-200">{progress.akademik.completed}</strong>
				dari {progress.akademik.total} penilaian telah terisi.
			</p>
		</div>

		<!-- Progress Ekstrakurikuler -->
		<div class="space-y-1.5">
			<div class="flex items-center justify-between text-xs">
				<span class="font-semibold text-slate-700 dark:text-slate-200">
					Nilai Ekstrakurikuler
				</span>
				<span class="badge badge-sm badge-soft badge-warning font-mono font-bold">
					{progress.ekstrakurikuler.percentage}%
				</span>
			</div>
			<div class="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
				<div
					class="h-full rounded-full bg-amber-500 transition-all duration-500"
					style="width: {Math.min(100, Math.max(0, progress.ekstrakurikuler.percentage))}%;"
				></div>
			</div>
			<p class="text-xs text-base-content/60">
				<strong class="text-slate-700 dark:text-slate-200"
					>{progress.ekstrakurikuler.completed}</strong
				>
				dari {progress.ekstrakurikuler.total} murid telah dinilai.
			</p>
		</div>

		<!-- Progress Kokurikuler -->
		<div class="space-y-1.5">
			<div class="flex items-center justify-between text-xs">
				<span class="font-semibold text-slate-700 dark:text-slate-200">
					Asesmen Kokurikuler (P5)
				</span>
				<span class="badge badge-sm badge-soft badge-info font-mono font-bold">
					{progress.kokurikuler.percentage}%
				</span>
			</div>
			<div class="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
				<div
					class="h-full rounded-full bg-blue-500 transition-all duration-500"
					style="width: {Math.min(100, Math.max(0, progress.kokurikuler.percentage))}%;"
				></div>
			</div>
			<p class="text-xs text-base-content/60">
				<strong class="text-slate-700 dark:text-slate-200">{progress.kokurikuler.completed}</strong>
				dari {progress.kokurikuler.total} dimensi selesai dinilai.
			</p>
		</div>
	</div>
</div>
