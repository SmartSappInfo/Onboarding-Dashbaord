# Tasks Phase 1: Security & Unified Mutation Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remediate critical security vulnerabilities and eliminate client-side Firestore mutation bypasses across the Tasks module, establishing `task-core.ts` as the single canonical mutation engine for all UI surfaces, background automations, and external MCP tools in strict compliance with `agents_mcp_rules.md`.

**Architecture:** 
1. Isolate bulk creation logic into a secure, non-`'use server'` library module (`src/lib/tasks/task-bulk-core.ts`), protecting the public HTTP callable action (`bulkCreateTasksAction`) with session authentication, workspace boundary enforcement (`requireWorkspace`), and RBAC verification (`canUser`).
2. Eliminate client-side Firestore SDK mutations in `TaskBoard.tsx`, `TaskWidget.tsx`, and `entities/[id]/page.tsx` by routing all state changes through `updateTaskAction` / `task-core.ts`, equipping Kanban drag-and-drop with optimistic UI rollback on rejection.
3. Rewire automation task updates (`handleUpdateTask`) to route through `updateTaskCore` under a system actor, ensuring tenant containment, immutable field stripping, activity logging, and the bi-directional contract obligation reverse hook (`syncTaskCompletionToObligation`).
4. Enforce strict typing (zero `any`, runtime Zod schema validation at trust boundaries), batch resource protection ($\le 450$ chunking), TOCTOU concurrency resilience, and mobile accessibility ($\ge 44\text{px}$ touch targets).

**Tech Stack:** Next.js Server Actions, Firebase Admin SDK & Client Firestore, Zod runtime schemas, Vitest, TypeScript (Strict zero-`any`).

---

## 1. `agents_mcp_rules.md` Compliance Matrix

| Rule # | Requirement from `agents_mcp_rules.md` | Phase 1 Implementation Guard |
| :--- | :--- | :--- |
| **Rule 1** | Conform to best-practice skills (`next-best-practices`, `vercel-react-best-practices`, `emilkowal-animations`, `frontend-design`, `backend-design`). | • All Server Actions authenticate and authorize independently.<br>• Client components use Emil Kowalski tactile easing (`active:scale-[0.97]`, `<250ms` transitions).<br>• Clear domain/presentation boundary separation. |
| **Rule 2** | Pre-mortem: Analyze what could go wrong and how to resolve it before coding. Run tests, typecheck, lint, local commit only (no push to remote). | Section 2 below details failure modes, race conditions, edge cases, and mitigation strategies. Local commit only. |
| **Rule 3** | Impact analysis: What other features/callers will be affected? How is backoffice diagnostics impacted? | Section 3 inventories all callers (`message-status-automations.ts`, `server-action-guard-baseline.json`, `TaskWidget.tsx`, `entities/[id]/page.tsx`, `task-actions.ts`). |
| **Rule 4** | **Zero `any`, `any[]`, or unchecked casts**. `unknown` only at external trust boundaries, immediately narrowed with Zod schemas. | Input schemas defined with Zod (`BulkTaskCreationInputSchema`). Explicit typing on all handlers and return types. Zero `any`. |
| **Rule 5** | Staged validation: test, verify, no premature automated production deployment. | All changes verified via unit tests, security sweeps, typecheck, and lint before committing locally. |
| **Rule 6** | Dependencies & documentation: check dependencies and get latest documentation. | Uses existing Next.js, Firebase Admin, and Zod dependencies without introducing redundant libraries. |
| **Rule 7** | Mobile optimization: touch targets $\ge 44\text{px}$, responsive gestures, clear plain UI English. | Kanban action triggers, error toasts, and bulk action buttons adhere to `min-h-[44px]` with plain, helpful language. |
| **Rule 8** | High security standards: eliminate open endpoints, enforce session + workspace boundary + RBAC checks. | • VULN-01 resolved: `bulkCreateTasksActionCore` moved to non-`'use server'` library.<br>• `bulkCreateTasksAction` enforces `requireAuth()`, `requireWorkspace(data.workspaceId)`, and `canUser()`. |
| **Rule 9 & 23** | Load & Resource Governance: Avoid batch overload, data overload, resource exhaustion. | • Batch writes chunked into slices of $\le 450$ records (under Firestore 500-operation ceiling).<br>• Concurrency limits on parallel operations. |
| **Rule 10** | Inline architectural documentation: leave clear comments explaining what changed, why, caution areas, testability pointers. | All new and modified functions documented with explanatory inline comments for future maintainers. |
| **Rule 12** | Annotations are hints, not security controls; server-side enforcement. | Server-side authorization check executes regardless of caller metadata. |
| **Rule 13** | Trust Boundary Matrix: classify data entering the system. | External HTTP payloads treated as `UNTRUSTED_EXTERNAL` and parsed through Zod before domain logic. |
| **Rule 16** | Agent Identity as First-Class Security Principal (`TaskActor`). | Differentiates `{ kind: 'user', uid }` (checked via `canUser`) from `{ kind: 'system', source }` (scoped server authority). |
| **Rule 18** | Time-of-Check / Time-of-Use (TOCTOU) protection. | Optimistic UI in `TaskBoard.tsx` rolls back immediately if server mutation is rejected or encounters version conflict. |
| **Rule 19 & 20** | Idempotency & Replay Protection. | Task mutations and obligation completions are idempotent; retries do not duplicate audit logs or clause fulfillment. |
| **Rule 21 & 22** | Two-Phase Action Model & Approval Binding for destructive operations. | Bulk delete and bulk complete actions require confirmation modals with explicit record counts before execution. |

