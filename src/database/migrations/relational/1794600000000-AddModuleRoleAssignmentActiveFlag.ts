import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddModuleRoleAssignmentActiveFlag1794600000000 implements MigrationInterface {
  name = 'AddModuleRoleAssignmentActiveFlag1794600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "module_role_assignment"
      ADD COLUMN IF NOT EXISTS "isActive" boolean NOT NULL DEFAULT true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "module_role_assignment"
      DROP COLUMN IF EXISTS "isActive"
    `);
  }
}
