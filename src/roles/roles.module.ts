import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoleEntity } from './infrastructure/persistence/relational/entities/role.entity';
import { PermissionEntity } from '../permissions/infrastructure/persistence/relational/entities/permission.entity';
import { RolePermissionGrantEntity } from '../module-runtime/role-permission-grant.entity';
import { AuthorizationAuditLogEntity } from '../module-runtime/authorization-audit-log.entity';
import { RolePermissionOverrideEntity } from '../module-runtime/role-permission-override.entity';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';

@Module({
  imports: [TypeOrmModule.forFeature([
    RoleEntity,
    PermissionEntity,
    RolePermissionGrantEntity,
    AuthorizationAuditLogEntity,
    RolePermissionOverrideEntity,
  ])],
  providers: [RolesService],
  controllers: [RolesController],
  exports: [RolesService],
})
export class RolesModule {}
