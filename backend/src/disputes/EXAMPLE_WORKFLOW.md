# Dispute Resolution System - Example Workflow

This document provides a complete walkthrough of a real-world dispute scenario with actual API calls and responses.

---

## Scenario: Alice's Overpayment Dispute

**Setup:**
- **Split ID:** `550e8400-e29b-41d4-a716-446655440000`
- **Participants:**
  - Alice (creator, Stellar address: `GAAAA...`)
  - Bob (Stellar address: `GBBBB...`)
  - Carol (Stellar address: `GCCCC...`)
- **Amount:** $100 total
- **Issue:** Alice claims she was charged $125 instead of split amount

---

## Step 1: Alice Files a Dispute

### Request
```bash
POST /disputes
Content-Type: application/json
Authorization: Bearer <alice-jwt-token>

{
  "splitId": "550e8400-e29b-41d4-a716-446655440000",
  "disputeType": "incorrect_amount",
  "description": "I was charged $125 for my share, but according to the split agreement, it should be $100. The itemized breakdown shows I should only owe $100."
}
```

### Response (201 Created)
```json
{
  "id": "dispute-1234-5678",
  "splitId": "550e8400-e29b-41d4-a716-446655440000",
  "raisedBy": "GAAAA...",
  "disputeType": "incorrect_amount",
  "description": "I was charged $125 for my share...",
  "status": "open",
  "evidence": [],
  "resolution": null,
  "resolvedBy": null,
  "resolvedAt": null,
  "resolutionOutcome": null,
  "splitFrozen": true,
  "auditTrail": [
    {
      "action": "dispute_created",
      "performedBy": "GAAAA...",
      "performedAt": "2024-02-20T10:30:00Z",
      "details": {
        "type": "incorrect_amount",
        "description": "I was charged $125 for my share..."
      }
    }
  ],
  "createdAt": "2024-02-20T10:30:00Z",
  "updatedAt": "2024-02-20T10:30:00Z"
}
```

### Events Emitted
- ✅ `dispute.created` → Notifies all split participants
- ✅ `split.frozen` → Audit trail: Split locked until resolution

### What Happens Now
- Split enters **FROZEN** state
- Bob and Carol cannot make new payments
- Bob and Carol receive notifications about the dispute
- Admin dashboard shows new dispute in queue

---

## Step 2: Alice Uploads Evidence

### Request
```bash
POST /disputes/dispute-1234-5678/evidence
Content-Type: application/json
Authorization: Bearer <alice-jwt-token>

{
  "fileKey": "s3://stellarsplit-evidence/dispute-1234-5678/invoice-original.pdf",
  "fileName": "invoice-original.pdf",
  "mimeType": "application/pdf",
  "size": 125440,
  "description": "Original invoice showing $100 amount agreed upon"
}
```

### Response (201 Created)
```json
{
  "id": "evidence-1111-2222",
  "disputeId": "dispute-1234-5678",
  "uploadedBy": "GAAAA...",
  "fileKey": "s3://stellarsplit-evidence/dispute-1234-5678/invoice-original.pdf",
  "fileName": "invoice-original.pdf",
  "mimeType": "application/pdf",
  "size": 125440,
  "description": "Original invoice showing $100 amount agreed upon",
  "metadata": {
    "originalName": "invoice.pdf",
    "uploadedFrom": "Web App v3.2",
    "ipAddress": "203.0.113.42"
  },
  "createdAt": "2024-02-20T10:35:00Z"
}
```

### Further Evidence Upload

```bash
POST /disputes/dispute-1234-5678/evidence
Content-Type: application/json
Authorization: Bearer <alice-jwt-token>

{
  "fileKey": "s3://stellarsplit-evidence/dispute-1234-5678/receipt-payment.jpg",
  "fileName": "receipt-payment.jpg",
  "mimeType": "image/jpeg",
  "size": 2048,
  "description": "Payment receipt showing $125 charged instead of $100"
}
```

