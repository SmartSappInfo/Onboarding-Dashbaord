# Tasks Phase 1: UI Foundations, Trustworthy Mutation Feedback & Execution Primitives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **DO NOT START EXECUTION UNTIL THIS PLAN IS EXPLICITLY APPROVED BY THE USER.**

**Goal:** Establish the standardized shared UI primitives and trustworthy feedback architecture for the Tasks Module in strict compliance with `docs/agents_mcp/agents_mcp_rules.md`, `.agents/AGENTS.md`, `docs/tasks/tasks_ui_spec.md`, `docs/tasks/tasks_prd.md`, and `docs/tasks/tasks_roadmap_ui.md`, while preserving 100% of current functionality.

**Architecture:**
1. **Modular UI Primitive Layer:** Extract and standardize `<TaskStatusBadge />`, `<TaskPriorityBadge />`, `<TaskAssignee />`, `<TaskDueDate />`, `<TaskRelationshipBadge />`, `<TaskSourceBadge />`, `<TaskEmptyState />`, `<TaskErrorState />`, `<TaskSkeleton />`, and `<ConfirmDialog />`. All primitives adhere to WCAG 2.2 AA accessibility, Emil Kowalski tactile micro-interactions (`active:scale-[0.97]`), and the Standardized Modal Architecture in `theme.md` (Section 8).
2. **Inflight Mutation Feedback & Concurrency Lock:** Implement scannable, accessible `<TaskListRow />` and upgrade `<TaskCard />` with visual pending states (`Saving...` spinner), preventing duplicate submissions while mutations are inflight across both List and Kanban views.
3. **Contractual Obligation Synchronization Transparency:** Display explicit "Sync pending" vs "Synced" states for DocSigning contract tasks, ensuring the UI never falsely implies downstream synchronization before backend confirmation.
4. **Two-Phase Bulk Operations & Approval Binding:** Upgrade bulk operations to a two-phase review workflow: replace browser-native prompts with `<ConfirmDialog />` for destructive operations, snapshot selected task IDs at approval time to prevent TOCTOU race conditions, and provide an itemized partial-failure breakdown with safe retry for failed items.
5. **Backoffice Diagnostics & Non-Code Management:** Surface task execution states, bulk failure logs, and contract sync status to Backoffice administrators, enabling diagnosis and reconciliation without code changes.
6. **Zero-Regression Monolith Decomposition:** Decompose inline UI in `TasksClient.tsx` into these modular primitives without regressing any existing features (views, filters, calendar dragging, keyboard navigation, or scope tabs).

**Tech Stack:** Next.js (App Router, Server Actions), React 18, Tailwind CSS, Radix UI Dialog / Dropdown / Tooltip, Lucide React, Vitest, React Testing Library, TypeScript (Strict zero-`any`).

---

## 1. `agents_mcp_rules.md` & Workspace Rules Compliance Matrix

