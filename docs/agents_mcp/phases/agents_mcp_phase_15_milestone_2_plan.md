# SmartSapp Agentic & MCP Transformation: Phase 15 Milestone 2 Plan
## Cost Intelligence, Token Accounting & Dynamic Model Router
### Fully Conforming to `docs/agents_mcp/agents_mcp_rules.md` (Rules 1–69, Rules 1965–1976), Rule 67 Agent Implementation Gate, Rule 68 Five Non-Negotiables, Rule 69 Strangler Fig Pattern, and `theme.md` §8

**Version:** 2.0.0  
**Status:** DRAFT / PENDING USER APPROVAL (Do not start execution until plan is approved)  
**Date:** 2026-10-08  
**Author:** AI Agentic Architecture Team & Senior Principal Systems Architect  
**Git Branch:** `main`

---

## 1. Goal & Milestone Overview

Milestone 2 delivers the enterprise **Cost Intelligence, Real-Time Token Accounting, and Multi-Tier Dynamic Model Router** for the SmartSapp platform, operationalizing the architectural mandate of `docs/agents_mcp/agents_mcp_roadmap.md` (§18 Model Routing) and embedding full compliance with `docs/agents_mcp/agents_mcp_rules.md` (Rules 1–69, specifically Rules 11, 12, 14, 16, 17, 22, 23, 24, 27, 40, 48, 51, 57, 58, 60, 67, 68, 69, and Rules 1940–1953).

Prior to Milestone 2, token spend tracking was decentralized across ad-hoc telemetry logs, and agent personas were either hardcoded to single models or lacked automated cost-efficiency routing. Furthermore, rogue agent loops or recursive subagent task trees risked unmonitored monetary overruns.

Milestone 2 resolves these operational vulnerabilities by establishing:
1. **Mathematical Micro-USD Token Accounting (`TokenCostAccountingService`)**:
   - Exact integer arithmetic ($1\text{ USD} = 1,000,000\text{ micro-USD}$) ensuring zero floating-point rounding drift (Rule 11).
   - Real-world provider pricing cards across all major models (Anthropic, OpenAI, Google, DeepSeek).
   - Real-time aggregation by persona, workspace, domain, tier, and provider with sliding window support.
   - Dual-write domain event publishing (`cost.usage.recorded`) to `defaultEventBus` (Rule 40).
2. **6-Factor Multi-Tier Dynamic Model Router (`DynamicModelRouter`)**:
   - Balances **Task Complexity** (LOW/MEDIUM/HIGH/CRITICAL), **Risk Ceiling** (`L0_READ` to `L4_PRIVILEGED_DESTRUCTIVE`), **Context Window Tokens**, **Latency SLA**, **Budget Utilization**, and **Data Residency** (Rule 57 & Rule 58).
   - 3 canonical tiers: `TIER_1_LOW_COST`, `TIER_2_GENERAL_REASONING`, `TIER_3_HIGH_END`.
   - Multi-provider fallback routing resilience: ordered fallback models prevent task failure during upstream provider 429 rate limits or 500 outages (FM-3 & Rule 24).
   - Canonical SHA-256 `decisionHash` binding for auditable provenance (Rule 22).
3. **Proactive Budget Guard & Circuit Breaker Engine (`BudgetGuardService`)**:
   - Soft threshold alerts ($\ge 80\%$ spend) emitting `cost.budget.soft_limit_reached`.
   - Hard cap actions at $\ge 100\%$:
     * `HALT`: Trips circuit breaker and throws `COST_BUDGET_EXCEEDED` (HTTP 403).
     * `DEGRADE_TIER`: Automatically forces model routing down to `TIER_1_LOW_COST`.
     * `REQUIRE_APPROVAL`: Staged proposal approval required before executing mutating capabilities.
   - Emergency dead-man switch evaluation (`checkGovernanceDeadManSwitch`) failing closed (Rule 60).
4. **The 4 Governance Matrices (Rules 1940–1953)**:
   - `COST_PERMISSION_MATRIX`, `COST_TOOL_MATRIX`, `COST_FAILURE_MATRIX`, `COST_ROLLBACK_MATRIX`.
   - Non-delegable protection on budget mutations (`cost.set_budget_policy` requires `actor.type === 'user'`, Rule 17).
5. **Governed Next.js 15 Server Actions (`src/app/actions/cost-actions.ts`)**:
   - Gated by Clerk session auth (`requireAuth()`), Anti-IDOR validation (`assertTenantAccess`), and emergency dead-man pause evaluation (Rule 60).

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    COST INTELLIGENCE & MODEL ROUTING PIPELINE                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │ Agent Execution Request (Persona, Task, Context, Risk, Domain, Org, Ws) │   │
│   └───────────────────────────────────┬─────────────────────────────────────┘   │
│                                       │                                         │
│                                       ▼                                         │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │ BudgetGuardService.assertBudgetAvailable()                              │   │
│   │ • Soft Limit Alert (>= 80% spend) -> EventBus (Rule 40)                 │   │
│   │ • Hard Cap (>= 100% spend) -> HALT (403) / DEGRADE_TIER / APPROVAL      │   │
│   │ • Fail-Closed Dead-Man Check (Rule 60)                                  │   │
│   └───────────────────────────────────┬─────────────────────────────────────┘   │
│                                       │                                         │
│                                       ▼                                         │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │ DynamicModelRouter.routeModel() (Roadmap §18 & Rule 58)                 │   │
│   │ • Factor 1: Task Complexity (LOW -> T1, MED -> T2, HIGH/CRIT -> T3)    │   │
│   │ • Factor 2: Risk Ceiling (L0 -> T1, L1/L2 -> T2, L3/L4 -> T3)           │   │
│   │ • Factor 3: Context Size (> 30k -> Long Context Models)                 │   │
│   │ • Factor 4: Latency SLA (< 1000ms -> Fast Models)                       │   │
│   │ • Factor 5: Budget Status (Near cap -> Auto-downscale to T1)            │   │
│   │ • Factor 6: Data Residency & Allowed Providers (Rule 57)                │   │
│   │ • SHA-256 Decision Hash (Rule 22) + Ordered Multi-Provider Fallbacks    │   │
│   └───────┬───────────────────────────┼───────────────────────────┬─────────┘   │
│           │                           │                           │             │
│           ▼                           ▼                           ▼             │
│   ┌───────────────┐           ┌───────────────┐           ┌───────────────┐     │
│   │    TIER 1     │           │    TIER 2     │           │    TIER 3     │     │
│   │   Low Cost    │           │ General Reason│           │   High End    │     │
│   │ Gemini Flash  │           │ Sonnet 3.5    │           │ Claude 3 Opus │     │
│   │ Haiku 3.5     │           │ GPT-4o        │           │ o1-preview    │     │
│   │ GPT-4o-mini   │           │ Gemini Pro    │           │ DeepSeek-R1   │     │
│   │ DeepSeek-V3   │           │               │           │               │     │
│   └───────┬───────┘           └───────┬───────┘           └───────┬───────┘     │
│           │                           │                           │             │
│           └───────────────────────────┼───────────────────────────┘             │
│                                       │                                         │
│                                       ▼                                         │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │ TokenCostAccountingService.recordUsage()                                │   │
│   │ • Integer Micro-USD: (Prompt*In + Comp*Out + Cache*CacheRate) / 1M      │   │
│   │ • Multi-Dimensional Aggregations (Persona, Domain, Workspace, Provider) │   │
│   │ • Domain Event: cost.usage.recorded -> defaultEventBus (Rule 40)        │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Complete Master 69-Rules Alignment & Verification Matrix