### Response (201 Created)
```json
{
  "id": "evidence-3333-4444",
  "disputeId": "dispute-1234-5678",
  "uploadedBy": "GAAAA...",
  "fileKey": "s3://stellarsplit-evidence/dispute-1234-5678/receipt-payment.jpg",
  "fileName": "receipt-payment.jpg",
  "mimeType": "image/jpeg",
  "size": 2048,
  "description": "Payment receipt showing $125 charged instead of $100",
  "createdAt": "2024-02-20T10:40:00Z"
}
```

### Events Emitted
- ✅ `dispute.evidence_added` → Notifies admins of new evidence

### Query Evidence

```bash
GET /disputes/dispute-1234-5678/evidence
```

### Response (200 OK)
```json
[
  {
    "id": "evidence-3333-4444",
    "disputeId": "dispute-1234-5678",
    "uploadedBy": "GAAAA...",
    "fileName": "receipt-payment.jpg",
    "mimeType": "image/jpeg",
    "size": 2048,
    "createdAt": "2024-02-20T10:40:00Z"
  },
  {
    "id": "evidence-1111-2222",
    "disputeId": "dispute-1234-5678",
    "uploadedBy": "GAAAA...",
    "fileName": "invoice-original.pdf",
    "mimeType": "application/pdf",
    "size": 125440,
    "createdAt": "2024-02-20T10:35:00Z"
  }
]
```

---

## Step 3: Alice Submits for Review

Alice is ready for the dispute to be reviewed by admins.

### Request
```bash
POST /disputes/dispute-1234-5678/submit-review
Content-Type: application/json
Authorization: Bearer <alice-jwt-token>

{}
```

### Response (200 OK)
```json
{
  "id": "dispute-1234-5678",
  "status": "under_review",
  "evidence": [
    {
      "id": "evidence-1111-2222",
      "uploadedBy": "GAAAA...",
      "uploadedAt": "2024-02-20T10:35:00Z",
      "fileKey": "s3://...",
      "fileName": "invoice-original.pdf",
      "mimeType": "application/pdf",
      "size": 125440
    },
    {
      "id": "evidence-3333-4444",
      "uploadedBy": "GAAAA...",
      "uploadedAt": "2024-02-20T10:40:00Z",
      "fileKey": "s3://...",
      "fileName": "receipt-payment.jpg",
      "mimeType": "image/jpeg",
      "size": 2048
    }
  ],
  "auditTrail": [
    {
      "action": "dispute_created",
      "performedBy": "GAAAA...",
      "performedAt": "2024-02-20T10:30:00Z",
      "details": {...}
    },
    {
      "action": "evidence_added",
      "performedBy": "GAAAA...",
      "performedAt": "2024-02-20T10:35:00Z",
      "details": {
        "evidenceId": "evidence-1111-2222",
        "fileName": "invoice-original.pdf"
      }
    },
    {
      "action": "evidence_added",
      "performedBy": "GAAAA...",
      "performedAt": "2024-02-20T10:40:00Z",
      "details": {
        "evidenceId": "evidence-3333-4444",
        "fileName": "receipt-payment.jpg"
      }
    },
    {
      "action": "submitted_for_review",
      "performedBy": "GAAAA...",
      "performedAt": "2024-02-20T11:00:00Z",
      "details": {
        "evidenceCount": 2
      }
    }
  ]
}
```

### Events Emitted
- ✅ `dispute.under_review` → Notifies admin queue for review

### What Happens Now
- Dispute status: **UNDER_REVIEW**
- Admin dashboard shows dispute ready for review
- Split remains **FROZEN**

---

## Step 4: Admin Reviews Dispute

### Get Dispute Details

The admin reviews the full dispute with all evidence and audit trail.

```bash
GET /disputes/dispute-1234-5678
Authorization: Bearer <admin-jwt-token>
```