| Rule # | Requirement from `agents_mcp_rules.md` & `.agents/AGENTS.md` | Phase 1 Implementation Guard |
| :--- | :--- | :--- |
| **Rule 1** | Conform to best-practice skills (`next-best-practices`, `vercel-react-best-practices`, `emilkowal-animations`, `backend-design`, `frontend-design`). Maintain all pre-existing app functionalities. | • All Server Actions authenticate and authorize independently.<br>• Client components use Emil Kowalski tactile easing (`active:scale-[0.97]`, `<250ms` transitions).<br>• Zero loss of multi-view (List/Board/Calendar), date filtering, or scope tabs. |
| **Rule 2** | Pre-mortem: Analyze what could go wrong and how to resolve it. Clean, testable, refactored, scalable without losing functionality. Local commit only, no push to origin. | Section 2 details failure modes, race conditions, edge cases, and mitigation strategies. Local commits only. |
| **Rule 3** | Impact analysis: What other features/callers will be affected? How is backoffice diagnostics impacted, and how can backoffice help manage this feature without code? | Section 3 inventories all callers (`TaskBoard`, `TasksClient`, `TaskCard`, `DocSigning`, Backoffice audit trails). |
| **Rule 4** | **Zero `any`, `any[]`, or unchecked casts**. `unknown` only at external trust boundaries, immediately validated with Zod. | Strict domain typing throughout. Input schemas defined with Zod. Zero `any` across all components and tests. |
| **Rule 5** | Staged validation: test, verify, no premature automated production deployment. | All changes verified via unit tests, security sweeps, `pnpm typecheck`, and `pnpm lint` before committing locally. |
| **Rule 6** | Dependencies & documentation: check dependencies and get latest documentation. | Uses existing Next.js, Radix UI, Lucide React, and Tailwind dependencies without introducing redundant libraries. |
| **Rule 7** | Mobile optimization: touch targets $\ge 44\text{px}$, responsive gestures, plain UI English, minimal text. | `TaskListRow`, `TaskCard` buttons, badge dropdowns, and dialog action buttons adhere to `min-h-[44px]` with visible focus outlines and screen-reader labels. |
| **Rule 8** | High security standards: eliminate open endpoints, enforce session + workspace boundary + RBAC checks. | Domain-level tenant boundary validation preserved. Server-side checks execute regardless of client UI state. |
| **Rule 9 & 23** | Load & Resource Governance: Avoid batch overload, data overload, resource exhaustion. | • Atomic bulk updates chunked into batches of $\le 450$.<br>• `pendingTaskIds` set prevents rapid double-submission flooding. |
| **Rule 10** | Inline architectural documentation: leave clear comments explaining what changed, why, caution areas, testability pointers. | All new and modified components documented with explanatory inline comments for future maintainers. |
| **Rule 12** | Annotations are hints, not security controls; server-side enforcement. | Server-side authorization check executes regardless of caller metadata. |
| **Rule 13** | Trust Boundary Matrix: classify data entering the system. | External HTTP payloads treated as `UNTRUSTED_EXTERNAL` and parsed through Zod before domain logic. |
| **Rule 16** | Agent Identity as First-Class Security Principal (`TaskActor`). | Differentiates `{ kind: 'user', uid }` (checked via `canUser`) from `{ kind: 'system', source }` (scoped server authority). |
| **Rule 18** | Time-of-Check / Time-of-Use (TOCTOU) protection. | • Optimistic UI in `TaskBoard.tsx` rolls back immediately on failure.<br>• Bulk operations snapshot selected IDs to prevent mutation of records altered during review. |
| **Rule 19 & 20** | Idempotency & Replay Protection. | Task mutations and obligation completions are idempotent; retries do not duplicate audit logs or clause fulfillment. |
| **Rule 21 & 22** | Two-Phase Action Model & Approval Binding for destructive operations. | Bulk delete and bulk complete actions require confirmation modals with explicit record counts and approved snapshots. |
| **Rule 24** | Circuit Breakers: graceful degradation on failure. | When server action fails, UI restores previous state, displays clear explanation, and provides actionable retry link. |
| **Rule 27** | Formal Saga / Compensation Model. | Failed bulk updates isolate failed items, commit successful items, and provide a targeted retry flow for failed items. |
| **Standard: Modal Architecture** | Standardized Modal Architecture in `theme.md` (Section 8). | `<ConfirmDialog />` and `<BulkActionReviewDialog />` bind to `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`, use `<DialogHeader demarcated>`, `<CardInfoTooltip text="..." />` alongside title, `<DialogDescription className="sr-only">`, and demarcated footer with tactile buttons (`rounded-xl active:scale-[0.97]`). |
| **Standard: Actionable Toasts** | Relative path starting with single `/`, persistent duration. | Toasts prompting permissions or settings pass `actionConfig` with relative paths (`/admin/settings/permissions`). |
| **Standard: TagSelector** | Single source of truth for workspace tags. | Tag selection routes exclusively through `<TagSelector>` in client/draft mode. |

---

## 2. Risk & Failure Mode Analysis (Pre-Mortem)