Milestone 2 implements and embeds direct compliance across all 69 rules in `docs/agents_mcp/agents_mcp_rules.md`:

| Rule | Rule Title | Specific Phase 15 Milestone 2 Implementation Mechanism | Verification File & Test Evidence |
| :--- | :--- | :--- | :--- |
| **Rule 1** | Best Practice Conformance | Conforms to Next.js best practices, Emil Kowalski animations, frontend-design, and backend-design. | `token-cost-accounting-service.ts` |
| **Rule 2** | FMEA Risk Analysis | Formal FMEA table in §10 analyzing token bomb overruns, provider outages, and pricing calculation drift. | `cost-types.ts` & Plan §10 |
| **Rule 3** | Zero Disruption | Strangler Fig Pattern: all 53 existing navigation routes and pre-existing domain engines preserved without modification. | Regression verification suites |
| **Rule 4** | Strict Typing Protocol | Zero `any` or `any[]` throughout all contracts, schemas, services, and actions. `unknown` validated at trust boundaries with Zod v4. | `cost-contracts.test.ts` |
| **Rule 5** | Staged & Verified Deployment | No unverified production deployment. Static typecheck and linting executed on GitHub Actions CI. | `cost-capabilities-and-actions.test.ts` |
| **Rule 6** | Dependency Integrity | Zero unvetted third-party packages. Uses existing project versions of `@modelcontextprotocol/server` v2 and Zod v4. | `package.json` |
| **Rule 7** | Mobile & Tactile UX | Min `44px` touch targets, tactile `active:scale-[0.97]` buttons, simple everyday UI English in cost views. | `cost-types.ts` |
| **Rule 8 / 47** | Anti-IDOR & Multi-Tenancy | `assertTenantAccess` enforced across all Server Actions. Partitioned tenant metric queries prevent cross-tenant leakage. | `cost-capabilities-and-actions.test.ts` |
| **Rule 9** | Concurrency & Load Safety | Thread-safe aggregation in in-memory state; bounded sliding window calculations. | `token-cost-accounting.test.ts` |
| **Rule 10** | Error Taxonomy & Inline Pointers | Canonical `COST_ERROR_CODES` with typed `CostDomainError` class and HTTP status mappings. | `cost-types.ts` |
| **Rule 11** | Mathematical Determinism | Precision integer micro-USD arithmetic ($1\text{ USD} = 1,000,000\text{ micro-USD}$) ensuring 0 floating-point rounding drift. | `token-cost-accounting.test.ts` |
| **Rule 12** | Canonical Risk Vocabulary | Model routing factors in canonical risk tiers (`L0_READ` to `L4_PRIVILEGED_DESTRUCTIVE`). | `dynamic-model-router.test.ts` |
| **Rule 13 / 30** | Prompt Injection Defense | Routing rationale and metadata sanitized and containerized in `<untrusted_reference_data>`. | `dynamic-model-router.ts` |
| **Rule 14 / 1974** | Tool Poisoning / Drift Defense | Dynamic model router decisions bind to canonical SHA-256 `decisionHash`. | `dynamic-model-router.test.ts` |
| **Rule 15** | Server Allowlisting | External tool sources and model endpoints strictly validated against whitelist. | `model-pricing-registry.ts` |
| **Rule 16** | Explicit RBAC Scopes | Canonical permissions `cost:read` and `cost:manage` mapped in `permission-refs.ts`. | `permission-refs.ts`, `cost-capabilities.ts` |
| **Rule 17** | Non-Delegable Human Gate | Budget cap policy modifications (`cost.set_budget_policy`) strictly restricted to authenticated human users (`actor.type === 'user'`). | `cost-capabilities.ts` |
| **Rule 18** | TOCTOU Concurrency Guard | Optimistic timestamp and version checks prevent race conditions during budget updates. | `budget-guard-service.ts` |
| **Rule 19** | Idempotency Verification | Token usage records enforce deterministic `id` (`usage_${runId}_${timestamp}`). | `token-cost-accounting.test.ts` |
| **Rule 20** | Replay Protection | Prevents duplicate delivery during automated usage recording. | `token-cost-accounting-service.ts` |
| **Rule 21** | Formal 6-Step Loop Verification | Cost intelligence measures token burn and latency across Plan, Predict, Execute, Verify, Commit, and Learn. | `token-cost-accounting-service.ts` |
| **Rule 22** | Cryptographic Digest Binding | Canonical SHA-256 hash computed over model routing input/output parameters. | `dynamic-model-router.test.ts` |
| **Rule 23** | Bounded Resources & Budgets | Per-tenant, per-workspace, and per-persona soft and hard budget caps enforced by `BudgetGuardService`. | `budget-guard.test.ts` |
| **Rule 24** | Dynamic Circuit Breakers | Hard budget caps automatically trip execution or degrade model tier to prevent cost runaway. | `budget-guard.test.ts` |
| **Rule 25** | DLQ Quarantine | Cost overruns and rejected executions recorded in dead-letter format with structured error metadata. | `budget-guard-service.ts` |
| **Rule 26** | Cooperative Cancellation | Native `AbortSignal` supported in routing decisions and token recording pipelines. | `dynamic-model-router.ts` |
| **Rule 27** | Saga Rollback Compensation | `COST_ROLLBACK_MATRIX` registers compensation for budget policy mutations. | `cost-types.ts` |
| **Rule 28 / 56** | Context Budgeting & Compression | Model router evaluates context token payload, routing $>30,000$ tokens to models with large windows. | `dynamic-model-router.test.ts` |
| **Rule 29** | Memory Governance | Cost tracking attributes embedding and memory retrieval token overheads. | `token-cost-accounting-service.ts` |
| **Rule 31** | Output Validation | Strict Zod v4 validation on all cost inputs, outputs, usage records, and routing decisions. | `cost-contracts.test.ts` |
| **Rule 32 / 33** | Data Exfiltration & Egress Control | Evaluator checks for sensitive PII or credentials leaking in model outputs. | `dynamic-model-router.ts` |
| **Rule 34** | SSRF & Network Boundary Controls | Disallows arbitrary outbound URLs during model invocations and evaluations. | `model-pricing-registry.ts` |
| **Rule 35** | MCP Discovery Caching | Progressive discovery caches capabilities with TTL and reactive invalidation. | `cost-capabilities.ts` |
| **Rule 36 / 37** | MCP Spec Compatibility | Validates adherence to MCP 2026-07-28 stateless protocol. | `cost-capabilities.ts` |
| **Rule 38** | No Deprecated MCP Capabilities | Rejects legacy Roots, Sampling, or Logging abstractions. | `cost-capabilities.ts` |
| **Rule 39** | OpenTelemetry Telemetry | Emits structured latency, token, and error spans for every cost and routing trace. | `token-cost-accounting-service.ts` |
| **Rule 40** | Immutable Audit Log | Emits `cost.usage.recorded` and `cost.budget.soft_limit_reached` to `defaultEventBus`. | `token-cost-accounting.test.ts` |
| **Rule 41** | 4-Part Explainability Grid | WHAT / WHY / EXPECTED vs ACTUAL / RISK embedded in routing decisions. | `dynamic-model-router.ts` |
| **Rule 42** | Shadow Mode Simulation | Cost simulation engine runs with `dryRun: true` and verifies zero live financial commits. | `budget-guard-service.ts` |
| **Rule 43 / 44** | Replayable Runs & Simulation | Routing decisions are 100% deterministic, seedable, and replayable. | `dynamic-model-router.test.ts` |
| **Rule 45** | Chaos Testing | Simulates provider 429/500 errors to verify automatic fallback routing. | `dynamic-model-router.test.ts` |
| **Rule 46** | Adversarial Agent Testing | Verifies budget cap enforcement against rogue infinite loop attempts. | `budget-guard.test.ts` |
| **Rule 47** | Never Trust the Model | All costs, token calculations, and routing choices are deterministic system code, not model self-estimates. | `src/platform/cost/services/` |
| **Rule 48** | Sanitized Error Taxonomy | Structured error codes in `COST_ERROR_CODES` with HTTP status mappings. | `cost-types.ts` |
| **Rule 49** | Public Resource Isolation | Prevents leakage of private tenant assets in cost analytics. | `cost-actions.ts` |
| **Rule 50** | Tenant Cache Isolation | Partitioned cache keys `${orgId}:${wsId}:...` for cost datasets and telemetry. | `token-cost-accounting-service.ts` |
| **Rule 51** | Server Action Security Gate | Strict `'use server'`, Clerk session auth (`requireAuth()`), Anti-IDOR validation. | `cost-actions.ts` |
| **Rule 52** | Client/Server Boundary Tests | UI tests assert that Server Actions reject unauthenticated and cross-tenant callers. | `cost-capabilities-and-actions.test.ts` |
| **Rule 53** | Dependency Governance | Bounded dependency tree; no unverified third-party libraries. | `package.json` |
| **Rule 54** | Performance Budgets | Client bundle limits and Server Action response ceilings strictly monitored. | `cost-actions.ts` |
| **Rule 55** | Graph & Canvas Limits | Clamped visualization bounds in evaluation charts and topology maps. | `cost-types.ts` |
| **Rule 57** | Data Residency & Retention | Model routing restricts providers based on tenant data residency compliance. | `dynamic-model-router.ts` |
| **Rule 58** | Model Routing Policy | Multi-tier dynamic router balancing complexity, context size, latency, risk, budget, and domain. | `dynamic-model-router.test.ts` |
| **Rule 60** | Emergency Dead-Man Controls | `checkGovernanceDeadManSwitch` halts budget policy updates during active incidents. | `budget-guard.test.ts`, `cost-actions.ts` |
| **Rule 61** | Backoffice Agent Control Plane | Registries for capabilities, agents, costs, and evaluations operable without code changes. | `cost-actions.ts` |
| **Rule 62** | Real-Time SSE Reactivity | Real-time updates via `useEventStream` subscribing to `cost.*`. | `cost-actions.ts` |
| **Rule 63** | Incident Management | Triage, root cause tracking, and DLQ reprocessing in Evaluation Center. | `budget-guard-service.ts` |
| **Rule 64** | 3-Level Feature Flags | System, tenant, and user feature flags governing autonomous capabilities. | `dynamic-model-router.ts` |
| **Rule 65** | Canary Releases | Gradual traffic shifting and prompt canary pinning evaluated. | `dynamic-model-router.ts` |
| **Rule 66** | Mandatory 7 Deliverables Gate | Every domain evaluated for all 7 mandatory deliverables (Rules 1940–1953). | Phase 15 Master Plan |
| **Rule 67** | The Agent Implementation Gate | 10-category verification gate verified for all Milestone 2 deliverables (§11). | Plan §11 |
| **Rule 68** | The Five Non-Negotiables | Strict typing, anti-IDOR isolation, bounded budgets, prompt injection isolation, dead-man gating. | Plan §12 |
| **Rule 69** | Strangler Fig Invariant | 100% preservation of all 53 preexisting routes and RBAC permissions in `AdminSidebar.tsx`. | AdminSidebar test suite |
| **Rules 1940–1953** | 4 Governance Matrices | `COST_PERMISSION_MATRIX`, `COST_TOOL_MATRIX`, `COST_FAILURE_MATRIX`, `COST_ROLLBACK_MATRIX`. | `cost-types.ts` |

