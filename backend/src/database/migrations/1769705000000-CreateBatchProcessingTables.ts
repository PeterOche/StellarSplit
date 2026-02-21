import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateBatchProcessingTables1769705000000 implements MigrationInterface {
  name = 'CreateBatchProcessingTables1769705000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum types
    await queryRunner.query(`
      CREATE TYPE "batch_job_type_enum" AS ENUM ('split_creation', 'payment_processing', 'scheduled_task')
    `);

    await queryRunner.query(`
      CREATE TYPE "batch_job_status_enum" AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled', 'partial')
    `);

    await queryRunner.query(`
      CREATE TYPE "batch_operation_status_enum" AS ENUM ('pending', 'processing', 'completed', 'failed', 'retrying', 'cancelled')
    `);

    // Create batch_jobs table
    await queryRunner.query(`
      CREATE TABLE "batch_jobs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "type" "batch_job_type_enum" NOT NULL,
        "status" "batch_job_status_enum" NOT NULL DEFAULT 'pending',
        "total_operations" integer NOT NULL DEFAULT 0,
        "completed_operations" integer NOT NULL DEFAULT 0,
        "failed_operations" integer NOT NULL DEFAULT 0,
        "progress" decimal(5,2) DEFAULT 0,
        "options" jsonb DEFAULT '{}',
        "error_message" text,
        "started_at" timestamp,
        "completed_at" timestamp,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_batch_jobs" PRIMARY KEY ("id")
      )
    `);

    // Create indexes for batch_jobs
    await queryRunner.query(`
      CREATE INDEX "IDX_batch_jobs_status" ON "batch_jobs" ("status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_batch_jobs_type" ON "batch_jobs" ("type")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_batch_jobs_created_at" ON "batch_jobs" ("created_at")
    `);

    // Create batch_operations table
    await queryRunner.query(`
      CREATE TABLE "batch_operations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "batch_id" uuid NOT NULL,
        "operation_index" integer NOT NULL,
        "status" "batch_operation_status_enum" NOT NULL DEFAULT 'pending',
        "payload" jsonb NOT NULL,
        "result" jsonb,
        "error_message" text,
        "error_code" varchar(50),
        "retry_count" integer DEFAULT 0,
        "started_at" timestamp,
        "completed_at" timestamp,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_batch_operations" PRIMARY KEY ("id"),
        CONSTRAINT "FK_batch_operations_batch" FOREIGN KEY ("batch_id") REFERENCES "batch_jobs"("id") ON DELETE CASCADE
      )
    `);

    // Create indexes for batch_operations
    await queryRunner.query(`
      CREATE INDEX "IDX_batch_operations_batch_id" ON "batch_operations" ("batch_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_batch_operations_status" ON "batch_operations" ("status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_batch_operations_operation_index" ON "batch_operations" ("operation_index")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX "IDX_batch_operations_operation_index"`);
    await queryRunner.query(`DROP INDEX "IDX_batch_operations_status"`);
    await queryRunner.query(`DROP INDEX "IDX_batch_operations_batch_id"`);
    await queryRunner.query(`DROP INDEX "IDX_batch_jobs_created_at"`);
    await queryRunner.query(`DROP INDEX "IDX_batch_jobs_type"`);
    await queryRunner.query(`DROP INDEX "IDX_batch_jobs_status"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE "batch_operations"`);
    await queryRunner.query(`DROP TABLE "batch_jobs"`);

    // Drop enum types
    await queryRunner.query(`DROP TYPE "batch_operation_status_enum"`);
    await queryRunner.query(`DROP TYPE "batch_job_status_enum"`);
    await queryRunner.query(`DROP TYPE "batch_job_type_enum"`);
  }
}
