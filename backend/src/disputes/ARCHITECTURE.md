# Dispute Resolution System - Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (UI)                            │
│  - File Dispute Form                                            │
│  - Evidence Upload                                              │
│  - Admin Dashboard                                              │
│  - Appeal Form                                                  │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    REST API Layer                               │
│  DisputesController                                             │
│  - POST   /disputes                                             │
│  - POST   /disputes/:id/evidence                                │
│  - POST   /disputes/:id/submit-review                           │
│  - POST   /disputes/:id/resolve (admin)                         │
│  - POST   /disputes/:id/reject (admin)                          │
│  - POST   /disputes/:id/appeal                                  │
│  - POST   /disputes/:id/request-evidence (admin)                │
│  - GET    /disputes/:id                                         │
│  - GET    /disputes                                             │
│  - GET    /disputes/:id/audit-trail                             │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Business Logic Layer                          │
│  DisputesService                                                │
│  - fileDispute()                                                │
│  - addEvidence()                                                │
│  - submitForReview()                                            │
│  - resolveDispute()                                             │
│  - rejectDispute()                                              │
│  - appealDispute()                                              │
│  - requestMoreEvidence()                                        │
└─────────────────┬──────────────────────────────────┬────────────┘
                  │                                  │
        ┌─────────▼──────────┐           ┌──────────▼──────────┐
        │ State Machine      │           │ Transaction Manager │
        │ validate()         │           │ (DataSource)        │
        │ canTransition()    │           │                     │
        │ isTerminalState()  │           │ Atomic Operations   │
        └────────────────────┘           └─────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Event System (NestJS)                         │
│  EventEmitter2                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ DomainEvents                                             │   │
│  │ - DisputeCreatedEvent                                   │   │
│  │ - DisputeEvidenceAddedEvent                             │   │
│  │ - DisputeUnderReviewEvent                               │   │
│  │ - DisputeResolvedEvent                                  │   │
│  │ - DisputeRejectedEvent                                  │   │
│  │ - DisputeAppealedEvent                                  │   │
│  │ - MoreEvidenceRequestedEvent                            │   │
│  │ - SplitFrozenEvent                                      │   │
│  │ - SplitUnfrozenEvent                                    │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────┬────────────────────────────────────┬────────────────────┘
       │                                    │
   ┌───▼───────────────────┐    ┌──────────▼──────────────────┐
   │ Notification Listener │    │ Audit Listener             │
   │ (Async)               │    │ (Logging)                  │
   │                       │    │                            │
   │ Emits to:             │    │ Logs:                      │
   │ - Email Queue         │    │ - Dispute created          │
   │ - SMS Queue           │    │ - Status changes           │
   │ - Push Notifications  │    │ - Admin actions            │
   │ - In-app Messages     │    │ - Financial updates        │
   └───────────┬───────────┘    └──────────┬──────────────────┘
               │                           │
               ▼                           ▼
        ┌──────────────┐          ┌─────────────────┐
        │ Bull Queue   │          │ Application Log │
        │ (Redis)      │          │                 │
        └──────┬───────┘          └─────────────────┘
               │
               ▼
        ┌──────────────────┐
        │ Email/SMS/Push   │
        │ Notification     │
        │ Service          │
        └──────────────────┘
```

---

## Data Model Relationships

```
┌─────────────────────────────────────────────────────────────┐
│                     Split Entity                            │
│  ────────────────────────────────────────────────────────  │
│  id                                                          │
│  totalAmount                                                 │
│  status                                                      │
│  isFrozen ◄────────────────┐                                │
│  ...                       │                                │
└─────────────┬──────────────┼────────────────────────────────┘
              │              │ (1 to many)
              │ (Foreign Key)│
              │              │
              ▼              │
