# SmartSapp Agentic & MCP Transformation: Phase 10 Milestone 5 Implementation Plan
## Flagship Revenue Operations Workflow, Autonomous Multi-Agent Swarm, Adversarial Red-Team & Platform QA
### Deeply Integrated with `docs/agents_mcp/agents_mcp_rules.md`, `theme.md` §8 & The 69 Agentic Development Rules

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement and verify the flagship signature autonomous revenue operations workflow: *"Find 20 qualified leads in edtech and prepare outreach"* — coordinating the 6-stage autonomous swarm pipeline (Discovery $\rightarrow$ Waterfall Enrichment $\rightarrow$ Deep Research $\rightarrow$ Explainable Qualification $\rightarrow$ SDR Personalization $\rightarrow$ Governance Approval Staging). Author the `RevenueSwarmOrchestrator`, expose secure Next.js 15 Server Actions, build the `theme.md` §8 compliant `RevenueSwarmModal`, execute an exhaustive adversarial red-team security test suite, and achieve full QA verification across the entire platform.

**Architecture:** Build canonical swarm contracts in `src/platform/agents/sales/swarm/revenue-swarm-types.ts`. Implement the 6-stage `RevenueSwarmOrchestrator` in `src/platform/agents/sales/swarm/revenue-swarm-orchestrator.ts` coordinating `prospecting_agent`, `enrichment_agent`, `lead_researcher`, `qualification_agent`, and `lead_sdr` with bounded concurrency ($\le 4$), knapsack context compression ($\le 4,000$ tokens), and emergency dead-man pause evaluation (Rule 60). Expose 4 secure Server Actions in `src/app/actions/revenue-swarm-actions.ts`. Author a `theme.md` §8 compliant `RevenueSwarmModal` and mount it into `ProspectFinderHud.tsx` and `ProspectFinderTab.tsx`. Validate with an adversarial red-team security suite (SSRF, prompt injection, payload tampering, anti-self-approval, dead-man pause) and full platform regression suites.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript (zero `any`/`any[]`), Zod v4, Lucide React, Tailwind CSS, Firestore Admin SDK, Vitest.

---

## 1. Executive Summary & The Flagship Revenue Workflow

In [`docs/agents_mcp/agents_mcp_roadmap.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/docs/agents_mcp/agents_mcp_roadmap.md) (§ Phase 10, lines 1583–1668) and [`docs/agents_mcp/phases/agents_mcp_phase_10_master_plan.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/docs/agents_mcp/phases/agents_mcp_phase_10_master_plan.md) (§1.3, lines 51–100), the signature revenue operations workflow of the Second Agent Wave is defined:

> **User or Rep prompts:**  
> *“Find 20 qualified leads in edtech and prepare outreach”*  
> (or clicks **"Launch Revenue Swarm"** from the Prospect Finder HUD)
>  
> **The Autonomous Revenue Swarm executes the 6-Stage Coordinated Pipeline:**  
> 1. **Discovery (`prospecting_agent`):** Discovers high-intent educational institutions and deduplicates against workspace CRM entities (`/workspace_entities`) and known contacts.  
> 2. **Enrichment (`enrichment_agent`):** Runs waterfall lookups, verifies domain validity, and performs email deliverability checks (DNS/MX/syntax).  
> 3. **Research (`lead_researcher`):** Scrapes public web data, detects fee collection pain points, technographic footprints, and decision-maker roles. Untrusted content is containerized inside `<untrusted-reference-data id="...">` (Rules 13 & 30).  
> 4. **Qualification (`qualification_agent`):** Calculates harmonic explainable qualification scores across Fit, Need, Intent, Budget, Authority, and Recency, filtering the top qualified prospects.  
> 5. **Personalization (`lead_sdr`):** Formulates tailored value proposition pitches across WhatsApp and Email with grounded objection handlers, E.164 phone normalization (`+233...` / `wa.me`), and variable interpolation delegated to `FieldsVariablesService.resolveTemplateVariables` (Workspace SSOT).  
> 6. **Governance & Staging (`outbound_agent` / `sdr`):** Stages cadences as formal governance proposals in `ApprovalStore` (Rules 21 & 22) with canonical sorted SHA-256 `payloadHash`, presenting staged drafts for operator review in `OutreachReviewDrawer`.

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│             PHASE 10 MILESTONE 5: FLAGSHIP REVENUE SWARM & PLATFORM QA                 │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                 OPERATOR SURFACES                                      │
│  Prospect Finder HUD (/admin/lead-intelligence)         Global ⌘K Omni-Bar (/admin)    │
│  ├── [Launch Revenue Swarm] Action Button               └── "Find 20 edtech leads..."  │
│  │                                                                                     │
│  ▼                                                                                     │
│  RevenueSwarmModal (theme.md §8)                                                       │
│  ├── Swarm Goal Presets (Edtech outreach, Greater Accra schools, Stalled re-engagement)│
│  ├── Configuration Form (Target industry, geography, count, SDR persona, channels)    │
│  ├── 6-Stage Visual Pipeline Progress (Discovery → Enrichment → Research → Qual → SDR) │
│  ├── Real-time Stage Metrics Cards & Blast Radius Report (0 Live Mutations in dryRun) │
│  └── 1-Click Action ──► OutreachReviewDrawer (Review & Approve Staged Cadences)        │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                         SECURE NEXT.JS 15 SERVER ACTIONS                               │
│                     (src/app/actions/revenue-swarm-actions.ts)                         │
│  ├── launchRevenueSwarmAction             ├── getRevenueSwarmHistoryAction             │
│  ├── cancelRevenueSwarmAction             └── getRevenueSwarmMetricsAction             │
│  ├── requireAuth() [Clerk Session Authentication] (Rule 51)                            │
│  ├── assertTenantContext() [Anti-IDOR Multi-Tenant Lock] (Rules 8 & 47)                │
│  └── checkGovernanceDeadManSwitch() [Emergency Pause Evaluation] (Rule 60)             │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                 CORE REVENUE SWARM ORCHESTRATOR SUBSYSTEM                              │
│                 (src/platform/agents/sales/swarm/)                                     │
│  ├── RevenueSwarmOrchestrator (6-stage autonomous pipeline, bounded concurrency <= 4) │
│  ├── RevenueSwarmContracts (Strict Zod v4 schemas, stage results, error taxonomy)      │
│  └── Swarm Event Logging (sales.swarm.started, stage_completed, approval_required)     │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                   MULTI-DOMAIN CAPABILITIES & GOVERNANCE BRIDGE                        │
│  ├── LeadContextAssembler (M1)              ├── Explainable Scoring Engine (M1)        │
│  ├── Specialized Personas & Matrix (M2)     ├── SdrOutboundEngine & SSOT Resolver (M4) │
│  ├── Canonical Capabilities lead.* & sdr.*  └── ApprovalStore & PayloadHash (M4)       │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Invariant Architecture: Dual-Tier CRM Data Model & Governed Capability Layer (Rule 69)

