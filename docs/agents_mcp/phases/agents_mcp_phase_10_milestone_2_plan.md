# Phase 10 Milestone 2 Implementation Plan: Specialized Sales Agent Personas, Tool Matrix, Eval Dataset & Shadow Mode

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the specialized sales agent workforce (`lead_sdr`, `prospecting_agent`, `enrichment_agent`, `qualification_agent`, `sales_coach`), complete the 4 mandatory governance matrices (Permission, Tool, Failure, Rollback), construct the 24-scenario enterprise evaluation benchmark (including 4 red-team security attacks), and build the Shadow Mode simulation harness (`dryRun: true`) with automated Blast Radius Report generation.

**Architecture:** Domain Agent Workforce architecture conforming to Rules 1940–1953 (Domain Agents Mandatory Deliverables Gate) and Rule 67 (Agent Implementation Gate). Wraps existing `AutonomousSDREngine` and `DeepResearchDossierEngine` into specialized agent personas with monotonic downward scope attenuation, explicit non-wildcard RBAC permission mapping, 12-strategy failure recovery, and zero-write shadow simulation.

**Tech Stack:** TypeScript, Next.js 15, Zod v4, Vitest, Firestore, Cloud Run Serverless Runtime.

---

## 1. Compliance Matrix: Rules 1940–1953 & Master 69 Rules

