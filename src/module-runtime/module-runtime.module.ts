import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PermissionEntity } from '../permissions/infrastructure/persistence/relational/entities/permission.entity';
import { ModulePermissionSeedService } from './module-permission-seed.service';

@Module({
  imports: [TypeOrmModule.forFeature([PermissionEntity])],
  providers: [ModulePermissionSeedService],
  exports: [ModulePermissionSeedService],
})
export class ModuleRuntimeModule {}
