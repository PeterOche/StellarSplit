# Dispute Resolution System

## Overview

The Dispute Resolution System is a comprehensive, event-driven, and financially-safe module for handling split payment disputes. It implements a full dispute lifecycle with automatic split freezing, participant notifications, evidence management, and multi-level review workflows.

**Core Features:**
- ✅ Automatic split freezing when disputes are created
- ✅ Event-driven architecture for scalable notifications
- ✅ Complete audit trail for compliance
- ✅ State machine-based workflow validation
- ✅ Appeal mechanism with limited time window
- ✅ Atomic transactions ensuring financial consistency
- ✅ Role-based access control (admin-only resolution)
- ✅ Idempotent operations for reliability

---

## Domain Model

### Dispute Entity

```typescript
id: UUID
splitId: UUID (FK → Split)
raisedBy: string (wallet address)
disputeType: enum
  - incorrect_amount
  - missing_payment
  - wrong_items
  - other
description: text
status: enum
  - open
  - evidence_collection
  - under_review
  - resolved
  - rejected
  - appealed
evidence: JSONB (array of evidence references)
resolution: text nullable
resolvedBy: string nullable (admin wallet/ID)
resolvedAt: timestamp nullable
resolutionOutcome: JSONB nullable
  - outcome: adjust_balances | refund | cancel_split | no_change
  - details: transaction details
  - executedAt: timestamp
originalDisputeId: UUID nullable (if appealed)
appealReason: text nullable
appealedAt: timestamp nullable
auditTrail: JSONB (array of audit entries)
splitFrozen: boolean
createdAt: timestamp
updatedAt: timestamp
deletedAt: timestamp (soft delete)
```

### DisputeEvidence Entity

```typescript
id: UUID
disputeId: UUID (FK → Dispute)
uploadedBy: string (wallet address)
fileKey: string (S3/Azure Blob reference)
fileName: string
mimeType: string
size: bigint (bytes)
description: text nullable
metadata: JSONB (checksums, IP address, etc.)
createdAt: timestamp
```

### Split Entity (Modified)

```typescript
isFrozen: boolean (new field)
  - When true: blocks new payments, withdrawals, distributions
  - Set by dispute creation
  - Cleared by dispute resolution/rejection/cancellation
```

---

## State Machine

Valid dispute status transitions:

```
┌─────────────────────────────────────────────────────────┐
│ Dispute State Machine                                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  OPEN ─────────────→ EVIDENCE_COLLECTION              │
│                            │                           │
│                            ↓                           │
│                     UNDER_REVIEW ─────→ RESOLVED      │
│                            │                    │     │
│                            ├─────────→ REJECTED │     │
│                                         │       │     │
│                                         ↓       ↓     │
│                                      APPEALED ←──────┘
│                                         │              │
│                                         ↓              │
│                               UNDER_REVIEW (restart)  │
│                                                         │
└─────────────────────────────────────────────────────────┘

Valid Transitions:
- OPEN → EVIDENCE_COLLECTION
- EVIDENCE_COLLECTION → UNDER_REVIEW
- UNDER_REVIEW → RESOLVED or REJECTED
- RESOLVED or REJECTED → APPEALED
- APPEALED → UNDER_REVIEW (new review cycle)

Invalid Transitions (throw BadRequestException):
- Any reverse transitions
- Skipping intermediate states
- Transitions from OPEN directly to RESOLVED
```

---

## Complete Dispute Lifecycle

### 1. Dispute Creation (Atomic Transaction)

**Endpoint:** `POST /disputes`

**Request:**
```json
{
  "splitId": "550e8400-e29b-41d4-a716-446655440000",
  "disputeType": "incorrect_amount",
  "description": "The amount charged exceeds the itemized list by $25"
}
```

**Actions (Single Transaction):**
1. Verify split exists and has no active disputes
2. Create dispute in `OPEN` status
3. Add audit trail entry
4. FREEZE split (`isFrozen = true`)
5. Emit `DisputeCreatedEvent` (triggers notifications)
6. Emit `SplitFrozenEvent` (audit trail)

**Response:** Dispute object with full audit trail

**Transactional Safety:**
- If split freeze fails, entire operation rolls back
- Dispute and freeze are atomic

### 2. Evidence Collection Phase

**Endpoint:** `POST /disputes/:disputeId/evidence`