| Rule # | Category | Milestone 2 Enforcement & Architectural Defense |
| :---: | :--- | :--- |
| **Rules 1940–1953** | Domain Agents Gate | Every sales agent persona ships with: 1. Shadow Mode (`sales-shadow-mode.ts`), 2. Evaluation Dataset (`sales-eval-dataset.ts`), 3. Permission Matrix (`SALES_PERMISSION_MATRIX`), 4. Tool Matrix (`SALES_TOOL_MATRIX`), 5. Failure Matrix (`SALES_FAILURE_MATRIX`), 6. Security Tests (`sales-agent-matrix.test.ts`, `sales-eval-dataset.test.ts`), 7. Rollback Plan (`SALES_ROLLBACK_MATRIX`). |
| **Rule 1** | Standards & Style | Strict adherence to Next.js 15 App Router conventions, clean separation of concerns, and zero leaky client/server boundaries. |
| **Rule 2** | Failure Mode Planning | 12 explicit failure recovery strategies in `SALES_FAILURE_MATRIX` covering provider rate limits, disposable domains, prompt injection, and DNS errors. |
| **Rule 3** | Backoffice Observability | Shadow mode simulation runs emit structured traces and domain events for backoffice visibility. |
| **Rule 4** | Zero `any` / Zero `any[]` | 100% strict TypeScript types with Zod v4 schemas for personas, matrices, eval scenarios, simulation results, and blast radius reports. |
| **Rule 8** | High Security & Anti-IDOR | Personas, eval scenarios, and shadow simulations bind strictly to `organizationId` and `workspaceId`. |
| **Rule 9** | High Load & Resource Limits | Explicit resource budgets on each persona (`maxDurationMs <= 120s`, `maxTokens <= 50,000`, `maxToolCalls <= 15`, `maxRecordsMutated <= 25`). Bounded queries $\le 50$. |
| **Rule 10** | Inline Documentation | Comprehensive `@fileOverview` headers explaining design rationale, rules compliance, and testability pointers. |
| **Rule 11** | MCP Protocol Compliance | Canonical `lead.*` and `sdr.*` capabilities exposed via Streamable HTTP (Spec 2026-07-28). |
| **Rule 12** | Risk Levels | Immutable risk level ceilings per persona (`L0_READ` to `L2_STATE_MUTATION`). `L3` outbound message dispatching requires human approval. |
| **Rule 13** | Trust Boundary Matrix | Web scraper output and external website HTML treated as untrusted and containerized in `<untrusted_reference_data id="...">`. |
| **Rule 14** | Fingerprint Drift Defense | Tool matrix maps canonical capability schemas with SHA-256 fingerprint verification before invocation. |
| **Rule 15** | Server Allowlisting | External enrichment providers (Clearbit, Apollo, Hunter, BuiltWith) verified against allowlist. |
| **Rule 16** | Agent Identity & Attenuation | Explicit persona definitions with monotonic downward scope attenuation ($P_{\text{child}} = P_{\text{parent}} \cap P_{\text{specialist}}$). Zero wildcard permissions (`*`). |
| **Rule 17** | Non-Delegable Actions Guard | Unsolicited bulk messaging and account deletion classified as non-delegable. |
| **Rule 18** | TOCTOU Concurrency | Failure matrix defines `TOCTOU_CONCURRENCY_CONFLICT` handling with re-fetch and optimistic lock verification. |
| **Rule 19** | Mandatory Idempotency | Shadow simulation creates deterministic keys: `sales_shadow_${runId}_${stepId}`. |
| **Rule 20 & 40** | Distributed Tracing & Audit Trail | Shadow runner injects correlation IDs and publishes `sales.agent.simulated` domain events to `defaultEventBus`. |
| **Rule 21 & 22** | Two-Phase Action Model & SHA-256 Binding | Outbound proposals bind to key-sorted SHA-256 `payloadHash` preventing parameter tampering. |
| **Rule 23** | Budget Ceilings Enforcement | Budgets enforced prior to simulation execution. |
| **Rule 24** | 5-State Circuit Breakers | External enrichment APIs protected by circuit breakers (`healthy`, `degraded`, `open`, `half_open`, `recovered`). |
| **Rule 25** | Dead-Letter Queues | Failure matrix routes unrecoverable enrichment/scoring failures to operator DLQ. |
| **Rule 26** | Cooperative Cancellation | Shadow runner accepts native `AbortSignal` for instantaneous cancellation. |
| **Rule 27** | Formal Saga Sagas | Rollback matrix maps mutating capabilities to reverse-LIFO compensating reversions. |
| **Rule 28 & 56** | Context Compression | Knapsack context compression keeps prospect history and technographics strictly $\le 4,000$ tokens. |
| **Rule 29** | Memory Governance | Retrieval weights fresh buying signals higher than stale historical interactions using temporal decay. |
| **Rule 30** | Knowledge Poisoning Defense | Prompt injection scanning on scraped web pages and emails, isolated via `<untrusted_reference_data id="...">`. |
| **Rule 31** | Output Schema Validation | Capability outputs verified using Zod v4 `safeParse` before passing to subsequent agent steps. |
| **Rule 32** | Exfiltration Detection | Sales agents strictly restricted to allowed domains (`lead_intelligence`, `crm_contacts`, `communication_messaging`, `knowledge_memory`). |
| **Rule 33** | Egress Redaction | Redaction engine masks API keys, bearer tokens, and sensitive contact PII before logging. |
| **Rule 34** | SSRF Defense | Failure matrix and eval dataset enforce `validateSafeEgressUrl` blocking private subnets and metadata IPs (`169.254.169.254`). |
| **Rule 39** | OpenTelemetry Standards | Injects W3C `traceparent` headers across all distributed sales capability invocations. |
| **Rule 41** | "Why Did You Do This?" Explainability Grid | Shadow simulation produces Blast Radius Reports with WHAT, WHY, and EXPECTED STATE CHANGE breakdown. |
| **Rule 42** | Shadow Mode Simulation Invariant | `dryRun: true` strictly enforced. Zero live database writes on production stores. |
| **Rule 44** | Deterministic Test Harness | Hermetic Vitest test harness with mock lead stores simulating discovery and scoring pipelines. |
| **Rule 46** | Adversarial Red-Team Scenarios | Eval dataset includes dedicated `SECURITY_ATTACK` scenarios (prompt injection via meta tags, SSRF private IP probes, IDOR cross-tenant probing, unapproved outbound bypass). |
| **Rule 47** | Never Trust the Model | All model outputs, lead scores, and generated drafts are validated against strict Zod v4 schemas. |
| **Rule 48** | Never Trust the Tool | Tool failure codes mapped to 12 structured error recovery strategies in `SALES_FAILURE_MATRIX`. |
| **Rule 50** | Cache Partitioning | In-memory lead and score caches partitioned by `organizationId`, `workspaceId`, and `prospectId`. |
| **Rule 54** | Performance Budgets | Lead search $<400\text{ms}$; score calculation $<250\text{ms}$; simulation run $<500\text{ms}$. |
| **Rule 58** | Model Routing Policy | Fast filters & contact extraction route to Flash; deep research dossiers, ICP scoring, and outreach drafting route to Pro. |
| **Rule 59** | Capability Domain Guard | Persona capabilities filtered strictly by allowed domains. |
| **Rule 60** | Emergency Dead-Man Switch | `checkGovernanceDeadManSwitch` evaluated before simulation execution; fails closed with HTTP 503 if tripped. |
| **Rule 67** | The Implementation Gate | Full 10-point architectural gate verification embedded in plan. |
| **Rule 68** | The Five Non-Negotiables | 1. Model is not security boundary. 2. Tool output is untrusted. 3. Mutations idempotent & auditable. 4. Bounded authority & resources. 5. Operable without code. |
| **Rule 69** | Strangler Fig Pattern | Wraps existing `AutonomousSDREngine` and `DeepResearchDossierEngine` without modifying legacy files; preserves dual-tier CRM model. |

---

## 2. The Agent Implementation Gate Verification (Rule 67)

Before completing Milestone 2, each of the 5 sales personas satisfies the 10-point Agent Implementation Gate:

