import { Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { BatchJob, BatchJobType, BatchJobStatus } from "../entities/batch-job.entity";
import { BatchOperation, BatchOperationStatus } from "../entities/batch-operation.entity";
import { BatchProgressService } from "../batch-progress.service";

interface ScheduledJobData {
  batchId: string;
  taskType: string;
  params?: Record<string, any>;
}

@Processor("batch_scheduled")
export class ScheduledBatchProcessor {
  private readonly logger = new Logger(ScheduledBatchProcessor.name);

  constructor(
    @InjectRepository(BatchJob)
    private batchJobRepository: Repository<BatchJob>,
    @InjectRepository(BatchOperation)
    private batchOperationRepository: Repository<BatchOperation>,
    private batchProgressService: BatchProgressService,
  ) {}

  @Process("daily_reconciliation")
  async handleDailyReconciliation(job: Job<ScheduledJobData>): Promise<void> {
    const { batchId } = job.data;
    this.logger.log(`Starting daily reconciliation for batch ${batchId}`);

    try {
      await this.executeScheduledTask(batchId, "daily_reconciliation", async () => {
        // TODO: Implement daily payment reconciliation
        // - Verify all pending payments
        // - Update statuses from Stellar network
        // - Generate reconciliation report
        
        await this.delay(2000); // Simulate work
        
        return {
          reconciledPayments: 150,
          failedPayments: 3,
          pendingPayments: 12,
          reportGenerated: true,
        };
      });

      this.logger.log(`Completed daily reconciliation for batch ${batchId}`);
    } catch (error: any) {
      this.logger.error(`Daily reconciliation failed: ${error.message}`);
      throw error;
    }
  }

  @Process("weekly_summary")
  async handleWeeklySummary(job: Job<ScheduledJobData>): Promise<void> {
    const { batchId } = job.data;
    this.logger.log(`Starting weekly summary for batch ${batchId}`);

    try {
      await this.executeScheduledTask(batchId, "weekly_summary", async () => {
        // TODO: Implement weekly summary generation
        // - Aggregate split statistics
        // - Calculate total volumes
        // - Generate user activity reports
        
        await this.delay(3000); // Simulate work
        
        return {
          totalSplits: 1250,
          totalPayments: 3420,
          totalVolume: 45678.90,
          activeUsers: 89,
          reportGenerated: true,
        };
      });

      this.logger.log(`Completed weekly summary for batch ${batchId}`);
    } catch (error: any) {
      this.logger.error(`Weekly summary failed: ${error.message}`);
      throw error;
    }
  }

  @Process("monthly_analytics")
  async handleMonthlyAnalytics(job: Job<ScheduledJobData>): Promise<void> {
    const { batchId } = job.data;
    this.logger.log(`Starting monthly analytics for batch ${batchId}`);

    try {
      await this.executeScheduledTask(batchId, "monthly_analytics", async () => {
        // TODO: Implement monthly analytics aggregation
        // - Aggregate spending by category
        // - Calculate user retention
        // - Generate trend analysis
        
        await this.delay(5000); // Simulate work
        
        return {
          totalVolume: 156789.45,
          averageSplitAmount: 125.50,
          topCategories: ["Food", "Travel", "Utilities"],
          userRetentionRate: 0.87,
          reportGenerated: true,
        };
      });

      this.logger.log(`Completed monthly analytics for batch ${batchId}`);
    } catch (error: any) {
      this.logger.error(`Monthly analytics failed: ${error.message}`);
      throw error;
    }
  }

  @Process("cleanup_old_batches")
  async handleCleanup(job: Job<ScheduledJobData>): Promise<void> {
    const { batchId, params } = job.data;
    const retentionDays = params?.retentionDays || 30;
    
    this.logger.log(`Starting cleanup for batches older than ${retentionDays} days`);

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      // Find old completed batches
      const oldBatches = await this.batchJobRepository.find({
        where: {
          status: BatchJobStatus.COMPLETED,
          completed_at: cutoffDate as any, // TypeORM comparison
        },
      });

      // Delete associated operations first
      for (const batch of oldBatches) {
        await this.batchOperationRepository.delete({ batch_id: batch.id });
      }

      // Delete batches
      await this.batchJobRepository.delete({
        status: BatchJobStatus.COMPLETED,
        completed_at: cutoffDate as any,
      });

      this.logger.log(`Cleaned up ${oldBatches.length} old batches`);

      await this.executeScheduledTask(batchId, "cleanup_old_batches", async () => ({
        deletedBatches: oldBatches.length,
        retentionDays,
        cutoffDate: cutoffDate.toISOString(),
      }));
    } catch (error: any) {
      this.logger.error(`Cleanup failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute a scheduled task with proper tracking
   */
  private async executeScheduledTask(
    batchId: string,
    taskType: string,
    taskFn: () => Promise<Record<string, any>>,
  ): Promise<void> {
    // Update batch status
    await this.batchJobRepository.update(batchId, {
      status: BatchJobStatus.PROCESSING,
      started_at: new Date(),
    });

    // Create a single operation for tracking
    const operation = this.batchOperationRepository.create({
      batch_id: batchId,
      operation_index: 0,
      status: BatchOperationStatus.PROCESSING,
      payload: { taskType },
    });

    await this.batchOperationRepository.save(operation);
    await this.batchProgressService.markOperationStarted(operation.id);

    try {
      // Execute the task
      const result = await taskFn();

      // Mark as completed
      await this.batchProgressService.markOperationCompleted(operation.id, result);

      // Update batch status
      await this.batchJobRepository.update(batchId, {
        status: BatchJobStatus.COMPLETED,
        completed_at: new Date(),
      });
    } catch (error: any) {
      // Mark as failed
      await this.batchProgressService.markOperationFailed(
        operation.id,
        error.message,
        "SCHEDULED_TASK_ERROR",
      );

      // Update batch status
      await this.batchJobRepository.update(batchId, {
        status: BatchJobStatus.FAILED,
        error_message: error.message,
        completed_at: new Date(),
      });

      throw error;
    }
  }

  /**
   * Schedule a new recurring batch job
   */
  async scheduleRecurringJob(
    queue: any,
    taskType: string,
    cronExpression: string,
    params?: Record<string, any>,
  ): Promise<string> {
    // Create batch job record
    const batch = this.batchJobRepository.create({
      type: BatchJobType.SCHEDULED_TASK,
      status: BatchJobStatus.PENDING,
      total_operations: 1,
      options: { taskType, cronExpression, params },
    });

    const savedBatch = await this.batchJobRepository.save(batch);

    // Add to queue with repeat options
    await queue.add(
      taskType,
      {
        batchId: savedBatch.id,
        taskType,
        params,
      },
      {
        repeat: {
          cron: cronExpression,
        },
        jobId: `${taskType}_${savedBatch.id}`,
      },
    );

    this.logger.log(`Scheduled ${taskType} job with cron: ${cronExpression}`);

    return savedBatch.id;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
