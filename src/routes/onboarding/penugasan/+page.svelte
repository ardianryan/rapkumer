<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	let isCustomizing = $state(false);

	const isTendik = $derived((data.zitadelUser?.role ?? '').trim().toLowerCase() === 'tendik');
	const hasDapodikPegawai = $derived(Boolean(data.pegawai));

	// State pemilihan mandiri (khusus guru)
	// svelte-ignore state_referenced_locally
	let selectedMapelIds = $state(
		new Set<number>((data.assignedMapel ?? []).map((m: { id: number }) => m.id))
	);
	// svelte-ignore state_referenced_locally
	let selectedKelasIds = $state(
		new Set<number>((data.assignedKelas ?? []).map((k: { id: number }) => k.id))
	);

	function toggleMapel(id: number) {
		if (selectedMapelIds.has(id)) {
			selectedMapelIds.delete(id);
		} else {
			selectedMapelIds.add(id);
		}
		selectedMapelIds = new Set(selectedMapelIds);
	}

	function toggleKelas(id: number) {
		if (selectedKelasIds.has(id)) {
			selectedKelasIds.delete(id);
		} else {
			selectedKelasIds.add(id);
		}
		selectedKelasIds = new Set(selectedKelasIds);
	}

	function toggleSelectAllKelas() {
		if (selectedKelasIds.size === data.availableKelas.length) {
			selectedKelasIds.clear();
		} else {
			selectedKelasIds = new Set(data.availableKelas.map((k: { id: number }) => k.id));
		}
		selectedKelasIds = new Set(selectedKelasIds);
	}
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
						melanjutkan ke Dashboard, mohon periksa apakah daftar <strong>Mata Pelajaran</strong>
						dan
						<strong>Kelas</strong> yang Anda ampu di bawah ini sudah sesuai.
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
			<!-- GURU: Tampilan Ringkasan Penugasan Saat Ini -->
			<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
				<!-- Card Mata Pelajaran -->
				<div
					class="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 dark:border-slate-800 space-y-4"
				>
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-3">
							<div
								class="h-10 w-10 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 flex items-center justify-center"
							>
								<Icon name="book-open" class="h-5 w-5" />
							</div>
							<h2 class="font-bold text-base text-slate-800 dark:text-slate-100">Mata Pelajaran</h2>
						</div>
						<span class="badge badge-primary badge-soft text-xs font-semibold">
							{data.assignedMapel.length} Mapel
						</span>
					</div>

					{#if data.assignedMapel.length > 0}
						<div class="space-y-2 max-h-60 overflow-y-auto pr-1">
							{#each data.assignedMapel as m (m.id)}
								<div
									class="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs"
								>
									<span class="font-semibold text-slate-800 dark:text-slate-200">{m.nama}</span>
									{#if m.kode}
										<span class="badge badge-sm badge-ghost text-[10px]">{m.kode}</span>
									{/if}
								</div>
							{/each}
						</div>
					{:else}
						<div
							class="p-6 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-xs"
						>
							Belum ada mata pelajaran yang ditugaskan.
						</div>
					{/if}
				</div>

				<!-- Card Kelas -->
				<div
					class="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 dark:border-slate-800 space-y-4"
				>
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-3">
							<div
								class="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center"
							>
								<Icon name="users" class="h-5 w-5" />
							</div>
							<h2 class="font-bold text-base text-slate-800 dark:text-slate-100">
								Kelas yang Diajar
							</h2>
						</div>
						<span class="badge badge-secondary badge-soft text-xs font-semibold">
							{data.assignedKelas.length} Kelas
						</span>
					</div>

					{#if data.assignedKelas.length > 0}
						<div class="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto pr-1">
							{#each data.assignedKelas as k (k.id)}
								<div
									class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs text-center font-semibold text-slate-800 dark:text-slate-200"
								>
									{k.nama}
									{#if k.fase}
										<span class="block text-[10px] font-normal text-slate-400">Fase {k.fase}</span>
									{/if}
								</div>
							{/each}
						</div>
					{:else}
						<div
							class="p-6 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-xs"
						>
							Belum ada kelas yang ditugaskan.
						</div>
					{/if}
				</div>
			</div>

			<!-- Tombol Konfirmasi Guru -->
			<div
				class="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4"
			>
				<div>
					<h3 class="font-bold text-sm sm:text-base text-slate-800 dark:text-slate-100">
						Apakah data penugasan di atas sudah sesuai?
					</h3>
					<p class="text-xs text-slate-500 dark:text-slate-400">
						Jika belum cocok atau masih kosong, Anda dapat memilih mata pelajaran serta kelas secara
						mandiri.
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
		{:else}
			<!-- Mode Mapping Mandiri Guru -->
			<form method="POST" action="?/updateMapping" class="space-y-6">
				<div
					class="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 dark:border-slate-800 space-y-6"
				>
					<div
						class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4"
					>
						<div>
							<h2 class="font-bold text-lg text-slate-800 dark:text-slate-100">
								Penyesuaian Mandiri: Mata Pelajaran & Kelas
							</h2>
							<p class="text-xs text-slate-500 dark:text-slate-400">
								Pilih mata pelajaran dan kelas yang Anda ampu dari data sekolah yang telah
								disinkronkan Dapodik.
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

					<!-- Bagian 1: Pilih Mata Pelajaran -->
					<div class="space-y-3">
						<div class="flex items-center justify-between">
							<label
								class="font-bold text-sm text-slate-700 dark:text-slate-200 flex items-center gap-2"
							>
								<Icon name="book-open" class="h-4 w-4 text-primary" />
								<span>Pilih Mata Pelajaran yang Diampu</span>
								<span class="badge badge-sm badge-primary">{selectedMapelIds.size} dipilih</span>
							</label>
						</div>

						<div
							class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-72 overflow-y-auto p-1"
						>
							{#each data.availableMapel as m (m.id)}
								<label
									class={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-colors text-xs ${selectedMapelIds.has(m.id) ? 'bg-primary/5 border-primary text-primary font-semibold' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300'}`}
								>
									<input
										type="checkbox"
										name="mapelIds"
										value={m.id}
										class="checkbox checkbox-primary checkbox-sm"
										checked={selectedMapelIds.has(m.id)}
										onchange={() => toggleMapel(m.id)}
									/>
									<span class="truncate">{m.nama}</span>
								</label>
							{/each}
						</div>
					</div>

					<!-- Bagian 2: Pilih Kelas -->
					<div class="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
						<div class="flex items-center justify-between">
							<label
								class="font-bold text-sm text-slate-700 dark:text-slate-200 flex items-center gap-2"
							>
								<Icon name="users" class="h-4 w-4 text-secondary" />
								<span>Pilih Kelas yang Diajar</span>
								<span class="badge badge-sm badge-secondary">{selectedKelasIds.size} dipilih</span>
							</label>

							<button
								type="button"
								class="btn btn-ghost btn-xs text-xs"
								onclick={toggleSelectAllKelas}
							>
								{selectedKelasIds.size === data.availableKelas.length
									? 'Batal Pilih Semua'
									: 'Pilih Semua Kelas'}
							</button>
						</div>

						<div
							class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-72 overflow-y-auto p-1"
						>
							{#each data.availableKelas as k (k.id)}
								<label
									class={`flex items-center gap-2.5 p-3 rounded-2xl border cursor-pointer transition-colors text-xs ${selectedKelasIds.has(k.id) ? 'bg-secondary/5 border-secondary text-secondary font-semibold' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300'}`}
								>
									<input
										type="checkbox"
										name="kelasIds"
										value={k.id}
										class="checkbox checkbox-secondary checkbox-sm"
										checked={selectedKelasIds.has(k.id)}
										onchange={() => toggleKelas(k.id)}
									/>
									<span class="truncate">{k.nama}</span>
								</label>
							{/each}
						</div>
					</div>

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
							disabled={selectedMapelIds.size === 0 && selectedKelasIds.size === 0}
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
