# Tasks Phase 5: Integration Hardening, Cross-Module Standards & Downstream Synchronization
## Implementation Plan (Conforming to `agents_mcp_rules.md`, Institutional Theme Standards & Roadmap §75–78)

> **File Location:** `docs/superpowers/plans/2026-10-09-tasks-phase-5-integration-hardening-cross-module-and-downstream-sync.md`  
> **Status:** Pending User Approval  
> **Target Subsystems:** Cross-Module Tasks Presentation (`CompactTaskCard`), Dashboard `TaskWidget`, CRM Entity Tasks Tab (`entities/[id]`), Deals Upcoming Tasks (`deals/[id]`), Downstream Contract Obligation Reverse Hook (`crm-deal-sync-service`), Recovery UX in `TaskDetailDrawer` and `TaskListRow`.  
> **Applicable Rules:** SmartSapp Agentic Development Rules (MCP Edition — Rules 1 through 25 from `docs/agents_mcp/agents_mcp_rules.md`), `.agents/AGENTS.md`, and `theme.md` (Section 8 Modal Architecture).  
> **Reference Specs:** `docs/tasks/tasks_roadmap_ui.md` (§75–78, §80–92), `docs/tasks/tasks_ui_spec.md` (Phase 5), and `docs/tasks/tasks_prd.md` (§20, §21).  

---

> [!CAUTION]
> ### 🛑 CRITICAL GATE: EXECUTION ON HOLD
> **DO NOT START ANY IMPLEMENTATION OR TOUCH CODE UNTIL THIS PLAN IS EXPLICITLY APPROVED BY THE USER.**  
> In accordance with Rule 5 and Rule 19 of `agents_mcp_rules.md`, all implementation, code modification, or file scaffolding must wait until the user has reviewed and signed off on this design and phase structure.

---

## 1. Executive Summary & Goals

This plan details the implementation of **Phase 5** of the SmartSapp Tasks Architecture upgrade:
1. **Canonical Cross-Module Task Card Standard (`CompactTaskCard.tsx`)**: An institutional, high-density component conforming to Roadmap §77:
   ```text
   ┌─────────────────────────────────────────────────────────────┐
   │ [○] Task Title                                [Priority]   │
   │     Status · Due Date · Assignee              [Source]     │
   │     [Relationship Badge: Deal / Entity / Agreement]         │
   │     ⚠ Contract obligation sync failed. [ Retry ]           │
   └─────────────────────────────────────────────────────────────┘
   ```
   Built using the atomic primitives validated in Phase 1–3 (`TaskStatusBadge`, `TaskPriorityBadge`, `TaskDueDate`, `TaskAssignee`, `TaskRelationshipBadge`, `TaskSourceBadge`), enforcing $\ge 44\text{px}$ touch targets, tactile micro-interactions (`active:scale-[0.97]`), and uniform status semantics.
2. **Cross-Module Task Harmonization**:
   - **Dashboard Task Widget (`TaskWidget.tsx`)**: Standardize ad-hoc card markup with `<CompactTaskCard>`, apply query bounding with `limit(10)` (Rule 9), and preserve Firestore streaming with optimistic completion feedback.
   - **CRM Entity Detail (`entities/[id]/page.tsx`)**: Standardize Tasks tab with `<CompactTaskCard>` and wire card click to open `TaskDetailDrawer` slide-over to preserve context without navigation.
   - **Deals Detail (`deals/[id]/page.tsx`)**: Standardize Upcoming Tasks with `<CompactTaskCard>`, preserving due-date urgency sorting (overdue/today first) and drawer inspection.
3. **Resilient Downstream Contract Obligation Synchronization (Roadmap §78)**:
   - Upgrade `src/lib/tasks/task-core.ts` (`line 255`) and `src/lib/task-server-actions.ts` (`line 155`) to eliminate the silent failure defect where reverse-hook errors were swallowed with only a `console.warn`.
   - Persist explicit states on task documents: `obligationSyncStatus: 'synced' | 'failed' | 'pending'`, `obligationSyncError: string | null`, `obligationSyncAt: string | null`.
   - Provide an authenticated, idempotent server action: `retryTaskObligationSyncAction(workspaceId, taskId)` with TOCTOU currency verification.
