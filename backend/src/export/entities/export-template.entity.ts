import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '@/entities/user.entity';
import { ExportFormat, ReportType } from './export-job.entity';

@Entity('export_templates')
export class ExportTemplate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column()
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string;

  @Column({
    type: 'enum',
    enum: ExportFormat,
    default: ExportFormat.CSV,
  })
  format!: ExportFormat;

  @Column({
    type: 'enum',
    enum: ReportType,
    default: ReportType.CUSTOM,
  })
  reportType!: ReportType;

  @Column({ type: 'jsonb' })
  filters!: {
    startDate?: string;
    endDate?: string;
    categories?: string[];
    participants?: string[];
    minAmount?: number;
    maxAmount?: number;
    currency?: string;
    paidByMe?: boolean;
    owedToMe?: boolean;
    settled?: boolean;
  };

  @Column({ type: 'jsonb', nullable: true })
  settings!: {
    includeTaxFields: boolean;
    includeReceipts: boolean;
    groupByCategory: boolean;
    groupByMonth: boolean;
    includeChart: boolean;
    includeSummary: boolean;
    logoUrl?: string;
    companyName?: string;
    taxId?: string;
  };

  @Column({ name: 'is_default', default: false })
  isDefault!: boolean;

  @Column({ name: 'is_scheduled', default: false })
  isScheduled!: boolean;

  @Column({ name: 'schedule_cron', nullable: true })
  scheduleCron!: string;

  @Column({ name: 'email_recipients', type: 'jsonb', nullable: true })
  emailRecipients!: string[];

  @Column({ name: 'email_subject_template', nullable: true })
  emailSubjectTemplate!: string;

  @Column({ name: 'email_body_template', type: 'text', nullable: true })
  emailBodyTemplate!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}