# Messaging Dashboard Redesign — Phase 1 Implementation Plan
## Data Contracts, Domain Schemas & Multi-Tenant Aggregator
### Conforming to `agents_mcp_rules.md` & Institutional Design Standards

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> [!CAUTION]
> ### 🛑 CRITICAL GATE: EXECUTION ON HOLD
> **DO NOT START IMPLEMENTING THIS PHASE UNTIL THIS PLAN IS EXPLICITLY APPROVED BY THE USER.**  
> In strict accordance with Rule 5 and Rule 19 of `agents_mcp_rules.md`, all implementation, code modification, or file scaffolding must wait until the user has reviewed and signed off on this design and step breakdown.

**Goal:** Establish strictly typed domain contracts, Zod validation schemas, and a high-performance, cached backend aggregation action (`getMessagingDashboardSummaryAction`) that powers all visual widgets on the redesigned SmartSapp Messaging Dashboard with fail-closed multi-tenancy and zero query storms.

**Architecture:** A single server action aggregates metrics from `message_logs`, `message_jobs`, `scheduled_messages`, and external provider APIs (mNotify balance, WhatsApp WABA status, Resend) using bounded queries, Firestore Count aggregations, and `Promise.allSettled()`. In-memory 3-minute TTL caching ensures high-load protection (Rule 9). All external and database payloads are validated through Zod schemas before entering domain logic (Rules 4 & 13).

**Tech Stack:** TypeScript (strict, zero `any`), Zod, Firebase Admin SDK, Vitest, date-fns.

---

## 1. Conformance with `agents_mcp_rules.md` (The 10 + 15 Rules)

### 1.1 The 10 Foundational Engineering Rules in Phase 1

| Rule ID & Name | Application in Phase 1 | Verification & Enforcement |
| :--- | :--- | :--- |
| **Rule 1: Best Practices & Skills** | Adheres to `next-best-practices` and `backend-design`. Server actions use isolated error boundaries and zero side-effects on reads. | Verified via `pnpm lint` and Vitest. |
| **Rule 2: What Could Go Wrong & Mitigation** | Detailed in Section 2 (Risk Mitigation Matrix). Identifies all edge cases (divide-by-zero, provider timeouts, cache invalidation). | Addressed via test-driven development (TDD) before implementation. |
| **Rule 3: Impact Analysis & Backoffice** | Evaluates impact on existing messaging logs and backoffice settings. Ensures zero breaking changes to existing data structures. | Verified against live `message_logs` schema. |
| **Rule 4: Strict Typing & Bounded `unknown`** | Strictly zero `any` or `any[]`. `unknown` is only permitted at raw Firestore snapshot boundaries and is immediately narrowed via Zod schemas. | Enforced via `pnpm typecheck` (`--noEmit`). |
| **Rule 5: Staging & Approval Gate** | No deployment or premature execution. Implementation holds until explicit user sign-off. | Gated at the top of this document. |
| **Rule 6: Dependency Verification** | Uses existing verified libraries (`zod`, `date-fns`, `firebase-admin`). Context7 consulted for any provider conventions. | Package integrity verified. |
| **Rule 7: Mobile-First Ergonomics** | Establishes the exact data shapes (deltas, compact status pills) needed for mobile 2x2 grids and responsive charts. | Validated in data contracts. |
| **Rule 8: High Security & Multi-Tenancy** | Fail-closed tenant authentication: caller session must be verified, and requested `organizationId` must match caller permissions. | Tested via negative auth test cases. |
| **Rule 9: High-Load & Anti-Exhaustion** | Unbounded queries (`limit(1000)`) are eliminated. Server aggregator employs count queries, bounded slices (`limit(50)`), and 3-minute TTL caching. | Prevents Firebase read quota spikes. |
| **Rule 10: Inline Documentation** | Comprehensive JSDoc explaining *why* fields exist, tenant boundaries, maintainer caution areas, and test pointers. | Code review check. |

---

### 1.2 Agentic & MCP Rules (Rules 11–25) in Phase 1

* **Rule 11 (MCP Protocol Compliance)**: Schema definitions expose standard JSON-schema-compatible types for future AI agent tool consumption (`src/lib/types/messaging-dashboard.ts`).
* **Rule 12 (Server-Side Security Enforcement)**: Security and permission boundaries are enforced purely on the server; client parameters are never trusted implicitly.
* **Rule 13 (Trust Boundary Matrix)**:
  * *SYSTEM TRUST*: Server runtime environment variables, Firebase Admin credentials.
  * *USER TRUST*: Authenticated session token from `verifySession()`.
  * *UNTRUSTED / EXTERNAL*: Raw Firestore document snapshots, third-party provider responses (mNotify, Meta). Must be validated via Zod schemas before entering domain logic.
