import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Split } from './split.entity';

export enum DisputeType {
  INCORRECT_AMOUNT = 'incorrect_amount',
  MISSING_PAYMENT = 'missing_payment',
  WRONG_ITEMS = 'wrong_items',
  OTHER = 'other',
}

export enum DisputeStatus {
  OPEN = 'open',
  EVIDENCE_COLLECTION = 'evidence_collection',
  UNDER_REVIEW = 'under_review',
  RESOLVED = 'resolved',
  REJECTED = 'rejected',
  APPEALED = 'appealed',
}

@Entity('disputes')
@Index(['splitId'])
@Index(['status'])
@Index(['raisedBy'])
@Index(['splitId', 'status'])
@Index(['createdAt'])
export class Dispute {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  splitId!: string;

  @ManyToOne(() => Split, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'splitId' })
  split!: Split;

  @Column({
    type: 'varchar',
    length: 56,
  })
  raisedBy!: string; // Wallet address of dispute creator

  @Column({
    type: 'enum',
    enum: DisputeType,
  })
  disputeType!: DisputeType;

  @Column({
    type: 'text',
  })
  description!: string;

  @Column({
    type: 'enum',
    enum: DisputeStatus,
    default: DisputeStatus.OPEN,
  })
  status!: DisputeStatus;

  // Evidence metadata stored as JSONB
  @Column({
    type: 'jsonb',
    nullable: true,
    default: () => "'[]'::jsonb",
  })
  evidence!: Array<{
    id: string;
    uploadedBy: string;
    uploadedAt: Date;
    fileKey: string; // Object storage reference
    fileName: string;
    mimeType: string;
    size: number;
  }>;

  @Column({
    type: 'text',
    nullable: true,
  })
  resolution: string | null = null;

  @Column({
    type: 'varchar',
    length: 56,
    nullable: true,
  })
  resolvedBy: string | null = null; // Wallet address or admin ID

  @Column({
    type: 'timestamp',
    nullable: true,
  })
  resolvedAt: Date | null = null;

  // Financial outcome details
  @Column({
    type: 'jsonb',
    nullable: true,
  })
  resolutionOutcome: {
    outcome: 'adjust_balances' | 'refund' | 'cancel_split' | 'no_change';
    details: Record<string, any>;
    executedAt?: Date;
    transactionHash?: string;
  } | null = null;

  // Appeal information
  @Column({
    type: 'uuid',
    nullable: true,
  })
  originalDisputeId: string | null = null; // Reference to the original dispute if this is an appeal

  @Column({
    type: 'text',
    nullable: true,
  })
  appealReason: string | null = null;

  @Column({
    type: 'timestamp',
    nullable: true,
  })
  appealedAt: Date | null = null;

  // Audit trail
  @Column({
    type: 'jsonb',
    nullable: true,
    default: () => "'[]'::jsonb",
  })
  auditTrail!: Array<{
    action: string;
    performedBy: string;
    performedAt: Date;
    details: Record<string, any>;
  }>;

  // Split was frozen when dispute created
  @Column({
    type: 'boolean',
    default: true,
  })
  splitFrozen!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt: Date | null = null;

  @OneToMany(() => Dispute, (dispute) => dispute)
  appeals!: Dispute[];}