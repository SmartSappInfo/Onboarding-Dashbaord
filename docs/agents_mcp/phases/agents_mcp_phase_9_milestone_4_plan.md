# SmartSapp Agentic & MCP Transformation: Phase 9 Milestone 4 Implementation Plan
## Next-Best-Action Engine, Account Risk Detector & Two-Phase CRM Proposal Workflows
### Deeply Integrated with `docs/agents_mcp/`, `docs/agentic/`, `theme.md` §8 & The 69 Agentic Development Rules

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Engineer the autonomous Account Risk Detector, Next-Best-Action (NBA) Engine, and Data Hygiene/Enrichment workflows, integrating them seamlessly with the Phase 6/8 Two-Phase Proposal Interceptor (Rule 21 & 22) for all state-changing CRM operations, while strictly preserving the dual-tier data model (targeting `/workspace_entities/{workspaceId}_{entityId}`), adhering to `theme.md` §8, and enforcing all 69 Agentic Development Rules with zero functional compromise.

**Architecture:** Build canonical CRM action, risk assessment, hygiene, and proposal contracts in `src/platform/agents/crm/actions/crm-action-types.ts`. Implement a deterministic + AI-augmented `CrmRiskDetector` that evaluates deal stalls, account dormancy, overdue commitments, aging receivables, and data hygiene defects. Implement a prioritized `CrmNextBestActionEngine` that formulates actionable next steps with Rule 41 explainability grids. Implement a `CrmProposalBridge` that creates cryptographic SHA-256 bound proposals, enforces Anti-IDOR, dead-man pause evaluation, and reverse-LIFO Saga rollback. Expose 5 secure Server Actions in `src/app/actions/crm-proposal-actions.ts` and author a `theme.md` §8 compliant `CrmProposalModal` wired into `AccountRecommendationsCard`.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript (zero `any`/`any[]`), Zod v4, Lucide React, Tailwind CSS, Firestore Admin SDK, Vitest.

---

## 1. Executive Summary & Architectural Vision

In Phase 9 Milestones 1–3, we delivered the multi-domain Context Assembler (`Account360Context`), specialized CRM agent personas (`lead_analyst`, `deal_strategist`, `crm_assistant`, etc.), evaluation benchmarks, shadow mode simulation, and in-context CRM intelligence cards (`AccountAiOverviewCard`, `AccountKnowledgePanel`, `AccountRecommendationsCard`, `DealIntelligenceCard`, `MeetingBriefDrawer`).

Milestone 4 completes the autonomous execution loop of the Universal CRM Agent:
1. **Hybrid Account Risk Detector (`crm-risk-detector.ts`):** Evaluates multi-dimensional signals across the account's 360° context:
   - Stalled Deals: Days in current stage exceeding threshold ($>14$d warning, $>30$d critical) or past expected close date.
   - Dark / Dormant Accounts: Days since last interaction (meeting, note, call, email) exceeding $>45$d ($>60$d critical).
   - Overdue Commitments: Unfulfilled promises or action items past deadline.
   - Aging Receivables: Overdue invoices $>60$d with outstanding balance $>0$.
   - Data Hygiene Defects: Missing decision-maker role, unverified email/phone, stale owner, duplicate entity candidates.
   - Sentiment Degradation: Negative sentiment shift in recent interactions.
2. **Next-Best-Action (NBA) Engine (`crm-next-best-action-engine.ts`):**
   - Synthesizes prioritized, high-impact next-best-actions mapped directly to detected risks and relationship goals.
   - Action types: `DRAFT_OUTREACH`, `SCHEDULE_MEETING`, `CREATE_TASK`, `UPDATE_STAGE`, `ASSIGN_OWNER`, `APPLY_TAGS`, `ENRICH_LEAD`, `RESOLVE_DUPLICATE`, `RESOLVE_HYGIENE`.
   - Injects Rule 41 explainability grid (WHAT, WHY, IMPACT, BLAST RADIUS).
   - Generates deterministic idempotency keys (`crm_action_${entityId}_${hash}`) (Rule 19).
   - Binds compensating capability specifications from `CRM_ROLLBACK_MATRIX` (Rule 27).
3. **Two-Phase CRM Proposal Bridge (`crm-proposal-bridge.ts`):**
   - Implements the Two-Phase Action Model (Rule 21) for all mutating operations (`L2`, `L3`, `L4`).
   - Computes canonical key-sorted SHA-256 `payloadHash` (Rule 22) preventing parameter tampering.
   - Enforces Anti-IDOR validation (`organizationId`, `workspaceId`) (Rule 8 & 47).
   - Evaluates Rule 60 emergency dead-man pause (`checkGovernanceDeadManSwitch`), blocking proposal execution with `DEAD_MAN_PAUSED` (HTTP 503).
   - Enforces Rule 13 anti-self-approval and Rule 18 live TOCTOU authority/version verification.
   - Preserves Dual-Tier CRM Data Model (Rule 69):
     * Mutations strictly target `/workspace_entities/{workspaceId}_{entityId}`, never mutating the corporate master `/entities/{entityId}`.
     * Tag applications route strictly through canonical Tag infrastructure.
     * Stage transitions update deal records with audit logging.
     * Tasks create records in `/tasks`.
   - Publishes domain events: `crm.action.proposed`, `crm.action.executed`, `crm.action.reverted`, `crm.action.rejected` (Rule 40).
   - Supports 1-click reverse-LIFO Saga rollback via `rollbackCrmActionAction` (Rule 27 & 63).
