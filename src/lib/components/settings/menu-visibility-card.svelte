<script lang="ts">
	import { invalidate, invalidateAll } from '$app/navigation';
	import Icon from '$lib/components/icon.svelte';
	import { appMenuItems } from '$lib/components/menu';
	import { toast } from '$lib/components/toast.svelte';

	interface Props {
		initialHiddenPaths?: string[];
	}

	let { initialHiddenPaths = [] }: Props = $props();

	// svelte-ignore state_referenced_locally
	let hiddenSet = $state<Set<string>>(new Set(initialHiddenPaths));
	let saving = $state(false);
	let filterQuery = $state('');

	// Ekstrak semua item yang memiliki path dari appMenuItems
	interface FlatMenuItem {
		title: string;
		path: string;
		category: string;
		subCategory?: string;
	}

	function flattenMenus(items: typeof appMenuItems): FlatMenuItem[] {
		const flat: FlatMenuItem[] = [];

		for (const cat of items) {
			const catTitle = cat.title;

			if (cat.path) {
				flat.push({ title: cat.title, path: cat.path, category: catTitle });
			}

			if (cat.subMenu) {
				for (const sub of cat.subMenu) {
					if (sub.path) {
						flat.push({ title: sub.title, path: sub.path, category: catTitle });
					}
					if (sub.subMenu) {
						for (const subSub of sub.subMenu) {
							if (subSub.path) {
								flat.push({
									title: subSub.title,
									path: subSub.path,
									category: catTitle,
									subCategory: sub.title
								});
							}
						}
					}
				}
			}
		}

		return flat;
	}

	const allFlatMenus = flattenMenus(appMenuItems);

	// Kelompokkan per kategori untuk tampilan antarmuka terstruktur
	const categories = $derived.by(() => {
		const q = filterQuery.trim().toLowerCase();
		const map = new Map<string, FlatMenuItem[]>();

		for (const item of allFlatMenus) {
			if (
				q &&
				!item.title.toLowerCase().includes(q) &&
				!item.path.toLowerCase().includes(q) &&
				!item.category.toLowerCase().includes(q) &&
				!(item.subCategory && item.subCategory.toLowerCase().includes(q))
			) {
				continue;
			}

			const list = map.get(item.category) || [];
			list.push(item);
			map.set(item.category, list);
		}

		return Array.from(map.entries()).map(([name, items]) => ({
			name,
			items
		}));
	});

	function isHidden(path: string): boolean {
		return hiddenSet.has(path);
	}

	function toggleItem(path: string) {
		const next = new Set(hiddenSet);
		if (next.has(path)) {
			next.delete(path);
		} else {
			next.add(path);
		}
		hiddenSet = next;
	}

	function toggleCategory(catItems: FlatMenuItem[], hide: boolean) {
		const next = new Set(hiddenSet);
		for (const item of catItems) {
			if (hide) {
				next.add(item.path);
			} else {
				next.delete(item.path);
			}
		}
		hiddenSet = next;
	}

	// Preset fungsi cepat
	function applyPreset(preset: 'all' | 'sts' | 'semester' | 'non-asrama') {
		const next = new Set(hiddenSet);

		if (preset === 'all') {
			next.clear();
			toast('Seluruh menu ditampilkan kembali.', 'info');
		} else if (preset === 'sts') {
			// Sembunyikan formatif, sumatif, nilai akhir reguler; tampilkan rapor sisipan
			next.add('/asesmen-formatif');
			next.add('/asesmen-sumatif');
			next.add('/intrakurikuler-nilai-akhir');
			next.delete('/rapor-sisipan');
			toast('Preset STS diterapkan (Intrakurikuler reguler disembunyikan).', 'success');
		} else if (preset === 'semester') {
			// Sembunyikan rapor sisipan; tampilkan formatif, sumatif, nilai akhir reguler
			next.delete('/asesmen-formatif');
			next.delete('/asesmen-sumatif');
			next.delete('/intrakurikuler-nilai-akhir');
			next.add('/rapor-sisipan');
			toast('Preset Akhir Semester diterapkan (Rapor Sisipan disembunyikan).', 'success');
		} else if (preset === 'non-asrama') {
			next.add('/keasramaan');
			next.add('/asesmen-keasramaan');
			toast('Modul keasramaan disembunyikan.', 'info');
		}

		hiddenSet = next;
	}

	async function handleSave() {
		saving = true;
		try {
			const res = await fetch('/api/pengaturan/menu-visibility', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ hiddenMenuPaths: Array.from(hiddenSet) })
			});

			const data = await res.json();
			if (!res.ok) {
				throw new Error(data.error || 'Gagal menyimpan pengaturan.');
			}

			toast(data.message || 'Pengaturan visibilitas menu berhasil disimpan.', 'success');
			await invalidate('app:menu-visibility');
			await invalidateAll();
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			toast(msg, 'error');
		} finally {
			saving = false;
		}
	}
</script>

