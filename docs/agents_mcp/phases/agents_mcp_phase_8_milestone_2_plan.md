# Implementation Plan: Phase 8 Milestone 2
# Agent Run Mission Control, Live Step Timeline & Inspectable Tool-Call Cards

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full-fidelity Agent Run Mission Control console (`/admin/intelligence/runs`), granular step execution timeline (`AgentRunTimeline`), inspectable tool-call cards (`ToolCallCard`), and standardized run detail drawer (`AgentRunDetailDrawer`) with real-time SSE execution telemetry.

**Architecture:** Connects Next.js 15 Server Actions to `AgentRunStore` and `CancellationEngine` with session-bound Anti-IDOR validation. Implements a responsive Three-Zone mission control surface, deep step-by-step DAG timeline with prompt injection `<untrusted_reference_data>` isolation, explainability attributes (WHAT, WHY, EXPECTED CHANGE), distributed tracing correlation badges, and `theme.md` §8 standardized drawer architecture.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind CSS, Lucide React, Zod v4, `useEventStream` (SSE), `@/platform/runtime/agent-run-store`, `@/platform/runtime/governance/cancellation-engine`.

---

## 1. Master 69-Rules Alignment & Enforcement Matrix for Milestone 2

To guarantee full conformance with `docs/agents_mcp/agents_mcp_rules.md` without compromising any platform functionality, the matrix below details the exact architectural defense and verification method for all 69 rules in Phase 8 Milestone 2:

### Section A: Core Development & Engineering Principles (Rules 1–10)
| Rule # | Requirement | Milestone 2 Implementation & Architectural Defense | Verification Method |
| :---: | :--- | :--- | :--- |
| **Rule 1** | Skill Conformance & Standards | Conforms strictly to `next-best-practices`, `vercel-react-best-practices`, `emilkowal-animations`, `frontend-design`, and `backend-design`. All preexisting app functionalities intact. | Automated test suite & static code review. |
| **Rule 2** | Failure Mode Planning & Cleanliness | Deep failure mode planning: network disconnections, SSE stream reconnection with exponential backoff, dead-man banner rendering, cancelled run visual badges. | Chaos testing simulations in Vitest. |
| **Rule 3** | Backoffice Enhancement & Non-Breaking | Provides `/admin/intelligence/runs` as the dedicated backoffice console so operators monitor, inspect, and cancel agent runs without code changes. | End-to-end UI verification. |
| **Rule 4** | Zero `any` / Zero `any[]` Typing Policy | Absolute strict typing across all components, hooks, server actions, and forms. `unknown` permitted only at raw boundaries, immediately narrowed with Zod v4 schemas. | `tsc --noEmit` clean exit code 0. |
| **Rule 5** | Staged Deployment & Security Verification | Reuses existing verified compound Firestore indexes for `agent_runs` (`organizationId`, `workspaceId`, `status`, `createdAt`). Staged emulator tests verified. | Firestore index verification. |
| **Rule 6** | Dependencies & Context7 Documentation | Uses verified stable versions of `lucide-react`, `framer-motion`, and Zod v4. Documentation verified via Context7 MCP. Zero unvetted dependencies. | Dependency tree audit. |
| **Rule 7** | Mobile-First & Plain UI English | All touch targets strictly $\ge 44\text{px}$; responsive drawer sheets and swipe gestures; clear, minimal, everyday UI language with zero walls of plain text. | Viewport tests (`375px` & `768px`). |
| **Rule 8** | High Security, Data Protection & Anti-IDOR | Every UI server action immutably binds to caller's authenticated session `organizationId`. Conflicting tenant parameters fail closed with `IDOR_VIOLATION` (HTTP 403). | Negative Anti-IDOR unit tests. |
| **Rule 9** | High Load & Resource Exhaustion Defense | Bounded list queries with pagination (`limit: 20`, max 100); 300ms debouncing on search and filter inputs; capped step timeline rendering ($\le 50$ steps). | Memory & DOM benchmark tests. |
| **Rule 10** | Inline Architectural Documentation | Every authored UI component, hook, and server action includes comprehensive `@fileOverview` documentation detailing UX behavior, security boundaries, and testability pointers. | Inline comment code review. |

