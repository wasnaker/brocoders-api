import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PermissionEntity } from './infrastructure/persistence/relational/entities/permission.entity';

@Injectable()
export class PermissionsSeedService {
  constructor(
    @InjectRepository(PermissionEntity)
    private readonly repository: Repository<PermissionEntity>,
  ) {}

  async run() {
    const count = await this.repository.count();
    if (count > 0) return;

    const permissions = [
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
    ];

    await this.repository.save(permissions);
  }
}
