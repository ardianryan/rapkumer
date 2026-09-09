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

<div class="min-h-screen w-full bg-slate-50 dark:bg-slate-950 py-10 px-4 sm:px-6 lg:px-8">
	<div class="max-w-4xl mx-auto space-y-8">
		<!-- Header Sambutan -->
		<div
			class="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-10 shadow-sm border border-slate-200/80 dark:border-slate-800 space-y-4"
		>
			<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div class="flex items-center gap-4">
					<div
						class="h-16 w-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0"
					>
						<Icon name="user" class="h-8 w-8" />
					</div>
					<div>
						<div class="flex flex-wrap items-center gap-2">
							<span class="badge badge-success badge-sm font-semibold text-[11px] text-white">
								● SSO Terhubung
							</span>
							<span
								class="badge badge-outline badge-sm font-semibold text-[11px] uppercase tracking-wider"
							>
								{data.zitadelUser?.role || (isTendik ? 'Tendik' : 'Guru')}
							</span>
							{#if data.pegawai?.nip}
								<span class="text-xs font-mono text-slate-500 dark:text-slate-400">
									NIP: {data.pegawai.nip}
								</span>
							{/if}
						</div>
						<h1
							class="text-2xl sm:text-3xl font-extrabold font-display text-slate-900 dark:text-white mt-1"
						>
							Selamat Datang, {data.pegawai?.nama ?? data.user.namaLengkap ?? data.user.username}!
						</h1>
					</div>
				</div>

				<div
					class="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-4 py-2.5 rounded-2xl"
				>
					<p class="font-medium text-slate-700 dark:text-slate-200">PTK ID Dapodik:</p>
					<p class="font-mono text-[11px] truncate max-w-[13rem] sm:max-w-[16rem]">
						{data.zitadelUser?.ptkId || data.pegawai?.dapodikPtkId || '-'}
					</p>
				</div>
			</div>

			<!-- Banner jika profil belum terhubung dengan data Dapodik -->
			{#if !hasDapodikPegawai}
				<div
					class="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/50 flex items-start gap-3"
				>
					<div
						class="p-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
					>
						<Icon name="alert" class="h-5 w-5" />
					</div>
					<div class="text-xs space-y-1">
						<p class="font-bold text-amber-900 dark:text-amber-200">
							Akun Belum Ditemukan di Data Dapodik Sekolah
						</p>
						<p class="text-amber-700 dark:text-amber-300 leading-relaxed">
							PTK ID atau data kepegawaian Anda belum terdaftar di sinkronisasi Dapodik Rapkumer
							sekolah ini.
							{#if isTendik}
								Sebagai Tenaga Kependidikan (Tendik), Anda dapat langsung masuk. Pengaturan
								penugasan dan hak akses lanjutan akan diatur oleh Admin Sekolah.
							{:else}
								Anda tetap dapat mengatur penugasan mata pelajaran dan kelas secara mandiri di bawah
								ini agar dapat langsung mulai bekerja.
							{/if}
						</p>
					</div>
				</div>
			{:else}
				<p class="text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-3xl">
					{#if isTendik}
						Akun SSO Anda berhasil terhubung dengan data profil di sistem Rapkumer. Anda terdaftar
						sebagai <strong>Tenaga Kependidikan (Tendik)</strong>.
					{:else}
						Akun SSO Anda berhasil terhubung dengan data profil di sistem Rapkumer. Sebelum
						melanjutkan ke Dashboard, mohon periksa apakah rincian <strong>Mata Pelajaran</strong>
						dan <strong>Kelas</strong> yang Anda ampu di bawah ini sudah sesuai.
					{/if}
				</p>
			{/if}
		</div>

		{#if form?.message}
			<div class="alert alert-error text-sm rounded-2xl shadow-sm">
				<Icon name="alert" class="h-5 w-5 shrink-0" />
				<span>{form.message}</span>
			</div>
		{/if}

		{#if isTendik}
			<!-- KHUSUS TENDIK: Tidak bisa atur pembelajaran, hanya info & tombol masuk -->
			<div
				class="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-10 shadow-sm border border-slate-200/80 dark:border-slate-800 space-y-6 text-center"
			>
				<div
					class="mx-auto h-16 w-16 rounded-2xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 flex items-center justify-center"
				>
					<Icon name="users" class="h-8 w-8" />
				</div>
				<div class="max-w-md mx-auto space-y-2">
					<h2 class="text-xl font-bold text-slate-800 dark:text-slate-100">
						Akses Tenaga Kependidikan (Tendik)
					</h2>
					<p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
						Tenaga Kependidikan tidak memiliki penugasan mata pelajaran atau kelas pembelajaran.
						Seluruh hak akses menu administratif ditentukan dan diatur secara terpusat oleh Admin
						Sekolah.
					</p>
				</div>

				<form method="POST" action="?/confirmCurrent" class="pt-4 flex justify-center">
					<button
						type="submit"
						class="btn btn-primary btn-md px-8 rounded-2xl text-xs text-white shadow-lg shadow-primary/25"
					>
						<Icon name="check" class="h-4 w-4" />
						Lanjutkan ke Beranda Aplikasi
					</button>
				</form>
			</div>
		{:else if !isCustomizing}
			<!-- GURU: Tampilan Ringkasan Penugasan Terstruktur (Multi-Mapel Multi-Kelas) -->
			<div
				class="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 dark:border-slate-800 space-y-6"
			>
				<div
					class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4"
				>
					<div class="flex items-center gap-3">
						<div
							class="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center"
						>
							<Icon name="book-open" class="h-5 w-5" />
						</div>
						<div>
							<h2 class="font-bold text-base text-slate-800 dark:text-slate-100">
								Penugasan Mata Pelajaran & Kelas
							</h2>
							<p class="text-xs text-slate-500 dark:text-slate-400">
								Daftar mata pelajaran beserta kelas-kelas yang Anda ampu saat ini.
							</p>
						</div>
					</div>

					<div class="flex items-center gap-2">
						<span class="badge badge-primary badge-soft text-xs font-semibold">
							{(data.assignedAssignments ?? []).length} Mapel
						</span>
						<span class="badge badge-secondary badge-soft text-xs font-semibold">
							{totalUniqueKelas} Kelas
						</span>
					</div>
				</div>

				{#if data.assignedAssignments && data.assignedAssignments.length > 0}
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						{#each data.assignedAssignments as item, idx (idx)}
							<div
								class="bg-slate-50/80 dark:bg-slate-800/40 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 space-y-3"
							>
								<div class="flex items-center justify-between gap-2">
									<div class="flex items-center gap-2">
										<span
											class="h-6 w-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0"
										>
											{idx + 1}
										</span>
										<h3 class="font-bold text-sm text-slate-800 dark:text-slate-200">
											{item.mapelNama}
										</h3>
									</div>
									<span class="badge badge-sm badge-ghost font-semibold text-[11px]">
										{item.kelasIds.length} Kelas
									</span>
								</div>

								<div class="flex flex-wrap gap-1.5 pt-1">
									{#each item.kelasIds as kId (kId)}
										{@const k = kelasMap.get(kId)}
										<span
											class="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 shadow-xs"
										>
											<Icon name="users" class="h-3 w-3 text-secondary" />
											<span>{k?.nama ?? `Kelas #${kId}`}</span>
											{#if k?.fase}
												<span class="text-[10px] text-slate-400 font-normal">({k.fase})</span>
											{/if}
										</span>
									{/each}
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<div
						class="p-8 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-xs space-y-2"
					>
						<p class="font-medium">Belum ada mata pelajaran dan kelas yang ditugaskan.</p>
						<p class="text-slate-500">
							Klik tombol <strong>"Sesuaikan (Mapping Mandiri)"</strong> di bawah untuk memilih mata pelajaran
							dan kelas yang Anda ajar.
						</p>
					</div>
				{/if}

				<!-- Tombol Konfirmasi Guru -->
				<div
					class="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4"
				>
					<div>
						<h3 class="font-bold text-sm sm:text-base text-slate-800 dark:text-slate-100">
							Apakah data penugasan di atas sudah sesuai?
						</h3>
						<p class="text-xs text-slate-500 dark:text-slate-400">
							Jika belum cocok atau masih kosong, Anda dapat menyesuaikan mata pelajaran serta kelas
							secara mandiri.
						</p>
					</div>

					<div class="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
						<button
							type="button"
							class="btn btn-outline btn-md w-full sm:w-auto rounded-2xl text-xs"
							onclick={() => (isCustomizing = true)}
						>
							<Icon name="edit" class="h-4 w-4" />
							Sesuaikan (Mapping Mandiri)
						</button>

						<form method="POST" action="?/confirmCurrent" class="w-full sm:w-auto">
							<button
								type="submit"
								class="btn btn-primary btn-md w-full sm:w-auto rounded-2xl text-xs text-white shadow-md shadow-primary/20"
							>
								<Icon name="check" class="h-4 w-4" />
								Ya, Sudah Sesuai (Lanjutkan)
							</button>
						</form>
					</div>
				</div>
			</div>
		{:else}
			<!-- Mode Mapping Mandiri Guru (Multi-Mapel Multi-Kelas) -->
			<form method="POST" action="?/updateMapping" class="space-y-6">
				<div
					class="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 dark:border-slate-800 space-y-6"
				>
					<div
						class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4"
					>
						<div>
							<h2 class="font-bold text-lg text-slate-800 dark:text-slate-100">
								Penyesuaian Mandiri: Multi-Kelas & Multi-Mapel
							</h2>
							<p class="text-xs text-slate-500 dark:text-slate-400">
								Pilih mata pelajaran yang Anda ampu, kemudian tentukan kelas-kelas yang diajar untuk
								masing-masing mata pelajaran.
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
						class="pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-end gap-3"
					>
						<button
							type="button"
							class="btn btn-ghost btn-md w-full sm:w-auto rounded-2xl text-xs"
							onclick={() => (isCustomizing = false)}
						>
							Batal
						</button>
						<button
							type="submit"
							class="btn btn-primary btn-md w-full sm:w-auto rounded-2xl text-xs text-white shadow-md shadow-primary/20"
							disabled={!canSaveAssignments}
						>
							<Icon name="check" class="h-4 w-4" />
							Simpan Pemetaan & Lanjut ke Dashboard
						</button>
					</div>
				</div>
			</form>
		{/if}
	</div>
</div>
