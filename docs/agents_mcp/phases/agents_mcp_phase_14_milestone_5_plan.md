# SmartSapp Agentic & MCP Transformation: Phase 14 Milestone 5 Plan
## Execution Inspector Modal, Agent Health Dashboard UI, Red-Team QA & Platform Graduation
### Fully Conforming to `docs/agents_mcp/agents_mcp_rules.md` (Rules 1–69, Rules 1940–1964, Rules 67–69), `docs/agents_mcp/agents_mcp_ui.md` (3598–3630), `theme.md` §8, and `.agents/AGENTS.md`

**Version:** 5.2.0  
**Status:** DRAFT / PENDING USER APPROVAL (Do not start execution until plan is approved)  
**Date:** 2026-10-08  
**Author:** AI Agentic Architecture Team & Principal Systems Architect  

---

## 1. Goal & Milestone Overview

Milestone 5 is the **capstone milestone of Phase 14 ("Agentic Self-Management, Postcondition Verification, Saga Compensation & Health Monitoring")** and establishes the institutional visual operator surfaces, backoffice telemetry cockpits, and comprehensive adversarial red-team verification for SmartSapp's autonomous workforce.

It operationalizes the human-in-the-loop and operator governance surfaces for the **Formal 6-Step Responsible Execution Loop**:
```text
PLAN → PREDICT (Snapshot Pre-State) → EXECUTE → VERIFY (Postconditions & Discrepancies) → COMMIT (Assert Version Unchanged) → LEARN (Self-Healing / Health Telemetry)
```

### 1.1 The Operational Problem

Following Milestones 1 through 4, the platform possesses:
- A mathematical postcondition assertion engine (Milestone 1, Rule 21 & 1959).
- A state-version validation and TOCTOU concurrency guard (Milestone 2, Rules 18 & 1960).
- A universal saga rollback coordinator and DLQ bridge (Milestone 3, Rules 25, 27 & 1961).
- A side-effect discrepancy engine, autonomous self-healing executor, and dynamic circuit breaker (Milestone 4, Rules 24, 41, 42 & 1962).

However, operators and systems administrators face three critical operational challenges:
1. **Execution Invisibility (Rule 41, 61 & `agents_mcp_ui.md` 3598–3612):** When an agent executes a multi-step task, operators have no visual, step-by-step inspector to examine what was planned, what was predicted, what actually mutated, which postconditions passed or failed, what proof chips were collected, and whether self-healing or saga compensations were triggered.
2. **Fleet-Wide Telemetry Void (Rule 24 & `agents_mcp_ui.md` 3616–3630):** Operators lack a centralized, Three-Zone mission control cockpit to monitor the health scorecards ($0 \dots 100$), success rate, failure rate, recovery rate, approval rate, average duration, cost, tool errors, and circuit breaker states (`CLOSED`, `DEGRADED`, `OPEN` [Shadow Mode], `HALF_OPEN`) across all 26 canonical agent personas in real time.
3. **Manual Circuit Breaker Controls & Governance (Rule 17, 60 & 61):** Tripped agents in `SHADOW_MODE` require safe, audited manual circuit reset capabilities with mandatory justification notes ($\ge 5$ characters) restricted exclusively to human operators (`actor.type === 'user'`).

### 1.2 The Solution

Milestone 5 delivers a complete, production-grade visual operator architecture and verification battery:
1. **Execution Verification Inspector (`ExecutionInspectorModal.tsx`)**: Standardized modal adhering strictly to `theme.md` §8 with a 6-Zone Stepper matching `agents_mcp_ui.md` line for line (`Plan`, `Actions`, `Expected Result` [PREDICT], `Actual Result` [EXECUTE], `Verification` [VERIFY], `Exceptions / Compensation`), live proof chips, `<untrusted_reference_data>` XML containers, and 4-part explainability grids (Rule 41).
2. **Three-Zone Agent Health Operations Cockpit (`/admin/intelligence/health` & `AgentHealthClient.tsx`)**: Zone 1 Fleet-Wide Executive KPIs, Zone 2 Filter & Status Tabs with debounced search, Zone 3 Agent Health Grid.
3. **Audited Manual Circuit Breaker Reset Modal (`CircuitResetModal.tsx`)**: Standardized modal adhering to `theme.md` §8 with mandatory $\ge 5$-character justification input and non-delegable human operator protection (Rule 17).
4. **Strangler Fig Navigation Integration (`AdminSidebar.tsx`)**: Mounts `Agent Health` under `INTELLIGENCE` with `Activity` icon, preserving 100% of all 52 pre-existing routes and accordion behaviors (Rule 69).
5. **6-Vector Adversarial Security Red-Team Test Battery (`verification-red-team.test.ts`)**: Exhaustive red-team battery probing postcondition assertion bypasses, TOCTOU version race attacks, saga cascade failures, prompt injection in discrepancy payloads, unauthorized circuit resets, and dead-man pause mechanics.
6. **Platform Graduation & Verification**: 100% passing tests, clean TypeScript compilation, and zero ESLint errors.

---

## 2. Exhaustive Rules Alignment with `docs/agents_mcp/agents_mcp_rules.md`

### 2.1 The Master Rules (Rules 1–69)