### Response (200 OK)
```json
{
  "id": "dispute-1234-5678",
  "splitId": "550e8400-e29b-41d4-a716-446655440000",
  "raisedBy": "GAAAA...",
  "disputeType": "incorrect_amount",
  "description": "I was charged $125 for my share...",
  "status": "under_review",
  "evidence": [
    {
      "id": "evidence-1111-2222",
      "uploadedBy": "GAAAA...",
      "uploadedAt": "2024-02-20T10:35:00Z",
      "fileKey": "s3://stellarsplit-evidence/dispute-1234-5678/invoice-original.pdf",
      "fileName": "invoice-original.pdf",
      "size": 125440
    },
    {
      "id": "evidence-3333-4444",
      "uploadedBy": "GAAAA...",
      "uploadedAt": "2024-02-20T10:40:00Z",
      "fileKey": "s3://stellarsplit-evidence/dispute-1234-5678/receipt-payment.jpg",
      "fileName": "receipt-payment.jpg",
      "size": 2048
    }
  ],
  "splitFrozen": true,
  "auditTrail": [
    // ... full timeline of actions
  ]
}
```

### Request More Evidence (if needed)

```bash
POST /disputes/dispute-1234-5678/request-evidence
Content-Type: application/json
Authorization: Bearer <admin-jwt-token>

{
  "evidenceRequest": "Please provide the transaction record from your payment processor showing the $125 charge. Include any communication with the payment gateway confirming the amounts."
}
```

### Response (200 OK)
```json
{
  "id": "dispute-1234-5678",
  "status": "under_review"
  // Evidence request logged in system
}
```

### Events Emitted
- ✅ `dispute.more_evidence_requested` → Notifies Alice

---

## Step 5: Admin Resolves Dispute

After reviewing the evidence, admin confirms the overpayment and resolves in Alice's favor.

### Request
```bash
POST /disputes/dispute-1234-5678/resolve
Content-Type: application/json
Authorization: Bearer <admin-jwt-token>

{
  "outcome": "adjust_balances",
  "resolution": "Evidence verifies overpayment. Payment processor charged $125 instead of agreed $100. Participant will receive $25 credit to be applied to future splits or refunded.",
  "details": {
    "creditAmount": 25,
    "currency": "XLM",
    "recipientWallet": "GAAAA...",
    "reason": "Overpayment correction",
    "transactionReference": "TXN-20240220-98765"
  }
}
```

### Response (200 OK)
```json
{
  "id": "dispute-1234-5678",
  "splitId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "resolved",
  "resolution": "Evidence verifies overpayment...",
  "resolvedBy": "<admin-wallet-address>",
  "resolvedAt": "2024-02-20T14:30:00Z",
  "resolutionOutcome": {
    "outcome": "adjust_balances",
    "details": {
      "creditAmount": 25,
      "currency": "XLM",
      "recipientWallet": "GAAAA...",
      "reason": "Overpayment correction"
    },
    "executedAt": "2024-02-20T14:30:00Z"
  },
  "splitFrozen": false,
  "auditTrail": [
    // ... all previous entries plus:
    {
      "action": "dispute_resolved",
      "performedBy": "<admin-wallet>",
      "performedAt": "2024-02-20T14:30:00Z",
      "details": {
        "outcome": "adjust_balances",
        "resolution": "Evidence verifies overpayment..."
      }
    }
  ]
}
```

### Events Emitted
- ✅ `dispute.resolved` → Notifies all participants
- ✅ `split.unfrozen` → Removes freeze, enables new operations

### What Happens Now
- Split is **UNFROZEN**
- Alice receives $25 credit
- Bob and Carol can resume making payments
- All participants get notification with resolution details

---

## Step 6: Viewing Audit Trail

Anyone can view the complete audit trail for compliance.

### Request
```bash
GET /disputes/dispute-1234-5678/audit-trail
```

