import { CoreAuthorizationRegistryService } from './core-authorization-registry.service';

describe('CoreAuthorizationRegistryService', () => {
  it('resolves Roles and Permissions by stable key, not database ID', async () => {
    const roles: any = { findOne: jest.fn().mockResolvedValue({
      moduleId: 'customer', moduleRoleKey: 'customer.manager',
      name: 'Customer Manager', scope: 'customer', isActive: true,
    }) };
    const permissions: any = { findOne: jest.fn().mockResolvedValue({
      permissionKey: 'equipment.read', name: 'Read equipment',
      moduleId: 'equipment', isActive: true,
    }) };
    const lifecycle: any = { findOne: jest.fn().mockResolvedValue({ moduleId: 'customer', status: 'active' }) };
    const authorization: any = {
      hasScopedModulePermission: jest.fn().mockResolvedValue(true),
      resolveModuleScopes: jest.fn().mockResolvedValue({ global: false, scopes: [{ type: 'branch', id: '42' }] }),
    };
    const service = new CoreAuthorizationRegistryService(roles, permissions, {} as any, lifecycle, authorization);
    await expect(service.findRole('customer', 'customer.manager')).resolves.toEqual({
      moduleId: 'customer', key: 'customer.manager',
      name: 'Customer Manager', scope: 'customer', active: true,
    });
    await expect(service.findPermission('equipment.read')).resolves.toEqual({
      key: 'equipment.read', name: 'Read equipment',
      moduleId: 'equipment', active: true,
    });
    expect(lifecycle.findOne).toHaveBeenCalledWith(expect.objectContaining({
      where: { moduleId: 'equipment', status: 'active' },
    }));
    await expect(service.hasScopedPermission({
      userId: 7,
      roleIds: [10],
      moduleId: 'equipment',
      permissionKey: 'equipment.read',
      targetScopes: [{ type: 'branch', id: '42' }],
    })).resolves.toBe(true);
    expect(authorization.hasScopedModulePermission).toHaveBeenCalledWith(
      7, [10], 'equipment', 'equipment.read', [{ type: 'branch', id: '42' }],
    );
  });
});
