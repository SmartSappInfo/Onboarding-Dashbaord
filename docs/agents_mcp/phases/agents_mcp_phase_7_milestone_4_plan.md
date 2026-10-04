# Phase 7 Milestone 4 Implementation Plan (Updated with 69 Rules)
## Resilient Retry Policies, Jitter, Dead-Letter Queue (DLQ) & Operator Recovery

**Platform:** SmartSapp Enterprise Agentic Workflow Platform  
**Phase:** Phase 7 — Durable Agentic Workflow Engine, Distributed Leases & Resilient Execution  
**Milestone:** Milestone 4 — Resilient Retry Policies, Jitter, Dead-Letter Queue (DLQ) & Operator Recovery  
**Version:** 2.0.0 (Comprehensive 69-Rules Alignment & Architectural Hardening)  
**Status:** APPROVED & READY FOR IMPLEMENTATION  
**Authors:** Senior Principal Systems & AI Agentic Architecture Engineer  

---

## 1. Executive Summary & Architectural Invariants

Phase 7 Milestone 4 delivers industrial-grade resilience, fault tolerance, and operator incident recovery for the SmartSapp Durable Workflow Engine. In serverless Google Cloud Run environments, distributed agent workflows face transient network blips, downstream provider rate limits (HTTP 429), temporary service outages (HTTP 503), poisoned inputs, and fatal authorization errors.

Milestone 4 replaces naive retries with:
1. **Tri-State Error Classification:** Categorizing errors into `TRANSIENT` (retryable with backoff), `PERMANENT` (schema invalid, non-retryable; immediate DLQ quarantine), and `FATAL` (auth/policy violation, dead-man pause; immediate abort).
2. **Exponential Backoff with Full Jitter:** Computing deterministic randomized delays $t = \min(\text{maxBackoffMs}, \text{baseBackoffMs} \times 2^{\text{attempt}-1}) \times \text{random}(0.5, 1.5)$ to prevent retry storms against degraded downstream systems.
3. **5-State Capability Circuit Breakers (Rule 24):** Wrapping capability invocations in circuit breakers (`CLOSED` $\to$ `DEGRADED` $\to$ `OPEN` $\to$ `HALF_OPEN` $\to$ `RECOVERED`), failing fast when providers are down.
4. **Multi-Tenant Workflow Dead-Letter Queue (DLQ) Service (Rule 25 & 48):** Quarantining exhausted or poisoned steps into Firestore `/organizations/{orgId}/workflow_dlq/{dlqId}` with sanitized error diagnostics (stripping secrets and DB internal stack traces).
5. **Distributed Asynchronous Saga Engine (Rule 27):** Executing compensating capabilities in strict reverse execution order (LIFO) across asynchronous steps upon terminal failure or cancellation.
6. **Operator Remediation Server Actions (Rule 51 & 63):** Empowering human operators to inspect, retry, skip, re-parameterize, or discard quarantined DLQ steps from the backoffice control plane.

---

## 2. Complete 69-Rules Compliance Matrix for Milestone 4

To ensure absolute conformance with `docs/agents_mcp/agents_mcp_rules.md` without compromising any platform functionality, the matrix below details the exact architectural defense and implementation for all relevant rules in Milestone 4:

### Section A: Core Development & Engineering Principles (Rules 1–10)
| Rule # | Requirement | Milestone 4 Implementation & Architectural Defense |
| :---: | :--- | :--- |
| **Rule 1** | Skill Conformance & Standards | Conforms strictly to `next-best-practices`, `vercel-react-best-practices`, and `backend-design`. All preexisting features preserved. |
| **Rule 2** | Failure Mode Planning & Cleanliness | Deep planning for serverless failure modes: Cloud Run 300s timeout, container SIGTERM, network partitions, webhook spoofing, duplicate task delivery. Clean code, TDD, strict linting. |
| **Rule 3** | Backoffice Enhancement & Non-Breaking | Provides operator remediation Server Actions for `/admin/workflows` and DLQ inspection without modifying existing code. |
| **Rule 4** | Zero `any` / Zero `any[]` Policy | Absolute strict typing. `unknown` permitted only at external boundary, immediately narrowed via Zod v4 schemas (`WorkflowDlqEntrySchema`, `WorkflowRetryPolicyConfigSchema`). |
| **Rule 5** | Staged Deployment & Security Verification | Compound Firestore indexes for `workflow_dlq` staged and verified. Security policies rigorously tested. |
| **Rule 6** | Dependencies & Context7 Documentation | Uses verified stable versions of `@google-cloud/tasks`, Zod v4, and Node.js `crypto`. Documentation checked via Context7 MCP. |
| **Rule 7** | Mobile-First & Plain UI English | Remediation actions and DLQ detail payloads use clear, minimal, everyday UI language. |
| **Rule 8 & 47** | High Security, Data Protection & Anti-IDOR | Every DLQ record, retry task, and remediation action immutably binds `organizationId` and `workspaceId`. Cross-tenant queries reject with `IDOR_VIOLATION`. |
| **Rule 9** | High Load & Resource Exhaustion Defense | Paged DLQ listing clamped between 1 and 100. Backoff delay capped at `maxBackoffMs` (60s). Subcollections prevent 1MB Firestore limits. |
| **Rule 10** | Inline Architectural Documentation | Every authored file includes comprehensive `@fileOverview` detailing state transitions, backoff math, and testability pointers. |

