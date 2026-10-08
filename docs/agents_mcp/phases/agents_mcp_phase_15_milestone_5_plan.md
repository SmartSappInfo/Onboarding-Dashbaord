# SmartSapp Agentic & MCP Transformation: Phase 15 Milestone 5 Plan
## Agent Evaluation Center UI, Quality Cockpit, Incident Management & Platform Graduation
### Comprehensive Alignment with `docs/agents_mcp/agents_mcp_rules.md` (Rules 1–69, Rules 1940–1953, Rules 1965–1976), Roadmap (§15, §16, §21–§25), Rule 67 Agent Implementation Gate, Rule 68 Five Non-Negotiables, Rule 69 Strangler Fig Pattern, and `theme.md` §8

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Version:** 2.0.0 (Updated with exhaustive `agents_mcp_rules.md` Master 69-Rules Compliance Matrix)  
**Status:** DRAFT / PENDING USER APPROVAL (Do not start execution until plan is approved)  
**Date:** 2026-10-08  
**Author:** AI Agentic Architecture Team & Senior Principal Systems Architect  
**Git Branch:** `main`  

---

## 1. Executive Summary & Capstone Context

**Phase 15 Milestone 5 is the final, capstone milestone of Phase 15 and the entire SmartSapp Agentic & MCP Transformation Program (Phases 0 through 15).**

Across the preceding 14 phases and Phase 15 Milestones 1–4, SmartSapp engineered an institutional, enterprise-grade autonomous agent foundation:
- **Phase 0–7:** Multi-Tenant Foundations, Contact Identification, Dual-Tier CRM Core, RBAC, Approvals, Messaging, Workflows.
- **Phase 8:** Canonical Agentic Runtime, Two-Phase Approval Interceptor, Domain Event Bus, Audit Trail, Dead-Man Pause.
- **Phase 9:** Universal CRM Agent, Account 360° Context Assembler, In-Context Intelligence Cards, NBA Engine, Risk Detector.
- **Phase 10:** Sales & Lead Intelligence Agent, SDR Sequences, WhatsApp Formulator, Revenue Operations Swarm.
- **Phase 11:** Meetings Intelligence, Audio Extraction, Grounded Briefs, Knowledge Inbox, Hybrid RAG, Recency Decay, Visual Graph.
- **Phase 12:** Finance & School Operations Agents, 3-Way Reconciliation, Fee Recovery, Attendance Anomaly Detector, School Finance Cockpit.
- **Phase 13:** Multi-Agent Swarm Orchestrator, Delegated Authority Protocol (Depth $\le 3$, Authority Intersection Algebra), Graph Reasoning, Swarm Mesh, Tri-State Circuit Breakers, Reverse-LIFO Saga Rollback, Three-Zone Mission Control Cockpit.
- **Phase 14:** Verification, Versioning & Health Framework (Postconditions, TOCTOU State Versioning, Universal Saga Rollback Matrix, Quarantine DLQ, Discrepancy Engine, Autonomous Healing, Telemetry Core, Execution Inspector, Health Dashboard & Red-Team).
- **Phase 15 Milestones 1–4:**
  - M1: Continuous Evaluation Engine & Multi-Domain Gold-Standard Benchmark Harness (35 scenarios, Human vs Agent Baseline).
  - M2: Cost Intelligence, Micro-USD Accounting & Dynamic 3-Tier Model Router.
  - M3: 10-Vector Adversarial Red-Team Battery, Synthetic Chaos Injection & Tool Definition Fingerprinting / Drift Monitor.
  - M4: Backoffice Strategic Asset Registries (`/admin/settings/ai/capabilities`, `/admin/settings/ai/agents`) & Progressive Capability Discovery Engine ($\le 45$ tokens/stub, $83.9\%$ token reduction).

**Milestone 5 brings this entire vision to reality for enterprise operators:**
1. **Agent Evaluation Center (`/admin/intelligence/evaluation` & `EvaluationCenterClient.tsx`):**
   A dedicated Three-Zone Mission Control Cockpit uniting all evaluation vectors into a single pane of glass.
2. **5-Part Quality Cockpit (`agents_mcp_ui.md` 3658–3665):**
   - Task Success Rate: **$\ge 96.2\%$**
   - Tool Correctness: **$\ge 98.7\%$**
   - Policy Violations: **$0$** (Absolute Zero)
   - Human Correction Rate: **$\le 4.8\%$**
   - Median Runtime: **$18\text{s}$**
   - Operating Principle: *"The important metric is not 'AI confidence'. It is **actual task performance**."*
3. **7-View Cockpit Navigation (`agents_mcp_ui.md` 3645–3653):**
   - `Benchmarks`: Gold-standard benchmark execution records, pass/fail indicators, scenario drilldowns.
   - `Regression`: Commit-by-commit regression detection, metric divergence alerts.
   - `Production Quality`: Live task performance, tool precision/recall, policy adherence.
   - `Failures`: Categorized failure logs with root-cause analysis, DLQ quarantine links, and FMEA strategy triggers.
   - `Human Corrections`: Review queue overrides, rejected proposals, modified arguments, correction rate trends.
   - `Cost & Tokens`: Micro-USD spend breakdown, prompt/completion/cached tokens, provider distributions.
   - `Latency & Performance`: P50, P90, P99 latency percentiles across capabilities and agent personas.
4. **Standardized Modal Architecture (`theme.md` §8):**
   - `IncidentManagementModal.tsx`: Emergency dead-man kill switch controls and incident ticketing with mandatory $\ge 5$ character justification notes (Rules 60 & 61).
   - `BenchmarkRunDetailModal.tsx`: Comprehensive run inspector with step execution logs, 4-part explainability grid (Rule 41), and XML reference isolation containers (`<untrusted_reference_data>`).
5. **Admin Sidebar Navigation Unification (Rule 69 Strangler Fig Invariant):**
   - Mounts `/admin/intelligence/evaluation` (`Evaluation Center`) under `INTELLIGENCE` with `Award` icon.
   - 100% preservation of all 53 preexisting administrative navigation routes and accordion states.
