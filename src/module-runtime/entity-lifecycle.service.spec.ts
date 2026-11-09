import { EntityLifecycleService } from './entity-lifecycle.service';
import { HookRegistryService } from './hook-registry.service';
import { ModuleOutboxEntity } from './module-outbox.entity';

describe('EntityLifecycleService', () => {
  let hooks: HookRegistryService;
  let lifecycle: EntityLifecycleService;

  beforeEach(() => {
    hooks = new HookRegistryService();
    lifecycle = new EntityLifecycleService(hooks);
  });

  it('should apply module filters before persistence', async () => {
    hooks.forModule('customer').addFilter<{
      name: string;
    }>('customer.branch.beforeInsert', (data) => ({ ...data, name: data.name.trim() }));

    await expect(
      lifecycle.before(
        'insert',
        {
          moduleId: 'customer',
          entityType: 'branch',
        },
        { name: ' Main Office ' },
      ),
    ).resolves.toEqual({ name: 'Main Office' });
  });

  it('should dispatch the before action with the filtered payload', async () => {
    const handler = jest.fn();
    const filter = jest.fn((value: { name: string }) => value);
    hooks.forModule('audit').addFilter('customer.branch.beforeUpdate', filter);
    hooks.forModule('audit').addAction('customer.branch.beforeUpdate', handler);
    const result = await lifecycle.before(
      'update',
      {
        moduleId: 'customer',
        entityType: 'branch',
      },
      { name: 'Updated' },
    );

    expect(result).toEqual({ name: 'Updated' });
    expect(handler).toHaveBeenCalledWith(
      { name: 'Updated' },
      expect.objectContaining({
        ownerModuleId: 'audit',
        sourceModuleId: 'customer',
      }),
    );
    expect((filter.mock.calls[0] as any[])[1].correlationId).toBe(
      (handler.mock.calls[0] as any[])[1].correlationId,
    );
  });

  it('should insert the immutable event envelope through the caller transaction manager', async () => {
    const insert = jest.fn().mockResolvedValue(undefined);
    const manager = {
      getRepository: jest.fn().mockReturnValue({ insert }),
    } as any;

    const event = await lifecycle.recordWithinTransaction(
      manager,
      'insert',
      {
        moduleId: 'customer',
        entityType: 'branch',
        entityId: 42,
        actorUserId: 7,
        correlationId: 'd9428888-122b-4e9c-b1bf-45f1a0e1c201',
      },
      { name: 'Main Office' },
    );

    expect(manager.getRepository).toHaveBeenCalledWith(ModuleOutboxEntity);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: event.eventId,
        eventName: 'customer.branch.afterInsert',
        moduleId: 'customer',
        entityType: 'branch',
        entityId: '42',
        operation: 'insert',
        correlationId: 'd9428888-122b-4e9c-b1bf-45f1a0e1c201',
        data: { name: 'Main Office' },
        status: 'pending',
      }),
    );
    expect(event.entity).toEqual({
      module: 'customer',
      type: 'branch',
      id: 42,
    });
  });
  it('should persist generic entity changes and outbox snapshots in one manager', async () => {
    hooks.forModule('customer').addFilter<{
      name: string;
    }>('customer.branch.beforeInsert', (data) => ({ ...data, name: data.name.trim() }));
    const insert = jest.fn().mockResolvedValue(undefined);
    const manager = {
      getRepository: jest.fn().mockReturnValue({ insert }),
    } as any;
    const persist = jest.fn((_manager, input: { name: string }) =>
      Promise.resolve({
        entityId: 99,
        result: { id: 99, name: input.name },
        snapshot: { name: input.name },
      }),
    );

    const result = await lifecycle.executeWithinTransaction(
      manager,
      'insert',
      { moduleId: 'customer', entityType: 'branch' },
      { name: ' Main Office ' },
      persist,
    );

    expect(result).toEqual({ id: 99, name: 'Main Office' });
    expect(persist).toHaveBeenCalledWith(manager, { name: 'Main Office' });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: '99',
        operation: 'insert',
        data: { name: 'Main Office' },
        status: 'pending',
      }),
    );
  });
});