### Section B: MCP & Security Foundations (Rules 11–25)
| Rule # | Requirement | Milestone 4 Implementation & Architectural Defense |
| :---: | :--- | :--- |
| **Rule 11** | MCP Protocol Compliance | DLQ entries support inspection and remediation via MCP Tasks extension endpoints (`task/result`, `task/cancel`). |
| **Rule 12** | No MCP Annotations as Security Controls | Step retry permissions verified server-side via `evaluatePrincipalAuthority` independently of tool annotations. |
| **Rule 13** | Formal Trust Boundary Matrix | Quarantined step outputs and payloads stored in DLQ are containerized in `<untrusted_reference_data id="...">` before entering agent context. |
| **Rule 14** | Tool Poisoning / Rug-Pull Defense | Step retries re-verify composite SHA-256 capability fingerprints (`ToolFingerprintService`) before invoking any registered tool. |
| **Rule 15** | Server Allowlisting & Supply-Chain Security | Capabilities retried from DLQ must reside in `approved`, `connected`, or `monitored` states in `ServerAllowlistService`. |
| **Rule 16** | Agent Identity as Security Principal | Workflows execute under authenticated `AgentPrincipal` with minted ephemeral session tokens. Wildcard (`*`) scopes are strictly prohibited. |
| **Rule 17** | Non-Delegable Actions | Workflow steps containing non-delegable actions cannot execute autonomously; retries must preserve approval gates. |
| **Rule 18** | TOCTOU Live Principal / Delegation Check | At each retried step, the worker verifies principal authorization and delegation validity against Firestore before executing mutations. |
| **Rule 19** | Mandatory Idempotency for Mutating Tools | Every retry step computes a deterministic `idempotencyKey` derived from `workflowId`, `stepId`, `attempt`, and input hash, preventing double-execution on Cloud Tasks retry. |
| **Rule 20** | Replay & Distributed Tracing | Propagates `x-smartsapp-correlation-id`, `mcp-transaction-id`, `workflowId`, and `dlqId` across all Cloud Tasks headers, execution steps, and audit events. |
| **Rule 21 & 22** | Two-Phase Actions & Cryptographic Binding | Re-parameterized DLQ steps verify canonical SHA-256 `payloadHash` prior to execution if high-risk. |
| **Rule 23** | Budget, Backpressure and Resource Governance | Enforces hard ceiling on retry attempts (`maxRetries = 5`) and backoff duration (`maxBackoffMs = 60,000ms`). |
| **Rule 24** | 5-State Circuit Breakers | Capabilities tracked across `healthy` $\to$ `degraded` $\to$ `open` $\to$ `half_open` $\to$ `recovered`. Fast-fails when open. |
| **Rule 25** | Dead-Letter and Recovery Queues | Quarantines poisoned steps with input context; provides operational queue for operator remediation. |

### Section C: Agent Runtime & Execution Architecture (Rules 26–40)
| Rule # | Requirement | Milestone 4 Implementation & Architectural Defense |
| :---: | :--- | :--- |
| **Rule 26** | Add Cancellation Semantics | True cancellation: marks pending steps `SKIPPED`, revokes leases, and triggers Saga compensation. |
| **Rule 27** | Formal Saga Model | Strict reverse-order (LIFO) rollback of mutating capabilities upon terminal failure or cancellation. |
| **Rule 28** | Context Budgeting | Quarantined context in DLQ entries is bounded to prevent memory bloat. |
| **Rule 30** | Untrusted Data Containers | Quarantined data and error details encapsulated in `<untrusted_reference_data id="...">` containers. |
| **Rule 31** | Post-Condition Verification | Steps retried from DLQ undergo post-condition state verification before marking `COMPLETED`. |
| **Rule 32** | Linear Non-Backtracking RegEx Matchers | Error sanitization uses linear non-backtracking regex patterns (`[REDACTED_SECRET:<type>]`). |
| **Rule 33 & 34** | Cloud Tasks Handshake & SSRF Guard | Re-enqueued retry steps target `/api/tasks/workflow-step` verifying Cloud Tasks HMAC and Google OIDC Bearer tokens. |
| **Rule 40** | Immutable Domain Events & Hashing | Emits `workflow.step_retry_scheduled`, `workflow.dlq_routed`, `workflow.dlq_remediated`, `workflow.saga_compensated` to EventBus with SHA-256 hash chaining. |

