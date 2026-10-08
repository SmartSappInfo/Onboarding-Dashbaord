# SmartSapp Agentic & MCP Transformation: Phase 15 Master Implementation Plan
## Production Hardening, Continuous Evaluation, Cost Intelligence, Model Routing & Enterprise Evaluation Center
### Fully Conforming to `docs/agents_mcp/agents_mcp_rules.md` (Rules 1–69, Rules 1965–1976), `theme.md` §8, `docs/agents_mcp/agents_mcp_ui.md` (3633–3670), and `.agents/AGENTS.md`

**Version:** 2.0.0  
**Status:** DRAFT / PENDING USER APPROVAL (Do not start milestone execution until plan is approved)  
**Date:** 2026-10-08  
**Author:** AI Agentic Architecture Team & Senior Principal Systems Architect  

---

## 1. Executive Summary & Transformation Destination

Across Phases 0 through 14, SmartSapp engineered an enterprise-grade agentic architecture:
- **Phases 0–7:** Foundations, Multi-Tenancy, Contact Identification, CRM Core, RBAC, Approvals, Messaging, Workflows.
- **Phase 8:** Canonical Agentic Runtime, Two-Phase Approval Interceptor, Domain Event Bus, Audit Trail, Dead-Man Pause.
- **Phase 9:** Universal CRM Agent, Account 360° Context Assembler, In-Context Cards, NBA Engine, Risk Detector.
- **Phase 10:** Sales & Lead Intelligence Agent, SDR Sequences, WhatsApp Formulator, Revenue Operations Swarm.
- **Phase 11:** Meetings Intelligence, Audio Pipeline, Grounded Briefs, Knowledge Inbox, Hybrid RAG, Recency Decay, Visual Graph.
- **Phase 12:** Finance & School Operations Agents, 3-Way Reconciliation, Fee Recovery, Attendance Anomaly Detector, School Finance Cockpit.
- **Phase 13:** Multi-Agent Orchestration, Delegated Authority (Depth $\le 3$, Authority Intersection Algebra), Graph Reasoning, Swarm Mesh, Tri-State Circuit Breakers, Reverse-LIFO Saga Rollback, Three-Zone Mission Control.
- **Phase 14:** Verification, Versioning & Health Framework (Postconditions, TOCTOU State Versioning, Universal Saga Matrix, Quarantine DLQ, Discrepancy Engine, Autonomous Healing, Telemetry Core, Execution Inspector, Health Dashboard & Red-Team).

**Phase 15 is the capstone and final phase of the entire SmartSapp Agentic & MCP Transformation Program.**

It transforms SmartSapp from an autonomous agent platform into a **self-benchmarking, cost-governed, progressively discovered, continuous improvement enterprise production platform** where:
1. **Agents are continuously evaluated** against measurable engineering benchmarks (Task Success $\ge 96\%$, Tool Correctness $\ge 98\%$, Policy Violations = 0, Human Correction $\le 5\%$).
2. **AI operations are cost-intelligent** with real-time token telemetry, budget caps, and dynamic model routing (Cheap vs Mid-tier vs High-end) so no token is wasted.
3. **Security is hardened** against adversarial prompt injection, knowledge base poisoning, tool poisoning, and dependency drift with continuous chaos testing.
4. **Operations manage the fleet without code** via Backoffice Agent and Tool Registries (`/admin/settings/ai/agents` & `/admin/settings/ai/capabilities`) and progressive capability discovery.
5. **Quality is visible** in the dedicated **Agent Evaluation Center** (`/admin/intelligence/evaluation`).

---

## 2. Core Architectural Pillars of Phase 15

### 2.1 Continuous Evaluation & Gold-Standard Benchmarking (Rules 44, 46, 59, 1970 & Roadmap §15)
- Automated evaluation harness evaluating:
  - **Task Completion:** Did the agent achieve the verified goal?
  - **Tool Selection (Rule 59):** Did the agent choose the correct capability? Did it call unnecessary tools? Did it over-retrieve? Did it mutate unnecessarily?
  - **Permission & Policy Correctness (Rules 8, 16, 17):** Were all RBAC scopes and non-delegable gates respected?
  - **State Invariant Correctness (Rule 10):** Did post-mutation records satisfy domain invariants?
  - **Evidence & Grounding (Rule 47):** Were all claims supported by citations without hallucinations?
- **Human Baseline vs Agent Baseline Comparison Engine (Roadmap §16):**
  - Measures task completion time (e.g. 17m human vs 2m agent), error rates (8% human vs 1.1% agent), and context consultation breadth (4/9 sources human vs 9/9 sources agent).

