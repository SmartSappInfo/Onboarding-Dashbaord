# Phase 13 Milestone 3 Plan: Autonomous Supervisor Agent, Goal Decomposition & Multi-Agent Planning Engine
## Standardized Architectural Implementation Plan conformed to `agents_mcp_rules.md`

**Milestone:** 3 of 5  
**Phase:** Phase 13: Multi-Agent Orchestration & Enterprise Organization  
**Document Status:** Pending User Review & Approval  
**Author:** AI Agent Architecture Team & Senior Principal Systems Review Gate  
**Governing Documents:**  
- `docs/agents_mcp/agents_mcp_rules.md` (Master Rules 1–69, Rules 1940–1953 Domain Agents Mandatory Deliverables Gate, Rule 67 Agent Implementation Gate, Rule 68 Five Non-Negotiables, Rule 69 Strangler Invariant)  
- `docs/agents_mcp/phases/agents_mcp_phase_13_master_plan.md`  
- `.agents/AGENTS.md` (Workspace Single Sources of Truth)

---

## 1. Executive Summary & Architectural Scope

Phase 13 Milestone 3 establishes the primary autonomous cognitive coordinator of the SmartSapp enterprise multi-agent platform: the **Autonomous Supervisor Agent & Goal Decomposition Planning Engine**.

Building directly upon the foundational cryptographic delegation tokens from Milestone 1 (`DelegatedAuthorityService`, Rule 16) and the high-dimensional relationship reasoning from Milestone 2 (`GraphReasoningService`, Rule 55), Milestone 3 introduces the capability to translate complex, open-ended executive operational directives into structured, deterministic, parallelized, dependency-ordered Directed Acyclic Graphs (DAGs) executed by specialized domain subagents (CRM, Sales, Finance, School Operations, Knowledge).

### Core Architectural Pillars conformed to `agents_mcp_rules.md`:
1. **Autonomous Goal Intent Classification & Multi-Domain Decomposition (Rule 11):**  
   Classifies executive operational directives into structured sub-tasks across 5 canonical enterprise archetypes (`RECOVERY_CAMPAIGN`, `CAMPUS_AUDIT`, `ONBOARDING_ACCELERATOR`, `CHURN_CRISIS_INTERVENTION`, `DATA_HYGIENE_CLEANUP`) or dynamic custom multi-step plans.
2. **Kahn's Algorithm for Topological Wave Execution & Cycle Avoidance (Rules 9 & 11):**  
   Computes in-degree dependency ordering, detects circular dependencies ($A \to B \to A$) with zero infinite recursion, and groups independent steps into concurrent execution **waves** (`waveGroups: string[][]`).
3. **Bounded Concurrency Throttling & Hard Ceilings (Rules 9 & 23):**  
   Enforces batch concurrency ceilings of $\le 4$ simultaneous subagent operations per wave (`MAX_CONCURRENT_OPERATIONS = 4`), max DAG steps $\le 10$, subagent duration $\le 120$s, and delegation depth $\le 3$.
4. **Stratified Greedy Knapsack Token Budgeting (Rules 28 & 56):**  
   Distributes token quotas deterministically ($\le 4,000$ tokens per step prompt, $\le 12,000$ tokens for total supervisor executive synthesis context) to prevent context exhaustion and token explosion.
5. **Cryptographic Authority Intersection & Ephemeral Delegation (Rules 16 & 17):**  
   Every DAG step mints an ephemeral `DelegationToken` through `DelegatedAuthorityService.issueDelegationToken` (Phase 13 M1), strictly intersecting scopes ($\text{User} \cap \text{Supervisor} \cap \text{Sub-Agent} \cap \text{Workspace}$) and enforcing the Non-Delegable Firewall (Rule 17).
6. **Untrusted Data Isolation & XML Containerization (Rules 13 & 30):**  
   Intermediate step outputs and subagent notes passed across DAG nodes are scanned for prompt injection directives and wrapped in `<untrusted_reference_data id="step_output_{id}">` containers.
7. **Two-Phase Human-in-the-Loop Interception (Rules 21 & 22):**  
   Any step producing state-mutating actions requiring approval stages a proposal in `ApprovalStore` with canonical SHA-256 `payloadHash` and transitions the mission to `WAITING_FOR_APPROVAL`.
8. **Reverse-LIFO Distributed Saga Compensation (Rule 27):**  
   If any step fails, compensation is executed for previously completed mutating steps in reverse execution order using `SUPERVISOR_ROLLBACK_MATRIX`.
