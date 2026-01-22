import { Module } from '@nestjs/common';
import { OcrService } from './ocr.service';
import { ReceiptParser } from './parsers/receipt-parser';

@Module({
  providers: [OcrService, ReceiptParser],
  exports: [OcrService],
})
export class OcrModule {}