---

## 2. Risk & Failure Mode Analysis (Pre-Mortem)

### Risk 1: Automation Engine Breakage on Message Status Changes
* **Hazard:** `src/lib/automations/message-status-automations.ts` directly imported `bulkCreateTasksActionCore` from `../../app/actions/bulk-task-actions`. Removing the export would break message automations.
* **Mitigation:** Extract `bulkCreateTasksCore` into `src/lib/tasks/task-bulk-core.ts`. Rewire `message-status-automations.ts` to import from `@/lib/tasks/task-bulk-core`, invoking with `{ kind: 'system', source: 'automation' }`.
* **Verification:** Run `pnpm test:run src/lib/__tests__/message-status-automations.test.ts`.

### Risk 2: Server Action Security Guard Baseline Test Failure
* **Hazard:** `src/platform/__tests__/security/server-action-guard-sweep.test.ts` scans all `'use server'` files against `server-action-guard-baseline.json`. If `bulkCreateTasksActionCore` is removed from the code but remains in the baseline (or vice versa), the test fails.
* **Mitigation:** Update `server-action-guard-baseline.json` synchronously with the code change.
* **Verification:** Run `pnpm test:run src/platform/__tests__/security/server-action-guard-sweep.test.ts`.

### Risk 3: Kanban Card "Ghost Drop" on Network or Permission Failure
* **Hazard:** If a user drags a task on the Kanban board and the network fails or permission is denied, an unhandled optimistic UI leaves the card in the wrong column while Firestore rejects it.
* **Mitigation:** Implement strict state rollback. If `updateTaskAction` returns `{ success: false }`, immediately restore the task's previous column in `localTasks` and show an actionable destructive toast with a retry / permissions link.

### Risk 4: Contract Obligation Silent De-Synchronization
* **Hazard:** When tasks linked to DocSigning contracts are marked `done` via Kanban drag-and-drop, dashboard widgets, or automation, direct Firestore mutations previously bypassed `syncTaskCompletionToObligation`.
* **Mitigation:** Route all updates through `updateTaskCore`. When `status === 'done'`, verify that `syncTaskCompletionToObligation` is invoked and the activity feed is updated.

### Risk 5: Firestore Batch Limit Overflow in Bulk Creation
* **Hazard:** Creating tasks for $>500$ entities in a single call exceeds the Firestore 500-operation limit per batch commit, throwing an unhandled exception.
* **Mitigation:** Chunk incoming entity arrays into blocks of $\le 450$ records, executing sequential batch commits safely.

---

## 3. Cross-Feature & Backoffice Impact Analysis

1. **Automations Engine:**
   * `handleUpdateTask` in `src/lib/automations/actions/task-actions.ts` is upgraded from raw `doc().update()` to `updateTaskCore()`. No existing automation configurations are broken; automations now gain activity logging and contract sync.
