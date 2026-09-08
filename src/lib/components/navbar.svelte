<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { page } from '$app/state';
	import DarkMode from '$lib/components/dark-mode.svelte';
	import Icon from '$lib/components/icon.svelte';
	import TasksModal from '$lib/components/modal-tasks.svelte';
	import { toast } from '$lib/components/toast.svelte';
	import { showModal } from '$lib/components/global-modal.svelte';
	import { favoritesStore } from '$lib/stores/favorites.svelte';
	import { onMount } from 'svelte';
	import type { Component } from 'svelte';

	type NavbarProps = {
		stopServer?: () => void;
		stoppingServer?: boolean;
		logout?: () => void;
		loggingOut?: boolean;
	};

	// Minimal local type for the user object shape we reference here.
	type UserLike = {
		pegawaiName?: string;
		username?: string;
		permissions?: string[];
		type?: 'admin' | 'kepala_sekolah' | 'user' | 'wali_asuh';
	};

	let {
		stopServer = () => {},
		stoppingServer = false,
		logout = () => {},
		loggingOut = false
	}: NavbarProps = $props();

	let tasksModalRef: { open: () => void } | null = null;
	const daftarKelas = $derived(page.data.daftarKelas ?? []);
	const kelasAktif = $derived(page.data.kelasAktif ?? null);
	const user = $derived(page.data.user ?? null);
	const kelasAktifLabel = $derived.by(() => {
		if (!kelasAktif) return 'Pilih Kelas';
		return kelasAktif.fase ? `${kelasAktif.nama} - ${kelasAktif.fase}` : kelasAktif.nama;
	});

	// Human-readable display name for current user (prefer pegawaiName if available)
	const displayUserName = $derived.by(() => {
		if (!user) return null;
		// use runtime field `pegawaiName` if the server provided it, otherwise fall back to username
		return (user as UserLike)?.pegawaiName ?? (user as UserLike)?.username ?? null;
	});

	// Whether current user can stop the server (client-side guard)
	// Allow users who explicitly have the `server_stop` permission, or
	// any user of type 'admin' (administrators can stop the server by default).
	const canStopServer = $derived.by(() => {
		if (!user) return false;
		// Admins should be allowed regardless of explicit permissions
		if ((user as UserLike).type === 'admin') return true;
		const perms = (user as UserLike)?.permissions ?? [];
		return Array.isArray(perms) ? perms.includes('server_stop') : false;
	});

	import SvelteURLSearchParams from '$lib/svelte-helpers/url-search-params';
	import { resolveHelpFile } from '$lib/help-maps';
	import { parseJenjangKelas, sortKelasNatural } from '$lib/utils.js';

	let searchQuery = $state('');
	let selectedJenjang = $state('Semua');

	type KelasItem = {
		id: number;
		nama: string;
		fase: string | null;
		waliKelas?: { id: number; nama: string } | null;
	};

	const sortedDaftarKelas = $derived.by(() => {
		const list: KelasItem[] = [...(daftarKelas as KelasItem[])];
		list.sort(sortKelasNatural);
		return list;
	});

	const availableJenjangList = $derived.by(() => {
		const set = new Set<string>();
		for (const k of sortedDaftarKelas) {
			set.add(parseJenjangKelas(k.nama));
		}
		return Array.from(set).sort((a, b) => sortKelasNatural(a, b));
	});

	const filteredDaftarKelas = $derived.by(() => {
		let list = sortedDaftarKelas;
		if (selectedJenjang !== 'Semua') {
			list = list.filter((k) => parseJenjangKelas(k.nama) === selectedJenjang);
		}
		const q = searchQuery.trim().toLowerCase();
		if (q) {
			list = list.filter((k) => {
				const nama = k.nama.toLowerCase();
				const fase = (k.fase || '').toLowerCase();
				const wali = (k.waliKelas?.nama || '').toLowerCase();
				return nama.includes(q) || fase.includes(q) || wali.includes(q);
			});
		}
		return list;
	});

	function buildKelasHref(kelasId: number) {
		const params = new SvelteURLSearchParams(page.url.search);
		params.set('kelas_id', String(kelasId));
		const query = params.toString();
		return query ? `${page.url.pathname}?${query}` : page.url.pathname;
	}

	function hasPindahPermission() {
		if (user?.type === 'wali_asuh') return true;
		const perms = user?.permissions ?? [];
		return perms.includes('kelas_pindah');
	}

	function handleKelasClick(e: MouseEvent) {
		if (hasPindahPermission()) {
			// allow navigation
			return;
		}
		// prevent navigation and show logout confirmation modal
		e.preventDefault();
		showModal({
			title: 'Konfirmasi Keluar',
			body: 'Anda tidak mempunyai akses untuk Pindah Kelas secara langsung, silakan masuk ulang ke kelas yang dituju. Keluar sekarang?',
			dismissible: true,
			onPositive: {
				label: 'Keluar',
				icon: 'export',
				action: ({ close }: { close: () => void }) => {
					close();
					logout();
				}
			},
			onNegative: { label: 'Batal', icon: 'close' }
		});
	}

	function onSelectKelas(e: MouseEvent) {
		handleKelasClick(e);
		if (document.activeElement instanceof HTMLElement) {
			document.activeElement.blur();
		}
	}

	/**
	 * Return an excerpt of `text` limited to `limit` characters.
	 * If text is shorter than or equal to limit, return it unchanged.
	 */
	function excerpt(text: string | null | undefined, limit = 16) {
		if (!text) return text;
		return text.length > limit ? text.slice(0, limit) + '…' : text;
	}

	async function getHelpPage(fileName: string) {
		const page = await import(`../../docs/help/${fileName}.md`);
		return {
			meta: page.metadata as { title: string },
			ContentPage: page.default as Component
		};
	}

	let loadingFav = $state(true);

	onMount(async () => {
		loadingFav = true;
		const ssrFavorites = page.data.favorites;
		if (Array.isArray(ssrFavorites) && ssrFavorites.length > 0) {
			favoritesStore.items = ssrFavorites;
			loadingFav = false;
			return;
		}
		try {
			const res = await fetch('/api/favorites');
			if (res.ok) {
				const data = await res.json();
				favoritesStore.items = data.favorites;
			}
		} catch {
			// ignore
		} finally {
			loadingFav = false;
		}
	});

	const isFavorited = $derived(favoritesStore.items.some((f) => f.path === page.url.pathname));
	const currentTitle = $derived(page.data.meta?.title || '');

	async function toggleFavorite() {
		if (loadingFav) return;
		const path = page.url.pathname;
		const title = currentTitle;
		if (!title) return;

		try {
			if (isFavorited) {
				const res = await fetch('/api/favorites', {
					method: 'DELETE',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ path })
				});
				if (res.ok) {
					favoritesStore.items = favoritesStore.items.filter((f) => f.path !== path);
				}
			} else {
				const res = await fetch('/api/favorites', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ path, title })
				});
				if (res.ok) {
					const data = await res.json();
					favoritesStore.items = [...favoritesStore.items, data.favorite];
				}
			}
		} catch {
			// ignore
		}
	}

	async function showHelp() {
		const pathname = page.url.pathname.replace(/\/+$/, '') || '/';
		const fileName = resolveHelpFile(pathname);
		if (!fileName) {
			toast(
				`Tombol ini berfungsi untuk menampilkan petunjuk penggunaan.<br />` +
					`Silakan klik salah satu menu lalu klik lagi tombol ini.`
			);
			return;
		}
		const result = await getHelpPage(fileName);
		showModal({
			title: result.meta.title,
			body: result.ContentPage,
			dismissible: true
		});
	}
