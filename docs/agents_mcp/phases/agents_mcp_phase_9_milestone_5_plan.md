# SmartSapp Agentic & MCP Transformation: Phase 9 Milestone 5 Implementation Plan
## Signature Autonomous Experience ("What's going on with X?"), Multi-Turn Copilot & Full Platform QA
### Deeply Integrated with `docs/agents_mcp/`, `docs/agentic/`, `theme.md` §8 & The 69 Agentic Development Rules

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement and verify the flagship signature autonomous behavior: *"What's going on with Greenfield School?"* — orchestrating the full 14-step timeline, multi-domain risk evaluation, commitments extraction, grounded narrative synthesis, and executable next-best-actions. Integrate multi-turn conversational follow-ups into the Global ⌘K Omni-Bar and Context Rail, execute adversarial red-team security tests, and achieve full QA verification across the entire platform.

**Architecture:** Build canonical signature contracts in `src/platform/agents/crm/signature/crm-signature-types.ts`. Implement the 14-step `CrmSignatureOrchestrator` integrating Context Assembler, Risk Detector, and NBA Engine. Implement a multi-turn `CrmMultiTurnSession` manager with 30-minute TTL, knapsack compression ($\le 4,000$ tokens), and prompt-injection defense. Expose 4 secure Server Actions in `src/app/actions/crm-signature-actions.ts`. Author a `theme.md` §8 compliant `CrmSignatureDossierModal` and wire it into `GlobalCommandBar` and `EntityAiPromptBar`. Validate with adversarial red-team tests and full platform regression suites.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript (zero `any`/`any[]`), Zod v4, Lucide React, Tailwind CSS, Firestore Admin SDK, Vitest.

---

## 1. Executive Summary & The Signature Behavior

In `docs/agents_mcp/agents_mcp_roadmap.md` (§ Phase 9, lines 1516–1581), the flagship milestone of the First Agent Wave is defined:

> **User says:**  
> *“What's going on with Greenfield School?”*  
>  
> **Agent autonomously executes the 14-Step Signature Pipeline:**  
> 1. Retrieve entity master (`/entities/{entityId}`) & workspace operational record (`/workspace_entities/{workspaceId}_{entityId}`) (Rule 69)  
> 2. Retrieve related contacts  
> 3. Retrieve open & historical deals  
> 4. Retrieve meetings & audio/transcript summaries  
> 5. Retrieve notes & call logs  
> 6. Retrieve payment & invoice context  
> 7. Retrieve previous communications  
> 8. Retrieve tasks & commitments  
> 9. Retrieve relevant semantic knowledge facts via `CanonicalMemoryService`  
> 10. Construct unified chronological timeline  
> 11. Identify unresolved issues & risks via `CrmRiskDetector`  
> 12. Identify commitments & promises from recent meetings/notes  
> 13. Produce grounded narrative answer with citations in `<untrusted_reference_data>`  
> 14. Offer executable next actions via `CrmNextBestActionEngine` & `CrmProposalBridge`  

This represents the defining realization of **"AI uses the app better than humans"** — not because of a larger model, but because of **complete structured access to SmartSapp**.

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│               PHASE 9 MILESTONE 5: SIGNATURE EXPERIENCE & MULTI-TURN COPILOT           │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                 OPERATOR SURFACES                                      │
│  Global ⌘K Omni-Bar (/admin)                      Context Rail & Prompt Bar (⌥C)       │
│  ├── "What's going on with Greenfield School?"    └── [Ask About Account] Chips        │
│  │                                                                                     │
│  ▼                                                                                     │
│  CrmSignatureDossierModal (theme.md §8)                                                │
│  ├── Executive Narrative & Health Score (0-100)                                        │
│  ├── 14-Step Interactive Timeline Feed (Deals, Meetings, Notes, Billing, Tasks)        │
│  ├── Active Risks & Unresolved Issues (Stalls, Dormancy, Overdue)                      │
│  ├── Commitments & Follow-up Promises                                                  │
│  ├── Grounded Citations (Untrusted Reference Data Containers)                          │
│  ├── Executable Next-Best-Action Cards ──► CrmProposalModal (Rule 21 & 22)             │
│  └── Multi-Turn Follow-up Input Bar ("Why did the deal stall last week?")             │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                         SECURE NEXT.JS 15 SERVER ACTIONS                               │
│                       (src/app/actions/crm-signature-actions.ts)                       │
│  ├── executeCrmSignatureInquiryAction     ├── getCrmSignatureSessionAction             │
│  ├── sendCrmFollowupMessageAction         └── getCrmSignatureMetricsAction             │
│  ├── requireAuth() [Clerk Session Authentication]                                      │
│  ├── assertTenantAccess() [Anti-IDOR Multi-Tenant Lock] (Rules 8 & 47)                 │
│  └── checkGovernanceDeadManSwitch() [Emergency Pause Evaluation] (Rule 60)             │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                   CORE SIGNATURE & MULTI-TURN ENGINE SUBSYSTEMS                        │
│                   (src/platform/agents/crm/signature/)                                 │
│  ├── CrmSignatureOrchestrator (14-step autonomous pipeline, Pro Tier routing)          │
│  ├── CrmMultiTurnSession (30-min TTL, rolling window <= 10 turns, knapsack <= 4k tokens)│
│  └── CrmSignatureContracts (Strict Zod v4 schemas, citations, error taxonomy)          │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                   MULTI-DOMAIN CONTEXT & PROPOSAL INFRASTRUCTURE                       │
│  ├── AccountContextAssembler (Milestone 1)     ├── CrmRiskDetector (Milestone 4)       │
│  ├── AccountTimelineService (Milestone 1)      ├── CrmNextBestActionEngine (M4)        │
│  ├── TieredModelRouter (Pro/Flash) (Phase 6)   └── CrmProposalBridge (M4 - Rule 21/22) │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Invariant Architecture: Dual-Tier CRM Data Model Preservation (Rule 69)

