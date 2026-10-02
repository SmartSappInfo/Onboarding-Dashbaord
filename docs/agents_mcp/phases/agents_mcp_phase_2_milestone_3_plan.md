# Phase 2 — Unified Event & Activity Backbone
## Milestone 3 Implementation Plan: UI Surfaces, Live SSE Stream & Operator Console
### Conformance Updated with `agents_mcp_rules.md` (Rules 1–69) & `theme.md` (§8 Modal Architecture)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the user-facing real-time activity stream via Server-Sent Events (SSE), the reusable `<ActivityTimeline2 />` component with Emil Kowalski micro-interactions, the Standardized Inspect Drawer adhering to `theme.md` §8 Modal Architecture, the Dead-Letter Queue Operator Console (`<DeadLetterQueueDrawer />`), and the Global Activity Dashboard at `/admin/activity` (with seamless legacy `/admin/activities` preservation).

**Architecture:** A Server-Sent Events (SSE) route handler (`/api/events/stream`) establishes an authenticated, multi-tenant real-time pipeline directly from `EventBus` to the browser, with graceful polling fallback upon network disconnection. Client components render standardized actor profiles (Human, AI, Automation, System), plain English summaries, and deep OpenTelemetry trace inspection drawers. Operators gain 1-click inspection, replay, and discard controls over quarantined events via the Dead-Letter Queue Drawer.

**Tech Stack:** Next.js 15 (App Router, Server Actions, Route Handlers), React 19, TypeScript (strict mode, zero `any`), Tailwind CSS, Radix UI Dialog & Tooltip primitives, Lucide Icons, Firestore compound indexes, Vitest.

---

## 1. Governing Rules & Invariant Conformance Matrix

