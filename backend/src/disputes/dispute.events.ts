import { Dispute, DisputeStatus } from '../entities/dispute.entity';
import { DisputeEvidence } from '../entities/dispute-evidence.entity';

/**
 * Base event for all dispute-related events
 */
export abstract class DisputeEvent {
  constructor(
    public readonly dispute: Dispute,
    public readonly timestamp: Date = new Date(),
  ) {}
}

/**
 * Emitted when a dispute is created
 * Triggers: split freeze, notification to participants
 */
export class DisputeCreatedEvent extends DisputeEvent {
  constructor(
    dispute: Dispute,
    public readonly raisedBy: string,
    timestamp?: Date,
  ) {
    super(dispute, timestamp);
  }
}

/**
 * Emitted when evidence is added to a dispute
 * Triggers: notification to admins/reviewers
 */
export class DisputeEvidenceAddedEvent extends DisputeEvent {
  constructor(
    dispute: Dispute,
    public readonly evidence: DisputeEvidence,
    public readonly uploadedBy: string,
    timestamp?: Date,
  ) {
    super(dispute, timestamp);
  }
}

/**
 * Emitted when dispute status changes to EVIDENCE_COLLECTION
 * Triggers: notification to participants
 */
export class DisputeEvidenceCollectionStartedEvent extends DisputeEvent {
  constructor(
    dispute: Dispute,
    public readonly collectionDeadline?: Date,
    timestamp?: Date,
  ) {
    super(dispute, timestamp);
  }
}

/**
 * Emitted when dispute is submitted for admin review
 * Triggers: notification to admins/moderators
 */
export class DisputeUnderReviewEvent extends DisputeEvent {
  constructor(
    dispute: Dispute,
    public readonly submittedAt: Date = new Date(),
  ) {
    super(dispute, submittedAt);
  }
}

/**
 * Emitted when dispute is resolved
 * Triggers: split unfreeze, financial updates, notifications
 */
export class DisputeResolvedEvent extends DisputeEvent {
  constructor(
    dispute: Dispute,
    public readonly resolvedBy: string,
    public readonly outcome: string,
    public readonly resolution: string,
    timestamp?: Date,
  ) {
    super(dispute, timestamp);
  }
}

/**
 * Emitted when dispute is rejected
 * Triggers: split unfreeze/cancellation, notifications
 */
export class DisputeRejectedEvent extends DisputeEvent {
  constructor(
    dispute: Dispute,
    public readonly resolvedBy: string,
    public readonly reason: string,
    timestamp?: Date,
  ) {
    super(dispute, timestamp);
  }
}

/**
 * Emitted when dispute is appealed
 * Triggers: new review cycle, notifications
 */
export class DisputeAppealedEvent extends DisputeEvent {
  constructor(
    dispute: Dispute,
    public readonly appealedBy: string,
    public readonly appealReason: string,
    public readonly originalDisputeId: string,
    timestamp?: Date,
  ) {
    super(dispute, timestamp);
  }
}

/**
 * Emitted when more evidence is requested
 * Triggers: notification to participants
 */
export class MoreEvidenceRequestedEvent extends DisputeEvent {
  constructor(
    dispute: Dispute,
    public readonly requestedBy: string,
    public readonly evidenceRequest: string,
    public readonly deadline?: Date,
    timestamp?: Date,
  ) {
    super(dispute, timestamp);
  }
}

/**
 * Emitted when split is frozen due to dispute
 * Used for analytics and audit trail
 */
export class SplitFrozenEvent {
  constructor(
    public readonly splitId: string,
    public readonly disputeId: string,
    public readonly freezeReason: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}

/**
 * Emitted when split is unfrozen after dispute resolution
 * Used for audit trail
 */
export class SplitUnfrozenEvent {
  constructor(
    public readonly splitId: string,
    public readonly disputeId: string,
    public readonly unfreezeReason: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}
