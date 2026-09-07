<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { onMount } from 'svelte';
	import Icon from '$lib/components/icon.svelte';
	import { favoritesStore, type Favorite } from '$lib/stores/favorites.svelte';

	let { favorites = [] }: { favorites: Favorite[] } = $props();

	let editing = $state(false);

	onMount(() => {
		if (favoritesStore.items.length === 0 && favorites.length > 0) {
			favoritesStore.items = favorites;
		}
	});

	async function removeFavorite(id: number) {
		const fav = favoritesStore.items.find((f) => f.id === id);
		if (!fav) return;

		try {
			const res = await fetch('/api/favorites', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ path: fav.path })
			});
			if (res.ok) {
				favoritesStore.items = favoritesStore.items.filter((f) => f.id !== id);
			}
		} catch {
			// ignore
		}
	}
</script>

<div class="card-clean p-5 sm:p-6">
	<div
		class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800"
	>
		<div class="flex items-center gap-2">
			<Icon name="star" class="h-4 w-4 text-warning fill-current" />
			<h2
				class="font-display text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider"
			>
				Menu Favorit
			</h2>
			{#if favoritesStore.items.length > 0}
				<span class="badge badge-xs badge-soft badge-warning font-semibold">
					{favoritesStore.items.length}
				</span>
			{/if}
		</div>
		{#if favoritesStore.items.length > 0}
			<button
				class="btn btn-ghost btn-xs rounded-lg text-xs text-base-content/60 hover:text-base-content shadow-none"
				title={editing ? 'Selesai' : 'Kelola'}
				onclick={() => (editing = !editing)}
			>
				<Icon name={editing ? 'check' : 'edit'} class="h-3 w-3" />
				<span>{editing ? 'Selesai' : 'Edit'}</span>
			</button>
		{/if}
	</div>

	{#if favoritesStore.items.length === 0}
		<div class="py-4 text-center">
			<p class="text-xs text-base-content/60">
				Belum ada menu favorit. Tambahkan dengan mengklik tombol bintang pada bilah atas (navbar).
			</p>
		</div>
	{:else}
		<div class="max-h-48 overflow-y-auto pt-2">
			<ul class="space-y-1">
				{#each favoritesStore.items as fav (fav.id)}
					<li
						class="flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-slate-100/70 dark:hover:bg-slate-800/60 transition-all group"
					>
						<a
							href={fav.path}
							class="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-primary truncate flex-1"
						>
							<span class="h-1.5 w-1.5 rounded-full bg-primary/60"></span>
							<span class="truncate">{fav.title}</span>
						</a>
						{#if editing}
							<button
								type="button"
								class="btn btn-ghost btn-xs btn-circle text-error"
								onclick={() => removeFavorite(fav.id)}
								title="Hapus favorit"
							>
								<Icon name="del" class="h-3 w-3" />
							</button>
						{/if}
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>