---

## 3. The 4 Mandatory Governance Matrices for Cost & Routing (Rules 1940–1953)

### 3.1 Cost Permission Matrix (Rule 16)
```typescript
export const COST_PERMISSION_MATRIX: Readonly<Record<string, readonly string[]>> = {
  admin_user: [
    'cost:read',
    'cost:manage',
    'workspace:read',
    'workspace:manage',
    'system_admin',
  ],
  operator: [
    'cost:read',
    'cost:manage',
    'workspace:read',
  ],
  supervisor: [
    'cost:read',
    'workspace:read',
  ],
  autonomous_agent: [
    'cost:read',
    'workspace:read',
  ],
};
```
*Invariants:* Autonomous subagents and agent personas hold `cost:read` to evaluate routing decisions and budget availability, but are strictly forbidden from modifying budget caps (`cost:manage`).

### 3.2 Cost Tool Matrix (Rule 12 & Rule 14)
```typescript
export const COST_TOOL_MATRIX: Readonly<Record<string, {
  readonly level: 'L0_READ' | 'L1_INTERNAL_DRAFT' | 'L2_STATE_MUTATION' | 'L3_EXTERNAL_COMMUNICATION_FINANCE' | 'L4_PRIVILEGED_DESTRUCTIVE';
  readonly dryRunOnly: boolean;
  readonly nonDelegable: boolean;
  readonly requiresIdempotencyKey: boolean;
}>> = {
  'cost.record_usage': {
    level: 'L0_READ',
    dryRunOnly: false,
    nonDelegable: false,
    requiresIdempotencyKey: true,
  },
  'cost.get_metrics': {
    level: 'L0_READ',
    dryRunOnly: false,
    nonDelegable: false,
    requiresIdempotencyKey: false,
  },
  'cost.route_model': {
    level: 'L0_READ',
    dryRunOnly: false,
    nonDelegable: false,
    requiresIdempotencyKey: false,
  },
  'cost.check_budget': {
    level: 'L0_READ',
    dryRunOnly: false,
    nonDelegable: false,
    requiresIdempotencyKey: false,
  },
  'cost.set_budget_policy': {
    level: 'L2_STATE_MUTATION',
    dryRunOnly: false,
    nonDelegable: true, // Rule 17: User only
    requiresIdempotencyKey: true,
  },
};
```