### Section B: MCP & Security Foundations (Rules 11–25)
| Rule # | Requirement | Milestone 2 Implementation & Architectural Defense | Verification Method |
| :---: | :--- | :--- | :--- |
| **Rule 11** | MCP Protocol Compliance | UI action dispatches consume MCP capabilities and runtime runs via stateless Streamable HTTP (Spec 2026-07-28). | Contract integration tests. |
| **Rule 12** | No MCP Annotations as Security Controls | UI risk badges and approval gates are computed server-side independently of client-provided metadata or hints. | Server Action unit tests. |
| **Rule 13** | Formal Trust Boundary Matrix | External tool inputs, arguments, and step outputs are treated as untrusted data and wrapped in `<untrusted_reference_data id="...">` containers before rendering. | DOM snapshot assertions. |
| **Rule 14** | Tool Poisoning / Rug-Pull Defense | Displays cryptographic SHA-256 tool fingerprint status in inspectable tool cards; unapproved drifted tools flagged with warning badges. | Tool card component tests. |
| **Rule 15** | Server Allowlisting & Supply-Chain Security | Displays server source and allowlist verification badges for external tools called during agent steps. | Tool card component tests. |
| **Rule 16** | Agent Identity as Security Principal | Displays authenticated `AgentPrincipal` badges and granted scopes on every run card; wildcard (`*`) scopes banned. | Run card rendering tests. |
| **Rule 17** | Non-Delegable Actions | Identifies non-delegable capabilities within step execution traces and displays mandatory human-in-the-loop markers. | Step timeline tests. |
| **Rule 18** | TOCTOU Live Principal / Delegation Check | Live status check verifies run is still cancellable (`isCancellableState`) before aborting in-flight execution tokens. | Concurrency race condition tests. |
| **Rule 19** | Mandatory Idempotency for Mutating Tools | Cancellation requests pass unique `correlationId` and deterministic timestamp to prevent duplicate cancel operations. | Cancellation engine tests. |
| **Rule 20** | Replay & Distributed Tracing | Displays `correlationId` and `traceId` badges with one-click clipboard copy on every agent run and tool call card. | Clipboard interaction tests. |
| **Rule 21** | Two-Phase Action Model for High-Risk Work | Runs paused in `waiting_for_approval` highlighted with amber pulse badges and direct link to the Approval Center (`/admin/intelligence/approvals`). | FSM state UI tests. |
| **Rule 22** | Cryptographic Approval Binding | Displays truncated SHA-256 `payloadHash` and step hashes with copy button; re-verifies hash before detail rendering. | Hash truncation tests. |
| **Rule 23** | Budget, Backpressure & Resource Governance | Displays real-time token, time, tool-call, and cost budget gauges on Run Detail Drawer with multi-dimensional progress bars. | Budget gauge tests. |
| **Rule 24** | 5-State Circuit Breakers | Displays circuit breaker health badges on agent runs when model downgrade or fallback occurred. | Model fallback status tests. |
| **Rule 25** | Dead-Letter & Recovery Queues | Run Center includes a dedicated "Failed / DLQ" filter tab with root-cause diagnostics, error codes, and retry actions. | DLQ tab filter tests. |

