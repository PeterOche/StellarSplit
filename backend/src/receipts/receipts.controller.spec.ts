import { Test, TestingModule } from '@nestjs/testing';
import { ReceiptsController } from './receipts.controller';
import { OcrService } from '../ocr/ocr.service';
import { BadRequestException } from '@nestjs/common';

describe('ReceiptsController', () => {
  let controller: ReceiptsController;
  let ocrService: OcrService;

  const mockOcrService = {
    scanReceipt: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReceiptsController],
      providers: [
        {
          provide: OcrService,
          useValue: mockOcrService,
        },
      ],
    }).compile();

    controller = module.get<ReceiptsController>(ReceiptsController);
    ocrService = module.get<OcrService>(OcrService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('scanReceipt', () => {
    it('should process valid image file', async () => {
      const mockFile = {
        originalname: 'receipt.jpg',
        mimetype: 'image/jpeg',
        size: 1024 * 1024, // 1MB
        buffer: Buffer.from('fake-image-data'),
      } as Express.Multer.File;

      const mockResult = {
        items: [{ name: 'Item 1', quantity: 1, price: 10.0 }],
        subtotal: 10.0,
        tax: 0.8,
        tip: 0,
        total: 10.8,
        confidence: 0.85,
      };

      mockOcrService.scanReceipt.mockResolvedValue(mockResult);

      const result = await controller.scanReceipt(mockFile);

      expect(result).toEqual(mockResult);
      expect(ocrService.scanReceipt).toHaveBeenCalledWith(mockFile.buffer);
    });

    it('should throw error if no file provided', async () => {
      await expect(controller.scanReceipt(null)).rejects.toThrow(BadRequestException);
    });

    it('should throw error for invalid file type', async () => {
      const mockFile = {
        originalname: 'receipt.pdf',
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('fake-data'),
      } as Express.Multer.File;

      await expect(controller.scanReceipt(mockFile)).rejects.toThrow(BadRequestException);
    });

    it('should throw error for file too large', async () => {
      const mockFile = {
        originalname: 'receipt.jpg',
        mimetype: 'image/jpeg',
        size: 11 * 1024 * 1024, // 11MB
        buffer: Buffer.from('fake-image-data'),
      } as Express.Multer.File;

      await expect(controller.scanReceipt(mockFile)).rejects.toThrow(BadRequestException);
    });

    it('should handle OCR service errors', async () => {
      const mockFile = {
        originalname: 'receipt.jpg',
        mimetype: 'image/jpeg',
        size: 1024,
        buffer: Buffer.from('fake-image-data'),
      } as Express.Multer.File;

      mockOcrService.scanReceipt.mockRejectedValue(new Error('OCR failed'));

      await expect(controller.scanReceipt(mockFile)).rejects.toThrow(BadRequestException);
    });

    it('should accept PNG files', async () => {
      const mockFile = {
        originalname: 'receipt.png',
        mimetype: 'image/png',
        size: 1024,
        buffer: Buffer.from('fake-image-data'),
      } as Express.Multer.File;

      const mockResult = {
        items: [],
        subtotal: 0,
        tax: 0,
        tip: 0,
        total: 0,
        confidence: 0.5,
      };

      mockOcrService.scanReceipt.mockResolvedValue(mockResult);

      const result = await controller.scanReceipt(mockFile);
      expect(result).toBeDefined();
    });
  });
});
