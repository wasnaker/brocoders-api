import { Injectable, Logger } from '@nestjs/common';
import { DataSource, IsNull } from 'typeorm';
import { PermissionEntity } from '../../../../permissions/infrastructure/persistence/relational/entities/permission.entity';
import { RoleEntity } from '../../../../roles/infrastructure/persistence/relational/entities/role.entity';
import { RolePermissionGrantEntity } from '../../../../module-runtime/role-permission-grant.entity';
import { AuthorizationAuditLogEntity } from '../../../../module-runtime/authorization-audit-log.entity';
import { rebuildRolePermissionProjection } from '../../../../module-runtime/role-permission-projection';

const CORE_ADMIN_GRANT_SOURCE = 'core.admin-role-all-permissions';

@Injectable()
export class RolePermissionSeedService {
  private readonly logger = new Logger(RolePermissionSeedService.name);

  constructor(private readonly dataSource: DataSource) {}

  async assignAllToAdmin(): Promise<void> {
    let restoredCount = 0;
    await this.dataSource.transaction(async (manager) => {
      const roles = manager.getRepository(RoleEntity);
      const permissions = manager.getRepository(PermissionEntity);
      const grants = manager.getRepository(RolePermissionGrantEntity);
      const audit = manager.getRepository(AuthorizationAuditLogEntity);
      const adminRole = await roles.findOne({
        where: { moduleId: IsNull(), moduleRoleKey: 'admin' },
      });
      if (!adminRole) {
        this.logger.warn('Core Admin Role not found — skipping permission assignment');
        return;
      }

      const allPermissions = await permissions.find({
        select: ['id', 'permissionKey'],
      });
      if (!allPermissions.length) {
        this.logger.warn('No permissions found — nothing to assign');
        return;
      }

      await manager.query('SELECT "id" FROM "role" WHERE "id" = $1 FOR UPDATE', [
        adminRole.id,
      ]);
      const permissionIds = allPermissions.map((permission) => permission.id);
      const existing = await grants.find({
        where: {
          roleId: adminRole.id,
          grantType: 'module_default',
          sourceModuleId: 'core',
          sourceKey: CORE_ADMIN_GRANT_SOURCE,
        },
        select: ['permissionId'],
      });
      const existingIds = new Set(
        existing.map((grant) => Number(grant.permissionId)),
      );
      const missing = allPermissions.filter(
        (permission) => !existingIds.has(permission.id),
      );

      if (missing.length) {
        await grants.insert(
          missing.map((permission) => ({
            roleId: adminRole.id,
            permissionId: permission.id,
            grantType: 'module_default' as const,
            sourceModuleId: 'core',
            sourceKey: CORE_ADMIN_GRANT_SOURCE,
          })),
        );
        await audit.insert({
          actorUserId: null,
          moduleId: 'core',
          entityType: 'role',
          entityKey: 'core:admin',
          action: 'role.core_default_grants.restore',
          before: null,
          after: {
            permissionKeys: missing.map((permission) => permission.permissionKey),
          },
          metadata: { sourceKey: CORE_ADMIN_GRANT_SOURCE },
        });
      }

      await rebuildRolePermissionProjection(manager, adminRole.id);
      restoredCount = missing.length;
    });

    this.logger.log(
      `Ensured ${restoredCount} Core default permission grant(s) for admin Role`,
    );
  }

  async run(): Promise<void> {
    await this.assignAllToAdmin();
  }
}
