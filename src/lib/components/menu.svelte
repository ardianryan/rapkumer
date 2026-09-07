<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { page } from '$app/state';
	import { StorageState } from '$lib/state.svelte';
	import { searchQueryMarker } from '$lib/utils';
	import Icon from './icon.svelte';
	import { appMenuItems } from './menu';
	import {
		isAuthorizedUser,
		resolveRoutePermission,
		WALI_KELAS_ONLY_PERMISSIONS
	} from '../../routes/pengguna/permissions';

	const expanded = new StorageState<boolean>('menu-expanded');

	let search = $state('');
	const activeSemesterTipe = $derived(
		(page.data as { activeSemesterTipe?: string | null } | null)?.activeSemesterTipe ?? null
	);

	const user = $derived(
		(
			page.data as {
				user?:
					| (Pick<AuthUser, 'permissions' | 'type'> & {
							kelasId?: number | null;
							ownKelasIds?: number[] | null;
					  })
					| null;
			} | null
		)?.user ?? null
	);

	const presensiGuruEnabled = $derived(
		(page.data as { presensiGuruEnabled?: boolean } | null)?.presensiGuruEnabled ?? true
	);

	const kelasAktif = $derived(
		(page.data as { kelasAktif?: { id: number } | null } | null)?.kelasAktif ?? null
	);

	function isHiddenForUser(path?: string): boolean {
		// Menu items without a path (parent groups) are filtered recursively via subMenu
		if (!path) return false;
		if (path === '/presensi-guru' && !presensiGuruEnabled) return true;
		// /dinas-luar is the permohonan feature for non-admin roles; admin & kepala
		// sekolah manage perjalanan dinas via the full /sppd page instead.
		if (
			path === '/dinas-luar' &&
			user &&
			(user.type === 'admin' || user.type === 'kepala_sekolah')
		) {
			return true;
		}
		// Wali kelas on non-own class: downgrade to guru-level permissions
		if (user?.type === 'wali_kelas' && kelasAktif?.id != null) {
			const ownIds = user.ownKelasIds?.length
				? user.ownKelasIds
				: user.kelasId != null
					? [user.kelasId]
					: [];
			if (ownIds.length > 0 && !ownIds.includes(kelasAktif.id)) {
				const required = resolveRoutePermission(path);
				if (required && WALI_KELAS_ONLY_PERMISSIONS.has(required)) {
					return true;
				}
			}
		}
		const required = resolveRoutePermission(path);
		if (!required) return false;
		return !isAuthorizedUser([required], user ?? undefined);
	}

	function filterMenuByUserType(items: MenuItem[]): MenuItem[] {
		return items
			.map((item) => {
				if (isHiddenForUser(item.path)) return null;
				if (item.subMenu) {
					const subMenu = item.subMenu;
					const filtered = filterMenuByUserType(subMenu);
					if (filtered.length === 0 && !item.path) return null;
					// Reuse the original item reference when nothing changed so the
					// keyed {#each} doesn't recreate <details> (preserves manual open/close).
					if (
						filtered.length === subMenu.length &&
						filtered.every((child, i) => child === subMenu[i])
					) {
						return item;
					}
					return { ...item, subMenu: filtered };
				}
				return item;
			})
			.filter((item): item is MenuItem => item !== null);
	}

	function filterByCondition(item: MenuItem, semesterTipe: string | null): boolean {
		if (item.condition && item.condition !== semesterTipe) return false;
		if (item.subMenu) {
			const hasVisibleChild = item.subMenu.some((child) => filterByCondition(child, semesterTipe));
			if (!hasVisibleChild) return false;
		}
		return true;
	}

	function filterMenuByCondition(items: MenuItem[], semesterTipe: string | null): MenuItem[] {
		return items
			.map((item) => {
				if (item.condition && item.condition !== semesterTipe) return null;
				if (item.subMenu) {
					const subMenu = item.subMenu;
					const filtered = filterMenuByCondition(subMenu, semesterTipe);
					if (filtered.length === 0) return null;
					// Reuse the original item reference when nothing changed so the
					// keyed {#each} doesn't recreate <details> (preserves manual open/close).
					if (
						filtered.length === subMenu.length &&
						filtered.every((child, i) => child === subMenu[i])
					) {
						return item;
					}
					return { ...item, subMenu: filtered };
				}
				return item;
			})
			.filter((item): item is MenuItem => item !== null);
	}

	function filterMenu(menu: MenuItem[], search: string): MenuItem[] {
		const lowerSearch = search.toLowerCase();
		return menu
			.map((item) => {
				if (!filterByCondition(item, activeSemesterTipe)) return null;

				const isMatch =
					item.title.toLowerCase().includes(lowerSearch) ||
					item.tags?.some((t) => t.toLocaleLowerCase().includes(lowerSearch));

				// if it has subMenu, filter recursively
				const filteredSubMenu = item.subMenu ? filterMenu(item.subMenu, search) : [];

				// keep this item if it matches or has matching children
				if (isMatch || filteredSubMenu.length > 0) {
					return {
						...item,
						subMenu: filteredSubMenu.length > 0 ? filteredSubMenu : undefined
					};
				}

				// discard
				return null;
			})
			.filter((item) => item !== null);
	}

	let menuItems = $derived(
		filterMenuByUserType(
			search
				? filterMenu(appMenuItems, search)
				: filterMenuByCondition(appMenuItems, activeSemesterTipe)
		)
	);

	function isMenuActive(currentPath: string, menuPath?: string) {
		if (!menuPath) return false;

		// match to sub paths
		const normalizedPath = currentPath.replace(/\/+$/, '');
		const normalizedItemPath = menuPath.replace(/\/+$/, '');
		const active =
			normalizedPath === normalizedItemPath || normalizedPath.startsWith(normalizedItemPath + '/');
		return active;
	}
