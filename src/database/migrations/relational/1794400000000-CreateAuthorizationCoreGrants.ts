import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Introduces provenance-aware authorization grants without removing the
 * legacy roles_permissions_role relation. Existing links are copied as
 * legacy grants so authorization remains backward-compatible during cutover.
 */
export class CreateAuthorizationCoreGrants1794400000000 implements MigrationInterface {
  name = 'CreateAuthorizationCoreGrants1794400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "permission"
      ADD COLUMN IF NOT EXISTS "permissionKey" character varying(160)
    `);
    // Permission names are currently globally unique. Preserve their exact
    // values as the initial stable keys; do not derive keys from database IDs.
    await queryRunner.query(`
      UPDATE "permission"
      SET "permissionKey" = "name"
      WHERE "permissionKey" IS NULL OR btrim("permissionKey") = ''
    `);
    await queryRunner.query(`
      ALTER TABLE "permission"
      ALTER COLUMN "permissionKey" SET NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_permission_permission_key"
      ON "permission" ("permissionKey")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "role_permission_grant" (
        "id" SERIAL NOT NULL,
        "roleId" integer NOT NULL,
        "permissionId" integer NOT NULL,
        "grantType" character varying(24) NOT NULL,
        "sourceModuleId" character varying(100),
        "sourceKey" character varying(200),
        "createdBy" integer,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_role_permission_grant" PRIMARY KEY ("id"),
        CONSTRAINT "FK_role_permission_grant_role"
          FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_role_permission_grant_permission"
          FOREIGN KEY ("permissionId") REFERENCES "permission"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_role_permission_grant_created_by"
          FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON DELETE SET NULL,
        CONSTRAINT "CHK_role_permission_grant_type"
          CHECK ("grantType" IN ('module_default', 'admin_manual', 'legacy')),
        CONSTRAINT "CHK_role_permission_grant_source"
          CHECK (
            ("grantType" = 'module_default' AND "sourceModuleId" IS NOT NULL AND "sourceKey" IS NOT NULL)
            OR ("grantType" = 'admin_manual' AND "sourceModuleId" IS NULL)
            OR ("grantType" = 'legacy')
          )
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_role_permission_grant_module_default"
      ON "role_permission_grant" ("roleId", "permissionId", "sourceModuleId", "sourceKey")
      WHERE "grantType" = 'module_default'
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_role_permission_grant_manual"
      ON "role_permission_grant" ("roleId", "permissionId")
      WHERE "grantType" = 'admin_manual'
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_role_permission_grant_legacy"
      ON "role_permission_grant" ("roleId", "permissionId")
      WHERE "grantType" = 'legacy'
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_role_permission_grant_source"
      ON "role_permission_grant" ("sourceModuleId", "grantType")
    `);

    // Keep the old join table in place until all readers and writers have
    // migrated. Legacy rows are intentionally not eligible for manifest cleanup.
    await queryRunner.query(`
      INSERT INTO "role_permission_grant"
        ("roleId", "permissionId", "grantType", "sourceKey")
      SELECT "roleId", "permissionId", 'legacy', 'legacy:roles_permissions_role'
      FROM "roles_permissions_role"
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "role_permission_override" (
        "id" SERIAL NOT NULL,
        "roleId" integer NOT NULL,
        "permissionId" integer NOT NULL,
        "effect" character varying(8) NOT NULL DEFAULT 'deny',
        "reason" text,
        "createdBy" integer,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_role_permission_override" PRIMARY KEY ("id"),
        CONSTRAINT "FK_role_permission_override_role"
          FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_role_permission_override_permission"
          FOREIGN KEY ("permissionId") REFERENCES "permission"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_role_permission_override_created_by"
          FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON DELETE SET NULL,
        CONSTRAINT "CHK_role_permission_override_effect" CHECK ("effect" = 'deny')
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_role_permission_override"
      ON "role_permission_override" ("roleId", "permissionId")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "module_authorization_sync" (
        "moduleId" character varying(100) NOT NULL,
        "manifestVersion" character varying(64) NOT NULL,
        "manifestHash" character varying(128) NOT NULL,
        "syncStatus" character varying(16) NOT NULL DEFAULT 'pending',
        "lastSyncedAt" TIMESTAMP WITH TIME ZONE,
        "lastError" text,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_module_authorization_sync" PRIMARY KEY ("moduleId"),
        CONSTRAINT "CHK_module_authorization_sync_status"
          CHECK ("syncStatus" IN ('pending', 'success', 'failed'))
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "authorization_audit_log" (
        "id" BIGSERIAL NOT NULL,
        "actorUserId" integer,
        "moduleId" character varying(100),
        "entityType" character varying(40) NOT NULL,
        "entityKey" character varying(200),
        "action" character varying(80) NOT NULL,
        "before" jsonb,
        "after" jsonb,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_authorization_audit_log" PRIMARY KEY ("id"),
        CONSTRAINT "FK_authorization_audit_log_actor"
          FOREIGN KEY ("actorUserId") REFERENCES "user"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_authorization_audit_log_module_created"
      ON "authorization_audit_log" ("moduleId", "createdAt")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_authorization_audit_log_entity"
      ON "authorization_audit_log" ("entityType", "entityKey", "createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Refuse rollback when Core-only administrator state or audit history
    // cannot be represented by the legacy join table.
    await queryRunner.query(`
      DO $
      BEGIN
        IF EXISTS (SELECT 1 FROM "role_permission_grant" WHERE "grantType" = 'admin_manual') THEN
          RAISE EXCEPTION 'Cannot revert Authorization Core while administrator manual grants exist';
        END IF;
        IF EXISTS (SELECT 1 FROM "role_permission_override") THEN
          RAISE EXCEPTION 'Cannot revert Authorization Core while administrator deny overrides exist';
        END IF;
        IF EXISTS (SELECT 1 FROM "authorization_audit_log") THEN
          RAISE EXCEPTION 'Cannot revert Authorization Core while audit history exists';
        END IF;
      END
      $;
    `);
    await queryRunner.query(`
      INSERT INTO "roles_permissions_role" ("roleId", "permissionId")
      SELECT DISTINCT "roleId", "permissionId"
      FROM "role_permission_grant"
      ON CONFLICT DO NOTHING
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_authorization_audit_log_entity"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_authorization_audit_log_module_created"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "authorization_audit_log"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "module_authorization_sync"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_role_permission_override"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "role_permission_override"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_role_permission_grant_source"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_role_permission_grant_legacy"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_role_permission_grant_manual"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_role_permission_grant_module_default"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "role_permission_grant"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_permission_permission_key"`);
    await queryRunner.query(`ALTER TABLE "permission" DROP COLUMN IF EXISTS "permissionKey"`);
  }
}
