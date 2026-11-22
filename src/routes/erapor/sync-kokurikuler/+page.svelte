<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	import { toast } from '$lib/components/toast.svelte';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	let selectedKode = $state(data.kegiatanList[0]?.kode ?? '');
	let selectedKelasId = $state<string>('');
	let loading = $state(false);
	let pushing = $state(false);

	let dryRunResult = $state<{
		isMapped: boolean;
		unmappedDimensi: string[];
		summary: { totalMurid: number; readyCount: number; skippedCount: number };
		previewNarrative: string | null;
		skippedSample: Array<{ nama: string; kelasNama: string; reason: string }>;
	} | null>(null);

	let pushResult = $state<{
		status: string;
		totalData: number;
		totalSuccess: number;
		totalFailed: number;
		errors: string[];
	} | null>(null);

	async function runDryRun() {
		if (!selectedKode) {
			toast('Pilih kegiatan kokurikuler terlebih dahulu.', 'warning');
			return;
		}
		loading = true;
		dryRunResult = null;
		pushResult = null;
		try {
			const res = await fetch('/api/erapor/sync-kokurikuler', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					mode: 'dry-run',
					siakadKode: selectedKode,
					kelasId: selectedKelasId ? Number(selectedKelasId) : null,
					semesterId: data.semesterId
				})
			});
			const json = await res.json();
			if (!res.ok) throw new Error(json.error || 'Gagal menjalankan Dry-Run');
			dryRunResult = json;
			toast(`Dry-Run selesai: ${json.summary.readyCount} siswa siap dikirim.`, 'success');
		} catch (err: unknown) {
			toast(err instanceof Error ? err.message : String(err), 'error');
		} finally {
			loading = false;
		}
	}

	async function runPush() {
		if (!dryRunResult || dryRunResult.summary.readyCount === 0) {
			toast('Jalankan "Cek Data / Dry-Run" terlebih dahulu.', 'warning');
			return;
		}
		pushing = true;
		pushResult = null;
		try {
			const res = await fetch('/api/erapor/sync-kokurikuler', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					mode: 'push',
					siakadKode: selectedKode,
					kelasId: selectedKelasId ? Number(selectedKelasId) : null,
					semesterId: data.semesterId
				})
			});
			const json = await res.json();
			if (!res.ok) throw new Error(json.error || 'Gagal sinkronisasi ke e-Rapor');
			pushResult = json;
			toast(
				`Sinkronisasi ${json.status}: ${json.totalSuccess}/${json.totalData} siswa berhasil.`,
				json.totalFailed === 0 ? 'success' : 'warning'
			);
		} catch (err: unknown) {
			toast(err instanceof Error ? err.message : String(err), 'error');
		} finally {
			pushing = false;
		}
	}
</script>