</script>

{#snippet menu_item(item: MenuItem)}
	{@const active = isMenuActive(page.url.pathname, item.path)}
	<li class="w-full">
		{#if item.subMenu}
			<details open={expanded.value || !!search} class="group w-full">
				<summary
					class="w-full rounded-xl py-2 px-2.5 text-xs font-semibold text-base-content/80 hover:bg-base-200/80 hover:text-base-content transition-colors flex items-center"
				>
					{@render menu_item_label(item)}
				</summary>
				<ul
					class="my-0.5 space-y-0.5 border-l-2 border-slate-200/80 dark:border-slate-800 ml-3 pl-1.5 w-full flex-col flex-nowrap"
				>
					{#each item.subMenu as menu (menu.path ?? menu.title)}
						{@render menu_item(menu)}
					{/each}
				</ul>
			</details>
		{:else}
			<a
				class="w-full rounded-xl py-2 px-2.5 text-xs font-medium transition-all flex items-center {active
					? 'bg-primary/10 text-primary font-bold shadow-2xs'
					: 'text-base-content/75 hover:bg-base-200/80 hover:text-base-content'}"
				href={item.path}
			>
				{@render menu_item_label(item)}
			</a>
		{/if}
	</li>
{/snippet}

{#snippet menu_item_label(item: MenuItem)}
	{#if item.icon}
		<Icon name={item.icon} class="h-4 w-4 shrink-0 opacity-80" />
	{/if}
	<span class="truncate">{@html searchQueryMarker(search, item.title)}</span>
	{#if search && item.tags?.length}
		<div
			class="badge badge-xs badge-soft badge-primary ml-auto text-[10px]"
			title="Termasuk di dalam menu"
		>
			tag
		</div>
	{/if}
{/snippet}

<div class="flex-1 flex flex-col min-h-0 w-full">
	<div class="mb-2.5 flex items-center gap-1.5 shrink-0 w-full">
		<label
			class="input input-sm border-slate-200/80 dark:border-slate-800/80 bg-slate-100/80 dark:bg-base-200 rounded-xl flex items-center gap-2 grow px-3 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all"
		>
			<Icon name="search" class="h-3.5 w-3.5 text-base-content/50 shrink-0" />
			<input type="search" class="grow text-xs" bind:value={search} placeholder="Cari menu..." />
		</label>
		<label
			class="btn btn-sm btn-ghost btn-square rounded-xl text-base-content/60 hover:bg-base-200 shadow-none cursor-pointer shrink-0"
			title={expanded.value ? 'Sempitkan menu' : 'Luaskan menu'}
		>
			<input type="checkbox" class="hidden" bind:checked={expanded.value} />
			<Icon name={expanded.value ? 'collapse-all' : 'expand-all'} class="h-4 w-4" />
		</label>
	</div>
	<div class="flex-1 overflow-y-auto overflow-x-hidden max-h-[calc(100vh-14rem)] pr-0.5 w-full">
		<ul class="menu menu-sm p-0 w-full flex-col flex-nowrap space-y-0.5">
			{#each menuItems as menu (menu.path ?? menu.title)}
				{@render menu_item(menu)}
			{:else}
				<li>
					<span class="italic text-base-content/50 text-xs px-2 py-3"
						>Tidak ada hasil pencarian</span
					>
				</li>
			{/each}
		</ul>
	</div>
</div>
