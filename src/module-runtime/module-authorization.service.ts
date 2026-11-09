import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { RoleEntity } from '../roles/infrastructure/persistence/relational/entities/role.entity';
import { PermissionEntity } from '../permissions/infrastructure/persistence/relational/entities/permission.entity';
import { ModuleRoleAssignmentEntity } from './module-role-assignment.entity';
import { RolePermissionGrantEntity } from './role-permission-grant.entity';
import { RolePermissionOverrideEntity } from './role-permission-override.entity';
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
      await manager.getRepository(ModuleRoleAssignmentEntity).delete({ moduleId });
      await manager.getRepository(RoleEntity).update({ moduleId }, { isActive: false });
      await manager.getRepository(PermissionEntity).update({ moduleId }, { isActive: false });
    });
  }

  async deactivateModule(moduleId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(RoleEntity).update({ moduleId }, { isActive: false });
      await manager.getRepository(PermissionEntity).update({ moduleId }, { isActive: false });
    });
  }

  async restoreModule(moduleId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(RoleEntity).update({ moduleId }, { isActive: true });
      await manager.getRepository(PermissionEntity).update({ moduleId }, { isActive: true });
    });
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
    const roleId = await this.findModuleRoleId(input.moduleId, input.roleKey);
    const manifest = BACKEND_MODULE_MANIFESTS.find((item) => item.id === input.moduleId);
    const roleDefinition = manifest?.roles?.find((item) => item.key === input.roleKey);
    if (!roleDefinition || roleDefinition.scope !== input.scopeType) {
      throw new Error('Module role scope does not match its manifest definition');
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
    if (existing) return;
    await this.assignmentsRepository.save(this.assignmentsRepository.create(input));
    void roleId;
  }

  /** Compatibility query backed by provenance-aware grants and deny overrides. */
  async hasPermission(roleId: number | string, permissionName: string): Promise<boolean> {
    const normalizedRoleId = Number(roleId);
    if (!Number.isSafeInteger(normalizedRoleId) || normalizedRoleId <= 0 || !permissionName?.trim()) return false;
    const role = await this.rolesRepository.findOne({ where: { id: normalizedRoleId, isActive: true } });
    if (!role) return false;
    const permission = await this.permissionsRepository.findOne({
      where: [{ permissionKey: permissionName }, { name: permissionName }],
    });
    if (!permission || !permission.isActive) return false;
    if (permission.moduleId && !(await this.isModuleActive(permission.moduleId))) return false;
    if (role.moduleId && !(await this.isModuleActive(role.moduleId))) return false;
    const grant = await this.grantsRepository.findOne({
      where: { roleId: normalizedRoleId, permissionId: permission.id },
    });
    if (!grant) return false;
    const denied = await this.overridesRepository.findOne({
      where: { roleId: normalizedRoleId, permissionId: permission.id, effect: 'deny' },
    });
    return !denied;
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

    // Core-owned wildcard is the only global bypass and is itself represented
    // by a persisted grant, never by a module-supplied manifest declaration.
    const wildcard = await this.permissionsRepository.findOne({
      where: { name: '*', moduleId: null, isActive: true },
    });
    if (wildcard) {
      for (const role of roles.filter((item) => !item.moduleId)) {
        const wildcardGrant = await this.grantsRepository.findOne({
          where: { roleId: role.id, permissionId: wildcard.id },
        });
        const wildcardDeny = await this.overridesRepository.findOne({
          where: { roleId: role.id, permissionId: wildcard.id, effect: 'deny' },
        });
        if (wildcardGrant && !wildcardDeny) return true;
      }
    }

    for (const role of roles) {
      if (role.moduleId && !(await this.isModuleActive(role.moduleId))) continue;
      const grant = await this.grantsRepository.findOne({
        where: { roleId: role.id, permissionId: permission.id },
      });
      if (!grant) continue;
      const denied = await this.overridesRepository.findOne({
        where: { roleId: role.id, permissionId: permission.id, effect: 'deny' },
      });
      if (denied) continue;

      let assignmentModuleId = moduleId;
      let assignmentRoleKey: string;
      let allowedScopeTypes: Set<string>;
      if (role.moduleId && role.moduleRoleKey) {
        const ownerManifest = BACKEND_MODULE_MANIFESTS.find((item) => item.id === role.moduleId);
        const roleDefinition = ownerManifest?.roles?.find((item) => item.key === role.moduleRoleKey);
        if (!roleDefinition) continue;
        assignmentModuleId = role.moduleId;
        assignmentRoleKey = role.moduleRoleKey;
        allowedScopeTypes = new Set([roleDefinition.scope]);
      } else if (!role.moduleId) {
        assignmentRoleKey = `core-role:${role.id}`;
        allowedScopeTypes = new Set(manifest.scopeTypes ?? []);
      } else {
        continue;
      }

      const assignments = await this.assignmentsRepository.find({
        where: { userId: user, moduleId: assignmentModuleId, roleKey: assignmentRoleKey },
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

    for (const role of roles) {
      if (role.moduleId && !(await this.isModuleActive(role.moduleId))) continue;
      const grant = await this.grantsRepository.findOne({ where: { roleId: role.id, permissionId: permission.id } });
      if (!grant) continue;
      const denied = await this.overridesRepository.findOne({
        where: { roleId: role.id, permissionId: permission.id, effect: 'deny' },
      });
      if (denied) continue;

      let assignmentModuleId = moduleId;
      let assignmentRoleKey: string;
      let allowedScopeTypes: Set<string>;
      if (role.moduleId && role.moduleRoleKey) {
        const ownerManifest = BACKEND_MODULE_MANIFESTS.find((item) => item.id === role.moduleId);
        const roleDefinition = ownerManifest?.roles?.find((item) => item.key === role.moduleRoleKey);
        if (!roleDefinition) continue;
        assignmentModuleId = role.moduleId;
        assignmentRoleKey = role.moduleRoleKey;
        allowedScopeTypes = new Set([roleDefinition.scope]);
      } else if (!role.moduleId) {
        assignmentRoleKey = `core-role:${role.id}`;
        allowedScopeTypes = new Set(manifest.scopeTypes ?? []);
      } else continue;

      const assignments = await this.assignmentsRepository.find({
        where: { userId: user, moduleId: assignmentModuleId, roleKey: assignmentRoleKey },
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
    const assignments = await this.assignmentsRepository.find({ where: { userId: user } });
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