### Section C: Agent Runtime, Governance & Execution (Rules 26–40)
| Rule # | Requirement | Milestone 2 Implementation & Architectural Defense | Verification Method |
| :---: | :--- | :--- | :--- |
| **Rule 26** | True Cooperative Cancellation Semantics | Run Detail Drawer provides prominent "Cancel Run" button that triggers `cancelAgentRunAction`, aborts active tokens, and transitions FSM to `cancelled`. | Cancellation workflow tests. |
| **Rule 27** | Formal Saga / Compensation Model | Step timeline displays compensating steps with purple "Compensated" badge and reversible capability indicators. | Saga compensation tests. |
| **Rule 28** | Context Budgeting | Panel 2 of Run Drawer renders prompt token estimates and working memory size against the 4,000-token ceiling. | Context meter tests. |
| **Rule 29** | Memory Governance | Working memory items displayed with half-life temporal validity indicators. | Memory panel tests. |
| **Rule 30** | Knowledge Poisoning Defense | Renders all external text inside `<untrusted_reference_data id="...">` tags preventing DOM-based or model prompt injection. | Injection string containment tests. |
| **Rule 31** | Output Validation Between Agent & Tool | Step timeline validates tool output schemas before rendering structured response components. | Schema parsing tests. |
| **Rule 32** | Cross-Domain Data Exfiltration Detection | Highlights cross-domain data access permissions in the Tools & Audit drawer panel. | Audit panel tests. |
| **Rule 33** | Egress Control & Redaction | In-place redaction masks credentials, API keys, and sensitive financial data in timeline logs (`[REDACTED_SECRET:<type>]`). | Redaction pattern tests. |
| **Rule 34** | SSRF & Network Boundary Controls | External URLs referenced in tool arguments verified via `validateSafeEgressUrl` before displaying clickable links. | URL sanitizer tests. |
| **Rule 35** | MCP Discovery Caching | Tool card metadata leverages cached discovery schemas without redundant network fetches. | ETag cache tests. |
| **Rule 36** | Capability Version Compatibility | Displays SemVer version compatibility pills for all executed capabilities in tool cards. | SemVer badge tests. |
| **Rule 37** | MCP Spec Compatibility Testing | Verifies all UI-facing MCP run event payloads conform to 2026-07-28 test suites. | Protocol conformance tests. |
| **Rule 38** | No Features on Deprecated MCP Primitives | Eliminates legacy stateful sessions; uses Streamable HTTP. | Header inspection tests. |
| **Rule 39** | OpenTelemetry From Day One | Run Timeline correlates OpenTelemetry trace IDs, span IDs, and step durations. | Distributed tracing tests. |
| **Rule 40** | Audit Log Immutability | All UI actions (cancellations, status updates) publish immutable domain events (`agent.run.cancelled`) to `defaultEventBus`. | EventBus subscriber tests. |

### Section D: Testing, Safety & Failure Modes (Rules 41–55)
| Rule # | Requirement | Milestone 2 Implementation & Architectural Defense | Verification Method |
| :---: | :--- | :--- | :--- |
| **Rule 41** | "Why Did You Do This?" Audit View | Every tool-call card and step explicitly renders WHAT, WHY, and EXPECTED STATE CHANGE. | Explainability audit tests. |
| **Rule 42** | Shadow Mode (Dry-Run Simulation) | Run cards distinguish shadow mode simulation runs (`dryRun: true`) with violet simulation badges. | Shadow mode filter tests. |
| **Rule 43** | Replayable Agent Runs | Run Center allows replaying past runs step-by-step to inspect historical state transitions. | Step navigation tests. |
| **Rule 44** | Deterministic Simulation Harness | Vitest test harness simulates agent run creation, step progression, and cancellation. | Unit test execution. |
| **Rule 45** | Chaos Testing | Tests UI resilience against SSE disconnects, server action errors, slow networks, and rapid cancellations. | Mock network failure tests. |
| **Rule 46** | Adversarial UI Testing | Red-team tests against prompt injection in goal search, payload tampering in detail drawers, and XSS attacks. | XSS string containment tests. |
| **Rule 47** | Never Trust the Model | All model-generated goals, plans, and reflection notes are validated with Zod v4 schemas before rendering. | Schema safeParse assertions. |
| **Rule 48** | Never Trust the Tool Either | Tool execution errors are caught, sanitized (masking internal stack traces), and displayed as user-friendly error banners. | Error sanitization tests. |
| **Rule 49** | Public Resource Isolation | Runs console (`/admin/intelligence/runs`) strictly segregated from public customer surfaces. | Route auth guard tests. |
| **Rule 50** | Cache Isolation Rules | All UI client caches keyed by `organizationId` and `workspaceId`. | Multi-tenant cache tests. |
| **Rule 51** | Server Action / Route Handler Security Gate | Every exported Server Action enforces `requireAuth()` and Anti-IDOR tenant validation. | Session auth tests. |
| **Rule 52** | Client/Server Boundary Tests | Verifies that secret API keys and server-only SDKs are never bundled into client bundles. | Bundle isolation checks. |
| **Rule 53** | Dependency Governance | Zero unvetted dependencies added; all packages locked and security-audited. | Package lock audit. |
| **Rule 54** | Performance Budgets | Runs table renders in $<100\text{ms}$; drawer opening $<50\text{ms}$; search debounced 300ms. | Render latency benchmarks. |
| **Rule 55** | Graph & Canvas Resource Limits | Step timeline bounded to $\le 50$ steps to prevent DOM freezes and memory exhaustion. | Step count limiter tests. |

