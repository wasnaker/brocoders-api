import { Module } from '@nestjs/common';

import { ModulesService } from './modules.service';
import { ModulesController } from './modules.controller';

/**
 * ModulesModule tidak punya entity sendiri dan tidak punya tabel di database.
 * Ia hanya membaca konfigurasi statis dari `src/config/modules.config.ts`.
 * Karena itu TIDAK ada `TypeOrmModule.forFeature` di sini.
 */
@Module({
  imports: [],
  controllers: [ModulesController],
  providers: [ModulesService],
})
export class ModulesModule {}
