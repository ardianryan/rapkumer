<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import Icon from '$lib/components/icon.svelte';
	import { toast } from '$lib/components/toast.svelte';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	let apiUrl = $state(data.config.apiUrl || '');
	// svelte-ignore state_referenced_locally
	let apiKeyInput = $state(data.config.maskedKey || '');
	// svelte-ignore state_referenced_locally
	let activeSemesterId = $state(data.config.activeSemesterId || '');
	// svelte-ignore state_referenced_locally
	let timeoutMs = $state(data.config.timeoutMs || 30000);
	// svelte-ignore state_referenced_locally
	let keySet = $state(data.config.keySet);

	let showKey = $state(false);
	let testing = $state(false);
	let saving = $state(false);
	let semesters = $state<Array<{ semester_id: string; nama_semester: string }>>([]);
	let testResult = $state<{
		success: boolean;
		message: string;
		appVersion?: string;
		totalTables?: number;
	} | null>(null);

	async function handleTest() {
		testing = true;
		testResult = null;
		try {
			const res = await fetch('/api/erapor/test', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					apiUrl,
					apiKey: apiKeyInput,
					timeoutMs: Number(timeoutMs) || 30000
				})
			});
			const json = await res.json();
			testResult = {
				success: Boolean(json.success),
				message: json.message || 'Gagal menguji koneksi.',
				appVersion: json.appVersion,
				totalTables: json.totalTables
			};
			if (Array.isArray(json.semesters) && json.semesters.length > 0) {
				semesters = json.semesters;
				if (!activeSemesterId && json.activeSemester?.semester_id) {
					activeSemesterId = json.activeSemester.semester_id;
				}
			}
			toast(testResult.message, testResult.success ? 'success' : 'error');
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			testResult = { success: false, message: msg };
			toast(msg, 'error');
		} finally {
			testing = false;
		}
	}

	async function handleSave() {
		saving = true;
		try {
			const res = await fetch('/api/erapor/settings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					apiUrl,
					apiKey: apiKeyInput,
					activeSemesterId,
					timeoutMs: Number(timeoutMs) || 30000
				})
			});
			const json = await res.json();
			if (!res.ok) {
				toast(json.error || 'Gagal menyimpan pengaturan.', 'error');
				return;
			}
			if (json.apiUrl) apiUrl = json.apiUrl;
			if (json.maskedKey) apiKeyInput = json.maskedKey;
			keySet = Boolean(json.keySet);
			toast(json.message || 'Pengaturan disimpan.', 'success');
			await invalidateAll();
		} catch (err: unknown) {
			toast(err instanceof Error ? err.message : String(err), 'error');
		} finally {
			saving = false;
		}
	}
</script>

<div class="card bg-base-100 border-base-200 rounded-xl border p-5 shadow-xs">
	<h2 class="mb-1 text-base font-bold">1. Pengaturan Koneksi Bridge REST API</h2>
	<p class="text-base-content/70 mb-4 text-xs">
		Masukkan URL server Bridge e-Rapor SMA dan API Key yang dibuat melalui
		<code>setup-erapor-sso.cmd</code> (Menu [3] KONFIGURASI).
	</p>

	{#if testResult}
		<div
			class="alert mb-4 text-xs {testResult.success ? 'alert-success text-white' : 'alert-error'}"
		>
			<Icon name={testResult.success ? 'success' : 'error'} class="h-4 w-4 shrink-0" />
			<div>
				<div class="font-bold">{testResult.message}</div>
				{#if testResult.success && testResult.totalTables}
					<div class="opacity-90">Entitas / tabel tervalidasi: {testResult.totalTables}</div>
				{/if}
			</div>
		</div>
	{/if}

	<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
		<label class="form-control w-full">
			<span class="label-text mb-1 text-xs font-semibold">URL Server Bridge e-Rapor</span>
			<input
				type="url"
				class="input input-bordered input-sm w-full"
				placeholder="https://erapor.sekolah.sch.id/bridge"
				bind:value={apiUrl}
			/>
			<span class="text-base-content/50 mt-1 text-[11px]">
				Bisa isi domain dasar atau lengkap dengan <code>/bridge</code>.
			</span>
		</label>

		<label class="form-control w-full">
			<span class="label-text mb-1 text-xs font-semibold">
				API Key Bridge {keySet ? '(tersimpan)' : ''}
			</span>
			<div class="join w-full">
				<input
					type={showKey ? 'text' : 'password'}
					class="input input-bordered input-sm join-item w-full font-mono"
					placeholder="erapor_write_..."
					bind:value={apiKeyInput}
				/>
				<button
					type="button"
					class="btn btn-sm btn-ghost join-item border-base-300 border"
					onclick={() => (showKey = !showKey)}
					aria-label="Tampilkan atau sembunyikan API Key"
				>
					<Icon name={showKey ? 'eye-off' : 'eye'} class="h-4 w-4" />
				</button>
			</div>
		</label>

		<label class="form-control w-full">
			<span class="label-text mb-1 text-xs font-semibold">Semester Target e-Rapor</span>
			{#if semesters.length > 0}
				<select class="select select-bordered select-sm w-full" bind:value={activeSemesterId}>
					{#each semesters as sem (sem.semester_id)}
						<option value={sem.semester_id}>
							{sem.semester_id} — {sem.nama_semester}
						</option>
					{/each}
				</select>
			{:else}
				<input
					type="text"
					class="input input-bordered input-sm w-full font-mono"
					placeholder="20261 (klik Tes Koneksi untuk memuat daftar semester)"
					bind:value={activeSemesterId}
				/>
			{/if}
		</label>

		<label class="form-control w-full">
			<span class="label-text mb-1 text-xs font-semibold">Timeout Request (ms)</span>
			<input
				type="number"
				min="3000"
				max="120000"
				step="1000"
				class="input input-bordered input-sm w-full"
				bind:value={timeoutMs}
			/>
		</label>
	</div>

	<div class="mt-5 flex flex-wrap items-center gap-2 border-t border-base-200 pt-4">
		<button
			type="button"
			class="btn btn-sm btn-outline btn-info"
			disabled={testing}
			onclick={handleTest}
		>
			{#if testing}
				<span class="loading loading-spinner loading-xs"></span>
			{:else}
				<Icon name="activity" class="h-4 w-4" />
			{/if}
			Tes Koneksi
		</button>

		<button type="button" class="btn btn-sm btn-primary" disabled={saving} onclick={handleSave}>
			{#if saving}
				<span class="loading loading-spinner loading-xs"></span>
			{:else}
				<Icon name="save" class="h-4 w-4" />
			{/if}
			Simpan Pengaturan
		</button>
	</div>
</div>
