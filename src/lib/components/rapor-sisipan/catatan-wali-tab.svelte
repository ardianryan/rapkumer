<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	import { toast } from '$lib/components/toast.svelte';

	interface CatatanWaliRow {
		muridId: number;
		no: number;
		nama: string;
		nisn?: string | null;
		catatanWali: string;
		sakit: number;
		izin: number;
		alfa: number;
	}

	interface Props {
		kelasId: number;
		kelasNama: string;
		items: CatatanWaliRow[];
		canEdit?: boolean;
		onSaved?: () => void;
	}

	let { kelasId, kelasNama, items, canEdit = true, onSaved }: Props = $props();

	// svelte-ignore state_referenced_locally
	let rows = $state(
		items.map((it) => ({
			muridId: it.muridId,
			no: it.no,
			nama: it.nama,
			nisn: it.nisn,
			catatanWali: it.catatanWali || '',
			sakit: it.sakit || 0,
			izin: it.izin || 0,
			alfa: it.alfa || 0
		}))
	);

	let isSaving = $state(false);
	let isSyncing = $state(false);

	async function handleSyncPresensi() {
		if (!canEdit) return;
		isSyncing = true;
		try {
			const res = await fetch('/api/rapor-sisipan/sinkron-presensi', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ kelasId })
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Gagal menyinkronkan presensi.');

			toast(data.message || 'Presensi berhasil ditarik otomatis!', 'success');
			onSaved?.();
		} catch (err) {
			toast((err as Error).message, 'error');
		} finally {
			isSyncing = false;
		}
	}

	async function handleSaveAll() {
		if (!canEdit) return;
		isSaving = true;
		try {
			const res = await fetch('/api/rapor-sisipan/catatan-wali', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					kelasId,
					items: rows.map((r) => ({
						muridId: r.muridId,
						catatanWali: r.catatanWali,
						sakit: r.sakit,
						izin: r.izin,
						alfa: r.alfa
					}))
				})
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Gagal menyimpan catatan wali.');

			toast(data.message || 'Catatan wali dan presensi tersimpan.', 'success');
			onSaved?.();
		} catch (err) {
			toast((err as Error).message, 'error');
		} finally {
			isSaving = false;
		}
	}
</script>

<div class="space-y-4">
	<div
		class="flex flex-wrap items-center justify-between gap-3 bg-base-100 p-4 rounded-xl border border-base-200 shadow-xs"
	>
		<div>
			<h3 class="text-base font-bold text-base-content">
				Catatan Wali Kelas & Presensi Tengah Semester
			</h3>
			<p class="text-xs text-base-content/70 mt-0.5">
				Kelas: <strong class="text-primary">{kelasNama}</strong>. Data ini akan tercetak pada lembar
				Rapor Sisipan (STS).
			</p>
		</div>

		<div class="flex items-center gap-2">
			<button
				type="button"
				class="btn btn-sm btn-soft btn-secondary"
				onclick={handleSyncPresensi}
				disabled={!canEdit || isSyncing}
				title="Tarik rekapan ketidakhadiran dari absensi harian paruh semester"
			>
				{#if isSyncing}
					<span class="loading loading-spinner loading-xs"></span>
					Menyinkronkan...
				{:else}
					<Icon name="repeat" />
					Tarik Presensi Otomatis
				{/if}
			</button>

			<button
				type="button"
				class="btn btn-sm btn-primary"
				onclick={handleSaveAll}
				disabled={!canEdit || isSaving}
			>
				{#if isSaving}
					<span class="loading loading-spinner loading-xs"></span>
					Menyimpan...
				{:else}
					<Icon name="check" />
					Simpan Catatan & Presensi
				{/if}
			</button>
		</div>
	</div>

	<!-- TABEL CATATAN WALI -->
	<div class="bg-base-100 overflow-x-auto rounded-xl border border-base-200 shadow-md">
		<table class="table table-sm w-full">
			<thead>
				<tr class="bg-base-200 text-base-content font-bold">
					<th class="w-12 text-center">No</th>
					<th class="min-w-44">Nama Peserta Didik</th>
					<th class="w-20 text-center" title="Sakit">Sakit (Hari)</th>
					<th class="w-20 text-center" title="Izin">Izin (Hari)</th>
					<th class="w-24 text-center" title="Tanpa Keterangan">Alfa (Hari)</th>
					<th class="min-w-72">Catatan Wali Kelas</th>
				</tr>
			</thead>
			<tbody>
				{#each rows as r (r.muridId)}
					<tr class="hover:bg-base-200/40 border-b border-base-200">
						<td class="text-center font-medium text-base-content/60">{r.no}</td>
						<td>
							<div class="font-bold text-xs">{r.nama}</div>
							{#if r.nisn}
								<div class="text-[10px] text-base-content/50">{r.nisn}</div>
							{/if}
						</td>
						<td class="text-center">
							<input
								type="number"
								min="0"
								class="input input-xs bg-base-200/70 text-center w-14 font-bold"
								bind:value={r.sakit}
								disabled={!canEdit}
							/>
						</td>
						<td class="text-center">
							<input
								type="number"
								min="0"
								class="input input-xs bg-base-200/70 text-center w-14 font-bold"
								bind:value={r.izin}
								disabled={!canEdit}
							/>
						</td>
						<td class="text-center">
							<input
								type="number"
								min="0"
								class="input input-xs bg-base-200/70 text-center w-14 font-bold"
								bind:value={r.alfa}
								disabled={!canEdit}
							/>
						</td>
						<td>
							<input
								type="text"
								class="input input-xs bg-base-200/60 w-full"
								placeholder="Catatan perkembangan karakter & motivasi tengah semester..."
								bind:value={r.catatanWali}
								disabled={!canEdit}
							/>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