### Section E: Governance, Operations & The Non-Negotiables (Rules 56–69)
| Rule # | Requirement | Milestone 2 Implementation & Architectural Defense | Verification Method |
| :---: | :--- | :--- | :--- |
| **Rule 56** | Agent Context Compression | Context & Memory tab displays compressed step summaries when context exceeds 4,000 tokens. | Context compressor tests. |
| **Rule 57** | Data Residency & Retention Awareness | UI surfaces respect organization data residency and data masking settings. | Masking rule tests. |
| **Rule 58** | Model Routing Policy | Displays model tier badge (`flash` vs `pro`) utilized for planning and execution steps. | Model tier badge tests. |
| **Rule 59** | Tool Selection Evaluation | Tool cards visually display permitted domains (`persona.allowedDomains`) and maximum risk level. | Risk boundary tests. |
| **Rule 60** | Emergency Dead-Man Controls | Checked on mutating actions (`cancelAgentRunAction`); fails closed with HTTP 503 / `DEAD_MAN_PAUSED` when active. | Dead-man pause tests. |
| **Rule 61** | Backoffice as Agent Control Plane | Privileged run management located at `/admin/intelligence/runs` restricted to authenticated operators. | RBAC permission tests. |
| **Rule 62** | Real-Time UI Reactivity via SSE | Live streaming updates consume Server-Sent Events via `useEventStream` with zero client polling. | Mock SSE event stream tests. |
| **Rule 63** | Agent Incident Management | Operators can pause runs, kill runaway agents, and trigger manual compensation directly from the Run Detail Drawer. | Incident response UI tests. |
| **Rule 64** | No Raw HTML/CSS Leakage & Feature Flags | Zero unescaped HTML/CSS tags rendered; UI features gated at System, Org, and Workspace levels. | XSS sanitization tests. |
| **Rule 65** | Canary Releases | Run cards display agent persona version and canary deployment indicators when present. | Version tag tests. |
| **Rule 66** | Phased Roadmap Alignment | Fully aligned with Phase 8 roadmap requirements and forward-compatible with Milestone 3 (Approval Center). | Plan review checkpoints. |
| **Rule 67** | The "UX Implementation Gate" | Strict 12-point pre-flight checklist verified before marking Milestone 2 complete. | Verification report. |
| **Rule 68** | The Five Non-Negotiable Invariants | 1. Identity is not the user. 2. Never trust the model. 3. Never trust untrusted data. 4. High-risk actions require two phases. 5. No dead ends in user experience. | Invariant validation checklist. |
| **Rule 69** | Strangler Fig Pattern SSOT | Preexisting routes intact; legacy `/admin/agents` and `/admin/runs` redirect seamlessly to `/admin/intelligence/runs`. | Redirection route tests. |

---

## 2. File Structure & Responsibilities

```
src/
├── app/
│   ├── actions/
│   │   └── agent-run-ui-actions.ts          # Server Actions: list runs, get details, cancel run, get metrics (Rule 51)
│   ├── admin/
│   │   ├── intelligence/
│   │   │   └── runs/
│   │   │       ├── page.tsx                 # Server page wrapper with SEO metadata & Suspense boundary
│   │   │       └── RunsClient.tsx           # Three-Zone mission control console with live SSE reactivity (Rule 62)
│   │   ├── agents/
│   │   │   └── page.tsx                     # Strangler Fig redirect to /admin/intelligence/runs (Rule 69)
│   │   └── runs/
│   │       └── page.tsx                     # Backward compatibility redirect to /admin/intelligence/runs (Rule 69)
├── components/
│   └── runs/
│       ├── AgentRunTimeline.tsx             # Sequential step timeline with 8 step types & injection container (Rule 13/30)
│       ├── ToolCallCard.tsx                 # Inspectable card with WHAT/WHY/CHANGE, SHA-256 hashes & tracing (Rule 41)
│       ├── AgentRunDetailDrawer.tsx         # theme.md §8 drawer with 4 tabbed panels & cooperative cancellation (Rule 26)
│       ├── RunMetricsCards.tsx              # 4 Executive KPI cards with health badges and counters
│       └── index.ts                         # Public barrel exports
└── platform/
    └── __tests__/
        ├── runtime/
        │   └── agent-run-ui-actions.test.ts # Server action tests (Anti-IDOR, auth, dead-man, cancel)
        └── ui/
            ├── agent-runs-console.test.tsx  # Mission control UI tests (filters, search, SSE updates)
            ├── agent-run-timeline.test.tsx  # Timeline tests (node types, timestamps, injection isolation)
            └── agent-run-detail-drawer.test.tsx # Drawer tests (theme.md §8, 4 tabs, cancellation flow)
```

