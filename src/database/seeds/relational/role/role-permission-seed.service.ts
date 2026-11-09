import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PermissionEntity } from '../../../../permissions/infrastructure/persistence/relational/entities/permission.entity';
import { RoleEntity } from '../../../../roles/infrastructure/persistence/relational/entities/role.entity';
import { RolePermissionGrantEntity } from '../../../../module-runtime/role-permission-grant.entity';
import { AuthorizationAuditLogEntity } from '../../../../module-runtime/authorization-audit-log.entity';

const CORE_ADMIN_GRANT_SOURCE = 'core.admin-role-all-permissions';

@Injectable()
export class RolePermissionSeedService {
  private readonly logger = new Logger(RolePermissionSeedService.name);

  constructor(
    @InjectRepository(RoleEntity)
    private readonly roleRepository: Repository<RoleEntity>,
    @InjectRepository(PermissionEntity)
    private readonly permissionRepository: Repository<PermissionEntity>,
    @InjectRepository(RolePermissionGrantEntity)
    private readonly grantRepository: Repository<RolePermissionGrantEntity>,
    @InjectRepository(AuthorizationAuditLogEntity)
    private readonly auditRepository: Repository<AuthorizationAuditLogEntity>,
  ) {}

  async assignAllToAdmin(): Promise<void> {
    const adminRole = await this.roleRepository.findOne({ where: { id: 1 } });
    if (!adminRole) {
      this.logger.warn('Admin role not found — skipping permission assignment');
      return;
    }

    const allPermissions = await this.permissionRepository.find({ select: ['id'] });
    if (!allPermissions.length) {
      this.logger.warn('No permissions found — nothing to assign');
      return;
    }

    const permissionIds = allPermissions.map((permission) => permission.id);
    const existing = await this.grantRepository.find({
      where: {
        roleId: 1,
        grantType: 'module_default',
        sourceModuleId: 'core',
        sourceKey: CORE_ADMIN_GRANT_SOURCE,
        permissionId: In(permissionIds),
      },
      select: ['permissionId'],
    });
    const existingIds = new Set(existing.map((grant) => Number(grant.permissionId)));
    const missing = allPermissions.filter((permission) => !existingIds.has(permission.id));

    if (missing.length) {
      await this.grantRepository.insert(missing.map((permission) => ({
        roleId: 1,
        permissionId: permission.id,
        grantType: 'module_default' as const,
        sourceModuleId: 'core',
        sourceKey: CORE_ADMIN_GRANT_SOURCE,
      })));
      await this.auditRepository.insert({
        actorUserId: null,
        moduleId: 'core',
        entityType: 'role',
        entityKey: 'core:admin',
        action: 'role.core_default_grants.restore',
        before: null,
        after: { permissionKeys: missing.map((permission) => permission.id) },
        metadata: { sourceKey: CORE_ADMIN_GRANT_SOURCE },
      });
    }

    // Backward-compatible projection for consumers not yet migrated.
    const allGrants = await this.grantRepository.find({
      where: { roleId: 1 },
      select: ['permissionId'],
    });
    await this.roleRepository.query(
      'DELETE FROM "roles_permissions_role" WHERE "roleId" = $1',
      [1],
    );
    for (const grant of allGrants) {
      await this.roleRepository.query(
        'INSERT INTO "roles_permissions_role" ("roleId", "permissionId") VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [1, grant.permissionId],
      );
    }

    this.logger.log(`Ensured ${missing.length} Core default permission grant(s) for admin role`);
  }

  async run(): Promise<void> {
    await this.assignAllToAdmin();
  }
}
