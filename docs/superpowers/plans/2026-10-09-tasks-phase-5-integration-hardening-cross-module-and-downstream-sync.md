# Tasks Phase 5: Integration Hardening, Cross-Module Standards & Downstream Synchronization Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harmonize task presentation and behavior across all SmartSapp CRM modules (Dashboard, Entity CRM, Deals, Agreements/DocSigning), deploy the universal `<CompactTaskCard>` component conforming to Section 77 of the Tasks Roadmap, and implement resilient downstream contract-obligation synchronization and retry UX conforming to Section 78.

**Architecture:** 
1. Establish a single, canonical `<CompactTaskCard>` component using the atomic primitives built in Phase 1-3 (`TaskStatusBadge`, `TaskPriorityBadge`, `TaskDueDate`, `TaskAssignee`, `TaskRelationshipBadge`, `TaskSourceBadge`).
2. Upgrade `src/lib/tasks/task-core.ts` and `src/lib/task-server-actions.ts` to record explicit synchronization states (`obligationSyncStatus: 'synced' | 'failed' | 'pending'`) rather than silently swallowing downstream failures.
3. Replace fragmented, ad-hoc task cards in `TaskWidget.tsx`, `entities/[id]/page.tsx`, and `deals/[id]/page.tsx` with `<CompactTaskCard>`.
4. Surface actionable, permission-aware retry affordances (`[ Retry synchronization ]`) in the UI when reverse hook execution encounters transient downstream failures.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript (Strict typing, zero `any` or `any[]`), Tailwind CSS, shadcn/ui, Radix UI, Lucide React, Vitest, Testing Library.

---

## Agents & MCP Rules Compliance Mapping

- **Rule 1 (Design Standards & UI Consistency):** Enforces Section 8 Modal Architecture (`theme.md`), Emil Kowalski micro-interactions (`active:scale-[0.97]`), and uniform status/priority semantics.
- **Rule 2 (Risk Analysis & Preservation):** Existing queries, filter states, and permission checks in Dashboard, CRM Entities, and Deals must remain 100% functional.
- **Rule 3 (Cross-Module Observability):** Downstream synchronization failures must be persisted and observable in UI and logs without crashing host modules.
- **Rule 4 (Strict Typing):** Zero `any` or `any[]`. Inferred and explicit types for all components, props, schemas, and contract outputs.
- **Rule 7 (Mobile & Accessibility First):** Every interactive control (status toggle, retry button, card click target) must meet `>= 44px` touch targets with keyboard navigation support.
- **Rule 8 (Security & Anti-IDOR):** Deep links and retry actions must enforce workspace scoping and verify caller permissions before mutating data.
- **Rule 10 (Inline Architectural Guidance):** All newly authored components and refactored sections must contain descriptive inline comments explaining design rationale and caution areas.
- **Rule 18/19 (TOCTOU & Idempotency):** Obligation retry operations must be idempotent and verify task currency before modifying contract states.

---

## File Structure & Responsibilities

| File Path | Action | Responsibility |
|---|---|---|
| `src/lib/types.ts` | Modify | Add `obligationSyncStatus`, `obligationSyncError`, and `obligationSyncAt` to `Task`. |
| `src/platform/domains/tasks_productivity/contracts/task-obligation-sync.contract.ts` | Create | Canonical capability contract for retrying downstream task obligations. |
| `src/platform/domains/tasks_productivity/contracts/__tests__/task-obligation-sync-contract.test.ts` | Create | Contract unit tests. |
| `src/lib/tasks/task-core.ts` | Modify | Persist `obligationSyncStatus` when reverse hook runs. |
| `src/lib/task-server-actions.ts` | Modify | Export `retryTaskObligationSyncAction(workspaceId, taskId)`. |
| `src/lib/__tests__/task-obligation-sync-actions.test.ts` | Create | Server action tests for reverse hook failure & retry. |
| `src/app/admin/tasks/components/CompactTaskCard.tsx` | Create | Universal embedded task card conforming to Roadmap §77. |
| `src/app/admin/tasks/components/__tests__/CompactTaskCard.test.tsx` | Create | Component unit tests for card layout, badges, click handlers, and failure banner. |
| `src/components/dashboard/TaskWidget.tsx` | Modify | Embed `<CompactTaskCard>` instead of custom ad-hoc styling. |
| `src/components/dashboard/__tests__/TaskWidget-compact.test.tsx` | Create | Widget integration tests. |
| `src/app/admin/entities/[id]/page.tsx` | Modify | Refactor Tasks tab to embed `<CompactTaskCard>` and wire `TaskDetailDrawer`. |
| `src/app/admin/entities/__tests__/EntityTasksTab.test.tsx` | Create | Entity detail tasks tab integration tests. |
| `src/app/admin/deals/[id]/page.tsx` | Modify | Refactor Upcoming Tasks section to embed `<CompactTaskCard>`. |
| `src/app/admin/deals/__tests__/DealTasksSection.test.tsx` | Create | Deal detail tasks section integration tests. |
| `src/app/admin/tasks/components/TaskDetailDrawer.tsx` | Modify | Add downstream sync status banner and retry button if sync failed. |
| `src/app/admin/tasks/components/TaskListRow.tsx` | Modify | Add downstream sync warning badge if sync failed. |

