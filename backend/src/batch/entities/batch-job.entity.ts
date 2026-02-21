import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from "typeorm";
import { BatchOperation } from "./batch-operation.entity";

export enum BatchJobType {
  SPLIT_CREATION = "split_creation",
  PAYMENT_PROCESSING = "payment_processing",
  SCHEDULED_TASK = "scheduled_task",
}

export enum BatchJobStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
  PARTIAL = "partial",
}

@Entity("batch_jobs")
@Index(["status"])
@Index(["type"])
@Index(["created_at"])
export class BatchJob {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({
    type: "enum",
    enum: BatchJobType,
  })
  type!: BatchJobType;

  @Column({
    type: "enum",
    enum: BatchJobStatus,
    default: BatchJobStatus.PENDING,
  })
  status!: BatchJobStatus;

  @Column({ type: "int", default: 0 })
  total_operations!: number;

  @Column({ type: "int", default: 0 })
  completed_operations!: number;

  @Column({ type: "int", default: 0 })
  failed_operations!: number;

  @Column({ type: "decimal", precision: 5, scale: 2, default: 0 })
  progress!: number;

  @Column({ type: "jsonb", default: {} })
  options!: Record<string, any>;

  @Column({ type: "text", nullable: true })
  error_message?: string;

  @Column({ type: "timestamp", nullable: true })
  started_at?: Date;

  @Column({ type: "timestamp", nullable: true })
  completed_at?: Date;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @OneToMany(() => BatchOperation, (operation) => operation.batch)
  operations?: BatchOperation[];
}
