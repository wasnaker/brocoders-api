import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ModuleLifecycleStatus =
  | 'installing'
  | 'installed'
  | 'activating'
  | 'active'
  | 'deactivating'
  | 'inactive'
  | 'uninstalling'
  | 'uninstalled'
  | 'failed';

@Entity({ name: 'module_lifecycle' })
export class ModuleLifecycleEntity {
  @PrimaryColumn({ type: 'varchar', length: 100 })
  moduleId: string;

  @Column({ type: 'varchar', length: 200 })
  packageName: string;

  @Column({ type: 'varchar', length: 64 })
  version: string;

  @Column({ type: 'varchar', length: 20, default: 'installed' })
  status: ModuleLifecycleStatus;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: Record<string, unknown>;

  @Column({ type: 'varchar', length: 16, default: 'retained' })
  dataRetention: 'retained' | 'purge-requested';

  @Column({ type: 'text', nullable: true })
  lastError?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  installedAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  activatedAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  deactivatedAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  uninstalledAt?: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