| Rule | Title | Specific Requirement in Milestone 3 | Conformance & Safeguard Architecture |
| :--- | :--- | :--- | :--- |
| **Rule 1** | **Preserve Pre-existing Functionality** | No regression in existing activity log queries or admin views | Legacy `/admin/activities` forwards transparently to `/admin/activity`; all 80 baseline regression suites (788 tests) remain 100% green. |
| **Rule 4** | **Strict Typing Protocol** | Zero `any` or `any[]`; narrow `unknown` at trust boundaries | Pure Zod schemas for activity filters, DLQ actions, SSE messages; narrow `unknown` at trust boundaries. Full repo passes `tsc --noEmit`. |
| **Rule 7** | **Visual Clarity & Everyday UI English** | Activity summaries and UI error toasts must use simple, everyday language | Summaries rendered as natural human sentences (e.g. *"Sarah Connor created deal 'Series A'"*). Error toasts contain actionable plain English navigation. |
| **Rule 8** | **High Security Standards & Anti-IDOR** | Prevent cross-tenant event access over SSE streams | `/api/events/stream` verifies user authentication and scopes event streaming strictly to the caller's `organizationId` and optional `workspaceId`. |
| **Rule 9** | **Batching & Resource Exhaustion Defense** | Bounded pagination; prevent SSE connection leaks in Cloud Run | Bounded cursor pagination (`default: 50, max: 100`); SSE streams automatically terminate on client disconnect (`request.signal.addEventListener('abort')`) to prevent dangling listeners in Cloud Run instances. |
| **Rule 10** | **Inline Architectural Comments** | Document changes, caution areas, and testability | Every newly authored file contains `@fileOverview` detailing design decisions, why it changed, caution areas for future maintainers, and testability pointers. |
| **Rule 13** | **Trust Boundary Matrix & XSS Defense** | Sanitize all raw event payloads before UI display | Event payloads and actor summaries displayed in the UI are sanitized to eliminate `<script>`, `<style>`, and raw HTML tags (`sanitizeText`). |
| **Rule 16** | **Natural Language Feedback & Actor Classes** | Explicit classification of actors in the UI | Visual actor badges in `<ActivityItem2 />` clearly classify actors: 👤 User (blue), 🤖 AI (purple with `Sparkles`), ⚡ Automation (amber with `Zap`), ⚙️ System (slate with `Settings2`). |
| **Rule 20** | **Replay Protection & Duplicate Guard** | DLQ replay actions preserve idempotency | Replaying quarantined events routes through existing idempotent pipeline (`${organizationId}_${eventId}`); duplicate re-deliveries are safely deduped. |
| **Rule 24** | **Cascade Failure Defense & Error Isolation** | Client stream resilience against network outages | Client-side `useEventStream` handles disconnects gracefully with exponential backoff and automatic polling fallback without crashing UI. |
| **Rule 25** | **Dead-Letter & Recovery Queues** | Operator visibility and replay controls | Dead-Letter Queue Operator Console (`<DeadLetterQueueDrawer />`) provides complete operator inspection, 1-click retry dispatch, and discard capabilities for quarantined events. |
| **Rule 39** | **OpenTelemetry Trace Propagation** | Preserve correlation across distributed hops | `<ActivityInspectDrawer />` renders distributed tracing metadata (`traceparent`, `correlationId`, `causationId`) and execution latency. |
| **Rule 40** | **Append-Only Immutability for Activities** | Activities must never be mutated in the UI | Timeline UI treats activity records as strictly append-only; zero inline editing of historic activity entries. |
| **Rule 41 & 47** | **Multi-Tenant Isolation by Default** | Strict tenant boundary enforcement | SSE route and Server Actions enforce strict tenant scoping (`organizationId` and `workspaceId`). Cross-tenant queries are blocked. |
| **Rule 60** | **Emergency Dead-Man Controls** | Instant halt capability without code redeploy | Global activity UI displays live status and respects emergency dead-man controls. |
| **Rule 61 & 62** | **Backoffice Control Plane & Security Center** | DLQ and event throughput statistics integrated into Backoffice | Dead-letter operator controls integrated into the admin console with red badge alert counters. |
| **Rule 64** | **Three-Tier Feature Flag Hierarchy** | Workspace $\to$ Organization $\to$ Global flags | Feature flag toggles evaluated hierarchically for real-time streaming enablement. |
| **Rule 69** | **Master Layering Axiom & Compatibility** | UI actions and AI agents emit identical events | Legacy `/admin/activities` seamlessly renders the unified feed; automations and CRM touchpoints remain 100% operational. |
| **Modal SSOT** | **theme.md §8 Modal Architecture** | Demarcated header, CardInfoTooltip, single-circle, sr-only description | All modals and drawers bind to `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`, demarcated headers, `<CardInfoTooltip text="..." />`, single-circle info tooltip at `z-[10050]`, `sr-only` descriptions, demarcated footers, and tactile buttons (`rounded-xl active:scale-[0.97]`). |
| **Fields SSOT** | **FieldsVariablesService SSOT** | Double-brace template token resolution | Any template resolution routes exclusively through `FieldsVariablesService.resolveTemplateVariables`. |
| **Tags SSOT** | **TagSelector SSOT** | Standardized contact tag selection | Tagging operations route exclusively through `<TagSelector>`. |

---

## 2. File Structure Map

```
src/
├── app/
│   ├── actions/
│   │   └── activity-actions.ts                # Typed Server Actions for activity queries & DLQ ops
│   ├── admin/
│   │   ├── activity/
│   │   │   ├── page.tsx                      # Server component for Global Activity Dashboard
│   │   │   └── GlobalActivityClient.tsx      # Three-zone responsive admin client dashboard
│   │   └── activities/
│   │       └── page.tsx                      # Backward-compatible redirect/alias to /admin/activity
│   └── api/
│       └── events/
│           └── stream/
│               └── route.ts                  # Authenticated multi-tenant SSE route handler
├── components/
│   └── activity/
│       ├── ActivityItem2.tsx                 # Standardized activity item with actor badges & tactile feedback
│       ├── ActivityTimeline2.tsx             # Reusable timeline component with live stream & filters
│       ├── ActivityInspectDrawer.tsx         # theme.md §8 Modal Architecture inspection drawer
│       └── DeadLetterQueueDrawer.tsx         # Operator console for reviewing & replaying DLQ events
├── hooks/
│   └── useEventStream.ts                     # React hook managing SSE lifecycle, heartbeats & reconnects
├── firestore.indexes.json                    # Modify: Add composite index for activities (actor.type + timestamp)
└── platform/
    └── __tests__/
        ├── events/
        │   ├── event-stream-route.test.ts    # SSE authentication, tenant filtering & abort teardown tests
        │   └── activity-actions.test.ts      # Server action authorization & DLQ replay tests
        └── ui/
            ├── activity-timeline2.test.tsx   # Timeline filtering, pagination & actor badges tests
            ├── activity-inspect-drawer.test.tsx # theme.md §8 modal compliance & trace rendering tests
            ├── dlq-drawer.test.tsx           # DLQ operator drawer replay & discard tests
            └── global-activity-page.test.tsx # Global page rendering & legacy alias tests
```

