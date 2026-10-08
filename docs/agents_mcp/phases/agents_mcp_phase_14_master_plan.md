# SmartSapp Agentic & MCP Transformation: Phase 14 Master Implementation Plan
## Agentic Self-Management, Postcondition Verification, Saga Compensation & Health Monitoring
### Fully Conforming to `docs/agents_mcp/agents_mcp_rules.md` (Rules 1–69, Rules 1940–1964, Rules 67–69), `theme.md` §8, and `.agents/AGENTS.md`

**Version:** 2.0.0  
**Status:** DRAFT / PENDING USER APPROVAL (Do not start execution until plan is approved)  
**Date:** 2026-10-08  
**Author:** AI Agentic Architecture Team & Principal Systems Architect  

---

## 1. Executive Summary & Transformation Destination

Across Phases 8 through 13, SmartSapp established specialized, domain-specific autonomous agent workforces across CRM, Sales, Meetings, Knowledge, Finance, School Operations, and Multi-Agent Supervisor Orchestration.

**Phase 14 represents the foundational transformation from "Agent Can Execute" to "Agent Can Execute Responsibly."**

In unverified AI architectures, autonomous agents operate on naive optimism:
```text
PLAN
 ↓
EXECUTE
 ↓
hope
```

Phase 14 replaces this fragile paradigm with the **Formal 6-Step Responsible Execution Loop**:
```text
PLAN
 ↓
PREDICT (state change, invariants, blast radius - Rule 41)
 ↓
EXECUTE (canonical capabilities, idempotency, two-phase approval - Rules 19, 21, 22)
 ↓
VERIFY (postconditions, state-version, side-effects, evidence - Rules 18, 47, 1959-1962)
 ↓
COMMIT (persist outcome, emit events, audit log - Rule 40)
 ↓
LEARN / HEAL (record telemetry, self-repair or compensate upon failure - Rules 24, 27, 48)
```

Every meaningful action executed by an agent in SmartSapp will verify its real-world postconditions, assert state versions, detect side-effect discrepancies, and autonomously compensate or self-heal when invariants are violated.

---

## 2. Core Architectural Pillars of Phase 14

### 2.1 Postcondition Assertion Framework (Rule 21 & 1959)
An agent never assumes success from an HTTP 200 or database write acknowledgment. A dedicated postcondition engine executes domain-specific assertions after every state mutation:
- **CRM Domain (`deal.advance_stage`, `entity.update`, `note.create`, `task.create`):**
  - Asserts deal state advanced, stage history recorded, activity log entry created, domain event emitted, and related tasks updated.
- **Sales & Outreach (`sdr.dispatch_email`, `sdr.dispatch_whatsapp`, `campaign.launch`):**
  - Asserts provider acceptance ID returned, recipient normalized to E.164, suppression rules respected, template variables cleanly resolved via `FieldsVariablesService`, and timeline logged.
- **Finance & Operations (`reconciliation.resolve_exception`, `collections.execute_proposal`, `invoice.create`):**
  - Asserts double-entry remainder invariant held down to the cent (`roundCurrency`, Rule 11), ledger transaction posted, invoice balance adjusted.
- **Knowledge & Memory (`knowledge.candidate.decide`, `knowledge.conflict.resolve`):**
  - Asserts temporal validity window set (`validFrom`, `validUntil`), superseded fact linked, and audit lineage recorded (Rule 29).
- **Supervisor & Swarm (`supervisor.mesh.route_handoff`, `supervisor.delegation.issue_token`):**
  - Asserts delegation depth bound ($\le 3$), token budget reserved, and step correlation preserved (Rules 9 & 23).

### 2.2 State-Version Validation & TOCTOU Defense (Rules 18 & 1960)
- Captures pre-mutation snapshots (`expectedVersion`, `stateHash`, `updatedAt`).
- Re-verifies state version post-mutation to detect race conditions, concurrent edits, or dirty writes.
- Enforces fail-closed recovery: if the underlying record changed during planning or execution, rejects the mutation and prompts a re-fetch and re-proposal.

### 2.3 Automated Multi-Step Saga Compensation (Rules 27 & 1961)
- When a multi-step workflow fails at step $k$:
  $$\text{Compensating Pipeline} = \text{Compensate}(S_{k-1}) \circ \text{Compensate}(S_{k-2}) \circ \dots \circ \text{Compensate}(S_1)$$
