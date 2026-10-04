# SmartSapp Agentic & MCP Transformation: Phase 7 Milestone 1 Plan
## Durable Workflow Contracts, 10-State Machine & Firestore Checkpoint Store
### Deeply Integrated with `docs/agents_mcp/`, `docs/CompanyBrain/`, `docs/agentic/`, `theme.md` §8 & The 69 Agentic Development Rules

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish canonical data contracts, Zod v4 schemas, the 10-state finite state machine transition matrix, and persistent multi-tenant Firestore checkpoint storage for durable workflows capable of surviving real-world interruptions and Cloud Run serverless lifecycles.

**Architecture:** A durable, partitioned state architecture where workflow instances, steps, and checkpoints are immutably tied to tenant boundaries (`organizationId`, `workspaceId`) and partitioned into subcollections (`/organizations/{orgId}/workflows/{workflowId}/steps` and `/checkpoints`) to prevent 1MB document bloat. State transitions route through an atomic, deterministic 10-state finite state machine that guarantees terminal state immutability, cooperative cancellation, and blockchain-like checkpoint hashing for audit compliance.

**Tech Stack:** TypeScript (strict mode, zero `any`), Zod v4, Google Cloud Firestore Admin SDK, Node crypto (SHA-256 integrity hashes), UniversalEventBus (`src/platform/events/`).

---

## 1. Executive Summary & Objective

In accordance with [`docs/agents_mcp/agents_mcp_roadmap.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/docs/agents_mcp/agents_mcp_roadmap.md) (§36 Phase 7 & §PHASE 7 lines 1176–1248) and [`docs/agents_mcp/phases/agents_mcp_phase_7_master_plan.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/docs/agents_mcp/phases/agents_mcp_phase_7_master_plan.md):

> **“Agents need to survive real-world interruptions. A five-second demo isn't the target.**  
> **A real agent may need to wait three days, wait for a meeting, wait for approval, wait for external webhook, wait for payment, retry an API, resume after deployment, or continue after Cloud Run termination.”**

The objective of **Milestone 1** is to build the contractual, architectural, and storage bedrock for Phase 7:
1. Canonical TypeScript and Zod v4 schemas defining `WorkflowDefinition`, `WorkflowInstance`, `WorkflowStep`, `WorkflowCheckpoint`, and `WaitCondition`.
2. The complete **10-State Finite State Machine** (`CREATED`, `QUEUED`, `RUNNING`, `WAITING`, `RESUMED`, `VERIFYING`, `COMPLETED`, `FAILED`, `CANCELLED`, `TIMED_OUT`) with deterministic transitions, terminal state guards, and suspension predicates.
3. Multi-tenant Firestore partitioned checkpoint store (`WorkflowStore`) supporting atomic state transitions via `runTransaction`, preventing document size overflow (Rule 9).
4. Hermetic in-memory store adapter (`createMemoryWorkflowStore`) for unit and integration testing.
5. Structured domain event publication (`workflow.created`, `workflow.state_changed`, `workflow.step_completed`, etc.) through `defaultEventBus`.

---

## 2. Failure Modes, Edge Cases & Preemptive Mitigations (Rule 2)

Before writing any implementation code, we analyze failure modes in durable serverless workflow state management and architect explicit mitigations:

1. **State Transition Race Conditions & Concurrency Clashes (Rule 9 & Rule 18):**
   - *Risk:* Concurrent Cloud Tasks delivery, webhook callbacks, or operator actions attempting to transition the same workflow instance simultaneously, producing corrupted state pointers or phantom steps.
   - *Mitigation:* All status mutations and checkpoint commits execute inside atomic Firestore transactions (`runTransaction`). In-memory test store uses mutex/locking semantics to guarantee strict serializability.
2. **Firestore 1MB Document Size Limit Exceeded (Rule 9):**
   - *Risk:* Multi-day workflows with hundreds of steps, large webhook payloads, or accumulated state exceeding Firestore's 1MB single-document ceiling.
   - *Mitigation:* Hierarchical subcollection partitioning: instance root stores summary metadata and active pointers; steps live in subcollection `/steps/{stepId}`; immutable audit snapshots live in `/checkpoints/{checkpointId}`.
3. **Cross-Tenant Workflow Hijacking / IDOR (Rule 8 & Rule 47):**
   - *Risk:* An operator or webhook from Tenant A inspecting, resuming, or cancelling a workflow belonging to Tenant B.
   - *Mitigation:* Immutable tenant lock: all store operations require and cross-validate `organizationId` and `workspaceId` against the caller's authenticated session. Any mismatch throws `TENANT_SCOPE_VIOLATION` (HTTP 403).
4. **Zombie Workflows / Stuck Non-Terminal States (Rule 23 & Rule 26):**
   - *Risk:* A workflow remaining in `RUNNING` or `WAITING` indefinitely after a worker crashes or an external webhook never arrives.
   - *Mitigation:* Global timeout enforcement (`expiresAt` / `maxTotalDurationMs`). Any non-terminal state can transition to `CANCELLED` (cooperative cancellation) or `TIMED_OUT` (lifecycle reaper).
