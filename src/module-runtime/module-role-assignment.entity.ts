import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Index(
  'UQ_module_role_assignment_scope',
  ['moduleId', 'roleKey', 'userId', 'scopeType', 'scopeId'],
  { unique: true },
)
@Index('IDX_module_role_assignment_user', ['userId'])
@Entity({ name: 'module_role_assignment' })
export class ModuleRoleAssignmentEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  userId: number;

  @Column({ type: 'varchar', length: 100 })
  moduleId: string;

  @Column({ type: 'varchar', length: 100 })
  roleKey: string;

  @Column({ type: 'varchar', length: 30 })
  scopeType: string;

  @Column({ type: 'varchar', length: 100 })
  scopeId: string;

  @Column({ type: 'int', nullable: true })
  assignedBy: number | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
