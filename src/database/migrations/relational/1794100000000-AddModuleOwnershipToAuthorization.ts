import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds ownership metadata for module-registered RBAC definitions. */
export class AddModuleOwnershipToAuthorization1794100000000 implements MigrationInterface {
  name = 'AddModuleOwnershipToAuthorization1794100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "role" ADD COLUMN "moduleId" character varying(100)`);
    await queryRunner.query(`ALTER TABLE "role" ADD COLUMN "moduleRoleKey" character varying(100)`);
    await queryRunner.query(`ALTER TABLE "role" ADD COLUMN "isActive" boolean NOT NULL DEFAULT true`);
    await queryRunner.query(`ALTER TABLE "permission" ADD COLUMN "moduleId" character varying(100)`);
    await queryRunner.query(`ALTER TABLE "permission" ADD COLUMN "isActive" boolean NOT NULL DEFAULT true`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_role_module_role_key" ON "role" ("moduleId", "moduleRoleKey") WHERE "moduleId" IS NOT NULL AND "moduleRoleKey" IS NOT NULL`);
    await queryRunner.query(`CREATE INDEX "IDX_role_module_id" ON "role" ("moduleId")`);
    await queryRunner.query(`CREATE INDEX "IDX_permission_module_id" ON "permission" ("moduleId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_permission_module_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_role_module_id"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_role_module_role_key"`);
    await queryRunner.query(`ALTER TABLE "permission" DROP COLUMN "isActive"`);
    await queryRunner.query(`ALTER TABLE "permission" DROP COLUMN "moduleId"`);
    await queryRunner.query(`ALTER TABLE "role" DROP COLUMN "isActive"`);
    await queryRunner.query(`ALTER TABLE "role" DROP COLUMN "moduleRoleKey"`);
    await queryRunner.query(`ALTER TABLE "role" DROP COLUMN "moduleId"`);
  }
}