- Executes in strict Reverse-LIFO order using registered compensating capabilities in `FINANCE_ROLLBACK_MATRIX`, `SALES_ROLLBACK_MATRIX`, and `SUPERVISOR_ROLLBACK_MATRIX`.
- If compensation fails, quarantines the execution into the Dead Letter Queue (DLQ) and fires critical operator alerts (Rule 25).

### 2.4 Side-Effect Verification & Self-Healing (Rules 41 & 1962)
- Compares `PredictedStateChange` (from Rule 41 PREDICT step) against `ActualStateChange` (derived from pre-state and post-state).
- Detects discrepancies: missing timeline events, orphaned draft records, unlinked relationships.
- Runs autonomous self-healing routines for benign discrepancies (e.g. retry missing timeline event), or halts execution and flags high-severity discrepancies for human review.

### 2.5 Agent Health, Telemetry & Circuit Breakers (`agents_mcp_ui.md` 3616–3630, Rule 24)
- Tracks continuous health telemetry per agent persona:
  - **Success Rate** (% runs with all postconditions verified)
  - **Failure Rate** (% runs with execution or verification errors)
  - **Self-Healing Recovery Rate** (% discrepancies resolved autonomously)
  - **Human Correction Rate** (% actions modified or rejected by humans)
  - **Tool Error Rate**, **Latency**, and **Token Cost**
- Dynamically calculates an **Agent Health Score** (0–100).
- Automatically trips circuit breakers if failure rate exceeds threshold (e.g., > 15%), degrading the agent to Shadow Mode (`dryRun: true`, Rule 42) and notifying operators without requiring code deployments (Rule 61).

### 2.6 Standardized UI Surfaces (`theme.md` §8)
- **Execution Verification Inspector (`ExecutionInspectorModal.tsx`):**
  - Detailed modal showing Plan, Actions, Expected Result (PREDICT), Actual Result (EXECUTE), Verification Checks (VERIFY), and Compensation/Exceptions.
- **Agent Health Dashboard (`/admin/intelligence/health` & `AgentHealthClient.tsx`):**
  - Three-Zone operations cockpit displaying fleet-wide health scorecards, live telemetry streams, and manual circuit breaker controls.

---

## 3. Honest Baseline & Pre-existing Asset Re-use (Rule 69 Strangler Fig)

Phase 14 synthesizes, reuses, and orchestrates existing platform investments without mutating legacy operational records or breaking pre-existing functionalities:

| Existing Platform Foundation | Location | Status | Phase 14 Orchestration Role |
| :--- | :--- | :--- | :--- |
| **Capability Registry** | `src/platform/capabilities/` | Production (50+ capabilities) | Target for postcondition verification and compensation bindings |
| **Unified Approval Store** | `src/platform/approvals/unified-approval-store.ts` | Production (Two-Phase, SHA-256) | Human-in-the-loop interceptor for verification failures |
| **Domain Event Bus** | `src/platform/events/event-bus.ts` | In-memory + Outbox Worker | Transport for verification telemetry and health events (Rule 40) |
| **Saga Rollback Coordinator** | `src/platform/agents/supervisor/mesh/supervisor-rollback-coordinator.ts` | Phase 13 Milestone 4 | Base infrastructure for Universal Saga Compensation Engine |
| **Workflow DLQ Service** | `src/platform/workflows/resilience/workflow-dlq-service.ts` | Production | Quarantine for uncompensable steps and poison events (Rule 25) |
| **FieldsVariablesService** | `src/lib/services/fields-variables-service.ts` | Workspace SSOT | Assertion target for template compilation & variable resolution |
| **TagSelector** | `src/components/tags/TagSelector.tsx` | Workspace SSOT | Verification target for tag bindings in client/draft mode |
| **Emergency Control Plane** | `src/platform/policy/finance-control-policy.ts` | Multi-switch controls | Central kill-switch integration (`checkGovernanceDeadManSwitch`, Rule 60) |

---

## 4. The 4 Mandatory Governance Matrices for Phase 14

To ensure strict compliance with Rules 12, 14, 16, 18, 24, 27, and 1954–1964, Phase 14 formalizes 4 governance matrices:

### 4.1 Verification Policy Matrix (`VERIFICATION_POLICY_MATRIX`)
Maps every mutating capability to required postconditions, severity, and failure recovery strategies:
- `FAIL_AND_COMPENSATE`: Halts execution and triggers immediate Reverse-LIFO Saga compensation.
- `ESCALATE_TO_APPROVAL`: Freezes state mutation and creates an ActionProposal in the Approval Store for human operator review.
- `RECORD_WARNING`: Logs discrepancy in audit trail and continues execution with degraded status.

