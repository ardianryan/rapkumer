<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Icon from '$lib/components/icon.svelte';

	let { children, data } = $props();

	const navItems = [
		{ label: 'Pengaturan API', path: '/erapor' as const, icon: 'gear' as const },
		{ label: 'Pemetaan Data', path: '/erapor/mapping' as const, icon: 'layers' as const },
		{
			label: 'Sync Kokurikuler',
			path: '/erapor/sync-kokurikuler' as const,
			icon: 'sparkles' as const
		},
		{
			label: 'Sync Akademik',
			path: '/erapor/sync-akademik' as const,
			icon: 'book' as const
		},
		{
			label: 'Sync Kehadiran & Wali',
			path: '/erapor/sync-walas' as const,
			icon: 'users' as const
		},
		{ label: 'Riwayat Log', path: '/erapor/logs' as const, icon: 'table' as const }
	];

	function isActive(itemPath: string) {
		if (itemPath === '/erapor') return page.url.pathname === '/erapor';
		return page.url.pathname.startsWith(itemPath);
	}
</script>

<div class="space-y-4">
	<div class="card bg-base-100 border-base-200 rounded-xl border p-4 shadow-xs">
		<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h1 class="text-xl font-bold">Integrasi e-Rapor SMA (Bridge REST API)</h1>
				<p class="text-base-content/70 text-xs">
					Sinkronisasi nilai akhir, capaian TP, kokurikuler P5, kehadiran, dan catatan wali ke
					e-Rapor SMA.
				</p>
			</div>
			<div class="flex items-center gap-2">
				{#if data.eraporConfigured}
					<span class="badge badge-success badge-sm font-semibold text-white">
						API Terkonfigurasi
					</span>
				{:else}
					<span class="badge badge-warning badge-sm font-semibold">Belum Dikonfigurasi</span>
				{/if}
				{#if data.eraporSemesterId}
					<span class="badge badge-primary badge-outline badge-sm font-mono">
						Semester: {data.eraporSemesterId}
					</span>
				{/if}
			</div>
		</div>

		<div class="mt-4 flex flex-wrap gap-1.5 border-t border-base-200 pt-3">
			{#each navItems as item (item.path)}
				<a
					href={resolve(item.path)}
					class="btn btn-xs sm:btn-sm gap-1.5 {isActive(item.path)
						? 'btn-primary'
						: 'btn-ghost bg-base-200/60'}"
				>
					<Icon name={item.icon} class="h-3.5 w-3.5" />
					{item.label}
				</a>
			{/each}
		</div>
	</div>

	{@render children()}
</div>