### 2.2 Cost Intelligence & Dynamic Model Router (Roadmap §17, §18 & Rules 23, 58)
- **Token & Cost Accounting Core (Rule 23):**
  - Tracks model, provider, prompt tokens, completion tokens, cached tokens, tool calls, execution duration, and estimated USD cost down to the micro-cent.
  - Per-tenant, per-workspace, and per-persona budget ceilings with automatic soft and hard alert thresholds.
- **Dynamic Model Router (Rule 58):**
  - Multi-tier routing policy engine:
    * **Tier 1 (Fast / Low-Cost - e.g. Flash Lite / Haiku):** Intent classification, routing, simple extraction, tag assignments.
    * **Tier 2 (General Reasoning - e.g. Flash / Sonnet):** Planning, summarization, meeting briefs, NBA generation, normal tool reasoning.
    * **Tier 3 (High-End / Complex - e.g. Pro / Opus):** Complex multi-agent DAG synthesis, ambiguous conflict resolution, financial reconciliation discrepancies, final postcondition verification.
  - Evaluates task complexity, context size, latency constraints, canonical risk level (`L0` to `L4`), and budget allowances.

### 2.3 Adversarial Red-Team Battery, Chaos Injection & Drift Defense (Rules 13, 14, 30, 45, 1971–1974 & Roadmap §14)
- **10-Vector Adversarial Injection & Poisoning Suite (Rule 30 & 46):**
  - Email, website, PDF, CRM note, meeting transcript, form field, customer input, MCP server metadata, tool output injection, and knowledge base poisoning.
  - XML reference isolation containerization (`<untrusted_reference_data id="...">`) and linear non-backtracking adversarial directive neutralization (Rules 13 & 30).
- **Chaos Injection Framework (Rule 45 & 1972):**
  - Simulates 429 rate limit backoff, 500 provider timeouts, network latency spikes, concurrent state mutations, and circuit breaker trip cascades.
- **Dependency & Tool-Definition Drift Monitor (Rules 14 & 1974):**
  - SHA-256 tool fingerprinting and automated schema change detection to defend against tool poisoning and rug-pull attacks.

### 2.4 Backoffice Strategic Asset Registries & Progressive Discovery (Rules 28, 35, 56, 61, 69 & Roadmap §21, §22, §23, §25)
- **Enterprise Tool & Capability Registry (`/admin/settings/ai/capabilities`, Roadmap §22):**
  - Authoritative inventory of all capabilities with risk tiers, input/output schemas, permissions, usage counts, failure rates, latency, and costs.
- **Enterprise Agent Registry (`/admin/settings/ai/agents`, Roadmap §23):**
  - Immutable versioned persona catalog (`DealAgent v1.4`, `BillingSpecialist v2.0`) with allowed/denied capabilities, budgets, models, policies, and evaluation suites.
- **Progressive Capability Discovery Engine (Roadmap §21 & Rule 28):**
  - Instead of dumping dozens of tool schemas into context, agents discover tools hierarchically: `domain.search` $\rightarrow$ `entity.get` $\rightarrow$ `entity.mutate`, saving up to 80% of prompt context tokens.
- **Platform Auto-Documentation Generator (Roadmap §25):**
  - Capability definitions compile deterministically into OpenAPI specifications, MCP schemas, Markdown developer documentation, and UI field guides.

### 2.5 Agent Evaluation Center UI & Incident Management (`theme.md` §8 & `agents_mcp_ui.md` 3633–3670, Rules 60–63)
- **Standardized Agent Evaluation Center (`/admin/intelligence/evaluation` & `EvaluationCenterClient.tsx`):**
  - Strict compliance with `theme.md` §8: demarcated headers/footers, single-circle `<CardInfoTooltip text="..." />` at `z-[10050]`, zero raw descriptions, tactile buttons (`rounded-xl active:scale-[0.97] min-h-[44px]`).
- **7-View Cockpit:**
  1. `Benchmarks` (Gold-standard task benchmark run history and pass rates)
  2. `Regression` (Continuous commit-by-commit regression detection)
  3. `Production Quality` (Task success, tool correctness, policy violations, human corrections)
  4. `Failures` (Categorized failure log with root causes and DLQ links)
  5. `Human Corrections` (Review queue overrides, rejected proposals, and edits)
  6. `Cost & Tokens` (Micro-dollar spend, token efficiency, model provider distribution)
  7. `Latency & Performance` (P50/P90/P99 latency distribution across capabilities)
- **Incident Management & Backoffice Emergency Controls (Rules 60 & 61):**
  - Single-click granular kill switches with audit justification modal ($\ge 5$ chars).

---

## 3. Honest Baseline & Pre-existing Asset Re-use (Rule 69 Strangler Fig)

Phase 15 builds upon and synthesizes the existing platform assets:

