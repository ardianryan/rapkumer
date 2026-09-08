<script lang="ts">
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';
	import { parseJenjangKelas, sortKelasNatural } from '$lib/utils';
	import type { DimensiProfilLulusanKey } from '$lib/statics';
	import type { KokurikulerRow } from './types';

	type DimensionOption = {
		key: DimensiProfilLulusanKey;
		label: string;
	};

	type KelasItem = { id: number; nama: string; fase: string | null };
	type KelasWithJenjang = KelasItem & { jenjang: string };

	let {
		open,
		title,
		action,
		kelasId,
		tableReady,
		canManage,
		isEditMode,
		modalItem,
		dimensionOptions,
		selectedDimensions,
		onToggleDimension,
		kodeInput,
		onKodeChange,
		tujuanInput,
		onTujuanChange,
		onClose,
		onSuccess,
		availableKelas = []
	}: {
		open: boolean;
		title: string;
		action: string;
		kelasId: number | null;
		tableReady: boolean;
		canManage: boolean;
		isEditMode: boolean;
		modalItem: (KokurikulerRow & { dimensi: DimensiProfilLulusanKey[] }) | null;
		dimensionOptions: DimensionOption[];
		selectedDimensions: DimensiProfilLulusanKey[];
		onToggleDimension: (dimension: DimensiProfilLulusanKey, checked: boolean) => void;
		kodeInput: string;
		onKodeChange: (value: string) => void;
		tujuanInput: string;
		onTujuanChange: (value: string) => void;
		onClose: () => void;
		onSuccess: (payload: { form: HTMLFormElement }) => void;
		availableKelas?: KelasItem[];
	} = $props();

	let submitting = $state(false);

	const otherClasses = $derived<KelasWithJenjang[]>(
		(availableKelas ?? [])
			.filter((k: KelasItem) => k.id !== kelasId)
			.map((k: KelasItem) => ({
				...k,
				jenjang: parseJenjangKelas(k.nama)
			}))
			.sort(sortKelasNatural)
	);

	const jenjangOptions = $derived.by<string[]>(() => {
		const raw: string[] = Array.from(new Set(otherClasses.map((k: KelasWithJenjang) => k.jenjang)));
		const order = ['X', 'XI', 'XII', 'VII', 'VIII', 'IX', 'I', 'II', 'III', 'IV', 'V', 'VI'];
		raw.sort((a: string, b: string) => {
			const idxA = order.indexOf(a);
			const idxB = order.indexOf(b);
			if (idxA !== -1 && idxB !== -1) return idxA - idxB;
			if (idxA !== -1) return -1;
			if (idxB !== -1) return 1;
			return a.localeCompare(b);
		});
		return ['Semua', ...raw];
	});

	let selectedJenjang = $state<string>('Semua');
	let selectedTargetIds = $state<number[]>([]);

	const displayedClasses = $derived<KelasWithJenjang[]>(
		selectedJenjang === 'Semua'
			? otherClasses
			: otherClasses.filter((k: KelasWithJenjang) => k.jenjang === selectedJenjang)
	);

	function toggleTargetClass(id: number, checked: boolean) {
		if (checked) {
			if (!selectedTargetIds.includes(id)) {
				selectedTargetIds = [...selectedTargetIds, id];
			}
		} else {
			selectedTargetIds = selectedTargetIds.filter((x) => x !== id);
		}
	}

	function selectAllDisplayed() {
		const displayedIds = displayedClasses.map((k: KelasWithJenjang) => k.id);
		const merged = new Set([...selectedTargetIds, ...displayedIds]);
		selectedTargetIds = Array.from(merged);
	}

	function unselectAll() {
		if (selectedJenjang === 'Semua') {
			selectedTargetIds = [];
		} else {
			const displayedIds = new Set(displayedClasses.map((k: KelasWithJenjang) => k.id));
			selectedTargetIds = selectedTargetIds.filter((id) => !displayedIds.has(id));
		}
	}

	function countByJenjang(j: string): number {
		return j === 'Semua' ? otherClasses.length : otherClasses.filter((k) => k.jenjang === j).length;
	}
</script>

