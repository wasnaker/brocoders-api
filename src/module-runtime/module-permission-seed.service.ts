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
    const moduleIds = new Set<string>();
    for (const manifest of BACKEND_MODULE_MANIFESTS) {
      if (
        !manifest.id ||
        !manifest.version ||
        !manifest.capabilities.includes('api')
      ) {
        throw new Error(
          'Backend module manifest has invalid identity or capabilities',
        );
      }
      if (moduleIds.has(manifest.id)) {
        throw new Error(`Duplicate backend module id "${manifest.id}"`);
      }
      moduleIds.add(manifest.id);
    }

    const definitions = BACKEND_MODULE_MANIFESTS.flatMap((manifest) =>
      manifest.permissions.map((permission) => ({
        ...permission,
        name: permission.name.trim(),
        moduleId: manifest.id,
      })),
    );
    const uniqueByName = new Map<string, (typeof definitions)[number]>();
    for (const definition of definitions) {
      if (!definition.name || !definition.description) {
        throw new Error('Module permissions must have a name and description');
      }

      const existingDefinition = uniqueByName.get(definition.name);
      if (
        existingDefinition &&
        (existingDefinition.description !== definition.description ||
          existingDefinition.moduleId !== definition.moduleId)
      ) {
        throw new Error(
          `Conflicting module ownership or descriptions for permission "${definition.name}"`,
        );
      }

      uniqueByName.set(definition.name, definition);
    }

    for (const definition of uniqueByName.values()) {
      const existing = await this.repository.findOne({
        where: { name: definition.name },
      });

      if (!existing) {
        await this.repository.save(this.repository.create({
          ...definition,
          isActive: true,
        }));
        continue;
      }

      if (existing.moduleId && existing.moduleId !== definition.moduleId) {
        throw new Error(
          `Permission "${definition.name}" is already owned by module "${existing.moduleId}" and cannot be registered by "${definition.moduleId}"`,
        );
      }

      // Ownership metadata may be filled for permissions created before module
      // ownership was introduced. Descriptions and active state are not
      // overwritten because administrators may manage them independently.
      if (!existing.moduleId) {
        existing.moduleId = definition.moduleId;
        await this.repository.save(existing);
      }
    }
  }
}