<section class="card bg-base-100 rounded-lg border border-none p-6 shadow-md">
	<header class="mb-4 space-y-2">
		<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h2 class="text-xl font-semibold flex items-center gap-2">
					<Icon name="gear" />
					Visibilitas Menu Guru
				</h2>
				<p class="text-base-content/70 mt-1 text-sm">
					Sembunyikan menu tertentu dari sidebar bagi akun guru dan wali kelas agar antarmuka lebih
					fokus (misalnya saat periode Rapor Sisipan). <strong>Admin dan Kepala Sekolah</strong> selalu
					dapat melihat semua menu.
				</p>
			</div>
			<div class="flex items-center gap-2 shrink-0">
				<button type="button" class="btn btn-primary btn-sm" onclick={handleSave} disabled={saving}>
					{#if saving}
						<span class="loading loading-spinner loading-xs"></span>
					{:else}
						<Icon name="save" />
					{/if}
					Simpan Pengaturan
				</button>
			</div>
		</div>

		<!-- Bar Preset Cepat -->
		<div class="bg-base-200/60 rounded-lg p-3 mt-4 space-y-2">
			<div class="flex flex-wrap items-center gap-2">
				<span
					class="text-xs font-semibold uppercase tracking-wider text-base-content/60 flex items-center gap-1"
				>
					<Icon name="sparkles" />
					Preset Cepat:
				</span>
				<button
					type="button"
					class="btn btn-xs btn-soft"
					onclick={() => applyPreset('all')}
					title="Tampilkan semua menu untuk guru"
				>
					Tampilkan Semua
				</button>
				<button
					type="button"
					class="btn btn-xs btn-soft btn-secondary"
					onclick={() => applyPreset('sts')}
					title="Sembunyikan intrakurikuler reguler agar guru fokus input nilai STS"
				>
					🎯 Mode Rapor Sisipan (STS)
				</button>
				<button
					type="button"
					class="btn btn-xs btn-soft btn-accent"
					onclick={() => applyPreset('semester')}
					title="Sembunyikan menu Rapor Sisipan saat masuk periode akhir semester"
				>
					🎓 Mode Rapor Akhir Semester
				</button>
				<button
					type="button"
					class="btn btn-xs btn-soft"
					onclick={() => applyPreset('non-asrama')}
					title="Sembunyikan menu keasramaan"
				>
					Sekolah Non-Asrama
				</button>
			</div>
		</div>

		<!-- Pencarian / Filter -->
		<div class="pt-2">
			<label
				class="input input-sm bg-base-200 dark:bg-base-300 w-full max-w-sm flex items-center gap-2"
			>
				<Icon name="search" />
				<input
					type="text"
					bind:value={filterQuery}
					placeholder="Cari nama menu atau path..."
					class="grow"
				/>
				{#if filterQuery}
					<button
						type="button"
						class="btn btn-ghost btn-xs btn-circle"
						onclick={() => (filterQuery = '')}
						aria-label="Bersihkan pencarian"
					>
						<Icon name="del" />
					</button>
				{/if}
			</label>
		</div>
	</header>

	<!-- Daftar Menu per Kategori -->
	<div class="mt-4 space-y-4">
		{#if categories.length === 0}
			<div class="alert alert-warning">
				<Icon name="alert" />
				<span>Tidak ada menu yang cocok dengan pencarian "{filterQuery}".</span>
			</div>
		{:else}
			{#each categories as cat (cat.name)}
				{@const allHiddenInCat = cat.items.every((it) => isHidden(it.path))}
				<div class="border-base-300 rounded-box border overflow-hidden">
					<div class="bg-base-200/50 flex items-center justify-between px-4 py-2.5">
						<span class="font-semibold text-sm">{cat.name}</span>
						<div class="flex items-center gap-1.5">
							<button
								type="button"
								class="btn btn-ghost btn-xs"
								onclick={() => toggleCategory(cat.items, !allHiddenInCat)}
							>
								{allHiddenInCat ? 'Tampilkan Semua Grup' : 'Sembunyikan Semua Grup'}
							</button>
						</div>
					</div>

					<div class="overflow-x-auto">
						<table class="table table-sm w-full">
							<thead>
								<tr class="text-xs text-base-content/60">
									<th>Nama Menu</th>
									<th>Rute (URL)</th>
									<th class="text-center">Status untuk Guru</th>
									<th class="text-center w-28">Visibilitas</th>
								</tr>
							</thead>
							<tbody>
								{#each cat.items as item (item.path)}
									{@const hidden = isHidden(item.path)}
									<tr class="hover:bg-base-200/30 transition-colors">
										<td>
											<div class="font-medium">
												{#if item.subCategory}
													<span class="text-base-content/50 text-xs font-normal">
														{item.subCategory} ➔
													</span>
												{/if}
												{item.title}
											</div>
										</td>
										<td>
											<code class="text-xs font-mono text-base-content/70">{item.path}</code>
										</td>
										<td class="text-center">
											{#if hidden}
												<span class="badge badge-warning badge-sm gap-1">
													<Icon name="eye-off" />
													Disembunyikan
												</span>
											{:else}
												<span class="badge badge-success badge-sm gap-1">
													<Icon name="eye" />
													Tampil
												</span>
											{/if}
										</td>
										<td class="text-center">
											<input
												type="checkbox"
												class="toggle toggle-primary toggle-sm"
												checked={!hidden}
												onchange={() => toggleItem(item.path)}
												title={hidden ? 'Klik untuk menampilkan' : 'Klik untuk menyembunyikan'}
												aria-label={`Ubah visibilitas menu ${item.title}`}
											/>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/each}
		{/if}
	</div>

	<!-- Ringkasan Footer -->
	<footer
		class="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-base-200 pt-4"
	>
		<div class="text-xs text-base-content/70">
			{#if hiddenSet.size === 0}
				<span>Semua menu aktif dan tampil untuk guru.</span>
			{:else}
				<span class="text-warning font-medium">
					{hiddenSet.size} menu sedang disembunyikan dari guru.
				</span>
			{/if}
		</div>
		<button type="button" class="btn btn-primary btn-sm" onclick={handleSave} disabled={saving}>
			{#if saving}
				<span class="loading loading-spinner loading-xs"></span>
			{:else}
				<Icon name="save" />
			{/if}
			Simpan Pengaturan
		</button>
	</footer>
</section>
