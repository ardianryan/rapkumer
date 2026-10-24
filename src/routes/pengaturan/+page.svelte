<script lang="ts">
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import Icon from '$lib/components/icon.svelte';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import AppInfoCard from '$lib/components/settings/app-info-card.svelte';
	import ChangeUsernameCard from '$lib/components/settings/change-username-card.svelte';
	import ChangePasswordCard from '$lib/components/settings/change-password-card.svelte';
	import StorageLocationCard from '$lib/components/settings/storage-location-card.svelte';
	import KopSuratCard from '$lib/components/settings/kop-surat-card.svelte';
	import TandaTanganCard from '$lib/components/settings/tanda-tangan-card.svelte';
	import TandaTanganGuruCard from '$lib/components/settings/tanda-tangan-guru-card.svelte';
	import DatabaseCard from '$lib/components/settings/database-card.svelte';
	import BukuTamuPasskeyCard from '$lib/components/settings/buku-tamu-passkey-card.svelte';
	import AiKeyCard from '$lib/components/settings/ai-key-card.svelte';
	import MenuVisibilityCard from '$lib/components/settings/menu-visibility-card.svelte';
	import AkasSettingsCard from '$lib/components/settings/akas-settings-card.svelte';
	import ScholargateSettingsCard from '$lib/components/settings/scholargate-settings-card.svelte';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	let user = $derived(page.data.user);
	const isAdmin = $derived(user?.type === 'admin' || user?.type === 'kepala_sekolah');
	const isGuru = $derived(
		user?.type === 'user' || user?.type === 'wali_kelas' || user?.type === 'wali_asuh'
	);

	// svelte-ignore state_referenced_locally
	let wasForcePasswordChange = $state(data.forcePasswordChange);
	let passwordChanged = $state(false);

	type TabId = 'akun' | 'dokumen' | 'visibilitas' | 'ai' | 'sistem';

	// Tab aktif yang disinkronkan dengan URL parameter ?tab=...
	let activeTab = $state<TabId>('akun');

	onMount(() => {
		const paramTab = page.url.searchParams.get('tab') as TabId | null;
		if (
			paramTab &&
			(paramTab === 'akun' ||
				paramTab === 'dokumen' ||
				paramTab === 'visibilitas' ||
				paramTab === 'ai' ||
				paramTab === 'sistem')
		) {
			if (isAdmin || paramTab === 'akun' || paramTab === 'ai' || paramTab === 'dokumen') {
				activeTab = paramTab;
			}
		}

		if (data.forcePasswordChange && browser) {
			activeTab = 'akun';
			document.getElementById('default-password-warning')?.scrollIntoView({ behavior: 'smooth' });
		}
	});

	function switchTab(tab: TabId) {
		activeTab = tab;
		if (browser) {
			const url = new URL(window.location.href);
			url.searchParams.set('tab', tab);
			window.history.replaceState({}, '', url.toString());
		}
	}

	function handlePasswordSuccess() {
		passwordChanged = true;
	}
</script>

