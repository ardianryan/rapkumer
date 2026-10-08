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
		isConfigured?: boolean;
		initialKomponenFormatif?: RtsKomponenFormatifItem[];
		initialKomponenSumatif?: RtsKomponenSumatifItem[];
		initialAdaStsTes?: boolean;
		initialAdaStsNonTes?: boolean;
		initialBobotSumatif?: number;
		initialBobotSts?: number;
		availableTps?: TujuanPembelajaranOption[];
		availableLingkupMateri?: string[];
		maxFormatif?: number;
		maxSumatif?: number;
		allowSts?: boolean;
		onSaved?: () => void;
		onClose?: () => void;
	}

	let {
		kelasId,
		mapelId,
		mapelNama,
		isConfigured = false,
		initialKomponenFormatif = [],
		initialKomponenSumatif = [],
		initialAdaStsTes = true,
		initialAdaStsNonTes = false,
		initialBobotSumatif = 70,
		initialBobotSts = 30,
		availableTps = [],
		availableLingkupMateri = [],
		maxFormatif = 4,
		maxSumatif = 3,
		allowSts = true,
		onSaved,
		onClose
	}: Props = $props();

	// svelte-ignore state_referenced_locally
	let komponenFormatif = $state<RtsKomponenFormatifItem[]>(
		initialKomponenFormatif.length > 0
			? JSON.parse(JSON.stringify(initialKomponenFormatif))
			: [
					{ kode: 'T1', nama: 'Tugas 1' },
					{ kode: 'T2', nama: 'Tugas 2' }
				]
	);

	// svelte-ignore state_referenced_locally
	let komponenSumatif = $state<RtsKomponenSumatifItem[]>(
		initialKomponenSumatif.length > 0
			? JSON.parse(JSON.stringify(initialKomponenSumatif))
			: [
					{
						kode: 'F1',
						lingkupMateri: 'Lingkup Materi 1',
						tpDeskripsi: 'Lingkup Materi 1'
					}
				]
	);

	// Gabungkan seluruh Lingkup Materi unik yang tersedia dari data guru
	let allLingkupMateri = $derived.by(() => {
		const set = new Set<string>();
		if (availableLingkupMateri) {
			for (const lm of availableLingkupMateri) {
				if (lm && lm.trim()) set.add(lm.trim());
			}
		}
		for (const t of availableTps) {
			const lm = t.lingkupMateri?.trim();
			if (lm) set.add(lm);
		}
		return Array.from(set);
	});

	// svelte-ignore state_referenced_locally
	let adaStsTes = $state<boolean>(allowSts ? initialAdaStsTes : false);
	// svelte-ignore state_referenced_locally
	let adaStsNonTes = $state<boolean>(allowSts ? initialAdaStsNonTes : false);
	// svelte-ignore state_referenced_locally
	let bobotSumatif = $state<number>(allowSts ? initialBobotSumatif : 100);
	// svelte-ignore state_referenced_locally
	let bobotSts = $state<number>(allowSts ? initialBobotSts : 0);
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
		if (komponenFormatif.length >= maxFormatif) {
			toast(`Maksimal ${maxFormatif} tugas yang diperbolehkan.`, 'warning');
			return;
		}
		const nextNum = komponenFormatif.length + 1;
		komponenFormatif.push({
			kode: `T${nextNum}`,
			nama: `Tugas ${nextNum}`
		});
	}

	function removeFormatif(index: number) {
		if (komponenFormatif.length <= 1) {
			toast('Minimal harus ada 1 tugas.', 'error');
			return;
		}
		komponenFormatif.splice(index, 1);
		// Re-index kodenya agar urut T1, T2...
		komponenFormatif.forEach((item, idx) => {
			item.kode = `T${idx + 1}`;
		});
	}

	function addSumatif(lmName?: string) {
		if (komponenSumatif.length >= maxSumatif) {
			toast(
				`Maksimal ${maxSumatif} asesmen formatif lingkup materi yang diperbolehkan.`,
				'warning'
			);
			return;
		}
		const nextNum = komponenSumatif.length + 1;
		const name = lmName || `Lingkup Materi ${nextNum}`;
		komponenSumatif.push({
			kode: `F${nextNum}`,
			lingkupMateri: name,
			tpDeskripsi: name
		});
	}

	function removeSumatif(index: number) {
		if (komponenSumatif.length <= 1) {
			toast('Minimal harus ada 1 asesmen formatif lingkup materi.', 'error');
			return;
		}
		komponenSumatif.splice(index, 1);
		komponenSumatif.forEach((item, idx) => {
			item.kode = `F${idx + 1}`;
		});
	}

	function loadAllAvailableLingkupMateri() {
		if (allLingkupMateri.length === 0) return;
		const targetLms = allLingkupMateri.slice(0, maxSumatif);
		komponenSumatif = targetLms.map((lm, idx) => ({
			kode: `F${idx + 1}`,
			lingkupMateri: lm,
			tpDeskripsi: lm
		}));
		if (allLingkupMateri.length > maxSumatif) {
			toast(
				`Dimuat ${maxSumatif} lingkup materi pertama (batas maksimal sekolah adalah ${maxSumatif} formatif).`,
				'info'
			);
		} else {
			toast(`Berhasil memuat ${allLingkupMateri.length} lingkup materi tersimpan.`, 'success');
		}
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (bobotSumatif + bobotSts !== 100) {
			toast('Total bobot Sumatif TP dan STS harus berjumlah 100%.', 'error');
			return;
		}

		// Pastikan tpDeskripsi terisi sama dengan lingkup materi
		komponenSumatif.forEach((s) => {
			s.tpDeskripsi = s.tpDeskripsi || s.lingkupMateri;
		});

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
					adaStsTes: allowSts ? adaStsTes : false,
					adaStsNonTes: allowSts ? adaStsNonTes : false,
					bobotSumatifTp: allowSts ? bobotSumatif : 100,
					bobotSts: allowSts ? bobotSts : 0
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

	let isResetting = $state<boolean>(false);

	async function handleReset() {
		const confirmed = confirm(
			`Apakah Anda yakin ingin menghapus konfigurasi komponen asesmen untuk mata pelajaran ${mapelNama}?\n\nPengaturan komponen dan nilai yang sudah diinput untuk mapel ini akan dihapus dan kembali ke kondisi awal (belum dikonfigurasi).`
		);
		if (!confirmed) return;

		isResetting = true;
		try {
			const res = await fetch('/api/rapor-sisipan/setup', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					kelasId,
					mataPelajaranId: mapelId
				})
			});

			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Gagal mereset konfigurasi.');

			toast(data.message || 'Konfigurasi asesmen berhasil direset.', 'success');
			onSaved?.();
		} catch (err) {
			toast((err as Error).message, 'error');
		} finally {
			isResetting = false;
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
		<!-- BAGIAN 1: TUGAS -->
		<div class="card bg-base-200/50 p-4 rounded-xl border border-base-200">
			<div class="flex items-center justify-between mb-3">
				<div>
					<h4 class="text-sm font-bold flex items-center gap-1.5 text-base-content">
						<span class="badge badge-primary badge-sm">1</span>
						Tugas (T1, T2, ...)
					</h4>
					<p class="text-xs text-base-content/60 mt-0.5">
						Tentukan berapa kali penugasan/tagihan harian yang dilakukan.
					</p>
				</div>
				<button
					type="button"
					class="btn btn-sm btn-soft btn-primary"
					onclick={addFormatif}
					disabled={komponenFormatif.length >= maxFormatif}
				>
					<Icon name="plus" />
					Tambah Tugas ({komponenFormatif.length}/{maxFormatif})
				</button>
			</div>

			<div class="space-y-2">
				{#each komponenFormatif as f, idx (idx)}
					<div class="flex items-center gap-2 bg-base-100 p-2 rounded-lg border border-base-200">
						<span class="badge badge-neutral font-bold shrink-0">{f.kode}</span>
						<input
							type="text"
							class="input input-sm bg-base-200 dark:bg-base-300 w-full"
							placeholder="Nama tugas (misal: Resume Struktur Sel, Latihan Soal Bab 1...)"
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

		<!-- BAGIAN 2: ASESMEN FORMATIF LINGKUP MATERI -->
		<div class="card bg-base-200/50 p-4 rounded-xl border border-base-200">
			<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
				<div>
					<h4 class="text-sm font-bold flex items-center gap-1.5 text-base-content">
						<span class="badge badge-primary badge-sm">2</span>
						Asesmen Formatif (Lingkup Materi)
					</h4>
					<p class="text-xs text-base-content/60 mt-0.5">
						Tentukan lingkup materi asesmen formatif yang dinilai sebelum tengah semester.
					</p>
				</div>
				<div class="flex flex-wrap items-center gap-2">
					{#if allLingkupMateri.length > 0}
						<button
							type="button"
							class="btn btn-xs btn-outline btn-primary"
							onclick={loadAllAvailableLingkupMateri}
							title="Otomatis masukkan semua lingkup materi yang tersimpan di TP mapel ini"
						>
							<Icon name="sparkles" />
							Pakai Semua LM ({allLingkupMateri.length})
						</button>
					{/if}
					<button
						type="button"
						class="btn btn-sm btn-soft btn-primary"
						onclick={() => addSumatif()}
						disabled={komponenSumatif.length >= maxSumatif}
					>
						<Icon name="plus" />
						Tambah Formatif ({komponenSumatif.length}/{maxSumatif})
					</button>
				</div>
			</div>

			<div class="space-y-2">
				{#each komponenSumatif as s, idx (idx)}
					<div class="flex items-center gap-2 bg-base-100 p-2.5 rounded-lg border border-base-200">
						<span class="badge badge-success text-white font-bold shrink-0">{s.kode}</span>

						{#if allLingkupMateri.length > 0}
							<div class="grow flex items-center gap-2">
								<input
									type="text"
									list="lm-list-{idx}"
									class="input input-sm bg-base-200 dark:bg-base-300 w-full font-medium"
									placeholder="Pilih atau ketik nama Lingkup Materi..."
									bind:value={s.lingkupMateri}
									oninput={() => {
										s.tpDeskripsi = s.lingkupMateri;
									}}
									required
								/>
								<datalist id="lm-list-{idx}">
									{#each allLingkupMateri as lm (lm)}
										<option value={lm}></option>
									{/each}
								</datalist>

								<select
									class="select select-xs bg-base-200 max-w-44 shrink-0"
									value={allLingkupMateri.includes(s.lingkupMateri) ? s.lingkupMateri : ''}
									onchange={(e) => {
										const val = (e.target as HTMLSelectElement).value;
										if (val) {
											s.lingkupMateri = val;
											s.tpDeskripsi = val;
										}
									}}
								>
									<option value="">-- Pilih dari Daftar --</option>
									{#each allLingkupMateri as lm (lm)}
										<option value={lm}>{lm}</option>
									{/each}
								</select>
							</div>
						{:else}
							<input
								type="text"
								class="input input-sm bg-base-200 dark:bg-base-300 w-full font-medium"
								placeholder="Nama Lingkup Materi (misal: Struktur Sel, Dinamika Partikel...)"
								bind:value={s.lingkupMateri}
								oninput={() => {
									s.tpDeskripsi = s.lingkupMateri;
								}}
								required
							/>
						{/if}

						<button
							type="button"
							class="btn btn-sm btn-ghost btn-square text-error shrink-0"
							onclick={() => removeSumatif(idx)}
							title="Hapus"
						>
							<Icon name="del" />
						</button>
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
				{#if !allowSts}
					<p class="text-xs text-base-content/60 mt-0.5">
						Kebijakan penilaian tengah semester diatur terpusat oleh sekolah.
					</p>
				{:else}
					<p class="text-xs text-base-content/60 mt-0.5">
						Centang bentuk asesmen STS yang dilaksanakan. Kolom pengisian nilai per siswa akan
						otomatis aktif di tabel nilai.
					</p>
				{/if}
			</div>

			{#if !allowSts}
				<div class="alert alert-warning text-xs py-3 px-3.5 rounded-lg flex items-start gap-2.5">
					<Icon name="info" class="w-4 h-4 shrink-0 mt-0.5 text-warning" />
					<div>
						<span class="font-bold text-base-content"
							>Asesmen STS Dinonaktifkan oleh Kebijakan Sekolah</span
						>
						<p class="mt-0.5 text-base-content/80 leading-relaxed">
							Administrator sekolah telah menetapkan bahwa sekolah tidak melaksanakan tes STS.
							Sesuai kebijakan ini, tidak ada kolom pengisian nilai STS dan pembobotan nilai akhir
							otomatis terkunci <strong>100% menggunakan nilai formatif materi</strong>.
						</p>
					</div>
				</div>
			{:else}
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
							<span class="font-semibold text-base-content">Bobot Rata-rata Formatif (Materi):</span
							>
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
								Tanpa tes STS: Nilai akhir rapor sisipan dihitung 100% murni dari rata-rata Formatif
								materi.
							</div>
						{:else}
							<div class="text-[11px] text-base-content/60 leading-tight">
								Nilai ujian diisi di kolom STS pada tabel. NA STS dihitung: <span
									class="font-medium text-base-content"
									>({bobotSumatif}% × Rata Formatif) + ({bobotSts}% × Nilai STS)</span
								>.
							</div>
						{/if}

						<div
							class="pt-2 border-t border-base-200 flex justify-between items-center text-[11px]"
						>
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
			{/if}
		</div>

		<!-- TOMBOL AKSI -->
		<div class="flex items-center justify-between gap-2 pt-2 border-t border-base-200">
			{#if isConfigured}
				<button
					type="button"
					class="btn btn-sm btn-outline btn-error"
					onclick={handleReset}
					disabled={isSaving || isResetting}
				>
					{#if isResetting}
						<span class="loading loading-spinner loading-xs"></span>
						Mereset...
					{:else}
						<Icon name="del" />
						Reset ke Default
					{/if}
				</button>
			{:else}
				<div></div>
			{/if}

			<div class="flex items-center gap-2">
				{#if onClose}
					<button
						type="button"
						class="btn btn-sm btn-ghost"
						onclick={onClose}
						disabled={isSaving || isResetting}
					>
						Batal
					</button>
				{/if}
				<button
					type="submit"
					class="btn btn-sm btn-primary"
					disabled={isSaving || isResetting || bobotSumatif + bobotSts !== 100}
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
		</div>
	</form>
</div>
