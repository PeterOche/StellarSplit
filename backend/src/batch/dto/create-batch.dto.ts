import {
  IsArray,
  IsString,
  IsNumber,
  IsOptional,
  IsObject,
  ValidateNested,
  Min,
  Max,
} from "class-validator";
import { Type } from "class-transformer";

export class BatchSplitItemDto {
  @IsNumber()
  @Min(0.01)
  totalAmount!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchParticipantDto)
  participants!: BatchParticipantDto[];

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  preferredCurrency?: string;

  @IsOptional()
  @IsString()
  creatorWalletAddress?: string;
}

export class BatchParticipantDto {
  @IsString()
  userId!: string;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsString()
  walletAddress?: string;
}

export class BatchPaymentItemDto {
  @IsString()
  splitId!: string;

  @IsString()
  participantId!: string;

  @IsString()
  stellarTxHash!: string;
}

export class BatchOptionsDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  chunkSize?: number;

  @IsOptional()
  @IsNumber()
  priority?: number;

  @IsOptional()
  @IsNumber()
  delay?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  concurrency?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  retryAttempts?: number;
}

export class CreateBatchSplitsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchSplitItemDto)
  splits!: BatchSplitItemDto[];

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => BatchOptionsDto)
  options?: BatchOptionsDto;
}

export class CreateBatchPaymentsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchPaymentItemDto)
  payments!: BatchPaymentItemDto[];

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => BatchOptionsDto)
  options?: BatchOptionsDto;
}

export class RetryBatchDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  operationIds?: string[];
}
