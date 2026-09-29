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
}
