<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import Icon from '$lib/components/icon.svelte';

	type MapelStat = {
		total: number;
		wajib: number;
		mulok: number;
		kokurikuler?: number;
		lainnya: number;
	};

	type EkstrakurikulerStat = {
		total: number;
	};

	let { mapel, ekstrakurikuler } = $props<{
		mapel: MapelStat;
		ekstrakurikuler: EkstrakurikulerStat;
	}>();

	function mapelParts(m: MapelStat): string {
		const parts: string[] = [];
		if (m.wajib) parts.push(`${m.wajib} Wajib`);
		if (m.mulok) parts.push(`${m.mulok} Mulok`);
		if (m.lainnya) parts.push(`${m.lainnya} Pilihan`);

		if (parts.length === 0) return '—';
		if (parts.length === 1) return parts[0];
		if (parts.length === 2) return parts.join(' & ');
		return parts.slice(0, -1).join(', ') + ' & ' + parts[parts.length - 1];
	}
</script>

<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
	<!-- Card Mapel Intrakurikuler -->
	<div class="card-clean card-clean-hover p-5 flex flex-col justify-between">
		<div class="flex items-start justify-between">
			<div class="space-y-1">
				<p class="text-xs font-semibold text-base-content/60 uppercase tracking-wider">
					Intrakurikuler
				</p>
				<p class="font-display text-3xl font-extrabold text-slate-800 dark:text-slate-100">
					{mapel.total}
				</p>
			</div>
			<div
				class="h-11 w-11 rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400 flex items-center justify-center shadow-xs"
			>
				<Icon name="book-open" class="h-5 w-5" />
			</div>
		</div>
		<div
			class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between"
		>
			<span class="text-xs text-base-content/65 truncate">
				{mapelParts(mapel)}
			</span>
			<a
				href="/intrakurikuler"
				class="text-xs font-semibold text-primary hover:underline flex items-center gap-1 shrink-0"
			>
				<span>Kelola</span>
				<Icon name="right" class="h-3 w-3" />
			</a>
		</div>
	</div>

	<!-- Card Ekstrakurikuler -->
	<div class="card-clean card-clean-hover p-5 flex flex-col justify-between">
		<div class="flex items-start justify-between">
			<div class="space-y-1">
				<p class="text-xs font-semibold text-base-content/60 uppercase tracking-wider">
					Ekstrakurikuler
				</p>
				<p class="font-display text-3xl font-extrabold text-slate-800 dark:text-slate-100">
					{ekstrakurikuler.total}
				</p>
			</div>
			<div
				class="h-11 w-11 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 flex items-center justify-center shadow-xs"
			>
				<Icon name="layers" class="h-5 w-5" />
			</div>
		</div>
		<div
			class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between"
		>
			<span class="text-xs text-base-content/65">
				{ekstrakurikuler.total ? 'Ekskul aktif sekolah' : 'Belum ada ekskul'}
			</span>
			<a
				href="/ekstrakurikuler"
				class="text-xs font-semibold text-primary hover:underline flex items-center gap-1 shrink-0"
			>
				<span>Kelola</span>
				<Icon name="right" class="h-3 w-3" />
			</a>
		</div>
	</div>
</div>