### Response (200 OK)
```json
[
  {
    "action": "dispute_created",
    "performedBy": "GAAAA...",
    "performedAt": "2024-02-20T10:30:00Z",
    "details": {
      "type": "incorrect_amount",
      "description": "I was charged $125 for my share..."
    }
  },
  {
    "action": "evidence_added",
    "performedBy": "GAAAA...",
    "performedAt": "2024-02-20T10:35:00Z",
    "details": {
      "evidenceId": "evidence-1111-2222",
      "fileName": "invoice-original.pdf",
      "size": 125440
    }
  },
  {
    "action": "evidence_added",
    "performedBy": "GAAAA...",
    "performedAt": "2024-02-20T10:40:00Z",
    "details": {
      "evidenceId": "evidence-3333-4444",
      "fileName": "receipt-payment.jpg",
      "size": 2048
    }
  },
  {
    "action": "submitted_for_review",
    "performedBy": "GAAAA...",
    "performedAt": "2024-02-20T11:00:00Z",
    "details": {
      "evidenceCount": 2
    }
  },
  {
    "action": "dispute_resolved",
    "performedBy": "GAdmin01...",
    "performedAt": "2024-02-20T14:30:00Z",
    "details": {
      "outcome": "adjust_balances",
      "resolution": "Evidence verifies overpayment..."
    }
  }
]
```

---

## Scenario 2: Appeal Process

Suppose Alice receives the resolution but disagrees with the decision (hypothetical).

### Request
```bash
POST /disputes/dispute-1234-5678/appeal
Content-Type: application/json
Authorization: Bearer <alice-jwt-token>

{
  "appealReason": "The admin decision ignored critical evidence showing the payment processor explicitly acknowledged the overpayment in their support ticket. This decision was made without proper review of all evidence."
}
```

### Response (200 OK)
```json
{
  "id": "dispute-1234-5678",
  "status": "appealed",
  "splitFrozen": true,
  "appealReason": "The admin decision ignored critical evidence...",
  "appealedAt": "2024-02-20T15:45:00Z",
  "auditTrail": [
    // ... all previous entries plus:
    {
      "action": "dispute_appealed",
      "performedBy": "GAAAA...",
      "performedAt": "2024-02-20T15:45:00Z",
      "details": {
        "appealReason": "The admin decision ignored critical evidence..."
      }
    }
  ]
}
```

### What Happens Now
- Dispute returns to **UNDER_REVIEW**
- Split is **RE-FROZEN**
- Different admin reviews the appeal
- Full evidence and original decision available

---

## Scenario 3: Rejection (Alternative Path)

If evidence was insufficient, admin might reject the dispute instead.

### Request
```bash
POST /disputes/dispute-1234-5678/reject
Content-Type: application/json
Authorization: Bearer <admin-jwt-token>

{
  "reason": "Evidence provided does not substantiate the claim. The invoice attachment predates the split agreement by 3 months and does not correspond to the current transaction. Claim dismissed."
}
```

### Response (200 OK)
```json
{
  "id": "dispute-1234-5678",
  "status": "rejected",
  "resolution": "Evidence provided does not substantiate...",
  "resolvedBy": "<admin-wallet>",
  "resolvedAt": "2024-02-20T14:30:00Z",
  "splitFrozen": false,
  "auditTrail": [
    // ... all entries plus:
    {
      "action": "dispute_rejected",
      "performedBy": "<admin-wallet>",
      "performedAt": "2024-02-20T14:30:00Z",
      "details": {
        "reason": "Evidence provided does not substantiate..."
      }
    }
  ]
}
```

### What Happens Now
- Dispute status: **REJECTED**
- Split is **UNFROZEN**
- Alice can appeal within 30 days
- No financial adjustments made

---

## Admin Dashboard - List Disputes

Admin can view all disputes with filters.

### Request
```bash
GET /disputes?status=under_review&page=1&limit=20&sortBy=createdAt&sortOrder=DESC
Authorization: Bearer <admin-jwt-token>
```