---

### Task 1: Domain Types & Obligation Sync Contract

**Files:**
- Modify: `src/lib/types.ts`
- Create: `src/platform/domains/tasks_productivity/contracts/task-obligation-sync.contract.ts`
- Create: `src/platform/domains/tasks_productivity/contracts/__tests__/task-obligation-sync-contract.test.ts`

- [ ] **Step 1: Write failing tests for `task-obligation-sync.contract.ts`**
  Validate input schema (`workspaceId`, `taskId`), permission requirements, and output schema (`taskId`, `contractId`, `obligationId`, `status: 'synced' | 'failed'`).
- [ ] **Step 2: Run test to verify failure**
  Run: `pnpm test:run src/platform/domains/tasks_productivity/contracts/__tests__/task-obligation-sync-contract.test.ts`
  Expected: FAIL (module not found).
- [ ] **Step 3: Update `src/lib/types.ts`**
  Add `obligationSyncStatus?: 'synced' | 'failed' | 'pending'`, `obligationSyncError?: string`, `obligationSyncAt?: string` to `Task`.
- [ ] **Step 4: Implement `task-obligation-sync.contract.ts`**
  Implement capability contract adhering to Rule 4 (Strict Typing), Rule 12 (Server-Side Risk), and Rule 47 (Workspace Confining).
- [ ] **Step 5: Run tests to verify pass**
  Run: `pnpm test:run src/platform/domains/tasks_productivity/contracts/__tests__/task-obligation-sync-contract.test.ts`
  Expected: PASS.
- [ ] **Step 6: Commit**
  Git commit: `feat(tasks): define obligation sync types and capability contract`

---

### Task 2: Downstream Sync Hardening & Retry Server Action

**Files:**
- Modify: `src/lib/tasks/task-core.ts`
- Modify: `src/lib/task-server-actions.ts`
- Create: `src/lib/__tests__/task-obligation-sync-actions.test.ts`

- [ ] **Step 1: Write failing test in `task-obligation-sync-actions.test.ts`**
  Assert that when `syncTaskCompletionToObligation` throws an error, the task record is updated with `obligationSyncStatus: 'failed'` and `obligationSyncError`. Assert that `retryTaskObligationSyncAction` re-triggers synchronization and sets `obligationSyncStatus: 'synced'` on success.
- [ ] **Step 2: Run test to verify failure**
  Run: `pnpm test:run src/lib/__tests__/task-obligation-sync-actions.test.ts`
  Expected: FAIL.
- [ ] **Step 3: Implement reverse hook status persistence in `task-core.ts` and `task-server-actions.ts`**
  Update `updateTaskCore` and `bulkUpdateTasksAction` to write `obligationSyncStatus` and handle retry.
- [ ] **Step 4: Implement `retryTaskObligationSyncAction`**
  Authenticated server action validating workspace permissions and executing retry.
- [ ] **Step 5: Run tests to verify pass**
  Run: `pnpm test:run src/lib/__tests__/task-obligation-sync-actions.test.ts`
  Expected: PASS.
