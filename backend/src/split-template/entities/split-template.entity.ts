import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from "typeorm";

export enum SplitType {
  EQUAL = "equal",
  ITEMIZED = "itemized",
  PERCENTAGE = "percentage",
  CUSTOM = "custom",
}

@Entity("split_templates")
export class SplitTemplate {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  userId!: string; // wallet address

  @Column()
  name!: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ type: "enum", enum: SplitType })
  splitType!: SplitType;

  @Column({ type: "jsonb" })
  defaultParticipants!: any[];

  @Column({ type: "jsonb", nullable: true })
  defaultItems?: any[];

  @Column({ type: "decimal", default: 0 })
  taxPercentage!: number;

  @Column({ type: "decimal", default: 0 })
  tipPercentage!: number;

  @Column({ default: 0 })
  usageCount!: number;

  @CreateDateColumn()
  createdAt!: Date;
}
