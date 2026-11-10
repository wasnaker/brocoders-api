import { RolePermissionSeedService } from './role-permission-seed.service';
import { RoleEntity } from '../../../../roles/infrastructure/persistence/relational/entities/role.entity';
import { PermissionEntity } from '../../../../permissions/infrastructure/persistence/relational/entities/permission.entity';
import { RolePermissionGrantEntity } from '../../../../module-runtime/role-permission-grant.entity';
import { AuthorizationAuditLogEntity } from '../../../../module-runtime/authorization-audit-log.entity';

describe('RolePermissionSeedService', () => {
  it('should restores Core Admin defaults transactionally without deleting manual grants', async () => {
    const admin = Object.assign(new RoleEntity(), {
      id: 1, name: 'Admin', moduleId: null, moduleRoleKey: 'admin',
    });
    const permission = Object.assign(new PermissionEntity(), {
      id: 20, name: 'read:equipment', permissionKey: 'read:equipment',
    });
    const grants = {
      find: jest.fn().mockResolvedValue([]),
      insert: jest.fn(),
    };
    const audit = { insert: jest.fn() };
    const repositories = new Map<any, any>([
      [RoleEntity, { findOne: jest.fn().mockResolvedValue(admin) }],
      [PermissionEntity, { find: jest.fn().mockResolvedValue([permission]) }],
      [RolePermissionGrantEntity, grants],
      [AuthorizationAuditLogEntity, audit],
    ]);
    const manager: any = {
      getRepository: (entity: any) => repositories.get(entity),
      query: jest.fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ permissionId: 20 }, { permissionId: 21 }])
        .mockResolvedValue([]),
    };
    const dataSource: any = {
      transaction: jest.fn(async (callback: (value: any) => Promise<void>) => callback(manager)),
    };
    const service = new RolePermissionSeedService(dataSource);

    await service.run();

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(repositories.get(RoleEntity).findOne).toHaveBeenCalledWith({
      where: { moduleId: expect.anything(), moduleRoleKey: 'admin' },
    });
    expect(grants.insert).toHaveBeenCalledWith([expect.objectContaining({
      roleId: 1,
      permissionId: 20,
      grantType: 'module_default',
      sourceModuleId: 'core',
      sourceKey: 'core.admin-role-all-permissions',
    })]);
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining('FOR UPDATE'),
      [1],
    );
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM "roles_permissions_role"'),
      [1],
    );
    expect(grants).not.toHaveProperty('delete');
    expect(audit.insert).toHaveBeenCalledWith(expect.objectContaining({
      entityKey: 'core:admin',
      action: 'role.core_default_grants.restore',
    }));
  });
});
