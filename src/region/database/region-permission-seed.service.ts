import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PermissionEntity } from '../../permissions/infrastructure/persistence/relational/entities/permission.entity';

/**
 * Registers permissions owned by the Region module.
 *
 * This operation is intentionally idempotent: installing/updating a module
 * adds missing permission definitions without deleting or replacing existing
 * permissions or role assignments.
 */
@Injectable()
export class RegionPermissionSeedService {
  constructor(
    @InjectRepository(PermissionEntity)
    private readonly permissionsRepository: Repository<PermissionEntity>,
  ) {}

  async run(): Promise<void> {
    const permission = await this.permissionsRepository.findOne({
      where: { name: 'read:region' },
    });

    if (permission) {
      return;
    }

    await this.permissionsRepository.save(
      this.permissionsRepository.create({
        name: 'read:region',
        description: 'Allows viewing Region module navigation and data',
      }),
    );
  }
}
