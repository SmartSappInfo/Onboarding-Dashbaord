# Phase 7 Milestone 2: Cloud Tasks Step Dispatcher, At-Least-Once Delivery, Leases & Zombie Reaper Completion Report

**Date:** October 3, 2026  
**Status:** COMPLETE  
**Milestone:** Phase 7, Milestone 2  
**Author:** AI Agentic Architecture Team & Antigravity  

---

## Executive Summary

Phase 7 Milestone 2 delivers the **distributed execution engine** for SmartSapp's long-running durable workflows, transitioning from state machine storage to active distributed execution. Running under Serverless Cloud Run and Google Cloud Tasks constraints, Milestone 2 implements:
1. **Canonical Execution & Dispatcher Contracts** (`src/platform/workflows/dispatcher/workflow-dispatcher-types.ts`, `workflow-execution-types.ts`, augmented `WorkflowStepSchema`)
2. **Distributed Workflow Lease Manager with Heartbeats & Atomic Versioning** (`src/platform/workflows/execution/workflow-lease-manager.ts`)
3. **Cloud Tasks Workflow Step Dispatcher with Idempotency Deduplication** (`src/platform/workflows/dispatcher/workflow-dispatcher.ts`)
4. **Resilient 9-Stage Workflow Step Execution Runner** (`src/platform/workflows/execution/workflow-step-runner.ts`)
5. **Crash Recovery & Zombie Workflow Reaper** (`src/platform/workflows/execution/workflow-recovery-service.ts`)
6. **Deterministic Cryptographic Checkpoint Replay Engine** (`src/platform/workflows/execution/workflow-replay-engine.ts`)
7. **Cloud Tasks Webhook Route Handler with Dual OIDC + HMAC Authentication** (`src/app/api/tasks/workflow-step/route.ts`)

All components strictly comply with the 69 SmartSapp Agentic Development Rules, specifically Rule 4 (zero `any` or `any[]`), Rules 8 & 47 (strict multi-tenant isolation and Anti-IDOR enforcement), Rule 9 & 18 (atomic transactions and Firestore subcollection partitioning), Rule 14 (tool fingerprint drift verification), Rules 16 & 17 (least privilege authority checks and non-delegable action stripping), Rule 19 (deterministic idempotency deduplication keys), Rule 20 & 40 (tamper-evident audit logging and SHA-256 hash chaining), Rule 23 (bounded attempt retries and bounded recovery scans), Rule 26 (cooperative cancellation token checks), Rule 30 (XML reference isolation containers), Rule 33 & 34 (Cloud Tasks dual-auth verification), Rule 42 (shadow mode simulation dryRun support), Rule 43 (checkpoint replay engine), and Rule 60 (emergency dead-man switch 503 backoff semantics).

---

## Delivered Architecture & Artifacts

### 1. Canonical Execution & Dispatcher Contracts (`src/platform/workflows/dispatcher/` & `execution/`)
- **`src/platform/workflows/dispatcher/workflow-dispatcher-types.ts`:**
  - `WorkflowStepTaskPayloadSchema`: Minimal lightweight payload (< 2 KB) containing `organizationId`, `workspaceId`, `workflowId`, `stepId`, `attempt`, `idempotencyKey`, and `timestamp`. Strictly compliant with Cloud Run and Cloud Tasks payload size guidelines.
  - `WorkflowDispatcherOptionsSchema`: Queue name, URL path, delay, and backoff configuration.
  - `WorkflowDispatcher` interface for in-memory and production Cloud Tasks implementations.
- **`src/platform/workflows/execution/workflow-execution-types.ts`:**
  - `StepLeaseSchema`: Distributed lock record binding `leaseId`, `workflowId`, `stepId`, `workerId`, `version`, `acquiredAt`, and `expiresAt`.
  - `LeaseAcquisitionResultSchema` & `LeaseRenewalResultSchema`: Heartbeat and ownership verification results.
  - `ReplayVerificationResultSchema`: Verification report containing cryptographic hash chain status, reconstructed state, and detected anomalies (`valid`, `tampered`, `forked`).
  - `ZombieReapReportSchema`: Diagnostics from crash recovery scans (scanned, reaped, retried, failed).
  - Structured error taxonomy (`WORKFLOW_EXECUTION_ERROR_CODES` & `WorkflowExecutionError`).
- **`src/platform/workflows/workflow-types.ts`:**
  - Augmented `WorkflowStepSchema` with distributed execution fields: `leaseId`, `leaseExpiresAt`, `leaseWorkerId`, `attempt`, `maxAttempts`, `backoffDelayMs`, and `timeoutMs`.

### 2. Distributed Workflow Lease Manager (`src/platform/workflows/execution/workflow-lease-manager.ts`)
- **Mutual Exclusion & Concurrency Control (Rule 9 & 18):**
  - Manages distributed locks on workflow step subcollections to prevent split-brain worker executions.
  - Monotonic version incrementing (`version: previous + 1`) ensures optimistic locking safety.
  - TTL clamping: restricts lease duration strictly between 5,000ms and 300,000ms.
