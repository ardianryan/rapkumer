<script lang="ts">
	let { data } = $props();
	let expandedId = $state<number | null>(null);
</script>

<div class="card bg-base-100 border-base-200 space-y-3 rounded-xl border p-4 shadow-xs">
	<div>
		<h2 class="text-base font-bold">6. Riwayat & Log Sinkronisasi e-Rapor SMA</h2>
		<p class="text-base-content/70 text-xs">Menampilkan 50 riwayat sinkronisasi terakhir.</p>
	</div>

	<div class="overflow-x-auto">
		<table class="table-xs table">
			<thead>
				<tr>
					<th>Waktu</th>
					<th>Tipe</th>
					<th>Target</th>
					<th>Berhasil / Total</th>
					<th>Status</th>
					<th>Oleh</th>
					<th>Detail</th>
				</tr>
			</thead>
			<tbody>
				{#each data.logs as log (log.id)}
					<tr>
						<td class="whitespace-nowrap">{log.createdAt ?? '-'}</td>
						<td class="font-mono">{log.syncType}</td>
						<td>{log.targetInfo ?? '-'}</td>
						<td>
							<span class="font-bold">{log.totalSuccess}</span> / {log.totalData}
							{#if log.totalFailed > 0}
								<span class="text-error">({log.totalFailed} gagal)</span>
							{/if}
						</td>
						<td>
							{#if log.status === 'SUCCESS'}
								<span class="badge badge-xs badge-success text-white">SUCCESS</span>
							{:else if log.status === 'PARTIAL'}
								<span class="badge badge-xs badge-warning">PARTIAL</span>
							{:else}
								<span class="badge badge-xs badge-error text-white">FAILED</span>
							{/if}
						</td>
						<td>{log.executedBy ?? '-'}</td>
						<td>
							<button
								type="button"
								class="btn btn-xs btn-ghost"
								onclick={() => (expandedId = expandedId === log.id ? null : log.id)}
							>
								{expandedId === log.id ? 'Tutup' : 'Lihat JSON'}
							</button>
						</td>
					</tr>
					{#if expandedId === log.id}
						<tr>
							<td colspan="7" class="bg-base-200/40 p-3">
								<div class="grid grid-cols-1 gap-2 md:grid-cols-2">
									<div>
										<div class="mb-1 text-[11px] font-bold">Request Payload</div>
										<pre
											class="bg-base-100 max-h-48 overflow-auto rounded p-2 text-[11px]">{log.requestPayload ??
												'-'}</pre>
									</div>
									<div>
										<div class="mb-1 text-[11px] font-bold">Response Body</div>
										<pre
											class="bg-base-100 max-h-48 overflow-auto rounded p-2 text-[11px]">{log.responseBody ??
												'-'}</pre>
									</div>
								</div>
							</td>
						</tr>
					{/if}
				{:else}
					<tr>
						<td colspan="7" class="py-6 text-center italic opacity-60">
							Belum ada riwayat sinkronisasi ke e-Rapor SMA.
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