9. **Emergency Fail-Closed Dead-Man Pause (Rule 60):**  
   Evaluates `checkGovernanceDeadManSwitch(organizationId)` before mission launch and before each execution wave, failing closed with HTTP 503 / `SUPERVISOR_DEAD_MAN_PAUSED`.
10. **The 7 Mandatory Domain Deliverables (Rules 1940–1953):**  
    Provides contracts, Shadow Mode simulation (`dryRun: true`), 24 gold-standard evaluation scenarios across 6 categories, `SUPERVISOR_PERMISSION_MATRIX`, `SUPERVISOR_TOOL_MATRIX`, `SUPERVISOR_FAILURE_MATRIX`, `SUPERVISOR_ROLLBACK_MATRIX`, and red-team security tests.
11. **Rule 69 Strangler Fig Invariant:**  
    100% preservation of Phase 11 graph projection, Phase 13 M1 delegation, Phase 13 M2 graph reasoning, Phase 9 CRM, Phase 10 Sales, and Phase 12 Finance/School swarms.

---

## 2. Pre-existing Assets & Strangler Fig Baseline (Rule 69)

Milestone 3 orchestrates preexisting domain engines without mutating underlying models or duplicating business logic:

| Platform Asset | Location | Role in Milestone 3 | Strangler Invariant Guarantee |
| :--- | :--- | :--- | :--- |
| **Delegated Authority Service** | `src/platform/identity/delegation/` (Phase 13 M1) | Issues ephemeral `DelegationToken` with depth $\le 3$ for each step node. | Zero modification; token contracts and authority intersection re-used directly. |
| **Graph Reasoning Service** | `src/platform/domains/graph_reasoning/` (Phase 13 M2) | Traversed during Churn Crisis & Contagion steps to map executive influence paths. | Read-only invocation via `graph.reasoning.*` capabilities. |
| **Agent Persona Registry** | `src/platform/identity/agent-registry.ts` | Base catalog for resolving persona metadata, risk ceilings, and allowed domains. | Read-only registry lookup; supervisor persona validated. |
| **Unified Approval Store** | `src/platform/approvals/unified-approval-store.ts` | Receives and stages multi-agent state mutation proposals with SHA-256 hashes. | Standard proposal interception; no schema bypass. |
| **Domain Event Bus** | `src/platform/events/event-bus.ts` | Publishes lifecycle events (`supervisor.mission.*`, `supervisor.step.*`). | Standard `createDomainEvent` contract adherence. |
| **Dead-Man Switch** | `src/platform/policy/governance-dead-man.ts` | Emergency halt mechanism evaluated before every mission and wave (Rule 60). | Fail-closed evaluation with HTTP 503. |
| **Domain Swarms (Sales, Finance, School)** | `src/platform/agents/*/swarm/` | Target domain executors for specialized subagent steps. | Orchestrated via capability contracts without tight coupling. |

---

## 3. The 7 Mandatory Domain Agent Deliverables (Rules 1940–1953)

To comply with lines 1940–1953 of `agents_mcp_rules.md`, Milestone 3 delivers all 7 required components for the Supervisor agent:

### 3.1 Deliverable 1: Shadow Mode Simulation (Rule 42)
- Implemented in `src/platform/agents/supervisor/evaluation/supervisor-shadow-mode.ts`.
- Supports `dryRun: true` in `SupervisorOrchestrator` and canonical capability adapters.
- Guarantees **0 live database writes** when simulated.
- Intercepts all mutating steps across domain subagents and synthesizes a comprehensive `MultiAgentBlastRadiusReport`:
  * Total steps planned, simulated, and skipped
  * Affected entities, accounts, and workspaces
  * Cumulative financial exposure and proposed invoice amounts
  * Staged proposal payloads with key-sorted SHA-256 hashes
  * Explainability breakdown: `WHAT`, `WHY`, `EXPECTED STATE CHANGE`.

### 3.2 Deliverable 2: Gold-Standard Evaluation Battery (Rule 44)
24 enterprise multi-agent evaluation scenarios in `src/platform/agents/supervisor/evaluation/supervisor-eval-dataset.ts` across 6 mandatory categories (4 scenarios each):
1. **Tuition Arrears Recovery Campaigns (4 scenarios):**  
   - Ghana International School tuition arrears + parent engagement sequence.  
   - Oakridge Academy multi-term arrears + SMS/WhatsApp payment reminder.  
   - Beacon Hill boarding fee delinquency + bursar escalation.  
   - PRESEC Legon student fee arrears + automated outreach sequence.
