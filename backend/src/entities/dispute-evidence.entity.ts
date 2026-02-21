import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Dispute } from './dispute.entity';

@Entity('dispute_evidence')
@Index(['disputeId'])
@Index(['uploadedBy'])
@Index(['createdAt'])
export class DisputeEvidence {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  disputeId!: string;

  @ManyToOne(() => Dispute, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'disputeId' })
  dispute!: Dispute;

  @Column({
    type: 'varchar',
    length: 56,
  })
  uploadedBy!: string; // Wallet address of uploader

  @Column({
    type: 'varchar',
  })
  fileKey!: string; // Object storage reference (S3, Azure Blob, etc.)

  @Column({
    type: 'varchar',
  })
  fileName!: string;

  @Column({
    type: 'varchar',
    length: 50,
  })
  mimeType!: string; // e.g., 'image/jpeg', 'application/pdf'

  @Column({
    type: 'bigint',
  })
  size!: number; // File size in bytes

  @Column({
    type: 'text',
    nullable: true,
  })
  description: string | null = null; // Optional description from uploader

  @Column({
    type: 'jsonb',
    nullable: true,
  })
  metadata: {
    originalName?: string;
    uploadedFrom?: string; // Device/app info
    ipAddress?: string;
    checksum?: string; // For integrity verification
    [key: string]: any;
  } | null = null;

  @CreateDateColumn()
  createdAt!: Date;
}
