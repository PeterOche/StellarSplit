import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiResponse } from '@nestjs/swagger';
import { OcrService } from '../ocr/ocr.service';
import { ScanReceiptResponseDto } from './dto/scan-receipt-response.dto';
import { Express } from 'express';

@ApiTags('Receipts')
@Controller('receipts')
export class ReceiptsController {
  private readonly logger = new Logger(ReceiptsController.name);

  constructor(private readonly ocrService: OcrService) {}

  @Post('scan')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({
    summary: 'Scan receipt image with OCR',
    description: 'Upload a receipt image to extract items, prices, and totals using OCR',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
          description: 'Receipt image file (JPEG, PNG, etc.)',
        },
      },
      required: ['image'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Receipt successfully scanned and parsed',
    type: ScanReceiptResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid image file or OCR processing failed',
  })
  async scanReceipt(@UploadedFile() file: Express.Multer.File): Promise<ScanReceiptResponseDto> {
    if (!file) {
      throw new BadRequestException('No image file provided');
    }

    // Validate file type
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`,
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds maximum limit of 10MB');
    }

    this.logger.log(`Processing receipt image: ${file.originalname} (${file.size} bytes)`);

    try {
      const result = await this.ocrService.scanReceipt(file.buffer);

      // If confidence is too low or no items found, suggest manual entry
      if (result.confidence < 0.3 || result.items.length === 0) {
        this.logger.warn(
          `Low confidence scan (${result.confidence.toFixed(2)}). Consider manual entry.`,
        );
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to scan receipt', error);
      throw new BadRequestException(
        `Failed to process receipt image: ${error.message}. Please try manual entry.`,
      );
    }
  }
}
