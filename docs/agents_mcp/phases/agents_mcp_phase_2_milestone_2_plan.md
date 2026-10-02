# Phase 2 — Unified Event & Activity Backbone
## Milestone 2 Implementation Plan: Reactive Universal Event Bus & Activity Aggregation Engine
### Conformance Updated with `agents_mcp_rules.md` (Rules 1–69)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the high-throughput, multi-tenant Reactive Universal Event Bus (`EventBus`), Activity Aggregation & Materialization Service (`ActivityAggregationService`), Actor Normalizer & Summary Engine, Legacy Activity Strangler Bridge (`legacyActivityStrangler`), and Core Domain Subscribers (CRM, Deals, Tasks), transforming asynchronous domain events into an immutable, unified activity timeline backbone.

**Architecture:** An in-process, tenant-isolated routing bus supporting exact matching and domain wildcards (`crm.*`, `deal.*`, `*`), backed by asynchronous dispatch from the Cloud Tasks outbox worker. Materializes canonical `DomainEvent` objects into denormalized `ActivityRecordV2` documents in Firestore, standardizes heterogeneous actor identities (User, Agent, Automation, System), translates event payloads into natural human summaries, and wraps legacy `logActivity` calls through a non-breaking Strangler Fig bridge that guarantees 100% continuity for all existing `triggerAutomationProtocols` automation triggers.

**Tech Stack:** TypeScript (strict mode, zero `any`), Zod v4, Google Cloud Firestore, Google Cloud Tasks, OpenTelemetry W3C trace propagation, Vitest.

---

## 1. Governing Rules & Invariant Conformance Matrix

| Rule | Title | Specific Requirement in Milestone 2 | Conformance & Safeguard Architecture |
| :--- | :--- | :--- | :--- |
| **Rule 1** | **Preserve Pre-existing Functionality** | No regression in CRM, Automations, Messaging, or Portals | Strangler bridge wraps `logActivity` non-disruptively; all 80 baseline regression suites (788 tests) remain 100% green. |
| **Rule 4** | **Strict Typing Protocol** | Zero `any` or `any[]`; narrow `unknown` at trust boundaries | Pure Zod schemas (`ActivityRecordV2Schema`, `NormalizedActorSchema`). Untrusted payloads validated before domain logic. Full repo passes `tsc --noEmit`. |
| **Rule 7** | **Visual Clarity & Everyday UI English** | Activity summaries must use common, simple language | `SummaryFormatter` generates concise, natural summaries (e.g. *"Joseph Aidoo created contact Sarah Connor"*, *"AI SDR Agent advanced deal"*). |
| **Rule 8** | **High Security Standards & Anti-IDOR** | Prevent cross-tenant event access | `EventBus` verifies tenant context before dispatching to tenant-scoped subscribers. Tenant ID derived from authenticated context. |
| **Rule 9** | **Batching & Resource Exhaustion Defense** | Prevent memory exhaustion and query timeouts | `ActivityStorage.listActivities` enforces strict bounds (`default: 50, max: 100`). `EventBus` bounds concurrent handler executions. |
| **Rule 10** | **Inline Architectural Comments** | Document changes, caution areas, and testability | Comprehensive explanatory comments in all newly created files detailing rationale, edge cases, and maintainer pointers. |
| **Rule 11** | **State Immutability & Audit Trail** | Activity timeline must be tamper-proof | `ActivityRecordV2` is strictly append-only. Updates and deletions are rejected at both API and Firestore levels. |
| **Rule 13** | **Trust Boundary Matrix** | Treat raw event payloads as untrusted data | Event payloads are sanitized against HTML/CSS injection before rendering or materializing into activity records (`sanitizeText`). |
| **Rule 16** | **Natural Language Feedback & Actor Classes** | Explicit classification of actors | `ActorNormalizer` standardizes all actors into 4 classes: `user`, `agent`, `automation`, `system` with role and model metadata. |
| **Rule 18** | **Concurrency & Lease Defense** | Prevent subscriber race conditions | Subscribers use idempotent writes and atomic counter increments (`FieldValue.increment`). |
| **Rule 20** | **Replay Protection & Duplicate Guard** | Cloud Tasks retries must not duplicate activities | Activity document IDs are deterministically derived as `${organizationId}_${eventId}`, ensuring idempotent `set(..., { merge: false })`. |
| **Rule 24** | **Cascade Failure Defense & Error Isolation** | One subscriber failure must not halt others | `EventBus.publish` executes handlers via `Promise.allSettled`, isolating failing subscribers from the rest of the system. |
| **Rule 27** | **Serverless Decoupling** | Handlers must not block HTTP responses | Event dispatch runs asynchronously in Cloud Tasks outbox worker or Next.js `runAfter()`, fully decoupled from client requests. |
| **Rule 31** | **Observability & Telemetry** | Structured logging of all event dispatches | `EventBus` logs execution metrics: event type, subscriber count, duration ms, tenant scope, and error counts. |
| **Rule 39** | **OpenTelemetry Trace Propagation** | Preserve correlation across distributed hops | Handlers and `ActivityRecordV2` documents carry `traceparent`, `correlationId`, and `causationId`. |
| **Rule 40** | **Append-Only Immutability for Activities** | Activities collection must never be mutated | Storage adapter prohibits `update` and `delete` operations; only `recordActivity` is exposed. |
| **Rule 41 & 47** | **Multi-Tenant Isolation by Default** | Strict tenant boundary enforcement | Subscribers filter by `organizationId` and `workspaceId`. Subscriptions without tenant scope are restricted to system-level sinks. |
| **Rule 60** | **Emergency Dead-Man Controls** | Instant halt capability without code redeploy | `checkEventDeadManSwitch` checked prior to event routing and aggregation; halts gracefully if emergency disabled. |
| **Rule 64** | **Three-Tier Feature Flag Hierarchy** | Workspace $\to$ Organization $\to$ Global flags | `checkEventFlag('enable_event_backbone')` evaluated before running strangler bridge or dispatching through event bus. |
| **Rule 69** | **Non-Distortion of Automation Protocols** | `triggerAutomationProtocols` must not break | Legacy `logActivity` continues to invoke `triggerAutomationProtocols` via `runAfter()`, maintaining 100% automation behavior. |

