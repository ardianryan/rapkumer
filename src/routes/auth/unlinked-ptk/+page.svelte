<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- static link back to login */
	import { page } from '$app/state';
	import Icon from '$lib/components/icon.svelte';

	const error = $derived(page.url.searchParams.get('error') ?? 'ptk_not_found');
	const ptkId = $derived(page.url.searchParams.get('ptk_id') ?? '');
	const nip = $derived(page.url.searchParams.get('nip') ?? '');
	const role = $derived(page.url.searchParams.get('role') ?? '');

	const isRoleNotAllowed = $derived(error === 'role_not_allowed');
</script>

<svelte:head>
	<title>{isRoleNotAllowed ? 'Akses Ditolak' : 'PTK ID Tidak Ditemukan'} - Rapkumer</title>
</svelte:head>

<div
	class="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-slate-50 dark:bg-slate-950"
>
	<div
		class="card w-full max-w-lg bg-white dark:bg-slate-900 shadow-xl border border-slate-200/80 dark:border-slate-800 rounded-3xl overflow-hidden"
	>
		<!-- Header Banner -->
		<div
			class={`p-6 sm:p-8 text-white ${isRoleNotAllowed ? 'bg-gradient-to-br from-amber-600 to-rose-700' : 'bg-gradient-to-br from-sky-700 to-indigo-900'}`}
		>
			<div class="flex items-center gap-4">
				<div
					class="h-14 w-14 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/20"
				>
					<Icon name={isRoleNotAllowed ? 'alert' : 'users'} class="h-7 w-7 text-white" />
				</div>
				<div>
					<span
						class="inline-block text-[11px] font-semibold tracking-wide uppercase px-2.5 py-0.5 rounded-full bg-white/20 text-white mb-1"
					>
						{isRoleNotAllowed ? 'Autentikasi SSO Dibatasi' : 'Pencocokan Data Dapodik'}
					</span>
					<h1 class="text-xl sm:text-2xl font-bold font-display leading-tight">
						{isRoleNotAllowed ? 'Akses Belum Diizinkan' : 'PTK ID Belum Terdaftar'}
					</h1>
				</div>
			</div>
		</div>

		<!-- Body -->
		<div class="p-6 sm:p-8 space-y-6">
			{#if isRoleNotAllowed}
				<div class="space-y-3">
					<p class="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
						Akun SSO Anda berhasil terverifikasi dengan peran <span
							class="font-semibold text-amber-600 dark:text-amber-400"
							>"{role || 'tidak diketahui'}"</span
						>.
					</p>
					<div
						class="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-200 leading-relaxed"
					>
						Sesuai kebijakan keamanan, portal Rapkumer saat ini hanya dapat diakses oleh akun dengan
						peran <strong>Guru</strong> atau <strong>Tenaga Kependidikan (Tendik)</strong>.
					</div>
				</div>
			{:else}
				<div class="space-y-3">
					<p class="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
						Akun SSO ZITADEL Anda aktif, namun <strong>PTK ID Dapodik</strong> atau
						<strong>NIP</strong> belum ditemukan di database sekolah pada aplikasi Rapkumer ini.
					</p>

					<!-- Detail Box -->
					<div
						class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-2 text-xs font-mono"
					>
						<div
							class="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-700/60"
						>
							<span class="text-slate-500">PTK ID ZITADEL</span>
							<span
								class="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[14rem] sm:max-w-xs"
								>{ptkId || '-'}</span
							>
						</div>
						<div class="flex justify-between items-center py-1">
							<span class="text-slate-500">NIP Akun</span>
							<span class="font-semibold text-slate-800 dark:text-slate-200">{nip || '-'}</span>
						</div>
					</div>

					<!-- Solusi / Langkah Tindak Lanjut -->
					<div
						class="p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200/70 dark:border-sky-900/50 space-y-2 text-xs text-sky-900 dark:text-sky-200"
					>
						<div class="font-semibold flex items-center gap-1.5">
							<Icon name="info" class="h-4 w-4 shrink-0" />
							<span>Langkah yang dapat dilakukan:</span>
						</div>
						<ul class="list-disc list-inside space-y-1 pl-1 text-slate-600 dark:text-slate-300">
							<li>Pastikan data Anda sudah disinkronkan dari Dapodik oleh Operator Sekolah.</li>
							<li>
								Hubungi Admin Sekolah untuk melakukan <em>Mapping Manual</em> ke profil GTK Anda.
							</li>
							<li>
								Jika Anda memiliki akun login lokal, Anda dapat masuk menggunakan formulir username
								& kata sandi biasa.
							</li>
						</ul>
					</div>
				</div>
			{/if}

			<!-- Actions -->
			<div class="pt-2 flex flex-col sm:flex-row gap-3">
				<a href="/login" class="btn btn-primary w-full shadow-lg shadow-primary/20 text-white">
					<Icon name="left" class="h-4 w-4" />
					Kembali ke Halaman Masuk
				</a>
			</div>
		</div>
	</div>
</div>
