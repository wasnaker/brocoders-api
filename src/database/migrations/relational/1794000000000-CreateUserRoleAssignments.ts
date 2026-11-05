import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Introduces the canonical many-to-many user/role relation.
 *
 * The legacy user.roleId column is intentionally retained during the
 * compatibility period. Existing assignments are copied so no user loses
 * their current role when the new relation is introduced.
 */
export class CreateUserRoleAssignments1794000000000 implements MigrationInterface {
  name = 'CreateUserRoleAssignments1794000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "user_roles_role" (
      "userId" integer NOT NULL,
      "roleId" integer NOT NULL,
      CONSTRAINT "PK_user_roles_role" PRIMARY KEY ("userId", "roleId"),
      CONSTRAINT "FK_user_roles_role_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
      CONSTRAINT "FK_user_roles_role_role" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    )`);

    await queryRunner.query(
      `CREATE INDEX "IDX_user_roles_role_user" ON "user_roles_role" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_roles_role_role" ON "user_roles_role" ("roleId")`,
    );

    await queryRunner.query(`
      INSERT INTO "user_roles_role" ("userId", "roleId")
      SELECT "id", "roleId"
      FROM "user"
      WHERE "roleId" IS NOT NULL
      ON CONFLICT ("userId", "roleId") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_user_roles_role_role"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_user_roles_role_user"`);
    await queryRunner.query(`DROP TABLE "user_roles_role"`);
  }
}