### 4.2 State Version Matrix (`STATE_VERSION_MATRIX`)
Defines the snapshot mechanism, version field, and optimistic locking lease for every mutable entity type:
- `entities`: `/entities/{id}` and `/workspace_entities/{ws}_{id}` with `version` and `updatedAt`.
- `deals`: `/deals/{id}` with `stageVersion` and `expectedAmount`.
- `invoices`: `/invoices/{id}` with `balance` and `paymentStatus`.
- `knowledge_nodes`: `/knowledge/{id}` with `validUntil` and `supersededBy`.

### 4.3 Universal Saga Rollback Matrix (`UNIVERSAL_SAGA_ROLLBACK_MATRIX`)
Unifies rollback capabilities across all domains:
- `crm.deal.advance_stage` $\rightarrow$ `crm.deal.revert_stage`
- `sdr.dispatch_whatsapp` $\rightarrow$ `sdr.log_outreach_revoked`
- `collections.execute_proposal` $\rightarrow$ `collections.rollback_proposal`
- `reconciliation.resolve_exception` $\rightarrow$ `reconciliation.unresolve_exception`
- `knowledge.candidate.decide` $\rightarrow$ `knowledge.candidate.reopen`

### 4.4 Agent Health Policy Matrix (`AGENT_HEALTH_POLICY_MATRIX`)
Configures threshold boundaries per agent persona:
- `minSuccessRate`: 85% (trips circuit breaker if drops below)
- `maxFailureRate`: 15% (trips circuit breaker if exceeds)
- `maxToolErrorsPerHour`: 10 errors
- `degradationMode`: `SHADOW_MODE` (zero live writes, Rule 42)

---

## 5. The 5 Milestones of Phase 14

```text
Phase 14: Agentic Self-Management & Verification
├── Milestone 1: Postcondition Verification Engine, Assertion Framework & Verification Matrix
├── Milestone 2: State-Version Validation, Optimistic Concurrency Engine & TOCTOU Guard
├── Milestone 3: Universal Saga Compensation Engine, Reverse-LIFO Coordinator & DLQ Bridge
├── Milestone 4: Side-Effect Discrepancy Engine, Autonomous Self-Healing & Health Telemetry Core
└── Milestone 5: Execution Inspector Modal, Agent Health Dashboard UI, Red-Team QA & Platform Graduation
```

---

### Milestone 1: Postcondition Verification Engine, Assertion Framework & Verification Matrix
**Focus:** Establishing canonical Zod contracts, postcondition interfaces, domain assertion engines, and verification matrices.

- **Tasks & Deliverables:**
  1. **Canonical Verification Contracts (`src/platform/verification/verification-types.ts`):**
     - `PostconditionAssertionSchema`: `assertionId`, `ruleName`, `targetResource`, `targetId`, `severity` (`CRITICAL`, `WARNING`), `status` (`VERIFIED`, `FAILED`, `SKIPPED`), `errorMessage`, `evidence`, `evaluatedAt`.
     - `VerificationResultSchema`: `executionId`, `capabilityId`, `overallStatus` (`PASS`, `FAIL`, `DEGRADED`), `assertionsCount`, `passedCount`, `failedCount`, `assertions` array, `durationMs`, `timestamp`.
     - `PostconditionContextSchema`: `organizationId`, `workspaceId`, `actorId`, `preStateSnapshot`, `postStateSnapshot`, `mutationPayload`.
     - Error taxonomy `VERIFICATION_ERROR_CODES` and typed `AgentVerificationError` class (Rule 48).
     - Strict Rule 4 typing: zero `any` or `any[]`.
  2. **Core Postcondition Engine (`src/platform/verification/postcondition-engine.ts`):**
     - Pure verification evaluator running assertions in parallel with timeout safeguards ($\le 5$s, Rule 26).
     - Standardized assertion rules per domain:
       - `crm:entity_updated`: confirms entity record exists and matches payload.
       - `crm:deal_stage_advanced`: confirms stage history entry and pipeline value.
       - `sales:outreach_sent`: confirms delivery status and E.164 normalization.
       - `finance:remainder_balanced`: confirms cent-level balancing invariant (Rule 11).
       - `knowledge:fact_superseded`: confirms `validUntil` and `supersededBy` pointers (Rule 29).
       - `supervisor:delegation_bounded`: confirms depth $\le 3$ and token budget $\le 4,000$ (Rules 9, 23, 28).
     - XML containerization: wraps all untrusted post-state records in `<untrusted_reference_data id="...">` (Rules 13 & 30).
     - Emergency dead-man switch evaluation via `checkGovernanceDeadManSwitch` failing closed (Rule 60).
  3. **Verification Matrix (`src/platform/verification/verification-matrix.ts`):**
     - Maps all canonical capabilities to mandatory postconditions and failure recovery strategies (`FAIL_AND_COMPENSATE`, `ESCALATE_TO_APPROVAL`, `RECORD_WARNING`).
  4. **Canonical Verification Capabilities (`src/platform/capabilities/verification/verification-capabilities.ts`):**
     - `verification.assert_postconditions` (L0_READ)
     - `verification.get_execution_verification` (L0_READ)
  5. **Server Actions & Test Suites:**
     - Next.js 15 Server Actions (`src/app/actions/verification-actions.ts`) with Clerk auth and anti-IDOR validation (Rules 8, 47, 51).
     - Dedicated Vitest test suite: `src/platform/__tests__/verification/postcondition-engine.test.ts`.