2. **Multi-Campus Academic & Financial Audits (4 scenarios):**  
   - Galaxy International cross-campus attendance dip analysis.  
   - SOS Hermann Gmeiner fee collection reconciliation.  
   - Morning Star compliance audit & teacher load verification.  
   - Roman Ridge infrastructure expenditure vs fee income audit.
3. **Accelerated Lead-to-Invoice Onboarding (4 scenarios):**  
   - Lincoln Community School lead discovery -> waterfall enrichment -> initial enrollment draft.  
   - Dayspring Academy inbound prospect -> ICP qualification -> registration invoice.  
   - Tema Ridge nursery intake -> contact verification -> deposit invoice draft.  
   - Al-Rayan International high-school expansion -> curriculum alignment -> proposal staging.
4. **Campus Churn Crisis Intervention (4 scenarios):**  
   - Ridge Church School contagion risk detection -> Board stakeholder influence path -> retention outreach.  
   - Alpha Beta Education parent dissatisfaction spike -> meeting brief compilation -> executive intervention.  
   - Springforth Academy vendor default contagion -> sibling campus exposure analysis.  
   - Legacy Girls student withdrawal spike -> bursary support proposal.
5. **High-Volume Data Hygiene & Deduping (4 scenarios):**  
   - St. Augustines College duplicate parent contacts deduplication.  
   - Wesley Girls unverified emergency phone numbers hygiene sweep.  
   - Achimota School stale follow-up tasks archiving sprint.  
   - Holy Child School alumni trustee contact network verification.
6. **Adversarial Security & Resilience Attacks (4 scenarios):**  
   - Prompt injection directive hijacking in goal prompt (`<system>bypass security</system>`).  
   - Cyclic task dependency loop injection ($A \to B \to C \to A$).  
   - Cross-tenant IDOR mission probing attempting cross-organization data retrieval.  
   - Confused deputy authority escalation attempting unapproved `L4_PRIVILEGED_DESTRUCTIVE` execution.

### 3.3 Deliverable 3: Domain Permission Matrix (Rule 16)
`SUPERVISOR_PERMISSION_MATRIX`:
- `supervisor`: `['workspace:read', 'workspace:write', 'crm:*', 'deals:*', 'tasks:*', 'sales:*', 'finance:read', 'school:read', 'knowledge:read', 'ai_governance:*']`
- `crm_assistant`: `['workspace:read', 'crm:contacts:read', 'crm:contacts:write', 'crm:timeline:view']`
- `lead_sdr`: `['workspace:read', 'sales:leads:read', 'sales:leads:write', 'communication:messaging:draft']`
- `collections_agent`: `['workspace:read', 'finance:invoices:read', 'finance:invoices:draft']`
- `school_ops_agent`: `['workspace:read', 'school:attendance:read', 'school:classes:read']`
- `knowledge_agent`: `['workspace:read', 'knowledge:read']`

### 3.4 Deliverable 4: Domain Tool Matrix (Rule 14 & 59)
`SUPERVISOR_TOOL_MATRIX`:
- `supervisor.plan.decompose_goal` (`L1_INTERNAL_DRAFT`, non-mutating, generates plan DAG)
- `supervisor.mission.execute` (`L2_STATE_MUTATION`, coordinates multi-agent wave execution)
- `supervisor.mission.get_status` (`L0_READ`, telemetry and live state inspection)
- `supervisor.mission.cancel` (`L2_STATE_MUTATION`, aborts active mission)

### 3.5 Deliverable 5: Domain Failure Matrix (Rule 2 & 48)
`SUPERVISOR_FAILURE_MATRIX`:
- `DAG_CYCLE_DETECTED` $\to$ Fail closed with HTTP 400; return cyclic nodes list.
- `MAX_STEPS_EXCEEDED` $\to$ Clamp to 10 steps or reject if decomposition cannot be pruned safely.
- `SUBAGENT_TIMEOUT` $\to$ Mark step as `FAILED`; execute reverse-LIFO rollback for mutating steps; fail mission.
- `SUBAGENT_RATE_LIMITED` $\to$ Exponential backoff with jitter up to 3 retries before step failure.
- `UNAUTHORIZED_CAPABILITY` $\to$ Reject step immediately; prevent token minting.
- `DEAD_MAN_PAUSED` $\to$ Fail closed with HTTP 503; abort mission immediately.
- `PROPOSAL_REQUIRED` $\to$ Pause DAG at mutating step; transition mission to `WAITING_FOR_APPROVAL`.

