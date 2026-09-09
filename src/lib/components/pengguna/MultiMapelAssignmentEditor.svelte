<script lang="ts">
	import Icon from '$lib/components/icon.svelte';

	export type GuruMapelAssignment = {
		mapelNama: string;
		kelasIds: number[];
	};

	let {
		availableMapel = [],
		availableKelas = [],
		assignments = $bindable([]),
		disabled = false
	} = $props<{
		availableMapel?: Array<{ id?: number; nama: string; kode?: string | null }>;
		availableKelas?: Array<{
			id: number;
			nama: string;
			fase?: string | null;
			sekolahId?: number;
		}>;
		assignments?: GuruMapelAssignment[];
		disabled?: boolean;
	}>();

	// Deduplikasi dan bersihkan daftar mata pelajaran
	const cleanAvailableMapel = $derived.by(() => {
		const seen = new Set<string>();
		const result: string[] = [];

		for (const m of availableMapel ?? []) {
			const name = (m.nama ?? '').trim();
			if (!name) continue;
			const lower = name.toLowerCase();
			// Kecualikan mapel induk gabungan yang tidak diajar langsung
			if (lower === 'pendidikan agama dan budi pekerti') continue;
			if (lower === 'pendalaman kitab suci') continue;

			if (!seen.has(lower)) {
				seen.add(lower);
				result.push(name);
			}
		}

		return result.sort((a, b) => a.localeCompare(b, 'id'));
	});

	// Deteksi kelompok jenjang / fase untuk tombol aksi cepat
	type QuickFilterGroup = {
		label: string;
		kelasIds: number[];
	};

	const quickFilterGroups = $derived.by(() => {
		const groups: QuickFilterGroup[] = [];
		if (!availableKelas || availableKelas.length === 0) return groups;

		// 1. Coba deteksi berdasarkan Fase (Kurikulum Merdeka)
		const byFase = new Map<string, number[]>();
		for (const k of availableKelas) {
			const f = (k.fase ?? '').trim().toUpperCase();
			if (f) {
				const arr = byFase.get(f) ?? [];
				arr.push(k.id);
				byFase.set(f, arr);
			}
		}

		if (byFase.size > 1) {
			for (const [fase, ids] of byFase.entries()) {
				groups.push({
					label: `Fase ${fase}`,
					kelasIds: ids
				});
			}
			return groups;
		}

		// 2. Jika fase tidak lengkap, deteksi berdasarkan prefix nama kelas (X, XI, XII atau 7, 8, 9 dsb)
		const byJenjang = new Map<string, number[]>();
		for (const k of availableKelas) {
			const name = (k.nama ?? '').trim();
			const match = name.match(/^(XII|XI|X|IX|VIII|VII|\d+)/i);
			if (match) {
				const j = match[1].toUpperCase();
				const arr = byJenjang.get(j) ?? [];
				arr.push(k.id);
				byJenjang.set(j, arr);
			}
		}

		if (byJenjang.size > 1) {
			for (const [jenjang, ids] of byJenjang.entries()) {
				groups.push({
					label: `Kls ${jenjang}`,
					kelasIds: ids
				});
			}
		}

		return groups;
	});

	function addAssignment() {
		assignments = [...assignments, { mapelNama: '', kelasIds: [] }];
	}

	function removeAssignment(index: number) {
		assignments = assignments.filter((_: GuruMapelAssignment, idx: number) => idx !== index);
	}

	function toggleKelas(assignmentIndex: number, kelasId: number) {
		const current = assignments[assignmentIndex];
		if (!current) return;

		const set = new Set(current.kelasIds);
		if (set.has(kelasId)) {
			set.delete(kelasId);
		} else {
			set.add(kelasId);
		}

		assignments = assignments.map((a: GuruMapelAssignment, idx: number) =>
			idx === assignmentIndex ? { ...a, kelasIds: Array.from(set) } : a
		);
	}

	function selectAllKelas(assignmentIndex: number) {
		const allIds = (availableKelas ?? []).map((k: { id: number }) => k.id);
		assignments = assignments.map((a: GuruMapelAssignment, idx: number) =>
			idx === assignmentIndex ? { ...a, kelasIds: allIds } : a
		);
	}

	function selectGroupKelas(assignmentIndex: number, groupKelasIds: number[]) {
		const current = assignments[assignmentIndex];
		if (!current) return;

		const currentSet = new Set(current.kelasIds);
		// Jika semua kelas dalam group sudah terpilih, batalkan pilihan group tersebut
		const allGroupSelected = groupKelasIds.every((id) => currentSet.has(id));

		if (allGroupSelected) {
			for (const id of groupKelasIds) currentSet.delete(id);
		} else {
			for (const id of groupKelasIds) currentSet.add(id);
		}

		assignments = assignments.map((a: GuruMapelAssignment, idx: number) =>
			idx === assignmentIndex ? { ...a, kelasIds: Array.from(currentSet) } : a
		);
	}

	function clearKelas(assignmentIndex: number) {
		assignments = assignments.map((a: GuruMapelAssignment, idx: number) =>
			idx === assignmentIndex ? { ...a, kelasIds: [] } : a
		);
	}

	// Inisialisasi minimal 1 baris jika assignments kosong saat komponen dimuat
	$effect(() => {
		if (assignments.length === 0) {
			assignments = [{ mapelNama: '', kelasIds: [] }];
		}
	});
</script>

