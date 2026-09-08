<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	let {
		selectedIds,
		onDelete,
		onResetPermissions,
		onAdd
	}: {
		selectedIds: number[];
		onDelete?: () => void;
		onResetPermissions?: () => void;
		onAdd?: () => void;
	} = $props();
</script>

{#if selectedIds.length > 0}
	<div class="flex flex-wrap items-center gap-2 sm:self-start">
		<button
			class="btn btn-outline btn-warning shadow-none"
			type="button"
			onclick={() => onResetPermissions?.()}
		>
			<Icon name="repeat" />
			Reset Hak Akses ({selectedIds.length})
		</button>
		<button class="btn btn-error shadow-none" type="button" onclick={() => onDelete?.()}>
			<Icon name="del" />
			Hapus Pengguna ({selectedIds.length})
		</button>
	</div>
{:else}
	<button
		class="btn btn-outline btn-primary shadow-none sm:self-start"
		type="button"
		onclick={() => onAdd?.()}
	>
		<Icon name="plus" />
		Tambah Pengguna
	</button>
{/if}
