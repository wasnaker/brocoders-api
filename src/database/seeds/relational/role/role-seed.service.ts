import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoleEntity } from '../../../../roles/infrastructure/persistence/relational/entities/role.entity';

@Injectable()
export class RoleSeedService {
  constructor(
    @InjectRepository(RoleEntity)
    private readonly repository: Repository<RoleEntity>,
  ) {}

  async run(): Promise<void> {
    await this.ensureCoreRole(1, 'Admin', 'admin');
    await this.ensureCoreRole(2, 'User', 'user');
  }

  private async ensureCoreRole(id: number, name: string, key: string): Promise<void> {
    let role = await this.repository.findOne({ where: { id } });
    if (!role) {
      role = this.repository.create({
        id,
        name,
        moduleId: null,
        moduleRoleKey: key,
        isActive: true,
      });
      await this.repository.save(role);
      return;
    }
    if (role.moduleId) {
      throw new Error(`Core Role "${name}" is unexpectedly owned by module "${role.moduleId}"`);
    }
    if (role.moduleRoleKey && role.moduleRoleKey !== key) {
      throw new Error(`Core Role id ${id} already has stable key "${role.moduleRoleKey}"`);
    }
    if (!role.moduleRoleKey) {
      role.moduleRoleKey = key;
      role.name = name;
      await this.repository.save(role);
    }
  }
}
