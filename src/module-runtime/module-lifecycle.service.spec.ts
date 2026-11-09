import { ModuleLifecycleService } from './module-lifecycle.service';
import { ModuleLifecycleEntity } from './module-lifecycle.entity';
import { ModuleServiceRegistry } from './module-service.registry';

describe('ModuleLifecycleService', () => {
  let service: ModuleLifecycleService;
  let record: ModuleLifecycleEntity;
  let modules: any;
  let hooks: { unregisterModule: jest.Mock };
  let services: { unregisterModule: jest.Mock; resolve: jest.Mock };
  let authorization: { restoreModule: jest.Mock; unregisterModule: jest.Mock };
  let disposer: jest.Mock;

  beforeEach(() => {
    record = {
      moduleId: 'customer',
      packageName: '@wasnaker/module-customer',
      version: '1.0.0',
      status: 'installed',
      metadata: {},
      dataRetention: 'retained',
    } as ModuleLifecycleEntity;
    modules = {
      findOne: jest.fn().mockReturnValue(Promise.resolve(record)),
      find: jest.fn().mockReturnValue(Promise.resolve([])),
      save: jest.fn().mockImplementation((value) => {
        record = { ...record, ...value };
        return Promise.resolve(record);
      }),
      update: jest.fn().mockImplementation((_where, patch) => {
        record = { ...record, ...patch };
        return Promise.resolve({ affected: 1 });
      }),
      create: jest.fn((value) => value),
    };
    hooks = { unregisterModule: jest.fn() };
    services = {
      unregisterModule: jest.fn(),
      resolve: jest.fn().mockReturnValue({}),
    };
    disposer = jest.fn();
    service = new ModuleLifecycleService(
      modules,
      hooks as never,
      services as never,
      authorization as never,
    );
  });

  it('should activate once and remove owned runtime contributions on deactivation', async () => {
    const activate = jest.fn().mockResolvedValue(disposer);
    service.registerRuntimeAdapter('customer', { activate });

    await expect(service.activate('customer')).resolves.toMatchObject({
      status: 'active',
    });
    await expect(service.activate('customer')).resolves.toMatchObject({
      status: 'active',
    });
    expect(activate).toHaveBeenCalledTimes(1);

    await expect(service.deactivate('customer')).resolves.toMatchObject({
      status: 'inactive',
    });
    expect(disposer).toHaveBeenCalledTimes(1);
    expect(hooks.unregisterModule).toHaveBeenCalledWith('customer');
    expect(services.unregisterModule).toHaveBeenCalledWith('customer');
  });

  it('should keep module data when uninstalling and record a tombstone', async () => {
    await expect(service.uninstall('customer')).resolves.toMatchObject({
      status: 'uninstalled',
      dataRetention: 'retained',
    });
  });

  it('should reject activation when a required module is not active', async () => {
    record = {
      ...record,
      moduleId: 'equipment',
      packageName: '@wasnaker/module-equipment',
      version: '1.0.0',
      status: 'installed',
    };
    modules.findOne.mockReturnValue(Promise.resolve(record));
    modules.find.mockReturnValue(Promise.resolve([]));

    await expect(service.activate('equipment')).rejects.toThrow(
      'Activate dependencies before "equipment"',
    );
  });

  it('should remove hooks and services when activation fails', async () => {
    service.registerRuntimeAdapter('customer', {
      activate: () => Promise.reject(new Error('adapter failed')),
    });

    await expect(service.activate('customer')).rejects.toThrow(
      'adapter failed',
    );
    expect(hooks.unregisterModule).toHaveBeenCalledWith('customer');
    expect(services.unregisterModule).toHaveBeenCalledWith('customer');
    expect(record.status).toBe('failed');
  });
  it('should remove module contributions on deactivation and restore them once on reactivation', async () => {
    const registry = new ModuleServiceRegistry();
    registry.register({
      providerModuleId: 'core',
      contractId: 'core.user-directory',
      version: '1.0.0',
      consumers: ['customer'],
      service: {},
    });
    registry.register({
      providerModuleId: 'core',
      contractId: 'core.account-provisioning',
      version: '1.0.0',
      consumers: ['customer'],
      service: {},
    });
    const runtimeHooks = new HookRegistryService();
    const runtime = new ModuleLifecycleService(modules, runtimeHooks, registry);
    const handler = jest.fn();
    let activations = 0;

    runtime.registerRuntimeAdapter('customer', {
      activate: () => {
        activations += 1;
        const removeHook = runtimeHooks
          .forModule('customer')
          .addAction('customer.lifecycle.test', handler);
        const removeService = registry.register({
          providerModuleId: 'customer',
          contractId: 'customer.lifecycle-test',
          version: '1.0.0',
          consumers: ['equipment'],
          service: {},
        });
        return () => {
          removeHook();
          removeService();
        };
      },
    });

    await runtime.activate('customer');
    await runtime.activate('customer');
    expect(activations).toBe(1);
    expect(runtimeHooks.getRegistrationCount('customer')).toBe(1);
    expect(
      registry
        .listContracts()
        .some((item) => item.contractId === 'customer.lifecycle-test'),
    ).toBe(true);

    await runtime.deactivate('customer');
    expect(runtimeHooks.getRegistrationCount('customer')).toBe(0);
    expect(
      registry
        .listContracts()
        .some((item) => item.contractId === 'customer.lifecycle-test'),
    ).toBe(false);

    await runtime.activate('customer');
    expect(activations).toBe(2);
    expect(runtimeHooks.getRegistrationCount('customer')).toBe(1);

    await runtime.uninstall('customer');
    expect(record.status).toBe('uninstalled');
    expect(runtimeHooks.getRegistrationCount('customer')).toBe(0);
    expect(
      registry
        .listContracts()
        .some((item) => item.contractId === 'customer.lifecycle-test'),
    ).toBe(false);
  });
});
