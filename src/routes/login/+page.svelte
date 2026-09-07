<script lang="ts">
	import { browser } from '$app/environment';
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';

	let showPassword = $state(false);

	let { data } = $props();

	// Brute-force lockout countdown (epoch ms when the account/IP unlocks).
	const LOCKOUT_STORAGE_KEY = 'rapkumer-login-lockout-until';
	let lockoutEndsAt = $state<number | null>(null);
	let now = $state(Date.now());

	const remainingSeconds = $derived(
		lockoutEndsAt === null ? 0 : Math.max(0, Math.ceil((lockoutEndsAt - now) / 1000))
	);
	const countdownLabel = $derived(
		`${Math.floor(remainingSeconds / 60)
			.toString()
			.padStart(2, '0')}:${(remainingSeconds % 60).toString().padStart(2, '0')}`
	);
	const isLocked = $derived(remainingSeconds > 0);

	$effect(() => {
		if (!isLocked) return;
		const id = setInterval(() => {
			now = Date.now();
		}, 1000);
		return () => clearInterval(id);
	});

	function readStoredLockout(): number | null {
		if (!browser) return null;
		try {
			const raw = window.localStorage.getItem(LOCKOUT_STORAGE_KEY);
			if (!raw) return null;
			const end = Number(raw);
			return Number.isFinite(end) && end > 0 ? end : null;
		} catch {
			return null;
		}
	}

	function persistLockout(endAt: number | null) {
		if (!browser) return;
		try {
			if (endAt === null) {
				window.localStorage.removeItem(LOCKOUT_STORAGE_KEY);
			} else {
				window.localStorage.setItem(LOCKOUT_STORAGE_KEY, String(endAt));
			}
		} catch {
			// ignore storage errors (private browsing, quota, ...)
		}
	}

	// Restore the countdown on mount: prefer the freshest of the server-reported
	// per-IP lockout and the locally persisted value so reloads keep the alert.
	$effect(() => {
		if (!browser) return;
		const candidates: number[] = [];
		const stored = readStoredLockout();
		if (stored !== null) candidates.push(stored);
		if (data.initialRetryAfterSeconds > 0) {
			candidates.push(Date.now() + data.initialRetryAfterSeconds * 1000);
		}
		if (candidates.length > 0) {
			const endAt = Math.max(...candidates);
			if (endAt > Date.now()) {
				lockoutEndsAt = endAt;
			} else {
				persistLockout(null);
			}
		}
	});

	function handleLoginFailure({ data: failData }: { data?: Record<string, unknown> }) {
		const retry = failData?.retryAfterSeconds;
		if (typeof retry === 'number' && retry > 0) {
			const endAt = Date.now() + retry * 1000;
			lockoutEndsAt = endAt;
			persistLockout(endAt);
		}
	}
	const sekolahNama = $derived(data.sekolah?.nama ?? 'SMA Negeri 1 Gedeg');
	const sekolahNpsn = $derived(data.sekolah?.npsn ?? null);
	const logoSrc = $derived(data.sekolah?.id ? '/sekolah/logo' : '/logo.png');

	let showHelpTip = $state(false);
</script>

<div
	class="min-h-screen w-full grid grid-cols-1 lg:grid-cols-12 bg-white dark:bg-slate-900 overflow-x-hidden"
