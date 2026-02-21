import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { getQueueToken } from "@nestjs/bull";
import { Queue } from "bull";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { ConfigService } from "@nestjs/config";

import { BatchService } from "./batch.service";
import { BatchProgressService } from "./batch-progress.service";
import { BatchJob, BatchJobStatus, BatchJobType } from "./entities/batch-job.entity";
import { BatchOperation, BatchOperationStatus } from "./entities/batch-operation.entity";
import { CreateBatchSplitsDto, CreateBatchPaymentsDto } from "./dto/create-batch.dto";

const mockRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  find: jest.fn(),
  findAndCount: jest.fn(),
});

const mockQueue = () => ({
  add: jest.fn(),
  getJob: jest.fn(),
});

const mockConfigService = () => ({
  get: jest.fn().mockReturnValue(100),
});

describe("BatchService", () => {
  let service: BatchService;
  let batchJobRepository: Repository<BatchJob>;
  let batchOperationRepository: Repository<BatchOperation>;
  let splitQueue: Queue;
  let paymentQueue: Queue;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BatchService,
        BatchProgressService,
        {
          provide: getRepositoryToken(BatchJob),
          useFactory: mockRepository,
        },
        {
          provide: getRepositoryToken(BatchOperation),
          useFactory: mockRepository,
        },
        {
          provide: getQueueToken("batch_splits"),
          useFactory: mockQueue,
        },
        {
          provide: getQueueToken("batch_payments"),
          useFactory: mockQueue,
        },
        {
          provide: getQueueToken("batch_scheduled"),
          useFactory: mockQueue,
        },
        {
          provide: ConfigService,
          useFactory: mockConfigService,
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BatchService>(BatchService);
    batchJobRepository = module.get<Repository<BatchJob>>(getRepositoryToken(BatchJob));
    batchOperationRepository = module.get<Repository<BatchOperation>>(getRepositoryToken(BatchOperation));
    splitQueue = module.get<Queue>(getQueueToken("batch_splits"));
    paymentQueue = module.get<Queue>(getQueueToken("batch_payments"));
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("createBatchSplits", () => {
    it("should create batch splits and queue job", async () => {
      const dto: CreateBatchSplitsDto = {
        splits: [
          {
            totalAmount: 100,
            participants: [{ userId: "user1", amount: 50 }],
            description: "Test split",
          },
        ],
        options: { chunkSize: 10 },
      };

      const mockBatch = {
        id: "batch-1",
        type: BatchJobType.SPLIT_CREATION,
        status: BatchJobStatus.PENDING,
        total_operations: 1,
        completed_operations: 0,
        failed_operations: 0,
        progress: 0,
        options: {},
        created_at: new Date(),
        updated_at: new Date(),
        operations: [],
      };

      (batchJobRepository.create as jest.Mock).mockReturnValue(mockBatch);
      (batchJobRepository.save as jest.Mock).mockResolvedValue(mockBatch);
      (batchJobRepository.findOne as jest.Mock).mockResolvedValue(mockBatch);
      (batchOperationRepository.create as jest.Mock).mockReturnValue({});
      (batchOperationRepository.save as jest.Mock).mockResolvedValue([]);
      (splitQueue.add as jest.Mock).mockResolvedValue({});

      const result = await service.createBatchSplits(dto);

      expect(batchJobRepository.create).toHaveBeenCalled();
      expect(batchJobRepository.save).toHaveBeenCalled();
      expect(splitQueue.add).toHaveBeenCalledWith("process", expect.any(Object), expect.any(Object));
      expect(result).toBeDefined();
    });
  });

  describe("createBatchPayments", () => {
    it("should create batch payments and queue job", async () => {
      const dto: CreateBatchPaymentsDto = {
        payments: [
          {
            splitId: "split-1",
            participantId: "user1",
            stellarTxHash: "tx-hash-1",
          },
        ],
        options: { chunkSize: 10, concurrency: 5 },
      };

      const mockBatch = {
        id: "batch-1",
        type: BatchJobType.PAYMENT_PROCESSING,
        status: BatchJobStatus.PENDING,
        total_operations: 1,
        completed_operations: 0,
        failed_operations: 0,
        progress: 0,
        options: {},
        created_at: new Date(),
        updated_at: new Date(),
        operations: [],
      };

      (batchJobRepository.create as jest.Mock).mockReturnValue(mockBatch);
      (batchJobRepository.save as jest.Mock).mockResolvedValue(mockBatch);
      (batchJobRepository.findOne as jest.Mock).mockResolvedValue(mockBatch);
      (batchOperationRepository.create as jest.Mock).mockReturnValue({});
      (batchOperationRepository.save as jest.Mock).mockResolvedValue([]);
      (paymentQueue.add as jest.Mock).mockResolvedValue({});

      const result = await service.createBatchPayments(dto);

      expect(batchJobRepository.create).toHaveBeenCalled();
      expect(paymentQueue.add).toHaveBeenCalledWith("process", expect.any(Object), expect.any(Object));
      expect(result).toBeDefined();
    });
  });

  describe("getBatchStatus", () => {
    it("should return batch status with operations", async () => {
      const mockBatch = {
        id: "batch-1",
        status: BatchJobStatus.PROCESSING,
        type: BatchJobType.SPLIT_CREATION,
        total_operations: 10,
        completed_operations: 5,
        failed_operations: 1,
        progress: 50,
        operations: [],
      };

      (batchJobRepository.findOne as jest.Mock).mockResolvedValue(mockBatch);

      const result = await service.getBatchStatus("batch-1");

      expect(result).toBeDefined();
      expect(result.id).toBe("batch-1");
      expect(result.progress).toBe(50);
    });

    it("should throw error if batch not found", async () => {
      (batchJobRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.getBatchStatus("non-existent")).rejects.toThrow();
    });
  });

  describe("retryFailedOperations", () => {
    it("should retry failed operations", async () => {
      const mockBatch = {
        id: "batch-1",
        type: BatchJobType.SPLIT_CREATION,
        status: BatchJobStatus.FAILED,
      };

      const mockOperations = [
        { id: "op-1", status: BatchOperationStatus.FAILED },
      ];

      (batchJobRepository.findOne as jest.Mock).mockResolvedValue(mockBatch);
      (batchOperationRepository.find as jest.Mock).mockResolvedValue(mockOperations);
      (batchOperationRepository.update as jest.Mock).mockResolvedValue({});
      (splitQueue.add as jest.Mock).mockResolvedValue({});

      const result = await service.retryFailedOperations("batch-1", ["op-1"]);

      expect(result).toBeDefined();
      expect(splitQueue.add).toHaveBeenCalled();
    });
  });

  describe("cancelBatch", () => {
    it("should cancel a pending batch", async () => {
      const mockBatch = {
        id: "batch-1",
        status: BatchJobStatus.PENDING,
        type: BatchJobType.SPLIT_CREATION,
        total_operations: 10,
        completed_operations: 5,
        failed_operations: 0,
        progress: 50,
        options: {},
        created_at: new Date(),
        updated_at: new Date(),
        operations: [],
      };

      (batchJobRepository.findOne as jest.Mock).mockResolvedValue(mockBatch);
      (batchJobRepository.update as jest.Mock).mockResolvedValue({});

      const result = await service.cancelBatch("batch-1");

      expect(result.status).toBe(BatchJobStatus.CANCELLED);
    });

    it("should not cancel a completed batch", async () => {
      const mockBatch = {
        id: "batch-1",
        status: BatchJobStatus.COMPLETED,
      };

      (batchJobRepository.findOne as jest.Mock).mockResolvedValue(mockBatch);

      await expect(service.cancelBatch("batch-1")).rejects.toThrow();
    });

    it("should not cancel a failed batch", async () => {
      const mockBatch = {
        id: "batch-1",
        status: BatchJobStatus.FAILED,
      };

      (batchJobRepository.findOne as jest.Mock).mockResolvedValue(mockBatch);

      await expect(service.cancelBatch("batch-1")).rejects.toThrow();
    });
  });
});
