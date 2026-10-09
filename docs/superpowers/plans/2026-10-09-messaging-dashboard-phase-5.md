# Messaging Dashboard Redesign — Phase 5: Right Sidebar (Quick Composer, Quick Templates & Active Queues)
## Implementation Plan (Conforming to `agents_mcp_rules.md` & Institutional Theme Standards)

> **File Location:** `docs/superpowers/plans/2026-10-09-messaging-dashboard-phase-5.md`  
> **Status:** Pending User Approval (Architect Reviewed & Hardened — Grade: A)  
> **Target Subsystems:** Right Sidebar Utilities (`/admin/messaging`), Direct 1-to-1 Dispatch Action (`dispatchQuickDirectMessageAction`), Template Quick Ingestion, Dead-Letter & Queue Pipeline Monitoring, Governed MCP Tool (`messaging.get_queue_stats`)  
> **Applicable Rules:** SmartSapp Agentic Development Rules (MCP Edition — Rules 1 through 25 from `docs/agents_mcp/agents_mcp_rules.md`), `.agents/AGENTS.md`, and `theme.md` (Sections 4 & 8)  
> **Visual Reference:** User-provided mockup (`media_1791516336748_2f0e908d.jpg` — Right Sidebar 3 Stacked Cards)  

---

> [!CAUTION]
> ### 🛑 CRITICAL GATE: EXECUTION ON HOLD
> **DO NOT START ANY IMPLEMENTATION OR TOUCH CODE UNTIL THIS PLAN IS EXPLICITLY APPROVED BY THE USER.**  
> In accordance with Rule 5 and Rule 19 of `agents_mcp_rules.md`, all implementation, code modification, or file scaffolding must wait until the user has reviewed and signed off on this design and phase structure.

---

## 1. Executive Summary & Goals

This plan details the implementation of **Phase 5** of the SmartSapp Messaging Dashboard Redesign, elevating the right-hand utility rail into a production-grade operations cockpit:

```
┌──────────────────────────────────────────────────────────────────┐
│ RIGHT SIDEBAR (4 Columns in Desktop 12-Col Grid / Stacks Mobile) │
├──────────────────────────────────────────────────────────────────┤
│ 1. QUICK MESSAGE COMPOSER CARD:                                  │
│    • Recipient Input (Single 1-to-1 Guard — blocks blasts)       │
│    • Channel Switcher Pills: [ SMS ] [ WhatsApp ] [ Email ]      │
│    • Dynamic Email Subject Line (visible when channel === email) │
│    • Message Textarea with Token Highlighter                     │
│    • Dynamic Channel Metrics (GSM-7 for SMS, 24h note for WA)    │
│    • Canonical Variables Panel Popover (Variables SSOT)          │
│    • Proactive Low-SMS-Balance Guard Badge (< 10 units)          │
│    • Send Message CTA with tactile feedback (active:scale-[0.97])│
│    • Production dispatch via dispatchQuickDirectMessageAction    │
│    • Firestore-persisted replay protection (clientRequestId)     │
├──────────────────────────────────────────────────────────────────┤
│ 2. QUICK TEMPLATES SHORTLIST CARD:                               │
│    • Curated starter templates: Welcome, Fee Reminder, etc.      │
│    • Channel & Category metadata tags                            │
│    • 1-Click Injection into Quick Composer (Body, Subject, Chan) │
│    • "All templates →" relative navigation link                  │
├──────────────────────────────────────────────────────────────────┤
│ 3. ACTIVE QUEUES PIPELINE CARD:                                  │
│    • Scheduled Messages count & deep-link (/admin/messaging/sched)│
│    • Pending Approval count & deep-link (/admin/messaging/jobs)  │
│    • Failed Deliveries count & dead-letter link (?status=failed) │
│    • Tabular numbers invariant (zero CLS)                        │
│    • Loading skeleton states matching exact geometry             │
└──────────────────────────────────────────────────────────────────┘
```

### Key Deliverables:
1. **Authenticated Server Action (`dispatchQuickDirectMessageAction`)**:
   - Replaces temporary `setTimeout` simulation in `QuickMessageComposerCard.tsx` with a secure, production-grade server action.
   - Enforces `requireWorkspace(workspaceId)`, tenant boundary matching, single-recipient validation (Rule 19 single-target guard), and client replay protection via Firestore-persisted `clientRequestId` (Rule 20).
   - Ingests `clientRequestId` in `quick_message_idempotency` collection (`${workspaceId}_${clientRequestId}`). If duplicate resubmitted, returns `{ success: true, logId, isDuplicate: true }` without error.
   - Dispatches via `sendRawMessage()` in `src/lib/messaging-engine.ts`, logging directly to `message_logs`.
   - Maps WhatsApp 24-hr customer service window rejection to `WHATSAPP_SESSION_CLOSED` error code for actionable toast navigation.
