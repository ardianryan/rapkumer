<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { hideModal, updateModal } from '$lib/components/global-modal.svelte';
	import { toast } from '$lib/components/toast.svelte';
	import { searchQueryMarker } from '$lib/utils';
	import { onMount } from 'svelte';

	type MuridItem = {
		id: number;
		nama: string;
		keterangan: string | null;
	};

	let {
		daftarMurid,
		kelasId = 0,
		tanggal,
		mataPelajaranId,
		daftarMataPelajaran = [],
		namaMataPelajaran,
		perkiraanJam,
		simulasiHari,
		simulasiJam,
		tipePresensi = 'awal_mapel',
		jenisPresensi = 'wali_kelas_saja',
		bypassJadwal = false
	}: {
		daftarMurid: MuridItem[];
		kelasId?: number;
		tanggal: string;
		mataPelajaranId?: number | null;
		daftarMataPelajaran?: Array<{ id: number; nama: string }>;
		namaMataPelajaran?: string;
		perkiraanJam?: string;
		simulasiHari?: string | null;
		simulasiJam?: string | null;
		tipePresensi?: string;
		jenisPresensi?: string;
		bypassJadwal?: boolean;
	} = $props();

	// svelte-ignore state_referenced_locally
	let selectedMapelId = $state<number | null>(
		mataPelajaranId ?? daftarMataPelajaran[0]?.id ?? null
	);
	// svelte-ignore state_referenced_locally
	let selectedJamKe = $state<string>(perkiraanJam || '1-2');

	const currentMapelNama = $derived.by(() => {
		if (selectedMapelId && daftarMataPelajaran.length > 0) {
			const found = daftarMataPelajaran.find((m) => m.id === selectedMapelId);
			if (found) return found.nama;
		}
		return namaMataPelajaran ?? '';
	});

	function saveActiveSession() {
		if (typeof window !== 'undefined' && kelasId && selectedMapelId) {
			try {
				const sessionData = {
					tanggal,
					kelasId,
					mataPelajaranId: selectedMapelId,
					namaMataPelajaran: currentMapelNama,
					jamKe: selectedJamKe
				};
				localStorage.setItem('active_teaching_session', JSON.stringify(sessionData));
			} catch {
				// ignore localStorage issues
			}
		}
	}

	let step = $state<'pilih-mode' | 'pilih-murid'>('pilih-mode');
	let pilihanHadirSemua = $state<string>('');
	let searchTerm = $state('');
	let selectedIds = $state<number[]>([]);
	let keteranganMap = $state<Record<number, string>>({});
	let sessionType = $state<'awal' | 'akhir'>('awal');
	let presensiType = $state('masuk');

	const isAwalAkhir = $derived(tipePresensi === 'awal_akhir_mapel' && !!namaMataPelajaran);

	const isWaliKelasMasukPulang = $derived(
		jenisPresensi === 'wali_kelas_saja' && tipePresensi === 'masuk_pulang'
	);

	$effect(() => {
		if (step === 'pilih-murid') {
			const ids: number[] = [];
			const map: Record<number, string> = {};
			for (const m of daftarMurid) {
				if (m.keterangan) {
					ids.push(m.id);
					map[m.id] = m.keterangan;
				}
			}
			selectedIds = ids;
			keteranganMap = map;
		}
	});

	const filteredMurid = $derived.by(() => {
		if (!searchTerm.trim()) return daftarMurid;
		const q = searchTerm.trim().toLowerCase();
		return daftarMurid.filter((m) => m.nama.toLowerCase().includes(q));
	});

	const allFilteredSelected = $derived.by(() => {
		if (filteredMurid.length === 0) return false;
		return filteredMurid.every((m) => selectedIds.includes(m.id));
	});

	function toggleSelect(id: number) {
		const idx = selectedIds.indexOf(id);
		if (idx === -1) {
			selectedIds = [...selectedIds, id];
			if (!keteranganMap[id]) {
				keteranganMap = { ...keteranganMap, [id]: 'alfa' };
			}
		} else {
			selectedIds = selectedIds.filter((x) => x !== id);
			const { [id]: _, ...rest } = keteranganMap;
			keteranganMap = rest;
		}
	}

	function toggleSelectAll() {
		if (allFilteredSelected) {
			const filteredIds = new Set(filteredMurid.map((m) => m.id));
			selectedIds = selectedIds.filter((id) => !filteredIds.has(id));
			const next = { ...keteranganMap };
			for (const id of filteredIds) {
				delete next[id];
			}
			keteranganMap = next;
		} else {
			const newIds = filteredMurid.map((m) => m.id);
			const existing = new Set(selectedIds);
			const toAdd = newIds.filter((id) => !existing.has(id));
			const next = { ...keteranganMap };
			for (const id of toAdd) {
				if (!next[id]) next[id] = 'alfa';
			}
			selectedIds = [...selectedIds, ...toAdd];
			keteranganMap = next;
		}
	}

	function setKeterangan(id: number, value: string) {
		keteranganMap = { ...keteranganMap, [id]: value };
	}

	function pilihTidak() {
		pilihanHadirSemua = 'tidak';
		step = 'pilih-murid';
		updateModal({
			onPositive: {
				label: 'Simpan',
				class: 'btn-soft flex-1 sm:flex-none',
				action: () => submitSelected()
			},
			onNegative: {
				label: 'Kembali',
				class: 'btn-soft flex-1 sm:flex-none sm:mr-auto',
				action: () => goToStep1()
			},
			onNeutral: undefined
		});
	}

	function goToStep1() {
		step = 'pilih-mode';
		pilihanHadirSemua = '';
		updateModal({
			onPositive: {
				label: 'Ya',
				class: 'btn-soft flex-1 sm:flex-none',
				action: () => submitHadirSemua()
			},
			onNegative: {
				label: 'Tidak',
				class: 'btn-soft flex-1 sm:flex-none sm:mr-auto',
				action: () => pilihTidak()
			},
			onNeutral: undefined
		});
	}

	async function submitHadirSemua() {
		try {
			const fd = new FormData();
			fd.set('mode', 'hadir_semua');
			fd.set('kelasId', String(kelasId));
			fd.set('tanggal', tanggal);
			const targetMapelId = selectedMapelId ?? mataPelajaranId;
			if (targetMapelId != null) fd.set('mataPelajaranId', String(targetMapelId));
			if (simulasiHari) fd.set('simHari', simulasiHari);
			if (simulasiJam) fd.set('simJam', simulasiJam);
			if (isAwalAkhir) fd.set('sessionType', sessionType);
			if (isWaliKelasMasukPulang) fd.set('presensiType', presensiType);
			const res = await fetch('?/isiSekaligus', { method: 'POST', body: fd, redirect: 'error' });
			if (!res.ok) {
				const err = await res.json().catch(() => ({ fail: 'Gagal menyimpan' }));
				throw new Error(err.fail ?? `Error ${res.status}`);
			}
			saveActiveSession();
			hideModal();
			await invalidate('app:absen');
			toast('Kehadiran disimpan! Sesi mengajar tersinkron ke Jurnal.', 'success');
		} catch (e) {
			toast(e instanceof Error ? e.message : 'Gagal menyimpan', 'error');
		}
	}

	async function submitSelected() {
		if (selectedIds.length === 0) {
			toast('Tidak ada murid yang dipilih', 'warning');
			return;
		}
		try {
			const entries = selectedIds.map((id) => ({
				muridId: id,
				keterangan: keteranganMap[id] || 'alfa'
			}));
			const fd = new FormData();
			fd.set('mode', 'selected');
			fd.set('kelasId', String(kelasId));
			fd.set('tanggal', tanggal);
			const targetMapelId = selectedMapelId ?? mataPelajaranId;
			if (targetMapelId != null) fd.set('mataPelajaranId', String(targetMapelId));
			if (simulasiHari) fd.set('simHari', simulasiHari);
			if (simulasiJam) fd.set('simJam', simulasiJam);
			if (isAwalAkhir) fd.set('sessionType', sessionType);
			if (isWaliKelasMasukPulang) fd.set('presensiType', presensiType);
			fd.set('entries', JSON.stringify(entries));
			const res = await fetch('?/isiSekaligus', { method: 'POST', body: fd, redirect: 'error' });
			if (!res.ok) {
				const err = await res.json().catch(() => ({ fail: 'Gagal menyimpan' }));
				throw new Error(err.fail ?? `Error ${res.status}`);
			}
			saveActiveSession();
			hideModal();
			await invalidate('app:absen');
			toast('Kehadiran disimpan! Sesi mengajar tersinkron ke Jurnal.', 'success');
		} catch (e) {
			toast(e instanceof Error ? e.message : 'Gagal menyimpan', 'error');
		}
	}

	onMount(() => {
		updateModal({
			onPositive: {
				label: 'Ya',
				class: 'btn-soft flex-1 sm:flex-none',
				action: () => submitHadirSemua()
			},
			onNegative: {
				label: 'Tidak',
				class: 'btn-soft flex-1 sm:flex-none sm:mr-auto',
				action: () => pilihTidak()
			},
			onNeutral: undefined
		});
	});