```text
1. ARCHITECTURE
   ✓ Canonical capabilities: lead.search, lead.enrich, lead.get_intelligence, lead.score,
     lead.get_decision_makers, lead.get_buying_signals, lead.get_recommended_pitch, lead.get_objection_handlers,
     sdr.get_daily_briefing, sdr.get_priority_queue, sdr.generate_outreach_draft, sdr.create_whatsapp_link,
     sdr.request_outreach_approval, sdr.record_outreach_outcome, sdr.get_conversion_insights.
   ✓ Strangler Fig: Wraps AutonomousSDREngine and DeepResearchDossierEngine without legacy mutation.
   ✓ Source of Truth: Firestore (/prospects, /workspace_entities, /entities, /sdr_drafts, /prospecting_campaigns).
   ✓ Events Emitted: sales.lead.discovered, sales.lead.enriched, sales.lead.scored, sales.outreach.drafted,
     sales.outreach.approval_required, sales.outreach.approved, sales.outreach.rejected, sales.agent.simulated.

2. AUTHORITY
   ✓ Who is allowed: Authenticated SDRs, Sales Managers, and Admins with crm or sales permissions.
   ✓ Permitted actions: Search leads, enrich data, calculate scores, research public websites, draft pitches,
     generate WhatsApp click-to-chat links, propose CRM stage transitions.
   ✓ Prohibited actions: Unsolicited bulk email sending without approval, live financial transactions, account deletion.
   ✓ Inheritance: Sub-agents inherit via monotonic downward scope attenuation (P_child = P_parent ∩ P_specialist).

3. DATA
   ✓ Inputs: Prospect names, company domains, public websites, technographics, ICP criteria.
   ✓ Outputs: Outbound email drafts, WhatsApp prefilled messages (upon approval), CRM records.
   ✓ Trusted: Verified tenant configuration, system prompt templates, canonical CRM records.
   ✓ Untrusted: External website HTML, scraped meta tags, third-party provider responses (isolated in <untrusted_reference_data>).
   ✓ Sensitive: Personal contact emails, phone numbers, executive revenue numbers (redacted in logs).

4. EXECUTION
   ✓ Idempotency: Deterministic keys (sales_shadow_${runId}_${stepId}, sdr_draft_${id}, lead_sync_${id}).
   ✓ Retries: Exponential backoff with jitter up to maxAttempts = 3.
   ✓ Cancellation: Native AbortSignal cooperative cancellation.
   ✓ Deduplication: Task deduplication keys prevent concurrent identical runs.
   ✓ Concurrency: TOCTOU version checking aborts with optimistic lock error.
   ✓ Replay: Checkpoint hash chain allows exact replay from last verified state.

5. MCP
   ✓ Protocol: Spec 2026-07-28.
   ✓ Transport: Streamable HTTP.
   ✓ Annotations: Readonly, destructive, high_risk hints (server-verified, Rule 12).
   ✓ Server Identity: sales-intelligence-mcp-server.
   ✓ Fingerprint: Pre-execution SHA-256 fingerprint verification fails closed.

6. FAILURE
   ✓ Timeout: 120s max duration ceiling per agent run; 5,000ms ceiling for web crawlers.
   ✓ 429: Circuit breaker trips to 'open', backpressure backoff kicks in.
   ✓ 500: Caught, sanitized, mapped to structured error codes in SALES_FAILURE_MATRIX.
   ✓ Partial: Saga reverse-LIFO compensation rolls back executed steps via SALES_ROLLBACK_MATRIX.
   ✓ Provider outage: Waterfall fallback (Clearbit -> Apollo -> Hunter -> BuiltWith).
   ✓ Stale approval: Action proposal expires after 24h; requires re-proposal.

7. SECURITY
   ✓ Prompt injection: Neutralized via regex pattern scanning and <untrusted_reference_data id="..."> isolation.
   ✓ Tool poisoning: SHA-256 capability fingerprint verification.
   ✓ Confused deputy: Agent identity immutably bound to caller's tenant context.
   ✓ SSRF: validateSafeEgressUrl blocks loopback, private subnets, and GCP metadata IPs (169.254.169.254).
   ✓ Exfiltration: Outbound domain whitelist enforced by capability registry.
   ✓ Cross-tenant leakage: Strict Anti-IDOR validation on every query and action.

8. OPERATIONS
   ✓ Disable: Emergency dead-man switch (Rule 60) fails closed with HTTP 503.
   ✓ Inspect: Live execution timeline on /admin/intelligence/runs.
   ✓ Replay: Deterministic replay from execution traces.
   ✓ Rollback: Reverse-LIFO saga compensation button.
   ✓ Dynamic Policy: Visual agent builder and policy editor (/admin/intelligence/agents).

9. TESTING
   ✓ Unit: Persona definitions, governance matrices, Zod schemas, URL parameter encoding.
   ✓ Integration: Multi-provider waterfall fallback, CRM dual-tier linking, Server Actions.
   ✓ Security: 4 dedicated adversarial scenarios (prompt injection, SSRF, IDOR, unapproved bypass).
   ✓ Evaluation: 24 real-world sales scenarios evaluated on golden benchmark dataset.
   ✓ Shadow Mode: Zero-write simulation harness generating Blast Radius Reports.

10. MIGRATION
   ✓ Existing behavior preserved: 100% of existing Lead Intelligence UI tabs and routes remain intact.
   ✓ Existing routes preserved: /admin/lead-intelligence continues to operate seamlessly.
   ✓ Existing data preserved: Dual-tier CRM data model (/entities vs /workspace_entities) preserved.
   ✓ Rollback documented: Feature flag FF_SALES_AGENT_WAVE allows instant rollback to classic mode.
```

