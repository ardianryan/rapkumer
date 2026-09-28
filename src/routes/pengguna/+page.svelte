<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- edit/add links to dedicated form pages are intentional */
	import { goto, invalidateAll } from '$app/navigation';
	import { showModal, updateModal } from '$lib/components/global-modal.svelte';
	import { toast } from '$lib/components/toast.svelte';
	import AlertWarning from '$lib/components/alert-warning.svelte';
	import UsersHeader from '$lib/components/pengguna/UsersHeader.svelte';
	import ExistingUserRow from '$lib/components/pengguna/ExistingUserRow.svelte';

	let { data } = $props();

	// derive user item type from incoming load data to keep typings simple
	type UserItem = typeof data.users extends Array<infer U> ? U : Record<string, unknown>;

	// local reactive users copy so UI updates instantly without full reload
	type LocalUser = UserItem & {
		isNew?: boolean;
		nama?: string;
		dapodikPtkId?: string | null;
		mataPelajaranId?: number | null;
		mataPelajaranIds?: number[];
		kelasIds?: number[];
		assignments?: Array<{ mapelNama: string; kelasIds: number[] }>;
		sso?: {
			userId: number;
			zitadelUuid: string;
			ptkId?: string | null;
			nip?: string | null;
			role?: string | null;
			isOnboarded?: boolean;
			lastLoginAt?: string | null;
		} | null;
	};
	// svelte-ignore state_referenced_locally
	let users = $state<LocalUser[]>(data.users ?? []);

	// selected ids for bulk actions
	let selectedIds = $state<number[]>([]);

	let activeTab = $state<'all' | 'local' | 'sso'>('all');
	let filteredUsers = $derived(
		activeTab === 'all'
			? users
			: activeTab === 'sso'
				? users.filter((u) => Boolean(u.sso || u.dapodikPtkId))
				: users.filter((u) => !u.sso && !u.dapodikPtkId)
	);

	// selectable ids derived once per render (positive existing user ids)
	let selectableIds = $derived(
		filteredUsers.map((u) => Number(u.id)).filter((n) => Number.isFinite(n) && n > 0)
	);

	function toggleSelect(id: number) {
		const idx = selectedIds.indexOf(id);
		if (idx === -1) selectedIds = [...selectedIds, id];
		else selectedIds = selectedIds.filter((x) => x !== id);
	}

	function handleBulkResetPermissions() {
		showModal({
			title: 'Reset Hak Akses Standar',
			body: `Yakin ingin mereset hak akses ${selectedIds.length} pengguna terpilih ke hak akses standar peran masing-masing?`,
			onPositive: {
				label: 'Reset Hak Akses',
				icon: 'repeat',
				action: async ({ close }: { close: () => void }) => {
					const form = new FormData();
					form.set('userIds', JSON.stringify(selectedIds));
					const res = await fetch('?/bulk_reset_permissions', { method: 'POST', body: form });
					if (res.ok) {
						toast({
							message: `Berhasil mereset hak akses ${selectedIds.length} pengguna ke standar peran`,
							type: 'success'
						});
						close();
						selectedIds = [];
						await invalidateAll();
						users = data.users ?? [];
					} else {
						toast({ message: 'Gagal mereset hak akses', type: 'error' });
					}
				}
			},
			onNegative: { label: 'Batal', icon: 'close' },
			dismissible: true
		});
	}

	async function handleDelete() {
		// reuse the shared delete modal logic for the currently selected ids
		openDeleteModalForIds(selectedIds);
	}
	// open delete modal for given ids (reused by bulk and single-user delete)
	function openDeleteModalForIds(ids: number[]) {
		const selectedUsers = users.filter((u) => ids.indexOf(u.id as number) !== -1);
		const hasWali = selectedUsers.some((u) => {
			const type = (u as { type?: string }).type;
			return type === 'wali_kelas' || type === 'wali_asuh';
		});

		if (hasWali) {
			showModal({
				title: 'Hapus pengguna',
				body: AlertWarning,
				bodyProps: {
					message:
						'Tidak dapat menghapus karena satu atau lebih pengguna terpilih berperan sebagai Wali Kelas atau Wali Asuh. Untuk menggantinya, klik tombol <strong>Atur Data Kelas</strong>'
				},
				onPositive: {
					label: 'Atur Data Kelas',
					icon: 'edit',
					action: ({ close }: { close: () => void }) => {
						close();
						window.location.href = '/kelas';
					}
				},
				onNegative: { label: 'Batal', icon: 'close' },
				dismissible: true
			});
			return;
		}

		showModal({
			title: 'Hapus pengguna',
			body: `Yakin ingin menghapus ${ids.length} pengguna yang dipilih?`,
			onPositive: {
				label: 'Hapus',
				icon: 'del',
				action: async ({ close }: { close: () => void }) => {
					const idsToDelete = ids.filter((n) => n > 0);
					if (!idsToDelete.length) {
						toast({ message: 'Tidak ada pengguna valid untuk dihapus', type: 'error' });
						return;
					}
					const form = new FormData();
					form.set('ids', idsToDelete.join(','));
					const res = await fetch('?/delete_users', { method: 'POST', body: form });
					if (res.ok) {
						await res.json().catch(() => ({}));
						users = users.filter((x) => !idsToDelete.includes(x.id as number));
						selectedIds = selectedIds.filter((n) => !idsToDelete.includes(n));
						users = [...users];
						toast({
							message: `Berhasil menghapus ${idsToDelete.length} pengguna`,
							type: 'success'
						});
						close();
					} else {
						let msg = 'Gagal menghapus';
						let parsedBody: unknown = null;
						try {
							parsedBody = await res.json().catch(() => null);
							if (parsedBody && typeof parsedBody === 'object') {
								const pb = parsedBody as Record<string, unknown>;
								if (typeof pb.message === 'string' && pb.message.trim()) msg = pb.message;
								else if (pb.type === 'warning' && typeof pb.message === 'string') msg = pb.message;
								else if (
									pb.error &&
									typeof (pb.error as Record<string, unknown>).message === 'string'
								)
									msg = (pb.error as Record<string, unknown>).message as string;
								else msg = JSON.stringify(pb);
							} else {
								const text = await res.text().catch(() => '');
								if (text.trim()) msg = text;
							}
						} catch {
							// keep default msg
						}
						try {
							if (
								parsedBody &&
								typeof parsedBody === 'object' &&
								(parsedBody as Record<string, unknown>).type === 'warning' &&
								typeof (parsedBody as Record<string, unknown>).message === 'string'
							) {
								const pb = parsedBody as Record<string, unknown>;
								const escapeHtml = (s: string) =>
									s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
								const safe = escapeHtml(pb.message as string);
								updateModal({
									title: 'Hapus pengguna',
									body: AlertWarning,
									bodyProps: { message: safe },
									onPositive: {
										label: 'Atur Wali Kelas',
										icon: 'key',
										action: ({ close: c }: { close: () => void }) => {
											c();
											window.location.href = '/kelas';
										}
									},
									onNegative: { label: 'Tutup', icon: 'close' },
									dismissible: true
								});
								return;
							}
						} catch {
							// ignore
						}
						toast({ message: msg, type: 'warning' });
					}
				}
			},
			onNegative: { label: 'Batal', icon: 'close' },
			dismissible: true
		});
	}
	function toggleSelectAll() {
		if (selectableIds.length === 0) {
			selectedIds = [];
			return;
		}
		const allSelected = selectableIds.every((id) => selectedIds.indexOf(id) !== -1);
		if (allSelected) selectedIds = [];
		else selectedIds = [...selectableIds];
	}

	// handle add/new row
	function handleAdd() {
		goto('/pengguna/form');
	}

	function handleEdit(user: LocalUser) {
		goto(`/pengguna/form/${user.id}`);
	}
