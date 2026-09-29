import { Logger, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PermissionEntity } from '../../../../permissions/infrastructure/persistence/relational/entities/permission.entity';
import { RoleEntity } from '../../../../roles/infrastructure/persistence/relational/entities/role.entity';
import { RoleEnum } from '../../../../roles/roles.enum';

@Injectable()
export class RolePermissionSeedService {
  private readonly logger = new Logger(RolePermissionSeedService.name);

  constructor(
    @InjectRepository(RoleEntity)
    private readonly roleRepository: Repository<RoleEntity>,
    @InjectRepository(PermissionEntity)
    private readonly permissionRepository: Repository<PermissionEntity>,
  ) {}

  async assignAllToAdmin(): Promise<void> {
    const adminRole = await this.roleRepository.findOne({
      where: { id: RoleEnum.admin },
    });

    if (!adminRole) {
      this.logger.warn('Admin role not found — skipping permission assignment');
      return;
    }

    const allPermissions = await this.permissionRepository.find({
      select: ['id'],
    });
    const allIds = allPermissions.map((p) => p.id);

    if (allIds.length === 0) {
      this.logger.warn('No permissions found — nothing to assign');
      return;
    }

    // Query the junction table directly to find already-linked permission ids.
    const existingRows = await this.roleRepository
      .createQueryBuilder()
      .select('rp.permissionId', 'permissionId')
      .from('roles_permissions_role', 'rp')
      .where('rp.roleId = :roleId', { roleId: RoleEnum.admin })
      .getRawMany();
    const existingIds = new Set(existingRows.map((r) => Number(r.permissionId)));

    const missingIds = allIds.filter((id) => !existingIds.has(id));

    if (missingIds.length === 0) {
      this.logger.log('Admin role already has all permissions — nothing to do');
      return;
    }

    // Use .add() (append-only) on the many-to-many relation.
    // .set() is NOT supported by TypeORM 0.3.28 for many-to-many.
    await this.roleRepository
      .createQueryBuilder()
      .relation(RoleEntity, 'permissions')
      .of(adminRole)
      .add(missingIds);

    this.logger.log(
      `Linked ${missingIds.length} new permission(s) to admin role`,
    );
  }

  async run(): Promise<void> {
    await this.assignAllToAdmin();
  }
}