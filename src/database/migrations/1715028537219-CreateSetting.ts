import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSetting1715028537219 implements MigrationInterface {
  name = 'CreateSetting1715028537219';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS \`setting\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`key\` VARCHAR(255) NOT NULL,
        \`value\` TEXT NULL,
        \`type\` VARCHAR(255) NOT NULL,
        \`group\` VARCHAR(255) NOT NULL,
        \`moduleAlias\` VARCHAR(255) NULL,
        \`createdAt\` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_setting_key\` (\`key\`),
        INDEX \`IDX_setting_group\` (\`group\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`setting\``);
  }
}