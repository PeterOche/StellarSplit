import { Module } from '@nestjs/common';
import { ReceiptsController } from './receipts.controller';
import { OcrModule } from '../ocr/ocr.module';

@Module({
  imports: [OcrModule],
  controllers: [ReceiptsController],
})
export class ReceiptsModule {}