---

## 3. Overview & File Map

```text
src/platform/identity/
├── agent-persona-types.ts         (Task 1 - Augment AGENT_PERSONA_IDS with 4 new sales personas)
└── agent-registry.ts              (Task 1 - Register built-in personas & specialist alias map)

src/platform/agents/sales/
├── context/
│   ├── lead-context-types.ts      (Phase 10 M1 - complete)
│   ├── lead-context-assembler.ts  (Phase 10 M1 - complete)
│   └── index.ts                   (Phase 10 M1 - complete)
├── personas/
│   ├── sales-persona-types.ts       (Task 1 - Persona IDs, schemas, definitions contract)
│   ├── sales-persona-definitions.ts (Task 1 - 5 specialized sales personas)
│   ├── sales-agent-matrix.ts        (Task 2 - Permission, Tool, Failure, Rollback matrices)
│   └── index.ts                     (Task 2 - Personas barrel)
├── evaluation/
│   ├── sales-eval-types.ts          (Task 3 - Evaluation scenario contracts & categories)
│   ├── sales-eval-dataset.ts        (Task 3 - 24 enterprise gold-standard scenarios)
│   ├── sales-shadow-mode.ts         (Task 4 - Zero-write simulation & Blast Radius Report)
│   └── index.ts                     (Task 4 - Evaluation barrel)
└── index.ts                         (Task 4 - Sales domain root barrel)

src/platform/__tests__/sales/
├── lead-contracts.test.ts           (Phase 10 M1 - 6 tests)
├── lead-capabilities.test.ts        (Phase 10 M1 - 8 tests)
├── lead-context-assembler.test.ts   (Phase 10 M1 - 4 tests)
├── sales-agent-actions.test.ts      (Phase 10 M1 - 7 tests)
├── sales-personas.test.ts           (Task 1 tests)
├── sales-agent-matrix.test.ts       (Task 2 tests)
├── sales-eval-dataset.test.ts       (Task 3 tests)
└── sales-shadow-mode.test.ts        (Task 4 tests)
```

---

## 4. Tasks & Detailed Step Breakdown

### Task 1: Specialized Sales Agent Personas (`sales-persona-types.ts`, `sales-persona-definitions.ts`, & Identity Registry Integration)

**Files:**
- Create: `src/platform/agents/sales/personas/sales-persona-types.ts`
- Create: `src/platform/agents/sales/personas/sales-persona-definitions.ts`
- Modify: `src/platform/identity/agent-persona-types.ts`
- Modify: `src/platform/identity/agent-registry.ts`
- Create: `src/platform/__tests__/sales/sales-personas.test.ts`

- [ ] **Step 1: Write the failing persona tests**

```typescript
// src/platform/__tests__/sales/sales-personas.test.ts
import { describe, it, expect } from 'vitest';
import {
  SALES_PERSONA_IDS,
  SALES_PERSONA_DEFINITIONS,
  isSalesPersonaId,
} from '../../agents/sales/personas/sales-persona-definitions';
import { getAgentPersonaRegistry } from '../../identity/agent-registry';
import { AGENT_PERSONA_IDS } from '../../identity/agent-persona-types';

describe('Sales Persona Definitions & Identity Registry', () => {
  it('exposes all 5 canonical sales persona definitions with valid structures', () => {
    expect(SALES_PERSONA_IDS).toContain('lead_sdr');
    expect(SALES_PERSONA_IDS).toContain('prospecting_agent');
    expect(SALES_PERSONA_IDS).toContain('enrichment_agent');
    expect(SALES_PERSONA_IDS).toContain('qualification_agent');
    expect(SALES_PERSONA_IDS).toContain('sales_coach');

    for (const id of SALES_PERSONA_IDS) {
      expect(isSalesPersonaId(id)).toBe(true);
      const persona = SALES_PERSONA_DEFINITIONS[id];
      expect(persona).toBeDefined();
      expect(persona.id).toBe(id);
      expect(persona.name).toBeTruthy();
      expect(persona.description).toBeTruthy();
      expect(persona.allowedDomains.length).toBeGreaterThan(0);
      expect(persona.allowedPermissions.length).toBeGreaterThan(0);
      expect(persona.budgets.maxTokens).toBeGreaterThan(0);
      expect(persona.budgets.maxDurationMs).toBeGreaterThan(0);
      expect(persona.budgets.maxToolCalls).toBeGreaterThan(0);
    }
  });

  it('enforces least-privilege risk ceilings on sales personas (Rule 12 & 16)', () => {
    expect(SALES_PERSONA_DEFINITIONS.prospecting_agent.maxAutonomousRiskLevel).toBe('L0_READ');
    expect(SALES_PERSONA_DEFINITIONS.qualification_agent.maxAutonomousRiskLevel).toBe('L0_READ');
    expect(SALES_PERSONA_DEFINITIONS.enrichment_agent.maxAutonomousRiskLevel).toBe('L1_INTERNAL_DRAFT');
    expect(SALES_PERSONA_DEFINITIONS.sales_coach.maxAutonomousRiskLevel).toBe('L1_INTERNAL_DRAFT');
    expect(SALES_PERSONA_DEFINITIONS.lead_sdr.maxAutonomousRiskLevel).toBe('L2_STATE_MUTATION');
  });

  it('contains zero wildcard permissions across all personas (Rule 16)', () => {
    for (const id of SALES_PERSONA_IDS) {
      const persona = SALES_PERSONA_DEFINITIONS[id];
      for (const perm of persona.allowedPermissions) {
        expect(perm).not.toContain('*');
        expect(perm).not.toBe('all');
      }
    }
  });

  it('registers all 5 sales personas in the platform-wide identity registry', () => {
    const registry = getAgentPersonaRegistry();
    for (const id of SALES_PERSONA_IDS) {
      expect(AGENT_PERSONA_IDS).toContain(id);
      expect(registry.hasPersona(id)).toBe(true);
      const resolved = registry.getPersona(id);
      expect(resolved).toBeDefined();
      expect(resolved?.id).toBe(id);
    }
  });

  it('resolves backward-compatible aliases for sales personas', () => {
    const registry = getAgentPersonaRegistry();
    expect(registry.resolvePersonaId('sdr_specialist')).toBe('lead_sdr');
    expect(registry.resolvePersonaId('prospector')).toBe('prospecting_agent');
    expect(registry.resolvePersonaId('enricher')).toBe('enrichment_agent');
    expect(registry.resolvePersonaId('lead_qualifier')).toBe('qualification_agent');
    expect(registry.resolvePersonaId('pitch_coach')).toBe('sales_coach');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/platform/__tests__/sales/sales-personas.test.ts`  
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement `sales-persona-types.ts`, `sales-persona-definitions.ts`, and augment identity registry**