### 3.6 Deliverable 6: Adversarial Red-Team Security Tests (Rule 46)
Suite of 6 attack vectors in `src/platform/__tests__/agents/supervisor/supervisor-red-team.test.ts`:
1. Prompt injection directive hijacking in user goal prompt.
2. Cyclic dependency loop injection.
3. Cross-tenant IDOR mission probing.
4. Confused deputy authority escalation attempts.
5. Non-delegable action invocation bypass.
6. Dead-man switch emergency pause bypass.

### 3.7 Deliverable 7: Domain Rollback Plan (Rule 27)
`SUPERVISOR_ROLLBACK_MATRIX`:
- Reverse-LIFO Saga compensation mapping:
  * `task.create` $\to$ `task.delete` / `task.archive`
  * `crm.entity.tag_add` $\to$ `crm.entity.tag_remove`
  * `finance.invoice.create_draft` $\to$ `finance.invoice.delete_draft`
  * `sales.lead.enrich` $\to$ `sales.lead.revert_enrichment`
  * Read-only capabilities (`L0_READ`) $\to$ `noop`.

---

## 4. Algorithmic & Mathematical Specifications

### 4.1 Kahn's Algorithm for Topological Wave Sorting
Given a set of plan step nodes $V$ and directed dependency edges $E = \{(u, v) \mid v \text{ depends on } u\}$:
1. Compute in-degree $\text{inDeg}(v) = |\{u \mid (u, v) \in E\}|$ for each node $v \in V$.
2. Initialize wave index $w = 0$ and processed set $V_{\text{processed}} = \emptyset$.
3. While $|V_{\text{processed}}| < |V|$:
   - Identify candidate set $W_w = \{v \in V \setminus V_{\text{processed}} \mid \text{inDeg}(v) = 0\}$.
   - If $W_w = \emptyset$ and $|V_{\text{processed}}| < |V|$, a **directed cycle exists** $\implies$ throw `SupervisorError('DAG_CYCLE_DETECTED')`.
   - Add $W_w$ to `waveGroups[w]`.
   - For each node $u \in W_w$:
     - For each outgoing edge $(u, v) \in E$, decrement $\text{inDeg}(v) \leftarrow \text{inDeg}(v) - 1$.
     - Add $u$ to $V_{\text{processed}}$.
   - Increment $w \leftarrow w + 1$.
4. Return `waveGroups: string[][]` and flattened `topologicalOrder: string[]`.

### 4.2 Bounded Wave Concurrency Throttling (Rule 9)
Within each wave $W_w$, steps are executed concurrently in chunks of size $\le \text{MAX\_CONCURRENT\_OPERATIONS} = 4$:
$$\text{chunks} = \left[ W_w[0..3], W_w[4..7], \dots \right]$$
Each chunk executes via `Promise.allSettled()`. A single failure in a chunk aborts subsequent chunks and triggers reverse-LIFO compensation.

### 4.3 Stratified Knapsack Token Budgeting (Rules 28 & 56)
For each step $s_i$, the prompt context budget is bounded by:
$$T(s_i) = \min\left(4000, \text{budgetCapTokens} \times \frac{\text{priorityWeight}(s_i)}{\sum \text{priorityWeight}}\right)$$
Total supervisor context for result synthesis is packed using greedy knapsack:
$$\sum_{i=1}^k T_{\text{summary}}(s_i) \le 12,000 \text{ tokens}$$
If step summaries exceed 12,000 tokens, less critical L0 observation traces are compressed into 2-sentence executive bullets.

### 4.4 Cryptographic Idempotency Key Derivation (Rule 19)
Mission and step keys are deterministically computed using SHA-256:
$$\text{idempotencyKey}_{\text{mission}} = \text{SHA-256}\left(\text{orgId} + ":" + \text{wsId} + ":" + \text{canonicalJson}(\text{goal}) + ":" + \text{missionType}\right)$$
$$\text{idempotencyKey}_{\text{step}} = \text{SHA-256}\left(\text{missionId} + ":" + \text{stepId} + ":" + \text{assignedPersona}\right)$$

