# Dispute Resolution System - Quick Reference Guide

## Installation & Setup

### 1. Run Migration
```bash
cd backend
npm run typeorm migration:run
```

### 2. Add to Environment
```env
# .env
DB_HOST=localhost
DB_PORT=5432
DB_USER=stellarsplit
DB_PASSWORD=***
DB_NAME=splitdb
REDIS_HOST=localhost
REDIS_PORT=6379
AWS_S3_BUCKET=stellarsplit-evidence
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=***
AWS_SECRET_ACCESS_KEY=***
```

### 3. Import Module (Already Done ✅)
```typescript
// src/app.module.ts
import { DisputesModule } from './disputes/disputes.module';

@Module({
  imports: [
    // ...
    DisputesModule,
  ],
})
export class AppModule {}
```

---

## API Quick Reference

### File Dispute
```bash
curl -X POST http://localhost:3000/disputes \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "splitId": "550e8400-e29b-41d4-a716-446655440000",
    "disputeType": "incorrect_amount",
    "description": "Charged $125 instead of $100"
  }'
```

### Upload Evidence
```bash
curl -X POST http://localhost:3000/disputes/dispute-id/evidence \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "fileKey": "s3://bucket/receipt.jpg",
    "fileName": "receipt.jpg",
    "mimeType": "image/jpeg",
    "size": 2048,
    "description": "Receipt showing charge"
  }'
```

### Submit for Review
```bash
curl -X POST http://localhost:3000/disputes/dispute-id/submit-review \
  -H "Authorization: Bearer <token>"
```

### Admin Resolve
```bash
curl -X POST http://localhost:3000/disputes/dispute-id/resolve \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "outcome": "adjust_balances",
    "resolution": "Overpayment confirmed. $25 credit applied.",
    "details": {
      "creditAmount": 25,
      "currency": "XLM"
    }
  }'
```

### Admin Reject
```bash
curl -X POST http://localhost:3000/disputes/dispute-id/reject \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Insufficient evidence provided"
  }'
```

### Appeal
```bash
curl -X POST http://localhost:3000/disputes/dispute-id/appeal \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "appealReason": "Resolution was unfair"
  }'
```

### Get Dispute
```bash
curl http://localhost:3000/disputes/dispute-id \
  -H "Authorization: Bearer <token>"
```

### Get Audit Trail
```bash
curl http://localhost:3000/disputes/dispute-id/audit-trail \
  -H "Authorization: Bearer <token>"
```

### List Disputes (Admin)
```bash
curl "http://localhost:3000/disputes?status=under_review&page=1&limit=20" \
  -H "Authorization: Bearer <admin-token>"
```

---

## Common Code Patterns

### Inject DisputesService
```typescript
import { DisputesService } from './disputes/disputes.service';

@Injectable()
export class MyService {
  constructor(private disputesService: DisputesService) {}

  async checkDispute(splitId: string) {
    const disputes = await this.disputesService.getDisputesBySplit(splitId);
    return disputes.length > 0;
  }
}
```

### Check Split Status Before Payment
```typescript
// In PaymentsService
async createPayment(dto: CreatePaymentDto) {
  const split = await this.splitRepository.findOne(dto.splitId);
  
  if (split.isFrozen) {
    throw new BadRequestException(
      'Cannot create payment: split is frozen due to active dispute'
    );
  }
  
  // ... continue with payment
}
```

### Listen to Dispute Events
```typescript
import { OnEvent } from '@nestjs/event-emitter';
import { DisputeCreatedEvent } from './disputes/dispute.events';

@Injectable()
export class MyListener {
  @OnEvent('dispute.created')
  async handleDisputeCreated(event: DisputeCreatedEvent) {
    console.log(`Dispute created: ${event.dispute.id}`);
    // Handle custom logic
  }
}
```

### Query Disputes with Filters
```typescript
const { disputes, total } = await this.disputesService.adminListDisputes({
  status: DisputeStatus.UNDER_REVIEW,
  page: 1,
  limit: 20,
  sortBy: 'createdAt',
  sortOrder: 'DESC',
});
```

---

## Testing

### Run Unit Tests
```bash
npm test -- disputes.service.spec.ts
```

### Run Integration Tests
```bash
npm test -- disputes.integration.spec.ts
```

### Run All Dispute Tests
```bash
npm test src/disputes/
```

### Debug Tests
```bash
node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand
```

---

## Troubleshooting

### Split Frozen After Dispute Resolution
**Problem:** Split still frozen after admin resolution
```typescript
// Check dispute status
const dispute = await disputesService.getDisputeById(disputeId);
console.log(dispute.status); // Should be 'resolved'
console.log(dispute.splitFrozen); // Should be false in DB

// Check split status
const split = await splitRepository.findOne(dispute.splitId);
console.log(split.isFrozen); // Should be false
```

