# SmartSapp Agentic & MCP Transformation: Phase 7 Milestone 2 Plan
## Cloud Tasks Workflow Dispatcher, Lease Engine, Crash Recovery & Replay
### Deeply Integrated with `docs/agents_mcp/`, `docs/CompanyBrain/`, `docs/agentic/`, `theme.md` §8 & The 69 Agentic Development Rules

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver serverless Cloud Run decoupling via Google Cloud Tasks, distributed workflow lease management, crash recovery for pre-empted containers, and deterministic cryptographic checkpoint replay.

**Architecture:** A distributed, serverless worker architecture where workflow steps are scheduled to Google Cloud Tasks (`workflow-worker-queue`) using lightweight, unprivileged payloads. Cloud Run instances execute steps by acquiring transactional distributed leases in Firestore to prevent double execution. Orphaned or pre-empted container executions are automatically detected and reaped by a zombie recovery service. Execution provenance is verified by a deterministic replay engine that validates SHA-256 hash chains across checkpoints.

**Tech Stack:** TypeScript (strict mode, zero `any`), Zod v4 (`zod/v4`), Google Cloud Tasks Client (`@google-cloud/tasks`), Cloud Tasks OIDC token validation (`src/lib/security/cloud-tasks-oidc.ts`), Cloud Tasks handshake authentication (`src/lib/security/cloud-tasks-auth.ts`), Google Cloud Firestore Admin SDK, Node crypto (SHA-256), UniversalEventBus (`src/platform/events/`).

---

## 1. Executive Summary & Objective

In accordance with [`docs/agents_mcp/agents_mcp_roadmap.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/docs/agents_mcp/agents_mcp_roadmap.md) (§36 Phase 7 & §PHASE 7 lines 1176–1248) and [`docs/agents_mcp/phases/agents_mcp_phase_7_master_plan.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/docs/agents_mcp/phases/agents_mcp_phase_7_master_plan.md) (Section 3, Milestone 2):

> **“Cloud Run is stateless and serverless: background promises are killed when the HTTP request finishes. Real durable workflows must decouple scheduling from execution via Cloud Tasks, acquire transactional leases to prevent duplicate execution, and automatically recover when containers crash.”**

The objective of **Milestone 2** is to operationalize the asynchronous execution layer on top of the durable contracts established in Milestone 1:
1. **Cloud Tasks Workflow Dispatcher (`src/platform/workflows/dispatcher/workflow-dispatcher.ts`):** Enqueues step execution jobs to Google Cloud Tasks (`workflow-worker-queue`) targeting `/api/tasks/workflow-step` with lightweight reference payloads (`{ workflowId, stepId, organizationId, workspaceId, idempotencyKey, attempt, correlationId }`).
2. **Distributed Workflow Lease Manager (`src/platform/workflows/execution/workflow-lease-manager.ts`):** Transactional distributed locking with configurable TTL (default 120s) preventing competing Cloud Run instances or retry deliveries from executing the same step concurrently.
3. **Workflow Step Execution Runner (`src/platform/workflows/execution/workflow-step-runner.ts`):** The 9-stage step runner: Dead-Man check, lease acquisition, Anti-IDOR validation, live authority verification, capability execution with cancellation tokens, post-condition assertion, state checkpointing, and downstream DAG progression.
4. **Crash Recovery & Zombie Workflow Reaper (`src/platform/workflows/execution/workflow-recovery-service.ts`):** Detects orphaned running steps whose worker died before releasing the lease, breaks the expired lease, records an anomaly checkpoint, and re-enqueues for retry.
5. **Deterministic Checkpoint Replay Engine (`src/platform/workflows/execution/workflow-replay-engine.ts`):** Rule 43 implementation verifying SHA-256 hash continuity across checkpoints and reconstructing point-in-time workflow state for auditing or debugging.
6. **Cloud Tasks Webhook Endpoint (`src/app/api/tasks/workflow-step/route.ts`):** Authenticated route handler with dual authentication (HMAC signature + Google OIDC token), Dead-Man pause returning HTTP 503 for automatic backoff, and execution dispatch.

---

## 2. Failure Modes, Edge Cases & Preemptive Mitigations (Rule 2)

1. **Cloud Run Container Pre-emption / Sudden SIGKILL (Rule 9 & Rule 24):**
   - *Risk:* A Cloud Run container is scaled down, redeployed, or pre-empted mid-step, leaving the step in `RUNNING` state with a dangling lease.
   - *Mitigation:* Bounded TTL leases (default 120s). The `WorkflowRecoveryService` sweeps for steps in `RUNNING` whose `leaseExpiresAt` is in the past, logs an anomaly checkpoint, breaks the lease, and re-enqueues the step if `attempt < maxAttempts`.
