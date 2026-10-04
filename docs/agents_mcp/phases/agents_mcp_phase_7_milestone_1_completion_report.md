# Phase 7 Milestone 1: Durable Workflow Contracts, 10-State Machine & Firestore Checkpoint Store Completion Report

**Date:** October 3, 2026  
**Status:** COMPLETE  
**Milestone:** Phase 7, Milestone 1  
**Author:** AI Agentic Architecture Team & Antigravity  

---

## Executive Summary

Phase 7 Milestone 1 kicks off **Phase 7: Long-Running Durable Workflows, Saga Distributed Transactions & Human-in-the-Loop Resumption**. Milestone 1 implements the core persistence and formal lifecycle foundation of the durable workflow engine:
1. **Canonical Workflow Contracts, Zod v4 Schemas & Error Taxonomy** (`src/platform/workflows/workflow-types.ts`)
2. **Deterministic 10-State Workflow State Machine & Cryptographic Checkpoint Chaining** (`src/platform/workflows/workflow-state-machine.ts`)
3. **Multi-Tenant Firestore Checkpoint Store & In-Memory Adapter** (`src/platform/workflows/workflow-store.ts`)
4. **Universal EventBus Integration & Workflow Domain Event Subscribers** (`src/platform/workflows/subscribers/workflow-event-subscribers.ts`)
5. **Multi-Tenant Compound Query Indexing** (`firestore.indexes.json`)

All components strictly comply with the 69 SmartSapp Agentic Development Rules, specifically Rule 4 (zero `any` or `any[]`), Rules 8 & 47 (strict tenant isolation and Anti-IDOR enforcement), Rule 9 (subcollection partitioning preventing the Firestore 1MB document limit), Rule 18 & 19 (atomic transactions and idempotency deduplication), Rule 26 (cooperative cancellation across non-terminal states), and Rule 40 (tamper-evident SHA-256 hash chaining).

---

## Delivered Architecture & Artifacts

### 1. Canonical Workflow Contracts, Schemas & Error Taxonomy (`src/platform/workflows/workflow-types.ts`)
- **10-State Lifecycle Enum (`WORKFLOW_STATES`):**
  - `CREATED` -> Initial unqueued state.
  - `QUEUED` -> Enqueued for execution worker dispatch.
  - `RUNNING` -> Actively executing workflow steps.
  - `WAITING` -> Parked awaiting an external resume event (webhook, timer, approval, human input).
  - `RESUMED` -> Wakeup signal received and validated; pending dispatch.
  - `VERIFYING` -> Running post-condition assertions.
  - `COMPLETED` -> Terminal success state.
  - `FAILED` -> Terminal unrecoverable error state.
  - `CANCELLED` -> Terminal cooperative cancellation state.
  - `TIMED_OUT` -> Terminal execution budget expiration state.
- **5 Wait Condition Types (`WAIT_CONDITION_TYPES`):**
  - `approval` (Human operator approval required)
  - `webhook` (External API callback)
  - `schedule` (Time-delayed execution)
  - `human_input` (Interactive form/prompt response)
  - `external_system` (Async 3rd-party webhook / polling result)
- **Zod v4 Schemas:**
  - `WorkflowWaitConditionSchema` & typed `WaitConditionInput` / `WaitCondition`
  - `WorkflowStepSchema`: Partitioned step representation with dependency arrays, mutating flags, saga compensating capabilities, and output validation flags.
  - `WorkflowCheckpointSchema`: State transition checkpoint with sequence number, state payload, and chained SHA-256 integrity hashes.
  - `WorkflowInstanceSchema`: Root workflow run metadata with tenant IDs, initiator principal, step counters, and multi-dimensional budgets.
  - `WorkflowBudgetsSchema`: Default ceilings (`maxTotalDurationMs`: 7 days, `maxSteps`: 50, `maxRetries`: 5).
  - `WorkflowDefinitionSchema`: Reusable DAG template definition contract.
- **Structured Error Taxonomy (`WORKFLOW_ERROR_CODES` & `WorkflowError`):**
  - `WORKFLOW_NOT_FOUND`, `STEP_NOT_FOUND`, `CHECKPOINT_NOT_FOUND`, `INVALID_TRANSITION`, `TERMINAL_STATE_IMMUTABLE`, `TENANT_SCOPE_VIOLATION`, `IDEMPOTENCY_CONFLICT`, `WAIT_CONDITION_NOT_MET`, `TOKEN_EXPIRED`, `TOKEN_INVALID`, `BUDGET_EXCEEDED`, `COMPENSATION_FAILED`, `DEAD_MAN_PAUSED`, `CIRCUIT_BREAKER_OPEN`.
  - HTTP status mapping via `mapWorkflowErrorToHttpStatus`.