### Section D: Testing, Verification & Safety Framework (Rules 41–55)
| Rule # | Requirement | Milestone 4 Implementation & Architectural Defense |
| :---: | :--- | :--- |
| **Rule 41** | "Why Did You Do This?" View | DLQ entries capture full execution context, error classification, and failure history. |
| **Rule 42** | Shadow Mode / Dry-Run | Saga compensation supports `dryRun: true`, validating rollback plan without writing live database mutations. |
| **Rule 43** | Replayable Runs | Checkpoint history allows deterministic reconstruction of failed and retried runs. |
| **Rule 44** | Deterministic Simulation | Test harness simulates provider 503s, 429s, validation failures, and circuit trips. |
| **Rule 45** | Chaos Testing | Fault injection test suites simulating transient 503s, permanent schema mismatch, provider outages, and circuit trips. |
| **Rule 46** | Adversarial Agent Testing | Tests verifying DLQ tamper resistance, Anti-IDOR cross-tenant access rejection, and prompt injection neutralization. |
| **Rule 48** | Sanitize Tool Errors | Masks API keys, JWTs, database connection strings, and internal stack traces before persisting to DLQ. |
| **Rule 50** | Cache Multi-Tenant Isolation | Circuit breaker and retry state cached per tenant and provider. |
| **Rule 51** | Server Actions Security | DLQ actions enforce Clerk `requireAuth()`, Anti-IDOR validation, and dead-man switch evaluation. |

### Section E: Governance, Operations & Phased Rollout (Rules 56–69)
| Rule # | Requirement | Milestone 4 Implementation & Architectural Defense |
| :---: | :--- | :--- |
| **Rule 57** | Fallback Degradation Strategy | When circuit breaker trips, workflows can route to fallback capabilities or pause gracefully. |
| **Rule 60** | Emergency Dead-Man Controls | Step execution, retries, and remediation server actions fail closed with `DEAD_MAN_PAUSED` when dead-man switch is active. |
| **Rule 61** | Backoffice as Control Plane | Operator remediation server actions restricted strictly to authenticated backoffice operators. |
| **Rule 62** | Real-Time UI Reactivity via SSE | Publishes `workflow.dlq_routed` and `workflow.dlq_remediated` so operator mission control updates with zero polling. |
| **Rule 63** | Agent Incident Management | Operator actions to retry, skip, re-parameterize, or discard quarantined workflow steps. |
| **Rule 67** | The 12-Point Implementation Gate | Verified across all 12 pre-flight requirements. |
| **Rule 68** | The Five Non-Negotiable Invariants | Strictly maintained: identity != user; model distrust; tool distrust; two-phase high-risk; cancellable & budget-bound. |
| **Rule 69** | Strangler Fig Invariant | Zero breaking regressions to preexisting automations, EventBus DLQ, or platform capabilities. |

---

## 3. Mathematical & Algorithmic Formulations

### 3.1 Exponential Backoff with Full Jitter Formulation
To prevent synchronization of retry storms ("thundering herd") against recovering downstream services:
$$\text{baseDelay} = \min\left(\text{maxBackoffMs}, \text{baseBackoffMs} \times \text{multiplier}^{\text{attempt}-1}\right)$$
$$\text{jitteredDelay} = \text{baseDelay} \times \left(0.5 + \text{random}()\right)$$

*Defaults:* `baseBackoffMs = 1,000`, `multiplier = 2.0`, `maxBackoffMs = 60,000`.  
*Progression:*
- Attempt 1: $[500\text{ms}, 1,500\text{ms}]$
- Attempt 2: $[1,000\text{ms}, 3,000\text{ms}]$
- Attempt 3: $[2,000\text{ms}, 6,000\text{ms}]$
- Attempt 4: $[4,000\text{ms}, 12,000\text{ms}]$
- Attempt 5: $[8,000\text{ms}, 24,000\text{ms}]$ (capped at 60s max)

