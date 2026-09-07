<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import Icon from '$lib/components/icon.svelte';

	type DashboardStatistik = App.DashboardStatistik;

	let { rombel, murid } = $props<{
		rombel: DashboardStatistik['rombel'];
		murid: DashboardStatistik['murid'];
	}>();

	const rombelBadges = $derived.by(() => rombel.perFase);
</script>

<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
	<!-- Card Rombel -->
	<div class="card-clean card-clean-hover p-5 flex flex-col justify-between">
		<div class="flex items-start justify-between">
			<div class="space-y-1">
				<p class="text-xs font-semibold text-base-content/60 uppercase tracking-wider">
					Rombel / Kelas
				</p>
				<p class="font-display text-3xl font-extrabold text-slate-800 dark:text-slate-100">
					{rombel.total}
				</p>
			</div>
			<div
				class="h-11 w-11 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 flex items-center justify-center shadow-xs"
			>
				<Icon name="users" class="h-5 w-5" />
			</div>
		</div>
		<div
			class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap gap-1.5"
		>
			{#if rombelBadges.length}
				{#each rombelBadges as badge (badge.label)}
					<span class="badge badge-xs badge-soft badge-info font-medium text-[11px] py-1 px-2">
						{badge.jumlah}
						{badge.label}
					</span>
				{/each}
			{:else}
				<span class="text-xs text-base-content/50 italic">Belum ada data rombel</span>
			{/if}
		</div>
	</div>

	<!-- Card Murid -->
	<div class="card-clean card-clean-hover p-5 flex flex-col justify-between">
		<div class="flex items-start justify-between">
			<div class="space-y-1">
				<p class="text-xs font-semibold text-base-content/60 uppercase tracking-wider">
					Total Murid
				</p>
				<p class="font-display text-3xl font-extrabold text-slate-800 dark:text-slate-100">
					{murid.total}
				</p>
			</div>
			<div
				class="h-11 w-11 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 flex items-center justify-center shadow-xs"
			>
				<Icon name="user" class="h-5 w-5" />
			</div>
		</div>
		<div
			class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between"
		>
			<span class="text-xs text-base-content/65">
				{murid.total ? 'Murid terdaftar aktif' : 'Belum ada data murid'}
			</span>
			{#if murid.total}
				<a
					href="/murid"
					class="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
				>
					<span>Lihat</span>
					<Icon name="right" class="h-3 w-3" />
				</a>
			{/if}
		</div>
	</div>
</div>
