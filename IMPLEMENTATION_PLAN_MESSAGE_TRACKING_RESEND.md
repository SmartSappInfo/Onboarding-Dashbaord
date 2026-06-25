# Message Tracking & Resend Feature Implementation Plan
**Version**: 1.0  
**Status**: Under Review  
**Last Updated**: 2026-06-25

---

## Executive Summary

This document outlines a phased implementation strategy for adding message delivery tracking (SMS, email, WhatsApp) and resend-on-no-open functionality to the automation system. The design prioritizes type safety, scalability, testability, and compliance with Next.js/React best practices.

**Scope**:
- Delivery status tracking (sent → delivered → opened → clicked)
- SMS delivery via BMS Africa API
- Email delivery via Resend API
- Resend-on-no-open functionality with waiting card state
- Real-time statistics dashboard
- Logic inspector statistics tab

**Key Constraints**:
- Zero `any` or `any[]` usage
- Firestore-backed (no SQL)
- Single-workspace isolation
- Async webhook processing
- Production-grade error handling

---

## Architecture Overview

### 1.1 Data Flow

```
Message Action Node
  ↓
  ├─→ sendMessage() [existing]
  ├─→ captureProviderMessageId()  [NEW]
  ├─→ createMessageTrackingRecord() [NEW]
  ├─→ scheduleResendJob() [NEW - if resend enabled]
  └─→ Firestore: automation_runs (update step status)

Provider Webhook (Resend/BMS)
  ↓
  ├─→ /api/webhooks/resend | /api/webhooks/bms
  ├─→ verifySignature()
  ├─→ parseEvent()
  ├─→ updateMessageTrackingRecord() [NEW]
  ├─→ checkResendCondition() [NEW - if applicable]
  ├─→ Firestore: message_tracking (update status)
  └─→ Firestore: message_node_stats (aggregate)

ResendJob Processing (async via Cloud Tasks)
  ↓
  ├─→ evaluateResendCondition()
  ├─→ Decision: Resend OR Advance
  ├─→ Firestore: automation_runs (update step OR advance)
  └─→ Firestore: message_tracking (create resend record)
```

### 1.2 Collections & Schemas

#### `message_tracking` Collection
```typescript
interface MessageTrackingRecord {
  // IDs
  id: string; // auto-generated, matches Firestore doc ID
  automationId: string;
  runId: string;
  nodeId: string;
  workspaceId: string;
  organizationId: string;

  // Provider & Channel
  provider: MessageProvider; // 'resend' | 'bms_sms' | 'twilio' (enum)
  channel: MessageChannel; // 'email' | 'sms' | 'whatsapp' (enum from types.ts)
  providerMessageId: string; // Resend email_id or BMS campaign_id

  // Recipient
  recipientEmail?: string; // normalized lowercase
  recipientPhone?: string; // normalized format
  recipientIdentifier: string; // email OR phone (for dedup)

  // Delivery States - use discriminated union, not optional booleans
  status: MessageStatus; // 'sent' | 'queued' | 'delivered' | 'bounced' | 'failed'
  sentAt: Timestamp; // when provider confirmed sent
  deliveredAt?: Timestamp;
  openedAt?: Timestamp;
  clickedAt?: Timestamp;
  repliedAt?: Timestamp;

  // Failure/Suppression
  bounceInfo?: {
    type: 'permanent' | 'temporary';
    reason: string;
    bouncedAt: Timestamp;
  };
  complaintInfo?: {
    reason: string;
    complainedAt: Timestamp;
  };
  suppressionInfo?: {
    reason: 'unsubscribe' | 'bounce' | 'complaint' | 'manual';
    suppressedAt: Timestamp;
  };

  // Resend
  resendConfig?: {
    enabled: true;
    maxResends: number; // 1-5
    resendCount: number; // current count
    triggerCondition: 'no_open' | 'no_click';
    resendDelay: number; // hours
  };
  resendHistory?: {
    resendNumber: number;
    resendedAt: Timestamp;
    resendedMessageId: string; // provider ID of resend
    title: string;
    previewText: string;
  }[];

  // Audit
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string; // automation engine / user ID
}

type MessageProvider = 'resend' | 'bms_sms' | 'twilio' | 'whatsapp';
type MessageStatus = 
  | 'queued'      // Awaiting send
  | 'sent'        // Provider confirmed
  | 'delivered'   // Confirmed delivered to device
  | 'bounced'     // Hard bounce
  | 'failed'      // Transient failure, will retry
  | 'suppressed'; // On suppression list
```

#### `message_node_stats` Collection
```typescript
interface MessageNodeStatistics {
  id: string; // automationId_nodeId
  automationId: string;
  nodeId: string;
  workspaceId: string;
  organizationId: string;

  // Aggregated counts
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalBounced: number;
  totalComplaints: number;
  totalSuppressed: number;
  totalReplied: number;

  // Calculated rates
  deliveryRate: number; // 0-100
  openRate: number;
  clickRate: number;
  bounceRate: number;
  replyRate: number;

  // Resend tracking
  resendJobsScheduled: number;
  resendJobsCompleted: number;
  totalResendsSent: number;

  // Metadata
  firstMessageAt?: Timestamp;
  lastMessageAt: Timestamp;
  lastUpdatedAt: Timestamp;
}
```

#### `resend_jobs` Collection
```typescript
interface ResendJob {
  id: string;
  automationId: string;
  runId: string;
  nodeId: string;
  workspaceId: string;

  // Original message reference
  originalMessageTrackingId: string;
  recipientIdentifier: string; // email or phone

  // Resend metadata
  resendNumber: number; // 1, 2, 3...
  maxResends: number;
  triggerCondition: 'no_open' | 'no_click';

  // Configuration for this resend
  title: string; // "Reminder: Did you see this?"
  previewText: string; // email preview or SMS first line
  messageContent: string; // same as original OR allow variation?

  // Scheduling
  scheduledFor: Timestamp; // when this resend should trigger
  checkAfter: Timestamp; // don't check until this time
  status: 'pending' | 'checked' | 'sent' | 'skipped' | 'failed';
  statusReason?: string; // why it was skipped/failed

  // Execution
  checkedAt?: Timestamp;
  sentAt?: Timestamp;
  newMessageTrackingId?: string; // if resend was sent

  // Audit
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 1.3 Indexes Required

```
message_tracking:
  - (workspaceId, nodeId, status)
  - (runId, status)
  - (automationId, status)
  - (recipientIdentifier, status)
  - (scheduledFor) - for resend job polling

resend_jobs:
  - (workspaceId, status, scheduledFor)
  - (runId, status)