5. **Tampered Resumption Tokens & Replay Attacks (Rule 14 & Rule 22):**
   - *Risk:* An attacker forging webhook resumption payloads or replaying an old resumption signal.
   - *Mitigation:* Cryptographically signed resumption tokens binding `workflowId`, `stepId`, `conditionType`, and a random nonce signed with HMAC-SHA256. Resumption checks assert token validity and consume the token atomically.
6. **Date & Timestamp Serialization Desynchronization (Rule 4):**
   - *Risk:* Inconsistent mixing of Unix numbers, JS Date objects, and Firestore Timestamps causing query failures.
   - *Mitigation:* Strict standard: all timestamps in contracts are ISO 8601 UTC strings (`z.string().datetime()`).

---

## 3. Phase 7 Specific Capabilities Matrix (Rules lines 1915–1927)

Per `docs/agents_mcp/agents_mcp_rules.md` (lines 1915–1927), Phase 7 requires 6 dedicated durable task capabilities:

| Phase 7 Capability | Requirement | Milestone 1 Implementation & Defense |
| :--- | :--- | :--- |
| **`cancel`** | True cooperative cancellation across distributed queues | `isCancellableWorkflowState()` predicate allows transition from any non-terminal state to `CANCELLED`. Step schemas record `cancellationReason` and `abortedAt`. |
| **`retry`** | Exponential backoff and retry policy tracking | `WorkflowStepSchema` records `attempt`, `maxAttempts`, `error`, and supports retrying failed steps by transitioning status back to `QUEUED` or `RUNNING`. |
| **`dead-letter`** | Poison pill quarantine and operator inspection | `WORKFLOW_ERROR_CODES` taxonomy and structured error payloads capture diagnostic context preparing for DLQ routing. |
| **`recovery`** | Crash recovery after Cloud Run container termination | Atomic Firestore checkpoints persist step inputs, outputs, and status. Re-hydration reconstructs exact in-flight state after restart. |
| **`compensation`** | Saga reverse-order compensation modeling | `WorkflowStepSchema` records `isMutating: boolean`, `compensatingCapabilityId?: string`, and `compensationStatus: 'none' \| 'pending' \| 'completed' \| 'failed'`. |
| **`replay`** | Deterministic audit and state machine replay | `WorkflowCheckpointSchema` records chained SHA-256 hashes (`hash`, `previousHash`) ensuring tamper-evident, deterministic event sourcing replay. |

---

## 4. Master 69-Rules Alignment & Enforcement Matrix for Milestone 1

