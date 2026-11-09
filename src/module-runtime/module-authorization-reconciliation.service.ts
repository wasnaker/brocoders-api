import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { PermissionEntity } from '../permissions/infrastructure/persistence/relational/entities/permission.entity';
import { RoleEntity } from '../roles/infrastructure/persistence/relational/entities/role.entity';
import { BACKEND_MODULE_MANIFESTS } from './module-manifest.registry';
import { BackendModuleManifest } from './module-manifest.type';
import { normalizeModuleRoleGrants, validateModuleAuthorizationManifests } from './module-manifest.authorization';
import { RolePermissionGrantEntity } from './role-permission-grant.entity';
import { ModuleAuthorizationSyncEntity } from './module-authorization-sync.entity';
import { AuthorizationAuditLogEntity } from './authorization-audit-log.entity';

export interface AuthorizationModuleSyncResult {
  moduleId: string;
  status: 'success' | 'failed';
  manifestVersion: string;
  manifestHash: string;
  restoredPermissions?: number;
  restoredGrants?: number;
  removedGrants?: number;
  error?: string;
}

@Injectable()
export class ModuleAuthorizationReconciliationService {
  constructor(private readonly dataSource: DataSource) {}

  validateOnly(moduleId?: string) {
    const manifest = moduleId
      ? BACKEND_MODULE_MANIFESTS.find((item) => item.id === moduleId)
      : undefined;
    if (moduleId && !manifest) return {
      valid: false,
      moduleId,
      errors: [{ moduleId, path: 'id', message: 'Unknown backend module' }],
    };
    const errors = validateModuleAuthorizationManifests(BACKEND_MODULE_MANIFESTS)
      .filter((error) => !moduleId || error.moduleId === moduleId);
    return {
      valid: errors.length === 0,
      ...(manifest ? {
        moduleId: manifest.id,
        manifestVersion: manifest.version,
        manifestHash: this.fingerprint(manifest),
      } : {}),
      errors,
    };
  }

