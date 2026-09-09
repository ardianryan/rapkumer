<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Icon from '$lib/components/icon.svelte';
	import { toast } from '$lib/components/toast.svelte';
	import { validatePasswordStrength } from '$lib/password-policy';
	import MultiMapelAssignmentEditor, {
		type GuruMapelAssignment
	} from '$lib/components/pengguna/MultiMapelAssignmentEditor.svelte';

	let {
		open = $bindable(false),
		mataPelajaran = [],
		sekolahList = [],
		kelasList = [],
		editUser = null
	} = $props<{
		open?: boolean;
		mataPelajaran?: { id: number; nama: string }[];
		sekolahList?: { id: number; nama: string }[];
		kelasList?: { id: number; nama: string; fase?: string | null; sekolahId: number }[];
		editUser?: {
			id: number;
			username: string;
			pegawaiName?: string | null;
			dapodikPtkId?: string | null;
			type?: string;
			sekolahId?: number | null;
			mataPelajaranIds?: number[];
			kelasIds?: number[];
			assignments?: GuruMapelAssignment[];
			pembelajaranList?: Array<{ kelasId: number; mataPelajaranId: number }>;
			sso?: {
				ptkId?: string | null;
				[key: string]: unknown;
			} | null;
		} | null;
	}>();

	const dispatch = createEventDispatcher();

	let nama = $state('');
	let username = $state('');
	let dapodikPtkId = $state('');
	let password = $state('');
	let type = $state('user');
	// Multi-mapel & Multi-kelas terstruktur khusus guru
	let assignments = $state<GuruMapelAssignment[]>([{ mapelNama: '', kelasIds: [] }]);
	// Legacy fallback: untuk role wali_kelas dsb
	let mataPelajaranIds = $state(new Set<number>());
	let kelasIds = $state(new Set<number>());
	let sekolahId = $state<string | number | null>('');
	let initialized = $state(false);
	let showPassword = $state(false);
	let selectAllKelas = $state(false);
	let saving = $state(false);

	const isEditMode = $derived(editUser !== null);
	const modalTitle = $derived(isEditMode ? 'Edit Pengguna' : 'Tambah Pengguna');

	// Derived state
	let uniqueMataPelajaran = $derived.by(() => uniqueByNama(mataPelajaran ?? []));
	let filteredMataPelajaran = $derived.by(() => {
		return uniqueMataPelajaran.filter((m) => {
			const name = (m.nama ?? '').toString().trim().toLowerCase();
			// exclude the exact combined parent subject
			if (name === 'pendidikan agama dan budi pekerti') return false;
			// exclude the exact combined parent subject for Pendalaman Kitab Suci
			if (name === 'pendalaman kitab suci') return false;
			return true;
		});
	});

	let filteredKelasList = $derived.by(() => {
		if (!sekolahId) return kelasList ?? [];
		const sId = Number(sekolahId);
		return (kelasList ?? []).filter((k: { sekolahId?: number | null }) => k.sekolahId === sId);
	});

	// Validasi: semua field wajib terisi (password optional saat edit, mapel optional untuk non-guru)
	let isValid = $derived.by(() => {
		const hasNama = nama.trim().length > 0;
		const hasUsername = username.trim().length > 0;
		const hasPassword = isEditMode ? true : password.trim().length > 0;
		const hasMapel =
			type !== 'user' ||
			assignments.some(
				(a) => (a.mapelNama ?? '').trim().length > 0 && (a.kelasIds ?? []).length > 0
			);
		return hasNama && hasUsername && hasPassword && hasMapel;
	});

	function uniqueByNama(list: { id: number; nama: string }[]) {
		const map = new Map<string, { id: number; nama: string }>();
		for (const m of list) {
			if (!map.has(m.nama)) map.set(m.nama, m);
		}
		return Array.from(map.values());
	}

	// initialize defaults only once when the modal opens
	$effect(() => {
		if (open && !initialized) {
			if (editUser) {
				nama = editUser.pegawaiName ?? '';
				username = editUser.username ?? '';
				dapodikPtkId = editUser.dapodikPtkId ?? editUser.sso?.ptkId ?? '';
				type = editUser.type ?? 'user';
				sekolahId = editUser.sekolahId ?? '';
				mataPelajaranIds = new Set(editUser.mataPelajaranIds ?? []);
				kelasIds = new Set(editUser.kelasIds ?? []);

				// Inisialisasi assignments terstruktur
				if (editUser.assignments && editUser.assignments.length > 0) {
					assignments = JSON.parse(JSON.stringify(editUser.assignments));
				} else if (editUser.pembelajaranList && editUser.pembelajaranList.length > 0) {
					const mpNameMap = new Map<number, string>();
					for (const m of mataPelajaran) mpNameMap.set(m.id, m.nama);
					const grouped = new Map<string, Set<number>>();
					for (const p of editUser.pembelajaranList) {
						const mName = mpNameMap.get(p.mataPelajaranId);
						if (mName) {
							const key = mName.trim();
							if (!grouped.has(key)) grouped.set(key, new Set());
							grouped.get(key)!.add(p.kelasId);
						}
					}
					assignments = Array.from(grouped.entries()).map(([mapelNama, kIds]) => ({
						mapelNama,
						kelasIds: Array.from(kIds)
					}));
				} else if (editUser.mataPelajaranIds && editUser.mataPelajaranIds.length > 0) {
					const kIds = editUser.kelasIds ?? [];
					const seen = new Set<string>();
					const list: GuruMapelAssignment[] = [];
					for (const mId of editUser.mataPelajaranIds) {
						const found = mataPelajaran.find((m: { id: number; nama: string }) => m.id === mId);
						if (found?.nama) {
							const key = found.nama.trim().toLowerCase();
							if (!seen.has(key)) {
								seen.add(key);
								list.push({ mapelNama: found.nama.trim(), kelasIds: kIds });
							}
						}
					}
					assignments = list.length > 0 ? list : [{ mapelNama: '', kelasIds: [] }];
				} else {
					assignments = [{ mapelNama: '', kelasIds: [] }];
				}
			} else {
				nama = '';
				username = '';
				dapodikPtkId = '';
				type = 'user';
				assignments = [{ mapelNama: '', kelasIds: [] }];
				mataPelajaranIds = new Set<number>();
				kelasIds = new Set<number>();
				sekolahId = '';
			}
			password = '';
			initialized = true;
			if (type === 'wali_kelas') selectAllMapelAndKelas();
		}
	});

	// if modal is closed, allow re-initialization next time it opens
	$effect(() => {
		if (!open) {
			initialized = false;
			selectAllKelas = false;
			saving = false;
			kelasIds.clear();
		}
	});

	function selectAllMapelAndKelas() {
		mataPelajaranIds = new Set(filteredMataPelajaran.map((m) => m.id));
		for (const k of filteredKelasList) {
			kelasIds.add(k.id);
		}
		kelasIds = new Set(kelasIds);
		selectAllKelas = filteredKelasList.length > 0;
	}

	function toggleSelectAllKelas() {
		selectAllKelas = !selectAllKelas;
		if (selectAllKelas) {
			for (const k of filteredKelasList) {
				kelasIds.add(k.id);
			}
		} else {
			kelasIds.clear();
		}
		kelasIds = new Set(kelasIds);
	}

	function close() {
		initialized = false;
		open = false;
		dispatch('cancel');
	}

	function toggleKelas(id: number) {
		if (kelasIds.has(id)) {
			kelasIds.delete(id);
		} else {
			kelasIds.add(id);
		}
		kelasIds = new Set(kelasIds);
	}

	async function save() {
		if (saving) return;
		if (password.trim()) {
			const passwordError = validatePasswordStrength(password.trim());
			if (passwordError) {
				toast({ message: passwordError, type: 'error' });
				return;
			}
		}
		saving = true;
		const form = new FormData();
		form.set('username', username || '');
		form.set('password', password || '');
		form.set('nama', nama || '');
		form.set('dapodikPtkId', dapodikPtkId.trim());
		form.set('type', type || 'user');
		form.set('sekolahId', String(sekolahId ?? ''));

		if (type === 'user') {
			// Multi-mapel & multi-kelas terstruktur
			form.set('assignments', JSON.stringify(assignments));
			const allKelasIds = Array.from(new Set(assignments.flatMap((a) => a.kelasIds)));
			form.set('kelasIds', JSON.stringify(allKelasIds));
		} else {
			form.set('mataPelajaranIds', JSON.stringify(Array.from(mataPelajaranIds)));
			form.set('kelasIds', JSON.stringify(Array.from(kelasIds)));
		}

		const endpoint = isEditMode ? '?/update_user' : '?/create_user';
		if (isEditMode) form.set('id', String(editUser!.id));

		try {
			const res = await fetch(endpoint, { method: 'POST', body: form });
			if (res.ok) {
				const body = await res.json().catch(() => ({}));
				const allKelasIds =
					type === 'user'
						? Array.from(new Set(assignments.flatMap((a) => a.kelasIds)))
						: Array.from(kelasIds);

				const mergedBody = {
					...body,
					username: body.user?.username ?? username,
					displayName: body.displayName ?? nama,
					dapodikPtkId: body.dapodikPtkId ?? (dapodikPtkId.trim() || null),
					assignments: type === 'user' ? assignments : undefined,
					mataPelajaranIds: body.mataPelajaranIds ?? Array.from(mataPelajaranIds),
					kelasIds: body.kelasIds ?? allKelasIds,
					user: body.user ?? {
						id: isEditMode ? editUser!.id : Date.now(),
						username: body.user?.username ?? username,
						createdAt: isEditMode ? undefined : new Date().toISOString(),
						type: body.user?.type ?? type,
						passwordUpdatedAt: body.user?.passwordUpdatedAt ?? new Date().toISOString()
					},
					__server_user_returned: Boolean(body.user && typeof body.user.id !== 'undefined')
				};
				toast({
					message: isEditMode ? 'Pengguna diperbarui' : 'Pengguna dibuat',
					type: 'success'
				});
				dispatch('saved', { body: mergedBody });
				open = false;
			} else {
				let msg = isEditMode ? 'Gagal memperbarui pengguna' : 'Gagal membuat pengguna';
				try {
					const parsed = await res.json().catch(() => null);
					if (parsed) {
						const flat = parsed as Record<string, unknown>;
						const data = (flat.data ?? flat) as Record<string, unknown>;
						if (typeof data.message === 'string' && data.message.trim()) msg = data.message;
						else if (
							flat.error &&
							typeof (flat.error as Record<string, unknown>).message === 'string'
						)
							msg = (flat.error as Record<string, unknown>).message as string;
						else msg = JSON.stringify(parsed);
					} else {
						msg = await res.text().catch(() => msg);
					}
				} catch {
					msg = (await res.text().catch(() => msg)) as string;
				}
				toast({
					message: `${isEditMode ? 'Gagal memperbarui' : 'Gagal membuat'}: ${msg}`,
					type: 'error'
				});
			}
		} catch {
			toast({
				message: isEditMode ? 'Gagal memperbarui pengguna' : 'Gagal membuat pengguna',
				type: 'error'
			});
		} finally {
			saving = false;
		}
	}