---

## 2. File Structure Map

```
src/platform/events/
├── contracts/
│   ├── event-dispatcher.contract.ts       (Existing from M1)
│   └── activity-record.contract.ts        (New: Zod schema for ActivityRecordV2 & NormalizedActor)
├── event-bus.ts                           (New: Universal Multi-Tenant EventBus with wildcard routing)
├── activity/
│   ├── activity-aggregation-service.ts    (New: Materializes DomainEvents into ActivityRecordV2)
│   ├── actor-normalizer.ts                (New: Standardizes User, Agent, Automation, System actors)
│   └── summary-formatter.ts               (New: Generates plain English natural language summaries)
├── adapters/
│   └── legacy-activity-strangler.ts       (New: Bridges legacy logActivity to DomainEvents & automations)
├── subscribers/
│   ├── crm-activity-subscriber.ts         (New: Handles crm.* events, updates entity activity timestamps)
│   ├── deals-activity-subscriber.ts       (New: Handles deal.* events, stage velocity & metrics)
│   └── tasks-activity-subscriber.ts       (New: Handles task.* events, status notifications)
├── storage/
│   ├── outbox-reader.ts                   (Existing from M1)
│   ├── event-execution-ledger.ts          (Existing from M1)
│   └── dead-letter-storage.ts             (Existing from M1)
└── resilience/
    ├── circuit-breaker.ts                 (Existing from M1)
    ├── event-dead-man.ts                  (Existing from M1)
    └── event-flags.ts                     (Existing from M1)

src/platform/tasks/
└── event-dispatcher-worker.ts             (Modify: Wire EventBus as default production dispatch sink)

src/lib/
└── activity-logger.ts                     (Modify: Integrate legacy-activity-strangler bridge non-disruptively)

src/platform/__tests__/events/
├── event-bus.test.ts                      (New: Pattern matching, wildcards, tenant isolation, error isolation)
├── activity-aggregation.test.ts           (New: ActivityRecordV2 materialization, idempotent writes)
├── actor-summary.test.ts                  (New: Actor normalization, plain English summaries)
├── legacy-strangler.test.ts               (New: logActivity bridge, backward compatibility, automations)
└── domain-subscribers.test.ts             (New: CRM, Deals, Tasks subscriber updates)
```

---

## 3. Detailed Milestone Tasks & TDD Specifications

### Task 1: Activity Record Contracts & Normalized Actor Schema (Rules 4, 16, 40)

**Files:**
- Create: `src/platform/events/contracts/activity-record.contract.ts`
- Test: `src/platform/__tests__/events/actor-summary.test.ts`

- [x] **Step 1: Write the failing contract validation test**
  Define tests verifying that `ActivityRecordV2Schema` and `NormalizedActorSchema` enforce:
  1. Strict actor types (`user`, `agent`, `automation`, `system`) with optional model and agentRole metadata.
  2. Entity reference validation (`type`, `id`, optional `name`).
  3. Non-empty string requirements for `id`, `eventId`, `organizationId`, `summary`, and `correlationId`.
  4. Immutable structure: parsing rejects unexpected mutations or invalid datetime stamps.
  5. Zero `any` or `any[]` types.

