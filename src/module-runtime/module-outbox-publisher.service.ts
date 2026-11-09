import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { HookRegistryService } from './hook-registry.service';
import { EntityEvent } from './entity-event.type';
import { ModuleOutboxEntity } from './module-outbox.entity';

interface ClaimedOutboxRow {
  eventId: string;
  eventName: string;
  moduleId: string;
  entityType: string;
  entityId: string;
  operation: 'insert' | 'update' | 'delete';
  schemaVersion: number;
  correlationId: string;
  occurredAt: Date;
  actorUserId: string | null;
  data: Record<string, unknown>;
}

/**
 * Pollable at-least-once outbox relay. Invoke publishBatch from a worker or
 * scheduler. Handlers must deduplicate by eventId because a process can crash
 * after a handler succeeds but before the row is marked published.
 */
@Injectable()
export class ModuleOutboxPublisherService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly hooks: HookRegistryService,
  ) {}

  async publishBatch(limit = 50, maxAttempts = 10): Promise<{
    claimed: number;
    published: number;
    failed: number;
  }> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
      throw new RangeError('Outbox batch limit must be between 1 and 500');
    }
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
      throw new RangeError('Outbox maxAttempts must be a positive integer');
    }

    const rows = await this.dataSource.transaction(async (manager) =>
      manager.query(
        `WITH candidates AS (
          SELECT "eventId"
          FROM "module_event_outbox"
          WHERE "status" = 'pending'
             OR ("status" = 'processing' AND "lockedAt" < now() - interval '5 minutes')
          ORDER BY "createdAt" ASC
          LIMIT $1
          FOR UPDATE SKIP LOCKED
        )
        UPDATE "module_event_outbox" AS outbox
        SET "status" = 'processing',
            "lockedAt" = now(),
            "attempts" = outbox."attempts" + 1
        FROM candidates
        WHERE outbox."eventId" = candidates."eventId"
        RETURNING outbox.*`,
        [limit],
      ),
    ) as ClaimedOutboxRow[];

    let published = 0;
    let failed = 0;
    for (const row of rows) {
      const event: EntityEvent = {
        eventId: row.eventId,
        eventName: row.eventName,
        entity: {
          module: row.moduleId,
          type: row.entityType,
          id: row.entityId,
        },
        operation: row.operation,
        occurredAt: new Date(row.occurredAt).toISOString(),
        actorUserId: row.actorUserId,
        correlationId: row.correlationId,
        schemaVersion: row.schemaVersion,
        data: row.data,
      };

      try {
        await this.hooks.doAction(
          row.eventName,
          event,
          row.moduleId,
          undefined,
          row.correlationId,
        );
        await this.dataSource.getRepository(ModuleOutboxEntity).update(
          { eventId: row.eventId, status: 'processing' },
          { status: 'published', publishedAt: new Date(), lockedAt: null, lastError: null },
        );
        published += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await this.dataSource.getRepository(ModuleOutboxEntity).update(
          { eventId: row.eventId, status: 'processing' },
          {
            status: row.attempts >= maxAttempts ? 'failed' : 'pending',
            lockedAt: null,
            lastError: message.slice(0, 8000),
          },
        );
        failed += 1;
      }
    }

    return { claimed: rows.length, published, failed };
  }
}