Milestone 1 enforces the governing rules from [`docs/agents_mcp/agents_mcp_rules.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/docs/agents_mcp/agents_mcp_rules.md) across all 5 sections without compromising existing functionality:

### Section A: Core Development & Engineering Principles (Rules 1–10)
| Rule # | Requirement | Milestone 1 Implementation & Architectural Defense |
| :---: | :--- | :--- |
| **Rule 1** | Skill Conformance & Standards | Conforms strictly to `backend-design`, `next-best-practices`, and `vercel-react-best-practices`. Preserves all preexisting platform functionalities across CRM, Portals, and Automations. |
| **Rule 2** | Failure Mode Planning & Cleanliness | Full failure mode analysis (concurrency, 1MB limits, IDOR, zombie states) with explicit mitigations. Clean, modular, refactored code verified with `pnpm typecheck` and `pnpm lint`. |
| **Rule 3** | Backoffice Enhancement & Non-Breaking | Provides the underlying storage and contracts for `/admin/workflows` so operators can inspect, manage, and cancel workflows without code changes. Existing features unaffected. |
| **Rule 4** | Zero `any` / Zero `any[]` Typing Policy | Absolute strict typing. All workflow definitions, instances, steps, checkpoints, and wait conditions defined via Zod v4 schemas (`zod/v4`). Unchecked type assertions are banned. `unknown` allowed only at external boundaries with immediate Zod parsing. |
| **Rule 5** | Staged Deployment & Security Verification | Explicit compound index definitions declared in `firestore.indexes.json` for `/organizations/{orgId}/workflows`. Staging and verification mandated before production deployment. |
| **Rule 6** | Dependencies & Context7 Documentation | Uses current stable versions of Zod v4, Firestore Admin, Node crypto, and Lucide React. Documentation fetched via Context7 MCP. |
| **Rule 7** | Mobile-First & Plain UI English | Naming conventions, error codes, and human-readable titles designed for mobile display, avoiding cryptic jargon or walls of text. |
| **Rule 8** | High Security, Data Protection & Anti-IDOR | All workflow store operations fail closed without valid `organizationId` and `workspaceId`. Queries are strictly partitioned under `/organizations/{orgId}/workflows/`. Cross-tenant access throws `TENANT_SCOPE_VIOLATION`. |
| **Rule 9** | High Load & Resource Exhaustion Defense | Partitioned subcollections prevent 1MB document bloat; pagination (`limit`, `offset`) on workflow listings; transaction gates prevent race conditions. |
| **Rule 10** | Inline Architectural Documentation | Comprehensive `@fileOverview` on every authored file, explaining lifecycle state transitions, concurrency safety, budget enforcement, caution areas, and testability pointers. |

### Section B: MCP & Security Foundations (Rules 11–25)
| Rule # | Requirement | Milestone 1 Implementation & Architectural Defense |
| :---: | :--- | :--- |
| **Rule 11** | MCP Protocol Compliance | Implements data contracts preparing for the official MCP Tasks extension (Spec 2026-07-28), supporting asynchronous execution handles (`task/create`, `task/get`, `task/cancel`). |
| **Rule 12** | No MCP Annotations as Security Controls | Workflow step schema records explicit `riskLevel` (`L0_READ` to `L4_PRIVILEGED_DESTRUCTIVE`) validated server-side independently of client tool annotations. |
| **Rule 13** | Formal Trust Boundary Matrix | External webhook payloads and untrusted step outputs are tagged and containerized in `<untrusted_reference_data id="...">` boundaries before ingestion. |
| **Rule 14** | Tool Poisoning / Rug-Pull Defense | `WorkflowStepSchema` records `capabilityFingerprint` and `fingerprintApproved` to ensure unapproved schema drifts are halted. |
| **Rule 15** | Server Allowlisting & Supply-Chain Security | Workflow step contracts store server target bindings validated against `ServerAllowlistService` approved states. |
| **Rule 16** | Agent Identity as Security Principal | Every `WorkflowInstance` binds `principal` (from Phase 0 stored principal) and `initiator`. Automated workflows never receive wildcard scopes. |
| **Rule 17** | Non-Delegable Actions | `WorkflowStepSchema` includes `isNonDelegable: boolean`; non-delegable capabilities cannot be executed autonomously without human approval (automatically transitions to `WAITING` with `approval`). |
| **Rule 18** | TOCTOU Protection Preparation | State machine and step contracts store delegation and authorization pointers, laying the foundation for live authority re-validation before step dispatch. |
| **Rule 19** | Mandatory Idempotency | Every `WorkflowStep` requires a deterministic `idempotencyKey` derived from workflowId, stepId, attempt, and input payload hash, preventing duplicate execution on retry. |
| **Rule 20** | Replay & Distributed Tracing | Propagates `x-smartsapp-correlation-id` and `mcp-transaction-id` across all workflow instances, steps, checkpoints, and emitted domain events. |
| **Rule 21** | Two-Phase Action Model for High-Risk Work | `WaitConditionSchema` supports `approval` condition with `proposalId` and cryptographic `payloadHash` binding for high-risk actions requiring human sign-off. |
| **Rule 22** | Cryptographic Approval Binding | Approval proposals bind a cryptographic SHA-256 `payloadHash`; any parameter modification invalidates the approval token. |
| **Rule 23** | Budget, Backpressure & Resource Governance | Canonical `WorkflowBudgetsSchema` defines hard multi-dimensional ceilings: `maxTotalDurationMs` (default 7 days), `maxSteps` (default 50), and `maxRetries` (default 5). |
| **Rule 24** | Circuit Breaker Status Integration | Step error taxonomy includes circuit-breaker trip codes (`CIRCUIT_BREAKER_OPEN`), allowing downstream engines to handle service unavailability gracefully. |
| **Rule 25** | Dead-Letter & Recovery Queues | Error codes and step failure metadata format structured diagnostic reports preparing for Milestone 4's `WorkflowDlqService`. |

### Section C: Agent Runtime, Governance & Execution (Rules 26–40)
| Rule # | Requirement | Milestone 1 Implementation & Architectural Defense |
| :---: | :--- | :--- |
| **Rule 26** | True Cooperative Cancellation Semantics | State machine supports immediate transition to `CANCELLED` from any non-terminal state. `isCancellableWorkflowState()` predicate allows cooperative workers to halt processing immediately. |
| **Rule 27** | Formal Saga & Compensation Modeling | `WorkflowStep` contracts define `compensatingCapabilityId` and `compensationStatus`, enabling reverse-order (LIFO) compensation execution on failure. |
| **Rule 28** | Context Budgeting | Step contracts capture token and payload size metrics to ensure accumulated state stays bounded. |
| **Rule 29** | Memory Governance | Workflow outputs are structured to enable synthesis into institutional memory with half-life decay ($t_{1/2}$) and tenant scoping. |
| **Rule 30** | Knowledge Poisoning Defense | External webhook payloads and untrusted inputs are containerized in `<untrusted_reference_data id="...">` before storage or processing. |
| **Rule 31** | Output Validation Between Agent & Tool | `WorkflowStepSchema` records `outputValidated: boolean` and `outputValidationErrors` validating step outputs against capability schemas. |
| **Rule 32** | Cross-Domain Data Exfiltration Detection | Monitors and flags abnormal data transfers across domain boundaries within multi-step workflow graphs. |
| **Rule 33** | Egress Control & Redaction | Outgoing step arguments and webhook calls redact sensitive tokens, credentials, and PII via linear non-backtracking matchers. |
| **Rule 34** | SSRF & Network Boundary Controls | Webhook and external step URLs are validated via `validateSafeEgressUrl`, blocking loopback, GCP metadata, and RFC-1918 subnets. |
| **Rule 35** | MCP Discovery Caching | Reuses Phase 5 discovery caching with SHA-256 ETags and HTTP 304 Not Modified responses for workflow tool resolution. |
| **Rule 36** | Capability Version Compatibility | Workflow step definitions specify SemVer compatible capability versions (`capabilityVersion`). |
| **Rule 37** | MCP Spec Compatibility Testing | Tests data contracts against MCP Tasks specification fixtures. |
| **Rule 38** | No Features on Deprecated MCP Primitives | Stateless execution model; legacy stateful session IDs and deprecated primitives are rejected. |
| **Rule 39** | OpenTelemetry Integration | Distributed trace context fields (`traceId`, `spanId`) integrated into step schemas. |
| **Rule 40** | Audit Log Immutability | Checkpoints compute SHA-256 hashes chained to previous checkpoints (`previousHash`), forming a tamper-evident audit record. Emits domain events (`workflow.*`) through `defaultEventBus`. |

### Section D: Testing, Safety & Failure Modes (Rules 41–55)
| Rule # | Requirement | Milestone 1 Implementation & Architectural Defense |
| :---: | :--- | :--- |
| **Rule 41** | "Why Did You Do This?" View | Step and checkpoint schemas capture WHAT, WHY, WHO, BLAST RADIUS, and EVIDENCE for explainability in the UI. |
| **Rule 42** | Shadow Mode (Dry-Run Simulation) | `WorkflowInstanceSchema` includes `dryRun: boolean`; dry runs simulate state transitions without writing mutating records. |
| **Rule 43** | Replayable Agent Runs | Every step captures full serialized input and output, enabling deterministic replay via checkpoint history. |
| **Rule 44** | Deterministic Simulation Harness | In-memory store provides complete deterministic simulation for hermetic testing without live database dependencies. |
| **Rule 45** | Chaos Testing | Prepares fault injection test vectors for container restarts, timeout kills, and duplicate deliveries. |
| **Rule 46** | Adversarial Workflow Testing | Red-team test suite evaluating forged resumption tokens, replay attacks, cross-tenant resumption token hijacking, and circular state loops. |
| **Rule 47** | Never Trust the Model | All parameters supplied by agents to workflows are strictly validated against Zod schemas. |
| **Rule 48** | Never Trust the Tool/Webhook Either | Sanitizes tool and webhook exceptions into structured `WORKFLOW_ERROR_CODES` without leaking internal stack traces. |
| **Rule 49** | Public Resource Isolation | Workflow admin and storage methods are segregated from public access; Cloud Tasks execution requires authenticated bearer tokens. |
| **Rule 50** | Cache Isolation Rules | All workflow caches keyed by `organizationId`, `workspaceId`, and SHA-256 hashes. |
| **Rule 51** | Server Action / Route Handler Security Gate | Server actions and route handlers validate session authentication via `requireAuth()` and cross-validate tenant boundaries. |
| **Rule 52** | Client/Server Boundary Tests | Verifies that server-only workflow store logic and Firebase Admin SDKs are never bundled into client components. |
| **Rule 53** | Dependency Governance | Zero unvetted dependencies added; all packages locked and security-scanned. |
| **Rule 54** | Performance Budgets | Step dispatch latency $\le 50\text{ms}$; lease acquisition $\le 20\text{ms}$; checkpoint serialization $\le 30\text{ms}$. |
| **Rule 55** | Graph & Canvas Resource Limits | Workflow DAG visualizer schema enforces node limits ($\le 50$ nodes) to prevent DOM exhaustion. |

### Section E: Governance, Operations & The Non-Negotiables (Rules 56–69)
| Rule # | Requirement | Milestone 1 Implementation & Architectural Defense |
| :---: | :--- | :--- |
| **Rule 56** | Agent Context Compression | Compresses workflow step histories into structured summaries when consumed by hybrid agent evaluators. |
| **Rule 57** | Data Retention & TTL | `WorkflowInstanceSchema` records `expiresAt` for automated compliance pruning. |
| **Rule 58** | Model Routing Policy | Low-latency workflow classification routes to Flash; complex exception handling and replanning route to Pro. |
| **Rule 59** | Tool Selection Evaluation | Validates candidate capabilities against workflow definition requirements and agent persona permissions. |
| **Rule 60** | Emergency Dead-Man Controls | Error taxonomy incorporates `WORKFLOW_DEAD_MAN_PAUSED`, ensuring fail-closed behavior when the platform kill switch is engaged. |
| **Rule 61** | Backoffice as Agent Control Plane | Admin workflow control plane (`/admin/workflows`) is restricted strictly to `APP_SURFACE=backoffice`. |
| **Rule 62** | Real-Time UI Reactivity via SSE | Operator console consumes live SSE event stream (`/api/events/stream`) via `useEventStream` for zero-polling real-time updates. |
| **Rule 63** | Agent Incident Management | Operators can pause workflows globally, abort specific instances, retry failed steps, and drain DLQ queues from the UI. |
| **Rule 64** | Feature Flags at Three Levels | Workflow engine features gated at System, Organization, and Workspace levels. |
| **Rule 65** | Canary Releases | Staged rollout support for new workflow definitions and execution worker versions. |
| **Rule 66** | Phased Roadmap Alignment | Fully aligned with Phase 7 roadmap requirements and forward-compatible with Phase 8 (AI UX). |
| **Rule 67** | The "Workflow Implementation Gate" | All Milestone 1 deliverables must satisfy the 12-point pre-flight checklist before completion. |
| **Rule 68** | The Five Non-Negotiable Invariants | 1. Identity is not the user. 2. Never trust the model. 3. Never trust the tool/webhook. 4. High-risk actions require two phases. 5. Everything must be cancellable and budget-bound. |
| **Rule 69** | Strangler Fig Pattern SSOT | Completely wraps and supersedes legacy task runners without breaking preexisting automations or call centre triggers. |

---

## 5. Architectural Specifications & Detailed Design

### 5.1 The 10-State Workflow State Machine (`src/platform/workflows/workflow-state-machine.ts`)

```
                  ┌──────────────┐
                  │   CREATED    │
                  └──────┬───────┘
                         │ enqueue
                         ▼
                  ┌──────────────┐
                  │    QUEUED    │
                  └──────┬───────┘
                         │ lease acquired
                         ▼
                  ┌──────────────┐
       ┌─────────►│   RUNNING    │◄─────────┐
       │          └──────┬───────┘          │
       │                 │ suspend          │
       │                 ▼                  │
       │          ┌──────────────┐          │ resume
       │          │   WAITING    │          │ signal
       │          └──────┬───────┘          │
       │                 │ signal received  │
       │                 ▼                  │
       │          ┌──────────────┐          │
       └──────────┤   RESUMED    ├──────────┘
                  └──────┬───────┘
                         │ verify output
                         ▼
                  ┌──────────────┐
                  │  VERIFYING   │
                  └──────┬───────┘
                         │ post-conditions met
                         ▼
                  ┌──────────────┐
                  │  COMPLETED   │ (Terminal Success)
                  └──────────────┘

TERMINAL FAILURE / EXIT TRANSITIONS (Permitted from any non-terminal state):
  ├── FAILED     (Max retries exhausted, fatal error, Saga compensation executed)
  ├── CANCELLED  (Cooperative cancellation requested, compensating actions applied)
  └── TIMED_OUT  (Total workflow duration ceiling exceeded)
```

#### Transition Matrix Definition:
```typescript
export const VALID_WORKFLOW_TRANSITIONS: Record<WorkflowState, readonly WorkflowState[]> = {
  CREATED: ['QUEUED', 'CANCELLED', 'TIMED_OUT', 'FAILED'],
  QUEUED: ['RUNNING', 'CANCELLED', 'TIMED_OUT', 'FAILED'],
  RUNNING: ['WAITING', 'VERIFYING', 'COMPLETED', 'FAILED', 'CANCELLED', 'TIMED_OUT'],
  WAITING: ['RESUMED', 'CANCELLED', 'TIMED_OUT', 'FAILED'],
  RESUMED: ['RUNNING', 'VERIFYING', 'CANCELLED', 'TIMED_OUT', 'FAILED'],
  VERIFYING: ['RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'TIMED_OUT'],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
  TIMED_OUT: [],
} as const;

export const TERMINAL_WORKFLOW_STATES: readonly WorkflowState[] = [
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'TIMED_OUT',
] as const;
```

### 5.2 Canonical Data Contracts (`src/platform/workflows/workflow-types.ts`)

#### 1. `WaitConditionSchema`:
```typescript
export const WaitConditionTypeSchema = z.enum([
  'approval',
  'webhook',
  'schedule',
  'human_input',
  'external_system',
]);
export type WaitConditionType = z.infer<typeof WaitConditionTypeSchema>;

export const WaitConditionSchema = z.object({
  type: WaitConditionTypeSchema,
  token: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
  details: z.record(z.string(), z.unknown()).default({}),
});
```

#### 2. `WorkflowStepSchema`:
```typescript
export const WorkflowStepStatusSchema = z.enum([
  'PENDING',
  'QUEUED',
  'RUNNING',
  'WAITING',
  'VERIFYING',
  'COMPLETED',
  'FAILED',
  'SKIPPED',
  'COMPENSATED',
]);
export type WorkflowStepStatus = z.infer<typeof WorkflowStepStatusSchema>;

export const WorkflowStepSchema = z.object({
  id: z.string().min(1),
  workflowId: z.string().min(1),
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  stepIndex: z.number().int().nonnegative(),
  capabilityId: z.string().min(1),
  capabilityVersion: z.string().optional(),
  name: z.string().min(1),
  status: WorkflowStepStatusSchema,
  dependsOn: z.array(z.string()).default([]),
  waitCondition: WaitConditionSchema.optional(),
  input: z.record(z.string(), z.unknown()).default({}),
  output: z.record(z.string(), z.unknown()).optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      details: z.unknown().optional(),
    })
    .optional(),
  attempt: z.number().int().nonnegative().default(0),
  maxAttempts: z.number().int().positive().default(3),
  idempotencyKey: z.string().min(1),
  isMutating: z.boolean().default(false),
  compensatingCapabilityId: z.string().optional(),
  compensationStatus: z.enum(['none', 'pending', 'completed', 'failed']).default('none'),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  durationMs: z.number().nonnegative().optional(),
});
```

#### 3. `WorkflowCheckpointSchema`:
```typescript
export const WorkflowCheckpointSchema = z.object({
  id: z.string().min(1),
  workflowId: z.string().min(1),
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  checkpointSequence: z.number().int().nonnegative(),
  fromState: WorkflowStateSchema,
  toState: WorkflowStateSchema,
  stepId: z.string().optional(),
  statePayload: z.record(z.string(), z.unknown()).default({}),
  hash: z.string().length(64), // SHA-256 integrity hash
  previousHash: z.string().length(64).optional(), // Chained hash for tamper-evidence
  timestamp: z.string().datetime(),
});
```

#### 4. `WorkflowInstanceSchema`:
```typescript
export const WorkflowInstanceSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  definitionId: z.string().min(1),
  definitionVersion: z.string().default('1.0.0'),
  title: z.string().min(1),
  status: WorkflowStateSchema,
  currentStepId: z.string().optional(),
  currentWaitCondition: WaitConditionSchema.optional(),
  initiator: z.object({
    actorType: z.enum(['user', 'agent', 'system', 'cron']),
    actorId: z.string().min(1),
  }),
  principal: StoredPrincipalSchema,
  correlationId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  inputs: z.record(z.string(), z.unknown()).default({}),
  outputs: z.record(z.string(), z.unknown()).optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      details: z.unknown().optional(),
    })
    .optional(),
  budgets: WorkflowBudgetsSchema,
  stepCounts: z.object({
    total: z.number().int().nonnegative().default(0),
    completed: z.number().int().nonnegative().default(0),
    failed: z.number().int().nonnegative().default(0),
    skipped: z.number().int().nonnegative().default(0),
  }),
  dryRun: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
});
```

### 5.3 Multi-Tenant Firestore Checkpoint Store (`src/platform/workflows/workflow-store.ts`)

#### Collection Partitioning Hierarchy:
```
/organizations/{orgId}/workflows/{workflowId}                 ──► Instance root metadata & current pointer
/organizations/{orgId}/workflows/{workflowId}/steps/{stepId}  ──► Discrete step records
/organizations/{orgId}/workflows/{workflowId}/checkpoints/{id}──► Immutable state transition audit chain
```

#### Unified Store Interface:
```typescript
export interface WorkflowStore {
  createInstance(input: CreateWorkflowInstanceInput): Promise<WorkflowInstance>;
  getInstance(id: string, tenant: TenantBoundary): Promise<WorkflowInstance | null>;
  updateInstanceStatus(
    id: string,
    targetState: WorkflowState,
    tenant: TenantBoundary,
    options?: {
      currentStepId?: string;
      waitCondition?: WaitCondition;
      error?: WorkflowErrorPayload;
      outputs?: Record<string, unknown>;
    }
  ): Promise<WorkflowInstance>;
  listInstances(options: ListWorkflowInstancesOptions): Promise<{ items: WorkflowInstance[]; total: number }>;
  
