import { Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { BatchJob, BatchJobStatus } from "../entities/batch-job.entity";
import { BatchOperation, BatchOperationStatus } from "../entities/batch-operation.entity";
import { BatchProgressService } from "../batch-progress.service";
import { BatchJobData } from "../batch.service";

interface SplitPayload {
  totalAmount: number;
  participants: Array<{ userId: string; amount: number; walletAddress?: string }>;
  description?: string;
  preferredCurrency?: string;
  creatorWalletAddress?: string;
}

@Processor("batch_splits")
export class SplitBatchProcessor {
  private readonly logger = new Logger(SplitBatchProcessor.name);

  constructor(
    @InjectRepository(BatchJob)
    private batchJobRepository: Repository<BatchJob>,
    @InjectRepository(BatchOperation)
    private batchOperationRepository: Repository<BatchOperation>,
    private batchProgressService: BatchProgressService,
  ) {}

  @Process("process")
  async handleSplitBatch(job: Job<BatchJobData>): Promise<void> {
    const { batchId, chunkSize, concurrency } = job.data;

    this.logger.log(`Starting split batch ${batchId}`);

    // Update batch status
    await this.batchJobRepository.update(batchId, {
      status: BatchJobStatus.PROCESSING,
      started_at: new Date(),
    });

    try {
      // Get all pending operations
      const operations = await this.batchOperationRepository.find({
        where: {
          batch_id: batchId,
          status: BatchOperationStatus.PENDING,
        },
        order: { operation_index: "ASC" },
      });

      if (operations.length === 0) {
        this.logger.warn(`No pending operations for batch ${batchId}`);
        return;
      }

      // Process in chunks
      for (let i = 0; i < operations.length; i += chunkSize) {
        const chunk = operations.slice(i, i + chunkSize);
        
        this.logger.debug(`Processing chunk ${Math.floor(i / chunkSize) + 1} of ${Math.ceil(operations.length / chunkSize)}`);

        // Process chunk with concurrency limit
        await this.processChunk(chunk, concurrency);

        // Update job progress
        const progress = Math.round(((i + chunk.length) / operations.length) * 100);
        await job.progress(progress);
      }

      this.logger.log(`Completed split batch ${batchId}`);
    } catch (error: any) {
      this.logger.error(`Failed to process split batch ${batchId}: ${error.message}`);
      
      // Update batch with error
      await this.batchJobRepository.update(batchId, {
        status: BatchJobStatus.FAILED,
        error_message: error.message,
        completed_at: new Date(),
      });

      throw error;
    }
  }

  /**
   * Process a chunk of operations with concurrency control
   */
  private async processChunk(
    operations: BatchOperation[],
    concurrency: number,
  ): Promise<void> {
    const queue = [...operations];
    const executing: Promise<void>[] = [];

    while (queue.length > 0 || executing.length > 0) {
      // Start new operations up to concurrency limit
      while (executing.length < concurrency && queue.length > 0) {
        const operation = queue.shift()!;
        executing.push(this.processOperation(operation));
      }

      // Wait for at least one operation to complete
      if (executing.length > 0) {
        await Promise.race(executing);
        
        // Remove completed promises
        for (let i = executing.length - 1; i >= 0; i--) {
          const promise = executing[i];
          // Check if promise is settled
          const result = await Promise.race([
            promise.then(() => ({ done: true })),
            Promise.resolve({ done: false }),
          ]);
          if (result.done) {
            executing.splice(i, 1);
          }
        }
      }
    }

    // Wait for all remaining operations
    await Promise.all(executing);
  }

  /**
   * Process a single split operation
   */
  private async processOperation(operation: BatchOperation): Promise<void> {
    try {
      // Mark as started
      await this.batchProgressService.markOperationStarted(operation.id);

      const payload = operation.payload as SplitPayload;

      // Validate payload
      this.validatePayload(payload);

      // Simulate split creation (replace with actual service call)
      const result = await this.createSplit(payload);

      // Mark as completed
      await this.batchProgressService.markOperationCompleted(operation.id, result);

      this.logger.debug(`Completed operation ${operation.id}`);
    } catch (error: any) {
      this.logger.error(`Failed operation ${operation.id}: ${error.message}`);
      
      await this.batchProgressService.markOperationFailed(
        operation.id,
        error.message,
        error.code || "UNKNOWN_ERROR",
      );
    }
  }

  /**
   * Validate split payload
   */
  private validatePayload(payload: SplitPayload): void {
    if (!payload.totalAmount || payload.totalAmount <= 0) {
      throw new Error("Invalid total amount");
    }

    if (!payload.participants || payload.participants.length === 0) {
      throw new Error("No participants provided");
    }

    const totalParticipantAmount = payload.participants.reduce(
      (sum, p) => sum + (p.amount || 0),
      0,
    );

    if (Math.abs(totalParticipantAmount - payload.totalAmount) > 0.01) {
      throw new Error("Participant amounts do not sum to total amount");
    }
  }

  /**
   * Create a split (placeholder for actual implementation)
   */
  private async createSplit(payload: SplitPayload): Promise<Record<string, any>> {
    // TODO: Integrate with actual split creation service
    // For now, simulate successful creation
    return {
      splitId: `split_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      totalAmount: payload.totalAmount,
      participantCount: payload.participants.length,
      createdAt: new Date().toISOString(),
    };
  }
}