---

### Milestone 2: State-Version Validation, Optimistic Concurrency Engine & TOCTOU Guard
**Focus:** Pre-mutation resource snapshots, version hashing, optimistic concurrency control, and TOCTOU defense (Rule 18).

- **Tasks & Deliverables:**
  1. **State Version Contracts (`src/platform/verification/concurrency/state-version-types.ts`):**
     - `ResourceSnapshotSchema`: `resourceId`, `resourceType`, `version` (number / timestamp), `stateHash` (SHA-256 over key-sorted JSON, Rule 22), `capturedAt`.
     - `VersionValidationResultSchema`: `isCurrent`, `expectedVersion`, `actualVersion`, `driftDetected`, `violationType` (`STALE_READ`, `CONCURRENT_MUTATION`, `DELETED_RESOURCE`).
  2. **Optimistic Concurrency & Snapshot Service (`src/platform/verification/concurrency/state-version-service.ts`):**
     - `captureSnapshot(resourceType, resourceId)`: Creates canonical SHA-256 state hash and version tag.
     - `assertVersionCurrent(expectedSnapshot, currentResource)`: Detects TOCTOU drift and rejects stale mutations with `STALE_VERSION_DETECTED` (Rule 18).
     - Atomic check-and-set wrapper for Firestore mutations.
  3. **Canonical Capabilities for Concurrency:**
     - `concurrency.snapshot_resource` (L0_READ)
     - `concurrency.verify_version` (L0_READ)
  4. **Server Actions & Test Suites:**
     - Next.js 15 Server Actions (`src/app/actions/concurrency-actions.ts`).
     - Vitest test suite: `src/platform/__tests__/verification/state-version.test.ts`.

---

### Milestone 3: Universal Saga Compensation Engine, Reverse-LIFO Coordinator & DLQ Bridge
**Focus:** Cross-domain Saga rollback coordinator, compensating capability execution in reverse-LIFO order (Rule 27), and DLQ quarantine (Rule 25).

- **Tasks & Deliverables:**
  1. **Saga Compensation Contracts (`src/platform/verification/saga/saga-compensation-types.ts`):**
     - `SagaStepExecutionRecordSchema`: `stepId`, `runId`, `capabilityId`, `inputPayload`, `outputPayload`, `compensatingCapabilityId`, `compensatingPayload`, `executedAt`, `status`.
     - `SagaCompensationResultSchema`: `runId`, `totalSteps`, `compensatedStepsCount`, `failedCompensationsCount`, `dlqEnqueued`, `auditTrail`.
  2. **Universal Saga Compensation Engine (`src/platform/verification/saga/saga-compensation-service.ts`):**
     - Coordinates multi-step execution undo in strict Reverse-LIFO order.
     - Automatically looks up compensating capabilities from `UNIVERSAL_SAGA_ROLLBACK_MATRIX`.
     - Emits `saga.step.compensated` and `saga.compensation.completed` domain events (Rule 40).
     - DLQ Quarantine: Enqueues uncompensable steps to `WorkflowDlqService` with sanitized error context (Rule 25).
     - Emergency dead-man switch evaluation failing closed (Rule 60).
  3. **Capabilities & Server Actions:**
     - `saga.execute_compensation` (L2_STATE_MUTATION, Non-Delegable, Rule 17)
     - `saga.get_execution_ledger` (L0_READ)
     - Next.js 15 Server Actions in `src/app/actions/saga-compensation-actions.ts`.
  4. **Test Suites:**
     - Vitest test battery: `src/platform/__tests__/verification/saga-compensation.test.ts`.

