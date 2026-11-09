import { ModuleOutboxPublisherService } from './module-outbox-publisher.service';
import { HookRegistryService } from './hook-registry.service';
import { ModuleOutboxEntity } from './module-outbox.entity';

describe('ModuleOutboxPublisherService', () => {
  const row = {
    eventId: 'd9428888-122b-4e9c-b1bf-45f1a0e1c201',
    eventName: 'customer.branch.afterInsert',
    moduleId: 'customer',
    entityType: 'branch',
    entityId: '42',
    operation: 'insert' as const,
    schemaVersion: 1,
    correlationId: 'd9428888-122b-4e9c-b1bf-45f1a0e1c202',
    occurredAt: new Date('2026-11-09T10:00:00.000Z'),
    actorUserId: '7',
    data: { name: 'Main Office' },
    attempts: 1,
  };

  it('should publish claimed events and mark them published', async () => {
    const update = jest.fn().mockResolvedValue({ affected: 1 });
    const dataSource = {
      transaction: jest.fn(async (callback) => callback({
        query: jest.fn().mockResolvedValue([row]),
      })),
      getRepository: jest.fn().mockReturnValue({ update }),
    };
    const hooks = new HookRegistryService();
    const handler = jest.fn();
    hooks.forModule('audit').addAction('customer.branch.afterInsert', handler);
    const publisher = new ModuleOutboxPublisherService(dataSource as any, hooks);

    await expect(publisher.publishBatch()).resolves.toEqual({
      claimed: 1,
      published: 1,
      failed: 0,
    });
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({
      eventId: row.eventId,
      occurredAt: row.occurredAt.toISOString(),
      correlationId: row.correlationId,
      entity: { module: 'customer', type: 'branch', id: '42' },
    }), expect.anything());
    expect(handler.mock.calls[0][1].correlationId).toBe(row.correlationId);
    expect(update).toHaveBeenCalledWith(
      { eventId: row.eventId, status: 'processing' },
      expect.objectContaining({ status: 'published', lockedAt: null }),
    );
    expect(dataSource.getRepository).toHaveBeenCalledWith(ModuleOutboxEntity);
  });

  it('should return failed events to pending and preserve the error for retry', async () => {
    const update = jest.fn().mockResolvedValue({ affected: 1 });
    const dataSource = {
      transaction: jest.fn(async (callback) => callback({
        query: jest.fn().mockResolvedValue([row]),
      })),
      getRepository: jest.fn().mockReturnValue({ update }),
    };
    const hooks = new HookRegistryService();
    hooks.forModule('audit').addAction('customer.branch.afterInsert', () => {
      throw new Error('temporary consumer failure');
    });
    const publisher = new ModuleOutboxPublisherService(dataSource as any, hooks);

    await expect(publisher.publishBatch()).resolves.toEqual({
      claimed: 1,
      published: 0,
      failed: 1,
    });
    expect(update).toHaveBeenCalledWith(
      { eventId: row.eventId, status: 'processing' },
      expect.objectContaining({
        status: 'pending',
        lockedAt: null,
        lastError: 'temporary consumer failure',
      }),
    );
  });

  it('should validate batch limits', async () => {
    const publisher = new ModuleOutboxPublisherService({} as any, new HookRegistryService());
    await expect(publisher.publishBatch(0)).rejects.toThrow('batch limit');
    await expect(publisher.publishBatch(10, 0)).rejects.toThrow('maxAttempts');
  });
});
