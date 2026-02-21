import { BadRequestException } from '@nestjs/common';
import { DisputeStatus } from '../entities/dispute.entity';

/**
 * State machine for dispute status transitions
 * Enforces valid state transitions and prevents invalid changes
 */
export class DisputeStateMachine {
  /**
   * Defines valid transitions from each state
   */
  private static readonly VALID_TRANSITIONS: Record<DisputeStatus, DisputeStatus[]> = {
    [DisputeStatus.OPEN]: [
      DisputeStatus.EVIDENCE_COLLECTION,
    ],
    [DisputeStatus.EVIDENCE_COLLECTION]: [
      DisputeStatus.UNDER_REVIEW,
    ],
    [DisputeStatus.UNDER_REVIEW]: [
      DisputeStatus.RESOLVED,
      DisputeStatus.REJECTED,
    ],
    [DisputeStatus.RESOLVED]: [
      DisputeStatus.APPEALED,
    ],
    [DisputeStatus.REJECTED]: [
      DisputeStatus.APPEALED,
    ],
    [DisputeStatus.APPEALED]: [
      DisputeStatus.UNDER_REVIEW,
    ],
  };

  /**
   * Check if a transition is valid
   */
  static canTransition(
    currentStatus: DisputeStatus,
    targetStatus: DisputeStatus,
  ): boolean {
    if (currentStatus === targetStatus) {
      return true; // Allow staying in same state (idempotent)
    }

    const validTransitions = this.VALID_TRANSITIONS[currentStatus] || [];
    return validTransitions.includes(targetStatus);
  }

  /**
   * Validate transition or throw error
   */
  static validateTransition(
    currentStatus: DisputeStatus,
    targetStatus: DisputeStatus,
  ): void {
    if (!this.canTransition(currentStatus, targetStatus)) {
      throw new BadRequestException(
        `Invalid dispute status transition from ${currentStatus} to ${targetStatus}. ` +
        `Valid transitions from ${currentStatus}: ${this.VALID_TRANSITIONS[currentStatus]?.join(', ') || 'none'}`,
      );
    }
  }

  /**
   * Get valid next states for a given state
   */
  static getValidNextStates(currentStatus: DisputeStatus): DisputeStatus[] {
    return this.VALID_TRANSITIONS[currentStatus] || [];
  }

  /**
   * Check if status represents a terminal state
   */
  static isTerminalState(status: DisputeStatus): boolean {
    const terminalStates = [DisputeStatus.RESOLVED, DisputeStatus.REJECTED];
    return terminalStates.includes(status);
  }

  /**
   * Check if status allows further actions (e.g., evidence submission)
   */
  static allowsEvidenceSubmission(status: DisputeStatus): boolean {
    const evidenceAllowedStates = [
      DisputeStatus.OPEN,
      DisputeStatus.EVIDENCE_COLLECTION,
    ];
    return evidenceAllowedStates.includes(status);
  }

  /**
   * Check if status can be reviewed
   */
  static canBeReviewed(status: DisputeStatus): boolean {
    const reviewableStates = [
      DisputeStatus.EVIDENCE_COLLECTION,
      DisputeStatus.UNDER_REVIEW,
    ];
    return reviewableStates.includes(status);
  }
}