In accordance with `docs/agents_mcp/agents_mcp_rules.md` (Rule 69) and `docs/agents_mcp/agents_mcp_tools.md`:
1. **Global Master Identity (`entities`):** `/entities/{entityId}` stores immutable, organization-wide corporate identity (legal name, registration, headquarters address, base website, verified industry). The signature inquiry reads global identity, but **never** mutates it.
2. **Workspace Operational Record (`workspace_entities`):** `/workspace_entities/{workspaceId}_{entityId}` stores workspace-scoped CRM execution state (pipeline, stage, assigned rep, tags, local activity log).
3. **Execution Invariant:** Any recommendation triggered from the signature inquiry (updating deal stage, applying tags, assigning rep) routes strictly through `CrmProposalBridge` targeting `/workspace_entities/${workspaceId}_${entityId}` or child collections (`/deals/{dealId}`, `/tasks/{taskId}`).
4. **Strangler Fig Invariant:** All preexisting CRM tabs, boards, search endpoints, and actions continue functioning with 100% backward compatibility. Zero regressions across baseline test suites.

---

## 3. Master 69-Rules Alignment & Enforcement Matrix for Milestone 5

| Rule # | Requirement | Milestone 5 Architectural Implementation & Verification |
| :---: | :--- | :--- |
| **Rule 1** | Skill Conformance & Standards | Conforms strictly to Next.js 15 App Router, React 19, Tailwind CSS, TypeScript strict mode, and modular decomposition. All legacy features preserved. |
| **Rule 2** | Failure Mode Planning & Cleanliness | Graceful fallback when AI synthesis fails, network drops, or records are missing. Degrades gracefully to structured raw timeline with deterministic heuristic highlights. |
| **Rule 3** | Backoffice Enhancement & Non-Breaking | Embeds directly into `/admin` omni-bar and entity/deal views without breaking existing backoffice features or navigation routes. |
| **Rule 4** | Zero `any` / Zero `any[]` Typing Policy | 100% strictly typed props, state, actions, and schema returns. `unknown` permitted only at raw boundaries, validated immediately with Zod v4. |
| **Rule 5** | Staged Deployment & Security Verification | All contracts, orchestrators, session managers, server actions, and UI modals verified with isolated tests before production integration. |
| **Rule 6** | Dependencies & Context7 Documentation | Uses verified stable versions of `zod/v4`, `lucide-react`, and `node:crypto`. Next.js 15 App Router patterns verified via Context7. |
| **Rule 7** | Mobile-First & Plain UI English | All touch targets $\ge 44\text{px}$ (`min-h-[44px]`), Emil Kowalski tactile clicks (`active:scale-[0.97]`), and plain human language for narratives and action explanations. |
| **Rule 8** | High Security, Data Protection & Anti-IDOR | Every server action enforces caller session `organizationId` matching requested `workspaceId`/`sessionId`/`entityId` boundaries. IDOR attempts fail closed with HTTP 403. |
| **Rule 9** | High Load & Resource Exhaustion Defense | Context retrieval queries bounded to 50 items; payload sizes $< 2\text{KB}$; execution timeouts capped at 10,000ms. |
| **Rule 10** | Inline Architectural Documentation | Every authored file includes comprehensive `@fileOverview` documentation detailing architecture, security invariants, Rule mappings, and testability pointers. |
| **Rule 11** | MCP Protocol Compliance | Action definitions bind to canonical MCP tool outputs; Spec 2026-07-28 Streamable HTTP compatible. |
| **Rule 12** | Risk Ceilings & Weighted Rank | Actions classified by canonical 5-tier risk levels: `L0_READ` (diagnostics), `L1_INTERNAL_DRAFT` (drafts), `L2_STATE_MUTATION` (stage/tags/tasks), `L3_EXTERNAL_COMMUNICATION_FINANCE` (email send, invoice trigger), `L4_PRIVILEGED_DESTRUCTIVE` (merge records). |
| **Rule 13** | Formal Trust Boundary Matrix & Anti-Self-Approval | Customer notes, meeting transcripts, emails, and citations wrapped in `<untrusted_reference_data id="...">` containers. Requesters cannot approve their own high-risk proposals (`SELF_APPROVAL_FORBIDDEN`). |
| **Rule 14** | Tool Poisoning / Rug-Pull Defense | Action triggers verify cryptographic composite SHA-256 fingerprints before executing bound capabilities. |
| **Rule 15** | Server Allowlisting & Supply-Chain Security | External enrichment links and citation URLs validated against allowlists with SSRF prevention. |
| **Rule 16** | Agent Identity as Security Principal | Actions execute under authenticated caller identity with explicit RBAC scopes (`operations:campuses:view`, `crm:entities:read`); no wildcard (`*`) permissions. |
| **Rule 17** | Non-Delegable Actions | Entity deletion, workspace destruction, and billing clearing stripped from autonomous execution affordances. |
| **Rule 18** | TOCTOU Live Principal / Record Check | Record versions verified before applying recommendation stage updates or owner assignments. If version is stale, aborts with `VERSION_MISMATCH`. |
| **Rule 19** | Mandatory Idempotency for Mutating Tools | Mutating recommendation triggers generate deterministic idempotency keys (`crm_action_${entityId}_${hash}`). |
| **Rule 20** | Replay & Distributed Tracing | Injects `correlationId` and `traceparent` headers into domain event metadata and Server Action responses. |
| **Rule 21** | Two-Phase Action Model | State-changing recommendations create action proposals requiring operator review before execution (PLAN -> PREVIEW -> APPROVE -> EXECUTE). |
| **Rule 22** | Cryptographic Approval Binding | Mutating proposals bound to canonical key-sorted SHA-256 `payloadHash`. When executing, rejects with `PAYLOAD_TAMPERED` if mismatched. |
| **Rule 23** | Resource Governance & Budgets | Context assembler enforces 4,000-token ceiling; synthesis duration bounded to 10,000ms. |
| **Rule 24** | 5-State Circuit Breakers | Tiered Model Router fallback protected by 5-state circuit breakers (`healthy`, `degraded`, `open`, `half_open`, `recovered`). |
| **Rule 25** | Dead-Letter & Recovery Queues | Failed proposal executions report structured diagnostics and log to EventBus audit log. |
| **Rule 26** | True Cooperative Cancellation | Actions and fetch requests support native `AbortSignal` cooperative cancellation. |
| **Rule 27** | Formal Saga / Compensation Model | Mutating recommendations bind compensating capabilities for 1-click rollback via `CRM_ROLLBACK_MATRIX`. |
| **Rule 28** | Context Budgeting | Greedy knapsack packing bounds account context strictly $\le 4,000$ tokens. |
| **Rule 29** | Memory Governance | Multi-turn sessions enforce 30-minute automatic TTL expiration; rolling window retained at $\le 10$ turns. |
| **Rule 30** | Knowledge Poisoning Defense | Prompts and UI renderers distrust instructions inside `<untrusted_reference_data>` XML containers. |
| **Rule 31** | Output Validation Between Agent & Tool | Zod schema validation on all action and proposal outputs via `safeParse`. |
| **Rule 32** | Cross-Domain Exfiltration Detection | Synthesis queries restricted strictly to CRM domain scopes (`crm_contacts`, `deals_revenue`, `knowledge_memory`). |
| **Rule 33** | Egress Control & Redaction | Redacts sensitive credentials, API keys, and PII from UI summaries (`[REDACTED_SECRET:<type>]`). |
| **Rule 34** | SSRF & Network Boundary Controls | Outbound company URLs and citations validated via `validateSafeEgressUrl` blocking loopback, GCP metadata, and private subnets. |
| **Rule 35** | MCP Discovery Caching | Deterministic ETag HTTP 304 caching for action schemas. |
| **Rule 36** | Capability Version Compatibility | Declares exact SemVer contracts for signature outputs. |
| **Rule 37** | MCP Spec Compatibility Testing | Conforms to Spec 2026-07-28 test suites. |
| **Rule 38** | No Features on Deprecated MCP Primitives | Uses Streamable HTTP; no stateful session leaks. |
| **Rule 39** | OpenTelemetry From Day One | Propagates W3C `traceparent` headers across server actions and domain events. |
| **Rule 40** | Audit Log Immutability | Publishes `crm.signature.inquiry_executed` and `crm.signature.followup_sent` to EventBus. |
| **Rule 41** | "Why Did You Do This?" Audit View | Every recommendation card features WHAT, WHY, and IMPACT explainability dimensions. |
| **Rule 42** | Mandatory Shadow Mode | All signature inquiry runs can be previewed/simulated with `dryRun: true` and Blast Radius Reports. |
| **Rule 43** | Replayable Agent Runs | Signature session snapshots capture full conversation turns allowing deterministic replay. |
| **Rule 44** | Deterministic Evaluation Dataset | Validated against the 24 gold-standard evaluation scenarios from Milestone 2 (Greenfield School, etc.). |
| **Rule 45** | Chaos Testing | Handles missing notes, empty deals, zero meetings, or corrupt timestamps gracefully with fallback UI. |
| **Rule 46** | Adversarial UI Testing | Red-team test suite against prompt injection via notes, cross-tenant IDOR probing, and unapproved mutation bypass. |
| **Rule 47** | Never Trust the Model | All model outputs, risk scores, and proposed actions are validated against strict Zod v4 schemas before execution or rendering. |
| **Rule 48** | Never Trust the Tool Either | Tool execution errors are caught, sanitized (masking internal stack traces), and mapped to structured user-friendly alerts. |
| **Rule 49** | Public Resource Isolation | CRM agent operations restricted strictly to authenticated admin/workspace surfaces; zero leakage to public portal routes. |
| **Rule 50** | Cache Isolation Rules | In-memory session and context caches partitioned by `organizationId`, `workspaceId`, and `entityId`. |
| **Rule 51** | Server Action / Route Handler Security Gate | Every exported Server Action enforces `'use server'`, Clerk session authentication (`requireAuth()`), and tenant IDOR checks. |
| **Rule 52** | Client/Server Boundary Tests | Verifies that server-side database access, API secrets, and AI prompts are never bundled into client bundles. |
| **Rule 53** | Dependency Governance | Zero unvetted dependencies added; all packages locked and security-audited. |
| **Rule 54** | Performance Budgets | 14-step assembly & narrative render $<1,200\text{ms}$; follow-up query $<600\text{ms}$. |
| **Rule 55** | Graph & Canvas Resource Limits | Related entity displays bounded to $\le 30$ connected nodes to prevent browser DOM lag. |
| **Rule 56** | Agent Context Compression | Knapsack context compressor summarizes long account histories, keeping input tokens strictly $\le 4,000$. |
| **Rule 57** | Data Residency & Retention Awareness | CRM context queries honor tenant data residency tags and redaction policies. |
| **Rule 58** | Model Routing Policy | Quick entity lookups & timeline formatting route to Flash; deep narrative synthesis, risk detection, and deal strategy route to Pro. |
| **Rule 59** | Tool Selection Evaluation | CRM agents restricted strictly to allowed capability domains (`crm_contacts`, `deals_revenue`, `knowledge_memory`, `tasks_productivity`). |
| **Rule 60** | Emergency Dead-Man Controls | `checkGovernanceDeadManSwitch` evaluated before inquiry execution and follow-up generation, failing closed with HTTP 503 / `CRM_DEAD_MAN_PAUSED`. |
| **Rule 61** | Surface Isolation | CRM backoffice administrative configurations restricted to `isBackofficeSurface()`. |
| **Rule 62** | Real-Time UI Reactivity via SSE | Live timeline updates stream via Server-Sent Events (`useEventStream`) without client polling. |
| **Rule 63** | Agent Incident Management | Operators can pause proposals, reject unapproved actions, and trigger manual rollback directly from the UI. |
| **Rule 64** | Zero Raw HTML/CSS Leakage & Feature Flags | Synthesized narratives rendered through sanitized markdown components; features gated by `FF_CRM_AGENT_WAVE` and `FF_CRM_SIGNATURE_BEHAVIOR`. |
| **Rule 65** | Canary Releases | Staged release supporting dark launches and tenant-specific beta access. |
| **Rule 66** | Phased Roadmap Alignment | Fully aligned with Phase 9 roadmap requirements and prepares the foundation for Phase 10 (Sales & Growth Agent System). |
| **Rule 67** | The Agent Implementation Gate | Mandatory 9-point pre-flight checklist verified before marking Milestone 5 complete (see Section 4 below). |
| **Rule 68** | The Five Non-Negotiable Invariants | 1. Identity is not the user. 2. Never trust the model. 3. Never trust untrusted data. 4. High-risk actions require two phases. 5. No dead ends in user experience. |
| **Rule 69** | Strangler Fig Pattern SSOT | Preserves dual-tier data model (`entities` vs `workspace_entities`); zero regressions across existing CRM tests, tabs, and routes. |

