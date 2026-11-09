import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'authorization_audit_log' })
@Index('IDX_authorization_audit_log_module_created', ['moduleId', 'createdAt'])
@Index('IDX_authorization_audit_log_entity', ['entityType', 'entityKey', 'createdAt'])
export class AuthorizationAuditLogEntity {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  /** String supports both numeric local user IDs and external actor identifiers. */
  @Column({ type: 'integer', nullable: true })
  actorUserId?: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  moduleId?: string | null;

  @Column({ type: 'varchar', length: 40 })
  entityType: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  entityKey?: string | null;

  @Column({ type: 'varchar', length: 80 })
  action: string;

  @Column({ type: 'jsonb', nullable: true })
  before?: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  after?: Record<string, unknown> | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