6. **Full Program Sign-Off & Platform Production Graduation (Phases 0–15):**
   - Comprehensive cross-domain swarm audit, static analysis verification (0 TypeScript errors, clean linting), and formal production graduation certification.

---

## 2. Architecture & Data Flow

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│              PHASE 15 MILESTONE 5: AGENT EVALUATION CENTER & PLATFORM GRADUATION                 │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│   ┌──────────────────────────────┐        ┌──────────────────────────────┐                       │
│   │ Continuous Evaluation Engine │        │ Token & Cost Accounting Core │                       │
│   │ (35 Gold-Standard Scenarios) │        │ (Micro-USD, Model Router)    │                       │
│   └──────────────┬───────────────┘        └──────────────┬───────────────┘                       │
│                  │                                       │                                       │
│                  ├───────────────────────────────────────┤                                       │
│                  ▼                                       ▼                                       │
│   ┌──────────────────────────────┐        ┌──────────────────────────────┐                       │
│   │ Adversarial & Drift Monitor  │        │ Human Baseline Comparators   │                       │
│   │ (10-Vector Red-Team & Chaos) │        │ (Speed, Errors, Context)     │                       │
│   └──────────────┬───────────────┘        └──────────────┬───────────────┘                       │
│                  │                                       │                                       │
│                  └───────────────────┬───────────────────┘                                       │
│                                      ▼                                                           │
│   ┌──────────────────────────────────────────────────────────────────────────────────────────┐   │
│   │ Governed Next.js 15 Server Actions (src/app/actions/evaluation-ui-actions.ts)             │   │
│   │ • Clerk Session Authentication (requireAuth())                                           │   │
│   │ • Multi-Tenant Anti-IDOR Boundary Lock (assertTenantAccess, Rules 8 & 47)               │   │
│   │ • Rule 60 Emergency Dead-Man Switch Evaluation (checkGovernanceDeadManSwitch)            │   │
│   │ • Rule 61 Mandatory Audit Justification Verification (>= 5 characters)                   │   │
│   │ • Real-time Event Publishing (defaultEventBus)                                           │   │
│   └──────────────────────────────────┬───────────────────────────────────────────────────────┘   │
│                                      ▼                                                           │
│   ┌──────────────────────────────────────────────────────────────────────────────────────────┐   │
│   │ Three-Zone Evaluation Center Cockpit (/admin/intelligence/evaluation)                    │   │
│   │                                                                                          │   │
│   │  ZONE 1: Executive Quality KPI Header & Human Comparison Card                            │   │
│   │  • Task Success (96.2%)  • Tool Correctness (98.7%)  • Zero Violations (0)               │   │
│   │  • Human Correction (4.8%)  • Median Runtime (18s)   • Single-Circle Tooltips z-[10050]  │   │
│   │                                                                                          │   │
│   │  ZONE 2: 7-View Tabs, 300ms Debounced Search & Domain/Risk Filter Bar                    │   │
│   │  • [Benchmarks] [Regression] [Production Quality] [Failures]                             │   │
│   │  • [Human Corrections] [Cost & Tokens] [Latency & Performance]                           │   │
│   │                                                                                          │   │
│   │  ZONE 3: Interactive View Data Surface & Real-Time SSE Stream (useEventStream, Rule 62)  │   │
│   │  • BenchmarkRunsTable  • CostLatencyChart  • FailureInspector  • IncidentQueue           │   │
│   │                                                                                          │   │
│   │  MODAL OVERLAYS (theme.md §8):                                                           │   │
│   │  • IncidentManagementModal (Kill-Switches, >= 5 char justification, single-circle tooltip)│  │
│   │  • BenchmarkRunDetailModal (4-Part Explainability Grid, <untrusted_reference_data>)      │   │
│   └──────────────────────────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Exhaustive Master 69-Rules & Rules 1940–1976 Compliance Matrix

The following table explicitly maps how Phase 15 Milestone 5 complies with **every single rule in `docs/agents_mcp/agents_mcp_rules.md` (Rules 1 through 69, Rules 1940–1953, and Rules 1965–1976)** without compromising any existing or new functionality:

