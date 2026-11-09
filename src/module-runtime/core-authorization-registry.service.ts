import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { PermissionEntity } from '../permissions/infrastructure/persistence/relational/entities/permission.entity';
import { RoleEntity } from '../roles/infrastructure/persistence/relational/entities/role.entity';
import { RolePermissionGrantEntity } from './role-permission-grant.entity';
import { ModuleLifecycleEntity } from './module-lifecycle.entity';
import { ModuleAuthorizationService } from './module-authorization.service';
import { AuthorizationScope } from './module-authorization.service';

export interface CoreAuthorizationRole {
  moduleId: string | null;
  key: string;
  name: string | null;
  active: boolean;
}
export interface CoreAuthorizationPermission {
  key: string;
  name: string;
  moduleId: string | null;
  active: boolean;
}
export interface CoreAuthorizationGrant {
  sourceModuleId: string | null;
  sourceKey: string | null;
  grantType: 'module_default' | 'admin_manual' | 'legacy';
  permissionKey: string;
}

/** Public stable-key facade; ORM entities and numeric IDs never cross module boundaries. */
@Injectable()
export class CoreAuthorizationRegistryService {
  constructor(
    @InjectRepository(RoleEntity) private readonly roles: Repository<RoleEntity>,
    @InjectRepository(PermissionEntity) private readonly permissions: Repository<PermissionEntity>,
    @InjectRepository(RolePermissionGrantEntity) private readonly grants: Repository<RolePermissionGrantEntity>,
    @InjectRepository(ModuleLifecycleEntity) private readonly lifecycle: Repository<ModuleLifecycleEntity>,
    private readonly authorization: ModuleAuthorizationService,
  ) {}

  async findRole(moduleId: string, roleKey: string): Promise<CoreAuthorizationRole | null> {
    const role = await this.roles.findOne({
      where: moduleId === 'core'
        ? { moduleId: IsNull(), moduleRoleKey: roleKey, isActive: true }
        : { moduleId, moduleRoleKey: roleKey, isActive: true },
      select: ['moduleId', 'moduleRoleKey', 'name', 'isActive'],
    });
    if (role && moduleId !== 'core' && !(await this.isModuleActive(moduleId))) return null;
    return role ? {
      moduleId: role.moduleId ?? null,
      key: role.moduleRoleKey ?? roleKey,
      name: role.name ?? null,
      active: role.isActive,
    } : null;
  }

  async findPermission(permissionKey: string): Promise<CoreAuthorizationPermission | null> {
    const permission = await this.permissions.findOne({
      where: { permissionKey, isActive: true },
      select: ['permissionKey', 'name', 'moduleId', 'isActive'],
    });
    if (permission?.moduleId && !(await this.isModuleActive(permission.moduleId))) return null;
    return permission ? {
      key: permission.permissionKey,
      name: permission.name,
      moduleId: permission.moduleId ?? null,
      active: permission.isActive,
    } : null;
  }

  private async isModuleActive(moduleId: string): Promise<boolean> {
    return Boolean(await this.lifecycle.findOne({
      where: { moduleId, status: 'active' },
      select: ['moduleId'],
    }));
  }

  async hasPermission(input: {
    roleId: number | string;
    permissionKey: string;
  }): Promise<boolean> {
    return this.authorization.hasPermission(input.roleId, input.permissionKey);
  }

  async hasScopedPermission(input: {
    userId: number | string;
    roleIds: readonly (number | string)[];
    moduleId: string;
    permissionKey: string;
    targetScopes: readonly AuthorizationScope[];
  }): Promise<boolean> {
    return this.authorization.hasScopedModulePermission(
      input.userId,
      input.roleIds,
      input.moduleId,
      input.permissionKey,
      input.targetScopes,
    );
  }

  async resolvePermissionScopes(input: {
    userId: number | string;
    roleIds: readonly (number | string)[];
    moduleId: string;
    permissionKey: string;
  }): Promise<{ global: boolean; scopes: AuthorizationScope[] }> {
    return this.authorization.resolveModuleScopes(
      input.userId,
      input.roleIds,
      input.moduleId,
      input.permissionKey,
    );
  }

  async listRoleGrants(moduleId: string, roleKey: string): Promise<CoreAuthorizationGrant[]> {
    const role = await this.roles.findOne({
      where: moduleId === 'core'
        ? { moduleId: IsNull(), moduleRoleKey: roleKey, isActive: true }
        : { moduleId, moduleRoleKey: roleKey, isActive: true },
      select: ['id'],
    });
    if (!role || (moduleId !== 'core' && !(await this.isModuleActive(moduleId)))) return [];
    return this.grants.createQueryBuilder('grant')
      .innerJoin(PermissionEntity, 'permission', 'permission.id = grant.permissionId')
      .leftJoin(ModuleLifecycleEntity, 'permissionModule', 'permissionModule.moduleId = permission.moduleId')
      .select('grant.sourceModuleId', 'sourceModuleId')
      .addSelect('grant.sourceKey', 'sourceKey')
      .addSelect('grant.grantType', 'grantType')
      .addSelect('permission.permissionKey', 'permissionKey')
      .where('grant.roleId = :roleId', { roleId: role.id })
      .andWhere('permission.isActive = true')
      .andWhere('(permission.moduleId IS NULL OR permissionModule.status = :activeStatus)', { activeStatus: 'active' })
      .orderBy('permission.permissionKey', 'ASC')
      .getRawMany<CoreAuthorizationGrant>();
  }
}