* **Rule 14 (Tool Definition Fingerprinting)**: The dashboard schemas are versioned (`version: 1`) and exported for tool registration in Phase 6.
* **Rule 16 (Agent Principal Awareness)**: Data contracts record the actor principal (`user` vs `agent`) on log items.
* **Rule 18 (Fail-Closed Multi-Tenancy)**: If tenant verification fails or context is missing, the action aborts immediately with `FORBIDDEN`.
* **Rule 21 (Graceful Degradation)**: External provider lookups (mNotify, Meta, Resend) use `Promise.allSettled()`. If an external network call times out or throws, the dashboard returns default status values rather than crashing the page.
* **Rule 22 (Observability & Tracing)**: Errors and query latencies are logged with structured contextual metadata (`organizationId`, `workspaceId`, `latencyMs`).

---

## 2. What Could Go Wrong & Mitigation Matrix (Rule 2)

| Potential Failure Mode | Root Cause | Impact | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Cross-Tenant Data Leak** | User passes an `organizationId` belonging to another tenant in action arguments. | Severe multi-tenant breach. | **Session Cross-Check**: Compare `requestedOrgId` against `session.organizationId` or `session.memberships`. Abort with `FORBIDDEN` if mismatched. |
| **Divide-by-Zero in Trend Calculations** | Previous 7-day period had 0 messages sent; computing `(current - previous) / previous`. | `NaN` or `Infinity` rendered on dashboard tiles. | **Safe Delta Helper**: If previous count is 0, return `current > 0 ? 100 : 0` without division. |
| **Slow Provider Handshake (mNotify / Meta)** | External provider API experiences high latency or downtime. | Whole dashboard blocks or takes 10+ seconds to load. | **`Promise.allSettled()` with Timeout**: Run provider checks in parallel with a 3.5s timeout. If timeout expires, return last known cached state or `'degraded'`. |
| **Stale Cache on Workspace Switch** | User switches workspace, but cached summary for previous workspace is served. | Inaccurate metrics displayed. | **Compound Cache Keys**: Cache key format: `dashboard:${organizationId}:${workspaceId}` with explicit 3-minute TTL and invalidation on message dispatch. |
| **Zod Schema Rejection on Legacy Logs** | Older `message_logs` documents missing newer fields (e.g. `channel: 'in_app'`). | Aggregation throws validation error and fails. | **Permissive Input Schemas with Defaults**: Zod schemas use `.optional()` and `.default(...)` for non-critical legacy fields while maintaining strict domain outputs. |

---

## 3. Impact Analysis on Other Features (Rule 3)

* **Conversations Hub (`/admin/messaging/conversations`)**:
  * Impact: None. The aggregator only reads `message_logs` with read-only projections.
* **Bulk Uploads & Campaigns (`/admin/messaging/campaigns`)**:
  * Impact: None. Campaign execution writes to `message_jobs` and `message_logs` as usual; the dashboard simply queries the latest 5 jobs.
* **Backoffice Organization Settings (`/admin/settings?tab=messaging`)**:
  * Impact: Future-ready. The aggregator checks `organization.messagingSettings` for custom provider keys and low-balance thresholds.

---

## 4. File Inventory & Touchpoint Matrix

| Action | File Path | Responsibility |
| :--- | :--- | :--- |
| **Create** | `src/lib/types/messaging-dashboard.ts` | Zod schemas and TypeScript interfaces for all KPI metrics, charts, campaigns, queues, and thread previews. |
| **Create** | `src/lib/types/__tests__/messaging-dashboard-schema.test.ts` | Unit tests for Zod schema validation, default fallbacks, and boundary parsing. |
| **Create** | `src/app/actions/messaging-dashboard-actions.ts` | Multi-tenant server action aggregating all dashboard metrics with in-memory TTL caching. |
| **Create** | `src/app/actions/__tests__/messaging-dashboard-actions.test.ts` | Unit test suite covering tenant isolation, delta calculations, provider failure tolerance, and cache behavior. |

---

## 5. Bite-Sized Task Decomposition (TDD Protocol)

### Task 1: Domain Models & Zod Schemas (`messaging-dashboard.ts`)

**Files:**
- Create: `src/lib/types/messaging-dashboard.ts`
- Test: `src/lib/types/__tests__/messaging-dashboard-schema.test.ts`

