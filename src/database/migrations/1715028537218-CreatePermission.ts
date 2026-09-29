import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePermission1715028537218 implements MigrationInterface {
  name = 'CreatePermission1715028537218';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "permission" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "description" character varying, CONSTRAINT "UQ_14889e6d7bdbcf7f1b42ab71920" UNIQUE ("name"), CONSTRAINT "PK_86d18e2b0b6a5c2a0a8f7e2c0c3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "roles_permissions_role" ("permissionId" integer NOT NULL, "roleId" integer NOT NULL, CONSTRAINT "PK_86d18e2b0b6a5c2a0a8f7e2c0c4" PRIMARY KEY ("permissionId", "roleId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_86d18e2b0b6a5c2a0a8f7e2c0c" ON "roles_permissions_role" ("permissionId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_86d18e2b0b6a5c2a0a8f7e2c0c5" ON "roles_permissions_role" ("roleId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "roles_permissions_role" ADD CONSTRAINT "FK_86d18e2b0b6a5c2a0a8f7e2c0c2" FOREIGN KEY ("permissionId") REFERENCES "permission"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "roles_permissions_role" ADD CONSTRAINT "FK_86d18e2b0b6a5c2a0a8f7e2c0c6" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "roles_permissions_role" DROP CONSTRAINT "FK_86d18e2b0b6a5c2a0a8f7e2c0c6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "roles_permissions_role" DROP CONSTRAINT "FK_86d18e2b0b6a5c2a0a8f7e2c0c2"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_86d18e2b0b6a5c2a0a8f7e2c0c5"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_86d18e2b0b6a5c2a0a8f7e2c0c"`,
    );
    await queryRunner.query(`DROP TABLE "roles_permissions_role"`);
    await queryRunner.query(`DROP TABLE "permission"`);
  }
}