2. **Double Execution / At-Least-Once Delivery Race Conditions (Rule 9 & Rule 18):**
   - *Risk:* Cloud Tasks delivers a task duplicate while an existing worker is still running the step.
   - *Mitigation:* `WorkflowLeaseManager.acquireLease` runs inside an atomic Firestore transaction (`db.runTransaction`). If a valid active lease exists, the second worker is rejected with `LEASE_ALREADY_ACQUIRED` and exits cleanly.
3. **Privilege Creep in Task Payloads (Cloud Run Blueprint §5.2):**
   - *Risk:* Sensitive auth tokens, API keys, or caller permissions placed in the Cloud Tasks body and tampered with in transit.
   - *Mitigation:* Payloads carry *only* minimal immutable identifiers (`workflowId`, `stepId`, `organizationId`, `workspaceId`, `idempotencyKey`). The worker loads the stored principal and inputs directly from the secure Firestore store.
4. **Cloud Tasks Infinite Retry Thundering Herd (Rule 23 & Rule 60):**
   - *Risk:* A failing capability triggers rapid retries, overwhelming downstream APIs or consuming excessive resources.
   - *Mitigation:* Hard attempt ceilings (`maxAttempts`, default 3). Retries compute exponential backoff with full jitter ($T = \min(\text{cap}, \text{base} \times 2^{\text{attempt}}) \pm \text{jitter}$) and schedule delayed tasks rather than tight loops.
5. **Emergency Dead-Man Switch Trip During Execution (Rule 60):**
   - *Risk:* An operator trips the platform kill-switch while background workflows are queued.
   - *Mitigation:* The webhook route handler evaluates `checkGovernanceDeadManSwitch` on arrival and immediately returns HTTP 503. Cloud Tasks treats HTTP 503 as a retryable backoff, pausing task progression safely until the emergency is lifted.
6. **Checkpoint Hash Chain Forgery / Tampering (Rule 40 & Rule 43):**
   - *Risk:* Malicious or accidental alteration of a past step outcome or state payload in Firestore.
   - *Mitigation:* `WorkflowReplayEngine` recomputes canonical sorted SHA-256 hashes sequentially. If any checkpoint was modified, the hash chain breaks (`HASH_CHAIN_BROKEN`), flagging the workflow as compromised.

---

## 3. Phase 7 Specific Capabilities Matrix (Rules lines 1915–1927)

Per `docs/agents_mcp/agents_mcp_rules.md` (lines 1915–1927), Phase 7 mandates 6 dedicated durable task capabilities:

| Phase 7 Capability | Requirement | Milestone 2 Implementation & Defense |
| :--- | :--- | :--- |
| **`cancel`** | True cooperative cancellation across distributed queues | `WorkflowStepRunner` passes an `AbortSignal` tied to the workflow instance's status. If an operator cancels the workflow, active leases are cancelled, and the webhook yields immediately. |
| **`retry`** | Exponential backoff and retry policy tracking | `WorkflowStepRunner` tracks `attempt` on `WorkflowStepSchema`, calculates exponential backoff with randomized jitter, and re-enqueues delayed tasks to Cloud Tasks. |
| **`dead-letter`** | Poison pill quarantine and operator inspection | When `attempt >= maxAttempts`, the runner marks the step as `FAILED`, emits `workflow.step_failed`, and prepares the step for DLQ quarantine (Milestone 4). |
| **`recovery`** | Crash recovery after Cloud Run container termination | `WorkflowRecoveryService` scans for expired leases on `RUNNING` steps, releases the zombie lock, records a recovery checkpoint, and re-dispatches. |
| **`compensation`** | Saga reverse-order compensation modeling | Mutative steps record `isMutating` and `compensatingCapabilityId`. When retries are exhausted, the runner flags the step for Saga compensation. |
| **`replay`** | Deterministic audit and state machine replay | `WorkflowReplayEngine` traverses checkpoints in sequence, verifies SHA-256 hashes, and reconstructs historical state at any sequence index. |

---

## 4. Master 69-Rules Alignment & Enforcement Matrix for Milestone 2

