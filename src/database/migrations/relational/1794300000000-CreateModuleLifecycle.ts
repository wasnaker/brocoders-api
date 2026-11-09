import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateModuleLifecycle1794300000000 implements MigrationInterface {
  name = 'CreateModuleLifecycle1794300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "module_lifecycle" (
        "moduleId" character varying(100) NOT NULL,
        "packageName" character varying(200) NOT NULL,
        "version" character varying(64) NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'installed',
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "dataRetention" character varying(16) NOT NULL DEFAULT 'retained',
        "lastError" text,
        "installedAt" TIMESTAMP WITH TIME ZONE,
        "activatedAt" TIMESTAMP WITH TIME ZONE,
        "deactivatedAt" TIMESTAMP WITH TIME ZONE,
        "uninstalledAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_module_lifecycle" PRIMARY KEY ("moduleId"),
        CONSTRAINT "CHK_module_lifecycle_status"
          CHECK ("status" IN ('installing', 'installed', 'activating', 'active', 'deactivating', 'inactive', 'uninstalling', 'uninstalled', 'failed')),
        CONSTRAINT "CHK_module_lifecycle_retention"
          CHECK ("dataRetention" IN ('retained', 'purge-requested'))
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_module_lifecycle_status"
      ON "module_lifecycle" ("status", "moduleId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_module_lifecycle_status"`);
    await queryRunner.query(`DROP TABLE "module_lifecycle"`);
  }
}
