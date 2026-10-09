# Tasks Phase 5: Integration Hardening, Cross-Module Standards & Downstream Synchronization Plan

> **Governance Notice:** Conforms strictly to `docs/agents_mcp/agents_mcp_rules.md`, `.agents/AGENTS.md`, `theme.md` (Section 8 Modal Architecture), and `docs/tasks/tasks_roadmap_ui.md` (§76, §77, §78).
> **Execution Status:** AWAITING PLAN APPROVAL. Do NOT begin execution until explicitly approved by the user.

---

## Executive Summary & Strategic Objective

Phase 5 represents the cross-module harmonization and enterprise resilience milestone for the SmartSapp Tasks system. While Phases 1–4 established the core UI primitives, kanban board, lists, detail drawers, standups, analytics, and AI assistance, Phase 5 guarantees that:
1. **Visual & Behavioral Consistency:** Every operational module in SmartSapp (Dashboard, CRM Entity Profiles, Deals Pipeline, Agreements/DocSigning, Automation) displays and interacts with tasks through a single, canonical `<CompactTaskCard>` component (conforming to Roadmap §77), eliminating fragmented ad-hoc implementations.
2. **Resilient Downstream Contract Synchronization:** When tasks bound to contractual obligations (e.g. DocSigning agreements) are resolved, reverse hook status transitions are tracked explicitly (`obligationSyncStatus: 'synced' | 'failed' | 'pending'`) rather than silently swallowed, supporting resilient retry mechanisms and zero data loss (conforming to Roadmap §78).
3. **Enterprise Agentic Compliance:** Fully enforces the 10 Foundation Rules and Agentic/MCP Rules (Rules 11–20, 40, 47, 69) including strict typing (zero `any`), server-side risk classification, TOCTOU concurrency guards, idempotency keys, mobile touch targets ($\ge 44\text{px}$), and zero unvalidated `unknown` at trust boundaries.

---

## Comprehensive Agents & MCP Rules Compliance Mapping

### 1. Foundation Rules (Rules 1 – 10)

| Rule | Requirement | Phase 5 Implementation Specification |
|---|---|---|
| **Rule 1: Design Standards & UI Consistency** | Next.js 15, React 19, `emilkowal-animations`, `frontend-design`, `backend-design`, `theme.md` §8. | `<CompactTaskCard>` uses standard atomic primitives (`TaskStatusBadge`, `TaskPriorityBadge`, `TaskDueDate`, `TaskAssignee`, `TaskRelationshipBadge`, `TaskSourceBadge`). All button interactions use `active:scale-[0.97]` tactile transitions ($< 250\text{ms}$). Modals/drawers follow Section 8 demarcated headers/footers with single-circle `CardInfoTooltip` (`z-[10050]`) and `sr-only` descriptions. |
| **Rule 2: Risk Analysis, Prevention & Scalability** | Proactive failure mode analysis, clean refactoring, test-driven validation, no origin pushes. | Detailed Risk Analysis & Mitigation Matrix below. All tasks executed with test-first methodology. Local commits only; strictly zero `git push`. |
| **Rule 3: Cross-Module Observability & Backoffice Governance** | Backoffice management without code changes; no broken downstream dependencies. | Downstream obligation sync failures are recorded in Firestore task documents and surfaced in backoffice audit feeds. Status tracking allows operations teams to inspect failed syncs and retry without touching code. |
| **Rule 4: Strict Typing Policy** | Zero `any` or `any[]`. No unchecked casts in domain code. Inferred/explicit types. Validate `unknown` at boundaries. | Absolute ban on `any` and `any[]`. External payloads from downstream sync services validated via Zod schemas at API boundary. All contracts and actions strictly typed. |
| **Rule 5: Deployment, Staging & Rule Safety** | Stage and verify rules/indexes before deployment. Never auto-deploy security-sensitive changes. | Firestore rules and queries for `tasks` and `obligations` verified with workspace isolation checks. No unvetted security rule modifications. |
| **Rule 6: Dependency & Documentation Standards** | No unvetted dependencies. Use official SDKs and latest documentation via Context7. | Uses established dependencies (`@/lib/types`, `date-fns`, `lucide-react`, `zod/v4`). Zero new external npm packages required. |
| **Rule 7: Mobile-First, Touch Targets & Everyday Plain UI English** | Touch targets $\ge 44\text{px}$. Gesture/viewport support. Minimal, plain everyday UI English. No verbose walls of text. | All interactive click targets (completion checkbox, card link, sync retry button) enforce `min-h-[44px]` and `min-w-[44px]`. Copy strictly uses concise, plain English: *"Task completed"*, *"Contract obligation could not be synchronized"*, *"[ Retry synchronization ]"*. |
| **Rule 8: Security, Anti-IDOR & Zero Trust** | Workspace confinement, tenant isolation, anti-IDOR checks, safe relative navigation. | All actions validate `workspaceId` against authenticated session before reading/mutating. Actionable toast paths strictly relative beginning with `/` (e.g. `/admin/finance/agreements`). |
| **Rule 9: Concurrency, Load & Resource Protection** | Avoid batch overload, resource exhaustion, or unbounded queries. | Queries in `TaskWidget` enforce `limit(10)`. Entity and deal task queries scoped strictly by workspace and parent IDs with indexes. Bulk operations chunked in batches $\le 500$. |
| **Rule 10: Inline Architectural Guidance** | Clear code comments explaining what changed, why, caution areas, and testability pointers. | Every new component, action, and contract includes structured `@fileOverview` and inline maintainer pointers explaining design decisions and safety boundaries. |

