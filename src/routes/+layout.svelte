<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- layout contains many intentional href links for navigation */
	import { page } from '$app/state';
	import { dev } from '$app/environment';
	import { invalidate, onNavigate } from '$app/navigation';
	import GlobalModal, { showModal } from '$lib/components/global-modal.svelte';
	import Icon from '$lib/components/icon.svelte';
	import Menu from '$lib/components/menu.svelte';
	import Navbar from '$lib/components/navbar.svelte';
	import Task from '$lib/components/tasks.svelte';
	import FavoriteMenusSidebar from '$lib/components/dashboard/favorite-menus-sidebar.svelte';
	import KodeKegiatan from '$lib/components/jadwal-bell/kode-kegiatan.svelte';
	import TambahKegiatanModal from '$lib/components/jadwal-bell/tambah-kegiatan-modal.svelte';
	import Toast, { toast } from '$lib/components/toast.svelte';
	import { jadwalIsEditing } from '$lib/stores/jadwal-edit';
	import { get } from 'svelte/store';

	import NavIndicator from '$lib/components/nav-indicator.svelte';
	import ScrollToTop from '$lib/components/scroll-to-top.svelte';
	import FavoriteMenusFab from '$lib/components/dashboard/favorite-menus-fab.svelte';
	import PresensiGuruModal from '$lib/components/presensi-guru/presensi-guru-modal.svelte';
	import '../app.css';

	let { data, children } = $props();

	const appName = 'Rapkumer';
	let stoppingServer = $state(false);
	let loggingOut = $state(false);

	// Close the mobile drawer when a menu item triggers client-side navigation.
	// The toggle checkbox lives in the layout (survives soft navigation), so
	// without this the drawer + overlay stay open on the target page and block
	// all clicks until a manual reload.
	onNavigate(() => {
		const drawerToggle = document.getElementById('my-drawer-2') as HTMLInputElement | null;
		if (drawerToggle) drawerToggle.checked = false;
	});

	const isLoginPage = $derived(page.url.pathname === '/login');
	const isTamuPage = $derived(page.url.pathname === '/tamu');
	const isJadwalPublikPage = $derived(page.url.pathname === '/jadwal-pelajaran');
	// When not authenticated, never render the drawer/navbar shell — not even for
	// error pages (e.g. 404 on an unknown URL). This avoids exposing the app menu
	// structure to anonymous visitors.
	const isUnauthenticatedError = $derived(!!page.error && !data.user);
	let isJadwalPage = $derived(page.url.pathname === '/akademik/jadwal-pelajaran');

	const skipPresensiGuruPrompt = $derived(
		isLoginPage ||
			isTamuPage ||
			isJadwalPublikPage ||
			page.url.pathname.startsWith('/logout') ||
			data.presensiGuruEnabled === false
	);
	let presensiGuruPromptChecked = $state(false);
	let presensiGuruShown = $state(false);

	const SIMULASI_STORAGE_KEY = 'rapkumer-simulasi-tanggal-jam';
	let simulasiTanggalJam = $state<string | null>(null);

	$effect(() => {
		if (!dev) return;
		const fromUrl = page.url.searchParams.get('tanggal-jam');
		if (fromUrl) {
			sessionStorage.setItem(SIMULASI_STORAGE_KEY, fromUrl);
		}
		simulasiTanggalJam = fromUrl ?? sessionStorage.getItem(SIMULASI_STORAGE_KEY) ?? null;
	});

	function resetSimulasi() {
		sessionStorage.removeItem(SIMULASI_STORAGE_KEY);
		simulasiTanggalJam = null;
	}

	$effect(() => {
		const user = data.user;
		if (!user || skipPresensiGuruPrompt || presensiGuruPromptChecked || presensiGuruShown) return;

		const override =
			page.url.searchParams.get('tanggal-jam') ??
			(dev ? sessionStorage.getItem(SIMULASI_STORAGE_KEY) : null);
		if (override) {
			sessionStorage.setItem(SIMULASI_STORAGE_KEY, override);
		}

		presensiGuruPromptChecked = true;

		const today = new Date().toISOString().slice(0, 10);
		const simulatedDate = override ? override.slice(0, 10) : null;
		const effectiveDate =
			simulatedDate && /^\d{4}-\d{2}-\d{2}$/.test(simulatedDate) ? simulatedDate : today;
		const storageKey = `rapkumer-presensi-guru-prompted-${user.id}-${effectiveDate}`;
		if (sessionStorage.getItem(storageKey)) return;

		const apiUrl = `/api/presensi-guru${override ? `?tanggal-jam=${encodeURIComponent(override)}` : ''}`;

		fetch(apiUrl)
			.then((res) => (res.ok ? res.json() : null))
			.then((status) => {
				if (!status?.shouldPrompt) return;
				presensiGuruShown = true;
				sessionStorage.setItem(storageKey, '1');
				showModal({
					title: 'Presensi Guru',
					body: PresensiGuruModal,
					bodyProps: {
						jamMasuk: status.jamMasuk ?? null,
						jamPulang: status.jamPulang ?? null,
						tanggalJam: override
					},
					dismissible: false
				});
			})
			.catch(() => {
				presensiGuruPromptChecked = false;
			});
	});
	const jadwalCanManage = $derived(
		((page.data.user as { permissions?: string[] })?.permissions ?? []).includes(
			'informasi_umum_akademik'
		)
	);

	async function handleHapusKegiatan(kode: string) {
		if (!jadwalCanManage || !get(jadwalIsEditing)) return;
		const formData = new FormData();
		formData.append('kode', kode);

		try {
			const res = await fetch('?/hapusKegiatan', {
				method: 'POST',
				body: formData,
				redirect: 'error'
			});

			if (!res.ok) {
				const err = await res.json().catch(() => ({ fail: 'Gagal menghapus kegiatan' }));
				throw new Error(err.fail ?? `Error ${res.status}`);
			}

			toast('Kegiatan berhasil dihapus', 'success');
			await invalidate('app:jadwal-bell');
		} catch (e) {
			toast(e instanceof Error ? e.message : 'Gagal menghapus kegiatan', 'error');
		}
	}

	function openEditKegiatan(kegiatan: { kode: string; nama: string; durasi: number | null }) {
		let actions: { submit: () => Promise<void>; cancel: () => void };
		showModal({
			title: 'Edit Kegiatan',
			body: TambahKegiatanModal,
			bodyProps: {
				onAction: (a: typeof actions) => {
					actions = a;
				},
				existingKegiatan: kegiatan
			},
			onPositive: {
				label: 'Simpan',
				action: () => actions!.submit()
			},
			onNegative: { label: 'Batal' },
			dismissible: false
		});
	}

	const readonlyRoutes = [
		'/murid',
		'/kokurikuler',
		'/ekstrakurikuler',
		'/keasramaan',
		'/asesmen-kokurikuler',
		'/nilai-ekstrakurikuler',
		'/asesmen-keasramaan',
		'/presensi-murid',
		'/jurnal-mengajar',
		'/catatan-wali-kelas',
		'/keputusan',
		'/cetak'
	];

	let kodeKegiatanOpen = $state(true);
	const isReadonlyPage = $derived(
		readonlyRoutes.some((r) => page.url.pathname === r || page.url.pathname.startsWith(r + '/'))
	);

	const userIsGuruMapel = $derived(data.user?.type === 'user' && data.hasMataPelajaran);
	const isPresensiMuridPage = $derived(page.url.pathname.startsWith('/presensi-murid'));
	const isJurnalMengajarPage = $derived(page.url.pathname.startsWith('/jurnal-mengajar'));
	const isCetakPage = $derived(page.url.pathname.startsWith('/cetak'));

	const disableInteraction = $derived(
		data.user?.type === 'user' &&
			isReadonlyPage &&
			!((isPresensiMuridPage || isJurnalMengajarPage || isCetakPage) && userIsGuruMapel)
	);

	async function stopServer() {
		if (stoppingServer) return;
		stoppingServer = true;

		const showSuccess = () =>
			toast({
				message:
					'Server dihentikan. Tutup jendela Rapkumer ini lalu jalankan ulang bila diperlukan.',
				type: 'info',
				persist: true
			});

		try {
			const response = await fetch('/api/runtime/stop', { method: 'POST', keepalive: true });
			if (response.ok) {
				showSuccess();
			} else {
				const details = await response.text().catch(() => '');
				console.error('Gagal menghentikan server', response.status, details);
				toast({ message: 'Gagal menghentikan server. Coba lagi.', type: 'error' });
			}
		} catch (error) {
			console.warn(
				'Permintaan stop server berakhir sebelum respons diterima. Diasumsikan berhasil.',
				error
			);
			showSuccess();
		} finally {
			stoppingServer = false;
		}
	}

	async function logout() {
		if (loggingOut) return;
		loggingOut = true;

		try {
			const response = await fetch('/logout', { method: 'POST' });
			if (response.ok) {
				const body = await response.json().catch(() => null);
				if (body?.redirectUrl) {
					window.location.href = body.redirectUrl;
					return;
				}
				window.location.href = '/login';
				return;
			}

			if (response.redirected) {
				window.location.href = response.url;
				return;
			}

			window.location.href = '/login';
		} catch (error) {
			console.error('Gagal logout', error);
			window.location.href = '/login';
		} finally {
			loggingOut = false;
		}
	}