- **Rule 1 (Modern Web Guidance & Skills):** Server Actions ('use server') and React components adhere to Next.js 15 standards, Vercel React best practices, and Emil Kowalski animation principles (`active:scale-[0.97]`).
- **Rule 2 (FMEA Failure Analysis):** Section 5 details an exhaustive FMEA matrix covering modal state desynchronization, SSE stream reconnection, circuit reset double-spend races, and DOM freeze prevention.
- **Rule 3 & Rule 61 (Backoffice Governance Impact):** Backoffice operators can inspect agent health scorecards, audit discrepancy reports, and reset tripped circuit breakers with mandatory justifications without requiring code deployments.
- **Rule 4 (Strict Typing Protocol):** Zero `any` or `any[]` across all contracts, props, state hooks, and test files. Bounded Zod v4 schemas (`ExecutionInspectorDataSchema`, `AgentHealthFilterStateSchema`).
- **Rule 5 (Staged Deployment & Verification):** Staged execution verifying UI models and components prior to route registration.
- **Rule 7 (Mobile-First & Tactile Feedback):** Minimum 44px touch targets (`min-h-[44px]`), responsive layouts, everyday UI English, and tactile button scaling (`active:scale-[0.97]`).
- **Rule 8 & 47 (Anti-IDOR Multi-Tenant Lock):** UI components and Server Actions enforce multi-tenant scoping by `organizationId` and `workspaceId`.
- **Rule 9 & Rule 23 (Bounded Concurrency & Resource Ceilings):** Clamps visual lists to $\le 100$ items and prevents UI memory leaks.
- **Rule 10 (Inline Architectural Documentation):** Comprehensive explanatory docstrings in all new files explaining design decisions, invariants, and cautionary areas.
- **Rule 11 (Mathematical Determinism):** Displays mathematically rounded health scores ($0 \dots 100$) and cent-level financial invariants (`roundCurrency`).
- **Rule 12 (Risk Vocabulary):** Visually reflects formal risk levels (`L0_READ`, `L1_INTERNAL_DRAFT`, `L2_STATE_MUTATION`, `L3_EXTERNAL_COMMUNICATION`, `L4_PRIVILEGED_DESTRUCTIVE`).
- **Rule 13 & 30 (Untrusted Data Isolation & Injection Defense):** All external outputs, raw payloads, and untrusted assertions are safely isolated inside `<untrusted_reference_data id="...">` containers.
- **Rule 14 (Schema Fingerprinting & Contracts):** Canonical Zod v4 schemas define UI contracts (`ExecutionInspectorDataSchema`).
- **Rule 16 (Explicit Scoped RBAC):** Inspecting and resetting agents requires explicit permissions (`can('operations', 'intelligence', 'view')` or `isSystemAdmin`).
- **Rule 17 (Non-Delegable Restrictions & Deciders):** Manual circuit breaker resets are strictly non-delegable (`actor.type === 'user'`). AI subagents cannot reset circuit breakers.
- **Rule 18 (TOCTOU Optimistic Concurrency Guard):** Inspector visualizes expected vs actual state versions and flags TOCTOU drift.
- **Rule 19 (Deterministic Idempotency):** Reset actions require idempotency keys to prevent duplicate execution.
- **Rule 20 (Replay Protection):** Prevents duplicate reset requests or replay attacks via state-version validation.
- **Rule 21 (Two-Phase Execution):** Visualizes the formal 6-step loop: Plan → Predict → Execute → Verify → Commit → Learn.
- **Rule 22 (Cryptographic SHA-256 Binding):** Displays state and payload SHA-256 hashes for cryptographic tamper verification.
- **Rule 24 (Dynamic Circuit Breakers):** Visualizes circuit states (`CLOSED`, `DEGRADED`, `OPEN` [Shadow Mode], `HALF_OPEN`) with distinct color indicators.
- **Rule 25 (Dead-Letter Queue DLQ):** Highlights DLQ-enqueued steps during uncompensable failures.
- **Rule 26 (Cooperative Cancellation):** Displays cancellation status (`CANCELLED`) when `AbortSignal` is triggered.
- **Rule 27 (Formal Saga / Reverse-LIFO Rollback):** Visualizes reverse-LIFO rollback steps ($S_k \dots S_1$) in the execution inspector.
- **Rule 28 & 56 (Knapsack Context Budgeting):** Displays token consumption and knapsack budget allocation for executions.
- **Rule 31, 32, 33 (Data Minimization & Sensitive Data Isolation):** Scrubs PII and credentials (`[REDACTED_SECRET:<type>]`) in inspector payloads.
- **Rule 40 (Domain Event Auditing):** Subscribes to real-time events (`verification.*`, `agent.health.*`, `health.*`) via `defaultEventBus`.
- **Rule 41 (Explainability Grid):** 4-part explainability grid (WHAT / WHY / EXPECTED STATE CHANGE / CONFIDENCE) embedded in the inspector.
- **Rule 42 (Shadow Mode & Dynamic Degradation):** Tripped agents display the amber "Shadow Mode (0 Live Mutations)" safety badge.
- **Rule 46 (Adversarial Agent Red-Team Battery):** Dedicated 6-vector adversarial red-team test suite (`verification-red-team.test.ts`).
- **Rule 47 (Never Trust the Model):** All verification proofs and health scores rendered in UI are deterministic system outputs.
- **Rule 48 (Sanitized Error Taxonomy):** UI error messages route through sanitized `VERIFICATION_UI_ERROR_CODES`.
- **Rule 50 (Cache & State Isolation):** Telemetry records strictly partitioned by `${organizationId}:${workspaceId}:${personaId}`.
- **Rule 51 (Server Actions Security):** Server Actions enforce Clerk session auth (`requireAuth()`), Anti-IDOR validation, and dead-man pause evaluation (Rule 60).
- **Rule 52 (Client/Server Boundary):** Clean separation of Server Component route (`page.tsx`) and Client Component cockpit (`AgentHealthClient.tsx`).
- **Rule 55 (Canvas & UI Resource Limits):** Clamps list views and graphs to bounded maximums ($\le 100$ entries).
- **Rule 60 (Emergency Dead-Man Switch Evaluation):** Evaluates `checkGovernanceDeadManSwitch` failing closed with HTTP 503 `HEALTH_DEAD_MAN_PAUSED`.
- **Rule 61 (Three-Zone Enterprise Mission Control Cockpit):** Zone 1 Executive KPIs, Zone 2 Filter & Status Tabs, Zone 3 Agent Grid.
- **Rule 62 (Real-Time SSE Reactivity):** Subscribes to SSE stream via `useEventStream` for live scorecard and circuit state updates.
- **Rule 64 (Three-Level Feature Flags):** Gated by `FF_AGENT_VERIFICATION` where applicable.
- **Rule 67 (The Agent Implementation Gate):** Fulfills all 5 gate dimensions (Architecture, Authority, Data, Execution, MCP).
- **Rule 68 (The Five Non-Negotiables):** Zero `any`, fail-closed security, model never boundary, bounded resources, kill switches.
- **Rule 69 (Strangler Fig Invariant):** Preserves all 52 pre-existing Admin routes and accordion states in `AdminSidebar.tsx`.
- **Rules 1940–1953 (Domain Agents Mandatory Deliverables Gate):** Verifies all domain agent governance matrices and shadow runners.
- **Rules 1954–1964 (Phase 14 Verification Architecture):** Full operationalization of postconditions, state-version, saga compensation, and self-healing.