2. **Dashboard Widgets:**
   * `TaskWidget.tsx` replaces fire-and-forget `completeTaskNonBlocking` with canonical `updateTaskAction`, ensuring dashboard completions trigger obligation fulfillment.
3. **CRM Contact/Entity Detail Pages:**
   * `src/app/admin/entities/[id]/page.tsx` switches from `completeTaskNonBlocking` to `updateTaskAction`.
4. **Backoffice Diagnostics:**
   * Backoffice audit logs now capture all task updates consistently because `updateTaskCore` logs to the activity stream, giving administrators complete visibility into task resolutions.

---

## 4. File Structure Map

| File Path | Role / Responsibility |
| :--- | :--- |
| `src/lib/tasks/task-bulk-core.ts` (NEW) | Canonical bulk task creation domain service. Validates Zod inputs, chunks batches ($\le 450$), respects actor boundaries, enforces tenant containment, strictly typed (zero `any`). |
| `src/app/actions/bulk-task-actions.ts` (MODIFY) | Public Server Action gateway. Strips `bulkCreateTasksActionCore` export to eliminate VULN-01. Secures `bulkCreateTasksAction` with `requireAuth()`, `requireWorkspace()`, and `canUser()`. |
| `src/platform/__tests__/security/server-action-guard-baseline.json` (MODIFY) | Removes `bulkCreateTasksActionCore` from the legacy exemption baseline now that it is secured. |
| `src/lib/automations/message-status-automations.ts` (MODIFY) | Updates automation bulk task creation caller to invoke `bulkCreateTasksCore` directly with system actor `{ kind: 'system', source: 'automation' }`. |
| `src/lib/automations/actions/task-actions.ts` (MODIFY) | Rewires `handleUpdateTask` from direct Firestore updates to `updateTaskCore` with `{ kind: 'system', source: 'automation' }`. |
| `src/app/admin/tasks/components/TaskBoard.tsx` (MODIFY) | Replaces `updateTaskNonBlocking` with `updateTaskAction`. Adds optimistic drag-and-drop state rollback on error, actionable error toasts, and contract-obligation completion feedback. |
| `src/components/dashboard/TaskWidget.tsx` (MODIFY) | Replaces `completeTaskNonBlocking` with canonical `updateTaskAction` with error handling and actionable toast navigation. |
| `src/app/admin/entities/[id]/page.tsx` (MODIFY) | Replaces `completeTaskNonBlocking` with canonical `updateTaskAction`. |
| `src/lib/task-actions.ts` (MODIFY) | Adds deprecation warnings to client SDK direct mutations, routing callers toward server actions. |
| `src/app/admin/tasks/TasksClient.tsx` (MODIFY) | Refactors bulk status and assignment actions to use atomic `bulkUpdateTasksAction`, adding accurate partial-failure feedback. |
| `src/lib/tasks/__tests__/task-bulk-core.test.ts` (NEW) | Comprehensive unit tests for bulk creation core, input validation, chunking, and tenant isolation. |
| `src/app/actions/__tests__/bulk-task-actions-security.test.ts` (NEW) | Security tests for `bulkCreateTasksAction` verifying cross-workspace rejection, anonymous caller rejection, and permission enforcement. |
| `src/lib/automations/__tests__/automation-task-update-core.test.ts` (NEW) | Integration tests verifying automation updates route through `updateTaskCore` and trigger contract obligation hooks. |
| `src/app/admin/tasks/components/__tests__/TaskBoard-mutation.test.tsx` (NEW) | Component tests verifying Kanban optimistic UI drag-and-drop, server error rollback, and contract obligation notifications. |

---

## 5. Detailed Task Execution Steps

### Task 1: Isolate Bulk Task Creation Core & Secure Server Action (VULN-01 Remediation)

**Files:**
- Create: `src/lib/tasks/task-bulk-core.ts`
- Modify: `src/app/actions/bulk-task-actions.ts`
- Modify: `src/lib/automations/message-status-automations.ts:270-280`
- Modify: `src/platform/__tests__/security/server-action-guard-baseline.json:40-42`
- Test: `src/lib/tasks/__tests__/task-bulk-core.test.ts`
- Test: `src/app/actions/__tests__/bulk-task-actions-security.test.ts`