---

## 3. Detailed Milestone Tasks & TDD Specifications

### Task 1: Real-Time SSE Stream Route Handler (`/api/events/stream`) & Client Hook (`useEventStream`)
*Enforces Rules 4, 8, 9, 10, 24, 47, 48, 51*

**Files:**
- Create: `src/app/api/events/stream/route.ts`
- Create: `src/hooks/useEventStream.ts`
- Test: `src/platform/__tests__/events/event-stream-route.test.ts`

- [ ] **Step 1: Write failing tests for SSE Route Handler**
  Define tests covering:
  1. Unauthorized requests (missing session) return 401 Unauthorized (**Rule 51**).
  2. Multi-tenant isolation: Subscriber registered with `organizationId: "org-1"` only receives events matching `org-1` (**Rule 47**).
  3. Stream headers: `Content-Type: text/event-stream; charset=utf-8`, `Cache-Control: no-cache, no-transform`, `Connection: keep-alive`.
  4. Initial connection handshake message: `data: {"type":"connected","timestamp":"..."}\n\n`.
  5. Teardown on abort: When client disconnects (`request.signal.aborted`), event bus listener is unsubscribed and heartbeat interval cleared (**Rule 9**).

- [ ] **Step 2: Run test to verify it fails**
  Run: `pnpm vitest run src/platform/__tests__/events/event-stream-route.test.ts`
  Expected: FAIL with route not found.

- [ ] **Step 3: Implement SSE Route Handler & Client Hook**
  - In `src/app/api/events/stream/route.ts`:
    - Resolve authenticated tenant context (`organizationId`, `workspaceId`).
    - Create `ReadableStream` with SSE format encoder.
    - Set up 25-second heartbeat ping (`data: {"type":"ping"}\n\n`).
    - Subscribe to `defaultEventBus.subscribe('*', handler, { organizationId, workspaceId })`.
    - Attach `request.signal.addEventListener('abort', ...)` for clean teardown.
  - In `src/hooks/useEventStream.ts`:
    - Manage `EventSource` connection, exponential backoff reconnection, and callback routing.

- [ ] **Step 4: Run test to verify it passes**
  Run: `pnpm vitest run src/platform/__tests__/events/event-stream-route.test.ts`
  Expected: PASS (all tests green).

- [ ] **Step 5: Typecheck verification**
  Run: `pnpm typecheck`

---

### Task 2: Activity & DLQ Server Actions (`src/app/actions/activity-actions.ts`)
*Enforces Rules 1, 4, 7, 8, 9, 20, 25, 47, 51*

**Files:**
- Create: `src/app/actions/activity-actions.ts`
- Test: `src/platform/__tests__/events/activity-actions.test.ts`

- [ ] **Step 1: Write failing tests for Activity Server Actions**
  Define tests covering:
  1. `listActivitiesAction`: verifies tenant boundaries, pagination limit clamping (1–100), returns typed `ActivityRecordV2[]`.
  2. `listDeadLetterEventsAction`: requires admin permissions, returns quarantined records.
  3. `replayDeadLetterEventAction`: requires admin permissions, retrieves event, republishes to `defaultEventBus`, marks `replayed`.
  4. `discardDeadLetterEventAction`: requires admin permissions, marks `discarded` with operator reason.