---

### 2.2 `theme.md` §8 (Standardized Modal & Dialog System Architecture)

- **Surface & Geometry:** Must bind strictly to `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`. Hardcoded dark/slate colors (`bg-slate-900`, `bg-slate-950`, `border-slate-800`) and excessive roundness (`rounded-3xl`, `rounded-[2rem]`) are strictly prohibited.
- **Demarcated Header:** Use `<DialogHeader demarcated>` (`min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20 px-6 py-3.5 sm:py-4`).
- **Zero Raw Descriptions:** Descriptions must not be rendered as plain text under the title. All guidance must route through `<CardInfoTooltip text="..." />` alongside the title, with `<DialogDescription className="sr-only">` for screen readers.
- **Single-Circle Info Tooltip:** The info tooltip button must render with a single circle (no outer button ring or border) and overlay above dialogs at `z-[10050]`.
- **Demarcated Footer:** Use `px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5` with tactile buttons (`rounded-xl active:scale-[0.97] min-h-[44px]`).

---

### 2.3 `docs/agents_mcp/agents_mcp_ui.md` Specification (Lines 3598–3630)

- **Execution Inspector Zones (3604–3611):**
  1. `Plan`
  2. `Actions`
  3. `Expected Result` (PREDICT)
  4. `Actual Result` (EXECUTE)
  5. `Verification` (VERIFY)
  6. `Exception / Compensation`
- **Agent Health Metrics Grid (3616–3630):**
  - Success Rate (%)
  - Failure Rate (%)
  - Recovery Rate (%)
  - Approval Rate (%)
  - Average Duration (ms/s)
  - Cost (USD)
  - Tool Errors Count
  - Circuit Breaker State & Health Score

---

### 2.4 `.agents/AGENTS.md` Workspace Rules

- **Fields & Variables Single Source of Truth:** Route all variable replacement through `FieldsVariablesService.resolveTemplateVariables`. Zero custom regex.
- **Tag Selection & Input Single Source of Truth:** Route all tag interactions through `<TagSelector>` in client/draft mode (`currentTagIds`, `onTagsChange`).
- **Actionable Error & Toast Navigation:** Pass `actionConfig: { path, label }` with relative paths (`/admin/intelligence/health`) to all toasts.
- **Next.js 15 Async APIs (`AGENTS.md`):** Handle Next.js 15 async `searchParams` and `params` properly in Server Components:
  ```typescript
  export default async function Page(props: {
    params: Promise<{ id?: string }>;
    searchParams: Promise<{ track?: string }>;
  })
  ```

---

## 3. High-Level Architecture & Component Topology

```text
src/app/admin/intelligence/health/
├── page.tsx                             (Server Component: Next.js 15 async searchParams, SEO, Suspense)
└── AgentHealthClient.tsx                (Client Component: Three-Zone Cockpit, SSE reactivity)
       │
       ├── Zone 1: AgentHealthKPIHeader.tsx (Fleet Health, Active Agents, Tripped Circuits, Success Rate)
       ├── Zone 2: Filter Tabs & Debounced Search (All, Healthy, Degraded, Tripped, Shadow Mode)
       └── Zone 3: AgentHealthTable.tsx   (All 26 Personas, Health Score, Circuit State, Actions)
              │
              ├── [Inspect] ──> ExecutionInspectorModal.tsx (theme.md §8: 6-Zone Stepper, Proofs)
              └── [Reset]   ──> CircuitResetModal.tsx       (theme.md §8: Human-only, >= 5 chars justification)
```

