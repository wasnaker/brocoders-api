import { Session } from '../../../session/domain/session';
import { Role } from '../../../roles/domain/role';
import { User } from '../../../users/domain/user';

/**
 * Hanya `role.id` yang disimpan di JWT — BUKAN objek role lengkap.
 *
 * Role + permissions utuh akan membengkakkan token melewati batas ukuran
 * cookie browser (~4096 byte) begitu jumlah permission modul bertambah,
 * sehingga cookie `auth-token-data` ditolak browser secara diam-diam dan
 * semua halaman admin memantul ke sign-in. Guard memakai `role.id`
 * (RolesGuard) dan permission validasi modul selalu membaca DB, jadi
 * menyimpan id saja cukup.
 */
export type JwtPayloadType = Pick<User, 'id'> & {
  role: Pick<Role, 'id'>;
  sessionId: Session['id'];
  iat: number;
  exp: number;
};
