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
import { RolePermissionGrantEntity } from './role-permission-grant.entity';
import { RolePermissionOverrideEntity } from './role-permission-override.entity';
import { ModuleAuthorizationSyncEntity } from './module-authorization-sync.entity';
import { AuthorizationAuditLogEntity } from './authorization-audit-log.entity';
import { ModuleAuthorizationReconciliationService } from './module-authorization-reconciliation.service';
import { CoreAuthorizationRegistryService } from './core-authorization-registry.service';
import { ModuleAuthorizationAdminController } from './module-authorization-admin.controller';
import { RolesGuard } from '../roles/roles.guard';
import {
  MODULE_LIFECYCLE_SERVICE,
  ModuleLifecycleService,
} from './module-lifecycle.service';
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
      RolePermissionGrantEntity,
      RolePermissionOverrideEntity,
      ModuleAuthorizationSyncEntity,
      AuthorizationAuditLogEntity,
    ]),
  ],
  controllers: [ModuleAuthorizationAdminController],
  providers: [
    ModuleAuthorizationService,
    ModuleAuthorizationReconciliationService,
    CoreAuthorizationRegistryService,
    RolesGuard,
    ModulePermissionSeedService,
    HookRegistryService,
    EntityLifecycleService,
    ModuleOutboxPublisherService,
    ModuleLifecycleService,
    { provide: MODULE_LIFECYCLE_SERVICE, useExisting: ModuleLifecycleService },
    CoreModuleServiceContracts,
    ModuleLifecycleBootstrap,
    ModuleServiceRegistry,
    { provide: MODULE_SERVICE_REGISTRY, useExisting: ModuleServiceRegistry },
  ],
  exports: [
    ModulePermissionSeedService,
    HookRegistryService,
    EntityLifecycleService,
    ModuleOutboxPublisherService,
    ModuleLifecycleService,
    MODULE_LIFECYCLE_SERVICE,
    ModuleServiceRegistry,
    MODULE_SERVICE_REGISTRY,
  ],
})
/** Shared runtime registries are exported for module-owned adapters and lifecycle. */
export class ModuleRuntimeModule {}
