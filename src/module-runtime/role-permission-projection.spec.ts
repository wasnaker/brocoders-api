import { EntityManager } from 'typeorm';
import { rebuildRolePermissionProjection } from './role-permission-projection';

describe('rebuildRolePermissionProjection', () => {
  it('projects only active, non-denied grants for active module owners', async () => {
    const manager = {
      query: jest.fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ permissionId: 41 }])
        .mockResolvedValue([]),
    } as unknown as EntityManager;

    await rebuildRolePermissionProjection(manager, 7);

    expect(manager.query).toHaveBeenCalledWith(
      'SELECT "id" FROM "role" WHERE "id" = $1 FOR UPDATE',
      [7],
    );
    const projectionQuery = (manager.query as jest.Mock).mock.calls[1][0] as string;
    expect(projectionQuery).toContain('role_lifecycle."status" = \'active\'');
    expect(projectionQuery).toContain('permission_lifecycle."status" = \'active\'');
    expect(projectionQuery).toContain('denied_permission."permissionKey" = \'*\'');
    expect(projectionQuery).toContain('NOT EXISTS');
    expect(manager.query).toHaveBeenCalledWith(
      'DELETE FROM "roles_permissions_role" WHERE "roleId" = $1',
      [7],
    );
    expect(manager.query).toHaveBeenCalledWith(
      'INSERT INTO "roles_permissions_role" ("roleId", "permissionId") VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [7, 41],
    );
  });
});