- [ ] **Step 1: Write failing security & domain tests for bulk task creation**
Create `src/lib/tasks/__tests__/task-bulk-core.test.ts` asserting:
1. Validates input schema via Zod (rejects invalid priority, missing title, empty entityIds).
2. Chunks batches safely ($\le 450$ per Firestore batch limit of 500).
3. Injects tenant boundary (`workspaceId`, `organizationId`) and populates `Task` schema without `any`.
4. Rejects callers when actor is a user without permission or targeting an unauthorized workspace.

Create `src/app/actions/__tests__/bulk-task-actions-security.test.ts` asserting:
1. Anonymous caller throws unauthenticated error.
2. Authenticated user targeting a foreign workspace (`workspace_B` when user only has membership in `workspace_A`) throws workspace access denied.
3. User without `operations:tasks:create` permission throws permission denied.
4. `bulkCreateTasksActionCore` is NOT exported as a Server Action.

- [ ] **Step 2: Run test to verify it fails**
```bash
pnpm test:run src/lib/tasks/__tests__/task-bulk-core.test.ts src/app/actions/__tests__/bulk-task-actions-security.test.ts
```
Expected: FAIL (modules/functions do not exist or fail assertions).

- [ ] **Step 3: Implement `src/lib/tasks/task-bulk-core.ts`**
Create `src/lib/tasks/task-bulk-core.ts` (NOT marked with `'use server'`):
- Define `BulkTaskCreationDataSchema` using Zod for strict runtime validation.
- Accept `(data: BulkTaskCreationData, actor: TaskActor)`.
- Enforce `checkPermission(actor, 'create', data.workspaceId)` from `task-core.ts`.
- Chunk `entityIds` by 450 max per batch.
- Batch write to `tasks` collection with complete typed `Task` attributes (`id`, `workspaceId`, `organizationId`, `status: 'todo'`, `priority`, `createdAt`, `updatedAt`, `reminders: []`, `reminderSent: false`, `source: actor.kind === 'system' ? 'automation' : 'manual'`).
- Return `{ success: true, count: number, message: string }`.

- [ ] **Step 4: Refactor `src/app/actions/bulk-task-actions.ts`**
- Remove `export async function bulkCreateTasksActionCore` entirely from `'use server'` module.
- In `bulkCreateTasksAction(data: BulkTaskCreationData)`:
  - Enforce `const session = await requireAuth();`
  - Enforce `await requireWorkspace(data.workspaceId);`
  - Enforce `const perm = await canUser(session.uid, 'operations', 'tasks', 'create', data.workspaceId);`
  - If not granted, return `{ success: false, error: perm.reason ?? 'Permission denied.' }`.
  - Delegate execution to `bulkCreateTasksCore(data, { kind: 'user', uid: session.uid })`.

- [ ] **Step 5: Update internal automation caller & baseline**
- In `src/lib/automations/message-status-automations.ts:273`, import `bulkCreateTasksCore` from `@/lib/tasks/task-bulk-core` and invoke with actor `{ kind: 'system', source: 'automation' }`.
- In `src/platform/__tests__/security/server-action-guard-baseline.json`, remove the line `"src/app/actions/bulk-task-actions.ts#bulkCreateTasksActionCore"`.

- [ ] **Step 6: Run tests to verify they pass**
```bash
pnpm test:run src/lib/tasks/__tests__/task-bulk-core.test.ts src/app/actions/__tests__/bulk-task-actions-security.test.ts src/platform/__tests__/security/server-action-guard-sweep.test.ts
```
Expected: PASS (0 errors, sweep clean).

- [ ] **Step 7: Commit Task 1**
```bash
git add src/lib/tasks/task-bulk-core.ts src/app/actions/bulk-task-actions.ts src/lib/automations/message-status-automations.ts src/platform/__tests__/security/server-action-guard-baseline.json src/lib/tasks/__tests__/task-bulk-core.test.ts src/app/actions/__tests__/bulk-task-actions-security.test.ts
git commit -m "security(tasks): isolate bulkCreateTasksCore and secure bulkCreateTasksAction server action"
```

---

### Task 2: Guard Automation Task Updates (VULN-02 Remediation)