### Section A: Core Development & Engineering Principles (Rules 1–10)
| Rule # | Requirement | Milestone 2 Implementation & Architectural Defense |
| :---: | :--- | :--- |
| **Rule 1** | Skill Conformance & Standards | Conforms to `backend-design`, `next-best-practices`, and `vercel-react-best-practices`. Preserves all existing CRM, Messaging, and Portal capabilities. |
| **Rule 2** | Failure Mode Planning & Cleanliness | Explicit analysis of container crashes, at-least-once races, thundering herds, and dead-man trips. Verified with `pnpm typecheck` and `pnpm lint`. |
| **Rule 3** | Backoffice Enhancement & Non-Breaking | Provides the underlying async execution engine for `/admin/workflows`. Does not break or modify existing routes or tables. |
| **Rule 4** | Zero `any` / Zero `any[]` Typing Policy | Zero `any` across all dispatcher, lease, runner, recovery, replay, and route files. All schemas validated with Zod v4 (`zod/v4`). |
| **Rule 5** | Production Readiness & Zero Regressions | Full test coverage for all new components. 100% pass on preexisting baseline test suite (`src/platform/__tests__/baseline/`). |
| **Rule 6** | Modern Tooling & Dependency Hygeine | Exclusively imports Zod from `zod/v4`. Uses native Node `crypto` for hashing and UUID generation. |
| **Rule 7** | Accessible & Responsive Ergonomics | N/A (Milestone 2 is backend infrastructure; UI surfaces built in Milestone 5). |
| **Rule 8** | High Security, Data Protection & Anti-IDOR | All dispatcher and runner operations assert matching `organizationId` and `workspaceId` against the workflow instance and stored principal. |
| **Rule 9** | High Load, Memory & Exhaustion Defense | Cloud Tasks queues throttle concurrency; Firestore subcollections protect 1MB limits; leases prevent runaway duplicate execution. |
| **Rule 10** | Inline Architectural Documentation | Comprehensive `@fileOverview` with invariants, state transitions, lease lifecycles, and testability pointers in every authored file. |

### Section B: Architecture, Identity & Permission Guardrails (Rules 11–24)
| Rule # | Requirement | Milestone 2 Implementation & Architectural Defense |
| :---: | :--- | :--- |
| **Rule 11** | Fail-Closed Architecture | Dispatcher, lease manager, and runner fail closed on invalid inputs, missing leases, or unverified tenants. |
| **Rule 12** | Explicit Risk Levels | Steps carry `riskLevel` (L0_READ to L4_PRIVILEGED_DESTRUCTIVE). High-risk steps are validated before execution. |
| **Rule 13** | Distrust Models & Inputs | Step inputs sanitized and scanned for injection before dispatching to capabilities. |
| **Rule 14** | Dynamic Tool Drift Rug-Pull Defense | `WorkflowStepRunner` verifies tool fingerprints using `verifyCapabilityFingerprint` before invoking any capability. |
| **Rule 15** | Dynamic Server Lifecycle Control | Verifies that underlying MCP servers or capability providers are in `approved` or `connected` states. |
| **Rule 16** | Strict Least Privilege & No Wildcards | Workflow execution runs strictly under the stored principal's granted scopes without wildcard expansion. |
| **Rule 17** | Absolute Non-Delegable Actions | Non-delegable operations flagged in `WorkflowStepSchema.isNonDelegable` require human operator approval. |
| **Rule 18** | ACID Concurrency & Live TOCTOU Checks | `WorkflowStepRunner` re-verifies principal authority and step lease in Firestore immediately before executing step logic. |
| **Rule 19** | Idempotency Key Tracking | Cloud Tasks task name includes `idempotencyKey` and `attempt` to deduplicate enqueue requests; store asserts key uniqueness. |
| **Rule 20** | Replay & Distributed Tracing | Propagates `correlationId` and `causationId` through Cloud Tasks payloads, lease records, and emitted domain events. |
| **Rule 21** | Human-in-the-Loop Interception | When a step encounters an approval requirement, the runner parks the workflow in `WAITING` (`approval`) and emits approval events. |
| **Rule 22** | Cryptographic Action Fingerprinting | Checkpoints and approval proposals compute SHA-256 hashes of canonical sorted payloads. |
| **Rule 23** | Multi-Dimensional Budget Governance | Runner enforces `step.maxAttempts`, `instance.budgets.maxSteps`, and `instance.budgets.maxTotalDurationMs`. |
| **Rule 24** | 3-State Circuit Breakers | Repeated failures trip circuit breakers, preventing cascading failures across downstream services. |