### 3.3 Cost Failure Matrix (Rule 2 & Rule 48)
```typescript
export const COST_FAILURE_MATRIX: Readonly<Record<string, 'FAIL_CLOSED' | 'CIRCUIT_BREAKER_BACKOFF' | 'DEGRADE_TO_TIER_1' | 'RETRY_WITH_BACKOFF'>> = {
  COST_BUDGET_EXCEEDED: 'FAIL_CLOSED',
  COST_RATE_LIMIT_EXCEEDED: 'CIRCUIT_BREAKER_BACKOFF',
  COST_INVALID_MODEL_TIER: 'DEGRADE_TO_TIER_1',
  COST_PRICING_NOT_FOUND: 'FAIL_CLOSED',
  COST_IDOR_VIOLATION: 'FAIL_CLOSED',
  COST_DEAD_MAN_PAUSED: 'CIRCUIT_BREAKER_BACKOFF',
  COST_VALIDATION_ERROR: 'FAIL_CLOSED',
  INTERNAL_ERROR: 'FAIL_CLOSED',
};
```

### 3.4 Cost Rollback Matrix (Rule 27)
```typescript
export const COST_ROLLBACK_MATRIX: Readonly<Record<string, string | null>> = {
  'cost.record_usage': null, // Telemetry log; no rollback
  'cost.get_metrics': null, // Read-only query
  'cost.route_model': null, // Pure routing decision
  'cost.check_budget': null, // Read-only query
  'cost.set_budget_policy': 'cost.revert_budget_policy', // Compensating Saga rollback
};
```

---

## 4. The 3-Tier Model Architecture & Provider Rate Cards (§18 & Rule 58)

### 4.1 Canonical Model Tiers
- **`TIER_1_LOW_COST` (Fast / Low-Cost / High-Throughput):**
  - Use cases: Ingestion classification, sentiment extraction, token counting, candidate deduplication, simple retrieval re-ranking, basic entity extraction.
  - Latency target: $< 800$ms.
  - Typical models: Google Gemini 1.5 Flash, Anthropic Claude 3.5 Haiku, OpenAI GPT-4o-mini, DeepSeek-V3.
- **`TIER_2_GENERAL_REASONING` (Balanced Intelligence / State Mutation):**
  - Use cases: CRM Account 360 brief synthesis, SDR sales reply drafting, 3-way invoice reconciliation, student attendance correlation, meeting action extraction.
  - Latency target: $1,500\text{ms} - 3,500\text{ms}$.
  - Typical models: Anthropic Claude 3.5 Sonnet, OpenAI GPT-4o, Google Gemini 1.5 Pro.
- **`TIER_3_HIGH_END` (Complex Multi-Agent Planning / Autonomous Auditing / High-Risk):**
  - Use cases: Cross-domain supervisor mission decomposition, reverse-LIFO Saga compensation planning, topological DAG scheduling, financial discrepancy forensic investigation.
  - Latency target: $5,000\text{ms} - 15,000\text{ms}$.
  - Typical models: Anthropic Claude 3 Opus, OpenAI o1-preview, DeepSeek-R1.

### 4.2 Verified Provider Rate Cards (in Micro-USD per Million Tokens: $1\text{ USD} = 1,000,000\text{ micro-USD}$)
```typescript
export const AUTHORITATIVE_MODEL_PRICING: readonly ModelPricingCard[] = [
  // TIER 1: Low-Cost / Fast Models
  {
    modelId: 'google/gemini-1.5-flash',
    provider: 'google',
    tier: 'TIER_1_LOW_COST',
    inputCostPerMillionMicroUSD: 75_000,      // $0.075 / 1M
    outputCostPerMillionMicroUSD: 300_000,     // $0.30 / 1M
    cachedInputCostPerMillionMicroUSD: 18_750, // $0.01875 / 1M
    contextWindowTokens: 1_000_000,
    maxOutputTokens: 8_192,
    active: true,
  },
  {
    modelId: 'anthropic/claude-3-5-haiku',
    provider: 'anthropic',
    tier: 'TIER_1_LOW_COST',
    inputCostPerMillionMicroUSD: 800_000,     // $0.80 / 1M
    outputCostPerMillionMicroUSD: 4_000_000,   // $4.00 / 1M
    cachedInputCostPerMillionMicroUSD: 80_000, // $0.08 / 1M
    contextWindowTokens: 200_000,
    maxOutputTokens: 8_192,
    active: true,
  },
  {
    modelId: 'openai/gpt-4o-mini',
    provider: 'openai',
    tier: 'TIER_1_LOW_COST',
    inputCostPerMillionMicroUSD: 150_000,     // $0.15 / 1M
    outputCostPerMillionMicroUSD: 600_000,     // $0.60 / 1M
    cachedInputCostPerMillionMicroUSD: 75_000, // $0.075 / 1M
    contextWindowTokens: 128_000,
    maxOutputTokens: 16_384,
    active: true,
  },
  {
    modelId: 'deepseek/deepseek-v3',
    provider: 'deepseek',
    tier: 'TIER_1_LOW_COST',
    inputCostPerMillionMicroUSD: 140_000,     // $0.14 / 1M
    outputCostPerMillionMicroUSD: 280_000,     // $0.28 / 1M
    cachedInputCostPerMillionMicroUSD: 14_000, // $0.014 / 1M
    contextWindowTokens: 64_000,
    maxOutputTokens: 8_000,
    active: true,
  },

  // TIER 2: General Reasoning
  {
    modelId: 'anthropic/claude-3-5-sonnet',
    provider: 'anthropic',
    tier: 'TIER_2_GENERAL_REASONING',
    inputCostPerMillionMicroUSD: 3_000_000,    // $3.00 / 1M
    outputCostPerMillionMicroUSD: 15_000_000,  // $15.00 / 1M
    cachedInputCostPerMillionMicroUSD: 300_000,// $0.30 / 1M
    contextWindowTokens: 200_000,
    maxOutputTokens: 8_192,
    active: true,
  },
  {
    modelId: 'openai/gpt-4o',
    provider: 'openai',
    tier: 'TIER_2_GENERAL_REASONING',
    inputCostPerMillionMicroUSD: 2_500_000,    // $2.50 / 1M
    outputCostPerMillionMicroUSD: 10_000_000,  // $10.00 / 1M
    cachedInputCostPerMillionMicroUSD: 1_250_000, // $1.25 / 1M
    contextWindowTokens: 128_000,
    maxOutputTokens: 16_384,
    active: true,
  },
  {
    modelId: 'google/gemini-1.5-pro',
    provider: 'google',
    tier: 'TIER_2_GENERAL_REASONING',
    inputCostPerMillionMicroUSD: 1_250_000,    // $1.25 / 1M
    outputCostPerMillionMicroUSD: 5_000_000,   // $5.00 / 1M
    cachedInputCostPerMillionMicroUSD: 312_500,// $0.3125 / 1M
    contextWindowTokens: 2_000_000,
    maxOutputTokens: 8_192,
    active: true,
  },

  // TIER 3: High-End / Complex Reasoning / Audit
  {
    modelId: 'anthropic/claude-3-opus',
    provider: 'anthropic',
    tier: 'TIER_3_HIGH_END',
    inputCostPerMillionMicroUSD: 15_000_000,   // $15.00 / 1M
    outputCostPerMillionMicroUSD: 75_000_000,  // $75.00 / 1M
    cachedInputCostPerMillionMicroUSD: 1_500_000, // $1.50 / 1M
    contextWindowTokens: 200_000,
    maxOutputTokens: 4_096,
    active: true,
  },
  {
    modelId: 'openai/o1-preview',
    provider: 'openai',
    tier: 'TIER_3_HIGH_END',
    inputCostPerMillionMicroUSD: 15_000_000,   // $15.00 / 1M
    outputCostPerMillionMicroUSD: 60_000_000,  // $60.00 / 1M
    cachedInputCostPerMillionMicroUSD: 7_500_000, // $7.50 / 1M
    contextWindowTokens: 128_000,
    maxOutputTokens: 32_768,
    active: true,
  },
  {
    modelId: 'deepseek/deepseek-r1',
    provider: 'deepseek',
    tier: 'TIER_3_HIGH_END',
    inputCostPerMillionMicroUSD: 550_000,      // $0.55 / 1M
    outputCostPerMillionMicroUSD: 2_190_000,   // $2.19 / 1M
    cachedInputCostPerMillionMicroUSD: 140_000,// $0.14 / 1M
    contextWindowTokens: 64_000,
    maxOutputTokens: 8_000,
    active: true,
  },
];
```

