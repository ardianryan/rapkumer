<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	let { u, onEdit, onOpenUser, onDelete = undefined } = $props();
</script>

<td>{u.pegawaiName ?? u.username}</td>
<td>{(u.roles ?? []).join(', ')}</td>
<td>{u.username ? u.username : '-'}</td>
<td>
	{#if u.sso}
		<div
			class="flex items-center gap-1.5"
			title={`PTK ID: ${u.sso.ptkId || u.dapodikPtkId || '-'} | NIP: ${u.sso.nip || '-'}`}
		>
			<span class="badge badge-success badge-soft badge-sm font-semibold text-[11px] gap-1">
				<span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
				Tersinkronisasi
			</span>
		</div>
	{:else}
		<div
			class="flex items-center gap-1.5"
			title={u.dapodikPtkId ? `PTK ID: ${u.dapodikPtkId}` : undefined}
		>
			<span class="badge badge-ghost badge-sm text-[11px] text-base-content/60"> Lokal </span>
			{#if u.dapodikPtkId}
				<span
					class="badge badge-info badge-soft badge-xs text-[10px]"
					title={`PTK ID: ${u.dapodikPtkId}`}
				>
					PTK ID
				</span>
			{/if}
		</div>
	{/if}
</td>
<td>
	<div class="flex flex-row">
		<button
			class="btn btn-sm btn-soft rounded-r-none shadow-none"
			title="Edit pengguna"
			onclick={() => onEdit?.(u)}
		>
			<Icon name="edit" />
		</button>
		<button
			class="btn btn-sm btn-error btn-soft rounded-l-none shadow-none"
			title="Hapus pengguna"
			onclick={() => onDelete?.(u)}
		>
			<Icon name="del" />
		</button>
	</div>
</td>
<td>
	<button
		class="btn btn-sm btn-soft shadow-none"
		title="Atur hak akses"
		type="button"
		onclick={(e) => {
			e.preventDefault();
			if (!u.isNew) onOpenUser?.(u);
		}}
		disabled={!!u.isNew}
	>
		<Icon name="key" />
	</button>
</td>
