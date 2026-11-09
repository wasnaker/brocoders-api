import { RolesService } from './roles.service';
import { RoleEntity } from './infrastructure/persistence/relational/entities/role.entity';
import { PermissionEntity } from '../permissions/infrastructure/persistence/relational/entities/permission.entity';
import { RolePermissionGrantEntity } from '../module-runtime/role-permission-grant.entity';
import { RolePermissionOverrideEntity } from '../module-runtime/role-permission-override.entity';
import { AuthorizationAuditLogEntity } from '../module-runtime/authorization-audit-log.entity';

describe('RolesService administrator grant ownership', () => {
  it('replaces only admin_manual grants and leaves module defaults and deny overrides intact', async () => {
    const role = Object.assign(new RoleEntity(), { id: 3, name: 'Customer Admin', moduleId: 'customer', moduleRoleKey: 'customer-admin' });
    const selectedPermission = Object.assign(new PermissionEntity(), { id: 41, name: 'read:equipment', permissionKey: 'read:equipment', moduleId: 'equipment', isActive: true });
    const grantRepository: any = {
      find: jest.fn().mockResolvedValue([{ id: 5, roleId: 3, permissionId: 40, grantType: 'admin_manual' }]),
      delete: jest.fn(),
      insert: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        innerJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      })),
    };
    const managerRepositories = new Map<any, any>([
      [RoleEntity, { findOne: jest.fn().mockResolvedValue(role) }],
      [PermissionEntity, { find: jest.fn().mockResolvedValue([selectedPermission]) }],
      [RolePermissionGrantEntity, grantRepository],
      [AuthorizationAuditLogEntity, { insert: jest.fn() }],
      [RolePermissionOverrideEntity, { findOne: jest.fn(), upsert: jest.fn(), delete: jest.fn() }],
    ]);
    const manager: any = {
      getRepository: (entity: any) => managerRepositories.get(entity),
      query: jest.fn().mockResolvedValue([]),
    };
    const dataSource: any = {
      transaction: jest.fn(async (callback: (value: any) => Promise<any>) => callback(manager)),
    };
    const rolesRepository: any = { find: jest.fn(), findOne: jest.fn().mockResolvedValue(role) };
    const permissionsRepository: any = { find: jest.fn().mockResolvedValue([selectedPermission]) };
    const overridesRepository: any = {
      createQueryBuilder: jest.fn(() => ({
        innerJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      })),
    };
    const service = new RolesService(
      rolesRepository,
      permissionsRepository,
      grantRepository,
      overridesRepository,
      dataSource,
    );

    await service.updatePermissions(3, [41], 99);

    expect(grantRepository.delete).toHaveBeenCalledWith({ roleId: 3, grantType: 'admin_manual' });
    expect(grantRepository.insert).toHaveBeenCalledWith([expect.objectContaining({
      roleId: 3,
      permissionId: 41,
      grantType: 'admin_manual',
      sourceModuleId: null,
      createdBy: 99,
    })]);
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining('FOR UPDATE'),
      [3],
    );
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM "roles_permissions_role"'),
      [3],
    );
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
  });
});
