<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import Icon from '$lib/components/icon.svelte';
	import { toast } from '$lib/components/toast.svelte';

	interface AkasData {
		baseUrl: string;
		maskedKey: string;
		keySet: boolean;
		sumberPresensi: 'lokal' | 'akas';
	}

	interface Props {
		akasData?: AkasData | null;
	}

	let { akasData }: Props = $props();

	// svelte-ignore state_referenced_locally
	let sumberPresensi = $state<'lokal' | 'akas'>(akasData?.sumberPresensi ?? 'lokal');
	// svelte-ignore state_referenced_locally
	let baseUrl = $state(akasData?.baseUrl || 'https://akas.smage.my.id');
	// svelte-ignore state_referenced_locally
	let apiKeyInput = $state(akasData?.maskedKey || '');
	// svelte-ignore state_referenced_locally
	let keySet = $state(akasData?.keySet ?? false);

	let testing = $state(false);
	let saving = $state(false);
	let testResult = $state<{ success: boolean; message: string } | null>(null);

	async function handleTest() {
		testResult = null;
		testing = true;
		try {
			const res = await fetch('/api/akas/test', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					baseUrl,
					apiKey: apiKeyInput
				})
			});

			const json = await res.json();
			testResult = {
				success: json.success ?? false,
				message: json.message || (json.success ? 'Koneksi berhasil!' : 'Koneksi gagal.')
			};

			if (json.success) {
				toast(json.message || 'Koneksi ke AKAS berhasil!', 'success');
			} else {
				toast(json.message || 'Koneksi ke AKAS gagal.', 'error');
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
			const res = await fetch('/api/pengaturan/akas', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sumberPresensi,
					akasBaseUrl: baseUrl,
					akasApiKey: apiKeyInput
				})
			});

			const json = await res.json();
			if (!res.ok) {
				throw new Error(json.error || 'Gagal menyimpan pengaturan AKAS.');
			}

			toast(json.message || 'Pengaturan AKAS berhasil disimpan.', 'success');
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
					<Icon name="repeat" />
					Presensi AKAS
				</h2>
				<p class="text-base-content/70 text-sm">
					Pilih sumber data presensi murid: input lokal atau sinkronisasi terpusat dari AKAS.
				</p>
			</div>
			<div class="shrink-0">
				{#if sumberPresensi === 'akas'}
					<span class="badge badge-accent badge-sm">Mode AKAS</span>
				{:else}
					<span class="badge badge-neutral badge-sm">Mode Lokal</span>
				{/if}
			</div>
		</div>
	</header>

	<div class="space-y-5">
		<!-- Pilihan Mode Presensi -->
		<div>
			<label class="label font-medium text-sm" for="mode-presensi-heading">
				<span id="mode-presensi-heading">Sumber Presensi</span>
			</label>
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 mt-1">
				<label
					class="flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-all {sumberPresensi ===
					'lokal'
						? 'border-primary bg-primary/5 ring-1 ring-primary'
						: 'border-base-300 hover:bg-base-200/50'}"
				>
					<input
						type="radio"
						name="sumberPresensi"
						value="lokal"
						class="radio radio-primary mt-0.5"
						bind:group={sumberPresensi}
					/>
					<div class="space-y-1">
						<div class="font-semibold text-sm">Lokal (Rapkumer)</div>
						<p class="text-xs text-base-content/70">
							Presensi dicatat manual oleh guru atau wali kelas.
						</p>
					</div>
				</label>

				<label
					class="flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-all {sumberPresensi ===
					'akas'
						? 'border-accent bg-accent/5 ring-1 ring-accent'
						: 'border-base-300 hover:bg-base-200/50'}"
				>
					<input
						type="radio"
						name="sumberPresensi"
						value="akas"
						class="radio radio-accent mt-0.5"
						bind:group={sumberPresensi}
					/>
					<div class="space-y-1">
						<div class="font-semibold text-sm">AKAS</div>
						<p class="text-xs text-base-content/70">
							Presensi ditarik langsung dari server AKAS via NISN.
						</p>
					</div>
				</label>
			</div>
		</div>

		<!-- Konfigurasi Kredensial API AKAS -->
		<div class="border-t border-base-200 pt-4 space-y-4">
			<div class="text-sm font-semibold flex items-center gap-2">
				<Icon name="key" />
				Koneksi API AKAS
			</div>

			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<fieldset class="fieldset">
					<legend class="fieldset-legend">URL Server</legend>
					<label class="input bg-base-200 dark:bg-base-300 w-full flex items-center gap-2">
						<Icon name="school" />
						<input
							type="url"
							bind:value={baseUrl}
							placeholder="https://akas.smage.my.id"
							class="grow font-mono text-sm"
						/>
					</label>
				</fieldset>

				<fieldset class="fieldset">
					<legend class="fieldset-legend">
						API Key
						{#if keySet}
							<span class="badge badge-success badge-xs ml-1">Tersimpan</span>
						{/if}
					</legend>
					<label class="input bg-base-200 dark:bg-base-300 w-full flex items-center gap-2">
						<Icon name="lock" />
						<input
							type="text"
							bind:value={apiKeyInput}
							placeholder="Masukkan API Key (akas_...)"
							class="grow font-mono text-sm"
							autocomplete="off"
						/>
						{#if apiKeyInput}
							<button
								type="button"
								class="btn btn-ghost btn-xs btn-circle"
								onclick={() => (apiKeyInput = '')}
								title="Kosongkan API Key"
							>
								<Icon name="del" />
							</button>
						{/if}
					</label>
				</fieldset>
			</div>

			<!-- Tombol Test Koneksi & Notifikasi -->
			<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-1">
				<div class="flex items-center gap-2">
					<button
						type="button"
						class="btn btn-sm btn-soft btn-info"
						onclick={handleTest}
						disabled={testing || !baseUrl || !apiKeyInput}
					>
						{#if testing}
							<span class="loading loading-spinner loading-xs"></span>
							Menguji...
						{:else}
							<Icon name="repeat" />
							Uji Koneksi
						{/if}
					</button>

					{#if testResult}
						<div
							class="alert {testResult.success
								? 'alert-success'
								: 'alert-error'} py-1.5 px-3 text-xs inline-flex items-center gap-1.5"
						>
							<Icon name={testResult.success ? 'success' : 'alert'} />
							<span>{testResult.message}</span>
						</div>
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
			</div>
		</div>
	</div>
</section>
