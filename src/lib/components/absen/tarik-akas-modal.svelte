<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { hideModal } from '$lib/components/global-modal.svelte';
	import { toast } from '$lib/components/toast.svelte';
	import Icon from '$lib/components/icon.svelte';

	let {
		kelasId,
		kelasNama = '',
		tanggal,
		isAdmin = false
	}: {
		kelasId?: number;
		kelasNama?: string;
		tanggal: string;
		isAdmin?: boolean;
	} = $props();

	type SyncScope = 'kelas' | 'semua';
	type SyncRange = 'daily' | 'bulan_ini' | 'semester_ini' | 'custom';

	let scope = $state<SyncScope>('kelas');
	let rangeMode = $state<SyncRange>('daily');

	// Hitung awal & akhir bulan ini berdasarkan tanggal aktif
	// svelte-ignore state_referenced_locally
	const activeDate = new Date(tanggal + 'T00:00:00');
	const curYear = activeDate.getFullYear();
	const curMonth = activeDate.getMonth();
	const firstDayStr = `${curYear}-${String(curMonth + 1).padStart(2, '0')}-01`;
	const lastDay = new Date(curYear, curMonth + 1, 0).getDate();
	const lastDayStr = `${curYear}-${String(curMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

	let customStart = $state(firstDayStr);
	let customEnd = $state(lastDayStr);

	let isSyncing = $state(false);
	let syncStatusText = $state('');
	let syncError = $state<string | null>(null);

	interface SyncStats {
		hadir: number;
		sakit: number;
		izin: number;
		alfa: number;
		terlambat: number;
		totalRecords: number;
	}

	interface SyncResult {
		success: boolean;
		message: string;
		kelasNama: string;
		totalMuridRapkumer: number;
		matchedByNisn: number;
		unmatchedStudents: Array<{ nama: string; nisn: string | null }>;
		stats: SyncStats;
	}

	let result = $state<SyncResult | null>(null);

	async function startSync() {
		isSyncing = true;
		syncError = null;
		result = null;
		syncStatusText = 'Menghubungi API AKAS v2...';

		try {
			const payload: {
				kelasId?: number;
				mode: 'daily' | 'range' | 'recap';
				date?: string;
				startDate?: string;
				endDate?: string;
			} = {
				kelasId: scope === 'kelas' ? kelasId : undefined,
				mode: 'daily'
			};

			if (rangeMode === 'daily') {
				payload.mode = 'daily';
				payload.date = tanggal;
			} else if (rangeMode === 'bulan_ini') {
				payload.mode = 'range';
				payload.startDate = firstDayStr;
				payload.endDate = lastDayStr;
			} else if (rangeMode === 'semester_ini') {
				payload.mode = 'recap';
			} else if (rangeMode === 'custom') {
				if (!customStart || !customEnd) {
					throw new Error('Rentang tanggal kustom belum lengkap.');
				}
				if (customStart > customEnd) {
					throw new Error('Tanggal mulai tidak boleh lebih akhir dari tanggal selesai.');
				}
				payload.mode = 'range';
				payload.startDate = customStart;
				payload.endDate = customEnd;
			}

			syncStatusText = 'Menarik data presensi dan mencocokkan NISN...';

			const res = await fetch('/api/akas/sync', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			const data = await res.json();

			if (!res.ok || !data.success) {
				throw new Error(data.message || `HTTP ${res.status} saat sinkronisasi`);
			}

			result = data;
			toast({ message: data.message, type: 'success' });
			await invalidate('app:absen');
		} catch (err: unknown) {
			syncError = err instanceof Error ? err.message : String(err);
			toast({ message: syncError, type: 'error' });
		} finally {
			isSyncing = false;
			syncStatusText = '';
		}
	}
</script>

<div class="space-y-4">
	{#if !result}
		<!-- Form Pengaturan Tarik Presensi -->
		<div class="space-y-3">
			<!-- Pilihan Rombel -->
			<div class="space-y-1">
				<label for="akas-scope-select" class="text-xs font-semibold text-base-content/70">
					Target Rombel / Kelas
				</label>
				<select
					id="akas-scope-select"
					class="select select-sm bg-base-200 dark:bg-base-300 w-full rounded-md"
					bind:value={scope}
					disabled={isSyncing}
				>
					<option value="kelas">Kelas {kelasNama || 'Terpilih'}</option>
					{#if isAdmin}
						<option value="semua">Semua Rombel</option>
					{/if}
				</select>
			</div>

			<!-- Pilihan Rentang Waktu -->
			<div class="space-y-1">
				<label for="akas-range-select" class="text-xs font-semibold text-base-content/70">
					Rentang Presensi
				</label>
				<select
					id="akas-range-select"
					class="select select-sm bg-base-200 dark:bg-base-300 w-full rounded-md"
					bind:value={rangeMode}
					disabled={isSyncing}
				>
					<option value="daily">Hari Ini ({tanggal})</option>
					<option value="bulan_ini">Bulan Ini ({firstDayStr} s.d {lastDayStr})</option>
					<option value="semester_ini">Semester Ini (Rekap Rapor)</option>
					<option value="custom">Kustom Rentang Tanggal</option>
				</select>
			</div>

			<!-- Input Kustom Rentang Tanggal -->
			{#if rangeMode === 'custom'}
				<div class="grid grid-cols-2 gap-2 pt-1">
					<div class="space-y-1">
						<label for="akas-custom-start" class="text-xs font-medium text-base-content/70">
							Tanggal Mulai
						</label>
						<input
							id="akas-custom-start"
							type="date"
							class="input input-sm bg-base-200 dark:bg-base-300 w-full rounded-md"
							bind:value={customStart}
							disabled={isSyncing}
						/>
					</div>
					<div class="space-y-1">
						<label for="akas-custom-end" class="text-xs font-medium text-base-content/70">
							Tanggal Selesai
						</label>
						<input
							id="akas-custom-end"
							type="date"
							class="input input-sm bg-base-200 dark:bg-base-300 w-full rounded-md"
							bind:value={customEnd}
							disabled={isSyncing}
						/>
					</div>
				</div>
			{/if}
		</div>

		<!-- Error Message -->
		{#if syncError}
			<div class="alert alert-error alert-soft text-xs py-2 px-3 rounded-lg flex items-start gap-2">
				<Icon name="alert" />
				<div class="flex-1">
					<strong>Sinkronisasi Gagal:</strong>
					<p>{syncError}</p>
				</div>
			</div>
		{/if}

		<!-- Loading State -->
		{#if isSyncing}
			<div class="space-y-2 py-3 text-center">
				<div class="flex items-center justify-center gap-2 text-sm text-primary font-medium">
					<span class="loading loading-spinner loading-md"></span>
					<span>{syncStatusText}</span>
				</div>
				<progress class="progress progress-primary w-full"></progress>
			</div>
		{/if}

		<!-- Action Buttons -->
		<div
			class="flex items-center justify-end gap-2 pt-2 border-t border-base-200 dark:border-base-300"
		>
			<button
				type="button"
				class="btn btn-sm btn-ghost rounded-md"
				disabled={isSyncing}
				onclick={() => hideModal()}
			>
				Batal
			</button>
			<button
				type="button"
				class="btn btn-sm btn-primary rounded-md gap-1"
				disabled={isSyncing}
				onclick={startSync}
			>
				{#if isSyncing}
					<span class="loading loading-spinner loading-xs"></span>
					Menarik...
				{:else}
					<Icon name="download" />
					Tarik Presensi
				{/if}
			</button>
		</div>
	{:else}
		<!-- Hasil Rekonsiliasi Sukses -->
		<div class="space-y-3">
			<div
				class="alert alert-success alert-soft py-2 px-3 rounded-lg flex items-center gap-2 text-xs"
			>
				<Icon name="check" />
				<div class="flex-1">
					<strong>Sinkronisasi Berhasil!</strong>
					<p>{result.message}</p>
				</div>
			</div>

			<!-- Grid Ringkasan -->
			<div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
				<div class="p-2.5 rounded-lg bg-base-200 dark:bg-base-300 text-center">
					<span class="text-xs text-base-content/70 block">Total Siswa</span>
					<span class="text-base font-bold text-base-content">{result.totalMuridRapkumer}</span>
				</div>
				<div class="p-2.5 rounded-lg bg-base-200 dark:bg-base-300 text-center">
					<span class="text-xs text-base-content/70 block">Cocok NISN</span>
					<span class="text-base font-bold text-success">{result.matchedByNisn}</span>
				</div>
				<div class="p-2.5 rounded-lg bg-base-200 dark:bg-base-300 text-center">
					<span class="text-xs text-base-content/70 block">Hadir</span>
					<span class="text-base font-bold text-primary">{result.stats.hadir}</span>
				</div>
				<div class="p-2.5 rounded-lg bg-base-200 dark:bg-base-300 text-center">
					<span class="text-xs text-base-content/70 block">Sakit / Izin / Alfa</span>
					<span class="text-base font-bold text-warning">
						{result.stats.sakit + result.stats.izin + result.stats.alfa}
					</span>
				</div>
			</div>

			<!-- Unmatched Students Warning -->
			{#if result.unmatchedStudents && result.unmatchedStudents.length > 0}
				<div class="alert alert-warning alert-soft p-3 rounded-lg text-xs space-y-2">
					<div class="flex items-center gap-2 font-semibold">
						<Icon name="warning" />
						<span>
							{result.unmatchedStudents.length} siswa Rapkumer tidak memiliki NISN atau tidak cocok di
							AKAS:
						</span>
					</div>
					<ul
						class="list-disc list-inside max-h-32 overflow-y-auto pl-1 space-y-0.5 text-base-content/80"
					>
						{#each result.unmatchedStudents as s, idx (idx)}
							<li>{s.nama} {s.nisn ? `(NISN: ${s.nisn})` : '(NISN Kosong)'}</li>
						{/each}
					</ul>
				</div>
			{/if}

			<!-- Action Buttons -->
			<div
				class="flex items-center justify-end gap-2 pt-2 border-t border-base-200 dark:border-base-300"
			>
				<button
					type="button"
					class="btn btn-sm btn-ghost rounded-md"
					onclick={() => {
						result = null;
					}}
				>
					Tarik Lagi
				</button>
				<button type="button" class="btn btn-sm btn-primary rounded-md" onclick={() => hideModal()}>
					Selesai
				</button>
			</div>
		</div>
	{/if}
</div>