  async syncModule(moduleId: string, actorUserId: number | null = null): Promise<AuthorizationModuleSyncResult> {
    const manifest = BACKEND_MODULE_MANIFESTS.find((item) => item.id === moduleId);
    if (!manifest) return {
      moduleId, status: 'failed', manifestVersion: 'unknown',
      manifestHash: '', error: 'Unknown backend module',
    };
    const validation = this.validateOnly(moduleId);
    const manifestHash = this.fingerprint(manifest);
    if (!validation.valid) {
      const error = validation.errors.map((item) => `${item.path}: ${item.message}`).join('; ');
      await this.recordFailure(manifest, manifestHash, actorUserId, error);
      return { moduleId, status: 'failed', manifestVersion: manifest.version, manifestHash, error };
    }

    try {
      const counts = await this.dataSource.transaction(async (manager) => {
        await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
          `authorization-sync:${moduleId}`,
        ]);
        const restoredPermissions = await this.syncPermissions(manager, manifest);
        await this.bindRoles(manager, manifest);
        const { restoredGrants, removedGrants } = await this.syncGrants(manager, manifest);
        await manager.getRepository(ModuleAuthorizationSyncEntity).upsert({
          moduleId, manifestVersion: manifest.version, manifestHash,
          syncStatus: 'success', lastSyncedAt: new Date(), lastError: null,
        }, ['moduleId']);
        await manager.getRepository(AuthorizationAuditLogEntity).insert({
          actorUserId, moduleId, entityType: 'module_authorization',
          entityKey: moduleId, action: 'manifest.sync', before: null,
          after: { manifestVersion: manifest.version, manifestHash, restoredPermissions, restoredGrants, removedGrants },
          metadata: { mode: 'module', transactional: true },
        });
        return { restoredPermissions, restoredGrants, removedGrants };
      });
      return { moduleId, status: 'success', manifestVersion: manifest.version, manifestHash, ...counts };
    } catch (cause) {
      const error = cause instanceof Error ? cause.message : String(cause);
      await this.recordFailure(manifest, manifestHash, actorUserId, error);
      return { moduleId, status: 'failed', manifestVersion: manifest.version, manifestHash, error };
    }
  }

  async syncAll(actorUserId: number | null = null): Promise<AuthorizationModuleSyncResult[]> {
    const ordered = this.topologicalOrder(BACKEND_MODULE_MANIFESTS);
    const results: AuthorizationModuleSyncResult[] = [];
    for (const manifest of ordered) results.push(await this.syncModule(manifest.id, actorUserId));
    return results;
  }

  private async syncPermissions(manager: EntityManager, manifest: BackendModuleManifest): Promise<number> {
    const repository = manager.getRepository(PermissionEntity);
    let restored = 0;
    for (const definition of manifest.permissions) {
      const key = definition.key?.trim() || definition.name.trim();
      const name = definition.name.trim();
      let permission = await repository.findOne({ where: { permissionKey: key } });
      if (!permission) permission = await repository.findOne({ where: { name } });
      if (!permission) {
        permission = repository.create({
          name, permissionKey: key, description: definition.description,
          moduleId: manifest.id, isActive: true,
        });
        await repository.save(permission);
        restored += 1;
        continue;
      }
      if (permission.moduleId && permission.moduleId !== manifest.id) {
        throw new Error(`Permission "${key}" is owned by "${permission.moduleId}", not "${manifest.id}"`);
      }
      if (permission.permissionKey !== key) {
        const collision = await repository.findOne({ where: { permissionKey: key } });
        if (collision && collision.id !== permission.id) throw new Error(`Permission key "${key}" is already in use`);
        permission.permissionKey = key;
      }
      permission.moduleId = manifest.id;
      permission.isActive = true;
      permission.name = name;
      permission.description = definition.description;
      await repository.save(permission);
    }
    const declaredKeys = manifest.permissions.map((item) => item.key?.trim() || item.name.trim());
    await manager.query(
      'UPDATE "permission" SET "isActive" = false WHERE "moduleId" = $1 AND NOT ("permissionKey" = ANY($2::varchar[]))',
      [manifest.id, declaredKeys],
    );
    return restored;
  }

  private async bindRoles(manager: EntityManager, manifest: BackendModuleManifest): Promise<void> {
    const repository = manager.getRepository(RoleEntity);
    for (const definition of manifest.roles ?? []) {
      let role = await repository.findOne({ where: { moduleId: manifest.id, moduleRoleKey: definition.key } });
      if (!role) role = await repository.findOne({ where: { name: definition.name } });
      if (!role) {
        // RoleEntity uses an explicit PrimaryColumn. Allocate the next stable
        // Core ID while holding a table lock; module manifests never choose IDs.
        await manager.query('LOCK TABLE "role" IN EXCLUSIVE MODE');
        const rows: Array<{ id: number | string }> = await manager.query(
          'SELECT COALESCE(MAX("id"), 0) + 1 AS "id" FROM "role"',
        );
        role = repository.create({
          id: Number(rows[0].id),
          name: definition.name,
          description: definition.description,
          moduleId: manifest.id,
          moduleRoleKey: definition.key,
          isActive: true,
        });
        await repository.save(role);
        continue;
      }
      if (role.moduleId && role.moduleId !== manifest.id) throw new Error(`Role "${definition.name}" is owned by "${role.moduleId}"`);
      if (role.moduleRoleKey && role.moduleRoleKey !== definition.key) throw new Error(`Role "${definition.name}" is already bound to key "${role.moduleRoleKey}"`);
      role.name = definition.name;
      role.description = definition.description;
      role.moduleId = manifest.id;
      role.moduleRoleKey = definition.key;
      role.isActive = true;
      await repository.save(role);
    }
    const declaredRoleKeys = (manifest.roles ?? []).map((role) => role.key);
    await manager.query(
      'UPDATE "role" SET "isActive" = false WHERE "moduleId" = $1 AND NOT ("moduleRoleKey" = ANY($2::varchar[]))',
      [manifest.id, declaredRoleKeys],
    );
  }

  private async syncGrants(manager: EntityManager, manifest: BackendModuleManifest) {
    const roles = manager.getRepository(RoleEntity);
    const permissions = manager.getRepository(PermissionEntity);
    const grants = manager.getRepository(RolePermissionGrantEntity);
    const declarations = normalizeModuleRoleGrants(manifest);
    const retained = new Set<string>();
    const affectedRoleIds = new Set<number>();
    let restoredGrants = 0;

    for (const declaration of declarations) {
      const role = await roles.findOne({
        where: declaration.targetRole.moduleId === 'core'
          ? { moduleId: IsNull(), moduleRoleKey: declaration.targetRole.key, isActive: true }
          : { moduleId: declaration.targetRole.moduleId, moduleRoleKey: declaration.targetRole.key, isActive: true },
      });
      if (!role) throw new Error(`Target Role "${declaration.targetRole.moduleId}:${declaration.targetRole.key}" is not registered`);
      affectedRoleIds.add(role.id);
      for (const permissionKey of declaration.permissions) {
        const permission = await permissions.findOne({
          where: { permissionKey: permissionKey, moduleId: manifest.id, isActive: true },
        });
        if (!permission) throw new Error(`Permission "${permissionKey}" is not owned by "${manifest.id}"`);
        retained.add(`${role.id}:${permission.id}:${declaration.sourceKey}`);
        const existing = await grants.findOne({
          where: {
            roleId: role.id, permissionId: permission.id,
            grantType: 'module_default', sourceModuleId: manifest.id,
            sourceKey: declaration.sourceKey,
          },
        });
        if (!existing) {
          await grants.insert({
            roleId: role.id, permissionId: permission.id,
            grantType: 'module_default', sourceModuleId: manifest.id,
            sourceKey: declaration.sourceKey,
          });
          restoredGrants += 1;
        }
      }
    }

    const defaults = await grants.find({
      where: { sourceModuleId: manifest.id, grantType: 'module_default' },
      select: ['id', 'roleId', 'permissionId', 'sourceKey'],
    });
    for (const grant of defaults) affectedRoleIds.add(grant.roleId);
    const obsolete = defaults.filter((grant) =>
      !retained.has(`${grant.roleId}:${grant.permissionId}:${grant.sourceKey}`),
    ).map((grant) => grant.id);
    if (obsolete.length) await grants.delete(obsolete);

    // Maintain the old many-to-many table as a compatibility projection.
    // It is no longer authoritative and is never used to infer provenance.
    for (const roleId of affectedRoleIds) {
      const effectiveRows: Array<{ permissionId: number }> = await manager.query(
        'SELECT DISTINCT "permissionId" FROM "role_permission_grant" WHERE "roleId" = $1',
        [roleId],
      );
      await manager.query('DELETE FROM "roles_permissions_role" WHERE "roleId" = $1', [roleId]);
      for (const row of effectiveRows) {
        await manager.query(
          'INSERT INTO "roles_permissions_role" ("roleId", "permissionId") VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [roleId, row.permissionId],
        );
      }
    }
    return { restoredGrants, removedGrants: obsolete.length };
  }

  private async recordFailure(manifest: BackendModuleManifest, manifestHash: string, actorUserId: number | null, error: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(ModuleAuthorizationSyncEntity).upsert({
        moduleId: manifest.id, manifestVersion: manifest.version,
        manifestHash, syncStatus: 'failed', lastError: error.slice(0, 8000),
      }, ['moduleId']);
      await manager.getRepository(AuthorizationAuditLogEntity).insert({
        actorUserId, moduleId: manifest.id, entityType: 'module_authorization',
        entityKey: manifest.id, action: 'manifest.sync_failed',
        before: null, after: { manifestVersion: manifest.version, manifestHash },
        metadata: { error: error.slice(0, 8000) },
      });
    });
  }

  private fingerprint(manifest: BackendModuleManifest): string {
    return createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
  }

  private topologicalOrder(manifests: readonly BackendModuleManifest[]): BackendModuleManifest[] {
    const pending = new Map(manifests.map((item) => [item.id, item]));
    const ordered: BackendModuleManifest[] = [];
    while (pending.size) {
      const ready = [...pending.values()].filter((item) =>
        (item.authorizationRequires ?? []).every((dependency) => !pending.has(dependency)),
      ).sort((a, b) => a.id.localeCompare(b.id));
      if (!ready.length) throw new Error('Module dependency cycle prevents authorization sync');
      for (const item of ready) { ordered.push(item); pending.delete(item.id); }
    }
    return ordered;
  }
}
