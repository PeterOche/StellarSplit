import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { EventEmitter2 } from "@nestjs/event-emitter";

import { BatchJob, BatchJobStatus } from "./entities/batch-job.entity";
import { BatchOperation, BatchOperationStatus } from "./entities/batch-operation.entity";
import { BatchProgressEventDto } from "./dto/batch-status.dto";

@Injectable()
export class BatchProgressService {
  private readonly logger = new Logger(BatchProgressService.name);

  constructor(
    @InjectRepository(BatchJob)
    private batchJobRepository: Repository<BatchJob>,
    @InjectRepository(BatchOperation)
    private batchOperationRepository: Repository<BatchOperation>,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * Update batch progress after an operation completes
   */
  async updateProgress(batchId: string): Promise<void> {
    const batch = await this.batchJobRepository.findOne({
      where: { id: batchId },
      relations: ["operations"],
    });

    if (!batch) {
      this.logger.warn(`Batch ${batchId} not found for progress update`);
      return;
    }

    const operations = batch.operations || [];
    const completed = operations.filter(
      (op) => op.status === BatchOperationStatus.COMPLETED,
    ).length;
    const failed = operations.filter(
      (op) => op.status === BatchOperationStatus.FAILED,
    ).length;
    const processing = operations.filter(
      (op) => op.status === BatchOperationStatus.PROCESSING,
    ).length;

    batch.completed_operations = completed;
    batch.failed_operations = failed;
    batch.progress = Math.round((completed / batch.total_operations) * 100);

    // Determine batch status
    if (completed + failed === batch.total_operations) {
      if (failed === 0) {
        batch.status = BatchJobStatus.COMPLETED;
        batch.completed_at = new Date();
      } else if (completed === 0) {
        batch.status = BatchJobStatus.FAILED;
        batch.completed_at = new Date();
      } else {
        batch.status = BatchJobStatus.PARTIAL;
        batch.completed_at = new Date();
      }
    } else if (processing > 0 && batch.status === BatchJobStatus.PENDING) {
      batch.status = BatchJobStatus.PROCESSING;
      if (!batch.started_at) {
        batch.started_at = new Date();
      }
    }

    await this.batchJobRepository.save(batch);

    // Emit progress event
    this.emitProgressEvent(batch);
  }

  /**
   * Mark an operation as started
   */
  async markOperationStarted(operationId: string): Promise<void> {
    await this.batchOperationRepository.update(operationId, {
      status: BatchOperationStatus.PROCESSING,
      started_at: new Date(),
    });
  }

  /**
   * Mark an operation as completed
   */
  async markOperationCompleted(
    operationId: string,
    result?: Record<string, any>,
  ): Promise<void> {
    const operation = await this.batchOperationRepository.findOne({
      where: { id: operationId },
      relations: ["batch"],
    });

    if (!operation) {
      this.logger.warn(`Operation ${operationId} not found`);
      return;
    }

    await this.batchOperationRepository.update(operationId, {
      status: BatchOperationStatus.COMPLETED,
      result,
      completed_at: new Date(),
    });

    // Update batch progress
    await this.updateProgress(operation.batch_id);
  }

  /**
   * Mark an operation as failed
   */
  async markOperationFailed(
    operationId: string,
    errorMessage: string,
    errorCode?: string,
  ): Promise<void> {
    const operation = await this.batchOperationRepository.findOne({
      where: { id: operationId },
      relations: ["batch"],
    });

    if (!operation) {
      this.logger.warn(`Operation ${operationId} not found`);
      return;
    }

    const retryCount = operation.retry_count + 1;
    const shouldRetry = retryCount < (operation.batch?.options?.retryAttempts || 5);

    const updateData: any = {
      status: shouldRetry ? BatchOperationStatus.RETRYING : BatchOperationStatus.FAILED,
      error_message: errorMessage,
      error_code: errorCode,
      retry_count: retryCount,
    };
    
    if (!shouldRetry) {
      updateData.completed_at = new Date();
    }
    
    await this.batchOperationRepository.update(operationId, updateData);

    // Update batch progress
    await this.updateProgress(operation.batch_id);
  }

  /**
   * Calculate estimated time remaining
   */
  calculateETA(batch: BatchJob): number | undefined {
    if (!batch.started_at || batch.completed_operations === 0) {
      return undefined;
    }

    const elapsed = Date.now() - batch.started_at.getTime();
    const rate = batch.completed_operations / elapsed; // operations per ms
    const remaining = batch.total_operations - batch.completed_operations;
    const eta = remaining / rate;

    return Math.round(eta);
  }

  /**
   * Calculate processing rate (operations per second)
   */
  calculateProcessingRate(batch: BatchJob): number | undefined {
    if (!batch.started_at || batch.completed_operations === 0) {
      return undefined;
    }

    const elapsed = (Date.now() - batch.started_at.getTime()) / 1000; // seconds
    return Math.round((batch.completed_operations / elapsed) * 100) / 100;
  }

  /**
   * Emit progress event
   */
  private emitProgressEvent(batch: BatchJob): void {
    const event: BatchProgressEventDto = {
      batchId: batch.id,
      progress: batch.progress,
      completedOperations: batch.completed_operations,
      failedOperations: batch.failed_operations,
      status: batch.status,
      message: this.getProgressMessage(batch),
    };

    this.eventEmitter.emit("batch.progress", event);
    this.logger.debug(`Batch ${batch.id} progress: ${batch.progress}%`);
  }

  /**
   * Get human-readable progress message
   */
  private getProgressMessage(batch: BatchJob): string {
    switch (batch.status) {
      case BatchJobStatus.PENDING:
        return "Waiting to start";
      case BatchJobStatus.PROCESSING:
        return `Processing: ${batch.completed_operations}/${batch.total_operations} completed`;
      case BatchJobStatus.COMPLETED:
        return "All operations completed successfully";
      case BatchJobStatus.FAILED:
        return "All operations failed";
      case BatchJobStatus.PARTIAL:
        return `${batch.completed_operations} completed, ${batch.failed_operations} failed`;
      case BatchJobStatus.CANCELLED:
        return "Batch cancelled";
      default:
        return "Unknown status";
    }
  }
}