**Constraints:**
- Only allowed in `OPEN` or `EVIDENCE_COLLECTION` status
- Multiple evidence items supported
- File references stored (not binary data in DB)
- Metadata tracked (uploader, timestamp, size, mime type)

**Request:**
```json
{
  "fileKey": "s3://bucket/evidence/receipt-123.jpg",
  "fileName": "receipt.jpg",
  "mimeType": "image/jpeg",
  "size": 2048,
  "description": "Original receipt",
  "metadata": {
    "ipAddress": "192.168.1.1",
    "uploadedFrom": "Mobile App v2.1"
  }
}
```

**Actions:**
1. Validate dispute allows evidence
2. Create `DisputeEvidence` record
3. Add to dispute's evidence array
4. Add audit trail entry
5. Emit `DisputeEvidenceAddedEvent`

**Response:** Evidence object with ID and timestamps

### 3. Submit for Review

**Endpoint:** `POST /disputes/:disputeId/submit-review`

**State Transition:** `EVIDENCE_COLLECTION` → `UNDER_REVIEW`

**Actions:**
1. Validate state transition
2. Update dispute status
3. Add audit trail entry
4. Emit `DisputeUnderReviewEvent` (triggers admin notifications)

### 4. Admin Review & Resolution

**Endpoint:** `POST /disputes/:disputeId/resolve` (Admin only)

**Request:**
```json
{
  "outcome": "adjust_balances",
  "resolution": "Participant verified to have overpaid. Credit $25.",
  "details": {
    "creditAmount": 25,
    "currency": "USD",
    "recipientWallet": "GXXXXX"
  }
}
```

**Possible Outcomes:**
- `adjust_balances`: Update participant balances
- `refund`: Issue refund to participant
- `cancel_split`: Cancel entire split (rare)
- `no_change`: Dismiss dispute, no changes

**Actions (Atomic Transaction):**
1. Validate state transition (`UNDER_REVIEW` → `RESOLVED`)
2. Update dispute with resolution details
3. Add audit trail entry
4. UNFREEZE split (`isFrozen = false`)
5. Emit `DisputeResolvedEvent` (triggers notifications & payment processing)
6. Emit `SplitUnfrozenEvent` (audit)

**Transactional Safety:**
- If financial update fails, dispute resolution is rolled back
- Split remains frozen until successful resolution

### 5. Rejection Path (Alternative)

**Endpoint:** `POST /disputes/:disputeId/reject` (Admin only)

**Request:**
```json
{
  "reason": "Insufficient evidence provided. Claim lacks receipt or proof of overpayment."
}
```

**Actions (Atomic Transaction):**
1. Validate state transition (`UNDER_REVIEW` → `REJECTED`)
2. Update dispute status and reason
3. Add audit trail entry
4. UNFREEZE split
5. Emit `DisputeRejectedEvent`
6. Emit `SplitUnfrozenEvent`

**Result:** Split returns to normal, dispute cannot be re-opened (but can be appealed)

### 6. Appeal Mechanism

**Endpoint:** `POST /disputes/:disputeId/appeal`

**Constraints:**
- Only dispute creator can appeal
- Limited to 30 days from resolution
- Creates new review cycle

**Request:**
```json
{
  "appealReason": "The resolution was unfair. Additional evidence was ignored during review."
}
```

**Actions (Atomic Transaction):**
1. Verify appealer is dispute creator
2. Verify within 30-day window
3. Update dispute to `APPEALED` status
4. FREEZE split again (`isFrozen = true`)
5. Record appeal reason and timestamp
6. Add audit trail entry
7. Emit `DisputeAppealedEvent`
8. Emit `SplitFrozenEvent`

**Result:** Dispute returns to `UNDER_REVIEW` for re-evaluation by another admin

### 7. Request More Evidence (Admin)

**Endpoint:** `POST /disputes/:disputeId/request-evidence` (Admin only)

**Request:**
```json
{
  "evidenceRequest": "Please provide photos of items received, packing slip, and shipping documentation"
}
```

**Actions:**
1. Add audit trail entry
2. Emit `MoreEvidenceRequestedEvent`
3. Notify dispute participants

**Result:** Participants notified to submit additional evidence

---

## Transactional Safety Guarantees

### Atomic Operations

The system ensures that the following operations are atomic (all-or-nothing):

1. **Dispute Creation + Split Freeze**
   - If either fails, both rollback
   - No orphaned disputes
   - No partially frozen splits