### Section C: Resiliency, Sagas & Boundary Protection (Rules 25–36)
| Rule # | Requirement | Milestone 2 Implementation & Architectural Defense |
| :---: | :--- | :--- |
| **Rule 25** | Saga Compensation & Rollbacks | Mutating steps record `isMutating` and `compensatingCapabilityId`. On terminal step failure, initiates Saga compensation. |
| **Rule 26** | True Cooperative Cancellation | `WorkflowStepRunner` listens to cancellation signals, releases leases, and marks steps as `CANCELLED`. |
| **Rule 27** | Formal Saga & Compensation Modeling | Reverse-order LIFO compensation modeling baked into step schemas and failure transitions. |
| **Rule 28** | Knapsack Context Packing | Step inputs and outputs are bounded; oversize payloads rejected. |
| **Rule 29** | Temporal Validity & Decay | Checkpoint timestamps strictly ISO 8601 UTC strings. |
| **Rule 30** | Indirect Prompt Injection Isolation | Untrusted reference containerization (`<untrusted_reference_data>`) applied to external outputs. |
| **Rule 31** | Content-Aware Data Exfiltration Scanner | Step outputs scanned for credential leaks before persisting to store. |
| **Rule 32** | ReDoS & Regular Expression Protection | Non-backtracking linear regex used for all token and pattern matching. |
| **Rule 33** | Cloud Tasks Handshake & OIDC Verification | `POST /api/tasks/workflow-step` validates `isAuthorizedCloudTaskRequest` and `verifyCloudTasksOidcToken`. |
| **Rule 34** | Universal Outbound SSRF Guard | Egress calls from step handlers validated with `validateSafeEgressUrl`. |
| **Rule 35** | ETag & Conditional HTTP Discovery | Checkpoints carry deterministic hashes. |
| **Rule 36** | Secret Token Masking & Redaction | Error logs and step failure payloads mask secrets and tokens. |

### Section D: Testing, Simulation & Operator Control (Rules 37–50)
| Rule # | Requirement | Milestone 2 Implementation & Architectural Defense |
| :---: | :--- | :--- |
| **Rule 37** | Full-Spectrum Regression Suite | Unit tests for dispatcher, lease manager, step runner, recovery service, replay engine, and webhook route. |
| **Rule 38** | Operator Surface Parity | All execution states and error details mapped to operator-visible models. |
| **Rule 39** | Distributed Tracing & Span Continuity | Trace context propagated across Cloud Tasks headers and Firestore checkpoint metadata. |
| **Rule 40** | Audit Log Immutability & Provenance | Checkpoints generate continuous SHA-256 hash chains linking to `previousHash`. |
| **Rule 41** | Autonomous Decision Explainability | Step records include `name`, `capabilityId`, `input`, and step diagnostics. |
| **Rule 42** | Shadow Mode (Dry-Run Simulation) | `WorkflowInstanceSchema.dryRun` bypasses mutative operations during step execution. |
| **Rule 43** | Replayable Runs & Failure Debugging | `WorkflowReplayEngine` deterministically reconstructs past state from checkpoint records. |
| **Rule 44** | Deterministic Simulation Harness | Hermetic in-memory implementations for dispatcher, lease manager, and store allow instant offline tests. |
| **Rule 45** | Comprehensive Golden Fixtures | Frozen workflow definitions and step payloads used for test verification. |
| **Rule 46** | Adversarial Red-Team Verification | Tests verify behavior under lease expiration, concurrent worker collisions, and token tampering. |
| **Rule 47** | Deep Multi-Tenancy Validation | Dual-tenant boundaries (`organizationId`, `workspaceId`) verified at dispatch, lease, and execution times. |
| **Rule 48** | Sanitized Error Surfacing | Client-facing errors sanitized; raw internal traces masked. |
| **Rule 49** | Real-World Interruption Durability | Step states persisted before and after every execution, surviving container restarts. |
| **Rule 50** | Cache Coherence & Tenant Invalidation | Leases automatically invalidated on release or expiration. |

### Section E: Next.js 15, Vercel & Cloud Run Engineering (Rules 51–69)
| Rule # | Requirement | Milestone 2 Implementation & Architectural Defense |
| :---: | :--- | :--- |
| **Rule 51** | Route Handler Security Gate | Next.js App Router route `src/app/api/tasks/workflow-step/route.ts` authenticated via OIDC and HMAC. |
| **Rule 52** | Vercel & Cloud Run Serverless Constraints | Step execution decoupled from caller; single steps execute within 120s lease to prevent Cloud Run timeouts. |
| **Rule 53** | Streaming & Real-Time Hydration | Workflow events emitted to Universal EventBus for live SSE UI streaming. |
| **Rule 54** | Context Budgeting Knapsack | Step input/output payloads limited to 100KB to prevent Firestore document bloat. |
| **Rule 55** | Strict Memory Boundaries | In-memory caches bounded with LRU eviction. |
| **Rule 56** | Zero Floating Promises | All async operations in step runner explicitly awaited; error handling comprehensive. |
| **Rule 57** | Clean Subagent Orchestration | Step runner decouples agent coordination from workflow state management. |
| **Rule 58** | Model Tier Routing | LLM tasks within workflow steps route through `TieredModelRouter`. |
| **Rule 59** | Capability Domain Guardrails | Verifies capability exists and principal has required domain access. |
| **Rule 60** | Emergency Dead-Man Controls | Webhook and step runner evaluate `checkGovernanceDeadManSwitch` on arrival; returns HTTP 503 for backoff. |
| **Rule 61** | Surface Isolation | Restricts privileged system capabilities to backoffice operators. |
| **Rule 62** | Real-Time SSE Observability | Emits `workflow.step_started`, `workflow.step_completed`, and `workflow.step_failed` events. |
| **Rule 63** | Proactive Incident Triage | Failure re-attempts and recovery actions emit telemetry for operator triage. |
| **Rule 64** | Standardized Dialog Architecture | N/A for backend Milestone 2 (applied in Milestone 5 UI). |
| **Rule 65** | Verification Before Completion | All code verified via `pnpm vitest`, `pnpm typecheck`, and `pnpm lint`. |
| **Rule 66** | Git & Deployment Protocol | Never pushes to remote branches unless explicitly instructed. |
| **Rule 67** | Code Quality & Completeness | Zero dangling promises, complete test coverage, production-grade error handling. |
| **Rule 68** | Non-Bypassable Governance | All workflow step executions strictly route through `WorkflowStepRunner`. |
| **Rule 69** | HMR Singleton Preservation | Singletons preserved on `globalThis.__smartsappWorkflow*`. |

