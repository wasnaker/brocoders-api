import { HookRegistryService } from './hook-registry.service';

describe('HookRegistryService', () => {
  let hooks: HookRegistryService;

  beforeEach(() => {
    hooks = new HookRegistryService();
  });

  it('should execute action handlers sequentially by priority and registration order', async () => {
    const calls: string[] = [];
    const moduleA = hooks.forModule('module-a');
    const moduleB = hooks.forModule('module-b');

    moduleA.addAction(
      'customer.created',
      () => {
        calls.push('a-late');
      },
      { priority: 20 },
    );
    moduleB.addAction(
      'customer.created',
      () => {
        calls.push('b-first');
      },
      { priority: 5 },
    );
    moduleA.addAction(
      'customer.created',
      () => {
        calls.push('a-middle-1');
      },
      { priority: 10 },
    );
    moduleA.addAction(
      'customer.created',
      () => {
        calls.push('a-middle-2');
      },
      { priority: 10 },
    );

    await hooks.doAction('customer.created', { id: 1 }, 'customer');

    expect(calls).toEqual(['b-first', 'a-middle-1', 'a-middle-2', 'a-late']);
  });

  it('should continue action handlers and report failures as an aggregate error', async () => {
    const calls: string[] = [];
    hooks.forModule('module-a').addAction('customer.created', () => {
      calls.push('first');
      throw new Error('handler failed');
    });
    hooks.forModule('module-b').addAction('customer.created', () => {
      calls.push('second');
    });

    await expect(hooks.doAction('customer.created', {})).rejects.toBeInstanceOf(
      AggregateError,
    );
    expect(calls).toEqual(['first', 'second']);
  });

  it('should share one correlation id across handlers in a dispatch', async () => {
    const correlationIds: string[] = [];
    hooks
      .forModule('module-a')
      .addAction('customer.created', (_payload, context) =>
        correlationIds.push(context.correlationId),
      );
    hooks
      .forModule('module-b')
      .addAction('customer.created', (_payload, context) =>
        correlationIds.push(context.correlationId),
      );

    await hooks.doAction('customer.created', { id: 1 });

    expect(correlationIds).toHaveLength(2);
    expect(correlationIds[0]).toBe(correlationIds[1]);
  });

  it('should pass each filter result to the next handler', async () => {
    hooks
      .forModule('module-a')
      .addFilter<number>('customer.beforeCreate', (value) => value + 1, {
        priority: 5,
      });
    hooks
      .forModule('module-b')
      .addFilter<number>('customer.beforeCreate', (value) => value * 2);

    await expect(
      hooks.applyFilters('customer.beforeCreate', 2, 'customer'),
    ).resolves.toBe(6);
  });

  it('should fail fast when a filter throws or returns undefined', async () => {
    const later = jest.fn((value: number) => value + 1);
    hooks
      .forModule('module-a')
      .addFilter<number>(
        'customer.beforeCreate',
        () => undefined as unknown as number,
        { priority: 1 },
      );
    hooks
      .forModule('module-b')
      .addFilter<number>('customer.beforeCreate', later);

    await expect(
      hooks.applyFilters('customer.beforeCreate', 1),
    ).rejects.toThrow('returned undefined');
    expect(later).not.toHaveBeenCalled();
  });

  it('should make repeated registration idempotent by handler or registration key', () => {
    const handler = jest.fn();
    const moduleHooks = hooks.forModule('module-a');
    moduleHooks.addAction('customer.created', handler);
    moduleHooks.addAction('customer.created', handler);
    moduleHooks.addAction('customer.created', jest.fn(), {
      registrationKey: 'customer-created-audit',
    });
    moduleHooks.addAction('customer.created', jest.fn(), {
      registrationKey: 'customer-created-audit',
    });

    expect(hooks.getRegistrationCount('module-a')).toBe(2);
  });

  it('should unregister only the owning module contributions', async () => {
    const handlerA = jest.fn();
    const handlerB = jest.fn();
    hooks.forModule('module-a').addAction('customer.created', handlerA);
    hooks.forModule('module-b').addAction('customer.created', handlerB);

    expect(hooks.unregisterModule('module-a')).toBe(1);
    await hooks.doAction('customer.created', {});

    expect(handlerA).not.toHaveBeenCalled();
    expect(handlerB).toHaveBeenCalledTimes(1);
  });

  it('should support explicit unregister and validate hook contracts', () => {
    const handler = jest.fn();
    const unregister = hooks
      .forModule('module-a')
      .addAction('customer.created', handler);

    unregister();
    unregister();
    expect(hooks.getRegistrationCount()).toBe(0);
    expect(() => hooks.forModule('Invalid Module')).toThrow();
    expect(() =>
      hooks.forModule('module-a').addAction('invalid', handler),
    ).toThrow();
  });
});
