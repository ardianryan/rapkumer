<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { dev } from '$app/environment';
	import SekolahOverviewCard from '$lib/components/dashboard/sekolah-overview-card.svelte';
	import RombelMuridStats from '$lib/components/dashboard/rombel-murid-stats.svelte';
	import MapelEkstrakurikulerStats from '$lib/components/dashboard/mapel-ekstrakurikuler-stats.svelte';
	import ProgressCard from '$lib/components/dashboard/progress-card.svelte';
	import QuickActionsCard from '$lib/components/dashboard/quick-actions-card.svelte';
	import FavoriteMenusCard from '$lib/components/dashboard/favorite-menus-card.svelte';
	import { computeNextEventMessage } from '$lib/utils/next-event-message';
	import BellStatus from '$lib/components/jadwal-bell/bell-status.svelte';
	import Icon from '$lib/components/icon.svelte';
	import { showModal } from '$lib/components/global-modal.svelte';
	import PresensiGuruModal from '$lib/components/presensi-guru/presensi-guru-modal.svelte';
	import { getHariSekolahList, isSchoolDay } from '$lib/hari-sekolah';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	const sekolah = (data.sekolah ?? null) as Sekolah | null;
	const statistikDashboard = $derived(
		data.statistikDashboard ?? {
			rombel: { total: 0, perFase: [] },
			murid: { total: 0 },
			mapel: { total: 0, wajib: 0, mulok: 0, kokurikuler: 0, lainnya: 0 },
			ekstrakurikuler: { total: 0 },
			progress: {
				akademik: { percentage: 0, completed: 0, total: 0 },
				ekstrakurikuler: { percentage: 0, completed: 0, total: 0 },
				kokurikuler: { percentage: 0, completed: 0, total: 0 }
			}
		}
	);
	const mapelStats = $derived(
		statistikDashboard.mapel ?? { total: 0, wajib: 0, mulok: 0, kokurikuler: 0, lainnya: 0 }
	);
	const progressStats = $derived(
		statistikDashboard.progress ?? {
			akademik: { percentage: 0, completed: 0, total: 0 },
			ekstrakurikuler: { percentage: 0, completed: 0, total: 0 },
			kokurikuler: { percentage: 0, completed: 0, total: 0 }
		}
	);
	const ekstrakurikulerStats = $derived(statistikDashboard.ekstrakurikuler ?? { total: 0 });
	const bellActive = $derived(data.bellActive ?? false);
	const hariSekolah = $derived((data.hariSekolah as number) ?? 6);
	const hariSekolahCustom = $derived((data.hariSekolahCustom as string | null) ?? null);
	const liburNasional = $derived((data.liburNasional as string[]) ?? []);
	const liburSemester = $derived(
		(data.liburSemester as Array<{ start: string; end: string }>) ?? []
	);

	const bellSettings = $derived(
		(data.bellSettings as {
			jamMulai: string;
			jamPelajaranMenit: number;
			durasiIstirahat: number;
			durasiUpacara: number;
		} | null) ?? null
	);
	const kegiatanCustom = $derived(
		(data.kegiatanCustom as Array<{ kode: string; nama: string; durasi: number | null }>) ?? []
	);
	const jadwalPelajaran = $derived(
		(data.jadwalPelajaran as Array<{
			hari: string;
			jamKe: number;
			kelasId: number;
			kodeKegiatan: string;
		}>) ?? []
	);
	const daftarKodeMapel = $derived((data.daftarKodeMapel as string[]) ?? []);
	const daftarKelas = $derived((data.daftarKelas as Array<{ id: number; nama: string }>) ?? []);

	const hariList = $derived(getHariSekolahList(hariSekolah, hariSekolahCustom));

	const hariNamaList = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

	const hariIndexMap: Record<number, string> = {
		0: 'minggu',
		1: 'senin',
		2: 'selasa',
		3: 'rabu',
		4: 'kamis',
		5: 'jumat',
		6: 'sabtu'
	};

	function toDateStr(date: Date): string {
		const y = date.getFullYear();
		const m = String(date.getMonth() + 1).padStart(2, '0');
		const d = String(date.getDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	}

	function isHoliday(date: Date): boolean {
		if (
			!isSchoolDay(
				hariSekolah,
				hariSekolahCustom,
				date.getFullYear(),
				date.getMonth() + 1,
				date.getDate()
			)
		)
			return true;
		const dateStr = toDateStr(date);
		if (liburNasional.includes(dateStr)) return true;
		for (const range of liburSemester) {
			if (dateStr >= range.start && dateStr <= range.end) return true;
		}
		return false;
	}

	function timeToMinutes(t: string): number {
		const [h, m] = t.split(':').map(Number);
		return h * 60 + m;
	}

	function minutesToTime(m: number): string {
		const h = Math.floor(m / 60);
		const min = m % 60;
		return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
	}

	function getDurasiKode(kode: string, defaultDur: number): number {
		if (kode === 'UPB') return bellSettings?.durasiUpacara ?? 70;
		if (kode === 'IST') return bellSettings?.durasiIstirahat ?? 30;
		const custom = kegiatanCustom.find((k) => k.kode === kode);
		if (custom?.durasi != null) return custom.durasi;
		return defaultDur;
	}

	const kelasTerurut = $derived(
		[...daftarKelas].sort((a, b) => {
			const aNum = parseInt(a.nama.replace(/\D/g, '')) || 0;
			const bNum = parseInt(b.nama.replace(/\D/g, '')) || 0;
			return aNum - bNum;
		})
	);

	const jadwalMatrix = $derived.by(() => {
		const matrix: Record<string, Record<number, Record<number, string>>> = {};
		for (const entry of jadwalPelajaran) {
			if (!matrix[entry.hari]) matrix[entry.hari] = {};
			if (!matrix[entry.hari][entry.jamKe]) matrix[entry.hari][entry.jamKe] = {};
			matrix[entry.hari][entry.jamKe][entry.kelasId] = entry.kodeKegiatan;
		}
		return matrix;
	});

	function isAllSame(hari: string, jamKe: number): string | null {
		const codes = kelasTerurut.map((k) => jadwalMatrix[hari]?.[jamKe]?.[k.id] ?? '');
		const unique = [...new Set(codes.filter(Boolean))];
		if (unique.length === 1) return unique[0];
		return null;
	}

	function isFirstSubjectPeriod(hari: string, jamKe: number): boolean {
		for (let j = 1; j < jamKe; j++) {
			const codes = kelasTerurut.map((k) => jadwalMatrix[hari]?.[j]?.[k.id] ?? '');
			for (const c of codes) {
				if (c && daftarKodeMapel.includes(c)) return false;
			}
		}
		return true;
	}

	function computeWaktu(hari: string, jamKe: number): { start: string; end: string } | null {
		const jamMulai = bellSettings?.jamMulai ?? '07:00';
		const jamPelajaranMenit = bellSettings?.jamPelajaranMenit ?? 35;
		const jamMulaiMinutes = timeToMinutes(jamMulai);
		const daySchedule = jadwalMatrix[hari] ?? {};

		let currentMinutes = jamMulaiMinutes;
		for (let prevJamKe = 1; prevJamKe < jamKe; prevJamKe++) {
			const prevCodes = kelasTerurut.map((k) => daySchedule[prevJamKe]?.[k.id] ?? '');
			const uniquePrev = [...new Set(prevCodes.filter(Boolean))];
			let dur = jamPelajaranMenit;
			if (uniquePrev.length === 1) {
				dur = getDurasiKode(uniquePrev[0], dur);
			}
			currentMinutes += dur;
		}

		const codes = kelasTerurut.map((k) => daySchedule[jamKe]?.[k.id] ?? '');
		const unique = [...new Set(codes.filter(Boolean))];
		let dur = jamPelajaranMenit;
		if (unique.length === 1) {
			dur = getDurasiKode(unique[0], dur);
		}

		return { start: minutesToTime(currentMinutes), end: minutesToTime(currentMinutes + dur) };
	}

	const maxJam = $derived.by(() => {
		let max = 0;
		for (const hari of hariList) {
			const daySchedule = jadwalMatrix[hari];
			if (daySchedule) {
				const periods = Object.keys(daySchedule).map(Number);
				if (periods.length > 0) {
					max = Math.max(max, ...periods);
				}
			}
		}
		return max;
	});

	let _now = $state(new Date());
	$effect(() => {
		const id = setInterval(() => (_now = new Date()), 60_000);
		return () => clearInterval(id);
	});

	const nextEventMessage = $derived.by(() => {
		return computeNextEventMessage({
			now: _now,
			bellActive,
			isHoliday,
			hariList,
			getTodayHari: (dayIdx) => hariIndexMap[dayIdx],
			maxJam,
			getFirstKode: (hari, jamKe) => {
				let kode = isAllSame(hari, jamKe);
				if (!kode) {
					const daySchedule = jadwalMatrix[hari]?.[jamKe];
					if (daySchedule) {
						for (const kelas of kelasTerurut) {
							const c = daySchedule[kelas.id];
							if (c) return c;
						}
					}
				}
				return kode;
			},
			computeWaktu,
			daftarKodeMapel,
			isFirstSubjectPeriod,
			kegiatanCustom
		});
	});

	const hariIni = $derived.by(() => {
		const status = isHoliday(_now) ? 'Libur' : 'Hari Belajar';
		const hariNama = hariNamaList[_now.getDay()];
		const tgl = _now.toLocaleDateString('id-ID', {
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
		return `${hariNama}, ${tgl} - ${status}`;
	});

	// Fallback reminder: warn on the dashboard when the auto-prompt "Presensi Guru"
	// modal was shown but the teacher still hasn't done presensi (e.g. force-closed
	// via Escape, or the page was reloaded while the modal was open).
	let presensiWarningVisible = $state(false);

	const SIMULASI_STORAGE_KEY = 'rapkumer-simulasi-tanggal-jam';

	function presensiApiUrl() {
		const override =
			page.url.searchParams.get('tanggal-jam') ??
			(dev ? sessionStorage.getItem(SIMULASI_STORAGE_KEY) : null);
		return {
			override,
			url: `/api/presensi-guru${override ? `?tanggal-jam=${encodeURIComponent(override)}` : ''}`
		};
	}

	function checkPresensiFallback() {
		if (presensiWarningVisible || !data.user) return;
		if (document.querySelector('dialog.modal[open]')) return;
		const userId = data.user.id;
		const { override, url } = presensiApiUrl();
		fetch(url)
			.then((res) => (res.ok ? res.json() : null))
			.then((status) => {
				if (!status?.shouldPrompt) return;
				// Match the layout's effective date so the fallback only fires once the
				// auto-prompt has actually been triggered (works with ?tanggal-jam simulation).
				const today = new Date().toISOString().slice(0, 10);
				const simulatedDate = override ? override.slice(0, 10) : null;
				const effectiveDate =
					simulatedDate && /^\d{4}-\d{2}-\d{2}$/.test(simulatedDate) ? simulatedDate : today;
				const promptKey = `rapkumer-presensi-guru-prompted-${userId}-${effectiveDate}`;
				if (!sessionStorage.getItem(promptKey)) return;
				presensiWarningVisible = true;
			})
			.catch(() => {});
	}

	async function openPresensiGuruModal() {
		if (!data.user) return;
		const { override, url } = presensiApiUrl();
		let jamMasuk: string | null = null;
		let jamPulang: string | null = null;
		try {
			const res = await fetch(url);
			const status = await res.json().catch(() => null);
			jamMasuk = status?.jamMasuk ?? null;
			jamPulang = status?.jamPulang ?? null;
		} catch {
			// fall through with unknown jam window
		}
		presensiWarningVisible = false;
		showModal({
			title: 'Presensi Guru',
			body: PresensiGuruModal,
			bodyProps: {
				jamMasuk,
				jamPulang,
				tanggalJam: override
			},
			dismissible: false
		});
	}

	const greeting = $derived.by(() => {
		const hour = _now.getHours();
		if (hour < 11) return 'Selamat Pagi';
		if (hour < 15) return 'Selamat Siang';
		if (hour < 18) return 'Selamat Sore';
		return 'Selamat Malam';
	});

	const userName = $derived(
		(data.user as { pegawaiName?: string; namaLengkap?: string; username?: string } | null)
			?.pegawaiName ||
			(data.user as { pegawaiName?: string; namaLengkap?: string; username?: string } | null)
				?.namaLengkap ||
			data.user?.username ||
			'Bapak/Ibu Guru'
	);

	onMount(() => {
		checkPresensiFallback();
		// Re-check whenever a dialog closes (catches the teacher force-closing the modal).
		const onDialogClose = () => checkPresensiFallback();
		document.addEventListener('close', onDialogClose, true);
		return () => document.removeEventListener('close', onDialogClose, true);
	});
</script>

<!-- Hero Banner Selamat Datang -->
<div
	class="card-clean mb-4 flex flex-col items-start justify-between gap-4 border border-slate-200/80 bg-gradient-to-r from-white via-slate-50 to-blue-50/40 p-5 sm:flex-row sm:items-center sm:p-6 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800"
>
	<div class="space-y-1">
		<div class="flex items-center gap-2">
			<span class="badge badge-sm badge-soft badge-primary font-semibold text-[11px]">
				SMA Negeri 1 Gedeg
			</span>
			<span class="text-base-content/60 text-xs font-medium">
				{hariIni}
			</span>
		</div>
		<h1
			class="font-display text-slate-800 text-xl font-extrabold tracking-tight sm:text-2xl dark:text-slate-100"
		>
			{greeting}, {userName}!
		</h1>
		<p class="text-base-content/70 text-xs sm:text-sm">
			Selamat datang di portal administrasi guru dan penilaian rapor terpadu.
		</p>
	</div>
	{#if bellActive && nextEventMessage}
		<div
			class="flex shrink-0 items-center gap-2.5 rounded-xl border border-blue-200/60 bg-blue-50 px-3.5 py-2 dark:border-blue-800/60 dark:bg-blue-950/40"
		>
			<Icon name="calendar" class="text-primary h-4 w-4 shrink-0" />
			<div class="text-xs">
				<p class="text-primary font-bold">Jadwal & Bel Sekolah</p>
				<p class="text-primary/80 font-mono text-[11px]">{nextEventMessage}</p>
			</div>
		</div>
	{/if}
</div>

{#if (!bellActive || !nextEventMessage) && nextEventMessage}
	<BellStatus {bellActive} {hariIni} {nextEventMessage} class="alert alert-info alert-soft mb-4" />
{/if}

{#if presensiWarningVisible}
	<div class="alert alert-warning alert-soft mb-4 flex items-center gap-3">
		<Icon name="warning" class="h-5 w-5 shrink-0" />
		<span>
			Bapak/Ibu belum melakukan presensi guru hari ini. Silakan lakukan presensi melalui tombol
			berikut:
		</span>
		<button
			class="btn btn-primary btn-sm ml-auto shrink-0 shadow-none"
			type="button"
			title="Presensi Sekarang"
			onclick={openPresensiGuruModal}
		>
			<Icon name="pen" />
			<span class="hidden sm:inline">Presensi Sekarang</span>
		</button>
	</div>
{/if}

<!-- Kontainer Utama Grid -->
<div class="grid w-full grid-cols-1 gap-4 md:grid-cols-2">
	<!-- Kolom 1: Data Utama & Statistik -->
	<div class="flex flex-col gap-4">
		<SekolahOverviewCard {sekolah} />
		<FavoriteMenusCard favorites={data.favorites ?? []} />
		<RombelMuridStats rombel={statistikDashboard.rombel} murid={statistikDashboard.murid} />
		<MapelEkstrakurikulerStats mapel={mapelStats} ekstrakurikuler={ekstrakurikulerStats} />
	</div>

	<!-- Kolom 2: Progress & Aksi -->
	<div class="flex flex-col gap-4">
		<ProgressCard progress={progressStats} />
		<QuickActionsCard />
	</div>
</div>

<!-- Footer Dashboard -->
<footer
	class="mt-8 pt-4 border-t border-slate-200/70 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-base-content/60 pb-4"
>
	<p>
		{sekolah?.nama ?? 'SMA Negeri 1 Gedeg'} • Portal Administrasi Guru & Penilaian Rapor
	</p>
	<p>
		Powered by
		<a
			href="https://github.com/sira313/rapkumer"
			target="_blank"
			rel="noreferrer noopener"
			class="font-semibold text-primary hover:underline"
		>
			Rapkumer
		</a>
	</p>
</footer>
