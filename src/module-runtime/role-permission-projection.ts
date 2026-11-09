import { EntityManager } from 'typeorm';

/**
 * Rebuilds the legacy many-to-many relation as an effective-permission
 * projection. The grant and override tables remain authoritative.
 *
 * The projection is deliberately fail-closed: inactive Roles, inactive
 * Permissions, inactive/missing module lifecycle records, and deny overrides
 * are excluded so legacy readers cannot bypass the Core query path.
 */
export async function rebuildRolePermissionProjection(
  manager: EntityManager,
  roleId: number,
): Promise<void> {
  await manager.query(
    'SELECT "id" FROM "role" WHERE "id" = $1 FOR UPDATE',
    [roleId],
  );
  const effectiveRows: Array<{ permissionId: number }> = await manager.query(
    `SELECT DISTINCT g."permissionId"
    FROM "role_permission_grant" g
    INNER JOIN "role" r ON r."id" = g."roleId"
    INNER JOIN "permission" p ON p."id" = g."permissionId"
    LEFT JOIN "module_lifecycle" permission_lifecycle
      ON permission_lifecycle."moduleId" = p."moduleId"
    LEFT JOIN "module_lifecycle" grant_lifecycle
      ON grant_lifecycle."moduleId" = g."sourceModuleId"
    WHERE g."roleId" = $1
      AND r."isActive" = true
      -- Core-owned Roles are global. Module-owned Roles are deliberately
      -- excluded because this legacy join cannot represent module assignments
      -- or scope constraints.
      AND r."moduleId" IS NULL
      AND p."isActive" = true
      AND (p."moduleId" IS NULL OR permission_lifecycle."status" = 'active')
      AND (g."sourceModuleId" IS NULL OR g."sourceModuleId" = 'core' OR grant_lifecycle."status" = 'active')
      AND NOT EXISTS (
        SELECT 1
        FROM "role_permission_override" o
        WHERE o."roleId" = g."roleId"
          AND o."effect" = 'deny'
          AND o."permissionId" = g."permissionId"
      )`,
    [roleId],
  );
  await manager.query(
    'DELETE FROM "roles_permissions_role" WHERE "roleId" = $1',
    [roleId],
  );
  for (const row of effectiveRows) {
    await manager.query(
      'INSERT INTO "roles_permissions_role" ("roleId", "permissionId") VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [roleId, row.permissionId],
    );
  }
}