### Risk 1: Regression of Drag-and-Drop or Calendar Timeline Resizing
* **Hazard:** Extracting primitives or modifying `TasksClient.tsx` could inadvertently interfere with `@dnd-kit` sensors on the Kanban board or pointer events in `TaskCalendar.tsx`.
* **Mitigation:** Retain existing event propagation guards (`e.stopPropagation()`, `onPointerDown`) on card action menus and row selection checkboxes. Primitives will be purely presentational or carefully isolated.
* **Verification:** Run `TaskBoard-mutation.test.tsx` and full task test suite after every change.

### Risk 2: Re-render Loop or Loss of Local State During Inflight Mutations
* **Hazard:** Tracking `pendingTaskIds` in `TasksClient.tsx` could trigger re-renders that reset active filter controls, date picker states, or open dialogs.
* **Mitigation:** Use a localized state pattern (`pendingTaskIds: Set<string>`) that updates only affected items without recreating root filter objects or resetting `lastResetKeyRef`.
* **Verification:** Verify in unit tests that changing a single task's pending state does not alter active filters or trigger unnecessary resets.

### Risk 3: Breaking Bulk Actions Contract & TOCTOU Race Condition
* **Hazard:** If a user selects 10 tasks, opens the review modal, and another user/automation modifies one of those tasks before confirmation, executing blind bulk updates could overwrite concurrent changes.
* **Mitigation:** Snapshot selected task objects at the moment the review dialog opens (`stagedBulkAction: { type, taskIds, targetValue, snapshotVersion }`). If the user confirms, execute against the snapshot and report any concurrent conflict.
* **Verification:** Write Vitest unit tests in `TasksClient-bulk-actions.test.ts` testing the two-phase review and partial failure retry cycle.

### Risk 4: Loss of Density Preference (`task_simple_view`)
* **Hazard:** `TasksClient.tsx` supports a persisted simple view vs detailed view toggle via `localStorage.getItem('task_simple_view')`.
* **Mitigation:** Ensure `<TaskListRow />` supports both `simple` and `detailed` variants, preserving identical layout density, relative time displays, and accessibility.
* **Verification:** Verify both variants in component unit tests.

### Risk 5: False Contract Obligation Completion Claims
* **Hazard:** When a task linked to a contract obligation is completed, displaying "Synced" immediately can mislead users if backend asynchronous processing is still running.
* **Mitigation:** Render "Sync pending" until the server action returns authoritative confirmation of obligation synchronization.

---

## 3. Cross-Feature & Backoffice Impact Analysis

1. **Backoffice Diagnostics & Governance:**
   * Backoffice administrators need visibility into task execution health, bulk operation outcomes, and contract sync status without requiring code changes.
   * By logging structured activity (`userId`, `workspaceId`, `taskId`, `action`, `status`, `obligationSyncStatus`), Backoffice audit trails at `/backoffice` can inspect task throughput, review failed bulk operations, and trigger reconciliation.
2. **CRM Entity & Deal Integrations:**
   * `<TaskRelationshipBadge />` unifies the visual presentation of linked CRM entities across Tasks, Deals, and Entity detail pages, eliminating inconsistent badges.
3. **DocSigning Integration:**
   * Contract obligation tasks clearly communicate their synchronization lifecycle, preventing user confusion when contract clauses are being updated asynchronously.
4. **Automations Engine:**
   * Automation-generated tasks are clearly attributed with `<TaskSourceBadge />`, allowing human operators to distinguish automated protocol interventions from human action items.

---

## 4. File Structure Map