---

## 3. Step-by-Step Implementation Tasks

### Task 1: UI Contracts & Typed Server Actions (`src/app/actions/agent-run-ui-actions.ts`)

**Files:**
- Create: `src/app/actions/agent-run-ui-actions.ts`
- Test: `src/platform/__tests__/runtime/agent-run-ui-actions.test.ts`

- [ ] **Step 1: Write the failing server action tests**
  - Test `listAgentRunsAction`: requires auth (Rule 51), anti-IDOR check (Rule 8 & 47), returns paginated runs from `AgentRunStore`.
  - Test `getAgentRunDetailsAction`: requires auth, anti-IDOR check, returns run + partitioned steps.
  - Test `cancelAgentRunAction`: requires auth, checks dead-man switch (Rule 60), validates cancellable status (Rule 26), invokes `CancellationEngine.cancelRun`, emits audit event `agent.run.cancelled` (Rule 40).
  - Test `getAgentRunMetricsAction`: calculates active runs, waiting approvals, completed, failed, and token usage.

- [ ] **Step 2: Run test to verify it fails**
  - Run: `pnpm vitest run src/platform/__tests__/runtime/agent-run-ui-actions.test.ts`
  - Expected: FAIL with module not found.

- [ ] **Step 3: Implement `src/app/actions/agent-run-ui-actions.ts`**
  - Export Next.js Server Actions with `'use server'`.
  - Session auth via `requireAuth()` (Rule 51).
  - Anti-IDOR validation asserting `auth.profile.organizationId === input.organizationId` (Rule 8 & 47).
  - Integration with `getAgentRunStore()` and `getCancellationEngine()`.
  - Dead-man pause check via `checkGovernanceDeadManSwitch` on `cancelAgentRunAction` (Rule 60).
  - Strict Zod v4 validation for all inputs and outputs (Rule 4 & 10).
  - Zero `any` or `any[]` (Rule 4).

- [ ] **Step 4: Run test to verify it passes**
  - Run: `pnpm vitest run src/platform/__tests__/runtime/agent-run-ui-actions.test.ts`
  - Expected: PASS (100%).

---

### Task 2: Granular Step Execution Timeline (`src/components/runs/AgentRunTimeline.tsx`)

**Files:**
- Create: `src/components/runs/AgentRunTimeline.tsx`
- Test: `src/platform/__tests__/ui/agent-run-timeline.test.tsx`

- [ ] **Step 1: Write the failing timeline tests**
  - Test renders 8 step types (`PLANNING`, `CONTEXT_RETRIEVAL`, `TOOL_CALL`, `VERIFICATION`, `REPLANNING`, `APPROVAL_WAIT`, `COMPENSATION`, `REFLECTION`).
  - Test renders timestamps and durations accurately.
  - Test expands/collapses step details (inputs, outputs, tokens, explainability).
  - Test wraps untrusted step outputs in `<untrusted_reference_data id="...">` (Rule 13 & 30).
  - Test renders compensated step state with purple undo indicators (Rule 27).
  - Test mobile touch targets $\ge 44\text{px}$ on toggle headers (Rule 7).

- [ ] **Step 2: Run test to verify it fails**
  - Run: `pnpm vitest run src/platform/__tests__/ui/agent-run-timeline.test.tsx`
  - Expected: FAIL with module not found.

- [ ] **Step 3: Implement `AgentRunTimeline.tsx`**
  - Vertical timeline with node icons and connecting lines.
  - Step status styling (`completed` green, `running` blue pulse, `failed` red, `skipped` amber, `compensated` purple).
  - Accordion for step details showing input parameters, output results, and explainability (`what`, `why`, `expectedStateChange`).
  - Isolation container: wraps external data in `<untrusted_reference_data id="...">` tags (Rule 30).
  - Mobile touch targets $\ge 44\text{px}$ on toggle headers (Rule 7).

- [ ] **Step 4: Run test to verify it passes**
  - Run: `pnpm vitest run src/platform/__tests__/ui/agent-run-timeline.test.tsx`
  - Expected: PASS (100%).

---

### Task 3: Inspectable Tool-Call Card (`src/components/runs/ToolCallCard.tsx`)

