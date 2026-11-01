/**
 * Daftar modul statis yang terdaftar di aplikasi.
 *
 * Sumber kebenaran: `brocoders-react-web/src/modules/core/manifests/index.ts`
 * File ini HARUS dijaga sinkron dengan file manifest di frontend. Setiap kali
 * modul ditambah/dihapus di frontend, perbarui array `MODULES` di sini.
 *
 * BUKAN plugin loader — tidak ada pemindaian filesystem, tidak ada enable/disable
 * runtime, tidak ada upload/install. Hanya konfigurasi statis yang dibaca
 * endpoint `/api/v1/modules`.
 */

export interface ModuleConfig {
  /** ID unik modul (kebab-case), dipakai sebagai parameter route `:id` */
  id: string;
  /** Nama tampilan modul */
  name: string;
  /**
   * Versi modul (semver).
   *
   * CATATAN: field ini TIDAK berasal dari manifest frontend — tipe
   * `ModuleManifest` di `brocoders-react-web/src/core/modules/types.ts` hanya
   * punya `alias`, `profileTabs`, `settingsTabs`, `dashboardWidgets`. Semua
   * modul sekarang bernilai '1.0.0'; kalau nanti modul punya versi sendiri,
   * sumbernya harus ditambahkan ke manifest, bukan diubah manual di sini.
   */
  version: string;
  /** Alias asli dari manifest frontend (referensi) */
  alias: string;
  /** Deskripsi singkat fungsi modul */
  description: string;
}

/**
 * Daftar modul yang benar-benar ada di frontend.
 * Diambil dari `brocoders-react-web/src/modules/core/manifests/index.ts`:
 * - coreSettings   -> alias: "core-settings"  (tab: general, appearance, language, roles)
 * - coreProfile    -> alias: "core-profile"   (tab: account, security)
 * - coreDashboard  -> alias: "core-dashboard" (widget: 3 KPI, recent-users, permissions, quick-links)
 * - post           -> alias: "post"           (tab: post-activity)
 *
 * `description` ditulis dari isi tab/widget yang benar-benar ada di manifest,
 * bukan dari klaim marketing. Kalau sebuah modul tidak punya manifest lagi,
 * hapus dari sini — jangan tambahkan placeholder.
 */
export const MODULES: readonly ModuleConfig[] = [
  {
    id: 'core-settings',
    name: 'Core Settings',
    version: '1.0.0',
    alias: 'core-settings', // manifest: coreSettings
    description:
      'Core module for application settings (general, appearance, language, roles)',
  },
  {
    id: 'core-profile',
    name: 'Core Profile',
    version: '1.0.0',
    alias: 'core-profile', // manifest: coreProfile
    description: 'Core module for user profile (account, security)',
  },
  {
    id: 'core-dashboard',
    name: 'Core Dashboard',
    version: '1.0.0',
    alias: 'core-dashboard', // manifest: coreDashboard
    description:
      'Core module for dashboard widgets (KPI, recent users, permissions, quick links)',
  },
  {
    id: 'post',
    name: 'Post',
    version: '1.0.0',
    alias: 'post', // manifest: post
    description: 'Post module with profile activity tab',
  },
  {
    id: 'region',
    name: 'Region',
    version: '1.0.0',
    alias: 'region', // manifest: region (bc-region, modul eksternal pertama)
    description:
      'Region reference data module — provinces and regencies (kabupaten/kota) admin-panel page',
  },
];

/**
 * Mencari modul berdasarkan ID.
 * Mengembalikan `undefined` kalau tidak ditemukan.
 */
export function findModuleById(id: string): ModuleConfig | undefined {
  return MODULES.find((m) => m.id === id);
}