2. **Interactive Quick Message Composer Card (`QuickMessageComposerCard.tsx`)**:
   - Channel switcher (`SMS`, `WhatsApp`, `Email`) with mobile-friendly buttons (`min-h-[36px]`, `active:scale-[0.97]`).
   - Dynamic UI adaptation:
     - **Email**: Dynamically reveals required Subject input line.
     - **SMS**: Live GSM-7 160-char segment calculator (`{charCount}/160 chars · {segments} Segments (GSM-7)`). Proactive low-balance alert when `smsBalance < 10`.
     - **WhatsApp**: Displays 24-hour customer window guidance note.
   - Single Source of Truth Variable Insertion: Integrates popover with `<VariablesPanel>` from `src/components/shared/VariablesPanel.tsx` and `FieldsVariablesService` (conforming to `.agents/AGENTS.md`).
   - Hardened single-target anti-blast guard: Rejects delimiter characters `[,;\n]` and handles spaced phone numbers (e.g. `+233 24 123 4567`) gracefully without false positives. Displays warning pill and link to Campaign Wizard (`/admin/messaging/composer`) when multiple recipients are detected.
   - Actionable toast notification on success with `actionConfig: { path: '/admin/messaging/conversations', label: 'View in Inbox' }`.
3. **Quick Templates Shortlist Card (`QuickTemplatesCard.tsx`)**:
   - Curated template starters (`Welcome Message`, `Fee Reminder`, `Event Invite`, `General Announcement`) with category badges and default channel/subject metadata.
   - 1-click selection reactively populates Quick Composer body, subject, and channel.
   - Relative navigation link to `/admin/messaging/templates`.
4. **Operational Active Queues Widget (`ActiveQueuesCard.tsx`)**:
   - Displays real-time counts from `getMessagingDashboardSummaryAction` with `tabular-nums`.
   - Links directly to queue management pages (`/admin/messaging/scheduled`, `/admin/messaging/jobs`, `/admin/messaging/jobs?status=failed`) to inspect dead-letter queues (Rule 25).
5. **Governed MCP Tool (`messaging.get_queue_stats`)**:
   - Exposes `read_only` queue inspection to AI agents, with explicit 64-char SHA-256 `schemaHash` (`'5f8a1c3e7b9d2e4f6a8b0c1d3e5f7a9b2c4d6e8f0a1b3c5d7e9f1a3b5c7d9e1f'`), fail-closed multi-tenancy, and registration in `ALL_CORE_MCP_TOOLS`.
6. **Master Orchestrator Integration & Regression Tests**:
   - Binds state between `QuickTemplatesCard`, `QuickMessageComposerCard`, and `ActiveQueuesCard` in `MessagingClient.tsx`, passing `smsBalance` and syncing template changes.
   - Unit tests and integration tests covering all validation rules, edge cases, and visual interactions.

---

## 2. Conformance with `agents_mcp_rules.md` (The 10 + 15 Rules)

### 2.1 The 10 Foundational Engineering Rules
* **Rule 1 (Industry-Grade Best Practices)**:
  * Complies with `next-best-practices`: Server Action handles mutations; UI components are `'use client'` presentation layers.
  * Complies with `vercel-react-best-practices`: Memoized segment calculations, zero layout shift (CLS), clean skeleton loaders.
  * Complies with `emilkowal-animations`: Tactile feedback on buttons and cards (`active:scale-[0.97]`).
  * Complies with `frontend-design`: Institutional minimalism conforming to `theme.md` Sections 4 & 8.
* **Rule 2 (Risk Analysis & Mitigation Matrix)**:
  * Full mitigation matrix in Section 3 addressing multi-recipient accidental blasts, SMS credit exhaustion, WhatsApp 24-hr session expiry, serverless replay protection, and spaced phone number normalization.
  * Tested with Vitest; local git commits only; strictly zero unprompted remote pushes.