4. **Governed MCP Capability Contract (`task-obligation-sync.contract.ts`)**:
   - Stateless capability contract conforming to MCP SDK v2 (`2026-07-28` spec), `L2_STATE_MUTATION` server-side authorization, workspace confinement, and principal audit logging.
5. **Downstream Integration Failure Recovery UX**:
   - Prominent Section 78 banner in `TaskDetailDrawer.tsx` and warning indicator in `TaskListRow.tsx`:
     ```text
     Task completed.
     Contract obligation could not be synchronized.
     [ Retry synchronization ]
     ```
   - One-click retry with actionable toasts linking strictly to safe relative paths (`/admin/finance/agreements`).

---

## 2. Conformance with `agents_mcp_rules.md` (The 10 + 15 Rules)

### 2.1 The 10 Foundational Engineering Rules

* **Rule 1 (Industry-Grade Best Practices & Design Standards)**:
  * Complies with `next-best-practices`: Presentation components (`CompactTaskCard`) are client components (`'use client'`), completely decoupled from Firestore queries or network side effects. They take validated props and callback handlers.
  * Complies with `vercel-react-best-practices`: Pure memoized layout, `tabular-nums` used on all dates/times to eliminate alignment jitter; zero unnecessary re-renders.
  * Complies with `emilkowal-animations`: Tactile feedback on all interactive elements (`active:scale-[0.97]`), smooth transitions ($< 250\text{ms}$).
  * Complies with `theme.md` Section 8 Modal Architecture: Drawers and modals use demarcated headers/footers with single-circle `CardInfoTooltip` (`z-[10050]`), `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`, and `sr-only` descriptions.
* **Rule 2 (Risk Analysis, Prevention & Scalability)**:
  * Comprehensive failure modes identified: downstream API timeout/lockout, TOCTOU collision during retry, ad-hoc UI regressions, and small mobile clipping.
  * Full mitigation matrix documented in Section 4.
  * Unit and integration test coverage with Vitest and React Testing Library before merging.
  * Strictly zero remote git pushes. Local commit discipline only.
* **Rule 3 (Cross-Module Observability & Backoffice Management)**:
  * Detailed in Section 5. Zero breaking changes to existing CRM, Deal, or Dashboard features.
  * Failed downstream obligation syncs are persisted directly on Firestore task records, making them observable in backoffice audit feeds.
  * Operations teams and administrators can inspect and trigger retries without touching code.
* **Rule 4 (Strict Typing & External Boundary Trust)**:
  * Strictly zero `any`, `any[]`, or unchecked casts across all new components, actions, contracts, and test suites.
  * External payloads from `crm-deal-sync-service.ts` validated via Zod schemas at API boundary.
  * Strict union types: `obligationSyncStatus: 'synced' | 'failed' | 'pending'`.
* **Rule 5 (Staging, Validation & Approval Gates)**:
  * Strict approval gate enforced before executing tasks.
  * All unit and integration tests must pass locally before staging.
  * Firestore rules for `tasks` and `contract_obligations` verified with workspace isolation checks.
* **Rule 6 (Dependency Integrity & Context7)**:
  * Uses existing, verified packages only: `@/lib/types`, `date-fns`, `lucide-react`, `zod/v4`.
  * Zero new external npm packages required.
* **Rule 7 (Mobile-First Ergonomics & Everyday UI English)**:
  * Every interactive touch target meets or exceeds `min-h-[44px]` and `min-w-[44px]` (completion circle, card click area, retry trigger).
  * Smooth transition from desktop slide-over to full-width mobile bottom sheet (<768px).
  * Everyday UI English: Concise labels with zero technical jargon (*"Task completed"*, *"Contract obligation could not be synchronized"*, *"[ Retry synchronization ]"*).
