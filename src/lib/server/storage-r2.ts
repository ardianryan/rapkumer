import {
	S3Client,
	PutObjectCommand,
	DeleteObjectCommand,
	GetObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env as dynamicEnv } from '$env/dynamic/private';

export interface R2Config {
	accessKeyId: string;
	secretAccessKey: string;
	endpoint: string;
	bucketName: string;
	folderPath: string;
	publicUrl: string;
	region: string;
	usePathStyleEndpoint: boolean;
}

function getEnv(key: string, fallback = ''): string {
	return dynamicEnv[key] || process.env[key] || fallback;
}

export function getR2Config(): R2Config {
	return {
		accessKeyId: getEnv('R2_ACCESS_KEY_ID'),
		secretAccessKey: getEnv('R2_SECRET_ACCESS_KEY'),
		endpoint: getEnv('R2_ENDPOINT'),
		bucketName: getEnv('R2_BUCKET_NAME'),
		folderPath: getEnv('R2_FOLDER_PATH'),
		publicUrl: getEnv('R2_PUBLIC_URL'),
		region: getEnv('R2_REGION', 'auto'),
		usePathStyleEndpoint: getEnv('R2_USE_PATH_STYLE_ENDPOINT', 'true') === 'true'
	};
}

export function isR2Configured(): boolean {
	const cfg = getR2Config();
	return Boolean(cfg.accessKeyId && cfg.secretAccessKey && cfg.endpoint && cfg.bucketName);
}

let cachedClient: S3Client | null = null;
let clientConfigKey = '';

export function getR2Client(): S3Client {
	const cfg = getR2Config();
	const key = `${cfg.accessKeyId}:${cfg.endpoint}:${cfg.region}:${cfg.usePathStyleEndpoint}`;

	if (!cachedClient || clientConfigKey !== key) {
		cachedClient = new S3Client({
			region: cfg.region || 'auto',
			endpoint: cfg.endpoint,
			credentials: {
				accessKeyId: cfg.accessKeyId,
				secretAccessKey: cfg.secretAccessKey
			},
			forcePathStyle: cfg.usePathStyleEndpoint
		});
		clientConfigKey = key;
	}

	return cachedClient;
}

/**
 * Builds a standardized R2 storage key incorporating optional folderPath.
 * e.g. folder="murid", filename="123_foto.jpg", folderPath="akademiksmage" -> "akademiksmage/murid/123_foto.jpg"
 */
export function buildR2Key(folder: string, filename: string): string {
	const cfg = getR2Config();
	const baseFolder = (cfg.folderPath || '').trim().replace(/^\/+|\/+$/g, '');
	const subFolder = folder.trim().replace(/^\/+|\/+$/g, '');
	const cleanName = filename.trim().replace(/^\/+/g, '');

	const parts = [baseFolder, subFolder, cleanName].filter(Boolean);
	return parts.join('/');
}

/**
 * Resolves the full public CDN URL for a given storage key.
 * e.g. "akademiksmage/murid/123.jpg" -> "https://static-r2-apac.ppti.me/akademiksmage/murid/123.jpg"
 */
export function getR2PublicUrl(key: string): string {
	const cfg = getR2Config();
	const publicDomain = (cfg.publicUrl || '').trim().replace(/\/+$/, '');
	const cleanKey = key.trim().replace(/^\/+/, '');
	if (!publicDomain) return `/${cleanKey}`;
	return `${publicDomain}/${cleanKey}`;
}

/**
 * Checks whether a given string is already an R2 public URL or external HTTP URL.
 */
export function isPublicUrl(url: string | null | undefined): boolean {
	if (!url) return false;
	return url.startsWith('http://') || url.startsWith('https://');
}

/**
 * Extracts the storage key from an R2 public URL, or returns the string if it's already a key.
 */
export function extractR2Key(urlOrKey: string): string {
	const cfg = getR2Config();
	const publicDomain = (cfg.publicUrl || '').trim().replace(/\/+$/, '');
	if (publicDomain && urlOrKey.startsWith(publicDomain)) {
		return urlOrKey.slice(publicDomain.length).replace(/^\/+/, '');
	}
	try {
		const parsed = new URL(urlOrKey);
		return parsed.pathname.replace(/^\/+/, '');
	} catch {
		return urlOrKey.replace(/^\/+/, '');
	}
}

/**
 * Generates a presigned PUT URL allowing clients to upload directly to R2.
 */
export async function createPresignedUploadUrl(
	key: string,
	contentType: string,
	expiresIn = 3600
): Promise<{ presignedUrl: string; publicUrl: string; key: string }> {
	const cfg = getR2Config();
	const client = getR2Client();

	const command = new PutObjectCommand({
		Bucket: cfg.bucketName,
		Key: key,
		ContentType: contentType
	});

	const presignedUrl = await getSignedUrl(client, command, { expiresIn });
	const publicUrl = getR2PublicUrl(key);

	return {
		presignedUrl,
		publicUrl,
		key
	};
}

/**
 * Uploads a Buffer/Uint8Array directly to R2 from the server.
 */
export async function uploadBufferToR2(
	key: string,
	buffer: Buffer | Uint8Array,
	contentType: string
): Promise<{ key: string; publicUrl: string }> {
	const cfg = getR2Config();
	const client = getR2Client();

	await client.send(
		new PutObjectCommand({
			Bucket: cfg.bucketName,
			Key: key,
			Body: buffer,
			ContentType: contentType
		})
	);

	return {
		key,
		publicUrl: getR2PublicUrl(key)
	};
}

/**
 * Deletes an object from R2 by key or public URL.
 */
export async function deleteFromR2(urlOrKey: string): Promise<boolean> {
	if (!isR2Configured() || !urlOrKey) return false;
	const cfg = getR2Config();
	const client = getR2Client();
	const key = extractR2Key(urlOrKey);

	try {
		await client.send(
			new DeleteObjectCommand({
				Bucket: cfg.bucketName,
				Key: key
			})
		);
		return true;
	} catch (err) {
		console.error('[R2 Storage] Gagal menghapus file dari R2:', err);
		return false;
	}
}

/**
 * Fetches an object from R2 as Buffer (useful for PDF generation / fallback).
 */
export async function fetchR2Buffer(urlOrKey: string): Promise<Buffer | null> {
	if (!isR2Configured() || !urlOrKey) return null;
	const cfg = getR2Config();
	const client = getR2Client();
	const key = extractR2Key(urlOrKey);

	try {
		const res = await client.send(
			new GetObjectCommand({
				Bucket: cfg.bucketName,
				Key: key
			})
		);
		if (!res.Body) return null;
		const bytes = await res.Body.transformToByteArray();
		return Buffer.from(bytes);
	} catch (err) {
		console.error('[R2 Storage] Gagal membaca file dari R2:', err);
		return null;
	}
}