┌─────────────────────────────────────────────────────────────┐
│                    Dispute Entity                           │
│  ────────────────────────────────────────────────────────  │
│  id                                                          │
│  splitId ◄────────────────────────────────────┘             │
│  raisedBy                                                    │
│  disputeType                                                 │
│  description                                                 │
│  status                                                      │
│  evidence: JSONB (lightweight refs)  ──┐                    │
│  auditTrail: JSONB                      │                   │
│  resolution                             │                   │
│  resolutionOutcome: JSONB              │                   │
│  ...                                   │                   │
└─────────────┬───────────────────────────┼────────────────────┘
              │                           │
              │ (1 to many)               │
              │                           │
              ▼                           ▼
┌────────────────────────┐    ┌──────────────────────────────┐
│ DisputeEvidence Entity │    │ Evidence Details (in JSONB)  │
│ ────────────────────── │    │ ────────────────────────────│
│ id                     │    │ - evidenceId                 │
│ disputeId              │    │ - uploadedBy                 │
│ uploadedBy             │    │ - uploadedAt                 │
│ fileKey                │    │ - fileKey                    │
│ fileName               │    │ - fileName                   │
│ mimeType               │    │ - size                       │
│ size                   │    │                              │
│ metadata: JSONB        │    │ AuditTrail Entry:            │
│ createdAt              │    │ ────────────────────────────│
└────────────────────────┘    │ - action                     │
                              │ - performedBy                │
   Object Storage (S3)        │ - performedAt                │
   ├── dispute-1234-5678/     │ - details                    │
   │  ├── receipt.jpg         │                              │
   │  ├── invoice.pdf         │ ResolutionOutcome (JSONB):   │
   │  └── evidence-xyz.png    │ ────────────────────────────│
   │                          │ - outcome                    │
   ▼                          │ - details                    │
   File                        │ - executedAt                │
   References                  │ - transactionHash           │
   Only                        │                              │
                              └──────────────────────────────┘
```

---

## State Machine Diagram

```
Entry Point: Split Exists
        │
        ▼
    ┌────────┐  
    │  OPEN  │  ◄─────────────────────┐
    └────┬───┘                        │
         │                            │
         │ moveToEvidenceCollection() │
         │ (automatic or on demand)   │
         │                            │
         ▼                            │
┌─────────────────────┐              │
│ EVIDENCE_COLLECTION │              │ (appeal restart)
│                     │              │
│ - addEvidence()     │              │
│ - addEvidence()     │              │
│ - ...more evidence  │              │
│ - submitForReview() │              │
└────────┬────────────┘              │
         │                           │
         ▼                           │
┌─────────────────────┐          ┌───┴───────────┐
│   UNDER_REVIEW      │          │  APPEALED     │
│                     │          │               │
│ - reviewEvidence()  │          │ - Re-review   │
│ - requestMore...()  │          │ - (5+ days)   │
│ - resolve()   ─────┐│          │               │
│ - reject()    ──┐  ││          └───────┬───────┘
└─────────────────┼──┼┤                  │
                  │  ││          ┌───────▼─┐
       ┌──────────┘  ││          │ New     │
       │             ││ (appeal  │ Review  │
       │             ││  within  │ Cycle   │
       │             ││  30 days)│         │
       │             │└──────────┘         │
       │             │                    │
       ▼             ▼                    │
    ┌────────┐  ┌────────┐               │
    │RESOLVED│  │REJECTED│               │
    └────┬───┘  └────┬───┘               │
         │           │                   │
         │ Can       │ Can               │
         │ Appeal    │ Appeal            │
         │           │                   │
         └───────┬───┴───────────────────┘
                 │
                 ▼
  Split Unfrozen & Operations Resume
       (or financial adjustments made)
```

---

## Transaction Flow - Dispute Creation

```
User Request
    │
    ▼
DisputesController.fileDispute()
    │
    └─► DisputesService.fileDispute()
        │
        ├─► dataSource.createQueryRunner()
        │
        ├─► queryRunner.startTransaction()
        │
        ├─► queryRunner.manager.findOne(Split)
        │   - Validate split exists
        │   - Check no active dispute
        │
        ├─► queryRunner.manager.create(Dispute)
        │   - Set status = OPEN
        │   - Add initial audit trail entry
        │
        ├─► queryRunner.manager.save(Dispute)
        │
        ├─► queryRunner.manager.update(Split)
        │   - Set isFrozen = true
        │
        ├─► queryRunner.commitTransaction()
        │   ✅ Both operations committed atomically
        │
        │   IF ERROR:
        │   queryRunner.rollbackTransaction()
        │   ❌ Both rolled back, consistent state
        │
        ├─► queryRunner.release()
        │
        └─► eventEmitter.emit('dispute.created')
            └─► Async listener processes
                ├─► dispute-notification.listener
                │   └─► Queue email notifications
                └─► dispute-audit.listener
                    └─► Log to audit service

