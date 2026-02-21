import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";

import { BatchService } from "./batch.service";
import { BatchJobStatus } from "./entities/batch-job.entity";
import {
  CreateBatchSplitsDto,
  CreateBatchPaymentsDto,
  RetryBatchDto,
} from "./dto/create-batch.dto";

@Controller("batch")
export class BatchController {
  constructor(private readonly batchService: BatchService) {}

  /**
   * Create a batch of splits
   */
  @Post("splits")
  @HttpCode(HttpStatus.CREATED)
  async createBatchSplits(@Body() dto: CreateBatchSplitsDto) {
    return this.batchService.createBatchSplits(dto);
  }

  /**
   * Create a batch of payments
   */
  @Post("payments")
  @HttpCode(HttpStatus.CREATED)
  async createBatchPayments(@Body() dto: CreateBatchPaymentsDto) {
    return this.batchService.createBatchPayments(dto);
  }

  /**
   * Get batch status by ID
   */
  @Get(":batchId/status")
  async getBatchStatus(@Param("batchId") batchId: string) {
    return this.batchService.getBatchStatus(batchId);
  }

  /**
   * List all batches with pagination
   */
  @Get()
  async listBatches(
    @Query("page") page: number = 1,
    @Query("limit") limit: number = 50,
    @Query("status") status?: BatchJobStatus,
  ) {
    return this.batchService.listBatches(page, limit, status);
  }

  /**
   * Retry failed operations in a batch
   */
  @Post(":batchId/retry")
  @HttpCode(HttpStatus.OK)
  async retryBatch(
    @Param("batchId") batchId: string,
    @Body() dto: RetryBatchDto,
  ) {
    return this.batchService.retryFailedOperations(batchId, dto.operationIds);
  }

  /**
   * Cancel a pending or processing batch
   */
  @Delete(":batchId/cancel")
  @HttpCode(HttpStatus.OK)
  async cancelBatch(@Param("batchId") batchId: string) {
    return this.batchService.cancelBatch(batchId);
  }

  /**
   * Get operations for a batch
   */
  @Get(":batchId/operations")
  async getBatchOperations(
    @Param("batchId") batchId: string,
    @Query("status") status?: string,
  ) {
    return this.batchService.getBatchOperations(
      batchId,
      status as any,
    );
  }
}