---

### 2. Protocol, Agentic & MCP Rules (Rules 11 – 20)

| Rule | Requirement | Phase 5 Implementation Specification |
|---|---|---|
| **Rule 11: MCP Protocol Compliance** | Target current supported MCP specification (`2026-07-28`), stateless execution, SDK v2 standards. | Capability contract `task-obligation-sync.contract.ts` adheres to stateless execution, standard schemas, and structured result types. |
| **Rule 12: Server-Side Risk Enforcement** | Risk classifications enforced server-side independently of client/MCP metadata hints. | Classified as `L2_STATE_MUTATION`. Explicit server-side permission checks (`operations:tasks:edit`, `contracts:obligations:edit`) enforced before executing reverse sync. |
| **Rule 13: Formal Trust Boundary Matrix** | Data entering agent/system has explicit trust classification. External data treated as untrusted. | See Trust Boundary Matrix below. Downstream agreement sync response parsed with Zod before updating task record. |
| **Rule 16: Agent Identity as Security Principal** | Security principal includes `organizationId`, `workspaceId`, `userId`, `actorType`, `agentId`. | Capability execution context records `principal.actorType` (`'user' | 'agent' | 'system'`) and tags task audit logs accordingly. |
| **Rule 18: TOCTOU Concurrency Protection** | Prevent time-of-check to time-of-use races using version/timestamp tokens. | `retryTaskObligationSyncAction` accepts `expectedUpdatedAt`. Mutation aborts safely with concurrency alert if task was modified concurrently. |
| **Rule 19: Mutating Action Idempotency** | Define idempotency keys and retry semantics for every mutation. | Re-executing `retryTaskObligationSyncAction` on an already-synced obligation returns cached success without duplicate side-effects. |
| **Rule 20: Replay & Duplicate Delivery Protection** | Unique execution identifiers (`executionId`, `idempotencyKey`). | Action execution generates a unique `executionId` for downstream synchronization calls to prevent double-fulfillment of contract terms. |

---

## Trust Boundary Matrix (Rule 13)

| Boundary Level | Data Source | Trust Classification | Validation & Handling Strategy |
|---|---|---|---|
| **Client UI Input** | User click / retry trigger | `USER TRUST` (Untrusted) | Validated server-side via session cookies, workspace membership check, and anti-IDOR verification. |
| **Task Core Engine** | Internal Firestore `tasks` collection | `SYSTEM TRUST` | Scoped to active workspace; validated via TypeScript `Task` interface and Firestore rules. |
| **Downstream Agreement Service** | `crm-deal-sync-service.ts` / DocSigning | `EXTERNAL / DOWNSTREAM DATA` | Treated as untrusted. Result wrapped in try/catch and validated against `ObligationSyncResultSchema`. |
| **Agent / MCP Tool Invocations** | AI Copilot / Automated flows | `AGENT TRUST` | Authority bounded by intersection: $\text{User Authority} \cap \text{Agent Authority} \cap \text{Workspace Policy}$. |

---

## Proactive Risk Analysis & Failure Modes Matrix (Rule 2 & Rule 3)