### Response (200 OK)
```json
{
  "disputes": [
    {
      "id": "dispute-1234-5678",
      "splitId": "550e8400-e29b-41d4-a716-446655440000",
      "raisedBy": "GAAAA...",
      "disputeType": "incorrect_amount",
      "status": "under_review",
      "createdAt": "2024-02-20T10:30:00Z",
      "updatedAt": "2024-02-20T11:00:00Z"
    },
    {
      "id": "dispute-9999-8888",
      "splitId": "550e8400-xxxx-xxxx-xxxx-446655440111",
      "raisedBy": "GBBBB...",
      "disputeType": "missing_payment",
      "status": "under_review",
      "createdAt": "2024-02-20T09:15:00Z",
      "updatedAt": "2024-02-20T10:00:00Z"
    }
  ],
  "total": 45
}
```

---

## Notifications Sent Throughout Lifecycle

### 1. Dispute Created
**Recipients:** All split participants, Admins
```
Subject: Dispute filed for your split
Body: Alice has filed an "incorrect_amount" dispute for the split dated Feb 20. 
View details: https://app.com/disputes/dispute-1234-5678
```

### 2. Evidence Added
**Recipients:** Admin/Reviewers
```
Subject: New evidence submitted - Dispute dispute-1234-5678
Body: Alice added evidence: receipt-payment.jpg (2 KB)
Review: https://app.com/admin/disputes/dispute-1234-5678
```

### 3. Submitted for Review
**Recipients:** Admin queue
```
Subject: Dispute ready for admin review - dispute-1234-5678
Body: Alice submitted the dispute with 2 evidence items.
Evidence count: 2 files totaling 127 KB
Review: https://app.com/admin/disputes/dispute-1234-5678
```

### 4. Dispute Resolved
**Recipients:** All participants
```
Subject: Dispute resolved - dispute-1234-5678
Body: Admin resolved the dispute in favor of Alice.
Outcome: Adjust balances - $25 credit
New split status: Active
```

### 5. Appeal Received
**Recipients:** Admin queue
```
Subject: Dispute appealed - dispute-1234-5678
Body: Alice appealed the resolution - new review required.
Appeal reason: The admin decision ignored critical evidence...
Review: https://app.com/admin/disputes/dispute-1234-5678
```

---

## Database State Timeline

### After Step 1: Dispute Created
```sql
-- disputes table
INSERT INTO disputes (id, splitId, raisedBy, disputeType, description, status, splitFrozen, createdAt)
VALUES ('dispute-1234-5678', '550e8400-...', 'GAAAA...', 'incorrect_amount', '...', 'open', true, NOW());

-- splits table
UPDATE splits SET isFrozen = true WHERE id = '550e8400-...';
```

### After Step 5: Dispute Resolved
```sql
-- disputes table
UPDATE disputes 
SET status = 'resolved', 
    resolution = '...', 
    resolvedBy = 'GAdmin01...', 
    resolvedAt = NOW(), 
    resolutionOutcome = '{"outcome": "adjust_balances", ...}'::jsonb
WHERE id = 'dispute-1234-5678';

-- splits table
UPDATE splits SET isFrozen = false WHERE id = '550e8400-...';

-- Financial ledger (application layer)
INSERT INTO ledger_entries (participantId, splitId, amount, type, reason)
VALUES ('alice-participant-id', '550e8400-...', 25, 'credit', 'Dispute resolution - overpayment correction');
```

---

## Key Takeaways

1. **Dispute Creation is Atomic** - Split freeze happens in same transaction
2. **Full Audit Trail** - Every action is recorded with timestamps and details
3. **State Machine Validation** - Invalid transitions are prevented
4. **Event-Driven Process** - Notifications sent asynchronously
5. **Financial Consistency** - Resolution and unfreezing atomic
6. **Appeal Rights** - 30-day window for participants to challenge
7. **Admin Control** - Only admins can resolve/reject
8. **Evidence Management** - File references stored, not binary data
9. **Compliance-Ready** - Full audit trail for legal/regulatory needs
10. **User Experience** - Clear notifications at each step
