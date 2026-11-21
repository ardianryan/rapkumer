#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const statePath = path.join(projectRoot, '.upstream-sync.json');

const HIGH_CONFLICT_FILES = new Set([
	'package.json',
	'src/hooks.server.ts',
	'src/lib/server/db/index.ts',
	'src/lib/server/db/schema.ts',
	'src/lib/components/menu.ts',
	'src/lib/components/menu-access.ts',
	'src/lib/components/mobile-dock.svelte',
	'src/routes/+layout.svelte',
	'src/routes/+layout.server.ts',
	'src/routes/api/database/import/+server.ts',
	'src/routes/cetak/rapor/preview-data.ts',
	'src/routes/(informasi-umum)/murid/form/[[id]]/+page.server.ts',
	'src/routes/(input-nilai)/asesmen-sumatif/formulir-asesmen/+page.server.ts'
]);

const SKIP_ONLY_PREFIXES = [
	'installer/',
	'scripts/prepare-windows.mjs',
	'scripts/prod-signed.mjs',
	'scripts/prod-unsigned.mjs',
	'scripts/bundle-gtk-dlls.mjs',
	'scripts/sync-to-installer.mjs',
	'src/routes/api/database/import/+server.ts'
];

function git(args) {
	return execFileSync('git', args, {
		cwd: projectRoot,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe']
	}).trim();
}

function loadState() {
	if (!fs.existsSync(statePath)) {
		return {
			upstreamRemote: 'upstream',
			upstreamBranch: 'main',
			lastSyncedTag: 'v2.1.9',
			lastSyncedCommit: 'fe81069',
			cherryPickedCommits: [],
			skippedCommits: []
		};
	}
	return JSON.parse(fs.readFileSync(statePath, 'utf8'));
}

function saveState(state) {
	fs.writeFileSync(statePath, `${JSON.stringify(state, null, '\t')}\n`, 'utf8');
}

function parseArgs(argv) {
	const opts = {
		noFetch: false,
		fromRef: null,
		markPicked: null,
		markSkipped: null,
		reason: '',
		setBaseline: null
	};
	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		if (arg === '--no-fetch') opts.noFetch = true;
		else if (arg === '--from' && argv[i + 1]) opts.fromRef = argv[++i];
		else if (arg === '--mark-picked' && argv[i + 1]) opts.markPicked = argv[++i];
		else if (arg === '--mark-skipped' && argv[i + 1]) opts.markSkipped = argv[++i];
		else if (arg === '--reason' && argv[i + 1]) opts.reason = argv[++i];
		else if (arg === '--set-baseline' && argv[i + 1]) opts.setBaseline = argv[++i];
	}
	return opts;
}

function resolveShortSha(ref) {
	return git(['rev-parse', '--short', ref]);
}

function isSkipOnlyFile(file) {
	return SKIP_ONLY_PREFIXES.some((prefix) => file === prefix || file.startsWith(prefix));
}

function isVersionBumpCommit(subject, files) {
	const isBumpMsg = /^(chore:\s*update version|update version|\d+\.\d+\.\d+)$/i.test(
		subject.trim()
	);
	if (!isBumpMsg) return false;
	return files.every((f) => f === 'package.json' || f === 'installer/rapkumer.iss');
}

function classifyCommit(sha, subject) {
	const filesOutput = git(['diff-tree', '--no-commit-id', '--name-only', '-r', sha]);
	const files = filesOutput ? filesOutput.split('\n').filter(Boolean) : [];
	const conflicts = files.filter((f) => HIGH_CONFLICT_FILES.has(f));

	const needsPgSync = files.some(
		(f) => f === 'src/lib/server/db/schema.ts' || f.startsWith('src/lib/server/db/ensure-')
	);
	let hasSqliteSyntax = false;
	if (needsPgSync || files.some((f) => f.startsWith('src/lib/server/db/'))) {
		const patch = git(['show', '--format=', sha]);
		hasSqliteSyntax = /\bPRAGMA\b|\bAUTOINCREMENT\b/i.test(patch);
	}

	const allSkipOnly =
		files.length > 0 && (files.every(isSkipOnlyFile) || isVersionBumpCommit(subject, files));

	const isPriority =
		!allSkipOnly &&
		(/\b(fix|feat|security|auth|csrf|dapodik|rapor|cetak|pdf|absen)\b/i.test(subject) ||
			files.some((f) => f.startsWith('src/')));

	const labels = [];
	if (allSkipOnly) labels.push('SKIP_KANDIDAT');
	else if (isPriority) labels.push('PRIORITAS');
	else labels.push('OPSIONAL');

	if (conflicts.length > 0) labels.push('REVIEW_KONFLIK');
	if (needsPgSync || hasSqliteSyntax) labels.push('CEK_POSTGRES');

	return { files, conflicts, labels, allSkipOnly, needsPgSync, hasSqliteSyntax };
}

