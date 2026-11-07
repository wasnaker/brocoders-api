import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { RoleEntity } from '../roles/infrastructure/persistence/relational/entities/role.entity';
import { ModuleRoleAssignmentEntity } from './module-role-assignment.entity';
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
  ) {}

  /** Legacy core-role permission check; retained for existing routes. */
  async hasPermission(
    roleId: number | string,
    permissionName: string,
  ): Promise<boolean> {
    const normalizedRoleId = Number(roleId);
    if (!Number.isSafeInteger(normalizedRoleId) || normalizedRoleId <= 0)
      return false;

    const matchingRoles = await this.rolesRepository
      .createQueryBuilder('role')
      .innerJoin(
        'role.permissions',
        'permission',
        `permission.name = :permissionName OR (permission.name = '*' AND permission.moduleId IS NULL AND role.moduleId IS NULL)`,
        { permissionName },
      )
      .where('role.id = :roleId', { roleId: normalizedRoleId })
      .andWhere('role.isActive = true')
      .andWhere('permission.isActive = true')
      .getCount();

    return matchingRoles > 0;
  }

  /**
   * Evaluates one complete role -> permission -> assignment chain.
   * The caller must supply role IDs reloaded from the current user record,
   * not role claims cached in a long-lived access token.
   */
  async hasScopedModulePermission(
    userId: number | string,
    roleIds: readonly (number | string)[],
    moduleId: string,
    permissionName: string,
    targetScopes: readonly AuthorizationScope[],
  ): Promise<boolean> {
    const normalizedUserId = Number(userId);
    const normalizedRoleIds = [
      ...new Set(
        roleIds
          .map(Number)
          .filter((id) => Number.isSafeInteger(id) && id > 0),
      ),
    ];

    if (
      !Number.isSafeInteger(normalizedUserId) ||
      normalizedUserId <= 0 ||
      !moduleId?.trim() ||
      !permissionName?.trim() ||
      normalizedRoleIds.length === 0
    ) {
      return false;
    }

    const manifest = BACKEND_MODULE_MANIFESTS.find(
      (item) => item.id === moduleId,
    );
    if (
      !manifest ||
      !manifest.permissions.some((permission) => permission.name === permissionName)
    ) {
      return false;
    }

    const moduleScopeTypes = new Set(
      manifest.scopeTypes ??
        (manifest.roles ?? []).map((role) => role.scope),
    );
    const roles = await this.rolesRepository.find({
      where: { id: In(normalizedRoleIds), isActive: true },
      relations: { permissions: true },
    });

    // System-wide access is explicit and core-owned. An unknown/non-module
    // role never becomes a global bypass merely because it is absent from
    // the module manifest.
    if (
      roles.some(
        (role) =>
          !role.moduleId &&
          role.permissions?.some(
            (permission) =>
              permission.name === '*' &&
              !permission.moduleId &&
              permission.isActive,
          ),
      )
    ) {
      return true;
    }

    const targetScopeKeys = new Set(
      targetScopes
        .filter((scope) => scope?.type && scope?.id)
        .map((scope) => `${scope.type}:${String(scope.id)}`),
    );

    for (const role of roles) {
      const hasActivePermission = role.permissions?.some(
        (permission) =>
          permission.name === permissionName &&
          permission.isActive &&
          permission.moduleId === moduleId,
      );
      if (!hasActivePermission) continue;

      let assignmentRoleKey: string;
      let allowedScopeTypes: Set<string>;

      if (role.moduleId === moduleId && role.moduleRoleKey) {
        const roleDefinition = manifest.roles?.find(
          (definition) => definition.key === role.moduleRoleKey,
        );
        if (
          !roleDefinition ||
          !roleDefinition.permissions.includes(permissionName)
        ) {
          continue;
        }
        assignmentRoleKey = role.moduleRoleKey;
        allowedScopeTypes = new Set([roleDefinition.scope]);
      } else if (!role.moduleId) {
        // Administrator-created core roles may receive module permissions,
        // but must have an explicit module_role_assignment using this stable
        // role-bound key. Permission alone never implies global scope.
        assignmentRoleKey = `core-role:${role.id}`;
        allowedScopeTypes = moduleScopeTypes;
      } else {
        continue;
      }

      const assignments = await this.assignmentsRepository.find({
        where: {
          userId: normalizedUserId,
          moduleId,
          roleKey: assignmentRoleKey,
        },
      });

      const hasMatchingAssignment = assignments.some((assignment) => {
        if (!allowedScopeTypes.has(assignment.scopeType)) return false;
        if (assignment.scopeType === 'global') return true;
        return targetScopeKeys.has(
          `${assignment.scopeType}:${String(assignment.scopeId)}`,
        );
      });

      if (hasMatchingAssignment) return true;
    }

    return false;
  }

  /**
   * Returns the authorized assignment scopes for a read/list permission.
   * Each scope is derived only from a role that owns the permission and its
   * matching roleKey assignment. The caller must still apply the returned
   * scopes in SQL before pagination and count.
   */
  async resolveModuleScopes(
    userId: number | string,
    roleIds: readonly (number | string)[],
    moduleId: string,
    permissionName: string,
  ): Promise<{ global: boolean; scopes: AuthorizationScope[] }> {
    const normalizedUserId = Number(userId);
    const normalizedRoleIds = [
      ...new Set(
        roleIds
          .map(Number)
          .filter((id) => Number.isSafeInteger(id) && id > 0),
      ),
    ];
    if (
      !Number.isSafeInteger(normalizedUserId) ||
      normalizedUserId <= 0 ||
      !moduleId?.trim() ||
      !permissionName?.trim() ||
      normalizedRoleIds.length === 0
    ) {
      return { global: false, scopes: [] };
    }

    const manifest = BACKEND_MODULE_MANIFESTS.find(
      (item) => item.id === moduleId,
    );
    if (!manifest?.roles?.length) return { global: false, scopes: [] };

    const roles = await this.rolesRepository.find({
      where: { id: In(normalizedRoleIds), isActive: true },
      relations: { permissions: true },
    });

    if (
      roles.some(
        (role) =>
          !role.moduleId &&
          role.permissions?.some(
            (permission) =>
              permission.name === '*' &&
              !permission.moduleId &&
              permission.isActive,
          ),
      )
    ) {
      return { global: true, scopes: [] };
    }

    const scopes = new Map<string, AuthorizationScope>();
    for (const role of roles) {
      if (
        role.moduleId !== moduleId ||
        !role.moduleRoleKey ||
        !role.isActive
      ) {
        continue;
      }
      const roleDefinition = manifest.roles.find(
        (definition) => definition.key === role.moduleRoleKey,
      );
      if (
        !roleDefinition ||
        !roleDefinition.permissions.includes(permissionName) ||
        !role.permissions?.some(
          (permission) =>
            permission.name === permissionName &&
            permission.isActive &&
            permission.moduleId === moduleId,
        )
      ) {
        continue;
      }

      const assignments = await this.assignmentsRepository.find({
        where: {
          userId: normalizedUserId,
          moduleId,
          roleKey: role.moduleRoleKey,
        },
      });
      for (const assignment of assignments) {
        if (assignment.scopeType === 'global') {
          if (roleDefinition.scope === 'global') {
            return { global: true, scopes: [] };
          }
          continue;
        }
        if (assignment.scopeType !== roleDefinition.scope) continue;
        const scope = {
          type: assignment.scopeType,
          id: String(assignment.scopeId),
        };
        scopes.set(`${scope.type}:${scope.id}`, scope);
      }
    }

    return { global: false, scopes: [...scopes.values()] };
  }

  /** Backward-compatible exact-scope API; new guards should use the path API. */
  async hasModulePermission(
    userId: number | string,
    moduleId: string,
    permissionName: string,
    scopeType: string,
    scopeId: number | string,
  ): Promise<boolean> {
    const normalizedUserId = Number(userId);
    if (!Number.isSafeInteger(normalizedUserId) || normalizedUserId <= 0) {
      return false;
    }

    const assignments = await this.assignmentsRepository.find({
      where: { userId: normalizedUserId, moduleId },
    });
    const roleKeys = [
      ...new Set(assignments.map((assignment) => assignment.roleKey)),
    ];
    if (roleKeys.length === 0) return false;

    const roles = await this.rolesRepository.find({
      where: {
        moduleId,
        moduleRoleKey: In(roleKeys),
        isActive: true,
      },
      select: ['id'],
    });

    return this.hasScopedModulePermission(
      normalizedUserId,
      roles.map((role) => role.id),
      moduleId,
      permissionName,
      [{ type: scopeType, id: String(scopeId) }],
    );
  }
}
