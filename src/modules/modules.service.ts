import { Injectable } from '@nestjs/common';

import {
  MODULES,
  ModuleConfig,
  findModuleById,
} from '../config/modules.config';
import { ModuleDto } from './dto/module.dto';

/**
 * Service read-only untuk daftar modul.
 *
 * Sumber data adalah konfigurasi statis (`src/config/modules.config.ts`),
 * BUKAN database dan BUKAN filesystem. Tidak ada pemindaian folder saat
 * runtime — daftar modul ditentukan saat build dan tidak berubah sampai
 * deploy berikutnya.
 */
@Injectable()
export class ModulesService {
  /**
   * Kembalikan seluruh daftar modul.
   */
  findAll(): ModuleDto[] {
    return MODULES.map((m) => ({ ...m }));
  }

  /**
   * Cari satu modul berdasarkan ID.
   * Mengembalikan `null` kalau tidak ditemukan (bukan exception) supaya
   * controller bisa membalas 200 dengan body null sesuai kontrak endpoint.
   */
  findOne(id: string): ModuleDto | null {
    const module: ModuleConfig | undefined = findModuleById(id);
    return module ? { ...module } : null;
  }
}