message_node_stats:
  - (automationId)
```

---

## Phase 1: Type Safety & Data Model

**Duration**: 3 days  
**Ownership**: Backend lead  
**Deliverable**: Type definitions, Firestore migrations, no breaking changes

### 1.1 Tasks

#### 1.1.1 Extend types.ts with strict interfaces
**File**: `src/lib/types.ts`

```typescript
// Enums for exhaustive type checking
export enum MessageProvider {
  Resend = 'resend',
  BmsSms = 'bms_sms',
  Twilio = 'twilio',
  WhatsAppCloud = 'whatsapp',
}

export enum MessageStatus {
  Queued = 'queued',
  Sent = 'sent',
  Delivered = 'delivered',
  Bounced = 'bounced',
  Failed = 'failed',
  Suppressed = 'suppressed',
}

export enum ResendTrigger {
  NoOpen = 'no_open',
  NoClick = 'no_click',
}

// Discriminated union for delivery states
export type DeliveryState =
  | { status: MessageStatus.Sent; sentAt: string }
  | { status: MessageStatus.Delivered; deliveredAt: string }
  | { status: MessageStatus.Opened; openedAt: string }
  | { status: MessageStatus.Bounced; bounceInfo: BounceInfo }
  | { status: MessageStatus.Suppressed; suppressionInfo: SuppressionInfo };

export interface BounceInfo {
  type: 'permanent' | 'temporary';
  reason: string;
  bouncedAt: string;
}

export interface SuppressionInfo {
  reason: 'unsubscribe' | 'bounce' | 'complaint' | 'manual';
  suppressedAt: string;
}

// No 'any' types - exhaustive interfaces
export interface MessageTrackingRecord {
  id: string;
  automationId: string;
  runId: string;
  nodeId: string;
  workspaceId: string;
  organizationId: string;
  provider: MessageProvider;
  channel: MessageChannel;
  providerMessageId: string;
  recipientEmail: string | null;
  recipientPhone: string | null;
  recipientIdentifier: string;
  deliveryState: DeliveryState;
  resendConfig: ResendConfiguration | null;
  resendHistory: ResendHistoryEntry[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface ResendConfiguration {
  enabled: true;
  maxResends: number;
  resendCount: number;
  triggerCondition: ResendTrigger;
  resendDelay: number;
}

export interface ResendHistoryEntry {
  resendNumber: number;
  resendedAt: string;
  resendedMessageId: string;
  title: string;
  previewText: string;
}

export interface MessageNodeStatistics {
  id: string;
  automationId: string;
  nodeId: string;
  workspaceId: string;
  organizationId: string;
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalBounced: number;
  totalComplaints: number;
  totalSuppressed: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  lastUpdatedAt: string;
}

export interface ResendJob {
  id: string;
  automationId: string;
  runId: string;
  nodeId: string;
  workspaceId: string;
  originalMessageTrackingId: string;
  recipientIdentifier: string;
  resendNumber: number;
  maxResends: number;
  triggerCondition: ResendTrigger;
  title: string;
  previewText: string;
  messageContent: string;
  scheduledFor: string;
  checkAfter: string;
  status: ResendJobStatus;
  statusReason: string | null;
  checkedAt: string | null;
  sentAt: string | null;
  newMessageTrackingId: string | null;
  createdAt: string;
  updatedAt: string;
}

export enum ResendJobStatus {
  Pending = 'pending',
  Checked = 'checked',
  Sent = 'sent',
  Skipped = 'skipped',
  Failed = 'failed',
}

// Extend AutomationAction
export interface AutomationAction {
  // ... existing fields ...
  resendConfig?: {
    enabled: boolean;
    maxResends: number; // 1-5, validated
    resendTitles: string[]; // One per resend
    resendPreviewTexts: string[]; // One per resend
    resendDelayHours: number; // >= 1
    triggerCondition: ResendTrigger;
  };
}
```

**Rationale**: 
- Discriminated unions prevent invalid state combinations
- Enums enable exhaustive type checking in TS
- No `any` - all fields explicitly typed
- Clear separation of concerns (tracking, stats, jobs)

#### 1.1.2 Create Firestore migration script
**File**: `src/lib/migrations/001_message_tracking.ts`

```typescript
// Migration runs once during app startup if collection doesn't exist
export async function createMessageTrackingCollections(
  db: FirebaseFirestore.Firestore
): Promise<void> {
  const collections = [
    'message_tracking',
    'message_node_stats',
    'resend_jobs',
  ];

  for (const collectionName of collections) {
    const col = db.collection(collectionName);
    const snap = await col.limit(1).get();
    if (snap.empty) {
      // Create a dummy document to initialize the collection
      await col.doc('_init').set({
        _init: true,
        _createdAt: new Date().toISOString(),
      });
      // Delete the dummy document
      await col.doc('_init').delete();
    }
  }

  // Create indexes (user must create these in Firestore console or via CLI)
  // Log warning if indexes don't exist
  console.warn(
    'Ensure Firestore composite indexes are created: see migration docs'
  );
}
```

**Index Creation** (via Firebase CLI or console):
```bash
# Run after deployment
firebase firestore:indexes
```

#### 1.1.3 Add tracking types to MessageTemplate
Extend `MessageTemplate` to include tracking metadata:
```typescript
export interface MessageTemplate {
  // ... existing fields ...
  tracking?: {
    enabled: boolean; // Track delivery by default for automation messages
    resendSupported: boolean; // Some templates may not allow resend
  };
}
```

### 1.2 Error Handling Strategy

Define custom error classes for this feature:
```typescript
// src/lib/errors/tracking-errors.ts
export class TrackingError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'TrackingError';
  }
}

export class WebhookVerificationError extends TrackingError {
  constructor(message: string) {
    super('WEBHOOK_VERIFICATION_FAILED', message);
  }
}

export class MessageTrackingNotFoundError extends TrackingError {
  constructor(messageId: string) {
    super('TRACKING_NOT_FOUND', `Message tracking record not found: ${messageId}`, {
      messageId,
    });
  }
}

export class ResendJobSchedulingError extends TrackingError {
  constructor(message: string, details: Record<string, unknown>) {
    super('RESEND_SCHEDULING_FAILED', message, details);
  }
}
```

### 1.3 Validation Schema

Use Zod for runtime validation (no `any` in parsing):
```typescript
// src/lib/validation/tracking-schemas.ts
import { z } from 'zod';