function handleMutations(opts, state) {
	if (opts.markPicked) {
		const shortSha = resolveShortSha(opts.markPicked);
		if (!state.cherryPickedCommits.includes(shortSha)) {
			state.cherryPickedCommits.push(shortSha);
			saveState(state);
			console.info(`[upstream:check] Ditandai cherry-picked: ${shortSha}`);
		} else {
			console.info(`[upstream:check] Commit ${shortSha} sudah tercatat di cherryPickedCommits.`);
		}
		return true;
	}

	if (opts.markSkipped) {
		const shortSha = resolveShortSha(opts.markSkipped);
		const exists = state.skippedCommits.some((entry) => entry.sha === shortSha);
		if (!exists) {
			state.skippedCommits.push({
				sha: shortSha,
				reason: opts.reason || 'Sengaja dilewati (installer/SQLite-only/tidak relevan)'
			});
			saveState(state);
			console.info(`[upstream:check] Ditandai skipped: ${shortSha}`);
		} else {
			console.info(`[upstream:check] Commit ${shortSha} sudah tercatat di skippedCommits.`);
		}
		return true;
	}

	if (opts.setBaseline) {
		const shortSha = resolveShortSha(opts.setBaseline);
		state.lastSyncedTag = opts.setBaseline;
		state.lastSyncedCommit = shortSha;
		saveState(state);
		console.info(`[upstream:check] Baseline diperbarui ke ${opts.setBaseline} (${shortSha}).`);
		return true;
	}

	return false;
}

function main() {
	const opts = parseArgs(process.argv.slice(2));
	const state = loadState();

	if (handleMutations(opts, state)) {
		return;
	}

	const remoteRef = `${state.upstreamRemote}/${state.upstreamBranch}`;
	if (!opts.noFetch) {
		console.info(`[upstream:check] Mengambil pembaruan dari ${state.upstreamRemote}...`);
		git(['fetch', state.upstreamRemote]);
	}

	const baseline = opts.fromRef || state.lastSyncedCommit;
	const logOutput = git([
		'log',
		'--no-merges',
		'--reverse',
		'--format=%h\t%s',
		`${baseline}..${remoteRef}`
	]);

	if (!logOutput) {
		console.info(
			`[upstream:check] Tidak ada commit baru di ${remoteRef} sejak ${baseline} (${state.lastSyncedTag}).`
		);
		return;
	}

	const pickedSet = new Set(state.cherryPickedCommits);
	const skippedSet = new Set(state.skippedCommits.map((item) => item.sha));
	const entries = logOutput
		.split('\n')
		.filter(Boolean)
		.map((line) => {
			const [sha, ...rest] = line.split('\t');
			return { sha, subject: rest.join('\t') };
		})
		.filter((item) => !pickedSet.has(item.sha) && !skippedSet.has(item.sha));

	if (entries.length === 0) {
		console.info(
			`[upstream:check] Seluruh commit baru sejak ${baseline} sudah diproses (picked/skipped).`
		);
		return;
	}

	console.info(`\nDitemukan ${entries.length} commit upstream baru (${baseline}..${remoteRef}):\n`);

	const suggestedPicks = [];
	for (const entry of entries) {
		const info = classifyCommit(entry.sha, entry.subject);
		console.info(`- ${entry.sha} | ${entry.subject}`);
		console.info(`  Tag   : [${info.labels.join(', ')}]`);
		if (info.conflicts.length > 0) {
			console.info(`  Konflik: ${info.conflicts.join(', ')}`);
		}
		if (info.needsPgSync || info.hasSqliteSyntax) {
			console.info(
				'  PG    : Jalankan `pnpm db:pg:sync` & cek `sql-translate.ts` jika ada PRAGMA/DDL baru'
			);
		}
		if (!info.allSkipOnly) {
			suggestedPicks.push(entry.sha);
		}
	}

	if (suggestedPicks.length > 0) {
		console.info('\nRekomendasi perintah di branch staging:');
		console.info(`  git checkout -b sync/upstream-next zitadel`);
		console.info(`  git cherry-pick -x ${suggestedPicks.join(' ')}`);
	}
}

main();