- [ ] **Step 2: Run test to verify it fails**
  Run: `pnpm vitest run src/platform/__tests__/events/activity-actions.test.ts`
  Expected: FAIL with actions not found.

- [ ] **Step 3: Implement Activity Server Actions**
  - In `src/app/actions/activity-actions.ts`:
    - Validate inputs with Zod schemas.
    - Call `ActivityAggregationService` and `DeadLetterStorage`.
    - Sanitize errors and return `{ success: true, data }` or `{ success: false, error }`.

- [ ] **Step 4: Run test to verify it passes**
  Run: `pnpm vitest run src/platform/__tests__/events/activity-actions.test.ts`
  Expected: PASS.

- [ ] **Step 5: Typecheck verification**
  Run: `pnpm typecheck`

---

### Task 3: Reusable Activity Timeline 2.0 Components (`<ActivityTimeline2 />` & `<ActivityItem2 />`)
*Enforces Rules 4, 7, 10, 16, Emil Kowalski Motion, Mobile 44px Touch Targets*

**Files:**
- Create: `src/components/activity/ActivityItem2.tsx`
- Create: `src/components/activity/ActivityTimeline2.tsx`
- Test: `src/platform/__tests__/ui/activity-timeline2.test.tsx`

- [ ] **Step 1: Write failing tests for Activity Timeline 2.0**
  Define tests covering:
  1. `ActivityItem2`: renders actor avatar & badge (👤 User: blue, 🤖 AI: purple `Sparkles`, ⚡ Automation: amber `Zap`, ⚙️ System: slate `Settings2`), formatted timestamp, summary, touch target min-h-[44px].
  2. `ActivityTimeline2`: renders actor class tabs (`All`, `Human (User)`, `AI (Agent)`, `Automation`, `System`), domain dropdown, debounced search, date grouping headers (`Today`, `Yesterday`, etc.), pulsing live status badge, and "Load More" cursor pagination.
  3. Real-time prepending: incoming event from `useEventStream` prepends to top with animation.

- [ ] **Step 2: Run test to verify it fails**
  Run: `pnpm vitest run src/platform/__tests__/ui/activity-timeline2.test.tsx`
  Expected: FAIL with components not found.

- [ ] **Step 3: Implement `<ActivityItem2 />` and `<ActivityTimeline2 />`**
  - Implement `ActivityItem2.tsx` with tactile button active state (`active:scale-[0.97]`).
  - Implement `ActivityTimeline2.tsx` with actor tabs, domain dropdown, search, live status badge, and cursor pagination.

- [ ] **Step 4: Run test to verify it passes**
  Run: `pnpm vitest run src/platform/__tests__/ui/activity-timeline2.test.tsx`
  Expected: PASS.

- [ ] **Step 5: Typecheck verification**
  Run: `pnpm typecheck`

---

### Task 4: Standardized Activity Inspect Drawer (`<ActivityInspectDrawer />`)
*Enforces `theme.md` §8 Modal Architecture, Rules 4, 7, 10, 39, 41*

**Files:**
- Create: `src/components/activity/ActivityInspectDrawer.tsx`
- Test: `src/platform/__tests__/ui/activity-inspect-drawer.test.tsx`

- [ ] **Step 1: Write failing tests for Inspect Drawer**
  Define tests covering:
  1. Surface styling adheres to `theme.md` §8: `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`. No hardcoded slate/dark classes.
  2. Demarcated header: `<DialogHeader demarcated>` with `<CardInfoTooltip text="..." />`.
  3. Zero raw visible description: uses `<DialogDescription className="sr-only">`.
  4. Single-circle info tooltip button at `z-[10050]`.
  5. Demarcated footer with tactile buttons (`rounded-xl active:scale-[0.97]`).
  6. OpenTelemetry trace display: `correlationId`, `causationId`, `eventId`, payload viewer, actor attribution.

- [ ] **Step 2: Run test to verify it fails**
  Run: `pnpm vitest run src/platform/__tests__/ui/activity-inspect-drawer.test.tsx`
  Expected: FAIL with drawer not found.

