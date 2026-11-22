<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	import { toast } from '$lib/components/toast.svelte';

	let { data } = $props();

	let activeTab = $state<'rombel' | 'mapel' | 'kokurikuler' | 'ptk'>('rombel');
	let loadingRef = $state(false);
	let saving = $state(false);
	let ptkSearch = $state('');

	// Reference lists fetched from e-Rapor Bridge
	let eraporRombels = $state<
		Array<{ rombongan_belajar_id: string; nm_kelas: string; tingkat_pendidikan_id?: string }>
	>([]);
	let eraporMapels = $state<
		Array<{ mata_pelajaran_id: number | string; nm_mapel: string; nm_ringkas?: string }>
	>([]);
	let eraporKelompok = $state<
		Array<{
			kelompok_id: string;
			nm_kelompok: string;
			nama_kegiatan?: string;
			id_kegiatan?: string;
		}>
	>([]);
	let eraporSubdimensi = $state<
		Array<{ id_subdimensi: string; nama_dimensi: string; nama_subdimensi: string }>
	>([]);
	let eraporPtks = $state<Array<{ ptk_id: string; nama: string; nip?: string | null }>>([]);

	// Local editable mapping states
	// svelte-ignore state_referenced_locally
	let rombelDraft = $state<Record<number, string>>(
		Object.fromEntries(
			data.existingMappings.rombels.map((r) => [r.siakadKelasId, r.eraporRombelId])
		)
	);
	// svelte-ignore state_referenced_locally
	let mapelDraft = $state<Record<string, string>>(
		Object.fromEntries(
			data.existingMappings.mapels.map((m) => [m.siakadMapelNama, m.eraporMapelId])
		)
	);
	// svelte-ignore state_referenced_locally
	let kokDraft = $state<
		Record<
			string,
			{
				eraporKelompokId: string;
				eraporKegiatanId: string;
				eraporKegiatanNama: string;
				dimensiMap: Record<string, string>;
			}
		>
	>(
		Object.fromEntries(
			data.kokurikulerList.map((k) => {
				const found = data.existingMappings.kokurikulers.find((e) => e.siakadKode === k.kode);
				return [
					k.kode,
					{
						eraporKelompokId: found?.eraporKelompokId ?? '',
						eraporKegiatanId: found?.eraporKegiatanId ?? '',
						eraporKegiatanNama: found?.eraporKegiatanNama ?? '',
						dimensiMap: { ...(found?.dimensiMap ?? {}) }
					}
				];
			})
		)
	);

	async function loadReferences() {
		loadingRef = true;
		try {
			const sem = encodeURIComponent(data.semesterId);
			const [rRes, mRes, klpRes, subRes, ptkRes] = await Promise.all([
				fetch(`/api/erapor/reference?entity=rombel&semester=${sem}`).then((r) => r.json()),
				fetch('/api/erapor/reference?entity=mapel').then((r) => r.json()),
				fetch(`/api/erapor/reference?entity=kelompok&semester=${sem}`).then((r) => r.json()),
				fetch('/api/erapor/reference?entity=subdimensi').then((r) => r.json()),
				fetch('/api/erapor/reference?entity=ptk').then((r) => r.json())
			]);

			if (rRes.error) throw new Error(rRes.error);
			eraporRombels = rRes.data ?? [];
			eraporMapels = mRes.data ?? [];
			eraporKelompok = klpRes.data ?? [];
			eraporSubdimensi = subRes.data ?? [];
			eraporPtks = ptkRes.data ?? [];
			toast('Referensi e-Rapor berhasil dimuat.', 'success');
		} catch (err: unknown) {
			toast(err instanceof Error ? err.message : String(err), 'error');
		} finally {
			loadingRef = false;
		}
	}

	function normalizeName(str: string) {
		return str.toLowerCase().replace(/[^a-z0-9]/g, '');
	}

	function autoMatchRombels() {
		if (eraporRombels.length === 0) {
			toast('Klik "Muat Referensi e-Rapor" terlebih dahulu.', 'warning');
			return;
		}
		let matched = 0;
		const next = { ...rombelDraft };
		for (const k of data.kelasList) {
			const norm = normalizeName(k.nama);
			const found = eraporRombels.find((er) => normalizeName(er.nm_kelas) === norm);
			if (found) {
				next[k.id] = found.rombongan_belajar_id;
				matched += 1;
			}
		}
		rombelDraft = next;
		toast(`Auto-Match menemukan ${matched} dari ${data.kelasList.length} kelas.`, 'success');
	}

	function autoMatchMapels() {
		if (eraporMapels.length === 0) {
			toast('Klik "Muat Referensi e-Rapor" terlebih dahulu.', 'warning');
			return;
		}
		let matched = 0;
		const next = { ...mapelDraft };
		for (const m of data.mapelList) {
			const norm = normalizeName(m.nama);
			const found = eraporMapels.find(
				(em) =>
					normalizeName(em.nm_mapel) === norm ||
					normalizeName(em.nm_mapel).includes(norm) ||
					norm.includes(normalizeName(em.nm_mapel))
			);
			if (found) {
				next[m.nama] = String(found.mata_pelajaran_id);
				matched += 1;
			}
		}
		mapelDraft = next;
		toast(`Auto-Match menemukan ${matched} dari ${data.mapelList.length} mapel.`, 'success');
	}

	async function saveRombelMapping() {
		saving = true;
		try {
			const items = data.kelasList.map((k) => {
				const id = rombelDraft[k.id] ?? '';
				const ref = eraporRombels.find((r) => r.rombongan_belajar_id === id);
				return {
					siakadKelasId: k.id,
					eraporRombelId: id,
					eraporNmKelas: ref?.nm_kelas ?? null
				};
			});
			const res = await fetch('/api/erapor/mapping', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: 'rombel', semesterId: data.semesterId, items })
			});
			const json = await res.json();
			if (!res.ok) throw new Error(json.error || 'Gagal menyimpan');
			toast(json.message, 'success');
		} catch (err: unknown) {
			toast(err instanceof Error ? err.message : String(err), 'error');
		} finally {
			saving = false;
		}
	}

	async function saveMapelMapping() {
		saving = true;
		try {
			const items = data.mapelList.map((m) => {
				const id = mapelDraft[m.nama] ?? '';
				const ref = eraporMapels.find((r) => String(r.mata_pelajaran_id) === id);
				return {
					siakadMapelNama: m.nama,
					eraporMapelId: id,
					eraporNmMapel: ref?.nm_mapel?.trim() ?? null
				};
			});
			const res = await fetch('/api/erapor/mapping', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: 'mapel', items })
			});
			const json = await res.json();
			if (!res.ok) throw new Error(json.error || 'Gagal menyimpan');
			toast(json.message, 'success');
		} catch (err: unknown) {
			toast(err instanceof Error ? err.message : String(err), 'error');
		} finally {
			saving = false;
		}
	}

	async function saveKokurikulerMapping() {
		saving = true;
		try {
			const items = Object.entries(kokDraft).map(([siakadKode, val]) => ({
				siakadKode,
				...val
			}));
			const res = await fetch('/api/erapor/mapping', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: 'kokurikuler', semesterId: data.semesterId, items })
			});
			const json = await res.json();
			if (!res.ok) throw new Error(json.error || 'Gagal menyimpan');
			toast(json.message, 'success');
		} catch (err: unknown) {
			toast(err instanceof Error ? err.message : String(err), 'error');
		} finally {
			saving = false;
		}
	}

	const dimensiLabelByKey = $derived(
		Object.fromEntries(data.dimensiPilihan.map((d) => [d.key, d.label]))
	);

	const filteredPtks = $derived.by(() => {
		const q = ptkSearch.trim().toLowerCase();
		if (!q) return eraporPtks;
		return eraporPtks.filter(
			(p) => p.nama.toLowerCase().includes(q) || (p.nip ?? '').toLowerCase().includes(q)
		);
	});