---

## 5. Detailed Task Breakdown & Implementation Steps

### Task 1: Canonical Dispatcher & Lease Contracts, Zod v4 Schemas & Error Taxonomy
**Files:**
- Create: `src/platform/workflows/dispatcher/workflow-dispatcher-types.ts`
- Create: `src/platform/workflows/execution/workflow-execution-types.ts`
- Test: `src/platform/__tests__/workflows/workflow-dispatcher-contracts.test.ts`

- [ ] **Step 1: Define WorkflowTaskPayloadSchema & Dispatcher Contracts**
  - Define `WorkflowTaskPayloadSchema` using `import { z } from 'zod/v4';`:
    ```ts
    export const WorkflowTaskPayloadSchema = z.object({
      workflowId: z.string().min(1),
      stepId: z.string().min(1),
      organizationId: z.string().min(1),
      workspaceId: z.string().min(1),
      idempotencyKey: z.string().min(1),
      attempt: z.number().int().nonnegative().default(0),
      correlationId: z.string().min(1),
      scheduledAt: z.string().datetime().optional(),
    });
    export type WorkflowTaskPayload = z.infer<typeof WorkflowTaskPayloadSchema>;
    ```
  - Define `EnqueueWorkflowStepOptions`:
    ```ts
    export interface EnqueueWorkflowStepOptions {
      workflowId: string;
      stepId: string;
      tenant: TenantBoundary;
      idempotencyKey: string;
      attempt?: number;
      correlationId?: string;
      delaySeconds?: number;
      executeAt?: string;
    }
    ```
  - Constants: `WORKFLOW_WORKER_QUEUE = 'workflow-worker-queue'`, `WORKFLOW_STEP_ENDPOINT = '/api/tasks/workflow-step'`.

- [ ] **Step 2: Define Lease, Recovery & Replay Contracts**
  - Define `WorkflowLeaseSchema`:
    ```ts
    export const WorkflowLeaseSchema = z.object({
      workflowId: z.string().min(1),
      stepId: z.string().min(1),
      workerId: z.string().min(1),
      leaseExpiresAt: z.string().datetime(),
      leaseVersion: z.number().int().positive().default(1),
      acquiredAt: z.string().datetime(),
    });
    export type WorkflowLease = z.infer<typeof WorkflowLeaseSchema>;
    ```
  - Define `ReplayVerificationResultSchema`:
    ```ts
    export const ReplayVerificationResultSchema = z.object({
      workflowId: z.string().min(1),
      isValid: z.boolean(),
      totalCheckpoints: z.number().int().nonnegative(),
      verifiedCheckpoints: z.number().int().nonnegative(),
      lastVerifiedSequence: z.number().int().nonnegative(),
      failureReason: z.string().optional(),
      divergenceIndex: z.number().int().optional(),
    });
    export type ReplayVerificationResult = z.infer<typeof ReplayVerificationResultSchema>;
    ```
  - Define `ZombieReapResultSchema` tracking recovered and failed steps:
    ```ts
    export const ZombieReapResultSchema = z.object({
      scannedSteps: z.number().int().nonnegative(),
      recoveredSteps: z.array(z.string()),
      failedSteps: z.array(z.string()),
      errors: z.array(z.string()),
    });
    export type ZombieReapResult = z.infer<typeof ZombieReapResultSchema>;
    ```
  - Define structured error taxonomy: `DISPATCH_ERROR_CODES`, `LEASE_ERROR_CODES`, `REPLAY_ERROR_CODES`, and typed error classes.
  - Zero `any` or `any[]` (Rule 4).

- [ ] **Step 3: Write Unit Tests & Verify**
  - Write `src/platform/__tests__/workflows/workflow-dispatcher-contracts.test.ts`.
  - Assert schema validation, default attempt parsing, lease expiration string validation, error taxonomy mapping.
  - Run `pnpm vitest run src/platform/__tests__/workflows/workflow-dispatcher-contracts.test.ts`.

