<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	import MultiMapelAssignmentEditor, {
		type GuruMapelAssignment
	} from '$lib/components/pengguna/MultiMapelAssignmentEditor.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	let isCustomizing = $state(false);

	const isTendik = $derived((data.zitadelUser?.role ?? '').trim().toLowerCase() === 'tendik');
	const hasDapodikPegawai = $derived(Boolean(data.pegawai));

	// State penugasan mandiri guru
	// svelte-ignore state_referenced_locally
	let assignments = $state<GuruMapelAssignment[]>(
		data.assignedAssignments?.length
			? JSON.parse(JSON.stringify(data.assignedAssignments))
			: [{ mapelNama: '', kelasIds: [] }]
	);

	// Map lookup nama kelas berdasarkan ID untuk kemudahan tampilan ringkasan
	const kelasMap = $derived.by(() => {
		const map = new Map<number, { nama: string; fase?: string | null }>();
		for (const k of data.availableKelas ?? []) {
			map.set(k.id, { nama: k.nama, fase: k.fase });
		}
		return map;
	});

	// Hitung total kelas unik dari seluruh penugasan
	const totalUniqueKelas = $derived.by(() => {
		const ids = new Set<number>();
		for (const a of data.assignedAssignments ?? []) {
			for (const id of a.kelasIds) ids.add(id);
		}
		return ids.size;
	});

	// Validasi apakah setidaknya ada 1 mapel dan 1 kelas terpilih untuk disimpan
	const canSaveAssignments = $derived.by(() => {
		return assignments.some(
			(a) => (a.mapelNama ?? '').trim().length > 0 && (a.kelasIds ?? []).length > 0
		);
	});
</script>

<svelte:head>
	<title
		>{isTendik ? 'Onboarding Tenaga Kependidikan' : 'Konfirmasi Penugasan Guru'} - Rapkumer</title
	>
</svelte:head>