* **Rule 8 (Security, Anti-IDOR & Zero Trust)**:
  * All server actions validate `workspaceId` against authenticated session before reading or mutating records.
  * Anti-IDOR: Completing a task only syncs to its strictly bound `relatedParentId` and `relatedEntityId`.
  * Actionable toast navigation paths strictly adhere to relative path protocol starting with `/` (e.g. `/admin/finance/agreements`). Prohibits direct external links, protocol schemes (`http:`, `https:`), or `javascript:` targets.
* **Rule 9 (High-Load Safety & Resource Protection)**:
  * Enforces `limit(10)` on `TaskWidget` query to prevent unbounded Firestore streaming.
  * Entity and deal task queries scoped strictly by workspace and parent IDs with indexes.
  * Bulk operations chunked in batches $\le 500$ documents.
* **Rule 10 (Inline Architectural Documentation & Pointers)**:
  * Comprehensive `@fileOverview` and inline JSDoc comments explaining architectural intent, security cautions, maintainer guidance, and testability pointers across all files.

---

### 2.2 The Agentic & MCP Rules (Rules 11–25)

* **Rule 11 (MCP Protocol Compliance — Current 2026-07-28 Spec & SDK v2)**:
  * Capability contract `task-obligation-sync.contract.ts` adheres to stateless protocol execution, header-based routing, and split `@modelcontextprotocol/server` package standards.
* **Rule 12 (Server-Side Risk Enforcement — Metadata vs Real Boundaries)**:
  * Risk classified as `L2_STATE_MUTATION`. Explicit server-side permission checks (`operations:tasks:edit`, `contracts:obligations:edit`) enforced before executing reverse sync, independent of client hints.
* **Rule 13 (Formal Trust Boundary Matrix)**:
  * Strict data classification applied:
    * `USER TRUST`: Client retry click (treated as untrusted; session & anti-IDOR verified).
    * `SYSTEM TRUST`: Internal Firestore `tasks` collection and task-core engine.
    * `TENANT TRUST`: Workspace confinement (`workspaceId`).
    * `EXTERNAL DATA`: Downstream `crm-deal-sync-service.ts` response (validated via Zod before updating task).
    * `AGENT TRUST`: Evaluated at intersection of `User authority ∩ Agent authority ∩ Workspace authority`.
* **Rule 14 (Tool Poisoning / Rug-Pull Defense)**:
  * Contract schemas versioned and fingerprinted (`version: '1.0.0'`). Any drift in downstream obligation fields caught at the Zod schema validation boundary.
* **Rule 15 (Server Allowlisting and Supply-Chain Controls)**:
  * Downstream sync calls strictly execute against internal allowlisted domain services; zero external dynamic URL dispatch.
* **Rule 16 (Agent Identity as a First-Class Security Principal)**:
  * Context records `principal.actorType` (`'user' | 'agent' | 'system'`), `agentId`, and `runId`. Agents cannot inherit unearned administrative privileges.
* **Rule 17 (Non-Delegable Privileges)**:
  * Overriding legal contract fulfillment or altering obligation definitions requires explicit human administrative permissions; cannot be delegated to autonomous subagents.
* **Rule 18 (Time-of-Check / Time-of-Use Protection — TOCTOU)**:
  * `retryTaskObligationSyncAction` accepts `expectedUpdatedAt`. If task was concurrently modified by another user or background job, mutation aborts safely with a concurrency alert.
* **Rule 19 (Mutating Tool Idempotency & Human-in-the-Loop Approval Gates)**:
  * Re-executing `retryTaskObligationSyncAction` on an already-synced obligation returns cached success (`alreadySynced: true`) without redundant downstream calls.
* **Rule 20 (Replay / Duplicate Delivery Protection)**:
  * Generates unique `executionId` for downstream synchronization calls to prevent double-fulfillment of contract terms.
* **Rule 21 (Model Drift & Prompt Injection Guardrails)**:
  * Downstream contract error messages sanitized before persisting to Firestore; UI renders sanitized strings via standard text nodes (zero raw unescaped HTML).