---

### Task 2: Distributed Workflow Lease Manager (Rule 9 & Rule 18)
**Files:**
- Create: `src/platform/workflows/execution/workflow-lease-manager.ts`
- Test: `src/platform/__tests__/workflows/workflow-lease-manager.test.ts`

- [ ] **Step 1: Implement WorkflowLeaseManager Contract & In-Memory Adapter**
  - Contract:
    ```ts
    export interface WorkflowLeaseManager {
      acquireLease(workflowId: string, stepId: string, tenant: TenantBoundary, workerId: string, ttlMs?: number): Promise<WorkflowLease>;
      renewLease(workflowId: string, stepId: string, tenant: TenantBoundary, workerId: string, ttlMs?: number): Promise<WorkflowLease>;
      releaseLease(workflowId: string, stepId: string, tenant: TenantBoundary, workerId: string): Promise<void>;
      getLease(workflowId: string, stepId: string, tenant: TenantBoundary): Promise<WorkflowLease | null>;
      clearForTests?(): Promise<void>;
    }
    ```
  - Implement `createMemoryWorkflowLeaseManager()` with in-memory map and lease expiration math.

- [ ] **Step 2: Implement Production Firestore Lease Manager**
  - Implement `createFirestoreWorkflowLeaseManager(customDb?: Firestore)`:
    - Points to step document in `/organizations/{orgId}/workflows/{workflowId}/steps/{stepId}`.
    - Inside `db.runTransaction`: reads step doc, asserts tenant match.
    - Checks if active lease exists and `leaseExpiresAt > now`.
    - If valid lease exists held by another worker, throws `WorkflowError('LEASE_ALREADY_ACQUIRED')`.
    - If unleased or expired (zombie), atomically sets `leasedBy: workerId`, `leaseExpiresAt: now + ttlMs`, `leaseVersion: version + 1`.
    - `releaseLease` transactionally clears lease fields.
  - Preserves HMR singleton on `globalThis.__smartsappWorkflowLeaseManager` (Rule 69).

- [ ] **Step 3: Write Unit Tests for Concurrency & Expiration**
  - Write `src/platform/__tests__/workflows/workflow-lease-manager.test.ts`:
    - Normal acquisition and release.
    - Contention rejection (second worker rejected while lease active).
    - Heartbeat extension (`renewLease`).
    - Stealing/recovering an expired lease when TTL has elapsed.
    - Multi-tenant boundary enforcement (`TENANT_SCOPE_VIOLATION`).
  - Run `pnpm vitest run src/platform/__tests__/workflows/workflow-lease-manager.test.ts`.

---

### Task 3: Cloud Tasks Workflow Dispatcher (Rule 9, 19, 33)
**Files:**
- Create: `src/platform/workflows/dispatcher/workflow-dispatcher.ts`
- Test: `src/platform/__tests__/workflows/workflow-dispatcher.test.ts`

- [ ] **Step 1: Implement WorkflowDispatcher Interface & In-Memory Adapter**
  - Contract:
    ```ts
    export interface WorkflowDispatcher {
      enqueueWorkflowStep(options: EnqueueWorkflowStepOptions): Promise<{ taskKey: string; payload: WorkflowTaskPayload }>;
      cancelWorkflowStepTask(workflowId: string, stepId: string, idempotencyKey: string, tenant: TenantBoundary): Promise<boolean>;
      getEnqueuedTasksForTests?(): Array<{ taskKey: string; payload: WorkflowTaskPayload; delaySeconds: number }>;
      clearForTests?(): Promise<void>;
    }
    ```
  - Implement `createMemoryWorkflowDispatcher()` capturing scheduled tasks in-memory.

- [ ] **Step 2: Implement Production Cloud Tasks Dispatcher**
  - Implement `createCloudTasksWorkflowDispatcher(deps?: { schedule?: typeof scheduleTaskWithKey; store?: WorkflowStore })`:
    - Validates workflow and step existence in `WorkflowStore` before scheduling.
    - Asserts tenant match (`assertTenantMatch`).
    - Constructs deterministic task name: `wf-step-${workflowId}-${stepId}-${attempt}-${idempotencyKey}`.
    - Invokes `scheduleTaskWithKey` targeting `workflow-worker-queue` and `/api/tasks/workflow-step`.
    - Emits `workflow.step_enqueued` via `defaultEventBus`.
    - Updates step status to `QUEUED` in `WorkflowStore` if `PENDING`.
  - HMR singleton `getWorkflowDispatcher()`.