| Potential Failure Mode | Root Cause | Severity | Prevention & Mitigation Strategy |
|---|---|---|---|
| **Downstream Agreement API Failure** | Network timeout, contract locked, or obligation already resolved. | High | Instead of swallowing error in `catch`, catch block writes `obligationSyncStatus: 'failed'` and `obligationSyncError: message` to task document. UI renders non-blocking warning with `[ Retry synchronization ]`. |
| **TOCTOU Concurrency Collision** | User marks task done while another user or agent edits task details. | Medium | Enforce `expectedUpdatedAt` check in `task-core.ts`. If timestamps mismatch, abort with actionable toast allowing user to reload latest state. |
| **Ad-Hoc UI Regression in CRM / Deals** | Swapping custom markup with `<CompactTaskCard>` breaks entity linking or click behavior. | High | Component integration tests (`EntityTasksTab.test.tsx`, `DealTasksSection.test.tsx`) written and verified prior to refactoring. Preserve all existing props, parent IDs, and search parameters. |
| **Query Performance Degradation** | Multiple widgets streaming full task collections on dashboard load. | Medium | Enforce `limit(10)` on `TaskWidget` query; use indexed compound queries (`workspaceId`, `status != done`, `dueDate asc`). |
| **Unvalidated Data Injection** | External sync service returns arbitrary error payload. | Medium | Sanitize error strings before saving to Firestore. Never render raw HTML in UI; render through standard sanitized text elements. |
| **Touch Target Violation on Mobile** | Small retry icon or badge inaccessible to touch users on small screens. | Medium | Enforce `min-h-[44px]` and `min-w-[44px]` on all interactive elements in `<CompactTaskCard>`, with clear visual focus rings. |

---

## File Structure & Impact Surface

```text
src/
├── lib/
│   ├── types.ts                                                    [Modify: Add obligation sync properties]
│   ├── task-server-actions.ts                                      [Modify: Add retryTaskObligationSyncAction & status handling]
│   ├── tasks/
│   │   └── task-core.ts                                            [Modify: Persist obligationSyncStatus on reverse hook]
│   └── __tests__/
│       └── task-obligation-sync-actions.test.ts                    [Create: Server action & reverse hook failure/retry tests]
├── platform/
│   └── domains/
│       └── tasks_productivity/
│           └── contracts/
│               ├── task-obligation-sync.contract.ts                [Create: Capability contract with Rules 11, 12, 18, 19]
│               └── __tests__/
│                   └── task-obligation-sync-contract.test.ts       [Create: Capability contract unit tests]
├── app/
│   └── admin/
│       ├── tasks/
│       │   └── components/
│       │       ├── CompactTaskCard.tsx                             [Create: Canonical cross-module task card (§77)]
│       │       ├── TaskDetailDrawer.tsx                            [Modify: Add sync failure banner & retry action (§78)]
│       │       ├── TaskListRow.tsx                                 [Modify: Add sync failure alert badge]
│       │       └── __tests__/
│       │           ├── CompactTaskCard.test.tsx                    [Create: Unit tests for card rendering & interactions]
│       │           └── TaskDetailDrawer-sync-failure.test.tsx      [Create: Integration tests for sync failure recovery]
│       ├── entities/
│       │   ├── [id]/
│       │   │   └── page.tsx                                        [Modify: Refactor Tasks tab to use CompactTaskCard]
│       │   └── __tests__/
│       │       └── EntityTasksTab.test.tsx                         [Create: Entity detail tasks tab integration tests]
│       └── deals/
│           ├── [id]/
│           │   └── page.tsx                                        [Modify: Refactor Upcoming Tasks section to use CompactTaskCard]
│           └── __tests__/
│               └── DealTasksSection.test.tsx                       [Create: Deal detail tasks section integration tests]
└── components/
    └── dashboard/
        ├── TaskWidget.tsx                                          [Modify: Standardize with CompactTaskCard & query limits]
        └── __tests__/
            └── TaskWidget-compact.test.tsx                         [Create: Dashboard widget integration tests]
```

---

## Detailed Bite-Sized Implementation Tasks

### Task 1: Domain Types & Obligation Sync Capability Contract
*Enforces Rule 4 (Strict Typing), Rule 11 (MCP Protocol), Rule 12 (Server-Side Risk L2), Rule 18 (TOCTOU), and Rule 47 (Workspace Confinement).*

**Files:**
- Modify: `src/lib/types.ts`
- Create: `src/platform/domains/tasks_productivity/contracts/task-obligation-sync.contract.ts`
- Create: `src/platform/domains/tasks_productivity/contracts/__tests__/task-obligation-sync-contract.test.ts`