</script>

<svelte:head>
	<script>
		(function () {
			try {
				var stored = localStorage.getItem('dark-mode');
				var theme;
				if (stored === 'dark' || stored === 'light') {
					theme = stored;
				} else if (stored === 'true' || stored === 'false') {
					theme = stored === 'true' ? 'dark' : 'light';
				} else if (stored) {
					try {
						var parsed = JSON.parse(stored);
						theme = parsed ? 'dark' : 'light';
					} catch (err) {
						theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
					}
				} else {
					theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
				}
				document.documentElement.setAttribute('data-theme', theme);
			} catch (e) {
				console.error('failed initialize dark mode:', e);
			}
		})();
	</script>
	<title>{appName}{page.data.meta.title ? ' - ' + page.data.meta.title : ''}</title>
</svelte:head>

{#if isLoginPage}
	<div class="min-h-screen w-full bg-slate-50 dark:bg-slate-950">
		{@render children()}
	</div>
{:else if isTamuPage || isUnauthenticatedError}
	<div
		class="relative min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-slate-50/90 dark:bg-slate-950 overflow-hidden"
	>
		<!-- Subtle ambient background accents -->
		<div
			class="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[32rem] w-[42rem] rounded-full bg-gradient-to-b from-primary/10 via-sky-400/5 to-transparent blur-3xl opacity-60"
		></div>
		<div
			class="pointer-events-none absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] opacity-60"
		></div>

		{#if isUnauthenticatedError}
			<div class="relative z-10 w-full max-w-lg">
				{@render children()}
			</div>
		{:else}
			<div class="relative z-10 w-full flex flex-col items-center justify-center">
				{@render children()}
			</div>
		{/if}
	</div>
{:else if isJadwalPublikPage}
	<div class="bg-base-200 flex min-h-screen flex-col p-6">
		{@render children()}
	</div>
{:else}
	<main class="drawer lg:drawer-open">
		<input id="my-drawer-2" type="checkbox" class="drawer-toggle" />
		<div class="drawer-content flex min-h-screen flex-col">
			<Navbar {stopServer} {stoppingServer} {logout} {loggingOut} />

			<div
				class="border-slate-200/70 bg-slate-50/80 dark:border-slate-800/80 dark:bg-base-200/50 flex flex-1 flex-col overflow-hidden border-t transition-colors lg:mr-2 lg:mb-2 lg:rounded-2xl lg:border-t-0 lg:border-l"
			>
				<div
					class="max-h-[calc(100vh-4.2rem)] min-h-[calc(100vh-4.2rem)] max-w-none overflow-y-auto md:max-h-[calc(100vh-4.6rem)] md:min-h-[calc(100vh-4.6rem)]"
				>
					<div class="m-4 flex flex-row xl:gap-4">
						<div class="w-full max-w-7xl min-w-0 flex-1">
							<ScrollToTop />
							<FavoriteMenusFab />
							<div class={disableInteraction ? 'is-readonly' : ''}>
								{@render children()}
							</div>
						</div>
						<div class="sticky top-4 self-start">
							{#if isJadwalPage && page.data.daftarKodeMapel}
								<div class="hidden xl:block">
									<div class="card bg-base-100 rounded-box mb-4 max-w-70 min-w-70 shadow-md">
										<div class="p-4">
											<div class="flex flex-row items-center gap-2">
												<h2 class="text-sm font-bold">Kode Kegiatan</h2>
												<div class="flex-1"></div>
												<div class="join">
													<button
														type="button"
														class="btn btn-sm join-item px-2 shadow-none"
														onclick={() => (kodeKegiatanOpen = !kodeKegiatanOpen)}
														title={kodeKegiatanOpen ? 'Tutup daftar kode' : 'Buka daftar kode'}
													>
														<Icon name={kodeKegiatanOpen ? 'up' : 'down'} />
													</button>
												</div>
											</div>
										</div>
										{#if kodeKegiatanOpen}
											<div class="p-4 pt-0">
												<KodeKegiatan
													kodeMapelPerKelas={(page.data.kodeMapelPerKelas as Array<{
														kelasId: number;
														namaKelas: string;
														kodeMapel: string[];
													}>) ?? []}
													kodeTambahan={['UPB', 'IST', 'PLG']}
													kodeKokurikuler={(page.data.daftarKodeKokurikuler as string[]) ?? []}
													kegiatanCustom={(page.data.kegiatanCustom as Array<{
														kode: string;
														nama: string;
														durasi: number | null;
													}>) ?? []}
													canManage={jadwalCanManage && $jadwalIsEditing}
													onHapusKegiatan={handleHapusKegiatan}
													onEditKegiatan={openEditKegiatan}
												/>
											</div>
										{/if}
									</div>
								</div>
							{/if}
							<Task variant="sidebar" />
							<FavoriteMenusSidebar />
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="drawer-side z-40">
			<label for="my-drawer-2" aria-label="close sidebar" class="drawer-overlay"></label>
			<aside
				class="bg-base-100 border-slate-200/80 dark:border-slate-800 text-base-content flex min-h-full w-64 max-w-64 flex-col justify-between border-r p-3.5 overflow-x-hidden"
			>
				<div class="flex flex-col flex-1 min-h-0 w-full">
					<div
						class="border-slate-200/70 dark:border-slate-800/80 mb-3 flex items-center gap-2.5 border-b px-1 pt-14 pb-2.5 lg:pt-1 shrink-0"
					>
						<div
							class="bg-primary/10 text-primary shadow-xs flex h-8 w-8 items-center justify-center rounded-lg font-bold text-base shrink-0 overflow-hidden"
						>
							{#if data.meta?.logoUrl}
								<img
									class="h-full w-full rounded object-contain p-0.5"
									src={data.meta.logoUrl}
									alt="Logo Sekolah"
								/>
							{:else if data.sekolah?.id}
								<img
									class="h-full w-full rounded object-contain p-0.5"
									src={`/sekolah/logo/${data.sekolah.id}`}
									alt={data.sekolah.nama || 'Logo Sekolah'}
									onerror={(e) => {
										(e.currentTarget as HTMLElement).style.display = 'none';
										const sibling = (e.currentTarget as HTMLElement).nextElementSibling;
										if (sibling) (sibling as HTMLElement).style.display = 'flex';
									}}
								/>
								<span style="display: none;">R</span>
							{:else}
								<span>R</span>
							{/if}
						</div>
						<div class="flex flex-col min-w-0">
							<a
								href="/"
								class="font-display hover:text-primary text-sm font-bold leading-tight tracking-tight transition-colors truncate"
							>
								{appName}
							</a>
							<span class="text-base-content/60 text-[11px] font-medium tracking-normal truncate">
								{data.sekolah?.nama ?? 'Administrasi Sekolah'}
							</span>
						</div>
					</div>

					<Menu />
				</div>

				<div
					class="border-slate-200/70 dark:border-slate-800/80 flex flex-col gap-0.5 border-t pt-2.5 mt-2 shrink-0"
				>
					{#if data.user?.type === 'admin'}
						<a
							href="/pengguna"
							class="text-base-content/70 hover:bg-base-200/80 hover:text-primary flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-all"
						>
							<Icon name="users" class="h-4 w-4 shrink-0" />
							<span>Manajemen Pengguna</span>
						</a>
					{/if}
					<a
						href="/pengaturan"
						class="text-base-content/70 hover:bg-base-200/80 hover:text-primary flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-all"
					>
						<Icon name="gear" class="h-4 w-4 shrink-0" />
						<span>Pengaturan</span>
					</a>
					<a
						href="/tentang"
						class="text-base-content/70 hover:bg-base-200/80 hover:text-primary flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-all"
					>
						<Icon name="info" class="h-4 w-4 shrink-0" />
						<span>Tentang Aplikasi</span>
					</a>
					<div class="px-2.5 pt-1.5 text-[10px] text-base-content/40">
						Powered by
						<a
							href="https://github.com/sira313/rapkumer"
							target="_blank"
							rel="noreferrer noopener"
							class="text-primary/80 hover:underline font-medium"
						>
							Rapkumer
						</a>
					</div>
				</div>
			</aside>
		</div>
	</main>
{/if}

<Toast />
<GlobalModal />
<NavIndicator />
{#if dev && simulasiTanggalJam && data.user}
	<div class="fixed right-4 bottom-4 z-40 flex items-center gap-2">
		<div class="alert alert-soft alert-warning shadow-lg">
			<Icon name="calendar" class="h-5 w-5 shrink-0" />
			<div class="text-xs leading-tight">
				<div class="font-bold">Mode simulasi presensi aktif</div>
				<div>{simulasiTanggalJam}</div>
			</div>
			<button
				type="button"
				class="btn btn-soft btn-warning btn-sm shadow-none"
				onclick={resetSimulasi}
			>
				Reset
			</button>
		</div>
	</div>
{/if}

<style>
	:global(
		.is-readonly :is(button, input, select, textarea, a, [role='button']):not(.pointer-events-auto)
	) {
		opacity: var(--btn-disabled-opacity, 0.5) !important;
		cursor: not-allowed !important;
		pointer-events: none !important;
	}
</style>