1. Create `src/platform/agents/sales/personas/sales-persona-types.ts`:
   - `SALES_PERSONA_IDS = ['lead_sdr', 'prospecting_agent', 'enrichment_agent', 'qualification_agent', 'sales_coach'] as const`
   - `SalesPersonaId = (typeof SALES_PERSONA_IDS)[number]`
   - `isSalesPersonaId(id: string): id is SalesPersonaId`
2. Create `src/platform/agents/sales/personas/sales-persona-definitions.ts`:
   - `lead_sdr`: Outbound Sales Development Representative (`L2_STATE_MUTATION`), drafts emails, WhatsApp links, and proposals.
   - `prospecting_agent`: Account & Lead Discovery Specialist (`L0_READ`), search, filters, and domain lookups.
   - `enrichment_agent`: Multi-Provider Waterfall Specialist (`L1_INTERNAL_DRAFT`), technologies, contacts, email verification.
   - `qualification_agent`: Lead Scoring & ICP Qualification Analyst (`L0_READ`), explainable scoring, buying signals.
   - `sales_coach`: Objections & Value Proposition Coach (`L1_INTERNAL_DRAFT`), objection counters, personalized pitch formulations.
3. Augment `src/platform/identity/agent-persona-types.ts`:
   - Add `'prospecting_agent'`, `'enrichment_agent'`, `'qualification_agent'`, `'sales_coach'` to `AGENT_PERSONA_IDS`.
4. Augment `src/platform/identity/agent-registry.ts`:
   - Import `SALES_PERSONA_DEFINITIONS` and register in `BUILT_IN_AGENT_PERSONAS`.
   - Add alias mappings to `SPECIALIST_ALIAS_MAP`:
     - `prospector: 'prospecting_agent'`
     - `enricher: 'enrichment_agent'`
     - `lead_qualifier: 'qualification_agent'`
     - `pitch_coach: 'sales_coach'`

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/platform/__tests__/sales/sales-personas.test.ts`  
Expected: PASS (5/5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/platform/agents/sales/personas/sales-persona* src/platform/identity/agent-persona* src/platform/identity/agent-registry* src/platform/__tests__/sales/sales-personas.test.ts
git commit -m "feat(sales): add specialized sales persona definitions and identity registry integration"
```

---

### Task 2: Permission, Tool, Failure & Rollback Matrices (`sales-agent-matrix.ts`)

**Files:**
- Create: `src/platform/agents/sales/personas/sales-agent-matrix.ts`
- Create: `src/platform/agents/sales/personas/index.ts`
- Create: `src/platform/__tests__/sales/sales-agent-matrix.test.ts`

- [ ] **Step 1: Write the failing matrix tests**

