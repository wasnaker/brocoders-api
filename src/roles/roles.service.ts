import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { RoleEntity } from './infrastructure/persistence/relational/entities/role.entity';
import { PermissionEntity } from '../permissions/infrastructure/persistence/relational/entities/permission.entity';
import { RolePermissionGrantEntity } from '../module-runtime/role-permission-grant.entity';
import { AuthorizationAuditLogEntity } from '../module-runtime/authorization-audit-log.entity';
import { RolePermissionOverrideEntity } from '../module-runtime/role-permission-override.entity';
import { NullableType } from '../utils/types/nullable.type';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(RoleEntity)
    private readonly rolesRepository: Repository<RoleEntity>,
    @InjectRepository(PermissionEntity)
    private readonly permissionsRepository: Repository<PermissionEntity>,
    @InjectRepository(RolePermissionGrantEntity)
    private readonly grantsRepository: Repository<RolePermissionGrantEntity>,
    @InjectRepository(RolePermissionOverrideEntity)
    private readonly overridesRepository: Repository<RolePermissionOverrideEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(): Promise<RoleEntity[]> {
    const roles = await this.rolesRepository.find();
    return this.attachEffectivePermissions(roles);
  }

  async findById(id: RoleEntity['id']): Promise<NullableType<RoleEntity> | null> {
    const role = await this.rolesRepository.findOne({ where: { id: Number(id) } });
    if (!role) return null;
    const [hydrated] = await this.attachEffectivePermissions([role]);
    return hydrated ?? null;
  }

  /**
   * The admin endpoint edits only administrator-owned grants. Manifest
   * defaults, legacy provenance, and deny overrides are not overwritten.
   * The old join table is maintained as a compatibility projection until
   * every legacy authorization reader has been migrated.
   */
  async setPermissionDeny(
    id: RoleEntity['id'],
    permissionId: number,
    actorUserId: number | null = null,
    reason: string | null = null,
  ): Promise<void> {
    const roleId = Number(id);
    if (!Number.isSafeInteger(roleId) || roleId <= 0 || !Number.isSafeInteger(permissionId) || permissionId <= 0) {
      throw new BadRequestException('Invalid Role or Permission id');
    }
    await this.dataSource.transaction(async (manager) => {
      const role = await manager.getRepository(RoleEntity).findOne({ where: { id: roleId } });
      const permission = await manager.getRepository(PermissionEntity).findOne({ where: { id: permissionId } });
      if (!role || !permission) throw new BadRequestException('Role or Permission does not exist');
      const overrides = manager.getRepository(RolePermissionOverrideEntity);
      const before = await overrides.findOne({ where: { roleId, permissionId } });
      await overrides.upsert({ roleId, permissionId, effect: 'deny', reason, createdBy: actorUserId, updatedAt: new Date() }, ['roleId', 'permissionId']);
      await manager.getRepository(AuthorizationAuditLogEntity).insert({
        actorUserId,
        moduleId: role.moduleId ?? 'core',
        entityType: 'role_permission_override',
        entityKey: `${role.moduleRoleKey ? `${role.moduleId ?? 'core'}:${role.moduleRoleKey}` : roleId}:${permission.permissionKey}`,
        action: 'permission.deny',
        before: before ? { effect: before.effect, reason: before.reason } : null,
        after: { effect: 'deny', reason },
        metadata: { roleId, permissionKey: permission.permissionKey },
      });
    });
  }

  async clearPermissionDeny(
    id: RoleEntity['id'],
    permissionId: number,
    actorUserId: number | null = null,
  ): Promise<void> {
    const roleId = Number(id);
    if (!Number.isSafeInteger(roleId) || roleId <= 0 || !Number.isSafeInteger(permissionId) || permissionId <= 0) {
      throw new BadRequestException('Invalid Role or Permission id');
    }
    await this.dataSource.transaction(async (manager) => {
      const role = await manager.getRepository(RoleEntity).findOne({ where: { id: roleId } });
      const permission = await manager.getRepository(PermissionEntity).findOne({ where: { id: permissionId } });
      if (!role || !permission) throw new BadRequestException('Role or Permission does not exist');
      const overrides = manager.getRepository(RolePermissionOverrideEntity);
      const before = await overrides.findOne({ where: { roleId, permissionId } });
      if (!before) return;
      await overrides.delete({ roleId, permissionId });
      await manager.getRepository(AuthorizationAuditLogEntity).insert({
        actorUserId,
        moduleId: role.moduleId ?? 'core',
        entityType: 'role_permission_override',
        entityKey: `${role.moduleRoleKey ? `${role.moduleId ?? 'core'}:${role.moduleRoleKey}` : roleId}:${permission.permissionKey}`,
        action: 'permission.deny_removed',
        before: { effect: before.effect, reason: before.reason },
        after: null,
        metadata: { roleId, permissionKey: permission.permissionKey },
      });
    });
  }

  async updatePermissions(
    id: RoleEntity['id'],
    permissionIds: number[],
    actorUserId: number | null = null,
  ): Promise<RoleEntity | null> {
    const roleId = Number(id);
    if (!Number.isSafeInteger(roleId) || roleId <= 0) {
      throw new BadRequestException('Invalid Role id');
    }
    const nextIds = [...new Set((permissionIds ?? []).map(Number))];
    if (nextIds.some((permissionId) => !Number.isSafeInteger(permissionId) || permissionId <= 0)) {
      throw new BadRequestException('Permission ids must be positive integers');
    }

    await this.dataSource.transaction(async (manager) => {
      const role = await manager.getRepository(RoleEntity).findOne({ where: { id: roleId } });
      if (!role) return;
      await manager.query('SELECT "id" FROM "role" WHERE "id" = $1 FOR UPDATE', [roleId]);

      const permissionRepository = manager.getRepository(PermissionEntity);
      const selected = nextIds.length
        ? await permissionRepository.find({ where: { id: In(nextIds) } })
        : [];
      if (selected.length !== nextIds.length) {
        throw new BadRequestException('One or more selected Permissions do not exist');
      }

      const grantRepository = manager.getRepository(RolePermissionGrantEntity);
      const before = await grantRepository.find({
        where: { roleId, grantType: 'admin_manual' },
      });
      const beforePermissions = before.length
        ? await permissionRepository.find({ where: { id: In(before.map((grant) => grant.permissionId)) } })
        : [];
      await grantRepository.delete({ roleId, grantType: 'admin_manual' });
      if (selected.length) {
        await grantRepository.insert(selected.map((permission) => ({
          roleId,
          permissionId: permission.id,
          grantType: 'admin_manual' as const,
          sourceModuleId: null,
          sourceKey: null,
          createdBy: actorUserId,
        })));
      }

      // Backward-compatible aggregate projection; provenance remains in the
      // grant table and this join table is not used as the source of truth.
      const allGrants: Array<{ permissionId: number }> = await manager.query(
        'SELECT DISTINCT "permissionId" FROM "role_permission_grant" WHERE "roleId" = $1',
        [roleId],
      );
      await manager.query('DELETE FROM "roles_permissions_role" WHERE "roleId" = $1', [roleId]);
      for (const grant of allGrants) {
        await manager.query(
          'INSERT INTO "roles_permissions_role" ("roleId", "permissionId") VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [roleId, grant.permissionId],
        );
      }

      await manager.getRepository(AuthorizationAuditLogEntity).insert({
        actorUserId,
        moduleId: role.moduleId ?? 'core',
        entityType: 'role',
        entityKey: role.moduleRoleKey
          ? `${role.moduleId ?? 'core'}:${role.moduleRoleKey}`
          : String(roleId),
        action: 'role.manual_grants.replace',
        before: { permissionKeys: beforePermissions.map((permission) => permission.permissionKey) },
        after: { permissionKeys: selected.map((permission) => permission.permissionKey) },
        metadata: { grantType: 'admin_manual' },
      });
    });

    return this.findById(roleId);
  }

  private async attachEffectivePermissions(roles: RoleEntity[]): Promise<RoleEntity[]> {
    if (!roles.length) return roles;
    const roleIds = roles.map((role) => role.id);
    const grantRows = await this.grantsRepository.createQueryBuilder('grant')
      .innerJoin(PermissionEntity, 'permission', 'permission.id = grant.permissionId')
      .select('grant.roleId', 'roleId')
      .addSelect('permission.id', 'permissionId')
      .addSelect('permission.permissionKey', 'permissionKey')
      .addSelect('grant.grantType', 'grantType')
      .addSelect('grant.sourceModuleId', 'sourceModuleId')
      .addSelect('grant.sourceKey', 'sourceKey')
      .where('grant.roleId IN (:...roleIds)', { roleIds })
      .andWhere('permission.isActive = true')
      .getRawMany<{
        roleId: number | string;
        permissionId: number | string;
        permissionKey: string;
        grantType: 'module_default' | 'admin_manual' | 'legacy';
        sourceModuleId: string | null;
        sourceKey: string | null;
      }>();
    const permissionIds = [...new Set(grantRows.map((row) => Number(row.permissionId)))];
    const permissions = permissionIds.length
      ? await this.permissionsRepository.find({ where: { id: In(permissionIds) } })
      : [];
    const byRole = new Map<number, Set<number>>();
    for (const row of grantRows) {
      const roleId = Number(row.roleId);
      if (!byRole.has(roleId)) byRole.set(roleId, new Set());
      byRole.get(roleId)?.add(Number(row.permissionId));
    }

    const overrideRows = await this.overridesRepository.createQueryBuilder('override')
      .innerJoin(PermissionEntity, 'permission', 'permission.id = override.permissionId')
      .select('override.roleId', 'roleId')
      .addSelect('permission.permissionKey', 'permissionKey')
      .addSelect('override.effect', 'effect')
      .addSelect('override.reason', 'reason')
      .where('override.roleId IN (:...roleIds)', { roleIds })
      .getRawMany<{
        roleId: number | string;
        permissionKey: string;
        effect: 'deny';
        reason: string | null;
      }>();

    for (const role of roles) {
      const ids = byRole.get(role.id) ?? new Set<number>();
      role.permissions = permissions.filter((permission) => ids.has(permission.id));
      role.authorizationGrants = grantRows
        .filter((row) => Number(row.roleId) === role.id)
        .map(({ permissionKey, grantType, sourceModuleId, sourceKey }) => ({
          permissionKey,
          grantType,
          sourceModuleId,
          sourceKey,
        }));
      role.authorizationOverrides = overrideRows
        .filter((row) => Number(row.roleId) === role.id)
        .map(({ permissionKey, effect, reason }) => ({
          permissionKey,
          effect,
          reason,
        }));
    }
    return roles;
  }
}
