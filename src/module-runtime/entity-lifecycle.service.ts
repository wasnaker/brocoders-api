import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { HookRegistryService } from './hook-registry.service';
import { EntityEvent, EntityLifecycleContext, EntityOperation } from './entity-event.type';
import { ModuleOutboxEntity } from './module-outbox.entity';

@Injectable()
export class EntityLifecycleService {
  constructor(private readonly hooks: HookRegistryService) {}

  async before<TData>(
    operation: EntityOperation,
    context: EntityLifecycleContext,
    data: TData,
  ): Promise<TData> {
    const eventName = this.eventName(context, operation, 'before');
    return this.hooks.applyFilters(eventName, data, context.moduleId, context.signal);
  }

  /**
   * Must be called with the EntityManager from the same transaction as the
   * entity write. The outbox row therefore commits or rolls back atomically.
   * Pass an explicit DTO/snapshot; never pass an ORM entity or manager.
   */
  async recordWithinTransaction<TData extends Record<string, unknown>>(
    manager: EntityManager,
    operation: EntityOperation,
    context: EntityLifecycleContext & { entityId: string | number },
    data: TData,
  ): Promise<EntityEvent<TData>> {
    const event: EntityEvent<TData> = {
      eventId: randomUUID(),
      eventName: this.eventName(context, operation, 'after'),
      entity: {
        module: context.moduleId,
        type: context.entityType,
        id: context.entityId,
      },
      operation,
      occurredAt: new Date().toISOString(),
      actorUserId: context.actorUserId,
      correlationId: context.correlationId ?? randomUUID(),
      schemaVersion: 1,
      data,
    };

    await manager.getRepository(ModuleOutboxEntity).insert({
      eventId: event.eventId,
      eventName: event.eventName,
      moduleId: context.moduleId,
      entityType: context.entityType,
      entityId: String(context.entityId),
      operation,
      schemaVersion: event.schemaVersion,
      correlationId: event.correlationId,
      occurredAt: new Date(event.occurredAt),
      actorUserId: event.actorUserId == null ? null : String(event.actorUserId),
      data: event.data,
      status: 'pending',
      attempts: 0,
    });

    return event;
  }

  private eventName(
    context: EntityLifecycleContext,
    operation: EntityOperation,
    phase: 'before' | 'after',
  ): string {
    return `${context.moduleId}.${context.entityType}.${phase}${operation[0].toUpperCase()}${operation.slice(1)}`;
  }
}