### 3.2 5-State Circuit Breaker State Transition Matrix (Rule 24)
```
          failureThreshold reached
    CLOSED ───────────────────────► OPEN
      ▲                              │
      │ 0 failures                   │ cooldownElapsed
      │ in half_open                 ▼
  RECOVERED ◄─────────────────── HALF_OPEN
      ▲       probeSuccess            │ probeFailure
      │                               ▼
      └───────────────────────────── OPEN
```
- **`CLOSED` (Healthy):** Normal execution. Failure counter resets on success.
- **`DEGRADED` (Warning):** Consecutive transient failures occurring ($1 \le \text{count} < \text{threshold}$).
- **`OPEN` (Tripped):** $\text{count} \ge \text{threshold}$ (default 5). Invocations fail fast immediately with `CIRCUIT_BREAKER_OPEN`.
- **`HALF_OPEN` (Probe):** After cooldown period (default 30s), permits limited probe requests to test provider health.
- **`RECOVERED` (Healing):** Probe succeeds; transitions back to `CLOSED`.

### 3.3 Reverse-LIFO Saga Stack Unwinding (Rule 27)
Given a workflow execution sequence of completed steps:
$$S = [S_1, S_2, S_3, \dots, S_k]$$
When $S_{k+1}$ permanently fails and triggers Saga rollback, the engine builds the compensation stack:
$$C = [C_k, C_{k-1}, \dots, C_1]$$
where $C_i$ is the compensating capability bound to $S_i$ (`step.compensatingCapabilityId` or capability definition risk metadata). Steps without compensating capabilities are safely skipped.

---

## 4. Detailed Task Breakdown & Implementation Specifications

### Task 1: Resilient Retry Contracts, Error Taxonomy & DLQ Schemas
- **File:** `src/platform/workflows/resilience/workflow-resilience-types.ts`
- **Contracts:**
  - `ErrorCategory`: `'TRANSIENT' | 'PERMANENT' | 'FATAL'`.
  - `WorkflowRetryPolicyConfigSchema`: Zod v4 schema with strict validation.
  - `CircuitBreakerState`: `'healthy' | 'degraded' | 'open' | 'half_open' | 'recovered'`.
  - `WorkflowDlqEntrySchema`: Complete Zod v4 schema for quarantined steps.
  - `WorkflowSagaStepSchema`, `WorkflowSagaResultSchema`.
  - `WORKFLOW_RESILIENCE_ERROR_CODES` taxonomy and typed `WorkflowResilienceError` class.

### Task 2: Resilient Retry Policy & 5-State Circuit Breaker Engine
- **File:** `src/platform/workflows/resilience/workflow-retry-policy.ts`
- **Components:**
  - `classifyWorkflowError(err: unknown): ErrorClassificationResult`: Categorizes exceptions into transient, permanent, or fatal.
  - `calculateRetryDelay(policy: WorkflowRetryPolicyConfig, attempt: number): number`: Computes Full Jitter delay in milliseconds and seconds.
  - `WorkflowCircuitBreakerManager`: Multi-tenant, provider-partitioned circuit breaker with state transitions, failure tracking, and cooldown probes.

### Task 3: Multi-Tenant Workflow Dead-Letter Queue (DLQ) Service
- **File:** `src/platform/workflows/resilience/workflow-dlq-service.ts`
- **Components:**
  - Storage contract `WorkflowDlqStore` with Firestore adapter and in-memory adapter (`createMemoryWorkflowDlqStore`).
  - `sanitizeErrorMessage(msg: string): string`: Linear non-backtracking redaction (Rule 48) stripping JWTs, private keys, API keys, database connection strings, and internal stack traces.
  - `routeToDlq`: Quarantines exhausted/failed steps, stores input context, updates step/instance status, and publishes `workflow.dlq_routed` domain event.
  - `listDlqEntries`, `getDlqEntry`, `remediateDlqEntry`: Querying and atomic status updates.

### Task 4: Distributed Workflow Saga Compensation Engine
- **File:** `src/platform/workflows/resilience/workflow-saga-engine.ts`
- **Components:**
  - `rollbackWorkflow(params: RollbackWorkflowInput): Promise<WorkflowSagaResult>`.
  - Reverse-LIFO traversal of completed steps.
  - Deterministic idempotency keys `saga_comp_${workflowId}_${stepId}` (Rule 19).
  - Dry-run simulation support (Rule 42).
  - Emergency dead-man switch evaluation (Rule 60).
  - Operator escalation (`requiresOperatorIntervention: true`) on partial failure (Rule 25 & 63).

