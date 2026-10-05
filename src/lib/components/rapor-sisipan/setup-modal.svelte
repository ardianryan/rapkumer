<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	import type { RtsKomponenFormatifItem, RtsKomponenSumatifItem } from '$lib/server/db/schema';
	import { toast } from '$lib/components/toast.svelte';

	interface TujuanPembelajaranOption {
		id: number;
		deskripsi: string;
		lingkupMateri: string | null;
	}

	interface Props {
		kelasId: number;
		mapelId: number;
		mapelNama: string;
		initialKomponenFormatif?: RtsKomponenFormatifItem[];
		initialKomponenSumatif?: RtsKomponenSumatifItem[];
		initialAdaStsTes?: boolean;
		initialAdaStsNonTes?: boolean;
		initialBobotSumatif?: number;
		initialBobotSts?: number;
		availableTps?: TujuanPembelajaranOption[];
		onSaved?: () => void;
		onClose?: () => void;
	}

	let {
		kelasId,
		mapelId,
		mapelNama,
		initialKomponenFormatif = [],
		initialKomponenSumatif = [],
		initialAdaStsTes = true,
		initialAdaStsNonTes = false,
		initialBobotSumatif = 70,
		initialBobotSts = 30,
		availableTps = [],
		onSaved,
		onClose
	}: Props = $props();

	// svelte-ignore state_referenced_locally
	let komponenFormatif = $state<RtsKomponenFormatifItem[]>(
		initialKomponenFormatif.length > 0
			? JSON.parse(JSON.stringify(initialKomponenFormatif))
			: [
					{ kode: 'F1', nama: 'Tugas Harian 1' },
					{ kode: 'F2', nama: 'Tugas Harian 2' }
				]
	);

	// svelte-ignore state_referenced_locally
	let komponenSumatif = $state<RtsKomponenSumatifItem[]>(
		initialKomponenSumatif.length > 0
			? JSON.parse(JSON.stringify(initialKomponenSumatif))
			: [
					{
						kode: 'S1',
						lingkupMateri: 'Lingkup Materi 1',
						tpDeskripsi: 'Tujuan Pembelajaran 1'
					}
				]
	);

	// svelte-ignore state_referenced_locally
	let adaStsTes = $state<boolean>(initialAdaStsTes);
	// svelte-ignore state_referenced_locally
	let adaStsNonTes = $state<boolean>(initialAdaStsNonTes);
	// svelte-ignore state_referenced_locally
	let bobotSumatif = $state<number>(initialBobotSumatif);
	// svelte-ignore state_referenced_locally
	let bobotSts = $state<number>(initialBobotSts);
	let isSaving = $state<boolean>(false);

	function handleStsToggle() {
		if (!adaStsTes && !adaStsNonTes) {
			bobotSumatif = 100;
			bobotSts = 0;
		} else if (bobotSts === 0) {
			bobotSumatif = 70;
			bobotSts = 30;
		}
	}

	function addFormatif() {
		const nextNum = komponenFormatif.length + 1;
		komponenFormatif.push({
			kode: `F${nextNum}`,
			nama: `Tugas Harian ${nextNum}`
		});
	}

	function removeFormatif(index: number) {
		if (komponenFormatif.length <= 1) {
			toast('Minimal harus ada 1 asesmen formatif.', 'error');
			return;
		}
		komponenFormatif.splice(index, 1);
		// Re-index kodenya agar urut F1, F2...
		komponenFormatif.forEach((item, idx) => {
			item.kode = `F${idx + 1}`;
		});
	}

	function addSumatif() {
		const nextNum = komponenSumatif.length + 1;
		komponenSumatif.push({
			kode: `S${nextNum}`,
			lingkupMateri: `Lingkup Materi ${nextNum}`,
			tpDeskripsi: `Tujuan Pembelajaran ${nextNum}`
		});
	}

	function removeSumatif(index: number) {
		if (komponenSumatif.length <= 1) {
			toast('Minimal harus ada 1 asesmen sumatif lingkup materi.', 'error');
			return;
		}
		komponenSumatif.splice(index, 1);
		komponenSumatif.forEach((item, idx) => {
			item.kode = `S${idx + 1}`;
		});
	}

	function pickTpForSumatif(index: number, tpIdStr: string) {
		const tpId = Number(tpIdStr);
		const found = availableTps.find((t) => t.id === tpId);
		if (found && komponenSumatif[index]) {
			komponenSumatif[index].tpId = found.id;
			komponenSumatif[index].lingkupMateri = found.lingkupMateri || '';
			komponenSumatif[index].tpDeskripsi = found.deskripsi;
		}
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (bobotSumatif + bobotSts !== 100) {
			toast('Total bobot Sumatif TP dan STS harus berjumlah 100%.', 'error');
			return;
		}

		isSaving = true;
		try {
			const res = await fetch('/api/rapor-sisipan/setup', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					kelasId,
					mataPelajaranId: mapelId,
					komponenFormatif,
					komponenSumatif,
					adaStsTes,
					adaStsNonTes,
					bobotSumatifTp: bobotSumatif,
					bobotSts
				})
			});

			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Gagal menyimpan pengaturan.');

			toast(data.message || 'Pengaturan asesmen berhasil disimpan.', 'success');
			onSaved?.();
		} catch (err) {
			toast((err as Error).message, 'error');
		} finally {
			isSaving = false;
		}
	}