---

## 4. The Agent Implementation Gate Verification (Rule 67)

In accordance with Rule 67 (`agents_mcp_rules.md` lines 1980–2050), Milestone 5 completes the Universal CRM Agent wave by fulfilling all 9 dimensions:

```text
1. ARCHITECTURE
   □ Canonical capabilities used: crm.workspace_entity.get, crm.deal.search, crm.meeting.get_dossier,
     crm.task.search, memory.search_semantic, crm.timeline.get_events.
   □ No duplication of existing services: wraps AccountContextAssembler, CrmRiskDetector, CrmNextBestActionEngine.
   □ Source of truth: Firestore (/entities, /workspace_entities, /deals, /meetings, /notes, /tasks, /invoices).
   □ Events emitted: crm.signature.inquiry_executed, crm.signature.followup_sent.

2. AUTHORITY
   □ Who is allowed to use it: Authenticated workspace members with 'operations:campuses:view' or 'crm:entities:read'.
   □ What may the agent do: Autonomous L0 context aggregation, L0 risk analysis, and L1 narrative dossier generation.
   □ What may the agent never do: Autonomous external messaging or direct record mutation without two-phase human review.
   □ Sub-agent delegation: Scope attenuates downward (P_child = P_parent ∩ P_specialist); non-delegables stripped.

3. DATA
   □ Data entering agent: 360° Account Context (deals, meetings, transcripts, notes, tasks, balances).
   □ Data leaving system: Zero external data exfiltration. Output remains within authenticated tenant UI.
   □ Trusted data: Verified Firestore records, system timestamps, schema-validated metadata.
   □ Untrusted data: Customer emails, meeting audio transcripts, user notes (wrapped in XML isolation tags).
   □ Sensitive data: Credit cards, bank details, API keys (masked with [REDACTED_SECRET:<type>]).

4. EXECUTION
   □ Idempotency: All mutating proposals generated from next-best-actions use deterministic idempotency keys.
   □ Retries: Read queries retry with exponential jitter; mutating actions fail closed.
   □ Cancellation: Cooperative cancellation via native AbortSignal on all promises.
   □ Record modification: TOCTOU concurrency check validates record version before committing updates.

5. MCP
   □ Protocol: Streamable HTTP Protocol Spec 2026-07-28.
   □ SDK: @modelcontextprotocol/server 2.1.0 with Genkit in-process adapter.
   □ Capabilities: Domain-partitioned CRM capabilities with cryptographic SHA-256 fingerprints.

6. FAILURE
   □ Timeout: 5,000ms context retrieval ceiling; 10,000ms overall synthesis budget.
   □ 429/500: Circuit breaker trips after 3 consecutive failures, falling back to Flash or cached state.
   □ Stale session: Sessions expire after 30 minutes; active TOCTOU validation catches intermediate modifications.

7. SECURITY
   □ Prompt injection: Pre-retrieval regex scanning and <untrusted_reference_data id="..."> isolation container.
   □ Tool poisoning: Runtime cryptographic SHA-256 fingerprint verification fails closed on schema drift.
   □ Tenant isolation: Strict anti-IDOR checks immutable to authenticated session organizationId.

8. OPERATIONS
   □ Backoffice disable: Dead-man pause switch immediately stops all reasoning without redeploying code.
   □ Backoffice inspection: Live inquiry timeline, correlation IDs, and token gauges on /admin/intelligence.
   □ Backoffice rollback: One-click reverse-LIFO Saga compensation for any executed proposal.

9. TESTING
   □ Unit tests: Hermetic test suites for signature orchestrator, session manager, and server actions.
   □ Integration tests: End-to-end 14-step signature inquiry simulation on Greenfield School scenario.
   □ Adversarial tests: Prompt injection in notes, cross-tenant IDOR probing, and unapproved mutation bypass.
```