- [x] **Step 2: Run test to verify it fails**
  Run: `pnpm vitest run src/platform/__tests__/events/actor-summary.test.ts`
  Expected: FAIL with "module not found" or "ActivityRecordV2Schema is not defined".

- [x] **Step 3: Implement `activity-record.contract.ts`**
  Implement `NormalizedActorSchema`, `ActivityEntityRefSchema`, `ActivityRecordV2Schema`, and `buildActivityDocumentId(organizationId, eventId)`.

- [x] **Step 4: Run contract tests to verify pass**
  Run: `pnpm vitest run src/platform/__tests__/events/actor-summary.test.ts`
  Expected: PASS.

---

### Task 2: Universal Multi-Tenant Event Bus with Pattern & Wildcard Routing (Rules 4, 8, 24, 31, 39, 41, 47)

**Files:**
- Create: `src/platform/events/event-bus.ts`
- Test: `src/platform/__tests__/events/event-bus.test.ts`

- [x] **Step 1: Write the failing EventBus test suite**
  Cover:
  1. Exact type subscription matching (`crm.contact.created`).
  2. Domain wildcard matching (`crm.*` receives `crm.contact.created` and `crm.contact.updated`, but NOT `deal.created`).
  3. Universal wildcard matching (`*` receives all domain events).
  4. Tenant boundary enforcement (**Rule 47**): A subscriber registered with `workspaceId: "ws-1"` will never receive events from `workspaceId: "ws-2"`, even if the event pattern matches.
  5. Isolated subscriber failure (**Rule 24**): If subscriber A throws an unhandled error, subscriber B still receives the event successfully.
  6. OpenTelemetry tracing propagation (**Rule 39**): Handlers receive the event's `correlationId` and `causationId`.
  7. Unsubscribe cleanup: Calling `subscription.unsubscribe()` prevents further deliveries.

- [x] **Step 2: Run test to verify it fails**
  Run: `pnpm vitest run src/platform/__tests__/events/event-bus.test.ts`
  Expected: FAIL with "module not found".

- [x] **Step 3: Implement `event-bus.ts`**
  Implement `createEventBus()`, `defaultEventBus`, pattern matching (`exact`, `prefix.*`, `*`), tenant perimeter filtering, and `Promise.allSettled` execution.

- [x] **Step 4: Run test to verify it passes**
  Run: `pnpm vitest run src/platform/__tests__/events/event-bus.test.ts`
  Expected: PASS (all tests green).

---

### Task 3: Actor Normalizer & Plain English Summary Engine (Rules 7, 13, 16)

**Files:**
- Create: `src/platform/events/activity/actor-normalizer.ts`
- Create: `src/platform/events/activity/summary-formatter.ts`
- Test: `src/platform/__tests__/events/actor-summary.test.ts`

- [x] **Step 1: Write failing tests for ActorNormalizer & SummaryFormatter**
  Test cases:
  1. Normalizes `user` actors with display name, email, or fallback to user ID.
  2. Normalizes `agent` actors with agent role (e.g. `AI SDR Agent`, `AI Sales Copilot`), model name, and badge styling metadata.
  3. Normalizes `automation` actors with workflow name or protocol trigger.
  4. Normalizes `system` actors with subsystem source name.
  5. Translates standard domain events into everyday English (`crm.contact.created`, `deal.stage_changed`, etc.).
  6. Robust fallback formatting for unmapped custom events without throwing errors.
  7. Sanitizes all strings against raw HTML/CSS tags to prevent XSS (**Rule 13**).

- [x] **Step 2: Run test to verify it fails**
  Run: `pnpm vitest run src/platform/__tests__/events/actor-summary.test.ts`
  Expected: FAIL.

- [x] **Step 3: Implement `actor-normalizer.ts` and `summary-formatter.ts`**
  Implement `normalizeActor(eventActor, context)` and `formatEventSummary(event, options)`.

- [x] **Step 4: Run test to verify it passes**
  Run: `pnpm vitest run src/platform/__tests__/events/actor-summary.test.ts`
  Expected: PASS.

---

### Task 4: Activity Aggregation & Materialization Service (Rules 9, 11, 20, 40)

**Files:**
- Create: `src/platform/events/activity/activity-aggregation-service.ts`
- Test: `src/platform/__tests__/events/activity-aggregation.test.ts`