**Files:**
- Modify: `src/lib/automations/actions/task-actions.ts:47-63`
- Test: `src/lib/automations/__tests__/automation-task-update-core.test.ts`

- [ ] **Step 1: Write failing test for automation task update through canonical core**
Create `src/lib/automations/__tests__/automation-task-update-core.test.ts`:
1. Verify `handleUpdateTask` calls `updateTaskCore` with `{ kind: 'system', source: 'automation' }`.
2. Verify update strips immutable fields (`id`, `workspaceId`, `createdAt`).
3. Verify that updating a task with `status: 'done'` logs activity and invokes `syncTaskCompletionToObligation` if the task is linked to a contract obligation.
4. Verify error is thrown if task does not belong to context workspace.

- [ ] **Step 2: Run test to verify it fails**
```bash
pnpm test:run src/lib/automations/__tests__/automation-task-update-core.test.ts
```
Expected: FAIL (currently calls direct Firestore `update()` without core validation or obligation hooks).

- [ ] **Step 3: Refactor `handleUpdateTask` in `src/lib/automations/actions/task-actions.ts`**
- Import `updateTaskCore` from `@/lib/tasks/task-core`.
- In `handleUpdateTask`:
  - Extract `taskId = (config.taskId as string) || (config.useTriggerTaskId ? (context.payload.taskId as string) : undefined)`.
  - Build typed `updates: Partial<Task>` safely (`status`, `assignedTo`, `priority`).
  - Call `updateTaskCore(taskId, updates, { kind: 'system', source: 'automation' })`.
  - If `!res.success`, throw new Error(`[Automation] Failed to update task: ${res.error}`).