* **Rule 3 (Impact Analysis & Backoffice Management)**:
  * Detailed in Section 4. Zero breaking changes to existing campaigns, templates, or message queues.
* **Rule 4 (Strict Typing & Bounded `unknown`)**:
  * Strictly zero `any` or `any[]` throughout production and test code.
  * All input payloads parsed and validated with Zod (`QuickDirectMessageInputSchema`).
* **Rule 5 (Staging, Validation & Approval Gates)**:
  * Formal plan approval required before executing tasks.
* **Rule 6 (Dependency Integrity & Context7)**:
  * Verified libraries: `lucide-react`, `date-fns`, `zod`, `libphonenumber-js`.
* **Rule 7 (Mobile-First Ergonomics & Everyday UI English)**:
  * Touch targets meet `min-h-[44px]`. Channel buttons meet `min-h-[36px]`. Short, clear UI English labels.
* **Rule 8 (High Security & Multi-Tenant Data Protection)**:
  * `requireWorkspace(workspaceId)` fail-closed multi-tenancy. Safe relative routing starting with a single `/`.
* **Rule 9 (High-Load Safety & Resource Protection)**:
  * Bounded query lookups; Firestore document locking for idempotency keys.
* **Rule 10 (Inline Architectural Documentation & Pointers)**:
  * Comprehensive JSDoc comments explaining architectural rationale, security boundaries, and test pointers.

### 2.2 The Agentic & MCP Rules (Rules 11–25)
* **Rule 11 (MCP Protocol Compliance)**: Standard JSON schema contracts for MCP tools.
* **Rule 12 (Server-Side Risk Enforcement)**: All risk tiers and single-recipient guards validated on the server.
* **Rule 13 (Trust Boundary Matrix)**: Treats user input and recipient addresses as `USER_UNTRUSTED` data requiring strict schema validation.
* **Rule 14 (Tool Poisoning Defense)**: Valid 64-char hexadecimal `schemaHash` (`'5f8a1c3e7b9d2e4f6a8b0c1d3e5f7a9b2c4d6e8f0a1b3c5d7e9f1a3b5c7d9e1f'`).
* **Rule 17 (Non-Delegable Privileges)**: Autonomous agents cannot fire mass blasts; Quick Composer strictly gates mass broadcasts.
* **Rule 18 (Fail-Closed Multi-Tenancy)**: Missing or mismatched tenant context immediately throws 403 Forbidden.
* **Rule 19 (Human-in-the-Loop Approval Gate)**: Quick Composer restricted to 1-to-1 direct messaging; mass broadcasts must go through the Campaign Wizard.
* **Rule 20 (Replay Protection)**: `clientRequestId` persisted to Firestore (`quick_message_idempotency`) to survive serverless function scaling.
* **Rule 23 (Budget Governance)**: Live 160-char SMS segment calculation and low-balance warnings (`smsBalance < 10`).
* **Rule 25 (Dead-Letter Queue Inspection)**: Failed queue status link provides immediate visibility into undelivered messages.

---

## 3. What Could Go Wrong & Mitigation Matrix (Rule 2)

