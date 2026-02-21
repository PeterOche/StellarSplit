import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  DisputeCreatedEvent,
  DisputeResolvedEvent,
  DisputeRejectedEvent,
  DisputeAppealedEvent,
  SplitFrozenEvent,
  SplitUnfrozenEvent,
} from '../dispute.events';

/**
 * Event listener for dispute audit trail
 * Logs all dispute events for compliance and debugging
 * TODO: Integrate with audit logging service
 */
@Injectable()
export class DisputeAuditListener {
  private readonly logger = new Logger(DisputeAuditListener.name);

  @OnEvent('dispute.created')
  async handleDisputeCreatedAudit(payload: DisputeCreatedEvent) {
    this.logger.debug(
      `AUDIT: Dispute created ${payload.dispute.id} | ` +
      `Split: ${payload.dispute.splitId} | ` +
      `Type: ${payload.dispute.disputeType} | ` +
      `Raised by: ${payload.raisedBy}`,
    );

    // TODO: Send to audit log service
    // await this.auditLogService.logEvent({
    //   action: 'DISPUTE_CREATED',
    //   disputeId: payload.dispute.id,
    //   splitId: payload.dispute.splitId,
    //   actor: payload.raisedBy,
    //   details: {
    //     type: payload.dispute.disputeType,
    //     description: payload.dispute.description,
    //   },
    //   timestamp: new Date(),
    // });
  }

  @OnEvent('dispute.resolved')
  async handleDisputeResolvedAudit(payload: DisputeResolvedEvent) {
    this.logger.debug(
      `AUDIT: Dispute resolved ${payload.dispute.id} | ` +
      `Outcome: ${payload.outcome} | ` +
      `Resolved by: ${payload.resolvedBy}`,
    );

    // TODO: Send to audit log service
    // await this.auditLogService.logEvent({
    //   action: 'DISPUTE_RESOLVED',
    //   disputeId: payload.dispute.id,
    //   actor: payload.resolvedBy,
    //   details: {
    //     outcome: payload.outcome,
    //     resolution: payload.resolution,
    //   },
    //   timestamp: new Date(),
    // });
  }

  @OnEvent('dispute.rejected')
  async handleDisputeRejectedAudit(payload: DisputeRejectedEvent) {
    this.logger.debug(
      `AUDIT: Dispute rejected ${payload.dispute.id} | ` +
      `Reason: ${payload.reason} | ` +
      `Rejected by: ${payload.resolvedBy}`,
    );

    // TODO: Send to audit log service
  }

  @OnEvent('dispute.appealed')
  async handleDisputeAppealedAudit(payload: DisputeAppealedEvent) {
    this.logger.debug(
      `AUDIT: Dispute appealed ${payload.dispute.id} | ` +
      `Original: ${payload.originalDisputeId} | ` +
      `Appealed by: ${payload.appealedBy}`,
    );

    // TODO: Send to audit log service
  }

  @OnEvent('split.frozen')
  async handleSplitFrozenAudit(payload: SplitFrozenEvent) {
    this.logger.debug(
      `AUDIT: Split frozen ${payload.splitId} | ` +
      `By dispute: ${payload.disputeId} | ` +
      `Reason: ${payload.freezeReason}`,
    );

    // TODO: Send to audit log service
  }

  @OnEvent('split.unfrozen')
  async handleSplitUnfrozenAudit(payload: SplitUnfrozenEvent) {
    this.logger.debug(
      `AUDIT: Split unfrozen ${payload.splitId} | ` +
      `By dispute: ${payload.disputeId} | ` +
      `Reason: ${payload.unfreezeReason}`,
    );

    // TODO: Send to audit log service
  }
}
