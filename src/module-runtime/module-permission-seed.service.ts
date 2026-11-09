import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PermissionEntity } from '../permissions/infrastructure/persistence/relational/entities/permission.entity';
import { RoleEntity } from '../roles/infrastructure/persistence/relational/entities/role.entity';
import { BACKEND_MODULE_MANIFESTS } from './module-manifest.registry';

@Injectable()
export class ModulePermissionSeedService {
  constructor(
    @InjectRepository(PermissionEntity)
    private readonly repository: Repository<PermissionEntity>,
    @InjectRepository(RoleEntity)
    private readonly rolesRepository: Repository<RoleEntity>,
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

      const declaredScopeTypes = manifest.scopeTypes ?? [
        ...new Set((manifest.roles ?? []).map((role) => role.scope)),
      ];
      const scopeTypes = new Set<string>();
      for (const scopeType of declaredScopeTypes) {
        if (
          !scopeType?.trim() ||
          scopeType.length > 30 ||
          scopeTypes.has(scopeType)
        ) {
          throw new Error(
            `Module "${manifest.id}" has an invalid or duplicate scope type "${scopeType}"`,
          );
        }
        scopeTypes.add(scopeType);
      }

      const roleKeys = new Set<string>();
      for (const role of manifest.roles ?? []) {
        if (!role.key?.trim() || !role.name?.trim() || roleKeys.has(role.key)) {
          throw new Error(
            `Module "${manifest.id}" has an invalid or duplicate role key "${role.key}"`,
          );
        }
        if (role.permissions.includes('*')) {
          throw new Error(
            `Module role "${manifest.id}:${role.key}" cannot declare the core wildcard permission`,
          );
        }
        if (!scopeTypes.has(role.scope)) {
          throw new Error(
            `Module role "${manifest.id}:${role.key}" uses undeclared scope type "${role.scope}"`,
          );
        }
        roleKeys.add(role.key);
      }
    }

    const definitions = BACKEND_MODULE_MANIFESTS.flatMap((manifest) =>
      manifest.permissions.map((permission) => ({
        ...permission,
        name: permission.name.trim(),
        permissionKey: permission.name.trim(),
        moduleId: manifest.id,
      })),
    );
    const uniqueByName = new Map<string, (typeof definitions)[number]>();
    for (const definition of definitions) {
      if (!definition.name || !definition.description) {
        throw new Error('Module permissions must have a name and description');
      }
      if (definition.name === '*') {
        throw new Error(
          'The core wildcard permission cannot be registered by a module',
        );
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
        await this.repository.save(
          this.repository.create({
            ...definition,
            isActive: true,
          }),
        );
        continue;
      }

      if (existing.moduleId && existing.moduleId !== definition.moduleId) {
        throw new Error(
          `Permission "${definition.name}" is already owned by module "${existing.moduleId}" and cannot be registered by "${definition.moduleId}"`,
        );
      }

      if (!existing.moduleId) {
        existing.moduleId = definition.moduleId;
        await this.repository.save(existing);
      }
    }

    // Bind each manifest role to its stable module identity before linking
    // permissions. A role name collision with another module is a hard error.
    for (const manifest of BACKEND_MODULE_MANIFESTS) {
      for (const roleDefinition of manifest.roles ?? []) {
        const role = await this.rolesRepository.findOne({
          where: { name: roleDefinition.name },
        });
        if (!role) continue;

        if (
          (role.moduleId &&
            role.moduleId !== manifest.id &&
            role.moduleRoleKey !== roleDefinition.key) ||
          (role.moduleRoleKey && role.moduleRoleKey !== roleDefinition.key)
        ) {
          throw new Error(
            `Role "${roleDefinition.name}" is already registered as ${role.moduleId ?? 'core'}:${role.moduleRoleKey ?? 'unkeyed'}; cannot bind it to ${manifest.id}:${roleDefinition.key}`,
          );
        }

        let roleChanged = false;
        if (!role.moduleId) {
          role.moduleId = manifest.id;
          roleChanged = true;
        }
        if (!role.moduleRoleKey) {
          role.moduleRoleKey = roleDefinition.key;
          roleChanged = true;
        }
        if (roleChanged) await this.rolesRepository.save(role);

        const permissions = await this.repository.find({
          where: roleDefinition.permissions.map((name) => ({ name })),
          select: ['id', 'name', 'permissionKey', 'moduleId', 'isActive'],
        });
        const permissionsByName = new Map(
          permissions.map((permission) => [permission.name, permission]),
        );
        const missingPermissions = roleDefinition.permissions.filter(
          (name) => !permissionsByName.has(name),
        );
        if (missingPermissions.length > 0) {
          throw new Error(
            `Module role "${manifest.id}:${roleDefinition.key}" references unregistered permissions: ${missingPermissions.join(', ')}`,
          );
        }
        const foreignPermissions = permissions.filter(
          (permission) => permission.moduleId !== manifest.id,
        );
        if (foreignPermissions.length > 0) {
          throw new Error(
            `Module role "${manifest.id}:${roleDefinition.key}" references permissions owned by another module`,
          );
        }

        const existingRows = await this.rolesRepository
          .createQueryBuilder()
          .select('rp.permissionId', 'permissionId')
          .from('roles_permissions_role', 'rp')
          .where('rp.roleId = :roleId', { roleId: role.id })
          .getRawMany<{ permissionId: number | string }>();
        const existingIds = new Set(
          existingRows.map((row) => Number(row.permissionId)),
        );
        const missingIds = permissions
          .filter((permission) => !existingIds.has(Number(permission.id)))
          .map((permission) => permission.id);

        if (missingIds.length > 0) {
          await this.rolesRepository
            .createQueryBuilder()
            .relation(RoleEntity, 'permissions')
            .of(role)
            .add(missingIds);
        }
      }
    }
  }
}