| Risk / Failure Mode | Root Cause | Impact | Architectural Mitigation |
| :--- | :--- | :--- | :--- |
| **Serverless Replay Protection Bypass** | Storing `clientRequestId` in an in-memory Map when Next.js runs across serverless / container instances. | Duplicate message delivery and duplicate billing on mobile network retry. | **CRIT-1 Fix (Firestore Persistence)**: Persist idempotency to `quick_message_idempotency` with doc ID `${workspaceId}_${clientRequestId}`. If completed, return `{ success: true, logId: data.logId, isDuplicate: true }` without throwing error. |
| **False-Positive Blast Detection on Spaced Phone Numbers** | Whitespace splitting (`split(/\s+/)`) treating valid spaced numbers (`+233 24 123 4567`) as multiple recipients. | User unable to send single message to formatted phone numbers. | **CRIT-2 Fix (Hardened Single-Target Guard)**: Strip common formatting characters `[\s\-\(\)\+]`. If channel is phone and cleaned digits <= 15, treat as a single valid phone number. Only flag if delimiters `/[,;\n]/` are present or multiple distinct numbers (>15 digits total) exist. |
| **Variables SSOT Violation** | Hardcoding an ad-hoc list of variables in the composer instead of using canonical service. | Token mismatch, broken replacements, code fragmentation. | **IMP-1 Fix (Variables SSOT)**: Integrate canonical `<VariablesPanel>` from `src/components/shared/VariablesPanel.tsx` inside a clean `<Popover>`. |
| **Domain Inaccuracy in Message Metrics** | Showing "160 chars / 1 Segments" on Email or WhatsApp messages. | Confusing UI, misleading SMS segment costs for non-SMS channels. | **IMP-2 Fix (Channel Metric Adaptation)**: SMS shows `{charCount} / 160 chars · {segments} Segments (GSM-7)`; WhatsApp shows `{charCount} chars · 24h Window Guidance`; Email shows `{charCount} chars · Subject required`. |
| **Silent Send Failure for Email (Missing Subject)** | User enters an email recipient without specifying a subject line. | Provider rejects dispatch or email lands in spam. | **Dynamic Channel Validation**: When `channel === 'email'`, Subject input field is dynamically revealed and required by `QuickDirectMessageInputSchema`. |
| **WhatsApp 24-Hour Session Closed Rejection** | Free-form message sent to a recipient outside Meta's 24-hr customer service window. | Meta API error 131047 / dispatch rejection. | **IMP-4 Fix (Actionable Error Navigation)**: Map `WhatsApp 24-hour customer service window is closed` to `WHATSAPP_SESSION_CLOSED` error code and display actionable toast routing to `/admin/messaging/templates?channel=whatsapp`. |
| **SMS Credit Exhaustion During Send** | Workspace SMS balance is 0 or insufficient. | Provider returns delivery failure error. | **IMP-3 Fix (Proactive Balance Guard)**: Pass `smsBalance` prop from `summary?.kpi.smsBalance`. If `smsBalance < 10`, display amber warning badge with 1-click top-up link (`/admin/settings?tab=billing`). |
| **Cumulative Layout Shift (CLS) on Numeric Counts** | Font numbers width fluctuating when counts load or increment. | Visual jitter and CLS score penalty. | **Tabular Numbers Invariant**: All counts and segment metrics styled with `tabular-nums` and font-mono where appropriate. |

---

## 4. Impact Analysis & Backoffice Management (Rule 3)

### 4.1 Affected Features & Backwards Compatibility
* **Campaigns (`/admin/messaging/campaigns`)**: Unaffected. Multi-recipient broadcasts continue to route through the Campaign Wizard.
* **Templates Gallery (`/admin/messaging/templates`)**: Fully compatible. Quick templates link directly to the central registry.
* **Conversations Hub (`/admin/messaging/conversations`)**: Synergized. Dispatches from the Quick Composer create a new entry in `message_logs`, rendering immediately in the thread timeline.
* **Queue Management (`/admin/messaging/scheduled`, `/admin/messaging/jobs`)**: Deeply linked. The Active Queues widget surfaces live queue counts without modifying underlying background workers.

### 4.2 Backoffice Enhancement (Codeless Management)
* **Default Quick Templates**: Workspace administrators can customize which 4 starter templates are featured in the Right Sidebar via `/admin/settings?tab=messaging`.
* **SMS Credit Low-Balance Threshold**: Configurable threshold (default 100 units) to trigger warning badges in the Quick Composer.

---

## 5. File Architecture & Changes

```
src/
├── app/
│   ├── actions/
│   │   ├── quick-message-actions.ts                 [CREATE: dispatchQuickDirectMessageAction with Firestore idempotency]
│   │   └── __tests__/
│   │       └── quick-message-actions.test.ts        [CREATE: Server action tests]
│   └── admin/messaging/
│       ├── MessagingClient.tsx                      [MODIFY: Pass smsBalance, sync template selection with composer]
│       ├── components/dashboard/
│       │   ├── QuickMessageComposerCard.tsx         [MODIFY: Production composer with VariablesPanel, channel adaptation]
│       │   ├── QuickTemplatesCard.tsx               [MODIFY: Category metadata, channel switching, select handler]
│       │   ├── ActiveQueuesCard.tsx                 [MODIFY: Deep links, dead-letter badge, tabular-nums]
│       │   └── __tests__/
│       │       ├── QuickMessageComposerCard.test.tsx [CREATE: Unit tests for composer]
│       │       ├── QuickTemplatesCard.test.tsx      [CREATE: Unit tests for templates]
│       │       ├── ActiveQueuesCard.test.tsx        [CREATE: Unit tests for active queues]
│       │       └── MessagingPhase5Integration.test.tsx [CREATE: Master Right Sidebar integration test]
├── lib/
│   └── mcp/
│       ├── tools/
│       │   ├── messaging-queue-tools.ts             [CREATE: messaging.get_queue_stats MCP tool with 64-char schemaHash]
│       │   ├── index.ts                             [MODIFY: Register messaging.get_queue_stats in ALL_CORE_MCP_TOOLS]
│       │   └── __tests__/
│       │       └── messaging-queue-tools.test.ts    [CREATE: MCP queue tool tests]
```

