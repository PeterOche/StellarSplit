import { BatchJobStatus, BatchJobType } from "../entities/batch-job.entity";
import { BatchOperationStatus } from "../entities/batch-operation.entity";

export class BatchOperationStatusDto {
  id!: string;
  operationIndex!: number;
  status!: BatchOperationStatus;
  errorMessage?: string;
  errorCode?: string;
  retryCount!: number;
  startedAt?: Date;
  completedAt?: Date;
}

export class BatchStatusDto {
  id!: string;
  type!: BatchJobType;
  status!: BatchJobStatus;
  totalOperations!: number;
  completedOperations!: number;
  failedOperations!: number;
  progress!: number;
  options!: Record<string, any>;
  errorMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt!: Date;
  updatedAt!: Date;
  operations?: BatchOperationStatusDto[];
  estimatedTimeRemaining?: number;
  processingRate?: number;
}

export class BatchListDto {
  batches!: BatchStatusDto[];
  total!: number;
  page!: number;
  limit!: number;
}

export class BatchProgressEventDto {
  batchId!: string;
  progress!: number;
  completedOperations!: number;
  failedOperations!: number;
  status!: BatchJobStatus;
  message?: string;
}

export class BatchOperationResultDto {
  operationId!: string;
  status!: BatchOperationStatus;
  result?: Record<string, any>;
  errorMessage?: string;
}
