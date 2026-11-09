import { Column, Entity, Index, ManyToMany, PrimaryGeneratedColumn } from 'typeorm';
import { RoleEntity } from '../../../../../roles/infrastructure/persistence/relational/entities/role.entity';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';

@Entity({
  name: 'permission',
})
@Index('UQ_permission_permission_key', ['permissionKey'], { unique: true })
export class PermissionEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  /** Immutable cross-module identifier; never a database-generated ID. */
  @Column({ type: 'varchar', length: 160 })
  permissionKey: string;

  @Column({ nullable: true })
  description?: string;

  /** Null for core permissions; otherwise identifies the registering module. */
  @Column({ type: 'varchar', length: 100, nullable: true })
  moduleId?: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @ManyToMany(() => RoleEntity, (role) => role.permissions, {
    nullable: true,
  })
  roles?: RoleEntity[];
}