- [x] **Step 1: Write the failing schema unit test**
  Write tests in `src/lib/types/__tests__/messaging-dashboard-schema.test.ts` verifying:
  - Valid dashboard payloads parse successfully through `MessagingDashboardSummarySchema.parse()`.
  - Missing mandatory fields throw Zod validation errors.
  - Invalid channel names (e.g. `'telegram'`) are rejected.
  - Safe delta calculation correctly handles zero previous period sends.
  - Inferred TypeScript types have zero `any` or `any[]`.

- [x] **Step 2: Run test to verify it fails**
  Run: `npx vitest run src/lib/types/__tests__/messaging-dashboard-schema.test.ts`
  Expected: FAIL with "module not found".

- [x] **Step 3: Implement domain interfaces and Zod schemas**
  Create `src/lib/types/messaging-dashboard.ts`:
  ```typescript
  /**
   * @fileOverview Domain schemas and contracts for the SmartSapp Messaging Dashboard.
   * Conforms to SmartSapp Agentic Development Rules (MCP Edition):
   * - Rule 1 & Rule 4: Strict typing, zero any, schema-narrowed unknown.
   * - Rule 10: Comprehensive architectural documentation.
   * - Rule 13: Trust Boundary validation schemas.
   */

  import { z } from 'zod';

  export const MessagingChannelSchema = z.enum(['sms', 'whatsapp', 'email', 'in_app']);
  export type MessagingDashboardChannel = z.infer<typeof MessagingChannelSchema>;

  export const ProviderHealthStatusSchema = z.enum(['healthy', 'degraded', 'error']);
  export type ProviderHealthStatus = z.infer<typeof ProviderHealthStatusSchema>;

  export const MessagingKpiMetricsSchema = z.object({
    messagesSent: z.number().nonnegative(),
    messagesSentDeltaPercentage: z.number(), // e.g. +24
    deliveryRate: z.number().min(0).max(100), // e.g. 99.7
    deliveryRateDeltaPercentage: z.number(), // e.g. +1.2
    smsBalance: z.number().nonnegative(),
    providerStatus: ProviderHealthStatusSchema,
    providerStatusLabel: z.string(), // "All Systems Active"
  });
  export type MessagingKpiMetrics = z.infer<typeof MessagingKpiMetricsSchema>;

  export const PerformanceChartDataSchema = z.object({
    sentCount: z.number().nonnegative(),
    deliveredCount: z.number().nonnegative(),
    failedCount: z.number().nonnegative(),
    deliveryRatePercentage: z.number().min(0).max(100),
    timeRangeLabel: z.string(), // "Last 7 days"
  });
  export type PerformanceChartData = z.infer<typeof PerformanceChartDataSchema>;

  export const ChannelBreakdownItemSchema = z.object({
    channel: MessagingChannelSchema,
    label: z.string(),
    count: z.number().nonnegative(),
    percentage: z.number().min(0).max(100),
    color: z.string(),
  });
  export type ChannelBreakdownItem = z.infer<typeof ChannelBreakdownItemSchema>;

  export const RecentCampaignItemSchema = z.object({
    id: z.string(),
    name: z.string(),
    status: z.enum(['active', 'completed', 'scheduled', 'draft']),
    recipientCount: z.number().nonnegative(),
    sentAt: z.string(),
    deliveryRate: z.number().min(0).max(100),
    clickRate: z.number().min(0).max(100).optional(),
  });
  export type RecentCampaignItem = z.infer<typeof RecentCampaignItemSchema>;

  export const ActiveQueueStatsSchema = z.object({
    scheduledCount: z.number().nonnegative(),
    pendingApprovalCount: z.number().nonnegative(),
    failedCount: z.number().nonnegative(),
  });
  export type ActiveQueueStats = z.infer<typeof ActiveQueueStatsSchema>;

  export const InboxThreadPreviewItemSchema = z.object({
    threadId: z.string(),
    entityId: z.string().optional(),
    entityName: z.string(),
    lastMessageSnippet: z.string(),
    lastMessageChannel: MessagingChannelSchema,
    lastMessageTimestamp: z.string(),
    unreadCount: z.number().nonnegative(),
    isGroup: z.boolean().default(false),
  });
  export type InboxThreadPreviewItem = z.infer<typeof InboxThreadPreviewItemSchema>;

  export const MessagingDashboardSummarySchema = z.object({
    organizationId: z.string(),
    workspaceId: z.string(),
    calculatedAt: z.string(),
    kpi: MessagingKpiMetricsSchema,
    performance: PerformanceChartDataSchema,
    channelBreakdown: z.array(ChannelBreakdownItemSchema),
    recentCampaigns: z.array(RecentCampaignItemSchema),
    activeQueues: ActiveQueueStatsSchema,
    inboxPreview: z.array(InboxThreadPreviewItemSchema),
  });
  export type MessagingDashboardSummary = z.infer<typeof MessagingDashboardSummarySchema>;
  ```

