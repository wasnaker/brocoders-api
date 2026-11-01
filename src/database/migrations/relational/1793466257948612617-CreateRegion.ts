import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRegion1793466257948612617 implements MigrationInterface {
  name = 'CreateRegion1793466257948612617';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS \`province\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`name\` VARCHAR(190) NOT NULL,
        \`isoCode\` VARCHAR(255) NULL,
        \`latitude\` DECIMAL(10, 6) NULL,
        \`longitude\` DECIMAL(10, 6) NULL,
        \`createdAt\` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`UQ_province_isoCode\` (\`isoCode\`),
        INDEX \`IDX_province_name\` (\`name\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS \`regency\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`provinceId\` INT NOT NULL,
        \`name\` VARCHAR(190) NOT NULL,
        \`type\` VARCHAR(255) NOT NULL DEFAULT 'kabupaten',
        \`isActive\` TINYINT NOT NULL DEFAULT 1,
        \`createdAt\` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_regency_provinceId\` (\`provinceId\`),
        INDEX \`IDX_regency_name\` (\`name\`),
        CONSTRAINT \`FK_regency_province\` FOREIGN KEY (\`provinceId\`)
          REFERENCES \`province\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`regency\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`province\``);
  }
}