</script>

<div class="card bg-base-100 border-base-200 space-y-4 rounded-xl border p-4 shadow-xs">
	<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
		<div class="tabs tabs-box bg-base-200/70 p-1">
			<button
				type="button"
				class="tab tab-xs sm:tab-sm font-semibold {activeTab === 'rombel'
					? 'tab-active bg-base-100'
					: ''}"
				onclick={() => (activeTab = 'rombel')}
			>
				Rombel / Kelas ({data.kelasList.length})
			</button>
			<button
				type="button"
				class="tab tab-xs sm:tab-sm font-semibold {activeTab === 'mapel'
					? 'tab-active bg-base-100'
					: ''}"
				onclick={() => (activeTab = 'mapel')}
			>
				Mata Pelajaran ({data.mapelList.length})
			</button>
			<button
				type="button"
				class="tab tab-xs sm:tab-sm font-semibold {activeTab === 'kokurikuler'
					? 'tab-active bg-base-100'
					: ''}"
				onclick={() => (activeTab = 'kokurikuler')}
			>
				Kokurikuler & P5 ({data.kokurikulerList.length})
			</button>
			<button
				type="button"
				class="tab tab-xs sm:tab-sm font-semibold {activeTab === 'ptk'
					? 'tab-active bg-base-100'
					: ''}"
				onclick={() => (activeTab = 'ptk')}
			>
				Referensi PTK
			</button>
		</div>

		<button
			type="button"
			class="btn btn-sm btn-outline btn-primary"
			disabled={loadingRef}
			onclick={loadReferences}
		>
			{#if loadingRef}
				<span class="loading loading-spinner loading-xs"></span>
			{:else}
				<Icon name="repeat" class="h-4 w-4" />
			{/if}
			Muat Referensi e-Rapor
		</button>
	</div>

	{#if activeTab === 'rombel'}
		<div class="flex flex-wrap items-center justify-between gap-2">
			<p class="text-base-content/70 text-xs">
				Jodohkan kelas SIAKAD dengan Rombel e-Rapor untuk semester <code>{data.semesterId}</code>.
			</p>
			<div class="flex gap-2">
				<button type="button" class="btn btn-xs btn-soft btn-info" onclick={autoMatchRombels}>
					<Icon name="sparkles" class="h-3.5 w-3.5" />
					Auto-Match by Name
				</button>
				<button
					type="button"
					class="btn btn-xs btn-primary"
					disabled={saving}
					onclick={saveRombelMapping}
				>
					<Icon name="save" class="h-3.5 w-3.5" />
					Simpan Mapping Rombel
				</button>
			</div>
		</div>

		<div class="overflow-x-auto">
			<table class="table-sm table">
				<thead>
					<tr>
						<th>Kelas SIAKAD</th>
						<th>Fase</th>
						<th>Rombel e-Rapor SMA</th>
						<th>Status</th>
					</tr>
				</thead>
				<tbody>
					{#each data.kelasList as kelas (kelas.id)}
						{@const mappedId = rombelDraft[kelas.id] ?? ''}
						{@const savedRef = data.existingMappings.rombels.find(
							(r) => r.siakadKelasId === kelas.id
						)}
						<tr>
							<td class="font-semibold">{kelas.nama}</td>
							<td>{kelas.fase ?? '-'}</td>
							<td>
								<select
									class="select select-bordered select-xs w-full max-w-xs"
									bind:value={rombelDraft[kelas.id]}
								>
									<option value="">-- Belum dipetakan --</option>
									{#if savedRef && !eraporRombels.some((r) => r.rombongan_belajar_id === savedRef.eraporRombelId)}
										<option value={savedRef.eraporRombelId}>
											{savedRef.eraporNmKelas || savedRef.eraporRombelId} (tersimpan)
										</option>
									{/if}
									{#each eraporRombels as er (er.rombongan_belajar_id)}
										<option value={er.rombongan_belajar_id}>
											{er.nm_kelas} (Tingkat {er.tingkat_pendidikan_id ?? '-'})
										</option>
									{/each}
								</select>
							</td>
							<td>
								{#if mappedId}
									<span class="badge badge-xs badge-success text-white">Cocok</span>
								{:else}
									<span class="badge badge-xs badge-ghost">Belum</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else if activeTab === 'mapel'}
		<div class="flex flex-wrap items-center justify-between gap-2">
			<p class="text-base-content/70 text-xs">
				Jodohkan nama mata pelajaran SIAKAD dengan referensi Mapel e-Rapor SMA.
			</p>
			<div class="flex gap-2">
				<button type="button" class="btn btn-xs btn-soft btn-info" onclick={autoMatchMapels}>
					<Icon name="sparkles" class="h-3.5 w-3.5" />
					Auto-Match
				</button>
				<button
					type="button"
					class="btn btn-xs btn-primary"
					disabled={saving}
					onclick={saveMapelMapping}
				>
					<Icon name="save" class="h-3.5 w-3.5" />
					Simpan Mapping Mapel
				</button>
			</div>
		</div>

		<div class="overflow-x-auto">
			<table class="table-sm table">
				<thead>
					<tr>
						<th>Kode</th>
						<th>Mata Pelajaran SIAKAD</th>
						<th>Mata Pelajaran e-Rapor SMA</th>
						<th>Status</th>
					</tr>
				</thead>
				<tbody>
					{#each data.mapelList as mapel (mapel.nama)}
						{@const mappedId = mapelDraft[mapel.nama] ?? ''}
						{@const savedRef = data.existingMappings.mapels.find(
							(m) => m.siakadMapelNama === mapel.nama
						)}
						<tr>
							<td class="font-mono text-xs">{mapel.kode ?? '-'}</td>
							<td class="font-semibold">{mapel.nama}</td>
							<td>
								<select
									class="select select-bordered select-xs w-full max-w-sm"
									bind:value={mapelDraft[mapel.nama]}
								>
									<option value="">-- Belum dipetakan --</option>
									{#if savedRef && !eraporMapels.some((m) => String(m.mata_pelajaran_id) === savedRef.eraporMapelId)}
										<option value={savedRef.eraporMapelId}>
											{savedRef.eraporNmMapel || savedRef.eraporMapelId} (tersimpan)
										</option>
									{/if}
									{#each eraporMapels as em (em.mata_pelajaran_id)}
										<option value={String(em.mata_pelajaran_id)}>
											{em.nm_mapel.trim()} ({em.nm_ringkas ?? em.mata_pelajaran_id})
										</option>
									{/each}
								</select>
							</td>
							<td>
								{#if mappedId}
									<span class="badge badge-xs badge-success text-white">Cocok</span>
								{:else}
									<span class="badge badge-xs badge-ghost">Belum</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else if activeTab === 'kokurikuler'}
		<div class="flex flex-wrap items-center justify-between gap-2">
			<p class="text-base-content/70 text-xs">
				Petakan kegiatan kokurikuler dan setiap dimensi profil lulusan SIAKAD ke
				<code>id_subdimensi</code> e-Rapor SMA.
			</p>
			<button
				type="button"
				class="btn btn-xs btn-primary"
				disabled={saving}
				onclick={saveKokurikulerMapping}
			>
				<Icon name="save" class="h-3.5 w-3.5" />
				Simpan Mapping Kokurikuler
			</button>
		</div>

		<div class="space-y-4">
			{#each data.kokurikulerList as kok (kok.kode)}
				{@const draft = kokDraft[kok.kode]}
				<div class="border-base-200 rounded-lg border p-4 space-y-3">
					<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<span class="badge badge-primary badge-sm font-mono font-bold">{kok.kode}</span>
							<p class="mt-1 text-sm font-semibold">{kok.tujuan}</p>
						</div>

						<label class="form-control w-full sm:max-w-xs">
							<span class="label-text mb-1 text-[11px] font-semibold">
								Kelompok Kokurikuler e-Rapor
							</span>
							<select
								class="select select-bordered select-xs w-full"
								value={draft?.eraporKelompokId ?? ''}
								onchange={(e) => {
									const klpId = e.currentTarget.value;
									const klp = eraporKelompok.find((x) => x.kelompok_id === klpId);
									kokDraft[kok.kode] = {
										...draft,
										eraporKelompokId: klpId,
										eraporKegiatanId: klp?.id_kegiatan ?? draft?.eraporKegiatanId ?? '',
										eraporKegiatanNama: klp?.nama_kegiatan ?? draft?.eraporKegiatanNama ?? ''
									};
								}}
							>
								<option value="">-- Opsional / Kelompok e-Rapor --</option>
								{#if draft?.eraporKelompokId && !eraporKelompok.some((x) => x.kelompok_id === draft.eraporKelompokId)}
									<option value={draft.eraporKelompokId}>
										{draft.eraporKegiatanNama || draft.eraporKelompokId} (tersimpan)
									</option>
								{/if}
								{#each eraporKelompok as klp (klp.kelompok_id)}
									<option value={klp.kelompok_id}>
										{klp.nm_kelompok} — {klp.nama_kegiatan ?? ''}
									</option>
								{/each}
							</select>
						</label>
					</div>

					<div class="grid grid-cols-1 gap-2 md:grid-cols-2">
						{#each kok.dimensi as dimKey (dimKey)}
							{@const selectedSubId = draft?.dimensiMap?.[dimKey] ?? ''}
							<div class="bg-base-200/40 rounded-lg p-2.5">
								<div class="mb-1 text-xs font-semibold">
									{dimensiLabelByKey[dimKey] ?? dimKey}
								</div>
								<select
									class="select select-bordered select-xs w-full"
									value={selectedSubId}
									onchange={(e) => {
										kokDraft[kok.kode] = {
											...draft,
											dimensiMap: {
												...(draft?.dimensiMap ?? {}),
												[dimKey]: e.currentTarget.value
											}
										};
									}}
								>
									<option value="">-- Pilih Subdimensi P5 e-Rapor --</option>
									{#if selectedSubId && !eraporSubdimensi.some((s) => s.id_subdimensi === selectedSubId)}
										<option value={selectedSubId}>{selectedSubId} (tersimpan)</option>
									{/if}
									{#each eraporSubdimensi as sub (sub.id_subdimensi)}
										<option value={sub.id_subdimensi}>
											{sub.nama_dimensi}: {sub.nama_subdimensi}
										</option>
									{/each}
								</select>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
			<p class="text-base-content/70 text-xs">
				Daftar PTK dari Bridge e-Rapor SMA ({eraporPtks.length} dimuat) untuk mencocokkan NIP/Nama dengan
				pegawai lokal ({data.pegawaiList.length} pegawai).
			</p>
			<input
				type="text"
				class="input input-bordered input-xs w-full sm:w-64"
				placeholder="Cari nama atau NIP PTK e-Rapor..."
				bind:value={ptkSearch}
			/>
		</div>
		<div class="max-h-96 overflow-auto">
			<table class="table-xs table">
				<thead>
					<tr>
						<th>Nama PTK e-Rapor</th>
						<th>NIP</th>
						<th>Kecocokan Lokal (NIP / Nama)</th>
					</tr>
				</thead>
				<tbody>
					{#each filteredPtks as ptk (ptk.ptk_id)}
						{@const localMatch = data.pegawaiList.find(
							(p) =>
								(ptk.nip && p.nip && p.nip.trim() === ptk.nip.trim()) ||
								normalizeName(p.nama) === normalizeName(ptk.nama)
						)}
						<tr>
							<td class="font-medium">{ptk.nama}</td>
							<td class="font-mono">{ptk.nip ?? '-'}</td>
							<td>
								{#if localMatch}
									<span class="badge badge-xs badge-success text-white">
										Cocok: {localMatch.nama}
									</span>
								{:else}
									<span class="badge badge-xs badge-ghost">Tidak ditemukan</span>
								{/if}
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="3" class="py-6 text-center italic opacity-60">
								Klik "Muat Referensi e-Rapor" untuk menampilkan daftar PTK.
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