</script>

<section class="card bg-base-100 rounded-lg border border-none p-6 shadow-md">
	<div class="space-y-4">
		<header class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<div class="space-y-2">
				<h1 class="text-2xl font-bold">Daftar pengguna</h1>
			</div>
			<UsersHeader
				{selectedIds}
				onDelete={handleDelete}
				onResetPermissions={handleBulkResetPermissions}
				onAdd={handleAdd}
			/>
		</header>

		<!-- Filter Tabs: Semua / Lokal / SSO Auth -->
		<div class="tabs tabs-box bg-base-200/60 p-1 rounded-2xl inline-flex w-fit text-xs">
			<button
				type="button"
				class={`tab tab-sm font-medium transition-all rounded-xl ${activeTab === 'all' ? 'tab-active font-bold bg-white dark:bg-base-100 shadow-sm' : ''}`}
				onclick={() => (activeTab = 'all')}
			>
				Semua Pengguna ({users.length})
			</button>
			<button
				type="button"
				class={`tab tab-sm font-medium transition-all rounded-xl gap-1.5 ${activeTab === 'sso' ? 'tab-active font-bold bg-white dark:bg-base-100 shadow-sm text-sky-600 dark:text-sky-400' : ''}`}
				onclick={() => (activeTab = 'sso')}
			>
				<span class="h-2 w-2 rounded-full bg-sky-500 inline-block"></span>
				SSO / Dapodik ({users.filter((u) => Boolean(u.sso || u.dapodikPtkId)).length})
			</button>
			<button
				type="button"
				class={`tab tab-sm font-medium transition-all rounded-xl ${activeTab === 'local' ? 'tab-active font-bold bg-white dark:bg-base-100 shadow-sm' : ''}`}
				onclick={() => (activeTab = 'local')}
			>
				Lokal Tanpa Dapodik ({users.filter((u) => !u.sso && !u.dapodikPtkId).length})
			</button>
		</div>

		<div class="overflow-x-auto">
			<table class="table">
				<thead>
					<tr>
						<th>
							<input
								type="checkbox"
								class="checkbox"
								checked={selectableIds.length > 0 &&
									selectableIds.every((id) => selectedIds.indexOf(id) !== -1)}
								onclick={() => toggleSelectAll()}
							/>
						</th>
						<th>Nama</th>
						<th>Role</th>
						<th>Nama Pengguna</th>
						<th>Autentikasi</th>
						<th>Aksi</th>
						<th>Hak Akses</th>
					</tr>
				</thead>
				<tbody>
					{#each filteredUsers as u (u.id)}
						<tr>
							<td>
								<input
									type="checkbox"
									class="checkbox"
									checked={selectedIds.indexOf(u.id) !== -1}
									onclick={() => toggleSelect(u.id)}
								/>
							</td>

							<ExistingUserRow
								{u}
								onEdit={handleEdit}
								onOpenUser={(user: LocalUser) => {
									window.location.href = '/pengguna/' + user.id;
								}}
								onDelete={(user: LocalUser) => openDeleteModalForIds([Number(user.id)])}
							/>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</section>
