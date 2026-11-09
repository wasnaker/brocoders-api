import { ModuleLifecycleService } from './module-lifecycle.service';
import { ModuleLifecycleEntity } from './module-lifecycle.entity';
import { ModuleServiceRegistry } from './module-service.registry';
import { HookRegistryService } from './hook-registry.service';

describe('ModuleLifecycleService', () => {
  let service: ModuleLifecycleService;
  let record: ModuleLifecycleEntity;
  let modules: any;
  let hooks: { unregisterModule: jest.Mock };
  let services: { unregisterModule: jest.Mock; resolve: jest.Mock };
  let authorization: { restoreModule: jest.Mock; deactivateModule: jest.Mock; unregisterModule: jest.Mock };
  let reconciliation: { syncModule: jest.Mock };
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
      findOne: jest.fn().mockImplementation(() => Promise.resolve(record)),
      find: jest.fn().mockImplementation(({ where }: any) => {
        const rawStatus = where?.status;
        const statuses = Array.isArray(rawStatus?.value)
          ? rawStatus.value
          : [rawStatus];
        if (statuses.includes('active')) {
          return Promise.resolve([{ moduleId: 'region', status: 'active' }]);
        }
        return Promise.resolve([{ moduleId: 'region', status: 'installed' }]);
      }),
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
    authorization = {
      restoreModule: jest.fn().mockResolvedValue(undefined),
      deactivateModule: jest.fn().mockResolvedValue(undefined),
      unregisterModule: jest.fn().mockResolvedValue(undefined),
    };
    reconciliation = { syncModule: jest.fn().mockResolvedValue({ status: 'success', moduleId: 'customer' }) };
    disposer = jest.fn();
    service = new ModuleLifecycleService(
      modules,
      hooks as never,
      services as never,
      authorization as never,
      reconciliation as never,
    );
  });

  it('should mark a failed installation as failed from the installing state', async () => {
    const failure = new Error('authorization reconciliation failed');
    reconciliation.syncModule.mockResolvedValue({ status: 'failed', moduleId: 'customer', error: failure.message });
    modules.findOne.mockResolvedValue(null);

    await expect(
      service.install('customer', '@wasnaker/module-customer', '1.0.0'),
    ).rejects.toThrow('authorization reconciliation failed');

    expect(reconciliation.syncModule).toHaveBeenCalledWith('customer');
    expect(authorization.restoreModule).not.toHaveBeenCalled();
    expect(authorization.deactivateModule).toHaveBeenCalledWith('customer');
    expect(modules.update).toHaveBeenCalledWith(
      { moduleId: 'customer', status: 'installing' },
      {
        status: 'failed',
        lastError: 'authorization reconciliation failed',
      },
    );
  });

  it('should activate once and remove owned runtime contributions on deactivation', async () => {
    const activate = jest.fn().mockResolvedValue(disposer);
    service.registerRuntimeAdapter('customer', { activate });

    await expect(service.activate('customer')).resolves.toMatchObject({
      status: 'active',
    });
    expect(reconciliation.syncModule).toHaveBeenCalledWith('customer');
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
    expect(authorization.deactivateModule).toHaveBeenCalledWith('customer');
  });

  it('fails closed when rebuilding runtime contributions for an active module fails', async () => {
    record = { ...record, status: 'active' };
    modules.findOne.mockImplementation(() => Promise.resolve(record));
    service.registerRuntimeAdapter('customer', {
      activate: () => Promise.reject(new Error('rehydration failed')),
    });

    await expect(service.activate('customer')).rejects.toThrow('rehydration failed');

    expect(hooks.unregisterModule).toHaveBeenCalledWith('customer');
    expect(services.unregisterModule).toHaveBeenCalledWith('customer');
    expect(authorization.deactivateModule).toHaveBeenCalledWith('customer');
    expect(modules.update).toHaveBeenCalledWith(
      { moduleId: 'customer', status: 'active' },
      { status: 'failed', lastError: 'rehydration failed' },
    );
  });

  it('should keep module data when uninstalling and record a tombstone', async () => {
    await expect(service.uninstall('customer')).resolves.toMatchObject({
      status: 'uninstalled',
      dataRetention: 'retained',
    });
  });

  it('should recover an interrupted activation as failed and clear contributions', async () => {
    record = { ...record, status: 'activating' };
    modules.findOne.mockImplementation(() => Promise.resolve(record));

    await expect(
      service.recoverInterruptedTransition('customer'),
    ).resolves.toMatchObject({
      status: 'failed',
      lastError: 'Lifecycle transition was interrupted by a process restart',
    });
    expect(hooks.unregisterModule).toHaveBeenCalledWith('customer');
    expect(services.unregisterModule).toHaveBeenCalledWith('customer');
    expect(authorization.deactivateModule).toHaveBeenCalledWith('customer');
  });

  it('should mark interrupted installation as failed when authorization recovery fails', async () => {
    const failure = new Error('authorization reconciliation failed during recovery');
    record = { ...record, status: 'installing' };
    modules.findOne.mockImplementation(() => Promise.resolve(record));
    reconciliation.syncModule.mockResolvedValue({ status: 'failed', moduleId: 'customer', error: failure.message });

    await expect(
      service.recoverInterruptedTransition('customer'),
    ).rejects.toThrow('authorization reconciliation failed during recovery');

    expect(modules.update).toHaveBeenCalledWith(
      { moduleId: 'customer', status: 'installing' },
      {
        status: 'failed',
        lastError: 'authorization reconciliation failed during recovery',
      },
    );
    expect(record.status).toBe('failed');
    expect(reconciliation.syncModule).toHaveBeenCalledWith('customer');
    expect(authorization.restoreModule).not.toHaveBeenCalled();
  });

  it('should finish an interrupted uninstall and retain module data', async () => {
    record = { ...record, status: 'uninstalling' };
    modules.findOne.mockImplementation(() => Promise.resolve(record));

    await expect(
      service.recoverInterruptedTransition('customer'),
    ).resolves.toMatchObject({
      status: 'uninstalled',
      dataRetention: 'retained',
    });
    expect(authorization.unregisterModule).toHaveBeenCalledWith('customer');
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
    expect(authorization.deactivateModule).toHaveBeenCalledWith('customer');
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
    const runtime = new ModuleLifecycleService(
      modules,
      runtimeHooks,
      registry,
      authorization as never,
      reconciliation as never,
    );
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