| Rule # | Principle & Mandate | Milestone 5 Implementation Mechanism | Verification & Test Evidence |
| :--- | :--- | :--- | :--- |
| **Rule 1** | Production Reliability & Framework Best Practices | Strictly adheres to Next.js 15 App Router conventions, React 19 hooks, Tailwind semantic classes, and Emil Kowalski micro-interactions. | Code review & component architecture |
| **Rule 2** | FMEA Failure Mode Analysis & Structured Recovery | Comprehensive FMEA matrix in §6 mapping all evaluation failure states to recovery strategies via `EVALUATION_UI_FAILURE_MATRIX`. | `evaluation-ui-contracts.test.ts` |
| **Rule 3** | Zero Disruption to Existing Apps & Operations | Strangler Fig preserved; Backoffice enables operators to evaluate, audit, and pause agents without code redeployment or downtime. | `AdminSidebar.test.tsx` (12/12 passing) |
| **Rule 4** | Strict Typing Protocol (`unknown` at boundaries) | Zero `any` or `any[]` throughout all contracts, schemas, Server Actions, and UI components; controlled `unknown` validated with Zod v4 schemas. | TypeScript compilation (`tsc --noEmit`) |
| **Rule 5** | Staged & Verified Deployment | No unverified automated production rollout; verified locally via Vitest batteries and verified in CI. | Local verification suite |
| **Rule 6** | Dependency Integrity & Supply Chain | Uses existing, audited dependencies; zero unvetted third-party chart or state libraries. | Package audit |
| **Rule 7** | Mobile & Tactile UX (`min-h-[44px]`, `active:scale-[0.97]`) | All buttons, tabs, inputs, and close triggers enforce `min-h-[44px]` touch targets, `active:scale-[0.97]`, and simple everyday UI English. | DOM and UI test assertions |
| **Rule 8** | Multi-Tenant Anti-IDOR Isolation | Scoped `assertTenantAccess` across all Server Actions; cross-tenant requests throw `IDOR_VIOLATION` (HTTP 403) and fail closed. | `evaluation-ui-actions.test.ts` |
| **Rule 9** | Concurrency & Load Safety | Paginated table queries (max 50 rows), sliding window telemetry clamped ($\le 100$), debounced search (300ms). | Concurrency tests |
| **Rule 10** | Inline Architectural Pointers | Exhaustive inline documentation explaining rationale, invariants, caution areas, and testability pointers. | Inline code inspection |
| **Rule 11** | Mathematical Determinism & Micro-Cent Rounding | Token costs, pass rates, error rates, and latencies computed using `roundCurrency` and exact integer rounding. | Unit tests on KPI calculations |
| **Rule 12** | Canonical Risk Vocabulary (`L0_READ` to `L4`) | UI surfaces reflect canonical risk tiers (`L0_READ`, `L1_INTERNAL_DRAFT`, `L2_STATE_MUTATION`, `L3_EXTERNAL_COMMUNICATION_FINANCE`, `L4_PRIVILEGED_DESTRUCTIVE`). | Modal & table badge tests |
| **Rule 13** | Prompt Injection Defense & Sanitization | Untrusted inputs and scenario parameters scanned against `ADVERSARIAL_DIRECTIVE_PATTERNS` before evaluation. | Red-team test suites |
| **Rule 14** | Tool Poisoning & Definition Drift Defense | Live tool verification surfaces cryptographic drift badges from Milestone 3 `ToolDriftMonitor`. | Table & badge tests |
| **Rule 15** | Server Allowlisting & SSRF Prevention | Disallows arbitrary external URL fetching during evaluation and benchmark runs. | Security tests |
| **Rule 16** | Non-Wildcard RBAC & Scoped Permissions | Canonical permissions: `intelligence:evaluation:view`, `intelligence:evaluation:manage`, `system_admin`. No wildcards. | Action & sidebar tests |
| **Rule 17** | Non-Delegable Decider & Human-in-the-Loop Gates | Incident management, kill switches, and circuit resets strictly restricted to authenticated human users (`actor.type === 'user'`). | Server Action auth tests |
| **Rule 18** | TOCTOU Concurrency Guard & Optimistic Versioning | State version validation prevents race conditions during benchmark replay and incident triage. | Concurrency tests |
| **Rule 19** | Idempotency Verification | Mutating actions enforce deterministic idempotency keys (`idempotencyKey`). | Action tests |
| **Rule 20** | Replay Protection & Unique Nonce | Prevents duplicate benchmark triggering via unique execution run IDs (`runId`). | Run trigger tests |
| **Rule 21** | Formal 6-Step Loop Verification | Benchmarks verify that agents execute Plan, Predict, Execute, Verify, Commit, and Learn. | Benchmark detail inspector |
| **Rule 22** | Cryptographic Digest Binding | State hashes and proposal payloads verified using canonical key-sorted SHA-256. | Cryptographic tests |
| **Rule 23** | Resource Budget Governance | Visualizes token consumption against per-tenant and per-agent budgets; halts runs exceeding limits. | Cost & tokens view tests |
| **Rule 24** | Dynamic Circuit Breakers | Visualizes circuit breaker states (`CLOSED`, `OPEN`, `HALF_OPEN`) with manual override capabilities. | Health & incident views |
| **Rule 25** | DLQ Quarantine | Links unhandled failures directly to DLQ triage records with structured error metadata. | Failures view tests |
| **Rule 26** | Cooperative Cancellation (`AbortSignal`) | Native `AbortSignal` propagated through all benchmark executions and async Server Actions. | Action tests |
| **Rule 27** | Reverse-LIFO Saga Rollback | Displays compensation plans and rollback verification results for failed mutating benchmarks. | Failures & run detail modal |
| **Rule 28** | Context Budgeting & Compression | Stratified Knapsack budgeting ($\le 30,000$ tokens total, $\le 4,000$ tokens per subagent). | Telemetry & KPI tests |
| **Rule 29** | Memory Governance & Fact Supersession | Fact supersession verified during knowledge evaluation benchmarks. | Knowledge evaluation tests |
| **Rule 30** | Untrusted Data XML Containerization | Model inputs, outputs, and proof tokens rendered inside `<untrusted_reference_data id="...">` containers. | Benchmark detail modal tests |
| **Rule 31** | Output Validation with Strict Schemas | Strict Zod v4 validation between every agent step, Server Action, and UI state model. | Contract tests |
| **Rule 32** | Data Exfiltration Defense & Output Scanning | Evaluator checks for sensitive PII or credentials leaking in model outputs. | Red-team test suites |
| **Rule 33** | Credential & Secret Redaction | Linear regex strips bearer tokens and API keys before displaying run logs or exporting reports. | Inspector modal tests |
| **Rule 34** | Network Boundary Controls | Disallows arbitrary outbound URLs during tool calls and evaluations. | Security tests |
| **Rule 35** | MCP Discovery Caching | Progressive discovery caches capabilities with TTL and reactive invalidation. | Cache tests |
| **Rule 36** | MCP 2026-07-28 Spec Compliance | Tool manifests and capabilities strictly adhere to stateless JSON-RPC 2.0 protocol. | Manifest tests |
| **Rule 37** | Stateless MCP Transport | Zero server-side session stickiness in MCP communication. | Transport tests |
| **Rule 38** | Prohibition of Deprecated MCP Capabilities | Rejects legacy Roots, Sampling, or Logging abstractions. | Manifest tests |
| **Rule 39** | Distributed Tracing & OpenTelemetry | Emits structured latency, token, and error spans for every evaluation trace. | Telemetry tests |
| **Rule 40** | Immutable Domain Event Emission | Emits `evaluation.run.triggered`, `evaluation.run.completed`, `evaluation.incident.created` via `defaultEventBus`. | Event bus tests |
| **Rule 41** | 4-Part Explainability Grid | WHAT / WHY / EXPECTED vs ACTUAL / RISK embedded in benchmark inspection modals. | Modal UI tests |
| **Rule 42** | Shadow Mode Simulation | Continuous evaluation runner executes strictly with `dryRun: true` (0 live database writes). | Benchmark execution tests |
| **Rule 43** | Deterministic Test Replayability | Benchmark scenarios are 100% deterministic and replayable with identical assertions. | Replay tests |
| **Rule 44** | Golden Dataset Benchmarking | Evaluates all 35 gold-standard enterprise scenarios across 7 domains. | Benchmark tests |
| **Rule 45** | Synthetic Fault Injection & Chaos Testing | Surfaces results of synthetic fault injections (429, 500, jitter, partition cascades). | Chaos tests |
| **Rule 46** | Adversarial Security & Red-Team Testing | Surfaces results of the 10-vector adversarial injection suite from Milestone 3. | Quality & benchmarks views |
| **Rule 47** | Never Trust the Model (Anti-Hallucination) | All evaluation scores, benchmarks, and costs are deterministic system evaluations. | Evaluator unit tests |
| **Rule 48** | Sanitized Error Taxonomy & HTTP Status Mapping | Structured error codes in `EVALUATION_UI_ERROR_CODES` with HTTP status mappings. | Contract tests |
| **Rule 49** | Public Resource Isolation | Prevents leakage of private tenant assets in evaluation benchmarks. | Security tests |
| **Rule 50** | Tenant Cache Isolation | Partitioned cache keys `${orgId}:${wsId}:...` for evaluation telemetry and benchmark datasets. | Cache tests |
| **Rule 51** | Next.js 15 Server Action Security Gate | Strict `'use server'`, Clerk session auth (`requireAuth()`), Anti-IDOR validation. | Action security tests |
| **Rule 52** | Client/Server Boundary Verification | UI tests assert that Server Actions reject unauthenticated and cross-tenant callers. | Action security tests |
| **Rule 53** | Dependency Governance | Bounded dependency tree; no unverified third-party libraries. | Dependency audit |
| **Rule 54** | Performance Budgets & Bundle Ceilings | Lightweight SVG/CSS visualizations; zero heavy chart library bundle bloat. | Bundle & render tests |
| **Rule 55** | Graph & Canvas Limits | Clamped bounds in latency and cost distribution charts. | Chart render tests |
| **Rule 56** | Multi-Agent Context Partitioning | Stratified context budgets across multi-agent swarms. | Swarm tests |
| **Rule 57** | Data Residency & Retention Cascades | Telemetry sliding window respects data retention cascades ($\le 100$ entries). | Telemetry tests |
| **Rule 58** | Dynamic Model Routing Policy | Visualizes model tier selection distribution (Tier 1 vs Tier 2 vs Tier 3). | Cost view tests |
| **Rule 59** | Tool Selection Evaluation | Specific evaluator checking tool choice accuracy, over-retrieval, and unnecessary mutations. | Quality view tests |
| **Rule 60** | Emergency Dead-Man Controls | Fail-closed evaluation via `checkGovernanceDeadManSwitch` on all execution and evaluation actions. | Action security tests |
| **Rule 61** | Backoffice Agent Control Plane | Granular kill switches and incident triage with mandatory $\ge 5$ character justification. | Incident modal tests |
| **Rule 62** | Real-Time SSE Reactivity | Real-time updates via `useEventStream` subscribing to `evaluation.*`, `cost.*`, `incident.*`. | SSE client tests |
| **Rule 63** | Incident Management | Triage, root cause tracking, and DLQ reprocessing in Evaluation Center. | Incident view tests |
| **Rule 64** | 3-Level Feature Flags | System, tenant, and user feature flags governing autonomous capabilities. | Feature flag tests |
| **Rule 65** | Canary Releases & Prompt Pinning | Gradual traffic shifting and prompt canary pinning evaluated in benchmark trends. | Canary tests |
| **Rule 66** | Mandatory 7 Deliverables Gate | Every domain evaluated for all 7 mandatory deliverables (Rules 1940–1953). | Deliverables gate audit |
| **Rule 67** | The Agent Implementation Gate | 10-category verification gate verified for all Phase 15 deliverables (§5). | Implementation gate audit |
| **Rule 68** | The Five Non-Negotiables | Strict typing, tenant isolation, fail-closed, no push, theme.md §8 verified. | Pre-completion checklist |
| **Rule 69** | Strangler Fig Invariant | 100% preservation of all 53 preexisting routes in `AdminSidebar.tsx`. | `AdminSidebar.test.tsx` |
| **Rules 1940–1953** | The 4 Governance Matrices | Permission, Tool, Failure, and Rollback matrices defined with deterministic mappings (§3.1). | Contract tests |
| **Rules 1965–1976** | Phase 15 Production Invariants | Continuous evaluation, adversarial testing, chaos testing, dependency & drift monitoring, incident management. | Full milestone verification |