---

### Milestone 4: Side-Effect Discrepancy Engine, Autonomous Self-Healing & Health Telemetry Core
**Focus:** Comparing predicted vs actual state changes, autonomous remediation routines, continuous agent health telemetry, and dynamic circuit breakers (Rules 24, 41, 1962).

- **Tasks & Deliverables:**
  1. **Discrepancy & Health Contracts (`src/platform/verification/health/health-types.ts`):**
     - `DiscrepancyReportSchema`: `predictedChange`, `actualChange`, `varianceType`, `isRemediable`, `remediationAction`.
     - `AgentHealthScorecardSchema`: `personaId`, `healthScore` (0–100), `status` (`HEALTHY`, `DEGRADED`, `TRIPPED`, `CRITICAL`), `successRate`, `recoveryRate`, `approvalRate`, `toolErrorsCount`, `avgDurationMs`, `tokenCostUSD`, `lastTrippedAt`.
     - `HealthThresholdPolicySchema`: `minSuccessRate` (default 85%), `maxFailureRate` (default 15%), `maxToolErrorsPerHour` (default 10).
  2. **Side-Effect Discrepancy & Self-Healing Service (`src/platform/verification/health/discrepancy-service.ts`):**
     - Compares `PredictedStateChange` vs `ActualStateChange`.
     - Autonomous self-healing executor for benign discrepancies (e.g., retrying secondary index write, re-linking timeline node).
     - Escalates non-remediable discrepancies to human operators.
  3. **Agent Health Monitoring & Circuit Breaker Engine (`src/platform/verification/health/agent-health-service.ts`):**
     - Aggregates execution and verification events across all personas.
     - Computes dynamic health scores.
     - Trips circuit breakers automatically when thresholds are violated, degrading personas to Shadow Mode (Rule 42).
     - Supports manual reset via authorized server action with mandatory audit justification (Rules 60 & 61).
  4. **Server Actions & Test Suites:**
     - Next.js 15 Server Actions (`src/app/actions/agent-health-actions.ts`).
     - Vitest test suite: `src/platform/__tests__/verification/agent-health.test.ts`.

---

### Milestone 5: Execution Inspector Modal, Agent Health Dashboard UI, Red-Team QA & Platform Graduation
**Focus:** Standardized modal UI for execution inspection, backoffice Agent Health dashboard, 6-vector adversarial red team, and production graduation.

- **Tasks & Deliverables:**
  1. **Execution Verification Inspector (`src/components/verification/ExecutionInspectorModal.tsx`):**
     - Strict compliance with `theme.md` §8 Standardized Modal Architecture:
       - Surface: `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`
       - Demarcated Header: `<DialogHeader demarcated>` with min-h-[52px]/[56px], border-b, bg-muted/20
       - Single-circle info tooltip: `<CardInfoTooltip text="..." />` at `z-[10050]`
       - Zero raw descriptions: `<DialogDescription className="sr-only">`
       - Demarcated footer: `px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5` with tactile buttons (`rounded-xl active:scale-[0.97] min-h-[44px]`).
     - 6-Zone Stepper: Plan, Actions, Expected Result (PREDICT), Actual Result (EXECUTE), Verification Checks (VERIFY), Exceptions/Compensation.
     - Live assertion checklist with interactive proof chips and `<untrusted_reference_data id="...">` containers.
  2. **Agent Health Dashboard (`src/app/admin/intelligence/health/`):**
     - Page route `/admin/intelligence/health` and client component `AgentHealthClient.tsx`.
     - Three-Zone layout (Rule 61): Zone 1 Executive KPIs, Zone 2 Filter & Status Tabs, Zone 3 Agent Health Grid.
     - One-click tactile circuit breaker reset modal with mandatory 5-character audit justification input.
     - Real-time SSE streaming reactivity via `useEventStream` subscribing to `verification.*` and `health.*` events (Rule 62).
  3. **Navigation Integration (`AdminSidebar.tsx`):**
     - Adds `Agent Health` under `INTELLIGENCE` group with `Activity` icon.
     - 100% Strangler Fig preservation of all 52 existing routes and accordion states (Rule 69).
  4. **Adversarial Security Red-Team Battery (`src/platform/__tests__/verification/verification-red-team.test.ts`):**
     - 6 attack vectors:
       1. Postcondition assertion bypass attempt
       2. Stale read & TOCTOU version race attack
       3. Saga compensation cascade failure & DLQ quarantine
       4. Discrepancy injection & fake-clean report attack
       5. Health telemetry tampering attack
       6. Emergency dead-man switch evaluation failing closed across actions and engines (Rule 60)
  5. **Verification & Platform Graduation:**
     - Full Vitest test suite verification (100% pass rate).
     - Full TypeScript compilation (`tsc --noEmit`).
     - ESLint static analysis (0 errors, warnings <= 670 ceiling).
     - Completion report and architectural code review.

