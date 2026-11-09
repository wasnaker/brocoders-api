import { CoreAuthorizationRegistryService } from './core-authorization-registry.service';

describe('CoreAuthorizationRegistryService', () => {
  it('resolves Roles and Permissions only through stable keys', async () => {
    const roles: any = {
      findOne: jest.fn().mockResolvedValue({
        moduleId: 'customer',
        moduleRoleKey: 'customer.manager',
        name: 'Customer Manager',
        isActive: true,
      }),
    };
    const permissions: any = {
      findOne: jest.fn().mockResolvedValue({
        permissionKey: 'equipment.read',
        name: 'Read equipment',
        moduleId: 'equipment',
        isActive: true,
      }),
    };
    const grants: any = {};
    const service = new CoreAuthorizationRegistryService(roles, permissions, grants);

    await expect(service.findRole('customer', 'customer.manager')).resolves.toEqual({
      moduleId: 'customer',
      key: 'customer.manager',
      name: 'Customer Manager',
      active: true,
    });
    await expect(service.findPermission('equipment.read')).resolves.toEqual({
      key: 'equipment.read',
      name: 'Read equipment',
      moduleId: 'equipment',
      active: true,
    });
    expect(roles.findOne).toHaveBeenCalledWith(expect.objectContaining({
      where: { moduleId: 'customer', moduleRoleKey: 'customer.manager', isActive: true },
    }));
    expect(permissions.findOne).toHaveBeenCalledWith(expect.objectContaining({
      where: { permissionKey: 'equipment.read', isActive: true },
    }));
  });
});
