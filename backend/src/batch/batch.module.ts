import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BullModule } from "@nestjs/bull";
import { ConfigModule, ConfigService } from "@nestjs/config";

import { BatchJob } from "./entities/batch-job.entity";
import { BatchOperation } from "./entities/batch-operation.entity";
import { BatchService } from "./batch.service";
import { BatchController } from "./batch.controller";
import { SplitBatchProcessor } from "./processors/split-batch.processor";
import { PaymentBatchProcessor } from "./processors/payment-batch.processor";
import { ScheduledBatchProcessor } from "./processors/scheduled-batch.processor";
import { BatchProgressService } from "./batch-progress.service";
import { BatchEventsService } from "./batch-events.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([BatchJob, BatchOperation]),
    BullModule.registerQueueAsync(
      {
        name: "batch_splits",
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          defaultJobOptions: {
            attempts: configService.get<number>("BATCH_RETRY_ATTEMPTS", 5),
            backoff: {
              type: "exponential",
              delay: configService.get<number>("BATCH_RETRY_DELAY_MS", 2000),
            },
            removeOnComplete: false,
            removeOnFail: false,
          },
        }),
        inject: [ConfigService],
      },
      {
        name: "batch_payments",
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          defaultJobOptions: {
            attempts: configService.get<number>("BATCH_RETRY_ATTEMPTS", 5),
            backoff: {
              type: "exponential",
              delay: configService.get<number>("BATCH_RETRY_DELAY_MS", 2000),
            },
            removeOnComplete: false,
            removeOnFail: false,
          },
        }),
        inject: [ConfigService],
      },
      {
        name: "batch_scheduled",
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          defaultJobOptions: {
            attempts: 3,
            backoff: {
              type: "fixed",
              delay: 5000,
            },
            removeOnComplete: true,
            removeOnFail: false,
          },
        }),
        inject: [ConfigService],
      },
    ),
  ],
  controllers: [BatchController],
  providers: [
    BatchService,
    BatchProgressService,
    BatchEventsService,
    SplitBatchProcessor,
    PaymentBatchProcessor,
    ScheduledBatchProcessor,
  ],
  exports: [BatchService, BatchProgressService],
})
export class BatchModule {}