- [ ] **Step 4: Run test to verify it passes**
```bash
pnpm test:run src/lib/automations/__tests__/automation-task-update-core.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit Task 2**
```bash
git add src/lib/automations/actions/task-actions.ts src/lib/automations/__tests__/automation-task-update-core.test.ts
git commit -m "fix(automations): route handleUpdateTask through updateTaskCore with contract obligation sync"
```

---

### Task 3: Eliminate Client Firestore Mutations in Kanban Board (`TaskBoard.tsx`)

**Files:**
- Modify: `src/app/admin/tasks/components/TaskBoard.tsx`
- Test: `src/app/admin/tasks/components/__tests__/TaskBoard-mutation.test.tsx`

- [ ] **Step 1: Write failing component test for TaskBoard mutation & optimistic rollback**
Create `src/app/admin/tasks/components/__tests__/TaskBoard-mutation.test.tsx`:
1. Render `TaskBoard` with mock tasks.
2. Drag task from `todo` to `in_progress`.
3. Verify `updateTaskAction` is called with `taskId` and `{ status: 'in_progress' }`.
4. Mock rejection from `updateTaskAction` (`{ success: false, error: 'Permission denied.' }`).
5. Verify state rolls back (task returns to `todo` column) and destructive toast with `actionConfig: { path: '/admin/settings/permissions', label: 'View Permissions' }` is fired.
6. Drag task to `done` that has `relatedParentId` and `relatedEntityId`. Verify completion toast displays contract obligation sync notice: `"✓ Task completed · Contract obligation updated"`.

- [ ] **Step 2: Run test to verify it fails**
```bash
pnpm test:run src/app/admin/tasks/components/__tests__/TaskBoard-mutation.test.tsx
```
Expected: FAIL (currently calls `updateTaskNonBlocking` from client SDK).

- [ ] **Step 3: Refactor `TaskBoard.tsx` to use canonical Server Action with rollback**
- Remove `import { updateTaskNonBlocking } from '@/lib/task-actions';`.
- Import `updateTaskAction` from `@/lib/task-server-actions`.
- In `handleDragEnd`:
  - Capture `previousStatus = activeTaskItem.status` and `targetStatus = currentLocalTask.status`.
  - Set optimistic local task state.
  - Await `res = await updateTaskAction(activeId, { status: targetStatus })`.
  - If `!res.success`:
    - Rollback local state: `setLocalTasks(prev => prev.map(t => t.id === activeId ? { ...t, status: previousStatus } : t))`.
    - Trigger error toast:
      ```ts
      toast({
        variant: 'destructive',
        title: "Couldn't update task",
        description: res.error || 'The task was not moved.',
        actionConfig: { path: '/admin/settings/permissions', label: 'View Permissions' }
      });
      ```
  - If `res.success`:
    - Check if `targetStatus === 'done' && activeTaskItem.relatedParentId && activeTaskItem.relatedEntityId`:
      ```ts
      toast({
        title: '✓ Task Completed',
        description: 'Task resolved and linked contract obligation synchronized.'
      });
      ```
    - Else show standard success toast.

- [ ] **Step 4: Run test to verify it passes**
```bash
pnpm test:run src/app/admin/tasks/components/__tests__/TaskBoard-mutation.test.tsx
```
Expected: PASS.

- [ ] **Step 5: Commit Task 3**
```bash
git add src/app/admin/tasks/components/TaskBoard.tsx src/app/admin/tasks/components/__tests__/TaskBoard-mutation.test.tsx
git commit -m "fix(tasks): eliminate client Firestore mutations in TaskBoard with optimistic rollback"
```

---

### Task 4: Eliminate Client Firestore Mutations in Dashboard & Entity Detail Pages

**Files:**
- Modify: `src/components/dashboard/TaskWidget.tsx`
- Modify: `src/app/admin/entities/[id]/page.tsx`
- Modify: `src/lib/task-actions.ts`
- Test: `src/components/dashboard/__tests__/TaskWidget-mutation.test.tsx`

- [ ] **Step 1: Write failing component test for TaskWidget canonical completion**
Create `src/components/dashboard/__tests__/TaskWidget-mutation.test.tsx`:
1. Render `TaskWidget` with sample tasks.
2. Click complete on a task.
3. Verify `updateTaskAction(id, { status: 'done' })` is called.
4. Verify error toast on failure.

- [ ] **Step 2: Run test to verify it fails**
```bash
pnpm test:run src/components/dashboard/__tests__/TaskWidget-mutation.test.tsx
```
Expected: FAIL.

- [ ] **Step 3: Refactor `TaskWidget.tsx` and `entities/[id]/page.tsx`**
- In `src/components/dashboard/TaskWidget.tsx`:
  - Replace `completeTaskNonBlocking` with `updateTaskAction(id, { status: 'done' })` from `@/lib/task-server-actions`.
  - Add toast feedback on success and failure with actionable navigation.
- In `src/app/admin/entities/[id]/page.tsx`:
  - Replace `completeTaskNonBlocking(firestore, taskId)` with `updateTaskAction(taskId, { status: 'done' })`.
  - Add toast error handling with `actionConfig`.
- In `src/lib/task-actions.ts`:
  - Deprecate `updateTaskNonBlocking` and `completeTaskNonBlocking` with `@deprecated` docstrings explaining why all mutations must route through `task-server-actions.ts` / `task-core.ts`.

- [ ] **Step 4: Run tests to verify they pass**
```bash
pnpm test:run src/components/dashboard/__tests__/TaskWidget-mutation.test.tsx
```
Expected: PASS.

- [ ] **Step 5: Commit Task 4**
```bash
git add src/components/dashboard/TaskWidget.tsx src/app/admin/entities/\[id\]/page.tsx src/lib/task-actions.ts src/components/dashboard/__tests__/TaskWidget-mutation.test.tsx
git commit -m "fix(tasks): eliminate client mutations in TaskWidget and EntityDetail page"
```

---

### Task 5: Refactor Bulk Actions to Atomic Batches & Precise Partial Failure Reporting

**Files:**
- Modify: `src/lib/task-server-actions.ts:101-126`
- Modify: `src/app/admin/tasks/TasksClient.tsx:780-845`
- Test: `src/app/admin/tasks/__tests__/TasksClient-bulk-actions.test.ts`

- [ ] **Step 1: Write failing test for bulk actions batching and partial failure representation**
Create `src/app/admin/tasks/__tests__/TasksClient-bulk-actions.test.ts`:
1. Verify `handleBulkAssign` calls `bulkUpdateTasksAction(selectedIds, { assignedTo: [userId] }, workspaceId)`.
2. Verify `handleBulkChangeStatus` calls `bulkUpdateTasksAction(selectedIds, { status }, workspaceId)`.
3. Verify that if status is `'done'`, `bulkUpdateTasksAction` triggers `syncTaskCompletionToObligation` for any linked contract tasks.
4. Verify partial failure UX: displays exact count of succeeded and failed tasks with action link.

- [ ] **Step 2: Run test to verify it fails**
```bash
pnpm test:run src/app/admin/tasks/__tests__/TasksClient-bulk-actions.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Update `bulkUpdateTasksAction` in `src/lib/task-server-actions.ts`**
- In `bulkUpdateTasksAction`:
  - When `updates.status === 'done'`, query stored tasks to check if any have `relatedParentId` and `relatedEntityId`.
  - Fulfill contract obligations via `syncTaskCompletionToObligation` for linked tasks.
  - Return `{ success: true, count: number }` or detailed partial outcome if applicable.

