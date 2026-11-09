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
    LEFT JOIN "module_lifecycle" role_lifecycle
      ON role_lifecycle."moduleId" = r."moduleId"
    LEFT JOIN "module_lifecycle" permission_lifecycle
      ON permission_lifecycle."moduleId" = p."moduleId"
    WHERE g."roleId" = $1
      AND r."isActive" = true
      AND (r."moduleId" IS NULL OR r."scope" = 'global')
      AND (r."moduleId" IS NULL OR role_lifecycle."status" = 'active')
      AND p."isActive" = true
      AND (p."moduleId" IS NULL OR permission_lifecycle."status" = 'active')
      AND NOT EXISTS (
        SELECT 1
        FROM "role_permission_override" o
        INNER JOIN "permission" denied_permission
          ON denied_permission."id" = o."permissionId"
        WHERE o."roleId" = g."roleId"
          AND o."effect" = 'deny'
          AND (o."permissionId" = g."permissionId" OR denied_permission."permissionKey" = '*')
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