4. **Operator Experience (`CrmProposalModal.tsx`):**
   - Strictly conforms to `theme.md` §8 (demarcated header/footer, single-circle info tooltip at `z-[10050]`, zero raw descriptions, $\ge 44\text{px}$ touch targets).
   - Features Explainability Grid, SHA-256 payload hash badge with copy, Mutation Delta / Diff Viewer, Dual-Tier Target Confirmation (`/workspace_entities`), and Reversible Saga indicator.
   - Embedded directly into `AccountRecommendationsCard.tsx` with zero dead ends.

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                     AUTONOMOUS RISK, NBA & TWO-PHASE CRM PROPOSALS                      │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                 OPERATOR SURFACES                                      │
│  Entity View: /admin/entities/[id]              Deal View: /admin/deals/[id]           │
│  ├── AccountRecommendationsCard                 └── DealIntelligenceCard               │
│  │   └── [Action Trigger] ────────┐                                                    │
│  │                                 ▼                                                   │
│  │                   CrmProposalModal (theme.md §8)                                    │
│  │                   ├── Explainability Grid (Rule 41: WHAT, WHY, IMPACT)              │
│  │                   ├── Cryptographic SHA-256 Hash Badge (Rule 22)                    │
│  │                   ├── Mutation Delta Viewer (Before vs After)                       │
│  │                   ├── Dual-Tier Target: /workspace_entities/{wId}_{eId} (Rule 69)   │
│  │                   └── [Confirm Proposal] ──► Governance Desk / Instant Execute      │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                         SECURE NEXT.JS 15 SERVER ACTIONS                               │
│                       (src/app/actions/crm-proposal-actions.ts)                        │
│  ├── evaluateAccountRisksAction        ├── proposeCrmActionAction                      │
│  ├── generateNextBestActionsAction     ├── executeApprovedCrmProposalAction            │
│  │                                     └── rollbackCrmActionAction (Saga Rollback)     │
│  ├── requireAuth() [Clerk Session Authentication]                                      │
│  ├── assertTenantContext() [Anti-IDOR Multi-Tenant Lock] (Rule 8 & 47)                 │
│  └── checkGovernanceDeadManSwitch() [Emergency Pause Evaluation] (Rule 60)             │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                    CORE CRM ACTION, RISK & PROPOSAL SUBSYSTEMS                         │
│                    (src/platform/agents/crm/actions/)                                  │
│  ├── CrmRiskDetector (Deterministic + AI: Stalls, Dormancy, Overdue, Aging, Hygiene)   │
│  ├── CrmNextBestActionEngine (Prioritized NBA synthesis, Explainability, Idempotency)   │
│  └── CrmProposalBridge (Two-Phase Interception, SHA-256 Binding, Saga Compensations)   │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                         FOUNDATIONAL CONTEXT & PERSISTENCE                             │
│  ├── Account360Context [Multi-Domain Context Assembler - Milestone 1]                  │
│  ├── Master Identity: /entities/{entityId} [Immutable Corporate Master] (Rule 69)      │
│  ├── Operational State: /workspace_entities/{workspaceId}_{entityId} (Rule 69)         │
│  ├── Approval Store: /organizations/{orgId}/action_proposals/{proposalId}              │
│  └── Tamper-Evident Audit Log: EventBus [crm.action.*, crm.account.risk_detected]      │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Invariant Architecture: Dual-Tier CRM Data Model Preservation (Rule 69)

In accordance with `docs/agents_mcp/agents_mcp_rules.md` (Rule 69) and `docs/agents_mcp/agents_mcp_tools.md`:
1. **Global Master Identity (`entities`):** `/entities/{entityId}` stores immutable, organization-wide corporate identity (legal name, registration, headquarters address, base website, verified industry). The NBA and Risk engines read global identity, but **never** mutate it directly.
2. **Workspace Operational Record (`workspace_entities`):** `/workspace_entities/{workspaceId}_{entityId}` stores workspace-scoped CRM execution state (pipeline, stage, assigned owner, workspace tags, lead score, local activity log).
3. **Execution Invariant:** All mutating actions executed by `CrmProposalBridge` (updating contact roles, tags, pipeline stage, or operational metadata) target `/workspace_entities/${workspaceId}_${entityId}`.
4. **Tag Infrastructure Invariant:** Tag applications or removals route exclusively through canonical `<TagSelector>` patterns and `FieldsVariablesService` standards.
5. **Strangler Fig Invariant:** Pre-existing tabs, deal workflows, and pipeline boards continue functioning without behavioral modification. 100% pass on all baseline regression suites.

---

## 3. Master 69-Rules Alignment & Enforcement Matrix for Milestone 4

