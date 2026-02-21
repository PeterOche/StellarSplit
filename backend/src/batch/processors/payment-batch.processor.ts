import { Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { BatchJob, BatchJobStatus } from "../entities/batch-job.entity";
import { BatchOperation, BatchOperationStatus } from "../entities/batch-operation.entity";
import { BatchProgressService } from "../batch-progress.service";
import { BatchJobData } from "../batch.service";

interface PaymentPayload {
  splitId: string;
  participantId: string;
  stellarTxHash: string;
}

@Processor("batch_payments")
export class PaymentBatchProcessor {
  private readonly logger = new Logger(PaymentBatchProcessor.name);

  constructor(
    @InjectRepository(BatchJob)
    private batchJobRepository: Repository<BatchJob>,
    @InjectRepository(BatchOperation)
    private batchOperationRepository: Repository<BatchOperation>,
    private batchProgressService: BatchProgressService,
  ) {}

  @Process("process")
  async handlePaymentBatch(job: Job<BatchJobData>): Promise<void> {
    const { batchId, chunkSize, concurrency } = job.data;

    this.logger.log(`Starting payment batch ${batchId}`);

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

      this.logger.log(`Completed payment batch ${batchId}`);
    } catch (error: any) {
      this.logger.error(`Failed to process payment batch ${batchId}: ${error.message}`);
      
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
   * Process a single payment operation
   */
  private async processOperation(operation: BatchOperation): Promise<void> {
    try {
      // Mark as started
      await this.batchProgressService.markOperationStarted(operation.id);

      const payload = operation.payload as PaymentPayload;

      // Validate payload
      this.validatePayload(payload);

      // Simulate payment processing (replace with actual service call)
      const result = await this.processPayment(payload);

      // Mark as completed
      await this.batchProgressService.markOperationCompleted(operation.id, result);

      this.logger.debug(`Completed payment operation ${operation.id}`);
    } catch (error: any) {
      this.logger.error(`Failed payment operation ${operation.id}: ${error.message}`);
      
      await this.batchProgressService.markOperationFailed(
        operation.id,
        error.message,
        error.code || "PAYMENT_ERROR",
      );
    }
  }

  /**
   * Validate payment payload
   */
  private validatePayload(payload: PaymentPayload): void {
    if (!payload.splitId) {
      throw new Error("Split ID is required");
    }

    if (!payload.participantId) {
      throw new Error("Participant ID is required");
    }

    if (!payload.stellarTxHash || payload.stellarTxHash.length < 10) {
      throw new Error("Invalid Stellar transaction hash");
    }
  }

  /**
   * Process a payment (placeholder for actual implementation)
   */
  private async processPayment(payload: PaymentPayload): Promise<Record<string, any>> {
    // TODO: Integrate with actual payment processing service
    // For now, simulate successful processing
    
    // Add small delay to simulate processing
    await this.delay(100);
    
    return {
      paymentId: `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      splitId: payload.splitId,
      participantId: payload.participantId,
      stellarTxHash: payload.stellarTxHash,
      status: "confirmed",
      processedAt: new Date().toISOString(),
    };
  }

  /**
   * Delay helper for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
