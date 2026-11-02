import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PermissionEntity } from '../permissions/infrastructure/persistence/relational/entities/permission.entity';
import { BACKEND_MODULE_MANIFESTS } from './module-manifest.registry';

@Injectable()
export class ModulePermissionSeedService {
  constructor(
    @InjectRepository(PermissionEntity)
    private readonly repository: Repository<PermissionEntity>,
  ) {}

  async run(): Promise<void> {
    const definitions = BACKEND_MODULE_MANIFESTS.flatMap((manifest) =>
      manifest.permissions.map((permission) => ({
        ...permission,
        name: permission.name.trim(),
      })),
    );
    const uniqueByName = new Map<string, (typeof definitions)[number]>();
    for (const definition of definitions) {
      uniqueByName.set(definition.name, definition);
    }
    const unique = [...uniqueByName.values()];
    if (unique.length === 0) return;

    const existing = await this.repository.find({
      select: ['name'],
      where: unique.map(({ name }) => ({ name })),
    });
    const existingNames = new Set(existing.map(({ name }) => name));
    const missing = unique.filter(({ name }) => !existingNames.has(name));
    if (missing.length === 0) return;

    await this.repository.save(
      this.repository.create(missing.map((permission) => ({ ...permission }))),
    );
  }
}