export const MessageTrackingRecordSchema = z.object({
  id: z.string().min(1),
  automationId: z.string().min(1),
  runId: z.string().min(1),
  nodeId: z.string().min(1),
  workspaceId: z.string().min(1),
  organizationId: z.string().min(1),
  provider: z.nativeEnum(MessageProvider),
  channel: z.enum(['email', 'sms', 'whatsapp']),
  providerMessageId: z.string().min(1),
  recipientEmail: z.string().email().nullable(),
  recipientPhone: z.string().regex(/^\+?[0-9]{7,15}$/).nullable(),
  recipientIdentifier: z.string().min(1),
  // deliveryState validated as discriminated union
  deliveryState: z.discriminatedUnion('status', [
    z.object({ status: z.literal(MessageStatus.Sent), sentAt: z.string() }),
    z.object({ status: z.literal(MessageStatus.Delivered), deliveredAt: z.string() }),
    // ... others
  ]),
  resendConfig: z.object({
    enabled: z.literal(true),
    maxResends: z.number().min(1).max(5),
    resendCount: z.number().min(0),
    triggerCondition: z.nativeEnum(ResendTrigger),
    resendDelay: z.number().min(1),
  }).nullable(),
  resendHistory: z.array(z.object({
    resendNumber: z.number().min(1),
    resendedAt: z.string(),
    resendedMessageId: z.string(),
    title: z.string(),
    previewText: z.string(),
  })),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string(),
});
```

### 1.4 Checklist

- [ ] All new types added to `src/lib/types.ts` (no `any`)
- [ ] Error classes created in `src/lib/errors/`
- [ ] Zod schemas for validation
- [ ] Firestore migration script created
- [ ] Index documentation added
- [ ] Types compile without errors
- [ ] No `any` or `any[]` in new code

**Commit Message**:
```
feat(types): add message tracking and resend types

- Add MessageProvider, MessageStatus, ResendTrigger enums
- Create MessageTrackingRecord, ResendJob, MessageNodeStatistics interfaces
- Add discriminated union for DeliveryState (no invalid states)
- Extend AutomationAction with resendConfig field
- Add Zod validation schemas (no runtime any)
- Define custom error classes for tracking operations
- Create Firestore index requirements doc
- All types are exhaustive - no any/any[] usage
```

---

## Phase 2: Message Sending & Tracking Capture

**Duration**: 4 days  
**Ownership**: Backend  
**Dependencies**: Phase 1  
**Deliverable**: Message sending captures provider IDs, creates tracking records

### 2.1 Tasks

#### 2.1.1 Modify sendMessage() to capture provider message ID
**File**: `src/lib/messaging-engine.ts`

Return type change:
```typescript
interface SendMessageResult {
  success: boolean;
  providerMessageId: string; // NEW
  provider: MessageProvider;
  channel: MessageChannel;
  sentAt: string;
  recipientIdentifier: string;
  error?: string;
}

export async function sendMessage(
  params: SendMessageParams
): Promise<SendMessageResult> {
  // ... existing logic ...

  // After successful send to provider:
  return {
    success: true,
    providerMessageId: resendResponse.id, // Resend returns 'id'
    provider: MessageProvider.Resend,
    channel: 'email',
    sentAt: new Date().toISOString(),
    recipientIdentifier: params.recipient,
  };
}
```

#### 2.1.2 Create message tracking service
**File**: `src/lib/services/message-tracking-service.ts`

```typescript
import { adminDb } from '../firebase-admin';
import {
  MessageTrackingRecord,
  MessageProvider,
  MessageStatus,
  MessageChannel,
} from '../types';

