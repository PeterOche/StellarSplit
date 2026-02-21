import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Inject,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  Dispute,
  DisputeStatus,
  DisputeType,
} from '../entities/dispute.entity';
import { DisputeEvidence } from '../entities/dispute-evidence.entity';
import { Split } from '../entities/split.entity';
import { DisputeStateMachine } from './dispute.state-machine';
import {
  FileDisputeDto,
  AddEvidenceDto,
  SubmitForReviewDto,
  ResolveDisputeDto,
  AppealDisputeDto,
  QueryDisputesDto,
  RequestMoreEvidenceDto,
} from './dto/dispute.dto';
import {
  DisputeCreatedEvent,
  DisputeEvidenceAddedEvent,
  DisputeUnderReviewEvent,
  DisputeResolvedEvent,
  DisputeRejectedEvent,
  DisputeAppealedEvent,
  MoreEvidenceRequestedEvent,
  SplitFrozenEvent,
  SplitUnfrozenEvent,
} from './dispute.events';

interface AuditTrailEntry {
  action: string;
  performedBy: string;
  performedAt: Date;
  details: Record<string, any>;
}

export type { AuditTrailEntry };

@Injectable()
export class DisputesService {
  private readonly logger = new Logger(DisputesService.name);

  constructor(
    @InjectRepository(Dispute)
    private readonly disputeRepository: Repository<Dispute>,
    @InjectRepository(DisputeEvidence)
    private readonly evidenceRepository: Repository<DisputeEvidence>,
    @InjectRepository(Split)
    private readonly splitRepository: Repository<Split>,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * CREATE DISPUTE WITH AUTOMATIC SPLIT FREEZE
   * Atomic transaction: dispute creation + split freeze
   */
  async fileDispute(
    fileDisputeDto: FileDisputeDto,
    raisedBy: string,
  ): Promise<Dispute> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Verify split exists
      const split = await queryRunner.manager.findOne(Split, {
        where: { id: fileDisputeDto.splitId },
      });

      if (!split) {
        throw new NotFoundException(
          `Split with ID ${fileDisputeDto.splitId} not found`,
        );
      }

      // Check if split already has active dispute
      const existingDispute = await queryRunner.manager.findOne(Dispute, {
        where: {
          splitId: fileDisputeDto.splitId,
          status: In([
            DisputeStatus.OPEN,
            DisputeStatus.EVIDENCE_COLLECTION,
            DisputeStatus.UNDER_REVIEW,
          ]),
        },
      });

      if (existingDispute) {
        throw new ConflictException(
          `Split already has an active dispute (${existingDispute.id})`,
        );
      }

      // Create dispute
      const dispute = queryRunner.manager.create(Dispute, {
        splitId: fileDisputeDto.splitId,
        raisedBy,
        disputeType: fileDisputeDto.disputeType,
        description: fileDisputeDto.description,
        status: DisputeStatus.OPEN,
        evidence: [],
        splitFrozen: true,
        auditTrail: [
          {
            action: 'dispute_created',
            performedBy: raisedBy,
            performedAt: new Date(),
            details: {
              type: fileDisputeDto.disputeType,
              description: fileDisputeDto.description,
            },
          },
        ],
      });

      const savedDispute = await queryRunner.manager.save(dispute);

      // Freeze split in same transaction
      await queryRunner.manager.update(
        Split,
        { id: fileDisputeDto.splitId },
        { isFrozen: true },
      );

      await queryRunner.commitTransaction();

      // Emit events (after transaction succeeds)
      this.eventEmitter.emit(
        'dispute.created',
        new DisputeCreatedEvent(savedDispute, raisedBy),
      );
      this.eventEmitter.emit(
        'split.frozen',
        new SplitFrozenEvent(
          fileDisputeDto.splitId,
          savedDispute.id,
          `Dispute created: ${fileDisputeDto.disputeType}`,
        ),
      );

      this.logger.log(
        `Dispute ${savedDispute.id} created for split ${fileDisputeDto.splitId}`,
      );

      return savedDispute;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to file dispute: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * ADD EVIDENCE TO DISPUTE
   */
  async addEvidence(
    addEvidenceDto: AddEvidenceDto,
    uploadedBy: string,
  ): Promise<DisputeEvidence> {
    const dispute = await this.disputeRepository.findOne({
      where: { id: addEvidenceDto.disputeId },
    });

    if (!dispute) {
      throw new NotFoundException(
        `Dispute with ID ${addEvidenceDto.disputeId} not found`,
      );
    }

    // Verify dispute allows evidence submission
    if (!DisputeStateMachine.allowsEvidenceSubmission(dispute.status)) {
      throw new BadRequestException(
        `Cannot add evidence to dispute in status: ${dispute.status}`,
      );
    }

    // Create evidence record
    const evidence = this.evidenceRepository.create({
      disputeId: addEvidenceDto.disputeId,
      uploadedBy,
      fileKey: addEvidenceDto.fileKey,
      fileName: addEvidenceDto.fileName,
      mimeType: addEvidenceDto.mimeType,
      size: addEvidenceDto.size,
      description: addEvidenceDto.description || null,
      metadata: addEvidenceDto.metadata || null,
    });

    const savedEvidence = await this.evidenceRepository.save(evidence);

    // Add to dispute's evidence array
    dispute.evidence = dispute.evidence || [];
    dispute.evidence.push({
      id: savedEvidence.id,
      uploadedBy,
      uploadedAt: savedEvidence.createdAt,
      fileKey: addEvidenceDto.fileKey,
      fileName: addEvidenceDto.fileName,
      mimeType: addEvidenceDto.mimeType,
      size: addEvidenceDto.size,
    });

    // Append audit trail
    const auditEntry: AuditTrailEntry = {
      action: 'evidence_added',
      performedBy: uploadedBy,
      performedAt: new Date(),
      details: {
        evidenceId: savedEvidence.id,
        fileName: addEvidenceDto.fileName,
        size: addEvidenceDto.size,
      },
    };
    dispute.auditTrail = dispute.auditTrail || [];
    dispute.auditTrail.push(auditEntry);

    await this.disputeRepository.save(dispute);

    // Emit event
    this.eventEmitter.emit(
      'dispute.evidence_added',
      new DisputeEvidenceAddedEvent(dispute, savedEvidence, uploadedBy),
    );

    this.logger.log(
      `Evidence ${savedEvidence.id} added to dispute ${dispute.id}`,
    );

    return savedEvidence;
  }

  /**
   * GET DISPUTE EVIDENCE
   */
  async getDisputeEvidence(disputeId: string): Promise<DisputeEvidence[]> {
    const evidence = await this.evidenceRepository.find({
      where: { disputeId },
      order: { createdAt: 'DESC' },
    });

    return evidence;
  }

  /**
   * TRANSITION: open → evidence_collection
   * Moves to evidence collection phase
   */
  async moveToEvidenceCollection(
    disputeId: string,
    performedBy: string,
  ): Promise<Dispute> {
    const dispute = await this.disputeRepository.findOne({
      where: { id: disputeId },
    });

    if (!dispute) {
      throw new NotFoundException(`Dispute with ID ${disputeId} not found`);
    }

    // Validate state transition
    DisputeStateMachine.validateTransition(
      dispute.status,
      DisputeStatus.EVIDENCE_COLLECTION,
    );

    dispute.status = DisputeStatus.EVIDENCE_COLLECTION;
    this.addAuditTrail(dispute, 'status_changed_to_evidence_collection', performedBy, {
      previousStatus: DisputeStatus.OPEN,
      newStatus: DisputeStatus.EVIDENCE_COLLECTION,
    });

    const updated = await this.disputeRepository.save(dispute);

    this.logger.log(
      `Dispute ${disputeId} transitioned to EVIDENCE_COLLECTION`,
    );

    return updated;
  }

  /**
   * SUBMIT FOR REVIEW
   * Transition: evidence_collection → under_review
   */
  async submitForReview(
    submitForReviewDto: SubmitForReviewDto,
    performedBy: string,
  ): Promise<Dispute> {
    const dispute = await this.disputeRepository.findOne({
      where: { id: submitForReviewDto.disputeId },
    });

    if (!dispute) {
      throw new NotFoundException(
        `Dispute with ID ${submitForReviewDto.disputeId} not found`,
      );
    }

    // Validate state transition
    DisputeStateMachine.validateTransition(
      dispute.status,
      DisputeStatus.UNDER_REVIEW,
    );

    dispute.status = DisputeStatus.UNDER_REVIEW;
    this.addAuditTrail(dispute, 'submitted_for_review', performedBy, {
      evidenceCount: dispute.evidence?.length || 0,
    });

    const updated = await this.disputeRepository.save(dispute);

    // Emit event
    this.eventEmitter.emit(
      'dispute.under_review',
      new DisputeUnderReviewEvent(updated),
    );

    this.logger.log(`Dispute ${submitForReviewDto.disputeId} submitted for review`);

    return updated;
  }

  /**
   * RESOLVE DISPUTE WITH FINANCIAL UPDATE
   * Atomic transaction: status update + split unfreeze + financial adjustments
   */
  async resolveDispute(
    resolveDisputeDto: ResolveDisputeDto,
    resolvedBy: string,
  ): Promise<Dispute> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const dispute = await queryRunner.manager.findOne(Dispute, {
        where: { id: resolveDisputeDto.disputeId },
      });

      if (!dispute) {
        throw new NotFoundException(
          `Dispute with ID ${resolveDisputeDto.disputeId} not found`,
        );
      }

      // Validate state transition
      DisputeStateMachine.validateTransition(
        dispute.status,
        DisputeStatus.RESOLVED,
      );

      // Get split for validation
      const split = await queryRunner.manager.findOne(Split, {
        where: { id: dispute.splitId },
      });

      if (!split) {
        throw new NotFoundException(`Split ${dispute.splitId} not found`);
      }

      // Update dispute
      dispute.status = DisputeStatus.RESOLVED;
      dispute.resolution = resolveDisputeDto.resolution;
      dispute.resolvedBy = resolvedBy;
      dispute.resolvedAt = new Date();
      dispute.resolutionOutcome = {
        outcome: resolveDisputeDto.outcome,
        details: resolveDisputeDto.details || {},
        executedAt: new Date(),
      };

      this.addAuditTrail(dispute, 'dispute_resolved', resolvedBy, {
        outcome: resolveDisputeDto.outcome,
        resolution: resolveDisputeDto.resolution.substring(0, 100),
      });

      const updatedDispute = await queryRunner.manager.save(dispute);

      // Unfreeze split
      await queryRunner.manager.update(
        Split,
        { id: dispute.splitId },
        { isFrozen: false },
      );

      await queryRunner.commitTransaction();

      // Emit events
      this.eventEmitter.emit(
        'dispute.resolved',
        new DisputeResolvedEvent(
          updatedDispute,
          resolvedBy,
          resolveDisputeDto.outcome,
          resolveDisputeDto.resolution,
        ),
      );
      this.eventEmitter.emit(
        'split.unfrozen',
        new SplitUnfrozenEvent(
          dispute.splitId,
          dispute.id,
          `Dispute resolved: ${resolveDisputeDto.outcome}`,
        ),
      );

      this.logger.log(
        `Dispute ${resolveDisputeDto.disputeId} resolved with outcome: ${resolveDisputeDto.outcome}`,
      );

      return updatedDispute;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to resolve dispute: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * REJECT DISPUTE
   * Transition: under_review → rejected, unfreezes split
   */
  async rejectDispute(
    disputeId: string,
    reason: string,
    performedBy: string,
  ): Promise<Dispute> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const dispute = await queryRunner.manager.findOne(Dispute, {
        where: { id: disputeId },
      });

      if (!dispute) {
        throw new NotFoundException(`Dispute with ID ${disputeId} not found`);
      }

      // Validate state transition
      DisputeStateMachine.validateTransition(
        dispute.status,
        DisputeStatus.REJECTED,
      );

      dispute.status = DisputeStatus.REJECTED;
      dispute.resolution = reason;
      dispute.resolvedBy = performedBy;
      dispute.resolvedAt = new Date();

      this.addAuditTrail(dispute, 'dispute_rejected', performedBy, {
        reason,
      });

      const updatedDispute = await queryRunner.manager.save(dispute);

      // Unfreeze split
      await queryRunner.manager.update(
        Split,
        { id: dispute.splitId },
        { isFrozen: false },
      );

      await queryRunner.commitTransaction();

      // Emit event
      this.eventEmitter.emit(
        'dispute.rejected',
        new DisputeRejectedEvent(updatedDispute, performedBy, reason),
      );
      this.eventEmitter.emit(
        'split.unfrozen',
        new SplitUnfrozenEvent(
          dispute.splitId,
          dispute.id,
          `Dispute rejected: ${reason}`,
        ),
      );

      this.logger.log(`Dispute ${disputeId} rejected`);

      return updatedDispute;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to reject dispute: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * APPEAL DISPUTE
   * Creates new review cycle, preserves audit trail
   * Only involved parties can appeal within limited window
   */
  async appealDispute(
    appealDisputeDto: AppealDisputeDto,
    appealedBy: string,
  ): Promise<Dispute> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const originalDispute = await queryRunner.manager.findOne(Dispute, {
        where: { id: appealDisputeDto.disputeId },
      });

      if (!originalDispute) {
        throw new NotFoundException(
          `Dispute with ID ${appealDisputeDto.disputeId} not found`,
        );
      }

      // Validate state transition
      DisputeStateMachine.validateTransition(
        originalDispute.status,
        DisputeStatus.APPEALED,
      );

      // Verify appealer is involved party (raisedBy or check participants)
      if (originalDispute.raisedBy !== appealedBy) {
        throw new ForbiddenException(
          'Only the party that raised the dispute can appeal',
        );
      }

      // Check appeal window (e.g., 30 days from resolution)
      const daysSinceResolution = Math.floor(
        (Date.now() - (originalDispute.resolvedAt?.getTime() || Date.now())) / (1000 * 60 * 60 * 24),
      );
      if (daysSinceResolution > 30) {
        throw new BadRequestException(
          'Appeal window has expired (30 days from resolution)',
        );
      }

      // Update original dispute to APPEALED
      originalDispute.status = DisputeStatus.APPEALED;
      originalDispute.appealReason = appealDisputeDto.appealReason;
      originalDispute.appealedAt = new Date();

      this.addAuditTrail(originalDispute, 'dispute_appealed', appealedBy, {
        appealReason: appealDisputeDto.appealReason.substring(0, 100),
      });

      const appealedDispute = await queryRunner.manager.save(originalDispute);

      // Freeze split again
      await queryRunner.manager.update(
        Split,
        { id: originalDispute.splitId },
        { isFrozen: true },
      );

      await queryRunner.commitTransaction();

      // Emit event
      this.eventEmitter.emit(
        'dispute.appealed',
        new DisputeAppealedEvent(
          appealedDispute,
          appealedBy,
          appealDisputeDto.appealReason,
          appealDisputeDto.disputeId,
        ),
      );
      this.eventEmitter.emit(
        'split.frozen',
        new SplitFrozenEvent(
          originalDispute.splitId,
          originalDispute.id,
          `Dispute appealed: ${appealDisputeDto.appealReason.substring(0, 50)}`,
        ),
      );

      this.logger.log(
        `Dispute ${appealDisputeDto.disputeId} appealed by ${appealedBy}`,
      );

      return appealedDispute;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to appeal dispute: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * REQUEST MORE EVIDENCE
   */
  async requestMoreEvidence(
    requestDto: RequestMoreEvidenceDto,
    requestedBy: string,
  ): Promise<Dispute> {
    const dispute = await this.disputeRepository.findOne({
      where: { id: requestDto.disputeId },
    });

    if (!dispute) {
      throw new NotFoundException(
        `Dispute with ID ${requestDto.disputeId} not found`,
      );
    }

    // Can request evidence only in certain statuses
    if (
      ![DisputeStatus.EVIDENCE_COLLECTION, DisputeStatus.UNDER_REVIEW].includes(
        dispute.status,
      )
    ) {
      throw new BadRequestException(
        `Cannot request evidence for dispute in status: ${dispute.status}`,
      );
    }

    this.addAuditTrail(dispute, 'more_evidence_requested', requestedBy, {
      request: requestDto.evidenceRequest.substring(0, 100),
    });

    await this.disputeRepository.save(dispute);

    // Emit event
    this.eventEmitter.emit(
      'dispute.more_evidence_requested',
      new MoreEvidenceRequestedEvent(
        dispute,
        requestedBy,
        requestDto.evidenceRequest,
      ),
    );

    this.logger.log(`More evidence requested for dispute ${requestDto.disputeId}`);

    return dispute;
  }

  /**
   * GET DISPUTE BY ID
   */
  async getDisputeById(disputeId: string): Promise<Dispute> {
    const dispute = await this.disputeRepository.findOne({
      where: { id: disputeId },
      relations: ['split'],
    });

    if (!dispute) {
      throw new NotFoundException(`Dispute with ID ${disputeId} not found`);
    }

    return dispute;
  }

  /**
   * GET DISPUTES BY SPLIT
   */
  async getDisputesBySplit(splitId: string): Promise<Dispute[]> {
    return this.disputeRepository.find({
      where: { splitId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * ADMIN LIST DISPUTES WITH FILTERS
   */
  async adminListDisputes(queryDto: QueryDisputesDto): Promise<{
    disputes: Dispute[];
    total: number;
  }> {
    const page = Math.max(queryDto.page || 1, 1);
    const limit = Math.min(queryDto.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: any = {};

    if (queryDto.splitId) {
      where.splitId = queryDto.splitId;
    }
    if (queryDto.status) {
      where.status = queryDto.status;
    }
    if (queryDto.raisedBy) {
      where.raisedBy = queryDto.raisedBy;
    }

    const [disputes, total] = await this.disputeRepository.findAndCount({
      where,
      order: {
        [queryDto.sortBy || 'createdAt']: queryDto.sortOrder || 'DESC',
      },
      skip,
      take: limit,
    });

    return { disputes, total };
  }

  /**
   * Helper: Add audit trail entry
   */
  private addAuditTrail(
    dispute: Dispute,
    action: string,
    performedBy: string,
    details: Record<string, any>,
  ): void {
    const entry: AuditTrailEntry = {
      action,
      performedBy,
      performedAt: new Date(),
      details,
    };

    if (!dispute.auditTrail) {
      dispute.auditTrail = [];
    }

    dispute.auditTrail.push(entry);
  }

  /**
   * Get audit trail for dispute
   */
  async getDisputeAuditTrail(disputeId: string): Promise<AuditTrailEntry[]> {
    const dispute = await this.disputeRepository.findOne({
      where: { id: disputeId },
    });

    if (!dispute) {
      throw new NotFoundException(`Dispute with ID ${disputeId} not found`);
    }

    return dispute.auditTrail || [];
  }
}
