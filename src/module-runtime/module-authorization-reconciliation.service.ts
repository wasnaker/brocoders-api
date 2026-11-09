import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { PermissionEntity } from '../permissions/infrastructure/persistence/relational/entities/permission.entity';
import { RoleEntity } from '../roles/infrastructure/persistence/relational/entities/role.entity';
import { BACKEND_MODULE_MANIFESTS } from './module-manifest.registry';
import { BackendModuleManifest } from './module-manifest.type';
import { CORE_PERMISSION_KEYS, normalizeModuleRoleGrants, validateModuleAuthorizationManifests } from './module-manifest.authorization';
import { RolePermissionGrantEntity } from './role-permission-grant.entity';
import { ModuleAuthorizationSyncEntity } from './module-authorization-sync.entity';
import { AuthorizationAuditLogEntity } from './authorization-audit-log.entity';
import { rebuildRolePermissionProjection } from './role-permission-projection';

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
    const relevantModules = new Set<string>();
    if (moduleId) {
      const pending = [moduleId];
      while (pending.length) {
        const current = pending.pop()!;
        if (relevantModules.has(current)) continue;
        relevantModules.add(current);
        const currentManifest = BACKEND_MODULE_MANIFESTS.find((item) => item.id === current);
        for (const dependency of currentManifest?.authorizationRequires ?? []) pending.push(dependency);
      }
    }
    const errors = validateModuleAuthorizationManifests(BACKEND_MODULE_MANIFESTS)
      .filter((error) => !moduleId || relevantModules.has(error.moduleId));
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

  async diffModule(moduleId: string) {
    const manifest = BACKEND_MODULE_MANIFESTS.find((item) => item.id === moduleId);
    if (!manifest) {
      return {
        valid: false,
        moduleId,
        errors: [{ moduleId, path: 'id', message: 'Unknown backend module' }],
      };
    }
    const validation = this.validateOnly(moduleId);
    if (!validation.valid) {
      return {
        valid: false,
        moduleId,
        manifestVersion: manifest.version,
        manifestHash: this.fingerprint(manifest),
        errors: validation.errors,
      };
    }

    const declaredPermissionKeys = manifest.permissions.map((item) => item.key?.trim() || item.name.trim());
    const declaredRoleKeys = (manifest.roles ?? []).map((item) => item.key);
    const [existingPermissions, existingRoles, existingGrants, manualGrants, denyOverrides, syncState] = await Promise.all([
      this.dataSource.query(
        'SELECT "permissionKey", "isActive" FROM "permission" WHERE "moduleId" = $1',
        [moduleId],
      ),
      this.dataSource.query(
        'SELECT "moduleRoleKey", "isActive" FROM "role" WHERE "moduleId" = $1',
        [moduleId],
      ),
      this.dataSource.query(
        `SELECT COALESCE(r."moduleId", 'core') AS "targetModuleId",
          r."moduleRoleKey" AS "targetRoleKey",
          p."permissionKey" AS "permissionKey",
          g."sourceKey" AS "sourceKey"
        FROM "role_permission_grant" g
        INNER JOIN "role" r ON r."id" = g."roleId"
        INNER JOIN "permission" p ON p."id" = g."permissionId"
        WHERE g."sourceModuleId" = $1 AND g."grantType" = 'module_default'`,
        [moduleId],
      ),
      this.dataSource.query(
        `SELECT COUNT(*)::int AS "count" FROM "role_permission_grant" g
        WHERE g."grantType" = 'admin_manual'
          AND (g."roleId" IN (SELECT "id" FROM "role" WHERE "moduleId" = $1)
            OR g."permissionId" IN (SELECT "id" FROM "permission" WHERE "moduleId" = $1))`,
        [moduleId],
      ),
      this.dataSource.query(
        `SELECT COUNT(*)::int AS "count" FROM "role_permission_override" o
        WHERE o."roleId" IN (SELECT "id" FROM "role" WHERE "moduleId" = $1)
          OR o."permissionId" IN (SELECT "id" FROM "permission" WHERE "moduleId" = $1)`,
        [moduleId],
      ),
      this.dataSource.getRepository(ModuleAuthorizationSyncEntity).findOne({ where: { moduleId } }),
    ]);

    const existingPermissionKeys = new Set(existingPermissions.map((item: any) => item.permissionKey));
    const existingRoleKeys = new Set(existingRoles.map((item: any) => item.moduleRoleKey));
    const desiredGrants = normalizeModuleRoleGrants(manifest).flatMap((grant) =>
      grant.permissions.map((permissionKey) => ({
        targetModuleId: grant.targetRole.moduleId,
        targetRoleKey: grant.targetRole.key,
        permissionKey,
        sourceKey: grant.sourceKey,
      })),
    );
    const grantIdentity = (item: any) => JSON.stringify([
      item.targetModuleId,
      item.targetRoleKey,
      item.permissionKey,
      item.sourceKey,
    ]);
    const existingGrantKeys = new Set(existingGrants.map(grantIdentity));
    const desiredGrantKeys = new Set(desiredGrants.map(grantIdentity));

    return {
      valid: true,
      moduleId,
      manifestVersion: manifest.version,
      manifestHash: this.fingerprint(manifest),
      lastSync: syncState ? {
        status: syncState.syncStatus,
        manifestVersion: syncState.manifestVersion,
        manifestHash: syncState.manifestHash,
        lastSyncedAt: syncState.lastSyncedAt,
        lastError: syncState.lastError,
      } : null,
      permissions: {
        missing: manifest.permissions.filter((item) => !existingPermissionKeys.has(item.key?.trim() || item.name.trim())),
        obsolete: existingPermissions.filter((item: any) => !declaredPermissionKeys.includes(item.permissionKey)),
      },
      roles: {
        missing: (manifest.roles ?? []).filter((item) => !existingRoleKeys.has(item.key)),
        obsolete: existingRoles.filter((item: any) => !declaredRoleKeys.includes(item.moduleRoleKey)),
      },
      grants: {
        missing: desiredGrants.filter((item) => !existingGrantKeys.has(grantIdentity(item))),
        obsolete: existingGrants.filter((item: any) => !desiredGrantKeys.has(grantIdentity(item))),
      },
      preservedAdministratorState: {
        manualGrantCount: Number(manualGrants[0]?.count ?? 0),
        denyOverrideCount: Number(denyOverrides[0]?.count ?? 0),
      },
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
      const error = validation.errors.map((item) => `${item.moduleId} ${item.path}: ${item.message}`).join('; ');
      await this.recordFailure(manifest, manifestHash, actorUserId, error);
      return { moduleId, status: 'failed', manifestVersion: manifest.version, manifestHash, error };
    }

    // Role owners are reconciled before grantors. This dependency is separate
    // from runtime install dependencies and may intentionally form no cycle
    // even when modules depend on one another for business services.
    for (const dependency of manifest.authorizationRequires ?? []) {
      const dependencyResult = await this.syncModule(dependency, actorUserId);
      if (dependencyResult.status !== 'success') {
        const error = `Authorization dependency "${dependency}" failed: ${dependencyResult.error ?? 'unknown error'}`;
        await this.recordFailure(manifest, manifestHash, actorUserId, error);
        return { moduleId, status: 'failed', manifestVersion: manifest.version, manifestHash, error };
      }
    }

    try {
      const counts = await this.dataSource.transaction(async (manager) => {
        await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
          `authorization-sync:${moduleId}`,
        ]);
        const restoredPermissions = await this.syncPermissions(manager, manifest);
        await this.bindRoles(manager, manifest);
        const { restoredGrants, removedGrants } = await this.syncGrants(manager, manifest);
        await this.rebuildModuleProjections(manager, moduleId);
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
      if (!permission.moduleId && CORE_PERMISSION_KEYS.has(key)) {
        throw new Error(`Permission "${key}" is reserved for Core and cannot be claimed by module "${manifest.id}"`);
      }
      if (permission.permissionKey !== key) {
        const collision = await repository.findOne({ where: { permissionKey: key } });
        if (collision && collision.id !== permission.id) throw new Error(`Permission key "${key}" is already in use`);
        if (permission.moduleId === manifest.id && permission.permissionKey) {
          throw new Error(
            `Permission key for "${name}" is already registered as "${permission.permissionKey}". Stable keys require an explicit migration to change.`,
          );
        }
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
          scope: definition.scope ?? 'global',
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
      role.scope = definition.scope ?? 'global';
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

    // Maintain the old many-to-many table as a fail-closed effective projection.
    for (const roleId of affectedRoleIds) {
      await rebuildRolePermissionProjection(manager, roleId);
    }
    return { restoredGrants, removedGrants: obsolete.length };
  }

  private async rebuildModuleProjections(manager: EntityManager, moduleId: string): Promise<void> {
    const affectedRoles: Array<{ roleId: number | string }> = await manager.query(
      `SELECT DISTINCT g."roleId"
      FROM "role_permission_grant" g
      INNER JOIN "role" r ON r."id" = g."roleId"
      INNER JOIN "permission" p ON p."id" = g."permissionId"
      WHERE r."moduleId" = $1 OR p."moduleId" = $1 OR g."sourceModuleId" = $1`,
      [moduleId],
    );
    for (const row of affectedRoles) {
      await rebuildRolePermissionProjection(manager, Number(row.roleId));
    }
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