* **Rule 22 (Two-Phase Action Model for High-Risk Work)**:
  * Manual retry triggers require explicit human click; displays in-flight pending state with confirmation toast.
* **Rule 23 (Budget, Backpressure & Resource Governance)**:
  * `TaskWidget` restricted to 10 tasks max. Task queries in CRM entities and Deals bounded and indexed.
* **Rule 24 (Circuit Breakers & Fail-Soft Degradation)**:
  * If downstream agreement service is unavailable, task completion succeeds locally and records `obligationSyncStatus: 'failed'`. The primary user workflow is never blocked by downstream outages.
* **Rule 25 (Dead-Letter and Recovery Queues / Tasks State)**:
  * Failed syncs act as durable task-level dead-letter states, observable and retryable directly in the UI.

---

## 3. Detailed Component Hierarchy & File Architecture

```text
src/
├── lib/
│   ├── types.ts                                                    (Modify: Add obligationSyncStatus, obligationSyncError, obligationSyncAt to Task)
│   ├── tasks/
│   │   └── task-core.ts                                            (Modify: Persist obligationSyncStatus on reverse-hook try/catch)
│   ├── task-server-actions.ts                                      (Modify: Add retryTaskObligationSyncAction & bulk status persistence)
│   └── __tests__/
│       └── task-obligation-sync-actions.test.ts                    (Create: Vitest server action unit & reverse-hook failure tests)
├── platform/
│   └── domains/
│       └── tasks_productivity/
│           └── contracts/
│               ├── task-obligation-sync.contract.ts                (Create: Capability contract with Rules 11, 12, 18, 19)
│               └── __tests__/
│                   └── task-obligation-sync-contract.test.ts       (Create: Vitest capability contract unit tests)
├── app/
│   └── admin/
│       ├── tasks/
│       │   └── components/
│       │       ├── CompactTaskCard.tsx                             (Create: Canonical cross-module task card conforming to §77)
│       │       ├── TaskDetailDrawer.tsx                            (Modify: Embed sync failure banner & retry action conforming to §78)
│       │       ├── TaskListRow.tsx                                 (Modify: Add sync failure alert badge)
│       │       └── __tests__/
│       │           ├── CompactTaskCard.test.tsx                    (Create: Unit tests for card rendering, touch targets & failure badge)
│       │           └── TaskDetailDrawer-sync-failure.test.tsx      (Create: Integration tests for sync failure recovery banner)
│       ├── entities/
│       │   ├── [id]/
│       │   │   └── page.tsx                                        (Modify: Refactor Tasks tab to use CompactTaskCard + Drawer)
│       │   └── __tests__/
│       │       └── EntityTasksTab.test.tsx                         (Create: Entity detail tasks tab integration tests)
│       └── deals/
│           ├── [id]/
│           │   └── page.tsx                                        (Modify: Refactor Upcoming Tasks to use CompactTaskCard + Drawer)
│           └── __tests__/
│               └── DealTasksSection.test.tsx                       (Create: Deal detail tasks section integration tests)
└── components/
    └── dashboard/
        ├── TaskWidget.tsx                                          (Modify: Standardize with CompactTaskCard & query limit(10))
        └── __tests__/
            └── TaskWidget-compact.test.tsx                         (Create: Dashboard widget integration tests)
```

---

## 4. What Could Go Wrong & Mitigation Matrix (Rule 2)