---

### 3.1 The 4 Mandatory Governance Matrices (Rules 1940–1953)

```typescript
// 1. Permission Matrix
export const EVALUATION_UI_PERMISSION_MATRIX: Readonly<Record<string, readonly string[]>> = {
  all_agent_personas: ['intelligence:evaluation:view', 'workspace:read'],
  supervisor: ['intelligence:evaluation:view', 'workspace:read'],
  admin_user: ['intelligence:evaluation:view', 'intelligence:evaluation:manage', 'system_admin', 'workspace:read'],
};

// 2. Tool Matrix
export const EVALUATION_UI_TOOL_MATRIX: Readonly<Record<string, {
  riskLevel: 'L0_READ' | 'L2_STATE_MUTATION';
  isDelegable: boolean;
  isIdempotent: boolean;
  auditRequired: boolean;
}>> = {
  'evaluation.ui.get_telemetry': { riskLevel: 'L0_READ', isDelegable: true, isIdempotent: false, auditRequired: false },
  'evaluation.ui.list_runs': { riskLevel: 'L0_READ', isDelegable: true, isIdempotent: false, auditRequired: false },
  'evaluation.ui.get_run_detail': { riskLevel: 'L0_READ', isDelegable: true, isIdempotent: false, auditRequired: false },
  'evaluation.ui.trigger_run': { riskLevel: 'L0_READ', isDelegable: false, isIdempotent: true, auditRequired: true },
  'evaluation.ui.create_incident': { riskLevel: 'L2_STATE_MUTATION', isDelegable: false, isIdempotent: true, auditRequired: true },
  'evaluation.ui.resolve_incident': { riskLevel: 'L2_STATE_MUTATION', isDelegable: false, isIdempotent: true, auditRequired: true },
  'evaluation.ui.toggle_dead_man': { riskLevel: 'L2_STATE_MUTATION', isDelegable: false, isIdempotent: true, auditRequired: true },
};

// 3. Failure Matrix
export const EVALUATION_UI_FAILURE_MATRIX: Readonly<Record<string, {
  httpStatus: number;
  strategy: 'FAIL_CLOSED' | 'FAIL_GRACEFULLY' | 'TRIGGER_REVERSE_LIFO_SAGA' | 'FALLBACK_TO_DEFAULT';
}>> = {
  EVALUATION_UI_RUN_NOT_FOUND: { httpStatus: 404, strategy: 'FAIL_GRACEFULLY' },
  EVALUATION_UI_INCIDENT_NOT_FOUND: { httpStatus: 404, strategy: 'FAIL_GRACEFULLY' },
  EVALUATION_UI_UNAUTHORIZED: { httpStatus: 403, strategy: 'FAIL_CLOSED' },
  EVALUATION_UI_IDOR_VIOLATION: { httpStatus: 403, strategy: 'FAIL_CLOSED' },
  EVALUATION_UI_DEAD_MAN_PAUSED: { httpStatus: 503, strategy: 'FAIL_CLOSED' },
  EVALUATION_UI_INVALID_INPUT: { httpStatus: 400, strategy: 'FAIL_CLOSED' },
  EVALUATION_UI_JUSTIFICATION_TOO_SHORT: { httpStatus: 400, strategy: 'FAIL_CLOSED' },
  EVALUATION_UI_EXECUTION_FAILED: { httpStatus: 500, strategy: 'FAIL_CLOSED' },
};

// 4. Rollback Matrix
export const EVALUATION_UI_ROLLBACK_MATRIX: Readonly<Record<string, string | null>> = {
  'evaluation.ui.create_incident': 'evaluation.ui.cancel_incident',
  'evaluation.ui.toggle_dead_man': 'evaluation.ui.restore_dead_man_state',
  'evaluation.ui.get_telemetry': null, // noop
  'evaluation.ui.list_runs': null, // noop
  'evaluation.ui.get_run_detail': null, // noop
  'evaluation.ui.trigger_run': null, // dryRun: true produces zero writes
};
```