<div class="space-y-4">
	<div class="card bg-base-100 border-base-200 rounded-xl border p-4 shadow-xs space-y-4">
		<div>
			<h2 class="text-base font-bold">3. Sinkronisasi Nilai Kokurikuler (P5 / DPL)</h2>
			<p class="text-base-content/70 text-xs">
				Mengirim nilai dimensi kokurikuler per siswa secara batch (50 siswa/request) ke
				<code>POST /bridge/nilai-kokurikuler</code>. Narasi 300–500 karakter otomatis dibentuk oleh
				e-Rapor.
			</p>
		</div>

		<div class="grid grid-cols-1 gap-3 md:grid-cols-2">
			<label class="form-control w-full">
				<span class="label-text mb-1 text-xs font-semibold">Kegiatan Kokurikuler</span>
				<select class="select select-bordered select-sm w-full" bind:value={selectedKode}>
					{#each data.kegiatanList as keg (keg.kode)}
						<option value={keg.kode}>{keg.kode} — {keg.tujuan}</option>
					{/each}
				</select>
			</label>

			<label class="form-control w-full">
				<span class="label-text mb-1 text-xs font-semibold">Filter Kelas (Opsional)</span>
				<select class="select select-bordered select-sm w-full" bind:value={selectedKelasId}>
					<option value="">Semua Kelas ({data.kelasList.length})</option>
					{#each data.kelasList as k (k.id)}
						<option value={String(k.id)}>{k.nama} {k.fase ? `(${k.fase})` : ''}</option>
					{/each}
				</select>
			</label>
		</div>

		<div class="flex flex-wrap gap-2 border-t border-base-200 pt-3">
			<button
				type="button"
				class="btn btn-sm btn-outline btn-info"
				disabled={loading || !selectedKode}
				onclick={runDryRun}
			>
				{#if loading}
					<span class="loading loading-spinner loading-xs"></span>
				{:else}
					<Icon name="search" class="h-4 w-4" />
				{/if}
				1. Cek Data / Dry-Run
			</button>

			<button
				type="button"
				class="btn btn-sm btn-primary"
				disabled={pushing || !dryRunResult || dryRunResult.summary.readyCount === 0}
				onclick={runPush}
			>
				{#if pushing}
					<span class="loading loading-spinner loading-xs"></span>
				{:else}
					<Icon name="export" class="h-4 w-4" />
				{/if}
				2. Sinkronkan ke e-Rapor
			</button>
		</div>
	</div>

	{#if dryRunResult}
		<div class="card bg-base-100 border-base-200 space-y-3 rounded-xl border p-4 shadow-xs">
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
				<div class="bg-base-200/50 rounded-lg p-3">
					<div class="text-xs opacity-70">Total Murid Target</div>
					<div class="text-xl font-bold">{dryRunResult.summary.totalMurid}</div>
				</div>
				<div class="bg-success/10 rounded-lg p-3">
					<div class="text-success text-xs font-semibold">Siap Dikirim</div>
					<div class="text-success text-xl font-bold">{dryRunResult.summary.readyCount}</div>
				</div>
				<div class="bg-warning/10 rounded-lg p-3">
					<div class="text-warning text-xs font-semibold">Dilewati (Belum Lengkap/NISN)</div>
					<div class="text-warning text-xl font-bold">{dryRunResult.summary.skippedCount}</div>
				</div>
			</div>

			{#if dryRunResult.unmappedDimensi.length > 0}
				<div class="alert alert-warning text-xs">
					<Icon name="warning" class="h-4 w-4 shrink-0" />
					<span>
						Ada dimensi yang belum dipetakan ke subdimensi e-Rapor:
						<code>{dryRunResult.unmappedDimensi.join(', ')}</code>. Lengkapi di menu Pemetaan Data.
					</span>
				</div>
			{/if}

			{#if dryRunResult.previewNarrative}
				<div class="bg-base-200/40 rounded-lg p-3">
					<div class="mb-1 text-xs font-bold">
						Preview Narasi Otomatis ({dryRunResult.previewNarrative.length} karakter):
					</div>
					<p class="text-xs leading-relaxed italic">{dryRunResult.previewNarrative}</p>
				</div>
			{/if}

			{#if dryRunResult.skippedSample.length > 0}
				<div class="max-h-52 overflow-auto">
					<table class="table-xs table">
						<thead>
							<tr>
								<th>Nama Murid</th>
								<th>Kelas</th>
								<th>Alasan Dilewati</th>
							</tr>
						</thead>
						<tbody>
							{#each dryRunResult.skippedSample as item, i (`${item.nama}-${i}`)}
								<tr>
									<td>{item.nama}</td>
									<td>{item.kelasNama}</td>
									<td class="text-warning">{item.reason}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	{/if}

	{#if pushResult}
		<div
			class="alert text-xs {pushResult.totalFailed === 0
				? 'alert-success text-white'
				: 'alert-warning'}"
		>
			<div>
				<div class="font-bold">
					Hasil Sinkronisasi ({pushResult.status}): {pushResult.totalSuccess} berhasil,
					{pushResult.totalFailed} gagal dari {pushResult.totalData} siswa.
				</div>
				{#if pushResult.errors.length > 0}
					<ul class="mt-1 list-disc pl-4">
						{#each pushResult.errors as err (err)}
							<li>{err}</li>
						{/each}
					</ul>
				{/if}
			</div>
		</div>
	{/if}
</div>
