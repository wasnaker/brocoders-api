import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSetting1715028537219 implements MigrationInterface {
  name = 'CreateSetting1715028537219';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "setting" (
        "id" SERIAL NOT NULL,
        "key" character varying(255) NOT NULL,
        "value" text NOT NULL,
        "type" character varying(255) NOT NULL,
        "group" character varying(255) NOT NULL,
        "moduleAlias" character varying(255),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_setting_key" UNIQUE ("key"),
        CONSTRAINT "PK_setting" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_setting_group" ON "setting" ("group")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "setting"');
  }
}
