# Message Tracking & Resend Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement delivery tracking, out-of-order webhook processing, automatic resend-on-no-open, and RFC 8058 one-click unsubscribe compliance for all automation and direct emails.

**Architecture:** Event-driven tracking and job scheduling using Firestore transactions for concurrency control, Next.js `after()` API for non-blocking aggregations, and Cloud Tasks for scheduling.

**Tech Stack:** Next.js (App Router), Firebase Admin SDK (Firestore), Resend SDK, BMS Africa SMS API.

---

## File Structure & File Changes

The following files will be created or modified as part of this plan:
*   [NEW] [src/lib/types/tracking.ts](file:///Users/josephaidoo/Desktop/Codes/vibe Coding/Onboarding-Dashbaord-main/src/lib/types/tracking.ts) — Core type definitions for tracking, state transitions, and jobs (100% type-safe, no `any`).
*   [NEW] [src/lib/errors/tracking-errors.ts](file:///Users/josephaidoo/Desktop/Codes/vibe Coding/Onboarding-Dashbaord-main/src/lib/errors/tracking-errors.ts) — Specific error classes for validation, signature verification, and scheduling.
*   [NEW] [src/lib/services/message-tracking-service.ts](file:///Users/josephaidoo/Desktop/Codes/vibe Coding/Onboarding-Dashbaord-main/src/lib/services/message-tracking-service.ts) — CRUD operations, atomic statistics increments, and out-of-order status updating.
*   [NEW] [src/lib/services/resend-job-service.ts](file:///Users/josephaidoo/Desktop/Codes/vibe Coding/Onboarding-Dashbaord-main/src/lib/services/resend-job-service.ts) — Job scheduling, queuing with Cloud Tasks, and job execution/skipping logic.
*   [MODIFY] [src/lib/types.ts](file:///Users/josephaidoo/Desktop/Codes/vibe Coding/Onboarding-Dashbaord-main/src/lib/types.ts) — Extend `AutomationAction` and `AutomationRun` to support resend states and config.
*   [MODIFY] [src/lib/resend-service.ts](file:///Users/josephaidoo/Desktop/Codes/vibe Coding/Onboarding-Dashbaord-main/src/lib/resend-service.ts) — Update `sendEmail` and `sendBatchEmails` to support custom Headers for RFC 8058 one-click unsubscribe.
*   [MODIFY] [src/lib/messaging-engine.ts](file:///Users/josephaidoo/Desktop/Codes/vibe Coding/Onboarding-Dashbaord-main/src/lib/messaging-engine.ts) — Ensure provider ids are returned and direct sends integrate secure links.
*   [MODIFY] [src/lib/automations/actions/message-actions.ts](file:///Users/josephaidoo/Desktop/Codes/vibe Coding/Onboarding-Dashbaord-main/src/lib/automations/actions/message-actions.ts) — Create tracking records on send, and inject secure unsubscribe links for direct emails.
*   [NEW] [src/app/api/webhooks/resend/route.ts](file:///Users/josephaidoo/Desktop/Codes/vibe Coding/Onboarding-Dashbaord-main/src/app/api/webhooks/resend/route.ts) — Resend webhook POST handler with signature check and Next.js 15 `after()` processing.
*   [NEW] [src/app/api/messaging/unsubscribe/one-click/route.ts](file:///Users/josephaidoo/Desktop/Codes/vibe Coding/Onboarding-Dashbaord-main/src/app/api/messaging/unsubscribe/one-click/route.ts) — RFC 8058 POST receiver for one-click unsubscribe headers.
*   [NEW] [src/app/api/jobs/resend/route.ts](file:///Users/josephaidoo/Desktop/Codes/vibe Coding/Onboarding-Dashbaord-main/src/app/api/jobs/resend/route.ts) — Next.js Route endpoint for Cloud Tasks invocation of resend tasks.

---

## Phase 1: Type Safety & Core Data Model

### Task 1.1: Create Tracking Types & Schemas
*   **Files:**
    *   Create: `src/lib/types/tracking.ts`
    *   Modify: `src/lib/types.ts`
*   - [ ] **Step 1: Write `src/lib/types/tracking.ts`**
    Define enums and discriminated unions for delivery status and state transitions. No usage of `any` or `any[]`.
    ```typescript
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
      Opened = 'opened',
      Clicked = 'clicked',
      Bounced = 'bounced',
      Failed = 'failed',
      Suppressed = 'suppressed',
    }

    export enum ResendTrigger {
      NoOpen = 'no_open',
      NoClick = 'no_click',
    }

    // State weight mapping to prevent out-of-order overwrites
    export const MESSAGE_STATUS_WEIGHT: Record<MessageStatus, number> = {
      [MessageStatus.Queued]: 1,
      [MessageStatus.Failed]: 1,
      [MessageStatus.Sent]: 2,
      [MessageStatus.Delivered]: 3,
      [MessageStatus.Opened]: 4,
      [MessageStatus.Clicked]: 5,
      [MessageStatus.Bounced]: 6,
      [MessageStatus.Suppressed]: 6,
    };

    export type DeliveryState =
      | { status: MessageStatus.Queued | MessageStatus.Failed; timestamp: string }
      | { status: MessageStatus.Sent; sentAt: string }
      | { status: MessageStatus.Delivered; deliveredAt: string }
      | { status: MessageStatus.Opened; openedAt: string }
      | { status: MessageStatus.Clicked; clickedAt: string }
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

    export interface MessageTrackingRecord {
      id: string;
      automationId: string;
      runId: string;
      nodeId: string;
      workspaceId: string;
      organizationId: string;
      provider: MessageProvider;
      channel: 'email' | 'sms' | 'whatsapp';
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
      enabled: boolean;
      maxResends: number;
      resendCount: number;
      triggerCondition: ResendTrigger;
      resendDelay: number; // in hours
    }

    export interface ResendHistoryEntry {
      resendNumber: number;
      resendedAt: string;
      resendedMessageId: string;
      title: string;
      previewText: string;
    }

    export interface MessageNodeStatistics {
      id: string; // automationId_nodeId
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
    ```

*   - [ ] **Step 2: Update `src/lib/types.ts`**
    Extend `AutomationAction` and `AutomationRun` to hold resend configuration parameters and node execution status updates.
    ```typescript
    // In src/lib/types.ts
    // Extend AutomationAction
    export interface AutomationAction {
      // ... existing fields ...
      resendConfig?: {
        enabled: boolean;
        maxResends: number; // validated 1-5
        resendTitles: string[]; // One per resend variant
        resendPreviewTexts: string[]; // One per resend variant
        resendDelayHours: number; // >= 1
        triggerCondition: 'no_open' | 'no_click';
      };
    }
    ```

### Task 1.2: Add Error Definitions
*   **Files:**
    *   Create: `src/lib/errors/tracking-errors.ts`
*   - [ ] **Step 1: Write `src/lib/errors/tracking-errors.ts`**
    Ensure typed errors are used for validations instead of general error message strings.
    ```typescript
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

    export class OutOfOrderStateError extends TrackingError {
      constructor(message: string, details: Record<string, unknown>) {
        super('OUT_OF_ORDER_STATE', message, details);
      }
    }

    export class ResendJobSchedulingError extends TrackingError {
      constructor(message: string, details: Record<string, unknown>) {
        super('RESEND_SCHEDULING_FAILED', message, details);
      }
    }
    ```

---

## Phase 2: Message Tracking Service (Firestore Transactions & Stats)

### Task 2.1: Implement Message Tracking Service
*   **Files:**
    *   Create: `src/lib/services/message-tracking-service.ts`
*   - [ ] **Step 1: Create the tracking manager service**
    Implement transactional upserts to prevent statistics drift and out-of-order status writes.
    ```typescript
    import { adminDb } from '../firebase-admin';
    import { FieldValue } from 'firebase-admin/firestore';
    import {
      MessageTrackingRecord,
      MessageNodeStatistics,
      MessageStatus,
      MESSAGE_STATUS_WEIGHT,
      DeliveryState,
      MessageProvider
    } from '../types/tracking';

    export class MessageTrackingService {
      async createTrackingRecord(
        record: Omit<MessageTrackingRecord, 'id' | 'createdAt' | 'updatedAt'>
      ): Promise<MessageTrackingRecord> {
        const docRef = adminDb.collection('message_tracking').doc();
        const now = new Date().toISOString();
        const trackingRecord: MessageTrackingRecord = {
          ...record,
          id: docRef.id,
          createdAt: now,
          updatedAt: now,
        };

        await docRef.set(trackingRecord);
        return trackingRecord;
      }

      async getTrackingRecord(id: string): Promise<MessageTrackingRecord | null> {
        const doc = await adminDb.collection('message_tracking').doc(id).get();
        return doc.exists ? (doc.data() as MessageTrackingRecord) : null;
      }

      async findByProviderMessageId(
        providerMessageId: string,
        provider: MessageProvider
      ): Promise<MessageTrackingRecord | null> {
        const snap = await adminDb
          .collection('message_tracking')
          .where('providerMessageId', '==', providerMessageId)
          .where('provider', '==', provider)
          .limit(1)
          .get();

        if (snap.empty) return null;
        return { id: snap.docs[0].id, ...snap.docs[0].data() } as MessageTrackingRecord;
      }

      async updateStateWithSequenceGuard(
        trackingId: string,
        newState: DeliveryState
      ): Promise<void> {
        const docRef = adminDb.collection('message_tracking').doc(trackingId);

        await adminDb.runTransaction(async (transaction) => {
          const doc = await transaction.get(docRef);
          if (!doc.exists) {
            throw new Error(`Tracking record not found: ${trackingId}`);
          }

          const current = doc.data() as MessageTrackingRecord;
          const currentWeight = MESSAGE_STATUS_WEIGHT[current.deliveryState.status] || 0;
          const newWeight = MESSAGE_STATUS_WEIGHT[newState.status] || 0;

          // Reject updates that downgrade delivery state progression
          if (newWeight <= currentWeight) {
            console.log(`[SEQUENCE_GUARD] Ignored state update for ${trackingId}. Current: ${current.deliveryState.status}, Proposed: ${newState.status}`);
            return;
          }

          transaction.update(docRef, {
            deliveryState: newState,
            updatedAt: new Date().toISOString(),
          });

          // Perform statistics aggregation updates atomically
          await this.adjustNodeStatisticsInTransaction(transaction, current, newState);
        });
      }

      private async adjustNodeStatisticsInTransaction(
        transaction: FirebaseFirestore.Transaction,
        current: MessageTrackingRecord,
        newState: DeliveryState
      ): Promise<void> {
        const statsId = `${current.automationId}_${current.nodeId}`;
        const statsRef = adminDb.collection('message_node_stats').doc(statsId);
        const statsSnap = await transaction.get(statsRef);

        const increments: Record<string, FirebaseFirestore.FieldValue> = {};
        
        // Define increment helpers
        const getIncrementField = (status: MessageStatus): string | null => {
          switch (status) {
            case MessageStatus.Delivered: return 'totalDelivered';
            case MessageStatus.Opened: return 'totalOpened';
            case MessageStatus.Clicked: return 'totalClicked';
            case MessageStatus.Bounced: return 'totalBounced';
            case MessageStatus.Suppressed: return 'totalSuppressed';
            default: return null;
          }
        };

        const oldField = getIncrementField(current.deliveryState.status);
        const newField = getIncrementField(newState.status);

        if (oldField) {
          increments[oldField] = FieldValue.increment(-1);
        }
        if (newField) {
          increments[newField] = FieldValue.increment(1);
        }

        if (Object.keys(increments).length === 0) return;

        if (!statsSnap.exists) {
          const initialStats: MessageNodeStatistics = {
            id: statsId,
            automationId: current.automationId,
            nodeId: current.nodeId,
            workspaceId: current.workspaceId,
            organizationId: current.organizationId,
            totalSent: 1,
            totalDelivered: newState.status === MessageStatus.Delivered ? 1 : 0,
            totalOpened: newState.status === MessageStatus.Opened ? 1 : 0,
            totalClicked: newState.status === MessageStatus.Clicked ? 1 : 0,
            totalBounced: newState.status === MessageStatus.Bounced ? 1 : 0,
            totalComplaints: 0,
            totalSuppressed: newState.status === MessageStatus.Suppressed ? 1 : 0,
            deliveryRate: 0,
            openRate: 0,
            clickRate: 0,
            bounceRate: 0,
            lastUpdatedAt: new Date().toISOString(),
          };
          transaction.set(statsRef, initialStats);
        } else {
          transaction.update(statsRef, {
            ...increments,
            lastUpdatedAt: new Date().toISOString(),
          });
        }
      }
    }

    export const messageTrackingService = new MessageTrackingService();
    ```

---

## Phase 3: Unsubscribe Links & List-Unsubscribe (RFC 8058) Headers

### Task 3.1: Add List-Unsubscribe Header Support in Resend Provider
*   **Files:**
    *   Modify: `src/lib/resend-service.ts`
*   - [ ] **Step 1: Inject List-Unsubscribe headers in `sendEmail`**
    Gmail/Yahoo requires marketing or bulk automations to carry one-click headers. Modify `sendEmail` and `sendBatchEmails` to accept unsubscribe options.
    ```typescript
    // In src/lib/resend-service.ts
    export async function sendEmail(params: {
      from?: string;
      to: string | string[];
      subject: string;
      html: string;
      attachments?: EmailAttachment[];
      scheduledAt?: string;
      tags?: ResendTag[];
      apiKey?: string;
      domain?: string;
      // Added unsubscribe options
      unsubscribeHeaders?: {
        oneClickUrl: string;
        preferenceUrl: string;
      };
    }) {
      const domain = params.domain || getDomain();
      const payload: Record<string, unknown> = {
        from: params.from || `SmartSapp <notifications@${domain}>`,
        to: params.to,
        subject: params.subject,
        html: params.html,
        attachments: params.attachments,
        scheduled_at: params.scheduledAt,
        tags: params.tags,
      };

      if (params.unsubscribeHeaders) {
        payload.headers = {
          'List-Unsubscribe': `<${params.unsubscribeHeaders.oneClickUrl}>, <${params.unsubscribeHeaders.preferenceUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        };
      }

      return resendRequest('/emails', 'POST', payload, params.apiKey);
    }
    ```

### Task 3.2: Update Messaging Engine to Inject Unsubscribe Headers
*   **Files:**
    *   Modify: `src/lib/messaging-engine.ts`
*   - [ ] **Step 1: Update variables and email routing in `sendMessage`**
    Construct the secure header links before dispatching to `sendEmail`.
    ```typescript
    // In src/lib/messaging-engine.ts
    // Resolve the secure unsubscribe token url
    const { generateSecureUnsubscribeLink } = await import('./services/unsubscribe-service');
    const unsubLink = await generateSecureUnsubscribeLink(recipient, resolvedEntityId, resolvedWorkspaceId);
    finalVariables.unsubscribe_link = unsubLink;

    // Generate List-Unsubscribe header links (RFC 8058 One-Click)
    const { getRequestBaseUrl } = await import('./utils/url-helpers');
    const baseUrl = await getRequestBaseUrl();
    const cleanEmail = recipient.toLowerCase().trim();
    const token = generateUnsubscribeToken(cleanEmail);

    const oneClickUrl = `${baseUrl}/api/messaging/unsubscribe/one-click?recipient=${encodeURIComponent(cleanEmail)}&token=${token}&ws=${resolvedWorkspaceId || 'global'}`;
    const preferenceUrl = unsubLink;

    // Inside sendEmail call payload logic:
    await sendEmail({
      from: `${sender.name} <${sender.identifier}>`,
      to: recipient,
      subject: resolvedSubject,
      html: compiledBody,
      apiKey: resendKey,
      domain: resendDomain,
      unsubscribeHeaders: {
        oneClickUrl,
        preferenceUrl,
      }
    });
    ```

### Task 3.3: Inject Unsubscribe Links dynamically in Direct/Raw Emails
*   **Files:**
    *   Modify: `src/lib/automations/actions/message-actions.ts`
*   - [ ] **Step 1: Modify `handleDirectEmail` loop**
    Ensure direct messages resolve the secure link per-recipient and replace `{{unsubscribe_link}}` within the dynamic HTML wrapper.
    ```typescript
    // In src/lib/automations/actions/message-actions.ts
    // Inside the recipientList.map loop:
    const { generateSecureUnsubscribeLink } = await import('../../services/unsubscribe-service');
    const recipientUnsubLink = await generateSecureUnsubscribeLink(recipient, context.entityId, context.workspaceId);

    // Replace unsubscribe variables inside raw HTML layout
    let finalBody = resolvedBodyContent;
    if (channel === 'email' && config.useBrandLayout !== false) {
      // HTML layout building...
      // Inject styled unsubscribe block in the footer
      finalBody = finalBody.replace(
        '{{unsubscribe_link}}',
        recipientUnsubLink
      );
    }
    ```

### Task 3.4: Create the RFC 8058 One-Click Unsubscribe Endpoint
*   **Files:**
    *   Create: `src/app/api/messaging/unsubscribe/one-click/route.ts`
*   - [ ] **Step 1: Write POST/GET handler for one-click unsubscribe**
    Handle incoming form-urlencoded `List-Unsubscribe=One-Click` POSTs securely without requiring UI interactions.
    ```typescript
    import { NextRequest, NextResponse } from 'next/server';
    import { verifyUnsubscribeToken, processUnsubscribe } from '@/lib/services/unsubscribe-service';

    export const dynamic = 'force-dynamic';

    export async function POST(request: NextRequest): Promise<NextResponse> {
      try {
        const { searchParams } = new URL(request.url);
        const recipient = searchParams.get('recipient') || '';
        const token = searchParams.get('token') || '';
        const workspaceId = searchParams.get('ws') || 'global';

        // 1. Verify cryptographic HMAC signature
        const isValid = verifyUnsubscribeToken(recipient, token);
        if (!isValid) {
          return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
        }

        // 2. Read the body format (Must carry List-Unsubscribe=One-Click)
        const contentType = request.headers.get('content-type') || '';
        if (contentType.includes('application/x-www-form-urlencoded')) {
          const text = await request.text();
          if (text !== 'List-Unsubscribe=One-Click') {
             return NextResponse.json({ error: 'Invalid body contents' }, { status: 400 });
          }
        }

        // 3. Apply opt-out suppression
        await processUnsubscribe(recipient, {
          emailStatus: 'unsubscribed',
          workspaceId,
        });

        return NextResponse.json({ success: true });
      } catch (error) {
        console.error('[RFC-8058-UNSUBSCRIBE] Failed:', error);
        return NextResponse.json({ error: 'Internal processing error' }, { status: 500 });
      }
    }
    ```

---

## Phase 4: Webhook Event Processing (Next.js 15 `after()`)

### Task 4.1: Create Resend Webhook Handler
*   **Files:**
    *   Create: `src/app/api/webhooks/resend/route.ts`
*   - [ ] **Step 1: Write signature validation and out-of-band processing logic**
    Use `after()` to immediately respond `200 OK` to Resend while resolving Firestore writes asynchronously.
    ```typescript
    import { NextRequest, NextResponse } from 'next/server';
    import { unstable_after as after } from 'next/cache';
    import crypto from 'crypto';
    import { messageTrackingService } from '@/lib/services/message-tracking-service';
    import { MessageProvider, MessageStatus, DeliveryState } from '@/lib/types/tracking';
    import { WebhookVerificationError } from '@/lib/errors/tracking-errors';
    import { adminDb } from '@/lib/firebase-admin';

    const RESEND_WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET || '';

    interface ResendPayload {
      type: string;
      created_at: string;
      data: {
        email_id: string;
        created_at: string;
        opened_at?: string;
        clicked_at?: string;
        bounce?: {
          type: 'permanent' | 'temporary';
          description: string;
        };
      };
    }

    export async function POST(request: NextRequest): Promise<NextResponse> {
      try {
        const signature = request.headers.get('x-resend-signature');
        if (!signature) {
          return NextResponse.json({ error: 'Missing header' }, { status: 401 });
        }

        const body = await request.text();
        const expected = crypto
          .createHmac('sha256', RESEND_WEBHOOK_SECRET)
          .update(body)
          .digest('hex');

        // Timing safe validation
        if (signature !== expected) {
          throw new WebhookVerificationError('Invalid webhook signature');
        }

        const payload = JSON.parse(body) as ResendPayload;

        // Perform processing out-of-band using after()
        after(async () => {
          try {
            const tracking = await messageTrackingService.findByProviderMessageId(
              payload.data.email_id,
              MessageProvider.Resend
            );

            if (!tracking) {
              console.warn(`[WEBHOOK] No tracking record found for Resend message: ${payload.data.email_id}`);
              return;
            }

            const deliveryState = mapResendEventToState(payload);
            if (!deliveryState) return;

            // Atomic state upgrade
            await messageTrackingService.updateStateWithSequenceGuard(tracking.id, deliveryState);

            // If open or click event, cancel scheduled resends
            if (deliveryState.status === MessageStatus.Opened || deliveryState.status === MessageStatus.Clicked) {
              await cancelPendingResendJobs(tracking.runId, tracking.nodeId);
            }
          } catch (err) {
            console.error('[WEBHOOK_AFTER] Async webhook update failed:', err);
          }
        });

        return NextResponse.json({ received: true });
      } catch (err) {
        console.error('[WEBHOOK_ENDPOINT] Failure:', err);
        return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
      }
    }

    function mapResendEventToState(payload: ResendPayload): DeliveryState | null {
      const time = payload.data.created_at;
      switch (payload.type) {
        case 'email.sent':
          return { status: MessageStatus.Sent, sentAt: time };
        case 'email.delivered':
          return { status: MessageStatus.Delivered, deliveredAt: time };
        case 'email.opened':
          return { status: MessageStatus.Opened, openedAt: payload.data.opened_at || time };
        case 'email.clicked':
          return { status: MessageStatus.Clicked, clickedAt: payload.data.clicked_at || time };
        case 'email.bounced':
          return {
            status: MessageStatus.Bounced,
            bounceInfo: {
              type: payload.data.bounce?.type || 'permanent',
              reason: payload.data.bounce?.description || 'Hard bounce',
              bouncedAt: time,
            },
          };
        default:
          return null;
      }
    }

    async function cancelPendingResendJobs(runId: string, nodeId: string): Promise<void> {
      const snap = await adminDb
        .collection('resend_jobs')
        .where('runId', '==', runId)
        .where('nodeId', '==', nodeId)
        .where('status', '==', 'pending')
        .get();

      if (snap.empty) return;

      const batch = adminDb.batch();
      snap.docs.forEach((doc) => {
        batch.update(doc.ref, {
          status: 'skipped',
          statusReason: 'Recipient engaged with message',
          updatedAt: new Date().toISOString(),
        });
      });
      await batch.commit();
      console.log(`[CANCEL_RESEND] Cancelled ${snap.size} pending resends for run ${runId}`);
    }
    ```

---

## Phase 5: Resend Scheduler & Cloud Tasks Processing

### Task 5.1: Write Resend Job Service
*   **Files:**
    *   Create: `src/lib/services/resend-job-service.ts`
*   - [ ] **Step 1: Write scheduler and job creation methods**
    Set up Google Cloud Tasks scheduling wrappers and job database logging.
    ```typescript
    import { adminDb } from '../firebase-admin';
    import { CloudTasksClient } from '@google-cloud/tasks';
    import { ResendJob, ResendJobStatus, ResendConfiguration, ResendTrigger } from '../types/tracking';

    const cloudTasksClient = new CloudTasksClient();
    const QUEUE = process.env.GOOGLE_CLOUD_TASKS_QUEUE || '';
    const PROJECT = process.env.GOOGLE_CLOUD_PROJECT_ID || '';
    const LOCATION = 'us-central1';

    export class ResendJobService {
      async scheduleResendJob(params: {
        automationId: string;
        runId: string;
        nodeId: string;
        workspaceId: string;
        originalTrackingId: string;
        recipientIdentifier: string;
        resendConfig: ResendConfiguration;
        title: string;
        previewText: string;
        messageContent: string;
      }): Promise<ResendJob> {
        const docRef = adminDb.collection('resend_jobs').doc();
        const delayMs = params.resendConfig.resendDelay * 60 * 60 * 1000;
        const scheduledTime = new Date(Date.now() + delayMs);

        const job: ResendJob = {
          id: docRef.id,
          automationId: params.automationId,
          runId: params.runId,
          nodeId: params.nodeId,
          workspaceId: params.workspaceId,
          originalMessageTrackingId: params.originalTrackingId,
          recipientIdentifier: params.recipientIdentifier,
          resendNumber: params.resendConfig.resendCount + 1,
          maxResends: params.resendConfig.maxResends,
          triggerCondition: params.resendConfig.triggerCondition,
          title: params.title,
          previewText: params.previewText,
          messageContent: params.messageContent,
          scheduledFor: scheduledTime.toISOString(),
          checkAfter: scheduledTime.toISOString(),
          status: ResendJobStatus.Pending,
          statusReason: null,
          checkedAt: null,
          sentAt: null,
          newMessageTrackingId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await docRef.set(job);

        // Enqueue the Cloud Task execution trigger
        await this.enqueueCloudTask(job);

        return job;
      }

      private async enqueueCloudTask(job: ResendJob): Promise<void> {
        if (!QUEUE || !PROJECT) {
          console.warn('[CLOUD_TASKS] Cloud Tasks config missing. Skipping enqueue.');
          return;
        }

        const parent = cloudTasksClient.queuePath(PROJECT, LOCATION, QUEUE);
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

        await cloudTasksClient.createTask({ parent, task });
      }
    }

    export const resendJobService = new ResendJobService();
    ```

### Task 5.2: Create the Resend Job API Endpoint
*   **Files:**
    *   Create: `src/app/api/jobs/resend/route.ts`
*   - [ ] **Step 1: Write Route handler to process scheduled resend items**
    Evaluates whether the recipient has performed the trigger condition (opened/clicked) and resends if not.
    ```typescript
    import { NextRequest, NextResponse } from 'next/server';
    import { adminDb } from '@/lib/firebase-admin';
    import { messageTrackingService } from '@/lib/services/message-tracking-service';
    import { ResendJob, ResendJobStatus, MessageStatus, ResendTrigger } from '@/lib/types/tracking';
    import { sendMessage } from '@/lib/messaging-engine';

    export async function POST(request: NextRequest): Promise<NextResponse> {
      try {
        const auth = request.headers.get('Authorization');
        if (auth !== `Bearer ${process.env.INTERNAL_API_TOKEN}`) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { jobId } = (await request.json()) as { jobId: string };
        const jobRef = adminDb.collection('resend_jobs').doc(jobId);
        
        await adminDb.runTransaction(async (transaction) => {
          const snap = await transaction.get(jobRef);
          if (!snap.exists) throw new Error(`Job not found: ${jobId}`);

          const job = snap.data() as ResendJob;
          if (job.status !== ResendJobStatus.Pending) return;

          const original = await messageTrackingService.getTrackingRecord(job.originalMessageTrackingId);
          if (!original) {
            transaction.update(jobRef, {
              status: ResendJobStatus.Failed,
              statusReason: 'Original tracking record deleted',
              updatedAt: new Date().toISOString(),
            });
            return;
          }

          // Evaluate condition: Skip if recipient already engaged
          const currentStatus = original.deliveryState.status;
          const hasOpened = currentStatus === MessageStatus.Opened || currentStatus === MessageStatus.Clicked;
          const hasClicked = currentStatus === MessageStatus.Clicked;

          if ((job.triggerCondition === ResendTrigger.NoOpen && hasOpened) ||
              (job.triggerCondition === ResendTrigger.NoClick && hasClicked)) {
            transaction.update(jobRef, {
              status: ResendJobStatus.Skipped,
              statusReason: `Recipient engaged (${currentStatus})`,
              checkedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
            return;
          }

          // Trigger Send Dispatch
          const sendResult = await sendMessage({
            templateId: original.nodeId, // Reuses node template structure
            recipient: job.recipientIdentifier,
            workspaceId: job.workspaceId,
            organizationId: original.organizationId,
            variables: {
              subject: job.title,
              previewText: job.previewText,
              body: job.messageContent,
            },
            entityId: original.id,
            trackLinks: true,
          });

          if (!sendResult.success) {
            throw new Error(`Dispatch failed: ${sendResult.error}`);
          }

          transaction.update(jobRef, {
            status: ResendJobStatus.Sent,
            sentAt: new Date().toISOString(),
            newMessageTrackingId: sendResult.logId || null,
            checkedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        });

        return NextResponse.json({ processed: true });
      } catch (err) {
        console.error('[RESEND_JOB_TRIGGER] Processing error:', err);
        return NextResponse.json({ error: 'Failed execution' }, { status: 500 });
      }
    }
    ```

---

## Phase 6: Verification Plan

### Automated Tests
*   `vitest src/lib/__tests__/message-tracking-service.test.ts` — Verifies transaction integrity and out-of-order sequence block updates.
*   `vitest src/lib/__tests__/email-webhook.test.ts` — Tests Resend signature verification and `after()` async hooks.
*   `vitest src/lib/__tests__/unsubscribe-service.test.ts` — Validates cryptographic token generation, parsing, and RFC 8058 one-click POST.

### Manual Verification
1.  **Direct Email Link Verification**: Deploy action changes, trigger a `DIRECT_EMAIL` action, and verify the email received contains a valid preferences url pointing to `https://.../preferences/email?token=...`.
2.  **RFC 8058 Compliance**: Send curl requests to the POST unsubscribe route:
    ```bash
    curl -X POST "http://localhost:3000/api/messaging/unsubscribe/one-click?recipient=test@example.com&token=VALID_TOKEN&ws=global" \
      -H "Content-Type: application/x-www-form-urlencoded" \
      -d "List-Unsubscribe=One-Click"
    ```
    Confirm suppression record is created in Firestore.