- [ ] **Step 3: Write Unit Tests & Verify**
  - Write `src/platform/__tests__/workflows/workflow-dispatcher.test.ts`:
    - Immediate step scheduling.
    - Delayed scheduling with `delaySeconds`.
    - Tenant boundary rejection.
    - Deterministic task key format.
  - Run `pnpm vitest run src/platform/__tests__/workflows/workflow-dispatcher.test.ts`.

---

### Task 4: Workflow Step Execution Runner (Rules 14, 18, 20, 26, 30, 40, 47, 60)
**Files:**
- Create: `src/platform/workflows/execution/workflow-step-runner.ts`
- Test: `src/platform/__tests__/workflows/workflow-step-runner.test.ts`

- [ ] **Step 1: Implement 9-Stage Step Execution Pipeline**
  - Implement `executeWorkflowStep(payload: WorkflowTaskPayload, options?: StepRunnerOptions)`:
    1. **Dead-Man Check:** `checkGovernanceDeadManSwitch()` -> throws `DEAD_MAN_PAUSED` if tripped (Rule 60).
    2. **Lease Acquisition:** `leaseManager.acquireLease(workflowId, stepId, tenant, workerId)` (Rule 9).
    3. **Tenant & Authority Check:** Loads workflow, asserts tenant, evaluates `evaluatePrincipalAuthority` for `workflow.principal` on `step.capabilityId` (Rule 18).
    4. **Capability Discovery & Fingerprint Drift:** Resolves capability via `getCapability()`, checks `verifyCapabilityFingerprint` (Rule 14).
    5. **Input Sanitization & Injection Scanner:** Scans input for prompt injection directives (`scanForPoisoningDirective`, Rule 13 & 30).
    6. **Execution with Cancellation Token:** Invokes capability `execute()` passing `AbortSignal` tied to instance status (Rule 26).
    7. **Post-Condition Assertion:** Verifies step output against capability schema (Rule 47).
    8. **Atomic Checkpoint & Counters:** Updates step to `COMPLETED`, records state transition checkpoint, increments parent `stepCounts.completed`, releases lease (Rule 18 & 40).
    9. **DAG Advancement:** Checks remaining steps in workflow definition. Identifies unblocked steps whose dependencies are now satisfied, transitions them to `QUEUED`, and calls `dispatcher.enqueueWorkflowStep`. If all steps completed, transitions workflow to `COMPLETED`.

- [ ] **Step 2: Implement Exponential Backoff Retry with Randomized Jitter**
  - On capability failure:
    - If `attempt + 1 < step.maxAttempts`:
      - Calculate backoff delay: $T = \min(300, 2^{\text{attempt}} \times 5) \pm \text{jitter}$ seconds.
      - Record step failure attempt and error in `WorkflowStore`.
      - Re-enqueue step with incremented `attempt` and `delaySeconds: T`.
      - Emit `workflow.step_retry_scheduled`.
    - If attempts exhausted:
      - Mark step as `FAILED`.
      - Check if step has `compensatingCapabilityId` (Saga compensation trigger).
      - Mark workflow instance as `FAILED`.

- [ ] **Step 3: Write Unit Tests & Verify**
  - Write `src/platform/__tests__/workflows/workflow-step-runner.test.ts`:
    - Successful step execution and output storage.
    - DAG progression: automatically scheduling dependent step 2 when step 1 completes.
    - Terminal workflow completion when all DAG steps complete.
    - Dead-man pause rejection.
    - Exponential backoff retry scheduling.
    - Attempt exhaustion and failure transition.
  - Run `pnpm vitest run src/platform/__tests__/workflows/workflow-step-runner.test.ts`.

---

### Task 5: Crash Recovery & Zombie Workflow Reaper (Rule 9 & Rule 23)
**Files:**
- Create: `src/platform/workflows/execution/workflow-recovery-service.ts`
- Test: `src/platform/__tests__/workflows/workflow-recovery.test.ts`

- [ ] **Step 1: Implement Zombie Step Detection & Lease Breaking**
  - Implement `WorkflowRecoveryService`:
    - `reapZombieSteps(tenant: TenantBoundary, options?: { maxBatchSize?: number })`:
      - Queries `steps` in `RUNNING` state where `leaseExpiresAt < now`.
      - For each zombie step:
        - Transactionally breaks the expired lease.
        - Records an audit checkpoint: `workflow.recovery.zombie_detected`.
        - If `step.attempt + 1 < step.maxAttempts`: transitions step back to `QUEUED` and re-dispatches to Cloud Tasks.
        - If attempts exhausted: transitions step to `FAILED`.
  - In-memory implementation for testing + production Firestore implementation.

- [ ] **Step 2: Write Unit Tests & Verify**
  - Write `src/platform/__tests__/workflows/workflow-recovery.test.ts`:
    - Clean scan when no leases are expired.
    - Expired lease detection and automatic re-enqueueing for retry.
    - Transition to `FAILED` when attempts are exhausted.
  - Run `pnpm vitest run src/platform/__tests__/workflows/workflow-recovery.test.ts`.

