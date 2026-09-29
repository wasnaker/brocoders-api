import { Module } from '@nestjs/common';

import { StatsService } from './stats.service';
import { StatsController } from './stats.controller';
import { UsersModule } from '../users/users.module';
import { RolesModule } from '../roles/roles.module';

/**
 * StatsModule tidak punya entity sendiri. Ia hanya menjumlahkan data yang
 * sudah dimiliki modul lain, jadi cukup meng-import dua module itu:
 *  - UsersModule  -> UserRepository (abstrak; relational ATAU document,
 *                    tergantung konfigurasi database, jadi boilerplate
 *                    tetap jalan di kedua mode)
 *  - RolesModule  -> RolesService.findAll() untuk jumlah role
 */
@Module({
  imports: [UsersModule, RolesModule],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