---

## 4. The 4 Mandatory Governance Matrices for Milestone 5

### 4.1 UI & Telemetry Permission Matrix (Rule 16)
| Persona / Principal | `health:view` | `health:reset` | `verification:inspect` |
| :--- | :---: | :---: | :---: |
| `autonomous_subagent` | FORBIDDEN | **FORBIDDEN (Rule 17)** | FORBIDDEN |
| `supervisor_agent` | ALLOWED | **FORBIDDEN (Rule 17)** | ALLOWED |
| `authenticated_user` | ALLOWED | FORBIDDEN | ALLOWED |
| `system_admin / operator` | ALLOWED | **ALLOWED (Audited $\ge 5$ chars)** | ALLOWED |

### 4.2 UI Tool Matrix (Rules 12 & 14)
| Tool / Capability | Risk Classification | Requires Expected Version | Audit Required | Idempotent | Non-Delegable |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `health.get_scorecard` | `L0_READ` | No | Yes | Yes | No |
| `health.list_scorecards` | `L0_READ` | No | Yes | Yes | No |
| `health.reset_circuit_breaker` | `L2_STATE_MUTATION` | Yes | **Yes (Rule 61)** | Yes | **Yes (Rule 17)** |
| `verification.get_execution` | `L0_READ` | No | Yes | Yes | No |

### 4.3 UI Failure Matrix (Rules 2 & 48)
| Error Code | HTTP Status | Root Cause | Deterministic Recovery Strategy |
| :--- | :---: | :--- | :--- |
| `VERIFICATION_UI_NOT_FOUND` | 404 | Execution record does not exist | `DISPLAY_EMPTY_STATE` (Prompt user with empty execution view) |
| `HEALTH_UNAUTHORIZED_RESET` | 403 | Non-human or unauthorized caller attempted reset | `FAIL_CLOSED` (Render error toast, block reset) |
| `HEALTH_INVALID_JUSTIFICATION` | 400 | Justification text < 5 characters | `INLINE_FORM_VALIDATION` (Display helper text, keep modal open) |
| `HEALTH_DEAD_MAN_PAUSED` | 503 | Emergency dead-man switch engaged | `DISPLAY_HALT_BANNER` (Disable reset actions, show amber banner) |
| `SSE_STREAM_DISCONNECTED` | 500 | EventSource connection dropped | `EXPONENTIAL_RECONNECT` (Fallback to manual refresh button) |

### 4.4 UI Rollback Matrix (Rule 27)
| Mutating UI Action | Compensating Rollback Action | Automatic or Manual? |
| :--- | :--- | :---: |
| `resetCircuitBreakerAction` | None (trips back automatically to `OPEN` on next SLA failure) | Automatic (Dynamic Breaker) |
| `resubmitDlqAction` | Quarantine back to DLQ on failure | Automatic |

---

## 5. Detailed Tasks & Implementation Plan

### Task 1: Canonical Verification UI Contracts & Error Taxonomy
- **Files to Create/Update:**
  - `src/platform/verification/ui/verification-ui-types.ts` (create)
  - `src/platform/verification/ui/index.ts` (create)
  - `src/platform/verification/index.ts` (update re-exports)
- **Deliverables:**
  - `ExecutionInspectorDataSchema` and `ExecutionInspectorData`:
    - `executionId: string`
    - `runId?: string`
    - `personaId: string`
    - `capabilityId: string`
    - `status: 'PASS' | 'FAIL' | 'DEGRADED' | 'SHADOW_MODE'`
    - `plan`: `{ goal: string; rationale: string; persona: string; riskLevel: RiskLevel; budgetTokens: number }`
    - `actions`: `Array<{ stepId: string; capabilityId: string; input: Record<string, unknown>; executedAt: string; status: 'SUCCESS' | 'FAILED' | 'COMPENSATED' }>`
    - `predict`: `{ predictedStateChange: Record<string, unknown>; expectedVersion?: number; stateHash?: string; blastRadius: Record<string, unknown> }`
    - `execute`: `{ output: Record<string, unknown>; durationMs: number; tokensUsed: number; liveWritesCount: number }`
    - `verify`: `{ result: VerificationResult; versionResult?: VersionValidationResult; discrepancyReport?: DiscrepancyReport }`
    - `compensate`: `{ required: boolean; executed: boolean; status?: 'PENDING' | 'SUCCESS' | 'FAILED' | 'SKIPPED'; compensatingSteps: Array<{ stepId: string; capabilityId: string; status: string }>; dlqEnqueued?: boolean; error?: string }`
  - Stepper step enum: `'PLAN' | 'ACTIONS' | 'PREDICT' | 'EXECUTE' | 'VERIFY' | 'COMPENSATE'`
  - `AgentHealthFilterState`: status filter (`ALL`, `HEALTHY`, `DEGRADED`, `TRIPPED`, `SHADOW_MODE`), domain filter (`ALL`, `CRM`, `SALES`, `MEETINGS`, `KNOWLEDGE`, `FINANCE`, `SCHOOL`, `SUPERVISOR`), search query.
  - Error taxonomy `VERIFICATION_UI_ERROR_CODES` and typed `VerificationUiError` class with HTTP status mapping.
  - Zero `any` or `any[]` (Rule 4).

