<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	import { toast } from '$lib/components/toast.svelte';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	let selectedKelasId = $state<number>(data.kelasList[0]?.id ?? 0);
	let loading = $state(false);
	let pushing = $state(false);

	let preview = $state<{
		mappingReady: boolean;
		summary: { totalMurid: number; readyCount: number; skippedCount: number };
		items: Array<{
			muridId: number;
			nama: string;
			nisn: string;
			sakit: number;
			izin: number;
			alfa: number;
			catatan: string;
			skipReason: string | null;
		}>;
	} | null>(null);

	async function runDryRun() {
		if (!selectedKelasId) return;
		loading = true;
		preview = null;
		try {
			const res = await fetch('/api/erapor/sync-walas', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					mode: 'dry-run',
					type: 'both',
					kelasId: selectedKelasId,
					semesterId: data.semesterId
				})
			});
			const json = await res.json();
			if (!res.ok) throw new Error(json.error || 'Gagal memuat preview');
			preview = json;
			toast(`Preview siap: ${json.summary.readyCount} murid siap dikirim.`, 'success');
		} catch (err: unknown) {
			toast(err instanceof Error ? err.message : String(err), 'error');
		} finally {
			loading = false;
		}
	}

	async function runPush(type: 'kehadiran' | 'catatan' | 'both') {
		pushing = true;
		try {
			const res = await fetch('/api/erapor/sync-walas', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					mode: 'push',
					type,
					kelasId: selectedKelasId,
					semesterId: data.semesterId
				})
			});
			const json = await res.json();
			if (!res.ok) throw new Error(json.error || 'Gagal mengirim ke e-Rapor');
			toast(
				`Sinkronisasi ${json.status}: ${json.totalSuccess}/${json.totalData} murid berhasil.`,
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
	<div class="card bg-base-100 border-base-200 space-y-4 rounded-xl border p-4 shadow-xs">
		<div>
			<h2 class="text-base font-bold">5. Sinkronisasi Kehadiran & Catatan Wali Kelas</h2>
			<p class="text-base-content/70 text-xs">
				Mengirim data rekap Sakit/Izin/Alfa dan Catatan Wali Kelas ke e-Rapor SMA.
			</p>
		</div>

		<label class="form-control w-full max-w-sm">
			<span class="label-text mb-1 text-xs font-semibold">Kelas / Rombel</span>
			<select
				class="select select-bordered select-sm w-full"
				bind:value={selectedKelasId}
				onchange={() => (preview = null)}
			>
				{#each data.kelasList as k (k.id)}
					<option value={k.id}>{k.nama} {k.fase ? `(${k.fase})` : ''}</option>
				{/each}
			</select>
		</label>

		<div class="flex flex-wrap gap-2 border-t border-base-200 pt-3">
			<button
				type="button"
				class="btn btn-sm btn-outline btn-info"
				disabled={loading || !selectedKelasId}
				onclick={runDryRun}
			>
				{#if loading}
					<span class="loading loading-spinner loading-xs"></span>
				{:else}
					<Icon name="search" class="h-4 w-4" />
				{/if}
				Cek Data / Preview
			</button>

			<button
				type="button"
				class="btn btn-sm btn-primary"
				disabled={pushing || !preview || !preview.mappingReady || preview.summary.readyCount === 0}
				onclick={() => runPush('kehadiran')}
			>
				Kirim Kehadiran
			</button>

			<button
				type="button"
				class="btn btn-sm btn-secondary"
				disabled={pushing || !preview || !preview.mappingReady || preview.summary.readyCount === 0}
				onclick={() => runPush('catatan')}
			>
				Kirim Catatan Wali
			</button>

			<button
				type="button"
				class="btn btn-sm btn-success text-white"
				disabled={pushing || !preview || !preview.mappingReady || preview.summary.readyCount === 0}
				onclick={() => runPush('both')}
			>
				Kirim Keduanya
			</button>
		</div>
	</div>

	{#if preview}
		<div class="card bg-base-100 border-base-200 space-y-3 rounded-xl border p-4 shadow-xs">
			{#if !preview.mappingReady}
				<div class="alert alert-warning text-xs">
					<Icon name="warning" class="h-4 w-4 shrink-0" />
					<span>
						Kelas ini belum dipetakan ke Rombel e-Rapor SMA. Lengkapi di tab
						<strong>Pemetaan Data</strong> terlebih dahulu.
					</span>
				</div>
			{/if}

			<div class="max-h-96 overflow-auto">
				<table class="table-xs table">
					<thead>
						<tr>
							<th>Nama Murid</th>
							<th>NISN</th>
							<th>S</th>
							<th>I</th>
							<th>A</th>
							<th>Catatan Wali</th>
							<th>Status</th>
						</tr>
					</thead>
					<tbody>
						{#each preview.items as item (item.muridId)}
							<tr>
								<td class="font-medium">{item.nama}</td>
								<td class="font-mono">{item.nisn || '-'}</td>
								<td>{item.sakit}</td>
								<td>{item.izin}</td>
								<td>{item.alfa}</td>
								<td class="max-w-xs truncate" title={item.catatan}>{item.catatan || '-'}</td>
								<td>
									{#if item.skipReason}
										<span class="badge badge-xs badge-warning">{item.skipReason}</span>
									{:else}
										<span class="badge badge-xs badge-success text-white">Siap</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</div>