- [ ] **Step 3: Implement `<ActivityInspectDrawer />`**
  - Build `ActivityInspectDrawer.tsx` strictly abiding by `theme.md` Section 8.
  - Render Actor Attribution, Entity Information, Plain English Summary, Distributed Tracing (`correlationId`, `causationId`, `traceparent`), and Raw Payload Viewer with copy-to-clipboard button.

- [ ] **Step 4: Run test to verify it passes**
  Run: `pnpm vitest run src/platform/__tests__/ui/activity-inspect-drawer.test.tsx`
  Expected: PASS.

- [ ] **Step 5: Typecheck verification**
  Run: `pnpm typecheck`

---

### Task 5: Dead-Letter Queue Operator Drawer (`<DeadLetterQueueDrawer />`)
*Enforces Rules 4, 7, 24, 25, 61, `theme.md` §8 Modal Architecture*

**Files:**
- Create: `src/components/activity/DeadLetterQueueDrawer.tsx`
- Test: `src/platform/__tests__/ui/dlq-drawer.test.tsx`

- [ ] **Step 1: Write failing tests for DLQ Operator Drawer**
  Define tests covering:
  1. Modal architecture compliance: demarcated header, `CardInfoTooltip`, `sr-only` description, demarcated footer.
  2. Quarantined records listing: shows `eventId`, `lastError`, attempt count, timestamp.
  3. 1-click "Retry Dispatch" action calls `replayDeadLetterEventAction` and updates UI optimistically.
  4. "Discard" action calls `discardDeadLetterEventAction` with operator confirmation.

- [ ] **Step 2: Run test to verify it fails**
  Run: `pnpm vitest run src/platform/__tests__/ui/dlq-drawer.test.tsx`
  Expected: FAIL with component not found.

- [ ] **Step 3: Implement `<DeadLetterQueueDrawer />`**
  - Build `DeadLetterQueueDrawer.tsx` adhering to `theme.md` Section 8.
  - List quarantined events with expandable error stack trace.
  - Action buttons per item: "Retry Dispatch" and "Discard".

- [ ] **Step 4: Run test to verify it passes**
  Run: `pnpm vitest run src/platform/__tests__/ui/dlq-drawer.test.tsx`
  Expected: PASS.

- [ ] **Step 5: Typecheck verification**
  Run: `pnpm typecheck`

---

### Task 6: Global Activity Dashboard (`/admin/activity`) & Legacy Alias (`/admin/activities`)
*Enforces Rules 1, 4, 7, 10, 47, 69, Three-Zone Layout*

**Files:**
- Create: `src/app/admin/activity/page.tsx`
- Create: `src/app/admin/activity/GlobalActivityClient.tsx`
- Modify: `src/app/admin/activities/page.tsx` (Seamless wrapper/alias to `/admin/activity`)
- Modify: `firestore.indexes.json` (Add composite index `actor.type ASC`, `timestamp DESC`)
- Test: `src/platform/__tests__/ui/global-activity-page.test.tsx`

- [ ] **Step 1: Write failing tests for Global Activity Page & Alias**
  Define tests covering:
  1. `/admin/activity` page renders metadata and `GlobalActivityClient`.
  2. `/admin/activities` transparently forwards/renders the same dashboard without breaking legacy links (**Rule 1, Rule 69**).
  3. Three-Zone layout: Zone 1 (Header + DLQ trigger), Zone 2 (Actor Tabs & Filters), Zone 3 (Activity Feed).

- [ ] **Step 2: Run test to verify it fails**
  Run: `pnpm vitest run src/platform/__tests__/ui/global-activity-page.test.tsx`
  Expected: FAIL with page not found.

- [ ] **Step 3: Implement Dashboard, Alias & Firestore Index**
  - In `src/app/admin/activity/page.tsx`: Server component with auth gating and metadata.
  - In `src/app/admin/activity/GlobalActivityClient.tsx`: Three-Zone layout with PageContainerFluid, embedding `<ActivityTimeline2 />` and `<DeadLetterQueueDrawer />`.
  - In `src/app/admin/activities/page.tsx`: Update to render the unified activity client, preserving 100% backward compatibility for all bookmarks and internal links.
  - In `firestore.indexes.json`: Add recommended composite index for `activities` collection (`actor.type ASC`, `timestamp DESC`).