- [x] **Step 1: Write failing tests for ActivityAggregationService**
  Test cases:
  1. Materializes canonical `DomainEvent` into an immutable `ActivityRecordV2`.
  2. Idempotent key generation: Derives document key as `${organizationId}_${eventId}`. Calling `materializeAndStore` multiple times for the same event writes to the same key and never duplicates records (**Rule 20**).
  3. Dual-storage: Writes to `workspaces/{workspaceId}/activities/{id}` (if workspaceId is present) and `organizations/{organizationId}/activities/{id}`.
  4. Immutability protection (**Rule 40**): Storage adapter provides only `recordActivity`, `getActivity`, and `listActivities`; updates and deletions are explicitly disallowed.
  5. Bounded queries (**Rule 9**): `listActivities` clamps `limit` between 1 and 100 (default 50).
  6. Includes both in-memory adapter (for hermetic unit tests) and Firestore production adapter.

- [x] **Step 2: Run test to verify it fails**
  Run: `pnpm vitest run src/platform/__tests__/events/activity-aggregation.test.ts`
  Expected: FAIL with "module not found".

- [x] **Step 3: Implement `activity-aggregation-service.ts`**
  Implement `ActivityStorage`, `createInMemoryActivityStorage`, `createFirestoreActivityStorage`, and `createActivityAggregationService`.

- [x] **Step 4: Run test to verify it passes**
  Run: `pnpm vitest run src/platform/__tests__/events/activity-aggregation.test.ts`
  Expected: PASS (all tests green).

---

### Task 5: Legacy Activity Strangler Bridge (Rules 1, 60, 64, 69)

**Files:**
- Create: `src/platform/events/adapters/legacy-activity-strangler.ts`
- Modify: `src/lib/activity-logger.ts`
- Test: `src/platform/__tests__/events/legacy-strangler.test.ts`

- [x] **Step 1: Write failing tests for LegacyActivityStrangler**
  Test cases:
  1. Preserves legacy `logActivity` behavior: writes to `activities` collection unchanged.
  2. Preserves automation execution: `triggerAutomationProtocols` continues to fire via `runAfter()` with identical payload.
  3. Non-blocking transformation: Converts legacy activity inputs (`LogActivityInput`) to canonical `DomainEvent` objects.
  4. Emits canonical domain event to `EventBus` without throwing.
  5. Fail-open resilience: If event bus or strangler translation fails, legacy activity logging and automations MUST NOT be affected.
  6. Feature flag check (**Rule 64**): Bypasses strangler bridge if `enable_event_backbone` flag is false or dead-man switch is engaged.
  7. Regression check: All pre-existing automation baseline tests remain 100% green.

- [x] **Step 2: Run test to verify it fails**
  Run: `pnpm vitest run src/platform/__tests__/events/legacy-strangler.test.ts`
  Expected: FAIL.

- [x] **Step 3: Implement `legacy-activity-strangler.ts` & update `src/lib/activity-logger.ts`**
  Implement `convertLegacyActivityToDomainEvent` and `bridgeLegacyActivityToEventBackbone`. Add non-blocking dynamic import inside `runAfter()` in `src/lib/activity-logger.ts`.

- [x] **Step 4: Run test to verify it passes**
  Run: `pnpm vitest run src/platform/__tests__/events/legacy-strangler.test.ts`
  Expected: PASS.

---

### Task 6: Core Domain Event Subscribers & Worker Integration (Rules 18, 24, 27, 47)

**Files:**
- Create: `src/platform/events/subscribers/crm-activity-subscriber.ts`
- Create: `src/platform/events/subscribers/deals-activity-subscriber.ts`
- Create: `src/platform/events/subscribers/tasks-activity-subscriber.ts`
- Modify: `src/platform/tasks/event-dispatcher-worker.ts`
- Test: `src/platform/__tests__/events/domain-subscribers.test.ts`

- [x] **Step 1: Write failing tests for Core Domain Subscribers & Worker Integration**
  Test cases:
  1. `CrmActivitySubscriber`: Subscribes to `crm.*`. On `crm.contact.updated` or `crm.contact.tagged`, updates entity `lastActivityAt` timestamp in Firestore.
  2. `DealsActivitySubscriber`: Subscribes to `deal.*`. On `deal.stage_changed`, updates stage velocity and duration metrics.
  3. `TasksActivitySubscriber`: Subscribes to `task.*`. On `task.completed`, updates task completion metrics.
  4. Worker Integration: `processEventDispatch` in `src/platform/tasks/event-dispatcher-worker.ts` routes leased events into `EventBus.publish(event)`, notifying both the `ActivityAggregationService` and domain subscribers.