</script>

<div class="navbar glass-navbar sticky top-0 z-30 px-3 py-2 transition-colors">
	<div class="flex-none lg:hidden">
		<label for="my-drawer-2" class="btn btn-square btn-ghost drawer-button">
			<span class="text-lg">
				<Icon name="menu-drawer" />
			</span>
		</label>
	</div>

	{#if currentTitle && page.url.pathname !== '/'}
		<button
			class="btn btn-ghost btn-circle shadow-none"
			title={isFavorited ? 'Hapus dari favorit' : 'Tambah ke favorit'}
			onclick={toggleFavorite}
			disabled={loadingFav}
		>
			<span class="text-xl">
				<Icon name="star" class={isFavorited ? 'text-warning fill-current' : ''} />
			</span>
		</button>
	{/if}
	<span
		class="font-display mx-2 flex-1 truncate px-2 text-base font-bold text-slate-800 md:text-lg dark:text-slate-100"
	>
		{currentTitle}
	</span>
	<div class="ml-auto flex-none">
		<ul class="flex items-center gap-1.5 px-1">
			<!-- tasks modal for mobile -->
			<li>
				<button
					class="btn btn-ghost btn-circle shadow-none xl:hidden"
					aria-label="Daftar Tugas"
					title="Daftar Tugas"
					onclick={() => tasksModalRef?.open()}
				>
					<Icon name="check" class="text-lg" />
				</button>
			</li>

			<!-- Dark Mode -->
			<li>
				<DarkMode />
			</li>

			<!-- Help -->
			<li>
				<button
					class="btn btn-ghost btn-circle shadow-none"
					aria-label="Bantuan"
					title="Petunjuk"
					onclick={showHelp}
				>
					<span class="text-lg opacity-80">
						<Icon name="question" />
					</span>
				</button>
			</li>

			<!-- Dropdown ganti kelas aktif -->
			<li class="ml-0.5">
				<div class="dropdown dropdown-end">
					<div
						tabindex="0"
						role="button"
						title="Ganti kelas aktif"
						class="btn btn-sm btn-soft btn-primary font-semibold text-xs px-2.5 sm:px-3 gap-1.5 rounded-full hover:shadow-xs transition-all border border-primary/20"
					>
						<Icon name="users" class="h-3.5 w-3.5" />
						<span class="max-w-24 sm:max-w-36 truncate">{excerpt(kelasAktifLabel, 16)}</span>
						<Icon name="select" class="h-3 w-3 opacity-70" />
					</div>
					<div
						class="dropdown-content bg-base-100 border border-slate-200/80 dark:border-slate-800 z-50 mt-3 w-72 sm:w-80 rounded-2xl p-3 shadow-xl focus:outline-none"
					>
						<!-- Header -->
						<div
							class="flex items-center justify-between px-1 py-1 border-b border-slate-200/60 dark:border-slate-800 mb-2"
						>
							<span
								class="text-xs font-bold text-base-content/80 uppercase tracking-wider flex items-center gap-1.5"
							>
								<Icon name="users" class="h-3.5 w-3.5 text-primary" />
								Pilih Rombel / Kelas
							</span>
							{#if kelasAktif}
								<span class="badge badge-xs badge-primary font-bold">{kelasAktif.nama}</span>
							{/if}
						</div>

						<!-- Search Input -->
						<div class="mb-2">
							<div class="relative">
								<input
									type="text"
									bind:value={searchQuery}
									placeholder="Cari rombel..."
									class="input input-sm input-bordered w-full rounded-xl pl-8 pr-7 text-xs bg-base-200/60 focus:bg-base-100"
								/>
								<div
									class="absolute left-2.5 top-1/2 -translate-y-1/2 text-base-content/50 pointer-events-none"
								>
									<Icon name="search" class="h-3.5 w-3.5" />
								</div>
								{#if searchQuery}
									<button
										type="button"
										class="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-base-content/40 hover:text-base-content"
										onclick={() => (searchQuery = '')}
									>
										✕
									</button>
								{/if}
							</div>
						</div>

						<!-- Filter Jenjang Tabs -->
						{#if availableJenjangList.length > 1}
							<div class="flex flex-wrap gap-1 mb-2">
								{#each ['Semua', ...availableJenjangList] as j (j)}
									<button
										type="button"
										class="px-2.5 py-1 rounded-lg text-xs font-medium transition-all {selectedJenjang ===
										j
											? 'bg-primary text-primary-content font-bold shadow-xs'
											: 'bg-base-200/70 hover:bg-base-200 text-base-content/70'}"
										onclick={() => (selectedJenjang = j)}
									>
										{j}
									</button>
								{/each}
							</div>
						{/if}

						<!-- List Kelas Grid -->
						{#if filteredDaftarKelas.length}
							<div class="grid grid-cols-2 gap-1.5 max-h-60 overflow-y-auto pr-1">
								{#each filteredDaftarKelas as kelas (kelas.id)}
									{@const label = kelas.nama}
									<a
										class="flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-all {kelasAktif?.id ===
										kelas.id
											? 'bg-primary text-primary-content font-bold shadow-xs'
											: 'hover:bg-base-200 text-base-content/80 border border-transparent hover:border-base-300'}"
										href={buildKelasHref(kelas.id)}
										onclick={onSelectKelas}
										title={kelas.fase ? `${kelas.nama} - ${kelas.fase}` : kelas.nama}
									>
										<span class="truncate">{label}</span>
										{#if kelasAktif?.id === kelas.id}
											<Icon name="check" class="h-3.5 w-3.5 shrink-0" />
										{/if}
									</a>
								{/each}
							</div>
						{:else}
							<p class="text-base-content/60 text-xs px-2 py-4 text-center">
								{searchQuery || selectedJenjang !== 'Semua'
									? 'Tidak ada kelas yang cocok dengan filter.'
									: 'Belum ada data kelas yang dapat dipilih.'}
							</p>
						{/if}
					</div>
				</div>
			</li>

			<!-- Dropdown profil pengguna -->
			<li class="ml-1">
				<div class="dropdown dropdown-end">
					<div
						tabindex="0"
						role="button"
						title="Profil pengguna"
						class="btn btn-ghost btn-circle avatar shadow-none"
					>
						<div
							class="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm border border-primary/20"
						>
							{(displayUserName || user?.username || 'U')[0].toUpperCase()}
						</div>
					</div>
					<div
						class="dropdown-content bg-base-100 border border-slate-200/80 dark:border-slate-800 z-50 mt-3 w-72 rounded-2xl p-4 shadow-xl focus:outline-none"
					>
						<!-- User Info Header -->
						<div
							class="flex items-center gap-3 pb-3 border-b border-slate-200/60 dark:border-slate-800"
						>
							<div
								class="w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-base border border-primary/20 shadow-xs"
							>
								{(displayUserName || user?.username || 'U')[0].toUpperCase()}
							</div>
							<div class="flex flex-col min-w-0">
								<p class="font-bold text-sm text-base-content truncate">
									{displayUserName || user?.username}
								</p>
								<div class="flex items-center gap-1.5 mt-0.5">
									{#if user?.type === 'admin'}
										<span class="badge badge-xs badge-primary font-medium">Admin</span>
									{:else if user?.type === 'kepala_sekolah'}
										<span class="badge badge-xs badge-info font-medium">Kepala Sekolah</span>
									{:else if user?.type === 'wali_kelas'}
										<span class="badge badge-xs badge-secondary font-medium">Wali Kelas</span>
									{:else if user?.type === 'wali_asuh'}
										<span class="badge badge-xs badge-accent font-medium">Wali Asuh</span>
									{:else}
										<span class="badge badge-xs badge-neutral font-medium">Guru Mapel</span>
									{/if}
									<span class="text-[10px] text-base-content/50">SMAN 1 Gedeg</span>
								</div>
							</div>
						</div>

						<!-- Links -->
						<div class="py-2 flex flex-col gap-1">
							<a
								href="/pengaturan/profil"
								class="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-base-content/80 hover:bg-base-200 transition-all"
							>
								<Icon name="user" class="h-4 w-4 text-base-content/60" />
								<span>Profil Saya</span>
							</a>
							{#if user?.type === 'admin'}
								<a
									href="/pengguna"
									class="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-base-content/80 hover:bg-base-200 transition-all"
								>
									<Icon name="users" class="h-4 w-4 text-base-content/60" />
									<span>Manajemen Pengguna</span>
								</a>
							{/if}
							<a
								href="/pengaturan"
								class="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-base-content/80 hover:bg-base-200 transition-all"
							>
								<Icon name="gear" class="h-4 w-4 text-base-content/60" />
								<span>Pengaturan Aplikasi</span>
							</a>
						</div>

						<!-- Actions -->
						<div class="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex gap-2">
							<button
								class="btn btn-sm btn-soft btn-error flex-1 rounded-xl shadow-none"
								type="button"
								onclick={logout}
								disabled={loggingOut}
							>
								<Icon name="export" class="h-3.5 w-3.5" />
								<span>{loggingOut ? 'Keluar…' : 'Keluar'}</span>
							</button>
							{#if canStopServer}
								<button
									class="btn btn-sm btn-ghost text-base-content/60 hover:text-error rounded-xl shadow-none"
									type="button"
									title="Stop Server"
									onclick={stopServer}
									disabled={stoppingServer}
								>
									<Icon name="power" class="h-3.5 w-3.5" />
								</button>
							{/if}
						</div>
					</div>
				</div>
			</li>
		</ul>
	</div>
</div>

<!-- Tempel instance modal di bawah navbar dan bind ref -->
<TasksModal bind:this={tasksModalRef} />
