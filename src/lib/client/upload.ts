/**
 * Helper to upload a file directly to Cloudflare R2 / S3 using a Presigned URL.
 * Bypasses the application server for fast, direct CDN upload.
 */
export async function uploadWithPresignedUrl(
	file: File,
	folder = 'uploads'
): Promise<{ success: boolean; url?: string; key?: string; error?: string; enabled?: boolean }> {
	try {
		// 1. Ask the server for a presigned PUT URL
		const presignRes = await fetch('/api/upload/presign', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				filename: file.name,
				contentType: file.type || 'application/octet-stream',
				folder
			})
		});

		if (!presignRes.ok) {
			const err = await presignRes.json().catch(() => ({ message: 'Gagal menghubungi server' }));
			return { success: false, error: err.message };
		}

		const data = await presignRes.json();
		if (!data.enabled || !data.presignedUrl) {
			return { success: false, enabled: false };
		}

		// 2. Upload file directly to R2 using HTTP PUT
		const uploadRes = await fetch(data.presignedUrl, {
			method: 'PUT',
			headers: {
				'Content-Type': file.type || 'application/octet-stream'
			},
			body: file
		});

		if (!uploadRes.ok) {
			return {
				success: false,
				error: `Gagal mengunggah file ke cloud storage (HTTP ${uploadRes.status})`
			};
		}

		return {
			success: true,
			enabled: true,
			url: data.publicUrl,
			key: data.key
		};
	} catch (err) {
		console.error('[uploadWithPresignedUrl]', err);
		return {
			success: false,
			error: err instanceof Error ? err.message : 'Terjadi kesalahan saat mengunggah file'
		};
	}
}