---

## 4. Detailed Component & UI Architecture (`theme.md` §8 & `agents_mcp_ui.md` 3633–3670)

### 4.1 Zone 1: Agent Quality KPI Header (`AgentQualityKPIHeader.tsx`)
Conforming to `agents_mcp_ui.md` lines 3658–3665:
- **5 Canonical Metric Cards:**
  1. **Task Success:** `96.2%` (Target $\ge 96.0\%$, Badge: `HEALTHY`, Icon: `CheckCircle2`)
  2. **Tool Correctness:** `98.7%` (Target $\ge 98.0\%$, Badge: `EXEMPLARY`, Icon: `Wrench`)
  3. **Policy Violations:** `0` (Target $= 0$, Badge: `ZERO_TOLERANCE`, Icon: `ShieldCheck`)
  4. **Human Correction:** `4.8%` (Target $\le 5.0\%$, Badge: `OPTIMAL`, Icon: `UserCheck`)
  5. **Median Runtime:** `18s` (Target $\le 30\text{s}$, Badge: `FAST`, Icon: `Clock`)
- **Single-Circle Tooltip Standard (`theme.md` §8.3):**
  Each KPI card renders a single-circle `<CardInfoTooltip text="..." />` elevated to `z-[10050]`.
  No double circles, no button borders, no focus rings on open.

### 4.2 Human vs Agent Comparison Card (`HumanAgentComparisonCard.tsx`)
Conforming to Roadmap §16:
- **Task Completion Time:** $17\text{m}$ (Human) vs $2\text{m}$ (Agent) — **$88.2\%$ faster**.
- **Error Rate:** $8.0\%$ (Human) vs $1.1\%$ (Agent) — **$86.3\%$ error reduction**.
- **Context Sources Consulted:** $4/9$ sources (Human) vs $9/9$ sources (Agent) — **$125\%$ broader context consultation**.

### 4.3 Zone 2: 7-View Navigation Bar & Search Filters
Conforming to `agents_mcp_ui.md` lines 3645–3653:
- Tab navigation between the 7 canonical views:
  1. `Benchmarks` (`Award`)
  2. `Regression` (`TrendingUp`)
  3. `Production Quality` (`Sparkles`)
  4. `Failures` (`AlertTriangle`)
  5. `Human Corrections` (`UserCheck`)
  6. `Cost & Tokens` (`Coins`)
  7. `Latency & Performance` (`Gauge`)
- 300ms debounced search query input (`Search` icon, `min-h-[44px]` touch target).
- Domain Filter Dropdown (`CRM`, `Sales`, `Meetings`, `Knowledge`, `Finance`, `School`, `Supervisor`, `All Domains`).
- Persona Filter Dropdown (All 26 canonical agent personas).

### 4.4 Zone 3: Active View Surface
- **`Benchmarks` View:** Renders `BenchmarkRunsTable.tsx` displaying run timestamp, scenario ID, domain, persona, benchmark score (0–100), pass/fail status chip, and tactile `[Inspect Run]` trigger button.
- **`Regression` View:** Renders commit-by-commit pass-rate trend chart, detecting score drops $> 2.0\%$.
- **`Production Quality` View:** Deep-dive cards into tool selection precision/recall, evidence grounding score, and postcondition satisfaction rates.
- **`Failures` View:** Categorized failure log with root causes, FMEA recovery strategies, and DLQ message identifiers.
- **`Human Corrections` View:** Proposal review queue overrides, human edits, rejection reasons, and correction rate velocity.
- **`Cost & Tokens` View:** Micro-USD spend breakdown by provider and persona, prompt vs completion tokens, cached token efficiency.
- **`Latency & Performance` View:** Pure SVG/CSS P50, P90, P99 latency percentiles across capabilities.

