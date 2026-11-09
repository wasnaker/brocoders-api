export type EntityOperation = 'insert' | 'update' | 'delete';

export interface EntityEvent<TData = Record<string, unknown>> {
  eventId: string;
  eventName: string;
  entity: {
    module: string;
    type: string;
    id: string | number;
  };
  operation: EntityOperation;
  occurredAt: string;
  actorUserId?: string | number | null;
  correlationId: string;
  schemaVersion: 1;
  data: TData;
}

export interface EntityLifecycleContext {
  moduleId: string;
  entityType: string;
  entityId?: string | number;
  actorUserId?: string | number | null;
  correlationId?: string;
  signal?: AbortSignal;
}
