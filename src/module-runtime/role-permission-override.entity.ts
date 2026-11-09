import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity({ name: 'role_permission_override' })
@Index('UQ_role_permission_override', ['roleId', 'permissionId'], { unique: true })
export class RolePermissionOverrideEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer' })
  roleId: number;

  @Column({ type: 'integer' })
  permissionId: number;

  @Column({ type: 'varchar', length: 8, default: 'deny' })
  effect: 'deny';

  @Column({ type: 'text', nullable: true })
  reason?: string | null;

  @Column({ type: 'integer', nullable: true })
  createdBy?: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