```typescript
// src/platform/__tests__/sales/sales-agent-matrix.test.ts
import { describe, it, expect } from 'vitest';
import {
  SALES_PERMISSION_MATRIX,
  SALES_TOOL_MATRIX,
  SALES_FAILURE_MATRIX,
  SALES_ROLLBACK_MATRIX,
} from '../../agents/sales/personas/sales-agent-matrix';
import { SALES_PERSONA_IDS } from '../../agents/sales/personas/sales-persona-definitions';

describe('Sales Governance Matrices', () => {
  it('defines explicit non-wildcard permissions for every persona (Rule 16)', () => {
    for (const personaId of SALES_PERSONA_IDS) {
      const perms = SALES_PERMISSION_MATRIX[personaId];
      expect(perms).toBeDefined();
      expect(perms.length).toBeGreaterThan(0);
      for (const p of perms) {
        expect(p).not.toContain('*');
      }
    }
  });

  it('maps all 15 canonical sales & SDR capabilities in the Tool Matrix with valid risk levels (Rule 12 & 14)', () => {
    expect(SALES_TOOL_MATRIX.length).toBeGreaterThanOrEqual(15);
    const capIds = SALES_TOOL_MATRIX.map((e) => e.capabilityId);
    expect(capIds).toContain('lead.search');
    expect(capIds).toContain('lead.score');
    expect(capIds).toContain('lead.enrich');
    expect(capIds).toContain('lead.get_intelligence');
    expect(capIds).toContain('lead.get_decision_makers');
    expect(capIds).toContain('lead.get_buying_signals');
    expect(capIds).toContain('lead.get_recommended_pitch');
    expect(capIds).toContain('lead.get_objection_handlers');
    expect(capIds).toContain('sdr.get_daily_briefing');
    expect(capIds).toContain('sdr.get_priority_queue');
    expect(capIds).toContain('sdr.generate_outreach_draft');
    expect(capIds).toContain('sdr.create_whatsapp_link');
    expect(capIds).toContain('sdr.request_outreach_approval');
    expect(capIds).toContain('sdr.record_outreach_outcome');
    expect(capIds).toContain('sdr.get_conversion_insights');
  });

  it('handles at least 12 distinct failure codes in the Failure Matrix (Rule 48)', () => {
    expect(SALES_FAILURE_MATRIX.length).toBeGreaterThanOrEqual(12);
    const failureCodes = SALES_FAILURE_MATRIX.map((e) => e.failureCode);
    expect(failureCodes).toContain('LEAD_NOT_FOUND');
    expect(failureCodes).toContain('RATE_LIMITED');
    expect(failureCodes).toContain('PROMPT_INJECTION_DETECTED');
    expect(failureCodes).toContain('DEAD_MAN_SWITCH_ENGAGED');
    expect(failureCodes).toContain('IDOR_VIOLATION');
    expect(failureCodes).toContain('DNS_MX_UNRESOLVED');
    expect(failureCodes).toContain('SSRF_DISALLOWED');
    expect(failureCodes).toContain('DISPOSABLE_EMAIL');
    expect(failureCodes).toContain('MODEL_HALLUCINATION');
    expect(failureCodes).toContain('STALE_APPROVAL_PROPOSAL');
    expect(failureCodes).toContain('TOCTOU_CONCURRENCY_CONFLICT');
    expect(failureCodes).toContain('BUDGET_EXCEEDED');
  });

  it('binds compensating capabilities in the Rollback Matrix for mutating operations (Rule 27)', () => {
    expect(SALES_ROLLBACK_MATRIX.length).toBeGreaterThanOrEqual(3);
    for (const entry of SALES_ROLLBACK_MATRIX) {
      expect(entry.mutatingCapabilityId).toBeTruthy();
      expect(entry.compensatingCapabilityId).toBeTruthy();
      expect(entry.strategy).toBe('REVERSE_LIFO');
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/platform/__tests__/sales/sales-agent-matrix.test.ts`  
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement `sales-agent-matrix.ts` and `index.ts`**

Author:
1. `SALES_PERMISSION_MATRIX`: Exact RBAC scopes (`crm:entities:read`, `crm:entities:edit`, `crm:leads:search`, `crm:leads:score`, `sdr:outreach:draft`, `sdr:outreach:send`).
2. `SALES_TOOL_MATRIX`: Inventory of 15 capabilities with Zod schema verification and risk classifications.
3. `SALES_FAILURE_MATRIX`: 12 error taxonomy codes and recovery strategies (`FAIL_CLOSED`, `RE_FETCH_AND_VERIFY`, `FALLBACK_TO_STATIC`, `DEGRADE_GRACEFULLY`, `ROUTE_TO_PROPOSAL`, `CIRCUIT_BREAKER_BACKOFF`).
4. `SALES_ROLLBACK_MATRIX`: Reverse-LIFO Saga compensation entries for mutating capabilities (`lead.enrich`, `sdr.generate_outreach_draft`, `sdr.request_outreach_approval`).
5. `src/platform/agents/sales/personas/index.ts`: Barrel export.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/platform/__tests__/sales/sales-agent-matrix.test.ts`  
Expected: PASS (4/4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/platform/agents/sales/personas/ src/platform/__tests__/sales/sales-agent-matrix.test.ts
git commit -m "feat(sales): add Permission, Tool, Failure, and Rollback matrices for sales workforce"
```