| Potential Failure Mode | Root Cause | Impact | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Downstream Agreement API Failure / Timeout** | DocSigning or agreement service experiencing transient network error or lock contention. | Obligation remains unfulfilled, but task shows completed without notification. | **Explicit State Persistence (Rule 24)**: Catch block in `task-core.ts` writes `obligationSyncStatus: 'failed'` and `obligationSyncError`. UI renders prominent recovery banner per §78. |
| **TOCTOU Race Condition During Retry** | Multiple operators or background sync jobs click retry simultaneously on the same task. | Redundant downstream fulfillment calls or database write collisions. | **Optimistic Concurrency Guard (Rule 18)**: `retryTaskObligationSyncAction` evaluates `expectedUpdatedAt`. If task was concurrently modified, aborts safely with concurrency alert. |
| **Duplicate Downstream Execution / Double Fulfillment** | Network drop after downstream success but before client receives confirmation. | Multiple fulfillment events recorded against the same contractual term. | **Idempotent Capability Engine (Rule 19 & 20)**: Downstream sync service checks if obligation is already `'fulfilled'`. If so, returns `{ success: true, obligationUpdated: false }` cleanly. |
| **Context Loss on Card Click in CRM Entities / Deals** | User clicks a task in Deal/Entity detail view and gets redirected to `/admin/tasks`, losing deal context. | Frustrating user experience, lost navigation state. | **In-Place Drawer Inspection (Rule 1 & Roadmap §87)**: Card click opens `TaskDetailDrawer` slide-over / bottom sheet directly within the host page. |
| **Touch Target Violation on Mobile (<768px)** | Small completion circle or retry button $< 44\text{px}$, causing tap misses. | Poor mobile usability, accessibility failure. | **Mobile Ergonomics Invariant (Rule 7)**: All interactive controls enforce `min-h-[44px]` and `min-w-[44px]` with `active:scale-[0.97]` tactile transitions. |
| **Query Storm / Resource Exhaustion on Dashboard** | Dashboard loads unbounded task collection on high-activity workspaces. | Slow page load, elevated Firestore read costs, memory spikes. | **Hard-Bounded Query (Rule 9)**: Apply `limit(10)` with compound indexing on `(workspaceId, status, dueDate)`. |
| **Open Redirect via Actionable Toasts** | Malicious injection or dynamic path concatenation in toast action button. | Open redirect vulnerability (CWE-601). | **Strict Relative Path Invariant (Rule 8)**: All `actionConfig.path` parameters strictly start with `/` (e.g. `/admin/finance/agreements`) with zero protocol or external domain targets. |

---

## 5. Impact Analysis & Backoffice Management (Rule 3)

### 5.1 Subsystem Impact Analysis
* **Tasks Command Hub (`/admin/tasks`)**: Fully compatible. `TaskListRow` gains an obligation sync failure indicator, enabling operators to identify failed downstream syncs from the list view.
* **Dashboard (`TaskWidget.tsx`)**: Replaces bespoke markup with `<CompactTaskCard>`. Visual layout is cleaner, more compact, and enforces `limit(10)` query bounds.
* **CRM Entity Profiles (`entities/[id]/page.tsx`)**: Tasks tab upgraded to `<CompactTaskCard>`. Clicking a task opens `TaskDetailDrawer` in place, preserving entity context.
* **Deals Pipeline (`deals/[id]/page.tsx`)**: Upcoming Tasks upgraded to `<CompactTaskCard>`. Urgency sorting (overdue/today first) is preserved.
* **Agreements & DocSigning (`crm-deal-sync-service.ts`)**: Reverse hook contract upgraded with explicit status tracking and safe idempotency.

### 5.2 Backoffice Management (Codeless Customization)
1. **Observable Sync Statuses**: Failed contract obligation syncs are persisted with `obligationSyncStatus: 'failed'` and an error description, making them queryable in Backoffice audit feeds.
2. **One-Click Recovery Without Code**: Operators can inspect failed tasks and execute `[ Retry synchronization ]` directly from the UI without requiring database scripts or developer intervention.
3. **Audit Trail**: Every retry operation records `actorUserId`, `syncedAt`, and `executionId` in the task activity log.

---

## 6. Bite-Sized Implementation Tasks

### Task 1: Domain Types & Obligation Sync Capability Contract
*Enforces Rule 4 (Strict Typing), Rule 11 (MCP Protocol), Rule 12 (Server-Side Risk L2), Rule 18 (TOCTOU), and Rule 47 (Workspace Confinement).*

**Files:**
- Modify: `src/lib/types.ts`
- Create: `src/platform/domains/tasks_productivity/contracts/task-obligation-sync.contract.ts`
- Create: `src/platform/domains/tasks_productivity/contracts/__tests__/task-obligation-sync-contract.test.ts`

