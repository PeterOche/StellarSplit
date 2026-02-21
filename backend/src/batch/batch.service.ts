import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { InjectQueue } from "@nestjs/bull";
import { Queue, Job } from "bull";
import { ConfigService } from "@nestjs/config";

import { BatchJob, BatchJobType, BatchJobStatus } from "./entities/batch-job.entity";
import { BatchOperation, BatchOperationStatus } from "./entities/batch-operation.entity";
import {
  CreateBatchSplitsDto,
  CreateBatchPaymentsDto,
  BatchOptionsDto,
} from "./dto/create-batch.dto";
import { BatchStatusDto, BatchListDto } from "./dto/batch-status.dto";
import { BatchProgressService } from "./batch-progress.service";

export interface BatchJobData {
  batchId: string;
  chunkSize: number;
  concurrency: number;
}

@Injectable()
export class BatchService {
  private readonly logger = new Logger(BatchService.name);
  private readonly defaultChunkSize: number;
  private readonly defaultConcurrency: number;

  constructor(
    @InjectRepository(BatchJob)
    private batchJobRepository: Repository<BatchJob>,
    @InjectRepository(BatchOperation)
    private batchOperationRepository: Repository<BatchOperation>,
    @InjectQueue("batch_splits") private splitQueue: Queue,
    @InjectQueue("batch_payments") private paymentQueue: Queue,
    @InjectQueue("batch_scheduled") private scheduledQueue: Queue,
    private batchProgressService: BatchProgressService,
    private configService: ConfigService,
  ) {
    this.defaultChunkSize = this.configService.get<number>("BATCH_CHUNK_SIZE", 100);
    this.defaultConcurrency = this.configService.get<number>("BATCH_CONCURRENCY", 5);
  }

  /**
   * Create a batch of splits
   */
  async createBatchSplits(dto: CreateBatchSplitsDto): Promise<BatchStatusDto> {
    const { splits, options } = dto;

    if (!splits || splits.length === 0) {
      throw new HttpException("No splits provided", HttpStatus.BAD_REQUEST);
    }

    // Create batch job
    const batch = this.batchJobRepository.create({
      type: BatchJobType.SPLIT_CREATION,
      status: BatchJobStatus.PENDING,
      total_operations: splits.length,
      options: options || {},
    });

    const savedBatch = await this.batchJobRepository.save(batch);

    // Create operations
    const operations = splits.map((split, index) =>
      this.batchOperationRepository.create({
        batch_id: savedBatch.id,
        operation_index: index,
        status: BatchOperationStatus.PENDING,
        payload: split,
      }),
    );

    await this.batchOperationRepository.save(operations);

    // Queue the batch job
    const chunkSize = options?.chunkSize || this.defaultChunkSize;
    const concurrency = options?.concurrency || this.defaultConcurrency;

    await this.splitQueue.add(
      "process",
      {
        batchId: savedBatch.id,
        chunkSize,
        concurrency,
      } as BatchJobData,
      {
        priority: options?.priority,
        delay: options?.delay,
        jobId: savedBatch.id,
      },
    );

    this.logger.log(`Created batch split job ${savedBatch.id} with ${splits.length} operations`);

    return this.getBatchStatus(savedBatch.id);
  }

  /**
   * Create a batch of payments
   */
  async createBatchPayments(dto: CreateBatchPaymentsDto): Promise<BatchStatusDto> {
    const { payments, options } = dto;

    if (!payments || payments.length === 0) {
      throw new HttpException("No payments provided", HttpStatus.BAD_REQUEST);
    }

    // Create batch job
    const batch = this.batchJobRepository.create({
      type: BatchJobType.PAYMENT_PROCESSING,
      status: BatchJobStatus.PENDING,
      total_operations: payments.length,
      options: options || {},
    });

    const savedBatch = await this.batchJobRepository.save(batch);

    // Create operations
    const operations = payments.map((payment, index) =>
      this.batchOperationRepository.create({
        batch_id: savedBatch.id,
        operation_index: index,
        status: BatchOperationStatus.PENDING,
        payload: payment,
      }),
    );

    await this.batchOperationRepository.save(operations);

    // Queue the batch job
    const chunkSize = options?.chunkSize || this.defaultChunkSize;
    const concurrency = options?.concurrency || this.defaultConcurrency;

    await this.paymentQueue.add(
      "process",
      {
        batchId: savedBatch.id,
        chunkSize,
        concurrency,
      } as BatchJobData,
      {
        priority: options?.priority,
        delay: options?.delay,
        jobId: savedBatch.id,
      },
    );

    this.logger.log(`Created batch payment job ${savedBatch.id} with ${payments.length} operations`);

    return this.getBatchStatus(savedBatch.id);
  }

  /**
   * Get batch status with operations
   */
  async getBatchStatus(batchId: string): Promise<BatchStatusDto> {
    const batch = await this.batchJobRepository.findOne({
      where: { id: batchId },
      relations: ["operations"],
    });

    if (!batch) {
      throw new HttpException("Batch not found", HttpStatus.NOT_FOUND);
    }

    return this.mapToStatusDto(batch);
  }

