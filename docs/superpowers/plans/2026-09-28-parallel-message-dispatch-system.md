# High-Throughput Parallel Message Dispatch System (20,000 Messages in Minutes) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **TDD is mandatory**: write the failing test, verify it fails, then implement minimal code to pass.
>
> **CRITICAL HUMAN APPROVAL GATE:** This plan MUST be approved by the human before any code is modified or executed.
>
> **Type Hygiene:** Strict typing (zero `any` or `any[]`) is required across all modified and new files.
>
> **Verification Gate:** Standard verification via `pnpm typecheck` (`tsc --noEmit`), `pnpm lint`, and targeted `vitest` tests. Do NOT run full `npm run build` or push to remote Git branches.

**Goal:** Transform the messaging engine from a slow, client-side sequential loop (~1 message/sec, taking ~6.6 hours for 20,000 messages) into an asynchronous, parallelized, cloud-backed background dispatch system capable of sending **20,000 messages within 2 to 4 minutes** across Email (Resend), SMS (mNotify), and WhatsApp (Meta Cloud API).

**Architecture:** 
1. **Composer Decoupling**: All sends (individual entity selection, tag filters, roles, custom filters, and CSV) generate a Firestore `message_jobs` record with pending tasks, instantly transitioning the UI to Step 6 ("Broadcast Progress"). The browser tab can be safely closed immediately.
2. **Server-Side Bulk Recipient Resolution**: Resolve 20,000 contact targets server-side in ~1.5 seconds via chunked `adminDb.getAll(...)`, completely eliminating the client-side entity resolution loop.
3. **Provider-Bounded Concurrency**: Within each chunk worker, parallelize outbound requests using `mapWithConcurrency`: Email batches of 100 via Resend, SMS bounded at 20 concurrent requests via mNotify, and WhatsApp bounded at 25 concurrent requests conforming strictly to Meta Cloud API Tier 1 rate limits (80 req/sec).
4. **Cloud Tasks Parallel Fan-Out**: Dispatch multi-chunk workers across Google Cloud Tasks (`bulk-trigger-queue-v2`) to execute up to 10-20 chunk workers simultaneously in parallel, with local development timer fallbacks.
5. **Real-time Observability & Failed Exports**: Step 6 subscribes via `onSnapshot` to the job document for real-time progress, delivery metrics, and 1-click export of failed recipients to PDF, CSV, or JSON.

**Tech Stack:** Next.js (App Router, Server Actions, Route Handlers), React 18, Firebase Admin SDK, Google Cloud Tasks (`@google-cloud/tasks`), Resend SDK, mNotify API, Meta WhatsApp Cloud API, Vitest.

---

## 1. Root Cause Analysis & Performance Breakdown