- [ ] **Step 1: Write failing tests for `task-obligation-sync.contract.ts`**

```typescript
// src/platform/domains/tasks_productivity/contracts/__tests__/task-obligation-sync-contract.test.ts
import { describe, it, expect } from 'vitest';
import { taskObligationSyncCapability, TaskObligationSyncInputSchema } from '../task-obligation-sync.contract';

describe('task.obligation.sync Capability Contract', () => {
  it('validates schema correctly', () => {
    const valid = TaskObligationSyncInputSchema.safeParse({
      workspaceId: 'ws-1',
      taskId: 'task-100',
      expectedUpdatedAt: '2026-10-09T00:00:00.000Z',
    });
    expect(valid.success).toBe(true);
  });

  it('enforces L2_STATE_MUTATION risk and workspace scoping', () => {
    expect(taskObligationSyncCapability.risk.level).toBe('L2_STATE_MUTATION');
    expect(taskObligationSyncCapability.workspaceScoped).toBe(true);
    expect(taskObligationSyncCapability.permissions).toContain('operations:tasks:edit');
  });
});
```

- [ ] **Step 2: Run test to verify failure**
  Run: `pnpm test:run src/platform/domains/tasks_productivity/contracts/__tests__/task-obligation-sync-contract.test.ts`
  Expected: FAIL (module not found).
- [ ] **Step 3: Update `src/lib/types.ts`**
  Add explicit fields to `Task` interface:
  ```typescript
  obligationSyncStatus?: 'synced' | 'failed' | 'pending';
  obligationSyncError?: string;
  obligationSyncAt?: string;
  ```
  Strict typing policy: zero `any` or `any[]`.
- [ ] **Step 4: Implement `task-obligation-sync.contract.ts`**
  Implement capability contract adhering to the project's standard `CapabilityDefinition` pattern. Wire input/output schemas with Zod, bind permissions, and implement handler with principal audit logging.
- [ ] **Step 5: Run tests to verify pass**
  Run: `pnpm test:run src/platform/domains/tasks_productivity/contracts/__tests__/task-obligation-sync-contract.test.ts`
  Expected: PASS.
- [ ] **Step 6: Commit**
  Git commit: `feat(tasks): define obligation sync types and capability contract`

---

### Task 2: Downstream Sync Status Persistence & Idempotent Retry Action
*Enforces Rule 2 (Failure Handling), Rule 8 (Security & Anti-IDOR), Rule 18 (TOCTOU), Rule 19 (Idempotency), and Rule 20 (Replay Protection).*

**Files:**
- Modify: `src/lib/tasks/task-core.ts`
- Modify: `src/lib/task-server-actions.ts`
- Create: `src/lib/__tests__/task-obligation-sync-actions.test.ts`

- [ ] **Step 1: Write failing tests in `task-obligation-sync-actions.test.ts`**
  - Test 1: When `syncTaskCompletionToObligation` fails, task document persists `obligationSyncStatus: 'failed'` and error message without throwing.
  - Test 2: When `syncTaskCompletionToObligation` succeeds, task document persists `obligationSyncStatus: 'synced'` and `obligationSyncAt`.
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

## 7. Verification & Quality Gates Plan

1. **Automated Verification:**
   - 100% pass across all unit and integration test suites.
   - Zero TypeScript compiler diagnostics (`tsc --noEmit`).
   - Zero ESLint warnings or errors across all modified hubs.
   - Zero `any` or `any[]` occurrences in new files.

2. **Architectural & Manual Checklist (for Senior Principal Architect review):**
   - Confirm `<CompactTaskCard>` displays consistent visual hierarchy across `/admin/tasks`, Dashboard, CRM Entity pages, and Deals.
   - Confirm touch targets are $\ge 44\text{px}$ on mobile across all cards, buttons, and retry actions.
   - Confirm downstream integration failures display the exact recovery UX specified in Section 78 with actionable relative toasts (`/admin/finance/agreements`).
   - Confirm zero regression on existing entity/deal filters and task completion behavior.