---

## 6. The Rule 67 Agent Implementation Gate Checklists

Every milestone in Phase 14 must satisfy the five-dimension gate before completion:

```text
ARCHITECTURE
□ What canonical capability does this use? (Registered in CapabilityRegistry, L0-L3)
□ Is this duplicating an existing service? (Reuses ApprovalStore, EventBus, DLQService)
□ What is the source of truth? (Firestore records + immutable audit ledger)
□ What events are emitted? (verification.*, saga.*, health.* via defaultEventBus)

AUTHORITY
□ Who is allowed to use it? (Clerk session auth with requireAuth())
□ What may the agent do? (Assert postconditions, evaluate state versions, simulate self-healing)
□ What may the agent never do? (Reset circuit breakers or execute unapproved compensations - Rule 17)
□ Can a sub-agent inherit this authority? (Only within delegated scope, depth <= 3)

DATA
□ What data enters the agent? (Pre- and post-mutation resource snapshots)
□ What data leaves the system? (Sanitized verification reports, health metrics)
□ What is trusted? (Internal database state, cryptographic SHA-256 hashes)
□ What is untrusted? (External API responses, user inputs, provider status strings)
□ What is sensitive? (Credentials and PII scrubbed via [REDACTED_SECRET:<type>])

EXECUTION
□ Is it idempotent? (Deterministic assertion IDs and compensation idempotency keys)
□ Can it be retried? (Safe postcondition re-evaluation, reverse-LIFO saga retry)
□ Can it be cancelled? (Cooperative cancellation via AbortSignal - Rule 26)
□ Can it be duplicated? (Deduplicated via executionId and stateHash)
□ What if the underlying record changes? (Detected by assertVersionCurrent, TOCTOU fail-closed)
□ What if the response is lost? (Idempotent replay via stored execution record)

MCP
□ What protocol version? (MCP Spec 2026-07-28)
□ What SDK version? (TypeScript SDK v2 / @modelcontextprotocol/server)
□ What capabilities? (verification.assert_postconditions, concurrency.verify_version, saga.execute_compensation)
□ What annotations? (Risk level annotations, audit required)
□ What server identity? (Stateless HTTP streamable transport)
□ What schema version? (Zod v4 canonical contracts)
```

---

## 7. Master Rules Compliance Matrix (Rules 1–69 & 1954–1964)

