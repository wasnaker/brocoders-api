import { ModuleAuthorizationService } from './module-authorization.service';

describe('ModuleAuthorizationService.hasScopedModulePermission', () => {
  const rolesRepository = { find: jest.fn() };
  const assignmentsRepository = { find: jest.fn() };
  let service: ModuleAuthorizationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ModuleAuthorizationService(
      rolesRepository as never,
      assignmentsRepository as never,
    );
  });

  const customerBranchAdmin = (permissions: string[]) => ({
    id: 10,
    name: 'Customer Branch Admin',
    moduleId: 'customer',
    moduleRoleKey: 'customer-branch-admin',
    isActive: true,
    permissions: permissions.map((name) => ({
      name,
      moduleId: 'customer',
      isActive: true,
    })),
  });

  it('allows when the same role has the permission and matching assignment', async () => {
    rolesRepository.find.mockResolvedValue([
      customerBranchAdmin(['read:branch']),
    ]);
    assignmentsRepository.find.mockResolvedValue([
      {
        userId: 7,
        moduleId: 'customer',
        roleKey: 'customer-branch-admin',
        scopeType: 'branch',
        scopeId: '43',
      },
    ]);

    await expect(
      service.hasScopedModulePermission(
        7,
        [10],
        'customer',
        'read:branch',
        [
          { type: 'branch', id: '43' },
          { type: 'customer', id: '17' },
        ],
      ),
    ).resolves.toBe(true);
  });

  it('does not combine a permission from one role with another role assignment', async () => {
    rolesRepository.find.mockResolvedValue([
      customerBranchAdmin(['read:branch']),
      {
        ...customerBranchAdmin([]),
        id: 11,
        name: 'Customer',
        moduleRoleKey: 'customer',
      },
    ]);
    assignmentsRepository.find
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          userId: 7,
          moduleId: 'customer',
          roleKey: 'customer',
          scopeType: 'branch',
          scopeId: '43',
        },
      ]);

    await expect(
      service.hasScopedModulePermission(
        7,
        [10, 11],
        'customer',
        'read:branch',
        [{ type: 'branch', id: '43' }],
      ),
    ).resolves.toBe(false);
  });

  it('denies when the role has permission but no assignment', async () => {
    rolesRepository.find.mockResolvedValue([
      customerBranchAdmin(['read:branch']),
    ]);
    assignmentsRepository.find.mockResolvedValue([]);

    await expect(
      service.hasScopedModulePermission(
        7,
        [10],
        'customer',
        'read:branch',
        [{ type: 'branch', id: '43' }],
      ),
    ).resolves.toBe(false);
  });

  it('allows only an explicit core wildcard administrator', async () => {
    rolesRepository.find.mockResolvedValue([
      {
        id: 1,
        name: 'System Administrator',
        moduleId: null,
        moduleRoleKey: null,
        isActive: true,
        permissions: [{ name: '*', moduleId: null, isActive: true }],
      },
    ]);

    await expect(
      service.hasScopedModulePermission(
        7,
        [1],
        'customer',
        'update:branch',
        [{ type: 'branch', id: '43' }],
      ),
    ).resolves.toBe(true);
    expect(assignmentsRepository.find).not.toHaveBeenCalled();
  });

  it('does not treat an unregistered non-admin role as a global bypass', async () => {
    rolesRepository.find.mockResolvedValue([
      {
        id: 2,
        name: 'Customer Support',
        moduleId: null,
        moduleRoleKey: null,
        isActive: true,
        permissions: [{ name: 'read:branch', moduleId: null, isActive: true }],
      },
    ]);

    await expect(
      service.hasScopedModulePermission(
        7,
        [2],
        'customer',
        'read:branch',
        [{ type: 'branch', id: '43' }],
      ),
    ).resolves.toBe(false);
    expect(assignmentsRepository.find).not.toHaveBeenCalled();
  });
});
