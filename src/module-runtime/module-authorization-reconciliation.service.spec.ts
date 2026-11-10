import { ModuleAuthorizationReconciliationService } from './module-authorization-reconciliation.service';
import { BackendModuleManifest } from './module-manifest.type';
import { PermissionEntity } from '../permissions/infrastructure/persistence/relational/entities/permission.entity';
import { RoleEntity } from '../roles/infrastructure/persistence/relational/entities/role.entity';
import { RolePermissionGrantEntity } from './role-permission-grant.entity';
import { RolePermissionOverrideEntity } from './role-permission-override.entity';
import { ModuleAuthorizationSyncEntity } from './module-authorization-sync.entity';
import { AuthorizationAuditLogEntity } from './authorization-audit-log.entity';
import { BACKEND_MODULE_MANIFESTS } from './module-manifest.registry';

const fixture = (input: Partial<BackendModuleManifest> & Pick<BackendModuleManifest, 'id'>): BackendModuleManifest => ({
  id: input.id,
  version: input.version ?? '1.0.0',
  capabilities: input.capabilities ?? ['api'],
  permissions: input.permissions ?? [],
  roles: input.roles ?? [],
  roleGrants: input.roleGrants,
  authorizationRequires: input.authorizationRequires ?? [],
  requires: input.requires ?? [],
});

