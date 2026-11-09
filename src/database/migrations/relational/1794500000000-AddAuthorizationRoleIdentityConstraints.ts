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
          SELECT lower("name")
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
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_role_module_role_key"
      ON "role" ("moduleId", "moduleRoleKey")
      WHERE "moduleId" IS NOT NULL AND "moduleRoleKey" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_role_module_role_key"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_role_core_role_key"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_role_name_case_insensitive"`);
    await queryRunner.query(`ALTER TABLE "role" DROP COLUMN IF EXISTS "description"`);
  }
}
