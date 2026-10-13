<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
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
		jumlahPelanggaran?: number;
		poinPelanggaran?: number;
		akasViolationsSyncedAt?: string | null;
	}

	interface Props {
		kelasId: number;
		kelasNama: string;
		items: CatatanWaliRow[];
		akasBaseUrl?: string;
		isAkasMode?: boolean;
		canEdit?: boolean;
		onSaved?: () => void;
	}

	let {
		kelasId,
		kelasNama,
		items,
		akasBaseUrl = 'https://akas.smage.my.id',
		isAkasMode = false,
		canEdit = true,
		onSaved
	}: Props = $props();

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
			alfa: it.alfa || 0,
			jumlahPelanggaran: it.jumlahPelanggaran || 0,
			poinPelanggaran: it.poinPelanggaran || 0,
			akasViolationsSyncedAt: it.akasViolationsSyncedAt || null
		}))
	);

	let isSaving = $state(false);
	let isSyncing = $state(false);

	async function handleSync() {
		if (!canEdit) return;
		isSyncing = true;
		try {
			const res = await fetch('/api/rapor-sisipan/sinkron-presensi', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ kelasId })
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Gagal menyinkronkan data.');

			toast(
				data.message || (isAkasMode ? 'Data AKAS berhasil ditarik!' : 'Presensi berhasil ditarik!'),
				'success'
			);
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

		<div class="flex flex-wrap items-center gap-2">
			<button
				type="button"
				class="btn btn-sm btn-soft {isAkasMode ? 'btn-warning' : 'btn-secondary'}"
				onclick={handleSync}
				disabled={!canEdit || isSyncing}
				title={isAkasMode
					? 'Tarik rekapitulasi kehadiran (S/I/A) serta pelanggaran & poin terbaru dari AKAS'
					: 'Tarik rekapan ketidakhadiran dari absensi harian paruh semester'}
			>
				{#if isSyncing}
					<span class="loading loading-spinner loading-xs"></span>
					{isAkasMode ? 'Menarik Data AKAS...' : 'Menyinkronkan...'}
				{:else}
					<Icon name="repeat" />
					{isAkasMode ? 'Tarik Data AKAS' : 'Tarik Presensi Otomatis'}
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

	<!-- BANNER INFORMASI INTEGRASI AKAS -->
	<div
		class="alert bg-base-100 border border-amber-500/30 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs"
	>
		<div class="flex items-center gap-3">
			<div
				class="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold shrink-0"
			>
				<Icon name="info" />
			</div>
			<div class="leading-relaxed text-base-content/80">
				<div class="font-bold text-base-content flex items-center gap-1.5">
					Integrasi Data AKAS (Kehadiran & Kedisiplinan)
				</div>
				Data kehadiran (Sakit, Izin, Alfa) dan rekapitulasi kedisiplinan (pelanggaran & poin) disinkronkan
				terpusat dari aplikasi<strong>AKAS</strong>. Untuk meninjau detail kejadian maupun tindak
				lanjut pembinaan siswa, silakan menuju aplikasi <strong>AKAS</strong>.
			</div>
		</div>
		<a
			href={akasBaseUrl}
			target="_blank"
			rel="noreferrer"
			class="btn btn-xs btn-outline btn-warning gap-1.5 font-bold shadow-none"
		>
			<Icon name="export" />
			Buka Aplikasi AKAS
		</a>
	</div>

	<!-- TABEL CATATAN WALI -->
	<div class="bg-base-100 overflow-x-auto rounded-xl border border-base-200 shadow-md">
		<table class="table table-sm w-full">
			<thead>
				<tr class="bg-base-200 text-base-content font-bold">
					<th class="w-12 text-center">No</th>
					<th class="min-w-44">Nama Peserta Didik</th>
					<th
						class="w-24 text-center bg-amber-500/10 text-amber-700 dark:text-amber-400"
						title="Jumlah Pelanggaran siswa tercatat di AKAS"
					>
						Pelanggaran
					</th>
					<th
						class="w-24 text-center bg-amber-500/10 text-amber-700 dark:text-amber-400"
						title="Total akumulasi poin pelanggaran siswa di AKAS"
					>
						Poin
					</th>
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

						<!-- REKAP PELANGGARAN DARI AKAS -->
						<td class="text-center bg-amber-500/5">
							{#if r.jumlahPelanggaran > 0}
								<span class="badge badge-xs badge-warning font-bold px-2 py-0.5">
									{r.jumlahPelanggaran}x
								</span>
							{:else}
								<span class="text-base-content/40 text-xs">0</span>
							{/if}
						</td>

						<!-- POIN PELANGGARAN DARI AKAS -->
						<td class="text-center bg-amber-500/5">
							{#if r.poinPelanggaran > 0}
								<span class="badge badge-xs badge-error font-bold px-2 py-0.5">
									{r.poinPelanggaran} Poin
								</span>
							{:else}
								<span class="text-emerald-600 dark:text-emerald-400 font-semibold text-xs">0</span>
							{/if}
						</td>

						<td class="text-center">
							<input
								type="number"
								min="0"
								class="input input-xs text-center w-14 font-bold {isAkasMode
									? 'bg-base-300/40 text-base-content/70 cursor-not-allowed border-dashed'
									: 'bg-base-200/70'}"
								bind:value={r.sakit}
								disabled={!canEdit || isAkasMode}
								title={isAkasMode ? 'Terkunci (Sinkron otomatis dari AKAS)' : undefined}
							/>
						</td>
						<td class="text-center">
							<input
								type="number"
								min="0"
								class="input input-xs text-center w-14 font-bold {isAkasMode
									? 'bg-base-300/40 text-base-content/70 cursor-not-allowed border-dashed'
									: 'bg-base-200/70'}"
								bind:value={r.izin}
								disabled={!canEdit || isAkasMode}
								title={isAkasMode ? 'Terkunci (Sinkron otomatis dari AKAS)' : undefined}
							/>
						</td>
						<td class="text-center">
							<input
								type="number"
								min="0"
								class="input input-xs text-center w-14 font-bold {isAkasMode
									? 'bg-base-300/40 text-base-content/70 cursor-not-allowed border-dashed'
									: 'bg-base-200/70'}"
								bind:value={r.alfa}
								disabled={!canEdit || isAkasMode}
								title={isAkasMode ? 'Terkunci (Sinkron otomatis dari AKAS)' : undefined}
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