</script>

<div class="space-y-5">
	<div class="border-b border-base-200 pb-3">
		<h3 class="text-lg font-bold text-base-content">Atur Komponen Asesmen Rapor Sisipan (STS)</h3>
		<p class="text-xs text-base-content/70 mt-0.5">
			Mata Pelajaran: <span class="font-semibold text-primary">{mapelNama}</span>. Konfigurasi ini
			fleksibel dan khusus untuk kelas & mapel Anda.
		</p>
	</div>

	<form onsubmit={handleSubmit} class="space-y-6">
		<!-- BAGIAN 1: ASESMEN FORMATIF -->
		<div class="card bg-base-200/50 p-4 rounded-xl border border-base-200">
			<div class="flex items-center justify-between mb-3">
				<div>
					<h4 class="text-sm font-bold flex items-center gap-1.5 text-base-content">
						<span class="badge badge-primary badge-sm">1</span>
						Asesmen Formatif (Tugas Harian)
					</h4>
					<p class="text-xs text-base-content/60 mt-0.5">
						Tentukan berapa kali penugasan/praktik formatif yang dilakukan.
					</p>
				</div>
				<button type="button" class="btn btn-sm btn-soft btn-primary" onclick={addFormatif}>
					<Icon name="plus" />
					Tambah Formatif
				</button>
			</div>

			<div class="space-y-2">
				{#each komponenFormatif as f, idx (idx)}
					<div class="flex items-center gap-2 bg-base-100 p-2 rounded-lg border border-base-200">
						<span class="badge badge-neutral font-bold shrink-0">{f.kode}</span>
						<input
							type="text"
							class="input input-sm bg-base-200 dark:bg-base-300 w-full"
							placeholder="Nama tugas (misal: Resume Struktur Sel, Kuis Bab 1...)"
							bind:value={f.nama}
							required
						/>
						<button
							type="button"
							class="btn btn-sm btn-ghost btn-square text-error"
							onclick={() => removeFormatif(idx)}
							title="Hapus"
						>
							<Icon name="del" />
						</button>
					</div>
				{/each}
			</div>
		</div>

		<!-- BAGIAN 2: ASESMEN SUMATIF LINGKUP MATERI -->
		<div class="card bg-base-200/50 p-4 rounded-xl border border-base-200">
			<div class="flex items-center justify-between mb-3">
				<div>
					<h4 class="text-sm font-bold flex items-center gap-1.5 text-base-content">
						<span class="badge badge-primary badge-sm">2</span>
						Asesmen Sumatif (Ulangan Lingkup Materi / TP)
					</h4>
					<p class="text-xs text-base-content/60 mt-0.5">
						Tentukan jumlah ulangan harian per materi/TP sebelum tengah semester.
					</p>
				</div>
				<button type="button" class="btn btn-sm btn-soft btn-primary" onclick={addSumatif}>
					<Icon name="plus" />
					Tambah Sumatif TP
				</button>
			</div>

			<div class="space-y-3">
				{#each komponenSumatif as s, idx (idx)}
					<div class="bg-base-100 p-3 rounded-lg border border-base-200 space-y-2">
						<div class="flex items-center justify-between">
							<span class="badge badge-success text-white font-bold">{s.kode}</span>
							{#if availableTps.length > 0}
								<div class="flex items-center gap-1">
									<span class="text-[11px] text-base-content/60">Pilih dari TP:</span>
									<select
										class="select select-xs bg-base-200"
										onchange={(e) => pickTpForSumatif(idx, (e.target as HTMLSelectElement).value)}
									>
										<option value="">-- Pilih TP Tersimpan --</option>
										{#each availableTps as tp (tp.id)}
											<option value={tp.id}>
												{tp.lingkupMateri ? `${tp.lingkupMateri}: ` : ''}{tp.deskripsi.slice(
													0,
													45
												)}...
											</option>
										{/each}
									</select>
								</div>
							{/if}
							<button
								type="button"
								class="btn btn-xs btn-ghost btn-square text-error"
								onclick={() => removeSumatif(idx)}
								title="Hapus"
							>
								<Icon name="del" />
							</button>
						</div>

						<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
							<label class="block">
								<span class="text-[11px] text-base-content/70 font-semibold mb-0.5 block">
									Lingkup Materi
								</span>
								<input
									type="text"
									class="input input-sm bg-base-200 dark:bg-base-300 w-full"
									placeholder="Contoh: Sel Hewan & Tumbuhan"
									bind:value={s.lingkupMateri}
									required
								/>
							</label>
							<label class="block">
								<span class="text-[11px] text-base-content/70 font-semibold mb-0.5 block">
									Deskripsi Capaian / TP
								</span>
								<input
									type="text"
									class="input input-sm bg-base-200 dark:bg-base-300 w-full"
									placeholder="Contoh: Menganalisis bioproses sel..."
									bind:value={s.tpDeskripsi}
									required
								/>
							</label>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- BAGIAN 3: PENGATURAN STS & PEMBOBOTAN -->
		<div class="card bg-base-200/50 p-4 rounded-xl border border-base-200 space-y-4">
			<div>
				<h4 class="text-sm font-bold flex items-center gap-1.5 text-base-content">
					<span class="badge badge-primary badge-sm">3</span>
					Pengaturan Sumatif Tengah Semester (STS) & Bobot
				</h4>
				<p class="text-xs text-base-content/60 mt-0.5">
					Centang bentuk asesmen STS yang dilaksanakan. Kolom pengisian nilai per siswa akan
					otomatis aktif di tabel nilai.
				</p>
			</div>

			<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
				<div class="space-y-2">
					<label
						class="label cursor-pointer justify-start items-start gap-3 bg-base-100 p-2.5 rounded-lg border border-base-200 hover:border-primary/40 transition-colors"
					>
						<input
							type="checkbox"
							class="checkbox checkbox-primary checkbox-sm mt-0.5"
							bind:checked={adaStsTes}
							onchange={handleStsToggle}
						/>
						<div>
							<span class="text-xs font-semibold block text-base-content"
								>Ada STS Tertulis / Tes</span
							>
							<span class="text-[11px] text-base-content/60 block">
								Memunculkan kolom input nilai tes tertulis per siswa di tabel nilai
							</span>
						</div>
					</label>
					<label
						class="label cursor-pointer justify-start items-start gap-3 bg-base-100 p-2.5 rounded-lg border border-base-200 hover:border-primary/40 transition-colors"
					>
						<input
							type="checkbox"
							class="checkbox checkbox-primary checkbox-sm mt-0.5"
							bind:checked={adaStsNonTes}
							onchange={handleStsToggle}
						/>
						<div>
							<span class="text-xs font-semibold block text-base-content"
								>Ada STS Non-Tes (Praktik / Proyek)</span
							>
							<span class="text-[11px] text-base-content/60 block">
								Memunculkan kolom input nilai praktik/proyek per siswa di tabel nilai
							</span>
						</div>
					</label>
				</div>

				<div class="bg-base-100 p-3 rounded-lg border border-base-200 space-y-2.5">
					<div class="flex items-center justify-between text-xs">
						<span class="font-semibold text-base-content">Bobot Rata-rata Sumatif TP:</span>
						<div class="flex items-center gap-1">
							<input
								type="number"
								min="0"
								max="100"
								class="input input-xs bg-base-200 dark:bg-base-300 w-16 text-center font-bold"
								bind:value={bobotSumatif}
								disabled={!adaStsTes && !adaStsNonTes}
							/>
							<span>%</span>
						</div>
					</div>
					<div class="flex items-center justify-between text-xs">
						<span class="font-semibold text-base-content">Bobot Nilai Ujian STS:</span>
						<div class="flex items-center gap-1">
							<input
								type="number"
								min="0"
								max="100"
								class="input input-xs bg-base-200 dark:bg-base-300 w-16 text-center font-bold"
								bind:value={bobotSts}
								disabled={!adaStsTes && !adaStsNonTes}
							/>
							<span>%</span>
						</div>
					</div>

					{#if !adaStsTes && !adaStsNonTes}
						<div
							class="bg-info/10 text-info text-[11px] p-2 rounded border border-info/20 leading-tight"
						>
							Tanpa tes STS: Nilai akhir rapor sisipan dihitung 100% murni dari rata-rata Sumatif
							TP.
						</div>
					{:else}
						<div class="text-[11px] text-base-content/60 leading-tight">
							Nilai ujian diisi di kolom STS pada tabel. NA STS dihitung: <span
								class="font-medium text-base-content"
								>({bobotSumatif}% × Rata TP) + ({bobotSts}% × Nilai STS)</span
							>.
						</div>
					{/if}

					<div class="pt-2 border-t border-base-200 flex justify-between items-center text-[11px]">
						<span class="text-base-content/70">Total Bobot:</span>
						<span
							class="font-bold {bobotSumatif + bobotSts === 100
								? 'text-success'
								: 'text-error font-extrabold'}"
						>
							{bobotSumatif + bobotSts}% {bobotSumatif + bobotSts !== 100 ? '(Harus 100%)' : '✓'}
						</span>
					</div>
				</div>
			</div>
		</div>

		<!-- TOMBOL AKSI -->
		<div class="flex items-center justify-end gap-2 pt-2">
			{#if onClose}
				<button type="button" class="btn btn-sm btn-ghost" onclick={onClose} disabled={isSaving}>
					Batal
				</button>
			{/if}
			<button
				type="submit"
				class="btn btn-sm btn-primary"
				disabled={isSaving || bobotSumatif + bobotSts !== 100}
			>
				{#if isSaving}
					<span class="loading loading-spinner loading-xs"></span>
					Menyimpan...
				{:else}
					<Icon name="check" />
					Simpan Pengaturan Asesmen
				{/if}
			</button>
		</div>
	</form>
</div>
