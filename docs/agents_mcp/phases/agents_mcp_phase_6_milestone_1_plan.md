# SmartSapp Agentic & MCP Transformation: Phase 6 Milestone 1 Plan
## Core Agent Runtime Contracts, Finite State Machine & Firestore Run Store
### Deeply Integrated with `docs/agents_mcp/`, `docs/CompanyBrain/`, `docs/agentic/`, `theme.md` §8 & The 69 Agentic Development Rules

**Version:** 1.1.0 (Comprehensive Source-Document & 69-Rules Synthesis)  
**Status:** PROPOSED FOR IMPLEMENTATION  
**Authors:** Senior Principal Systems & AI Agentic Architecture Engineer  
**Milestone Focus:** Phase 6 — Milestone 1: Core Agent Runtime Contracts, Finite State Machine & Firestore Run Store  

---

## 1. Executive Summary & Objective

In accordance with [`docs/agents_mcp/agents_mcp_roadmap.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/docs/agents_mcp/agents_mcp_roadmap.md) (§36 Phase 6 & §32 Lifecycle) and [`docs/agents_mcp/phases/agents_mcp_phase_6_master_plan.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/docs/agents_mcp/phases/agents_mcp_phase_6_master_plan.md):

> **“Do not build ‘one SmartSapp Agent.’ Build an agent runtime capable of running many specialized agents from one execution model.”**

The objective of **Milestone 1** is to construct the foundational data contracts, deterministic state machine, and persistent multi-tenant storage for the SmartSapp Autonomous Agent Runtime. Every agent execution in SmartSapp—whether an autonomous background research task, a lead scoring pipeline, a deal coaching analysis, or an interactive portal guide—must execute as an auditable, budget-governed, cancellable **Agent Run** transitioning through strict lifecycle states.

---

## 2. Failure Modes, Edge Cases & Preemptive Mitigations (Rule 2)

Before writing any code, we identify what could go wrong in this runtime layer and architect explicit defenses:

1. **State Transition Race Conditions & Concurrency Conflicts (Rule 9 & Rule 18):**
   - *Risk:* Multiple async workers or webhook callbacks attempting to transition an agent run or record step outputs simultaneously, resulting in missed state updates or corrupt budget accumulators.
   - *Mitigation:* Firestore atomic transactions (`runTransaction`) are used for all status transitions and budget increments. In-memory test store uses a thread-safe mutex/locking mechanism to guarantee strict serializability.
2. **Firestore 1MB Document Size Limit Exceeded (Rule 9):**
   - *Risk:* Multi-step runs with extensive tool inputs, evidence packs, or model reflections exceeding Firestore's 1MB per-document limit.
   - *Mitigation:* Bounded architecture: `agent_runs` collection stores run-level metadata, summary counts, and the current active step pointer. All discrete step execution records are partitioned into a dedicated subcollection `/organizations/{orgId}/agent_runs/{runId}/steps/{stepId}`.
3. **Runaway Resource Consumption (Rule 23):**
   - *Risk:* Infinite loops, token blowout, or unbounded execution duration.
   - *Mitigation:* Hard multi-dimensional ceilings enforced at contract validation time: `maxTokens` (default 50k, max 200k), `maxToolCalls` (default 15, max 50), `maxDurationMs` (default 120s, max 300s), `maxRecordsMutated` (default 25, max 100), `maxDelegationDepth` ($\le 3$).
4. **Cross-Tenant Run Hopping / IDOR (Rule 8 & Rule 47):**
   - *Risk:* A malicious or compromised caller accessing or cancelling an agent run in another workspace/organization.
   - *Mitigation:* Immutable tenant lock: all store operations require and strictly cross-validate `organizationId` and `workspaceId` against the authenticated caller. Any mismatch throws `TENANT_SCOPE_VIOLATION` (HTTP 403).
5. **Zombie Runs / Uncancellable Steps (Rule 26):**
   - *Risk:* Runs stuck in `executing` or `planning` indefinitely when cancelled.
   - *Mitigation:* State machine allows transitioning to `cancelled` from any non-terminal state. Step records store an `abortSignal` token and `cancellationReason`.
6. **Date & Timestamp Serialization Inconsistency (Rule 4):**
   - *Risk:* Mixing JavaScript `Date` objects, Firestore `Timestamp` objects, and Unix numbers.
   - *Mitigation:* Strict standard: all timestamps in contracts are ISO 8601 UTC strings (`z.string().datetime()`).

