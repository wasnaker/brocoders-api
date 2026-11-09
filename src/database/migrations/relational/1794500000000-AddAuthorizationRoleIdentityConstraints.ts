import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Enforces the stable identity of module-owned Roles and the global Role
 * display-name uniqueness policy. Existing duplicate names fail explicitly
 * rather than being silently renamed or reassigned during migration.
 */
export class AddAuthorizationRoleIdentityConstraints1794500000000 implements MigrationInterface {
  name = 'AddAuthorizationRoleIdentityConstraints1794500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "role" ADD COLUMN IF NOT EXISTS "description" text NULL`);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT lower(btrim("name"))
          FROM "role"
          GROUP BY lower(btrim("name"))
          HAVING COUNT(*) > 1
        ) THEN
          RAISE EXCEPTION 'Cannot enforce global Role name uniqueness: duplicate Role names exist';
        END IF;
      END
      $$;
    `);
    await queryRunner.query(`
      UPDATE "role" SET "moduleRoleKey" = 'admin'
      WHERE "moduleId" IS NULL AND "moduleRoleKey" IS NULL AND lower("name") = 'admin'
    `);
    await queryRunner.query(`
      UPDATE "role" SET "moduleRoleKey" = 'user'
      WHERE "moduleId" IS NULL AND "moduleRoleKey" IS NULL AND lower("name") = 'user'
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_role_core_role_key"
      ON "role" ("moduleRoleKey")
      WHERE "moduleId" IS NULL AND "moduleRoleKey" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_role_name_case_insensitive"
      ON "role" (lower(btrim("name")))
    `);
    // The legacy join cannot represent module assignments, scopes, or deny
    // overrides. Restrict it to Core Admin's active wildcard grant only.
    await queryRunner.query(`
      DELETE FROM "roles_permissions_role"
    `);
    await queryRunner.query(`
      INSERT INTO "roles_permissions_role" ("roleId", "permissionId")
      SELECT DISTINCT g."roleId", g."permissionId"
      FROM "role_permission_grant" g
      INNER JOIN "role" r ON r."id" = g."roleId"
      INNER JOIN "permission" p ON p."id" = g."permissionId"
      LEFT JOIN "module_lifecycle" permission_lifecycle
        ON permission_lifecycle."moduleId" = p."moduleId"
      WHERE r."moduleId" IS NULL
        AND r."moduleRoleKey" = 'admin'
        AND r."isActive" = true
        AND p."isActive" = true
        AND (p."moduleId" IS NULL OR permission_lifecycle."status" = 'active')
        AND EXISTS (
          SELECT 1
          FROM "role_permission_grant" wildcard_grant
          INNER JOIN "permission" wildcard_permission
            ON wildcard_permission."id" = wildcard_grant."permissionId"
          WHERE wildcard_grant."roleId" = r."id"
            AND wildcard_permission."permissionKey" = '*'
            AND NOT EXISTS (
              SELECT 1 FROM "role_permission_override" wildcard_deny
              WHERE wildcard_deny."roleId" = r."id"
                AND wildcard_deny."permissionId" = wildcard_permission."id"
                AND wildcard_deny."effect" = 'deny'
            )
        )
        AND NOT EXISTS (
          SELECT 1 FROM "role_permission_override" specific_deny
          WHERE specific_deny."roleId" = g."roleId"
            AND specific_deny."permissionId" = g."permissionId"
            AND specific_deny."effect" = 'deny'
        )
      ON CONFLICT DO NOTHING
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_role_module_role_key"
      ON "role" ("moduleId", "moduleRoleKey")
      WHERE "moduleId" IS NOT NULL AND "moduleRoleKey" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_role_core_role_key"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_role_name_case_insensitive"`);
    await queryRunner.query(`ALTER TABLE "role" DROP COLUMN IF EXISTS "description"`);
  }
}
