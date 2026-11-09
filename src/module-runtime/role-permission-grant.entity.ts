import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type RolePermissionGrantType =
  | 'module_default'
  | 'admin_manual'
  | 'legacy';

@Entity({ name: 'role_permission_grant' })
@Index('UQ_role_permission_grant_module_default', ['roleId', 'permissionId', 'sourceModuleId', 'sourceKey'], {
  unique: true,
  where: '"grantType" = \'module_default\'',
})
@Index('UQ_role_permission_grant_manual', ['roleId', 'permissionId'], {
  unique: true,
  where: '"grantType" = \'admin_manual\'',
})
@Index('UQ_role_permission_grant_legacy', ['roleId', 'permissionId'], {
  unique: true,
  where: '"grantType" = \'legacy\'',
})
export class RolePermissionGrantEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer' })
  roleId: number;

  @Column({ type: 'integer' })
  permissionId: number;

  @Column({ type: 'varchar', length: 24 })
  grantType: RolePermissionGrantType;

  /** Module that declared this grant, not the module owning the Role. */
  @Column({ type: 'varchar', length: 100, nullable: true })
  sourceModuleId?: string | null;

  /** Stable manifest grant key, or an administrator/legacy provenance key. */
  @Column({ type: 'varchar', length: 200, nullable: true })
  sourceKey?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  createdBy?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
