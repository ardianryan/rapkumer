import { json } from '@sveltejs/kit';

export type EraporAdminAuth =
	| {
			error: Response;
			user?: undefined;
			sekolah?: undefined;
	  }
	| {
			error?: undefined;
			user: NonNullable<App.Locals['user']>;
			sekolah: NonNullable<App.Locals['sekolah']>;
	  };

export function requireEraporAdmin(locals: App.Locals): EraporAdminAuth {
	const user = locals.user;
	if (!user) {
		return { error: json({ error: 'Tidak terotentikasi.' }, { status: 401 }) };
	}
	if (user.type !== 'admin' && user.type !== 'kepala_sekolah') {
		return {
			error: json(
				{
					error:
						'Akses ditolak. Hanya Admin atau Kepala Sekolah yang dapat mengakses Integrasi e-Rapor.'
				},
				{ status: 403 }
			)
		};
	}
	const sekolah = locals.sekolah;
	if (!sekolah?.id) {
		return { error: json({ error: 'Sekolah aktif tidak ditemukan.' }, { status: 400 }) };
	}
	return { user, sekolah };
}