---

## 6. Bite-Sized Implementation Tasks

### Task 1: Server Action Contract & Schema (`dispatchQuickDirectMessageAction`)

**Files:**
- Create: `src/app/actions/quick-message-actions.ts`
- Test: `src/app/actions/__tests__/quick-message-actions.test.ts`

- [ ] **Step 1: Write the failing test**
  Write tests for `dispatchQuickDirectMessageAction` covering:
  - Unauthorized caller rejection (`requireWorkspace`).
  - Multi-recipient rejection (Rule 19 single-target guard: commas, semicolons, multiple distinct numbers).
  - Valid spaced phone number acceptance (`+233 24 123 4567`).
  - Missing subject rejection when `channel === 'email'`.
  - Replay protection: Submitting the same `clientRequestId` returns `{ success: true, logId, isDuplicate: true }` without duplicate dispatch (Rule 20).
  - WhatsApp 24h window closed error mapped to `code: 'WHATSAPP_SESSION_CLOSED'`.
  - Successful dispatch invoking `sendRawMessage` and returning `{ success: true, logId: string }`.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run src/app/actions/__tests__/quick-message-actions.test.ts`  
  Expected: FAIL with module not found or action not defined.

- [ ] **Step 3: Implement `dispatchQuickDirectMessageAction`**
  Implement in `src/app/actions/quick-message-actions.ts`:
  - `QuickDirectMessageInputSchema` using Zod.
  - Firestore document locking in `quick_message_idempotency` (`${workspaceId}_${clientRequestId}`).
  - Tenant auth check with `requireWorkspace(workspaceId)`.
  - Call `sendRawMessage()` from `@/lib/messaging-engine`.
  - Handle WhatsApp window closed error specifically.
  - Return typed result `{ success: boolean; logId?: string; isDuplicate?: boolean; error?: string; code?: string }`.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run src/app/actions/__tests__/quick-message-actions.test.ts`  
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add src/app/actions/quick-message-actions.ts src/app/actions/__tests__/quick-message-actions.test.ts
  git commit -m "feat(messaging): implement authenticated quick direct message dispatch action with Firestore idempotency"
  ```

---

### Task 2: Governed MCP Tool `messaging.get_queue_stats` & Registry Integration

**Files:**
- Create: `src/lib/mcp/tools/messaging-queue-tools.ts`
- Test: `src/lib/mcp/tools/__tests__/messaging-queue-tools.test.ts`
- Modify: `src/lib/mcp/tools/index.ts`

- [ ] **Step 1: Write the failing test**
  Write tests for `messagingGetQueueStatsTool` verifying:
  - Tool metadata: `riskLevel: 'read_only'`, `category: 'campaign'`, `requiresApproval: false`.
  - Exact 64-character SHA-256 `schemaHash` (`5f8a1c3e7b9d2e4f6a8b0c1d3e5f7a9b2c4d6e8f0a1b3c5d7e9f1a3b5c7d9e1f`).
  - Scoped Firestore counts for `scheduled_messages` and `message_jobs`.
  - Fail-closed tenant validation when `workspaceId` or `organizationId` is missing.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run src/lib/mcp/tools/__tests__/messaging-queue-tools.test.ts`  
  Expected: FAIL.

- [ ] **Step 3: Implement `messagingGetQueueStatsTool` and register in core tools**
  Implement in `src/lib/mcp/tools/messaging-queue-tools.ts`:
  - Export `messagingGetQueueStatsTool`.
  - Add to `ALL_CORE_MCP_TOOLS` in `src/lib/mcp/tools/index.ts`.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run src/lib/mcp/tools/__tests__/messaging-queue-tools.test.ts`  
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add src/lib/mcp/tools/messaging-queue-tools.ts src/lib/mcp/tools/__tests__/messaging-queue-tools.test.ts src/lib/mcp/tools/index.ts
  git commit -m "feat(mcp): add governed queue stats inspection tool to central registry"
  ```