  createStep(input: CreateWorkflowStepInput): Promise<WorkflowStep>;
  getStep(workflowId: string, stepId: string, tenant: TenantBoundary): Promise<WorkflowStep | null>;
  updateStep(
    workflowId: string,
    stepId: string,
    update: UpdateWorkflowStepInput,
    tenant: TenantBoundary
  ): Promise<WorkflowStep>;
  listSteps(workflowId: string, tenant: TenantBoundary): Promise<WorkflowStep[]>;

  recordCheckpoint(input: CreateWorkflowCheckpointInput): Promise<WorkflowCheckpoint>;
  listCheckpoints(workflowId: string, tenant: TenantBoundary): Promise<WorkflowCheckpoint[]>;
}
```

---

## 6. Implementation Task Breakdown

### Task 1: Canonical Workflow Contracts, Schemas & Error Taxonomy
**Files:**
- Create: `src/platform/workflows/workflow-types.ts`
- Test: `src/platform/__tests__/workflows/workflow-contracts.test.ts`

- [ ] **Step 1: Write failing test for contracts, schemas, and error taxonomy**
  - Test valid vs invalid `WorkflowInstanceSchema`, `WorkflowStepSchema`, `WorkflowCheckpointSchema`, `WaitConditionSchema`.
  - Test SHA-256 hash formatting on checkpoints.
  - Test strict rejection of missing tenant fields (`organizationId`, `workspaceId`).
  - Test error taxonomy instantiation (`WorkflowError`).
- [ ] **Step 2: Run test to verify it fails**
  - Run: `pnpm vitest run src/platform/__tests__/workflows/workflow-contracts.test.ts`
  - Expected: FAIL with module not found.
- [ ] **Step 3: Implement `src/platform/workflows/workflow-types.ts`**
  - Define all Zod v4 schemas, bifurcated input/output types, error codes, and typed `WorkflowError`.
  - Zero `any` or `any[]` (Rule 4).
- [ ] **Step 4: Run test to verify it passes**
  - Run: `pnpm vitest run src/platform/__tests__/workflows/workflow-contracts.test.ts`
  - Expected: PASS.

---

### Task 2: Deterministic 10-State Machine & State Transition Matrix
**Files:**
- Create: `src/platform/workflows/workflow-state-machine.ts`
- Test: `src/platform/__tests__/workflows/workflow-state-machine.test.ts`

- [ ] **Step 1: Write failing test for state machine transitions**
  - Test valid sequential transitions: `CREATED -> QUEUED -> RUNNING -> WAITING -> RESUMED -> VERIFYING -> COMPLETED`.
  - Test valid exit transitions to terminal states (`FAILED`, `CANCELLED`, `TIMED_OUT`).
  - Test illegal jump rejections: e.g. `COMPLETED -> RUNNING`, `CREATED -> RESUMED`.
  - Test terminal state immutability.
  - Test predicates: `isTerminalWorkflowState`, `isCancellableWorkflowState`, `isWaitingWorkflowState`.
- [ ] **Step 2: Run test to verify it fails**
  - Run: `pnpm vitest run src/platform/__tests__/workflows/workflow-state-machine.test.ts`
  - Expected: FAIL with module not found.
- [ ] **Step 3: Implement `src/platform/workflows/workflow-state-machine.ts`**
  - Implement `VALID_WORKFLOW_TRANSITIONS`, `assertValidWorkflowTransition`, `isTerminalWorkflowState`, `isCancellableWorkflowState`, and `createCheckpointHash`.
- [ ] **Step 4: Run test to verify it passes**
  - Run: `pnpm vitest run src/platform/__tests__/workflows/workflow-state-machine.test.ts`
  - Expected: PASS.

---

### Task 3: Multi-Tenant Firestore Checkpoint Store & In-Memory Test Adapter
**Files:**
- Create: `src/platform/workflows/workflow-store.ts`
- Modify: `firestore.indexes.json`
- Test: `src/platform/__tests__/workflows/workflow-store.test.ts`

- [ ] **Step 1: Write failing test for store persistence and isolation**
  - Test instance creation, step creation, and checkpoint recording.
  - Test atomic state transitions via `updateInstanceStatus`.
  - Test Anti-IDOR enforcement: accessing instance or steps with mismatched tenant throws `TENANT_SCOPE_VIOLATION`.
  - Test listing instances with pagination and status filters.
  - Test checkpoint hash chaining (`previousHash`).
- [ ] **Step 2: Run test to verify it fails**
  - Run: `pnpm vitest run src/platform/__tests__/workflows/workflow-store.test.ts`
  - Expected: FAIL with module not found.
- [ ] **Step 3: Implement `src/platform/workflows/workflow-store.ts`**
  - Implement `WorkflowStore` interface, `createMemoryWorkflowStore()`, and `createFirestoreWorkflowStore()`.
  - Subcollection partitioning: `/steps` and `/checkpoints`.
  - Declare compound index in `firestore.indexes.json`.
- [ ] **Step 4: Run test to verify it passes**
  - Run: `pnpm vitest run src/platform/__tests__/workflows/workflow-store.test.ts`
  - Expected: PASS.

---

### Task 4: Workflow Domain Event Subscribers & Universal EventBus Integration
**Files:**
- Create: `src/platform/workflows/subscribers/workflow-event-subscribers.ts`
- Create: `src/platform/workflows/index.ts`
- Test: `src/platform/__tests__/workflows/workflow-events.test.ts`

- [ ] **Step 1: Write failing test for domain event publishing**
  - Verify that state transitions publish `workflow.state_changed`, `workflow.created`, `workflow.step_completed`, `workflow.completed`, `workflow.failed`.
  - Verify payload completeness: `workflowId`, `organizationId`, `workspaceId`, `status`, `correlationId`.
- [ ] **Step 2: Run test to verify it fails**
  - Run: `pnpm vitest run src/platform/__tests__/workflows/workflow-events.test.ts`
  - Expected: FAIL with module not found.
- [ ] **Step 3: Implement `workflow-event-subscribers.ts` and barrel `index.ts`**
  - Implement `publishWorkflowEvent` helper using `defaultEventBus`.
  - Export public API from `src/platform/workflows/index.ts`.
- [ ] **Step 4: Run test to verify it passes**
  - Run: `pnpm vitest run src/platform/__tests__/workflows/workflow-events.test.ts`
  - Expected: PASS.

---

### Task 5: Platform Regression Sweep, Typecheck & Static Analysis
**Files:**
- Test all platform test suites
- Run TypeScript typecheck
- Run ESLint

- [ ] **Step 1: Run all workflow test suites in Vitest**
  - Run: `pnpm vitest run src/platform/__tests__/workflows/`
  - Expected: 100% pass across all authored test files.
- [ ] **Step 2: Run project-wide TypeScript typecheck**
  - Run: `NODE_OPTIONS='--max-old-space-size=8192' pnpm typecheck`
  - Expected: Clean exit 0, 0 errors.
- [ ] **Step 3: Run project-wide ESLint**
  - Run: `pnpm lint`
  - Expected: Clean exit 0, 0 errors.

---

## 7. The 12-Point Workflow Implementation Gate (Rule 67) & Non-Negotiables (Rule 68)

### 7.1 The 12-Point Workflow Implementation Gate (Rule 67)
Before Milestone 1 is declared complete, it must verify all 12 items:
```
[ ] 1. Protocol & Version Compliance: Targets MCP Tasks extension spec 2026-07-28 & Cloud Tasks SDK (Rule 11 & 38).
[ ] 2. Identity & Tenant Isolation: Executes under AgentPrincipal; Anti-IDOR validated on all checkpoints (Rule 8, 16 & 47).
[ ] 3. Scope & Delegation Check: Attenuated scopes verified; non-delegables stripped into WAITING state (Rule 16 & 17).
[ ] 4. TOCTOU Authority Verification: Live check in Firestore prior to resumed step execution (Rule 18).
[ ] 5. Idempotency & Distributed Tracing: Deterministic idempotencyKey and correlation IDs across all steps (Rule 19 & 20).
[ ] 6. Two-Phase Action Model: High-risk steps suspend to WAITING (approval) and bind SHA-256 payloadHash (Rule 21 & 22).
[ ] 7. Resource Ceilings & Budgets: Hard limits on step counts, retry attempts, and total workflow duration (Rule 23 & 54).
[ ] 8. True Cancellation & Sagas: Cooperative abort revokes Cloud Tasks; compensating Sagas execute in LIFO order (Rule 26 & 27).
[ ] 9. Context Budgeting & Injection Isolation: Webhook payloads containerized in <untrusted_reference_data> (Rule 28 & 30).
[ ] 10. Output Validation & Error Sanitization: Step outputs validated; internal errors sanitized before DLQ (Rule 31 & 48).
[ ] 11. Immutability & Audit Trail: Immutable domain events emitted to UniversalEventBus on all state changes (Rule 40).
[ ] 12. Dead-Man Switch Gate: checkGovernanceDeadManSwitch evaluated at Step 1 of all workers and routes (Rule 60).
```

### 7.2 The Five Non-Negotiable Invariants (Rule 68)
1. **Identity is not the user (Rule 16):** Workflows execute under authenticated `AgentPrincipal` with attenuated scopes. Never execute background workflows with unchecked ambient permissions.
2. **Never trust the model (Rule 47):** When agents select or parameterize deterministic workflows, all inputs are strictly validated against the workflow's Zod schema.
3. **Never trust the tool or external webhook (Rule 48):** External callbacks can deliver poisoned payloads or fail unexpectedly. Always validate signatures, containerize inputs, and handle timeouts.
4. **High-risk actions require two phases (Rules 21 & 22):** Any step mutating external customer records or incurring cost must suspend into `WAITING` (`approval`) for human sign-off.
5. **Everything must be cancellable and budget-bound (Rules 23 & 26):** Every workflow instance must enforce global timeout bounds and support clean cooperative cancellation with compensation.

---

## 8. Exit Criteria & Definition of Done

Milestone 1 is complete when:
- `workflow-types.ts`, `workflow-state-machine.ts`, `workflow-store.ts`, `workflow-event-subscribers.ts`, and `index.ts` are fully authored and tested.
- 100% of tests pass across `src/platform/__tests__/workflows/`.
- `pnpm typecheck` and `pnpm lint` exit with 0 errors.
- Completion report authored and submitted for Senior Principal Systems & AI Agentic Architecture Review.
