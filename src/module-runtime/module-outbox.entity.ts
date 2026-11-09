import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

export type ModuleOutboxStatus =
  | 'pending'
  | 'processing'
  | 'published'
  | 'failed';

@Entity({ name: 'module_event_outbox' })
@Index('IDX_module_event_outbox_pending', ['status', 'createdAt'])
export class ModuleOutboxEntity {
  @PrimaryColumn({ type: 'uuid' })
  eventId: string;

  @Column({ type: 'varchar', length: 160 })
  eventName: string;

  @Column({ type: 'varchar', length: 100 })
  moduleId: string;

  @Column({ type: 'varchar', length: 120 })
  entityType: string;

  @Column({ type: 'varchar', length: 160 })
  entityId: string;

  @Column({ type: 'varchar', length: 16 })
  operation: 'insert' | 'update' | 'delete';

  @Column({ type: 'integer', default: 1 })
  schemaVersion: number;

  @Column({ type: 'uuid' })
  correlationId: string;

  @Column({ type: 'timestamptz' })
  occurredAt: Date;

  @Column({ type: 'varchar', length: 100, nullable: true })
  actorUserId?: string | null;

  @Column({ type: 'jsonb' })
  data: Record<string, unknown>;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: ModuleOutboxStatus;

  @Column({ type: 'integer', default: 0 })
  attempts: number;

  @Column({ type: 'timestamptz', nullable: true })
  lockedAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  lastError?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt?: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