---

## 3. Master 69-Rules Alignment & Enforcement for Milestone 1

Milestone 1 strictly adheres to the governing rules from [`docs/agents_mcp/agents_mcp_rules.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/docs/agents_mcp/agents_mcp_rules.md):

| Rule # | Requirement | Milestone 1 Implementation & Architectural Defense |
| :---: | :--- | :--- |
| **Rule 1** | Skill Conformance & Standards | Conforms strictly to `backend-design` and `next-best-practices`. Preserves all preexisting app functionalities and establishes the foundation for agent run execution. |
| **Rule 2** | Failure Mode Planning & Cleanliness | Full failure mode analysis (concurrency, 1MB limits, IDOR, zombie runs) with explicit mitigations. Clean, modular, and refactored code verified with `pnpm typecheck` and `pnpm lint`. |
| **Rule 3** | Backoffice Enhancement & Non-Breaking | Provides the underlying storage and contracts for `/admin/runs` and `/admin/agents` so operators can inspect, manage, and cancel runs without code changes. Existing CRM and Portals unaffected. |
| **Rule 4** | Zero `any` / Zero `any[]` Typing Policy | Absolute strict typing. All runs, steps, goals, budgets, and outcomes defined via Zod v4 schemas (`zod/v4`). Unchecked type assertions are strictly prohibited. `unknown` allowed only at external boundaries with immediate Zod parsing. |
| **Rule 5** | Staged Deployment & Security Verification | Explicit compound index definitions declared for Firestore collections. Staging and verification mandated before production deployment. |
| **Rule 6** | Dependencies & Context7 Documentation | Uses current stable versions of Zod v4, Firestore Admin, and Lucide React. Documentation fetched via Context7 MCP. |
| **Rule 7** | Mobile-First & Plain UI English | Naming conventions, error codes, and human-readable titles designed for mobile display (`RunDetailDrawer`), avoiding cryptic jargon or walls of text. |
| **Rule 8 & 47** | Multi-Tenancy & Anti-IDOR | All run store operations fail closed without valid `organizationId` and `workspaceId`. Queries are strictly partitioned under `/organizations/{orgId}/agent_runs/`. Cross-tenant access throws `TENANT_SCOPE_VIOLATION`. |
| **Rule 9** | High Load & Resource Exhaustion Defense | Partitioned subcollections prevent 1MB document bloat; pagination (`limit`, `offset`) on run listings; transaction gates prevent race conditions. |
| **Rule 10** | Inline Architectural Documentation | Comprehensive `@fileOverview` on every authored file, explaining lifecycle state transitions, concurrency safety, budget enforcement, caution areas, and testability pointers. |
| **Rule 11 & 38** | MCP Protocol & Statelessness | Stateless execution model; contracts support header-based routing (`mcp-transaction-id`, `x-smartsapp-correlation-id`) without legacy session dependencies. |
| **Rule 12** | No MCP Annotations as Security Controls | Step schema records explicit `riskLevel` (`L0_READ` to `L4_PRIVILEGED_DESTRUCTIVE`) validated server-side. |
| **Rule 13 & 30** | Trust Boundaries & Poisoning Defense | Untrusted user prompts and tool outputs are tagged and containerized in `<untrusted_reference_data id="...">` boundaries before LLM ingestion. |
| **Rule 14** | Tool Poisoning / Rug-Pull Defense | `PlanStepSchema` records `capabilityFingerprint` and `fingerprintApproved` to ensure unapproved schema drifts are halted. |
| **Rule 16** | Agent Identity as Security Principal | Every `AgentRun` binds an `agentPersonaId` (from Phase 3 canonical personas: `crm_researcher`, `lead_sdr`, `deal_coach`, etc.) and `principalId`. Automated agents never receive wildcard scopes. |
| **Rule 17** | Non-Delegable Actions | `PlanStepSchema` includes `isNonDelegable: boolean`; non-delegable capabilities cannot be executed autonomously without human approval. |
| **Rule 18** | TOCTOU Protection Preparation | State machine and step contracts store delegation and authorization pointers, laying the foundation for live authority re-validation before step dispatch. |
| **Rule 19** | Mandatory Idempotency | Every `AgentStep` requires a deterministic `idempotencyKey` derived from runId, stepIndex, and input payload hash, preventing duplicate execution. |
| **Rule 20** | Replay & Distributed Tracing | Propagates `x-smartsapp-correlation-id` and `mcp-transaction-id` across all run steps and emitted domain events. |
| **Rule 21 & 22** | Two-Phase Action Model & Approval Binding | `PlanStepSchema` and `AgentStepSchema` support `actionProposalId` and `payloadHash` binding for high-risk actions requiring human sign-off. |
| **Rule 23 & 54** | Budget, Backpressure & Resource Governance | Canonical `AgentRunBudgetsSchema` defines hard multi-dimensional ceilings: `maxTokens`, `maxToolCalls`, `maxDurationMs`, `maxRecordsMutated`, `maxFinancialAmount`, and `maxDelegationDepth`. Real-time usage is tracked in `AgentRunBudgetUsageSchema`. |
| **Rule 24** | Circuit Breaker Status Integration | Step error taxonomy includes circuit-breaker trip codes (`CIRCUIT_BREAKER_OPEN`), allowing downstream planning engines to handle service unavailability gracefully. |
| **Rule 26** | True Cancellation Semantics | State machine supports immediate transition to `cancelled` from any non-terminal state. `isCancellableState()` predicate allows cooperative workers to halt processing immediately. |
| **Rule 27** | Formal Saga & Compensation Modeling | `AgentStep` contracts define `compensatingCapabilityId` and `compensationStepId`, enabling Milestone 3's reverse-order compensation engine. |
| **Rule 28 & 56** | Context Budgeting & Compression | Step contracts capture `tokensUsed` and `contextTokenUsage` to feed the knapsack context compressor. |
| **Rule 31** | Inter-Step Output Validation | `AgentStepSchema` records `outputValidated: boolean` and `outputValidationErrors` validating tool outputs against schemas. |
| **Rule 36** | Capability Version Compatibility | Plan steps specify SemVer compatible capability versions (`capabilityVersion`). |
| **Rule 39** | OpenTelemetry Integration | Distributed trace context fields (`traceId`, `spanId`) integrated into step schemas. |
| **Rule 40** | Audit Log Immutability | All state machine transitions and step completions emit structured domain events (`agent.run.*`) through `defaultEventBus` to the tamper-evident audit store. |
| **Rule 41** | "Why Did You Do This?" View | Step and outcome schemas capture WHAT, WHY, WHO, BLAST RADIUS, and EVIDENCE for explainability in the UI. |
| **Rule 42** | Shadow Mode (Dry-Run) | `AgentRunSchema` includes `dryRun: boolean`; dry runs simulate plan generation and execution without writing mutating records. |
| **Rule 43** | Replayable Agent Runs | Every step captures full serialized input and output, enabling deterministic replay via `originalRunId`. |
| **Rule 44** | Deterministic Simulation Harness | In-memory store provides complete deterministic simulation for hermetic testing without live database dependencies. |
| **Rule 47** | Never Trust the Model | All model-generated goals, plans, and arguments are strictly validated against Zod schemas. |
| **Rule 48** | Never Trust the Tool Either | Sanitizes tool exceptions into structured `AGENT_RUNTIME_ERROR_CODES` without leaking internal stack traces. |
| **Rule 50** | Cache Isolation Rules | All caches keyed by `organizationId`, `workspaceId`, and SHA-256 hashes. |
| **Rule 57** | Data Retention & TTL | `AgentRunSchema` records `retentionExpiresAt` for automated compliance pruning. |
| **Rule 58** | Model Routing Policy | `AgentRunSchema` records `modelTier: "flash" | "pro"` indicating the assigned reasoning tier. |
| **Rule 60** | Emergency Dead-Man Integration | Error taxonomy incorporates `EMERGENCY_DEAD_MAN_PAUSED`, ensuring fail-closed behavior when the platform kill switch is engaged. |
| **Rule 67** | The "Agent Implementation Gate" | All Milestone 1 deliverables must satisfy the 12-point pre-flight checklist before completion. |
| **Rule 68** | The Five Non-Negotiable Invariants | 1. Identity is not the user (Rule 16). 2. Never trust the model (Rule 47). 3. Never trust the tool (Rule 48). 4. High-risk actions require two phases (Rule 21 & 22). 5. Everything must be cancellable and budget-bound (Rule 23 & 26). |
| **Rule 69** | Strangler Fig Pattern SSOT | Completely wraps and supersedes legacy task runners without breaking preexisting Genkit flows or CompanyBrain 2.0 services. |

---

## 4. Architectural Specifications & Detailed Design

### 4.1 Finite State Machine Architecture (`src/platform/runtime/agent-state-machine.ts`)

Every agent run transitions through an explicit, deterministic 11-state finite state machine conforming to PRD §89 and Document 07:

```
                                  ┌─────────────┐
                                  │   CREATED   │
                                  └──────┬──────┘
                                         │
                                         ▼
                                  ┌─────────────┐
                                  │   QUEUED    │
                                  └──────┬──────┘
                                         │
                                         ▼
                                  ┌─────────────┐
                    ┌────────────►│  PLANNING   │◄────────────┐
                    │             └──────┬──────┘             │
                    │                    │                    │
                    │                    ▼                    │
                    │             ┌─────────────┐             │
                    │             │   CONTEXT   │             │
                    │             │  BUILDING   │             │
                    │             └──────┬──────┘             │
                    │                    │                    │
                    │                    ▼                    │
                    │             ┌─────────────┐             │
                    │             │  EXECUTING  │             │
                    │             └──────┬──────┘             │
                    │                    │                    │
                    │          ┌─────────┼─────────┐          │
                    │          ▼         │         ▼          │
                    │    ┌───────────┐   │   ┌───────────┐    │
                    │    │  WAITING  │   │   │ VERIFYING │    │
                    │    │    FOR    │   │   └─────┬─────┘    │
                    │    │ APPROVAL  │   │         │          │
                    │    └─────┬─────┘   │         │          │
                    │          │         ▼         │          │
                    │          │    ┌─────────┐    │          │
                    │          │    │RETRYING │────┘          │
                    │          │    └────┬────┘               │
                    │          ▼         ▼                    │
                    │    ┌───────────────────┐                │
                    └────│      REPLAN       │────────────────┘
                         └───────────────────┘
                                   │
               ┌───────────────────┼───────────────────┐
               ▼                   ▼                   ▼
        ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
        │  COMPLETED  │     │   FAILED    │     │  CANCELLED  │
        │ (Terminal)  │     │ (Terminal)  │     │ (Terminal)  │
        └─────────────┘     └─────────────┘     └─────────────┘
```

#### State Transition Rules:
1. **Initial State:** Runs are created in `created` or `queued`.
2. **Autonomous Progression:** `queued` ➔ `planning` ➔ `context_building` ➔ `executing` ➔ `verifying` ➔ `completed`.
3. **Human-in-the-Loop Interception (Rule 21):** `executing` ➔ `waiting_for_approval` (when encountering L3/L4 capability actions). Once approved, resumes to `executing`.
4. **Failure & Recovery:** `executing` or `verifying` ➔ `retrying` ➔ `planning` (replan) or `executing`.
5. **Terminal Invariance:** `completed`, `failed`, and `cancelled` are terminal states. No transition out of a terminal state is permitted under any circumstances (`TERMINAL_STATE_IMMUTABLE`).
6. **Cancellation Semantics (Rule 26):** Any active, non-terminal state may transition directly to `cancelled`.

---

### 4.2 Canonical Data Contracts (`src/platform/runtime/agent-run-types.ts`)

#### 1. Enums & Identifiers:
- `AGENT_RUN_STATUSES`: `created`, `queued`, `planning`, `context_building`, `executing`, `waiting_for_approval`, `verifying`, `retrying`, `completed`, `failed`, `cancelled`
- `AGENT_STEP_STATUSES`: `pending`, `running`, `completed`, `failed`, `skipped`, `compensated`
- `AGENT_STEP_TYPES`: `planning`, `context_retrieval`, `tool_call`, `verification`, `replanning`, `approval_wait`, `compensation`, `reflection`
- `AGENT_INTENTS`: `research`, `pipeline_audit`, `deal_coaching`, `portal_guidance`, `meeting_preparation`, `task_execution`, `custom_goal`
- `AGENT_TRIGGER_TYPES`: `manual`, `scheduled`, `reactive_event`, `delegation`
- `AGENT_MODEL_TIERS`: `flash` (Gemini 2.5 Flash), `pro` (Gemini 2.5 Pro)

#### 2. Schemas & Models:
- **`AgentGoalSchema`:** `prompt`, `intent`, `subject` (`type`, `id`), `constraints`, `metadata`.
- **`PlanStepSchema`:** `stepId`, `stepIndex`, `title`, `type`, `capabilityId`, `capabilityVersion`, `riskLevel`, `arguments`, `dependsOnStepIds`, `expectedStateChange`, `isNonDelegable`, `capabilityFingerprint`, `compensatingCapabilityId`, `timeoutMs`.
- **`ExecutionPlanSchema`:** `planId`, `version`, `steps`, `estimatedTokens`, `rationale`, `createdAt`.
- **`AgentStepSchema`:** `stepId`, `runId`, `stepIndex`, `type`, `title`, `capabilityId`, `capabilityVersion`, `status`, `idempotencyKey`, `correlationId`, `traceId`, `spanId`, `actionProposalId`, `payloadHash`, `startedAt`, `completedAt`, `durationMs`, `input`, `output`, `outputValidated`, `sanitizedError`, `tokensUsed`, `compensationStepId`, `compensationStatus`.
- **`AgentRunBudgetsSchema`:** `maxDurationMs`, `maxTokens`, `maxToolCalls`, `maxRecordsMutated`, `maxFinancialAmount`, `maxDelegationDepth`.
- **`AgentRunBudgetUsageSchema`:** `tokensUsed`, `toolCallsExecuted`, `durationMs`, `recordsMutated`, `financialAmount`, `currentDelegationDepth`.
- **`AgentOutcomeSchema`:** `answer`, `summary`, `findings`, `actionsTaken`, `actionProposalsCreated`, `memoriesCreated`, `sourceCitations`, `completedAt`.
- **`AgentRunSchema`:** `runId`, `organizationId`, `workspaceId`, `agentPersonaId`, `principalId`, `authorizingUserId`, `triggerType`, `modelTier`, `dryRun`, `goal`, `status`, `stateHistory`, `currentPlan`, `currentStepIndex`, `budgets`, `budgetUsage`, `outcome`, `error`, `retentionExpiresAt`, `metadata`, `createdAt`, `updatedAt`, `startedAt`, `completedAt`.

#### 3. Structured Error Taxonomy (`AGENT_RUNTIME_ERROR_CODES`):
- `RUN_NOT_FOUND` (404)
- `STEP_NOT_FOUND` (404)
- `INVALID_STATE_TRANSITION` (400)
- `TERMINAL_STATE_IMMUTABLE` (409)
- `BUDGET_EXCEEDED` (429)
- `RUN_CANCELLED` (410)
- `TENANT_SCOPE_VIOLATION` (403)
- `CONCURRENCY_CONFLICT` (409)
- `IDEMPOTENCY_COLLISION` (409)
- `INVALID_RUN_INPUT` (400)
- `CIRCUIT_BREAKER_OPEN` (503)
- `EMERGENCY_DEAD_MAN_PAUSED` (503)

---

### 4.3 Firestore Run Store Architecture (`src/platform/runtime/agent-run-store.ts`)

#### Firestore Collection Hierarchy:
```
/organizations/{organizationId}/agent_runs/{runId}
  ├── fields: (runId, workspaceId, agentPersonaId, status, modelTier, dryRun, goal, budgets, budgetUsage, createdAt, updatedAt...)
  └── subcollection: steps/{stepId}
        ├── fields: (stepId, runId, stepIndex, type, title, status, idempotencyKey, correlationId, input, output...)
```

#### Firestore Compound Indexes (`firestore.indexes.json`):
```json
{
  "collectionGroup": "agent_runs",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "organizationId", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "agent_runs",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "organizationId", "order": "ASCENDING" },
    { "fieldPath": "agentPersonaId", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

#### Store Contract (`AgentRunStore`):
```typescript
export interface AgentRunStore {
  createRun(input: CreateAgentRunInput): Promise<AgentRun>;
  getRun(organizationId: string, runId: string): Promise<AgentRun | null>;
  listRuns(organizationId: string, options?: ListAgentRunsOptions): Promise<{ runs: AgentRun[]; total: number }>;
  updateRunStatus(input: UpdateAgentRunStatusInput): Promise<AgentRun>;
  saveExecutionPlan(organizationId: string, runId: string, plan: ExecutionPlan): Promise<AgentRun>;
  createStep(organizationId: string, runId: string, step: CreateStepInput): Promise<AgentStep>;
  getStep(organizationId: string, runId: string, stepId: string): Promise<AgentStep | null>;
  listSteps(organizationId: string, runId: string): Promise<AgentStep[]>;
  updateStep(input: UpdateStepInput): Promise<AgentStep>;
  updateBudgetUsage(organizationId: string, runId: string, delta: Partial<AgentRunBudgetUsage>): Promise<AgentRun>;
  setOutcome(organizationId: string, runId: string, outcome: AgentOutcome): Promise<AgentRun>;
}
```

---

### 4.4 Structured Domain Event Publication (`src/platform/runtime/subscribers/agent-event-subscribers.ts`)

All lifecycle transitions publish strongly typed events to `UniversalEventBus` (Rule 40):
1. `agent.run.created`: emitted on run initialization.
2. `agent.run.state_changed`: emitted on any state machine progression with previous and new status.
3. `agent.run.step_started`: emitted when a step begins execution.
4. `agent.run.step_completed`: emitted with duration and token usage.
5. `agent.run.completed`: emitted with final outcome and total budget consumption.
6. `agent.run.failed`: emitted with sanitized error details.
7. `agent.run.cancelled`: emitted with cancellation rationale.

---

## 5. Implementation Steps & File Structure

```
src/platform/runtime/
├── agent-run-types.ts                   # Core contracts, Zod v4 schemas, error taxonomy
├── agent-state-machine.ts               # Transition validator, terminal state guards, lifecycle graph
├── agent-run-store.ts                   # Firestore & in-memory run store adapters, transaction gates
├── subscribers/
│   └── agent-event-subscribers.ts       # Structured domain event publisher for runtime lifecycle
└── index.ts                             # Public barrel exporting all runtime contracts and stores

src/platform/__tests__/runtime/
├── agent-contracts.test.ts              # Zod validation, budget bounds, error code checks
├── agent-state-machine.test.ts          # State transitions, illegal jump rejections, terminal guards
└── agent-run-store.test.ts              # CRUD, step subcollections, budget accumulation, tenant isolation
```

---

## 6. Verification & Testing Gates

### 6.1 Test Suite Breakdown:
1. **Contracts & Schemas (`agent-contracts.test.ts`):**
   - Validates valid `AgentRun` and `AgentStep` against schemas.
   - Asserts failure on invalid persona IDs, negative budgets, or missing tenant IDs.
   - Validates error taxonomy codes and `AgentRuntimeError` construction.
2. **State Machine Transitions (`agent-state-machine.test.ts`):**
   - Verifies all legal forward transitions across the 11 states.
   - Verifies rejection of illegal jumps (e.g. `completed` ➔ `executing`, `failed` ➔ `planning`).
   - Asserts terminal state immutability.
   - Verifies cancellation from any non-terminal state.
   - Verifies state history progression recording.
3. **Run Store Persistence & Multi-Tenancy (`agent-run-store.test.ts`):**
   - Verifies run creation, retrieval, and listing with pagination and status filters.
   - Verifies atomic status transitions and budget increments via transactions.
   - Verifies step creation, updates, and chronological ordering in subcollections.
   - Verifies Anti-IDOR enforcement: accessing a run with mismatched `organizationId` throws `TENANT_SCOPE_VIOLATION`.

### 6.2 Verification Commands:
- `NODE_OPTIONS='--max-old-space-size=8192' pnpm typecheck` (0 errors)
- `pnpm lint` (0 errors)
- `pnpm vitest run src/platform/__tests__/runtime/` (100% pass)
- Platform baseline regression suite: all preexisting tests passing (Rule 69).

---

## 7. Definition of Done for Milestone 1

Milestone 1 is complete when:
1. All authored files exist with full production implementation and zero `any`/`any[]` (Rule 4).
2. The 11-state finite state machine enforces deterministic transitions and terminal immutability.
3. The `AgentRunStore` provides full persistence across runs and steps with strict tenant isolation.
4. All 3 test suites pass 100% in Vitest.
5. All 12 criteria of the **Agent Implementation Gate (Rule 67)** are verified.
6. The codebase is prepared for Milestone 2: Autonomous Planning Engine, Dynamic Replanning & Multi-Model Router.
