import { Column, Entity, JoinTable, ManyToMany, PrimaryColumn } from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { PermissionEntity } from '../../../../../permissions/infrastructure/persistence/relational/entities/permission.entity';

@Entity({
  name: 'role',
})
export class RoleEntity extends EntityRelationalHelper {
  @PrimaryColumn()
  id: number;

  @Column()
  name?: string;

  /** Null for core roles; otherwise identifies the module that registered this role. */
  @Column({ type: 'varchar', length: 100, nullable: true })
  moduleId?: string | null;

  /** Stable role key within the owning module. */
  @Column({ type: 'varchar', length: 100, nullable: true })
  moduleRoleKey?: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @ManyToMany(() => PermissionEntity, (permission) => permission.roles, {
    eager: false,
    nullable: true,
  })
  @JoinTable({
    name: 'roles_permissions_role',
    joinColumns: [{ name: 'roleId', referencedColumnName: 'id' }],
    inverseJoinColumns: [{ name: 'permissionId', referencedColumnName: 'id' }],
  })
  permissions?: PermissionEntity[];

  /** Effective grant sources for administration; not a persisted ORM column. */
  authorizationGrants?: Array<{
    permissionKey: string;
    grantType: 'module_default' | 'admin_manual' | 'legacy';
    sourceModuleId: string | null;
    sourceKey: string | null;
  }>;

  /** Administrator deny overrides; not a persisted ORM column. */
  authorizationOverrides?: Array<{
    permissionKey: string;
    effect: 'deny';
    reason: string | null;
  }>;
}
