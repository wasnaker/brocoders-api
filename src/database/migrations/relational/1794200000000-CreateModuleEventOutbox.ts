import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateModuleEventOutbox1794200000000 implements MigrationInterface {
  name = 'CreateModuleEventOutbox1794200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "module_event_outbox" (
        "eventId" uuid NOT NULL,
        "eventName" character varying(160) NOT NULL,
        "moduleId" character varying(100) NOT NULL,
        "entityType" character varying(120) NOT NULL,
        "entityId" character varying(160) NOT NULL,
        "operation" character varying(16) NOT NULL,
        "schemaVersion" integer NOT NULL DEFAULT 1,
        "correlationId" uuid NOT NULL,
        "occurredAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "actorUserId" character varying(100),
        "data" jsonb NOT NULL,
        "status" character varying(16) NOT NULL DEFAULT 'pending',
        "attempts" integer NOT NULL DEFAULT 0,
        "lockedAt" TIMESTAMP WITH TIME ZONE,
        "lastError" text,
        "publishedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_module_event_outbox" PRIMARY KEY ("eventId"),
        CONSTRAINT "CHK_module_event_outbox_operation"
          CHECK ("operation" IN ('insert', 'update', 'delete')),
        CONSTRAINT "CHK_module_event_outbox_status"
          CHECK ("status" IN ('pending', 'processing', 'published', 'failed'))
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_module_event_outbox_pending"
      ON "module_event_outbox" ("status", "createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_module_event_outbox_pending"`);
    await queryRunner.query(`DROP TABLE "module_event_outbox"`);
  }
}