### Task 2: Execution Verification Inspector Modal (`ExecutionInspectorModal.tsx`)
- **File to Create:** `src/components/verification/ExecutionInspectorModal.tsx`
- **Deliverables:**
  - Strict compliance with `theme.md` §8 Standardized Modal Architecture:
    - Surface: `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`
    - Demarcated Header: `<DialogHeader demarcated>` with min-h-[52px]/[56px], border-b, bg-muted/20
    - Single-circle info tooltip: `<CardInfoTooltip text="..." />` at `z-[10050]`
    - Zero raw descriptions: `<DialogDescription className="sr-only">`
    - Demarcated footer: `px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5` with tactile buttons (`rounded-xl active:scale-[0.97] min-h-[44px]`).
  - 6-Zone Interactive Stepper (conforming to `docs/agents_mcp/agents_mcp_ui.md` 3604–3611):
    1. **Plan:** Target Persona, High-level Goal, Risk Tier Badge (`L0_READ` to `L4_PRIVILEGED_DESTRUCTIVE`), Token Budget.
    2. **Actions:** Sequence of capability calls with timestamps, inputs, and execution statuses.
    3. **Expected Result (PREDICT):** Predicted state changes, expected state version, and blast radius report.
    4. **Actual Result (EXECUTE):** Actual execution output, execution duration (ms), token consumption, and live database writes counter.
    5. **Verification (VERIFY):** Postcondition assertion checklist with interactive proof chips, severity badges (`CRITICAL`, `WARNING`), and `<untrusted_reference_data id="...">` containers.
    6. **Exceptions / Compensation:** Discrepancy variance classification, self-healing attempt details, or Reverse-LIFO Saga rollback execution tree.
  - Interactive proof chip toggles, XML untrusted data containers, and explainability grid (WHAT / WHY / EXPECTED vs ACTUAL).

### Task 3: Manual Circuit Breaker Reset Modal (`CircuitResetModal.tsx`)
- **File to Create:** `src/components/verification/CircuitResetModal.tsx`
- **Deliverables:**
  - Strict compliance with `theme.md` §8 Standardized Modal Architecture.
  - Demarcated header with single-circle info tooltip at `z-[10050]`.
  - Persona diagnostic summary: current circuit state (`OPEN`), failure rate %, consecutive failures, degradation mode (`SHADOW_MODE`).
  - Operator justification input textarea requiring $\ge 5$ characters with live character counter (Rule 61).
  - Non-delegable human operator protection (`actor.type === 'user'`) (Rule 17).
  - Tactile [Cancel] and [Reset Circuit Breaker] buttons (`rounded-xl active:scale-[0.97] min-h-[44px]`) executing `resetCircuitBreakerAction`.
  - Actionable toast notifications upon success or error with `actionConfig: { path: '/admin/intelligence/health', label: 'View Health Cockpit' }`.

### Task 4: Executive KPI Header & Agent Health Table
- **Files to Create:**
  - `src/components/verification/AgentHealthKPIHeader.tsx`
  - `src/components/verification/AgentHealthTable.tsx`
  - `src/components/verification/index.ts`
- **Deliverables:**
  - `AgentHealthKPIHeader.tsx`:
    - 5 Zone 1 KPI cards:
      1. Fleet Health Score (fleet-wide average, color-banded: $\ge 80$ Green, $60-79$ Amber, $<60$ Red).
      2. Active Agent Fleet (healthy vs degraded count).
      3. Tripped Circuit Breakers (`OPEN` count in Shadow Mode).
      4. Verification Success Rate (fleet average percentage).
      5. 24h Discrepancies Healed (autonomous recoveries count).
    - Single-circle info tooltips on every card.
  - `AgentHealthTable.tsx`:
    - Data grid containing all 26 canonical agent personas (`AGENT_PERSONA_IDS`).
    - Domain grouping: CRM, Sales, Meetings, Knowledge, Finance, School Ops, Supervisor.
    - Columns: Persona Name, Domain, Health Score Badge (0–100), Circuit State (`CLOSED`, `DEGRADED`, `OPEN`, `HALF_OPEN`), SLA Thresholds, Success Rate %, Recovery Rate %, Average Duration, Cost, Tool Errors, Actions.
    - Tactile action triggers: [Inspect] opening `ExecutionInspectorModal` and [Reset] opening `CircuitResetModal`.

### Task 5: Three-Zone Operations Cockpit & Strangler Fig Navigation
- **Files to Create/Update:**
  - `src/app/admin/intelligence/health/page.tsx` (create)
  - `src/app/admin/intelligence/health/AgentHealthClient.tsx` (create)
  - `src/app/admin/components/AdminSidebar.tsx` (update)
- **Deliverables:**
  - `page.tsx`: Server Component with SEO metadata (`Agent Health & Verification Cockpit | SmartSapp`) and Suspense boundary. Correctly handles Next.js 15 async `searchParams`.
  - `AgentHealthClient.tsx`:
    - Zone 1: Executive KPI Header (`AgentHealthKPIHeader`).
    - Zone 2: Search (debounced 300ms) + Filter tabs (`ALL`, `HEALTHY`, `DEGRADED`, `TRIPPED`, `SHADOW_MODE`) + Domain chips.
    - Zone 3: Agent Health Grid (`AgentHealthTable`).
    - Real-time SSE streaming reactivity via `useEventStream` subscribing to `verification.*`, `agent.health.*`, and `health.*` domain events (Rule 62).
    - Actionable toast navigation with relative paths (`actionConfig: { path, label }`).
  - `AdminSidebar.tsx`:
    - Mounts `Agent Health` (`/admin/intelligence/health`) with Lucide `Activity` icon under `INTELLIGENCE`.
    - Preserves 100% of all 52 pre-existing routes, role permissions (`can('operations', 'intelligence', 'view') || isSystemAdmin`), and accordion behaviors (Rule 69).

