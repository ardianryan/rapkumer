<script lang="ts">
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';

	let {
		variant,
		title,
		description,
		idPrefix,
		data
	}: {
		variant: 'sekolah' | 'pribadi';
		title: string;
		description: string;
		idPrefix: string;
		data: {
			keySet: boolean;
			maskedKey: string | null;
			envKeyPresent: boolean;
			model: string;
			baseUrl: string;
		};
	} = $props();

	// svelte-ignore state_referenced_locally
	const isPersonal = variant === 'pribadi';
	const saveAction = isPersonal ? '?/save-my-ai-key' : '?/save-gemini-key';
	const clearAction = isPersonal ? '?/clear-my-ai-key' : '?/clear-gemini-key';

	// Password visibility toggle
	let showKey = $state(false);
	let clearingKey = $state(false);
	// svelte-ignore state_referenced_locally
	let aiModel = $state(data.model);
	// svelte-ignore state_referenced_locally
	let aiBaseUrl = $state(data.baseUrl);
</script>

<section
	id="ai-key"
	class="card bg-base-100 rounded-lg border border-none p-6 shadow-md scroll-mt-20"
>
	<FormEnhance
		action={saveAction}
		onsuccess={({ form }) => {
			form.reset();
		}}
	>
		{#snippet children({ submitting, invalid })}
			<header class="mb-4 space-y-2">
				<h2 class="text-xl font-semibold">{title}</h2>
				<p class="text-base-content/70 text-sm">
					{description}
				</p>
				{#if data.keySet}
					<div class="alert alert-success">
						<Icon name="success" />
						<span>Kunci API {isPersonal ? 'pribadi ' : ''}aktif: {data.maskedKey}</span>
					</div>
				{:else if isPersonal}
					<div class="alert alert-warning alert-soft">
						<Icon name="warning" />
						<span
							>Belum ada kunci API pribadi. Kunci sekolah tidak bisa dipakai untuk fitur "Generate".
							Setel kunci Anda di bawah.</span
						>
					</div>
				{:else if data.envKeyPresent}
					<div class="alert alert-info alert-soft">
						<Icon name="info" />
						<span
							>Kunci API aktif dari variabel lingkungan <code>GEMINI_API_KEY</code> (file .env). Kunci
							di atas tidak dapat diubah dari halaman ini.</span
						>
					</div>
				{:else}
					<div class="alert alert-warning alert-soft">
						<Icon name="warning" />
						<span>Belum ada kunci API. Fitur "Generate" belum dapat digunakan.</span>
					</div>
				{/if}
			</header>

			<!-- Bantuan Link Cepat Gemini API Key -->
			<div
				class="mb-5 rounded-2xl border border-primary/25 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 sm:p-5"
			>
				<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
					<div class="space-y-1">
						<div class="flex items-center gap-2 font-bold text-sm text-primary">
							<Icon name="sparkles" />
							<span>Panduan Dapatkan Gemini API Key Gratis</span>
						</div>
						<p class="text-xs text-base-content/80 leading-relaxed">
							Google menyediakan kuota Gemini AI gratis tanpa kartu kredit untuk guru dan sekolah.
							Buka Google AI Studio, klik <strong>Create API Key</strong>, lalu salin kuncinya ke
							formulir di bawah.
						</p>
					</div>
					<a
						href="https://aistudio.google.com/api-keys"
						target="_blank"
						rel="noreferrer noopener"
						class="btn btn-sm btn-primary shadow-sm gap-2 shrink-0 self-stretch sm:self-auto"
					>
						<Icon name="sparkles" />
						<span>Buka Google AI Studio</span>
						<Icon name="right" />
					</a>
				</div>
			</div>

			<fieldset class="fieldset">
				<div class="flex items-center justify-between">
					<legend class="fieldset-legend mb-0">Kunci API</legend>
					<a
						href="https://aistudio.google.com/api-keys"
						target="_blank"
						rel="noreferrer noopener"
						class="link link-primary text-xs flex items-center gap-1 font-medium hover:underline"
					>
						<span>Dapatkan di aistudio.google.com/api-keys</span>
						<Icon name="right" />
					</a>
				</div>
				<div class="form-control">
					<label class="input bg-base-200 dark:bg-base-300 validator w-full dark:border-none">
						<span class="pl-2"><Icon name="key" /></span>
						<input
							type={showKey ? 'text' : 'password'}
							id="{idPrefix}ApiKey"
							name="apiKey"
							required
							minlength={10}
							placeholder="AIzaSy… / sk-… / ds-…"
							autocomplete="off"
						/>
						<button
							type="button"
							class="cursor-pointer pr-2"
							onclick={() => (showKey = !showKey)}
							aria-label="Lihat atau sembunyikan kunci API"
						>
							<Icon name={showKey ? 'eye-off' : 'eye'} />
						</button>
					</label>
					<p class="text-base-content/70 mt-1 text-xs">
						Kunci API Gemini biasanya diawali dengan <code>AIzaSy...</code>. Masukkan kunci baru untuk menyimpan.
					</p>
				</div>
			</fieldset>

			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<fieldset class="fieldset">
					<legend class="fieldset-legend">Model</legend>
					<input
						class="input bg-base-200 dark:bg-base-300 w-full dark:border-none"
						type="text"
						name="model"
						bind:value={aiModel}
						placeholder={isPersonal ? 'ikut setelan sekolah' : 'gemini-3.6-flash'}
						list="{idPrefix}-model-list"
					/>
					<datalist id="{idPrefix}-model-list">
						<option value="gemini-3.6-flash"></option>
						<option value="gemini-3.1-pro"></option>
						<option value="gemini-3.7-flash"></option>
						<option value="claude-opus-4.8"></option>
						<option value="claude-opus-5"></option>
						<option value="claude-sonnet-5"></option>
						<option value="gpt-5.6-sol"></option>
						<option value="gpt-5.6-terra"></option>
						<option value="deepseek-v4-flash"></option>
						<option value="deepseek-v4-pro"></option>
						<option value="glm-5.2"></option>
						<option value="glm-5.3"></option>
						<option value="kimi-k3"></option>
						<option value="qwen3.8-max"></option>
					</datalist>
					<p class="text-base-content/70 mt-1 text-xs">
						{isPersonal
							? 'Kosongkan untuk mengikuti model setelan sekolah.'
							: 'Nama model sesuai penyedia API yang digunakan.'}
					</p>
				</fieldset>

				<fieldset class="fieldset">
					<legend class="fieldset-legend">Base URL</legend>
					<input
						class="input bg-base-200 dark:bg-base-300 w-full dark:border-none"
						type="text"
						name="baseUrl"
						bind:value={aiBaseUrl}
						placeholder={isPersonal
							? 'ikut setelan sekolah'
							: 'contoh: https://generativelanguage.googleapis.com'}
						autocomplete="off"
						required={!isPersonal}
					/>
					<p class="text-base-content/70 mt-1 text-xs">
						{#if isPersonal}
							Kosongkan untuk mengikuti base URL sekolah.
						{:else}
							Endpoint API lengkap termasuk <code>/v1</code> jika diperlukan.
						{/if}
					</p>
				</fieldset>
			</div>

			<div class="mt-6 flex items-center gap-2">
				{#if data.keySet}
					<button
						class="btn btn-soft btn-error shadow-none"
						type="submit"
						form="{idPrefix}-key-clear"
						disabled={clearingKey}
					>
						<Icon name="del" />
						{clearingKey ? 'Menghapus…' : 'Hapus Kunci'}
					</button>
				{/if}

				<button
					class="btn btn-primary shadow-none ml-auto"
					type="submit"
					disabled={submitting || invalid}
				>
					<Icon name="save" />
					{submitting ? 'Menyimpan…' : 'Simpan'}
				</button>
			</div>
		{/snippet}
	</FormEnhance>

	{#if data.keySet}
		<FormEnhance
			id="{idPrefix}-key-clear"
			action={clearAction}
			submitStateChange={(s) => (clearingKey = s)}
		>
			{#snippet children({ submitting })}
				<button type="submit" class="hidden" disabled={submitting}>Hapus</button>
			{/snippet}
		</FormEnhance>
	{/if}
</section>
