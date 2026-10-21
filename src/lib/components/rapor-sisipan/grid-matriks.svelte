<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import Icon from '$lib/components/icon.svelte';
	import type { RtsKomponenFormatifItem, RtsKomponenSumatifItem } from '$lib/server/db/schema';
	import { toast } from '$lib/components/toast.svelte';
	import CopyMapelModal from './copy-mapel-modal.svelte';

	interface MuridItem {
		id: number;
		no: number;
		nama: string;
		nisn?: string | null;
		nis?: string | null;
		nilaiFormatif?: Record<string, number | null> | null;
		nilaiSumatif?: Record<string, number | null> | null;
		stsTes?: number | null;
		stsNonTes?: number | null;
		catatanGuru?: string | null;
	}

	interface Props {
		kelasId: number;
		mapelId: number;
		mapelNama: string;
		komponenFormatif: RtsKomponenFormatifItem[];
		komponenSumatif: RtsKomponenSumatifItem[];
		adaStsTes: boolean;
		adaStsNonTes: boolean;
		bobotSumatif: number;
		bobotSts: number;
		muridList: MuridItem[];
		allowSts?: boolean;
		canEdit?: boolean;
		isAdmin?: boolean;
		daftarKelas?: Array<{ id: number; nama: string; fase?: string | null }>;
		kelasNama?: string;
		onSaved?: () => void;
		onOpenSetup?: () => void;
	}

	let {
		kelasId,
		mapelId,
		mapelNama,
		komponenFormatif,
		komponenSumatif,
		adaStsTes,
		adaStsNonTes,
		bobotSumatif,
		bobotSts,
		muridList,
		allowSts = true,
		canEdit = true,
		isAdmin = false,
		daftarKelas = [],
		kelasNama = '',
		onSaved,
		onOpenSetup
	}: Props = $props();

	const effectiveAdaStsTes = $derived(allowSts && adaStsTes);
	const effectiveAdaStsNonTes = $derived(allowSts && adaStsNonTes);
	const effectiveBobotSumatif = $derived(allowSts ? bobotSumatif : 100);
	const effectiveBobotSts = $derived(allowSts ? bobotSts : 0);

	function parseScoreRecord(rec: unknown): Record<string, number | null> {
		if (!rec) return {};
		if (typeof rec === 'string') {
			try {
				const p = JSON.parse(rec);
				if (typeof p === 'object' && p !== null) return p;
			} catch {
				return {};
			}
		}
		if (typeof rec === 'object' && rec !== null) {
			return { ...(rec as Record<string, number | null>) };
		}
		return {};
	}

	function normalizeStudentRow(m: MuridItem, idx: number) {
		const fObj = parseScoreRecord(m.nilaiFormatif);
		const sObj = parseScoreRecord(m.nilaiSumatif);

		// Fallback key formatif jika kode di DB berbeda (mis. F1 vs T1)
		komponenFormatif.forEach((f, fIdx) => {
			if (fObj[f.kode] == null) {
				const altKeys = [`F${fIdx + 1}`, `Tugas ${fIdx + 1}`, `F_${f.kode}`, `T_${f.kode}`, f.nama];
				for (const k of altKeys) {
					if (fObj[k] != null) {
						fObj[f.kode] = fObj[k];
						break;
					}
				}
			}
		});

		// Fallback key sumatif jika kode di DB berbeda (mis. S1 vs F1)
		komponenSumatif.forEach((s, sIdx) => {
			if (sObj[s.kode] == null) {
				const altKeys = [
					`S${sIdx + 1}`,
					`LM${sIdx + 1}`,
					`F${sIdx + 1}`,
					`TP${sIdx + 1}`,
					`S_${s.kode}`,
					`F_${s.kode}`
				];
				for (const k of altKeys) {
					if (sObj[k] != null) {
						sObj[s.kode] = sObj[k];
						break;
					}
				}
			}
		});

		return {
			muridId: m.id,
			no: idx + 1,
			nama: m.nama,
			nisn: m.nisn,
			nilaiFormatif: fObj,
			nilaiSumatif: sObj,
			stsTes: m.stsTes ?? null,
			stsNonTes: m.stsNonTes ?? null,
			catatanGuru: m.catatanGuru ?? ''
		};
	}

	// svelte-ignore state_referenced_locally
	let rows = $state(muridList.map(normalizeStudentRow));

	$effect(() => {
		if (muridList) {
			rows = muridList.map(normalizeStudentRow);
		}
	});

	let isSaving = $state(false);
	let isImporting = $state(false);
	let fileInputRef: HTMLInputElement | null = $state(null);

	// Hitung rata formatif per baris
	function getRataFormatif(rec: Record<string, number | null>): number | null {
		const vals = komponenFormatif
			.map((f) => rec[f.kode])
			.filter((v): v is number => v != null && !Number.isNaN(v));
		if (vals.length === 0) return null;
		return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
	}

	// Hitung rata sumatif TP per baris
	function getRataSumatif(rec: Record<string, number | null>): number | null {
		const vals = komponenSumatif
			.map((s) => rec[s.kode])
			.filter((v): v is number => v != null && !Number.isNaN(v));
		if (vals.length === 0) return null;
		return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
	}

	// Hitung nilai STS per baris
	function getNilaiSts(tes: number | null, nonTes: number | null): number | null {
		if (!allowSts) return null;
		const validTes = effectiveAdaStsTes && tes != null && !Number.isNaN(tes);
		const validNonTes = effectiveAdaStsNonTes && nonTes != null && !Number.isNaN(nonTes);

		if (validTes && validNonTes) return Math.round(((tes! + nonTes!) / 2) * 100) / 100;
		if (validTes) return tes;
		if (validNonTes) return nonTes;
		return null;
	}

	// Hitung NA STS per baris
	function getNilaiAkhirRts(
		rataSumatif: number | null,
		sts: number | null,
		bSumatif: number,
		bSts: number
	): number | null {
		const effBSts = allowSts ? bSts : 0;
		const effBSumatif = allowSts ? bSumatif : 100;
		if (!allowSts || effBSts <= 0) return rataSumatif;

		if (rataSumatif == null && sts == null) return null;
		if (rataSumatif != null && sts == null) return rataSumatif;
		if (rataSumatif == null && sts != null) return sts;

		const totalB = effBSumatif + effBSts;
		if (totalB <= 0) return rataSumatif;
		return Math.round(((rataSumatif! * effBSumatif + sts! * effBSts) / totalB) * 100) / 100;
	}

	// Keyboard navigation: Arrow Up, Down, Left, Right, Enter
	function handleKeyDown(e: KeyboardEvent, rowIndex: number, colIndex: number) {
		const totalRows = rows.length;
		// Jumlah total input column per baris:
		// F columns + S columns + (effectiveAdaStsTes ? 1 : 0) + (effectiveAdaStsNonTes ? 1 : 0)
		const totalCols =
			komponenFormatif.length +
			komponenSumatif.length +
			(effectiveAdaStsTes ? 1 : 0) +
			(effectiveAdaStsNonTes ? 1 : 0);

		if (e.key === 'Enter' || e.key === 'ArrowDown') {
			e.preventDefault();
			const nextRow = rowIndex + 1;
			if (nextRow < totalRows) {
				const nextInput = document.getElementById(
					`cell-${nextRow}-${colIndex}`
				) as HTMLInputElement;
				nextInput?.focus();
				nextInput?.select();
			}
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			const prevRow = rowIndex - 1;
			if (prevRow >= 0) {
				const prevInput = document.getElementById(
					`cell-${prevRow}-${colIndex}`
				) as HTMLInputElement;
				prevInput?.focus();
				prevInput?.select();
			}
		} else if (
			e.key === 'ArrowRight' &&
			(e.target as HTMLInputElement).selectionEnd === (e.target as HTMLInputElement).value.length
		) {
			const nextCol = colIndex + 1;
			if (nextCol < totalCols) {
				e.preventDefault();
				const nextInput = document.getElementById(
					`cell-${rowIndex}-${nextCol}`
				) as HTMLInputElement;
				nextInput?.focus();
				nextInput?.select();
			}
		} else if (e.key === 'ArrowLeft' && (e.target as HTMLInputElement).selectionStart === 0) {
			const prevCol = colIndex - 1;
			if (prevCol >= 0) {
				e.preventDefault();
				const prevInput = document.getElementById(
					`cell-${rowIndex}-${prevCol}`
				) as HTMLInputElement;
				prevInput?.focus();
				prevInput?.select();
			}
		}
	}

	// Parsing input nilai agar angka 0-100 valid (mendukung desimal titik dan koma khas Excel Indonesia)
	function parseScoreInput(val: string): number | null {
		const clean = val.trim().replace(',', '.');
		if (!clean) return null;
		const n = Number(clean);
		if (Number.isNaN(n) || n < 0) return null;
		if (n > 100) return 100;
		return Math.round(n * 100) / 100;
	}

	// Helper untuk mengatur nilai sel berdasarkan indeks kolom matriks
	function setCellValue(rowIndex: number, colIndex: number, rawVal: string): boolean {
		if (rowIndex < 0 || rowIndex >= rows.length) return false;
		const row = rows[rowIndex];
		const parsed = parseScoreInput(rawVal);

		const numFormatif = komponenFormatif.length;
		const numSumatif = komponenSumatif.length;

		// 1. Kolom Tugas / Formatif
		if (colIndex < numFormatif) {
			const f = komponenFormatif[colIndex];
			if (f) {
				row.nilaiFormatif[f.kode] = parsed;
				return true;
			}
		}

		// 2. Kolom Asesmen Formatif / Sumatif Materi
		const sumatifIdx = colIndex - numFormatif;
		if (sumatifIdx >= 0 && sumatifIdx < numSumatif) {
			const s = komponenSumatif[sumatifIdx];
			if (s) {
				row.nilaiSumatif[s.kode] = parsed;
				return true;
			}
		}

		// 3. Kolom STS Tes
		let currentPos = numFormatif + numSumatif;
		if (effectiveAdaStsTes) {
			if (colIndex === currentPos) {
				row.stsTes = parsed;
				return true;
			}
			currentPos++;
		}

		// 4. Kolom STS Non-Tes
		if (effectiveAdaStsNonTes) {
			if (colIndex === currentPos) {
				row.stsNonTes = parsed;
				return true;
			}
		}

		return false;
	}

	// Handler Copy-Paste langsung dari Excel / Spreadsheet
	function handlePaste(e: ClipboardEvent, startRowIndex: number, startColIndex: number) {
		if (!canEdit) return;
		const clipboardText = e.clipboardData?.getData('text/plain');
		if (!clipboardText) return;

		// Cek apakah data berisi multiple baris atau kolom (khas copy Excel)
		// Excel memisahkan baris dengan \r\n atau \n dan kolom dengan \t
		const hasMultipleRows = clipboardText.includes('\n');
		const hasMultipleCols = clipboardText.includes('\t');

		if (!hasMultipleRows && !hasMultipleCols) {
			// Jika cuma 1 teks/angka tunggal tanpa newline atau tab, biarkan paste bawaan browser
			return;
		}

		e.preventDefault();

		// Pecah baris-baris
		const rawLines = clipboardText.split(/\r\n|\r|\n/);
		// Hapus baris terakhir jika kosong (sering terjadi saat copy dari excel ada trailing newline)
		if (rawLines.length > 0 && rawLines[rawLines.length - 1].trim() === '') {
			rawLines.pop();
		}

		if (rawLines.length === 0) return;

		let affectedCells = 0;
		let affectedRows = 0;

		rawLines.forEach((line, lineOffset) => {
			const targetRow = startRowIndex + lineOffset;
			if (targetRow >= rows.length) return;

			const cells = line.split('\t');
			let rowModified = false;

			cells.forEach((cellVal, colOffset) => {
				const targetCol = startColIndex + colOffset;
				const ok = setCellValue(targetRow, targetCol, cellVal);
				if (ok) {
					affectedCells++;
					rowModified = true;
				}
			});

			if (rowModified) {
				affectedRows++;
			}
		});

		if (affectedCells > 0) {
			toast(
				`Berhasil menempelkan ${affectedCells} nilai (${affectedRows} murid) dari Excel.`,
				'success'
			);
		}
	}

	// Handler Paste ke bawah untuk Catatan Guru
	function handlePasteCatatan(e: ClipboardEvent, startRowIndex: number) {
		if (!canEdit) return;
		const clipboardText = e.clipboardData?.getData('text/plain');
		if (!clipboardText) return;

		const hasMultipleRows = clipboardText.includes('\n');
		if (!hasMultipleRows) return; // single paste bawaan browser

		e.preventDefault();

		const rawLines = clipboardText.split(/\r\n|\r|\n/);
		if (rawLines.length > 0 && rawLines[rawLines.length - 1].trim() === '') {
			rawLines.pop();
		}
		if (rawLines.length === 0) return;

		let count = 0;
		rawLines.forEach((line, offset) => {
			const targetRow = startRowIndex + offset;
			if (targetRow < rows.length) {
				rows[targetRow].catatanGuru = line.trim();
				count++;
			}
		});

		if (count > 0) {
			toast(`Berhasil menempelkan catatan untuk ${count} murid dari Excel.`, 'success');
		}
	}

	async function handleSaveAll() {
		if (!canEdit) return;
		isSaving = true;
		try {
			const payloadItems = rows.map((r) => ({
				muridId: r.muridId,
				nilaiFormatif: r.nilaiFormatif,
				nilaiSumatif: r.nilaiSumatif,
				stsTes: r.stsTes,
				stsNonTes: r.stsNonTes,
				catatanGuru: r.catatanGuru
			}));

			const res = await fetch('/api/rapor-sisipan/simpan-nilai', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					kelasId,
					mataPelajaranId: mapelId,
					items: payloadItems
				})
			});

			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Gagal menyimpan nilai.');

			toast(data.message || 'Semua nilai berhasil disimpan!', 'success');
			onSaved?.();
		} catch (err) {
			toast((err as Error).message, 'error');
		} finally {
			isSaving = false;
		}
	}

	// Penanganan Unggah Excel
	async function handleFileSelected(e: Event) {
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		isImporting = true;
		try {
			const form = new FormData();
			form.append('file', file);
			form.append('kelasId', String(kelasId));
			form.append('mapelId', String(mapelId));
			form.append('autoSave', 'false'); // jangan langsung timpa DB, tampilkan di grid dahulu

			const res = await fetch('/api/rapor-sisipan/import-excel', {
				method: 'POST',
				body: form
			});

			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Gagal memproses file Excel.');

			// Terapkan data hasil parse ke baris lokal
			const itemsMap = new Map<
				number,
				{
					muridId: number;
					nilaiFormatif?: Record<string, number | null>;
					nilaiSumatif?: Record<string, number | null>;
					stsTes?: number | null;
					stsNonTes?: number | null;
					catatanGuru?: string | null;
				}
			>(
				data.items.map(
					(it: {
						muridId: number;
						nilaiFormatif?: Record<string, number | null>;
						nilaiSumatif?: Record<string, number | null>;
						stsTes?: number | null;
						stsNonTes?: number | null;
						catatanGuru?: string | null;
					}) => [it.muridId, it]
				)
			);
			for (const r of rows) {
				const imported = itemsMap.get(r.muridId);
				if (imported) {
					r.nilaiFormatif = { ...r.nilaiFormatif, ...(imported.nilaiFormatif || {}) };
					r.nilaiSumatif = { ...r.nilaiSumatif, ...(imported.nilaiSumatif || {}) };
					if (imported.stsTes !== undefined) r.stsTes = imported.stsTes;
					if (imported.stsNonTes !== undefined) r.stsNonTes = imported.stsNonTes;
					if (imported.catatanGuru) r.catatanGuru = imported.catatanGuru;
				}
			}

			toast(
				`Nilai berhasil diimpor ke tabel (${data.count} murid). Periksa lalu klik "Simpan Semua Nilai".`,
				'success'
			);
		} catch (err) {
			toast((err as Error).message, 'error');
		} finally {
			isImporting = false;
			if (fileInputRef) fileInputRef.value = '';
		}
	}

	// Fitur Isi Cepat / Bulk Fill modal sederhana
	let showQuickFill = $state(false);
	let showCopyModal = $state(false);
	let quickFillColumn = $state('all_formatif');
	let quickFillValue = $state(80);

	function applyQuickFill() {
		const val = Number(quickFillValue);
		if (Number.isNaN(val) || val < 0 || val > 100) {
			toast('Nilai harus berupa angka 0 - 100.', 'error');
			return;
		}

		let count = 0;
		for (const r of rows) {
			if (quickFillColumn === 'all_formatif') {
				for (const f of komponenFormatif) {
					if (r.nilaiFormatif[f.kode] == null) {
						r.nilaiFormatif[f.kode] = val;
						count++;
					}
				}
			} else if (quickFillColumn === 'all_sumatif') {
				for (const s of komponenSumatif) {
					if (r.nilaiSumatif[s.kode] == null) {
						r.nilaiSumatif[s.kode] = val;
						count++;
					}
				}
			} else if (quickFillColumn === 'sts_tes' && adaStsTes) {
				if (r.stsTes == null) {
					r.stsTes = val;
					count++;
				}
			} else if (quickFillColumn.startsWith('F_')) {
				const kode = quickFillColumn.replace('F_', '');
				if (r.nilaiFormatif[kode] == null) {
					r.nilaiFormatif[kode] = val;
					count++;
				}
			} else if (quickFillColumn.startsWith('S_')) {
				const kode = quickFillColumn.replace('S_', '');
				if (r.nilaiSumatif[kode] == null) {
					r.nilaiSumatif[kode] = val;
					count++;
				}
			}
		}

		showQuickFill = false;
		toast(`Berhasil mengisi nilai ${val} pada ${count} kotak kosong.`, 'success');
	}
