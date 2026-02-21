import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey, TableIndex } from 'typeorm';

export class CreateDisputeSystem1769098000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add isFrozen column to splits table
    await queryRunner.addColumn(
      'splits',
      new TableColumn({
        name: 'isFrozen',
        type: 'boolean',
        default: false,
        isNullable: false,
      }),
    );

    // Create disputes table
    await queryRunner.createTable(
      new Table({
        name: 'disputes',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'splitId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'raisedBy',
            type: 'varchar',
            length: '56',
            isNullable: false,
          },
          {
            name: 'disputeType',
            type: 'enum',
            enum: ['incorrect_amount', 'missing_payment', 'wrong_items', 'other'],
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['open', 'evidence_collection', 'under_review', 'resolved', 'rejected', 'appealed'],
            default: "'open'",
            isNullable: false,
          },
          {
            name: 'evidence',
            type: 'jsonb',
            isNullable: true,
            default: "'[]'::jsonb",
          },
          {
            name: 'resolution',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'resolvedBy',
            type: 'varchar',
            length: '56',
            isNullable: true,
          },
          {
            name: 'resolvedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'resolutionOutcome',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'originalDisputeId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'appealReason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'appealedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'auditTrail',
            type: 'jsonb',
            isNullable: true,
            default: "'[]'::jsonb",
          },
          {
            name: 'splitFrozen',
            type: 'boolean',
            default: true,
            isNullable: false,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'deletedAt',
            type: 'timestamp',
            isNullable: true,
          },
        ],
        foreignKeys: [
          new TableForeignKey({
            columnNames: ['splitId'],
            referencedColumnNames: ['id'],
            referencedTableName: 'splits',
            onDelete: 'CASCADE',
          }),
        ],
        indices: [
          new TableIndex({ columnNames: ['splitId'] }),
          new TableIndex({ columnNames: ['status'] }),
          new TableIndex({ columnNames: ['raisedBy'] }),
          new TableIndex({ columnNames: ['splitId', 'status'] }),
          new TableIndex({ columnNames: ['createdAt'] }),
        ],
      }),
      true,
    );

    // Create dispute_evidence table
    await queryRunner.createTable(
      new Table({
        name: 'dispute_evidence',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'disputeId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'uploadedBy',
            type: 'varchar',
            length: '56',
            isNullable: false,
          },
          {
            name: 'fileKey',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'fileName',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'mimeType',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'size',
            type: 'bigint',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
        foreignKeys: [
          new TableForeignKey({
            columnNames: ['disputeId'],
            referencedColumnNames: ['id'],
            referencedTableName: 'disputes',
            onDelete: 'CASCADE',
          }),
        ],
        indices: [
          new TableIndex({ columnNames: ['disputeId'] }),
          new TableIndex({ columnNames: ['uploadedBy'] }),
          new TableIndex({ columnNames: ['createdAt'] }),
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order
    await queryRunner.dropTable('dispute_evidence');
    await queryRunner.dropTable('disputes');

    // Remove isFrozen column from splits
    await queryRunner.dropColumn('splits', 'isFrozen');
  }
}