  /**
   * List batches with pagination
   */
  async listBatches(
    page: number = 1,
    limit: number = 50,
    status?: BatchJobStatus,
  ): Promise<BatchListDto> {
    const where: any = {};
    if (status) {
      where.status = status;
    }

    const [batches, total] = await this.batchJobRepository.findAndCount({
      where,
      order: { created_at: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      batches: batches.map((batch) => this.mapToStatusDto(batch)),
      total,
      page,
      limit,
    };
  }

  /**
   * Retry failed operations
   */
  async retryFailedOperations(
    batchId: string,
    operationIds?: string[],
  ): Promise<BatchStatusDto> {
    const batch = await this.batchJobRepository.findOne({
      where: { id: batchId },
    });

    if (!batch) {
      throw new HttpException("Batch not found", HttpStatus.NOT_FOUND);
    }

    // Get failed operations to retry
    const where: any = {
      batch_id: batchId,
      status: BatchOperationStatus.FAILED,
    };

    if (operationIds && operationIds.length > 0) {
      where.id = In(operationIds);
    }

    const failedOperations = await this.batchOperationRepository.find({
      where,
    });

    if (failedOperations.length === 0) {
      throw new HttpException("No failed operations to retry", HttpStatus.BAD_REQUEST);
    }

    // Reset operations to pending
    for (const operation of failedOperations) {
      operation.status = BatchOperationStatus.PENDING;
      operation.error_message = undefined;
      operation.error_code = undefined;
      await this.batchOperationRepository.save(operation);
    }

    // Update batch status
    batch.status = BatchJobStatus.PENDING;
    batch.error_message = undefined;
    await this.batchJobRepository.save(batch);

    // Re-queue the job
    const queue = batch.type === BatchJobType.SPLIT_CREATION ? this.splitQueue : this.paymentQueue;
    const chunkSize = batch.options?.chunkSize || this.defaultChunkSize;
    const concurrency = batch.options?.concurrency || this.defaultConcurrency;

    await queue.add(
      "process",
      {
        batchId: batch.id,
        chunkSize,
        concurrency,
      } as BatchJobData,
      {
        jobId: batch.id,
      },
    );

    this.logger.log(`Retrying ${failedOperations.length} failed operations for batch ${batchId}`);

    return this.getBatchStatus(batchId);
  }

  /**
   * Cancel a batch job
   */
  async cancelBatch(batchId: string): Promise<BatchStatusDto> {
    const batch = await this.batchJobRepository.findOne({
      where: { id: batchId },
    });

    if (!batch) {
      throw new HttpException("Batch not found", HttpStatus.NOT_FOUND);
    }

    if (batch.status === BatchJobStatus.COMPLETED || batch.status === BatchJobStatus.FAILED) {
      throw new HttpException("Cannot cancel a completed or failed batch", HttpStatus.BAD_REQUEST);
    }

    // Remove job from queue if still pending
    const queue = batch.type === BatchJobType.SPLIT_CREATION ? this.splitQueue : this.paymentQueue;
    const job = await queue.getJob(batchId);
    if (job) {
      await job.remove();
    }

    // Cancel pending operations
    await this.batchOperationRepository.update(
      {
        batch_id: batchId,
        status: In([BatchOperationStatus.PENDING, BatchOperationStatus.PROCESSING]),
      },
      {
        status: BatchOperationStatus.CANCELLED,
        completed_at: new Date(),
      },
    );

    // Update batch status
    batch.status = BatchJobStatus.CANCELLED;
    batch.completed_at = new Date();
    await this.batchJobRepository.save(batch);

    this.logger.log(`Cancelled batch ${batchId}`);

    return this.getBatchStatus(batchId);
  }

  /**
   * Get operations for a batch
   */
  async getBatchOperations(
    batchId: string,
    status?: BatchOperationStatus,
  ): Promise<BatchOperation[]> {
    const where: any = { batch_id: batchId };
    if (status) {
      where.status = status;
    }

    return this.batchOperationRepository.find({
      where,
      order: { operation_index: "ASC" },
    });
  }

  /**
   * Map BatchJob entity to BatchStatusDto
   */
  private mapToStatusDto(batch: BatchJob): BatchStatusDto {
    const dto: BatchStatusDto = {
      id: batch.id,
      type: batch.type,
      status: batch.status,
      totalOperations: batch.total_operations,
      completedOperations: batch.completed_operations,
      failedOperations: batch.failed_operations,
      progress: batch.progress,
      options: batch.options,
      errorMessage: batch.error_message,
      startedAt: batch.started_at,
      completedAt: batch.completed_at,
      createdAt: batch.created_at,
      updatedAt: batch.updated_at,
      estimatedTimeRemaining: this.batchProgressService.calculateETA(batch),
      processingRate: this.batchProgressService.calculateProcessingRate(batch),
    };

    if (batch.operations) {
      dto.operations = batch.operations.map((op) => ({
        id: op.id,
        operationIndex: op.operation_index,
        status: op.status,
        errorMessage: op.error_message,
        errorCode: op.error_code,
        retryCount: op.retry_count,
        startedAt: op.started_at,
        completedAt: op.completed_at,
      }));
    }

    return dto;
  }
}