</script>

{#if step === 'pilih-mode'}
	<div class="flex flex-col gap-4">
		{#if daftarMataPelajaran.length > 1}
			<div class="flex flex-col gap-1">
				<span class="text-xs font-semibold text-base-content/70">Mata Pelajaran</span>
				<select
					class="select select-sm bg-base-200 dark:bg-base-300 w-full dark:border-none"
					bind:value={selectedMapelId}
				>
					{#each daftarMataPelajaran as mp (mp.id)}
						<option value={mp.id}>{mp.nama}</option>
					{/each}
				</select>
			</div>
		{/if}

		{#if selectedMapelId || namaMataPelajaran}
			<div class="flex flex-col gap-1">
				<span class="text-xs font-semibold text-base-content/70">Jam Pelajaran ke-</span>
				<select
					class="select select-sm bg-base-200 dark:bg-base-300 w-full dark:border-none"
					bind:value={selectedJamKe}
				>
					<option value="1-2">Jam 1-2</option>
					<option value="3-4">Jam 3-4</option>
					<option value="5-6">Jam 5-6</option>
					<option value="7-8">Jam 7-8</option>
					<option value="9-10">Jam 9-10</option>
					<option value="1">Jam 1</option>
					<option value="2">Jam 2</option>
					<option value="3">Jam 3</option>
					<option value="4">Jam 4</option>
					<option value="5">Jam 5</option>
					<option value="6">Jam 6</option>
					<option value="7">Jam 7</option>
					<option value="8">Jam 8</option>
				</select>
			</div>
		{/if}

		{#if isAwalAkhir}
			<select
				class="select select-sm bg-base-200 dark:bg-base-300 w-full dark:border-none"
				bind:value={sessionType}
			>
				<option value="awal">Awal Mapel</option>
				<option value="akhir">Akhir Mapel</option>
			</select>
		{/if}
		{#if isWaliKelasMasukPulang}
			<select
				class="select select-sm bg-base-200 dark:bg-base-300 w-full dark:border-none"
				bind:value={presensiType}
			>
				<option value="masuk">Presensi Masuk</option>
				<option value="pulang">Presensi Pulang</option>
			</select>
		{/if}
		{#if currentMapelNama}
			<p class="text-base-content text-lg font-medium">
				Apakah hadir semua pada mata pelajaran {currentMapelNama}
				{selectedJamKe ? `(Jam ${selectedJamKe})` : ''}?
			</p>
		{:else}
			<p class="text-base-content text-lg font-medium">Apakah hadir semua hari ini?</p>
		{/if}
	</div>
{:else}
	<div class="flex flex-col gap-3">
		<p class="text-base-content text-lg font-medium">Siapa yang tidak hadir?</p>

		<label class="input bg-base-200 dark:bg-base-300 w-full dark:border-none">
			<input
				type="search"
				placeholder="Cari nama murid..."
				bind:value={searchTerm}
				autocomplete="off"
			/>
		</label>

		<div
			class="bg-base-100 dark:bg-base-200 max-h-80 overflow-y-auto rounded-md shadow-md dark:shadow-none"
		>
			<table class="border-base-200 table border dark:border-none">
				<thead>
					<tr class="bg-base-200 dark:bg-base-300 text-base-content text-left font-bold">
						<th class="w-12">
							<input
								type="checkbox"
								class="checkbox checkbox-sm"
								checked={allFilteredSelected}
								onclick={toggleSelectAll}
							/>
						</th>
						<th>Nama</th>
						<th class="text-center" style="min-width: 120px;">Keterangan</th>
					</tr>
				</thead>
				<tbody>
					{#each filteredMurid as murid (murid.id)}
						{@const checked = selectedIds.includes(murid.id)}
						<tr>
							<td>
								<input
									type="checkbox"
									class="checkbox checkbox-sm"
									{checked}
									onclick={() => toggleSelect(murid.id)}
								/>
							</td>
							<td>{@html searchQueryMarker(searchTerm, murid.nama)}</td>
							<td class="overflow-hidden text-center">
								{#if checked}
									<select
										class="select select-sm bg-base-200 dark:bg-base-300 w-full truncate text-center dark:border-none"
										value={keteranganMap[murid.id] || 'alfa'}
										onchange={(e) =>
											setKeterangan(murid.id, (e.currentTarget as HTMLSelectElement).value)}
									>
										<option value="sakit">Sakit</option>
										<option value="izin">Izin</option>
										<option value="alfa">TK</option>
									</select>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
{/if}
