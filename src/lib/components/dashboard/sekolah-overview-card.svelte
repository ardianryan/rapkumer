<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import Icon from '$lib/components/icon.svelte';

	let { sekolah } = $props<{ sekolah: Sekolah | null }>();

	const sekolahLogo = $derived(sekolah?.id ? `/sekolah/logo/${sekolah.id}` : '/sekolah.png');
	const sekolahNama = $derived(sekolah?.nama ?? 'SMA Negeri 1 Gedeg');
	const sekolahNpsn = $derived(sekolah?.npsn ?? '-');
	const sekolahAlamat = $derived(
		sekolah?.alamat
			? [sekolah.alamat.desa, sekolah.alamat.kecamatan, sekolah.alamat.kabupaten]
					.filter(Boolean)
					.join(', ')
			: 'Kab. Mojokerto, Jawa Timur'
	);
</script>

<div class="card-clean card-clean-hover p-5 sm:p-6">
	<div class="flex flex-col sm:flex-row items-start sm:items-center gap-4">
		<div
			class="h-16 w-16 sm:h-20 sm:w-20 shrink-0 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-2.5 flex items-center justify-center shadow-xs"
		>
			<img
				src={sekolahLogo}
				alt={`Logo ${sekolahNama}`}
				class="h-full w-full object-contain drop-shadow-xs"
				onerror={(e) => {
					// Fallback if logo fails
					(e.currentTarget as HTMLElement).style.display = 'none';
				}}
			/>
		</div>
		<div class="space-y-1 min-w-0 flex-1">
			<div class="flex flex-wrap items-center gap-2">
				<span class="badge badge-sm badge-soft badge-primary font-medium text-[11px]">
					Identitas Satuan Pendidikan
				</span>
				<span class="badge badge-sm badge-soft badge-neutral font-mono text-[11px]">
					NPSN: {sekolahNpsn}
				</span>
			</div>
			<h2
				class="font-display text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 truncate"
			>
				{sekolahNama}
			</h2>
			<p class="text-xs text-base-content/65 flex items-center gap-1.5 truncate">
				<Icon name="school" class="h-3.5 w-3.5 shrink-0 opacity-70" />
				<span>{sekolahAlamat}</span>
			</p>
		</div>
		<div class="hidden md:flex flex-col items-end shrink-0 pl-2">
			<a
				href="/sekolah"
				class="btn btn-sm btn-soft btn-primary rounded-xl text-xs shadow-none gap-1.5"
			>
				<Icon name="info" class="h-3.5 w-3.5" />
				<span>Detail Sekolah</span>
			</a>
		</div>
	</div>
</div>
