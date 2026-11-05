import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateModuleRoleAssignments1793900000000 implements MigrationInterface {
  name = 'CreateModuleRoleAssignments1793900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "module_role_assignment" (
      "id" SERIAL NOT NULL,
      "userId" integer NOT NULL,
      "moduleId" character varying(100) NOT NULL,
      "roleKey" character varying(100) NOT NULL,
      "scopeType" character varying(30) NOT NULL,
      "scopeId" character varying(100) NOT NULL,
      "assignedBy" integer,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_module_role_assignment" PRIMARY KEY ("id"),
      CONSTRAINT "FK_module_role_assignment_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
      CONSTRAINT "FK_module_role_assignment_assigned_by" FOREIGN KEY ("assignedBy") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    )`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_module_role_assignment_scope" ON "module_role_assignment" ("moduleId", "roleKey", "userId", "scopeType", "scopeId")`);
    await queryRunner.query(`CREATE INDEX "IDX_module_role_assignment_user" ON "module_role_assignment" ("userId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_module_role_assignment_user"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_module_role_assignment_scope"`);
    await queryRunner.query(`DROP TABLE "module_role_assignment"`);
  }
}