<!-- Input tersembunyi untuk form submit standar (misal di halaman onboarding) -->
<input type="hidden" name="assignments" value={JSON.stringify(assignments)} />

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<div>
			<h4 class="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
				<Icon name="book-open" class="h-4 w-4 text-primary" />
				<span>Pemetaan Mata Pelajaran & Kelas</span>
			</h4>
			<p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
				Tentukan mata pelajaran yang diampu beserta kelas-kelas yang diajar untuk setiap mata
				pelajaran.
			</p>
		</div>

		<button
			type="button"
			class="btn btn-sm btn-outline btn-primary rounded-xl text-xs gap-1.5 shadow-xs"
			onclick={addAssignment}
			{disabled}
		>
			<Icon name="plus" class="h-3.5 w-3.5" />
			<span>Tambah Mapel</span>
		</button>
	</div>

	<!-- Daftar Kartu Penugasan Per Mata Pelajaran -->
	<div class="space-y-3">
		{#each assignments as item, idx (idx)}
			<div
				class="bg-white dark:bg-slate-900/90 rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3 transition-all hover:border-slate-300 dark:hover:border-slate-700"
			>
				<!-- Baris Header Kartu: Pilih Mapel & Tombol Hapus -->
				<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
					<div class="flex items-center gap-2 flex-1">
						<span
							class="h-6 w-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0"
						>
							{idx + 1}
						</span>

						<div class="flex-1 max-w-sm">
							<select
								class="select select-sm dark:bg-slate-800/80 border-slate-300 dark:border-slate-700 w-full font-medium text-xs rounded-xl focus:border-primary focus:ring-1 focus:ring-primary"
								bind:value={item.mapelNama}
								{disabled}
							>
								<option value="" disabled selected={!item.mapelNama}>
									-- Pilih Mata Pelajaran --
								</option>
								{#if item.mapelNama && !cleanAvailableMapel.includes(item.mapelNama)}
									<option value={item.mapelNama}>{item.mapelNama}</option>
								{/if}
								{#each cleanAvailableMapel as mapelName (mapelName)}
									<option value={mapelName}>{mapelName}</option>
								{/each}
							</select>
						</div>
					</div>

					<div class="flex items-center justify-between sm:justify-end gap-2">
						<span
							class={`badge badge-sm font-semibold text-[11px] ${item.kelasIds.length > 0 ? 'badge-primary badge-soft' : 'badge-ghost text-slate-400'}`}
						>
							{item.kelasIds.length} Kelas Dipilih
						</span>

						{#if assignments.length > 1}
							<button
								type="button"
								class="btn btn-ghost btn-xs text-error hover:bg-error/10 rounded-lg p-1"
								title="Hapus mata pelajaran ini"
								onclick={() => removeAssignment(idx)}
								{disabled}
							>
								<Icon name="del" class="h-4 w-4" />
							</button>
						{/if}
					</div>
				</div>

				<!-- Bagian Pemilihan Kelas untuk Mapel ini -->
				<div class="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-2.5">
					<!-- Toolbar Aksi Cepat Kelas -->
					<div class="flex flex-wrap items-center justify-between gap-1.5 text-xs">
						<span class="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
							Centang kelas yang diajar:
						</span>

						<div class="flex flex-wrap items-center gap-1">
							<button
								type="button"
								class="btn btn-ghost btn-xs text-[11px] h-6 min-h-0 px-2 rounded-lg text-primary font-medium hover:bg-primary/10"
								onclick={() => selectAllKelas(idx)}
								{disabled}
							>
								Pilih Semua
							</button>

							{#each quickFilterGroups as group (group.label)}
								<button
									type="button"
									class="btn btn-ghost btn-xs text-[11px] h-6 min-h-0 px-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
									onclick={() => selectGroupKelas(idx, group.kelasIds)}
									{disabled}
								>
									{group.label}
								</button>
							{/each}

							{#if item.kelasIds.length > 0}
								<button
									type="button"
									class="btn btn-ghost btn-xs text-[11px] h-6 min-h-0 px-2 rounded-lg text-slate-400 hover:text-error hover:bg-error/10"
									onclick={() => clearKelas(idx)}
									{disabled}
								>
									Kosongkan
								</button>
							{/if}
						</div>
					</div>

					<!-- Grid Checkbox Kelas -->
					{#if availableKelas && availableKelas.length > 0}
						<div
							class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1.5 max-h-48 overflow-y-auto pr-1"
						>
							{#each availableKelas as k (k.id)}
								{@const isSelected = item.kelasIds.includes(k.id)}
								<label
									class={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer select-none transition-all text-xs ${
										isSelected
											? 'bg-primary/10 border-primary text-primary font-semibold shadow-xs'
											: 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
									} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
								>
									<input
										type="checkbox"
										class="checkbox checkbox-primary checkbox-xs rounded"
										checked={isSelected}
										onchange={() => toggleKelas(idx, k.id)}
										{disabled}
									/>
									<span class="truncate">
										{k.nama}
										{#if k.fase}
											<span class="text-[10px] opacity-70 font-normal">({k.fase})</span>
										{/if}
									</span>
								</label>
							{/each}
						</div>
					{:else}
						<div
							class="p-4 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-xs"
						>
							Belum ada kelas aktif di sekolah ini.
						</div>
					{/if}
				</div>
			</div>
		{/each}
	</div>

	{#if assignments.length === 0}
		<div
			class="p-6 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-xs space-y-2"
		>
			<p>Belum ada mata pelajaran yang ditugaskan.</p>
			<button
				type="button"
				class="btn btn-sm btn-primary rounded-xl text-xs gap-1.5"
				onclick={addAssignment}
			>
				<Icon name="plus" class="h-3.5 w-3.5" />
				<span>Mulai Tambah Mata Pelajaran</span>
			</button>
		</div>
	{/if}
</div>