---

## 5. Granular Task Breakdown

### Task 1: Canonical Signature Contracts, Citations & Multi-Turn Types
**Target Files:**
- `src/platform/agents/crm/signature/crm-signature-types.ts`
- `src/platform/agents/crm/signature/index.ts`
- `src/platform/__tests__/agents/crm/crm-signature-contracts.test.ts`

- [ ] **Step 1: Write the failing contract tests**
  Author `src/platform/__tests__/agents/crm/crm-signature-contracts.test.ts` validating:
  - `CrmSignatureQuerySchema`: validates natural language query string or explicit entity ID, organizationId, workspaceId, callerId, and options (`dryRun`, `maxTokens`, `signal`).
  - `CrmSignatureCitationSchema`: validates source types (`note`, `meeting`, `transcript`, `deal`, `invoice`, `task`, `memory`), title, snippet, timestamp, and deep link URL.
  - `CrmSignatureResultSchema`: validates entity header, executive narrative, health score, 14-step timeline highlights, active risks, commitments, executable proposed actions, and citations list.
  - `CrmSignatureSessionSchema`: validates sessionId, entityId, tenant boundaries, message history array, and 30-minute expiration timestamp.
  - `CrmFollowupMessageSchema`: validates follow-up message input and response shape.
  - `CRM_SIGNATURE_ERROR_CODES` covers all canonical error strings with HTTP status mapping.
  - Strict Rule 4 adherence: Zero `any` or `any[]`.