| Existing Platform Foundation | Location | Status | Phase 15 Orchestration Role |
| :--- | :--- | :--- | :--- |
| **All 26 Agent Personas** | `src/platform/identity/` | Operational | Evaluated continuously across all domains |
| **Unified Capability Gateway** | `src/platform/capabilities/` | Operational | Monitored for tool selection, drift, and cost |
| **Saga Compensation Engine** | `src/platform/verification/saga/` | Operational | Tested under chaos and rollback scenarios |
| **State Versioning Engine** | `src/platform/verification/concurrency/` | Operational | Validated for concurrency race defense |
| **Agent Health Service** | `src/platform/verification/health/` | Operational | Feeds telemetry directly into Quality views |
| **Admin Sidebar Navigation** | `src/app/admin/components/AdminSidebar.tsx` | 52 Routes Active | Mounts `/admin/intelligence/evaluation` and `/admin/settings/ai/*` |
| **Approval Store & Audit Bus** | `src/platform/runtime/` & `src/platform/events/` | Operational | Analyzed for human correction rates |
| **Fields & Variables Service (SSOT)** | `src/lib/services/fields-variables-service.ts` | Operational | Template tag parsing and evaluation verification |
| **Tag Selector (SSOT)** | `src/components/tags/TagSelector.tsx` | Operational | Tag filtering in Evaluation Center |

---

## 4. Master 69-Rules Alignment & Verification Protocol

Phase 15 embeds and verifies compliance across all 69 rules in `docs/agents_mcp/agents_mcp_rules.md`:

| Rule | Requirement | Phase 15 Implementation Mechanism |
| :--- | :--- | :--- |
| **Rule 1** | Best Practice Conformance | Adheres to `next-best-practices`, `vercel-react-best-practices`, `emilkowal-animations`, `frontend-design`. |
| **Rule 2** | FMEA Failure Mode Analysis | Formal FMEA table in §6 covering triggers, severities, and platform resolutions. |
| **Rule 3** | Zero Disruption to Existing Apps | Strangler Fig preserved; Backoffice enabled to control agent systems without code deployments. |
| **Rule 4** | Strict Typing Protocol | Zero `any` or `any[]` throughout all contracts, schemas, and UI components; `unknown` validated at boundaries. |
| **Rule 5** | Staged & Verified Deployment | No unverified automated production rollout; verified locally and via remote CI. |
| **Rule 6** | Dependency Integrity | Uses existing dependencies; verifies SDK versions (`@modelcontextprotocol/server` v2, Zod v4). |
| **Rule 7** | Mobile & Tactile UX | `min-h-[44px]` touch targets, `active:scale-[0.97]` buttons, simple everyday UI English. |
| **Rule 8 / 47** | Multi-Tenant Anti-IDOR Isolation | Scoped `assertTenantContext` across all Server Actions; zero cross-tenant leakage. |
| **Rule 9** | Concurrency & Load Safety | Batch size bounded, sliding window telemetry clamped, rate limit throttles enforced. |
| **Rule 10** | Inline Architectural Pointers | Exhaustive inline comments explaining rationale, invariants, and testability pointers. |
| **Rule 11** | Mathematical Determinism | Token costs, benchmark averages, and error rates computed using `roundCurrency` and exact math. |
| **Rule 12** | Canonical Risk Vocabulary | UI surfaces reflect canonical risk tiers (`L0_READ` to `L4_PRIVILEGED_DESTRUCTIVE`). |
| **Rule 13 / 30** | Prompt Injection XML Containerization | Proof snapshots, adversarial fixtures, and untrusted inputs enclosed in `<untrusted_reference_data>`. |
| **Rule 14 / 1974** | Tool Poisoning & Drift Defense | SHA-256 fingerprinting on capability schemas and MCP tool definitions to detect drift. |
| **Rule 15** | Server Allowlisting | External tool sources and model endpoints strictly validated against whitelist. |
| **Rule 16** | Agent Identity Security Principal | Every benchmark and run explicitly records authorizing user, persona ID, and delegation chain. |
| **Rule 17** | Non-Delegable Human Gate | Incident kill switches and emergency resets strictly restricted to authenticated users (`actor.type === 'user'`). |
| **Rule 18** | TOCTOU Concurrency Guard | Evaluates that optimistic version checks prevent race conditions during continuous evaluations. |
| **Rule 19** | Idempotency Verification | Evaluates that every mutating capability accepts and enforces deterministic idempotency keys. |
| **Rule 20** | Replay Protection | Prevents duplicate delivery during automated benchmark re-runs. |
| **Rule 21** | Formal 6-Step Loop Verification | Benchmarks verify that agents execute Plan, Predict, Execute, Verify, Commit, and Learn. |
| **Rule 22** | Cryptographic Digest Binding | State hashes and proposal payloads verified using canonical key-sorted SHA-256. |
| **Rule 23** | Bounded Resources & Budgets | Per-tenant and per-agent token and cost limits enforced by `BudgetGuardService`. |
| **Rule 24** | Dynamic Circuit Breakers | High failure rate or cost overrun automatically degrades agent to Shadow Mode. |
| **Rule 25** | DLQ Quarantine | Benchmark and runtime failures routed to Dead-Letter Queue with structured error metadata. |
| **Rule 26** | Cooperative Cancellation | Native `AbortSignal` propagated through all evaluation runs and chaos tests. |
| **Rule 27** | Reverse-LIFO Saga Rollback | Evaluates reverse-LIFO rollback correctness under synthetic chaos injection. |
| **Rule 28 / 56** | Context Budgeting & Compression | Stratified Knapsack budgeting ($\le 30,000$ tokens) and progressive discovery token pruning. |
| **Rule 29** | Memory Governance | Fact supersession verified during knowledge evaluation benchmarks. |
| **Rule 31** | Output Validation | Strict Zod v4 validation between every agent step and capability result. |
| **Rule 32 / 33** | Data Exfiltration & Egress Control | Evaluator checks for sensitive PII or credentials leaking in model outputs. |
| **Rule 34** | SSRF & Network Boundary Controls | Disallows arbitrary outbound URLs during tool calls and evaluations. |
| **Rule 35** | MCP Discovery Caching | Progressive discovery caches capabilities with TTL and reactive invalidation. |
| **Rule 36 / 37** | MCP Spec Compatibility | Validates adherence to MCP 2026-07-28 stateless protocol. |
| **Rule 38** | No Deprecated MCP Capabilities | Rejects legacy Roots, Sampling, or Logging abstractions. |
| **Rule 39** | OpenTelemetry Telemetry | Emits structured latency, token, and error spans for every evaluation trace. |
| **Rule 40** | Immutable Audit Log | Every evaluation run, benchmark result, and budget override logged to `defaultEventBus`. |
| **Rule 41** | 4-Part Explainability Grid | WHAT / WHY / EXPECTED vs ACTUAL / RISK embedded in evaluation results. |
| **Rule 42** | Shadow Mode Simulation | Continuous evaluation runner executes with `dryRun: true` (0 live database writes). |
| **Rule 43 / 44** | Replayable Runs & Simulation | Benchmark scenarios are 100% deterministic and replayable. |
| **Rule 45** | Chaos Testing | Milestone 3 introduces synthetic faults (429, 500, jitter, partition cascades). |
| **Rule 46** | Adversarial Testing | Milestone 3 executes 10 dedicated adversarial injection vectors. |
| **Rule 47** | Never Trust the Model | All evaluation scores, benchmarks, and costs are deterministic system evaluations. |
| **Rule 48** | Sanitized Error Taxonomy | Structured error codes in `EVALUATION_ERROR_CODES` with HTTP status mappings. |
| **Rule 49** | Public Resource Isolation | Prevents leakage of private tenant assets in evaluation benchmarks. |
| **Rule 50** | Tenant Cache Isolation | Partitioned cache keys `${orgId}:${wsId}:...` for evaluation datasets and telemetry. |
| **Rule 51** | Server Action Security Gate | Strict `'use server'`, Clerk session auth (`requireAuth()`), Anti-IDOR validation. |
| **Rule 52** | Client/Server Boundary Tests | UI tests assert that Server Actions reject unauthenticated and cross-tenant callers. |
| **Rule 53** | Dependency Governance | Bounded dependency tree; no unverified third-party libraries. |
| **Rule 54** | Performance Budgets | Client bundle limits and Server Action response ceilings strictly monitored. |
| **Rule 55** | Graph & Canvas Limits | Clamped visualization bounds in evaluation charts and topology maps. |
| **Rule 57** | Data Residency & Retention | Telemetry sliding window respects data retention cascades. |
| **Rule 58** | Model Routing Policy | Milestone 2 implements 3-tier model router based on task complexity and budget. |
| **Rule 59** | Tool Selection Evaluation | Specific evaluator checking tool choice accuracy, over-retrieval, and unnecessary mutations. |
| **Rule 60** | Emergency Dead-Man Controls | Fail-closed evaluation via `checkGovernanceDeadManSwitch` on all execution and evaluation actions. |
| **Rule 61** | Backoffice Agent Control Plane | Registries for capabilities, agents, costs, and evaluations operable without code changes. |
| **Rule 62** | Real-Time SSE Reactivity | Real-time updates via `useEventStream` subscribing to `evaluation.*`, `cost.*`, `incident.*`. |
| **Rule 63** | Incident Management | Triage, root cause tracking, and DLQ reprocessing in Evaluation Center. |
| **Rule 64** | 3-Level Feature Flags | System, tenant, and user feature flags governing autonomous capabilities. |
| **Rule 65** | Canary Releases | Gradual traffic shifting and prompt canary pinning evaluated. |
| **Rule 66** | Mandatory 7 Deliverables Gate | Every domain evaluated for all 7 mandatory deliverables (Rules 1940–1953). |
| **Rule 67** | The Agent Implementation Gate | 10-category verification gate verified for all Phase 15 deliverables (§5). |
| **Rule 68** | The Five Non-Negotiables | Strict enforcement of Non-Negotiables 11–15 (§5.2). |
| **Rule 69** | Strangler Fig Invariant | 100% preservation of all 53 preexisting routes and RBAC permissions in `AdminSidebar.tsx`. |
| **Rules 1965–1976** | Phase 15 Production Invariants | Continuous evaluation, adversarial testing, chaos testing, dependency & drift monitoring. |