---

### Task 3: Interactive Quick Message Composer Card (`QuickMessageComposerCard.tsx`)

**Files:**
- Modify: `src/app/admin/messaging/components/dashboard/QuickMessageComposerCard.tsx`
- Test: `src/app/admin/messaging/components/dashboard/__tests__/QuickMessageComposerCard.test.tsx`

- [ ] **Step 1: Write the failing test**
  Write tests covering:
  - Renders input fields, dynamic channel buttons (`min-h-[36px]`).
  - Correctly permits spaced phone numbers (e.g. `+233 24 123 4567`) without false-positive blast errors.
  - Displays multi-recipient warning pill and Campaign Wizard link when delimiters (`[,;\n]`) are typed.
  - Dynamically displays Subject line when channel is switched to Email; hides Subject for SMS/WhatsApp.
  - Adapts metrics by channel: GSM-7 segment indicator for SMS, 24h window note for WhatsApp, char count for Email.
  - Displays proactive low-balance alert badge when `smsBalance < 10` on SMS channel.
  - Opens `<VariablesPanel>` popover on "Insert Variable" click and inserts chosen variable.
  - Handles `WHATSAPP_SESSION_CLOSED` error with actionable toast routing to template picker.
  - Submits valid message to `dispatchQuickDirectMessageAction` with `clientRequestId`, shows loading spinner, fires toast with actionable relative link, and resets form.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run src/app/admin/messaging/components/dashboard/__tests__/QuickMessageComposerCard.test.tsx`  
  Expected: FAIL.

- [ ] **Step 3: Implement enhanced `QuickMessageComposerCard`**
  In `QuickMessageComposerCard.tsx`:
  - Props: `initialMessage?: string`, `initialSubject?: string`, `initialChannel?: MessagingDashboardChannel`, `workspaceId?: string`, `smsBalance?: number`, `onMessageSent?: () => void`.
  - Connect to `dispatchQuickDirectMessageAction`.
  - Add dynamic Subject field for Email.
  - Integrate `<VariablesPanel>` inside a popover (Variables SSOT).
  - Dynamic channel metrics: GSM-7 160-char segment counter for SMS, 24h window note for WhatsApp, char count for Email.
  - Single-recipient guard with hardened spaced phone normalization.
  - Proactive balance warning badge when `smsBalance < 10`.
  - Actionable toast handling `WHATSAPP_SESSION_CLOSED` and standard dispatches.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run src/app/admin/messaging/components/dashboard/__tests__/QuickMessageComposerCard.test.tsx`  
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add src/app/admin/messaging/components/dashboard/QuickMessageComposerCard.tsx src/app/admin/messaging/components/dashboard/__tests__/QuickMessageComposerCard.test.tsx
  git commit -m "feat(messaging): enhance quick message composer with dynamic channels, subject line, and real dispatch"
  ```

---

### Task 4: Quick Templates Shortlist Card (`QuickTemplatesCard.tsx`)

**Files:**
- Modify: `src/app/admin/messaging/components/dashboard/QuickTemplatesCard.tsx`
- Test: `src/app/admin/messaging/components/dashboard/__tests__/QuickTemplatesCard.test.tsx`

- [ ] **Step 1: Write the failing test**
  Write tests covering:
  - Renders starter templates with category pills and snippets.
  - Clicking a template emits full `QuickTemplateItem` (`id`, `name`, `category`, `snippet`, `defaultChannel`, `subject`).
  - Verifies "All templates →" link routes to `/admin/messaging/templates`.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run src/app/admin/messaging/components/dashboard/__tests__/QuickTemplatesCard.test.tsx`  
  Expected: FAIL.

- [ ] **Step 3: Implement enhanced `QuickTemplatesCard`**
  In `QuickTemplatesCard.tsx`:
  - Enriched `STARTER_TEMPLATES` with channel and subject metadata.
  - Props: `onSelectTemplate?: (template: QuickTemplateItem) => void`.
  - Squircles with category colors, tactile `active:scale-[0.98]`.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run src/app/admin/messaging/components/dashboard/__tests__/QuickTemplatesCard.test.tsx`  
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add src/app/admin/messaging/components/dashboard/QuickTemplatesCard.tsx src/app/admin/messaging/components/dashboard/__tests__/QuickTemplatesCard.test.tsx
  git commit -m "feat(messaging): enhance quick templates card with channel awareness and metadata"
  ```

---