Response sent to client immediately
Event listeners process asynchronously
```

---

## Transaction Flow - Dispute Resolution

```
Admin Request
    │
    ▼
DisputesController.resolveDispute()
    │
    └─► DisputesService.resolveDispute()
        │
        ├─► dataSource.createQueryRunner()
        │
        ├─► queryRunner.startTransaction()
        │
        ├─► queryRunner.manager.findOne(Dispute)
        │   - Get dispute details
        │
        ├─► DisputeStateMachine.validateTransition()
        │   - UNDER_REVIEW → RESOLVED valid?
        │
        ├─► queryRunner.manager.findOne(Split)
        │   - Validate split exists
        │
        ├─► queryRunner.manager.save(Dispute)
        │   - Set status = RESOLVED
        │   - Set resolution text
        │   - Set resolvedBy, resolvedAt
        │   - Set resolutionOutcome with details
        │   - Add audit trail entry
        │
        ├─► queryRunner.manager.update(Split)
        │   - Set isFrozen = false
        │
        ├─► [OPTIONAL: PaymentService integration]
        │   - If outcome = 'adjust_balances'
        │   - Create ledger entry for credit
        │   - Update participant balances
        │   ✅ All in same transaction
        │
        ├─► queryRunner.commitTransaction()
        │   ✅ All operations committed atomically
        │
        │   IF ERROR AT ANY STEP:
        │   queryRunner.rollbackTransaction()
        │   ❌ Entire resolution rolled back
        │   ❌ Split remains frozen
        │   ❌ Financial ledger unchanged
        │
        ├─► queryRunner.release()
        │
        ├─► eventEmitter.emit('dispute.resolved')
        │   └─► Listeners queue notifications
        │
        └─► eventEmitter.emit('split.unfrozen')
            └─► Audit logging

After Success:
- Split unfrozen (can accept payments)
- Financial adjustments applied
- Participants notified asynchronously
- Full audit trail recorded
- System consistent
```

---

## Module Dependencies

```
DisputesModule
    │
    ├─ Imports:
    │  ├─ TypeOrmModule.forFeature([Dispute, DisputeEvidence, Split])
    │  └─ EventEmitterModule
    │
    ├─ Provides:
    │  ├─ DisputesService
    │  │  └─ Depends on:
    │  │     ├─ DisputeRepository
    │  │     ├─ DisputeEvidenceRepository
    │  │     ├─ SplitRepository
    │  │     ├─ DataSource (for transactions)
    │  │     └─ EventEmitter2
    │  │
    │  ├─ DisputesController
    │  │  └─ Depends on: DisputesService
    │  │
    │  ├─ DisputeNotificationListener
    │  │  └─ Listens to: dispute.* events
    │  │
    │  └─ DisputeAuditListener
    │     └─ Listens to: dispute.* and split.* events
    │
    ├─ Exports: DisputesService
    │
    └─ Used By:
       ├─ AppModule (root)
       ├─ PaymentsModule (to check split frozen)
       ├─ (Future) Admin Dashboard Module
       └─ (Future) Notifications Module
```

---

## Error Handling Flow

```
API Request
    │
    ▼
DisputesController (DTOs validate)
    │
    ├─ Validation Error (400)
    │  └─► ValidationException
    │
    ▼
