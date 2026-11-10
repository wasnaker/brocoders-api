import { ModuleAuthorizationService } from './module-authorization.service';
import { RoleEntity } from '../roles/infrastructure/persistence/relational/entities/role.entity';
import { PermissionEntity } from '../permissions/infrastructure/persistence/relational/entities/permission.entity';
import { ModuleRoleAssignmentEntity } from './module-role-assignment.entity';

describe('ModuleAuthorizationService grant query path', () => {
  const roles = { find: jest.fn(), findOne: jest.fn() };
  const assignments = { find: jest.fn(), findOne: jest.fn(), create: jest.fn((value) => value), save: jest.fn() };
  const permissions = { findOne: jest.fn() };
  const grants = { findOne: jest.fn() };
  const overrides = { findOne: jest.fn() };
  const lifecycle = { findOne: jest.fn() };
  const dataSource = { transaction: jest.fn() };
  let service: ModuleAuthorizationService;

  const customerRole = {
    id: 10,
    name: 'Customer Branch Admin',
    moduleId: 'customer',
    moduleRoleKey: 'customer-branch-admin',
    scope: 'branch',
    isActive: true,
  };
  const equipmentPermission = {
    id: 81,
    name: 'read:equipment',
    permissionKey: 'read:equipment',
    moduleId: 'equipment',
    isActive: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    roles.find.mockResolvedValue([customerRole]);
    roles.findOne.mockResolvedValue({ id: 31 });
    assignments.find.mockResolvedValue([{
      userId: 7,
      moduleId: 'customer',
      roleKey: 'customer-branch-admin',
      scopeType: 'branch',
      scopeId: '43',
    }]);
    assignments.findOne.mockResolvedValue(null);
    assignments.create.mockImplementation((value) => value);
    assignments.save.mockResolvedValue(undefined);
    permissions.findOne.mockImplementation(({ where }: any) => {
      if (Array.isArray(where)) {
        if (where.some((item) => item.moduleId === 'equipment')) return equipmentPermission;
        return { id: 20, name: 'read:branch', permissionKey: 'read:branch', moduleId: 'customer', isActive: true };
      }
      if (where?.name === '*') return null;
      return null;
    });
    grants.findOne.mockResolvedValue({ id: 100 });
    overrides.findOne.mockResolvedValue(null);
    lifecycle.findOne.mockResolvedValue({ moduleId: 'customer', status: 'active' });
    service = new ModuleAuthorizationService(
      roles as never,
      assignments as never,
      permissions as never,
      grants as never,
      overrides as never,
      lifecycle as never,
      dataSource as never,
    );
  });

  it('should allows Equipment permission granted by a Customer-owned Role using Customer scope assignment', async () => {
    lifecycle.findOne.mockResolvedValue({ moduleId: 'equipment', status: 'active' });
    await expect(service.hasScopedModulePermission(
      7,
      [10],
      'equipment',
      'read:equipment',
      [{ type: 'branch', id: '43' }],
    )).resolves.toBe(true);
    expect(assignments.find).toHaveBeenCalledWith({
      where: { userId: 7, moduleId: 'customer', roleKey: 'customer-branch-admin' },
    });
  });

  it('should fails closed when the permission-owning module is not active', async () => {
    lifecycle.findOne.mockResolvedValue(null);
    await expect(service.hasScopedModulePermission(
      7, [10], 'equipment', 'read:equipment', [{ type: 'branch', id: '43' }],
    )).resolves.toBe(false);
    expect(grants.findOne).not.toHaveBeenCalled();
  });

  it('should fails closed when an administrator deny override exists for the Role-Permission pair', async () => {
    overrides.findOne.mockResolvedValue({ effect: 'deny' });
    await expect(service.hasScopedModulePermission(
      7, [10], 'equipment', 'read:equipment', [{ type: 'branch', id: '43' }],
    )).resolves.toBe(false);
  });

  it('should does not allow a matching permission grant without a matching scope assignment', async () => {
    assignments.find.mockResolvedValue([]);
    await expect(service.hasScopedModulePermission(
      7, [10], 'equipment', 'read:equipment', [{ type: 'branch', id: '43' }],
    )).resolves.toBe(false);
  });

  it('should resolves only the scope assigned to the Customer-owned Role', async () => {
    await expect(service.resolveModuleScopes(
      7, [10], 'equipment', 'read:equipment',
    )).resolves.toEqual({
      global: false,
      scopes: [{ type: 'branch', id: '43' }],
    });
  });

  it('should treats an explicit Core Role grant as global without module assignments', async () => {
    roles.find.mockResolvedValue([{
      id: 1, name: 'Admin', moduleId: null, moduleRoleKey: 'admin', scope: 'global', isActive: true,
    }]);
    permissions.findOne.mockImplementation(({ where }: any) =>
      Array.isArray(where) ? equipmentPermission : null,
    );
    grants.findOne.mockResolvedValue({ id: 1, roleId: 1, permissionId: 81 });
    overrides.findOne.mockResolvedValue(null);

    await expect(service.hasScopedModulePermission(
      7, [1], 'equipment', 'read:equipment', [{ type: 'branch', id: '43' }],
    )).resolves.toBe(true);
    expect(assignments.find).not.toHaveBeenCalled();
    await expect(service.resolveModuleScopes(
      7, [1], 'equipment', 'read:equipment',
    )).resolves.toEqual({ global: true, scopes: [] });
  });

  it('should allows a Core wildcard Role when no specific deny override exists', async () => {
    roles.find.mockResolvedValue([{ id: 1, name: 'Admin', moduleId: null, moduleRoleKey: 'admin', isActive: true }]);
    permissions.findOne.mockImplementation(({ where }: any) => {
      if (Array.isArray(where)) return equipmentPermission;
      if (where?.name === '*') return { id: 99, name: '*', moduleId: null, isActive: true };
      return null;
    });
    overrides.findOne.mockResolvedValue(null);
    await expect(service.hasScopedModulePermission(
      7, [1], 'equipment', 'read:equipment', [{ type: 'branch', id: '43' }],
    )).resolves.toBe(true);
    expect(assignments.find).not.toHaveBeenCalled();
  });

  it('should applies a specific deny override before a Core wildcard grant', async () => {
    roles.find.mockResolvedValue([{ id: 1, name: 'Admin', moduleId: null, moduleRoleKey: 'admin', isActive: true }]);
    permissions.findOne.mockImplementation(({ where }: any) => {
      if (Array.isArray(where)) return equipmentPermission;
      if (where?.name === '*') return { id: 99, name: '*', moduleId: null, isActive: true };
      return null;
    });
    overrides.findOne.mockImplementation(({ where }: any) =>
      where.permissionId === 81 ? { effect: 'deny' } : null,
    );
    await expect(service.hasScopedModulePermission(
      7, [1], 'equipment', 'read:equipment', [{ type: 'branch', id: '43' }],
    )).resolves.toBe(false);
  });

  it('should applies a specific deny to a Core wildcard Role in the compatibility query', async () => {
    roles.findOne.mockResolvedValue({ id: 1, moduleId: null, isActive: true });
    permissions.findOne.mockImplementation(({ where }: any) => {
      if (Array.isArray(where)) return equipmentPermission;
      if (where?.name === '*') return { id: 99, name: '*', moduleId: null, isActive: true };
      return null;
    });
    grants.findOne.mockResolvedValue({ id: 101 });
    overrides.findOne.mockImplementation(({ where }: any) =>
      where.permissionId === 81 ? { effect: 'deny' } : null,
    );
    await expect(service.hasPermission(1, 'read:equipment')).resolves.toBe(false);
  });

  it('should fails closed for scoped module Roles in the unscoped compatibility query', async () => {
    roles.findOne.mockResolvedValue({
      id: 10, moduleId: 'customer', moduleRoleKey: 'customer-branch-admin', isActive: true,
    });
    await expect(service.hasPermission(10, 'read:equipment')).resolves.toBe(false);
    expect(grants.findOne).not.toHaveBeenCalled();
  });

  it('should uses grants and deny overrides for the compatibility permission check', async () => {
    roles.findOne.mockResolvedValue({ id: 10, moduleId: null, moduleRoleKey: 'admin', isActive: true });
    permissions.findOne.mockResolvedValue({
      id: 20, name: 'read:branch', permissionKey: 'read:branch',
      moduleId: 'customer', isActive: true,
    });
    overrides.findOne.mockResolvedValue({ effect: 'deny' });
    await expect(service.hasPermission(10, 'read:branch')).resolves.toBe(false);
  });
});