### 4.5 Standardized Modals (`theme.md` §8)

#### 4.5.1 `IncidentManagementModal.tsx`
- **Surface & Geometry:** `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`.
- **Demarcated Header:** `<DialogHeader demarcated>` with ambient tint `bg-muted/20`, divider `border-b border-border/80`, padding `px-6 py-3.5 sm:py-4`.
- **Zero Raw Descriptions:** Screen-reader only `<DialogDescription className="sr-only">`. Contextual guidance via `<CardInfoTooltip text="..." />` at `z-[10050]`.
- **Kill-Switch Controls (Rule 60):**
  - `agent_execution_paused` (Emergency platform pause)
  - `model_routing_paused` (Emergency fallback to Tier 1 models)
  - `dynamic_discovery_paused` (Fallback to static capability registry)
- **Mandatory Justification (Rule 61):**
  - Textarea with live character counter enforcing $\ge 5$ characters.
  - Submit button disabled until length requirement is satisfied.
- **Demarcated Footer:** `px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5`, tactile buttons with `rounded-xl active:scale-[0.97] min-h-[44px]`.

#### 4.5.2 `BenchmarkRunDetailModal.tsx`
- **Surface & Geometry:** `theme.md` §8 standard.
- **4-Part Explainability Grid (Rule 41):**
  - **WHAT:** Scenario description, target persona, evaluated capability.
  - **WHY:** Evaluation objective and benchmark hypothesis.
  - **EXPECTED vs ACTUAL:** Asserted state vs observed postcondition state.
  - **RISK:** Risk tier (`L0_READ` to `L4`) and potential blast radius.
- **XML Reference Isolation Container (Rules 13 & 30):**
  - Model inputs, outputs, and proof tokens rendered inside `<untrusted_reference_data id="...">` containers.
- **Secret Redaction (Rules 32 & 33):**
  - All tokens, bearer strings, and keys masked before rendering.

---

## 5. The Rule 67 Agent Implementation Gate Assessment for Milestone 5

```text
1. ARCHITECTURE
□ What canonical capability does this use?
  Uses CapabilityRegistry and evaluation capabilities in src/platform/capabilities/evaluation/.
□ Is this duplicating an existing service?
  No. Reuses ContinuousEvaluationEngine, HumanAgentBaselineService, and TokenCostAccountingService.
□ What is the source of truth?
  Canonical Zod v4 schemas in evaluation-ui-types.ts; FieldsVariablesService for variable interpolation.
□ What events are emitted?
  Emits evaluation.run.triggered, evaluation.run.completed, evaluation.incident.created to defaultEventBus.

2. AUTHORITY
□ Who is allowed to use it?
  Bound to intelligence:evaluation:view, intelligence:evaluation:manage, and system_admin.
□ What may the agent do?
  Read telemetry, execute gold-standard scenarios in dryRun mode, inspect benchmark details.
□ What may the agent never do?
  Perform production database writes during benchmarks (dryRun: true enforced), toggle kill switches.
□ Can a sub-agent inherit this authority?
  No. Incident management and kill switches are non-delegable and human-only (Rule 17).

3. DATA
□ What data enters the agent?
  Evaluation runs, benchmark scores, cost records, incident notes, filter queries.
□ What data leaves the agent?
  Aggregated telemetry, sanitized run reports, incident tickets.
□ Is untrusted data separated from instructions?
  Yes. All model outputs and raw inputs containerized in <untrusted_reference_data id="..."> (Rule 30).
□ Is sensitive data exposed?
  No. Strict linear non-backtracking redaction on bearer tokens, API keys, and PII (Rules 32 & 33).

4. EXECUTION
□ Is execution idempotent?
  Yes. All benchmark executions and incident tickets use deterministic UUIDs/run IDs (Rule 19).
□ What is the retry policy?
  Bounded retries (<= 2) with exponential backoff on transient failures.
□ What is the timeout and cancellation policy?
  Cooperative AbortSignal propagated through all benchmark replays and actions (Rule 26).
□ How is concurrency managed?
  Sliding window clamped to <= 100 entries; paginated tables clamped to <= 50 rows (Rule 9).

5. MCP
□ What protocol version is used?
  Stateless MCP 2026-07-28 tool manifests (Rule 36).
□ Are annotations trusted for security?
  No. Hints only; security enforced strictly server-side.
□ How is drift detected?
  Integrated with Milestone 3 ToolDriftMonitor fingerprints (Rule 14 & 1974).

6. FAILURE
□ How do timeouts manifest?
  30s timeout per scenario evaluation; 10s timeout on Server Actions (Rule 26).
□ What is the fail-closed behavior?
  Dead-man switch pauses return HTTP 503 EVALUATION_DEAD_MAN_PAUSED (Rule 60).
□ Where do poisoned inputs go?
  Irrecoverable benchmark failures routed to DLQ with structured metadata (Rule 25).

7. SECURITY
□ How is prompt injection prevented?
  Linear non-backtracking scan (ADVERSARIAL_DIRECTIVE_PATTERNS) and XML reference isolation (Rule 30).
□ How is IDOR prevented?
  Scoped assertTenantAccess boundary enforcement on all Server Actions (Rules 8 & 47).
□ How is confused deputy prevented?
  Strict identity binding between authorizing user and agent execution principal (Rule 16).

8. OPERATIONS
□ Where is the control plane?
  Three-Zone console at /admin/intelligence/evaluation (Rule 61).
□ Can runs be replayed?
  Yes. 100% deterministic scenario replay from gold-standard datasets (Rule 44).
□ Can behavior be modified without code?
  Yes. Kill switches, view filters, and incident notes operable without code changes (Rule 61).

9. TESTING
□ What test suites verify this?
  Contract tests, Server Action tests, UI component tests, and platform regression battery.
□ What is the test pass criteria?
  100% test pass rate across all suites before deployment.

10. MIGRATION
□ Does this break existing functionality?
  No. Strangler Fig invariant: 100% preservation of all 53 preexisting routes in AdminSidebar.tsx (Rule 69).
□ Are database schemas modified?
  No. Zero schema modifications to production business collections.
```

