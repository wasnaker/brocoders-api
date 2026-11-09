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
    hooks.forModule('customer').addFilter<{ name: string }>(
      'customer.branch.beforeInsert',
      (data) => ({ ...data, name: data.name.trim() }),
    );

    await expect(
      lifecycle.before('insert', {
        moduleId: 'customer',
        entityType: 'branch',
      }, { name: ' Main Office ' }),
    ).resolves.toEqual({ name: 'Main Office' });
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
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      eventId: event.eventId,
      eventName: 'customer.branch.afterInsert',
      moduleId: 'customer',
      entityType: 'branch',
      entityId: '42',
      operation: 'insert',
      correlationId: 'd9428888-122b-4e9c-b1bf-45f1a0e1c201',
      data: { name: 'Main Office' },
      status: 'pending',
    }));
    expect(event.entity).toEqual({ module: 'customer', type: 'branch', id: 42 });
  });
});