</script>

<div class="space-y-4">
	<!-- ACTION BAR -->
	<div
		class="flex flex-wrap items-center justify-between gap-3 bg-base-100 p-4 rounded-xl border border-base-200 shadow-xs"
	>
		<div class="flex flex-wrap items-center gap-2">
			<button
				type="button"
				class="btn btn-sm btn-soft btn-secondary"
				onclick={onOpenSetup}
				disabled={!canEdit}
			>
				<Icon name="gear" />
				Atur Komponen Asesmen
			</button>

			<a
				href="/api/rapor-sisipan/export-excel?kelasId={kelasId}&mapelId={mapelId}"
				class="btn btn-sm btn-soft shadow-none"
				target="_blank"
			>
				<Icon name="download" />
				Unduh Format Excel
			</a>

			<label
				class="btn btn-sm btn-soft shadow-none cursor-pointer {isImporting ? 'btn-disabled' : ''}"
			>
				{#if isImporting}
					<span class="loading loading-spinner loading-xs"></span>
					Mengimpor...
				{:else}
					<Icon name="import" />
					Unggah Excel
				{/if}
				<input
					type="file"
					accept=".xlsx"
					class="hidden"
					bind:this={fileInputRef}
					onchange={handleFileSelected}
					disabled={!canEdit || isImporting}
				/>
			</label>

			<button
				type="button"
				class="btn btn-sm btn-ghost shadow-none"
				onclick={() => (showQuickFill = !showQuickFill)}
				disabled={!canEdit}
			>
				<Icon name="pen" />
				Isi Cepat
			</button>
		</div>

		<div class="flex items-center gap-2">
			<button
				type="button"
				class="btn btn-sm btn-primary shadow-sm"
				onclick={handleSaveAll}
				disabled={!canEdit || isSaving}
			>
				{#if isSaving}
					<span class="loading loading-spinner loading-xs"></span>
					Menyimpan...
				{:else}
					<Icon name="check" />
					Simpan Semua Nilai
				{/if}
			</button>
		</div>
	</div>

	<!-- QUICK FILL DRAWER/BAR (JIKA DIBUKA) -->
	{#if showQuickFill}
		<div
			class="card bg-base-200 p-3 rounded-xl border border-base-300 flex flex-wrap items-center gap-3"
		>
			<div class="flex items-center gap-1.5 text-xs font-bold">
				<Icon name="info" />
				Isi Cepat Kolom yang Masih Kosong:
			</div>
			<div class="flex items-center gap-2">
				<select class="select select-xs bg-base-100" bind:value={quickFillColumn}>
					<option value="all_formatif">Semua Tugas Kosong</option>
					<option value="all_sumatif">Semua Formatif Materi Kosong</option>
					{#if effectiveAdaStsTes}
						<option value="sts_tes">STS Tes</option>
					{/if}
					{#each komponenFormatif as f (f.kode)}
						<option value="F_{f.kode}">Tugas: [{f.kode}] {f.nama}</option>
					{/each}
					{#each komponenSumatif as s (s.kode)}
						<option value="S_{s.kode}">Formatif: [{s.kode}] {s.lingkupMateri}</option>
					{/each}
				</select>
				<input
					type="number"
					min="0"
					max="100"
					class="input input-xs bg-base-100 w-16 text-center font-bold"
					bind:value={quickFillValue}
					placeholder="80"
				/>
				<button type="button" class="btn btn-xs btn-primary" onclick={applyQuickFill}>
					Terapkan
				</button>
				{#if isAdmin}
					<div class="divider divider-horizontal my-0"></div>
					<button
						type="button"
						class="btn btn-xs btn-outline btn-primary gap-1"
						onclick={() => (showCopyModal = true)}
					>
						<Icon name="copy" class="w-3.5 h-3.5" />
						Salin Komponen & Nilai dari Mapel Lain
					</button>
				{/if}
				<button type="button" class="btn btn-xs btn-ghost" onclick={() => (showQuickFill = false)}>
					Tutup
				</button>
			</div>
		</div>
	{/if}

	{#if isAdmin}
		<CopyMapelModal
			bind:open={showCopyModal}
			targetKelasId={kelasId}
			targetKelasNama={kelasNama}
			targetMapelId={mapelId}
			targetMapelNama={mapelNama}
			{daftarKelas}
			onSuccess={() => {
				showQuickFill = false;
				onSaved?.();
			}}
		/>
	{/if}

	<!-- INFORMASI PETUNJUK -->
	<div class="flex flex-wrap items-center justify-between text-xs text-base-content/70 px-1 gap-2">
		<div class="flex flex-wrap items-center gap-2">
			<span>
				💡 <em
					>Matriks Nilai <strong>{mapelNama}</strong>: Bisa langsung
					<strong>Copy dari Excel</strong>
					dan <strong>Paste (Ctrl+V)</strong> pada kotak nilai untuk mengisi otomatis ke bawah. Gunakan
					panah (↑, ↓, ←, →) atau Enter untuk berpindah sel.</em
				>
			</span>
		</div>
		<div class="flex items-center gap-3">
			<span class="inline-flex items-center gap-1">
				<span class="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block"></span> Tugas
			</span>
			<span class="inline-flex items-center gap-1">
				<span class="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> Formatif ({effectiveBobotSumatif}%)
			</span>
			{#if allowSts && (adaStsTes || adaStsNonTes)}
				<span class="inline-flex items-center gap-1">
					<span class="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span> STS ({effectiveBobotSts}%)
				</span>
			{/if}
		</div>
	</div>

	<!-- MATRIKS SPREADSHEET TABLE -->
	<div class="bg-base-100 overflow-x-auto rounded-xl border border-base-200 shadow-md">
		<table class="table table-xs w-full border-collapse">
			<thead>
				<!-- HEADER GROUP ROW -->
				<tr class="bg-base-200/90 text-base-content font-bold border-b border-base-300">
					<th rowspan="2" class="w-10 text-center border-r border-base-300">No</th>
					<th
						rowspan="2"
						class="min-w-44 border-r border-base-300 sticky left-0 bg-base-200/90 z-10"
					>
						Nama Peserta Didik
					</th>

					<!-- KELOMPOK TUGAS -->
					<th
						colspan={komponenFormatif.length + 1}
						class="text-center bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-r border-base-300 py-1.5"
					>
						TUGAS
					</th>

					<!-- KELOMPOK FORMATIF TP -->
					<th
						colspan={komponenSumatif.length + 1}
						class="text-center bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-r border-base-300 py-1.5"
					>
						ASESMEN FORMATIF LINGKUP MATERI ({effectiveBobotSumatif}%)
					</th>

					<!-- KELOMPOK STS -->
					{#if effectiveAdaStsTes || effectiveAdaStsNonTes}
						<th
							colspan={(effectiveAdaStsTes && effectiveAdaStsNonTes ? 2 : 1) + 1}
							class="text-center bg-amber-500/10 text-amber-700 dark:text-amber-400 border-r border-base-300 py-1.5"
						>
							SUMATIF TENGAH SEMESTER ({effectiveBobotSts}%)
						</th>
					{/if}

					<!-- NILAI AKHIR RTS -->
					<th
						rowspan="2"
						class="text-center bg-primary/10 text-primary font-extrabold min-w-16 border-r border-base-300"
					>
						NA STS
					</th>

					<!-- CATATAN GURU -->
					<th rowspan="2" class="min-w-56 text-left"> Catatan / Deskripsi Capaian Guru </th>
				</tr>

				<!-- SUB-HEADER INDIVIDUAL COLUMNS -->
				<tr
					class="bg-base-200 text-base-content/80 text-[11px] font-semibold border-b border-base-300"
				>
					<!-- Tugas Sub-cols -->
					{#each komponenFormatif as f (f.kode)}
						<th class="text-center min-w-14 border-r border-base-200 py-1.5" title={f.nama}>
							{f.kode}
						</th>
					{/each}
					<th
						class="text-center min-w-14 bg-indigo-500/5 text-indigo-700 dark:text-indigo-400 font-bold border-r border-base-300"
					>
						Rata T
					</th>

					<!-- Formatif Sub-cols -->
					{#each komponenSumatif as s (s.kode)}
						<th
							class="text-center min-w-14 border-r border-base-200 py-1.5"
							title="{s.lingkupMateri}: {s.tpDeskripsi}"
						>
							{s.kode}
						</th>
					{/each}
					<th
						class="text-center min-w-14 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400 font-bold border-r border-base-300"
					>
						Rata F
					</th>

					<!-- STS Sub-cols -->
					{#if effectiveAdaStsTes}
						<th class="text-center min-w-14 border-r border-base-200 py-1.5">Tes</th>
					{/if}
					{#if effectiveAdaStsNonTes}
						<th class="text-center min-w-14 border-r border-base-200 py-1.5">Non-Tes</th>
					{/if}
					{#if effectiveAdaStsTes || effectiveAdaStsNonTes}
						<th
							class="text-center min-w-14 bg-amber-500/5 text-amber-700 dark:text-amber-400 font-bold border-r border-base-300"
						>
							Rata STS
						</th>
					{/if}
				</tr>
			</thead>

			<tbody>
				{#each rows as row, rIdx (row.muridId)}
					{@const rataF = getRataFormatif(row.nilaiFormatif)}
					{@const rataS = getRataSumatif(row.nilaiSumatif)}
					{@const valSts = getNilaiSts(row.stsTes, row.stsNonTes)}
					{@const naRts = getNilaiAkhirRts(rataS, valSts, effectiveBobotSumatif, effectiveBobotSts)}

					<tr class="hover:bg-base-200/40 border-b border-base-200 transition-colors">
						<!-- No -->
						<td class="text-center font-medium border-r border-base-200 text-base-content/60">
							{row.no}
						</td>

						<!-- Nama Murid -->
						<td
							class="border-r border-base-200 sticky left-0 bg-base-100 z-5 font-semibold text-xs py-1.5"
						>
							<span class="truncate block max-w-56" title={row.nama}>{row.nama}</span>
							{#if row.nisn}
								<span class="text-[10px] text-base-content/50 block font-normal">{row.nisn}</span>
							{/if}
						</td>

						<!-- INPUT FORMATIF -->
						{#each komponenFormatif as f, fIdx (f.kode)}
							{@const colIdx = fIdx}
							<td class="p-1 border-r border-base-200 text-center">
								<input
									id="cell-{rIdx}-{colIdx}"
									type="text"
									inputmode="numeric"
									class="input input-xs bg-base-200/60 focus:bg-base-100 text-center font-semibold w-12 rounded px-1 transition-all"
									value={row.nilaiFormatif[f.kode] ?? ''}
									oninput={(e) => {
										row.nilaiFormatif[f.kode] = parseScoreInput(
											(e.target as HTMLInputElement).value
										);
									}}
									onkeydown={(e) => handleKeyDown(e, rIdx, colIdx)}
									onpaste={(e) => handlePaste(e, rIdx, colIdx)}
									disabled={!canEdit}
								/>
							</td>
						{/each}

						<!-- RATA FORMATIF (BADGE AUTO) -->
						<td
							class="text-center font-bold text-xs bg-indigo-500/5 text-indigo-700 dark:text-indigo-400 border-r border-base-300"
						>
							{rataF != null ? rataF : '—'}
						</td>

						<!-- INPUT SUMATIF TP -->
						{#each komponenSumatif as s, sIdx (s.kode)}
							{@const colIdx = komponenFormatif.length + sIdx}
							<td class="p-1 border-r border-base-200 text-center">
								<input
									id="cell-{rIdx}-{colIdx}"
									type="text"
									inputmode="numeric"
									class="input input-xs bg-base-200/60 focus:bg-base-100 text-center font-semibold w-12 rounded px-1 transition-all"
									value={row.nilaiSumatif[s.kode] ?? ''}
									oninput={(e) => {
										row.nilaiSumatif[s.kode] = parseScoreInput(
											(e.target as HTMLInputElement).value
										);
									}}
									onkeydown={(e) => handleKeyDown(e, rIdx, colIdx)}
									onpaste={(e) => handlePaste(e, rIdx, colIdx)}
									disabled={!canEdit}
								/>
							</td>
						{/each}

						<!-- RATA SUMATIF (BADGE AUTO) -->
						<td
							class="text-center font-bold text-xs bg-emerald-500/5 text-emerald-700 dark:text-emerald-400 border-r border-base-300"
						>
							{rataS != null ? rataS : '—'}
						</td>

						<!-- INPUT STS TES -->
						{#if effectiveAdaStsTes}
							{@const colIdx = komponenFormatif.length + komponenSumatif.length}
							<td class="p-1 border-r border-base-200 text-center">
								<input
									id="cell-{rIdx}-{colIdx}"
									type="text"
									inputmode="numeric"
									class="input input-xs bg-base-200/60 focus:bg-base-100 text-center font-semibold w-12 rounded px-1 transition-all"
									value={row.stsTes ?? ''}
									oninput={(e) => {
										row.stsTes = parseScoreInput((e.target as HTMLInputElement).value);
									}}
									onkeydown={(e) => handleKeyDown(e, rIdx, colIdx)}
									onpaste={(e) => handlePaste(e, rIdx, colIdx)}
									disabled={!canEdit}
								/>
							</td>
						{/if}

						<!-- INPUT STS NON-TES -->
						{#if effectiveAdaStsNonTes}
							{@const colIdx =
								komponenFormatif.length + komponenSumatif.length + (effectiveAdaStsTes ? 1 : 0)}
							<td class="p-1 border-r border-base-200 text-center">
								<input
									id="cell-{rIdx}-{colIdx}"
									type="text"
									inputmode="numeric"
									class="input input-xs bg-base-200/60 focus:bg-base-100 text-center font-semibold w-12 rounded px-1 transition-all"
									value={row.stsNonTes ?? ''}
									oninput={(e) => {
										row.stsNonTes = parseScoreInput((e.target as HTMLInputElement).value);
									}}
									onkeydown={(e) => handleKeyDown(e, rIdx, colIdx)}
									onpaste={(e) => handlePaste(e, rIdx, colIdx)}
									disabled={!canEdit}
								/>
							</td>
						{/if}

						<!-- RATA STS (BADGE AUTO) -->
						{#if effectiveAdaStsTes || effectiveAdaStsNonTes}
							<td
								class="text-center font-bold text-xs bg-amber-500/5 text-amber-700 dark:text-amber-400 border-r border-base-300"
							>
								{valSts != null ? valSts : '—'}
							</td>
						{/if}

						<!-- NA STS HIGHLIGHT BADGE -->
						<td
							class="text-center font-black text-xs bg-primary/10 text-primary border-r border-base-300"
						>
							{#if naRts != null}
								<span class="badge badge-sm badge-primary font-bold">{naRts}</span>
							{:else}
								<span class="text-base-content/40">—</span>
							{/if}
						</td>

						<!-- CATATAN GURU -->
						<td class="p-1">
							<input
								id="cell-catatan-{rIdx}"
								type="text"
								class="input input-xs bg-base-200/50 focus:bg-base-100 w-full rounded px-2"
								placeholder="Catatan kemajuan belajar peserta didik..."
								bind:value={row.catatanGuru}
								onpaste={(e) => handlePasteCatatan(e, rIdx)}
								disabled={!canEdit}
							/>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<!-- BOTTOM FLOATING ACTION ON MOBILE / DESKTOP -->
	<div class="flex items-center justify-between pt-2">
		<div class="text-xs text-base-content/60">
			Jumlah Siswa: <strong class="text-base-content">{rows.length} murid</strong>
		</div>
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
				Simpan Semua Nilai
			{/if}
		</button>
	</div>
</div>