### Task 5: Workflow Step Runner Integration
- **File:** `src/platform/workflows/execution/workflow-step-runner.ts`
- **Refactoring:**
  - Check circuit breaker prior to capability invocation (fail fast if `OPEN`).
  - Replace naive retry with `WorkflowRetryPolicy` and `WorkflowDlqService`.
  - Automatically route to DLQ upon retry exhaustion or permanent failure.
  - Automatically trigger `WorkflowSagaEngine` if compensation is configured.

### Task 6: Operator DLQ Remediation Server Actions
- **File:** `src/app/actions/workflow-dlq-actions.ts`
- **Actions ('use server'):**
  - `listWorkflowDlqEntriesAction`
  - `getWorkflowDlqEntryDetailsAction`
  - `retryWorkflowDlqStepAction`
  - `skipWorkflowDlqStepAction`
  - `reparameterizeWorkflowDlqStepAction`
  - `discardWorkflowDlqEntryAction`
- **Security Invariants:**
  - Clerk session authentication via `requireAuth()` (Rule 51).
  - Anti-IDOR validation (`caller.orgId === tenant.orgId`, Rules 8 & 47).
  - Emergency dead-man pause evaluation (`checkGovernanceDeadManSwitch`, Rule 60).

### Task 7: Compound Firestore Indexes & Public Export Barrels
- **Files:** `firestore.indexes.json`, `src/platform/workflows/resilience/index.ts`, `src/platform/workflows/index.ts`
- **Indexes:**
  - `workflow_dlq`: `(organizationId ASC, workspaceId ASC, status ASC, quarantinedAt DESC)`
  - `workflow_dlq`: `(organizationId ASC, workflowId ASC, quarantinedAt DESC)`

### Task 8: Verification Gates, Chaos Testing & Vitest Suites
- **Test Suites (`src/platform/__tests__/workflows/`):**
  - `workflow-retry-policy.test.ts` (Classification, backoff math, circuit breaker states).
  - `workflow-dlq-service.test.ts` (Quarantine, sanitization, anti-IDOR, remediation).
  - `workflow-saga-engine.test.ts` (LIFO execution, idempotency, dry-run, failure escalation).
  - `workflow-dlq-actions.test.ts` (Server actions auth, anti-IDOR, dead-man check).
  - `workflow-resilience-integration.test.ts` (End-to-end chaos testing, fault injection, DLQ routing, operator recovery).
- **Gates:**
  - `NODE_OPTIONS='--max-old-space-size=8192' pnpm typecheck` (0 errors).
  - `NODE_OPTIONS='--max-old-space-size=8192' pnpm lint` (0 errors).
  - 100% pass across all 17+ workflow test files and platform regression suites.

---

## 5. The 12-Point Workflow Implementation Gate (Rule 67) Verification Checklist

```
[ ] 1. Protocol & Version Compliance: Targets Next.js 15, Cloud Tasks SDK, and Zod v4.
[ ] 2. Identity & Tenant Isolation: Immutably binds organizationId and workspaceId; Anti-IDOR enforced.
[ ] 3. Scope & Delegation Check: Attenuated scopes verified on retried steps.
[ ] 4. TOCTOU Authority Verification: Live check in Firestore prior to retried step execution (Rule 18).
[ ] 5. Idempotency & Distributed Tracing: Deterministic idempotencyKey and correlation IDs across retries and Sagas (Rule 19 & 20).
[ ] 6. Two-Phase Action Model: High-risk re-parameterized steps verify SHA-256 payloadHash (Rule 21 & 22).
[ ] 7. Resource Ceilings & Budgets: Hard limit of maxRetries = 5, maxBackoffMs = 60s (Rule 23 & 54).
[ ] 8. True Cancellation & Sagas: Compensating Sagas execute in strict reverse order (LIFO) (Rule 26 & 27).
[ ] 9. Context Budgeting & Injection Isolation: DLQ diagnostics sanitized and containerized in <untrusted_reference_data> (Rule 28 & 30).
[ ] 10. Output Validation & Error Sanitization: Tool errors sanitized stripping secrets before persisting to DLQ (Rule 31 & 48).
[ ] 11. Immutability & Audit Trail: Structured domain events emitted to EventBus on all state changes and DLQ events (Rule 40).
[ ] 12. Dead-Man Switch Gate: checkGovernanceDeadManSwitch evaluated at Step 1 of all workers and Server Actions (Rule 60).
```