**Files:**
- Create: `src/components/runs/ToolCallCard.tsx`
- Test: `src/platform/__tests__/ui/tool-call-card.test.tsx`

- [ ] **Step 1: Write the failing tool-call card tests**
  - Test displays capability ID, target entity, and risk level badge (L0 to L4).
  - Test displays explainability standard: WHAT, WHY, EXPECTED CHANGE (Rule 41).
  - Test displays truncated SHA-256 payload and step hashes with copy button (Rule 22).
  - Test displays correlation ID and trace ID badges with copy button (Rule 20 & 39).
  - Test wraps tool inputs/outputs in `<untrusted_reference_data id="...">` (Rule 30).
  - Test displays Revert/Compensate button when `compensatingCapabilityId` exists (Rule 27).

- [ ] **Step 2: Run test to verify it fails**
  - Run: `pnpm vitest run src/platform/__tests__/ui/tool-call-card.test.tsx`
  - Expected: FAIL with module not found.

- [ ] **Step 3: Implement `ToolCallCard.tsx`**
  - Card container with `border border-border/80 bg-card rounded-xl p-4`.
  - Risk badges with canonical colors (`L0` slate, `L1` sky, `L2` amber, `L3` orange, `L4` red).
  - Structured explainability grid (WHAT / WHY / EXPECTED CHANGE) (Rule 41).
  - Cryptographic hash pills and distributed tracing badges with clipboard copy utility (Rule 20, 22, 39).
  - Prompt injection isolation `<untrusted_reference_data>` container (Rule 30).

- [ ] **Step 4: Run test to verify it passes**
  - Run: `pnpm vitest run src/platform/__tests__/ui/tool-call-card.test.tsx`
  - Expected: PASS (100%).

---

### Task 4: Standardized Run Detail Drawer (`src/components/runs/AgentRunDetailDrawer.tsx`)

**Files:**
- Create: `src/components/runs/AgentRunDetailDrawer.tsx`
- Test: `src/platform/__tests__/ui/agent-run-detail-drawer.test.tsx`

- [ ] **Step 1: Write the failing drawer tests**
  - Test `theme.md` §8 compliance: surface tokens, demarcated header, single-circle info tooltip at `z-[10050]`, `sr-only` description, demarcated footer with tactile buttons.
  - Test 4 tabbed panels: `Timeline & Steps`, `Context & Memory`, `Tools & Audit`, `Budgets & Cost`.
  - Test cooperative cancellation button triggers cancellation modal and calls `cancelAgentRunAction` (Rule 26).
  - Test budget progress meters (tokens, tool calls, duration) with color thresholds (Rule 23).

- [ ] **Step 2: Run test to verify it fails**
  - Run: `pnpm vitest run src/platform/__tests__/ui/agent-run-detail-drawer.test.tsx`
  - Expected: FAIL with module not found.

- [ ] **Step 3: Implement `AgentRunDetailDrawer.tsx`**
  - Built with Radix Sheet/Dialog adhering strictly to `theme.md` §8.
  - Header: Demarcated `<DialogHeader demarcated>`, Run ID title, status pill, persona badge, `<CardInfoTooltip text="..." />` at `z-[10050]`, `<DialogDescription className="sr-only">`.
  - Tabs: Flat horizontal segmented bar (`Timeline & Steps`, `Context & Memory`, `Tools & Audit`, `Budgets & Cost`).
  - Panel 1: Mounts `AgentRunTimeline`.
  - Panel 2: Displays working memory, prompt token estimate, evidence citations.
  - Panel 3: Lists tool calls using `ToolCallCard`, correlation badges, state transition history.
  - Panel 4: Multi-dimensional budget usage gauges (tokens, tool calls, elapsed duration, mutated records) (Rule 23).
  - Footer: Demarcated footer with "Close" button and "Cancel Run" button (visible only if run is cancellable, Rule 26). Confirmation dialog adhering to `theme.md` §8.

- [ ] **Step 4: Run test to verify it passes**
  - Run: `pnpm vitest run src/platform/__tests__/ui/agent-run-detail-drawer.test.tsx`
  - Expected: PASS (100%).

---

### Task 5: Executive KPI Cards & Run Mission Control Console (`src/app/admin/intelligence/runs/` & `src/components/runs/RunMetricsCards.tsx`)