| File Path | Role / Responsibility |
| :--- | :--- |
| `src/app/admin/tasks/components/primitives/TaskStatusBadge.tsx` (NEW) | Reusable status badge with semantic plain-text labels, accessible colors, and optional keyboard dropdown changer. |
| `src/app/admin/tasks/components/primitives/TaskPriorityBadge.tsx` (NEW) | Visual priority indicator subordinate to title, with accessible contrast and Lucide icons. |
| `src/app/admin/tasks/components/primitives/TaskAssignee.tsx` (NEW) | Avatar group with fallback initials, tooltips, and $\ge 44\text{px}$ touch targets. |
| `src/app/admin/tasks/components/primitives/TaskDueDate.tsx` (NEW) | Defensive date badge using `date-utils.ts`, text-based relative time ("Today", "Tomorrow", "Overdue"), safe against `RangeError`. |
| `src/app/admin/tasks/components/primitives/TaskRelationshipBadge.tsx` (NEW) | Contextual badge for CRM records (Institution, Family, Deal, Contract Obligation), with "Sync pending" vs "Synced" status indicator. |
| `src/app/admin/tasks/components/primitives/TaskSourceBadge.tsx` (NEW) | Attribution badge for task creation source (Manual, Automation, AI, System). |
| `src/app/admin/tasks/components/primitives/TaskEmptyState.tsx` (NEW) | Contextual empty state with distinct copy and actions for "No tasks yet" vs "No tasks match filters". |
| `src/app/admin/tasks/components/primitives/TaskErrorState.tsx` (NEW) | Accessible error boundary/fallback card with [ Try again ] and [ View permissions ] actions. |
| `src/app/admin/tasks/components/primitives/TaskSkeleton.tsx` (NEW) | Skeletons for list rows, kanban cards, and calendar view. |
| `src/app/admin/tasks/components/primitives/ConfirmDialog.tsx` (NEW) | Standardized modal confirmation dialog conforming to `theme.md` (Section 8) for destructive actions and bulk reviews. |
| `src/app/admin/tasks/components/TaskListRow.tsx` (NEW) | Scannable, dense list row supporting both simple and detailed density modes, row selection, mutation pending spinner, and keyboard focus. |
| `src/app/admin/tasks/components/BulkActionReviewDialog.tsx` (NEW) | Two-phase review dialog for bulk status, assignment, and deletion with itemized partial-failure breakdown and safe retry. |
| `src/app/admin/tasks/components/TaskCard.tsx` (MODIFY) | Integrate `TaskStatusBadge`, `TaskPriorityBadge`, `TaskDueDate`, `TaskRelationshipBadge`, and inflight mutation pending state. |
| `src/app/admin/tasks/TasksClient.tsx` (MODIFY) | Wire `TaskListRow`, `BulkActionReviewDialog`, and `pendingTaskIds` state, deprecating inline redundant markup. |
| `src/app/admin/tasks/components/__tests__/TaskPrimitives.test.tsx` (NEW) | Unit tests verifying rendering, accessibility, and safe fallbacks for all primitives. |
| `src/app/admin/tasks/components/__tests__/TaskSystemStates.test.tsx` (NEW) | Unit tests for empty states, error states, and modal confirmation dialog. |
| `src/app/admin/tasks/components/__tests__/TaskListRow.test.tsx` (NEW) | Unit tests for `TaskListRow` density modes, selection, and mutation pending spinner. |
| `src/app/admin/tasks/components/__tests__/BulkActionReviewDialog.test.tsx` (NEW) | Unit tests for two-phase review and partial-failure retry workflow. |

---

## 5. Detailed Task Execution Steps

### Task 1: Create Shared Task Metadata Badges & Primitives

**Files:**
- Create: `src/app/admin/tasks/components/primitives/TaskStatusBadge.tsx`
- Create: `src/app/admin/tasks/components/primitives/TaskPriorityBadge.tsx`
- Create: `src/app/admin/tasks/components/primitives/TaskAssignee.tsx`
- Create: `src/app/admin/tasks/components/primitives/TaskDueDate.tsx`
- Create: `src/app/admin/tasks/components/primitives/TaskRelationshipBadge.tsx`
- Create: `src/app/admin/tasks/components/primitives/TaskSourceBadge.tsx`
- Test: `src/app/admin/tasks/components/__tests__/TaskPrimitives.test.tsx`