export class MessageTrackingService {
  async createTrackingRecord(
    record: Omit<MessageTrackingRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<MessageTrackingRecord> {
    // Normalize recipient identifier
    const recipientIdentifier =
      record.recipientEmail?.toLowerCase() || record.recipientPhone || '';

    if (!recipientIdentifier) {
      throw new Error('Either email or phone must be provided');
    }

    const docRef = adminDb
      .collection('message_tracking')
      .doc();

    const now = new Date().toISOString();
    const trackingRecord: MessageTrackingRecord = {
      ...record,
      id: docRef.id,
      recipientIdentifier,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(trackingRecord);
    return trackingRecord;
  }

  async updateTrackingRecord(
    trackingId: string,
    updates: Partial<MessageTrackingRecord>
  ): Promise<void> {
    await adminDb
      .collection('message_tracking')
      .doc(trackingId)
      .update({
        ...updates,
        updatedAt: new Date().toISOString(),
      });
  }

  async getTrackingRecord(
    trackingId: string
  ): Promise<MessageTrackingRecord | null> {
    const doc = await adminDb
      .collection('message_tracking')
      .doc(trackingId)
      .get();

    return doc.exists ? (doc.data() as MessageTrackingRecord) : null;
  }

  async getNodeStatistics(
    automationId: string,
    nodeId: string
  ): Promise<MessageNodeStatistics | null> {
    const doc = await adminDb
      .collection('message_node_stats')
      .doc(`${automationId}_${nodeId}`)
      .get();

    return doc.exists ? (doc.data() as MessageNodeStatistics) : null;
  }

  async updateNodeStatistics(
    automationId: string,
    nodeId: string,
    updates: Partial<MessageNodeStatistics>
  ): Promise<void> {
    const docId = `${automationId}_${nodeId}`;
    const docRef = adminDb
      .collection('message_node_stats')
      .doc(docId);

    const existing = await docRef.get();
    if (!existing.exists) {
      // Initialize stats doc
      const stats: MessageNodeStatistics = {
        id: docId,
        automationId,
        nodeId,
        workspaceId: updates.workspaceId || '',
        organizationId: updates.organizationId || '',
        totalSent: 0,
        totalDelivered: 0,
        totalOpened: 0,
        totalClicked: 0,
        totalBounced: 0,
        totalComplaints: 0,
        totalSuppressed: 0,
        deliveryRate: 0,
        openRate: 0,
        clickRate: 0,
        bounceRate: 0,
        lastUpdatedAt: new Date().toISOString(),
        ...updates,
      };
      await docRef.set(stats);
    } else {
      await docRef.update(updates);
    }
  }
}

export const messageTrackingService = new MessageTrackingService();
```

#### 2.1.3 Update message-actions.ts to create tracking records
**File**: `src/lib/automations/actions/message-actions.ts`

```typescript
export async function handleSendMessage(
  config: Record<string, unknown>,
  context: ExecutionContext
): Promise<void> {
  // ... existing recipient resolution ...

  for (const recipient of recipientList) {
    // Send message via existing sendMessage()
    const sendResult = await sendMessage({
      templateId: config.templateId as string,
      senderProfileId: (config.senderProfileId as string) || 'default',
      organizationId: context.organizationId,
      recipient: recipient,
      variables: sendMessageVars,
      entityId: context.entityId,
      workspaceId: context.workspaceId,
    });

    if (!sendResult.success) {
      throw new Error(`Failed to send message: ${sendResult.error}`);
    }

    // NEW: Create tracking record
    try {
      await messageTrackingService.createTrackingRecord({
        automationId: context.automationId,
        runId: context.runId,
        nodeId: nodeData.id,
        workspaceId: context.workspaceId,
        organizationId: context.organizationId,
        provider: sendResult.provider,
        channel: sendResult.channel,
        providerMessageId: sendResult.providerMessageId,
        recipientEmail: sendResult.channel === 'email' ? recipient : null,
        recipientPhone: sendResult.channel === 'sms' ? recipient : null,
        deliveryState: {
          status: MessageStatus.Sent,
          sentAt: sendResult.sentAt,
        },
        resendConfig: config.resendConfig || null,
        resendHistory: [],
        createdBy: 'automation-engine',
      });

      // NEW: Update node statistics
      await messageTrackingService.updateNodeStatistics(
        context.automationId,
        nodeData.id,
        {
          totalSent: FieldValue.increment(1),
          lastUpdatedAt: new Date().toISOString(),
        }
      );

      // NEW: Schedule resend if enabled
      if (config.resendConfig?.enabled) {
        await scheduleResendJob(context, recipient, nodeData);
      }
    } catch (error) {
      // Log but don't fail - tracking is non-critical
      console.error('Failed to create tracking record:', error);
      await logAutomationEvent('error', 'tracking_failed', {
        automationId: context.automationId,
        runId: context.runId,
        recipient,
        error: String(error),
      });
    }
  }
}
```

#### 2.1.4 Create resend job scheduling function
**File**: `src/lib/services/resend-job-service.ts`

```typescript
export class ResendJobService {
  async scheduleResendJob(
    context: ExecutionContext,
    recipientIdentifier: string,
    originalTrackingId: string,
    resendConfig: ResendConfiguration,
    messageConfig: {
      title: string;
      previewText: string;
      messageContent: string;
    }
  ): Promise<ResendJob> {
    const docRef = adminDb
      .collection('resend_jobs')
      .doc();

    const now = new Date();
    const scheduledFor = new Date(
      now.getTime() + resendConfig.resendDelay * 60 * 60 * 1000
    );

    const job: ResendJob = {
      id: docRef.id,
      automationId: context.automationId,
      runId: context.runId,
      nodeId: context.currentNodeId || '',
      workspaceId: context.workspaceId,
      originalMessageTrackingId: originalTrackingId,
      recipientIdentifier,
      resendNumber: 1,
      maxResends: resendConfig.maxResends,
      triggerCondition: resendConfig.triggerCondition,
      title: messageConfig.title,
      previewText: messageConfig.previewText,
      messageContent: messageConfig.messageContent,
      scheduledFor: scheduledFor.toISOString(),
      checkAfter: scheduledFor.toISOString(),
      status: ResendJobStatus.Pending,
      statusReason: null,
      checkedAt: null,
      sentAt: null,
      newMessageTrackingId: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    await docRef.set(job);
    return job;
  }
}
```

### 2.2 Testing Strategy

**Unit Tests** (`src/lib/__tests__/message-tracking-service.test.ts`):
- Create tracking record with valid data
- Reject tracking record without email or phone
- Update tracking record status
- Retrieve existing tracking record
- Handle non-existent tracking record

**Integration Tests** (`src/lib/__tests__/message-send-with-tracking.integration.test.ts`):
- Send message via handleSendMessage
- Verify tracking record created with correct provider ID
- Verify node statistics incremented
- Verify resend job scheduled if enabled
- Handle tracking failure without failing message send

### 2.3 Checklist

- [ ] sendMessage() returns providerMessageId
- [ ] MessageTrackingService created with CRUD operations
- [ ] message-actions.ts creates tracking records after send
- [ ] Node statistics updated on each send
- [ ] ResendJobService created for scheduling
- [ ] Error handling doesn't fail automation (non-blocking)
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] No `any` or `any[]` usage

**Commit Message**:
```
feat(tracking): capture message sends and create tracking records

- Modify sendMessage() to return providerMessageId
- Create MessageTrackingService for CRUD operations
- Update handleSendMessage to create tracking records after send
- Track node-level statistics (totalSent, lastMessageAt)
- Create ResendJobService for scheduling resend jobs
- Add error handling that doesn't block automation
- All operations use Firestore transactions for consistency
- Add comprehensive unit and integration tests
```

---

## Phase 3: Webhook Infrastructure & Event Processing

**Duration**: 5 days  
**Ownership**: Backend  
**Dependencies**: Phases 1-2  
**Deliverable**: Webhook endpoints, signature verification, event processing

### 3.1 Webhook Endpoints

#### 3.1.1 Resend webhook endpoint
**File**: `src/app/api/webhooks/resend/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { messageTrackingService } from '@/lib/services/message-tracking-service';
import { WebhookVerificationError } from '@/lib/errors/tracking-errors';

const RESEND_WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET || '';

interface ResendWebhookEvent {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    created_at: string;
    // varies by event type
    opened_at?: string;
    clicked_at?: string;
    bounce?: {
      type: 'permanent' | 'temporary';
      description: string;
    };
    suppressed?: boolean;
  };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Verify signature
    const signature = request.headers.get('x-resend-signature');
    if (!signature) {
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 401 }
      );
    }

    const body = await request.text();
    const expectedSignature = crypto
      .createHmac('sha256', RESEND_WEBHOOK_SECRET)
      .update(body)
      .digest('hex');

    if (signature !== expectedSignature) {
      throw new WebhookVerificationError('Invalid Resend signature');
    }

    // 2. Parse and validate event
    const event: ResendWebhookEvent = JSON.parse(body);
    validateResendEvent(event);

    // 3. Find tracking record
    const tracking = await messageTrackingService.findByProviderMessageId(
      event.data.email_id,
      MessageProvider.Resend
    );

    if (!tracking) {
      // Message may be from before tracking was enabled
      console.warn(`No tracking record found for ${event.data.email_id}`);
      return NextResponse.json({ received: true });
    }

