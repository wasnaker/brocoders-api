import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoleEntity } from '../roles/infrastructure/persistence/relational/entities/role.entity';

@Injectable()
export class ModuleAuthorizationService {
  constructor(
    @InjectRepository(RoleEntity)
    private readonly rolesRepository: Repository<RoleEntity>,
  ) {}

  async hasPermission(
    roleId: number | string,
    permissionName: string,
  ): Promise<boolean> {
    const normalizedRoleId = Number(roleId);
    if (!Number.isSafeInteger(normalizedRoleId) || normalizedRoleId <= 0) {
      return false;
    }

    const matchingRoles = await this.rolesRepository
      .createQueryBuilder('role')
      .innerJoin(
        'role.permissions',
        'permission',
        'permission.name = :permissionName',
        { permissionName },
      )
      .where('role.id = :roleId', { roleId: normalizedRoleId })
      .getCount();

    return matchingRoles > 0;
  }
}
