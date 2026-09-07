<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import Icon from '$lib/components/icon.svelte';
	import { showModal } from '$lib/components/global-modal.svelte';
	import ImportDatabaseModal from '$lib/components/modals/import-database-modal.svelte';
	import { toast } from '$lib/components/toast.svelte';

	import { page } from '$app/state';
	import { resolve } from '$app/paths';

	let canDashboardManage = $derived.by(() => {
		const perms = (page.data.user ?? { permissions: [] }).permissions ?? [];
		return (perms as string[]).includes('dashboard_manage');
	});

	let downloadingBackup = $state(false);

	const handleBackupDownload = async () => {
		if (typeof window === 'undefined' || downloadingBackup) return;
		downloadingBackup = true;

		try {
			const response = await fetch('/api/database/backup');
			if (!response.ok) {
				const errorText = (await response.text()) || 'Gagal mengunduh backup database.';
				toast({ message: errorText, type: 'error' });
				return;
			}

			const blob = await response.blob();
			let filename = 'rapkumer-backup.sqlite3';
			const disposition = response.headers.get('content-disposition');
			const matched = disposition?.match(/filename="?([^";]+)"?/i);
			if (matched?.[1]) {
				filename = matched[1];
			} else {
				const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
				filename = `rapkumer-backup-${timestamp}.sqlite3`;
			}

			const blobUrl = URL.createObjectURL(blob);
			const anchor = document.createElement('a');
			document.body.appendChild(anchor);
			anchor.href = blobUrl;
			anchor.download = filename;
			anchor.click();
			document.body.removeChild(anchor);
			URL.revokeObjectURL(blobUrl);
			toast({ message: 'Backup database berhasil diunduh.', type: 'success' });
		} catch (error) {
			console.error(error);
			toast({ message: 'Gagal mengunduh backup database.', type: 'error' });
		} finally {
			downloadingBackup = false;
		}
	};

	const handleImport = () => {
		showModal({
			title: 'Import Database',
			body: ImportDatabaseModal,
			dismissible: true
		});
	};
</script>

<div class="card-clean p-5 sm:p-6">
	<div
		class="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800"
	>
		<div class="flex items-center gap-2.5">
			<div
				class="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-2xs"
			>
				<Icon name="sparkles" class="h-4.5 w-4.5" />
			</div>
			<div>
				<h2 class="font-display text-base font-bold text-slate-800 dark:text-slate-100">
					Aksi Cepat
				</h2>
				<p class="text-xs text-base-content/60">Pintasan menu utama dan pemeliharaan data</p>
			</div>
		</div>
	</div>

	<div class="space-y-4 pt-4">
		<!-- Pintasan Rutinitas Guru -->
		<div class="grid grid-cols-2 gap-2.5">
			<a
				href="/absen"
				class="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200/70 dark:border-slate-800 hover:border-primary/40 hover:bg-primary/5 dark:hover:bg-primary/10 transition-all text-center group"
			>
				<div
					class="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform"
				>
					<Icon name="check" class="h-4 w-4" />
				</div>
				<span class="text-xs font-semibold text-slate-800 dark:text-slate-200">Presensi Murid</span>
			</a>

			<a
				href="/asesmen-formatif"
				class="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200/70 dark:border-slate-800 hover:border-primary/40 hover:bg-primary/5 dark:hover:bg-primary/10 transition-all text-center group"
			>
				<div
					class="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform"
				>
					<Icon name="pen" class="h-4 w-4" />
				</div>
				<span class="text-xs font-semibold text-slate-800 dark:text-slate-200">Input Nilai TP</span>
			</a>

			<a
				href="/jurnal-mengajar"
				class="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200/70 dark:border-slate-800 hover:border-primary/40 hover:bg-primary/5 dark:hover:bg-primary/10 transition-all text-center group"
			>
				<div
					class="h-8 w-8 rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform"
				>
					<Icon name="calendar" class="h-4 w-4" />
				</div>
				<span class="text-xs font-semibold text-slate-800 dark:text-slate-200">Jurnal Mengajar</span
				>
			</a>

			<a
				href="/cetak"
				class="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200/70 dark:border-slate-800 hover:border-primary/40 hover:bg-primary/5 dark:hover:bg-primary/10 transition-all text-center group"
			>
				<div
					class="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform"
				>
					<Icon name="print" class="h-4 w-4" />
				</div>
				<span class="text-xs font-semibold text-slate-800 dark:text-slate-200">Cetak Rapor</span>
			</a>
		</div>

		<!-- Tombol Pengaturan & Backup untuk Admin -->
		<div class="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
			<a
				href={resolve('/pengaturan')}
				onclick={(e) => {
					if (!canDashboardManage) e.preventDefault();
				}}
				class="btn btn-sm btn-soft btn-primary w-full rounded-xl shadow-none justify-between"
				class:btn-disabled={!canDashboardManage}
				aria-disabled={!canDashboardManage}
			>
				<div class="flex items-center gap-2">
					<Icon name="gear" class="h-4 w-4" />
					<span>Pengaturan Aplikasi</span>
				</div>
				<Icon name="right" class="h-3.5 w-3.5 opacity-60" />
			</a>

			<div class="grid grid-cols-2 gap-2">
				<button
					type="button"
					onclick={() => (canDashboardManage ? handleBackupDownload() : undefined)}
					class="btn btn-sm btn-soft btn-neutral rounded-xl w-full shadow-none gap-1.5"
					disabled={downloadingBackup || !canDashboardManage}
					aria-disabled={!canDashboardManage}
					aria-busy={downloadingBackup}
				>
					{#if downloadingBackup}
						<span class="loading loading-spinner loading-xs"></span>
					{:else}
						<Icon name="database" class="h-3.5 w-3.5" />
					{/if}
					<span>Backup</span>
				</button>
				<button
					type="button"
					onclick={() => (canDashboardManage ? handleImport() : undefined)}
					class="btn btn-sm btn-soft btn-neutral rounded-xl w-full shadow-none gap-1.5"
					disabled={!canDashboardManage}
					aria-disabled={!canDashboardManage}
				>
					<Icon name="import" class="h-3.5 w-3.5" />
					<span>Import</span>
				</button>
			</div>
		</div>
	</div>
</div>
