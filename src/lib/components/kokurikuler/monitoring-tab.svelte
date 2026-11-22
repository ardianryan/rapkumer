<script lang="ts">
	import { resolve } from '$app/paths';
	import Icon from '$lib/components/icon.svelte';

	export interface KokurikulerClassProgress {
		kelasId: number;
		kelasNama: string;
		fase: string | null;
		waliKelasNama: string | null;
		kokurikulerId: number | null;
		dimensiCount: number;
		totalMurid: number;
		muridLengkap: number;
		persentase: number;
		status: 'complete' | 'incomplete' | 'no_activity';
	}

	export interface KokurikulerActivityMonitoring {
		kode: string;
		tujuan: string;
		classes: KokurikulerClassProgress[];
	}

	interface Props {
		activities: KokurikulerActivityMonitoring[];
		kelasAktifId?: number | null;
	}

	let { activities, kelasAktifId = null }: Props = $props();

	let selectedKode = $state('');
	let statusFilter = $state<'all' | 'complete' | 'incomplete' | 'no_activity'>('all');
	let searchQuery = $state('');

	const effectiveKode = $derived(
		activities.some((a) => a.kode === selectedKode) ? selectedKode : (activities[0]?.kode ?? '')
	);

	const activeActivity = $derived(activities.find((a) => a.kode === effectiveKode) ?? null);

	const classList = $derived(activeActivity?.classes ?? []);
	const totalKelas = $derived(classList.length);
	const totalLengkap = $derived(classList.filter((c) => c.status === 'complete').length);
	const totalBelumLengkap = $derived(classList.filter((c) => c.status === 'incomplete').length);
	const totalBelumAda = $derived(classList.filter((c) => c.status === 'no_activity').length);
	const kelasDenganKegiatan = $derived(totalLengkap + totalBelumLengkap);
	const overallPersentase = $derived(
		kelasDenganKegiatan > 0 ? Math.round((totalLengkap / kelasDenganKegiatan) * 100) : 0
	);

	const filteredClasses = $derived.by(() => {
		const q = searchQuery.trim().toLowerCase();
		return classList.filter((item) => {
			if (statusFilter !== 'all' && item.status !== statusFilter) return false;
			if (!q) return true;
			const nama = item.kelasNama.toLowerCase();
			const wali = (item.waliKelasNama ?? '').toLowerCase();
			const fase = (item.fase ?? '').toLowerCase();
			return nama.includes(q) || wali.includes(q) || fase.includes(q);
		});
	});
</script>