### Task 6: 6-Vector Adversarial Security Red-Team Test Battery
- **File to Create:** `src/platform/__tests__/verification/verification-red-team.test.ts`
- **Deliverables:**
  - 6 dedicated attack vectors evaluating the end-to-end verification and UI governance subsystem:
    1. **Vector 1: Postcondition Assertion Bypass Attempt:** Adversary supplies forged post-state claiming invariant `PASS`; engine asserts real database record and rejects with `ASSERTION_FAILED`.
    2. **Vector 2: Stale Read & TOCTOU Version Race Attack:** Concurrent worker mutates record during execution window; state-version service detects `STALE_VERSION_DETECTED` and aborts mutation.
    3. **Vector 3: Saga Compensation Cascade Failure & DLQ Quarantine:** A step in a reverse-LIFO rollback fails; engine captures failure, preserves execution ledger, and safely quarantines the incident into `WorkflowDlqService` without crashing.
    4. **Vector 4: Discrepancy Injection & Fake-Clean Report Attack:** Untrusted delta payload containing prompt injection directives (`IGNORE ALL RULES...`) is neutralized and isolated inside `<untrusted_reference_data>` XML container.
    5. **Vector 5: Health Telemetry Tampering & Unauthorized Circuit Reset Attack:** AI subagent or unauthenticated caller attempts to call `resetCircuitBreakerAction`; request is rejected with HTTP 403 `HEALTH_UNAUTHORIZED_RESET` (Rule 17).
    6. **Vector 6: Emergency Dead-Man Switch Evaluation:** Engaging emergency dead-man pause causes all verification, discrepancy, and health actions to fail closed immediately with HTTP 503 `HEALTH_DEAD_MAN_PAUSED` (Rule 60).

### Task 7: End-to-End Verification, Static Analysis & Platform Graduation
- **Deliverables:**
  - Run full platform test verification suite (100% pass rate).
  - Run full TypeScript compilation (`pnpm typecheck`): 0 errors.
  - Run ESLint static analysis (`pnpm lint`): 0 errors, warnings $\le 720$.
  - Author Phase 14 Milestone 5 Completion Report: `docs/agents_mcp/phases/agents_mcp_phase_14_milestone_5_completion_report.md`.
  - Conduct Phase 14 Comprehensive Architectural Code Review with Senior Principal Systems & AI Agentic Architecture Reviewer subagent (`docs/agents_mcp/phases/agents_mcp_phase_14_milestone_5_code_review.md`).

---

## 6. The Rule 67 Agent Implementation Gate Checklists

Every milestone in Phase 14 must satisfy the ten Rule 67 dimensions before completion:

```text
ARCHITECTURE
□ What canonical capability does this use? (health.get_scorecard, health.list_scorecards, health.reset_circuit_breaker, verification.assert_postconditions)
□ Is this duplicating an existing service? (No; extends CapabilityRegistry, EventBus, DLQService, and AgentHealthService)
□ What is the source of truth? (Firestore records + immutable audit ledger)
□ What events are emitted? (verification.*, saga.*, health.* via defaultEventBus)

AUTHORITY
□ Who is allowed to use it? (Clerk session auth via requireAuth(); read open to authenticated operators/supervisors; reset restricted to human operators)
□ What may the agent do? (Assert postconditions, evaluate state versions, simulate self-healing)
□ What may the agent never do? (Reset circuit breakers or declare itself "healthy" - Rule 17)
□ Can a sub-agent inherit this authority? (No; reset capability is non-delegable)

DATA
□ What data enters the agent? (Pre- and post-mutation resource snapshots, telemetry events)
□ What data leaves the system? (Sanitized verification reports, health metrics)
□ What is trusted? (Internal database state, cryptographic SHA-256 hashes)
□ What is untrusted? (External API responses, user inputs, provider status strings, prompt injections)
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
□ What capabilities? (health.get_scorecard, health.list_scorecards, health.reset_circuit_breaker)
□ What annotations? (Risk level annotations, audit required)
□ What server identity? (Stateless HTTP streamable transport)
□ What schema version? (Zod v4 canonical contracts)
□ What happens if tool definition changes? (SHA-256 fingerprint drift detection - Rule 14)

FAILURE
□ Timeout? (Bounded: modal data fetching <= 3s, action calls <= 5s)
□ 429? (Graceful backoff in SSE reconnect and action retry)
□ 500? (Sanitized error boundary in React and structured error return in Server Actions)
□ Partial execution? (Recorded as error event, increments failure counter, updates health score)
□ Provider unavailable? (Circuit breaker trips to OPEN, persona degraded to SHADOW_MODE)
□ Stale approval? (Rejected with STALE_APPROVAL / 409)
□ Concurrent modification? (Optimistic locking check; fail-closed with 409)

SECURITY
□ Prompt injection? (All external context scanned for ADVERSARIAL_DIRECTIVE_PATTERNS and isolated in <untrusted_reference_data>)
□ Tool poisoning? (Canonical schema hashes verify tool integrity)
□ Confused deputy? (Multi-tenant partition assertion assertTenantAccess prevents cross-tenant access)
□ SSRF? (No arbitrary URL fetching during self-healing or modal inspection)
□ Exfiltration? (Telemetry payloads stripped of secrets before storage or event emission)
□ Privilege escalation? (Circuit reset strictly enforces actor.type === 'user')
□ Cross-tenant leakage? (Partitioned by organizationId:workspaceId)

OPERATIONS
□ Can Backoffice disable it? (Yes; via platform dead-man kill switch - Rule 60)
□ Can Backoffice inspect it? (Yes; health scorecards and discrepancy reports exposed via Server Actions)
□ Can Backoffice replay it? (Yes; self-healing routines re-executable idempotently)
□ Can Backoffice rollback it? (Yes; via SagaCompensationService - Rule 27)
□ Can Backoffice change policy without code? (Yes; AGENT_HEALTH_POLICY_MATRIX thresholds configurable via backoffice policy store)

TESTING
□ Unit: Full coverage of modal state, stepper progression, and table rendering
□ Integration: EventBus subscription, SSE stream parsing, and action execution
□ Contract: Zod v4 schemas validation and strict typing
□ Security: Anti-IDOR cross-tenant injection and subagent reset bypass
□ Adversarial: 6-vector red-team test suite
□ Load: 100-event telemetry burst processing under bounded memory
□ Chaos: AbortSignal cancellation mid-evaluation and mid-healing

MIGRATION
□ Existing behavior preserved? (Yes; 100% backward compatible with existing personas)
□ Existing routes preserved? (Yes; 100% preservation of all 52 pre-existing routes in AdminSidebar)
□ Existing data preserved? (Yes; read-only telemetry overlay, zero destructive table migrations)
□ Backfill needed? (No; telemetry records dynamically on fresh executions)
□ Restore procedure documented? (Yes; manual circuit reset runbook)
□ Rollback documented? (Yes; feature flag / kill switch disabling telemetry hooks)
```