- [ ] **Step 1: Write unit tests for primitives**
  Write tests covering:
  - `TaskStatusBadge`: Correct label and color class for each `TaskStatus` (`todo`, `in_progress`, `review`, `done`, `cancelled`), ensuring text is never replaced by color alone.
  - `TaskPriorityBadge`: Correct icon and text label for `urgent`, `high`, `medium`, `low`.
  - `TaskAssignee`: Correct display of single user, multiple avatars, overflow badge (`+2`), and unassigned fallback. Touch target $\ge 44\text{px}$.
  - `TaskDueDate`: Correct parsing and rendering of valid date, today, overdue, and graceful null handling without `RangeError`.
  - `TaskRelationshipBadge`: Correct entity label, type icon, and contract obligation sync status indicator (`Sync pending` vs `Synced`).
  - `TaskSourceBadge`: Correct badge for `automation`, `ai`, `system`, and `manual`.

- [ ] **Step 2: Run test to verify failure**
  Run: `pnpm test:run src/app/admin/tasks/components/__tests__/TaskPrimitives.test.tsx`
  Expected: FAIL with module not found.

- [ ] **Step 3: Implement `TaskStatusBadge.tsx`**
  Strict typing, accessible contrast, plain-language text labels, optional dropdown trigger mode for non-drag status change. Leave explanatory comments.

- [ ] **Step 4: Implement `TaskPriorityBadge.tsx`**
  Visual priority indicator using Lucide icons (`AlertCircle`, `ArrowUp`, `ArrowRight`, `ArrowDown`), plain-language text, subdued colors.

- [ ] **Step 5: Implement `TaskAssignee.tsx`**
  Avatar cluster with Radix tooltip, fallback initials, strictly typed `UserProfile` mapping, responsive sizing with touch targets $\ge 44\text{px}$ when interactive.

- [ ] **Step 6: Implement `TaskDueDate.tsx`**
  Powered by `safeParseDate` and `formatTaskDueDate` from `@/lib/utils/date-utils`, explicit text ("Overdue", "Today", "Tomorrow"), never color alone.

- [ ] **Step 7: Implement `TaskRelationshipBadge.tsx`**
  Displays linked CRM entity (Institution, Family, Deal) or DocSigning contract obligation with clickable link and sync indicator.

- [ ] **Step 8: Implement `TaskSourceBadge.tsx`**
  Attribution indicator distinguishing manual, automation, AI, and system-generated tasks.

- [ ] **Step 9: Run tests to verify pass**
  Run: `pnpm test:run src/app/admin/tasks/components/__tests__/TaskPrimitives.test.tsx`
  Expected: PASS (all tests pass).

- [ ] **Step 10: Commit**
  Run:
  ```bash
  git add src/app/admin/tasks/components/primitives/ src/app/admin/tasks/components/__tests__/TaskPrimitives.test.tsx
  git commit -m "feat(tasks): create shared task badges and visual primitives"
  ```

---

### Task 2: Standardized System States & `<ConfirmDialog />`

**Files:**
- Create: `src/app/admin/tasks/components/primitives/TaskEmptyState.tsx`
- Create: `src/app/admin/tasks/components/primitives/TaskErrorState.tsx`
- Create: `src/app/admin/tasks/components/primitives/TaskSkeleton.tsx`
- Create: `src/app/admin/tasks/components/primitives/ConfirmDialog.tsx`
- Test: `src/app/admin/tasks/components/__tests__/TaskSystemStates.test.tsx`

- [ ] **Step 1: Write unit tests for system states & `<ConfirmDialog />`**
  - Verify `TaskEmptyState` renders distinct actions for "first task" vs "filters active" (`[ Clear filters ]`).
  - Verify `TaskErrorState` renders actionable button with `active:scale-[0.97]` and links to relative path.
  - Verify `TaskSkeleton` renders appropriate row and card skeleton layouts.
  - Verify `ConfirmDialog` conforms strictly to `.agents/AGENTS.md` modal architecture (`DialogHeader demarcated`, `CardInfoTooltip`, demarcated footer, tactile buttons).