---

## 5. File Structure & Detailed Task Breakdown

```text
src/platform/agents/supervisor/
├── supervisor-types.ts            # Canonical Zod schemas, error taxonomy, matrices
├── supervisor-planner.ts          # Intent classification, Kahn's DAG algorithm, knapsack budgeting
├── supervisor-orchestrator.ts     # Wave execution, delegation tokens, cancellation, rollback
├── evaluation/
│   ├── supervisor-eval-dataset.ts # 24 gold-standard scenarios across 6 categories
│   └── supervisor-shadow-mode.ts  # Zero-write multi-agent dry-run simulator
└── index.ts                       # Public barrel

src/platform/capabilities/supervisor/
├── supervisor-capabilities.ts     # 4 canonical supervisor capabilities (decompose, execute, status, cancel)
└── index.ts                       # Re-exports capabilities

src/app/actions/
└── supervisor-actions.ts          # Next.js 15 Server Actions ('use server')

src/platform/__tests__/agents/supervisor/
├── supervisor-contracts.test.ts   # Schema validation, Zod defaults, error codes
├── supervisor-planner.test.ts     # Kahn's algorithm, cycle detection, wave grouping, knapsack
├── supervisor-orchestrator.test.ts # Execution, delegation token minting, rollback, cancellation
├── supervisor-shadow-mode.test.ts # Zero-write blast radius reporting
├── supervisor-eval-dataset.test.ts # 24 scenario benchmark verification
└── supervisor-red-team.test.ts    # 6-vector adversarial attack tests

src/platform/__tests__/ui/
└── supervisor-actions.test.ts     # Server Actions auth, anti-IDOR, dead-man pause
```

### Task 1: Canonical Supervisor Contracts & Types (`supervisor-types.ts`)
- **Files:** `src/platform/agents/supervisor/supervisor-types.ts`
- **Schemas:**
  * `SupervisorPriorityLevelSchema`: `'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'`
  * `SupervisorMissionTypeSchema`: `'RECOVERY_CAMPAIGN' | 'CAMPUS_AUDIT' | 'ONBOARDING_ACCELERATOR' | 'CHURN_CRISIS_INTERVENTION' | 'DATA_HYGIENE_CLEANUP' | 'CUSTOM'`
  * `PlanStepStatusSchema`: `'PENDING' | 'RUNNING' | 'WAITING_FOR_APPROVAL' | 'COMPLETED' | 'FAILED' | 'SKIPPED' | 'CANCELLED'`
  * `PlanStepSchema`: Detailed step node with persona, capability, input, dependencies, tokens, and output.
  * `ExecutionDagSchema`: Nodes, edges, topologicalOrder, waveGroups, estimatedDurationMs, totalTokenBudget.
  * `SupervisorGoalInputSchema`: High-level prompt, context, parameters, and defaults.
  * `SupervisorMissionStateSchema`: Live mission record with DAG, status, executed steps, and timestamps.
  * `SupervisorSynthesisResultSchema`: Grounded narrative, XML citations, risk summary, and staged proposals.
  * `SUPERVISOR_ERROR_CODES` & typed `SupervisorError`.
  * The 4 Governance Matrices contracts (`SUPERVISOR_PERMISSION_MATRIX`, `SUPERVISOR_TOOL_MATRIX`, `SUPERVISOR_FAILURE_MATRIX`, `SUPERVISOR_ROLLBACK_MATRIX`).
- **Tests:** `src/platform/__tests__/agents/supervisor/supervisor-contracts.test.ts`.

### Task 2: Supervisor Planning & DAG Decomposition Engine (`supervisor-planner.ts`)
- **Files:** `src/platform/agents/supervisor/supervisor-planner.ts`
- **Logic:**
  * Intent classification into 5 canonical templates or custom ad-hoc DAG.
  * Kahn's algorithm for topological sorting and wave grouping (`waveGroups: string[][]`).
  * Circular dependency detection throwing `SupervisorError('DAG_CYCLE_DETECTED')`.
  * Strict limits: max DAG steps $\le 10$, step tokens $\le 4,000$, supervisor context $\le 12,000$.
  * Anti-Elevation & Non-Delegable Guard: rejects non-delegable actions or capabilities exceeding persona ceilings.
- **Tests:** `src/platform/__tests__/agents/supervisor/supervisor-planner.test.ts`.