describe('ModuleAuthorizationReconciliationService', () => {
  it('should validate-only inspects installed manifests without opening a transaction', () => {
    const dataSource = { transaction: jest.fn() };
    const service = new ModuleAuthorizationReconciliationService(dataSource as never);
    const result = service.validateOnly();
    expect(result).toEqual(expect.objectContaining({ valid: true, errors: [] }));
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('should reports an unknown module without writing synchronization state', () => {
    const dataSource = { transaction: jest.fn() };
    const service = new ModuleAuthorizationReconciliationService(dataSource as never);
    const result = service.validateOnly('unknown-module');
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toBe('Unknown backend module');
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('should validates the Customer, Equipment, and Region manifest dependency graph', () => {
    const result = new ModuleAuthorizationReconciliationService({} as never).validateOnly();
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(BACKEND_MODULE_MANIFESTS.find((item) => item.id === 'equipment')?.authorizationRequires).toContain('customer');
    expect(BACKEND_MODULE_MANIFESTS.find((item) => item.id === 'region')?.authorizationRequires).toContain('customer');
  });

  it('should restores missing permissions and deactivates only obsolete permissions owned by the module', async () => {
    const manifest = fixture({
      id: 'equipment',
      permissions: [{ key: 'equipment.read', name: 'equipment.read', description: 'Read equipment' }],
    });
    const repository: any = {
      findOne: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.roleId === 10 ? { id: 1 } : null)),
      create: jest.fn((value) => value),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const manager: any = {
      getRepository: jest.fn(() => repository),
      query: jest.fn().mockResolvedValue([]),
    };
    const service = new ModuleAuthorizationReconciliationService({} as never);

    await (service as any).syncPermissions(manager, manifest);

    expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({
      name: 'equipment.read',
      permissionKey: 'equipment.read',
      moduleId: 'equipment',
      isActive: true,
    }));
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE "moduleId" = $1'),
      ['equipment', ['equipment.read']],
    );
  });

  it('should rejects silent mutation of a permission stable key', async () => {
    const manifest = fixture({
      id: 'equipment',
      permissions: [{ key: 'equipment.read.v2', name: 'read:equipment', description: 'Read equipment' }],
    });
    const existing = Object.assign(new PermissionEntity(), {
      id: 8, name: 'read:equipment', permissionKey: 'read:equipment',
      moduleId: 'equipment', isActive: true,
    });
    const repository: any = {
      findOne: jest.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(null),
      create: jest.fn((value) => value),
      save: jest.fn(),
    };
    const manager: any = {
      getRepository: jest.fn(() => repository),
      query: jest.fn(),
    };
    const service = new ModuleAuthorizationReconciliationService({} as never);

    await expect((service as any).syncPermissions(manager, manifest))
      .rejects.toThrow('Stable keys require an explicit migration to change');
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('should does not allow a module to claim a Core-owned permission', async () => {
    const manifest = fixture({
      id: 'equipment',
      permissions: [{ key: 'read:user', name: 'read:user', description: 'Read users' }],
    });
    const corePermission = Object.assign(new PermissionEntity(), {
      id: 2, name: 'read:user', permissionKey: 'read:user', moduleId: null, isActive: true,
    });
    const repository: any = {
      findOne: jest.fn()
        .mockResolvedValueOnce(corePermission),
      create: jest.fn((value) => value),
      save: jest.fn(),
    };
    const manager: any = {
      getRepository: jest.fn(() => repository),
      query: jest.fn(),
    };
    const service = new ModuleAuthorizationReconciliationService({} as never);

    await expect((service as any).syncPermissions(manager, manifest))
      .rejects.toThrow('reserved for Core');
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('should restores cross-module defaults and removes only obsolete defaults from this grantor', async () => {
    const manifest = BACKEND_MODULE_MANIFESTS.find((item) => item.id === 'equipment')!;
    const roles: any = {
      findOne: jest.fn().mockImplementation(({ where }) => Promise.resolve({
        id: where.moduleRoleKey === 'customer' ? 10 : 11,
        moduleId: 'customer',
        moduleRoleKey: where.moduleRoleKey,
      })),
    };
    const permissions: any = {
      findOne: jest.fn().mockResolvedValue({
        id: 81, permissionKey: 'read:equipment', moduleId: 'equipment', isActive: true,
      }),
    };
    const grants: any = {
      findOne: jest.fn().mockResolvedValue(null),
      insert: jest.fn(),
      find: jest.fn().mockResolvedValue([
        { id: 1, roleId: 10, permissionId: 81, sourceKey: 'role-grant:customer' },
        { id: 2, roleId: 99, permissionId: 90, sourceKey: 'obsolete-grant' },
      ]),
      delete: jest.fn(),
    };
    const manager: any = {
      getRepository: jest.fn((entity) => {
        if (entity === RoleEntity) return roles;
        if (entity === PermissionEntity) return permissions;
        if (entity === RolePermissionGrantEntity) return grants;
        if (entity === RolePermissionOverrideEntity) throw new Error('deny overrides must not be reconciled');
        return undefined;
      }),
      query: jest.fn().mockResolvedValue([{ permissionId: 81 }]),
    };
    const service = new ModuleAuthorizationReconciliationService({} as never);

    const result = await (service as any).syncGrants(manager, manifest);

    expect(result).toEqual({ restoredGrants: 1, removedGrants: 1 });
    expect(grants.insert).toHaveBeenCalledTimes(1);
    expect(grants.insert).toHaveBeenCalledWith(expect.objectContaining({
      roleId: 11,
      permissionId: 81,
      grantType: 'module_default',
      sourceModuleId: 'equipment',
      sourceKey: 'role-grant:customer-branch-admin',
    }));
    expect(grants.delete).toHaveBeenCalledWith([2]);
    expect(grants.find).toHaveBeenCalledWith(expect.objectContaining({
      where: { sourceModuleId: 'equipment', grantType: 'module_default' },
    }));
    expect(manager.getRepository).not.toHaveBeenCalledWith(RolePermissionOverrideEntity);
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining('FOR UPDATE'),
      [10],
    );
  });

  it('should returns a read-only diff with manual grants and deny overrides preserved', async () => {
    const dataSource: any = {
      query: jest.fn((sql: string) => {
        if (sql.includes('FROM "permission"')) return Promise.resolve([{ permissionKey: 'read:customer', isActive: true }]);
        if (sql.includes('FROM "role"')) return Promise.resolve([]);
        if (sql.includes('FROM "role_permission_grant" g') && sql.includes('admin_manual')) return Promise.resolve([{ count: 2 }]);
        if (sql.includes('FROM "role_permission_override"')) return Promise.resolve([{ count: 1 }]);
        return Promise.resolve([]);
      }),
      getRepository: jest.fn(() => ({ findOne: jest.fn().mockResolvedValue({
        syncStatus: 'success', manifestVersion: '0.1.3', manifestHash: 'abc',
      }) })),
      transaction: jest.fn(),
    };
    const service = new ModuleAuthorizationReconciliationService(dataSource);
    const result = await service.diffModule('customer');

    expect(result.valid).toBe(true);
    expect(result.permissions.missing.length).toBeGreaterThan(0);
    expect(result.grants.missing).toBeDefined();
    expect(result.preservedAdministratorState).toEqual({
      manualGrantCount: 2,
      denyOverrideCount: 1,
    });
    expect(result.lastSync.status).toBe('success');
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('should syncs all manifests in authorization dependency order', async () => {
    const service = new ModuleAuthorizationReconciliationService({} as never);
    const sync = jest.spyOn(service, 'syncModule').mockImplementation(async (moduleId) => ({
      moduleId,
      status: 'success',
      manifestVersion: '1.0.0',
      manifestHash: 'test',
    }));

    const results = await service.syncAll();

    expect(results).toHaveLength(BACKEND_MODULE_MANIFESTS.length);
    const order = sync.mock.calls.map(([moduleId]) => moduleId);
    expect(order.indexOf('customer')).toBeLessThan(order.indexOf('equipment'));
    expect(order.indexOf('customer')).toBeLessThan(order.indexOf('region'));
  });

  it('should records a failed sync after the module transaction rolls back', async () => {
    const service = new ModuleAuthorizationReconciliationService({} as never);
    jest.spyOn(service as any, 'syncPermissions').mockRejectedValue(new Error('permission write failed'));
    const syncState = { upsert: jest.fn() };
    const audit = { insert: jest.fn() };
    const manager: any = {
      query: jest.fn().mockResolvedValue([]),
      getRepository: jest.fn((entity) => {
        if (entity === ModuleAuthorizationSyncEntity) return syncState;
        if (entity === AuthorizationAuditLogEntity) return audit;
        return undefined;
      }),
    };
    const dataSource: any = {
      transaction: jest.fn((callback: (value: any) => Promise<any>) => callback(manager)),
    };
    (service as any).dataSource = dataSource;

    const result = await service.syncModule('customer');

    expect(result).toEqual(expect.objectContaining({
      status: 'failed',
      error: 'permission write failed',
    }));
    expect(dataSource.transaction).toHaveBeenCalledTimes(2);
    expect(syncState.upsert).toHaveBeenCalledTimes(1);
    expect(syncState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ syncStatus: 'failed', lastError: 'permission write failed' }),
      ['moduleId'],
    );
    expect(audit.insert).toHaveBeenCalledWith(expect.objectContaining({
      action: 'manifest.sync_failed',
    }));
  });

  it('should uses one PostgreSQL advisory transaction lock for a module sync', async () => {
    const service = new ModuleAuthorizationReconciliationService({} as never);
    jest.spyOn(service as any, 'syncPermissions').mockResolvedValue(0);
    jest.spyOn(service as any, 'bindRoles').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'syncGrants').mockResolvedValue({ restoredGrants: 0, removedGrants: 0 });
    const syncState = { upsert: jest.fn() };
    const audit = { insert: jest.fn() };
    const manager: any = {
      query: jest.fn().mockResolvedValue([]),
      getRepository: jest.fn((entity) => {
        if (entity === ModuleAuthorizationSyncEntity) return syncState;
        if (entity === AuthorizationAuditLogEntity) return audit;
        return undefined;
      }),
    };
    const dataSource: any = {
      transaction: jest.fn(async (callback: (value: any) => Promise<any>) => callback(manager)),
    };
    (service as any).dataSource = dataSource;

    const result = await service.syncModule('customer');

    expect(result.status).toBe('success');
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(manager.query).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      ['authorization-sync:customer'],
    );
    expect(syncState.upsert).toHaveBeenCalledTimes(1);
    expect(audit.insert).toHaveBeenCalledTimes(1);
  });
});