---

### Task 6: Deterministic Checkpoint Replay Engine (Rule 40 & Rule 43)
**Files:**
- Create: `src/platform/workflows/execution/workflow-replay-engine.ts`
- Test: `src/platform/__tests__/workflows/workflow-replay.test.ts`

- [ ] **Step 1: Implement Cryptographic Hash Chain Replay**
  - Implement `WorkflowReplayEngine`:
    - `replayWorkflow(workflowId: string, tenant: TenantBoundary, targetSequence?: number): Promise<ReplayVerificationResult>`:
      - Reads all checkpoints from `WorkflowStore.listCheckpoints(workflowId, tenant)`.
      - Traverses checkpoints in ascending order from `checkpointSequence: 0` to `targetSequence ?? N`.
      - Recomputes canonical sorted SHA-256 hash using `createCheckpointHash`.
      - Verifies `recomputedHash === checkpoint.hash`.
      - Verifies `checkpoint.previousHash === previousCheckpoint.hash` (for sequence > 0).
      - Reconstructs in-memory workflow state at the target sequence.
      - Returns `ReplayVerificationResult` indicating validity or divergence point.

- [ ] **Step 2: Write Unit Tests & Verify**
  - Write `src/platform/__tests__/workflows/workflow-replay.test.ts`:
    - Valid replay of complete multi-step workflow.
    - Point-in-time state reconstruction.
    - Tampering detection: modifying an intermediate checkpoint payload causes hash mismatch.
    - Fork detection: broken `previousHash` link identified immediately.
  - Run `pnpm vitest run src/platform/__tests__/workflows/workflow-replay.test.ts`.

---

### Task 7: Cloud Tasks Webhook Route Handler (Rule 33, 51 & 60)
**Files:**
- Create: `src/app/api/tasks/workflow-step/route.ts`
- Test: `src/platform/__tests__/workflows/workflow-step-route.test.ts`

- [ ] **Step 1: Implement Authenticated Next.js Route Handler**
  - Next.js 15 App Router route: `POST /api/tasks/workflow-step`.
  - Step 1: Validate Cloud Tasks handshake signature `isAuthorizedCloudTaskRequest(request.headers)` (Rule 34).
  - Step 2: Validate Google OIDC token `verifyCloudTasksOidcToken(request.headers)` (Rule 33).
  - Step 3: Parse and validate JSON body with `WorkflowTaskPayloadSchema` (Rule 4).
  - Step 4: Evaluate Dead-Man switch (`checkGovernanceDeadManSwitch`). If tripped, return HTTP 503 so Cloud Tasks automatically retries with backoff (Rule 60).
  - Step 5: Invoke `WorkflowStepRunner.executeWorkflowStep(payload)`.
  - Return HTTP 200 on success. On transient/retryable errors, return HTTP 500/503.

- [ ] **Step 2: Write Route Integration Tests & Verify**
  - Write `src/platform/__tests__/workflows/workflow-step-route.test.ts`:
    - 401 on missing/invalid Cloud Tasks handshake header.
    - 401 on invalid OIDC bearer token.
    - 400 on malformed JSON or invalid schema.
    - 503 on active Dead-Man switch (allowing Cloud Tasks retry).
    - 200 on successful step execution.
  - Run `pnpm vitest run src/platform/__tests__/workflows/workflow-step-route.test.ts`.

---

### Task 8: Public Barrels, Regression Testing & Full Platform Verification
**Files:**
- Modify: `src/platform/workflows/index.ts`
- Test: Full regression suite across `src/platform/__tests__/workflows/` and baseline suites

- [ ] **Step 1: Update Public Barrels**
  - Export all new dispatcher, lease, runner, recovery, and replay types and functions from `src/platform/workflows/index.ts`.

- [ ] **Step 2: Run All Workflow Unit Tests**
  - Run `pnpm vitest run src/platform/__tests__/workflows/`.
  - Verify 100% pass across all test suites.

- [ ] **Step 3: Run Platform Baseline Regression Tests**
  - Run `pnpm vitest run src/platform/__tests__/baseline/`.
  - Verify all 6 suites (43 tests) pass.

- [ ] **Step 4: Full Static Typecheck & Lint**
  - Run `NODE_OPTIONS='--max-old-space-size=8192' pnpm typecheck`.
  - Run `pnpm lint`.
  - Verify 0 errors and zero `any` compliance.

- [ ] **Step 5: Author Completion Report & Senior Review**
  - Document findings in `docs/agents_mcp/phases/agents_mcp_phase_7_milestone_2_completion_report.md` and user artifact.
  - Invoke Senior Principal Systems & AI Agentic Architecture Reviewer.
