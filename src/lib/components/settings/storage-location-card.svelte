<script lang="ts">
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';
	import StorageFolderPicker from '$lib/components/settings/storage-folder-picker.svelte';

	let {
		storage
	}: {
		storage: {
			dataRoot: string;
			rootManagedByLauncher: boolean;
			r2?: {
				isConfigured: boolean;
				bucketName: string;
				folderPath: string;
				publicUrl: string;
				endpoint: string;
			};
		};
	} = $props();

	const isR2Active = $derived(Boolean(storage?.r2?.isConfigured));

	// Storage location form (admin only). Uploads/sounds follow the data root
	// automatically, so only the root is editable here.
	// svelte-ignore state_referenced_locally
	let storageRoot = $state(storage.dataRoot);
	const storageChanged = $derived(storageRoot !== storage.dataRoot);

	// Folder picker
	let pickerOpen = $state(false);
	let pickerInitial = $state('');
	let pickerTitle = $state('Pilih Folder');

	function openPicker() {
		if (isR2Active) return;
		pickerInitial = storageRoot;
		pickerTitle = 'Pilih Folder Root Data';
		pickerOpen = true;
	}

	function handlePickerSelect(event: CustomEvent<{ path: string }>) {
		storageRoot = event.detail.path;
		pickerOpen = false;
	}
</script>