| Rule # | Requirement | Milestone 4 Architectural Implementation & Verification |
| :---: | :--- | :--- |
| **Rule 1** | Skill Conformance & Standards | Conforms strictly to Next.js 15 App Router, React 19, Tailwind CSS, TypeScript strict mode, and modular decomposition. All legacy features preserved. |
| **Rule 2** | Failure Mode Planning & Cleanliness | Graceful fallback when AI synthesis fails, network drops, or records are missing. Risk assessment and NBA synthesis degrade gracefully to deterministic heuristic rules. |
| **Rule 3** | Backoffice Enhancement & Non-Breaking | Embeds directly into `/admin/entities/[id]` and connects with `/admin/intelligence/approvals` without breaking any existing tab, widget, or action. |
| **Rule 4** | Zero `any` / Zero `any[]` Typing Policy | 100% strictly typed props, state, actions, and schema returns. `unknown` permitted only at raw boundaries, validated immediately with Zod v4. |
| **Rule 5** | Staged Deployment & Security Verification | All contracts, risk detectors, NBA engines, server actions, and UI modals verified with isolated tests before production integration. |
| **Rule 6** | Dependencies & Context7 Documentation | Uses verified stable versions of `zod/v4`, `lucide-react`, and `node:crypto`. Next.js 15 App Router patterns verified via Context7. |
| **Rule 7** | Mobile-First & Plain UI English | All touch targets $\ge 44\text{px}$ (`min-h-[44px]`), Emil Kowalski tactile clicks (`active:scale-[0.97]`), and plain human language for risk alerts and action explanations. |
| **Rule 8** | High Security, Data Protection & Anti-IDOR | Every server action enforces caller session `organizationId` matching requested `workspaceId`/`entityId` boundaries. IDOR attempts fail closed with HTTP 403. |
| **Rule 9** | High Load & Resource Exhaustion Defense | Context retrieval queries bounded to 50 items; payload sizes $< 2\text{KB}$; execution timeouts capped at 5,000ms. |
| **Rule 10** | Inline Architectural Documentation | Every authored file includes comprehensive `@fileOverview` documentation detailing architecture, security invariants, Rule mappings, and testability pointers. |
| **Rule 11** | MCP Protocol Compliance | Action definitions bind to canonical MCP tool outputs; Spec 2026-07-28 Streamable HTTP compatible. |
| **Rule 12** | Risk Ceilings & Weighted Rank | Actions classified by canonical 5-tier risk levels: `L0_READ` (diagnostics), `L1_INTERNAL_DRAFT` (drafts), `L2_STATE_MUTATION` (stage/tags/tasks), `L3_EXTERNAL_COMMUNICATION_FINANCE` (email send, invoice trigger), `L4_PRIVILEGED_DESTRUCTIVE` (merge records). |
| **Rule 13** | Formal Trust Boundary Matrix & Anti-Self-Approval | Customer notes, meeting transcripts, emails, and citations wrapped in `<untrusted_reference_data id="...">` containers. Requesters cannot approve their own high-risk proposals (`SELF_APPROVAL_FORBIDDEN`). |
| **Rule 14** | Tool Poisoning / Rug-Pull Defense | Action triggers verify cryptographic composite SHA-256 fingerprints before executing bound capabilities. |
| **Rule 15** | Server Allowlisting & Supply-Chain Security | External enrichment links and citation URLs validated against allowlists with SSRF prevention. |
| **Rule 16** | Agent Identity as Security Principal | Actions execute under authenticated caller identity with explicit RBAC scopes (`operations:campuses:edit`, `crm:entities:write`); no wildcard (`*`) permissions. |
| **Rule 17** | Non-Delegable Actions | Entity deletion, workspace destruction, and billing modifications stripped from autonomous execution affordances. |
| **Rule 18** | TOCTOU Live Principal / Record Check | Record versions verified before applying recommendation stage updates or owner assignments. If version is stale, aborts with `VERSION_MISMATCH`. |
| **Rule 19** | Mandatory Idempotency for Mutating Tools | Mutating recommendation triggers generate deterministic idempotency keys (`crm_action_${entityId}_${hash}`). |
| **Rule 20** | Replay & Distributed Tracing | Injects `correlationId` and `toolInvocationId` into domain event metadata and Server Action responses. |
| **Rule 21** | Two-Phase Action Model | State-changing recommendations create action proposals requiring operator review before execution (PLAN -> PREVIEW -> APPROVE -> EXECUTE). |
| **Rule 22** | Cryptographic Approval Binding | Mutating proposals bound to canonical key-sorted SHA-256 `payloadHash`. When executing, rejects with `PAYLOAD_TAMPERED` if mismatched. |
| **Rule 23** | Resource Governance & Budgets | Context assembler enforces 4,000-token ceiling; synthesis duration bounded to 5,000ms. |
| **Rule 24** | 5-State Circuit Breakers | Tiered Model Router fallback protected by 5-state circuit breakers (`healthy`, `degraded`, `open`, `half_open`, `recovered`). |
| **Rule 25** | Dead-Letter & Recovery Queues | Failed proposal executions report structured diagnostics and log to EventBus audit log. |
| **Rule 26** | True Cooperative Cancellation | Actions and fetch requests support native `AbortSignal` cooperative cancellation. |
| **Rule 27** | Formal Saga / Compensation Model | Mutating recommendations bind compensating capabilities for 1-click rollback via `CRM_ROLLBACK_MATRIX`. |
| **Rule 28** | Context Budgeting | Greedy knapsack packing bounds account context strictly $\le 4,000$ tokens. |
| **Rule 29** | Memory Governance | Temporal decay weighting prioritizes fresh meetings, recent notes, and open deals. |
| **Rule 30** | Knowledge Poisoning Defense | Prompts and UI renderers distrust instructions inside `<untrusted_reference_data>` XML containers. |
| **Rule 31** | Output Validation Between Agent & Tool | Zod schema validation on all action and proposal outputs via `safeParse`. |
| **Rule 32** | Cross-Domain Exfiltration Detection | Synthesis queries restricted strictly to CRM domain scopes (`crm_contacts`, `deals_revenue`, `knowledge_memory`). |
| **Rule 33** | Egress Control & Redaction | Redacts sensitive credentials, API keys, and PII from UI summaries (`[REDACTED_SECRET:<type>]`). |
| **Rule 34** | SSRF & Network Boundary Controls | Outbound company URLs and citations validated via `validateSafeEgressUrl` blocking loopback, GCP metadata, and private subnets. |
| **Rule 35** | MCP Discovery Caching | Deterministic ETag HTTP 304 caching for action schemas. |
| **Rule 36** | Capability Version Compatibility | Declares exact SemVer contracts for action outputs. |
| **Rule 37** | MCP Spec Compatibility Testing | Conforms to Spec 2026-07-28 test suites. |
| **Rule 38** | No Features on Deprecated MCP Primitives | Uses Streamable HTTP; no stateful session leaks. |
| **Rule 39** | OpenTelemetry From Day One | Propagates W3C `traceparent` headers across server actions and domain events. |
| **Rule 40** | Audit Log Immutability | Publishes `crm.account.risk_detected`, `crm.action.proposed`, `crm.action.executed`, `crm.action.reverted` to EventBus. |
| **Rule 41** | "Why Did You Do This?" Audit View | Every recommendation card features WHAT, WHY, and IMPACT explainability dimensions. |
| **Rule 42** | Mandatory Shadow Mode | All recommendation triggers can be previewed/simulated with `dryRun: true` and Blast Radius Reports. |
| **Rule 43** | Replayable Agent Runs | Action generation inputs and outputs capture full snapshots allowing deterministic replay. |
| **Rule 44** | Deterministic Evaluation Dataset | Validated against the 24 gold-standard evaluation scenarios from Milestone 2. |
| **Rule 45** | Chaos Testing | Handles missing notes, empty deals, zero meetings, or corrupt timestamps gracefully with fallback UI. |
| **Rule 46** | Adversarial UI Testing | Red-team test suite against prompt injection via notes, cross-tenant IDOR probing, and unapproved mutation bypass. |
| **Rule 47** | Never Trust the Model | All model outputs, risk scores, and proposed actions are validated against strict Zod v4 schemas before execution or rendering. |
| **Rule 48** | Never Trust the Tool Either | Tool execution errors are caught, sanitized (masking internal stack traces), and mapped to structured user-friendly alerts. |
| **Rule 49** | Public Resource Isolation | CRM agent operations restricted strictly to authenticated admin/workspace surfaces; zero leakage to public portal routes. |
| **Rule 50** | Cache Isolation Rules | In-memory risk and recommendation caches partitioned by `organizationId`, `workspaceId`, and `entityId`. |
| **Rule 51** | Server Action / Route Handler Security Gate | Every exported Server Action enforces `'use server'`, Clerk session authentication (`requireAuth()`), and tenant IDOR checks. |
| **Rule 52** | Client/Server Boundary Tests | Verifies that server-side database access, API secrets, and AI prompts are never bundled into client bundles. |
| **Rule 53** | Dependency Governance | Zero unvetted dependencies added; all packages locked and security-audited. |
| **Rule 54** | Performance Budgets | Risk detection $<300\text{ms}$; NBA synthesis $<800\text{ms}$; proposal creation $<400\text{ms}$. |
| **Rule 55** | Graph & Canvas Resource Limits | Related entity displays bounded to $\le 30$ connected nodes to prevent browser DOM lag. |
| **Rule 56** | Agent Context Compression | Knapsack context compressor summarizes long account histories, keeping input tokens strictly $\le 4,000$. |
| **Rule 57** | Data Residency & Retention Awareness | CRM context queries honor tenant data residency tags and redaction policies. |
| **Rule 58** | Model Routing Policy | Quick risk heuristics route to Flash; deep proposal formulation and draft synthesis route to Pro. |
| **Rule 59** | Tool Selection Evaluation | CRM agents restricted strictly to allowed capability domains (`crm_contacts`, `deals_revenue`, `knowledge_memory`, `tasks_productivity`). |
| **Rule 60** | Emergency Dead-Man Controls | `checkGovernanceDeadManSwitch` evaluated before proposal creation and execution, failing closed with HTTP 503 / `CRM_DEAD_MAN_PAUSED`. |
| **Rule 61** | Surface Isolation | CRM backoffice administrative configurations restricted to `isBackofficeSurface()`. |
| **Rule 62** | Real-Time UI Reactivity via SSE | Live proposal status updates stream via Server-Sent Events (`useEventStream`) without client polling. |
| **Rule 63** | Agent Incident Management | Operators can pause proposals, reject unapproved actions, and trigger manual rollback directly from the UI. |
| **Rule 64** | Zero Raw HTML/CSS Leakage & Feature Flags | Synthesized outreach and notes rendered through sanitized markdown components; features gated by `FF_CRM_AGENT_WAVE`. |
| **Rule 65** | Canary Releases | Staged release supporting dark launches and tenant-specific beta access. |
| **Rule 66** | Phased Roadmap Alignment | Fully aligned with Phase 9 roadmap requirements and forward-compatible with Phase 10 (Sales & Growth Agent System). |
| **Rule 67** | The Agent Implementation Gate | Mandatory 9-point pre-flight checklist verified before marking Milestone 4 complete (see Section 4 below). |
| **Rule 68** | The Five Non-Negotiable Invariants | 1. Identity is not the user. 2. Never trust the model. 3. Never trust untrusted data. 4. High-risk actions require two phases. 5. No dead ends in user experience. |
| **Rule 69** | Strangler Fig Pattern SSOT | Preserves dual-tier data model (`entities` vs `workspace_entities`); zero regressions across existing CRM tests, tabs, and routes. |

