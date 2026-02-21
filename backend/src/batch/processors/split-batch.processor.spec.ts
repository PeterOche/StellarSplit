import { Test, TestingModule } from "@nestjs/testing";
import { Job } from "bull";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { SplitBatchProcessor } from "./split-batch.processor";
import { BatchProgressService } from "../batch-progress.service";
import { BatchOperation, BatchOperationStatus } from "../entities/batch-operation.entity";
import { BatchJob } from "../entities/batch-job.entity";

const mockRepository = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  save: jest.fn(),
});

const mockBatchProgressService = () => ({
  markOperationStarted: jest.fn(),
  markOperationCompleted: jest.fn(),
  markOperationFailed: jest.fn(),
});

describe("SplitBatchProcessor", () => {
  let processor: SplitBatchProcessor;
  let batchJobRepository: Repository<BatchJob>;
  let batchOperationRepository: Repository<BatchOperation>;
  let batchProgressService: BatchProgressService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SplitBatchProcessor,
        {
          provide: getRepositoryToken(BatchJob),
          useFactory: mockRepository,
        },
        {
          provide: getRepositoryToken(BatchOperation),
          useFactory: mockRepository,
        },
        {
          provide: BatchProgressService,
          useFactory: mockBatchProgressService,
        },
      ],
    }).compile();

    processor = module.get<SplitBatchProcessor>(SplitBatchProcessor);
    batchJobRepository = module.get<Repository<BatchJob>>(getRepositoryToken(BatchJob));
    batchOperationRepository = module.get<Repository<BatchOperation>>(getRepositoryToken(BatchOperation));
    batchProgressService = module.get<BatchProgressService>(BatchProgressService);
  });

  it("should be defined", () => {
    expect(processor).toBeDefined();
  });

  describe("handleSplitBatch", () => {
    it("should process split batch successfully", async () => {
      const mockJob = {
        id: "job-1",
        data: {
          batchId: "batch-1",
          chunkSize: 2,
          concurrency: 1,
        },
        progress: jest.fn(),
      } as unknown as Job;

      const mockOperations = [
        {
          id: "op-1",
          payload: {
            totalAmount: 100,
            participants: [{ userId: "user1", amount: 50 }],
          },
        },
        {
          id: "op-2",
          payload: {
            totalAmount: 200,
            participants: [{ userId: "user2", amount: 100 }],
          },
        },
      ];

      (batchOperationRepository.find as jest.Mock).mockResolvedValue(mockOperations);
      (batchProgressService.markOperationStarted as jest.Mock).mockResolvedValue(undefined);
      (batchProgressService.markOperationCompleted as jest.Mock).mockResolvedValue(undefined);

      await processor.handleSplitBatch(mockJob);

      expect(batchOperationRepository.find).toHaveBeenCalledWith({
        where: { batch_id: "batch-1" },
        order: { operation_index: "ASC" },
      });
      expect(mockJob.progress).toHaveBeenCalled();
    });

    it("should handle empty operations", async () => {
      const mockJob = {
        id: "job-1",
        data: {
          batchId: "batch-1",
          chunkSize: 10,
          concurrency: 5,
        },
        progress: jest.fn(),
      } as unknown as Job;

      (batchOperationRepository.find as jest.Mock).mockResolvedValue([]);

      await processor.handleSplitBatch(mockJob);

      expect(batchOperationRepository.find).toHaveBeenCalled();
    });
  });

  describe("processSingleSplit", () => {
    it("should process single split successfully", async () => {
      const operation = {
        id: "op-1",
        payload: {
          totalAmount: 100,
          participants: [{ userId: "user1", amount: 50 }],
          description: "Test split",
        },
      };

      (batchProgressService.markOperationStarted as jest.Mock).mockResolvedValue(undefined);
      (batchProgressService.markOperationCompleted as jest.Mock).mockResolvedValue(undefined);

      // We need to access the private method through any cast for testing
      await (processor as any).processSingleSplit(operation);

      expect(batchProgressService.markOperationStarted).toHaveBeenCalledWith("op-1");
      expect(batchProgressService.markOperationCompleted).toHaveBeenCalledWith("op-1", expect.any(Object));
    });

    it("should handle processing errors", async () => {
      const operation = {
        id: "op-1",
        payload: {
          totalAmount: 100,
          participants: [], // Invalid - no participants
        },
      };

      (batchProgressService.markOperationStarted as jest.Mock).mockResolvedValue(undefined);
      (batchProgressService.markOperationFailed as jest.Mock).mockResolvedValue(undefined);

      await (processor as any).processSingleSplit(operation);

      expect(batchProgressService.markOperationFailed).toHaveBeenCalledWith(
        "op-1",
        expect.any(String),
        "VALIDATION_ERROR",
      );
    });
  });
});