describe('ModuleAuthorizationService.assignModuleRole', () => {
  const roles = { findOne: jest.fn() };
  const assignments = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(),
  };
  const lifecycle = { findOne: jest.fn() };
  let service: ModuleAuthorizationService;

  beforeEach(() => {
    jest.clearAllMocks();
    roles.findOne.mockResolvedValue({ id: 31, scope: 'branch' });
    lifecycle.findOne.mockResolvedValue({ moduleId: 'customer', status: 'active' });
    assignments.findOne.mockResolvedValue(null);
    service = new ModuleAuthorizationService(
      roles as never,
      assignments as never,
      {} as never,
      {} as never,
      {} as never,
      lifecycle as never,
      {} as never,
    );
  });

  it('should creates a scoped assignment for a registered Role', async () => {
    await service.assignModuleRole({
      userId: 101,
      moduleId: 'customer',
      roleKey: 'customer-branch-admin',
      scopeType: 'branch',
      scopeId: '42',
      assignedBy: 12,
    });
    expect(assignments.save).toHaveBeenCalledWith(expect.objectContaining({
      userId: 101,
      moduleId: 'customer',
      roleKey: 'customer-branch-admin',
      scopeType: 'branch',
      scopeId: '42',
      assignedBy: 12,
    }));
  });

  it('should reactivates a retained assignment instead of inserting a duplicate', async () => {
    const existing = { id: 55, isActive: false };
    assignments.findOne.mockResolvedValue(existing);
    await service.assignModuleRole({
      userId: 101,
      moduleId: 'customer',
      roleKey: 'customer-branch-admin',
      scopeType: 'branch',
      scopeId: '42',
      assignedBy: 12,
    });
    expect(existing.isActive).toBe(true);
    expect(assignments.save).toHaveBeenCalledWith(existing);
  });

  it('should does not create a duplicate assignment', async () => {
    assignments.findOne.mockResolvedValue({ id: 55 });
    await service.assignModuleRole({
      userId: 101,
      moduleId: 'customer',
      roleKey: 'customer-branch-admin',
      scopeType: 'branch',
      scopeId: '42',
      assignedBy: 12,
    });
    expect(assignments.save).not.toHaveBeenCalled();
  });

  it('should rejects a scope type that does not match the Role definition', async () => {
    await expect(service.assignModuleRole({
      userId: 101,
      moduleId: 'customer',
      roleKey: 'customer-branch-admin',
      scopeType: 'customer',
      scopeId: '42',
      assignedBy: 12,
    })).rejects.toThrow('Module role scope does not match its manifest definition');
    expect(assignments.save).not.toHaveBeenCalled();
  });
});


