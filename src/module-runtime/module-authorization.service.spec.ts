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

  it('allows an administrator-created core role only with its own explicit scope assignment', async () => {
    rolesRepository.find.mockResolvedValue([
      {
        id: 22,
        name: 'Custom Branch Supervisor',
        moduleId: null,
        moduleRoleKey: null,
        isActive: true,
        permissions: [
          { name: 'read:branch', moduleId: 'customer', isActive: true },
        ],
      },
    ]);
    assignmentsRepository.find.mockResolvedValue([
      {
        userId: 7,
        moduleId: 'customer',
        roleKey: 'core-role:22',
        scopeType: 'branch',
        scopeId: '43',
      },
    ]);

    await expect(
      service.hasScopedModulePermission(
        7,
        [22],
        'customer',
        'read:branch',
        [{ type: 'branch', id: '43' }],
      ),
    ).resolves.toBe(true);
  });

  it('does not give an administrator-created role global access from permission alone', async () => {
    rolesRepository.find.mockResolvedValue([
      {
        id: 23,
        name: 'Custom Branch Supervisor',
        moduleId: null,
        moduleRoleKey: null,
        isActive: true,
        permissions: [
          { name: 'read:branch', moduleId: 'customer', isActive: true },
        ],
      },
    ]);
    assignmentsRepository.find.mockResolvedValue([]);

    await expect(
      service.hasScopedModulePermission(
        7,
        [23],
        'customer',
        'read:branch',
        [{ type: 'branch', id: '43' }],
      ),
    ).resolves.toBe(false);
  });

  it('does not allow a customer-scoped role to create a new customer globally', async () => {
    rolesRepository.find.mockResolvedValue([
      {
        id: 12,
        name: 'Customer Admin',
        moduleId: 'customer',
        moduleRoleKey: 'customer-admin',
        isActive: true,
        permissions: [
          { name: 'create:customer', moduleId: 'customer', isActive: true },
        ],
      },
    ]);
    assignmentsRepository.find.mockResolvedValue([
      {
        userId: 7,
        moduleId: 'customer',
        roleKey: 'customer-admin',
        scopeType: 'customer',
        scopeId: '16',
      },
    ]);

    await expect(
      service.hasScopedModulePermission(
        7,
        [12],
        'customer',
        'create:customer',
        [],
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

  it('returns only scopes from roles that own the requested permission', async () => {
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
      {
        userId: 7,
        moduleId: 'customer',
        roleKey: 'customer-branch-admin',
        scopeType: 'customer',
        scopeId: '17',
      },
    ]);

    await expect(
      service.resolveModuleScopes(7, [10], 'customer', 'read:branch'),
    ).resolves.toEqual({
      global: false,
      scopes: [{ type: 'branch', id: '43' }],
    });
  });

  it('resolves global list access only from the explicit core wildcard', async () => {
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
      service.resolveModuleScopes(7, [1], 'customer', 'read:branch'),
    ).resolves.toEqual({ global: true, scopes: [] });
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