- [ ] **Step 1: Write failing tests for `task-obligation-sync.contract.ts`**
  Assert input validation (`workspaceId`, `taskId`, optional `expectedUpdatedAt`, optional `idempotencyKey`).
  Assert output schema (`taskId`, `contractId`, `obligationId`, `status: 'synced' | 'failed'`, `syncedAt`).
  Assert risk policy: `level: 'L2_STATE_MUTATION'`, `workspaceScoped: true`, `auditRequired: true`.
- [ ] **Step 2: Run test to verify failure**
  Run: `pnpm test:run src/platform/domains/tasks_productivity/contracts/__tests__/task-obligation-sync-contract.test.ts`
  Expected: FAIL (module not found).
- [ ] **Step 3: Update `src/lib/types.ts`**
  Add explicit fields to `Task` interface:
  ```ts
  obligationSyncStatus?: 'synced' | 'failed' | 'pending';
  obligationSyncError?: string;
  obligationSyncAt?: string;
  ```
  Ensure zero `any` or `any[]`.
- [ ] **Step 4: Implement `task-obligation-sync.contract.ts`**
  Implement capability contract adhering to the project's standard `CapabilityDefinition` pattern. Wire input/output schemas with Zod, bind permissions (`['operations:tasks:edit', 'contracts:obligations:edit']`), and implement handler with principal audit logging.
- [ ] **Step 5: Run tests to verify pass**
  Run: `pnpm test:run src/platform/domains/tasks_productivity/contracts/__tests__/task-obligation-sync-contract.test.ts`
  Expected: PASS.
- [ ] **Step 6: Commit**
  Git commit: `feat(tasks): define obligation sync types and capability contract`

---

### Task 2: Reverse Hook Status Persistence & Idempotent Retry Action
*Enforces Rule 2 (Failure Handling), Rule 8 (Security & Anti-IDOR), Rule 18 (TOCTOU), Rule 19 (Idempotency), and Rule 20 (Replay Protection).*

**Files:**
- Modify: `src/lib/tasks/task-core.ts`
- Modify: `src/lib/task-server-actions.ts`
- Create: `src/lib/__tests__/task-obligation-sync-actions.test.ts`

- [ ] **Step 1: Write failing tests in `task-obligation-sync-actions.test.ts`**
  - Test 1: When `syncTaskCompletionToObligation` fails, task record persists `obligationSyncStatus: 'failed'` and the error message without crashing.
  - Test 2: When `syncTaskCompletionToObligation` succeeds, task record persists `obligationSyncStatus: 'synced'` and `obligationSyncAt`.
  - Test 3: `retryTaskObligationSyncAction` validates workspace authorization, checks `expectedUpdatedAt` for TOCTOU concurrency, performs sync, and transitions status to `'synced'`.
  - Test 4: `retryTaskObligationSyncAction` is idempotent: calling it on already-synced task returns success without redundant sync calls.
- [ ] **Step 2: Run test to verify failure**
  Run: `pnpm test:run src/lib/__tests__/task-obligation-sync-actions.test.ts`
  Expected: FAIL.
- [ ] **Step 3: Implement reverse hook status persistence in `task-core.ts`**
  In `updateTaskCore` reverse hook block:
  - If sync succeeds: write `{ obligationSyncStatus: 'synced', obligationSyncAt: new Date().toISOString(), obligationSyncError: null }`.
  - If sync throws: write `{ obligationSyncStatus: 'failed', obligationSyncError: err.message || 'Downstream sync failed' }`.
  - Mirror behavior in `bulkUpdateTasksAction` in `src/lib/task-server-actions.ts`.
- [ ] **Step 4: Implement `retryTaskObligationSyncAction` in `task-server-actions.ts`**
  - Authenticate session user and verify workspace access.
  - Fetch task document, verify presence of `relatedParentId` (contractId) and `relatedEntityId` (obligationId).
  - Verify `expectedUpdatedAt` if provided (TOCTOU guard).
  - If already `'synced'`, return `{ success: true, alreadySynced: true }`.
  - Execute `syncTaskCompletionToObligation`, record outcome, and return strictly typed `TaskResult`.
- [ ] **Step 5: Run tests to verify pass**
  Run: `pnpm test:run src/lib/__tests__/task-obligation-sync-actions.test.ts`
  Expected: PASS.