describe('ModuleAuthorizationService lifecycle projection', () => {
  it('should restores retained Role assignments when a module is reactivated', async () => {
    const assignments: any = { update: jest.fn() };
    const manager: any = {
      getRepository: () => assignments,
      query: jest.fn().mockResolvedValue([]),
    };
    const dataSource: any = {
      transaction: jest.fn(async (callback: (value: any) => Promise<void>) => callback(manager)),
    };
    const service = new ModuleAuthorizationService(
      {} as any, assignments, {} as any, {} as any, {} as any, {} as any, dataSource,
    );

    await service.restoreModule('customer');

    expect(assignments.update).toHaveBeenCalledWith({ moduleId: 'customer' }, { isActive: true });
  });

  it('should removes legacy effective permissions when a module is deactivated', async () => {
    const roles: any = { update: jest.fn() };
    const permissions: any = { update: jest.fn() };
    const assignments: any = { delete: jest.fn(), update: jest.fn() };
    const manager: any = {
      getRepository: (entity: any) => {
        if (entity === RoleEntity) return roles;
        if (entity === PermissionEntity) return permissions;
        if (entity === ModuleRoleAssignmentEntity) return assignments;
        throw new Error('Unexpected repository');
      },
      query: jest.fn((sql: string) =>
        sql.includes('SELECT DISTINCT g."roleId"')
          ? Promise.resolve([{ roleId: 3 }])
          : Promise.resolve([]),
      ),
    };
    const dataSource: any = {
      transaction: jest.fn(async (callback: (value: any) => Promise<void>) => callback(manager)),
    };
    const service = new ModuleAuthorizationService(
      {} as any, assignments, {} as any, {} as any, {} as any, {} as any, dataSource,
    );

    await service.unregisterModule('equipment');

    expect(assignments.update).toHaveBeenCalledWith({ moduleId: 'equipment' }, { isActive: false });
    expect(roles.update).toHaveBeenCalledWith({ moduleId: 'equipment' }, { isActive: false });
    expect(permissions.update).toHaveBeenCalledWith({ moduleId: 'equipment' }, { isActive: false });
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining('permission_lifecycle'),
      [3],
    );
  });
});