**Solution:** If mismatch, manually unfreeze:
```typescript
await splitRepository.update(splitId, { isFrozen: false });
```

### Evidence Upload Not Appearing
**Problem:** Evidence uploaded but not visible
```typescript
// Verify dispute status allows evidence
const dispute = await disputesService.getDisputeById(disputeId);
const allowed = DisputeStateMachine.allowsEvidenceSubmission(dispute.status);
console.log(allowed); // Should be true
```

**Solution:** Move dispute to correct status first:
```typescript
if (dispute.status === DisputeStatus.OPEN) {
  await disputesService.moveToEvidenceCollection(disputeId, adminWallet);
}
```

### Appeal Failed - Window Expired
**Problem:** Cannot appeal after resolution
```typescript
const daysSincResolution = Math.floor(
  (Date.now() - dispute.resolvedAt.getTime()) / (1000 * 60 * 60 * 24)
);
console.log(daysSincResolution); // If > 30, appeal expired
```

**Solution:** Appeal window is 30 days from resolution, cannot extend

### State Transition Error
**Problem:** "Invalid dispute status transition"
```typescript
// Check current status and valid transitions
const currentStatus = dispute.status;
const validTransitions = DisputeStateMachine.getValidNextStates(currentStatus);
console.log(`From ${currentStatus}, can go to:`, validTransitions);
```

**Solution:** Follow the state machine path:
```
OPEN → EVIDENCE_COLLECTION → UNDER_REVIEW → RESOLVED/REJECTED → APPEALED
```

### Transaction Rollback
**Problem:** Dispute created but split not frozen
```typescript
// If creation failed midway, DB is inconsistent
// Solution: Delete orphaned dispute manually or retry creation
const dispute = await disputeRepository.findOne(disputeId);
const split = await splitRepository.findOne(dispute.splitId);

if (dispute.splitFrozen === false && split.isFrozen === false) {
  // Both should match after atomic operation
  console.error('Inconsistent state - transaction failed');
}
```

---

## Database Queries

### Check Active Disputes
```sql
SELECT id, splitId, status, createdAt 
FROM disputes 
WHERE status IN ('open', 'evidence_collection', 'under_review')
ORDER BY createdAt DESC;
```

### Find Frozen Splits
```sql
SELECT s.id, s.status, COUNT(d.id) as dispute_count
FROM splits s
LEFT JOIN disputes d ON s.id = d.splitId
WHERE s.isFrozen = true
GROUP BY s.id;
```

### Dispute Statistics
```sql
SELECT 
  status,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (resolvedAt - createdAt))) / 3600 as avg_hours_to_resolve
FROM disputes
GROUP BY status;
```

### Evidence Uploaded Per Dispute
```sql
SELECT 
  d.id, 
  d.splitId,
  COUNT(de.id) as evidence_count,
  SUM(de.size) / 1024 / 1024 as total_size_mb
FROM disputes d
LEFT JOIN dispute_evidence de ON d.id = de.disputeId
GROUP BY d.id, d.splitId
ORDER BY evidence_count DESC;
```

### Audit Trail for Dispute
```sql
SELECT 
  id,
  status,
  auditTrail
FROM disputes
WHERE id = 'dispute-id-here';

-- Then in application, parse JSONB auditTrail array
```

---

## Event Listeners Setup

### Custom Notification Listener
```typescript
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DisputeCreatedEvent } from './dispute.events';

@Injectable()
export class CustomDisputeListener {
  @OnEvent('dispute.created')
  async handleDisputeCreated(event: DisputeCreatedEvent) {
    // Custom logic: send Slack notification, trigger webhook, etc.
    console.log(`Custom: Dispute ${event.dispute.id} created`);
  }
}
```

### Register in Module
```typescript
@Module({
  providers: [
    DisputesService,
    DisputeNotificationListener,
    DisputeAuditListener,
    CustomDisputeListener,  // Add here
  ],
})
export class DisputesModule {}
```

---

## Performance Optimization

### Add Caching (Redis)
```typescript
@Get('disputes/:splitId')
@CacheKey('disputes_' + splitId)
@CacheTTL(300) // 5 minutes
async getDisputesBySplit(@Param('splitId') splitId: string) {
  return this.disputesService.getDisputesBySplit(splitId);
}
```

