# SmartSapp Agentic & MCP Transformation: Phase 8 Master Implementation Plan
## Agent-Native UI/UX, Global Command Center, Adaptive Context Rail & Operator Mission Control
### Deeply Integrated with `docs/agents_mcp/`, `docs/CompanyBrain/`, `docs/agentic/`, `theme.md` §8 & The 69 Agentic Development Rules

**Version:** 1.1.0 (Comprehensive Source-Document & Master 69-Rules Synthesis)  
**Status:** COMPLETE & READY FOR IMPLEMENTATION  
**Authors:** Senior Principal Systems & AI Agentic Architecture Engineer  
**Governing Documents & Source Foundations:**
- **Agentic & MCP Transformation Foundation:**
  - [`docs/agents_mcp/agents_mcp_roadmap.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/docs/agents_mcp/agents_mcp_roadmap.md) (§36 Phase 8: "AI-native UX: AI becomes a first-class application interface", lines 1249–1515: Global AI Command Bar, §9 The Agent Run Center, §10 Tool-call UI, §11 Agent Builder, §12 Workflow Canvas)
  - [`docs/agents_mcp/agents_mcp_ui.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/docs/agents_mcp/agents_mcp_ui.md) (All 94 sections: §1 New SmartSapp UX Mental Model, §2 Global Application Shell, §3 Desktop Navigation, §4 Navigation Behavior, §5 Responsive Breakpoints, §6–7 Mobile & Tablet Shells, §8 The Global Command Center, §9 Command Composer, §10 Agent Run Center, §11 Agent Run Timeline, §12 Agent Approval Center, §30–35 CRM Contextual Surfaces, §36–40 Agent Builder & Editor, §41–42 Workflow Canvas, §76 Global Context Rail, §80 Global Object Command Menu, §81 Design Principle: No Dead Ends, §82 Phase 8 Delivery Map)
  - [`docs/agents_mcp/agents_mcp_rules.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/docs/agents_mcp/agents_mcp_rules.md) (All 69 Rules: Core Principles 1–10, MCP Rules 11–25, Agent Runtime Rules 26–40, Testing & Safety Rules 41–55, Governance & Operational Rules 56–69; specifically UI & Action rules: Rule 4 strict types zero `any`, Rule 7 mobile-first $\ge 44\text{px}$, Rule 8 multi-tenant isolation, Rule 9 resource bounds, Rule 10 Zod schemas, Rule 13 untrusted model output, Rule 14 fingerprinting, Rule 16 agent identity & scopes, Rule 17 non-delegable actions, Rule 18 TOCTOU checks, Rule 20 audit logging, Rule 21 Two-Phase approvals, Rule 22 SHA-256 payload hash binding, Rule 26 cooperative cancellation, Rule 27 Sagas, Rule 28 knapsack context budgeting, Rule 30 prompt injection XML isolation, Rule 34 SSRF defense, Rule 39 distributed tracing correlation ID, Rule 40 domain events on EventBus, Rule 41 explainability what/why/expectedStateChange, Rule 42 dry-run shadow mode, Rule 47 anti-IDOR, Rule 48 error sanitization, Rule 51 server actions requireAuth & anti-IDOR, Rule 55 interactive graphs bounded, Rule 56 token ceilings, Rule 60 emergency dead-man pause, Rule 61 surface isolation, Rule 62 SSE streaming via `useEventStream`, Rule 64 no raw HTML/CSS leakage, Rule 68 five non-negotiable invariants, Rule 69 Strangler Fig zero regression)
  - [`docs/agents_mcp/agents_mcp_prd.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/docs/agents_mcp/agents_mcp_prd.md) (§§53–59: Agent Architecture, Common SmartSappAgent Interface; §§88–103: State Machine, Human-in-the-Loop Rules & UI/UX Information Architecture)
  - [`docs/agents_mcp/agents_mcp_cloudrun.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/docs/agents_mcp/agents_mcp_cloudrun.md) (§1.4 Serverless Throttling, §5 Overcoming Lifecycles, §6 Request Limits & SSRF Defense)
- **Design System & Workspace Rules:**
  - [`theme.md` Section 8](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/theme.md#L396-L442) (Standardized Modal & Dialog Architecture SSOT)
  - [`.agents/AGENTS.md`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/.agents/AGENTS.md) (SSOT: Strict Typing, TagSelector, FieldsVariablesService, Actionable Toasts, Modal System)
- **Existing Implementation Bedrock (Phases 0–7 Completed):**
  - `src/platform/capabilities/` (Execution Gateway, Contracts, Registry, Risk Levels)
  - `src/platform/events/` (Universal Event Bus, Transactional Outbox, SSE Stream)
  - `src/platform/identity/` (Agent Personas, Ephemeral HMAC Tokens, Agent Registry)
  - `src/platform/policy/` (Bounded Delegation, Scope Attenuation, Two-Phase Proposals, Dead-Man Pause)
  - `src/platform/memory/` (5-Tier Memory Plane, Qdrant Vector Adapter, RRF Hybrid Retriever, Knapsack Budgeting)
  - `src/platform/mcp/` (Stateless Streamable HTTP Transport, Progressive Tool Discovery, Supply-Chain DNS Pinning, In-Process Genkit Adapter, Strangler Bridge)
  - `src/platform/runtime/` (Autonomous Agent Runtime, Planning DAG, Multi-Model Router, Knapsack Context Compressor, Sagas & Cancellation, Step Verification, Operator Run Center, Swarm Coordinator)
  - `src/platform/workflows/` (Durable Workflow Engine, 10-State Machine, Checkpoint Store, Cloud Tasks Dispatcher, Lease Manager, Replay & Recovery, Agent-Workflow Bridge, MCP Tasks Protocol)

---

## 1. Executive Summary & Product Vision

### 1.1 The Completed Platform Foundations (Phases 0 through 7)
Through Phases 0 to 7, SmartSapp has engineered a complete, enterprise-grade agentic infrastructure:
1. **Phase 0:** Canonical capability inventory (2,337 capabilities), behavioral freeze, L0–L4 risk taxonomy.
2. **Phase 1:** 15-step Canonical Execution Gateway (`executeCapability`), idempotency deduplication, SSRF defense.
3. **Phase 2:** Reactive Transactional Outbox, Cloud Tasks dispatcher, DLQ, Universal Multi-Tenant Event Bus, live SSE streaming.
4. **Phase 3:** Agent Identity as a first-class security principal (Rule 16), ephemeral HMAC tokens, Two-Phase Proposals with SHA-256 payload binding, Rule 60 emergency dead-man pause switch.
5. **Phase 4:** 5-Tier Institutional Memory Plane, Qdrant REST vector engine, Okapi BM25 sparse retriever, RRF hybrid retrieval, knapsack token budgeting ($\le 4,000$ tokens), prompt injection `<untrusted_reference_data>` isolation container.
6. **Phase 5:** Universal MCP Platform (Spec 2026-07-28), 6 domain-partitioned MCP servers, progressive tool discovery with SHA-256 ETags, cryptographic tool fingerprinting, 8-stage server allowlisting, 7-tier egress data policy, in-process Genkit adapter ($<1\text{ms}$ dispatch).
7. **Phase 6:** Autonomous Agent Runtime, Kahn's DAG sorting, anti-oscillation blacklisting, Tiered Model Router, Knapsack Context Compressor, LIFO Sagas, Two-Phase approval interception, and Multi-Agent Swarm Coordinator.
8. **Phase 7:** Durable Workflow Engine, 10-state lifecycle machine, Firestore checkpoint store with subcollection partitioning, Cloud Tasks step dispatcher, distributed leasing, zombie reaper, crash recovery, and MCP Tasks protocol extension.

### 1.2 The Destination of Phase 8: Agent-Native UI/UX
SmartSapp now enters **Phase 8: Agent-Native UI/UX**.

In accordance with `docs/agents_mcp/agents_mcp_roadmap.md` (§36 & §PHASE 8) and `docs/agents_mcp/agents_mcp_ui.md` (§1 & §82):
> **“The application should stop treating AI as an isolated utility. SmartSapp should remain a complete business application for humans, while simultaneously becoming an operating environment that agents can navigate, understand, and execute through.”**

Phase 8 elevates AI from fragmented chat boxes, static tables, or disjointed admin tools into a **cohesive, fluid, agent-native user experience**.

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                PHASE 8 UI/UX MENTAL MODEL                              │
│                                                                                        │
│     NAVIGATE                  ASK                    DELEGATE             UNDERSTAND   │
│  Traditional UI        Natural Language          Autonomous Agents     Knowledge Graph │
│  (Browse & Filter)     (Instant Answers)         (Multi-Step Tasks)    (Memory Mesh)   │
└───────────────────────────────────┬────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              THREE-ZONE APPLICATION SHELL                              │
│                                                                                        │
│  ┌──────────────────┐  ┌─────────────────────────────────────┐  ┌───────────────────┐  │
│  │   PRIMARY NAV    │  │           MAIN WORKSPACE            │  │   ADAPTIVE RAIL   │  │
│  │                  │  │                                     │  │                   │  │
│  │ WORK             │  │ Global Command Center / Intelligence│  │ Current Entity    │  │
│  │ AUTOMATION       │  │ CRM Contextual Surfaces             │  │ Related Entities  │  │
│  │ INTELLIGENCE     │  │ Agent Run Mission Control           │  │ AI Context Health │  │
│  │ STUDIOS          │  │ Agent Approval Center               │  │ Active Agents     │  │
│  │ TRANSACT         │  │ No-Code Agent Builder Canvas        │  │ Pending Approvals │  │
│  │ SYSTEM           │  │                                     │  │                   │  │
│  └──────────────────┘  └─────────────────────────────────────┘  └───────────────────┘  │
│                                                                                        │
│  Omni-Bar: Global ⌘K Command Dialog (Intent Classifier, Composer, Real-Time SSE Stream)│
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Master 69-Rules Alignment & Enforcement Matrix for Phase 8

To guarantee full conformance with `docs/agents_mcp/agents_mcp_rules.md` without compromising any platform functionality, the matrix below details the exact architectural defense and implementation for all 69 rules in Phase 8:

### Section A: Core Development & Engineering Principles (Rules 1–10)
| Rule # | Requirement | Phase 8 Implementation & Architectural Defense |
| :---: | :--- | :--- |
| **Rule 1** | Skill Conformance & Standards | Conforms strictly to `next-best-practices`, `vercel-react-best-practices`, `emilkowal-animations`, `frontend-design`, and `backend-design`. All preexisting features preserved. |
| **Rule 2** | Failure Mode Planning & Cleanliness | Deep planning for UI failure modes: offline handling, network disconnection, optimistic UI rollback, dead-man banner state, SSE reconnect with exponential backoff. |
| **Rule 3** | Backoffice Enhancement & Non-Breaking | Provides `/admin/intelligence`, `/admin/intelligence/runs`, `/admin/intelligence/approvals`, and `/admin/intelligence/agents` so operators configure AI without touching code. |
| **Rule 4** | Zero `any` / Zero `any[]` Typing Policy | Absolute strict typing across all components, hooks, server actions, and forms. `unknown` permitted only at raw input boundaries, immediately narrowed with Zod v4 schemas. |
| **Rule 5** | Staged Deployment & Security Verification | All compound Firestore indexes for `agent_runs`, `action_proposals`, and `agent_personas` staged and verified. Security rules emulator tested prior to deployment. |
| **Rule 6** | Dependencies & Context7 Documentation | Uses verified stable versions of `@modelcontextprotocol/server`, `cmdk`, `lucide-react`, `framer-motion`, and Zod v4. Documentation verified via Context7 MCP. |
| **Rule 7** | Mobile-First & Plain UI English | All touch targets strictly $\ge 44\text{px}$; responsive drawer sheets and swipe gestures; clear, minimal, everyday UI language with zero walls of plain text. |
| **Rule 8** | High Security, Data Protection & Anti-IDOR | Every UI server action immutably binds to caller's authenticated session `organizationId`. Conflicting tenant parameters fail closed with `IDOR_VIOLATION` (HTTP 403). |
| **Rule 9** | High Load & Resource Exhaustion Defense | Bounded list queries with pagination/virtualization; 300ms debouncing on search and filter inputs; bounded SSE connection subscriptions. |
| **Rule 10** | Inline Architectural Documentation | Every authored UI component, hook, and server action includes comprehensive `@fileOverview` documentation detailing UX behavior, security boundaries, and testability pointers. |

### Section B: MCP & Security Foundations (Rules 11–25)
| Rule # | Requirement | Phase 8 Implementation & Architectural Defense |
| :---: | :--- | :--- |
| **Rule 11** | MCP Protocol Compliance | UI action dispatches consume MCP capabilities and MCP Tasks via Streamable HTTP (Spec 2026-07-28), supporting stateless multi-round-trip execution. |
| **Rule 12** | No MCP Annotations as Security Controls | UI risk badges and approval gates are computed server-side independently of client-provided metadata or hints. |
| **Rule 13** | Formal Trust Boundary Matrix | External user notes, entity fields, webhook payloads, and model outputs are isolated inside `<untrusted_reference_data id="...">` containers before rendering (Rule 30). |
| **Rule 14** | Tool Poisoning / Rug-Pull Defense | Displays cryptographic SHA-256 tool fingerprint status in inspectable tool cards; unapproved drifted tools flagged with warning badges. |
| **Rule 15** | Server Allowlisting & Supply-Chain Security | External servers displayed with 8-stage lifecycle status pills; unapproved servers disabled for agent selection in Agent Builder. |
| **Rule 16** | Agent Identity as Security Principal | Displays authenticated `AgentPrincipal` badges and granted scopes on every run card; wildcard (`*`) scopes banned. |
| **Rule 17** | Non-Delegable Actions | Agent Builder disables non-delegable actions from autonomous execution; they mandate human-in-the-loop approval. |
| **Rule 18** | TOCTOU Live Principal / Delegation Check | Approvals and command execution perform live Firestore permission validation before dispatch. |
| **Rule 19** | Mandatory Idempotency for Mutating Tools | Command Bar actions generate deterministic `idempotencyKey` preventing accidental double-submits on quick double-clicks. |
| **Rule 20** | Replay & Distributed Tracing | Displays `correlationId` and `transactionId` badges with one-click copy on every agent run and tool call card. |
| **Rule 21** | Two-Phase Action Model for High-Risk Work | High-risk actions (L2/L3/L4) transition to pending proposals with explicit approval requirement. |
| **Rule 22** | Cryptographic Approval Binding | Proposal cards display truncated SHA-256 `payloadHash` and re-verify hash at execution time. |
| **Rule 23** | Budget, Backpressure & Resource Governance | Displays real-time token, time, tool-call, and cost budget gauges on Run Center and Agent Builder. |
| **Rule 24** | 5-State Circuit Breakers | Displays circuit breaker health badges (`healthy`, `degraded`, `open`, `half_open`) on model routes and external servers. |
| **Rule 25** | Dead-Letter & Recovery Queues | Run Center includes a dedicated "Failed & DLQ" filter tab with root-cause diagnostics and retry actions. |

### Section C: Agent Runtime, Governance & Execution (Rules 26–40)
| Rule # | Requirement | Phase 8 Implementation & Architectural Defense |
| :---: | :--- | :--- |
| **Rule 26** | True Cooperative Cancellation Semantics | Run Center provides prominent "Cancel Run" button that triggers `cancelRunAction` and aborts active tasks. |
| **Rule 27** | Formal Saga / Compensation Model | Tool cards display compensating actions with "Undo / Compensate" affordances when runs fail or cancel. |
| **Rule 28** | Context Budgeting | Context Rail and "Ask AI" queries enforce strict $\le 4,000$ token ceiling to prevent model context window overflow. |
| **Rule 29** | Memory Governance | Shows memory retention half-life decay indicators and allows operators to adjust memory decay in Agent Builder. |
| **Rule 30** | Knowledge Poisoning Defense | Renders all external text inside `<untrusted_reference_data id="...">` tags preventing DOM-based or model prompt injection. |
| **Rule 31** | Output Validation Between Agent & Tool | Step timeline validates tool output schemas before rendering structured response components. |
| **Rule 32** | Cross-Domain Data Exfiltration Detection | Agent Builder visually highlights cross-domain data access permissions. |
| **Rule 33** | Egress Control & Redaction | In-place redaction masks credentials, API keys, and sensitive financial data in timeline logs (`[REDACTED_SECRET:<type>]`). |
| **Rule 34** | SSRF & Network Boundary Controls | External webhook and server URLs validated with `validateSafeEgressUrl` in Agent Builder. |
| **Rule 35** | MCP Discovery Caching | Tool selection in Agent Builder reuses cached discovery schemas with ETag HTTP 304 validation. |
| **Rule 36** | Capability Version Compatibility | Agent Builder displays SemVer version compatibility pills for all tools. |
| **Rule 37** | MCP Spec Compatibility Testing | Verifies all UI-facing MCP endpoints comply with 2026-07-28 test suites. |
| **Rule 38** | No Features on Deprecated MCP Primitives | Eliminates legacy stateful sessions; uses Streamable HTTP. |
| **Rule 39** | OpenTelemetry From Day One | Run Timeline correlates OpenTelemetry trace IDs and step durations. |
| **Rule 40** | Audit Log Immutability | All UI actions (approvals, rejections, run cancellations, agent persona edits) publish immutable domain events to `defaultEventBus`. |

### Section D: Testing, Safety & Failure Modes (Rules 41–55)
| Rule # | Requirement | Phase 8 Implementation & Architectural Defense |
| :---: | :--- | :--- |
| **Rule 41** | "Why Did You Do This?" Audit View | Every tool-call card and approval proposal explicitly renders WHAT, WHY, and EXPECTED STATE CHANGE. |
| **Rule 42** | Shadow Mode (Dry-Run Simulation) | Agent Builder includes an interactive Test Lab running in `dryRun: true` producing Blast Radius Reports. |
| **Rule 43** | Replayable Agent Runs | Run Center allows replaying past runs step-by-step to inspect historical state transitions. |
| **Rule 44** | Deterministic Simulation Harness | Vitest test harness simulates command bar intent classifications and run timeline updates. |
| **Rule 45** | Chaos Testing | Tests UI resilience against SSE disconnects, server action errors, slow networks, and rapid cancellations. |
| **Rule 46** | Adversarial UI Testing | Red-team tests against prompt injection in search input, payload tampering in approval drawers, and XSS attacks. |
| **Rule 47** | Never Trust the Model | All model outputs, classified intents, and suggested plans are validated with Zod schemas before rendering. |
| **Rule 48** | Never Trust the Tool Either | Tool execution errors are caught, sanitized (masking internal stack traces), and displayed as user-friendly error banners. |
| **Rule 49** | Public Resource Isolation | Intelligence and agent management routes (`/admin/intelligence/*`) strictly segregated from public portals. |
| **Rule 50** | Cache Isolation Rules | All UI client caches keyed by `organizationId` and `workspaceId`. |
| **Rule 51** | Server Action / Route Handler Security Gate | Every exported Server Action enforces `requireAuth()` and anti-IDOR tenant validation. |
| **Rule 52** | Client/Server Boundary Tests | Verifies that secret API keys and server-only SDKs are never bundled into client bundles. |
| **Rule 53** | Dependency Governance | Zero unvetted dependencies added; all packages locked and security-audited. |
| **Rule 54** | Performance Budgets | Command Bar open latency $<50\text{ms}$; intent classification $<200\text{ms}$; run list render $<100\text{ms}$. |
| **Rule 55** | Graph & Canvas Resource Limits | Knowledge Graph and visual DAG components bounded to $\le 50$ nodes to prevent DOM freezes. |

### Section E: Governance, Operations & The Non-Negotiables (Rules 56–69)
| Rule # | Requirement | Phase 8 Implementation & Architectural Defense |
| :---: | :--- | :--- |
| **Rule 56** | Agent Context Compression | Prompt composer compresses conversation history into compact summaries. |
| **Rule 57** | Data Residency & Retention Awareness | UI surfaces respect organization data residency and data masking settings. |
| **Rule 58** | Model Routing Policy | Command Bar intent classification routes to Flash; complex plan decomposition routes to Pro. |
| **Rule 59** | Tool Selection Evaluation | Agent Builder restricts capability selection strictly by persona role and tenant subscription tier. |
| **Rule 60** | Emergency Dead-Man Controls | Banner displays active dead-man switch with disabled mutating action buttons; mutating actions fail closed. |
| **Rule 61** | Backoffice as Agent Control Plane | Privileged agent configuration is restricted to authenticated admin surfaces. |
| **Rule 62** | Real-Time UI Reactivity via SSE | Live streaming updates consume Server-Sent Events via `useEventStream` with zero client polling. |
| **Rule 63** | Agent Incident Management | Operators can pause runs, kill runaway agents, reject proposals, and trigger manual compensation from the UI. |
| **Rule 64** | No Raw HTML/CSS Leakage & Feature Flags | Zero unescaped HTML/CSS tags rendered; UI features gated at System, Org, and Workspace levels. |
| **Rule 65** | Canary Releases | Agent Builder supports staging drafts and canary rollouts of agent personas. |
| **Rule 66** | Phased Roadmap Alignment | Fully aligned with Phase 8 roadmap requirements and forward-compatible with Phase 9 (Universal CRM Agent). |
| **Rule 67** | The "UX Implementation Gate" | Strict 12-point pre-flight checklist verified before marking any Phase 8 milestone complete. |
| **Rule 68** | The Five Non-Negotiable Invariants | 1. Identity is not the user. 2. Never trust the model. 3. Never trust untrusted data. 4. High-risk actions require two phases. 5. No dead ends in user experience. |
| **Rule 69** | Strangler Fig Pattern SSOT | Preexisting CRM routes, notes, automations, and navigation remain 100% operational; modern intelligence surfaces augment legacy capabilities with zero regressions. |

---

## 3. Phase 8 Milestones Breakdown with Explicit Rule Mapping

Phase 8 is structured into **5 comprehensive, sequentially verifiable milestones**:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 PHASE 8 IMPLEMENTATION MILESTONES                                │
│                                                                                                  │
│  Milestone 1: Global AI Command Center, Intent Classifier, 5-State Composer & ⌘K Omni-Bar       │
│  Milestone 2: Agent Run Mission Control, Step Timeline & Inspectable Tool-Call Cards             │
│  Milestone 3: Unified Agent Approval Center, Two-Phase Proposal Interception & Review Drawer     │
│  Milestone 4: Adaptive Global Context Rail, CRM Contextual Surfaces & Object Command Menu       │
│  Milestone 5: Visual No-Code Agent Builder, Policy Editor, Test Lab & Navigation Unification     │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### Milestone 1: Global AI Command Center, Intelligent Intent Composer & Global ⌘K Omni-Bar
**Goal:** Build the unified Global Command Center and `⌘K` modal with real-time multi-modal intent classification, 5-state command composer, quick-action suggestion chips, and real-time SSE execution feedback.

#### Rule Compliance & Architectural Governance Mapping:
- **Rule 4 & 10 (Strict Typing & Zod Validation):** Zero `any`/`any[]`; explicit `CommandIntentSchema`, `ExecuteCommandInputSchema`.
- **Rule 7 (Mobile & Touch First):** All modal inputs and quick action chips meet `min-h-[44px]` touch targets.
- **Rule 8 & 47 (Multi-Tenancy & Anti-IDOR):** Authenticated `organizationId` enforced; client injection rejected.
- **Rule 19 (Idempotency):** Deterministic idempotency key derived from query hash and user session.
- **Rule 47 (Never Trust the Model):** Intent classification schema-validated before rendering plan options.
- **Rule 51 (Server Action Security):** Clerk session authentication `requireAuth()` on all actions.
- **Rule 54 (Performance Budgets):** Keyboard dialog open $<50\text{ms}$; instant classification $<200\text{ms}$.
- **Rule 58 (Model Routing):** Intent classification routes to Flash model; complex plan generation routes to Pro.
- **Rule 60 (Dead-Man Pause):** Mutating command executions fail closed when dead-man switch is active.
- **Rule 62 (SSE Reactivity):** Live step progression updates via `useEventStream` without client polling.
- **Modal Architecture SSOT (`theme.md` §8):** Standardized surface, demarcated header, single-circle info tooltip at `z-[10050]`, screen-reader description, demarcated footer with tactile buttons.

#### Deliverables:
1. **Command Center Contracts & Classifier (`src/platform/ui/command/command-types.ts` & `command-intent-classifier.ts`):**
   - Canonical Zod v4 schemas: `CommandIntentSchema` (`SEARCH`, `ANALYZE`, `EXECUTE`, `DELEGATE`, `AUTOMATE`), `CommandClassificationResultSchema`, `CommandSuggestionSchema`, `ExecuteCommandInputSchema`, `CommandExecutionResultSchema`.
   - Heuristic + Model-based intent classifier with deterministic pattern matching for instant response ($<20\text{ms}$) and fallback to Flash model router for nuanced natural language requests.
2. **Server Actions (`src/app/actions/command-actions.ts`):**
   - Next.js Server Actions convention (`'use server'`) with Clerk session guard `requireAuth()` (Rule 51).
   - `classifyCommandIntentAction`: Returns intent, target entities, confidence score, and suggested action plan.
   - `getCommandSuggestionsAction`: Returns context-aware suggestion chips based on workspace context.
   - `executeCommandAction`: Dispatches the classified intent to the appropriate subsystem (Hybrid Retriever for `SEARCH`, Domain Capability for `EXECUTE`, Agent Planner for `DELEGATE`, Workflow Engine for `AUTOMATE`).
3. **Global ⌘K Omni-Bar Dialog (`src/components/command/GlobalCommandBar.tsx`):**
   - Global keyboard shortcut handler (`⌘K` / `Ctrl+K`).
   - Built on `src/components/ui/command.tsx` (`cmdk`) and strict compliance with `theme.md` §8.
   - 5-State Command Composer (`Empty`, `Suggesting`, `Planning`, `Executing`, `Completed`).
   - Real-time SSE streaming updates (`useEventStream`) during plan decomposition and step execution.
4. **Command Center Operator Surface (`src/app/admin/intelligence/page.tsx` & `IntelligenceClient.tsx`):**
   - Three-Zone layout: Greeting banner, suggested action chips, active agent overview bar, full command console.
5. **Testing Suite (`src/platform/__tests__/ui/command-center.test.tsx` & `src/platform/__tests__/command/command-classifier.test.ts`):**
   - Intent classification accuracy across all 5 intent types.
   - Command composer 5-state transitions.
   - `theme.md` §8 modal architecture compliance.
   - Keyboard navigation and mobile touch targets $\ge 44\text{px}$.

---

### Milestone 2: Agent Run Mission Control, Live Step Timeline & Inspectable Tool-Call Cards
**Goal:** Build the full-fidelity Agent Run Mission Control, granular step execution timeline, inspectable tool-call UI cards, and real-time SSE execution telemetry.

#### Rule Compliance & Architectural Governance Mapping:
- **Rule 4 & 10 (Strict Typing & Zod Validation):** Canonical schemas for run filters, step timelines, tool-call details.
- **Rule 13 & 30 (Untrusted Input & Prompt Injection Isolation):** Untrusted tool inputs, parameters, and outputs rendered strictly inside `<untrusted_reference_data id="...">` containers.
- **Rule 20 & 39 (Distributed Tracing):** Displays correlation ID and transaction ID badges with one-click copy.
- **Rule 22 (Cryptographic Hashes):** Truncated SHA-256 payload and step hashes displayed with copy button.
- **Rule 26 (Cooperative Cancellation):** Cancellation button calls `cancelRunAction` aborting active tokens cleanly.
- **Rule 27 (Sagas & Compensation):** Compensated steps highlighted with "Undone / Compensated" indicators.
- **Rule 41 (Explainability Standard):** Every tool card explicitly displays WHAT, WHY, and EXPECTED STATE CHANGE.
- **Rule 62 (SSE Reactivity):** Live status updates stream via `useEventStream` subscribing to `agent.run.*`.
- **Rule 64 (Zero Raw HTML/CSS Leakage):** Error outputs and payloads sanitized against raw tag injection.
- **Modal Architecture SSOT (`theme.md` §8):** Standardized Run Detail Drawer with demarcated header, single-circle info tooltip at `z-[10050]`, and tactile footer.

#### Deliverables:
1. **Agent Run Mission Control Surface (`src/app/admin/intelligence/runs/page.tsx` & `RunsClient.tsx`):**
   - Three-Zone operator mission control layout: Executive KPI cards (Active Runs, Waiting Approvals, Completed 24h, Token Cost), multi-filter toolbar, live runs stream.
   - Filterable by: Status (`running`, `waiting_for_approval`, `completed`, `failed`, `cancelled`), persona, domain, and time window.
   - Real-time updates via `useEventStream` subscribing to `agent.run.*` and `agent.step.*` SSE events.
   - Backward compatibility redirects from `/admin/runs` and `/admin/ai/runs` (Rule 69).
2. **Granular Agent Run Timeline (`src/components/runs/AgentRunTimeline.tsx`):**
   - Displays sequential execution trace with millisecond timestamps.
   - Node badges for all step types: `PLAN`, `TOOL_CALL`, `REPLAN`, `VERIFY`, `SYNTHESIS`, `HUMAN_PROPOSAL`, `CRITIQUE`.
   - Expandable step details: Step inputs, outputs, runtime duration, token usage, and side effects.
3. **Inspectable Tool-Call Cards (`src/components/runs/ToolCallCard.tsx`):**
   - Structured visual card displaying: Tool Name, Target Entity, Risk Level badge (L0–L4), Explainability attributes (`what`, `why`, `expectedStateChange`), Status indicator, and Revert affordance.
   - Prompt injection containerization (`<untrusted_reference_data>`) and truncated SHA-256 hash display.
4. **Standardized Run Detail Drawer (`src/components/runs/AgentRunDetailDrawer.tsx`):**
   - Strict `theme.md` §8 compliance with 4 tabbed panels: `Timeline & Steps`, `Context & Memory`, `Tools & Audit`, `Budgets & Cost`.
   - Demarcated footer with cooperative cancellation button (`cancelRunAction`).
5. **Server Actions (`src/app/actions/agent-run-ui-actions.ts`):**
   - `listAgentRunsAction`, `getAgentRunDetailsAction`, `cancelAgentRunAction`.
6. **Testing Suite (`src/platform/__tests__/ui/agent-runs-console.test.tsx`):**
   - Run filtering and pagination.
   - Step timeline rendering and state updates.
   - Tool-call card expand/collapse and prompt injection isolation.
   - Cooperative cancellation workflow and modal behavior.

---

### Milestone 3: Unified Agent Approval Center, Two-Phase Human-in-the-Loop Interception & Proposal Review Drawer
**Goal:** Build the dedicated Agent Approval Center, Two-Phase Human-in-the-Loop review drawer, cryptographic SHA-256 payload tampering validation, and structured decision governance.

#### Rule Compliance & Architectural Governance Mapping:
- **Rule 4 & 10 (Strict Typing & Zod Validation):** Strongly typed approval filters, proposal records, and decision inputs.
- **Rule 18 (TOCTOU Authority Check):** Live check verifies approving user's current permissions before executing approved payload.
- **Rule 21 & 22 (Two-Phase Approval & Cryptographic Binding):** Validates SHA-256 `payloadHash` at execution time; fails closed with `PAYLOAD_TAMPERED` if mismatched.
- **Rule 30 (Prompt Injection Defense):** Proposed payloads rendered in `<untrusted_reference_data id="...">` containers.
- **Rule 40 (Audit Immutability):** Approval and rejection actions emit immutable domain events to `defaultEventBus`.
- **Rule 41 (Plain-English Descriptions):** Eliminates generic descriptions; requires explicit WHAT, WHY, and EXPECTED CHANGE.
- **Rule 51 (Server Action Security):** Clerk session authentication `requireAuth()` and anti-IDOR validation.
- **Rule 60 (Dead-Man Pause Gate):** Emergency banner displayed; approval executions fail closed when paused.
- **Modal Architecture SSOT (`theme.md` §8):** Standardized Proposal Review Drawer with demarcated header, single-circle info tooltip at `z-[10050]`, and tactile footer.

#### Deliverables:
1. **Unified Approval Center Surface (`src/app/admin/intelligence/approvals/page.tsx` & `ApprovalsClient.tsx`):**
   - Dedicated mission control consolidating pending proposals from autonomous agents, swarms, and durable workflows.
   - Category filter pills: `All`, `Campaigns`, `Financial`, `Messaging`, `Bulk Updates`, `Privileged`.
   - Emergency dead-man banner indicating active pause state (Rule 60).
   - Clean redirection and backward compatibility with preexisting `/admin/approvals`.
2. **Structured Approval Review Cards (`src/components/approvals/ApprovalReviewCard.tsx`):**
   - Eliminates generic AI descriptions in favor of explicit, structured review sections: WHAT, WHY, AFFECTED, EVIDENCE, EXPECTED CHANGE, RISK & POLICY.
   - Quick action buttons: `Approve`, `Reject` (with mandatory reason modal), `Inspect Details`.
3. **Standardized Proposal Review Drawer (`src/components/approvals/ProposalReviewDrawer.tsx`):**
   - Adheres strictly to `theme.md` §8.
   - Diff viewer showing proposed state change vs current database state.
   - Payload inspector wrapping untrusted data in `<untrusted_reference_data id="...">`.
   - Safe parameter editor for allowed non-destructive adjustments before approval.
4. **Cryptographic Validation & Execution Pipeline (`src/app/actions/approval-governance-actions.ts`):**
   - Server Actions with Clerk authentication `requireAuth()` and anti-IDOR validation.
   - Cryptographic SHA-256 payload binding validation.
   - Live TOCTOU authority check.
   - Dead-man pause check failing closed with HTTP 503.
   - EventBus domain events: `approval.granted`, `approval.rejected`.
5. **Testing Suite (`src/platform/__tests__/ui/approval-center.test.tsx`):**
   - Approval card rendering and filter grouping.
   - Cryptographic payload tampering detection test.
   - Rejection modal requiring mandatory explanation.
   - TOCTOU authority verification.

---

### Milestone 4: Adaptive Global Context Rail, CRM Contextual Intelligence Hub & Universal Object Command Menu
**Goal:** Build the adaptive right Context Rail, embed contextual "Ask AI" surfaces across CRM records, and deploy the universal Object Command Menu across all entities.

#### Rule Compliance & Architectural Governance Mapping:
- **Rule 4 & 10 (Strict Typing & Zod Validation):** Canonical schemas for context rail payloads and "Ask AI" queries.
- **Rule 7 (Mobile-First Touch Standards):** Context rail collapses smoothly to a slide-over sheet on mobile viewports.
- **Rule 8 & 47 (Tenant Scoping & Anti-IDOR):** Ingests entity context strictly bound to caller's authenticated organization.
- **Rule 28 & 56 (Context Budgeting):** Context rail and "Ask AI" queries enforce hard $\le 4,000$ token ceiling.
- **Rule 30 (Prompt Injection Defense):** Entity context and memory citations wrapped in `<untrusted_reference_data>`.
- **Rule 41 (Grounded Citations):** Answers render explicit source citations linking to original notes/records.
- **Rule 51 (Server Action Security):** Clerk session authentication `requireAuth()` on all rail actions.
- **Rule 69 (Strangler SSOT & No Dead Ends):** Augments existing CRM pages with zero regression; every action provides direct navigation into the next step (§81).

#### Deliverables:
1. **Adaptive Global Context Rail (`src/components/context-rail/GlobalContextRail.tsx`):**
   - Non-intrusive adaptive right rail that slides out on entity pages (`/contacts/:id`, `/institutions/:id`, `/deals/:id`) or when invoked via keyboard shortcut `⌥C` (Option+C).
   - 6 Contextual Modules: Current Entity Dossier, Related Entities Mesh, Institutional Memory & Context, Relationship Health Meter, Active Agent Runs, Pending Approvals.
2. **CRM Contextual "Ask About This" Surface (`src/components/crm/EntityAiPromptBar.tsx`):**
   - Contextual prompt bar embedded on every CRM entity detail page.
   - Dynamic quick-prompt chips: "What do they care about?", "What's unresolved?", "What did we promise?", "Summarize relationship", "Prepare meeting briefing".
   - Executes hybrid memory retrieval within strict token ceilings ($\le 4,000$ tokens).
3. **Universal Object Command Menu (`src/components/shared/ObjectCommandMenu.tsx`):**
   - Standardized dropdown menu component ("...") mounted on entity rows, deal cards, and table lists.
   - Contextual actions: `Ask AI about this entity`, `Summarize activity`, `Find related entities`, `Create follow-up task`, `Launch Agent Run`, `Add to Workflow`.
   - Strict "No Dead Ends" rule (§81).
4. **Server Actions (`src/app/actions/context-rail-actions.ts`):**
   - `getEntityContextRailDataAction`, `askEntityAiAction`.
5. **Testing Suite (`src/platform/__tests__/ui/context-rail.test.tsx` & `src/platform/__tests__/ui/crm-ai-surfaces.test.tsx`):**
   - Context rail open/close, responsive collapse on mobile, and data rendering.
   - "Ask AI" prompt execution, citation display, and prompt injection isolation.
   - Object command menu action dispatching.

---

### Milestone 5: No-Code Visual Agent Builder, Policy Editor, Test Lab & Navigation Unification
**Goal:** Build the visual No-Code Agent Builder, Policy Editor, Test Lab Sandbox with Blast Radius Reports, and complete the full navigation unification of `AdminSidebar` into the canonical 6-group architecture.

#### Rule Compliance & Architectural Governance Mapping:
- **Rule 4 & 10 (Strict Typing & Zod Validation):** Canonical schemas for agent persona forms, diff views, and test lab payloads.
- **Rule 7 (Mobile-First Navigation):** Sidebar navigation groups and mobile sheet drawers meet $\ge 44\text{px}$ touch targets.
- **Rule 16 & 17 (Identity & Non-Delegable Actions):** Enforces scope attenuation; non-delegable actions barred from autonomous execution.
- **Rule 23 (Resource Governance):** Delegation depth ceiling enforced at $\le 4$; hard token and tool call limits.
- **Rule 34 (SSRF Defense):** Webhook trigger URLs validated via `validateSafeEgressUrl`.
- **Rule 42 (Shadow Simulation Mode):** Agent Test Lab executes in `dryRun: true`, producing Blast Radius Reports with zero live database mutations.
- **Rule 51 (Server Action Security):** Clerk session authentication `requireAuth()` and anti-IDOR validation.
- **Rule 55 (Graph Resource Limits):** Interactive visual topology diagrams bounded to $\le 50$ nodes.
- **Rule 60 (Dead-Man Pause Gate):** Agent publishing disabled during active dead-man switch.
- **Rule 69 (Strangler Fig SSOT):** Preexisting navigation groups, routes, and permissions remain 100% operational with zero regressions.
- **Modal Architecture SSOT (`theme.md` §8):** Version diff modal and test lab drawer adhere strictly to standardized modal geometry, demarcated headers/footers, and single-circle tooltips at `z-[10050]`.

#### Deliverables:
1. **Visual No-Code Agent Builder (`src/app/admin/intelligence/agents/page.tsx` & `AgentBuilderClient.tsx`):**
   - Allows non-technical operators to create, edit, and configure custom autonomous agents without touching code:
     * **Panel 1 — Identity & Purpose:** Name, slug, avatar selector, role description, persona system prompt.
     * **Panel 2 — Capabilities & Domain Scopes:** Canonical domain selector (`crm`, `knowledge`, `messaging`, `sales`, `portals`, `system`), capability checkboxes with L0–L4 risk chips.
     * **Panel 3 — Memory & Knowledge:** Linked memory tiers, source collections, half-life exponential decay presets.
     * **Panel 4 — Governance & Policies:** Execution level, max autonomous risk level, mandatory human approval rules, delegation depth ceiling ($\le 4$).
     * **Panel 5 — Models & Budgets:** Primary model (`flash` or `pro`), fallback model, max tokens ceiling ($\le 100\text{k}$), max tool calls ceiling ($\le 30$), cost budget.
     * **Panel 6 — Triggers & Outputs:** Manual trigger, EventBus subscriptions, Cron schedules, Webhooks.
2. **Agent Version Diff & History (`src/components/builder/AgentVersionDiffModal.tsx`):**
   - Adheres strictly to `theme.md` §8:
     * Visual side-by-side diff comparing draft settings against published agent persona.
     * Clear highlighting of modified tool permissions, changed risk levels, and updated system prompts.
3. **Interactive Agent Test Lab (Sandbox) (`src/components/builder/AgentTestLab.tsx`):**
   - Allows operators to simulate agent goals in a safe, hermetic sandbox.
   - Executes in Shadow Simulation Mode (`dryRun: true`, Rule 42) guaranteeing zero live database mutations.
   - Generates comprehensive **Blast Radius Reports** detailing: capabilities invoked, mutations intercepted, required approvals, and estimated cost.
4. **Global Navigation Unification (`src/app/admin/components/AdminSidebar.tsx`):**
   - Re-organizes sidebar navigation into canonical 6-group structure (§3):
     * `WORK`: Dashboard, Contacts, Deals/Pipeline, Tasks, Meetings, Calendar.
     * `AUTOMATION`: Automations, Workflows, Schedules, Runs.
     * `INTELLIGENCE`: Command Center (`/admin/intelligence`), Company Brain (`/admin/brain`), Knowledge Inbox (`/admin/knowledge/inbox`), Knowledge Graph (`/admin/quick-notes/graph`), Agents (`/admin/intelligence/agents`), Agent Runs (`/admin/intelligence/runs`), Approvals (`/admin/intelligence/approvals`), MCP Capabilities (`/admin/mcp`).
     * `STUDIOS`: Portals, Landing Pages, Media, Flipbooks, Surveys, Doc Signing, Messaging, Call Centre, Forms, Tags, QR Studio, Verify Studio.
     * `TRANSACT`: Agreements, Invoices, Packages, Cycles, Billing Setup.
     * `SYSTEM`: Activities, Lead Scores, Settings, Developer API, Webhooks.
   - Mobile and tablet responsive navigation optimization: touch targets $\ge 44\text{px}$ (Rule 7), sheet drawer support, keyboard shortcuts.
5. **Server Actions (`src/app/actions/agent-builder-actions.ts`):**
   - `saveAgentPersonaAction`, `publishAgentPersonaAction`, `testAgentPersonaAction`.
6. **Testing Suite (`src/platform/__tests__/ui/agent-builder.test.tsx` & `src/platform/__tests__/ui/navigation-unification.test.tsx`):**
   - Agent builder form validation with Zod schemas.
   - Version diff modal rendering.
   - Test lab simulation and blast radius calculation.
   - Full navigation group rendering, responsive mobile drawer, and keyboard navigation.

---

## 4. The 12-Point UX Implementation Gate (Rule 67) & Non-Negotiable Invariants (Rule 68)

### 4.1 The 12-Point UX Implementation Gate (Rule 67)
Before any milestone in Phase 8 is marked complete and submitted for review, it must satisfy all 12 items:

```
[x] 1. Protocol & Version Compliance: Adheres strictly to Next.js App Router, React 19 / Server Actions, and MCP 2026-07-28 patterns.
[x] 2. Strict Typing Invariant (Rule 4): Zero use of `any` or `any[]`; explicit Zod schemas for all props, states, and Server Actions.
[x] 3. Mobile & Touch Accessibility (Rule 7): All interactive touch targets strictly >= 44px; mobile sheets and swipe gestures validated.
[x] 4. Multi-Tenant Boundary & Anti-IDOR (Rules 8 & 47): Session organizationId cross-validated on every action; fail-closed on mismatch.
[x] 5. Resource Ceilings & Performance (Rules 9, 28 & 56): Hard ceilings on token budgeting (<= 4,000 tokens) and bounded list limits.
[x] 6. Prompt Injection Defense (Rule 30): All untrusted external text, entity fields, and tool outputs rendered in <untrusted_reference_data> containers.
[x] 7. Two-Phase Cryptographic Integrity (Rules 21 & 22): Approvals bind SHA-256 payloadHash; validated prior to execution.
[x] 8. Explainability Standard (Rule 41): All tool cards and approval proposals explicitly detail WHAT, WHY, and EXPECTED STATE CHANGE.
[x] 9. Shadow Mode Simulation (Rule 42): Agent Test Lab executes in dry-run mode, producing verifiable Blast Radius Reports.
[x] 10. Dead-Man Switch Safety Gate (Rule 60): All mutating server actions evaluate checkGovernanceDeadManSwitch at Step 1.
[x] 11. Real-Time SSE Reactivity (Rule 62): Live status updates route through useEventStream with zero polling loops.
[x] 12. Modal & Dialog System SSOT (theme.md §8): All modals bind to standardized geometry, demarcated headers/footers, and single-circle tooltip at z-[10050].
```

### 4.2 The Five Non-Negotiable Invariants (Rule 68)
1. **Identity is not the user (Rule 16):** Agent actions execute under authenticated `AgentPrincipal` with attenuated scopes. Never execute agent commands with unchecked ambient permissions.
2. **Never trust the model (Rule 47):** Model outputs, classified intents, and generated plans must be schema-validated before rendering or execution.
3. **Never trust untrusted data (Rule 30):** User notes, external webhook payloads, and third-party data must be containerized in `<untrusted_reference_data id="...">` to prevent client-side or agent-side prompt injection.
4. **High-risk actions require two phases (Rules 21 & 22):** Any action mutating external customer records, spending funds, or modifying access must require human sign-off with SHA-256 payload hash verification.
5. **No dead ends in the user experience (§81):** Every search result, card, summary, or error must provide clear, actionable next steps or return pathways.

---

## 5. Strangler Fig Architecture & Backward Compatibility (Rule 69)

1. **Zero-Regression to Existing Modules:**
   - Existing CRM routes (`/admin/contacts`, `/admin/pipeline`, `/admin/tasks`, `/admin/meetings`) remain 100% operational; contextual surfaces augment rather than replace existing views.
2. **Backward-Compatible Route Redirections:**
   - `/admin/runs` and `/admin/ai/runs` redirect seamlessly to `/admin/intelligence/runs`.
   - `/admin/approvals` redirects seamlessly to `/admin/intelligence/approvals`.
   - Legacy `/admin/quick-notes` and `/admin/companybrain` routes remain intact and accessible.
3. **Preservation of Preexisting Permissions & Roles:**
   - All navigation items check user roles and permissions (`can('operations', ...)`), ensuring unprivileged users cannot access restricted intelligence surfaces.
4. **Full Test Suite Continuity:**
   - Preexisting platform test suites (149 test files, 1,135 tests) must continue passing with zero regressions throughout Phase 8.

---

## 6. Definition of Done & Exit Criteria

Phase 8 will be complete and ready for production deployment when:
1. All 5 milestones are fully implemented with zero dangling stubs or mock bypasses.
2. 100% of authored tests pass in Vitest across all unit, component, integration, and UI suites.
3. `pnpm typecheck` exits with 0 errors under strict TypeScript compilation (Rule 4).
4. `pnpm lint` passes with 0 errors across all authored and modified files.
5. All 12 criteria of the **UX Implementation Gate (Rule 67)** are verified green.
6. The **Senior Principal Systems & AI Agentic Architecture Reviewer** conducts a comprehensive code review and awards an unconditional **Grade A/A+**.
7. Changes are committed, pushed to `origin main`, and successfully deployed through the remote GitHub Actions CI/CD pipeline.