DisputesService
    │
    ├─ Split not found (404)
    │  └─► NotFoundException
    │
    ├─ Active dispute exists (409)
    │  └─► ConflictException
    │
    ├─ Invalid state transition (400)
    │  └─► BadRequestException
    │     (via DisputeStateMachine.validateTransition)
    │
    ├─ Evidence not allowed in this status (400)
    │  └─► BadRequestException
    │
    ├─ Appeal window expired (400)
    │  └─► BadRequestException
    │
    ├─ Non-creator trying to appeal (403)
    │  └─► ForbiddenException
    │
    ├─ Database error (500)
    │  └─► QueryFailedError
    │  └─► Automatic rollback via queryRunner
    │
    └─ Unexpected error (500)
       └─► InternalServerErrorException

All Errors:
- Logged with full context
- Audit trail updated on user action errors
- Transaction rolled back on DB errors
- Error response with helpful message
```

---

## Scaling Considerations

### Database Optimization
- ✅ Indices on: (splitId, status), raisedBy, createdAt
- ✅ Pagination on admin list queries (min 20, max 100)
- ✅ JSONB for flexible audit trail (indexable via GIN)
- ✅ Soft deletes preserve history

### Performance
- ✅ Async event listeners (non-blocking)
- ✅ Queue-based notifications (Bull/Redis)
- ✅ Connection pooling (DataSource)
- ✅ Read replicas for audit trail queries

### Concurrency
- ✅ Optimistic locking via Dispute.updatedAt
- ✅ Transactions for critical operations
- ✅ No N+1 queries (use relations)
- ✅ Stateless service (scalable horizontally)

### Load Balancing
- ✅ Stateless design allows multiple instances
- ✅ Shared database (PostgreSQL)
- ✅ Shared event emitter (Redis)
- ✅ Shared queue (Redis)

---

## Security Architecture

```
┌──────────────────────────────────────────────────────┐
│            Authentication Layer                      │
│  JWT Token → Extract from Authorization header      │
│  Verify signature, expiration, issuer               │
└──────────┬───────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────┐
│           Authorization Layer                        │
│  Route-level Role Guards (@Roles decorator)         │
│  - Public endpoints: /disputes/:id                   │
│  - Admin only: /disputes/:id/resolve                 │
│  - Participant: /disputes/:id/appeal                 │
└──────────┬───────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────┐
│          Business Logic Validation                   │
│  - State machine prevents invalid transitions        │
│  - Party verification for appeals                    │
│  - Ownership checks for evidence upload              │
└──────────┬───────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────┐
│         Data Layer Protection                        │
│  - SQL parameterization (TypeORM)                    │
│  - Transactions prevent inconsistency                │
│  - Soft deletes preserve compliance data             │
│  - Audit trail immutable (JSONB append-only)         │
└──────────────────────────────────────────────────────┘
```

---

## Monitoring & Observability

```
DisputesService
    │
    ├─ Logger.log() - Info level
    │  └─► "Dispute 123 created for split 456"
    │
    ├─ Logger.debug() - Debug level
    │  └─► "State transition: OPEN → EVIDENCE_COLLECTION"
    │
    ├─ Logger.error() - Error level
    │  └─► "Failed to resolve dispute: DB connection"
    │
    └─ Events emit
       ├─ DisputeCreatedEvent
       ├─ DisputeResolvedEvent
       ├─ SplitFrozenEvent
       └─► Can be subscribed by monitoring system

Metrics to Track:
- Disputes created per day/hour
- Average resolution time
- Approval rate (resolved vs rejected)
- Appeal rate
- Most common dispute types
- Split freeze duration

Alerts:
- Disputes stuck in under_review > 7 days
- High appeal rate (> 20%)
- Job queue size (backlog)
- Database connection pool exhaustion
```

---

## Deployment Checklist

- [ ] Environment variables configured
- [ ] Database migration applied
- [ ] DisputesModule imported in AppModule
- [ ] Auth guards implemented on admin endpoints
- [ ] Notification queue (Bull) configured
- [ ] Email service integration completed
- [ ] File storage (S3/Azure) configured and tested
- [ ] Feature flags for gradual rollout
- [ ] Monitoring and logging setup
- [ ] Documentation reviewed with team
- [ ] Load testing with realistic data volume
- [ ] Backup and recovery procedures tested
- [ ] Audit logging to compliance system configured
