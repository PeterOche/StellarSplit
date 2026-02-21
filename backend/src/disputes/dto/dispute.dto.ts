import { IsString, IsEnum, IsUUID, IsNotEmpty, IsOptional, MaxLength, MinLength, IsArray } from 'class-validator';
import { DisputeType, DisputeStatus } from '../../entities/dispute.entity';

export class FileDisputeDto {
  @IsUUID()
  @IsNotEmpty()
  splitId!: string;

  @IsEnum(DisputeType)
  @IsNotEmpty()
  disputeType!: DisputeType;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(5000)
  description!: string;
}

export class AddEvidenceDto {
  @IsUUID()
  @IsNotEmpty()
  disputeId!: string;

  @IsString()
  @IsNotEmpty()
  fileKey!: string; // Reference to uploaded file in object storage

  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @IsString()
  @IsNotEmpty()
  mimeType!: string;

  @IsNotEmpty()
  size!: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}

export class SubmitForReviewDto {
  @IsUUID()
  @IsNotEmpty()
  disputeId!: string;
}

export class ResolveDisputeDto {
  @IsUUID()
  @IsNotEmpty()
  disputeId!: string;

  @IsEnum(['adjust_balances', 'refund', 'cancel_split', 'no_change'])
  @IsNotEmpty()
  outcome!: 'adjust_balances' | 'refund' | 'cancel_split' | 'no_change';

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(5000)
  resolution!: string;

  @IsOptional()
  details?: Record<string, any>; // Outcome-specific details
}

export class AppealDisputeDto {
  @IsUUID()
  @IsNotEmpty()
  disputeId!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(5000)
  appealReason!: string;
}

export class QueryDisputesDto {
  @IsOptional()
  @IsUUID()
  splitId?: string;

  @IsOptional()
  @IsEnum(DisputeStatus)
  status?: DisputeStatus;

  @IsOptional()
  @IsString()
  raisedBy?: string;

  @IsOptional()
  page?: number = 1;

  @IsOptional()
  limit?: number = 20;

  @IsOptional()
  sortBy?: 'createdAt' | 'updatedAt' | 'status' = 'createdAt';

  @IsOptional()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

export class RequestMoreEvidenceDto {
  @IsUUID()
  @IsNotEmpty()
  disputeId!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(2000)
  evidenceRequest!: string;
}