---

## 6. Implementation Tasks & Step-by-Step Execution Plan

### Task 1: Canonical Evaluation UI Contracts & 4 Governance Matrices
- [ ] Create `src/platform/evaluation/ui/evaluation-ui-types.ts`:
  - Canonical Zod v4 schemas:
    * `EvaluationViewTabSchema`: `'benchmarks' | 'regression' | 'production_quality' | 'failures' | 'human_corrections' | 'cost_tokens' | 'latency_performance'`
    * `AgentQualityKPIsSchema`: `taskSuccessRate`, `toolCorrectnessRate`, `policyViolationsCount`, `humanCorrectionRate`, `medianRuntimeSeconds`, `totalRunsEvaluated`, `activePersonasCount`.
    * `EvaluationFilterStateSchema`: `domain`, `personaId`, `status`, `view`, `searchQuery`, `timeRange`.
    * `IncidentSeveritySchema`: `'P0_CRITICAL' | 'P1_HIGH' | 'P2_MEDIUM' | 'P3_LOW'`
    * `IncidentStatusSchema`: `'OPEN' | 'INVESTIGATING' | 'MITIGATED' | 'RESOLVED'`
    * `EvaluationIncidentTicketSchema`: `id`, `organizationId`, `title`, `severity`, `status`, `personaId`, `capabilityId`, `justification`, `createdAt`, `updatedAt`, `resolvedAt`, `authorUserId`.
    * `CreateIncidentInputSchema`: with `justification: z.string().min(5)`.
    * `ResolveIncidentInputSchema`: with `resolutionNotes: z.string().min(5)`.
    * `RegressionTrendPointSchema`: `timestamp`, `commitSha`, `taskSuccessRate`, `toolCorrectnessRate`, `benchmarkScore`.
    * `FailureSummaryRecordSchema`: `id`, `scenarioId`, `personaId`, `domain`, `errorCode`, `failureStrategy`, `rootCause`, `timestamp`, `dlqMessageId`.
    * `HumanCorrectionRecordSchema`: `id`, `proposalId`, `personaId`, `domain`, `actionType`, `originalPayloadSummary`, `correctedPayloadSummary`, `rejectionReason`, `timestamp`, `reviewedByUserId`.
    * `EvaluationDashboardTelemetrySchema`: Zone 1 KPIs, active benchmarks, human baseline, recent failures, open incidents.
  - Error taxonomy: `EVALUATION_UI_ERROR_CODES` and typed `EvaluationUiError` class with HTTP status mappings.
  - The 4 Governance Matrices (Rules 1940–1953):
    * `EVALUATION_UI_PERMISSION_MATRIX`
    * `EVALUATION_UI_TOOL_MATRIX`
    * `EVALUATION_UI_FAILURE_MATRIX`
    * `EVALUATION_UI_ROLLBACK_MATRIX`
  - Strict zero-`any` / zero-`any[]` compliance (Rule 4).
- [ ] Export public contracts from `src/platform/evaluation/ui/index.ts` and platform root `src/platform/evaluation/index.ts`.
- [ ] Author test suite: `src/platform/__tests__/evaluation/evaluation-ui-contracts.test.ts`.

### Task 2: Governed Evaluation UI Server Actions
- [ ] Create `src/app/actions/evaluation-ui-actions.ts`:
  - `'use server'` adhering strictly to Rule 51.
  - Clerk session authentication via `requireAuth()`.
  - Multi-tenant Anti-IDOR validation (`assertTenantAccess`) failing closed with HTTP 403 `IDOR_VIOLATION` (Rules 8 & 47).
  - Rule 60 emergency dead-man pause evaluation (`checkGovernanceDeadManSwitch` from `@/platform/policy/governance-dead-man`).
  - Actions to implement:
    * `getEvaluationDashboardTelemetryAction(organizationId)`: returns `EvaluationDashboardTelemetry`.
    * `listBenchmarkRunsAction(query)`: paginated benchmark run list with domain/persona filtering.
    * `getBenchmarkRunDetailAction(runId, organizationId)`: detailed run report with step logs and XML reference containers.
    * `triggerGoldStandardRunAction(scenarioId, organizationId)`: triggers evaluation in `dryRun: true` mode.
    * `createIncidentTicketAction(input)`: creates incident ticket with $\ge 5$ char justification (Rule 61).
    * `resolveIncidentTicketAction(input)`: resolves incident ticket with $\ge 5$ char resolution notes (Rule 61).
    * `toggleEmergencyDeadManAction(organizationId, switchName, state, justification)`: toggles dead-man switch with $\ge 5$ char justification (Rule 60 & 61).
    * `getEvaluationViewDataAction(view, filter)`: fetches data for specific view tabs.
  - Sanitized structured error returns via `EvaluationActionResult<T>` (Rule 48).
- [ ] Author test suite: `src/platform/__tests__/evaluation/evaluation-ui-actions.test.ts`.

### Task 3: Standardized UI Modals (`theme.md` §8)
- [ ] Create `src/components/evaluation/IncidentManagementModal.tsx`:
  - Strict compliance with `theme.md` §8:
    * Surface: `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`.
    * Demarcated Header: `<DialogHeader demarcated>` with `px-6 py-3.5 sm:py-4 border-b border-border/80 bg-muted/20`.
    * Zero Raw Descriptions: `<CardInfoTooltip text="..." />` alongside title elevated to `z-[10050]`, screen-reader only `<DialogDescription className="sr-only">`.
    * Emergency Dead-Man Switches (Rule 60): `agent_execution_paused`, `model_routing_paused`, `dynamic_discovery_paused`.
    * Mandatory Justification (Rule 61): live character counter enforcing $\ge 5$ characters.
    * Demarcated Footer: `px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5`, tactile buttons with `rounded-xl active:scale-[0.97] min-h-[44px]`.