<div class="space-y-4">
	{#if activities.length === 0}
		<div class="card bg-base-100 border-base-200 rounded-xl border p-8 text-center shadow-xs">
			<p class="text-base-content/70 text-sm font-medium">
				Belum ada kegiatan kokurikuler yang terdaftar di sekolah/semester aktif.
			</p>
			<p class="text-base-content/50 mt-1 text-xs">
				Tambahkan kegiatan kokurikuler terlebih dahulu pada tab Daftar Kokurikuler.
			</p>
		</div>
	{:else}
		<!-- FILTER KEGIATAN & PENCARIAN -->
		<div class="card bg-base-100 border-base-200 rounded-xl border p-4 shadow-xs space-y-3">
			<div class="grid grid-cols-1 gap-3 md:grid-cols-2">
				<label class="form-control w-full">
					<span class="label-text mb-1 text-xs font-semibold">Pilih Kegiatan Kokurikuler</span>
					<select
						class="select select-bordered select-sm w-full"
						value={effectiveKode}
						onchange={(e) => (selectedKode = e.currentTarget.value)}
					>
						{#each activities as act (act.kode)}
							<option value={act.kode}>{act.kode} — {act.tujuan}</option>
						{/each}
					</select>
				</label>

				<label class="form-control w-full">
					<span class="label-text mb-1 text-xs font-semibold">Cari Kelas / Wali Kelas</span>
					<div class="relative">
						<input
							type="text"
							class="input input-bordered input-sm w-full pl-8"
							placeholder="Ketik nama kelas atau wali kelas..."
							bind:value={searchQuery}
						/>
						<Icon
							name="search"
							class="text-base-content/40 pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2"
						/>
					</div>
				</label>
			</div>

			<div class="flex flex-wrap items-center gap-1.5 pt-1">
				<button
					type="button"
					class="btn btn-xs {statusFilter === 'all' ? 'btn-primary' : 'btn-ghost'}"
					onclick={() => (statusFilter = 'all')}
				>
					Semua ({totalKelas})
				</button>
				<button
					type="button"
					class="btn btn-xs {statusFilter === 'complete' ? 'btn-success text-white' : 'btn-ghost'}"
					onclick={() => (statusFilter = 'complete')}
				>
					Lengkap ({totalLengkap})
				</button>
				<button
					type="button"
					class="btn btn-xs {statusFilter === 'incomplete' ? 'btn-warning' : 'btn-ghost'}"
					onclick={() => (statusFilter = 'incomplete')}
				>
					Belum Lengkap ({totalBelumLengkap})
				</button>
				<button
					type="button"
					class="btn btn-xs {statusFilter === 'no_activity' ? 'btn-neutral' : 'btn-ghost'}"
					onclick={() => (statusFilter = 'no_activity')}
				>
					Belum Ada Kegiatan ({totalBelumAda})
				</button>
			</div>
		</div>

		<!-- RINGKASAN CAPAIAN KEGIATAN -->
		<div
			class="card bg-base-100 border-base-200 flex flex-col items-center justify-between gap-4 rounded-xl border p-5 shadow-xs sm:flex-row"
		>
			<div class="min-w-0">
				<div class="flex flex-wrap items-center gap-2">
					<span class="badge badge-primary badge-sm font-mono font-bold">
						{activeActivity?.kode}
					</span>
					<h3 class="text-base-content text-base font-bold">
						Monitoring Kelengkapan Nilai Kokurikuler
					</h3>
				</div>
				{#if activeActivity?.tujuan}
					<p class="text-base-content/70 mt-1 line-clamp-2 text-xs">
						{activeActivity.tujuan}
					</p>
				{/if}
				<p class="text-base-content/60 mt-1 text-xs">
					<strong>{totalLengkap}</strong> dari <strong>{kelasDenganKegiatan}</strong> kelas
					terdaftar sudah lengkap ({totalBelumAda} kelas belum memiliki kegiatan ini).
				</p>
			</div>

			<div class="flex shrink-0 items-center gap-4">
				<div class="text-right">
					<div class="text-base-content/70 text-xs font-semibold">Kelas Lengkap:</div>
					<div class="text-primary text-xl font-black">{overallPersentase}%</div>
				</div>
				<div
					class="radial-progress text-primary bg-primary/10 border-primary/20 text-xs font-bold"
					style="--value:{overallPersentase}; --size:3rem; --thickness: 4px;"
					role="progressbar"
					aria-valuenow={overallPersentase}
					aria-valuemin={0}
					aria-valuemax={100}
				>
					{overallPersentase}%
				</div>
			</div>
		</div>

		<!-- DAFTAR KARTU KELAS -->
		{#if filteredClasses.length === 0}
			<div class="card bg-base-100 border-base-200 rounded-xl border p-6 text-center shadow-xs">
				<p class="text-base-content/60 text-sm italic">
					Tidak ada kelas yang sesuai dengan filter saat ini.
				</p>
			</div>
		{:else}
			<div class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
				{#each filteredClasses as item (item.kelasId)}
					<div
						class="card bg-base-100 hover:border-primary/40 flex flex-col justify-between rounded-xl border p-4 shadow-sm transition-all {kelasAktifId ===
						item.kelasId
							? 'border-primary/50 ring-primary/15 ring-1'
							: 'border-base-200'}"
					>
						<div>
							<div class="mb-1.5 flex items-start justify-between gap-2">
								<div class="min-w-0">
									<h4 class="text-base-content truncate text-sm font-bold" title={item.kelasNama}>
										{item.kelasNama}
										{#if item.fase}
											<span class="text-base-content/50 font-normal">({item.fase})</span>
										{/if}
									</h4>
								</div>
								{#if item.status === 'complete'}
									<span class="badge badge-xs badge-success shrink-0 font-bold text-white">
										100% Lengkap
									</span>
								{:else if item.status === 'incomplete'}
									<span class="badge badge-xs badge-warning shrink-0 font-bold">
										{item.persentase}%
									</span>
								{:else}
									<span class="badge badge-xs badge-neutral shrink-0 font-semibold">
										Belum Ada Kegiatan
									</span>
								{/if}
							</div>

							<p class="text-base-content/60 mb-3 flex items-center gap-1 text-xs">
								<Icon name="user" class="h-3 w-3 shrink-0" />
								<span class="truncate">{item.waliKelasNama || 'Belum ada wali kelas'}</span>
							</p>

							<div class="mb-4 space-y-1">
								<div class="text-base-content/70 flex justify-between text-[11px]">
									<span>
										Kelengkapan ({item.dimensiCount} dimensi):
									</span>
									<span class="text-base-content font-bold">
										{item.muridLengkap} / {item.totalMurid} murid
									</span>
								</div>
								<progress
									class="progress {item.status === 'complete'
										? 'progress-success'
										: item.status === 'incomplete'
											? 'progress-primary'
											: 'progress-neutral'} h-1.5 w-full"
									value={item.persentase}
									max="100"
								></progress>
							</div>
						</div>

						<div class="border-base-200 flex justify-end border-t pt-2">
							{#if item.kokurikulerId !== null}
								<a
									href={resolve(
										`/asesmen-kokurikuler?kelas_id=${item.kelasId}&kokurikulerId=${item.kokurikulerId}` as '/asesmen-kokurikuler'
									)}
									class="btn btn-xs btn-soft btn-primary w-full font-semibold"
								>
									<Icon name="pen" />
									Buka / Isi Nilai
								</a>
							{:else}
								<a
									href={resolve(`/kokurikuler?kelas_id=${item.kelasId}` as '/kokurikuler')}
									class="btn btn-xs btn-soft btn-neutral w-full font-semibold"
								>
									<Icon name="plus" />
									Tambah di Kelas Ini
								</a>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>