- **Strict Typing Policy:** Zero `any` or `any[]` (Rule 4).

### 2. Deterministic 10-State Machine & Cryptographic Checkpoint Chaining (`src/platform/workflows/workflow-state-machine.ts`)
- **FSM Transition Matrix (`VALID_WORKFLOW_TRANSITIONS`):**
  - Explicit allowed transition map preventing illegal jumps.
  - `assertValidWorkflowTransition(from, to)` verifies state flow and throws typed `WorkflowError`.
- **Terminal State Immutability:**
  - `isTerminalWorkflowState(state)` detects terminal states (`COMPLETED`, `FAILED`, `CANCELLED`, `TIMED_OUT`).
  - Any transition out of a terminal state throws `TERMINAL_STATE_IMMUTABLE`.
- **Cooperative Cancellation Predicate:**
  - `isCancellableWorkflowState(state)` allows all 6 non-terminal states (`CREATED`, `QUEUED`, `RUNNING`, `WAITING`, `RESUMED`, `VERIFYING`) to transition cleanly to `CANCELLED` (Rule 26).
- **Cryptographic Checkpoint Hash Chaining (Rule 40):**
  - `createCheckpointHash()` generates deterministic SHA-256 hashes from canonical key-sorted JSON payloads.
  - Includes `workflowId`, `sequence`, `fromState`, `toState`, `stepId`, `statePayload`, and `previousHash`.
  - Forms an immutable, tamper-evident cryptographic blockchain of all state changes for the workflow run.

### 3. Multi-Tenant Firestore Checkpoint Store & In-Memory Adapter (`src/platform/workflows/workflow-store.ts`)
- **Unified Contract (`WorkflowStore`):**
  - `createInstance(input)`: Atomic creation with idempotency key deduplication.
  - `getInstance(id, tenant)`: Tenant-scoped retrieval with Anti-IDOR validation.
  - `updateInstanceStatus(id, targetState, tenant, options)`: Atomic transition asserting valid state changes, recording state checkpoints, and persisting wait conditions.
  - `listInstances(options)`: Filtered pagination by tenant, status, and definition ID.
  - `createStep(input)`, `getStep(...)`, `updateStep(...)`, `listSteps(...)`: Subcollection partitioned steps with automatic parent counter updates (`total`, `completed`, `failed`, `skipped`).
  - `recordCheckpoint(input)`, `listCheckpoints(...)`, `getLatestCheckpoint(...)`: Subcollection partitioned cryptographic checkpoints.
- **Hermetic Testing Store (`createMemoryWorkflowStore`):**
  - High-performance, isolated in-memory implementation for unit and regression testing.
- **Production Firestore Store (`createFirestoreWorkflowStore`):**
  - Partitioned collections:
    - `/organizations/{orgId}/workflows/{workflowId}`
    - `/organizations/{orgId}/workflows/{workflowId}/steps/{stepId}`
    - `/organizations/{orgId}/workflows/{workflowId}/checkpoints/{checkpointId}`
  - Prevents Firestore 1MB document limit even in massive multi-week workflows (Rule 9).
  - All status transitions, step updates, and checkpoint additions execute inside `db.runTransaction` for concurrency safety (Rule 18 & 19).
- **HMR-Safe Singleton (`getWorkflowStore()`):**
  - Preserved across hot-module reloads on `globalThis.__smartsappWorkflowStore` (Rule 69).

### 4. Workflow Domain Event Subscribers & Universal EventBus Integration (`src/platform/workflows/subscribers/workflow-event-subscribers.ts`)
- **8 Workflow Domain Event Types (`WORKFLOW_EVENT_TYPES`):**
  - `workflow.created`
  - `workflow.state_changed`
  - `workflow.step_started`
  - `workflow.step_completed`
  - `workflow.step_failed`
  - `workflow.waiting`
  - `workflow.resumed`
  - `workflow.completed`
- **Helper Functions:**
  - `publishWorkflowEvent()`: Normalizes workflow metadata into standard `DomainEvent` envelopes and dispatches through `defaultEventBus`.
  - `subscribeToWorkflows()`: Subscribes reactive event handlers to workflow events with type-safe filtering.

### 5. Multi-Tenant Compound Query Indexing (`firestore.indexes.json`)
- Added compound indexes for collection `workflows`:
  - `workspaceId` (ASC), `status` (ASC), `createdAt` (DESC)
  - `workspaceId` (ASC), `definitionId` (ASC), `createdAt` (DESC)
  - `workspaceId` (ASC), `idempotencyKey` (ASC)