- [ ] Create `src/components/evaluation/BenchmarkRunDetailModal.tsx`:
  - Strict compliance with `theme.md` §8.
  - 4-Part Explainability Grid (Rule 41): WHAT / WHY / EXPECTED vs ACTUAL / RISK.
  - Evaluator score breakdown (Task, Tool, Policy, Evidence).
  - XML reference isolation container `<untrusted_reference_data id="...">` for untrusted model input/output previews (Rules 13 & 30).
  - Secret redaction (Rules 32 & 33).
  - Tactile close button and footer.

### Task 4: Evaluation Center UI Components & Data Views
- [ ] Create `src/components/evaluation/AgentQualityKPIHeader.tsx`:
  - 5 Canonical KPI Cards conforming to `agents_mcp_ui.md` 3658–3665:
    * Task Success: `96.2%`
    * Tool Correctness: `98.7%`
    * Policy Violations: `0`
    * Human Correction: `4.8%`
    * Median Runtime: `18s`
  - Single-circle `<CardInfoTooltip text="..." />` at `z-[10050]` for every metric.
- [ ] Create `src/components/evaluation/HumanAgentComparisonCard.tsx`:
  - Visual comparative cards for Task Time ($17\text{m}$ vs $2\text{m}$), Error Rate ($8.0\%$ vs $1.1\%$), Context Consultation ($4/9$ vs $9/9$).
- [ ] Create `src/components/evaluation/BenchmarkRunsTable.tsx`:
  - Interactive table with scenario ID, domain badge, persona chip, status badge (`PASS` / `FAIL`), execution duration, and `[Inspect Run]` trigger button.
- [ ] Create `src/components/evaluation/CostLatencyChart.tsx`:
  - Lightweight SVG/CSS visualizations for token spend by persona and P50/P90/P99 latency distribution.
  - Zero heavy external chart libraries (Rule 54 performance budget).
- [ ] Create `src/components/evaluation/index.ts`: UI barrel export.

### Task 5: Operations Cockpit Route & Admin Sidebar Navigation
- [ ] Create `src/app/admin/intelligence/evaluation/page.tsx`:
  - Next.js 15 Server Component with async `searchParams`, SEO metadata, and Suspense boundary.
- [ ] Create `src/app/admin/intelligence/evaluation/EvaluationCenterClient.tsx`:
  - Three-Zone layout (Zone 1 KPI Header & Human Baseline, Zone 2 7-View Tabs & Debounced Search, Zone 3 Active View Surface).
  - Real-time SSE reactivity (`useEventStream`) subscribing to `evaluation.*`, `incident.*`, `cost.*` (Rule 62).
  - Integrated modal state for `IncidentManagementModal` and `BenchmarkRunDetailModal`.
- [ ] Update `src/app/admin/components/AdminSidebar.tsx`:
  - Mount `/admin/intelligence/evaluation` (`Evaluation Center`) under `INTELLIGENCE` group with Lucide `Award` icon.
  - Preserve 100% of all 53 existing navigation routes and accordion state (Rule 69 Strangler Invariant).
- [ ] Author UI test suite: `src/platform/__tests__/ui/evaluation-center-ui.test.tsx`.

### Task 6: Full Platform Verification, Adversarial Red-Team & Static Analysis
- [ ] Run full Vitest verification on Milestone 5 suites:
  - `src/platform/__tests__/evaluation/evaluation-ui-contracts.test.ts`
  - `src/platform/__tests__/evaluation/evaluation-ui-actions.test.ts`
  - `src/platform/__tests__/ui/evaluation-center-ui.test.tsx`
- [ ] Run full Phase 15 regression test battery:
  - Cost intelligence tests (`src/platform/__tests__/cost/`)
  - Continuous evaluation tests (`src/platform/__tests__/evaluation/`)
  - Security & chaos tests (`src/platform/__tests__/security/`)
  - Strategic registry tests (`src/platform/__tests__/registry/`)
- [ ] Run static code analysis:
  - Strict zero-`any` audit (`grep -rn "any" ...`)
  - `NODE_OPTIONS='--max-old-space-size=8192' pnpm typecheck` (verifying 0 errors)
  - `pnpm lint` (verifying errors === 0, warnings <= ceiling)

### Task 7: Architectural Code Review & Program Graduation
- [ ] Dispatch Senior Principal Systems & AI Agentic Architecture Reviewer subagent.
- [ ] Author completion report: `docs/agents_mcp/phases/agents_mcp_phase_15_milestone_5_completion_report.md`.
- [ ] Author code review report: `docs/agents_mcp/phases/agents_mcp_phase_15_milestone_5_code_review.md`.
- [ ] Author Full Program Final Graduation & Production Sign-Off Report certifying completion of Phases 0 through 15.

---

## 7. Definition of Done for Milestone 5 & Platform Graduation

Milestone 5 and the SmartSapp Agentic Transformation Program will be considered complete when:
1. All 7 implementation tasks are fully executed and verified.
2. The Agent Evaluation Center (`/admin/intelligence/evaluation`) renders seamlessly across all 7 views with real-time SSE updates.
3. The 5-Part Quality Cockpit accurately reflects canonical targets (Task Success $\ge 96.2\%$, Tool Correctness $\ge 98.7\%$, Policy Violations $= 0$, Human Correction $\le 4.8\%$).
4. Standardized modals strictly adhere to `theme.md` §8 (demarcated header/footer, single-circle info tooltip at `z-[10050]`, `sr-only` descriptions, tactile buttons).
5. All 53 administrative routes in `AdminSidebar.tsx` remain 100% operational (Rule 69).
6. 100% of test suites pass cleanly with zero regressions.
7. TypeScript static compilation exits with code 0 (`0 errors`).
8. Senior Principal Architectural Code Review certifies production readiness with Grade A.

---

## 8. Review Sign-off & Certification

| Role | Name | Status | Timestamp |
| :--- | :--- | :---: | :--- |
| **Lead Agentic Systems Architect** | AI Architecture Planning Team | **SUBMITTED FOR APPROVAL** | 2026-10-08T20:55:00Z |
| **Senior Principal Systems Architect** | Platform Architecture Board | **PENDING USER APPROVAL** | 2026-10-08T20:55:00Z |
| **Enterprise Platform Operator** | Platform Operations Director | **PENDING USER APPROVAL** | 2026-10-08T20:55:00Z |