- [ ] **Step 2: Run test to verify it fails**
  `pnpm vitest run src/platform/__tests__/agents/crm/crm-signature-contracts.test.ts`
- [ ] **Step 3: Implement `crm-signature-types.ts` and barrel `index.ts`**
  Author strict Zod v4 schemas, type exports, error taxonomy, and `CrmSignatureError` class.
- [ ] **Step 4: Run test to verify it passes**
  `pnpm vitest run src/platform/__tests__/agents/crm/crm-signature-contracts.test.ts`
- [ ] **Step 5: Commit**
  `git commit -m "feat(crm-signature): add canonical CRM signature inquiry contracts and error taxonomy"`

---

### Task 2: Flagship 14-Step Signature Autonomous Orchestrator
**Target Files:**
- `src/platform/agents/crm/signature/crm-signature-orchestrator.ts`
- `src/platform/__tests__/agents/crm/crm-signature-orchestrator.test.ts`

- [ ] **Step 1: Write the failing orchestrator tests**
  Author `src/platform/__tests__/agents/crm/crm-signature-orchestrator.test.ts` testing:
  - Executes full 14-step autonomous pipeline:
    1. Retrieve entity master (`/entities/{entityId}`) & operational state (`/workspace_entities/{workspaceId}_{entityId}`)
    2. Retrieve related contacts
    3. Retrieve deals
    4. Retrieve meetings & audio transcripts
    5. Retrieve notes & call logs
    6. Retrieve payment & invoice context
    7. Retrieve previous communications
    8. Retrieve tasks & commitments
    9. Retrieve semantic memory facts via `CanonicalMemoryService`
    10. Construct chronological timeline via `AccountTimelineService`
    11. Identify active risks via `CrmRiskDetector`
    12. Identify commitments & promises from recent meetings
    13. Produce grounded narrative answer with citations in `<untrusted_reference_data>` (Rule 13 & 30)
    14. Offer executable next actions via `CrmNextBestActionEngine`
  - Enforces Knapsack context budgeting ($\le 4,000$ tokens) (Rule 28 & 56).
  - Routes synthesis to Pro tier model via `TieredModelRouter` with circuit breaker fallback (Rule 24 & 58).
  - Enforces Rule 60 emergency dead-man pause check, rejecting with `CRM_DEAD_MAN_PAUSED`.
  - Publishes `crm.signature.inquiry_executed` domain event via `defaultEventBus` using `createDomainEvent` (Rule 40).
  - Shadow Mode dry-run support (`dryRun: true`) producing a Blast Radius Report without database writes (Rule 42).
  - HMR-safe singleton preservation via `getCrmSignatureOrchestrator()`.
