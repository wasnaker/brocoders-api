import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PermissionEntity } from '../permissions/infrastructure/persistence/relational/entities/permission.entity';
import { RoleEntity } from '../roles/infrastructure/persistence/relational/entities/role.entity';
import { ModuleAuthorizationService } from './module-authorization.service';
import { ModulePermissionSeedService } from './module-permission-seed.service';
import { HookRegistryService } from './hook-registry.service';
import { ModuleRoleAssignmentEntity } from './module-role-assignment.entity';
import { ModuleOutboxEntity } from './module-outbox.entity';
import { EntityLifecycleService } from './entity-lifecycle.service';
import { ModuleOutboxPublisherService } from './module-outbox-publisher.service';
import { MODULE_SERVICE_REGISTRY, ModuleServiceRegistry } from './module-service.registry';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PermissionEntity,
      RoleEntity,
      ModuleRoleAssignmentEntity,
      ModuleOutboxEntity,
    ]),
  ],
  providers: [
    ModuleAuthorizationService,
    ModulePermissionSeedService,
    HookRegistryService,
    EntityLifecycleService,
    ModuleOutboxPublisherService,
    ModuleServiceRegistry,
    { provide: MODULE_SERVICE_REGISTRY, useExisting: ModuleServiceRegistry },
  ],
  exports: [
    ModuleAuthorizationService,
    ModulePermissionSeedService,
    HookRegistryService,
    EntityLifecycleService,
    ModuleOutboxPublisherService,
    ModuleServiceRegistry,
    MODULE_SERVICE_REGISTRY,
  ],
})
/** Shared runtime registries are exported for module-owned adapters and lifecycle. */
export class ModuleRuntimeModule {}
