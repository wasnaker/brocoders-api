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
    const service = new CoreAuthorizationRegistryService(roles, permissions, {} as any, lifecycle);
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
  });
});