- [ ] **Step 4: Run test to verify it passes**
  Run: `pnpm vitest run src/platform/__tests__/ui/global-activity-page.test.tsx`
  Expected: PASS.

- [ ] **Step 5: Typecheck verification**
  Run: `pnpm typecheck`

---

### Task 7: Full Verification Suite, Baseline Regression & Quality Sweep
*Enforces Rules 1, 4, 67, 68, 69*

- [ ] **Step 1: Run all event & UI test suites**
  Run: `pnpm vitest run src/platform/__tests__/events/ src/platform/__tests__/ui/`
  Expected: 100% green pass.

- [ ] **Step 2: Run full baseline regression suite**
  Run: `pnpm test:agentic:baseline`
  Expected: All 80+ test files and 788+ baseline tests pass 100% green.

- [ ] **Step 3: Run strict TypeScript compilation check**
  Run: `pnpm typecheck` (`tsc --noEmit`)
  Expected: Exit code 0 (zero errors, zero `any`).

- [ ] **Step 4: Run ESLint quality audit**
  Run: `NODE_OPTIONS='--max-old-space-size=8192' pnpm eslint src/app/admin/activity/ src/app/admin/activities/ src/components/activity/ src/app/actions/activity-actions.ts src/app/api/events/stream/`
  Expected: Exit code 0 (zero errors, zero warnings).

- [ ] **Step 5: Author Completion Report & Request Architectural Certification**
  Write `docs/agents_mcp/phases/agents_mcp_phase_2_milestone_3_completion_report.md` and request formal sign-off from `senior_code_reviewer` subagent.

---

## 4. Edge Cases, Failure Modes & Mitigations

| Edge Case / Hazard | Root Cause | Architectural Mitigation in Milestone 3 |
| :--- | :--- | :--- |
| **Dangling SSE Listeners in Cloud Run** | Client closes browser tab or navigates away without closing stream | Wire `request.signal.addEventListener('abort', () => { clearInterval(ping); sub.unsubscribe(); })` to instantly tear down listener upon client disconnect (**Rule 9**). |
| **Network Interruption on SSE Stream** | Transient WiFi or proxy disconnect | `useEventStream` automatically implements exponential backoff reconnection with fallback to periodic background interval polling (**Rule 24**). |
| **Cross-Tenant SSE Stream Leak** | Client attempts to listen to events outside their organization | Route handler verifies session identity and registers subscriber strictly with `{ organizationId, workspaceId }` (**Rule 47**). |
| **Legacy URL 404 Breakdown** | Users or automated systems accessing `/admin/activities` | `/admin/activities` page imports and renders the unified dashboard seamlessly (**Rule 1, Rule 69**). |
| **Payload XSS Injection in UI** | Malicious content injected into event payload string | Summary formatter and JSON viewer sanitize all strings before DOM insertion (**Rule 13**). |
| **Modal Geometry Inconsistency** | Modals with hardcoded slate backgrounds or square corners | Strict binding to `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl` and `<DialogHeader demarcated>` (**theme.md §8**). |

---

## 5. Definition of Done & Quality Gates

1. **Strict Type Safety:** `pnpm typecheck` exits with code 0 repository-wide (zero `any` or `any[]`).
2. **Lint Cleanliness:** `pnpm eslint` reports 0 errors and 0 warnings across all Phase 2 Milestone 3 files.
3. **Modal SSOT Compliance:** 100% adherence to `theme.md` §8 (demarcated header, single-circle info tooltip at `z-[10050]`, `sr-only` description, demarcated footer).
4. **Baseline Invariants:** `pnpm test:agentic:baseline` remains 100% green (all 80+ test files, 788+ tests).
5. **No Remote Push:** Changes remain local; strictly no `git push` to remote branches.
6. **Architectural Review:** Certified with **Grade A+** by Senior Principal Systems & AI Agentic Architecture Reviewer.
