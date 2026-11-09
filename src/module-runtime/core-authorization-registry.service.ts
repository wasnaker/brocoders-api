import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PermissionEntity } from '../permissions/infrastructure/persistence/relational/entities/permission.entity';
import { RoleEntity } from '../roles/infrastructure/persistence/relational/entities/role.entity';
import { RolePermissionGrantEntity } from './role-permission-grant.entity';

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

/**
 * Public Core facade for stable-key authorization lookups.
 * Module consumers receive metadata and grant provenance, never ORM entities,
 * repositories, or numeric database identifiers.
 */
@Injectable()
export class CoreAuthorizationRegistryService {
  constructor(
    @InjectRepository(RoleEntity)
    private readonly roles: Repository<RoleEntity>,
    @InjectRepository(PermissionEntity)
    private readonly permissions: Repository<PermissionEntity>,
    @InjectRepository(RolePermissionGrantEntity)
    private readonly grants: Repository<RolePermissionGrantEntity>,
  ) {}

  async findRole(moduleId: string, roleKey: string): Promise<CoreAuthorizationRole | null> {
    const role = await this.roles.findOne({
      where: { moduleId, moduleRoleKey: roleKey, isActive: true },
      select: ['moduleId', 'moduleRoleKey', 'name', 'isActive'],
    });
    if (!role) return null;
    return {
      moduleId: role.moduleId ?? null,
      key: role.moduleRoleKey ?? roleKey,
      name: role.name ?? null,
      active: role.isActive,
    };
  }

  async findPermission(permissionKey: string): Promise<CoreAuthorizationPermission | null> {
    const permission = await this.permissions.findOne({
      where: { permissionKey, isActive: true },
      select: ['permissionKey', 'name', 'moduleId', 'isActive'],
    });
    if (!permission) return null;
    return {
      key: permission.permissionKey,
      name: permission.name,
      moduleId: permission.moduleId ?? null,
      active: permission.isActive,
    };
  }

  async listRoleGrants(moduleId: string, roleKey: string): Promise<CoreAuthorizationGrant[]> {
    const role = await this.roles.findOne({
      where: { moduleId, moduleRoleKey: roleKey, isActive: true },
      select: ['id'],
    });
    if (!role) return [];

    const rows = await this.grants
      .createQueryBuilder('grant')
      .innerJoin(PermissionEntity, 'permission', 'permission.id = grant.permissionId')
      .select('grant.sourceModuleId', 'sourceModuleId')
      .addSelect('grant.sourceKey', 'sourceKey')
      .addSelect('grant.grantType', 'grantType')
      .addSelect('permission.permissionKey', 'permissionKey')
      .where('grant.roleId = :roleId', { roleId: role.id })
      .andWhere('permission.isActive = true')
      .orderBy('permission.permissionKey', 'ASC')
      .getRawMany<CoreAuthorizationGrant>();
    return rows;
  }
}