2. **Dispute Resolution + Financial Updates + Split Unfreeze**
   - All three succeed or all rollback
   - Ledger consistency guaranteed
   - No double-spending

3. **Dispute Appeal + Split Re-freeze**
   - Both succeed or both rollback
   - No disputes stuck in limbo

### Implementation

```typescript
// Example: Atomic dispute creation
const queryRunner = this.dataSource.createQueryRunner();
await queryRunner.connect();
await queryRunner.startTransaction();

try {
  // 1. Create dispute
  const dispute = await queryRunner.manager.save(Dispute, {...});
  
  // 2. Freeze split in same transaction
  await queryRunner.manager.update(Split, 
    { id: splitId }, 
    { isFrozen: true }
  );
  
  await queryRunner.commitTransaction();
  
  // 3. Emit events (after transaction succeeds)
  this.eventEmitter.emit('dispute.created', ...);
  
} catch (error) {
  await queryRunner.rollbackTransaction();
  throw error;
}
```

---

## Split Freeze Logic

### When Split is Frozen:

- ✅ Dispute active (any non-resolved status)
- ✅ Block new payments from any participant
- ✅ Block withdrawals/distributions
- ✅ Block modification of split terms
- ✅ Allow viewing split details
- ✅ Allow adding evidence

### When Split is Unfrozen:

- ✅ Dispute resolved, rejected, or dismissed
- ✅ Normal operations resume
- ✅ Financial updates (credits, refunds) applied
- ✅ Participants can resume payments

### Implementation Example:

```typescript
// In payments service - before creating payment
async createPayment(dto: CreatePaymentDto) {
  const split = await this.splitRepository.findOne(dto.splitId);
  
  if (split.isFrozen) {
    throw new BadRequestException(
      'Cannot create payment: split is frozen due to active dispute'
    );
  }
  
  // ... continue with payment creation
}
```

---

## Event-Driven Notification System

### Events Emitted

| Event | When | Listeners | Action |
|-------|------|-----------|--------|
| `dispute.created` | Dispute filed | Notification Queue | Notify all split participants & admins |
| `dispute.evidence_added` | Evidence uploaded | Admin Notifications | Notify reviewers of new evidence |
| `dispute.under_review` | Submitted for review | Admin Notifications | Route to review queue |
| `dispute.resolved` | Admin resolves | Notification Queue | Notify all parties with outcome |
| `dispute.rejected` | Admin rejects | Notification Queue | Notify participants |
| `dispute.appealed` | Participant appeals | Admin Notifications | Route to admin for re-review |
| `more_evidence_requested` | Admin requests | Notification Queue | Notify participants to submit evidence |
| `split.frozen` | When split frozen | Audit Logger | Log freeze event |
| `split.unfrozen` | When split unfrozen | Audit Logger | Log unfreeze event |

### Async Notification Queue

```typescript
// Event listener queues notifications
@OnEvent('dispute.created')
async handleDisputeCreated(event: DisputeCreatedEvent) {
  await this.notificationQueue.add('DISPUTE_CREATED', {
    disputeId: event.dispute.id,
    splitId: event.dispute.splitId,
    participants: [...split participants...],
    template: 'dispute_created.html'
  });
}

// Worker processes queue asynchronously
@Process('DISPUTE_CREATED')
async processDisputeNotification(job: Job) {
  const { disputeId, participants, template } = job.data;
  
  for (const participant of participants) {
    await this.emailService.send({
      to: participant.email,
      template,
      subject: `Dispute filed for your split`
    });
  }
}
```

---

## Audit Trail

Every dispute action is recorded with full context:

```typescript
auditTrail: [
  {
    action: "dispute_created",
    performedBy: "GXXXXX",
    performedAt: "2024-02-20T10:30:00Z",
    details: {
      type: "incorrect_amount",
      description: "..."
    }
  },
  {
    action: "evidence_added",
    performedBy: "GXXXXX",
    performedAt: "2024-02-20T10:35:00Z",
    details: {
      evidenceId: "evidence-123",
      fileName: "receipt.jpg"
    }
  },
  {
    action: "submitted_for_review",
    performedBy: "GXXXXX",
    performedAt: "2024-02-20T10:40:00Z",
    details: {
      evidenceCount: 2
    }
  },
  {
    action: "dispute_resolved",
    performedBy: "admin-wallet",
    performedAt: "2024-02-20T11:20:00Z",
    details: {
      outcome: "adjust_balances",
      resolution: "..."
    }
  }
]
```

