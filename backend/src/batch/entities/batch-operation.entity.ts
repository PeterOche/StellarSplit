import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";
import { BatchJob } from "./batch-job.entity";

export enum BatchOperationStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed",
  RETRYING = "retrying",
  CANCELLED = "cancelled",
}

@Entity("batch_operations")
@Index(["batch_id"])
@Index(["status"])
@Index(["operation_index"])
export class BatchOperation {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  batch_id!: string;

  @Column({ type: "int" })
  operation_index!: number;

  @Column({
    type: "enum",
    enum: BatchOperationStatus,
    default: BatchOperationStatus.PENDING,
  })
  status!: BatchOperationStatus;

  @Column({ type: "jsonb" })
  payload!: Record<string, any>;

  @Column({ type: "jsonb", nullable: true })
  result?: Record<string, any>;

  @Column({ type: "text", nullable: true })
  error_message?: string;

  @Column({ type: "varchar", length: 50, nullable: true })
  error_code?: string;

  @Column({ type: "int", default: 0 })
  retry_count!: number;

  @Column({ type: "timestamp", nullable: true })
  started_at?: Date;

  @Column({ type: "timestamp", nullable: true })
  completed_at?: Date;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @ManyToOne(() => BatchJob, (batch) => batch.operations, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "batch_id" })
  batch?: BatchJob;
}