---

## 4. The Agent Implementation Gate Verification (Rule 67)

In accordance with Rule 67 (`agents_mcp_rules.md` lines 1980–2050), Milestone 4 answers every dimension of the gate:

```text
1. ARCHITECTURE
   □ Canonical capabilities used: crm.workspace_entity.update, crm.deal.update_stage,
     crm.task.create, crm.tag.apply, crm.tag.remove, crm.lead.enrich, crm.entity.resolve_duplicate.
   □ No duplication of existing services: wraps existing crm-core, deal-core, and approval interceptor.
   □ Source of truth: Firestore (/workspace_entities, /deals, /tasks, /action_proposals).
   □ Events emitted: crm.account.risk_detected, crm.action.proposed, crm.action.executed, crm.action.reverted.

2. AUTHORITY
   □ Who is allowed to use it: Authenticated workspace members with 'operations:campuses:edit' or 'crm:entities:write'.
   □ What may the agent do: Autonomous L0 risk evaluation, L1 outreach drafting, and proposal formulation.
   □ What may the agent never do: Autonomous external email dispatch without approval, entity deletion, or billing clearing.
   □ Sub-agent delegation: Scope attenuates downward (P_child = P_parent ∩ P_specialist); non-delegables stripped.

3. DATA
   □ Data entering agent: 360° Account Context (deals, meetings, notes, billing balance, tasks).
   □ Data leaving system: Zero external data exfiltration. Proposals execute within tenant boundaries.
   □ Trusted data: Verified Firestore records, system timestamps, schema-validated metadata.
   □ Untrusted data: Customer emails, meeting transcripts, user notes (wrapped in XML isolation tags).
   □ Sensitive data: Credit cards, bank details, API keys (masked with [REDACTED_SECRET:<type>]).

4. EXECUTION
   □ Idempotency: All mutating proposals use deterministic idempotency keys (crm_action_${entityId}_${hash}).
   □ Retries: Read queries retry with exponential jitter; mutating actions fail closed.
   □ Cancellation: Cooperative cancellation via native AbortSignal on all promises.
   □ Record modification: TOCTOU concurrency check validates record version before committing updates.

5. MCP
   □ Protocol: Streamable HTTP Protocol Spec 2026-07-28.
   □ SDK: @modelcontextprotocol/server 2.1.0 with Genkit in-process adapter.
   □ Capabilities: Domain-partitioned CRM capabilities with cryptographic SHA-256 fingerprints.

6. FAILURE
   □ Timeout: 5,000ms context retrieval ceiling; 10,000ms overall execution budget.
   □ 429/500: Circuit breaker trips after 3 consecutive failures, falling back to Flash or cached state.
   □ Stale approval: Proposals expire after 72 hours; live TOCTOU validation catches intermediate modifications.

7. SECURITY
   □ Prompt injection: Pre-retrieval regex scanning and <untrusted_reference_data id="..."> isolation container.
   □ Tool poisoning: Runtime cryptographic SHA-256 fingerprint verification fails closed on schema drift.
   □ Tenant isolation: Strict anti-IDOR checks immutable to authenticated session organizationId.

8. OPERATIONS
   □ Backoffice disable: Dead-man pause switch immediately stops all reasoning without redeploying code.
   □ Backoffice inspection: Live proposal inspection drawer on /admin/intelligence/approvals.
   □ Backoffice rollback: One-click reverse-LIFO Saga compensation for any executed proposal.

9. TESTING
   □ Unit tests: Hermetic test suites for risk detector, NBA engine, proposal bridge, and server actions.
   □ Integration tests: End-to-end proposal creation, SHA-256 validation, execution, and rollback.
   □ Adversarial tests: Prompt injection in notes, cross-tenant IDOR probing, and unapproved mutation bypass.
```