- [ ] **Step 2: Run test to verify failure**
  Run: `pnpm test:run src/app/admin/tasks/components/__tests__/TaskSystemStates.test.tsx`
  Expected: FAIL with module not found.

- [ ] **Step 3: Implement `TaskEmptyState.tsx`**
  Informative empty state with icon, title, description, and primary CTA button.

- [ ] **Step 4: Implement `TaskErrorState.tsx`**
  Actionable error state with retry callback and optional relative navigation link.

- [ ] **Step 5: Implement `TaskSkeleton.tsx`**
  Skeleton loaders matching final layout shapes (list rows, kanban columns).

- [ ] **Step 6: Implement `ConfirmDialog.tsx`**
  Modal dialog conforming strictly to `theme.md` (Section 8) and `.agents/AGENTS.md`. Demarcated header, single-circle info tooltip, sr-only description, demarcated footer with `rounded-xl active:scale-[0.97]` buttons.

- [ ] **Step 7: Run tests to verify pass**
  Run: `pnpm test:run src/app/admin/tasks/components/__tests__/TaskSystemStates.test.tsx`
  Expected: PASS.

- [ ] **Step 8: Commit**
  Run:
  ```bash
  git add src/app/admin/tasks/components/primitives/ src/app/admin/tasks/components/__tests__/TaskSystemStates.test.tsx
  git commit -m "feat(tasks): implement standardized empty, error, skeleton, and confirm dialogs"
  ```

---

### Task 3: Scannable List Row Component with Mutation Pending State

**Files:**
- Create: `src/app/admin/tasks/components/TaskListRow.tsx`
- Test: `src/app/admin/tasks/components/__tests__/TaskListRow.test.tsx`

- [ ] **Step 1: Write unit tests for `TaskListRow`**
  - Verify rendering in simple density mode (compact row, title, relative date pill, status badge, selection checkbox).
  - Verify rendering in detailed density mode (expanded row, category badge, entity name, tags, assignee avatar).
  - Verify visual mutation pending state (`isPending={true}` disables checkbox and displays `Saving...` / spinner).
  - Verify keyboard accessibility (Enter/Space opens task editor, Space on checkbox toggles selection without opening editor).
  - Verify touch target size $\ge 44\text{px}$.

- [ ] **Step 2: Run test to verify failure**
  Run: `pnpm test:run src/app/admin/tasks/components/__tests__/TaskListRow.test.tsx`
  Expected: FAIL with module not found.

- [ ] **Step 3: Implement `TaskListRow.tsx`**
  - Integrate primitives: `TaskStatusBadge`, `TaskPriorityBadge`, `TaskDueDate`, `TaskAssignee`, `TaskRelationshipBadge`.
  - Support `isSimpleView` prop for density toggling.
  - Implement row selection checkbox with touch target $\ge 44\text{px}$.
  - Support `isPending` prop rendering spinner overlay and disabling concurrent clicks.
  - Support complete button / quick resolution check.
  - Add Emil Kowalski tactile easing (`active:scale-[0.99]`).

- [ ] **Step 4: Run tests to verify pass**
  Run: `pnpm test:run src/app/admin/tasks/components/__tests__/TaskListRow.test.tsx`
  Expected: PASS.

- [ ] **Step 5: Commit**
  Run:
  ```bash
  git add src/app/admin/tasks/components/TaskListRow.tsx src/app/admin/tasks/components/__tests__/TaskListRow.test.tsx
  git commit -m "feat(tasks): create accessible TaskListRow with simple/detailed density and mutation pending states"
  ```

---

### Task 4: Card & Row Inflight Mutation State & Contract Obligation Sync Status

**Files:**
- Modify: `src/app/admin/tasks/components/TaskCard.tsx`
- Modify: `src/app/admin/tasks/components/TaskBoard.tsx`
- Test: `src/app/admin/tasks/components/__tests__/TaskCard-mutation-feedback.test.tsx`