- **Heartbeat Renewal:**
  - `renewLease` allows active worker instances to extend leases before expiration, verifying worker ownership and version match.
- **Graceful Lease Stealing:**
  - When a worker dies or fails to heartbeat and `expiresAt < now`, new workers can acquire the lease cleanly without deadlock.
- **Store Implementations:**
  - `createMemoryWorkflowLeaseManager` for ultra-fast, isolated testing.
  - `createFirestoreWorkflowLeaseManager` executing inside `db.runTransaction` for production.
  - HMR singleton preservation via `getWorkflowLeaseManager()` on `globalThis.__smartsappWorkflowLeaseManager`.

### 3. Cloud Tasks Workflow Step Dispatcher (`src/platform/workflows/dispatcher/workflow-dispatcher.ts`)
- **Deduplicated Step Scheduling (Rule 9, 19, 33):**
  - Schedules tasks on Cloud Tasks queue `workflow-step-queue` targeting `/api/tasks/workflow-step`.
  - Sanitized deterministic task key generation: `wf_${workflowId}_s_${stepId}_a_${attempt}`.
  - Cloud Tasks deduplication window prevents duplicate task scheduling on network retries.
  - Payload < 2 KB avoids oversized task payloads.
- **Implementations:**
  - `MemoryWorkflowDispatcher` maintaining in-memory queue with inspection helpers.
  - `CloudTasksWorkflowDispatcher` wrapping `scheduleTaskWithKey` with OIDC service account authentication.
  - EventBus emission: `workflow.step_dispatched` on every enqueue.

### 4. Resilient 9-Stage Workflow Step Execution Runner (`src/platform/workflows/execution/workflow-step-runner.ts`)
- **Full Pipeline Execution (Rules 14, 18, 20, 26, 30, 40, 47, 60):**
  1. **Rule 60 Dead-Man Switch Evaluation:** Throws `DEAD_MAN_PAUSED` if emergency kill-switch is active.
  2. **Distributed Lease Acquisition:** Secures exclusive worker lease before reading or mutating step state.
  3. **Pre-Execution Step Validation:** Validates step existence, matches tenant context, and verifies non-terminal and non-cancelled run state (Rule 26).
  4. **Prompt Injection & Adversarial Defense:** Scans step input arguments and sanitizes instructions inside `<untrusted_reference_data id="...">` containers (Rules 13 & 30).
  5. **Principal Evaluator Authority Verification:** Evaluates caller permissions against capability domains, strictly denying non-delegable actions to automated agents (Rules 16 & 17).
  6. **Cryptographic Tool Fingerprint Drift Guard:** Verifies tool SHA-256 fingerprint against approved baseline, failing closed on schema or prompt drift (Rule 14).
  7. **Capability Execution:** Dispatches capability with optional shadow mode dryRun support (Rule 42).
  8. **Step Output Verification & Cryptographic Checkpointing:** Verifies output schema, transitions step status, updates workflow counters, and appends a SHA-256 chained checkpoint (Rule 40).
  9. **Lease Release & Domain Event Emission:** Releases lease cleanly and emits `workflow.step_completed` or `workflow.step_failed`.
- **Exponential Backoff Retry Engine:**
  - Automatically calculates backoff delay with jitter: `delay = min(baseDelay * 2^(attempt - 1) + jitter, maxDelay)`.
  - Re-dispatches step to Cloud Tasks queue when attempts remain.

### 5. Crash Recovery & Zombie Workflow Reaper (`src/platform/workflows/execution/workflow-recovery-service.ts`)
- **Automated Orphan Detection (Rule 9 & 23):**
  - Scans for steps in `RUNNING` status whose distributed lease has expired (`leaseExpiresAt < now`).
  - Bounded query pagination (`limit(50)`) prevents Firestore query exhaustion.
- **Self-Healing Recovery:**
  - Breaks expired lease, marks previous worker dead, increments attempt count.
  - If `attempt < maxAttempts`: re-queues step and dispatches fresh task to Cloud Tasks.
  - If `attempt >= maxAttempts`: marks step as `FAILED`, marks parent workflow as `FAILED`, records audit checkpoint, and emits `workflow.step_failed`.

### 6. Deterministic Checkpoint Replay Engine (`src/platform/workflows/execution/workflow-replay-engine.ts`)
- **Cryptographic Audit Chain Verification (Rule 40 & 43):**
  - Loads all historical checkpoints for a workflow instance sorted by sequence.
  - Recomputes SHA-256 hash at each sequence step: `SHA-256(workflowId + sequence + fromState + toState + stepId + JSON(statePayload) + previousHash)`.
  - Verifies hash matches stored hash (detects payload tampering).
  - Verifies `previousHash` matches hash of sequence - 1 (detects blockchain fork or checkpoint deletion).
- **Time-Travel State Reconstruction:**
  - Reconstructs complete workflow instance state, step outputs, and variable context up to any target sequence.