---

## 5. Domain Agents Mandatory Deliverables (Rules 1940–1953)

Per `agents_mcp_rules.md` lines 1940–1953, Milestone 4 incorporates the mandatory deliverables:

```text
1. SHADOW MODE
   - executeCrmActionShadowMode with dryRun: true.
   - Evaluates risks and generates proposals with zero Firestore writes, producing Blast Radius Reports.

2. EVALUATION DATASET
   - Scenario coverage across Stalled Deals, Dark Accounts, Overdue Commitments, Aging Receivables, and Hygiene Defects.

3. PERMISSION MATRIX
   - Strict RBAC mapping: only authorized operators can confirm and execute mutating proposals.

4. TOOL MATRIX
   - Explicit allowed capability inventory and risk level ceilings per persona.

5. FAILURE MATRIX
   - Deterministic handling for missing entities, empty timelines, stale records, model timeouts, contradictory facts.

6. SECURITY TESTS
   - Adversarial red-team suite validating prompt injection defense, cross-tenant isolation, and unapproved mutation rejection.

7. ROLLBACK PLAN
   - Reverse-LIFO Saga compensation binding for every state-changing CRM action proposal via CRM_ROLLBACK_MATRIX.
```

---

## 6. Granular Task Breakdown

### Task 1: Canonical CRM Action, Risk, Hygiene & Proposal Contracts
**Target Files:**
- `src/platform/agents/crm/actions/crm-action-types.ts`
- `src/platform/agents/crm/actions/index.ts`
- `src/platform/__tests__/agents/crm/crm-action-contracts.test.ts`