    // 4. Update based on event type
    await processResendEvent(tracking, event);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    // Don't expose error details
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function processResendEvent(
  tracking: MessageTrackingRecord,
  event: ResendWebhookEvent
): Promise<void> {
  const updates: Partial<MessageTrackingRecord> = {};

  switch (event.type) {
    case 'email.sent':
      updates.deliveryState = {
        status: MessageStatus.Sent,
        sentAt: event.data.created_at,
      };
      break;

    case 'email.delivered':
      updates.deliveryState = {
        status: MessageStatus.Delivered,
        deliveredAt: event.data.created_at,
      };
      break;

    case 'email.opened':
      updates.deliveryState = {
        status: MessageStatus.Opened,
        openedAt: event.data.opened_at || event.created_at,
      };
      // Cancel any pending resend jobs
      await cancelResendJobs(tracking.runId, tracking.nodeId);
      break;

    case 'email.clicked':
      updates.deliveryState = {
        status: MessageStatus.Clicked,
        clickedAt: event.data.clicked_at || event.created_at,
      };
      // Cancel any pending resend jobs
      await cancelResendJobs(tracking.runId, tracking.nodeId);
      break;

    case 'email.bounced':
      updates.deliveryState = {
        status: MessageStatus.Bounced,
        bounceInfo: {
          type: event.data.bounce?.type || 'permanent',
          reason: event.data.bounce?.description || 'Bounce',
          bouncedAt: event.data.created_at,
        },
      };
      break;

    case 'email.suppressed':
      updates.deliveryState = {
        status: MessageStatus.Suppressed,
        suppressionInfo: {
          reason: 'bounce',
          suppressedAt: event.data.created_at,
        },
      };
      break;

    default:
      console.warn(`Unknown event type: ${event.type}`);
      return;
  }

  // Update tracking record
  await messageTrackingService.updateTrackingRecord(tracking.id, updates);

  // Update node statistics
  await updateStatisticsFromEvent(tracking, event.type);
}

function validateResendEvent(event: ResendWebhookEvent): void {
  if (!event.type || !event.data?.email_id) {
    throw new WebhookVerificationError('Invalid event structure');
  }
}

async function cancelResendJobs(
  runId: string,
  nodeId: string
): Promise<void> {
  const jobs = await adminDb
    .collection('resend_jobs')
    .where('runId', '==', runId)
    .where('nodeId', '==', nodeId)
    .where('status', '==', ResendJobStatus.Pending)
    .get();

  for (const doc of jobs.docs) {
    await doc.ref.update({
      status: ResendJobStatus.Skipped,
      statusReason: 'Message was opened/clicked before resend',
      updatedAt: new Date().toISOString(),
    });
  }
}

async function updateStatisticsFromEvent(
  tracking: MessageTrackingRecord,
  eventType: string
): Promise<void> {
  const updates: Record<string, any> = {
    lastUpdatedAt: new Date().toISOString(),
  };

  const status = eventType.split('.')[1]; // 'delivered', 'opened', etc.
  const fieldMap: Record<string, string> = {
    delivered: 'totalDelivered',
    opened: 'totalOpened',
    clicked: 'totalClicked',
    bounced: 'totalBounced',
  };

  const field = fieldMap[status];
  if (field) {
    updates[field] = FieldValue.increment(1);
  }

  await messageTrackingService.updateNodeStatistics(
    tracking.automationId,
    tracking.nodeId,
    updates
  );
}
```

#### 3.1.2 BMS SMS webhook endpoint
**File**: `src/app/api/webhooks/bms-sms/route.ts`

[Similar structure to Resend webhook, with BMS-specific event formats]

### 3.2 Webhook Verification Utilities

**File**: `src/lib/webhooks/signature-verification.ts`

```typescript
import crypto from 'crypto';

export class SignatureVerifier {
  static verifyResendSignature(
    signature: string,
    body: string,
    secret: string
  ): boolean {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');
    return crypto.timingSafeEqual(signature, expected);
  }