<section class="card bg-base-100 rounded-lg border border-none p-6 shadow-md">
	<FormEnhance action="?/update-storage-location">
		{#snippet children({ submitting })}
			<header class="mb-4 space-y-2">
				<div class="flex flex-wrap items-center justify-between gap-2">
					<h2 class="text-xl font-semibold">Lokasi Data</h2>
					{#if isR2Active}
						<div class="badge badge-success gap-1.5 py-3 text-xs font-medium">
							<Icon name="check" class="h-3.5 w-3.5" />
							Cloudflare R2 / S3 Aktif
						</div>
					{/if}
				</div>
				<p class="text-base-content/70 text-sm">
					{#if isR2Active}
						Penyimpanan media publik dialihkan ke Object Storage (Cloudflare R2 / S3). Pengaturan path folder fisik lokal server terkunci secara otomatis.
					{:else}
						Pilih root data. Subfolder <code>ttd/</code>, <code>dinas-luar/</code>,
						<code>uploads/</code>, dan <code>sounds/</code> akan dibuat otomatis di dalamnya. File yang
						ada akan dipindahkan otomatis ke lokasi baru; perubahan berlaku setelah server dimulai ulang.
					{/if}
				</p>
			</header>

			{#if isR2Active}
				<div class="mb-5 space-y-2.5 rounded-xl border border-success/30 bg-success/10 p-4">
					<div class="flex items-center gap-2 text-sm font-semibold text-success">
						<Icon name="lock" class="h-4 w-4 shrink-0" />
						<span>Penyimpanan Berkas Ditangani oleh Cloudflare R2 / S3</span>
					</div>
					<p class="text-xs leading-relaxed text-base-content/80">
						Seluruh berkas media (foto profil, bukti dinas luar, paraf/tanda tangan presensi, dan dokumen lampiran lainnya) diunggah langsung dan disajikan melalui URL CDN publik Cloudflare R2.
					</p>
					<div class="grid grid-cols-1 gap-2 pt-1 text-xs sm:grid-cols-2">
						<div class="rounded-lg border border-base-200 bg-base-100/80 p-2.5">
							<span class="block font-medium text-base-content/60">Bucket:</span>
							<span class="font-mono font-semibold text-base-content/90">{storage.r2?.bucketName || '-'}</span>
						</div>
						<div class="rounded-lg border border-base-200 bg-base-100/80 p-2.5">
							<span class="block font-medium text-base-content/60">Folder Path:</span>
							<span class="font-mono font-semibold text-base-content/90">{storage.r2?.folderPath ? storage.r2.folderPath : '(root bucket)'}</span>
						</div>
						{#if storage.r2?.publicUrl}
							<div class="rounded-lg border border-base-200 bg-base-100/80 p-2.5 sm:col-span-2">
								<span class="block font-medium text-base-content/60">Public CDN URL:</span>
								<a
									href={storage.r2.publicUrl}
									target="_blank"
									rel="noreferrer"
									class="break-all font-mono font-semibold text-success underline"
								>
									{storage.r2.publicUrl}
								</a>
							</div>
						{/if}
					</div>
					<div class="flex items-center gap-1.5 pt-1 text-[11px] text-base-content/60">
						<Icon name="info" class="h-3.5 w-3.5 shrink-0" />
						<span>Untuk mengubah konfigurasi bucket/kredensial, perbarui variabel <code>R2_*</code> di environment (.env / Portainer).</span>
					</div>
				</div>
			{/if}

			{#if storage.rootManagedByLauncher}
				<div role="alert" class="alert alert-info mb-4">
					<Icon name="alert" />
					<span
						>Pada instalasi Windows, pengaturan ini disimpan ke file Installer
						<code>%LOCALAPPDATA%\Rapkumer-data\data-root.txt</code> dan diterapkan saat aplikasi
						dimulai ulang. Basis data tetap berada di
						<code>%LOCALAPPDATA%\Rapkumer-data\database.sqlite3</code>.</span
					>
				</div>
			{/if}

			<fieldset class="fieldset">
				<legend class="fieldset-legend">Root data (RAPKUMER_DATA_DIR)</legend>
				<div class="join w-full">
					<input
						class="input bg-base-200 dark:bg-base-300 join-item w-full dark:border-none disabled:opacity-60 disabled:cursor-not-allowed"
						type="text"
						name="dataRoot"
						bind:value={storageRoot}
						disabled={isR2Active}
						placeholder="Kosongkan untuk default"
					/>
					<button
						class="btn join-item btn-soft btn-info shadow-none"
						type="button"
						disabled={isR2Active}
						aria-disabled={isR2Active}
						title={isR2Active ? 'Terkunci karena menggunakan Cloudflare R2' : 'Pilih folder'}
						onclick={openPicker}
					>
						<Icon name={isR2Active ? 'lock' : 'folder'} />
						{isR2Active ? 'Terkunci' : 'Jelajah'}
					</button>
				</div>
				<p class="text-base-content/70 mt-1 text-xs">
					{#if isR2Active}
						<span class="text-warning flex items-center gap-1">
							<Icon name="lock" class="h-3 w-3 inline" />
							Folder lokal server tidak digunakan untuk berkas publik saat Cloudflare R2 aktif.
						</span>
					{:else}
						Cukup pilih root ini saja. Subfolder <code>ttd/</code>, <code>dinas-luar/</code>,
						<code>uploads/</code>, dan <code>sounds/</code> dibuat otomatis di dalamnya saat disimpan.
					{/if}
				</p>
			</fieldset>

			{#if !isR2Active}
				<div role="alert" class="alert alert-info mt-4 alert-soft">
					<Icon name="info" />
					<span
						>File di lokasi lama akan disalin ke lokasi baru (tidak dihapus). Perlu mulai ulang server
						agar aplikasi membaca folder baru.</span
					>
				</div>

				<div class="mt-6 flex justify-end">
					<button
						class="btn btn-primary shadow-none"
						type="submit"
						disabled={submitting || !storageChanged}
						aria-disabled={!storageChanged}
						title={storageChanged ? '' : 'Tidak ada perubahan yang disimpan'}
					>
						<Icon name="save" />
						{submitting ? 'Menyimpan…' : 'Simpan Lokasi'}
					</button>
				</div>
			{/if}
		{/snippet}
	</FormEnhance>

	<StorageFolderPicker
		open={pickerOpen}
		title={pickerTitle}
		initial={pickerInitial}
		on:select={handlePickerSelect}
		on:close={() => (pickerOpen = false)}
	/>
</section>