---

### Task 3: 20+ Enterprise Evaluation Benchmark Dataset (`sales-eval-types.ts` & `sales-eval-dataset.ts`)

**Files:**
- Create: `src/platform/agents/sales/evaluation/sales-eval-types.ts`
- Create: `src/platform/agents/sales/evaluation/sales-eval-dataset.ts`
- Create: `src/platform/__tests__/sales/sales-eval-dataset.test.ts`

- [ ] **Step 1: Write the failing eval dataset tests**

```typescript
// src/platform/__tests__/sales/sales-eval-dataset.test.ts
import { describe, it, expect } from 'vitest';
import {
  SALES_EVAL_CATEGORIES,
  SALES_EVAL_DATASET,
  SalesEvalScenarioSchema,
} from '../../agents/sales/evaluation/sales-eval-dataset';

describe('Sales Evaluation Dataset', () => {
  it('contains at least 20 gold-standard evaluation scenarios', () => {
    expect(SALES_EVAL_DATASET.length).toBeGreaterThanOrEqual(20);
  });

  it('covers all 6 canonical sales evaluation categories', () => {
    const categories = new Set(SALES_EVAL_DATASET.map((s) => s.category));
    for (const cat of SALES_EVAL_CATEGORIES) {
      expect(categories.has(cat)).toBe(true);
    }
  });

  it('validates every evaluation scenario against SalesEvalScenarioSchema', () => {
    for (const scenario of SALES_EVAL_DATASET) {
      const parsed = SalesEvalScenarioSchema.safeParse(scenario);
      expect(parsed.success).toBe(true);
      expect(scenario.groundTruthFacts.length).toBeGreaterThan(0);
      expect(scenario.expectedActions.length).toBeGreaterThan(0);
      expect(scenario.workspaceId).toBeTruthy();
      expect(scenario.organizationId).toBeTruthy();
    }
  });

  it('includes explicit adversarial and security attack scenarios (Rule 46)', () => {
    const securityScenarios = SALES_EVAL_DATASET.filter((s) => s.category === 'SECURITY_ATTACK');
    expect(securityScenarios.length).toBeGreaterThanOrEqual(4);
    for (const sec of securityScenarios) {
      expect(sec.forbiddenActions).toBeDefined();
      expect(sec.forbiddenActions?.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/platform/__tests__/sales/sales-eval-dataset.test.ts`  
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement `sales-eval-types.ts` and `sales-eval-dataset.ts`**

Author:
1. `SALES_EVAL_CATEGORIES`:
   - `ENTERPRISE_DISCOVERY`: Account searches in Education, Banking, Logistics, and Health.
   - `WATERFALL_ENRICHMENT`: Incomplete lead profiles requiring multi-stage contact and domain enrichment.
   - `ICP_QUALIFICATION`: High vs low ICP fit accounts with explainable driver validation.
   - `DEEP_RESEARCH_DOSSIER`: Technographic synthesis, payment gap discovery, and executive summaries.
   - `OUTBOUND_PITCH_DRAFT`: Multi-channel outreach drafts (Email, WhatsApp) with persona targeting.
   - `SECURITY_ATTACK`: Prompt injection inside scraped meta tags, SSRF private IP probes, IDOR tenant mismatches, and unapproved bulk send attempts.
2. 24 fully detailed, realistic scenarios with `groundTruthFacts`, `expectedPersona`, `expectedRiskLevel`, `expectedActions`, and `forbiddenActions`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/platform/__tests__/sales/sales-eval-dataset.test.ts`  
Expected: PASS (4/4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/platform/agents/sales/evaluation/sales-eval* src/platform/__tests__/sales/sales-eval-dataset.test.ts
git commit -m "feat(sales): add 24-scenario gold-standard evaluation dataset covering sales workflows and security probes"
```

---

### Task 4: Shadow Mode Simulation Harness & Blast Radius Reports (`sales-shadow-mode.ts`)

**Files:**
- Create: `src/platform/agents/sales/evaluation/sales-shadow-mode.ts`
- Create: `src/platform/agents/sales/evaluation/index.ts`
- Create: `src/platform/agents/sales/index.ts`
- Create: `src/platform/__tests__/sales/sales-shadow-mode.test.ts`

- [ ] **Step 1: Write the failing shadow mode simulation tests**