- [ ] **Step 2: Run test to verify it fails**
  `pnpm vitest run src/platform/__tests__/agents/crm/crm-signature-orchestrator.test.ts`
- [ ] **Step 3: Implement `crm-signature-orchestrator.ts`**
  Author `CrmSignatureOrchestrator` coordinating all multi-domain subsystems with strict typing and error handling.
- [ ] **Step 4: Run test to verify it passes**
  `pnpm vitest run src/platform/__tests__/agents/crm/crm-signature-orchestrator.test.ts`
- [ ] **Step 5: Commit**
  `git commit -m "feat(crm-signature): implement flagship 14-step autonomous signature orchestrator"`

---

### Task 3: Multi-Turn Conversational Session Manager & Memory Window
**Target Files:**
- `src/platform/agents/crm/signature/crm-multi-turn-session.ts`
- `src/platform/__tests__/agents/crm/crm-multi-turn-session.test.ts`

- [ ] **Step 1: Write the failing multi-turn session tests**
  Author `src/platform/__tests__/agents/crm/crm-multi-turn-session.test.ts` testing:
  - Creates and manages multi-turn sessions with 30-minute automatic TTL expiration (Rule 29).
  - Bounded conversational window: retains last $\le 10$ turns with knapsack context budgeting $\le 4,000$ tokens.
  - Multi-tenant boundary assertion (Rules 8 & 47).
  - Scans follow-up questions for prompt injection directives (`ADVERSARIAL_DIRECTIVE_PATTERNS`, Rule 30).
  - Emits `crm.signature.followup_sent` domain event via `defaultEventBus` using `createDomainEvent` (Rule 40).
  - Dead-man pause check returning `CRM_DEAD_MAN_PAUSED` (Rule 60).
  - HMR-safe singleton preservation via `getCrmSignatureSessionManager()`.
