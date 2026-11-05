import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { RoleEntity } from '../roles/infrastructure/persistence/relational/entities/role.entity';
import { ModuleRoleAssignmentEntity } from './module-role-assignment.entity';
import { BACKEND_MODULE_MANIFESTS } from './module-manifest.registry';

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
        'permission.name = :permissionName',
        { permissionName },
      )
      .where('role.id = :roleId', { roleId: normalizedRoleId })
      .getCount();

    return matchingRoles > 0;
  }

  /** Checks module-declared role permissions against a user's scoped assignments. */
  async hasModulePermission(
    userId: number | string,
    moduleId: string,
    permissionName: string,
    scopeType: 'customer' | 'branch',
    scopeId: number | string,
  ): Promise<boolean> {
    const normalizedUserId = Number(userId);
    if (
      !Number.isSafeInteger(normalizedUserId) ||
      normalizedUserId <= 0 ||
      !scopeId
    )
      return false;

    const manifest = BACKEND_MODULE_MANIFESTS.find(
      (item) => item.id === moduleId,
    );
    if (!manifest?.roles?.length) return false;

    const eligibleRoles = manifest.roles.filter(
      (role) =>
        role.permissions.includes(permissionName) &&
        (role.scope === 'global' || role.scope === scopeType),
    );
    if (!eligibleRoles.length) return false;

    const assignments = await this.assignmentsRepository.find({
      where: {
        userId: normalizedUserId,
        moduleId,
        roleKey: In(eligibleRoles.map((role) => role.key)),
      },
    });

    return assignments.some(
      (assignment) =>
        assignment.scopeType === 'global' ||
        (assignment.scopeType === scopeType &&
          assignment.scopeId === String(scopeId)),
    );
  }
}