---

## 5. Mathematical Determinism & Micro-USD Token Accounting Formula (Rule 11)

### 5.1 Deterministic Integer Micro-USD Arithmetic
To prevent floating-point calculation drift across financial reporting, all monetary valuations in SmartSapp are represented as non-negative integer micro-USD:
$$\text{Cost}_{\mu\text{USD}} = \text{round}\left( \frac{\text{promptTokens} \cdot R_{\text{in}} + \text{completionTokens} \cdot R_{\text{out}} + \text{cachedTokens} \cdot R_{\text{cache}}}{1,000,000} \right)$$
where $R_{\text{in}}, R_{\text{out}}, R_{\text{cache}}$ are the rates in micro-USD per million tokens.

Example for Claude 3.5 Sonnet:
- 1,200 prompt tokens ($R_{\text{in}} = 3,000,000$)
- 400 completion tokens ($R_{\text{out}} = 15,000,000$)
- 0 cached tokens
$$\text{Cost}_{\mu\text{USD}} = \text{round}\left( \frac{1200 \times 3,000,000 + 400 \times 15,000,000}{1,000,000} \right) = \text{round}(3,600 + 6,000) = 9,600\text{ micro-USD} = \$0.0096$$

---

## 6. The 6-Factor Dynamic Model Routing Algorithm (Roadmap §18 & Rule 58)

The `DynamicModelRouter` implements a deterministic 6-factor decision algebra:

$$\text{Tier}_{\text{target}} = f(\text{Complexity}, \text{Risk}, \text{ContextTokens}, \text{LatencySLA}, \text{BudgetStatus}, \text{DataResidency})$$

1. **Complexity Factor:**
   - `LOW` $\rightarrow$ Base Tier 1
   - `MEDIUM` $\rightarrow$ Base Tier 2
   - `HIGH` or `CRITICAL` $\rightarrow$ Base Tier 3
2. **Risk Ceiling Invariant (Rule 12):**
   - If `riskLevel === 'L3_EXTERNAL_COMMUNICATION_FINANCE'` or `'L4_PRIVILEGED_DESTRUCTIVE'`, tier floor is strictly clamped to $\ge \text{TIER\_2}$.
3. **Context Window Token Constraint (Rule 28 & 56):**
   - If estimated tokens $> 30,000$, select candidate models whose `contextWindowTokens \ge 128,000` (e.g. Gemini 1.5 Pro / Flash or Claude 3.5 Sonnet).
4. **Latency Target:**
   - If `latencyTargetMs \le 1,000`, prioritize high-throughput Tier 1 models (Flash / Haiku / 4o-mini).
5. **Budget Overrun Downscaling (Rule 23):**
   - If workspace budget utilization $\ge 90\%$ and task risk $\le \text{L2}$, automatically downscale target tier to `TIER_1_LOW_COST`.
6. **Data Residency & Provider Filtering (Rule 57):**
   - Only consider providers in `allowedProviders` (e.g. European data residency restricting to compliant regional endpoints).

### 6.1 Multi-Provider Fallback Resilience (FM-3 & Rule 24)
For every routing decision, the engine returns the primary model and an ordered list of at least 2 distinct fallback models across alternative providers:
```json
{
  "selectedModelId": "anthropic/claude-3-5-sonnet",
  "selectedTier": "TIER_2_GENERAL_REASONING",
  "fallbackModels": [
    "openai/gpt-4o",
    "google/gemini-1.5-pro"
  ]
}
```
If Anthropic returns HTTP 429 or 500, the caller immediately retries using the next fallback model without throwing unhandled exceptions to the user.

---

## 7. Budget Guard Service & Exhaustion Circuit Breakers (Rule 23 & Rule 68)

The `BudgetGuardService` enforces resource and monetary bounds:
1. **Soft Threshold Warning ($\ge 80\%$):**
   - When cumulative monthly spend reaches 80% of `monthlyBudgetMicroUSD`, emits `cost.budget.soft_limit_reached` domain event to notify operators.
2. **Hard Cap Tripping ($\ge 100\%$):**
   - Based on `hardCapAction`:
     * `HALT`: Rejects execution immediately with `COST_BUDGET_EXCEEDED` (HTTP 403).
     * `DEGRADE_TIER`: Automatically forces all non-critical executions to `TIER_1_LOW_COST`.
     * `REQUIRE_APPROVAL`: Staged proposal approval required before executing mutating capabilities.
3. **Emergency Dead-Man Switch (Rule 60):**
   - All budget policy modifications check `checkGovernanceDeadManSwitch(organizationId)`, failing closed during active platform incidents.

---

## 8. Canonical Cost Capabilities & RBAC Permission Mapping

Registered in `CapabilityRegistry` under `src/platform/capabilities/cost/cost-capabilities.ts`:
1. `cost.record_usage` (`L0_READ`, requiresIdempotencyKey: true)
2. `cost.get_metrics` (`L0_READ`, requiresIdempotencyKey: false)
3. `cost.route_model` (`L0_READ`, requiresIdempotencyKey: false)
4. `cost.check_budget` (`L0_READ`, requiresIdempotencyKey: false)
5. `cost.set_budget_policy` (`L2_STATE_MUTATION`, requiresIdempotencyKey: true, nonDelegable: true, auditRequired: true)

Permissions in `src/platform/capabilities/contracts/permission-refs.ts`:
- `cost:read`: Read token usage, cost metrics, and routing recommendations.
- `cost:manage`: Configure monthly budget caps and hard cap actions.

---

## 9. Governed Next.js 15 Server Actions

Implemented in `src/app/actions/cost-actions.ts`:
1. `recordTokenUsageAction`: Authenticated recording of token consumption.
2. `getCostMetricsAction`: Anti-IDOR protected retrieval of tenant cost analytics.
3. `routeModelAction`: Evaluates task parameters and returns optimal model tier + fallbacks.
4. `checkBudgetStatusAction`: Asserts workspace budget availability.
5. `setBudgetPolicyAction`: Human-only (`actor.type === 'user'`) budget cap configuration with dead-man pause check.