<!-- Header Ringkas Halaman Pengaturan -->
<div class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
	<div>
		<h1 class="text-2xl font-bold flex items-center gap-2">
			<Icon name="gear" />
			Pengaturan
		</h1>
		<p class="text-sm text-base-content/70 mt-0.5">
			Kelola preferensi akun, keamanan, visibilitas menu, dan integrasi sistem.
		</p>
	</div>
	<div class="flex items-center gap-2">
		<a class="btn btn-sm btn-soft btn-success shadow-none" href={resolve('/pengaturan/profil')}>
			<Icon name="user" />
			Edit Profil
		</a>
		{#if isAdmin}
			<a class="btn btn-sm btn-soft btn-info shadow-none" href={resolve('/pengguna')}>
				<Icon name="users" />
				Manajemen Pengguna
			</a>
		{/if}
	</div>
</div>

<!-- Notifikasi Peringatan Ganti Kata Sandi Bawaan -->
{#if wasForcePasswordChange}
	{#if passwordChanged}
		<div class="alert alert-success mb-5" role="status">
			<Icon name="success" />
			<span>Kata sandi berhasil diubah. Silakan gunakan aplikasi.</span>
		</div>
	{:else}
		<div id="default-password-warning" class="alert alert-warning mb-5 scroll-mt-20" role="alert">
			<Icon name="lock" />
			<span>
				Jangan gunakan sandi bawaan! Perbarui kata sandi di tab
				<strong>Akun & Keamanan</strong> di bawah sebelum menggunakan aplikasi.
			</span>
		</div>
	{/if}
{/if}

<!-- Navigasi Tab Pengaturan (DaisyUI 5 Native) -->
<div class="mb-5">
	<div
		role="tablist"
		class="tabs tabs-box bg-base-200/80 p-1 rounded-xl w-full sm:w-auto inline-flex overflow-x-auto gap-1 border border-base-300/50"
	>
		<button
			type="button"
			role="tab"
			aria-selected={activeTab === 'akun'}
			class="tab tab-sm sm:tab-md font-semibold rounded-lg transition-all {activeTab === 'akun'
				? 'tab-active bg-base-100 shadow-sm text-primary font-bold'
				: 'hover:text-base-content text-base-content/70'}"
			onclick={() => switchTab('akun')}
		>
			<Icon name="lock" class="h-4 w-4 mr-1.5" />
			Akun & Keamanan
		</button>

		{#if isAdmin}
			<button
				type="button"
				role="tab"
				aria-selected={activeTab === 'dokumen'}
				class="tab tab-sm sm:tab-md font-semibold rounded-lg transition-all {activeTab === 'dokumen'
					? 'tab-active bg-base-100 shadow-sm text-primary font-bold'
					: 'hover:text-base-content text-base-content/70'}"
				onclick={() => switchTab('dokumen')}
			>
				<Icon name="pen" class="h-4 w-4 mr-1.5" />
				Kop & Tanda Tangan
			</button>
		{/if}

		{#if isAdmin}
			<button
				type="button"
				role="tab"
				aria-selected={activeTab === 'visibilitas'}
				class="tab tab-sm sm:tab-md font-semibold rounded-lg transition-all {activeTab ===
				'visibilitas'
					? 'tab-active bg-base-100 shadow-sm text-primary font-bold'
					: 'hover:text-base-content text-base-content/70'}"
				onclick={() => switchTab('visibilitas')}
			>
				<Icon name="eye" class="h-4 w-4 mr-1.5" />
				Visibilitas Menu
				{#if (data.hiddenMenuPaths?.length ?? 0) > 0}
					<span class="badge badge-warning badge-xs ml-1.5">
						{data.hiddenMenuPaths.length}
					</span>
				{/if}
			</button>
		{/if}

		<button
			type="button"
			role="tab"
			aria-selected={activeTab === 'ai'}
			class="tab tab-sm sm:tab-md font-semibold rounded-lg transition-all {activeTab === 'ai'
				? 'tab-active bg-base-100 shadow-sm text-primary font-bold'
				: 'hover:text-base-content text-base-content/70'}"
			onclick={() => switchTab('ai')}
		>
			<Icon name="sparkles" class="h-4 w-4 mr-1.5" />
			Kunci AI
		</button>

		{#if isAdmin}
			<button
				type="button"
				role="tab"
				aria-selected={activeTab === 'sistem'}
				class="tab tab-sm sm:tab-md font-semibold rounded-lg transition-all {activeTab === 'sistem'
					? 'tab-active bg-base-100 shadow-sm text-primary font-bold'
					: 'hover:text-base-content text-base-content/70'}"
				onclick={() => switchTab('sistem')}
			>
				<Icon name="gear" class="h-4 w-4 mr-1.5" />
				Sistem & Database
			</button>
		{/if}
	</div>
</div>

<!-- KONTEN TAB -->
{#if activeTab === 'akun'}
	<div class="space-y-4">
		<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
			<ChangeUsernameCard />
			<ChangePasswordCard onsuccess={handlePasswordSuccess} isSsoUser={data.isSsoUser} />
		</div>

		{#if user?.type === 'wali_kelas' || user?.type === 'wali_asuh' || user?.type === 'wali_asrama' || user?.type === 'user'}
			<TandaTanganGuruCard />
		{/if}

		{#if isAdmin}
			<BukuTamuPasskeyCard
				passkeySet={data.bukuTamuPasskeySet}
				activePasskey={data.bukuTamuPasskey}
			/>
		{/if}
	</div>
{:else if activeTab === 'dokumen' && isAdmin}
	<div class="space-y-4">
		<KopSuratCard />
		<TandaTanganCard />
	</div>
{:else if activeTab === 'visibilitas' && isAdmin}
	<div class="space-y-4">
		<MenuVisibilityCard initialHiddenPaths={data.hiddenMenuPaths} />
	</div>
{:else if activeTab === 'ai'}
	<div class="space-y-4">
		{#if isAdmin}
			<AiKeyCard
				variant="sekolah"
				title="Kunci API AI Sekolah"
				description="Kunci API sekolah untuk fitur &quot;Generate&quot; Tujuan Pembelajaran di halaman Intrakurikuler. Dipakai oleh admin/kepala sekolah; guru memakai kunci API pribadi masing-masing. Mendukung Google Gemini langsung (native API) dan semua penyedia yang kompatibel dengan OpenAI chat completions (OpenRouter, DeepSeek, Groq, dsb)."
				idPrefix="gemini"
				data={data.gemini}
			/>
		{/if}

		{#if isGuru}
			<AiKeyCard
				variant="pribadi"
				title="Kunci API AI Pribadi"
				description="Kunci API milik Anda sendiri untuk fitur &quot;Generate&quot; Tujuan Pembelajaran. Kunci sekolah tidak dapat dipakai guru, jadi setel kunci pribadi agar fitur aktif. Kuota terpisah dari pengguna lain."
				idPrefix="personal-ai"
				data={data.personalAi}
			/>
		{/if}
	</div>
{:else if activeTab === 'sistem' && isAdmin}
	<div class="space-y-4">
		<AppInfoCard
			currentVersion={data.appVersion ?? '0.0.0'}
			addresses={data.appAddresses ?? []}
			protocol={data.protocol ?? 'http:'}
			{isAdmin}
		/>

		{#if data.akas}
			<AkasSettingsCard akasData={data.akas} />
		{/if}

		{#if data.scholargate}
			<ScholargateSettingsCard scholargateData={data.scholargate} />
		{/if}

		{#if user?.type === 'admin' && data.storage}
			<StorageLocationCard storage={data.storage} />
		{/if}

		{#if !wasForcePasswordChange}
			<DatabaseCard />
		{/if}
	</div>
{/if}
