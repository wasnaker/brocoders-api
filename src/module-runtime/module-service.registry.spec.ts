import { ModuleServiceRegistry } from './module-service.registry';

describe('ModuleServiceRegistry', () => {
  let registry: ModuleServiceRegistry;

  beforeEach(() => {
    registry = new ModuleServiceRegistry();
  });

  it('should resolves a public service facade for an explicitly allowed consumer', () => {
    const service = { findBranch: jest.fn().mockResolvedValue({ id: '1' }) };
    registry.register({
      providerModuleId: 'customer',
      contractId: 'customer.branch-directory',
      version: '1.2.0',
      consumers: ['equipment'],
      service,
    });

    expect(
      registry.resolve<typeof service>(
        'equipment',
        'customer.branch-directory',
        '^1.0.0',
      ),
    ).toBe(service);
  });

  it('should rejects consumers that are not in the provider allow-list', () => {
    registry.register({
      providerModuleId: 'customer',
      contractId: 'customer.branch-directory',
      version: '1.0.0',
      consumers: ['equipment'],
      service: { findBranch: jest.fn() },
    });

    expect(() =>
      registry.resolve('region', 'customer.branch-directory', '^1.0.0'),
    ).toThrow('not an authorized consumer');
  });

  it('should rejects incompatible major versions and lower provided versions', () => {
    registry.register({
      providerModuleId: 'customer',
      contractId: 'customer.branch-directory',
      version: '1.1.0',
      consumers: ['equipment'],
      service: { findBranch: jest.fn() },
    });

    expect(() =>
      registry.resolve('equipment', 'customer.branch-directory', '^2.0.0'),
    ).toThrow('Incompatible module service contract');
    expect(() =>
      registry.resolve('equipment', 'customer.branch-directory', '1.2.0'),
    ).toThrow('Incompatible module service contract');
  });

  it('should requires provider namespace and rejects conflicting duplicate contracts', () => {
    expect(() =>
      registry.register({
        providerModuleId: 'customer',
        contractId: 'equipment.branch-directory',
        version: '1.0.0',
        consumers: ['equipment'],
        service: {},
      }),
    ).toThrow('must be namespaced');

    const registration = {
      providerModuleId: 'customer',
      contractId: 'customer.branch-directory',
      version: '1.0.0',
      consumers: ['equipment'],
      service: {},
    };
    const unregister = registry.register(registration);
    expect(() =>
      registry.register({
        ...registration,
        service: {},
      }),
    ).toThrow('already registered');
    // An identical registration is idempotent and returns a disposer.
    const unregisterDuplicate = registry.register(registration);
    unregisterDuplicate();
    expect(registry.listContracts()).toHaveLength(1);
    unregister();
    expect(registry.listContracts()).toHaveLength(0);
  });

  it('should unregisters all contracts owned by a module', () => {
    registry.register({
      providerModuleId: 'customer',
      contractId: 'customer.branch-directory',
      version: '1.0.0',
      consumers: ['equipment'],
      service: {},
    });
    registry.register({
      providerModuleId: 'customer',
      contractId: 'customer.customer-directory',
      version: '1.0.0',
      consumers: ['equipment'],
      service: {},
    });

    expect(registry.unregisterModule('customer')).toBe(2);
    expect(registry.listContracts()).toEqual([]);
  });

  it('should returns an unregister callback scoped to its own registration', () => {
    const unregister = registry.register({
      providerModuleId: 'customer',
      contractId: 'customer.branch-directory',
      version: '1.0.0',
      consumers: ['equipment'],
      service: {},
    });

    unregister();
    expect(registry.listContracts()).toEqual([]);
  });
});