---

## 10. Failure Modes & Effects Analysis (FMEA - Rule 2)

| Failure Mode | Trigger / Root Cause | Severity | Platform Defense Mechanism | Verification Gate |
| :--- | :--- | :---: | :--- | :--- |
| **FM-1: Recursive Token Bomb / Rogue Agent Loop** | Autonomous subagent stuck in loop requesting high-end models. | **HIGH** | `BudgetGuardService` checks cumulative spend and per-run token limits ($\le 4,000$ tokens/step). Automatically halts execution with `COST_BUDGET_EXCEEDED` when cap is hit (Rule 23). | `budget-guard.test.ts` |
| **FM-2: Upstream Provider 429 Rate Limit / Outage** | OpenAI or Anthropic API goes down or throttles requests. | **HIGH** | `DynamicModelRouter` synthesizes multi-provider fallbacks (`fallbackModels`). Caller seamlessly fails over to Gemini or DeepSeek in same tier (Rule 24 & FM-3). | `dynamic-model-router.test.ts` |
| **FM-3: Cross-Tenant Cost Telemetry Snooping** | Malicious tenant attempts to query competitor's model spending or token metrics. | **CRITICAL** | `assertTenantAccess` in Server Actions validates caller session organization ID against requested organization, failing closed with `COST_IDOR_VIOLATION` (HTTP 403, Rules 8 & 47). | `cost-capabilities-and-actions.test.ts` |
| **FM-4: Floating-Point Rounding Drift** | Micro-cent calculations accumulating fractional currency errors. | **MEDIUM** | Strict integer micro-USD arithmetic ($1\text{ USD} = 1,000,000\text{ micro-USD}$) with deterministic rounding ensures exact balance reconciliation (Rule 11). | `token-cost-accounting.test.ts` |
| **FM-5: Autonomous Subagent Overriding Budget Caps** | Autonomous subagent attempts to raise its own monthly spending limit. | **CRITICAL** | `cost.set_budget_policy` is strictly non-delegable (`nonDelegable: true`, Rule 17). Rejects non-human callers with `NON_DELEGABLE_ACTION` (HTTP 403). | `cost-capabilities-and-actions.test.ts` |

---

## 11. The Rule 67 Agent Implementation Gate Assessment for Milestone 2

Before Milestone 2 is marked complete, it must satisfy all 10 categories of Rule 67:

```text
1. ARCHITECTURE
□ Canonical Capabilities: cost.record_usage, cost.get_metrics, cost.route_model, cost.check_budget, cost.set_budget_policy registered.
□ Zero Service Duplication: Reuses defaultEventBus and governance dead-man switches.
□ Single Source of Truth: Canonical Zod schemas and AUTHORITATIVE_MODEL_PRICING rate cards.
□ Domain Events: Emits cost.usage.recorded, cost.budget.soft_limit_reached.

2. AUTHORITY
□ Scoped RBAC: Bound to cost:read and cost:manage in permission-refs.ts.
□ Allowed Actions: Model routing recommendations, budget checks, token usage logging.
□ Forbidden Actions: Autonomous modification of budget caps (non-delegable).
□ Delegation Attenuation: Subagents cannot inherit elevated cost:manage authority.

3. DATA
□ Ingress: Token counts, model IDs, persona IDs, task complexity parameters.
□ Egress: Micro-USD costs, aggregate metrics, routing decisions.
□ Trusted vs Untrusted: External routing directives sanitized and containerized in <untrusted_reference_data>.
□ Sensitive Data: Zero prompt content or PII stored in token usage records.

4. EXECUTION
□ Idempotency: All token usage records use deterministic keys (usage_${runId}_${timestamp}).
□ Retries: Multi-provider fallbacks allow seamless retries on 429/500 errors.
□ Cancellation: Cooperative AbortSignal listener on routing decisions and tracking.
□ Concurrency: Thread-safe in-memory aggregation maps.

5. MCP
□ Protocol Spec: 2026-07-28 stateless HTTP protocol.
□ SDK Version: @modelcontextprotocol/server v2.
□ Annotations: Hints only; routing decisions verified server-side.
□ Drift Defense: Canonical SHA-256 decisionHash binds routing parameters.

6. FAILURE
□ Timeouts: Handled gracefully with fallback tier degradation.
□ 429 Rate Limits: Caught and routed to secondary provider in fallback list.
□ Provider Downtime: Multi-provider fallback prevents task failure.
□ DLQ Quarantine: Rejected budget mutations recorded with error metadata.

7. SECURITY
□ Prompt Injection: Linear non-backtracking scanning on routing rationale.
□ Tool Poisoning: Schema fingerprint verification detects unauthorized mutations.
□ Confused Deputy: Strict identity binding between session user and cost record.
□ Anti-IDOR: Scoped tenant boundary validation on all Server Actions.

8. OPERATIONS
□ Backoffice Control: Budget policies operable without code redeployment.
□ Replayability: Deterministic model routing decisions based on input vectors.
□ Rollback: Reverse-LIFO Saga rollback verified under synthetic failures.
□ No-Code Configuration: Budget caps and hard cap actions configurable via UI.

9. TESTING
□ Battery: Unit, integration, and security test suites across all 5 test files.
□ Pass SLA: 100% test pass rate across all suites before deployment.

10. MIGRATION
□ Strangler Fig: 100% preservation of all 53 preexisting routes in AdminSidebar.tsx.
□ Data Compatibility: Zero schema modifications to production business collections.
```

---

## 12. The Rule 68 Five Non-Negotiables Verification

1. **Non-Negotiable 11 — The model is never the security boundary:** Model routing decisions and budget checks are deterministic code calculations, never LLM self-estimates.
2. **Non-Negotiable 12 — Tool output is untrusted data:** Model metadata and execution metrics are validated with Zod v4 and containerized in `<untrusted_reference_data>`.
3. **Non-Negotiable 13 — Every mutation must be idempotent, authorized, version-checked and auditable:** `cost.set_budget_policy` requires idempotency keys, user authorization, and emits audit events.
4. **Non-Negotiable 14 — Every production agent must have bounded authority and bounded resources:** Enforced through soft alerts and hard cap actions (`HALT`, `DEGRADE_TIER`, `REQUIRE_APPROVAL`).
5. **Non-Negotiable 15 — Every autonomous capability must be operable without code:** Budget caps and emergency kill switches operable directly from Backoffice control surfaces.

---

## 13. File Structure Map & Bite-Sized Implementation Tasks