</script>

{#if open}
	<div class="modal modal-open">
		<div
			class={`modal-box flex max-h-[90vh] flex-col p-4 sm:p-6 ${type === 'user' ? 'max-w-2xl' : 'max-w-lg'}`}
		>
			<h3 class="mb-3 text-lg font-bold">{modalTitle}</h3>
			<div class="flex-1 space-y-4 overflow-y-auto px-1">
				<!-- Sekolah -->
				<fieldset class="fieldset">
					<legend class="fieldset-legend">Sekolah</legend>
					<select
						id="add-user-sekolah"
						class="select dark:bg-base-200 w-full truncate dark:border-none"
						bind:value={sekolahId}
						onchange={() => {
							kelasIds.clear();
							selectAllKelas = false;
						}}
					>
						<option disabled selected={sekolahId === ''} value="">Pilih Sekolah</option>
						{#if sekolahList && sekolahList.length}
							{#each sekolahList as s (s.id)}
								<option value={s.id}>{s.nama}</option>
							{/each}
						{:else}
							<option disabled>- tidak ada sekolah -</option>
						{/if}
					</select>
					<p class="label text-wrap">
						Opsional: kaitkan pengguna ke sekolah tertentu sehingga saat login sekolah aktif bisa
						disesuaikan.
					</p>
				</fieldset>

				<!-- Nama -->
				<fieldset class="fieldset">
					<legend class="fieldset-legend">Nama Lengkap</legend>
					<input
						id="add-user-nama"
						required
						class="input dark:bg-base-200 w-full dark:border-none"
						bind:value={nama}
						placeholder="Contoh: Bruce Wayne, Bat."
					/>
					<p class="label text-wrap">Nama lengkap pengguna dan gelar (tampil pada daftar)</p>
				</fieldset>

				<!-- PTK ID Dapodik -->
				<fieldset class="fieldset">
					<legend class="fieldset-legend">PTK ID (Dapodik)</legend>
					<input
						id="add-user-ptk-id"
						type="text"
						class="input dark:bg-base-200 w-full dark:border-none font-mono text-sm"
						bind:value={dapodikPtkId}
						placeholder="Contoh: 1faad84c-f1a5-404d-849b-4e8bf0a7ab82"
					/>
					<p class="label text-wrap">
						Opsional: UUID PTK dari Dapodik untuk pencocokan otomatis akun saat login via SSO
						ZITADEL.
					</p>
				</fieldset>

				<!-- Role -->
				<fieldset class="fieldset">
					<legend class="fieldset-legend">Peran (Role)</legend>
					<select
						id="add-user-role"
						class="select dark:bg-base-200 w-full dark:border-none font-semibold"
						bind:value={type}
						onchange={() => {
							if (type === 'wali_kelas') selectAllMapelAndKelas();
						}}
					>
						<option value="user">Guru (Pendidik)</option>
						<option value="wali_kelas">Wali Kelas</option>
						<option value="wali_asuh">Wali Asuh</option>
						<option value="kepala_sekolah">Kepala Sekolah</option>
						<option value="admin">Admin</option>
					</select>
					<p class="label text-wrap">Tentukan peran pengguna dalam sistem</p>
				</fieldset>

				<!-- Akun Login -->
				<fieldset class="fieldset">
					<legend class="fieldset-legend">Akun Masuk</legend>
					<div class="flex flex-col gap-2 sm:flex-row">
						<label class="input validator dark:bg-base-200 w-full dark:border-none">
							<Icon name="user" />
							<input
								id="add-user-username"
								type="text"
								required
								placeholder="Nama pengguna"
								title="Hanya huruf, angka, atau tanda hubung"
								bind:value={username}
							/>
						</label>
						<label class="input validator dark:bg-base-200 w-full dark:border-none">
							<Icon name="lock" />
							<input
								id="add-user-password"
								type={showPassword ? 'text' : 'password'}
								placeholder={isEditMode
									? 'Kata sandi baru (kosongkan jika tidak diubah)'
									: 'Kata sandi'}
								bind:value={password}
							/>
							<button
								type="button"
								class="cursor-pointer"
								onclick={() => (showPassword = !showPassword)}
								aria-label="Lihat atau sembunyikan kata sandi"
							>
								<Icon name={showPassword ? 'eye-off' : 'eye'} />
							</button>
						</label>
					</div>
					<p class="validator-hint hidden">Isi nama pengguna dan kata sandi dulu!</p>
					<p class="label">
						{isEditMode
							? 'Nama pengguna wajib diisi. Kata sandi opsional (kosongkan jika tidak diubah).'
							: 'Nama pengguna dan kata sandi untuk masuk'}
					</p>
				</fieldset>

				<!-- KHUSUS GURU: Editor Penugasan Multi-Mapel & Multi-Kelas -->
				{#if type === 'user'}
					<div class="pt-2 border-t border-slate-200 dark:border-slate-800">
						<MultiMapelAssignmentEditor
							bind:assignments
							availableMapel={filteredMataPelajaran}
							availableKelas={filteredKelasList}
						/>
					</div>
				{:else if type === 'wali_kelas'}
					<!-- Kelas untuk Wali Kelas -->
					<div
						tabindex="0"
						role="button"
						class="bg-base-200 border-base-300 collapse-arrow collapse"
					>
						<div class="collapse-title font-semibold">
							Kelas yang Diampu {#if kelasIds.size > 0}
								<span class="badge badge-sm badge-secondary">{kelasIds.size}</span>
							{/if}
						</div>
						<div class="collapse-content text-sm">
							<div class="space-y-3">
								<p class="text-xs opacity-75">Pilih kelas yang diampu oleh Wali Kelas ini</p>
								{#if filteredKelasList.length > 0}
									<div class="space-y-2">
										<label class="bg-base-300 flex cursor-pointer gap-2 rounded p-2 font-semibold">
											<input
												type="checkbox"
												class="checkbox checkbox-sm"
												checked={selectAllKelas}
												onchange={toggleSelectAllKelas}
											/>
											<span class="text-sm">Pilih Semua</span>
										</label>
										{#each filteredKelasList as k (k.id)}
											<label class="flex cursor-pointer gap-2">
												<input
													type="checkbox"
													class="checkbox checkbox-sm"
													checked={kelasIds.has(k.id)}
													onchange={() => toggleKelas(k.id)}
												/>
												<span class="text-sm"
													>{k.nama}
													{#if k.fase}({k.fase}){/if}</span
												>
											</label>
										{/each}
									</div>
								{:else}
									<p class="text-xs opacity-75">- tidak ada kelas -</p>
								{/if}
							</div>
						</div>
					</div>
				{/if}
			</div>

			<div
				class="modal-action sticky bottom-0 z-10 pt-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900"
			>
				<button
					class="btn btn-soft shadow-none mr-auto"
					type="button"
					onclick={close}
					disabled={saving}><Icon name="close" /> Batal</button
				>
				<button
					class="btn btn-primary shadow-none"
					type="button"
					onclick={save}
					disabled={!isValid || saving}
					><Icon name="save" /> {saving ? 'Menyimpan...' : 'Simpan'}</button
				>
			</div>
		</div>
	</div>
{/if}