- [ ] **Step 6: Commit**
  Git commit: `feat(tasks): implement obligation sync status tracking and idempotent retry server action`

---

### Task 3: Universal Canonical `<CompactTaskCard>` Component
*Enforces Rule 1 (Design System), Rule 4 (Strict Typing), Rule 7 (Mobile Touch Targets $\ge 44\text{px}$ & Plain UI English), and Roadmap §77.*

**Files:**
- Create: `src/app/admin/tasks/components/CompactTaskCard.tsx`
- Create: `src/app/admin/tasks/components/__tests__/CompactTaskCard.test.tsx`

- [ ] **Step 1: Write failing tests for `CompactTaskCard`**
  - Test 1: Renders task title, status badge, priority badge, due date, assignee, and relationship/source badges.
  - Test 2: Completion toggle button has `min-h-[44px]` and `min-w-[44px]` touch target with accessible `aria-label`.
  - Test 3: Card click target triggers `onClick` with keyboard accessibility (`Enter` and `Space` key handlers).
  - Test 4: Renders inline failure badge with warning icon and retry trigger when `task.obligationSyncStatus === 'failed'`.
  - Test 5: Tactile micro-interactions: verifies `active:scale-[0.97]` styling.
- [ ] **Step 2: Run test to verify failure**
  Run: `pnpm test:run src/app/admin/tasks/components/__tests__/CompactTaskCard.test.tsx`
  Expected: FAIL (module not found).
- [ ] **Step 3: Implement `CompactTaskCard.tsx`**
  Structure per Roadmap §77:
  ```text
  ┌─────────────────────────────────────────────────────────────┐
  │ [○] Task Title                                [Priority]   │
  │     Status · Due Date · Assignee              [Source]     │
  │     [Relationship Badge]                                  │
  │     ⚠ Contract obligation sync failed. [ Retry ]           │
  └─────────────────────────────────────────────────────────────┘
  ```
  - Leverage atomic primitives from Phase 1 (`TaskStatusBadge`, `TaskPriorityBadge`, `TaskDueDate`, `TaskAssignee`, `TaskRelationshipBadge`, `TaskSourceBadge`).
  - Strict typing: zero `any`.
  - Concise everyday English copy.
  - Mobile touch targets $\ge 44\text{px}$.
- [ ] **Step 4: Run tests to verify pass**
  Run: `pnpm test:run src/app/admin/tasks/components/__tests__/CompactTaskCard.test.tsx`
  Expected: PASS.
- [ ] **Step 5: Commit**
  Git commit: `feat(tasks): create universal CompactTaskCard component adhering to cross-module standards`

---

### Task 4: Cross-Module Integration — Dashboard Task Widget
*Enforces Rule 2 (Preservation), Rule 7 (Responsive UX), Rule 8 (Security), and Rule 9 (Query Limits).*

**Files:**
- Modify: `src/components/dashboard/TaskWidget.tsx`
- Create: `src/components/dashboard/__tests__/TaskWidget-compact.test.tsx`

- [ ] **Step 1: Write failing test in `TaskWidget-compact.test.tsx`**
  - Verify `TaskWidget` renders tasks using `<CompactTaskCard>`.
  - Verify complete action marks task resolved and displays actionable toast.
  - Verify empty state displays *"All Missions Resolved"* illustration when task list is empty.
  - Verify *"Command Hub"* CTA routes to `/admin/tasks`.
  - Verify query applies `limit(10)` to protect database performance (Rule 9).
- [ ] **Step 2: Run test to verify failure**
  Run: `pnpm test:run src/components/dashboard/__tests__/TaskWidget-compact.test.tsx`
  Expected: FAIL.
- [ ] **Step 3: Refactor `TaskWidget.tsx`**
  - Replace ad-hoc card markup with `<CompactTaskCard>`.
  - Update query limit from 5 to 10 for balanced density.
  - Pass `onToggleComplete` and handle mutation feedback with optimistic update and actionable toasts.
  - Ensure zero `any` or unchecked casts.
- [ ] **Step 4: Run tests to verify pass**
  Run: `pnpm test:run src/components/dashboard/__tests__/TaskWidget-compact.test.tsx`
  Expected: PASS.
- [ ] **Step 5: Commit**
  Git commit: `refactor(dashboard): standardize TaskWidget with universal CompactTaskCard`

---