>
	<!-- Panel Kiri: Showcase Institusi & Branding Sekolah (Desktop) -->
	<div
		class="lg:col-span-5 xl:col-span-5 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white p-7 sm:p-10 lg:p-12 xl:p-16 flex flex-col justify-between relative overflow-hidden"
	>
		<!-- Ambient Glow Accents -->
		<div
			class="pointer-events-none absolute -top-28 -left-28 h-80 w-80 rounded-full bg-primary/25 blur-3xl"
		></div>
		<div
			class="pointer-events-none absolute -bottom-28 -right-28 h-80 w-80 rounded-full bg-sky-500/20 blur-3xl"
		></div>
		<div
			class="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:20px_20px]"
		></div>

		<!-- Bagian Atas Panel Kiri -->
		<div class="relative z-10 space-y-8">
			<!-- Header Logo Sekolah -->
			<div class="flex items-center gap-3.5">
				<img
					src={logoSrc}
					alt={`Logo ${sekolahNama}`}
					class="h-14 w-14 object-contain shrink-0"
					onerror={(e) => {
						(e.currentTarget as HTMLImageElement).src = '/tutwuri.png';
					}}
				/>
				<div class="min-w-0">
					<h2 class="font-display text-base sm:text-lg font-bold text-white leading-tight truncate">
						{sekolahNama}
					</h2>
					{#if sekolahNpsn}
						<p class="text-xs text-white/60 font-mono">NPSN: {sekolahNpsn}</p>
					{/if}
				</div>
			</div>

			<!-- Headline & Deskripsi -->
			<div class="space-y-3 pt-4">
				<span
					class="inline-block badge badge-sm bg-primary/25 text-sky-200 border-none font-semibold text-[11px] px-3 py-1"
				>
					Portal GTK Terpadu
				</span>
				<h1
					class="font-display text-2xl sm:text-3xl xl:text-4xl font-extrabold text-white leading-tight tracking-tight"
				>
					Administrasi Guru & Penilaian Rapor
				</h1>
				<p class="text-xs sm:text-sm text-white/70 leading-relaxed max-w-lg">
					Platform terintegrasi untuk pengelolaan jadwal mengajar, presensi harian, jurnal, asesmen
					sumatif/formatif, dan pengolahan rapor Kurikulum Merdeka.
				</p>
			</div>

			<!-- Fitur Unggulan Institusi -->
			<ul class="space-y-3 pt-2 text-xs sm:text-sm text-white/85">
				<li class="flex items-center gap-3">
					<div
						class="h-6 w-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0"
					>
						<Icon name="check" class="h-3.5 w-3.5 stroke-[3]" />
					</div>
					<span>Rapor Kurikulum Merdeka & P5</span>
				</li>
				<li class="flex items-center gap-3">
					<div
						class="h-6 w-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0"
					>
						<Icon name="check" class="h-3.5 w-3.5 stroke-[3]" />
					</div>
					<span>Presensi Masuk & Pulang Digital</span>
				</li>
				<li class="flex items-center gap-3">
					<div
						class="h-6 w-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0"
					>
						<Icon name="check" class="h-3.5 w-3.5 stroke-[3]" />
					</div>
					<span>Jurnal Mengajar & Buku Tamu Guru</span>
				</li>
			</ul>
		</div>

		<!-- Footer Panel Kiri -->
		<div
			class="relative z-10 pt-8 mt-8 border-t border-white/10 flex items-center justify-end text-xs text-white/50"
		>
			<span class="font-mono text-[11px]">Rapkumer v{data.appVersion}</span>
		</div>
	</div>

	<!-- Panel Kanan: Formulir Login (Full Width Content Area) -->
	<div
		class="lg:col-span-7 xl:col-span-7 p-6 sm:p-12 lg:p-16 xl:p-24 flex flex-col justify-between bg-white dark:bg-slate-900 min-h-[32rem]"
	>
		<!-- Header Mobile Only -->
		<div
			class="lg:hidden flex items-center gap-3 pb-6 mb-6 border-b border-slate-100 dark:border-slate-800"
		>
			<img src={logoSrc} alt={`Logo ${sekolahNama}`} class="h-10 w-10 object-contain" />
			<div>
				<h3 class="font-display text-sm font-bold text-slate-800 dark:text-slate-100">
					{sekolahNama}
				</h3>
				<p class="text-[11px] text-base-content/60">Portal Administrasi Guru</p>
			</div>
		</div>

		<!-- Form Container (Centered) -->
		<div class="w-full max-w-md mx-auto my-auto py-6 space-y-6">
			<!-- Form Header -->
			<header class="space-y-2">
				<h2
					class="font-display text-2xl sm:text-3xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight"
				>
					Selamat Datang
				</h2>
				<p class="text-xs sm:text-sm text-base-content/65">
					Silakan masukkan nama pengguna dan kata sandi akun Anda untuk melanjutkan
				</p>
			</header>

			<!-- Alert Locked State -->
			{#if isLocked}
				<div
					class="alert alert-error text-xs rounded-xl flex items-center gap-2.5 p-3.5 shadow-xs"
					role="alert"
				>
					<Icon name="lock" class="h-4 w-4 shrink-0" />
					<span class="leading-relaxed">
						Terlalu banyak percobaan gagal. Coba lagi dalam
						<span class="font-mono tabular-nums font-bold underline">{countdownLabel}</span>.
					</span>
				</div>
			{/if}

			<!-- Form -->
			<FormEnhance action="?/login" onfailure={handleLoginFailure}>
				{#snippet children({ submitting, invalid })}
					<div class="space-y-4">
						<!-- Username -->
						<div class="space-y-1.5">
							<label
								class="text-xs font-semibold text-slate-700 dark:text-slate-300"
								for="username"
							>
								Nama Pengguna / NIP
							</label>
							<div class="relative flex items-center">
								<Icon
									name="user"
									class="absolute left-3.5 h-4 w-4 text-base-content/40 pointer-events-none"
								/>
								<input
									type="text"
									id="username"
									name="username"
									required
									autocomplete="username"
									placeholder="Contoh: Admin atau NIP Anda"
									class="input rounded-xl border-slate-200/90 dark:border-slate-700 bg-slate-50/50 dark:bg-base-200 w-full pl-10 pr-3 h-11 text-xs sm:text-sm focus:border-primary focus:bg-white dark:focus:bg-base-100 focus:ring-2 focus:ring-primary/10 transition-all"
								/>
							</div>
						</div>

						<!-- Password -->
						<div class="space-y-1.5">
							<div class="flex items-center justify-between">
								<label
									class="text-xs font-semibold text-slate-700 dark:text-slate-300"
									for="password"
								>
									Kata Sandi
								</label>
								<button
									type="button"
									class="text-[11px] text-primary hover:underline font-medium cursor-pointer"
									onclick={() => (showHelpTip = !showHelpTip)}
								>
									Lupa kata sandi?
								</button>
							</div>
							<div class="relative flex items-center">
								<Icon
									name="lock"
									class="absolute left-3.5 h-4 w-4 text-base-content/40 pointer-events-none"
								/>
								<input
									type={showPassword ? 'text' : 'password'}
									id="password"
									name="password"
									required
									autocomplete="current-password"
									placeholder="••••••••"
									class="input rounded-xl border-slate-200/90 dark:border-slate-700 bg-slate-50/50 dark:bg-base-200 w-full pl-10 pr-10 h-11 text-xs sm:text-sm focus:border-primary focus:bg-white dark:focus:bg-base-100 focus:ring-2 focus:ring-primary/10 transition-all"
								/>
								<button
									type="button"
									class="absolute right-3 text-base-content/45 hover:text-base-content transition-colors p-1 cursor-pointer"
									onclick={() => (showPassword = !showPassword)}
									aria-label="Lihat atau sembunyikan kata sandi"
								>
									<Icon name={showPassword ? 'eye-off' : 'eye'} class="h-4 w-4" />
								</button>
							</div>
						</div>

						<!-- Password Help Drawer -->
						{#if showHelpTip}
							<div
								class="rounded-xl border border-blue-100 dark:border-blue-900/60 bg-blue-50/80 dark:bg-blue-950/40 p-3.5 text-[11px] text-blue-800 dark:text-blue-300 space-y-1 animate-in fade-in duration-200"
							>
								<div class="font-bold flex items-center gap-1.5">
									<Icon name="info" class="h-3.5 w-3.5" />
									<span>Bantuan Akun & Kata Sandi</span>
								</div>
								<p class="leading-relaxed opacity-90">
									Silakan hubungi <strong>Admin IT / Kurikulum Sekolah</strong> untuk mereset kata sandi
									atau memperbarui data akun GTK Anda.
								</p>
							</div>
						{/if}

						<!-- Submit Button -->
						<button
							class="btn btn-primary h-12 rounded-xl font-bold text-xs sm:text-sm tracking-wide mt-3 w-full shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
							type="submit"
							disabled={submitting || invalid || isLocked}
						>
							{#if submitting}
								<span class="loading loading-spinner loading-xs"></span>
								<span>Memverifikasi Akun…</span>
							{:else}
								<span>Masuk ke Portal</span>
								<Icon name="right" class="h-4 w-4" />
							{/if}
						</button>
					</div>
				{/snippet}
			</FormEnhance>

			<!-- SSO Section Divider & Button -->
			{#if data.sso?.enabled}
				<div class="pt-2 space-y-4">
					<div class="relative flex items-center justify-center">
						<div class="border-t border-slate-200 dark:border-slate-800 w-full"></div>
						<span
							class="bg-white dark:bg-slate-900 px-3 text-[11px] font-medium text-slate-400 uppercase tracking-wider shrink-0"
						>
							atau masuk dengan
						</span>
					</div>

					<a
						href={data.sso.loginUrl}
						class="btn btn-outline border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-400 h-12 rounded-xl font-bold text-xs sm:text-sm tracking-wide w-full transition-all flex items-center justify-center gap-2.5 text-slate-700 dark:text-slate-200 shadow-sm"
					>
						<div
							class="h-6 w-6 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0"
						>
							<Icon name="key" class="h-3.5 w-3.5" />
						</div>
						<span>{data.sso.buttonText}</span>
					</a>
				</div>
			{/if}
		</div>

		<!-- Footer Panel Kanan -->
		<footer
			class="pt-6 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-base-content/50"
		>
			<span>© 2026 {sekolahNama}</span>
			<span>
				Powered by
				<a
					href="https://github.com/sira313/rapkumer"
					target="_blank"
					rel="noreferrer noopener"
					class="font-semibold text-primary hover:underline transition-colors"
				>
					Rapkumer
				</a>
			</span>
		</footer>
	</div>
</div>