- [ ] **Step 6: Commit**
  Git commit: `feat(tasks): implement obligation sync status tracking and retry server action`

---

### Task 3: Canonical Universal `<CompactTaskCard>` Component

**Files:**
- Create: `src/app/admin/tasks/components/CompactTaskCard.tsx`
- Create: `src/app/admin/tasks/components/__tests__/CompactTaskCard.test.tsx`

- [ ] **Step 1: Write failing tests for `CompactTaskCard`**
  Verify rendering of title, status badge, priority badge, due date, assignee, relationship badge, and source badge. Verify complete button triggers `onToggleComplete`, clicking the card body invokes `onClick`, and integration failure badge renders with a retry trigger when `obligationSyncStatus === 'failed'`. Verify touch target is `>= 44px`.
- [ ] **Step 2: Run test to verify failure**
  Run: `pnpm test:run src/app/admin/tasks/components/__tests__/CompactTaskCard.test.tsx`
  Expected: FAIL (module not found).
- [ ] **Step 3: Implement `CompactTaskCard.tsx`**
  Compact, high-density card conforming to Roadmap §77 and Section 8 Design System. Clean truncated typography, keyboard accessible focus states, tactile buttons (`active:scale-[0.97]`).
- [ ] **Step 4: Run tests to verify pass**
  Run: `pnpm test:run src/app/admin/tasks/components/__tests__/CompactTaskCard.test.tsx`
  Expected: PASS.
- [ ] **Step 5: Commit**
  Git commit: `feat(tasks): create universal CompactTaskCard component adhering to cross-module standards`

---

### Task 4: Cross-Module Integration — Dashboard Task Widget

**Files:**
- Modify: `src/components/dashboard/TaskWidget.tsx`
- Create: `src/components/dashboard/__tests__/TaskWidget-compact.test.tsx`

- [ ] **Step 1: Write failing test in `TaskWidget-compact.test.tsx`**
  Verify that `TaskWidget` renders tasks using `CompactTaskCard`, shows empty state, handles completion, and maintains link to `/admin/tasks`.
- [ ] **Step 2: Refactor `TaskWidget.tsx`**
  Replace ad-hoc custom markup with `<CompactTaskCard>`. Preserve Firestore real-time streaming, tenant scoping, and empty states.
- [ ] **Step 3: Run tests to verify pass**
  Run: `pnpm test:run src/components/dashboard/__tests__/TaskWidget-compact.test.tsx`
  Expected: PASS.
- [ ] **Step 4: Commit**
  Git commit: `refactor(dashboard): standardize TaskWidget with universal CompactTaskCard`

---

### Task 5: Cross-Module Integration — CRM Entity Detail Page

**Files:**
- Modify: `src/app/admin/entities/[id]/page.tsx`
- Create: `src/app/admin/entities/__tests__/EntityTasksTab.test.tsx`

- [ ] **Step 1: Write failing test in `EntityTasksTab.test.tsx`**
  Verify that the Tasks tab on the CRM entity page renders tasks with `CompactTaskCard` and allows opening task detail.
- [ ] **Step 2: Refactor Tasks tab in `src/app/admin/entities/[id]/page.tsx`**
  Replace ad-hoc cards with `<CompactTaskCard>`. Wire `onClick` to open `TaskDetailDrawer` for full contextual view.
- [ ] **Step 3: Run tests to verify pass**
  Run: `pnpm test:run src/app/admin/entities/__tests__/EntityTasksTab.test.tsx`
  Expected: PASS.
- [ ] **Step 4: Commit**
  Git commit: `refactor(entities): standardize CRM entity tasks tab with CompactTaskCard and detail drawer`

---

### Task 6: Cross-Module Integration — Deal Detail Page

**Files:**
- Modify: `src/app/admin/deals/[id]/page.tsx`
- Create: `src/app/admin/deals/__tests__/DealTasksSection.test.tsx`

- [ ] **Step 1: Write failing test in `DealTasksSection.test.tsx`**
  Verify that Deal detail renders tasks using `CompactTaskCard`, displays deal relationship badge, and provides seamless completion.