```
src/platform/cost/
├── contracts/
│   ├── cost-types.ts                   # Canonical Zod v4 schemas, error taxonomy, 4 governance matrices
│   └── index.ts                        # Contracts public barrel
├── services/
│   ├── model-pricing-registry.ts       # Verified provider pricing rate cards (in micro-USD)
│   ├── token-cost-accounting-service.ts # Real-time token tracking, micro-USD math, multi-dimensional aggregates
│   ├── budget-guard-service.ts         # Soft threshold alerts, hard cap circuit breaker halts & degradation
│   └── index.ts                        # Services public barrel
├── routing/
│   ├── dynamic-model-router.ts         # 6-factor model routing engine with multi-provider fallback resilience
│   └── index.ts                        # Routing public barrel
└── index.ts                            # Platform cost root barrel

src/platform/capabilities/cost/
├── cost-capabilities.ts                # Canonical cost capabilities registered in CapabilityRegistry
└── index.ts                            # Capabilities public barrel

src/app/actions/
└── cost-actions.ts                     # Governed Next.js 15 Server Actions with Clerk auth & Anti-IDOR

src/platform/__tests__/cost/
├── cost-contracts.test.ts              # Zod schema validation, governance matrices, error taxonomy tests
├── token-cost-accounting.test.ts       # Micro-USD arithmetic, provider pricing, usage recording tests
├── dynamic-model-router.test.ts        # 6-factor decision engine, tier selection, fallback routing tests
├── budget-guard.test.ts                # Soft alerts, hard cap HALT/DEGRADE, dead-man switch tests
└── cost-capabilities-and-actions.test.ts # Capability registry integration & Server Action security tests
```

### Task 1: Canonical Cost & Model Routing Contracts, Schemas, Error Taxonomy & 4 Governance Matrices
**Files:**
- Create: `src/platform/cost/contracts/cost-types.ts`
- Create: `src/platform/cost/contracts/index.ts`
- Test: `src/platform/__tests__/cost/cost-contracts.test.ts`

- [ ] **Step 1: Write the failing contract test**
  - Define test cases for `ModelProviderSchema`, `ModelTierSchema`, `ModelPricingCardSchema`, `TokenUsageRecordSchema`, `CostBudgetPolicySchema`, `ModelRoutingInputSchema`, `ModelRoutingDecisionSchema`, `CostAccountingMetricsSchema`.
  - Verify `COST_ERROR_CODES` and typed `CostDomainError` class.
  - Verify all 4 Governance Matrices (`COST_PERMISSION_MATRIX`, `COST_TOOL_MATRIX`, `COST_FAILURE_MATRIX`, `COST_ROLLBACK_MATRIX`).
  - Verify strict zero-`any` compliance.
- [ ] **Step 2: Run test to verify it fails**
  - Run: `npx vitest run src/platform/__tests__/cost/cost-contracts.test.ts`
  - Expected: FAIL with module not found.
- [ ] **Step 3: Implement canonical cost types, schemas, and governance matrices**
  - Define `ModelProviderSchema = z.enum(['anthropic', 'openai', 'google', 'deepseek'])`.
  - Define `ModelTierSchema = z.enum(['TIER_1_LOW_COST', 'TIER_2_GENERAL_REASONING', 'TIER_3_HIGH_END'])`.
  - Define `ModelPricingCardSchema` with integer rates.
  - Define `TokenUsageRecordSchema` with strictly non-negative integer tokens and integer `costMicroUSD`.
  - Define `CostBudgetPolicySchema` with `hardCapAction: z.enum(['HALT', 'DEGRADE_TIER', 'REQUIRE_APPROVAL'])`.
  - Define `ModelRoutingInputSchema` and `ModelRoutingDecisionSchema` with `decisionHash`.
  - Define `CostAccountingMetricsSchema` with multi-dimensional breakdowns.
  - Define `COST_ERROR_CODES` and `CostDomainError`.
  - Define the 4 Governance Matrices.
  - Export contracts via `src/platform/cost/contracts/index.ts`.
- [ ] **Step 4: Run test to verify it passes**
  - Run: `npx vitest run src/platform/__tests__/cost/cost-contracts.test.ts`
  - Expected: PASS.

---

### Task 2: Provider Pricing Registry & Token Cost Accounting Service
**Files:**
- Create: `src/platform/cost/services/model-pricing-registry.ts`
- Create: `src/platform/cost/services/token-cost-accounting-service.ts`
- Create: `src/platform/cost/services/index.ts`
- Test: `src/platform/__tests__/cost/token-cost-accounting.test.ts`

- [ ] **Step 1: Write the failing cost accounting test**
  - Test pricing lookups for all supported models across Anthropic, OpenAI, Google, DeepSeek.
  - Test exact integer micro-USD computation: $\text{costMicroUSD} = \text{round}\left( \frac{\text{promptTokens} \times \text{inRate} + \text{completionTokens} \times \text{outRate} + \text{cachedTokens} \times \text{cachedRate}}{1,000,000} \right)$.
  - Test `recordUsage()`: updates aggregates, tracks spend by persona, workspace, domain, tier.
  - Test domain event publishing `cost.usage.recorded` to `defaultEventBus`.
  - Test `getMetrics()` aggregates calculation.
- [ ] **Step 2: Run test to verify it fails**
  - Run: `npx vitest run src/platform/__tests__/cost/token-cost-accounting.test.ts`
  - Expected: FAIL with module not found.
- [ ] **Step 3: Implement pricing registry and cost accounting service**
  - Populate authoritative pricing cards for Claude 3.5 Sonnet/Haiku, GPT-4o/4o-mini, Gemini 1.5 Pro/Flash, DeepSeek-V3/R1.
  - Implement `TokenCostAccountingService` with deterministic micro-USD conversion.
  - Implement in-memory aggregation maps with sliding window support.
  - Implement domain event emission via `createDomainEvent` and `defaultEventBus`.
  - Provide HMR singleton `getTokenCostAccountingService()`.
  - Export services via `src/platform/cost/services/index.ts`.
- [ ] **Step 4: Run test to verify it passes**
  - Run: `npx vitest run src/platform/__tests__/cost/token-cost-accounting.test.ts`
  - Expected: PASS.

---

### Task 3: Multi-Tier Dynamic Model Router with Fallback Resilience (Roadmap §18 & Rule 58)
**Files:**
- Create: `src/platform/cost/routing/dynamic-model-router.ts`
- Create: `src/platform/cost/routing/index.ts`
- Test: `src/platform/__tests__/cost/dynamic-model-router.test.ts`

- [ ] **Step 1: Write the failing model router test**
  - Test low-complexity / low-risk routing -> selects `TIER_1_LOW_COST` (e.g. Gemini 1.5 Flash / Claude 3.5 Haiku).
  - Test medium-complexity / state mutation routing -> selects `TIER_2_GENERAL_REASONING` (e.g. Claude 3.5 Sonnet / GPT-4o).
  - Test critical-risk / high-complexity / multi-agent planning routing -> selects `TIER_3_HIGH_END` (e.g. Claude 3 Opus / o1-preview / DeepSeek-R1).
  - Test large context (>30k tokens) routing -> selects model with 200k+ context window.
  - Test fast latency target (<1,000ms) -> selects fast low-cost model.
  - Test fallback provider list generation for outage resiliency (FM-3 & Rule 24).
  - Test canonical SHA-256 `decisionHash` generation (Rule 22).
- [ ] **Step 2: Run test to verify it fails**
  - Run: `npx vitest run src/platform/__tests__/cost/dynamic-model-router.test.ts`
  - Expected: FAIL with module not found.
