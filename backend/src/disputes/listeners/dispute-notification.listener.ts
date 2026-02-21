import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  DisputeCreatedEvent,
  DisputeEvidenceAddedEvent,
  DisputeUnderReviewEvent,
  DisputeResolvedEvent,
  DisputeRejectedEvent,
  DisputeAppealedEvent,
  MoreEvidenceRequestedEvent,
} from '../dispute.events';

/**
 * Event listener for dispute notifications
 * Emits events to queue system for async notification delivery
 * TODO: Integrate with email/notification queue
 */
@Injectable()
export class DisputeNotificationListener {
  private readonly logger = new Logger(DisputeNotificationListener.name);

  /**
   * When dispute is created:
   * - Notify all split participants
   * - Notify admins
   */
  @OnEvent('dispute.created')
  async handleDisputeCreated(payload: DisputeCreatedEvent) {
    this.logger.log(
      `Dispute created: ${payload.dispute.id} - Queuing notifications...`,
    );

    // TODO: Queue notifications
    // Example pseudo-code:
    // await this.notificationQueue.add('dispute.created', {
    //   disputeId: payload.dispute.id,
    //   splitId: payload.dispute.splitId,
    //   participants: [...split.participants],
    //   admins: [...admins],
    // });

    console.log(`NOTIFICATION: Dispute ${payload.dispute.id} created by ${payload.raisedBy}`);
  }

  /**
   * When evidence is added:
   * - Notify admins/reviewers
   */
  @OnEvent('dispute.evidence_added')
  async handleEvidenceAdded(payload: DisputeEvidenceAddedEvent) {
    this.logger.log(
      `Evidence added to dispute ${payload.dispute.id}: ${payload.evidence.fileName}`,
    );

    // TODO: Queue notification
    console.log(
      `NOTIFICATION: Evidence added to dispute ${payload.dispute.id} by ${payload.uploadedBy}`,
    );
  }

  /**
   * When dispute is under review:
   * - Notify relevant admins
   */
  @OnEvent('dispute.under_review')
  async handleDisputeUnderReview(payload: DisputeUnderReviewEvent) {
    this.logger.log(`Dispute ${payload.dispute.id} is now under review`);

    // TODO: Queue notification
    console.log(
      `NOTIFICATION: Dispute ${payload.dispute.id} submitted for review`,
    );
  }

  /**
   * When dispute is resolved:
   * - Notify all participants
   * - Include resolution details
   */
  @OnEvent('dispute.resolved')
  async handleDisputeResolved(payload: DisputeResolvedEvent) {
    this.logger.log(
      `Dispute ${payload.dispute.id} resolved with outcome: ${payload.outcome}`,
    );

    // TODO: Queue notification
    console.log(
      `NOTIFICATION: Dispute ${payload.dispute.id} resolved - Outcome: ${payload.outcome}`,
    );
  }

  /**
   * When dispute is rejected:
   * - Notify dispute creator
   * - Include reason
   */
  @OnEvent('dispute.rejected')
  async handleDisputeRejected(payload: DisputeRejectedEvent) {
    this.logger.log(`Dispute ${payload.dispute.id} rejected. Reason: ${payload.reason}`);

    // TODO: Queue notification
    console.log(
      `NOTIFICATION: Dispute ${payload.dispute.id} rejected - Reason: ${payload.reason}`,
    );
  }

  /**
   * When dispute is appealed:
   * - Notify admins for new review
   * - Re-freeze split if unfrozen
   */
  @OnEvent('dispute.appealed')
  async handleDisputeAppealed(payload: DisputeAppealedEvent) {
    this.logger.log(
      `Dispute ${payload.dispute.id} appealed by ${payload.appealedBy}`,
    );

    // TODO: Queue notification
    console.log(
      `NOTIFICATION: Dispute ${payload.dispute.id} appealed - New review cycle`,
    );
  }

  /**
   * When more evidence is requested:
   * - Notify involved parties
   * - Include evidence request details
   */
  @OnEvent('dispute.more_evidence_requested')
  async handleMoreEvidenceRequested(payload: MoreEvidenceRequestedEvent) {
    this.logger.log(
      `More evidence requested for dispute ${payload.dispute.id}`,
    );

    // TODO: Queue notification
    console.log(
      `NOTIFICATION: More evidence requested for dispute ${payload.dispute.id}`,
    );
  }
}
