import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PermissionEntity } from './infrastructure/persistence/relational/entities/permission.entity';
import { PermissionsService } from './permissions.service';
import { PermissionsController } from './permissions.controller';
import { PermissionsRelationalRepository } from './infrastructure/persistence/relational/repositories/permission.repository';
import { PermissionRepository } from './infrastructure/persistence/permission.repository';

@Module({
  imports: [TypeOrmModule.forFeature([PermissionEntity])],
  providers: [
    PermissionsService,
    {
      provide: PermissionRepository,
      useClass: PermissionsRelationalRepository,
    },
  ],
  controllers: [PermissionsController],
  exports: [PermissionsService],
})
export class PermissionsModule {}