- [ ] **Step 4: Refactor bulk handlers in `TasksClient.tsx`**
- In `TasksClient.tsx`:
  - Refactor `handleBulkAssign`: Replace `Promise.all` loop with single `await bulkUpdateTasksAction(selectedIds, { assignedTo: [userId] }, activeWorkspaceId)`.
  - Refactor `handleBulkChangeStatus`: Replace `Promise.all` loop with single `await bulkUpdateTasksAction(selectedIds, { status }, activeWorkspaceId)`.
  - Refactor `handleBulkPostpone`: Process in atomic chunks or batch action.
  - Add actionable partial failure notifications when some tasks fail.

- [ ] **Step 5: Run tests to verify they pass**
```bash
pnpm test:run src/app/admin/tasks/__tests__/TasksClient-bulk-actions.test.ts
```
Expected: PASS.

- [ ] **Step 6: Commit Task 5**
```bash
git add src/lib/task-server-actions.ts src/app/admin/tasks/TasksClient.tsx src/app/admin/tasks/__tests__/TasksClient-bulk-actions.test.ts
git commit -m "perf(tasks): refactor bulk actions to atomic batches with partial failure reporting"
```

---

### Task 6: Comprehensive Security Sweep, Full Test Matrix & Gate Verification

**Files:**
- Test: All task test suites + security sweep

- [ ] **Step 1: Run complete Task & Security test suites**
```bash
pnpm test:run src/lib/tasks/__tests__/task-bulk-core.test.ts src/app/actions/__tests__/bulk-task-actions-security.test.ts src/lib/automations/__tests__/automation-task-update-core.test.ts src/app/admin/tasks/components/__tests__/TaskBoard-mutation.test.tsx src/components/dashboard/__tests__/TaskWidget-mutation.test.tsx src/app/admin/tasks/__tests__/TasksClient-bulk-actions.test.ts src/platform/__tests__/security/server-action-guard-sweep.test.ts
```
Expected: All tests PASS.

- [ ] **Step 2: Run all workspace visibility and CRM test suites**
```bash
pnpm test:run src/test/unit/workspace-visibility-types.test.ts src/lib/__tests__/workspace-admin-utils.test.ts src/lib/hooks/__tests__/use-workspace-visibility.test.tsx src/lib/__tests__/widget-registry-access.test.ts src/app/admin/components/__tests__/AdminSidebar-visibility.test.tsx src/app/admin/settings/components/__tests__/WorkspaceRegionalTab-visibility.test.tsx src/app/admin/tasks/__tests__/TasksClient-scoping.test.ts src/app/admin/pipeline/__tests__/PipelineClient-scoping.test.ts src/app/admin/pipeline/utils/filter-deals.test.ts "src/app/(backoffice)/backoffice/workspaces/__tests__/workspace-detail-governance.test.ts" src/lib/mcp/__tests__/mcp-visibility-scoping.test.ts
```
Expected: All 11 suites (37 tests) PASS.

- [ ] **Step 3: Run TypeScript strict typecheck**
```bash
pnpm typecheck
```
Expected: 0 errors.

- [ ] **Step 4: Run ESLint**
```bash
pnpm lint
```
Expected: 0 errors.

- [ ] **Step 5: Verify git status and commit final phase 1 checkpoint**
Verify only intended files were modified. Ensure NO push to remote.
```bash
git log -n 5 --oneline
```
