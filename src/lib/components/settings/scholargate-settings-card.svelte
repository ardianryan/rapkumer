<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import Icon from '$lib/components/icon.svelte';
	import { toast } from '$lib/components/toast.svelte';

	interface ScholargateData {
		baseUrl: string;
		maskedKey: string;
		keySet: boolean;
		referer: string;
	}

	interface Props {
		scholargateData?: ScholargateData | null;
	}

	let { scholargateData }: Props = $props();

	// svelte-ignore state_referenced_locally
	let baseUrl = $state(scholargateData?.baseUrl || '');
	// svelte-ignore state_referenced_locally
	let apiKeyInput = $state(scholargateData?.maskedKey || '');
	// svelte-ignore state_referenced_locally
	let referer = $state(scholargateData?.referer || '');
	// svelte-ignore state_referenced_locally
	let keySet = $state(scholargateData?.keySet ?? false);

	let testing = $state(false);
	let saving = $state(false);
	let testResult = $state<{ success: boolean; message: string } | null>(null);

	async function handleTest() {
		if (!baseUrl.trim()) {
			toast('Ketik URL Server SMAGE ID terlebih dahulu.', 'warning');
			return;
		}
		if (!apiKeyInput.trim()) {
			toast('Ketik API Key SMAGE ID terlebih dahulu.', 'warning');
			return;
		}
		if (!referer.trim()) {
			toast('Ketik Domain / Referer aplikasi terlebih dahulu.', 'warning');
			return;
		}

		testResult = null;
		testing = true;
		try {
			const res = await fetch('/api/scholargate/test', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					baseUrl,
					apiKey: apiKeyInput,
					referer
				})
			});

			const json = await res.json();
			testResult = {
				success: json.success ?? false,
				message: json.message || (json.success ? 'Koneksi berhasil!' : 'Koneksi gagal.')
			};

			if (json.success) {
				toast(json.message || 'Koneksi ke SMAGE ID berhasil!', 'success');
			} else {
				toast(json.message || 'Koneksi ke SMAGE ID gagal.', 'error');
			}
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			testResult = { success: false, message: `Error: ${msg}` };
			toast(msg, 'error');
		} finally {
			testing = false;
		}
	}

	async function handleSave() {
		saving = true;
		try {
			const res = await fetch('/api/pengaturan/scholargate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					baseUrl,
					apiKey: apiKeyInput,
					referer
				})
			});

			const json = await res.json();
			if (!res.ok) {
				throw new Error(json.error || 'Gagal menyimpan pengaturan SMAGE ID.');
			}

			toast(json.message || 'Pengaturan SMAGE ID berhasil disimpan.', 'success');
			if (apiKeyInput && !apiKeyInput.includes('•')) {
				keySet = true;
			}
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
	<header class="mb-4 space-y-1">
		<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h2 class="text-xl font-semibold flex items-center gap-2">
					<Icon name="user" />
					Integrasi SMAGE ID (ScholarGate)
				</h2>
				<p class="text-base-content/70 text-sm">
					Konfigurasi API direktori profil guru & identitas GTK. Guru dapat memperbarui identitas
					dirinya sendiri secara instan tanpa memerlukan akun admin.
				</p>
			</div>
			<div class="shrink-0">
				{#if keySet && baseUrl}
					<span class="badge badge-success badge-sm">Terhubung</span>
				{:else}
					<span class="badge badge-warning badge-sm">Belum Disetel</span>
				{/if}
			</div>
		</div>
	</header>

	<div class="space-y-4">
		<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
			<fieldset class="fieldset">
				<legend class="fieldset-legend">URL Server (Base URL)</legend>
				<label class="input bg-base-200 dark:bg-base-300 w-full flex items-center gap-2">
					<Icon name="school" />
					<input
						type="url"
						bind:value={baseUrl}
						placeholder="Contoh: https://portal.smage.my.id"
						class="grow font-mono text-sm"
					/>
				</label>
				<p class="text-xs text-base-content/60 mt-1">Alamat endpoint API ScholarGate / SMAGE ID.</p>
			</fieldset>

			<fieldset class="fieldset">
				<legend class="fieldset-legend">Domain / URL Referer</legend>
				<label class="input bg-base-200 dark:bg-base-300 w-full flex items-center gap-2">
					<Icon name="school" />
					<input
						type="text"
						bind:value={referer}
						placeholder="Contoh: https://rapkumer.smage.my.id"
						class="grow font-mono text-sm"
					/>
				</label>
				<p class="text-xs text-base-content/60 mt-1">
					Wajib: Diperlukan untuk verifikasi domain pemanggil di ScholarGate.
				</p>
			</fieldset>

			<fieldset class="fieldset">
				<legend class="fieldset-legend">
					API Key
					{#if keySet}
						<span class="badge badge-success badge-xs ml-1">Tersimpan</span>
					{/if}
				</legend>
				<label class="input bg-base-200 dark:bg-base-300 w-full flex items-center gap-2">
					<Icon name="key" />
					<input
						type="password"
						bind:value={apiKeyInput}
						placeholder={keySet ? '••••••••' : 'Masukkan API Key SMAGE ID'}
						class="grow font-mono text-sm"
						autocomplete="new-password"
					/>
				</label>
				<p class="text-xs text-base-content/60 mt-1">
					Diperoleh dari panel manajemen kunci API ScholarGate.
				</p>
			</fieldset>
		</div>

		{#if testResult}
			<div
				class="alert text-sm {testResult.success
					? 'alert-success text-success-content'
					: 'alert-error text-error-content'}"
			>
				<Icon name={testResult.success ? 'success' : 'error'} />
				<span>{testResult.message}</span>
			</div>
		{/if}

		<div class="flex flex-wrap items-center justify-between gap-3 pt-2">
			<button
				type="button"
				class="btn btn-outline btn-sm gap-2"
				onclick={handleTest}
				disabled={testing || saving}
			>
				{#if testing}
					<span class="loading loading-spinner loading-xs"></span>
					Menguji...
				{:else}
					<Icon name="repeat" />
					Uji Koneksi
				{/if}
			</button>

			<button
				type="button"
				class="btn btn-primary btn-sm gap-2"
				onclick={handleSave}
				disabled={saving || testing}
			>
				{#if saving}
					<span class="loading loading-spinner loading-xs"></span>
					Menyimpan...
				{:else}
					<Icon name="save" />
					Simpan Pengaturan
				{/if}
			</button>
		</div>
	</div>
</section>
