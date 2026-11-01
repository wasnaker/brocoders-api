import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLanguageToUser1700000000000 implements MigrationInterface {
  name = 'AddLanguageToUser1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "user" ADD COLUMN "language" character varying(10)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "user" DROP COLUMN "language"',
    );
  }
}