### Batch Operations
```typescript
// Don't do this (N queries):
for (const splitId of splitIds) {
  await this.disputesService.getDisputesBySplit(splitId);
}

// Do this (1 query):
const disputes = await this.disputeRepository.find({
  where: { splitId: In(splitIds) },
});
const byeSplitId = groupBy(disputes, d => d.splitId);
```

### Pagination
```typescript
@Get('disputes')
async listDisputes(
  @Query('page', ParseIntPipe) page = 1,
  @Query('limit', ParseIntPipe) limit = 20,
) {
  return this.disputesService.adminListDisputes({
    page: Math.max(page, 1),
    limit: Math.min(limit, 100),
  });
}
```

---

## Integration Checklist

- [ ] **Auth Guards Setup**
  - [ ] JWT validation on all endpoints
  - [ ] Admin role guard on `resolve`, `reject`, `request-evidence`
  - [ ] Creator check on `appeal`

- [ ] **Notification Queue**
  - [ ] Bull queue configured
  - [ ] Email service integrated
  - [ ] Listeners dispatch to queue

- [ ] **File Storage**
  - [ ] S3 or Azure Blob configured
  - [ ] Upload endpoint created
  - [ ] File cleanup job scheduled

- [ ] **Audit Logging**
  - [ ] Audit listener integrated with logging service
  - [ ] Compliance data exported regularly
  - [ ] Data retention policy enforced

- [ ] **Monitoring**
  - [ ] Dispute metrics dashboard
  - [ ] Alert rules configured
  - [ ] Performance monitoring active

- [ ] **Testing**
  - [ ] Unit tests passing
  - [ ] Integration tests passing
  - [ ] Load testing completed
  - [ ] Edge cases tested

---

## Useful Links

- **Full Documentation**: [README.md](README.md)
- **Example Workflow**: [EXAMPLE_WORKFLOW.md](EXAMPLE_WORKFLOW.md)
- **Architecture**: [ARCHITECTURE.md](ARCHITECTURE.md)
- **Implementation Details**: [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)

---

## Common Status Codes

| Status | Scenario |
|--------|----------|
| 201 | Dispute created, evidence uploaded |
| 200 | Dispute retrieved, action completed |
| 400 | Invalid state transition, validation error |
| 403 | Insufficient permissions (appeal by non-creator) |
| 404 | Dispute or split not found |
| 409 | Active dispute already exists for split |
| 500 | Database error, transaction rolled back |

---

## Key Imports

```typescript
// Main service
import { DisputesService } from './disputes/disputes.service';

// Entities
import { Dispute, DisputeStatus, DisputeType } from './entities/dispute.entity';
import { DisputeEvidence } from './entities/dispute-evidence.entity';

// DTOs
import { 
  FileDisputeDto, 
  AddEvidenceDto,
  ResolveDisputeDto,
  AppealDisputeDto 
} from './disputes/dto/dispute.dto';

// Events
import { DisputeCreatedEvent, DisputeResolvedEvent } from './disputes/dispute.events';

// State Machine
import { DisputeStateMachine } from './disputes/dispute.state-machine';

// Module
import { DisputesModule } from './disputes/disputes.module';
```

---

## Debugging Commands

### Check Dispute Status
```typescript
// In NestJS REPL or script
const dispute = await disputesService.getDisputeById('dispute-id');
console.log(JSON.stringify(dispute, null, 2));
```

### List All Active Disputes
```typescript
const { disputes } = await disputesService.adminListDisputes({
  status: DisputeStatus.UNDER_REVIEW,
  limit: 100,
});
console.log(`Total under review: ${disputes.length}`);
```

### Get Dispute Audit Trail
```typescript
const trail = await disputesService.getDisputeAuditTrail('dispute-id');
console.table(trail);
```

### Check Split Freeze Status
```typescript
const split = await splitRepository.findOne(splitId);
console.log(`Split ${splitId} frozen: ${split.isFrozen}`);
```

---

## Performance Tips

1. **Use Indices** - Already configured for (splitId, status)
2. **Limit Results** - Always paginate (max 100)
3. **Cache Frequently Accessed** - Dispute details with 5min TTL
4. **Batch Operations** - Use `In()` operator for multiple IDs
5. **Avoid N+1** - Use relations to load related data
6. **Async Events** - Listeners run non-blocking

---

## Security Reminders

1. ✅ Validate all inputs (DTOs)
2. ✅ Check auth before sensitive operations
3. ✅ Verify role for admin operations
4. ✅ Use SQL parameterization (TypeORM)
5. ✅ Audit trail immutable (JSONB append-only)
6. ✅ Soft delete preserves data
7. ✅ Transactions prevent corruption
8. ✅ Rate limit if exposed to public

---

$For questions or issues, refer to full documentation or review test files for examples.