- [ ] **Step 2: Run test to verify it fails**
  `pnpm vitest run src/platform/__tests__/agents/crm/crm-multi-turn-session.test.ts`
- [ ] **Step 3: Implement `crm-multi-turn-session.ts`**
  Author `CrmMultiTurnSessionManager` with in-memory adapter and Firestore session persistence.
- [ ] **Step 4: Run test to verify it passes**
  `pnpm vitest run src/platform/__tests__/agents/crm/crm-multi-turn-session.test.ts`
- [ ] **Step 5: Commit**
  `git commit -m "feat(crm-signature): implement multi-turn conversational session manager with TTL governance"`

---

### Task 4: Secure Next.js 15 Server Actions
**Target Files:**
- `src/app/actions/crm-signature-actions.ts`
- `src/platform/__tests__/ui/crm-signature-actions.test.ts`

- [ ] **Step 1: Write the failing server action tests**
  Author `src/platform/__tests__/ui/crm-signature-actions.test.ts` testing:
  - Next.js Server Actions convention (`'use server'`).
  - Clerk session authentication via `requireAuth()` (rejects unauthenticated callers with `AUTHENTICATION_REQUIRED`).
  - Anti-IDOR validation: verifies caller's session `organizationId` matches requested tenant boundary, returning `IDOR_VIOLATION` on mismatch (Rule 8 & 47).
  - Emergency dead-man pause check: returns `CRM_DEAD_MAN_PAUSED` when dead-man switch is active (Rule 60).
  - 4 typed server actions:
    * `executeCrmSignatureInquiryAction({ query, entityId, workspaceId })`
    * `sendCrmFollowupMessageAction({ sessionId, workspaceId, message })`
    * `getCrmSignatureSessionAction({ sessionId, workspaceId })`
    * `getCrmSignatureMetricsAction({ workspaceId })`
- [ ] **Step 2: Run test to verify it fails**
  `pnpm vitest run src/platform/__tests__/ui/crm-signature-actions.test.ts`
- [ ] **Step 3: Implement `crm-signature-actions.ts`**
  Author the 4 server actions adhering strictly to Rule 51, Anti-IDOR, dead-man check, and sanitized error mapping.
- [ ] **Step 4: Run test to verify it passes**
  `pnpm vitest run src/platform/__tests__/ui/crm-signature-actions.test.ts`
- [ ] **Step 5: Commit**
  `git commit -m "feat(crm-signature): implement secure CRM signature inquiry server actions"`

---

### Task 5: Standardized Signature Dossier Modal & Surface Integration
**Target Files:**
- `src/components/crm/signature/CrmSignatureDossierModal.tsx`
- `src/components/crm/signature/CrmSignatureTimelineFeed.tsx`
- `src/components/crm/signature/index.ts`
- `src/components/command/GlobalCommandBar.tsx`
- `src/platform/__tests__/ui/crm-signature-ui.test.tsx`

- [ ] **Step 1: Write the failing UI modal tests**
  Author `src/platform/__tests__/ui/crm-signature-ui.test.tsx` testing:
  - `CrmSignatureDossierModal` strictly adheres to `theme.md` §8:
    * Surface: `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`.
    * Demarcated header: `<DialogHeader demarcated min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20 px-6 py-3.5 sm:py-4>`.
    * Single-circle info tooltip button with `<CardInfoTooltip text="..." />` elevated at `z-[10050]`.
    * Zero raw description clutter; `<DialogDescription className="sr-only">`.
    * Demarcated footer: `px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-between gap-2.5` with tactile buttons (`rounded-xl active:scale-[0.97] min-h-[44px]`).
  - Renders Executive Narrative, Health Score, 14-Step Timeline Feed, Active Risks, Commitments, and Citations.
  - Interactive Follow-up chat composer bar with tactile send button and debounced typing.
  - Actionable recommendation triggers opening `CrmProposalModal` with zero dead ends.
  - Global ⌘K Omni-Bar integration: typing "What's going on with [entity]?" triggers the signature dossier modal.
- [ ] **Step 2: Run test to verify it fails**
  `pnpm vitest run src/platform/__tests__/ui/crm-signature-ui.test.tsx`