```typescript
// src/platform/__tests__/sales/sales-shadow-mode.test.ts
import { describe, it, expect } from 'vitest';
import { SalesShadowRunner } from '../../agents/sales/evaluation/sales-shadow-mode';

describe('Sales Shadow Mode Simulation', () => {
  it('runs a read-only prospecting simulation with zero mutations and outputs Blast Radius Report (Rule 42)', async () => {
    const runner = new SalesShadowRunner();
    const result = await runner.simulate({
      personaId: 'prospecting_agent',
      organizationId: 'org_test',
      workspaceId: 'ws_test',
      goalPrompt: 'Find top 5 technology leads in Accra',
      simulatedSteps: [
        {
          capabilityId: 'lead.search',
          input: { queryText: 'Technology', limit: 5 },
          riskLevel: 'L0_READ',
        },
      ],
    });

    expect(result.dryRun).toBe(true);
    expect(result.liveMutationsExecuted).toBe(0);
    expect(result.blastRadiusReport).toBeDefined();
    expect(result.blastRadiusReport.overallRiskLevel).toBe('L0_READ');
    expect(result.blastRadiusReport.interceptedMutationsCount).toBe(0);
  });

  it('intercepts mutating capabilities in shadow mode and prevents live writes (Rule 42)', async () => {
    const runner = new SalesShadowRunner();
    const result = await runner.simulate({
      personaId: 'enrichment_agent',
      organizationId: 'org_test',
      workspaceId: 'ws_test',
      goalPrompt: 'Enrich prospect lead_sample_01',
      simulatedSteps: [
        {
          capabilityId: 'lead.enrich',
          input: { prospectId: 'lead_sample_01', domain: 'example.com' },
          riskLevel: 'L1_INTERNAL_DRAFT',
        },
      ],
    });

    expect(result.dryRun).toBe(true);
    expect(result.liveMutationsExecuted).toBe(0);
    expect(result.blastRadiusReport.interceptedMutationsCount).toBe(1);
    expect(result.blastRadiusReport.overallRiskLevel).toBe('L1_INTERNAL_DRAFT');
  });

  it('flags non-delegable operations as requiring human intervention (Rule 17 & 21)', async () => {
    const runner = new SalesShadowRunner();
    const result = await runner.simulate({
      personaId: 'lead_sdr',
      organizationId: 'org_test',
      workspaceId: 'ws_test',
      goalPrompt: 'Dispatch outbound campaign',
      simulatedSteps: [
        {
          capabilityId: 'sdr.unsolicited_bulk_send',
          input: { recipients: ['ceo@target.com'] },
          riskLevel: 'L3_EXTERNAL_COMMUNICATION_FINANCE',
        },
      ],
    });

    expect(result.blastRadiusReport.hasNonDelegableActions).toBe(true);
    expect(result.blastRadiusReport.requiresHumanApproval).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/platform/__tests__/sales/sales-shadow-mode.test.ts`  
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement `sales-shadow-mode.ts` and barrels**

Author:
1. `SalesShadowRunner`:
   - Enforces `dryRun: true` (Rule 42).
   - Validates persona authority against `SALES_PERMISSION_MATRIX` and `SALES_TOOL_MATRIX`.
   - Intercepts mutating operations (`L1_INTERNAL_DRAFT`, `L2_STATE_MUTATION`, `L3_EXTERNAL_COMMUNICATION_FINANCE`, `L4_PRIVILEGED_DESTRUCTIVE`), guaranteeing 0 live database writes.
   - Evaluates dead-man switch via `checkGovernanceDeadManSwitch` (Rule 60).
   - Emits `sales.agent.simulated` domain event to `defaultEventBus` (Rule 40).
   - Synthesizes `BlastRadiusReport` with explainability breakdown (WHAT / WHY / EXPECTED STATE CHANGE) (Rule 41).
2. Barrels:
   - `src/platform/agents/sales/evaluation/index.ts`
   - `src/platform/agents/sales/index.ts`

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/platform/__tests__/sales/sales-shadow-mode.test.ts`  
Expected: PASS (3/3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/platform/agents/sales/ src/platform/__tests__/sales/sales-shadow-mode.test.ts
git commit -m "feat(sales): add SalesShadowRunner simulation harness and automated Blast Radius Reports"
```

---

### Task 5: Milestone 2 Verification, Baseline Regression & Quality Gate

- [ ] **Step 1: Run full sales test suite**

Run: `pnpm vitest run src/platform/__tests__/sales/`  
Expected: 100% tests passing across all 8 sales test files (Contracts, Capabilities, Context Assembler, Server Actions, Personas, Matrices, Eval Dataset, Shadow Mode).

- [ ] **Step 2: Run baseline regression suite**

Run: `pnpm vitest run src/platform/__tests__/baseline/`  
Expected: 100% tests passing across all 6 baseline regression suites (Rule 69 Strangler Invariant).

- [ ] **Step 3: Run TypeScript static typecheck**

Run: `NODE_OPTIONS='--max-old-space-size=8192' pnpm typecheck`  
Expected: Clean exit code 0 (`tsc --noEmit`, 0 compilation errors).

- [ ] **Step 4: Run ESLint static analysis**

Run: `pnpm lint`  
Expected: Clean exit code 0 (0 errors, warnings strictly under ceiling $\le 670$).

- [ ] **Step 5: Author Milestone 2 Completion Report**

Create: `docs/agents_mcp/phases/agents_mcp_phase_10_milestone_2_completion_report.md`  
Commit:
```bash
git add docs/agents_mcp/phases/agents_mcp_phase_10_milestone_2_completion_report.md
git commit -m "docs(sales): add Phase 10 Milestone 2 completion report"
```