- [ ] **Step 2: Refactor Upcoming Tasks section in `src/app/admin/deals/[id]/page.tsx`**
  Replace custom card loop with `<CompactTaskCard>`.
- [ ] **Step 3: Run tests to verify pass**
  Run: `pnpm test:run src/app/admin/deals/__tests__/DealTasksSection.test.tsx`
  Expected: PASS.
- [ ] **Step 4: Commit**
  Git commit: `refactor(deals): standardize deal upcoming tasks section with CompactTaskCard`

---

### Task 7: Integration Failure Recovery UX in Detail Drawer & List Row

**Files:**
- Modify: `src/app/admin/tasks/components/TaskDetailDrawer.tsx`
- Modify: `src/app/admin/tasks/components/TaskListRow.tsx`
- Create: `src/app/admin/tasks/components/__tests__/TaskDetailDrawer-sync-failure.test.tsx`

- [ ] **Step 1: Write failing test for sync failure banner in `TaskDetailDrawer-sync-failure.test.tsx`**
  Assert that when `task.obligationSyncStatus === 'failed'`, `TaskDetailDrawer` renders a destructive warning banner with a `Retry synchronization` button that calls `retryTaskObligationSyncAction`.
- [ ] **Step 2: Update `TaskDetailDrawer.tsx` and `TaskListRow.tsx`**
  Embed the Section 78 failure notice:
  `Contract obligation could not be synchronized. [ Retry synchronization ]` with a relative toast path `/admin/finance/contracts`.
- [ ] **Step 3: Run tests to verify pass**
  Run: `pnpm test:run src/app/admin/tasks/components/__tests__/TaskDetailDrawer-sync-failure.test.tsx`
  Expected: PASS.
- [ ] **Step 4: Commit**
  Git commit: `feat(tasks): add contract obligation sync failure alert and retry affordance to TaskDetailDrawer and TaskListRow`

---

### Task 8: End-to-End Quality Gates & Comprehensive System Verification

**Files:**
- All Phase 1 through Phase 5 files across Tasks, Standups, Analytics, Dashboard, Entities, Deals, and Contracts.

- [ ] **Step 1: Run complete Tasks and integration test suites**
  Run: `pnpm test:run src/app/admin/tasks/ src/app/admin/standups/ src/app/admin/task-analytics/ src/components/dashboard/ src/platform/domains/tasks_productivity/`
  Confirm 100% test pass rate.
- [ ] **Step 2: Run TypeScript Typecheck**
  Run: `pnpm typecheck` (`tsc --noEmit`)
  Confirm 0 TypeScript errors.
- [ ] **Step 3: Run ESLint**
  Run: `pnpm eslint src/app/admin/tasks/ src/app/admin/standups/ src/app/admin/task-analytics/ src/components/dashboard/TaskWidget.tsx`
  Confirm 0 ESLint errors and warnings.
- [ ] **Step 4: Verify Zero `any` or `any[]` Invariant**
  Run: `grep -rn "any\[\]" src/app/admin/tasks/components/CompactTaskCard.tsx src/platform/domains/tasks_productivity/contracts/task-obligation-sync.contract.ts`
  Confirm 0 matches.
- [ ] **Step 5: Final git commit for Phase 5**
  Git commit: `feat(tasks): complete Phase 5 integration hardening, cross-module standards, and downstream sync`

---

## Verification & Architecture Review Plan

1. **Automated Verification:**
   - 100% pass across all unit and integration test suites.
   - Zero TypeScript compiler diagnostics (`tsc --noEmit`).
   - Zero ESLint warnings or errors across all modified hubs.
   - Zero `any` or `any[]` occurrences in new files.

2. **Architectural & Manual Checklist (for Senior Principal Architect review):**
   - Confirm `<CompactTaskCard>` displays consistent visual hierarchy across `/admin/tasks`, Dashboard, CRM Entity pages, and Deals.
   - Confirm touch targets are `>= 44px` on mobile across all cards, buttons, and retry actions.
   - Confirm downstream integration failures display the exact recovery UX specified in Section 78 with actionable relative toasts (`/admin/finance/contracts`).
   - Confirm zero regression on existing entity/deal filters and task completion behavior.