---

## 7. FMEA Failure Mode & Effects Analysis (Rule 2)

| Potential Failure Mode | Root Cause | Severity | Mitigating Architectural Mechanism |
| :--- | :--- | :---: | :--- |
| **Modal State Desynchronization** | Real-time SSE updates arrive while modal is open with stale data | Low | Modal local state isolates initial snapshot; [Refresh] button syncs latest data |
| **Circuit Reset Double-Spend** | Multiple operators attempt simultaneous reset of the same tripped persona | Medium | Optimistic locking on circuit state (`expectedState: 'OPEN'`); second reset safely rejected |
| **SSE Stream Dropped** | Network hiccup or idle timeout terminates EventSource connection | Low | `useEventStream` auto-reconnects with exponential backoff and jitter |
| **Large Payload Rendering Freeze** | Execution inspector attempts to render 10,000-line JSON payload | High | Payloads clamped to token ceilings ($\le 4,000$ tokens); collapsible JSON tree view |
| **Unauthorized Subagent Reset Attempt** | Compromised subagent attempts calling `resetCircuitBreakerAction` | Critical | Programmatic enforcement: `actor.type === 'user'`; non-delegable firewall (Rule 17) |
| **Cross-Tenant Telemetry Leakage** | Malicious client requests another tenant's agent health metrics | Critical | Anti-IDOR assertion `assertTenantAccess` fails closed with HTTP 403 `IDOR_VIOLATION` |

---

## 8. Master Rules Compliance Matrix (Rules 1–69 & 1954–1964)