---

## 5. The Rule 67 Agent Implementation Gate Assessment for Phase 15

Before any Phase 15 deliverable is considered complete, it must satisfy the 10 categories of Rule 67:

```text
1. ARCHITECTURE
□ Canonical Capabilities: Continuous evaluation, model routing, and registry discovery invoke standard CapabilityRegistry.
□ Zero Service Duplication: Reuses AgentHealthService, SagaCompensationStore, and EventBus.
□ Single Source of Truth: Canonical Zod schemas and FieldsVariablesService for template variables.
□ Domain Events: Emits evaluation.run.completed, cost.budget.exceeded, incident.created.

2. AUTHORITY
□ Scoped RBAC: Bound to intelligence:evaluation:view, intelligence:evaluation:manage, system_admin.
□ Allowed Actions: Benchmark execution in dryRun mode, model tier selection, telemetry reads.
□ Forbidden Actions: Production database writes during evaluation (dryRun === true), subagent kill-switch overrides.
□ Delegation Attenuation: Subagents cannot inherit elevated evaluation or kill-switch permissions.

3. DATA
□ Ingress: Gold-standard test inputs, untrusted reference data, provider pricing cards.
□ Egress: Aggregated benchmark metrics, micro-USD costs, sanitised failure summaries.
□ Trusted vs Untrusted: All inputs from external models or fixtures wrapped in <untrusted_reference_data>.
□ Sensitive Data: No PII, bearer tokens, or API keys in evaluation datasets or logs.

4. EXECUTION
□ Idempotency: All evaluation runs use deterministic runId keys (eval_run_${scenarioId}_${timestamp}).
□ Retries: Transient model 429/500 errors retried with exponential backoff and jitter.
□ Cancellation: Cooperative AbortSignal listener on every benchmark and chaos test.
□ Concurrency: Isolated in-memory execution; zero state collisions across parallel benchmark runs.

5. MCP
□ Protocol Spec: 2026-07-28 stateless HTTP protocol.
□ SDK Version: @modelcontextprotocol/server v2.
□ Annotations: Treated strictly as hints; security enforced server-side.
□ Drift Defense: SHA-256 fingerprint verification on tool schemas.

6. FAILURE
□ Timeouts: 30s timeout per scenario with graceful FAIL status reporting.
□ 429 Rate Limits: Caught and handled with backpressure backoff.
□ Provider Downtime: Fallback to static mock datasets during CI test suite execution.
□ DLQ Quarantine: Irrecoverable errors during runs quarantined to DLQ.

7. SECURITY
□ Prompt Injection: 10-vector adversarial injection battery with linear non-backtracking scanning.
□ Tool Poisoning: Schema fingerprint verification detects unauthorized mutations.
□ Confused Deputy: Strict identity binding between authorizing user and agent execution principal.
□ Anti-IDOR: Scoped tenant boundary validation on all Server Actions.

8. OPERATIONS
□ Backoffice Control: Registries at /admin/settings/ai/* and cockpit at /admin/intelligence/evaluation.
□ Replayability: 100% deterministic scenario replay from gold-standard datasets.
□ Rollback: Reverse-LIFO Saga rollback verified under synthetic failures.
□ No-Code Configuration: Thresholds, model router policies, and kill switches configurable via UI.

9. TESTING
□ Battery: Unit, integration, UI, adversarial red-team, and chaos test suites.
□ Pass SLA: 100% test pass rate across all suites before deployment.

10. MIGRATION
□ Strangler Fig: 100% preservation of all 53 preexisting routes in AdminSidebar.tsx.
□ Data Compatibility: Zero schema modifications to production business collections.
```

---

## 6. Failure Modes & Effects Analysis (FMEA - Rule 2)