- [x] **Step 2: Run test to verify it fails**
  Run: `pnpm vitest run src/platform/__tests__/events/domain-subscribers.test.ts`
  Expected: FAIL.

- [x] **Step 3: Implement Domain Subscribers and Wire EventBus into Dispatcher Worker**
  Implement domain subscribers and plug `createProductionEventBusSink` into `src/platform/tasks/event-dispatcher-worker.ts`.

- [x] **Step 4: Run domain subscribers tests to verify pass**
  Run: `pnpm vitest run src/platform/__tests__/events/domain-subscribers.test.ts`
  Expected: PASS.

---

### Task 7: Milestone 2 Comprehensive Verification & Quality Gates (Rule 69)

**Files:**
- Test: `pnpm vitest run src/platform/__tests__/events/`
- Test: `pnpm test:agentic:baseline`
- Check: `pnpm typecheck`
- Lint: `pnpm eslint`

- [x] **Step 1: Run all Milestone 1 & Milestone 2 event test suites**
  Run: `pnpm vitest run src/platform/__tests__/events/`
  Result: 11 passed (11), 59 passed (59) in 1.40s.

- [x] **Step 2: Run full baseline regression suite**
  Run: `pnpm test:agentic:baseline`
  Result: 80 passed (80 files), 788 passed (788 tests) in 45.68s. Zero regressions across CRM, Automations, Messaging, Portals.

- [x] **Step 3: Run strict TypeScript typecheck**
  Run: `NODE_OPTIONS='--max-old-space-size=8192' tsc --noEmit`
  Result: Exit code 0, zero `any` or `any[]` errors.

- [x] **Step 4: Run ESLint**
  Run: `NODE_OPTIONS='--max-old-space-size=8192' pnpm eslint src/platform/events/ src/platform/tasks/ src/platform/__tests__/events/ src/lib/activity-logger.ts`
  Result: Exit code 0, zero errors, zero warnings.

- [x] **Step 5: Author Completion Report & Formal Code Review**
  Created `docs/agents_mcp/phases/agents_mcp_phase_2_milestone_2_completion_report.md` and certified with **Grade A+** by `senior_code_reviewer`.

---

## 4. Edge Cases, Failure Modes & Mitigations

| Edge Case / Hazard | Root Cause | Architectural Mitigation in Milestone 2 |
| :--- | :--- | :--- |
| **Subscriber Cascade Failure** | One downstream subscriber throws an unhandled error | `EventBus.publish` wraps all handlers in `Promise.allSettled`. Failed subscribers return diagnostic errors without blocking other subscribers or failing the outbox lease (**Rule 24**). |
| **Duplicate Activity Records** | Cloud Tasks delivers duplicate task due to network timeout | Document IDs are deterministically derived as `${organizationId}_${eventId}`. Writing uses idempotent `set(..., { merge: false })` (**Rule 20**). |
| **Cross-Tenant Event Leak** | Wildcard subscriber receives events from another tenant | `EventBus` verifies `organizationId` and `workspaceId` matching between subscription and event before calling handler (**Rule 47**). |
| **Automation Disruption** | Modifying `logActivity` breaks existing automations | Strangler bridge executes in non-blocking fashion after `triggerAutomationProtocols`. Any bridge error is caught and logged without affecting legacy flow (**Rule 69**). |
| **Emergency Halt Anomaly** | Sudden runaway event dispatch loop | `checkEventDeadManSwitch` stops routing instantly when `system_settings/event_backbone.emergencyDisabled` is set (**Rule 60**). |
| **Untrusted Event Payload Injection** | Malicious actor passes XSS script in payload string | `SummaryFormatter` and `ActivityRecordV2Schema` sanitize and escape strings, rejecting raw HTML/CSS markup (**Rule 13**). |

---

## 5. Definition of Done & Quality Gates

1. **Strict Type Safety:** `pnpm typecheck` exits with code 0 repository-wide (zero `any` or `any[]`).
2. **Lint Cleanliness:** `pnpm eslint` reports 0 errors and 0 warnings across all Phase 2 files.
3. **Event Test Suite Coverage:** 100% pass across all 11 Milestone 2 event tests (59 passed).
4. **Baseline Invariants:** `pnpm test:agentic:baseline` remains 100% green (all 80 test files, 788 tests).
5. **No Remote Push:** Changes remain local; strictly no `git push` to remote branches.
6. **Architectural Review:** Certified with **Grade A+** by Senior Principal Systems & AI Agentic Architecture Reviewer.