### Audit Trail Query

**Endpoint:** `GET /disputes/:disputeId/audit-trail`

**Response:**
```json
[
  {
    "action": "dispute_created",
    "performedBy": "GXXXXX",
    "performedAt": "2024-02-20T10:30:00Z",
    "details": {...}
  },
  ...
]
```

---

## API Reference

### Dispute Management

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/disputes` | File new dispute | Any participant |
| GET | `/disputes/:disputeId` | Get dispute details | Public |
| GET | `/disputes/split/:splitId` | Get disputes for split | Public |
| GET | `/disputes` | List all disputes | Admin only |
| POST | `/disputes/:disputeId/evidence` | Add evidence | Participant |
| GET | `/disputes/:disputeId/evidence` | List evidence | Public |
| POST | `/disputes/:disputeId/submit-review` | Submit for review | Participant |
| POST | `/disputes/:disputeId/resolve` | Resolve dispute | Admin only |
| POST | `/disputes/:disputeId/reject` | Reject dispute | Admin only |
| POST | `/disputes/:disputeId/appeal` | Appeal decision | Dispute creator |
| POST | `/disputes/:disputeId/request-evidence` | Request more evidence | Admin only |
| GET | `/disputes/:disputeId/audit-trail` | Get audit history | Public |

---

## Testing

### Unit Tests

```bash
npm test -- disputes.service.spec.ts
```

Tests covered:
- ✅ Dispute creation freezes split
- ✅ Invalid state transitions rejected
- ✅ Evidence upload linked correctly
- ✅ Resolution updates status and unfreezes split
- ✅ Appeal restarts review flow
- ✅ State machine validation
- ✅ Audit trail accuracy

### Integration Tests

```bash
npm test -- disputes.integration.spec.ts
```

Tests covered:
- ✅ Full dispute lifecycle
- ✅ Event emission
- ✅ Database transactions
- ✅ API endpoints
- ✅ Error handling
- ✅ Admin operations
- ✅ Query filtering

---

## Error Handling

### Common Errors

| Status | Error | Cause | Solution |
|--------|-------|-------|----------|
| 400 | Invalid state transition | Wrong dispute status | Check current status first |
| 400 | Cannot add evidence | Dispute in wrong status | Move to evidence collection |
| 404 | Dispute not found | Invalid dispute ID | Verify dispute ID |
| 409 | Active dispute exists | Split already has dispute | Resolve existing dispute first |
| 403 | Forbidden | Insufficient permissions | Use admin account for resolution |
| 422 | Validation error | Missing required fields | Check DTO validation |

---

## Security Considerations

1. **Split Freeze Enforcement**
   - Always check `isFrozen` before accepting payments
   - Cannot bypass freeze except through resolution

2. **Admin-Only Operations**
   - Resolution and rejection require admin role
   - Use role-based guards on controllers

3. **Soft Deletes**
   - Disputes use soft deletes for compliance
   - Preserves full audit trail

4. **Evidence Storage**
   - Only file references stored in DB
   - Use object storage (S3, Azure Blob) for files
   - Enforce size limits (max 50MB per file)

5. **Appeal Window**
   - Hardcoded 30-day limit prevents indefinite disputes
   - Returns `BadRequestException` if exceeded

6. **Idempotency**
   - All operations can be safely retried
   - No double-operations due to duplicate requests

---

## Migration

Run migration to create tables:

```bash
npm run typeorm migration:run
```

Migration creates:
- `disputes` table with indexes
- `dispute_evidence` table with foreign keys
- `splits.isFrozen` column (default: false)

---

## Future Enhancements

- [ ] Automated evidence validation (OCR, fraud detection)
- [ ] Multi-level admin review (escalation chain)
- [ ] Financial escrow during disputes
- [ ] Integration with dispute resolution partners
- [ ] Machine learning for pattern detection
- [ ] Blockchain-backed audit trail
- [ ] Real-time dispute notifications (WebSocket)
- [ ] Video evidence support
- [ ] Legal document templates

---

## Related Modules

- **Payments**: Blocked when split is frozen
- **Email**: Sends dispute notifications
- **Analytics**: Tracks dispute metrics
- **Security**: Role-based access control
- **Webhooks**: External dispute updates

---

## Support

For questions or issues:
1. Check audit trail for detailed action history
2. Review state machine transitions
3. Verify split freeze status
4. Check event logs for notifications