- [ ] **Step 1: Write tests for `TaskCard` pending mutation feedback & obligation sync status**
  - Verify that when `isPending={true}`, `TaskCard` displays an accessible pending indicator and prevents duplicate drag or clicks.
  - Verify that contract obligation tasks show a "Sync pending" badge if obligation fulfillment is awaiting confirmation, or "Synced" when completed.

- [ ] **Step 2: Run test to verify failure**
  Run: `pnpm test:run src/app/admin/tasks/components/__tests__/TaskCard-mutation-feedback.test.tsx`
  Expected: FAIL.

- [ ] **Step 3: Upgrade `TaskCard.tsx`**
  - Integrate `TaskStatusBadge`, `TaskPriorityBadge`, `TaskDueDate`, and `TaskRelationshipBadge`.
  - Add `isPending?: boolean` prop with subtle `Saving...` spinner indicator.
  - Render contract obligation synchronization status with explicit "Sync pending" vs "Synced" states.
  - Ensure touch targets adhere to `min-h-[44px]`.

- [ ] **Step 4: Update `TaskBoard.tsx`**
  - Pass `pendingTaskIds.has(task.id)` down to `TaskCard` via `TaskColumn`.
  - Maintain `pendingTaskIds` state during `updateTaskAction` execution to provide visual feedback.

- [ ] **Step 5: Run tests to verify pass**
  Run: `pnpm test:run src/app/admin/tasks/components/__tests__/TaskCard-mutation-feedback.test.tsx src/app/admin/tasks/components/__tests__/TaskBoard-mutation.test.tsx`
  Expected: PASS.

- [ ] **Step 6: Commit**
  Run:
  ```bash
  git add src/app/admin/tasks/components/TaskCard.tsx src/app/admin/tasks/components/TaskBoard.tsx src/app/admin/tasks/components/__tests__/TaskCard-mutation-feedback.test.tsx
  git commit -m "feat(tasks): add visual pending states and contract sync status to TaskCard and TaskBoard"
  ```

---

### Task 5: Two-Phase Bulk Action Review & Partial Failure Retry Flow

**Files:**
- Create: `src/app/admin/tasks/components/BulkActionReviewDialog.tsx`
- Test: `src/app/admin/tasks/components/__tests__/BulkActionReviewDialog.test.tsx`

- [ ] **Step 1: Write unit tests for `BulkActionReviewDialog`**
  - Test status change review: displays action name, target status, and count of selected tasks.
  - Test destructive delete review: requires explicit confirmation with red destructive CTA and impact explanation.
  - Test partial failure display: shows succeeded count and failed task list with error reasons and a [ Retry Failed Tasks ] button.
  - Verify approval snapshot binding: confirms exact payload and selection snapshot.

- [ ] **Step 2: Run test to verify failure**
  Run: `pnpm test:run src/app/admin/tasks/components/__tests__/BulkActionReviewDialog.test.tsx`
  Expected: FAIL with module not found.

- [ ] **Step 3: Implement `BulkActionReviewDialog.tsx`**
  - Adhere strictly to Modal Architecture in `.agents/AGENTS.md` (Demarcated header, `CardInfoTooltip`, demarcated footer, tactile buttons).
  - Support review stage: action name, affected task count, preview of first 5 titles.
  - Support executing stage: loading spinner, progress indicator.
  - Support partial failure stage: list failed tasks, offer retry for safe items.

- [ ] **Step 4: Run tests to verify pass**
  Run: `pnpm test:run src/app/admin/tasks/components/__tests__/BulkActionReviewDialog.test.tsx`
  Expected: PASS.

- [ ] **Step 5: Commit**
  Run:
  ```bash
  git add src/app/admin/tasks/components/BulkActionReviewDialog.tsx src/app/admin/tasks/components/__tests__/BulkActionReviewDialog.test.tsx
  git commit -m "feat(tasks): create BulkActionReviewDialog with two-phase review and partial-failure retry"
  ```

---

### Task 6: Refactor `TasksClient.tsx` to Use Primitives, Pending State & Bulk Review