<div class="min-h-screen w-full bg-base-200/40 py-8 px-4 sm:px-6 lg:px-8">
	<div class="max-w-4xl mx-auto space-y-6">
		<!-- Header Sambutan -->
		<div class="bg-base-100 rounded-2xl p-6 sm:p-8 shadow-sm border border-base-200 space-y-4">
			<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div class="flex items-center gap-4">
					<div
						class="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0"
					>
						<Icon name="user" class="h-7 w-7" />
					</div>
					<div>
						<div class="flex flex-wrap items-center gap-2">
							<span class="badge badge-success badge-sm font-medium text-[11px] text-white">
								SSO Terhubung
							</span>
							<span
								class="badge badge-outline badge-sm font-medium text-[11px] uppercase tracking-wider"
							>
								{data.zitadelUser?.role || (isTendik ? 'Tendik' : 'Guru')}
							</span>
							{#if data.pegawai?.nip}
								<span class="text-xs font-mono text-base-content/60">
									NIP: {data.pegawai.nip}
								</span>
							{/if}
						</div>
						<h1 class="text-xl sm:text-2xl font-bold font-display text-base-content mt-1">
							Selamat datang, {data.pegawai?.nama ?? data.user.namaLengkap ?? data.user.username}!
						</h1>
					</div>
				</div>

				<div
					class="text-xs bg-base-200/60 dark:bg-base-300/40 px-3.5 py-2.5 rounded-xl border border-base-200 shrink-0 self-start sm:self-auto"
				>
					<span class="text-[11px] font-medium text-base-content/60 block">PTK ID Dapodik:</span>
					<span class="font-mono text-xs font-semibold text-base-content select-all">
						{data.zitadelUser?.ptkId || data.pegawai?.dapodikPtkId || '-'}
					</span>
				</div>
			</div>

			<!-- Banner jika profil belum terhubung dengan data Dapodik -->
			{#if !hasDapodikPegawai}
				<div class="p-4 rounded-xl bg-warning/10 border border-warning/20 flex items-start gap-3">
					<div class="text-warning shrink-0 mt-0.5">
						<Icon name="alert" class="h-5 w-5" />
					</div>
					<div class="text-xs space-y-1">
						<p class="font-bold text-base-content">Akun Belum Ditemukan di Data Dapodik Sekolah</p>
						<p class="text-base-content/70 leading-relaxed">
							PTK ID atau data kepegawaian Anda belum terdaftar pada data Dapodik Rapkumer sekolah
							ini.
							{#if isTendik}
								Sebagai Tenaga Kependidikan, Anda dapat langsung masuk. Hak akses administratif akan
								disesuaikan oleh Admin Sekolah.
							{:else}
								Anda dapat menentukan penugasan mata pelajaran dan kelas di bawah ini agar langsung
								dapat menginput nilai.
							{/if}
						</p>
					</div>
				</div>
			{:else}
				<p class="text-sm text-base-content/70 leading-relaxed max-w-3xl">
					{#if isTendik}
						Akun SSO Anda telah terhubung dengan data profil di Rapkumer sebagai <strong
							>Tenaga Kependidikan</strong
						>.
					{:else}
						Akun SSO Anda telah terhubung dengan data profil di Rapkumer. Pastikan rincian
						<strong>Mata Pelajaran</strong> dan <strong>Kelas</strong> yang Anda ampu semester ini sudah
						sesuai sebelum melanjutkan ke beranda.
					{/if}
				</p>
			{/if}
		</div>

		{#if form?.message}
			<div class="alert alert-error text-sm rounded-xl shadow-xs">
				<Icon name="alert" class="h-5 w-5 shrink-0" />
				<span>{form.message}</span>
			</div>
		{/if}

		{#if isTendik}
			<!-- KHUSUS TENDIK: Tidak bisa atur pembelajaran, hanya info & tombol masuk -->
			<div
				class="bg-base-100 rounded-2xl p-6 sm:p-10 shadow-sm border border-base-200 space-y-6 text-center"
			>
				<div
					class="mx-auto h-16 w-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center"
				>
					<Icon name="users" class="h-8 w-8" />
				</div>
				<div class="max-w-md mx-auto space-y-2">
					<h2 class="text-xl font-bold text-base-content">Akses Tenaga Kependidikan</h2>
					<p class="text-xs text-base-content/60 leading-relaxed">
						Tenaga Kependidikan tidak memiliki penugasan mata pelajaran atau rombel mengajar. Hak
						akses administratif Anda ditentukan dan dikelola secara terpusat oleh Admin Sekolah.
					</p>
				</div>

				<form method="POST" action="?/confirmCurrent" class="pt-4 flex justify-center">
					<button
						type="submit"
						class="btn btn-primary btn-sm sm:btn-md px-8 rounded-xl text-xs sm:text-sm font-semibold text-white shadow-xs whitespace-nowrap"
					>
						<Icon name="check" class="h-4 w-4" />
						Lanjutkan ke Beranda
					</button>
				</form>
			</div>
		{:else if !isCustomizing}
			<!-- GURU: Tampilan Ringkasan Penugasan Terstruktur (Multi-Mapel Multi-Kelas) -->
			<div class="bg-base-100 rounded-2xl p-6 sm:p-8 shadow-sm border border-base-200 space-y-6">
				<div
					class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-base-200 pb-4"
				>
					<div class="flex items-center gap-3">
						<div
							class="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"
						>
							<Icon name="book-open" class="h-5 w-5" />
						</div>
						<div>
							<h2 class="font-bold text-base text-base-content">
								Penugasan Mata Pelajaran & Kelas
							</h2>
							<p class="text-xs text-base-content/60">
								Daftar mata pelajaran dan rombongan belajar yang Anda ampu semester ini.
							</p>
						</div>
					</div>

					<div class="flex items-center gap-2">
						<span class="badge badge-primary badge-soft text-xs font-semibold">
							{(data.assignedAssignments ?? []).length} Mapel
						</span>
						<span class="badge badge-neutral badge-soft text-xs font-semibold">
							{totalUniqueKelas} Kelas
						</span>
					</div>
				</div>

				{#if data.assignedAssignments && data.assignedAssignments.length > 0}
					<div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
						{#each data.assignedAssignments as item, idx (idx)}
							<div class="bg-base-200/40 rounded-xl p-4 border border-base-200 space-y-3">
								<div class="flex items-center justify-between gap-2">
									<div class="flex items-center gap-2.5 min-w-0">
										<span
											class="h-6 w-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0"
										>
											{idx + 1}
										</span>
										<h3 class="font-bold text-sm text-base-content truncate">
											{item.mapelNama}
										</h3>
									</div>
									<span class="badge badge-sm badge-ghost font-medium text-[11px] shrink-0">
										{item.kelasIds.length} Kelas
									</span>
								</div>

								<div class="flex flex-wrap gap-1.5 pt-0.5">
									{#each item.kelasIds as kId (kId)}
										{@const k = kelasMap.get(kId)}
										<span
											class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-base-100 border border-base-200 text-xs font-medium text-base-content shadow-2xs"
										>
											<Icon name="users" class="h-3.5 w-3.5 text-primary/70" />
											<span>{k?.nama ?? `Kelas #${kId}`}</span>
											{#if k?.fase}
												<span class="text-[10px] text-base-content/50">({k.fase})</span>
											{/if}
										</span>
									{/each}
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<div
						class="p-8 text-center rounded-xl border border-dashed border-base-200 text-base-content/60 text-xs space-y-2"
					>
						<p class="font-medium text-base-content">
							Belum ada mata pelajaran dan kelas yang terdaftar.
						</p>
						<p class="text-base-content/60">
							Klik tombol <strong>"Ubah Penugasan"</strong> di bawah untuk memilih mata pelajaran dan
							kelas yang Anda ajar.
						</p>
					</div>
				{/if}

				<!-- Tombol Konfirmasi Guru -->
				<div
					class="pt-5 border-t border-base-200 flex flex-col md:flex-row md:items-center justify-between gap-4"
				>
					<div class="space-y-0.5">
						<h3 class="font-bold text-sm text-base-content">
							Apakah data penugasan di atas sudah sesuai?
						</h3>
						<p class="text-xs text-base-content/60">
							Jika ada mata pelajaran atau kelas yang belum pas, Anda dapat menyesuaikannya sendiri.
						</p>
					</div>

					<div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
						<button
							type="button"
							class="btn btn-outline btn-sm sm:btn-md rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap"
							onclick={() => (isCustomizing = true)}
						>
							<Icon name="edit" class="h-4 w-4" />
							Ubah Penugasan
						</button>

						<form method="POST" action="?/confirmCurrent" class="shrink-0">
							<button
								type="submit"
								class="btn btn-primary btn-sm sm:btn-md rounded-xl text-xs sm:text-sm font-semibold text-white shadow-xs whitespace-nowrap w-full"
							>
								<Icon name="check" class="h-4 w-4" />
								Sudah Sesuai, Lanjutkan
							</button>
						</form>
					</div>
				</div>
			</div>
		{:else}
			<!-- Mode Mapping Mandiri Guru (Multi-Mapel Multi-Kelas) -->
			<form method="POST" action="?/updateMapping" class="space-y-6">
				<div class="bg-base-100 rounded-2xl p-6 sm:p-8 shadow-sm border border-base-200 space-y-6">
					<div class="flex items-center justify-between border-b border-base-200 pb-4">
						<div>
							<h2 class="font-bold text-base sm:text-lg text-base-content">
								Ubah Penugasan Mata Pelajaran & Kelas
							</h2>
							<p class="text-xs text-base-content/60">
								Tentukan mata pelajaran yang Anda ampu beserta kelas yang diajar.
							</p>
						</div>
						<button
							type="button"
							class="btn btn-ghost btn-sm text-xs rounded-xl"
							onclick={() => (isCustomizing = false)}
						>
							Batal
						</button>
					</div>

					<!-- Komponen Editor Penugasan Multi-Mapel -->
					<MultiMapelAssignmentEditor
						bind:assignments
						availableMapel={data.availableMapel}
						availableKelas={data.availableKelas}
					/>

					<!-- Submit Actions -->
					<div
						class="pt-6 border-t border-base-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5"
					>
						<button
							type="button"
							class="btn btn-ghost btn-sm sm:btn-md rounded-xl text-xs sm:text-sm font-semibold w-full sm:w-auto"
							onclick={() => (isCustomizing = false)}
						>
							Batal
						</button>
						<button
							type="submit"
							class="btn btn-primary btn-sm sm:btn-md rounded-xl text-xs sm:text-sm font-semibold text-white shadow-xs whitespace-nowrap w-full sm:w-auto"
							disabled={!canSaveAssignments}
						>
							<Icon name="check" class="h-4 w-4" />
							Simpan & Lanjutkan ke Beranda
						</button>
					</div>
				</div>
			</form>
		{/if}
	</div>
</div>