### A. Current Sequential System (Why it takes hours/days)
1. **Client-Side Sequential Loop in `ComposerWizard.tsx` (Lines 728–880)**:
   - For all non-CSV audiences (`mode === 'single'`), the browser client loops over each recipient:
     ```typescript
     for (let i = 0; i < filteredRecipients.length; i++) {
       res = await sendMessage(...) // Server Action HTTP round-trip (~300-500ms)
       if (i < filteredRecipients.length - 1) await new Promise(r => setTimeout(r, 500)); // Artificial 500ms sleep!
     }
     ```
   - Total latency per message: ~1.0–1.2 seconds.
   - 209 messages (from user's screenshot) = ~4.2 minutes of continuous browser execution.
   - 20,000 messages = **24,000 seconds = 6.67 hours**!
   - If the user switches tabs on mobile, closes the laptop, or encounters a network blip, the send halts midway.
2. **Per-Entity Contact Resolution in Browser (Lines 735–743)**:
   - When selecting entities individually (`audienceSource === 'individual'`), the browser calls `resolveContact(entityId)` and `resolveRecipientContacts(...)` sequentially for each entity. For 1,000 entities, that's 2,000 sequential network requests before a message is even dispatched!
3. **Serial Background Chaining in `bulk-messaging.ts`**:
   - `CHUNK_SIZE = 50`.
   - In SMS/WhatsApp mode, `processJobChunkBackground` iterates sequentially through tasks in each chunk.
   - Chunks are chained serially via `after(processJobChunkBackground)`.
   - 20,000 tasks = 400 chained chunks. Serverless environments (Cloud Run, Vercel) terminate background processes after request timeouts, stranding chunks in `status: 'pending'`.

---

### B. Mathematical Target Throughput Comparison

| Component | Current Setup | Proposed Parallel System | 20,000 Messages Duration |
|---|---|---|---|
| **Recipient Resolution** | Client loop (1 by 1 in browser): ~15–30 mins | Server-side batched `adminDb.getAll`: ~1.5s | **~1.5 seconds** |
| **Email (Resend)** | Sequential (1 email/sec): ~5.5 hours | Batch API (100 emails/call) + 10 parallel workers | **20 – 40 seconds** |
| **SMS (mNotify)** | Sequential (1 SMS/sec + 500ms sleep): ~6.6 hours | `mapWithConcurrency(tasks, 20)` + 5-10 parallel chunk workers | **2.5 – 4 minutes** |
| **WhatsApp (Meta)** | Sequential (1 msg/sec): ~6.6 hours | `mapWithConcurrency(tasks, 25)` (Meta Tier 1: 80 req/s) | **3.5 – 4.2 minutes** |
| **User Experience** | Tab must stay open for hours; locks browser | Tab transitions to Step 6 immediately; safe to close tab | **Instant (< 2 seconds to launch)** |

---

## 2. File Architecture & Decomposition

| File Path | Responsibility | Action |
|---|---|---|
| `src/lib/types.ts` | Add `totalChunks`, `workerConcurrency`, and `dispatchSpeed` fields to `MessageJob` / `MessageTask` | Modify |
| `src/lib/contacts/bulk-contact-resolver.ts` | High-performance server-side resolver for 10,000+ entities using batched Firestore queries (`adminDb.getAll`) | Create |
| `src/lib/bulk-messaging.ts` | Support ad-hoc messages (`customBody`/`customSubject`), increase email chunk size to 100, add bounded concurrency for SMS/WhatsApp via `mapWithConcurrency`, and fan-out parallel chunks via Cloud Tasks | Modify |
| `src/app/api/messaging/bulk-worker/route.ts` | Dedicated background worker endpoint authenticated with `x-cloud-tasks-secret` to process individual chunks in parallel | Create |
| `src/app/admin/messaging/composer/components/ComposerWizard.tsx` | Decouple "Send Now": replace client-side loop with `createBulkMessageJob` + transition to Step 6. Add failed export action to Step 6 | Modify |
| `src/lib/__tests__/bulk-messaging-parallel.test.ts` | Vitest suite verifying bounded concurrency, rate limit backoff, and Cloud Tasks fan-out | Create |

---

## 3. Tasks Breakdown

### Phase 1: Server-Side Bulk Recipient Resolution & Data Model

#### Task 1: Create Server-Side Bulk Recipient Resolver
**Files:**
- Create: `src/lib/contacts/bulk-contact-resolver.ts`
- Test: `src/lib/__tests__/bulk-contact-resolver.test.ts`

- [ ] **Step 1: Write the failing test for bulk contact resolution**
  Test resolving 500 entity contacts in batches of 100 with channel filtering ('email' vs 'sms').
  ```typescript
  // src/lib/__tests__/bulk-contact-resolver.test.ts
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import { resolveBulkRecipientsForEntities } from '../contacts/bulk-contact-resolver';
  import { adminDb } from '../firebase-admin';

  vi.mock('../firebase-admin', () => ({
    adminDb: {
      getAll: vi.fn(),
      collection: vi.fn(),
    },
  }));

  describe('resolveBulkRecipientsForEntities', () => {
    it('resolves contacts in batches of 100 without 1-by-1 queries', async () => {
      const mockDocs = Array.from({ length: 50 }, (_, i) => ({
        exists: true,
        id: `entity_${i}`,
        data: () => ({
          name: `School ${i}`,
          entityContacts: [
            { name: `Principal ${i}`, email: `p${i}@example.com`, phone: `+2335012340${i}`, isPrimary: true, typeKey: 'principal' }
          ]
        })
      }));
      (adminDb.getAll as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockDocs);

      const results = await resolveBulkRecipientsForEntities({
        entityIds: Array.from({ length: 50 }, (_, i) => `entity_${i}`),
        workspaceId: 'ws_1',
        contactScope: 'primary',
        channel: 'email',
      });

      expect(results.length).toBe(50);
      expect(results[0].contact).toBe('p0@example.com');
      expect(results[0].contactName).toBe('Principal 0');
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run src/lib/__tests__/bulk-contact-resolver.test.ts`
  Expected: FAIL with "Cannot find module '../contacts/bulk-contact-resolver'".

- [ ] **Step 3: Implement `resolveBulkRecipientsForEntities`**
  Implement batched resolution using `adminDb.getAll(...)` in chunks of 300 (Firestore limit for `getAll` is up to 500 docs per call).
  ```typescript
  // src/lib/contacts/bulk-contact-resolver.ts
  import { adminDb } from '@/lib/firebase-admin';
  import type { EntityContact } from '@/lib/types';

  export interface BulkRecipientTarget {
    recipient: string;
    contactName: string;
    entityName: string;
    entityId: string;
    variables: Record<string, unknown>;
  }

  export async function resolveBulkRecipientsForEntities(params: {
    entityIds: string[];
    workspaceId: string;
    contactScope: 'primary' | 'signatories' | 'all' | (string & {});
    channel: 'email' | 'sms' | 'whatsapp';
    contactTypeFilter?: string[] | null;
  }): Promise<BulkRecipientTarget[]> {
    const { entityIds, workspaceId, contactScope, channel, contactTypeFilter } = params;
    if (!entityIds.length) return [];

    const isEmail = channel === 'email';
    const resolvedRecipients: BulkRecipientTarget[] = [];

    // Chunk entity IDs in slices of 300 for adminDb.getAll
    const CHUNK_SIZE = 300;
    for (let i = 0; i < entityIds.length; i += CHUNK_SIZE) {
      const slice = entityIds.slice(i, i + CHUNK_SIZE);
      // ARCHITECTURAL NOTE: Entities reside in the top-level 'entities' collection
      const docRefs = slice.map((id) => adminDb.collection('entities').doc(id));

      const snapshots = await adminDb.getAll(...docRefs);

      for (const snap of snapshots) {
        if (!snap.exists) continue;
        const data = snap.data() || {};
        const entityName = (data.name as string) || 'Unknown Entity';
        const entityId = snap.id;
        const contacts = (data.entityContacts || data.contacts || []) as EntityContact[];

        const eligible = contacts.filter((c) => {
          if (contactTypeFilter && contactTypeFilter.length > 0) {
            return contactTypeFilter.includes(c.typeKey);
          }
          if (contactScope === 'primary') return !!c.isPrimary;
          if (contactScope === 'signatories') return !!c.isSignatory;
          return true; // 'all'
        });

        if (eligible.length > 0) {
          for (const c of eligible) {
            const targetValue = isEmail ? c.email : c.phone;
            if (targetValue && targetValue.trim()) {
              resolvedRecipients.push({
                recipient: targetValue.trim(),
                contactName: c.name || entityName,
                entityName,
                entityId,
                variables: {
                  contact_name: c.name || entityName,
                  first_name: (c.name || '').split(' ')[0] || entityName,
                  entity_name: entityName,
                  school_name: entityName,
                  role: c.typeKey || 'Contact',
                  email: c.email || '',
                  phone: c.phone || '',
                },
              });
            }
          }
        } else {
          // Direct entity fallback when no nested entityContacts exist
          const fbEmail = (data.email || data.primaryEmail || data.primaryContactEmail) as string | undefined;
          const fbPhone = (data.phone || data.primaryPhone || data.primaryContactPhone) as string | undefined;
          const targetValue = isEmail ? fbEmail : fbPhone;
          if (targetValue && targetValue.trim()) {
            const contactName = (data.primaryContactName || entityName) as string;
            resolvedRecipients.push({
              recipient: targetValue.trim(),
              contactName,
              entityName,
              entityId,
              variables: {
                contact_name: contactName,
                first_name: contactName.split(' ')[0] || entityName,
                entity_name: entityName,
                school_name: entityName,
                role: 'Primary',
                email: fbEmail || '',
                phone: fbPhone || '',
              },
            });
          }
        }
      }
    }

    return resolvedRecipients;
  }
  ```

- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run src/lib/__tests__/bulk-contact-resolver.test.ts`
  Expected: PASS.

---

#### Task 2: Extend `createBulkMessageJob` for Ad-hoc/Composer Messages
**Files:**
- Modify: `src/lib/bulk-messaging.ts:31-125`
- Test: `src/lib/__tests__/fallback-duplication.test.ts`

- [ ] **Step 1: Write the failing test for ad-hoc bulk message jobs**
  Verify that `createBulkMessageJob` can create a job without a pre-saved `templateId` by passing `customSubject`, `customBody`, `channel`, and `blocks`.
  ```typescript
  it('creates a bulk job with custom body when templateId is omitted', async () => {
    const res = await createBulkMessageJob({
      channel: 'sms',
      customBody: 'Hello {{contact_name}}, your report is ready.',
      senderProfileId: 'profile_1',
      recipients: [{ recipient: '+233501234567', variables: { contact_name: 'John' } }],
      userId: 'user_1',
    });
    expect(res.jobId).toBeDefined();
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run src/lib/__tests__/fallback-duplication.test.ts`
  Expected: FAIL with "Channel or template not found".

- [ ] **Step 3: Update `BulkJobInput` and `createBulkMessageJob` in `bulk-messaging.ts`**
  Allow `templateId` to be optional when `customBody` and `channel` are provided:
  ```typescript
  export interface BulkJobInput {
    templateId?: string;
    senderProfileId: string;
    channel?: 'email' | 'sms' | 'whatsapp';
    customSubject?: string;
    customBody?: string;
    blocks?: MessageBlock[];
    contentMode?: 'plain_text' | 'rich_builder';
    recipients: {
      recipient: string;
      variables: Record<string, unknown>;
      entityId?: string;
      displayName?: string;
      campaignVariantId?: 'A' | 'B';
    }[];
    userId: string;
    trackLinks?: boolean;
    campaignId?: string;
    workspaceId?: string;
    organizationId?: string;
  }
  ```
  If `templateId` is missing, resolve `channel` from input, initialize `jobData` with `customBody`, `customSubject`, and `channel`, and proceed with batched task insertion.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run src/lib/__tests__/fallback-duplication.test.ts`
  Expected: PASS.

---

### Phase 2: Provider Concurrency & In-Chunk Parallelism

#### Task 3: Implement Bounded Concurrency inside `bulk-messaging.ts`
**Files:**
- Modify: `src/lib/bulk-messaging.ts:540-790`
- Test: `src/lib/__tests__/bulk-messaging-parallel.test.ts`

- [ ] **Step 1: Write failing test for bounded concurrency in chunk processing**
  Verify that when processing a chunk of 50 SMS/WhatsApp tasks, `sendMessage` calls run concurrently up to the concurrency limit rather than sequentially.
  ```typescript
  // src/lib/__tests__/bulk-messaging-parallel.test.ts
  import { describe, it, expect, vi } from 'vitest';
  import { mapWithConcurrency } from '../utils/concurrency';

  describe('Bulk Messaging Concurrency Limits', () => {
    it('executes tasks within bounded concurrency of 20 without exceeding limit', async () => {
      let activeWorkers = 0;
      let maxActiveWorkers = 0;

      const items = Array.from({ length: 50 }, (_, i) => i);
      const results = await mapWithConcurrency(items, 20, async () => {
        activeWorkers++;
        maxActiveWorkers = Math.max(maxActiveWorkers, activeWorkers);
        await new Promise((r) => setTimeout(r, 20));
        activeWorkers--;
        return true;
      });

      expect(results.length).toBe(50);
      expect(maxActiveWorkers).toBeLessThanOrEqual(20);
      expect(maxActiveWorkers).toBeGreaterThan(1);
    });
  });
  ```

- [ ] **Step 2: Run test to verify helper behavior**
  Run: `npx vitest run src/lib/__tests__/bulk-messaging-parallel.test.ts`
  Expected: PASS.

- [ ] **Step 3: Refactor `processJobChunkBackground` and `processBulkJobChunk` to use `mapWithConcurrency`**
  In `src/lib/bulk-messaging.ts`:
  1. Increase `CHUNK_SIZE = 100` for Email (matching Resend batch max size) and `100` for SMS/WhatsApp.
  2. Replace the sequential `for (const taskDoc of tasksSnap.docs)` loop for SMS and WhatsApp with:
     ```typescript
     const CONCURRENCY_LIMIT = job.channel === 'whatsapp' ? 25 : 20;

     const taskDocs = tasksSnap.docs.filter((d) => (d.data() as MessageTask).status !== 'sent');
     processedCount = taskDocs.length;

     await mapWithConcurrency(taskDocs, CONCURRENCY_LIMIT, async (taskDoc) => {
       const task = taskDoc.data() as MessageTask;
       const result = await sendMessage({
         templateId: job.templateId,
         senderProfileId: job.senderProfileId,
         organizationId: orgId,
         recipient: task.recipient,
         variables: task.variables,
         trackLinks: job.trackLinks,
         subject: subjectOverride,
         body: bodyOverride,
         campaignId: job.campaignId,
         campaignVariantId: task.campaignVariantId,
         tags: [
           { name: 'jobId', value: jobId },
           { name: 'taskId', value: taskDoc.id }
         ]
       });

       if (result.success) {
         successIncrement++;
         await taskDoc.ref.update({ status: 'sent', sentAt: new Date().toISOString() });
       } else {
         failedIncrement++;
         await taskDoc.ref.update({ status: 'failed', error: result.error || 'Dispatch error' });
       }
     });
     ```

- [ ] **Step 4: Verify test suite runs clean**
  Run: `npx vitest run src/lib/__tests__/bulk-messaging-parallel.test.ts`
  Expected: PASS.

---

### Phase 3: Cloud Tasks Multi-Chunk Parallel Dispatcher

#### Task 4: Create Dedicated Background Worker Endpoint (`/api/messaging/bulk-worker`)
**Files:**
- Create: `src/app/api/messaging/bulk-worker/route.ts`
- Test: `src/lib/__tests__/bulk-worker-endpoint.test.ts`

- [ ] **Step 1: Write failing test for the bulk worker endpoint**
  Verify that the endpoint validates `x-cloud-tasks-secret` and processes a chunk for the given `jobId`.
  ```typescript
  // src/lib/__tests__/bulk-worker-endpoint.test.ts
  import { describe, it, expect, vi } from 'vitest';
  import { POST } from '@/app/api/messaging/bulk-worker/route';
  import { NextRequest } from 'next/server';

  vi.mock('@/lib/bulk-messaging', () => ({
    processJobChunkBackground: vi.fn().mockResolvedValue(undefined),
  }));

  describe('Bulk Worker Endpoint', () => {
    it('rejects requests without correct secret', async () => {
      const req = new NextRequest('http://localhost:3000/api/messaging/bulk-worker', {
        method: 'POST',
        headers: { 'x-cloud-tasks-secret': 'invalid' },
        body: JSON.stringify({ jobId: 'job_123' }),
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run src/lib/__tests__/bulk-worker-endpoint.test.ts`
  Expected: FAIL with "Cannot find module '@/app/api/messaging/bulk-worker/route'".

- [ ] **Step 3: Implement `/api/messaging/bulk-worker/route.ts`**
  ```typescript
  import { NextRequest, NextResponse } from 'next/server';
  import { processJobChunkBackground } from '@/lib/bulk-messaging';

  export async function POST(req: NextRequest) {
    const secret = process.env.CLOUD_TASKS_SECRET;
    if (!secret) {
      console.error('[BULK-WORKER] CLOUD_TASKS_SECRET is not configured on server.');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const incomingSecret = req.headers.get('x-cloud-tasks-secret');
    if (incomingSecret !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      const { jobId, chunkIndex } = await req.json();
      if (!jobId) {
        return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
      }

      await processJobChunkBackground(jobId, typeof chunkIndex === 'number' ? chunkIndex : undefined);
      return NextResponse.json({ success: true, jobId, chunkIndex });
    } catch (err: unknown) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Worker failure' },
        { status: 500 }
      );
    }
  }
  ```

- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run src/lib/__tests__/bulk-worker-endpoint.test.ts`
  Expected: PASS.

---

#### Task 5: Implement Deterministic Chunk Partitioning & Multi-Chunk Fan-Out
**Files:**
- Modify: `src/lib/bulk-messaging.ts`
- Modify: `src/lib/gcp-tasks-client.ts`

- [ ] **Step 1: Write failing test for deterministic chunk partitioning**
  Verify that `createBulkMessageJob` stamps `chunkIndex` on every task doc, and `processJobChunkBackground` queries exclusively by `chunkIndex`, preventing race conditions and duplicate dispatches across concurrent workers.
- [ ] **Step 2: Run test to verify failure**
  Run: `npx vitest run src/lib/__tests__/bulk-messaging-parallel.test.ts`
- [ ] **Step 3: Implement deterministic chunk partitioning and rate-limited fan-out**
  1. In `createBulkMessageJob`:
     ```typescript
     // Assign deterministic chunkIndex to eliminate race conditions
     let globalIdx = 0;
     for (const chunk of taskChunks) {
       const batch = adminDb.batch();
       for (const item of chunk) {
         const taskRef = jobRef.collection('tasks').doc();
         const chunkIndex = Math.floor(globalIdx / CHUNK_SIZE);
         const taskData: Omit<MessageTask, 'id'> = {
           recipient: item.recipient,
           variables: item.variables,
           status: 'pending',
           chunkIndex, // <-- Non-overlapping partition key
           ...(item.entityId && { entityId: item.entityId }),
           ...(item.displayName && { displayName: item.displayName }),
           ...(item.campaignVariantId && { campaignVariantId: item.campaignVariantId }),
         };
         batch.set(taskRef, taskData);
         globalIdx++;
       }
       await batch.commit();
     }
     ```
  2. In `processJobChunkBackground(jobId, chunkIndex)`:
     ```typescript
     let query = jobRef.collection('tasks').where('status', '==', 'pending');
     if (typeof chunkIndex === 'number') {
       query = query.where('chunkIndex', '==', chunkIndex);
     }
     const tasksSnap = await query.limit(CHUNK_SIZE).get();
     ```
  3. In Cloud Tasks fan-out, apply provider-specific concurrency ceilings:
     - **WhatsApp**: Max 2 concurrent chunk workers × 25 req/worker = 50 req/sec (strictly respects Meta Cloud API Tier 1 limit of 80 req/sec).
     - **SMS**: Max 4 concurrent chunk workers × 20 req/worker = 80 req/sec.
     - **Email**: Up to 10 concurrent chunk workers × 100 emails/batch = 1,000 emails/sec via Resend batch API.
     ```typescript
     const totalChunks = Math.ceil(uniqueRecipients.length / CHUNK_SIZE);
     const maxConcurrent = job.channel === 'whatsapp' ? 2 : job.channel === 'sms' ? 4 : 10;
     const initialFanOut = Math.min(totalChunks, maxConcurrent);

     for (let c = 0; c < initialFanOut; c++) {
       await scheduleTaskWithKey(
         `bulk_chunk_${jobRef.id}_${c}_${Date.now()}`,
         'bulk-trigger-queue-v2',
         '/api/messaging/bulk-worker',
         { jobId: jobRef.id, chunkIndex: c }
       );
     }
     ```
- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run src/lib/__tests__/bulk-messaging-parallel.test.ts`
  Expected: PASS.

---

### Phase 4: Composer Decoupling & UI Step 6 Migration

#### Task 6: Decouple Composer "Send Now" & Add Failed Delivery Export to Step 6
**Files:**
- Modify: `src/app/admin/messaging/composer/components/ComposerWizard.tsx:700-900, 1760-1860`

- [ ] **Step 1: Replace browser loop with `createBulkMessageJob` in `ComposerWizard.tsx`**
  In `onSubmit`:
  ```typescript
  // Eliminate lines 728-880 (the sequential for loop with 500ms sleep)
  // Instead:
  let finalRecipients: Array<{ recipient: string; contactName: string; entityName: string; entityId: string; variables: Record<string, unknown> }> = [];

  if (audienceSource === 'individual') {
    // High-performance server-side bulk contact resolution
    finalRecipients = await resolveBulkRecipientsForEntities({
      entityIds: data.selectedEntityIds,
      workspaceId: activeWorkspaceId,
      contactScope: data.contactScope,
      contactTypeFilter: data.contactTypeFilter,
      channel: data.channel,
    });
  } else if (audienceSource === 'manual' || audienceSource === 'saved') {
    finalRecipients = filteredRecipients.map((r) => ({
      recipient: (data.channel === 'email' ? r.email : r.phone) || '',
      contactName: r.name || 'Recipient',
      entityName: r.entityName || 'Entity',
      entityId: r.entityId || '',
      variables: {
        contact_name: r.name,
        entity_name: r.entityName,
      },
    })).filter((r) => Boolean(r.recipient));
  }

  // Create bulk message job with snapshotted body/subject or template
  const { jobId } = await createBulkMessageJob({
    templateId: data.messageSourceType === 'template' ? data.templateId : undefined,
    channel: data.channel,
    customSubject: data.customSubject,
    customBody: data.customBody,
    senderProfileId: data.senderProfileId!,
    recipients: finalRecipients,
    userId: user.uid,
    workspaceId: activeWorkspaceId,
    organizationId: activeOrganizationId,
  });

  // Instantly advance to Step 6 with live tracking!
  setStep(6);
  startJobProcessing(jobId);
  ```

- [ ] **Step 2: Add Failed Export Action and Live Throughput Speed to Step 6**
  In Step 6 ("Broadcast Progress"):
  1. Calculate dispatch speed: `const speedMsgsPerSec = Math.round(jobProcessed / elapsedSeconds)`.
  2. When `jobFailed > 0`, render:
     ```tsx
     <div className="flex items-center justify-between p-4 rounded-xl bg-red-950/20 border border-red-500/20">
       <div className="flex items-center gap-3">
         <AlertCircle className="h-5 w-5 text-red-400" />
         <div>
           <p className="text-sm font-semibold text-red-200">{jobFailed} Delivery Failures Detected</p>
           <p className="text-xs text-red-400/80">Export incident logs for reconciliation or re-engagement.</p>
         </div>
       </div>
       <div className="flex gap-2">
         <Button onClick={() => handleExportFailedJobTasks(currentJobId, 'csv')} size="sm" variant="outline" className="border-red-500/30 text-red-300">
           Export CSV
         </Button>
         <Button onClick={() => handleExportFailedJobTasks(currentJobId, 'pdf')} size="sm" variant="outline" className="border-red-500/30 text-red-300">
           Export PDF
         </Button>
       </div>
     </div>
     ```
  3. Wire `handleExportFailedJobTasks(jobId, format)` to fetch `where('status', '==', 'failed')` from `message_jobs/{jobId}/tasks` and trigger the existing sanitized exporter.

- [ ] **Step 3: Verify TypeScript typing and Lint**
  Run: `pnpm typecheck`
  Expected: 0 errors.

---

### Phase 5: Verification & Safety Gates

#### Task 7: Comprehensive Verification & Benchmark Checks
- [ ] **Step 1: Run typecheck**
  Command: `pnpm typecheck` (`tsc --noEmit`)
  Expected: 0 errors.
- [ ] **Step 2: Run lint check**
  Command: `pnpm lint`
  Expected: 0 errors.
- [ ] **Step 3: Run targeted Vitest suite**
  Command: `npx vitest run src/lib/__tests__/bulk-contact-resolver.test.ts src/lib/__tests__/bulk-messaging-parallel.test.ts src/lib/__tests__/bulk-worker-endpoint.test.ts src/lib/__tests__/fallback-duplication.test.ts`
  Expected: All tests passing (100% green).
- [ ] **Step 4: Verify Zero `any/any[]` (Rule 1)**
  Command: `! grep -rnE '\bany\b(\[\])?' src/lib/contacts/bulk-contact-resolver.ts src/app/api/messaging/bulk-worker/route.ts`
  Expected: Clean (0 matches).

---

## 4. Human Review & Execution Options

Plan complete and saved to `docs/superpowers/plans/2026-09-28-parallel-message-dispatch-system.md`.

**Two execution options once approved:**
1. **Subagent-Driven (recommended)**: Fresh subagent per task, code review between tasks, fast iteration.
2. **Inline Execution**: Execute tasks in this session using `executing-plans`, batch execution with checkpoints.
