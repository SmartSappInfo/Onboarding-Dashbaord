# Phase 13 Milestone 5 Plan: Enterprise Organization Cockpit, Delegation Tree UI, Red-Team QA & Platform Graduation
## Fully Conforming to `agents_mcp_rules.md` (Rules 1–69, 1940–1953, 67–69), `theme.md` §8, and `.agents/AGENTS.md`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the executive Organization Mission Control Cockpit, interactive DAG/Delegation Tree UI, Graph Reasoning & Contagion Modal, AdminSidebar integration, and 6-vector adversarial security red-team battery, culminating in the final production release and platform graduation of Phase 13.

**Architecture:** A Three-Zone reactive operations cockpit (`OrganizationMissionControlClient`) conforming to Rule 61, powered by real-time SSE event streaming (`useEventStream`, Rule 62), tactile micro-interactions (`active:scale-[0.97]`, Rule 7), and standardized Radix dialogs adhering strictly to `theme.md` §8 (`border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`, demarcated header/footer, single-circle `<CardInfoTooltip text="..." />` at `z-[10050]`, zero raw description clutter). Multi-tenant anti-IDOR validation (Rules 8 & 47) and emergency fail-closed dead-man switches (Rule 60) are enforced across all operator actions.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind CSS, Lucide React, Radix UI Dialog & Tooltip primitives, Vitest, Testing Library React, Zod v4, Clerk Auth.

---

## 1. Executive Summary & Scope

Phase 13 Milestone 5 delivers the human-in-the-loop operational frontend and security graduation gate for the entire SmartSapp multi-agent workforce.

While Milestones 1–4 constructed the cryptographic, graph-topological, planning, and peer-to-peer transport engines, Milestone 5 makes the multi-agent organization visible, steerable, and verifiable by human operators:

1. **Standardized Modal System (`theme.md` §8):**
   - `SupervisorMissionModal.tsx`: High-level goal formulation with priority, duration, token cap, and Shadow Mode simulation toggles.
   - `DelegationTreeModal.tsx`: Visual tree representation of active supervisor delegation tokens, subagent statuses, and latency meters with depth badges ($\le 3$).
   - `GraphReasoningModal.tsx`: Interactive SVG visualization of influence paths and contagion clusters with clamped bounds ($\le 80$ nodes, $\le 150$ edges, depth $\le 2$, Rule 55).
2. **Three-Zone Organization Mission Control Cockpit (Rule 61 & 62):**
   - Zone 1: Executive Telemetry & Topology Status Grid.
   - Zone 2: Mission Command Deck & Topological DAG Execution HUD with Reverse-LIFO compensation rewind flow.
   - Zone 3: Swarm Mesh Topology, DLQ Reprocessing Desk, and Emergency Dead-Man Switch Panel.
   - Page route: `/admin/intelligence/organization` (`src/app/admin/intelligence/organization/page.tsx`).
3. **Admin Sidebar Navigation Unification (Rule 69 Strangler Invariant):**
   - Mount `/admin/intelligence/organization` under the `INTELLIGENCE` group in `AdminSidebar.tsx` with `Network` icon, preserving 100% of all 52 preexisting routes and permissions.
4. **Comprehensive Adversarial Security Red-Team QA Battery:**
   - 6 attack vectors: Confused deputy, delegation depth overflow ($> 3$), cross-tenant IDOR, prompt injection directive escalation, tampered SHA-256 delegation token signature rejection, and emergency dead-man kill switch.
5. **Platform Release & Senior Principal Architect Sign-Off:**
   - Full TypeScript compilation (`0 errors`), ESLint analysis (`0 errors`), full test battery, and platform graduation.

---

## 2. File Structure & Module Decomposition

```text
src/components/supervisor/
├── SupervisorMissionModal.tsx         # Goal formulation, budget parameters, and live mission launcher (theme.md §8)
├── DelegationTreeModal.tsx            # Visual tree representation of active supervisor delegation tokens & scopes
├── GraphReasoningModal.tsx            # Interactive SVG visualization of influence paths and contagion clusters (Rule 55)
└── index.ts                           # Unified component barrel

src/app/admin/intelligence/organization/
├── page.tsx                           # Next.js 15 Server Component with Clerk session auth
└── OrganizationMissionControlClient.tsx # Three-Zone Mission Control layout with live SSE streaming reactivity

src/app/admin/components/
└── AdminSidebar.tsx                   # Unification of Organization Swarm navigation item (Rule 69 Strangler Invariant)

src/platform/__tests__/ui/
├── supervisor-mission-modal.test.tsx  # Modal rendering, theme.md §8 layout, touch targets, and action dispatch
├── delegation-tree-modal.test.tsx     # Tree depth indicators, token revocation, and audit justification validation
├── graph-reasoning-modal.test.tsx     # Clamped SVG graph canvas, mode switches, and 4-part explainability
├── organization-mission-control.test.tsx # Three-Zone layout, SSE stream updates, and dead-man switch controls
└── admin-sidebar-organization.test.tsx # Strangler Fig preservation test verifying all 52 routes and permissions

src/platform/__tests__/agents/supervisor/
└── supervisor-adversarial-red-team.test.ts # 6-vector adversarial security battery (Confused Deputy, Depth Overflow, IDOR, etc.)
```

