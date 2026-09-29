import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PermissionEntity } from '../../../../permissions/infrastructure/persistence/relational/entities/permission.entity';

const DEFAULT_PERMISSIONS = [
  { name: 'create:user', description: 'Allows creating a new user' },
  { name: 'read:user', description: 'Allows reading user data' },
  { name: 'update:user', description: 'Allows updating user data' },
  { name: 'delete:user', description: 'Allows deleting a user' },
  { name: 'create:role', description: 'Allows creating a new role' },
  { name: 'read:role', description: 'Allows reading role data' },
  { name: 'update:role', description: 'Allows updating role data' },
  { name: 'delete:role', description: 'Allows deleting a role' },
  { name: 'create:permission', description: 'Allows creating a new permission' },
  { name: 'read:permission', description: 'Allows reading permission data' },
  { name: 'update:permission', description: 'Allows updating permission data' },
  { name: 'delete:permission', description: 'Allows deleting a permission' },
  { name: 'read:settings', description: 'Allows accessing application settings' },
];

@Injectable()
export class PermissionSeedService {
  constructor(
    @InjectRepository(PermissionEntity)
    private readonly repository: Repository<PermissionEntity>,
  ) {}

  async run() {
    if (DEFAULT_PERMISSIONS.length === 0) {
      return;
    }

    const existing = await this.repository.find({
      select: ['name'],
      where: DEFAULT_PERMISSIONS.map((p) => ({ name: p.name })),
    });
    const existingNames = new Set(existing.map((p) => p.name));

    const missing = DEFAULT_PERMISSIONS.filter(
      (p) => !existingNames.has(p.name),
    );

    if (missing.length === 0) {
      return;
    }

    await this.repository.save(
      this.repository.create(
        missing.map((permission) =>
          this.repository.create(permission),
        ),
      ),
    );
  }
}