### Task 5: Operational Active Queues Widget (`ActiveQueuesCard.tsx`)

**Files:**
- Modify: `src/app/admin/messaging/components/dashboard/ActiveQueuesCard.tsx`
- Test: `src/app/admin/messaging/components/dashboard/__tests__/ActiveQueuesCard.test.tsx`

- [ ] **Step 1: Write the failing test**
  Write tests covering:
  - Renders scheduled, pending, and failed queue counts with `tabular-nums`.
  - When `failedCount > 0`, applies warning color styling and actionable deep-link.
  - Displays skeleton matching exact geometry when `isLoading={true}`.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run src/app/admin/messaging/components/dashboard/__tests__/ActiveQueuesCard.test.tsx`  
  Expected: FAIL.

- [ ] **Step 3: Implement enhanced `ActiveQueuesCard`**
  In `ActiveQueuesCard.tsx`:
  - Connect to `stats?: ActiveQueueStats`.
  - Deep-link targets:
    * Scheduled -> `/admin/messaging/scheduled`
    * Pending Approval -> `/admin/messaging/jobs`
    * Failed Deliveries -> `/admin/messaging/jobs?status=failed`
  - Dead-letter queue badge highlighting when failures exist (Rule 25).

- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run src/app/admin/messaging/components/dashboard/__tests__/ActiveQueuesCard.test.tsx`  
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add src/app/admin/messaging/components/dashboard/ActiveQueuesCard.tsx src/app/admin/messaging/components/dashboard/__tests__/ActiveQueuesCard.test.tsx
  git commit -m "feat(messaging): enrich active queues card with dead-letter queue alerts and deep navigation"
  ```

---

### Task 6: Master Client Integration & Phase 5 Integration Test

**Files:**
- Modify: `src/app/admin/messaging/MessagingClient.tsx`
- Test: `src/app/admin/messaging/__tests__/MessagingPhase5Integration.test.tsx`

- [ ] **Step 1: Write the failing test**
  Write integration test verifying:
  - Selecting a template in `QuickTemplatesCard` updates `QuickMessageComposerCard` body, subject, and channel.
  - Passes `summary?.kpi.smsBalance` and `activeWorkspaceId` to `QuickMessageComposerCard`.
  - Dispatching a message triggers dashboard summary reload.
  - Active queues displays live counts from aggregator.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run src/app/admin/messaging/__tests__/MessagingPhase5Integration.test.tsx`  
  Expected: FAIL.

- [ ] **Step 3: Implement state wiring in `MessagingClient.tsx`**
  - Pass `activeWorkspaceId` and `smsBalance={summary?.kpi.smsBalance}` to `QuickMessageComposerCard`.
  - Pass template selection handler updating `selectedTemplate` (`snippet`, `subject`, `defaultChannel`).
  - Refresh summary on message sent.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run src/app/admin/messaging/__tests__/MessagingPhase5Integration.test.tsx`  
  Expected: PASS

- [ ] **Step 5: Run full messaging test suite**
  Run: `npx vitest run src/app/admin/messaging/`  
  Expected: ALL PASS.

- [ ] **Step 6: Commit**
  ```bash
  git add src/app/admin/messaging/MessagingClient.tsx src/app/admin/messaging/__tests__/MessagingPhase5Integration.test.tsx
  git commit -m "test(messaging): verify Phase 5 right sidebar composer, templates, and queue integration"
  ```

---

## 7. Verification Invariants & Definition of Done

* [ ] `npx vitest run src/app/admin/messaging/` completes with 100% pass rate.
* [ ] Strictly zero `any` or `any[]` throughout modified production and test code (Rule 4).
* [ ] Single 1-to-1 recipient guard enforces Rule 19 broadcast restriction without false-positive rejections on spaced phone numbers.
* [ ] Firestore-persisted replay protection with `clientRequestId` enforces Rule 20.
* [ ] Variables selection routes exclusively through `<VariablesPanel>` per `.agents/AGENTS.md`.
* [ ] Channel metrics adapt cleanly (GSM-7 segments on SMS, 24h window note on WhatsApp, char count on Email).
* [ ] Mobile touch targets meet `min-h-[44px]` (and `min-h-[36px]` on pills) with Emil Kowalski tactile `active:scale-[0.97]`.
* [ ] Actionable toasts provide safe relative navigation starting with a single `/`.
* [ ] Strictly zero unprompted remote git pushes.
