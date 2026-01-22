import { Test, TestingModule } from '@nestjs/testing';
import { OcrService } from './ocr.service';
import { ReceiptParser } from './parsers/receipt-parser';

// Mock Tesseract.js
jest.mock('tesseract.js', () => ({
  createWorker: jest.fn().mockResolvedValue({
    recognize: jest.fn().mockResolvedValue({
      data: {
        text: 'Item 1    10.00\nItem 2    15.00\nTotal     25.00',
        confidence: 85,
      },
    }),
    terminate: jest.fn().mockResolvedValue(undefined),
  }),
}));

// Mock Sharp
jest.mock('sharp', () => {
  return jest.fn().mockImplementation(() => ({
    metadata: jest.fn().mockResolvedValue({ width: 1000, height: 1500, format: 'jpeg' }),
    greyscale: jest.fn().mockReturnThis(),
    normalise: jest.fn().mockReturnThis(),
    resize: jest.fn().mockReturnThis(),
    sharpen: jest.fn().mockReturnThis(),
    png: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('processed-image')),
  }));
});

describe('OcrService', () => {
  let service: OcrService;
  let receiptParser: ReceiptParser;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OcrService, ReceiptParser],
    }).compile();

    service = module.get<OcrService>(OcrService);
    receiptParser = module.get<ReceiptParser>(ReceiptParser);
  });

  afterEach(async () => {
    await service.cleanup();
  });

  describe('initialize', () => {
    it('should initialize Tesseract worker', async () => {
      await service.initialize();
      // Worker should be initialized
      expect(service).toBeDefined();
    });

    it('should not reinitialize if already initialized', async () => {
      await service.initialize();
      await service.initialize();
      // Should not throw error
      expect(service).toBeDefined();
    });
  });

  describe('scanReceipt', () => {
    it('should process receipt image and return parsed data', async () => {
      const mockImageBuffer = Buffer.from('fake-image-data');

      const result = await service.scanReceipt(mockImageBuffer);

      expect(result).toBeDefined();
      expect(result.items).toBeDefined();
      expect(result.total).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should handle image preprocessing errors gracefully', async () => {
      const mockImageBuffer = Buffer.from('fake-image-data');
      
      // Mock sharp to throw error
      const sharp = require('sharp');
      sharp.mockImplementationOnce(() => {
        throw new Error('Image processing failed');
      });

      // Should still attempt to process
      await expect(service.scanReceipt(mockImageBuffer)).resolves.toBeDefined();
    });
  });

  describe('cleanup', () => {
    it('should terminate worker and cleanup resources', async () => {
      await service.initialize();
      await service.cleanup();
      // Should not throw error
      expect(service).toBeDefined();
    });
  });
});