### Task 5: Cross-Module Integration — CRM Entity Detail Tasks Tab
*Enforces Rule 1 (Design Standards), Rule 2 (Preservation), Rule 7 (Mobile UX), and Roadmap §76.*

**Files:**
- Modify: `src/app/admin/entities/[id]/page.tsx`
- Create: `src/app/admin/entities/__tests__/EntityTasksTab.test.tsx`

- [ ] **Step 1: Write failing test in `EntityTasksTab.test.tsx`**
  - Verify Tasks tab renders pending actions using `<CompactTaskCard>`.
  - Verify clicking card opens `TaskDetailDrawer` with selected task.
  - Verify toggling complete triggers task status mutation.
  - Verify `Create Task` button opens task editor modal.
  - Verify empty state renders clean informative messaging with entity terminology.
- [ ] **Step 2: Run test to verify failure**
  Run: `pnpm test:run src/app/admin/entities/__tests__/EntityTasksTab.test.tsx`
  Expected: FAIL.
- [ ] **Step 3: Refactor Tasks tab in `src/app/admin/entities/[id]/page.tsx`**
  - Replace custom card markup with `<CompactTaskCard>`.
  - Wire `onClick` on `<CompactTaskCard>` to open `TaskDetailDrawer`.
  - Embed `TaskDetailDrawer` for seamless in-page inspection without navigating away.
  - Preserve PDF dossier generation and existing entity context.
- [ ] **Step 4: Run tests to verify pass**
  Run: `pnpm test:run src/app/admin/entities/__tests__/EntityTasksTab.test.tsx`
  Expected: PASS.
- [ ] **Step 5: Commit**
  Git commit: `refactor(entities): standardize CRM entity tasks tab with CompactTaskCard and detail drawer`

---

### Task 6: Cross-Module Integration — Deals Detail Upcoming Tasks Section
*Enforces Rule 1 (Design Standards), Rule 2 (Preservation), Rule 7 (Touch Targets), and Roadmap §76.*

**Files:**
- Modify: `src/app/admin/deals/[id]/page.tsx`
- Create: `src/app/admin/deals/__tests__/DealTasksSection.test.tsx`

- [ ] **Step 1: Write failing test in `DealTasksSection.test.tsx`**
  - Verify Upcoming Tasks card in deal detail view renders tasks using `<CompactTaskCard>`.
  - Verify tasks are sorted with incomplete tasks first, ordered by due date urgency.
  - Verify clicking card opens `TaskDetailDrawer`.
  - Verify completion toggle updates deal task state.
- [ ] **Step 2: Run test to verify failure**
  Run: `pnpm test:run src/app/admin/deals/__tests__/DealTasksSection.test.tsx`
  Expected: FAIL.
- [ ] **Step 3: Refactor Upcoming Tasks section in `src/app/admin/deals/[id]/page.tsx`**
  - Replace ad-hoc card markup with `<CompactTaskCard>`.
  - Wire `TaskDetailDrawer` for full task metadata and checklist inspection.
  - Preserve `setIsCreateTaskOpen` modal workflow.
- [ ] **Step 4: Run tests to verify pass**
  Run: `pnpm test:run src/app/admin/deals/__tests__/DealTasksSection.test.tsx`
  Expected: PASS.
- [ ] **Step 5: Commit**
  Git commit: `refactor(deals): standardize deal upcoming tasks section with CompactTaskCard`

---

### Task 7: Downstream Sync Failure Recovery UX in Detail Drawer & List Row
*Enforces Rule 1 (Modal & Design System), Rule 3 (Observability), Rule 7 (Plain UI English), and Roadmap §78.*

**Files:**
- Modify: `src/app/admin/tasks/components/TaskDetailDrawer.tsx`
- Modify: `src/app/admin/tasks/components/TaskListRow.tsx`
- Create: `src/app/admin/tasks/components/__tests__/TaskDetailDrawer-sync-failure.test.tsx`

- [ ] **Step 1: Write failing tests in `TaskDetailDrawer-sync-failure.test.tsx`**
  - Test 1: When `task.obligationSyncStatus === 'pending'`, renders subtle badge *"Contract sync pending"*.
  - Test 2: When `task.obligationSyncStatus === 'failed'`, renders amber/rose warning banner:
    *"Contract obligation could not be synchronized."* with `[ Retry synchronization ]` button.
  - Test 3: Clicking `[ Retry synchronization ]` triggers `retryTaskObligationSyncAction`, shows loading spinner, and dispatches success toast with relative action link `/admin/finance/agreements`.
  - Test 4: In `TaskListRow.tsx`, failure icon/badge appears next to relationship tag when `obligationSyncStatus === 'failed'`.