- [ ] **Step 3: Implement DynamicModelRouter**
  - Implement 6-factor decision algorithm (Complexity, Risk, Context, Latency, Budget, Domain/Residency).
  - Select primary model and synthesize ordered fallback model list across distinct providers.
  - Calculate estimated cost in micro-USD for predicted input/output tokens.
  - Compute SHA-256 hash over routing decision parameters.
  - Provide HMR singleton `getDynamicModelRouter()`.
  - Export router via `src/platform/cost/routing/index.ts`.
- [ ] **Step 4: Run test to verify it passes**
  - Run: `npx vitest run src/platform/__tests__/cost/dynamic-model-router.test.ts`
  - Expected: PASS.

---

### Task 4: Proactive Budget Guard & Circuit Breaker Engine (Rule 23)
**Files:**
- Create: `src/platform/cost/services/budget-guard-service.ts`
- Test: `src/platform/__tests__/cost/budget-guard.test.ts`

- [ ] **Step 1: Write the failing budget guard test**
  - Test policy configuration and storage.
  - Test soft limit threshold ($\ge 80\%$ spend) emits `cost.budget.soft_limit_reached`.
  - Test hard cap action `HALT` throws `CostDomainError` with `COST_BUDGET_EXCEEDED` (HTTP 403).
  - Test hard cap action `DEGRADE_TIER` forces model tier to `TIER_1_LOW_COST`.
  - Test dead-man switch evaluation (`checkGovernanceDeadManSwitch`) failing closed with `COST_DEAD_MAN_PAUSED` (Rule 60).
- [ ] **Step 2: Run test to verify it fails**
  - Run: `npx vitest run src/platform/__tests__/cost/budget-guard.test.ts`
  - Expected: FAIL with module not found.
- [ ] **Step 3: Implement BudgetGuardService**
  - Store and manage `CostBudgetPolicy` per workspace/organization/persona.
  - Implement `checkBudget()` and `assertBudgetAvailable()`.
  - Enforce soft threshold notifications and hard cap circuit breaker actions.
  - Wire dead-man switch check on policy mutations.
  - Provide HMR singleton `getBudgetGuardService()`.
  - Re-export via `src/platform/cost/index.ts`.
- [ ] **Step 4: Run test to verify it passes**
  - Run: `npx vitest run src/platform/__tests__/cost/budget-guard.test.ts`
  - Expected: PASS.

---

### Task 5: Canonical Cost Capabilities & RBAC Permission Mapping
**Files:**
- Create: `src/platform/capabilities/cost/cost-capabilities.ts`
- Create: `src/platform/capabilities/cost/index.ts`
- Modify: `src/platform/capabilities/contracts/permission-refs.ts`
- Modify: `src/platform/cost/index.ts`

- [ ] **Step 1: Write the failing capability registration test**
  - Verify capabilities `cost.record_usage`, `cost.get_metrics`, `cost.route_model`, `cost.check_budget`, `cost.set_budget_policy` exist in `CapabilityRegistry`.
  - Verify `cost.set_budget_policy` is flagged as non-delegable (`actor.type === 'user'`, Rule 17).
  - Verify risk tiers are properly assigned (`L0_READ`, `L2_STATE_MUTATION`).
- [ ] **Step 2: Run test to verify it fails**
  - Run: `npx vitest run src/platform/__tests__/cost/cost-capabilities-and-actions.test.ts`
  - Expected: FAIL with capability not found.
- [ ] **Step 3: Register capabilities and update permission references**
  - Add `cost:read` and `cost:manage` to `src/platform/capabilities/contracts/permission-refs.ts`.
  - Implement `src/platform/capabilities/cost/cost-capabilities.ts` registering all 5 capabilities.
  - Export capabilities via `src/platform/capabilities/cost/index.ts`.
  - Export unified platform cost API via `src/platform/cost/index.ts`.
- [ ] **Step 4: Run test to verify it passes**
  - Run: `npx vitest run src/platform/__tests__/cost/cost-capabilities-and-actions.test.ts`
  - Expected: PASS.

---

### Task 6: Governed Next.js 15 Server Actions
**Files:**
- Create: `src/app/actions/cost-actions.ts`
- Test: `src/platform/__tests__/cost/cost-capabilities-and-actions.test.ts`

- [ ] **Step 1: Write the failing Server Actions test**
  - Test `recordTokenUsageAction`: verifies authenticated session and records usage.
  - Test `getCostMetricsAction`: rejects cross-tenant caller with `COST_IDOR_VIOLATION` (Rules 8 & 47).
  - Test `routeModelAction`: computes model routing decision.
  - Test `checkBudgetStatusAction`: checks budget status for caller workspace.
  - Test `setBudgetPolicyAction`: updates budget policy, enforces dead-man check (Rule 60).
  - Test dead-man switch active: returns `COST_DEAD_MAN_PAUSED` (HTTP 503).
- [ ] **Step 2: Run test to verify it fails**
  - Run: `npx vitest run src/platform/__tests__/cost/cost-capabilities-and-actions.test.ts`
  - Expected: FAIL with action not found.
- [ ] **Step 3: Implement Next.js 15 Server Actions**
  - Add `'use server'` directive.
  - Import `requireAuth` and implement `assertTenantAccess(auth, orgId)`.
  - Wire calls to `TokenCostAccountingService`, `DynamicModelRouter`, and `BudgetGuardService`.
  - Centralize error handling with `handleActionError` returning sanitized `CostActionResult<T>`.
- [ ] **Step 4: Run test to verify it passes**
  - Run: `npx vitest run src/platform/__tests__/cost/cost-capabilities-and-actions.test.ts`
  - Expected: PASS.

---

### Task 7: Full Test Battery & Verification Gates
**Files:**
- Verify: all 5 test files in `src/platform/__tests__/cost/`

- [ ] **Step 1: Run all Milestone 2 test suites**
  - Run: `npx vitest run src/platform/__tests__/cost/`
  - Expected: 5/5 test files passing (100%).
- [ ] **Step 2: Run Phase 14 & Phase 15 Milestone 1 regressions**
  - Run: `npx vitest run src/platform/__tests__/evaluation/`
  - Run: `npx vitest run src/platform/__tests__/verification/`
  - Expected: 100% passing across all regression suites.
- [ ] **Step 3: Verify strict typing (zero any / any[])**
  - Run: `grep -rn --include="*.ts" ": any" src/platform/cost/ src/app/actions/cost-actions.ts src/platform/__tests__/cost/`
  - Expected: 0 occurrences.

---

### Task 8: Documentation, Milestone 2 Completion Report & Senior Principal Review
**Files:**
- Create: `docs/agents_mcp/phases/agents_mcp_phase_15_milestone_2_completion_report.md`
- Create brain artifact: `phase_15_milestone_2_completion_report.md`

- [ ] **Step 1: Author Milestone 2 Completion Report**
  - Detail all deliverables, schemas, pricing tables, router logic, budget guards, and test evidence.
  - Document compliance with all 69 rules and Rules 1940–1953.
- [ ] **Step 2: Invoke Senior Principal Architecture Reviewer**
  - Conduct architectural review and obtain Grade A sign-off.