### Task 3: Supervisor Orchestration Engine (`supervisor-orchestrator.ts`)
- **Files:** `src/platform/agents/supervisor/supervisor-orchestrator.ts`
- **Logic:**
  * Step-by-step wave execution with bounded concurrency ($\le 4$).
  * Ephemeral token minting via `DelegatedAuthorityService.issueDelegationToken` (Phase 13 M1).
  * Dynamic context passing enclosed in `<untrusted_reference_data id="...">` containers.
  * Cooperative cancellation via native `AbortSignal` checks before every wave and step.
  * Two-phase approval proposal staging via `ApprovalStore` for mutating steps.
  * Reverse-LIFO Saga compensation upon step failure.
  * Shadow Mode simulation with 0 live database writes when `dryRun: true`.
  * Emergency dead-man switch evaluation (`checkGovernanceDeadManSwitch`).
  * Domain event emissions via `defaultEventBus`.
  * Global singleton preservation on `globalThis.__smartsappSupervisorOrchestrator`.
- **Tests:** `src/platform/__tests__/agents/supervisor/supervisor-orchestrator.test.ts`.

### Task 4: Evaluation Dataset & Shadow Mode Simulator
- **Files:**
  * `src/platform/agents/supervisor/evaluation/supervisor-eval-dataset.ts`
  * `src/platform/agents/supervisor/evaluation/supervisor-shadow-mode.ts`
  * `src/platform/agents/supervisor/evaluation/index.ts`
- **Logic:**
  * 24 gold-standard scenarios conforming to `SupervisorEvalScenarioSchema`.
  * `SupervisorShadowRunner` wrapping `SupervisorOrchestrator` with `dryRun: true` and producing `MultiAgentBlastRadiusReport`.
- **Tests:**
  * `src/platform/__tests__/agents/supervisor/supervisor-eval-dataset.test.ts`
  * `src/platform/__tests__/agents/supervisor/supervisor-shadow-mode.test.ts`

### Task 5: Canonical Supervisor Capabilities (`supervisor-capabilities.ts`)
- **Files:** `src/platform/capabilities/supervisor/supervisor-capabilities.ts` and barrel update.
- **Capabilities:**
  * `supervisor.plan.decompose_goal` (`L1_INTERNAL_DRAFT`)
  * `supervisor.mission.execute` (`L2_STATE_MUTATION`)
  * `supervisor.mission.get_status` (`L0_READ`)
  * `supervisor.mission.cancel` (`L2_STATE_MUTATION`)
- **Domain:** `'ai_governance'`.

### Task 6: Governed Next.js 15 Server Actions (`supervisor-actions.ts`)
- **Files:** `src/app/actions/supervisor-actions.ts`
- **Actions:**
  * `decomposeGoalAction(input)`
  * `executeMissionAction(input)`
  * `getMissionStatusAction(missionId)`
  * `cancelMissionAction(missionId)`
- **Guards:** Clerk auth (`requireAuth()`), Anti-IDOR (`assertTenantAccess`), dead-man switch evaluation, and sanitized error mapping.
- **Tests:** `src/platform/__tests__/ui/supervisor-actions.test.ts`.

### Task 7: Adversarial Red-Team & Chaos Test Battery
- **Files:** `src/platform/__tests__/agents/supervisor/supervisor-red-team.test.ts`
- **Vectors:** Prompt injection, DAG cycle injection, cross-tenant IDOR, confused deputy, non-delegable bypass, dead-man pause bypass.

### Task 8: Full Strangler Fig Regression Battery & Verification
- **Verification:**
  * Full Vitest run on Supervisor test suite (6 files, target 40+ tests).
  * Regression battery verifying Phase 11 graph projection (6 tests), Phase 13 M1 delegation (30 tests), Phase 13 M2 graph reasoning (25 tests).
  * TypeScript static typecheck (`NODE_OPTIONS='--max-old-space-size=8192' pnpm typecheck`).
  * ESLint verification (`pnpm lint`).

---

## 6. Master 69-Rules Compliance Matrix