- [ ] **Step 2: Run test to verify failure**
  Run: `pnpm test:run src/app/admin/tasks/components/__tests__/TaskDetailDrawer-sync-failure.test.tsx`
  Expected: FAIL.
- [ ] **Step 3: Implement recovery banner in `TaskDetailDrawer.tsx` & `TaskListRow.tsx`**
  - Add recovery alert block in `TaskDetailDrawer` below relationship badges.
  - Implement retry handler with pending spinner and toast navigation.
  - In `TaskListRow.tsx`, add warning tooltip on obligation status.
- [ ] **Step 4: Run tests to verify pass**
  Run: `pnpm test:run src/app/admin/tasks/components/__tests__/TaskDetailDrawer-sync-failure.test.tsx`
  Expected: PASS.
- [ ] **Step 5: Commit**
  Git commit: `feat(tasks): implement contract obligation sync failure alert and retry affordance`

---

### Task 8: End-to-End Quality Gates & Comprehensive System Verification
*Enforces Rule 1, 2, 4, 5, 7, 8, 9, 10, and Definition of Done.*

**Files:**
- All Phase 1 through Phase 5 files across Tasks, Standups, Analytics, Dashboard, Entities, Deals, and Contracts.

- [ ] **Step 1: Run complete Tasks and integration test suites**
  Execute all unit and integration suites covering Tasks, Standups, Analytics, Dashboard, Entities, Deals, and Contracts:
  ```bash
  pnpm test:run src/app/admin/tasks/ src/app/admin/standups/ src/app/admin/task-analytics/ src/components/dashboard/ src/platform/domains/tasks_productivity/
  ```
  Expected: 100% test pass rate across all files.
- [ ] **Step 2: Run Full TypeScript Verification**
  Execute strict typecheck across the repository:
  ```bash
  pnpm typecheck
  ```
  Expected: 0 errors in tasks and integration hubs.
- [ ] **Step 3: Run ESLint with 8GB Memory Allocation**
  Execute ESLint with memory flag:
  ```bash
  NODE_OPTIONS='--max-old-space-size=8192' pnpm eslint src/app/admin/tasks/ src/app/admin/standups/ src/app/admin/task-analytics/ src/components/dashboard/TaskWidget.tsx src/platform/domains/tasks_productivity/
  ```
  Expected: 0 errors, 0 warnings.
- [ ] **Step 4: Verify Zero `any` or `any[]` Invariant**
  Scan all newly authored and modified Phase 5 files:
  ```bash
  grep -rn "any\[\]" src/app/admin/tasks/components/CompactTaskCard.tsx src/platform/domains/tasks_productivity/contracts/task-obligation-sync.contract.ts src/lib/tasks/task-core.ts
  ```
  Expected: 0 matches.
- [ ] **Step 5: Architectural Review & Final Commit**
  Git commit: `feat(tasks): finalize Phase 5 integration hardening, cross-module standards, and downstream sync`

---

## Verification & Architecture Review Plan

1. **Automated CI/Verification Gates:**
   - 100% test pass rate across all test suites.
   - Zero TypeScript compiler diagnostics (`tsc --noEmit`).
   - Zero ESLint warnings or errors across all modified hubs.
   - Zero `any` or `any[]` occurrences in application/domain code.

2. **Architectural Review Checklist (for Senior Principal Systems & AI Agent Architect):**
   - [ ] **Visual Consistency (§77):** `<CompactTaskCard>` displays consistent hierarchy across Dashboard, CRM Entities, Deals, and Tasks command hub.
   - [ ] **Mobile Usability (Rule 7):** All click targets enforce $\ge 44\text{px}$ touch areas with `active:scale-[0.97]` tactile transitions.
   - [ ] **Downstream Resilience (§78):** Failed contract obligation sync transitions to `'failed'`, presents plain English banner, and provides idempotent one-click retry.
   - [ ] **Security & Anti-IDOR (Rule 8):** All server actions enforce workspace scoping and verify session user before mutating records.
   - [ ] **Toast Safety:** Actionable toasts strictly use relative paths starting with `/`.
   - [ ] **Preservation (Rule 2):** Zero regression of existing filters, search parameters, or real-time Firestore listeners.