---

## 3. Implementation Tasks & Verification Gates

### Task 1: Supervisor Mission Modal & Launcher (`SupervisorMissionModal.tsx`)
- Formulate goal prompt with character count validation.
- Operational constraints selector (max duration, budget cap $\le 50,000$, priority level).
- Dry-Run / Shadow Mode toggle badge (Rule 42: "0 Live Mutations").
- Adherence to `theme.md` §8 (`<DialogHeader demarcated>`, `<CardInfoTooltip text="..." />` at `z-[10050]`, `<DialogDescription className="sr-only">`, demarcated footer, tactile buttons).
- Test: `src/platform/__tests__/ui/supervisor-mission-modal.test.tsx`.

### Task 2: Visual Delegation Tree & Scoped Authority Modal (`DelegationTreeModal.tsx`)
- Hierarchical tree visualization: Root Supervisor $\to$ Intermediate Domain Orchestrator $\to$ Specialist Subagent.
- Delegation depth indicators ($depth \le 3$, Rule 9).
- Scoped permissions pill list with non-delegable security lock badges (Rule 17).
- SHA-256 token signature badges with 1-click tactile copy feedback.
- Remaining TTL countdown badge.
- Interactive [Revoke Delegation Token] button prompting for mandatory $\ge 5$ character audit justification (Rule 61).
- Test: `src/platform/__tests__/ui/delegation-tree-modal.test.tsx`.

### Task 3: Interactive Graph Reasoning & Contagion Explorer Modal (`GraphReasoningModal.tsx`)
- Clamped interactive SVG graph visualizer enforcing Rule 55 bounds ($\le 80$ nodes, $\le 150$ edges, depth $\le 2$).
- Traversal bounding banner rendered: `"Showing most relevant 80 of N nodes · Bounded for performance"`.
- Mode switcher: `Influence Centrality`, `Risk Contagion`, `Causal Paths`.
- Rule 41 explainability drawer displaying structured 4-part grid (WHAT / WHY / IMPACT / RISK).
- XML isolation containerization `<untrusted_reference_data id="...">` (Rules 13 & 30).
- Test: `src/platform/__tests__/ui/graph-reasoning-modal.test.tsx`.

### Task 4: Three-Zone Organization Mission Control Cockpit (`OrganizationMissionControlClient.tsx` & Page)
- Zone 1: Executive Telemetry & Topology Status Grid (Active missions, Swarm Mesh health dot, active delegations, knapsack token usage).
- Zone 2: Mission Command Deck & Topological DAG Execution HUD with Reverse-LIFO compensation rewind flow and step inspector drawer.
- Zone 3: Swarm Mesh Topology, Dead-Letter Queue (DLQ) Reprocessing Desk with 1-click [Resubmit] action, and Emergency Dead-Man Switch Panel (Rule 60).
- Real-time reactivity via `useEventStream` subscribing to `supervisor.*`, `mesh.*`, and `delegation.*` (Rule 62).
- Route: `/admin/intelligence/organization` (`src/app/admin/intelligence/organization/page.tsx`).
- Public barrel: `src/components/supervisor/index.ts`.
- Test: `src/platform/__tests__/ui/organization-mission-control.test.tsx`.

### Task 5: Admin Sidebar Navigation Unification & Route Shims (Rule 69 Strangler Invariant)
- Mount `{ href: wrapHref('/admin/intelligence/organization'), icon: Network, label: 'Organization Swarm', visible: can('operations', 'intelligence', 'view') || isSystemAdmin }` under `intelligenceNavItems` in `AdminSidebar.tsx`.
- 100% preservation of all 52 preexisting routes and permissions.
- Test: `src/platform/__tests__/ui/admin-sidebar-organization.test.tsx`.

### Task 6: Comprehensive Adversarial Security Red-Team QA Battery
- Authored in `src/platform/__tests__/agents/supervisor/supervisor-adversarial-red-team.test.ts`.
- 6 attack vectors:
  1. Confused deputy privilege escalation via subagent delegation.
  2. Delegation depth overflow ($depth > 3$).
  3. Cross-tenant IDOR propagation between supervisor and subagents.
  4. Prompt injection directive escalation in subagent output during supervisor synthesis.
  5. Tampered SHA-256 delegation token signature rejection.
  6. Emergency dead-man kill switch (`supervisor_paused` / `checkGovernanceDeadManSwitch`) instant halting.

### Task 7: Full Platform Verification, Linting, Typecheck & Completion Gate
- Full Vitest test suites (`pnpm vitest run`).
- Full platform regression suite (`310+` test files, `2,400+` tests).
- Clean TypeScript static compilation (`pnpm typecheck`, 0 errors).
- Clean ESLint static analysis (`pnpm lint`, 0 errors, warnings <= 720 ceiling).
- Completion Report: `docs/agents_mcp/phases/agents_mcp_phase_13_milestone_5_completion_report.md`.
- Master Plan updated to 100% complete: `docs/agents_mcp/phases/agents_mcp_phase_13_master_plan.md`.

### Task 8: Senior Principal Architect Final Review & Platform Release Sign-Off
- Code review report: `docs/agents_mcp/phases/agents_mcp_phase_13_milestone_5_code_review.md`.
- Final platform graduation sign-off.