{#if open}
	<div
		class="modal modal-open"
		tabindex="-1"
		role="dialog"
		aria-modal="true"
		onkeydown={(event) => {
			if (event.key === 'Escape') onClose();
		}}
	>
		<div class="modal-box flex max-h-[85vh] flex-col p-4 sm:max-w-2xl">
			<h3 class="shrink-0 text-lg font-bold">{title}</h3>

			<div class="min-h-0 flex-1 overflow-y-auto px-1 py-4">
				<FormEnhance
					id="form-kokurikuler"
					class="space-y-4"
					{action}
					onsuccess={onSuccess}
					submitStateChange={(v) => (submitting = v)}
				>
					<input name="kelasId" value={kelasId ?? ''} hidden />
					{#if isEditMode && modalItem}
						<input name="id" value={modalItem.id} hidden />
					{/if}

					<div class="space-y-2">
						<p class="font-semibold">Pilih Dimensi Profil Lulusan</p>
						<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
							{#each dimensionOptions as dimensi (dimensi.key)}
								<label class="flex cursor-pointer flex-row gap-2">
									<input
										type="checkbox"
										class="checkbox"
										value={dimensi.key}
										name="dimensi"
										checked={selectedDimensions.includes(dimensi.key)}
										onchange={(event) =>
											onToggleDimension(dimensi.key, event.currentTarget.checked)}
										aria-label={dimensi.label}
									/>
									<div class="flex flex-col">
										<span>{dimensi.label}</span>
									</div>
								</label>
							{/each}
						</div>
					</div>

					<div class="space-y-2">
						<p class="font-semibold">Kode</p>
						<input
							type="text"
							class="input bg-base-200 dark:bg-base-300 w-full dark:border-none"
							placeholder="Masukkan kode (contoh: KK-BAKU)"
							name="kode"
							value={kodeInput}
							oninput={(event) => onKodeChange((event.currentTarget as HTMLInputElement).value)}
							required
							disabled={!canManage}
							maxlength={20}
						/>
					</div>

					<div class="space-y-2">
						<p class="font-semibold">Kegiatan Kokurikuler</p>
						<textarea
							class="textarea bg-base-200 dark:bg-base-300 h-28 w-full dark:border-none"
							placeholder="Ketik kegiatan atau tema kegiatan kokurikuler"
							name="kokurikuler"
							value={tujuanInput}
							oninput={(event) =>
								onTujuanChange((event.currentTarget as HTMLTextAreaElement).value)}
							required
							disabled={!canManage}></textarea>
					</div>

					<!-- Bagian Bawah: Terapkan ke Kelas Lain Sekaligus -->
					{#if !isEditMode && otherClasses.length > 0}
						<div
							class="space-y-3 rounded-2xl border border-base-300 bg-base-200/50 p-4 dark:border-base-content/10 dark:bg-base-300/30"
						>
							<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
								<div>
									<h4 class="flex items-center gap-1.5 text-sm font-bold text-base-content">
										<Icon name="layers" />
										Terapkan ke Kelas Lain Sekaligus (Opsional)
									</h4>
									<p class="text-xs text-base-content/70">
										Pilih jenjang dan centang kelas paralel yang juga menggunakan tema projek ini
									</p>
								</div>
								<div class="flex items-center gap-1.5">
									<button
										type="button"
										class="btn btn-xs btn-outline btn-primary shadow-none"
										onclick={selectAllDisplayed}
									>
										Pilih Semua {selectedJenjang !== 'Semua' ? `(${selectedJenjang})` : ''}
									</button>
									{#if selectedTargetIds.length > 0}
										<button
											type="button"
											class="btn btn-xs btn-ghost text-error shadow-none"
											onclick={unselectAll}
										>
											Batal ({selectedTargetIds.length})
										</button>
									{/if}
								</div>
							</div>

							<!-- Filter Jenjang Smart Filter (X, XI, XII, dll) -->
							{#if jenjangOptions.length > 1}
								<div class="flex flex-wrap items-center gap-1.5 pt-1">
									<span class="mr-1 text-xs font-medium text-base-content/60">Jenjang:</span>
									{#each jenjangOptions as j (j)}
										{@const count = countByJenjang(j)}
										{#if count > 0}
											<button
												type="button"
												class={`btn btn-xs rounded-xl font-medium transition-all ${
													selectedJenjang === j
														? 'btn-primary font-bold shadow-sm'
														: 'btn-ghost bg-base-100 dark:bg-base-200 hover:bg-base-300/60'
												}`}
												onclick={() => (selectedJenjang = j)}
											>
												{j === 'Semua' ? 'Semua Jenjang' : `Jenjang ${j}`}
												<span class="badge badge-xs opacity-75">{count}</span>
											</button>
										{/if}
									{/each}
								</div>
							{/if}

							<!-- Checklist Pilihan Kelas -->
							<div class="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-3">
								{#each displayedClasses as k (k.id)}
									{@const isChecked = selectedTargetIds.includes(k.id)}
									<label
										class={`flex cursor-pointer items-center justify-between gap-2 rounded-xl border p-2 text-xs transition-all ${
											isChecked
												? 'border-primary bg-primary/10 font-semibold shadow-xs'
												: 'border-base-300 bg-base-100 hover:bg-base-200/60 dark:border-base-content/10 dark:bg-base-200'
										}`}
									>
										<span class="truncate">{k.nama}</span>
										<input
											type="checkbox"
											name="targetKelasIds"
											value={k.id}
											checked={isChecked}
											onchange={(e) => toggleTargetClass(k.id, e.currentTarget.checked)}
											class="checkbox checkbox-xs checkbox-primary"
										/>
									</label>
								{/each}
							</div>
						</div>
					{/if}
				</FormEnhance>
			</div>

			<div class="modal-action shrink-0">
				<button class="btn btn-soft shadow-none mr-auto" type="button" onclick={onClose}>
					<Icon name="close" />
					Batal
				</button>
				<button
					class="btn btn-primary shadow-none"
					type="submit"
					form="form-kokurikuler"
					disabled={submitting ||
						!selectedDimensions.length ||
						!kelasId ||
						!tableReady ||
						!kodeInput.trim() ||
						!tujuanInput.trim()}
				>
					{#if submitting}
						<div class="loading loading-spinner"></div>
					{:else}
						<Icon name="save" />
					{/if}
					{isEditMode ? 'Simpan Perubahan' : 'Simpan'}
				</button>
			</div>
		</div>
		<form method="dialog" class="modal-backdrop">
			<button
				type="submit"
				onclick={(event) => {
					event.preventDefault();
					onClose();
				}}
			>
				tutup
			</button>
		</form>
	</div>
{/if}
