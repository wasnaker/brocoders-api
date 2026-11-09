import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PermissionEntity } from '../permissions/infrastructure/persistence/relational/entities/permission.entity';
import { RoleEntity } from '../roles/infrastructure/persistence/relational/entities/role.entity';
import { ModuleAuthorizationService } from './module-authorization.service';
import { ModulePermissionSeedService } from './module-permission-seed.service';
import { HookRegistryService } from './hook-registry.service';
import { ModuleRoleAssignmentEntity } from './module-role-assignment.entity';
import { ModuleOutboxEntity } from './module-outbox.entity';
import { ModuleLifecycleEntity } from './module-lifecycle.entity';
import { ModuleLifecycleService } from './module-lifecycle.service';
import { CoreModuleServiceContracts } from './core-module-service.contracts';
import { ModuleLifecycleBootstrap } from './module-lifecycle.bootstrap';
import { EntityLifecycleService } from './entity-lifecycle.service';
import { ModuleOutboxPublisherService } from './module-outbox-publisher.service';
import {
  MODULE_SERVICE_REGISTRY,
  ModuleServiceRegistry,
} from './module-service.registry';

@Module({
  imports: [
    UsersModule,
    TypeOrmModule.forFeature([
      PermissionEntity,
      RoleEntity,
      ModuleRoleAssignmentEntity,
      ModuleOutboxEntity,
      ModuleLifecycleEntity,
    ]),
  ],
  providers: [
    ModuleAuthorizationService,
    ModulePermissionSeedService,
    HookRegistryService,
    EntityLifecycleService,
    ModuleOutboxPublisherService,
    ModuleLifecycleService,
    CoreModuleServiceContracts,
    ModuleLifecycleBootstrap,
    ModuleServiceRegistry,
    { provide: MODULE_SERVICE_REGISTRY, useExisting: ModuleServiceRegistry },
  ],
  exports: [
    ModuleAuthorizationService,
    ModulePermissionSeedService,
    HookRegistryService,
    EntityLifecycleService,
    ModuleOutboxPublisherService,
    ModuleLifecycleService,
    ModuleServiceRegistry,
    MODULE_SERVICE_REGISTRY,
  ],
})
/** Shared runtime registries are exported for module-owned adapters and lifecycle. */
export class ModuleRuntimeModule {}