In accordance with [`docs/agents_mcp/agents_mcp_rules.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/docs/agents_mcp/agents_mcp_rules.md) (Rule 69):

> **"Do not build an 'AI layer' beside SmartSapp. Build a governed capability layer underneath SmartSapp that both humans and agents use."**

```text
                 USER (Admin / Sales Rep)
                    │
                 AGENT (Revenue Swarm Orchestrator / Lead SDR)
                    │
               MCP / AI UX (Prospect Finder HUD, Omni-Bar, Swarm Modal)
                    │
           ┌────────▼────────┐
           │ POLICY + TRUST  │ (Rules 11-18, 51, 60, Anti-IDOR, Dead-Man)
           └────────┬────────┘
                    │
           CAPABILITY REGISTRY (lead.*, sdr.*)
                    │
         ┌──────────┼──────────┐
      DISCOVERY  ENRICHMENT  OUTBOUND
         │          │          │
         └──────────┼──────────┘
                    │
               DOMAIN SERVICES (LeadContextAssembler, SdrOutboundEngine, ScoringEngine)
                    │
             FIRESTORE / DB (/entities [master], /workspace_entities, /sdr_drafts)
                    │
            EVENTS + APPROVALS (defaultEventBus, ApprovalStore, payloadHash)
```

### The Dual-Tier CRM Data Model Invariant:
1. **Global Master Identity (`entities`):** `/entities/{entityId}` stores immutable, organization-wide corporate identity (legal name, registration, headquarters address, base website, verified industry). The discovery agent reads and links to global identity, but **never** mutates it.
2. **Workspace Operational Record (`workspace_entities`):** `/workspace_entities/{workspaceId}_{entityId}` stores workspace-scoped CRM execution state (qualification score, assigned SDR, outreach cadence history, tags).
3. **Execution Invariant:** Any mutation triggered by lead enrichment or campaign preparation updates `/workspace_entities/{workspaceId}_{entityId}` or stages drafts in `capability_approvals` / `sdr_drafts`.
4. **Strangler Fig Invariant:** All preexisting Lead Intelligence tabs, filters, scanners, and actions continue functioning with 100% backward compatibility. Zero regressions across baseline test suites.

---

## 3. Failure Mode & Edge Case Mitigation Matrix (Rule 2)

In accordance with Rule 2 of `agents_mcp_rules.md`:

| Failure Mode / Edge Case | Risk | Architectural Defense & Mitigation Strategy |
| :--- | :--- | :--- |
| **Discovery Deduplication Collision** | Duplicate lead creation or CRM record pollution | `LeadContextAssembler` queries existing `/workspace_entities` by domain and normalized name before inserting new prospects. Duplicates are tagged rather than duplicated. |
| **Enrichment Provider Outage / 429** | Swarm pipeline blocks or hangs | 4-tier waterfall fallback (Clearbit $\rightarrow$ Apollo $\rightarrow$ Hunter $\rightarrow$ BuiltWith) protected by 5-state circuit breakers (Rule 24). Returns partial enrichment diagnostics rather than crashing. |
| **Malformed Scraped Web HTML / Injection** | Cross-Site Scripting or prompt injection | Web crawler responses parsed through HTML entity sanitization; dynamic text wrapped inside `<untrusted-reference-data id="...">` containers (Rules 13 & 30). |
| **Incomplete Technographic Footprint** | NaN or unhandled score calculation exception | `ExplainableScoringEngine` applies defensive fallback defaults (0 score for missing criteria) with explicit confidence discount. |
| **WhatsApp Phone Format Anomaly** | Invalid URL or broken click-to-chat links | `SdrOutboundEngine.normalizePhoneNumber` sanitizes Ghana/regional prefixes (`020...`, `024...`, `2330...` $\rightarrow$ `+233...`). If unresolvable, WhatsApp channel is flagged unavailable with diagnostic reason. |
| **Two-Phase Payload Tampering** | Unauthorized mutation of staged sequence parameters | Live cryptographic check in `dispatchApprovedOutreachAction` asserts `proposal.payloadHash === computeOutreachPayloadHash(payload)`. Rejects mismatched execution with `PAYLOAD_TAMPERED` (Rule 22). |
| **Anti-Self-Approval Bypass Attempt** | Operator approves their own outbound outreach | Server Actions enforce `authorizingUserId !== approvedBy` (Rule 13), failing closed with `SELF_APPROVAL_FORBIDDEN`. |
| **Emergency Dead-Man Switch Trip** | Operator halts operations during active swarm run | `checkGovernanceDeadManSwitch` evaluated before every stage; immediately aborts with HTTP 503 / `SALES_DEAD_MAN_PAUSED` (Rule 60). |
| **High Concurrency / Resource Overload** | Cloud Run memory exhaustion or rate limits | Bounded concurrency ($\le 4$ parallel operations, Rule 9 & 23); greedy knapsack compression ($\le 4,000$ tokens, Rule 28 & 56). |

---

## 4. Backoffice Observability & No-Code Operator Governance (Rule 3 & 68)

In accordance with Rule 3 and Rule 68 (Invariant 15: "Operable without code"):

1. **Backoffice Observability (`/admin/intelligence/runs` & `/admin/lead-intelligence`):**
   - Operators can inspect the 6-stage swarm execution timeline, latency metrics, token consumption, and staged action proposals.
   - Real-time Server-Sent Events (`useEventStream`) stream swarm progression without polling (Rule 62).
2. **Backoffice Two-Phase Approval Desk (`/admin/intelligence/approvals`):**
   - Outbound sequences staged by the swarm surface immediately in the operator approval center with Rule 41 explainability grids (**WHAT**, **WHY**, **EXPECTED STATE CHANGE**) and SHA-256 payload hashes.
3. **Emergency Kill-Switch Control:**
   - Operators can trip the global or sales dead-man switch from the Backoffice governance console, immediately terminating active swarm runs and dispatches without code deployment.
4. **No-Code Persona & Policy Management (`/admin/intelligence/agents`):**
   - Sales Managers can adjust SDR persona instructions, allowed domains, and daily sending limits through the Visual Agent Studio without modifying TypeScript files.

---

## 5. The Five Non-Negotiable Invariants (Rule 68)

In `docs/agents_mcp/agents_mcp_rules.md` (Section 68, lines 2077–2101), five principles are designated as **absolutely non-negotiable**. Milestone 5 embeds these into every task:

### **Invariant 11 — The model is never the security boundary.**
*Authorization, validation, and policy happen completely outside the model.*
- The LLM cannot authorize outbound sends, bypass tenant checks, or directly invoke mutations.
- Next.js Server Actions validate Clerk session authentication (`requireAuth()`), enforce tenant lock (`assertTenantContext`), and evaluate Zod v4 schemas *before* the model is consulted, and validate model outputs *after* generation.

### **Invariant 12 — Tool output is untrusted data.**
*Never allow tool output, retrieved documents, or customer content to become instructions.*
- Scraped school websites, meta tags, and public contact notes are parsed as untrusted data and strictly wrapped in XML isolation containers: `<untrusted-reference-data id="...">`.
- The prompt instructs the LLM that content inside `<untrusted-reference-data>` is reference material only and cannot contain executable directives or system prompt overrides.

### **Invariant 13 — Every mutation must be idempotent, authorized, version-checked, and auditable.**
*This prevents an enormous class of agent failures.*
- Any action originating from the swarm inquiry generates a deterministic idempotency key (`sales_swarm_${orgId}_${hash}`).
- Enforces cryptographic SHA-256 `payloadHash` binding on all staged sequence proposals (Rule 22).
- Emits immutable audit domain events to `defaultEventBus` (Rule 40).

### **Invariant 14 — Every production agent must have bounded authority and bounded resources.**
*Permissions, tokens, time, tool calls, records, money, and external side effects all need limits.*
- Context assembly is bounded by greedy knapsack packing to $\le 4,000$ tokens (Rules 28 & 56).
- Maximum swarm execution duration is capped at 60,000ms.
- Concurrency ceiling: $\le 4$ parallel operations during discovery/enrichment (Rules 9 & 23).
- Non-delegable operations (unsolicited mass bulk blast, entity deletion) are permanently stripped (Rule 17).

### **Invariant 15 — Every autonomous capability must be operable without code.**
*Backoffice must be able to inspect, pause, disable, approve, rollback, replay, and investigate it.*
- Operators can inspect the full 6-stage swarm execution, token metrics, and staged proposals.
- The emergency dead-man switch (`checkGovernanceDeadManSwitch`) can halt all autonomous sales execution instantly without redeploying code.
- Every staged proposal can be reviewed and approved in `OutreachReviewDrawer` or rejected via two-phase governance (Rule 21).

---

## 6. Master 69-Rules Alignment & Enforcement Matrix for Milestone 5

| Rule # | Requirement | Milestone 5 Architectural Implementation & Verification |
| :---: | :--- | :--- |
| **Rule 1** | Skill Conformance & Standards | Conforms strictly to Next.js 15 App Router, React 19, Tailwind CSS, TypeScript strict mode, and modular decomposition. All legacy features preserved. |
| **Rule 2** | Failure Mode Planning & Cleanliness | Detailed failure matrix covering provider 429s, DNS timeouts, malformed HTML, prompt injection, and dead-man pause. |
| **Rule 3** | Backoffice Enhancement & Non-Breaking | Embeds directly into `/admin/lead-intelligence` and Prospect Finder HUD without breaking existing tabs, search, or filters. |
| **Rule 4** | Zero `any` / Zero `any[]` Typing Policy | 100% strictly typed props, state, actions, and schema returns. `unknown` permitted only at raw boundaries, validated immediately with Zod v4. |
| **Rule 5** | Staged Deployment & Security Verification | All contracts, orchestrators, actions, and UI modals verified with isolated tests before production integration. |
| **Rule 6** | Dependencies & Context7 Documentation | Uses verified stable versions of `zod/v4`, `lucide-react`, and `node:crypto`. |
| **Rule 7** | Mobile-First & Plain UI English | All touch targets $\ge 44\text{px}$ (`min-h-[44px]`), Emil Kowalski tactile clicks (`active:scale-[0.97]`), and plain human language for stage names and explanations. |
| **Rule 8** | High Security, Data Protection & Anti-IDOR | Every server action enforces caller session `organizationId` matching requested `workspaceId`/`swarmRunId` boundaries. IDOR attempts fail closed with HTTP 403. |
| **Rule 9** | High Load & Resource Exhaustion Defense | Lead discovery queries bounded to $\le 50$ items; payload sizes $< 2\text{MB}$; concurrency capped at 4 parallel specialists. |
| **Rule 10** | Inline Architectural Documentation | Every authored file includes comprehensive `@fileOverview` documentation detailing architecture, security invariants, Rule mappings, and testability pointers. |
| **Rule 11** | MCP Protocol Compliance | Action definitions bind to canonical MCP tool outputs; Spec 2026-07-28 Streamable HTTP compatible. |
| **Rule 12** | Risk Ceilings & Weighted Rank | Actions classified by canonical 5-tier risk levels: `L0_READ` (discovery/search), `L1_INTERNAL_DRAFT` (scoring/drafting), `L2_STATE_MUTATION` (logging/tagging), `L3_EXTERNAL_COMMUNICATION_FINANCE` (outbound sequence staging). |
| **Rule 13** | Formal Trust Boundary Matrix & Anti-Self-Approval | Scraped website notes wrapped in `<untrusted-reference-data id="...">` containers. Requesters cannot approve their own high-risk sequence proposals (`SELF_APPROVAL_FORBIDDEN`). |
| **Rule 14** | Tool Poisoning / Rug-Pull Defense | Action triggers verify cryptographic composite SHA-256 fingerprints before executing bound capabilities. |
| **Rule 15** | Server Allowlisting & Supply-Chain Hardening | External enrichment links and crawler URLs validated against allowlists with SSRF prevention. |
| **Rule 16** | Agent Identity as Security Principal | Swarm executes under authenticated caller identity with explicit RBAC scopes (`operations:campuses:view`, `crm:entities:read`); no wildcard (`*`) permissions. |
| **Rule 17** | Non-Delegable Actions | Unsolicited autonomous mass sending without human review stripped from autonomous execution affordances. |
| **Rule 18** | TOCTOU Live Principal / Record Check | Proposal `payloadHash` verified before executing outbound dispatch. |
| **Rule 19** | Mandatory Idempotency for Mutating Tools | Mutating recommendation triggers generate deterministic idempotency keys (`sales_swarm_${orgId}_${hash}`). |
| **Rule 20** | Replay & Distributed Tracing | Injects `correlationId` and `traceparent` headers into domain event metadata and Server Action responses. |
| **Rule 21** | Two-Phase Action Model | Staging cadences as action proposals requiring operator review before execution (PLAN -> PREVIEW -> APPROVE -> EXECUTE). |
| **Rule 22** | Cryptographic Approval Binding | Mutating proposals bound to canonical key-sorted SHA-256 `payloadHash`. When executing, rejects with `PAYLOAD_TAMPERED` if mismatched. |
| **Rule 23** | Resource Governance & Budgets | Context assembler enforces 4,000-token ceiling; swarm run duration bounded to 60,000ms. |
| **Rule 24** | 5-State Circuit Breakers | External enrichment APIs protected by circuit breakers (`healthy`, `degraded`, `open`, `half_open`, `recovered`). |
| **Rule 25** | Dead-Letter & Recovery Queues | Failed swarm steps report structured diagnostics and log to EventBus audit log. |
| **Rule 26** | True Cooperative Cancellation | Swarm orchestrator accepts native `AbortSignal` cooperative cancellation. |
| **Rule 27** | Formal Saga / Compensation Model | Mutating proposals bind compensating capabilities for rollback if rejected. |
| **Rule 28** | Context Budgeting | Stratified knapsack packing bounds prospect context strictly $\le 4,000$ tokens. |
| **Rule 29** | Memory Governance | Fresh buying signals weighted higher than stale historical interactions using temporal decay. |
| **Rule 30** | Knowledge Poisoning Defense | Untrusted text isolated within `<untrusted-reference-data id="...">` containers. |
| **Rule 31** | Output Validation Between Agent & Tool | Zod v4 schema validation on all action and proposal outputs via `safeParse`. |
| **Rule 32** | Cross-Domain Exfiltration Defense | Swarm queries restricted strictly to sales domain scopes (`lead_intelligence`, `crm_contacts`, `campaigns_growth`, `messaging_outbound`). |
| **Rule 33** | Outbound Egress Control & Redaction | Redacts sensitive credentials, API keys, and PII from UI summaries (`[REDACTED_SECRET:<type>]`). |
| **Rule 34** | SSRF & Network Boundary Controls | Web crawlers and enrichment URLs validated via `validateSafeEgressUrl` blocking loopback, GCP metadata, and private subnets. |
| **Rule 35** | MCP Discovery Caching | Deterministic ETag HTTP 304 caching for action schemas. |
| **Rule 36** | Capability Version Compatibility | Declares exact SemVer contracts for sales capabilities. |
| **Rule 37** | MCP Spec Compatibility Testing | Conforms to Spec 2026-07-28 test suites. |
| **Rule 38** | No Features on Deprecated MCP Primitives | Uses Streamable HTTP; no stateful session leaks. |
| **Rule 39** | OpenTelemetry From Day One | Propagates W3C `traceparent` headers across server actions and domain events. |
| **Rule 40** | Audit Log Immutability | Publishes `sales.swarm.started`, `stage_completed`, `completed`, `approval_required` to EventBus. |
| **Rule 41** | "Why Did You Do This?" Audit View | Every staged sequence features WHAT, WHY, and EXPECTED STATE CHANGE explainability dimensions. |
| **Rule 42** | Mandatory Shadow Mode | All swarm runs can be previewed/simulated with `dryRun: true` and Blast Radius Reports. |
| **Rule 43** | Replayable Agent Runs | Swarm session snapshots capture full stage progression allowing deterministic replay. |
| **Rule 44** | Deterministic Evaluation Dataset | Validated against the 24 gold-standard evaluation scenarios from Milestone 2. |
| **Rule 45** | Chaos Testing | Handles network drops, missing emails, or invalid numbers gracefully with fallback diagnostics. |
| **Rule 46** | Adversarial UI Testing | Red-team test suite against prompt injection via notes, cross-tenant IDOR probing, and unapproved mutation bypass. |
| **Rule 47** | Never Trust the Model | All model outputs, risk scores, and proposed actions are validated against strict Zod v4 schemas before execution or rendering. |
| **Rule 48** | Never Trust the Tool Either | Tool execution errors are caught, sanitized (masking internal stack traces), and mapped to structured user-friendly alerts. |
| **Rule 49** | Public Resource Isolation | Sales swarm operations restricted strictly to authenticated admin/workspace surfaces; zero leakage to public portal routes. |
| **Rule 50** | Cache Isolation Rules | In-memory swarm caches partitioned by `organizationId`, `workspaceId`, and `swarmRunId`. |
| **Rule 51** | Server Action / Route Handler Security Gate | Every exported Server Action enforces `'use server'`, Clerk session authentication (`requireAuth()`), and tenant IDOR checks. |
| **Rule 52** | Client/Server Boundary Tests | Verifies that server-side database access, API secrets, and AI prompts are never bundled into client bundles. |
| **Rule 53** | Dependency Governance | Zero unvetted dependencies added; all packages locked and security-audited. |
| **Rule 54** | Performance Budgets | 6-stage swarm execution $<15,000\text{ms}$; individual stage $<3,000\text{ms}$. |
| **Rule 55** | DOM Resource Limits | Swarm stage displays bounded to $\le 50$ items to prevent browser DOM lag. |
| **Rule 56** | Agent Context Compression | Knapsack context compressor summarizes long account histories, keeping input tokens strictly $\le 4,000$. |
| **Rule 57** | Data Residency & Retention Awareness | Sales context queries honor tenant data residency tags and redaction policies. |
| **Rule 58** | Model Routing Policy | Quick filtering routes to Flash; deep ICP scoring and outreach personalization route to Pro. |
| **Rule 59** | Tool Selection Evaluation | Swarm specialists restricted strictly to allowed capability domains. |
| **Rule 60** | Emergency Dead-Man Controls | `checkGovernanceDeadManSwitch` evaluated before swarm execution and at each stage, failing closed with HTTP 503 / `SALES_DEAD_MAN_PAUSED`. |
| **Rule 61** | Surface Isolation | Sales backoffice administrative configurations restricted to `isBackofficeSurface()`. |
| **Rule 62** | Real-Time UI Reactivity via SSE | Live swarm progress updates stream via Server-Sent Events (`useEventStream`) without client polling. |
| **Rule 63** | Agent Incident Management | Operators can pause proposals, reject unapproved actions, and trigger manual rollback directly from the UI. |
| **Rule 64** | Zero Raw HTML/CSS Leakage & Feature Flags | Synthesized copy rendered through sanitized components; features gated by `FF_SALES_AGENT_WAVE`. |
| **Rule 65** | Canary Releases | Staged release supporting dark launches and tenant-specific beta access. |
| **Rule 66** | Phased Roadmap Alignment | Fully aligned with Phase 10 roadmap requirements and completes the Second Agent Wave. |
| **Rule 67** | The Agent Implementation Gate | Mandatory 10-dimension pre-flight checklist verified before marking Milestone 5 complete (see Section 7 below). |
| **Rule 68** | The Five Non-Negotiable Invariants | Invariant 11 (Model != security boundary), 12 (Tool output = untrusted data), 13 (Idempotent/authorized/versioned/audited mutations), 14 (Bounded authority & resources), 15 (Operable without code). |
| **Rule 69** | Governed Capability Layer Underneath SmartSapp | Dual-tier data model (`entities` vs `workspace_entities`); zero regressions across existing sales tests, tabs, and routes. |

---

## 7. The Agent Implementation Gate Verification (Rule 67)

In accordance with Rule 67 (`agents_mcp_rules.md` lines 1980–2075), Milestone 5 completes the Sales & Growth Agent Wave by fulfilling all 10 mandatory dimensions:

```text
1. ARCHITECTURE
   □ What canonical capabilities does this use?
     lead.search, lead.enrich, lead.get_intelligence, lead.score, sdr.draft_outreach, sdr.prepare_sequence.
   □ Is this duplicating an existing service?
     No. It orchestrates LeadContextAssembler, ExplainableScoringEngine, and SdrOutboundEngine.
   □ What is the source of truth?
     Firestore (/entities master [immutable], /workspace_entities [operational], /sdr_drafts, /capability_approvals).
   □ What events are emitted?
     sales.swarm.started, sales.swarm.stage_completed, sales.swarm.completed, sales.swarm.approval_required.

2. AUTHORITY
   □ Who is allowed to use it: Authenticated sales managers, SDRs, and platform admins.
   □ What may the agent do: Search, enrich, score, crawl websites, formulate drafts, stage approval proposals.
   □ What may the agent never do: Send live unsolicited outbound emails/messages without human approval.
   □ Can a sub-agent inherit this authority: Yes, strictly monotonically attenuated (P_child = P_parent ∩ P_specialist).

3. DATA
   □ What data enters the agent: Prospect names, company domains, public websites, technographics, ICP criteria.
   □ What data leaves the system: Outbound drafts, WhatsApp links, staged approval proposals.
   □ What is trusted: Verified tenant configuration, system prompt templates, canonical CRM records.
   □ What is untrusted: Scraped website HTML, meta tags, external provider responses (isolated in <untrusted-reference-data>).
   □ What is sensitive: Personal contact emails, phone numbers, executive revenue numbers (redacted in logs).

4. EXECUTION
   □ Is it idempotent: Yes, deterministic idempotency keys for all swarm runs (sales_swarm_${orgId}_${hash}).
   □ Can it be retried: Yes, exponential backoff with jitter up to maxAttempts = 3.
   □ Can it be cancelled: Yes, cooperative cancellation via AbortSignal.
   □ Can it be duplicated: No, deduplication keys prevent concurrent identical runs.
   □ What if underlying record changes: TOCTOU version check aborts with optimistic lock error.
   □ What if response is lost: Checkpoint hash chain allows exact replay from last verified state.

5. MCP
   □ What protocol version: Spec 2026-07-28.
   □ What SDK version: @modelcontextprotocol/server v2.x.
   □ What capabilities: Tools, Prompts, Resources, Tasks.
   □ What annotations: Readonly, destructive, high_risk hints (server-verified, Rule 12).
   □ What server identity: sales-intelligence-mcp-server.
   □ What schema version: Zod v4 canonical contracts.
   □ What if tool definition changes: Pre-execution cryptographic SHA-256 fingerprint verification fails closed.

6. FAILURE
   □ Timeout: 60s max duration ceiling per swarm run; 5,000ms ceiling for web crawlers.
   □ 429: Circuit breaker trips to 'open', backpressure backoff kicks in.
   □ 500: Caught, sanitized, mapped to structured error codes (REVENUE_SWARM_ERROR_CODES).
   □ Partial execution: Uncompleted stages marked failed, partial drafts preserved for operator inspection.
   □ Provider unavailable: Waterfall fallback across secondary providers.
   □ Stale approval: Action proposal expires after 24h; requires re-proposal.
   □ Concurrent modification: Optimistic concurrency version mismatch triggers replan.

7. SECURITY
   □ Prompt injection: Neutralized via regex pattern scanning and <untrusted-reference-data id="..."> isolation.
   □ Tool poisoning: SHA-256 capability fingerprint verification.
   □ Confused deputy: Agent identity immutably bound to caller's tenant context.
   □ SSRF: validateSafeEgressUrl blocks loopback, private subnets, and GCP metadata IPs.
   □ Exfiltration: Outbound domain whitelist enforced by capability registry.
   □ Privilege escalation: Monotonic downward scope attenuation prevents privilege elevation.
   □ Cross-tenant leakage: Strict Anti-IDOR validation on every query and action.

8. OPERATIONS
   □ Can Backoffice disable it: Yes, emergency dead-man pause switch (Rule 60).
   □ Can Backoffice inspect it: Yes, live execution timeline on /admin/intelligence/runs.
   □ Can Backoffice replay it: Yes, deterministic replay from execution traces.
   □ Can Backoffice rollback it: Yes, reverse-LIFO saga compensation button.
   □ Can Backoffice change policy without code: Yes, dynamic persona policy editor (/admin/intelligence/agents).

9. TESTING
   □ Unit: Contract validation, score calculation, URL parameter encoding, SSRF prober.
   □ Integration: Multi-provider waterfall fallback, CRM dual-tier linking, Server Actions.
   □ Security: Adversarial prompt injection in web HTML, IDOR cross-tenant probing, unapproved outbound send bypass.
   □ Evaluation: 24 real-world sales scenarios evaluated on golden benchmark dataset.
   □ Chaos: Provider 500/429 simulation, DNS resolution timeouts, malformed HTML responses.

10. MIGRATION
   □ Existing behavior preserved: 100% of existing Lead Intelligence UI tabs and routes remain intact.
   □ Existing routes preserved: /admin/lead-intelligence continues to operate seamlessly.
   □ Existing data preserved: Dual-tier CRM data model (/entities vs /workspace_entities) preserved without data migration.
   □ Rollback documented: Feature flag FF_SALES_AGENT_WAVE allows instant rollback to classic mode.
```

---

## 8. Bite-Sized Task Breakdown (Tasks 1–6)

### Task 1: Revenue Swarm Contracts, Zod v4 Schemas & Error Taxonomy
**Target Files:**
- Create: `src/platform/agents/sales/swarm/revenue-swarm-types.ts`
- Create: `src/platform/__tests__/sales/revenue-swarm-contracts.test.ts`
- Modify: `src/platform/agents/sales/index.ts` (barrel export)

- [ ] **Step 1: Write the failing contract tests**
  Author `src/platform/__tests__/sales/revenue-swarm-contracts.test.ts` testing:
  - Zod v4 schema validation for `RevenueSwarmCriteriaSchema`: query, targetIndustry, geography, targetLeadCount (1 to 50), minQualificationScore (0 to 100), channels ('whatsapp', 'email'), sdrPersonaId ('lead_sdr'), dryRun.
  - `RevenueSwarmStageResultSchema`: stage name, status, countIn, countOut, durationMs, details, errors.
  - `RevenueSwarmOutcomeSchema`: swarmRunId, missionId, status ('completed', 'waiting_for_approval', 'failed', 'cancelled'), stages array, totalDiscovered, totalEnriched, totalQualified, totalDraftsGenerated, totalProposalsStaged, proposalIds, payloadHash, isDryRun, blastRadius, durationMs.
  - `REVENUE_SWARM_ERROR_CODES` and `RevenueSwarmError` typed class with HTTP status mapping.
  - Zero `any` or `any[]` typing adherence (Rule 4).
- [ ] **Step 2: Run test to verify it fails**
  `pnpm vitest run src/platform/__tests__/sales/revenue-swarm-contracts.test.ts`
- [ ] **Step 3: Implement `revenue-swarm-types.ts`**
  Author schemas, types, error codes, and typed error class using `zod/v4`.
- [ ] **Step 4: Run test to verify it passes**
  `pnpm vitest run src/platform/__tests__/sales/revenue-swarm-contracts.test.ts`
- [ ] **Step 5: Commit**
  `git commit -m "feat(sales-swarm): author canonical revenue swarm contracts and Zod schemas (Phase 10 M5 Task 1)"`

---

### Task 2: Autonomous Revenue Swarm Orchestrator Engine
**Target Files:**
- Create: `src/platform/agents/sales/swarm/revenue-swarm-orchestrator.ts`
- Create: `src/platform/__tests__/sales/revenue-swarm-orchestrator.test.ts`
- Modify: `src/platform/agents/sales/swarm/index.ts` (barrel export)

- [ ] **Step 1: Write the failing orchestrator tests**
  Author `src/platform/__tests__/sales/revenue-swarm-orchestrator.test.ts` testing:
  - Executes the 6-stage autonomous pipeline:
    1. Discovery: searches and deduplicates prospects.
    2. Enrichment: verifies email deliverability and contact roles.
    3. Research: gathers technographics and pain points, containerized in `<untrusted-reference-data>`.
    4. Qualification: scores leads and filters top prospects up to target count.
    5. Personalization: drafts tailored messages via `SdrOutboundEngine.draftOutreach` and `FieldsVariablesService`.
    6. Governance Staging: stages sequence proposals in `ApprovalStore` with canonical SHA-256 `payloadHash`.
  - Concurrency throttling ($\le 4$ parallel operations).
  - Emergency dead-man switch evaluation (`checkGovernanceDeadManSwitch`) halting execution with `SALES_DEAD_MAN_PAUSED` (Rule 60).
  - Shadow mode execution (`dryRun: true`, Rule 42) producing `BlastRadiusReport` with 0 live mutations.
  - Cooperative cancellation via `AbortSignal` (Rule 26).
  - Domain event emissions via `defaultEventBus` (Rule 40).
- [ ] **Step 2: Run test to verify it fails**
  `pnpm vitest run src/platform/__tests__/sales/revenue-swarm-orchestrator.test.ts`
- [ ] **Step 3: Implement `revenue-swarm-orchestrator.ts`**
  Author `RevenueSwarmOrchestrator` coordinating existing platform engines (`LeadContextAssembler`, `SdrOutboundEngine`, `ExplainableScoringEngine`) without code duplication (Rule 69).
- [ ] **Step 4: Run test to verify it passes**
  `pnpm vitest run src/platform/__tests__/sales/revenue-swarm-orchestrator.test.ts`
- [ ] **Step 5: Commit**
  `git commit -m "feat(sales-swarm): implement autonomous revenue swarm orchestrator engine (Phase 10 M5 Task 2)"`

---

### Task 3: Secure Next.js 15 Server Actions for Revenue Swarm
**Target Files:**
- Create: `src/app/actions/revenue-swarm-actions.ts`
- Create: `src/platform/__tests__/sales/revenue-swarm-actions.test.ts`

- [ ] **Step 1: Write the failing server action tests**
  Author `src/platform/__tests__/sales/revenue-swarm-actions.test.ts` testing:
  - Next.js Server Actions convention (`'use server'`) adhering strictly to Rule 51.
  - Clerk session authentication via `requireAuth()` (rejects unauthenticated callers with `AUTHENTICATION_REQUIRED`).
  - Anti-IDOR tenant lock via `assertTenantContext(auth, organizationId)` (rejects mismatched tenants with `IDOR_VIOLATION`).
  - Rule 60 emergency dead-man pause evaluation returning `SALES_DEAD_MAN_PAUSED`.
  - 4 typed server actions:
    * `launchRevenueSwarmAction(params)`
    * `getRevenueSwarmHistoryAction(organizationId, workspaceId)`
    * `cancelRevenueSwarmAction(organizationId, swarmRunId)`
    * `getRevenueSwarmMetricsAction(organizationId, workspaceId)`
- [ ] **Step 2: Run test to verify it fails**
  `pnpm vitest run src/platform/__tests__/sales/revenue-swarm-actions.test.ts`
- [ ] **Step 3: Implement `revenue-swarm-actions.ts`**
  Author the server actions with Clerk authentication, Anti-IDOR validation, dead-man check, and sanitized error mapping.
- [ ] **Step 4: Run test to verify it passes**
  `pnpm vitest run src/platform/__tests__/sales/revenue-swarm-actions.test.ts`
- [ ] **Step 5: Commit**
  `git commit -m "feat(sales-swarm): implement secure Next.js 15 revenue swarm server actions (Phase 10 M5 Task 3)"`

---

### Task 4: Standardized Revenue Swarm Modal & Surface Integration
**Target Files:**
- Create: `src/components/sales/RevenueSwarmModal.tsx`
- Modify: `src/components/sales/ProspectFinderHud.tsx`
- Modify: `src/app/admin/lead-intelligence/components/ProspectFinderTab.tsx`
- Modify: `src/app/admin/lead-intelligence/LeadIntelligenceClient.tsx`
- Modify: `src/components/sales/index.ts` (barrel export)
- Create: `src/platform/__tests__/ui/revenue-swarm-modal.test.tsx`

- [ ] **Step 1: Write the failing UI modal tests**
  Author `src/platform/__tests__/ui/revenue-swarm-modal.test.tsx` testing:
  - Strict compliance with `theme.md` §8 (Standardized Modal Architecture):
    * Surface & geometry: `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`
    * Demarcated header: `<DialogHeader demarcated>`
    * Single-circle info tooltip button with `<CardInfoTooltip text="..." />` elevated at `z-[10050]`
    * Zero raw description clutter; `<DialogDescription className="sr-only">`
    * Demarcated footer: `px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-between gap-2.5 min-h-[56px]` with tactile buttons (`rounded-xl active:scale-[0.97] min-h-[44px]`).
  - Swarm preset chips ("Find 20 qualified leads in edtech and prepare outreach", etc.)
  - 6-Stage visual pipeline timeline with status indicators and step metrics.
  - Blast Radius Report indicator when `dryRun: true` ("0 Live Database Mutations").
  - 1-click action trigger opening `OutreachReviewDrawer` to review and approve staged cadences.
  - HUD integration: "Launch Revenue Swarm" action button in `ProspectFinderHud.tsx`.
- [ ] **Step 2: Run test to verify it fails**
  `pnpm vitest run src/platform/__tests__/ui/revenue-swarm-modal.test.tsx`
- [ ] **Step 3: Implement `RevenueSwarmModal.tsx` and wire surfaces**
  - Implement `RevenueSwarmModal.tsx` conforming to `theme.md` §8.
  - Mount modal and trigger button in `ProspectFinderHud.tsx` and `ProspectFinderTab.tsx`.
  - Pass required tenant context from `LeadIntelligenceClient.tsx`.
- [ ] **Step 4: Run test to verify it passes**
  `pnpm vitest run src/platform/__tests__/ui/revenue-swarm-modal.test.tsx`
- [ ] **Step 5: Commit**
  `git commit -m "feat(sales-ui): add standardized Revenue Swarm Modal and mount in Prospect Finder HUD (Phase 10 M5 Task 4)"`

---

### Task 5: Adversarial Red-Team Security Suite (Rule 46)
**Target Files:**
- Create: `src/platform/__tests__/sales/sales-red-team.test.ts`

- [ ] **Step 1: Author Adversarial Red-Team Security Test Suite**
  Author `src/platform/__tests__/sales/sales-red-team.test.ts` testing 5 critical attack vectors:
  - **Vector 1: Prompt Injection in Scraped Web Pages & Notes (Rules 13 & 30):**
    Adversarial inputs attempting to override SDR personas or inject unauthorized discounts are contained inside `<untrusted-reference-data>` and not executed by template resolvers.
  - **Vector 2: SSRF Network Boundary Defense (Rule 34):**
    `validateSafeEgressUrl` blocks crawler requests to `169.254.169.254` (cloud metadata), `127.0.0.1`, `localhost`, and RFC 1918 private subnets (`10.0.0.0/8`, `192.168.0.0/16`).
  - **Vector 3: Cryptographic Two-Phase Payload Tampering (Rule 22):**
    Mutating staged draft parameters between approval and dispatch produces a SHA-256 `payloadHash` mismatch, rejecting execution with `PAYLOAD_TAMPERED`.
  - **Vector 4: Anti-Self-Approval Enforcement (Rule 13):**
    The user or agent who staged an outbound cadence is prevented from approving their own proposal, failing with `SELF_APPROVAL_FORBIDDEN`.
  - **Vector 5: Emergency Dead-Man Switch Evaluation (Rule 60):**
    Active dead-man pause switch unconditionally halts swarm discovery, drafting, staging, and dispatch with `SALES_DEAD_MAN_PAUSED`.
- [ ] **Step 2: Run test to verify it passes**
  `pnpm vitest run src/platform/__tests__/sales/sales-red-team.test.ts`
- [ ] **Step 3: Commit**
  `git commit -m "test(sales-security): add comprehensive adversarial red-team test suite (Phase 10 M5 Task 5)"`

---

### Task 6: Full Platform QA Verification Battery & Phase 10 Synthesis
**Target Files:**
- `docs/agents_mcp/phases/agents_mcp_phase_10_milestone_5_completion_report.md`
- `docs/agents_mcp/phases/agents_mcp_phase_10_milestone_5_code_review.md`

- [ ] **Step 1: Execute Sales vitest test suites**
  `pnpm vitest run src/platform/__tests__/sales/`
- [ ] **Step 2: Execute UI vitest test suites**
  `pnpm vitest run src/platform/__tests__/ui/`
- [ ] **Step 3: Execute Platform Baseline Regression suite**
  `pnpm vitest run src/platform/__tests__/baseline/`
- [ ] **Step 4: Execute TypeScript static typecheck**
  `NODE_OPTIONS='--max-old-space-size=8192' pnpm typecheck`
- [ ] **Step 5: Execute ESLint static analysis**
  `NODE_OPTIONS='--max-old-space-size=8192' pnpm lint` (verify $\le 670$ warnings, 0 in new code)
- [ ] **Step 6: Document Milestone 5 Completion Report & Commit**
  Author `docs/agents_mcp/phases/agents_mcp_phase_10_milestone_5_completion_report.md` and commit.
- [ ] **Step 7: Conduct Senior Principal Architectural Code Review & Commit**
  Invoke subagent for formal code review, author `docs/agents_mcp/phases/agents_mcp_phase_10_milestone_5_code_review.md`, and commit.

---

## 9. Verification Gates & Completion Protocol

Before declaring Phase 10 Milestone 5 complete and graduating Phase 10, all 6 verification gates must pass:
1. **Compilation Gate:** `NODE_OPTIONS='--max-old-space-size=8192' pnpm typecheck` exits with 0 errors.
2. **Linting Gate:** `NODE_OPTIONS='--max-old-space-size=8192' pnpm lint` exits with 0 errors and zero new warnings ($\le 670$).
3. **Unit & E2E Test Gate:** 100% pass rate on all authored Milestone 5 test suites.
4. **Adversarial Red-Team Gate:** All 5 adversarial attack vectors neutralized and tested.
5. **Regression Gate:** Zero regressions across baseline test suites (Rule 69 Strangler Invariant).
6. **Design System Gate:** Strict conformance with `theme.md` §8 for all modal/drawer components.

---

## 10. Rollback Plan & Safety Invariants

1. **Feature Flag Isolation:** Gated behind `FF_SALES_AGENT_WAVE`. If disabled, UI surfaces revert to standard Prospect Finder without swarm action buttons.
2. **Zero In-Place Destruction:** Master `/entities` identity records are immutable. All mutations target `/workspace_entities`.
3. **Emergency Pause (Rule 60):** Tripping the dead-man switch immediately pauses all autonomous sales reasoning with HTTP 503 / `SALES_DEAD_MAN_PAUSED`.
4. **Saga Reversibility (Rule 27):** Every mutating proposal staged records an explicit compensating capability for instantaneous one-click operator rollback via `ApprovalStore`.
