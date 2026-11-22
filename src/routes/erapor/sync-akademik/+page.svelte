<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	import { toast } from '$lib/components/toast.svelte';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	let selectedKelasId = $state<number>(data.kelasList[0]?.id ?? 0);
	let selectedMapelId = $state<number>(0);
	let loading = $state(false);
	let pushing = $state(false);

	const mapelsForKelas = $derived(data.mapelList.filter((m) => m.kelasId === selectedKelasId));

	const effectiveMapelId = $derived(
		mapelsForKelas.some((m) => m.id === selectedMapelId)
			? selectedMapelId
			: (mapelsForKelas[0]?.id ?? 0)
	);

	let preview = $state<{
		mappingReady: boolean;
		summary: { totalMurid: number; readyCount: number; skippedCount: number };
		items: Array<{
			muridId: number;
			nama: string;
			nisn: string;
			nilaiRapor: number | null;
			deskripsiTinggi: string;
			deskripsiRendah: string;
			skipReason: string | null;
		}>;
	} | null>(null);

	async function runDryRun() {
		if (!selectedKelasId || !effectiveMapelId) {
			toast('Pilih kelas dan mata pelajaran terlebih dahulu.', 'warning');
			return;
		}
		loading = true;
		preview = null;
		try {
			const res = await fetch('/api/erapor/sync-akademik', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					mode: 'dry-run',
					type: 'both',
					kelasId: selectedKelasId,
					mataPelajaranId: effectiveMapelId,
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

	async function runPush(type: 'nilai' | 'deskripsi' | 'both') {
		pushing = true;
		try {
			const res = await fetch('/api/erapor/sync-akademik', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					mode: 'push',
					type,
					kelasId: selectedKelasId,
					mataPelajaranId: effectiveMapelId,
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
			<h2 class="text-base font-bold">4. Sinkronisasi Nilai Rapor & Capaian TP</h2>
			<p class="text-base-content/70 text-xs">
				Mengirim nilai akhir rapor (skala 0–100) dan deskripsi capaian tertinggi/terendah ke e-Rapor
				SMA.
			</p>
		</div>

		<div class="grid grid-cols-1 gap-3 md:grid-cols-2">
			<label class="form-control w-full">
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

			<label class="form-control w-full">
				<span class="label-text mb-1 text-xs font-semibold">Mata Pelajaran</span>
				<select
					class="select select-bordered select-sm w-full"
					value={effectiveMapelId}
					onchange={(e) => {
						selectedMapelId = Number(e.currentTarget.value);
						preview = null;
					}}
				>
					{#each mapelsForKelas as m (m.id)}
						<option value={m.id}>{m.kode ? `[${m.kode}] ` : ''}{m.nama}</option>
					{/each}
				</select>
			</label>
		</div>

		<div class="flex flex-wrap gap-2 border-t border-base-200 pt-3">
			<button
				type="button"
				class="btn btn-sm btn-outline btn-info"
				disabled={loading || !effectiveMapelId}
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
				onclick={() => runPush('nilai')}
			>
				Kirim Nilai Rapor
			</button>

			<button
				type="button"
				class="btn btn-sm btn-secondary"
				disabled={pushing || !preview || !preview.mappingReady || preview.summary.readyCount === 0}
				onclick={() => runPush('deskripsi')}
			>
				Kirim Deskripsi Capaian
			</button>

			<button
				type="button"
				class="btn btn-sm btn-success text-white"
				disabled={pushing || !preview || !preview.mappingReady || preview.summary.readyCount === 0}
				onclick={() => runPush('both')}
			>
				Kirim Nilai & Deskripsi
			</button>
		</div>
	</div>

	{#if preview}
		<div class="card bg-base-100 border-base-200 space-y-3 rounded-xl border p-4 shadow-xs">
			{#if !preview.mappingReady}
				<div class="alert alert-warning text-xs">
					<Icon name="warning" class="h-4 w-4 shrink-0" />
					<span>
						Kelas atau mata pelajaran ini belum dipetakan ke e-Rapor SMA. Lengkapi di tab
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
							<th>Nilai Rapor</th>
							<th>Capaian Tertinggi</th>
							<th>Capaian Terendah</th>
							<th>Status</th>
						</tr>
					</thead>
					<tbody>
						{#each preview.items as item (item.muridId)}
							<tr>
								<td class="font-medium">{item.nama}</td>
								<td class="font-mono">{item.nisn || '-'}</td>
								<td class="font-bold">{item.nilaiRapor ?? '-'}</td>
								<td class="max-w-xs truncate" title={item.deskripsiTinggi}>
									{item.deskripsiTinggi || '-'}
								</td>
								<td class="max-w-xs truncate" title={item.deskripsiRendah}>
									{item.deskripsiRendah || '-'}
								</td>
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
