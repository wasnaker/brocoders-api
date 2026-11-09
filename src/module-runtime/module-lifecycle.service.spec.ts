import { ModuleLifecycleService } from './module-lifecycle.service';
import { ModuleLifecycleEntity } from './module-lifecycle.entity';

describe('ModuleLifecycleService', () => {
  let service: ModuleLifecycleService;
  let record: ModuleLifecycleEntity;
  let modules: any;
  let hooks: { unregisterModule: jest.Mock };
  let services: { unregisterModule: jest.Mock };
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
      findOne: jest.fn().mockImplementation(async () => record),
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn().mockImplementation(async (value) => {
        record = { ...record, ...value };
        return record;
      }),
      update: jest.fn().mockImplementation(async (_where, patch) => {
        record = { ...record, ...patch };
        return { affected: 1 };
      }),
      create: jest.fn((value) => value),
    };
    hooks = { unregisterModule: jest.fn() };
    services = { unregisterModule: jest.fn() };
    disposer = jest.fn();
    service = new ModuleLifecycleService(
      modules,
      hooks as never,
      services as never,
    );
  });

  it('activates once and removes owned runtime contributions on deactivation', async () => {
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

  it('keeps module data when uninstalling and records a tombstone', async () => {
    await expect(service.uninstall('customer')).resolves.toMatchObject({
      status: 'uninstalled',
      dataRetention: 'retained',
    });
  });

  it('rejects activation when a required module is not active', async () => {
    record = {
      ...record,
      moduleId: 'equipment',
      packageName: '@wasnaker/module-equipment',
      version: '1.0.0',
      status: 'installed',
    };
    modules.findOne.mockImplementation(async () => record);
    modules.find.mockResolvedValue([]);

    await expect(service.activate('equipment')).rejects.toThrow(
      'Activate dependencies before "equipment"',
    );
  });

  it('removes hooks and services when activation fails', async () => {
    service.registerRuntimeAdapter('customer', {
      activate: async () => {
        throw new Error('adapter failed');
      },
    });

    await expect(service.activate('customer')).rejects.toThrow('adapter failed');
    expect(hooks.unregisterModule).toHaveBeenCalledWith('customer');
    expect(services.unregisterModule).toHaveBeenCalledWith('customer');
    expect(record.status).toBe('failed');
  });
});