- [x] **Step 1: Write the failing contract tests**
  Author `src/platform/__tests__/agents/crm/crm-action-contracts.test.ts` validating:
  - `CrmRiskAssessmentSchema` validates multi-factor risk scores, risk levels (`LOW`, `MODERATE`, `ELEVATED`, `CRITICAL`), and individual risk factors.
  - `CrmProposedActionSchema` validates action types, priority enums, 5-tier risk levels (`L0` to `L4`), explainability grids (`what`, `why`, `impact`, `blastRadius`), idempotency keys (`crm_action_${entityId}_${hash}`), and execution payloads.
  - `CRM_ROLLBACK_MATRIX` maps every mutating action type to an explicit compensating capability.
  - `CrmHygieneDefectSchema` validates contact role gaps, unverified emails, invalid phone formats, and duplicate candidate pairs.
  - `CrmLeadEnrichmentRequestSchema` and `CrmLeadEnrichmentResultSchema` validate firmographic/technographic outputs.
  - `CRM_ACTION_ERROR_CODES` covers all canonical error strings.
- [x] **Step 2: Run test to verify it fails**
  `pnpm vitest run src/platform/__tests__/agents/crm/crm-action-contracts.test.ts`
- [x] **Step 3: Implement `crm-action-types.ts` and barrel `index.ts`**
  Author strict Zod v4 schemas, type exports, error taxonomy, and `CrmActionError` class. Re-export via barrel `index.ts`. Ensure zero `any` or `any[]` (Rule 4).
- [x] **Step 4: Run test to verify it passes**
  `pnpm vitest run src/platform/__tests__/agents/crm/crm-action-contracts.test.ts`
- [x] **Step 5: Commit**
  `git commit -m "feat(crm-agent): add canonical CRM action, risk, and hygiene contracts"`

---

### Task 2: Hybrid Account Risk Detector
**Target Files:**
- `src/platform/agents/crm/actions/crm-risk-detector.ts`
- `src/platform/__tests__/agents/crm/crm-risk-detector.test.ts`

- [x] **Step 1: Write the failing risk detector tests**
  Author `src/platform/__tests__/agents/crm/crm-risk-detector.test.ts` testing:
  - Stalled Deals: Flags deals exceeding 14d warning / 30d critical stage thresholds or past close dates.
  - Dark / Dormant Accounts: Flags accounts with $> 45$d ($> 60$d critical) since last touchpoint.
  - Overdue Commitments: Filters uncompleted promises where `dueDate < now()`.
  - Aging Receivables: Flags accounts with invoices $> 60$d overdue with balance $> 0$.
  - Data Hygiene Defects: Detects absence of primary decision-maker, unverified contact data, and duplicate candidates.
  - Sentiment Degradation: Computes trend from recent meetings and notes.
  - Multi-factor weighted composite score formula (0–100) and risk level assignment (`LOW`, `MODERATE`, `ELEVATED`, `CRITICAL`).
  - Publishes `crm.account.risk_detected` domain event via `defaultEventBus` (Rule 40) when `dryRun: false`.
  - Shadow Mode dry-run support (`dryRun: true`) producing a Blast Radius Report without database writes (Rule 42).
- [x] **Step 2: Run test to verify it fails**
  `pnpm vitest run src/platform/__tests__/agents/crm/crm-risk-detector.test.ts`
- [x] **Step 3: Implement `crm-risk-detector.ts`**
  Author `CrmRiskDetector` class with pure evaluation algorithms and singleton `getCrmRiskDetector()`.
- [x] **Step 4: Run test to verify it passes**
  `pnpm vitest run src/platform/__tests__/agents/crm/crm-risk-detector.test.ts`
- [x] **Step 5: Commit**
  `git commit -m "feat(crm-agent): implement hybrid account risk detector"`

---

### Task 3: Autonomous Next-Best-Action (NBA) Engine
**Target Files:**
- `src/platform/agents/crm/actions/crm-next-best-action-engine.ts`
- `src/platform/__tests__/agents/crm/crm-next-best-action.test.ts`

- [x] **Step 1: Write the failing NBA engine tests**
  Author `src/platform/__tests__/agents/crm/crm-next-best-action.test.ts` testing:
  - Synthesizes prioritized, high-impact actions from detected risks and relationship goals.
  - Generates deal re-acceleration strategy for stalled deals (`UPDATE_STAGE`, `SCHEDULE_MEETING`).
  - Generates personalized re-engagement outreach for dormant accounts (`DRAFT_OUTREACH`).
  - Generates urgent remediation tasks for overdue commitments (`CREATE_TASK`).
  - Proposes polite finance check-in for aging receivables (`DRAFT_OUTREACH`).
  - Recommends technographic/firmographic enrichment for sparse accounts (`ENRICH_LEAD`).
  - Recommends identity resolution or contact verification for hygiene defects (`RESOLVE_HYGIENE`, `RESOLVE_DUPLICATE`).
  - Injects Rule 41 explainability grids (WHAT, WHY, IMPACT, BLAST RADIUS).
  - Computes deterministic idempotency keys (`crm_action_${entityId}_${hash}`) (Rule 19).
  - Binds compensating capability specifications from `CRM_ROLLBACK_MATRIX` (Rule 27).
