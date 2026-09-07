import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isR2Configured, buildR2Key, createPresignedUploadUrl } from '$lib/server/storage-r2';

const ALLOWED_CONTENT_TYPES = [
	'image/jpeg',
	'image/png',
	'image/webp',
	'image/svg+xml',
	'application/pdf',
	'audio/mpeg',
	'audio/mp3',
	'audio/wav'
];

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		throw error(401, { message: 'Harus login terlebih dahulu' });
	}

	if (!isR2Configured()) {
		return json({
			enabled: false,
			message: 'R2 storage belum dikonfigurasi'
		});
	}

	let body: { filename?: string; contentType?: string; folder?: string };
	try {
		body = await request.json();
	} catch {
		throw error(400, { message: 'Format request tidak valid (JSON required)' });
	}

	const { filename, contentType, folder = 'uploads' } = body;
	if (!filename || typeof filename !== 'string') {
		throw error(400, { message: 'Parameter filename wajib diisi' });
	}
	if (!contentType || typeof contentType !== 'string') {
		throw error(400, { message: 'Parameter contentType wajib diisi' });
	}

	const normalizedType = contentType.toLowerCase().split(';')[0].trim();
	if (!ALLOWED_CONTENT_TYPES.includes(normalizedType)) {
		throw error(400, { message: `Tipe file '${normalizedType}' tidak didukung` });
	}

	// Sanitize folder & filename
	const safeFolder = folder.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 30) || 'uploads';
	const baseName = filename
		.replace(/[^a-zA-Z0-9._-]/g, '_')
		.replace(/_+/g, '_')
		.slice(0, 80);
	const uniqueFilename = `${locals.user.id}_${Date.now()}_${baseName}`;
	const key = buildR2Key(safeFolder, uniqueFilename);

	try {
		const presign = await createPresignedUploadUrl(key, normalizedType, 3600);
		return json({
			enabled: true,
			presignedUrl: presign.presignedUrl,
			publicUrl: presign.publicUrl,
			key: presign.key
		});
	} catch (err) {
		console.error('[Presign API Error]:', err);
		throw error(500, { message: 'Gagal membuat presigned upload URL' });
	}
};