| Rule | Title | Mandate in Milestone 5 | Verification Mechanism |
| :--- | :--- | :--- | :--- |
| **Rule 1** | Modern Web Guidance & Skills | Next.js 15 Server/Client boundaries, Emil Kowalski tactile scaling. | UI code inspection & animation tests |
| **Rule 2** | Risk Analysis & Scalability | Complete FMEA analysis covering 6 failure modes and mitigations. | Section 7 FMEA Table & Unit Tests |
| **Rule 3** | Backoffice Controls | Centralized health dashboard and audited manual circuit resets. | Action & UI Component tests |
| **Rule 4** | Strict Typing Policy | Zero `any` or `any[]` across all UI contracts and test files. | `pnpm typecheck` & AST inspection |
| **Rule 5** | Staged Deployments | Progressive staging of UI components, modals, and navigation routes. | Staging checklist |
| **Rule 7** | Mobile-First & Clear English | Minimum 44px touch targets (`min-h-[44px]`), responsive layout, clear UI English. | Viewport & touch target audits |
| **Rule 8** | Tenant Isolation | All health metrics, scorecards, and reset actions tenant-scoped. | `assertTenantAccess` & IDOR Red-Team |
| **Rule 9** | High Load & Resource Governance | Clamps data grid lists to $\le 100$ items; avoids DOM freeze. | Resource bounding tests |
| **Rule 10** | Inline Architectural Docs | Explanatory comments across all files explaining invariants and cautions. | Code comments audit |
| **Rule 11** | Mathematical Determinism | Displays integer-rounded health scores ($0 \dots 100$) and cent-level math. | Unit tests |
| **Rule 12** | Risk Vocabulary | Displays risk badges (`L0_READ` to `L4_PRIVILEGED_DESTRUCTIVE`) in inspector. | Component rendering tests |
| **Rule 13** | Untrusted Data Isolation | Wraps all payload deltas and external memos in `<untrusted_reference_data>`. | Sanitization tests |
| **Rule 14** | Schema Fingerprinting | UI models and contracts defined via canonical Zod v4 schemas. | Schema test suite |
| **Rule 16** | Explicit RBAC Scopes | Inspecting and resetting agents requires `operations:intelligence:view`. | Permission check tests |
| **Rule 17** | Non-Delegable Actions | Circuit reset strictly requires human operator (`actor.type === 'user'`). | Red-Team Vector 5 test |
| **Rule 18** | TOCTOU State Versioning | Inspector renders expected vs actual version; warns on concurrent drift. | Version drift tests |
| **Rule 19** | Idempotency | Reset action requires idempotency key. | Duplicate request test |
| **Rule 21** | Two-Phase Execution | Visualizes 6-step loop: Plan → Predict → Execute → Verify → Commit → Learn. | Stepper UI tests |
| **Rule 22** | Cryptographic Binding | Displays SHA-256 state and payload hashes in execution inspector. | Cryptographic digest tests |
| **Rule 24** | Dynamic Circuit Breakers | Visualizes circuit states (`CLOSED`, `DEGRADED`, `OPEN`, `HALF_OPEN`). | State machine UI tests |
| **Rule 25** | Dead Letter Queue | Visualizes DLQ quarantine status for failed compensations. | DLQ badge tests |
| **Rule 26** | Cancellation Semantics | Displays cancellation badges when execution was cancelled via `AbortSignal`. | Cancellation UI tests |
| **Rule 27** | Reverse-LIFO Saga | Visualizes compensating steps in reverse order ($S_k \dots S_1$). | Saga stepper tests |
| **Rule 28** | Context Budgeting | Displays token consumption meter and knapsack allocation in inspector. | Token badge tests |
| **Rule 30** | Prompt Injection Defense | Sanitizes payload memos against `ADVERSARIAL_DIRECTIVE_PATTERNS`. | Red-Team Vector 4 test |
| **Rule 40** | Domain Event Auditing | Subscribes to `verification.*` and `agent.health.*` events via `useEventStream`. | SSE streaming tests |
| **Rule 41** | Explainability Grid | Displays 4-part grid: WHAT, WHY, EXPECTED STATE CHANGE, CONFIDENCE. | Grid component tests |
| **Rule 42** | Shadow Mode Simulation | Tripped agents display amber "Shadow Mode (0 Live Mutations)" badge. | Badge rendering tests |
| **Rule 46** | Adversarial Red-Team | 6 dedicated attack vectors evaluating the verification subsystem. | `verification-red-team.test.ts` |
| **Rule 47** | Never Trust the Model | All proofs, scores, and circuit states generated deterministically. | Code inspection |
| **Rule 48** | Sanitized Error Taxonomy | Maps `VERIFICATION_UI_ERROR_CODES` to safe HTTP status codes. | Error mapping tests |
| **Rule 51** | Server Actions Security | Enforces `'use server'`, Clerk session auth, Anti-IDOR, dead-man pause. | Action security tests |
| **Rule 52** | Client/Server Boundary | Clear boundary between Server Component route and Client cockpit. | Build boundary audit |
| **Rule 55** | Canvas Resource Limits | Clamps execution steps to $\le 100$ items. | Limit clamp tests |
| **Rule 60** | Emergency Dead-Man Switch | Checks `checkGovernanceDeadManSwitch`; halts all actions on emergency pause. | Red-Team Vector 6 test |
| **Rule 61** | Backoffice Operations | Operable without code deploys; Three-Zone mission control layout. | UI layout audit |
| **Rule 62** | Real-Time SSE Reactivity | Subscribes to SSE stream via `useEventStream` for live scorecard updates. | SSE integration tests |
| **Rule 64** | Feature Flag Gating | Gated by `FF_AGENT_VERIFICATION` where applicable. | Feature flag tests |
| **Rule 67** | Agent Implementation Gate | Satisfies all 10 checklist dimensions (Architecture, Authority, Data, etc.). | Section 6 Gate Checklist |
| **Rule 68** | Five Non-Negotiables | Strict typing (no any), fail-closed, model not boundary, bounded resources, kill switches. | Section 2.3 Verification |
| **Rule 69** | Strangler Fig Invariant | Preserves 100% of all 52 pre-existing routes and accordion states in `AdminSidebar`. | Route regression tests |
| **Rules 1954–1964** | Phase 14 Verification | Visualizes postconditions, state-version, saga compensation, and self-healing. | End-to-end UI tests |
| **theme.md §8** | Standardized Modals | Strict compliance: demarcated header/footer, single-circle info tooltip, sr-only description. | Modal DOM tests |
| **FieldsVariables** | Workspace SSOT | Route all variable replacement through `FieldsVariablesService`. Zero custom regex. | Service audit |
| **TagSelector** | Workspace SSOT | Route tag interactions exclusively through `<TagSelector>` in client/draft mode. | Component audit |

---

## 9. Verification Gates & Protocol Notice

In accordance with `.agents/AGENTS.md` and user directives:
- **NO REMOTE PUSH:** Never push commits to remote branches (`main` or `deployment`).
- **NO FULL PRODUCTION BUILD:** Do not run `npm run build` for intermediate verification; use `pnpm typecheck` and `pnpm lint`.
- **STRICT TYPING:** Zero `any` or `any[]` across all code.
- **PLAN FIRST:** Implementation will **NOT** begin until this plan has been reviewed and formally approved by the user.