- [x] **Step 2: Run test to verify it fails**
  `pnpm vitest run src/platform/__tests__/agents/crm/crm-next-best-action.test.ts`
- [x] **Step 3: Implement `crm-next-best-action-engine.ts`**
  Author `CrmNextBestActionEngine` with ranking heuristics, prompt generation, and singleton `getCrmNextBestActionEngine()`.
- [x] **Step 4: Run test to verify it passes**
  `pnpm vitest run src/platform/__tests__/agents/crm/crm-next-best-action.test.ts`
- [x] **Step 5: Commit**
  `git commit -m "feat(crm-agent): implement autonomous next-best-action engine"`

---

### Task 4: Two-Phase CRM Proposal Bridge
**Target Files:**
- `src/platform/agents/crm/actions/crm-proposal-bridge.ts`
- `src/platform/__tests__/agents/crm/crm-proposal-bridge.test.ts`

- [x] **Step 1: Write the failing proposal bridge tests**
  Author `src/platform/__tests__/agents/crm/crm-proposal-bridge.test.ts` testing:
  - `proposeAction`: creates an `ActionProposal` in `ApprovalStore` with canonical key-sorted SHA-256 `payloadHash` (Rule 22) and status `'pending'`.
  - Enforces Anti-IDOR validation (`organizationId`, `workspaceId`) (Rule 8 & 47).
  - Enforces Rule 60 emergency dead-man pause check, rejecting with `DEAD_MAN_PAUSED`.
  - `executeApprovedProposal`: verifies `payloadHash` against actual payload; throws `PAYLOAD_TAMPERED` if mismatched.
  - Enforces Rule 13 anti-self-approval and Rule 18 live TOCTOU record version check.
  - **Dual-Tier CRM Data Model Preservation (Rule 69):**
    * Target mutations strictly apply to `/workspace_entities/{workspaceId}_{entityId}`.
    * Deal stage updates target `/deals/{dealId}`.
    * Tasks create records in `/tasks`.
    * Tag operations route strictly through canonical Tag infrastructure.
    * Never mutates corporate master `/entities/{entityId}`.
  - Publishes domain events: `crm.action.proposed`, `crm.action.executed`, `crm.action.reverted`, `crm.action.rejected` (Rule 40).
  - `rollbackAction`: executes reverse-LIFO Saga compensation and publishes `crm.action.reverted` (Rule 27 & 63).
- [x] **Step 2: Run test to verify it fails**
  `pnpm vitest run src/platform/__tests__/agents/crm/crm-proposal-bridge.test.ts`
- [x] **Step 3: Implement `crm-proposal-bridge.ts`**
  Author `CrmProposalBridge` class and singleton `getCrmProposalBridge()`.
- [x] **Step 4: Run test to verify it passes**
  `pnpm vitest run src/platform/__tests__/agents/crm/crm-proposal-bridge.test.ts`
- [x] **Step 5: Commit**
  `git commit -m "feat(crm-agent): implement two-phase CRM proposal bridge with SHA-256 binding"`

---

### Task 5: Secure Next.js 15 Server Actions
**Target Files:**
- `src/app/actions/crm-proposal-actions.ts`
- `src/platform/__tests__/ui/crm-proposal-actions.test.ts`

- [x] **Step 1: Write the failing server action tests**
  Author `src/platform/__tests__/ui/crm-proposal-actions.test.ts` testing:
  - Next.js Server Actions convention (`'use server'`).
  - Clerk session authentication via `requireAuth()` (rejects unauthenticated callers with `AUTHENTICATION_REQUIRED`).
  - Anti-IDOR validation: verifies caller's session `organizationId` matches requested tenant boundary, returning `IDOR_VIOLATION` on mismatch (Rule 8 & 47).
  - Emergency dead-man pause check: returns `CRM_DEAD_MAN_PAUSED` when dead-man switch is active (Rule 60).
  - 5 typed server actions:
    * `evaluateAccountRisksAction({ workspaceId, entityId })`
    * `generateNextBestActionsAction({ workspaceId, entityId })`
    * `proposeCrmActionAction({ workspaceId, entityId, actionData })`
    * `executeApprovedCrmProposalAction({ organizationId, proposalId, executionPayload })`
    * `rollbackCrmActionAction({ organizationId, proposalId, reason })`
- [x] **Step 2: Run test to verify it fails**
  `pnpm vitest run src/platform/__tests__/ui/crm-proposal-actions.test.ts`
- [x] **Step 3: Implement `crm-proposal-actions.ts`**
  Author the 5 server actions adhering strictly to Rule 51, Anti-IDOR, dead-man check, and sanitized error mapping.
- [x] **Step 4: Run test to verify it passes**
  `pnpm vitest run src/platform/__tests__/ui/crm-proposal-actions.test.ts`
- [x] **Step 5: Commit**
  `git commit -m "feat(crm-agent): implement secure CRM proposal server actions"`

---