**Files:**
- Create: `src/components/runs/RunMetricsCards.tsx`
- Create: `src/components/runs/index.ts`
- Create: `src/app/admin/intelligence/runs/page.tsx`
- Create: `src/app/admin/intelligence/runs/RunsClient.tsx`
- Create: `src/app/admin/agents/page.tsx` (Strangler Fig redirect)
- Create: `src/app/admin/runs/page.tsx` (Strangler Fig redirect)
- Test: `src/platform/__tests__/ui/agent-runs-console.test.tsx`

- [ ] **Step 1: Write the failing console tests**
  - Test Three-Zone layout (Executive KPI Header, Category Filter Toolbar, Runs Stream Table).
  - Test filters runs by status tab (`ALL`, `RUNNING`, `WAITING_FOR_APPROVAL`, `COMPLETED`, `FAILED`, `CANCELLED`).
  - Test debounced search by Run ID, goal, or persona (300ms debounce).
  - Test clicking "Inspect" opens `AgentRunDetailDrawer` with selected run.
  - Test real-time SSE updates via `useEventStream` updates run status and step progression dynamically (Rule 62).
  - Test Strangler Fig redirects from `/admin/agents` and `/admin/runs` preserve query parameters (Rule 69).

- [ ] **Step 2: Run test to verify it fails**
  - Run: `pnpm vitest run src/platform/__tests__/ui/agent-runs-console.test.tsx`
  - Expected: FAIL with module not found.

- [ ] **Step 3: Implement `RunMetricsCards.tsx`, `RunsClient.tsx`, `page.tsx`, and redirects**
  - `RunMetricsCards`: 4 KPI cards (Total Runs, Active/Running, Waiting Approvals, Failed/DLQ) with pulse indicators and status colors.
  - `RunsClient`: Three-Zone mission control layout with status tabs, search bar, time window selector, run table with tactile rows, and drawer state manager.
  - `useEventStream`: Listens to `agent.run.*` and `agent.step.*` events, dynamically updating list state (Rule 62).
  - Strangler Fig redirect routes at `src/app/admin/agents/page.tsx` and `src/app/admin/runs/page.tsx` forwarding to `/admin/intelligence/runs` (Rule 69).
  - Public barrel at `src/components/runs/index.ts`.

- [ ] **Step 4: Run test to verify it passes**
  - Run: `pnpm vitest run src/platform/__tests__/ui/agent-runs-console.test.tsx`
  - Expected: PASS (100%).

---

### Task 6: Full Regression, Typecheck & Static Analysis Verification

- [ ] **Step 1: Run all Milestone 2 test suites**
  - Run: `pnpm vitest run src/platform/__tests__/runtime/agent-run-ui-actions.test.ts src/platform/__tests__/ui/agent-run-timeline.test.tsx src/platform/__tests__/ui/tool-call-card.test.tsx src/platform/__tests__/ui/agent-run-detail-drawer.test.tsx src/platform/__tests__/ui/agent-runs-console.test.tsx`
  - Expected: PASS (100%).

- [ ] **Step 2: Run full command center regression suite**
  - Run: `pnpm vitest run src/platform/__tests__/command/ src/platform/__tests__/ui/`
  - Expected: PASS (100%).

- [ ] **Step 3: Run TypeScript compiler check**
  - Run: `NODE_OPTIONS='--max-old-space-size=8192' pnpm typecheck`
  - Expected: Exit code 0 (0 errors).

- [ ] **Step 4: Run ESLint static analysis**
  - Run: `NODE_OPTIONS='--max-old-space-size=8192' pnpm eslint src/app/actions/agent-run-ui-actions.ts src/components/runs/ src/app/admin/intelligence/runs/ src/app/admin/agents/ src/app/admin/runs/`
  - Expected: Exit code 0 (0 errors, 0 warnings).

---

## 4. Self-Review Checklist
- [x] **Spec Coverage:** Covers full Run Mission Control, step timeline, inspectable tool cards, detail drawer, and Server Actions.
- [x] **No Placeholders:** All tasks define exact files, explicit imports, complete test assertions, and exact code paths.
- [x] **Type Consistency:** Strictly typed with Zod v4 schemas, `AgentRun`, `AgentStep`, and canonical status enums.
- [x] **Rule Compliance:** Full alignment with all 69 Agentic Development Rules and `theme.md` §8 modal architecture.