- Added compound indexes for subcollection `checkpoints`:
  - `workspaceId` (ASC), `checkpointSequence` (ASC)

---

## Test Suites & Verification Gates

### 1. Workflow Subsystem Tests (`src/platform/__tests__/workflows/`)
- `workflow-contracts.test.ts`: **15/15 passed** (Zod schemas, wait conditions, budgets, error codes, HTTP mapping)
- `workflow-state-machine.test.ts`: **12/12 passed** (transition matrix, terminal immutability, cooperative cancellation, SHA-256 hash chaining)
- `workflow-store.test.ts`: **8/8 passed** (atomic creation, idempotency conflicts, Anti-IDOR tenant isolation, step counter accumulation, subcollection checkpoints, status queries)
- `workflow-events.test.ts`: **2/2 passed** (EventBus dispatch, state change events, step completion payloads)
- **Total Workflow Tests:** **37/37 passed (100%)**

### 2. Platform Baseline Regression Tests (`src/platform/__tests__/baseline/`)
- `portal-membership.baseline.test.ts`: **12/12 passed**
- `tenant-isolation.baseline.test.ts`: **7/7 passed**
- `crm-lifecycle.baseline.test.ts`: **4/4 passed**
- `portal-experience.baseline.test.ts`: **4/4 passed**
- `messaging-pipeline.baseline.test.ts`: **10/10 passed**
- `automations-callcentre.baseline.test.ts`: **6/6 passed**
- **Total Baseline Tests:** **43/43 passed (100%)**

### 3. Static Analysis & Type Safety
- **TypeScript Compilation:** Clean exit code 0 (`NODE_OPTIONS='--max-old-space-size=8192' pnpm typecheck`), 0 errors.
- **ESLint Analysis:** Clean exit code 0 (`pnpm lint`), 0 errors.
- **Strict Typing Compliance:** Zero `any` or `any[]` (Rule 4).

---

## Milestone 1 Rule Compliance Matrix

| Rule # | Requirement | Implementation & Verification Evidence | Status |
|:---|:---|:---|:---:|
| **Rule 4** | Zero `any` / `any[]` Typing Policy | Verified via strict `tsc --noEmit` and ast-grep. All schemas strictly typed with Zod v4 and explicit interfaces. | **PASS** |
| **Rule 8** | Tenant Isolation & Anti-IDOR | Every store method asserts `record.organizationId === tenant.organizationId && record.workspaceId === tenant.workspaceId`. Tested in `workflow-store.test.ts`. | **PASS** |
| **Rule 9** | High Load & 1MB Protection | Steps and Checkpoints partitioned into subcollections `/workflows/{id}/steps` and `/checkpoints`. | **PASS** |
| **Rule 10** | Schema Validation | All payloads validated via Zod v4 schemas (`WorkflowInstanceSchema`, `WorkflowStepSchema`, `WorkflowCheckpointSchema`). | **PASS** |
| **Rule 18** | Concurrency Control | All Firestore updates and sequence increments execute inside atomic `db.runTransaction`. | **PASS** |
| **Rule 19** | Idempotency Deduplication | Store asserts uniqueness of `idempotencyKey` per tenant and throws `IDEMPOTENCY_CONFLICT` on duplicates. | **PASS** |
| **Rule 26** | Cooperative Cancellation | Non-terminal states transition cleanly to `CANCELLED` via `isCancellableWorkflowState`. | **PASS** |
| **Rule 40** | Audit Logging & Provenance | Checkpoints generate SHA-256 hash chains linking to `previousHash` for tamper-evident history. | **PASS** |
| **Rule 47** | Deep Multi-Tenancy Validation | Tenant boundaries enforced across root collections, subcollections, and event envelopes. | **PASS** |
| **Rule 69** | HMR Singleton Preservation | Store singleton preserved across HMR reloads on `globalThis.__smartsappWorkflowStore`. | **PASS** |

---

## Readiness Assessment for Milestone 2

With Phase 7 Milestone 1 complete:
- The 10-state machine, canonical contracts, and multi-tenant Firestore store provide the exact foundational substrate required by **Phase 7 Milestone 2: Cloud Tasks Orchestrator, Step Execution Pipeline & Idempotent Worker Dispatch**.
- Milestone 2 will implement the asynchronous dispatch queue, OIDC request authentication, step execution runner, and exponential backoff retry mechanics.
