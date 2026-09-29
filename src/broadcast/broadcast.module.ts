import { Module } from '@nestjs/common';

import { BroadcastService } from './broadcast.service';
import { BroadcastController } from './broadcast.controller';
import { SettingsModule } from '../settings/settings.module';

/**
 * Module baru, bukan reuse `SettingsController`, karena `GET /v1/settings`
 * di-guard `@Roles(RoleEnum.admin)` sementara broadcast harus terbaca semua
 * user terautentikasi. `SettingsService` sudah di-`exports` di
 * `settings.module.ts`, jadi cukup meng-import module itu — `TypeOrmModule`
 * ikut terbawa lewat import chain.
 */
@Module({
  imports: [SettingsModule],
  controllers: [BroadcastController],
  providers: [BroadcastService],
})
export class BroadcastModule {}
