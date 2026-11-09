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
    WHERE g."roleId" = $1
      AND r."isActive" = true
      -- The legacy join cannot represent module assignment or scope. Only the
      -- Core Admin wildcard grant is globally effective without that context.
      AND r."moduleId" IS NULL
      AND r."moduleRoleKey" = 'admin'
      AND EXISTS (
        SELECT 1
        FROM "role_permission_grant" admin_wildcard_grant
        INNER JOIN "permission" admin_wildcard_permission
          ON admin_wildcard_permission."id" = admin_wildcard_grant."permissionId"
        WHERE admin_wildcard_grant."roleId" = r."id"
          AND admin_wildcard_permission."permissionKey" = '*'
          AND NOT EXISTS (
            SELECT 1 FROM "role_permission_override" wildcard_deny
            WHERE wildcard_deny."roleId" = r."id"
              AND wildcard_deny."permissionId" = admin_wildcard_permission."id"
              AND wildcard_deny."effect" = 'deny'
          )
      )
      AND p."isActive" = true
      AND (p."moduleId" IS NULL OR permission_lifecycle."status" = 'active')
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