### Task 6: Standardized Proposal Modal & Recommendations Surface Integration
**Target Files:**
- `src/components/crm/actions/CrmProposalModal.tsx`
- `src/components/crm/actions/index.ts`
- `src/components/crm/intelligence/AccountRecommendationsCard.tsx`
- `src/platform/__tests__/ui/crm-proposal-modal.test.tsx`

- [x] **Step 1: Write the failing UI modal tests**
  Author `src/platform/__tests__/ui/crm-proposal-modal.test.tsx` testing:
  - `CrmProposalModal` strictly adheres to `theme.md` §8:
    * Surface: `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`.
    * Demarcated header: `<DialogHeader demarcated min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20 px-6 py-3.5 sm:py-4>`.
    * Single-circle info tooltip button with `<CardInfoTooltip text="..." />` elevated at `z-[10050]`.
    * Zero raw description clutter; `<DialogDescription className="sr-only">`.
    * Demarcated footer: `px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5` with tactile buttons (`rounded-xl active:scale-[0.97] min-h-[44px]`).
  - Explainability Grid (WHAT, WHY, IMPACT, BLAST RADIUS, RISK LEVEL) (Rule 41).
  - Truncated SHA-256 payload hash badge with copy feedback (Rule 22).
  - Mutation Delta / Diff Viewer (Before vs After state preview).
  - Dual-Tier Target Confirmation (`/workspace_entities/{workspaceId}_{entityId}`).
  - Reversible Saga indicator showing compensating capability.
  - Actionable toast navigation with relative paths (`actionConfig: { path: '/admin/intelligence/approvals', label: 'Review Approvals' }`).
- [x] **Step 2: Run test to verify it fails**
  `pnpm vitest run src/platform/__tests__/ui/crm-proposal-modal.test.tsx`
- [x] **Step 3: Implement `CrmProposalModal.tsx` and wire up `AccountRecommendationsCard.tsx`**
  - Implement `CrmProposalModal.tsx` adhering strictly to `theme.md` §8.
  - In `AccountRecommendationsCard.tsx`, wire `onActionClick` callback to open `CrmProposalModal` with pre-filled proposal payload, explainability details, and confirmation controls.
  - Provide one-click execution trigger for low-risk actions or submission to `/admin/intelligence/approvals` for high-risk actions.
  - Verify zero regressions on legacy CRM tabs and deal views.
- [x] **Step 4: Run test to verify it passes**
  `pnpm vitest run src/platform/__tests__/ui/crm-proposal-modal.test.tsx`
- [x] **Step 5: Full verification gates**
  Run:
  ```bash
  # 1. CRM Platform test suites
  pnpm vitest run src/platform/__tests__/agents/crm/

  # 2. UI test suites
  pnpm vitest run src/platform/__tests__/ui/

  # 3. Platform baseline regression suites
  pnpm vitest run src/platform/__tests__/baseline/

  # 4. TypeScript static typecheck
  NODE_OPTIONS='--max-old-space-size=8192' pnpm typecheck

  # 5. ESLint static analysis
  NODE_OPTIONS='--max-old-space-size=8192' pnpm lint
  ```
- [x] **Step 6: Commit**
  `git commit -m "feat(crm-ui): add standardized CRM proposal modal and wire recommendations triggers"`

---

## 7. Verification Gates & Test Execution Protocol

Before declaring Milestone 4 complete, all 6 verification gates must pass:
1. **Compilation Gate:** `NODE_OPTIONS='--max-old-space-size=8192' pnpm typecheck` exits with 0 errors.
2. **Linting Gate:** `NODE_OPTIONS='--max-old-space-size=8192' pnpm lint` exits with 0 errors and zero new warnings.
3. **Unit Test Gate:** 100% pass rate on all authored Milestone 4 test suites:
   - `src/platform/__tests__/agents/crm/crm-action-contracts.test.ts`
   - `src/platform/__tests__/agents/crm/crm-risk-detector.test.ts`
   - `src/platform/__tests__/agents/crm/crm-next-best-action.test.ts`
   - `src/platform/__tests__/agents/crm/crm-proposal-bridge.test.ts`
   - `src/platform/__tests__/ui/crm-proposal-actions.test.ts`
   - `src/platform/__tests__/ui/crm-proposal-modal.test.tsx`
4. **Regression Gate:** Zero regressions across baseline test suites (Rule 69 Strangler Invariant).
5. **Security Gate:** Zero `any`/`any[]` (Rule 4), Anti-IDOR tenant lock (Rule 8), prompt injection XML isolation (Rule 30), SHA-256 payload binding (Rule 22), and dead-man switch evaluation (Rule 60).
6. **Design System Gate:** Strict conformance with `theme.md` §8 for all modal/drawer components.

---

## 8. Rollback Plan & Safety Invariants

1. **Feature Flag Isolation:** Gated behind `FF_CRM_AGENT_WAVE` and `FF_CRM_NEXT_BEST_ACTIONS`. If disabled, recommendations revert to read-only informational cards.
2. **Zero In-Place Destruction:** Master `/entities` identity records are immutable. All mutations target `/workspace_entities`.
3. **Emergency Pause (Rule 60):** Tripping the dead-man switch immediately pauses all autonomous CRM reasoning and proposal executions with HTTP 503 / `CRM_DEAD_MAN_PAUSED`.
4. **Saga Reversibility (Rule 27):** Every mutating action proposed by the agent records an explicit compensating capability for instantaneous one-click operator rollback via `rollbackCrmActionAction`.
