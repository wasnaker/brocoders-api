import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export type ModuleAuthorizationSyncStatus = 'pending' | 'success' | 'failed';

@Entity({ name: 'module_authorization_sync' })
export class ModuleAuthorizationSyncEntity {
  @PrimaryColumn({ type: 'varchar', length: 100 })
  moduleId: string;

  @Column({ type: 'varchar', length: 64 })
  manifestVersion: string;

  @Column({ type: 'varchar', length: 128 })
  manifestHash: string;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  syncStatus: ModuleAuthorizationSyncStatus;

  @Column({ type: 'timestamptz', nullable: true })
  lastSyncedAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  lastError?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