**Files:**
- Modify: `src/app/admin/tasks/TasksClient.tsx`
- Test: `src/app/admin/tasks/__tests__/TasksClient-toolbar-filters.test.ts`
- Test: `src/app/admin/tasks/__tests__/TasksClient-bulk-actions.test.ts`
- Test: `src/app/admin/tasks/__tests__/TasksClient-scoping.test.ts`

- [ ] **Step 1: Wire `TaskListRow` into List View**
  - Replace the 400+ lines of inline list rows in `TasksClient.tsx` with `<TaskListRow />`.
  - Pass `isSimpleView`, selection state, `isPending`, and event handlers.
  - Ensure zero change to grouping accordions (Current, Overdue, Upcoming, Resolved).

- [ ] **Step 2: Wire `pendingTaskIds` state**
  - Add `const [pendingTaskIds, setPendingTaskIds] = React.useState<Set<string>>(new Set());`.
  - When a task mutation begins (quick resolve, status dropdown, editor save), add task ID to `pendingTaskIds`.
  - Remove from `pendingTaskIds` when mutation resolves or fails.
  - Pass `pendingTaskIds` to `TaskBoard` and `TaskListRow`.

- [ ] **Step 3: Wire `BulkActionReviewDialog`**
  - Replace browser-native prompts and direct bulk execution with `BulkActionReviewDialog`.
  - On confirm, execute atomic `bulkUpdateTasksAction`.
  - If partial failure occurs, pass failed items into dialog for retry review.

- [ ] **Step 4: Wire `TaskEmptyState`, `TaskErrorState`, and `TaskSkeleton`**
  - Replace raw empty state strings with `<TaskEmptyState />` providing "Clear filters" or "Create task" CTA.
  - Replace raw loading indicators with `<TaskSkeleton />`.

- [ ] **Step 5: Run all task test suites to verify zero regressions**
  Run: `pnpm test:run src/lib/utils/__tests__/date-utils.test.ts src/platform/domains/tasks_productivity/contracts/__tests__/task-contracts.test.ts src/app/admin/tasks/components/__tests__/ src/app/admin/tasks/__tests__/`
  Expected: PASS (all tests pass).

- [ ] **Step 6: Commit**
  Run:
  ```bash
  git add src/app/admin/tasks/TasksClient.tsx
  git commit -m "refactor(tasks): wire reusable primitives, mutation pending locks, and bulk review dialog into TasksClient"
  ```

---

### Task 7: Quality Gates, TypeScript Verification & Lint Cleanliness

**Files:**
- All task-related files

- [ ] **Step 1: Run complete task test suites**
  Run: `pnpm test:run src/lib/utils/__tests__/date-utils.test.ts src/platform/domains/tasks_productivity/contracts/__tests__/task-contracts.test.ts src/app/admin/tasks/components/__tests__/ src/app/admin/tasks/__tests__/`
  Expected: PASS.

- [ ] **Step 2: Verify zero `any` or `any[]`**
  Run: `grep -rn -E ":\s*any\b|<any>|any\[\]" src/app/admin/tasks/components/ src/lib/utils/date-utils.ts src/app/admin/tasks/TasksClient.tsx`
  Expected: 0 TypeScript type occurrences.

- [ ] **Step 3: Run repository-wide TypeScript check**
  Run: `pnpm typecheck`
  Expected: Exit code 0.

- [ ] **Step 4: Run ESLint**
  Run: `pnpm eslint src/app/admin/tasks/ src/lib/utils/date-utils.ts`
  Expected: 0 errors, 0 warnings.

- [ ] **Step 5: Commit quality gate verification**
  Run:
  ```bash
  git commit --allow-empty -m "chore(tasks): verify Phase 1 quality gates, typing, and test suites"
  ```

---

## 6. Execution Handoff & Approval Gate

This plan is complete and saved to `docs/superpowers/plans/2026-10-09-tasks-phase-1-ui-foundations-and-trustworthy-feedback.md`.

**In strict adherence to instructions, execution will NOT begin until you review and approve this plan.**
