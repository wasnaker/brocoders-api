import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { RoleEntity } from '../roles/infrastructure/persistence/relational/entities/role.entity';
import { PermissionEntity } from '../permissions/infrastructure/persistence/relational/entities/permission.entity';
import { ModuleRoleAssignmentEntity } from './module-role-assignment.entity';
import { RolePermissionGrantEntity } from './role-permission-grant.entity';
import { RolePermissionOverrideEntity } from './role-permission-override.entity';
import { rebuildRolePermissionProjection } from './role-permission-projection';
import { ModuleLifecycleEntity } from './module-lifecycle.entity';
import { BACKEND_MODULE_MANIFESTS } from './module-manifest.registry';

export interface AuthorizationScope {
  type: string;
  id: string;
}

@Injectable()
export class ModuleAuthorizationService {
  constructor(
    @InjectRepository(RoleEntity)
    private readonly rolesRepository: Repository<RoleEntity>,
    @InjectRepository(ModuleRoleAssignmentEntity)
    private readonly assignmentsRepository: Repository<ModuleRoleAssignmentEntity>,
    @InjectRepository(PermissionEntity)
    private readonly permissionsRepository: Repository<PermissionEntity>,
    @InjectRepository(RolePermissionGrantEntity)
    private readonly grantsRepository: Repository<RolePermissionGrantEntity>,
    @InjectRepository(RolePermissionOverrideEntity)
    private readonly overridesRepository: Repository<RolePermissionOverrideEntity>,
    @InjectRepository(ModuleLifecycleEntity)
    private readonly lifecycleRepository: Repository<ModuleLifecycleEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async unregisterModule(moduleId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(ModuleRoleAssignmentEntity).update({ moduleId }, { isActive: false });
      await manager.getRepository(RoleEntity).update({ moduleId }, { isActive: false });
      await manager.getRepository(PermissionEntity).update({ moduleId }, { isActive: false });
      await this.rebuildModuleProjectionsInTransaction(manager, moduleId);
    });
  }

  async deactivateModule(moduleId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(RoleEntity).update({ moduleId }, { isActive: false });
      await manager.getRepository(PermissionEntity).update({ moduleId }, { isActive: false });
      await manager.getRepository(ModuleRoleAssignmentEntity).update({ moduleId }, { isActive: false });
      await this.rebuildModuleProjectionsInTransaction(manager, moduleId);
    });
  }

  async restoreModule(moduleId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(ModuleRoleAssignmentEntity).update({ moduleId }, { isActive: true });
      await this.rebuildModuleProjectionsInTransaction(manager, moduleId);
    });
  }

  async rebuildModuleProjections(moduleId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await this.rebuildModuleProjectionsInTransaction(manager, moduleId);
    });
  }

  private async rebuildModuleProjectionsInTransaction(manager: EntityManager, moduleId: string): Promise<void> {
    const affectedRoles: Array<{ roleId: number | string }> = await manager.query(
      `SELECT DISTINCT g."roleId"
      FROM "role_permission_grant" g
      INNER JOIN "role" r ON r."id" = g."roleId"
      INNER JOIN "permission" p ON p."id" = g."permissionId"
      WHERE r."moduleId" = $1 OR p."moduleId" = $1 OR g."sourceModuleId" = $1`,
      [moduleId],
    );
    for (const row of affectedRoles) {
      await rebuildRolePermissionProjection(manager, Number(row.roleId));
    }
  }

  async findModuleRoleId(moduleId: string, roleKey: string): Promise<number> {
    const role = await this.rolesRepository.findOne({
      where: { moduleId, moduleRoleKey: roleKey, isActive: true },
      select: ['id'],
    });
    if (!role) throw new Error(`Module role "${moduleId}:${roleKey}" is not registered`);
    return role.id;
  }

  async assignModuleRole(input: {
    userId: number;
    moduleId: string;
    roleKey: string;
    scopeType: string;
    scopeId: string;
    assignedBy: number | null;
  }): Promise<void> {
    if (!(await this.isModuleActive(input.moduleId))) {
      throw new Error('Cannot assign a Role owned by an inactive module');
    }
    const manifest = BACKEND_MODULE_MANIFESTS.find((item) => item.id === input.moduleId);
    const roleDefinition = manifest?.roles?.find((item) => item.key === input.roleKey);
    const role = await this.rolesRepository.findOne({
      where: { moduleId: input.moduleId, moduleRoleKey: input.roleKey, isActive: true },
    });
    if (!roleDefinition || !role || role.scope !== roleDefinition.scope || roleDefinition.scope !== input.scopeType) {
      throw new Error('Module role scope does not match its persisted manifest definition');
    }
    const existing = await this.assignmentsRepository.findOne({
      where: {
        userId: input.userId,
        moduleId: input.moduleId,
        roleKey: input.roleKey,
        scopeType: input.scopeType,
        scopeId: input.scopeId,
      },
    });
    if (existing) {
      if (existing.isActive === false) {
        existing.isActive = true;
        await this.assignmentsRepository.save(existing);
      }
      return;
    }
    await this.assignmentsRepository.save(this.assignmentsRepository.create({ ...input, isActive: true }));
  }

  /** Compatibility query backed by provenance-aware grants and deny overrides. */
  async hasPermission(roleId: number | string, permissionName: string): Promise<boolean> {
    const normalizedRoleId = Number(roleId);
    if (!Number.isSafeInteger(normalizedRoleId) || normalizedRoleId <= 0 || !permissionName?.trim()) return false;
    const role = await this.rolesRepository.findOne({ where: { id: normalizedRoleId, isActive: true } });
    if (!role) return false;
    // This compatibility API has no user assignment or scope context.
    // Module Roles must always use hasScopedModulePermission, even when their
    // manifest scope is global, so assignment and scope checks cannot be skipped.
    if (role.moduleId) return false;
    let permission = await this.permissionsRepository.findOne({
      where: [{ permissionKey: permissionName }, { name: permissionName }],
    });
    if (!permission) {
      permission = await this.permissionsRepository.findOne({
        where: { name: '*', moduleId: IsNull(), isActive: true },
      });
    }
    if (!permission || !permission.isActive) return false;
    if (permission.moduleId && !(await this.isModuleActive(permission.moduleId))) return false;
    if (role.moduleId && !(await this.isModuleActive(role.moduleId))) return false;
    const specificDeny = await this.overridesRepository.findOne({
      where: { roleId: normalizedRoleId, permissionId: permission.id, effect: 'deny' },
    });
    if (specificDeny) return false;
    const grant = await this.grantsRepository.findOne({
      where: { roleId: normalizedRoleId, permissionId: permission.id },
    });
    if (grant && (
      !grant.sourceModuleId ||
      grant.sourceModuleId === 'core' ||
      await this.isModuleActive(grant.sourceModuleId)
    )) {
      const denied = await this.overridesRepository.findOne({
        where: { roleId: normalizedRoleId, permissionId: permission.id, effect: 'deny' },
      });
      if (!denied) return true;
    }
    if (!role.moduleId) {
      const wildcard = await this.permissionsRepository.findOne({
        where: { name: '*', moduleId: IsNull(), isActive: true },
      });
      if (wildcard) {
        const [wildcardGrant, wildcardDeny, requestedPermissionDeny] = await Promise.all([
          this.grantsRepository.findOne({
            where: { roleId: normalizedRoleId, permissionId: wildcard.id },
          }),
          this.overridesRepository.findOne({
            where: { roleId: normalizedRoleId, permissionId: wildcard.id, effect: 'deny' },
          }),
          this.overridesRepository.findOne({
            where: { roleId: normalizedRoleId, permissionId: permission.id, effect: 'deny' },
          }),
        ]);
        return Boolean(wildcardGrant && !wildcardDeny && !requestedPermissionDeny);
      }
    }
    return false;
  }

  async hasScopedModulePermission(
    userId: number | string,
    roleIds: readonly (number | string)[],
    moduleId: string,
    permissionName: string,
    targetScopes: readonly AuthorizationScope[],
  ): Promise<boolean> {
    const user = Number(userId);
    const ids = [...new Set(roleIds.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))];
    if (!Number.isSafeInteger(user) || user <= 0 || !moduleId?.trim() || !permissionName?.trim() || !ids.length) return false;
    if (!(await this.isModuleActive(moduleId))) return false;

    const manifest = BACKEND_MODULE_MANIFESTS.find((item) => item.id === moduleId);
    if (!manifest || !manifest.permissions.some((permission) =>
      (permission.key?.trim() || permission.name) === permissionName || permission.name === permissionName,
    )) return false;

    const permission = await this.permissionsRepository.findOne({
      where: [
        { permissionKey: permissionName, moduleId, isActive: true },
        { name: permissionName, moduleId, isActive: true },
      ],
    });
    if (!permission) return false;

    const roles = await this.rolesRepository.find({
      where: { id: In(ids), isActive: true },
    });
    const targetKeys = new Set(targetScopes
      .filter((scope) => scope?.type && scope?.id !== undefined && scope?.id !== null)
      .map((scope) => `${scope.type}:${String(scope.id)}`));

    // Core-owned Roles are global. The wildcard is an explicit Core-owned
    // permission grant, not an implicit role or manifest shortcut.
    const wildcard = await this.permissionsRepository.findOne({
      where: { name: '*', moduleId: IsNull(), isActive: true },
    });
    if (wildcard) {
      for (const role of roles.filter((item) => !item.moduleId)) {
        const wildcardGrant = await this.grantsRepository.findOne({
          where: { roleId: role.id, permissionId: wildcard.id },
        });
        const [wildcardDeny, specificDeny] = await Promise.all([
          this.overridesRepository.findOne({ where: { roleId: role.id, permissionId: wildcard.id, effect: 'deny' } }),
          this.overridesRepository.findOne({ where: { roleId: role.id, permissionId: permission.id, effect: 'deny' } }),
        ]);
        const wildcardGrantActive = wildcardGrant && (
          !wildcardGrant.sourceModuleId ||
          wildcardGrant.sourceModuleId === 'core' ||
          await this.isModuleActive(wildcardGrant.sourceModuleId)
        );
        if (wildcardGrantActive && !wildcardDeny && !specificDeny) return true;
      }
    }

    for (const role of roles) {
      if (role.moduleId && !(await this.isModuleActive(role.moduleId))) continue;
      const grant = await this.grantsRepository.findOne({
        where: { roleId: role.id, permissionId: permission.id },
      });
      if (!grant) continue;
      if (grant.sourceModuleId && grant.sourceModuleId !== 'core' && !(await this.isModuleActive(grant.sourceModuleId))) continue;
      const denied = await this.overridesRepository.findOne({
        where: { roleId: role.id, permissionId: permission.id, effect: 'deny' },
      });
      if (denied) continue;

      if (!role.moduleId) {
        // Core-owned Roles are global; a specific non-denied grant is enough.
        return true;
      }
      if (!role.moduleRoleKey) continue;
      const ownerManifest = BACKEND_MODULE_MANIFESTS.find((item) => item.id === role.moduleId);
      const roleDefinition = ownerManifest?.roles?.find((item) => item.key === role.moduleRoleKey);
      if (!roleDefinition || role.scope !== roleDefinition.scope) continue;
      const assignmentModuleId = role.moduleId;
      const assignmentRoleKey = role.moduleRoleKey;
      const allowedScopeTypes = new Set([roleDefinition.scope]);

      const assignments = await this.assignmentsRepository.find({
        where: { userId: user, moduleId: assignmentModuleId, roleKey: assignmentRoleKey, isActive: true },
      });
      const allowed = assignments.some((assignment) => {
        if (!allowedScopeTypes.has(assignment.scopeType)) return false;
        if (assignment.scopeType === 'global') return true;
        return targetKeys.has(`${assignment.scopeType}:${String(assignment.scopeId)}`);
      });
      if (allowed) return true;
    }
    return false;
  }

  async resolveModuleScopes(
    userId: number | string,
    roleIds: readonly (number | string)[],
    moduleId: string,
    permissionName: string,
  ): Promise<{ global: boolean; scopes: AuthorizationScope[] }> {
    const user = Number(userId);
    const ids = [...new Set(roleIds.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))];
    if (!Number.isSafeInteger(user) || user <= 0 || !moduleId?.trim() || !permissionName?.trim() || !ids.length) {
      return { global: false, scopes: [] };
    }
    if (!(await this.isModuleActive(moduleId))) return { global: false, scopes: [] };
    const manifest = BACKEND_MODULE_MANIFESTS.find((item) => item.id === moduleId);
    if (!manifest) return { global: false, scopes: [] };
    const permission = await this.permissionsRepository.findOne({
      where: [
        { permissionKey: permissionName, moduleId, isActive: true },
        { name: permissionName, moduleId, isActive: true },
      ],
    });
    if (!permission) return { global: false, scopes: [] };
    const roles = await this.rolesRepository.find({ where: { id: In(ids), isActive: true } });
    const scopes = new Map<string, AuthorizationScope>();
    const wildcard = await this.permissionsRepository.findOne({
      where: { name: '*', moduleId: IsNull(), isActive: true },
    });
    if (wildcard) {
      for (const role of roles.filter((item) => !item.moduleId)) {
        const [wildcardGrant, wildcardDeny, specificDeny] = await Promise.all([
          this.grantsRepository.findOne({ where: { roleId: role.id, permissionId: wildcard.id } }),
          this.overridesRepository.findOne({ where: { roleId: role.id, permissionId: wildcard.id, effect: 'deny' } }),
          this.overridesRepository.findOne({ where: { roleId: role.id, permissionId: permission.id, effect: 'deny' } }),
        ]);
        if (wildcardGrant && !wildcardDeny && !specificDeny) return { global: true, scopes: [] };
      }
    }

    for (const role of roles) {
      if (role.moduleId && !(await this.isModuleActive(role.moduleId))) continue;
      const grant = await this.grantsRepository.findOne({ where: { roleId: role.id, permissionId: permission.id } });
      if (!grant) continue;
      if (grant.sourceModuleId && grant.sourceModuleId !== 'core' && !(await this.isModuleActive(grant.sourceModuleId))) continue;
      const denied = await this.overridesRepository.findOne({
        where: { roleId: role.id, permissionId: permission.id, effect: 'deny' },
      });
      if (denied) continue;

      if (!role.moduleId) {
        global = true;
        continue;
      }
      if (!role.moduleRoleKey) continue;
      const ownerManifest = BACKEND_MODULE_MANIFESTS.find((item) => item.id === role.moduleId);
      const roleDefinition = ownerManifest?.roles?.find((item) => item.key === role.moduleRoleKey);
      if (!roleDefinition || role.scope !== roleDefinition.scope) continue;
      const assignmentModuleId = role.moduleId;
      const assignmentRoleKey = role.moduleRoleKey;
      const allowedScopeTypes = new Set([roleDefinition.scope]);

      const assignments = await this.assignmentsRepository.find({
        where: { userId: user, moduleId: assignmentModuleId, roleKey: assignmentRoleKey, isActive: true },
      });
      for (const assignment of assignments) {
        if (!allowedScopeTypes.has(assignment.scopeType)) continue;
        if (assignment.scopeType === 'global') return { global: true, scopes: [] };
        const scope = { type: assignment.scopeType, id: String(assignment.scopeId) };
        scopes.set(`${scope.type}:${scope.id}`, scope);
      }
    }
    return { global: false, scopes: [...scopes.values()] };
  }

  async hasModulePermission(
    userId: number | string,
    moduleId: string,
    permissionName: string,
    scopeType: string,
    scopeId: number | string,
  ): Promise<boolean> {
    const user = Number(userId);
    if (!Number.isSafeInteger(user) || user <= 0) return false;
    const assignments = await this.assignmentsRepository.find({ where: { userId: user, isActive: true } });
    const roleIds = new Set<number>();
    for (const assignment of assignments) {
      if (assignment.roleKey.startsWith('core-role:')) {
        const id = Number(assignment.roleKey.slice('core-role:'.length));
        if (Number.isSafeInteger(id) && id > 0) roleIds.add(id);
      } else {
        const role = await this.rolesRepository.findOne({
          where: { moduleId: assignment.moduleId, moduleRoleKey: assignment.roleKey, isActive: true },
          select: ['id'],
        });
        if (role) roleIds.add(role.id);
      }
    }
    return this.hasScopedModulePermission(
      user,
      [...roleIds],
      moduleId,
      permissionName,
      [{ type: scopeType, id: String(scopeId) }],
    );
  }

  private async isModuleActive(moduleId: string): Promise<boolean> {
    const lifecycle = await this.lifecycleRepository.findOne({
      where: { moduleId, status: 'active' },
      select: ['moduleId'],
    });
    return Boolean(lifecycle);
  }
}