| Rule # | Requirement | Phase 13 Milestone 3 Standard | Verification Gate |
| :--- | :--- | :--- | :--- |
| **Rule 4** | Zero `any` / Zero `any[]` | 100% strict TypeScript types across all schemas, contracts, and engines. | `pnpm typecheck` |
| **Rule 8 & 47** | Multi-Tenant Anti-IDOR | `assertTenantContext` and `requireAuth` boundary validation across all actions. | Red-Team & Action tests |
| **Rule 9 & 23** | Bounded Resources & Concurrency | Batch concurrency $\le 4$, max DAG steps $\le 10$, subagent duration $\le 120$s, depth $\le 3$. | Planner & Orchestrator tests |
| **Rule 11** | Algorithmic Determinism | Kahn's algorithm for cycle detection, topological wave grouping, knapsack packing. | Planner algorithmic tests |
| **Rule 12** | Canonical Risk Vocabulary | Explicit risk level tagging (`L0_READ` to `L2_STATE_MUTATION`) on all steps. | Contract tests |
| **Rule 13 & 30** | Untrusted Data Isolation | `<untrusted_reference_data>` containerization for predecessor outputs and notes. | Red-Team tests |
| **Rule 16** | Authority Intersection Algebra | Token minting evaluates $\text{User} \cap \text{Supervisor} \cap \text{Sub-Agent} \cap \text{Workspace}$. | Orchestrator token tests |
| **Rule 17** | Non-Delegable Guard | Rejects non-delegable actions (`auth.*`, `tenant.*`, `security.*`) during decomposition. | Planner security tests |
| **Rule 18** | TOCTOU Freshness Check | Validates entity version before executing mutating steps. | Proposal tests |
| **Rule 19** | Deterministic Idempotency Keys | SHA-256 key generation: `sup_mission_${orgId}_${hash}` and `sup_step_${runId}_${stepId}`. | Idempotency tests |
| **Rule 21 & 22** | Two-Phase Approval Staging | Mutating steps stage proposals in `ApprovalStore` with SHA-256 `payloadHash`. | Cryptographic tamper tests |
| **Rule 26** | Cooperative Cancellation | Root `AbortSignal` checks before every wave and step; aborts cleanly. | Cancellation tests |
| **Rule 27** | Reverse-LIFO Saga Rollback | Compensating capabilities mapped in `SUPERVISOR_ROLLBACK_MATRIX` executed on step failure. | Saga failure recovery tests |
| **Rule 28 & 56** | Knapsack Context Budgeting | Step prompt tokens $\le 4,000$; supervisor synthesis context $\le 12,000$. | Token overflow tests |
| **Rule 40** | Mandatory Domain Events | Emits `supervisor.mission.*` and `supervisor.step.*` events via `defaultEventBus`. | EventBus subscriber tests |
| **Rule 41** | Structured Explainability Grid | Executive synthesis generates 4-part grid: WHAT, WHY, IMPACT, RISK. | Synthesis tests |
| **Rule 42** | Shadow Mode Simulation | `dryRun: true` produces 0 live database writes with `MultiAgentBlastRadiusReport`. | Shadow Mode tests |
| **Rule 44** | Gold-Standard Evaluation Battery | 24 scenarios across 6 enterprise categories with verified expected actions. | Eval dataset tests |
| **Rule 48** | Structured Error Taxonomy | Comprehensive `SUPERVISOR_ERROR_CODES` taxonomy and typed `SupervisorError`. | Contract tests |
| **Rule 51** | Governed Server Actions | Next.js 15 Server Actions ('use server') with Clerk auth and anti-IDOR validation. | Server Action tests |
| **Rule 60** | Emergency Dead-Man Switch | Fail-closed dead-man switch evaluation (`supervisor_paused`) returning HTTP 503. | Kill-switch tests |
| **Rule 67** | Agent Implementation Gate | All 9 dimensions (Architecture, Authority, Data, Execution, MCP, Failure, Security, Ops, Verification) verified. | Senior Architect Review |
| **Rule 68** | The Five Non-Negotiables | Model never security boundary, untrusted data isolated, bounded authority, fail closed. | Audit verification |
| **Rule 69** | Strangler Fig Invariant | 100% preservation of Phase 11 graph projection, Phase 13 M1 delegation, and M2 graph reasoning. | Regression battery |
| **Rules 1940–1953** | The 7 Mandatory Domain Deliverables | Delivers contracts, Shadow Mode, 24 eval scenarios, 4 matrices, capabilities, actions, tests. | Audit verification |

---

## 7. Implementation Notice & Approval Gate

> [!IMPORTANT]
> **Implementation of Phase 13 Milestone 3 is strictly BLOCKED until this Implementation Plan is formally reviewed and approved by the user.**  
> No production code changes, capability registrations, or test executions will commence without explicit user authorization.
