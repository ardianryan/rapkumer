import fs from 'node:fs/promises';
import path from 'node:path';
import { error } from '@sveltejs/kit';
import db from '$lib/server/db/index.js';
import { tableMurid } from '$lib/server/db/schema.js';
import { uploadsDir } from '$lib/server/data-dirs';
import { eq } from 'drizzle-orm';
import {
	isR2Configured,
	buildR2Key,
	uploadBufferToR2,
	deleteFromR2,
	isPublicUrl
} from '$lib/server/storage-r2';

function contentTypeFor(filename: string) {
	if (filename.endsWith('.png')) return 'image/png';
	if (filename.endsWith('.webp')) return 'image/webp';
	return 'image/jpeg';
}

function slugifyName(name: string) {
	if (!name) return 'murid';
	const cleaned = name
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^\p{L}\p{N}\s-]/gu, '')
		.trim()
		.replace(/\s+/g, '-')
		.toLowerCase();
	return cleaned.substring(0, 80) || 'murid';
}

async function generateUniqueFilename(
	dbInstance: typeof db,
	base: string,
	ext: string,
	dir: string
) {
	let filename = `${base}${ext}`;
	let counter = 1;
	let exists: boolean;

	do {
		try {
			await fs.access(path.join(dir, filename));
			exists = true;
			filename = `${base}-${counter}${ext}`;
			counter++;
		} catch {
			exists = false;
		}
	} while (exists && counter < 1000);

	return filename;
}

export async function GET({ params }: { params: Record<string, string> }) {
	const id = +params.id;
	if (!id) throw error(400, 'Invalid id');

	const murid = await db.query.tableMurid.findFirst({
		where: eq(tableMurid.id, id),
		columns: { foto: true }
	});
	if (!murid || !murid.foto) throw error(404, 'Not found');

	// If photo is stored as a public R2 URL, redirect directly to CDN
	if (isPublicUrl(murid.foto)) {
		return new Response(null, {
			status: 302,
			headers: { Location: murid.foto }
		});
	}

	const dir = uploadsDir();
	const filePath = path.join(dir, murid.foto);
	try {
		const data = await fs.readFile(filePath);
		return new Response(Buffer.from(data), {
			headers: { 'Content-Type': contentTypeFor(murid.foto) }
		});
	} catch {
		throw error(404, 'Not found');
	}
}

export async function DELETE({
	params,
	locals
}: {
	params: Record<string, string>;
	locals: App.Locals;
}) {
	const id = +params.id;
	if (!id) return new Response(JSON.stringify({ message: 'Invalid id' }), { status: 400 });

	const murid = await db.query.tableMurid.findFirst({
		where: eq(tableMurid.id, id),
		columns: { foto: true, sekolahId: true }
	});
	if (!murid) return new Response(JSON.stringify({ message: 'Not found' }), { status: 404 });

	// ensure sekolah ownership
	const sekolahId = locals.sekolah?.id;
	if (!sekolahId || murid.sekolahId !== sekolahId)
		return new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 });

	if (murid.foto) {
		if (isPublicUrl(murid.foto)) {
			await deleteFromR2(murid.foto);
		} else {
			const dir = uploadsDir();
			try {
				await fs.unlink(path.join(dir, murid.foto));
			} catch {
				// ignore
			}
		}
		await db.update(tableMurid).set({ foto: null }).where(eq(tableMurid.id, id));
	}
	return new Response(JSON.stringify({ message: 'OK' }), {
		headers: { 'Content-Type': 'application/json' }
	});
}

export async function POST({
	params,
	request,
	locals
}: {
	params: Record<string, string>;
	request: Request;
	locals: App.Locals;
}) {
	const id = +params.id;
	if (!id) return new Response(JSON.stringify({ message: 'Invalid id' }), { status: 400 });

	const murid = await db.query.tableMurid.findFirst({
		where: eq(tableMurid.id, id),
		columns: { id: true, nama: true, foto: true, sekolahId: true }
	});
	if (!murid) return new Response(JSON.stringify({ message: 'Murid not found' }), { status: 404 });

	// ensure sekolah ownership
	const sekolahId = locals.sekolah?.id;
	if (!sekolahId || murid.sekolahId !== sekolahId)
		return new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 });

	const formData = await request.formData();
	const uploadedFile = formData.get('foto') as File | null;

	if (!uploadedFile || uploadedFile.size === 0) {
		return new Response(JSON.stringify({ message: 'No file provided' }), { status: 400 });
	}

	const allowed = ['image/png', 'image/jpeg', 'image/webp'];
	if (!allowed.includes(uploadedFile.type)) {
		return new Response(
			JSON.stringify({ message: 'Format file tidak didukung; hanya JPG, PNG, dan WebP yang diizinkan' }),
			{ status: 400 }
		);
	}

	if (uploadedFile.size > 5 * 1024 * 1024) {
		return new Response(
			JSON.stringify({ message: 'Ukuran file foto tidak boleh lebih dari 5MB' }),
			{ status: 400 }
		);
	}

	try {
		const buffer = Buffer.from(await uploadedFile.arrayBuffer());
		const ext = uploadedFile.type === 'image/png' ? '.png' : uploadedFile.type === 'image/webp' ? '.webp' : '.jpg';
		const base = slugifyName(murid.nama || `murid-${murid.id}`);

		let finalFotoRef: string;

		if (isR2Configured()) {
			const filename = `${base}_${Date.now()}${ext}`;
			const key = buildR2Key('murid', filename);
			const { publicUrl } = await uploadBufferToR2(key, buffer, uploadedFile.type);
			finalFotoRef = publicUrl;

			// Delete old photo if exists
			if (murid.foto) {
				if (isPublicUrl(murid.foto)) {
					await deleteFromR2(murid.foto);
				} else {
					try {
						await fs.unlink(path.join(uploadsDir(), murid.foto));
					} catch {
						// ignore
					}
				}
			}
		} else {
			const dir = uploadsDir();
			await fs.mkdir(dir, { recursive: true });

			const filename = await generateUniqueFilename(db, base, ext, dir);
			const filePath = path.join(dir, filename);

			// Remove old file if exists and different
			if (murid.foto && murid.foto !== filename) {
				if (isPublicUrl(murid.foto)) {
					await deleteFromR2(murid.foto);
				} else {
					try {
						await fs.unlink(path.join(dir, murid.foto));
					} catch {
						// ignore
					}
				}
			}

			await fs.writeFile(filePath, buffer, { mode: 0o644 });
			finalFotoRef = filename;
		}

		await db.update(tableMurid).set({ foto: finalFotoRef }).where(eq(tableMurid.id, id));

		return new Response(JSON.stringify({ foto: finalFotoRef, message: 'Foto berhasil diperbarui' }), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (err) {
		console.error('Upload error:', err);
		return new Response(JSON.stringify({ message: 'Gagal upload foto' }), { status: 500 });
	}
}