- [ ] **Step 3: Implement `CrmSignatureDossierModal.tsx` and wire up surfaces**
  - Implement `CrmSignatureDossierModal.tsx` and `CrmSignatureTimelineFeed.tsx` adhering strictly to `theme.md` §8.
  - Integrate signature inquiry shortcut into `GlobalCommandBar.tsx`.
  - Wire action triggers to `CrmProposalModal` for two-phase approval workflow.
- [ ] **Step 4: Run test to verify it passes**
  `pnpm vitest run src/platform/__tests__/ui/crm-signature-ui.test.tsx`
- [ ] **Step 5: Commit**
  `git commit -m "feat(crm-ui): add standardized signature dossier modal and wire omni-bar integration"`

---

### Task 6: Adversarial Red-Team Security & Full Platform QA Verification
**Target Files:**
- `src/platform/__tests__/agents/crm/crm-signature-e2e.test.ts`
- `src/platform/__tests__/agents/crm/crm-adversarial-security.test.ts`

- [ ] **Step 1: Author Greenfield School E2E Signature Inquiry Test Suite**
  Author `src/platform/__tests__/agents/crm/crm-signature-e2e.test.ts` testing the complete 14-step pipeline:
  - Tests signature inquiry "What's going on with Greenfield School?" across the mock 360° context.
  - Validates that timeline is correctly constructed, stalled deal is detected, overdue commitment is flagged, citations are present, and actionable stage update / task proposals are offered.
  - Tests 2 turns of multi-turn conversational follow-up questions within the active session.
- [ ] **Step 2: Author Adversarial Security Red-Team Test Suite (Rule 46)**
  Author `src/platform/__tests__/agents/crm/crm-adversarial-security.test.ts` testing:
  - Vector 1: Prompt injection embedded in customer notes (attempts to override system instructions).
  - Vector 2: Cross-tenant IDOR attacks (attempting to retrieve or mutate data from another tenant).
  - Vector 3: Cryptographic SHA-256 payload tampering attacks on signature-proposed actions.
  - Vector 4: Emergency dead-man switch bypass attempts.
  - Vector 5: Context knapsack overflow attacks ($>4,000$ tokens).
- [ ] **Step 3: Run E2E and adversarial tests**
  `pnpm vitest run src/platform/__tests__/agents/crm/crm-signature-e2e.test.ts src/platform/__tests__/agents/crm/crm-adversarial-security.test.ts`
- [ ] **Step 4: Run full 5-gate platform verification battery**
  ```bash
  # 1. CRM Agent Platform vitest suites
  pnpm vitest run src/platform/__tests__/agents/crm/

  # 2. UI vitest suites
  pnpm vitest run src/platform/__tests__/ui/

  # 3. Platform baseline regression suites (Rule 69 Strangler Invariant)
  pnpm vitest run src/platform/__tests__/baseline/

  # 4. TypeScript static typecheck
  NODE_OPTIONS='--max-old-space-size=8192' pnpm typecheck

  # 5. ESLint static analysis
  NODE_OPTIONS='--max-old-space-size=8192' pnpm lint
  ```
- [ ] **Step 5: Commit**
  `git commit -m "test(crm-agent): add signature e2e and adversarial red-team security verification suites"`

---

## 6. Verification Gates & Completion Protocol

Before declaring Phase 9 Milestone 5 complete and graduating Phase 9, all 6 verification gates must pass:
1. **Compilation Gate:** `NODE_OPTIONS='--max-old-space-size=8192' pnpm typecheck` exits with 0 errors.
2. **Linting Gate:** `NODE_OPTIONS='--max-old-space-size=8192' pnpm lint` exits with 0 errors and zero new warnings ($\le 670$).
3. **Unit & E2E Test Gate:** 100% pass rate on all authored Milestone 5 test suites.
4. **Adversarial Red-Team Gate:** All 5 adversarial attack vectors neutralized and tested.
5. **Regression Gate:** Zero regressions across baseline test suites (Rule 69 Strangler Invariant).
6. **Design System Gate:** Strict conformance with `theme.md` §8 for all modal/drawer components.

---

## 7. Rollback Plan & Safety Invariants

1. **Feature Flag Isolation:** Gated behind `FF_CRM_AGENT_WAVE` and `FF_CRM_SIGNATURE_BEHAVIOR`. If disabled, omni-bar reverts to standard search.
2. **Zero In-Place Destruction:** Master `/entities` identity records are immutable. All mutations target `/workspace_entities`.
3. **Emergency Pause (Rule 60):** Tripping the dead-man switch immediately pauses all autonomous CRM reasoning with HTTP 503 / `CRM_DEAD_MAN_PAUSED`.
4. **Saga Reversibility (Rule 27):** Every mutating action proposed records an explicit compensating capability for instantaneous one-click operator rollback via `rollbackCrmActionAction`.