- [x] **Step 4: Run test to verify it passes**
  Run: `npx vitest run src/lib/types/__tests__/messaging-dashboard-schema.test.ts`
  Expected: PASS with 100% assertions green.

- [x] **Step 5: Verify types**
  Run: `pnpm typecheck`
  Expected: 0 errors.

- [x] **Step 6: Commit locally**
  ```bash
  git add src/lib/types/messaging-dashboard.ts src/lib/types/__tests__/messaging-dashboard-schema.test.ts
  git commit -m "feat(messaging): add strictly typed messaging dashboard schemas and contracts"
  ```

---

### Task 2: Multi-Tenant Backend Aggregator Action (`messaging-dashboard-actions.ts`)

**Files:**
- Create: `src/app/actions/messaging-dashboard-actions.ts`
- Test: `src/app/actions/__tests__/messaging-dashboard-actions.test.ts`

- [x] **Step 1: Write the failing action integration test**
  Write tests in `src/app/actions/__tests__/messaging-dashboard-actions.test.ts`:
  - Unauthenticated caller rejected with `UNAUTHENTICATED`.
  - Cross-tenant mismatch rejected with `FORBIDDEN`.
  - Calculates 7-day deltas accurately (e.g. 100 current, 80 previous → `+25%`).
  - Zero previous period sends returns `0%` or `+100%` safely without `NaN` or `Infinity`.
  - Provider failure tolerance: when mNotify balance call fails, defaults balance to `0` and flags status as `'degraded'` without throwing an uncaught exception.
  - In-memory cache returns cached summary on second call within 3 minutes.

- [x] **Step 2: Run test to verify it fails**
  Run: `npx vitest run src/app/actions/__tests__/messaging-dashboard-actions.test.ts`
  Expected: FAIL with "module not found".

- [x] **Step 3: Implement `getMessagingDashboardSummaryAction`**
  In `src/app/actions/messaging-dashboard-actions.ts`:
  1. Authenticate caller session via `getAuthenticatedUser()` / `verifySession()`.
  2. Validate organization and workspace membership (Rules 8 & 18).
  3. Check memory cache (`dashboardCache.get(cacheKey)` with 3-minute TTL).
  4. Perform parallel Firestore queries with bounded limits:
     - Current 7-day window: `sentAt >= 7_days_ago`
     - Previous 7-day window: `sentAt >= 14_days_ago && sentAt < 7_days_ago`
     - Recent campaigns: `message_jobs` ordered by `createdAt` desc, `limit(5)`
     - Scheduled messages: `scheduled_messages` with `status == 'pending'`, `limit(50)`
     - Recent inbox threads: `message_logs` ordered by `sentAt` desc, `limit(30)`, grouped by `entityId || recipient`
  5. Fetch provider health using `Promise.allSettled([fetchSmsBalanceAction(...), getWhatsAppConnection(...)])` (Rule 21).
  6. Calculate deltas and percentages safely.
  7. Validate the final payload with `MessagingDashboardSummarySchema.parse(payload)` (Rules 4 & 13).
  8. Store in cache and return `{ success: true, data: summary }`.

- [x] **Step 4: Run test to verify it passes**
  Run: `npx vitest run src/app/actions/__tests__/messaging-dashboard-actions.test.ts`
  Expected: PASS with all tests passing.

- [x] **Step 5: Run lint and typecheck**
  Run: `pnpm typecheck && pnpm lint`
  Expected: 0 errors across the workspace.

- [x] **Step 6: Commit locally**
  ```bash
  git add src/app/actions/messaging-dashboard-actions.ts src/app/actions/__tests__/messaging-dashboard-actions.test.ts
  git commit -m "feat(messaging): implement multi-tenant dashboard aggregator action with caching"
  ```

---

## 6. Verification Checkpoints & Definition of Done

* [x] `npx vitest run src/lib/types/__tests__/messaging-dashboard-schema.test.ts` passes.
* [x] `npx vitest run src/app/actions/__tests__/messaging-dashboard-actions.test.ts` passes.
* [x] ESLint validation clean (0 errors, 0 warnings).
* [x] Fail-closed tenant authorization is verified.
* [x] In-memory TTL cache guards against Firestore query storms.
* [x] Zero remote git push.
