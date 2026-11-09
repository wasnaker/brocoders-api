import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PermissionEntity } from '../permissions/infrastructure/persistence/relational/entities/permission.entity';
import { RoleEntity } from '../roles/infrastructure/persistence/relational/entities/role.entity';
import { ModuleAuthorizationService } from './module-authorization.service';
import { ModulePermissionSeedService } from './module-permission-seed.service';
import { HookRegistryService } from './hook-registry.service';
import { ModuleRoleAssignmentEntity } from './module-role-assignment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PermissionEntity,
      RoleEntity,
      ModuleRoleAssignmentEntity,
    ]),
  ],
  providers: [
    ModuleAuthorizationService,
    ModulePermissionSeedService,
    HookRegistryService,
  ],
  exports: [
    ModuleAuthorizationService,
    ModulePermissionSeedService,
    HookRegistryService,
  ],
})
export class ModuleRuntimeModule {}