| Failure Mode | Trigger / Root Cause | Severity | Platform Defense Mechanism | Verification Gate |
| :--- | :--- | :---: | :--- | :--- |
| **FM-1: Evaluation Benchmark Data Contamination** | Benchmark scenario accidentally executes mutating write against live production database. | **CRITICAL** | `ContinuousEvaluationEngine` strictly enforces `dryRun: true` and verifies `liveWritesCount === 0`. If a write is attempted, it throws `EVALUATION_LIVE_WRITE_FORBIDDEN` and fails closed (Rule 42). | Verified in Milestone 1 Red-Team Suite |
| **FM-2: Cost Model Runaway / Token Bomb** | Rogue loop or complex recursive subagent consumes excessive tokens. | **HIGH** | `BudgetGuardService` enforces per-run ($4,000$ tokens) and per-workspace monthly USD caps. Automatically trips circuit breaker and halts execution when threshold is exceeded (Rule 23). | Verified in Milestone 2 Budget Guard Tests |
| **FM-3: Model Routing Provider 500 Outage** | Upstream provider (e.g. Anthropic, OpenAI) suffers API outage or degradation. | **HIGH** | `DynamicModelRouter` catches provider failure, logs error, and dynamically routes to alternative configured provider (e.g. Gemini / DeepSeek) within the same tier without breaking the workflow (Rule 58). | Verified in Milestone 2 Model Router Tests |
| **FM-4: Adversarial Prompt Injection in Evaluation Fixture** | Malicious injection directive embedded in evaluation dataset or customer memo. | **CRITICAL** | Linear non-backtracking regex scanner (`ADVERSARIAL_DIRECTIVE_PATTERNS`) neutralizes prompt instructions; payload enclosed inside `<untrusted_reference_data>` container (Rules 13 & 30). | Verified in Milestone 3 Red-Team Suite |
| **FM-5: Tool Definition Rug-Pull Attack** | Upstream MCP server silently alters tool input schema to exfiltrate parameters. | **CRITICAL** | `ToolDriftMonitor` computes canonical key-sorted SHA-256 fingerprint of tool definition. Rejects execution and triggers Backoffice security incident upon hash mismatch (Rule 14 & 1974). | Verified in Milestone 3 Drift Tests |
| **FM-6: Operator Impulsive Emergency Kill-Switch Toggle** | Operator accidentally clicks kill switch during peak business hours. | **MEDIUM** | Standardized `IncidentManagementModal` (`theme.md` §8) enforces double-confirmation and mandatory $\ge 5$ character audit justification note (Rule 61). | Verified in Milestone 5 UI Tests |
| **FM-7: Context Window Overflow During Tool Discovery** | Agent context overwhelmed by hundreds of capability schemas. | **MEDIUM** | `ProgressiveDiscoveryService` filters tools hierarchically: `domain.search` $\rightarrow$ `entity.get` $\rightarrow$ `entity.mutate`, keeping prompt context $\le 4,000$ tokens (Rule 28). | Verified in Milestone 4 Discovery Tests |

---

## 7. Phase 15 Milestone Breakdown

```
Phase 15: Production Hardening, Evaluation & Continuous Agent Improvement
├── Milestone 1: Continuous Evaluation Engine & Multi-Domain Gold-Standard Benchmark Harness
│   ├── Canonical Evaluation Schemas & Evaluators (Task, Tool, Policy, State, Evidence, Hallucination)
│   ├── 35 Gold-Standard Tasks (5 each across CRM, Sales, Meetings, Knowledge, Finance, School, Supervisor)
│   └── Human Baseline vs Agent Baseline Benchmarking Engine (Speed, Error Rate, Context Breadth)
│
├── Milestone 2: Cost Intelligence, Token Accounting & Dynamic Model Router
│   ├── Unified Token & Cost Accounting Engine (Micro-USD, In/Out Tokens, Cached Tokens, Latency)
│   ├── Multi-Tier Dynamic Model Router (Tier 1 Fast, Tier 2 General, Tier 3 High-End)
│   └── Workspace & Persona Budget Ceilings, Rate Limit Monitors & Exhaustion Circuit Breakers
│
├── Milestone 3: Adversarial Red-Team Battery, Chaos Injection & Dependency Drift Monitor
│   ├── 10-Vector Adversarial Injection & Poisoning Suite (Email, Notes, PDF, Transcripts, MCP, Tools)
│   ├── Chaos Injection Engine (429 Rate Limits, Timeouts, Latency Spikes, Partition Cascades)
│   └── Tool Definition Fingerprinting & Rug-Pull Drift Defense (SHA-256 Schema Verification)
│
├── Milestone 4: Backoffice Strategic Asset Registries: Agent Registry, Tool Registry & Progressive Discovery
│   ├── Enterprise Tool Registry UI & Capability Catalog (/admin/settings/ai/capabilities)
│   ├── Enterprise Agent Registry UI & Immutable Version Catalog (/admin/settings/ai/agents)
│   ├── Progressive Capability Discovery Engine (Hierarchical Intent-Based Tool Loading)
│   └── Platform Auto-Documentation Generator (Capability -> OpenAPI, MCP, Markdown Docs)
│
└── Milestone 5: Agent Evaluation Center UI, Quality Cockpit, Incident Management & Platform Graduation
    ├── Standardized Agent Evaluation Center (/admin/intelligence/evaluation & EvaluationCenterClient)
    ├── 5-Part Quality Cockpit (Task Success 96.2%+, Tool Correctness 98.7%+, Zero Violations, <5% Correction)
    ├── 7-View Navigation (Benchmarks, Regression, Quality, Failures, Human Corrections, Cost, Latency)
    ├── Backoffice Incident Management & Dead-Man Kill Switches (Rule 60 & 61)
    └── Full Program Final Graduation & Production Platform Sign-Off (Phases 0–15)
```