  static verifyBmsSignature(
    signature: string,
    body: string,
    secret: string
  ): boolean {
    // BMS uses different signature method - research their format
    const expected = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');
    return crypto.timingSafeEqual(signature, expected);
  }
}
```

### 3.3 Checklist

- [ ] Resend webhook endpoint created and tested
- [ ] BMS SMS webhook endpoint created and tested
- [ ] Signature verification implemented with timing-safe comparison
- [ ] Event parsing validated with no `any` types
- [ ] Tracking records updated correctly for each event
- [ ] Node statistics updated atomically
- [ ] Resend jobs cancelled when message is engaged
- [ ] Error handling doesn't expose internal details
- [ ] Webhooks logged for debugging
- [ ] Unit tests for each event type

**Commit Message**:
```
feat(webhooks): add Resend and BMS SMS webhook processors

- Create /api/webhooks/resend endpoint with signature verification
- Create /api/webhooks/bms-sms endpoint with signature verification
- Process email events (sent, delivered, opened, clicked, bounced)
- Process SMS status callbacks
- Update tracking records atomically
- Update node statistics from webhook events
- Cancel resend jobs when message is engaged
- Add comprehensive error handling and logging
```

---

## Phase 4: Resend Job Scheduler & Processing

**Duration**: 4 days  
**Ownership**: Backend  
**Dependencies**: Phases 1-3  
**Deliverable**: Async job processing, resend triggering, automation advancement

### 4.1 Resend Job Processor

**File**: `src/lib/automations/resend-job-processor.ts`

```typescript
export class ResendJobProcessor {
  async processResendJob(job: ResendJob): Promise<void> {
    try {
      // 1. Check if resend should happen
      const originalTracking = await messageTrackingService.getTrackingRecord(
        job.originalMessageTrackingId
      );

      if (!originalTracking) {
        throw new Error(`Original tracking not found: ${job.originalMessageTrackingId}`);
      }

      // 2. Evaluate condition (no open, no click)
      const shouldResend = this.shouldResendBasedOnCondition(
        originalTracking,
        job.triggerCondition
      );

      if (!shouldResend) {
        // Message already engaged - mark job as skipped
        await adminDb
          .collection('resend_jobs')
          .doc(job.id)
          .update({
            status: ResendJobStatus.Skipped,
            statusReason: `Message already ${job.triggerCondition}`,
            updatedAt: new Date().toISOString(),
          });
        return;
      }

      // 3. Check if we haven't exceeded max resends
      if (job.resendNumber >= job.maxResends) {
        await adminDb
          .collection('resend_jobs')
          .doc(job.id)
          .update({
            status: ResendJobStatus.Skipped,
            statusReason: 'Max resends reached',
            checkedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

        // Advance automation to next step
        await this.advanceAutomationRun(job.runId, job.nodeId);
        return;
      }

      // 4. Send resend message
      const newMessageId = await this.sendResendMessage(
        job,
        originalTracking
      );

      // 5. Update resend job
      await adminDb
        .collection('resend_jobs')
        .doc(job.id)
        .update({
          status: ResendJobStatus.Sent,
          sentAt: new Date().toISOString(),
          newMessageTrackingId: newMessageId,
          updatedAt: new Date().toISOString(),
        });

      // 6. Schedule next resend if applicable
      if (job.resendNumber < job.maxResends) {
        await this.scheduleNextResend(job);
      } else {
        // Last resend - set automation to waiting state
        // User will manually advance or it auto-advances after final timeout
        await adminDb
          .collection('automation_runs')
          .doc(job.runId)
          .update({
            currentNodeId: job.nodeId,
            status: 'waiting', // Don't advance yet
            metadata: {
              reason: 'Awaiting final resend completion',
              resendComplete: true,
            },
          });
      }
    } catch (error) {
      console.error('Resend job processing failed:', error);
      await adminDb
        .collection('resend_jobs')
        .doc(job.id)
        .update({
          status: ResendJobStatus.Failed,
          statusReason: `Error: ${error instanceof Error ? error.message : 'Unknown'}`,
          updatedAt: new Date().toISOString(),
        });

      await logAutomationEvent('error', 'resend_processing_failed', {
        jobId: job.id,
        error: String(error),
      });
    }
  }

  private shouldResendBasedOnCondition(
    tracking: MessageTrackingRecord,
    condition: ResendTrigger
  ): boolean {
    const state = tracking.deliveryState;

    switch (condition) {
      case ResendTrigger.NoOpen:
        // Resend if not opened yet
        return state.status !== MessageStatus.Opened &&
               state.status !== MessageStatus.Clicked;

      case ResendTrigger.NoClick:
        // Resend if not clicked yet
        return state.status !== MessageStatus.Clicked;

      default:
        return false;
    }
  }

  private async sendResendMessage(
    job: ResendJob,
    originalTracking: MessageTrackingRecord
  ): Promise<string> {
    // Send via Resend with custom subject/preview
    const sendResult = await sendMessage({
      // ... parameters ...
      subject: job.title,
      previewText: job.previewText,
      body: job.messageContent,
      recipient: job.recipientIdentifier,
    });

    if (!sendResult.success) {
      throw new Error(`Failed to send resend: ${sendResult.error}`);
    }

    // Create new tracking record for resend
    const resendTracking = await messageTrackingService.createTrackingRecord({
      automationId: job.automationId,
      runId: job.runId,
      nodeId: job.nodeId,
      workspaceId: job.workspaceId,
      provider: originalTracking.provider,
      channel: originalTracking.channel,
      providerMessageId: sendResult.providerMessageId,
      recipientEmail: originalTracking.recipientEmail,
      recipientPhone: originalTracking.recipientPhone,
      deliveryState: {
        status: MessageStatus.Sent,
        sentAt: sendResult.sentAt,
      },
      resendConfig: null, // Don't resend the resend
      resendHistory: [
        {
          resendNumber: job.resendNumber,
          resendedAt: new Date().toISOString(),
          resendedMessageId: sendResult.providerMessageId,
          title: job.title,
          previewText: job.previewText,
        },
      ],
      createdBy: 'resend-job-processor',
    });

    return resendTracking.id;
  }

  private async scheduleNextResend(job: ResendJob): Promise<void> {
    const nextScheduledFor = new Date(
      new Date(job.scheduledFor).getTime() +
      job.maxResends * 60 * 60 * 1000 // Cumulative delay
    );

    const nextJob: ResendJob = {
      ...job,
      id: adminDb.collection('resend_jobs').doc().id,
      resendNumber: job.resendNumber + 1,
      scheduledFor: nextScheduledFor.toISOString(),
      checkAfter: nextScheduledFor.toISOString(),
      status: ResendJobStatus.Pending,
      statusReason: null,
      checkedAt: null,
      sentAt: null,
      newMessageTrackingId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await adminDb
      .collection('resend_jobs')
      .doc(nextJob.id)
      .set(nextJob);
  }

  private async advanceAutomationRun(
    runId: string,
    currentNodeId: string
  ): Promise<void> {
    // Find next step in automation
    // Update automation_runs to advance
    // This logic depends on your automation engine
    console.log(`Would advance run ${runId} from node ${currentNodeId}`);
  }
}
```

### 4.2 Cloud Tasks Integration

**File**: `src/lib/automations/resend-scheduler.ts`

```typescript
import { CloudTasksClient } from '@google-cloud/tasks';

const cloudTasksClient = new CloudTasksClient();
const QUEUE_NAME = process.env.GOOGLE_CLOUD_TASKS_QUEUE || 'resend-jobs';
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || '';

export async function enqueueResendJob(job: ResendJob): Promise<void> {
  const parent = cloudTasksClient.queuePath(PROJECT_ID, 'us-central1', QUEUE_NAME);

  const task = {
    httpRequest: {
      httpMethod: 'POST' as const,
      url: `${process.env.NEXT_PUBLIC_APP_URL}/api/jobs/resend`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.INTERNAL_API_TOKEN}`,
      },
      body: Buffer.from(JSON.stringify({ jobId: job.id })).toString('base64'),
    },
    scheduleTime: {
      seconds: Math.floor(new Date(job.scheduledFor).getTime() / 1000),
    },
  };

  try {
    await cloudTasksClient.createTask({ parent, task });
  } catch (error) {
    console.error('Failed to enqueue resend job:', error);
    throw new ResendJobSchedulingError(
      'Failed to schedule resend job',
      { jobId: job.id, error: String(error) }
    );
  }
}
```

### 4.3 Resend Job API Endpoint

**File**: `src/app/api/jobs/resend/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { ResendJobProcessor } from '@/lib/automations/resend-job-processor';
import { messageTrackingService } from '@/lib/services/message-tracking-service';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify authorization
    const auth = request.headers.get('Authorization');
    if (auth !== `Bearer ${process.env.INTERNAL_API_TOKEN}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { jobId } = await request.json();

    // Retrieve job
    const jobDoc = await adminDb
      .collection('resend_jobs')
      .doc(jobId)
      .get();

    if (!jobDoc.exists) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    const job = jobDoc.data() as ResendJob;

    // Process
    const processor = new ResendJobProcessor();
    await processor.processResendJob(job);

    return NextResponse.json({ processed: true });
  } catch (error) {
    console.error('Resend job API error:', error);
    return NextResponse.json(
      { error: 'Job processing failed' },
      { status: 500 }
    );
  }
}
```

### 4.4 Checklist

- [ ] ResendJobProcessor created with full logic
- [ ] Condition evaluation (no open, no click) works correctly
- [ ] Resend messages sent with custom titles/preview text
- [ ] Next resend scheduled if max not reached
- [ ] Automation advanced when max resends complete
- [ ] Cloud Tasks integration set up
- [ ] Job API endpoint secured with authorization
- [ ] Error handling creates audit trail
- [ ] No `any` types used

**Commit Message**:
```
feat(resend): implement resend job processor and scheduler

- Create ResendJobProcessor for evaluating and executing resends
- Implement condition evaluation (no_open, no_click)
- Send resend messages with custom titles/preview text
- Schedule next resend if max not reached
- Update tracking records for each resend
- Integrate with Cloud Tasks for async scheduling
- Create /api/jobs/resend endpoint for task execution
- Add comprehensive error handling and logging
```

---

## Phase 5: Message Statistics UI Components

**Duration**: 5 days  
**Ownership**: Frontend  
**Dependencies**: Phases 1-4  
**Deliverable**: Statistics panel, card, inspector tab

### 5.1 Message Statistics Card Component

**File**: `src/app/admin/automations/components/MessageStatisticsCard.tsx`

```typescript
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { MessageNodeStatistics } from '@/lib/types';
import { cn } from '@/lib/utils';

interface MessageStatisticsCardProps {
  automationId: string;
  nodeId: string;
  isLoading?: boolean;
  onRefresh?: () => Promise<void>;
}

export function MessageStatisticsCard({
  automationId,
  nodeId,
  isLoading = false,
  onRefresh,
}: MessageStatisticsCardProps): React.ReactElement {
  const [stats, setStats] = useState<MessageNodeStatistics | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch statistics on mount
  useEffect(() => {
    const fetchStats = async (): Promise<void> => {
      try {
        const response = await fetch(
          `/api/automations/${automationId}/nodes/${nodeId}/statistics`
        );
        if (!response.ok) throw new Error('Failed to fetch statistics');
        const data = (await response.json()) as MessageNodeStatistics;
        setStats(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    };

    fetchStats();
  }, [automationId, nodeId]);

  const handleRefresh = useCallback(async (): Promise<void> => {
    setIsRefreshing(true);
    try {
      if (onRefresh) {
        await onRefresh();
      } else {
        const response = await fetch(
          `/api/automations/${automationId}/nodes/${nodeId}/statistics/refresh`,
          { method: 'POST' }
        );
        if (!response.ok) throw new Error('Failed to refresh');
        const data = (await response.json()) as MessageNodeStatistics;
        setStats(data);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsRefreshing(false);
    }
  }, [automationId, nodeId, onRefresh]);

  if (isLoading || !stats) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
            <div className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Statistics</h3>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="h-8 w-8 p-0"
          title="Refresh statistics"
        >
          <RefreshCw
            className={cn('h-4 w-4', isRefreshing && 'animate-spin')}
          />
        </Button>
      </div>

      {error && (
        <div className="mb-2 text-xs text-red-600">{error}</div>
      )}

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="bg-gray-50 p-2 rounded">
          <div className="text-gray-600">Sent</div>
          <div className="font-semibold text-gray-900">{stats.totalSent}</div>
        </div>
        <div className="bg-blue-50 p-2 rounded">
          <div className="text-gray-600">Delivered</div>
          <div className="font-semibold text-blue-900">
            {stats.totalDelivered} ({Math.round(stats.deliveryRate)}%)
          </div>
        </div>
        <div className="bg-green-50 p-2 rounded">
          <div className="text-gray-600">Opened</div>
          <div className="font-semibold text-green-900">
            {stats.totalOpened} ({Math.round(stats.openRate)}%)
          </div>
        </div>
      </div>
    </Card>
  );
}
```

**Key Design Decisions**:
- Separate loading state from data state (no undefined mixing)
- Error handling shown inline
- Refresh button with loading state
- Uses design tokens (colors, spacing from Tailwind)
- Accessible button with title attribute
- No `any` types in props

### 5.2 Message Statistics Inspector Tab

**File**: `src/app/admin/automations/components/InspectorTabs/MessageStatisticsTab.tsx`

```typescript
'use client';

import React, { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageNodeStatistics, MessageTrackingRecord } from '@/lib/types';
import { DeliveryTimeline } from './DeliveryTimeline';
import { RecipientBreakdown } from './RecipientBreakdown';
import { ResendHistory } from './ResendHistory';

interface MessageStatisticsTabProps {
  automationId: string;
  nodeId: string;
}

export function MessageStatisticsTab({
  automationId,
  nodeId,
}: MessageStatisticsTabProps): React.ReactElement {
  const [stats, setStats] = useState<MessageNodeStatistics | null>(null);
  const [messages, setMessages] = useState<MessageTrackingRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async (): Promise<void> => {
      try {
        const [statsRes, messagesRes] = await Promise.all([
          fetch(
            `/api/automations/${automationId}/nodes/${nodeId}/statistics`
          ),
          fetch(
            `/api/automations/${automationId}/nodes/${nodeId}/messages`
          ),
        ]);

        if (!statsRes.ok || !messagesRes.ok) {
          throw new Error('Failed to fetch data');
        }

        const statsData = (await statsRes.json()) as MessageNodeStatistics;
        const messagesData = (await messagesRes.json()) as MessageTrackingRecord[];

        setStats(statsData);
        setMessages(messagesData);
      } catch (error) {
        console.error('Failed to fetch statistics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [automationId, nodeId]);

  if (isLoading) {
    return <div className="p-4">Loading statistics...</div>;
  }

  if (!stats) {
    return <div className="p-4 text-gray-500">No statistics available</div>;
  }

  return (
    <Tabs defaultValue="summary" className="w-full">
      <TabsList>
        <TabsTrigger value="summary">Summary</TabsTrigger>
        <TabsTrigger value="timeline">Timeline</TabsTrigger>
        <TabsTrigger value="recipients">Recipients</TabsTrigger>
        {messages.some((m) => m.resendHistory?.length) && (
          <TabsTrigger value="resends">Resends</TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="summary" className="p-4">
        <div className="grid grid-cols-2 gap-4">
          <StatCard label="Total Sent" value={stats.totalSent} />
          <StatCard
            label="Delivered"
            value={`${stats.totalDelivered} (${Math.round(stats.deliveryRate)}%)`}
          />
          <StatCard
            label="Opened"
            value={`${stats.totalOpened} (${Math.round(stats.openRate)}%)`}
          />
          <StatCard
            label="Clicked"
            value={`${stats.totalClicked} (${Math.round(stats.clickRate)}%)`}
          />
          <StatCard
            label="Bounced"
            value={`${stats.totalBounced} (${Math.round(stats.bounceRate)}%)`}
          />
          <StatCard label="Suppressed" value={stats.totalSuppressed} />
        </div>
      </TabsContent>

      <TabsContent value="timeline">
        <DeliveryTimeline messages={messages} />
      </TabsContent>

      <TabsContent value="recipients">
        <RecipientBreakdown messages={messages} />
      </TabsContent>

      {messages.some((m) => m.resendHistory?.length) && (
        <TabsContent value="resends">
          <ResendHistory messages={messages} />
        </TabsContent>
      )}
    </Tabs>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}): React.ReactElement {
  return (
    <div className="border rounded-lg p-3">
      <p className="text-xs text-gray-600">{label}</p>
      <p className="text-lg font-semibold text-gray-900">{value}</p>
    </div>
  );
}
```

### 5.3 Checklist

- [ ] MessageStatisticsCard created with refresh functionality
- [ ] Statistics Inspector Tab with multiple views
- [ ] Timeline chart showing delivery progression
- [ ] Recipient breakdown with filtering
- [ ] Resend history display
- [ ] Loading states properly handled
- [ ] Error states shown to user
- [ ] No `any` types in components
- [ ] Animations smooth and non-disruptive (per emilkowal-animations)
- [ ] Responsive design tested

**Commit Message**:
```
feat(ui): add message statistics components

- Create MessageStatisticsCard with refresh button
- Add MessageStatisticsTab with 4 subtabs (summary, timeline, recipients, resends)
- Implement delivery timeline visualization
- Add recipient breakdown with filters
- Display resend history for messages
- All data fetched with proper error/loading states
- Uses design tokens and Tailwind for consistent styling
```

---

## Phase 6: Resend Configuration UI

**Duration**: 3 days  
**Ownership**: Frontend  
**Dependencies**: Phases 1, 5  
**Deliverable**: Resend settings in action config panel

### 6.1 Resend Configuration Panel

**File**: `src/app/admin/automations/components/ActionConfigPanel.tsx` (modify)

[Configuration panel component showing resend toggle, max resends, titles, preview text fields]

---

## RISK ANALYSIS & MITIGATION

### Critical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Webhook signature verification failure | Medium | High | Use timing-safe crypto comparison, test with real provider signatures |
| Message tracking lag behind real-time | High | Medium | Accept eventual consistency, provide refresh button, log warning if stale |
| Resend jobs stuck in "pending" state | Medium | High | Add monitoring dashboard, manual override endpoint, timeout jobs after 7 days |
| Firestore write quota exceeded on high volume | Low | Critical | Batch updates, implement circuit breaker, pre-allocate quota |
| Race condition: message opens before resend scheduled | High | Low | Check current status before scheduling resend, use transactions |
| Resend messages treated as new messages in analytics | High | Medium | Tag resend messages with `isResend: true` flag, exclude from some reports |
| Contact advances to next step before resend complete | Medium | High | Keep run in "waiting" state, manual advance button, auto-advance after timeout |

### Architectural Risks

| Issue | Solution |
|-------|----------|
| N+1 queries when fetching messages | Batch queries, implement caching layer, use Firestore collection groups |
| Statistics calculations too slow | Pre-aggregate in Firestore, use FieldValue.increment() for atomic updates |
| Webhook processing becomes bottleneck | Queue webhooks in Pub/Sub, process asynchronously |
| Memory leaks in node processes | Regular database connection cleanup, implement connection pooling |

### Type Safety Risks

| Issue | Solution |
|-------|----------|
| Discriminated union bugs at runtime | Use Zod validation on webhook payloads, 100% test coverage |
| Firebase returning unexpected shape | Validate all Firestore reads with Zod, throw errors on mismatch |
| Resend API response changes | Version API calls, pin SDK version, test against stable branch |

---

## AFFECTED FEATURES & INTEGRATION POINTS

### Features Affected by Message Tracking

1. **Automation Run Display**
   - Need to show "waiting" state on automation cards
   - Add resend progress indicator
   - Implement manual advance button

2. **Automation Analytics/Reporting**
   - Exclude resend messages from certain reports (they're not new sends)
   - Add "engagement rate" metric (opened / sent)
   - Track resend effectiveness (did resending help?)

3. **Message Suppression/Blocklist**
   - Hook into Resend bounces/complaints
   - Sync suppressed contacts with contact blocklist
   - Prevent sending to suppressed addresses

4. **Automation History/Audit Trail**
   - Log each resend as separate action
   - Track which messages were resends
   - Include in automation replay/debugging

5. **Workspace Settings**
   - Add max messages per day limit check
   - Monitor Resend/BMS quota usage
   - Alert on rate limiting

6. **Contact Management**
   - Add "last email" field to contact
   - Track engagement history
   - Update suppression status from webhook

7. **Automations Executor**
   - Need to handle "waiting" state in traversal logic
   - Implement manual step override
   - Add timeout for waiting states (7 days?)

### New Dependencies

- **Google Cloud Tasks** (for job scheduling)
- **Resend Node SDK** (already integrated)
- **BMS Africa SDK** (new - might not exist, may need REST wrapper)

### Database Migrations

- Create 3 new Firestore collections
- Add 3 composite indexes
- Add 4 fields to AutomationRun type

---

## TESTING STRATEGY

### Unit Tests (Phase 1-3)
- Type validation with Zod
- Service CRUD operations
- Webhook signature verification
- Event parsing

### Integration Tests (Phase 4-5)
- End-to-end message send → tracking → webhook → update
- Resend job scheduling and processing
- UI component rendering with real data

### E2E Tests (Phase 6+)
- Full automation with resend enabled
- Manual resend triggering
- Statistics accuracy

### Performance Tests
- 1000 webhook events/second throughput
- Statistics aggregation on 10K messages
- Query latency (<500ms for UI)

---

## DEPLOYMENT CHECKLIST

- [ ] Firestore indexes deployed
- [ ] Environment variables configured (RESEND_KEY, BMS_KEY, WEBHOOK_SECRETS)
- [ ] Cloud Tasks queue created
- [ ] Webhook endpoints exposed and verified
- [ ] Provider webhooks configured (Resend dashboard, BMS dashboard)
- [ ] Monitoring/alerting configured for webhook queue depth
- [ ] Runbook created for resend job failures
- [ ] User documentation written

---

## Success Metrics

- 99.9% webhook delivery success rate
- <5s latency for statistics refresh
- Zero message loss (idempotent processing)
- Resend increases engagement rate by 10-20%
- <1% of users hit resend max limit

---

**Document Version**: 1.0  
**Last Updated**: 2026-06-25  
**Ready for Phase 1**: Yes