| Rule | Title | Mandate in Phase 14 | Verification Mechanism |
| :--- | :--- | :--- | :--- |
| **Rule 1** | Modern Web Guidance & Skills | Conforms to Next.js best practices, Emil Kowalski animations, and frontend-design skills. | UI review & animation inspection |
| **Rule 2** | Risk Analysis & Scalability | Identifies what could go wrong (stale reads, ungrounded mutations, cascade drops) and implements mitigations. | FMEA analysis & unit tests |
| **Rule 3** | Backoffice Controls | Enhances backoffice with real-time health telemetry and circuit reset without code deploys. | Backoffice action tests |
| **Rule 4** | Strict Typing Policy | Zero `any` or `any[]` across all verification contracts, engines, and UI components. | `pnpm typecheck` & AST inspection |
| **Rule 5** | Staged Deployments | Validates and stages all new capabilities and schemas before production graduation. | Staging checklist |
| **Rule 6** | Dependencies & Context7 | Dependencies strictly configured; verified against Context7 and official docs. | Dependency review |
| **Rule 7** | Mobile-First & Clear English | All UI surfaces responsive, touch-friendly (`min-h-[44px]`), plain English text. | Viewport & touch audits |
| **Rule 8** | Tenant Isolation | All assertions and health metrics partitioned by `organizationId` and `workspaceId`. | `assertTenantContext` & IDOR red-team |
| **Rule 9** | High Load & Resource Governance | Bounded parallel evaluation ($\le 4$), execution timeouts ($\le 5$s). | Concurrency load tests |
| **Rule 10** | Inline Architectural Docs | Leaves clear explanatory comments explaining what changed and why. | Code comments audit |
| **Rule 11** | Mathematical Determinism | Cent-level rounding in financial postcondition assertions (`roundCurrency`). | `roundCurrency` unit tests |
| **Rule 12** | Annotations != Security | Formal risk tiers (`L0_READ` to `L2_STATE_MUTATION`) enforced by code, not advisory annotations. | Capability definition tests |
| **Rule 13** | Untrusted Data Isolation | External records and post-states wrapped in `<untrusted_reference_data id="...">`. | Sanitization tests & regex validation |
| **Rule 14** | Rug-Pull Defense | Verification capabilities and tool definitions versioned with SHA-256 fingerprints. | Tool fingerprint tests |
| **Rule 15** | Server Allowlisting | External tool sources verified against server allowlist. | Allowlist tests |
| **Rule 16** | Explicit RBAC Scopes | Resetting circuit breakers requires `governance:manage` permission. | RBAC assertion tests |
| **Rule 17** | Non-Delegable Actions | Saga manual rollback and circuit reset are strictly non-delegable to AI agents (`actor.type === 'user'`). | Non-delegable guard unit tests |
| **Rule 18** | TOCTOU & State Versioning | Re-asserts version pre- and post-mutation; rejects stale states. | Concurrency race tests |
| **Rule 19** | Idempotency | Postconditions and compensations require unique idempotency keys. | Duplicate execution tests |
| **Rule 20** | Replay Protection | Execution records track `executionId`, `attempt`, and outcome status. | Replay protection tests |
| **Rule 21** | Two-Phase Execution | Formal 6-step loop: Plan → Predict → Execute → Verify → Commit → Learn. | Orchestrator workflow tests |
| **Rule 22** | Cryptographic Binding | State hashes and proposal hashes verified via SHA-256 over key-sorted JSON. | Hash verification tests |
| **Rule 23** | Resource Governance | Bounds verification execution time ($\le 5$s) and token budget ($\le 4,000$). | Budget guard tests |
| **Rule 24** | Circuit Breakers | Automatically trips circuit breaker when agent failure rate exceeds threshold. | Health engine tests |
| **Rule 25** | Dead Letter Queue | Uncompensable steps enqueued to DLQ with sanitized error context. | DLQ enqueue assertion tests |
| **Rule 26** | Cancellation Semantics | Native `AbortSignal` cooperative cancellation supported across engines. | Abort signal unit tests |
| **Rule 27** | Reverse-LIFO Saga | Compensating actions executed in strict Reverse-LIFO order on workflow failure. | Saga rollback tests |
| **Rule 28** | Context Budgeting | Knapsack token packing bounds prompt and assertion context. | Token meter tests |
| **Rule 29** | Memory Governance | Asserts fact supersession updates `validUntil` and `supersededBy`. | Knowledge assertion tests |
| **Rule 30** | Prompt Injection Defense | Sanitizes post-state strings against `ADVERSARIAL_DIRECTIVE_PATTERNS`. | Red-team injection battery |
| **Rule 31** | Output Validation | Validates all model and tool outputs with Zod v4 schemas before consumption. | Schema validation tests |
| **Rule 32 & 33** | Secret Scrubbing | Scrub credentials in assertion evidence (`[REDACTED_SECRET:<type>]`). | Secret scrubber tests |
| **Rule 34** | SSRF Defense | Blocks loopback, link-local, and metadata IP egress in verification tools. | SSRF filter tests |
| **Rule 35** | Discovery Caching | Caches capability discovery results with TTL and schema hashes. | Cache invalidation tests |
| **Rule 36** | Capability Versioning | Capabilities versioned with semantic versioning (`major.minor.patch`). | Version compatibility tests |
| **Rule 37** | MCP Spec Compliance | Tested against MCP Spec 2026-07-28 and SDK v2. | Conformance suite |
| **Rule 38** | No Deprecated Features | Uses stateless Streamable HTTP; avoids deprecated legacy SSE. | Architecture inspection |
| **Rule 39** | OpenTelemetry | Traces verification requests with `traceId`, `spanId`, and correlation headers. | Header propagation tests |
| **Rule 40** | Domain Event Auditing | Emits `verification.*`, `saga.*`, and `health.*` domain events to `defaultEventBus`. | Event listener assertion tests |
| **Rule 41** | Explainability Grid | Execution inspector displays WHAT, WHY, and EXPECTED vs ACTUAL state change. | UI component tests |
| **Rule 42** | Shadow Mode Simulation | Degraded agents execute in Shadow Mode (`dryRun: true`) with zero live writes. | Zero-mutation simulation tests |
| **Rule 43** | Replayable Runs | Stores execution ledger enabling step-by-step audit replay. | Replay tests |
| **Rule 44** | Deterministic Simulation | Evaluates assertions deterministically without stochastic randomness. | Simulation tests |
| **Rule 45** | Chaos Testing | Evaluates behavior under network failure, timeouts, and concurrent race conditions. | Chaos test suite |
| **Rule 46** | Adversarial Red-Team | Dedicated red-team test batteries covering injection, IDOR, tampering, and bypass. | Red-team test battery |
| **Rule 47** | Anti-IDOR Enforcement | Server Actions validate tenant matching caller's authenticated session. | IDOR probe tests |
| **Rule 48** | Sanitized Error Taxonomy | Structured error codes mapped to HTTP status; zero stack leaks. | Error mapping tests |
| **Rule 49** | Public Resource Isolation | Public resources isolated from sensitive internal verification records. | Resource isolation tests |
| **Rule 50** | Cache Isolation | Cache keys scoped by tenant (`${tenantId}:${resourceId}`). | Cache isolation tests |
| **Rule 51** | Server Actions Security | Next.js 15 Server Actions enforce Clerk session auth and dead-man pause. | Action security tests |
| **Rule 52** | Client/Server Boundary | Clear boundary separating server actions from client components. | Build boundary checks |
| **Rule 53** | Dependency Governance | Zero unvetted third-party libraries; relies on core platform services. | Dependency audit |
| **Rule 54** | Performance Budgets | Verification evaluation completed in $\le 300$ms in normal conditions. | Performance benchmarks |
| **Rule 55** | Canvas Resource Limits | Clamps execution DAG visualization to $\le 80$ nodes and $\le 150$ edges. | Visual canvas bounds tests |
| **Rule 56** | Context Compression | Knapsack packing compresses evidence payloads to stay within token ceilings. | Token compression tests |
| **Rule 57** | Data Retention | Verification records follow workspace retention policies with soft delete. | Retention tests |
| **Rule 58** | Model Routing Policy | Postcondition analysis routes deterministically; uses Flash for heuristics. | Model routing tests |
| **Rule 59** | Tool Selection Eval | Verifies that selected capabilities strictly match the required task scope. | Tool selection tests |
| **Rule 60** | Emergency Dead-Man Switch | Checks `checkGovernanceDeadManSwitch`; fails closed on emergency stop. | Dead-man fail-closed tests |
| **Rule 61** | Backoffice Operations | Circuit breaker reset and policy edits operable without code deploys. | Backoffice action tests |
| **Rule 62** | Real-time SSE Streaming | Agent Health dashboard subscribes to real-time events via `useEventStream`. | SSE mock tests |
| **Rule 63** | Incident Management | Fired alerts route to backoffice security center during verification failures. | Incident handler tests |
| **Rule 64** | Three-Level Feature Flags | Gated by `FF_AGENT_VERIFICATION` at system, tenant, and user levels. | Feature flag tests |
| **Rule 65** | Canary Releases | Verification engine staged and rolled out progressively. | Release checklist |
| **Rule 66** | Mandatory Deliverables Gate | Fulfills contracts, matrices, evaluation datasets, shadow mode, UI, and red team. | Completion criteria |
| **Rule 67** | Agent Implementation Gate | Satisfies all 5 checklist dimensions (Arch, Authority, Data, Execution, MCP). | Milestone checklist |
| **Rule 68** | Five Non-Negotiables | Strict typing (no any), no raw HTML, performance bounds, mobile a11y, high security. | Gate verification |
| **Rule 69** | Strangler Fig Invariant | Preserves all 52 pre-existing Admin routes and pre-existing capability engines. | Route and regression tests |
| **Rules 1954–1964** | Phase 14 Verification | Implements postcondition checks, state-version validation, compensation, side-effect verification. | Dedicated test battery |
| **theme.md §8** | Standardized Modals | Strict compliance: demarcated header/footer, single-circle info tooltip, sr-only description. | DOM & snapshot tests |
| **FieldsVariables** | Workspace SSOT | Route all variable replacement through `FieldsVariablesService`. Zero custom regex. | Template compilation tests |
| **TagSelector** | Workspace SSOT | Route tag selection exclusively through `<TagSelector>` in client/draft mode. | Component tests |

---

## 8. Execution Gates & Protocol Notice

**CRITICAL INSTRUCTION:** In accordance with the user directive, execution of Phase 14 will **NOT** begin until the implementation plan is fully approved.