---

### Milestone 1: Continuous Evaluation Engine & Multi-Domain Gold-Standard Benchmark Harness
- **Target Deliverables:**
  1. `src/platform/evaluation/contracts/evaluation-types.ts`: Zod v4 schemas for `EvaluationScenarioSchema`, `EvaluationRunSchema`, `EvaluationMetricScoreSchema`, `BenchmarkComparisonSchema`, and `HumanVsAgentBaselineSchema`.
  2. `src/platform/evaluation/engine/continuous-evaluation-engine.ts`: Core engine executing gold-standard scenarios against agent personas with strict zero-write isolation (`dryRun: true`, Rule 42).
  3. `src/platform/evaluation/evaluators/`:
     - `task-completion-evaluator.ts`: Goal achievement and postcondition verification.
     - `tool-selection-evaluator.ts` (Rule 59): Precision/recall on tool choice, detection of unnecessary calls, missing capabilities, and over-retrieval.
     - `policy-correctness-evaluator.ts`: Scoped RBAC, tenant isolation, non-delegables compliance.
     - `evidence-grounding-evaluator.ts` (Rule 47): Claim-to-citation alignment, hallucination scoring.
  4. `src/platform/evaluation/datasets/gold-standard-catalog.ts`: 35 gold-standard enterprise scenarios (5 each across CRM, Sales, Meetings, Knowledge, Finance, School, Supervisor).
  5. `src/platform/evaluation/benchmarks/human-agent-baseline-service.ts`: Computes comparative efficiency metrics: Task Time ($T_H$ vs $T_A$), Error Rate ($E_H$ vs $E_A$), Context Sources Consulted ($C_H$ vs $C_A$).
  6. Unit & Integration test suites (`src/platform/__tests__/evaluation/continuous-evaluation.test.ts`).

### Milestone 2: Cost Intelligence, Token Accounting & Dynamic Model Router
- **Target Deliverables:**
  1. `src/platform/cost/contracts/cost-types.ts`: Zod v4 schemas for `TokenUsageRecordSchema`, `CostBudgetPolicySchema`, `ModelRoutingDecisionSchema`, `CostAccountingMetricsSchema`.
  2. `src/platform/cost/services/token-cost-accounting-service.ts`: Records prompt/completion/cached tokens, calculates micro-USD costs based on live provider pricing, aggregates spend by persona, workspace, domain, and tool.
  3. `src/platform/cost/routing/dynamic-model-router.ts` (Roadmap §18):
     - Router evaluating task complexity, context size, latency target, canonical risk level (`L0` to `L4`), and budget constraints.
     - Selects optimal tier: `TIER_1_LOW_COST`, `TIER_2_GENERAL_REASONING`, `TIER_3_HIGH_END`.
  4. `src/platform/cost/services/budget-guard-service.ts`: Enforces soft and hard budget caps, tripping circuit breakers or routing to fallback low-cost models when caps are reached (Rule 23).
  5. Unit & Integration test suites (`src/platform/__tests__/cost/cost-accounting-router.test.ts`).

### Milestone 3: Adversarial Red-Team Battery, Chaos Injection & Dependency Drift Monitor
- **Target Deliverables:**
  1. `src/platform/security/adversarial/adversarial-suite-types.ts`: Contracts and attack definitions.
  2. `src/platform/security/adversarial/adversarial-injection-runner.ts`: 10-vector red-team test harness evaluating prompt injection neutralization across email, notes, PDFs, transcripts, form inputs, customer data, MCP metadata, and knowledge poisoning (Rules 13, 30, Roadmap §14).
  3. `src/platform/resilience/chaos/chaos-injection-engine.ts` (Rule 1972):
     - Injects synthetic faults: 429 rate limit spikes, 500 provider timeouts, network latency jitter, concurrent lock contention, and partial failure.
     - Asserts graceful degradation, reverse-LIFO rollback, DLQ quarantine, and zero unhandled exceptions.
  4. `src/platform/security/drift/tool-drift-monitor.ts` (Rules 14 & 1974):
     - SHA-256 fingerprint validation of capability schemas and MCP tool definitions.
     - Alerts on unexpected schema mutations, breaking contract changes, or tool rug-pulls.
  5. Unit & Red-Team test suites (`src/platform/__tests__/security/phase-15-adversarial-chaos.test.ts`).

