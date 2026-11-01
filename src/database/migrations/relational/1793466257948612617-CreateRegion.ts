import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRegion1793466257948612617 implements MigrationInterface {
  name = 'CreateRegion1793466257948612617';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "province" (
        "id" SERIAL NOT NULL,
        "name" character varying(190) NOT NULL,
        "isoCode" character varying(255),
        "latitude" numeric(10, 6),
        "longitude" numeric(10, 6),
        "createdAt" TIMESTAMP DEFAULT now(),
        "updatedAt" TIMESTAMP DEFAULT now(),
        CONSTRAINT "UQ_province_isoCode" UNIQUE ("isoCode"),
        CONSTRAINT "PK_province" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_province_name" ON "province" ("name")',
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "regency" (
        "id" SERIAL NOT NULL,
        "provinceId" integer NOT NULL,
        "name" character varying(190) NOT NULL,
        "type" character varying(255) NOT NULL DEFAULT 'kabupaten',
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP DEFAULT now(),
        "updatedAt" TIMESTAMP DEFAULT now(),
        CONSTRAINT "PK_regency" PRIMARY KEY ("id"),
        CONSTRAINT "FK_regency_province" FOREIGN KEY ("provinceId")
          REFERENCES "province" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_regency_provinceId" ON "regency" ("provinceId")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_regency_name" ON "regency" ("name")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "regency"');
    await queryRunner.query('DROP TABLE IF EXISTS "province"');
  }
}