### 7. Cloud Tasks Webhook Route Handler (`src/app/api/tasks/workflow-step/route.ts`)
- **Defense-in-Depth Security (Rules 33, 34, 51, 60):**
  - **Dual Cloud Tasks Authentication:**
    1. Secret HMAC handshake header (`x-cloudtasks-signature` verified via `isAuthorizedCloudTaskRequest`).
    2. Google OIDC bearer token (`Authorization: Bearer <token>` verified via `verifyCloudTasksOidcToken`).
  - **Rule 60 Dead-Man Switch Response:** Returns HTTP 503 Service Unavailable so Cloud Tasks automatically applies exponential backoff without dropping the task.
  - **Anti-IDOR & Payload Validation:** Validates payload strictly against `WorkflowStepTaskPayloadSchema` (Zod v4).
  - **Execution Dispatch:** Instantiates `WorkflowStepRunner` and executes the step, returning HTTP 200 on success and HTTP 500 on retryable error.

---

## Test Verification & Quality Gates

### Test Suites Executed
1. `src/platform/__tests__/workflows/workflow-dispatcher-contracts.test.ts` (13 tests)
2. `src/platform/__tests__/workflows/workflow-lease-manager.test.ts` (7 tests)
3. `src/platform/__tests__/workflows/workflow-dispatcher.test.ts` (6 tests)
4. `src/platform/__tests__/workflows/workflow-step-runner.test.ts` (6 tests)
5. `src/platform/__tests__/workflows/workflow-recovery.test.ts` (3 tests)
6. `src/platform/__tests__/workflows/workflow-replay.test.ts` (4 tests)
7. `src/platform/__tests__/workflows/workflow-step-route.test.ts` (6 tests)
8. `src/platform/__tests__/workflows/workflow-contracts.test.ts` (15 tests)
9. `src/platform/__tests__/workflows/workflow-state-machine.test.ts` (12 tests)
10. `src/platform/__tests__/workflows/workflow-store.test.ts` (8 tests)
11. `src/platform/__tests__/workflows/workflow-events.test.ts` (2 tests)

**Result:** **11 passed test files, 82 passed tests (100% pass rate).**

### Regression Verification
- `src/platform/__tests__/baseline/` suite: **6 passed test files, 43 passed tests (0 regressions).**

---

## Rule Compliance Summary

| Rule | Description | Status | Evidence |
|---|---|---|---|
| Rule 4 | Zero `any` or `any[]` typing policy | PASS | Verified in all runner, lease, dispatcher, replay, and route files. |
| Rule 6 | Strict Zod v4 import policy (`zod/v4`) | PASS | Standardized across all workflow schema definitions. |
| Rule 8 & 47 | Strict Multi-Tenant Scoping & Anti-IDOR | PASS | Tenant boundaries enforced across lease manager, runner, dispatcher, and reaper. |
| Rule 9 & 18 | Firestore 1MB subcollections & atomic transactions | PASS | Steps, leases, and checkpoints partitioned into subcollections with transactional mutations. |
| Rule 14 | Tool Fingerprint Drift Verification | PASS | Runner verifies tool SHA-256 fingerprint before capability dispatch. |
| Rule 16 & 17 | Least Privilege & Non-Delegable Actions | PASS | Runner evaluates principal authority and strips non-delegable permissions from automated agents. |
| Rule 19 | Deterministic Idempotency Keys | PASS | Cloud Tasks deduplication keys formatted as `wf_${id}_s_${step}_a_${attempt}`. |
| Rule 20 & 40 | Cryptographic Hash Chaining & Audit Logging | PASS | Replay engine recomputes and validates SHA-256 hash chains. |
| Rule 23 | Bounded Ceilings & Loop Protections | PASS | Max retry attempts enforced; zombie reaper limits scans to 50 items. |
| Rule 26 | Cooperative Cancellation | PASS | Runner checks run status before execution, aborting if cancelled. |
| Rule 30 | XML Reference Isolation Containers | PASS | Untrusted arguments wrapped in `<untrusted_reference_data>` containers. |
| Rule 33 & 34 | Cloud Tasks Webhook Security & Outbound Guards | PASS | Dual HMAC + Google OIDC auth required on `/api/tasks/workflow-step`. |
| Rule 42 | Shadow Mode Dry-Run Simulation | PASS | Runner honors dryRun flags bypassing live external mutations. |
| Rule 43 | Replay Engine Point-in-Time Reconstruction | PASS | Deterministic replayer detects forks and tampering. |
| Rule 60 | Governance Dead-Man Switch | PASS | Route handler returns HTTP 503 for Cloud Tasks automatic backoff during emergency pause. |
| Rule 66 | Git Remote Branch Safety | PASS | Zero unprompted git pushes performed. |
| Rule 69 | HMR Singleton Preservation | PASS | Singletons bound to `globalThis` with fallback guards. |

---

## Conclusion & Readiness for Milestone 3

Phase 7 Milestone 2 provides the rock-solid, production-grade distributed execution runtime required for enterprise workflows. The platform is now fully prepared to begin **Phase 7 Milestone 3: Saga Orchestration, Dual-Phase Compensations, Operator Interventions & Workflow Sagas**.