### Milestone 4: Backoffice Strategic Asset Registries: Agent Registry, Tool Registry & Progressive Discovery
- **Target Deliverables:**
  1. `src/platform/registry/ui/capability-registry-types.ts`: Schemas for capability catalog, version history, usage analytics, and documentation models.
  2. `src/platform/registry/discovery/progressive-discovery-service.ts` (Roadmap §21):
     - Progressive tool filtering and hierarchical discovery preventing prompt context saturation.
     - Emits discoverable tool hints based on agent intent.
  3. `src/platform/registry/docs/platform-doc-generator.ts` (Roadmap §25):
     - Auto-generates OpenAPI, MCP tool schemas, and Markdown references directly from canonical capability definitions.
  4. Server Actions & UI Surfaces (`theme.md` §8):
     - `src/app/admin/settings/ai/capabilities/`: Tool Registry UI with search, domain filtering, risk badges, and error telemetry.
     - `src/app/admin/settings/ai/agents/`: Agent Registry UI with immutable versions, allowed/denied capabilities, and budget settings.
  5. Unit & Integration test suites (`src/platform/__tests__/registry/progressive-discovery.test.ts`).

### Milestone 5: Agent Evaluation Center UI, Quality Cockpit, Incident Management & Platform Graduation
- **Target Deliverables:**
  1. `src/platform/evaluation/ui/evaluation-ui-types.ts`: Schemas for Evaluation Center views, KPI cards, and incident controls.
  2. `src/components/evaluation/`:
     - `AgentQualityKPIHeader.tsx`: Task Success (96.2%+), Tool Correctness (98.7%+), Policy Violations (0), Human Correction (4.8%), Median Runtime.
     - `BenchmarkRunsTable.tsx`: Historical benchmark runs with pass/fail drilldowns.
     - `HumanAgentComparisonCard.tsx`: Visual comparative cards ($T_H$ vs $T_A$, $E_H$ vs $E_A$).
     - `CostLatencyChart.tsx`: Micro-USD cost and latency P50/P90/P99 visualizations.
     - `IncidentManagementModal.tsx`: Standardized modal (`theme.md` §8) for tripping/resetting dead-man switches with $\ge 5$ char justification.
  3. Operations Cockpit Route:
     - `src/app/admin/intelligence/evaluation/page.tsx` & `EvaluationCenterClient.tsx`: Three-Zone mission control with real-time SSE reactivity (`useEventStream`, Rule 62).
  4. `src/app/admin/components/AdminSidebar.tsx`:
     - Mounts `Evaluation Center` under `INTELLIGENCE` with `Award` / `BarChart3` icon.
     - Preserves 100% of all 53 existing navigation routes (Rule 69 Strangler Invariant).
  5. Full Verification Battery: Unit, integration, UI, and red-team test suites.
  6. Phase 15 Completion Report & Senior Principal Architectural Code Review.
  7. **Full Program Sign-Off & Platform Production Graduation (Phases 0–15)**.

---

## 8. Definition of Done for Phase 15 & Platform Graduation

Phase 15 and the full SmartSapp Agentic Transformation Program will be considered complete and production-graduated when:
1. **100% of Phase 15 Milestones (M1–M5)** are implemented and verified.
2. **Gold-Standard Benchmarks Pass:** All 35 enterprise scenarios across 7 domains evaluate cleanly with measurable metrics.
3. **Quality Cockpit SLA Met:** Task success $\ge 96\%$, tool correctness $\ge 98\%$, zero policy violations, human corrections $\le 5\%$.
4. **Adversarial & Chaos Batteries:** 100% pass rate across the 10-vector injection suite and chaos fault injections.
5. **Static Analysis & Type Integrity:**
   - Zero `any` or `any[]` across all code.
   - Clean TypeScript compilation (`NODE_OPTIONS='--max-old-space-size=8192' pnpm typecheck`).
   - Clean ESLint analysis within calibrated threshold (`pnpm lint`).
6. **Platform Verification Battery:** Zero test regressions across the 1,200+ test files and 9,200+ tests in the repository.
7. **Architectural Sign-off:** Comprehensive Senior Principal Architectural Code Review with Final Production Grade A.
