import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ValidationPipe,
} from '@nestjs/common';
import { DisputesService, AuditTrailEntry } from './disputes.service';
import {
  FileDisputeDto,
  AddEvidenceDto,
  SubmitForReviewDto,
  ResolveDisputeDto,
  AppealDisputeDto,
  QueryDisputesDto,
  RequestMoreEvidenceDto,
} from './dto/dispute.dto';
import { Dispute } from '../entities/dispute.entity';
import { DisputeEvidence } from '../entities/dispute-evidence.entity';

// TODO: Implement these with actual auth guards
// import { AuthGuard } from '@nestjs/passport';
// import { RolesGuard } from '../security/roles.guard';
// import { Roles } from '../security/roles.decorator';

/**
 * Dispute Resolution API Controller
 * Handlers for all dispute-related operations
 */
@Controller('disputes')
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  /**
   * FILE DISPUTE
   * POST /disputes
   * Creates a new dispute and automatically freezes the split
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async fileDispute(
    @Body(ValidationPipe) fileDisputeDto: FileDisputeDto,
    // @Request() req: any, // Will contain authenticated user
  ): Promise<Dispute> {
    // TODO: Extract from auth context
    const raisedBy = 'G...' as any; // Placeholder - from JWT or session
    return this.disputesService.fileDispute(fileDisputeDto, raisedBy);
  }

  /**
   * ADD EVIDENCE
   * POST /disputes/:disputeId/evidence
   * Adds evidence to a dispute
   */
  @Post(':disputeId/evidence')
  @HttpCode(HttpStatus.CREATED)
  async addEvidence(
    @Param('disputeId') disputeId: string,
    @Body(ValidationPipe) addEvidenceDto: AddEvidenceDto,
  ): Promise<DisputeEvidence> {
    // TODO: Extract from auth
    const uploadedBy = 'G...' as any;
    return this.disputesService.addEvidence(
      { ...addEvidenceDto, disputeId },
      uploadedBy,
    );
  }

  /**
   * GET DISPUTE EVIDENCE
   * GET /disputes/:disputeId/evidence
   * Retrieves all evidence for a dispute
   */
  @Get(':disputeId/evidence')
  async getDisputeEvidence(
    @Param('disputeId') disputeId: string,
  ): Promise<DisputeEvidence[]> {
    return this.disputesService.getDisputeEvidence(disputeId);
  }

  /**
   * SUBMIT FOR REVIEW
   * POST /disputes/:disputeId/submit-review
   * Moves dispute from evidence collection to under review
   */
  @Post(':disputeId/submit-review')
  @HttpCode(HttpStatus.OK)
  async submitForReview(
    @Param('disputeId') disputeId: string,
    @Body(ValidationPipe) submitForReviewDto: SubmitForReviewDto,
  ): Promise<Dispute> {
    // TODO: Extract from auth
    const performedBy = 'G...' as any;
    return this.disputesService.submitForReview(
      { ...submitForReviewDto, disputeId },
      performedBy,
    );
  }

  /**
   * RESOLVE DISPUTE
   * POST /disputes/:disputeId/resolve
   * Admin endpoint: resolves dispute and unfreezes split
   * Requires admin role
   */
  @Post(':disputeId/resolve')
  @HttpCode(HttpStatus.OK)
  // @UseGuards(AuthGuard('jwt'), RolesGuard)
  // @Roles('admin', 'moderator')
  async resolveDispute(
    @Param('disputeId') disputeId: string,
    @Body(ValidationPipe) resolveDisputeDto: ResolveDisputeDto,
  ): Promise<Dispute> {
    // TODO: Extract from auth
    const resolvedBy = 'G...' as any;
    return this.disputesService.resolveDispute(
      { ...resolveDisputeDto, disputeId },
      resolvedBy,
    );
  }

  /**
   * REJECT DISPUTE
   * POST /disputes/:disputeId/reject
   * Admin endpoint: rejects dispute and unfreezes split
   * Requires admin role
   */
  @Post(':disputeId/reject')
  @HttpCode(HttpStatus.OK)
  // @UseGuards(AuthGuard('jwt'), RolesGuard)
  // @Roles('admin', 'moderator')
  async rejectDispute(
    @Param('disputeId') disputeId: string,
    @Body() body: { reason: string },
  ): Promise<Dispute> {
    // TODO: Extract from auth
    const performedBy = 'G...' as any;
    return this.disputesService.rejectDispute(disputeId, body.reason, performedBy);
  }

  /**
   * APPEAL DISPUTE
   * POST /disputes/:disputeId/appeal
   * Only dispute creator can appeal within 30 days
   */
  @Post(':disputeId/appeal')
  @HttpCode(HttpStatus.OK)
  async appealDispute(
    @Param('disputeId') disputeId: string,
    @Body(ValidationPipe) appealDisputeDto: AppealDisputeDto,
  ): Promise<Dispute> {
    // TODO: Extract from auth
    const appealedBy = 'G...' as any;
    return this.disputesService.appealDispute(
      { ...appealDisputeDto, disputeId },
      appealedBy,
    );
  }

  /**
   * REQUEST MORE EVIDENCE
   * POST /disputes/:disputeId/request-evidence
   * Admin endpoint: requests additional evidence
   */
  @Post(':disputeId/request-evidence')
  @HttpCode(HttpStatus.OK)
  // @UseGuards(AuthGuard('jwt'), RolesGuard)
  // @Roles('admin', 'moderator')
  async requestMoreEvidence(
    @Param('disputeId') disputeId: string,
    @Body(ValidationPipe) requestDto: RequestMoreEvidenceDto,
  ): Promise<Dispute> {
    // TODO: Extract from auth
    const requestedBy = 'G...' as any;
    return this.disputesService.requestMoreEvidence(
      { ...requestDto, disputeId },
      requestedBy,
    );
  }

  /**
   * GET DISPUTE BY ID
   * GET /disputes/:disputeId
   * Retrieves full dispute details including audit trail
   */
  @Get(':disputeId')
  async getDisputeById(@Param('disputeId') disputeId: string): Promise<Dispute> {
    return this.disputesService.getDisputeById(disputeId);
  }

  /**
   * GET DISPUTES BY SPLIT
   * GET /disputes/split/:splitId
   * Retrieves all disputes for a specific split
   */
  @Get('split/:splitId')
  async getDisputesBySplit(@Param('splitId') splitId: string): Promise<Dispute[]> {
    return this.disputesService.getDisputesBySplit(splitId);
  }

  /**
   * ADMIN LIST DISPUTES
   * GET /disputes
   * Admin endpoint: lists all disputes with filtering
   * Requires admin role
   */
  @Get()
  // @UseGuards(AuthGuard('jwt'), RolesGuard)
  // @Roles('admin', 'moderator')
  async adminListDisputes(
    @Query() queryDto: QueryDisputesDto,
  ): Promise<{ disputes: Dispute[]; total: number }> {
    return this.disputesService.adminListDisputes(queryDto);
  }

  /**
   * GET DISPUTE AUDIT TRAIL
   * GET /disputes/:disputeId/audit-trail
   * Retrieves the full audit trail for a dispute
   */
  @Get(':disputeId/audit-trail')
  async getDisputeAuditTrail(
    @Param('disputeId') disputeId: string,
  ): Promise<AuditTrailEntry[]> {
    return this.disputesService.getDisputeAuditTrail(disputeId);
  }
}
