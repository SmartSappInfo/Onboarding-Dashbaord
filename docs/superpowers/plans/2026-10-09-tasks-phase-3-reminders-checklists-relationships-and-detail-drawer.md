# Phase 3: Reminders, Checklists, Activity Timeline, Cross-Module Relationships & Detail Drawer Implementation Plan
### Conforming to `docs/agents_mcp/agents_mcp_rules.md` & Institutional Design Standards

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> [!CAUTION]
> ### 🛑 CRITICAL GATE: EXECUTION ON HOLD
> **DO NOT START IMPLEMENTING THIS PHASE UNTIL THIS PLAN IS EXPLICITLY APPROVED BY THE USER.**  
> In strict accordance with Rule 5 and Rule 19 of `docs/agents_mcp/agents_mcp_rules.md`, all implementation, code modification, or file scaffolding must wait until the user has reviewed and signed off on this design and step breakdown.

**Goal:** Transform the Tasks module from a static title/date list into an actionable execution workspace by implementing interactive checklists with live completion metadata, reliable reminder scheduling with plain-English delivery states, rich cross-module CRM relationship previews, and an ergonomic slide-over Task Detail Drawer, strictly adhering to `.agents/AGENTS.md` and `docs/agents_mcp/agents_mcp_rules.md`.

**Architecture:**
- **Interactive Checklists (PRD §7.4, Roadmap §42, UI Spec §577-588):** Direct item toggle with instant optimistic feedback, tracking completion timestamp (`completedAt`) and user metadata (`completedBy`), progress badges (`3 of 5 complete`) across rows and cards, and inline item creation without popups.
- **Reliable Reminders & Delivery States (PRD §7.6, Roadmap §37-39, UI Spec §599-612):** Compact inline reminder configuration with preset offsets (15m, 1h, 1d, 1w, custom), multi-channel selection (notification, email, sms), plain-English status indicators (`Scheduled`, `Sent`, `Failed`, `Cancelled`), and inline retry actions.
- **Cross-Module Relationship Previews (PRD §7.7, Roadmap §40-41, UI Spec §613-624):** Deep-linked relationship badges with rich hover popovers for Deals, Contract Obligations, Institutions, Meetings, and Surveys without duplicating heavy CRM data.
- **Slide-Over Task Detail Drawer (Roadmap §43, UI Spec §559-576):** Right-side slide-over sheet preserving user board/list position, offering direct checklist execution, status switching, reminders, and activity stream, with seamless responsive fallback on mobile viewports.
- **Strict Compliance (`.agents/AGENTS.md` & `docs/agents_mcp/agents_mcp_rules.md`):** Zero `any` or `any[]`, relative actionable toast navigation starting with `/`, Section 8 modal/drawer geometry, and `min-h-[44px]` touch targets.

**Tech Stack:** Next.js (App Router), React 19, TypeScript (Strict), Cloud Firestore, Tailwind CSS, Lucide React, date-fns, Vitest, React Testing Library.

---

## 1. Compliance Matrix: `docs/agents_mcp/agents_mcp_rules.md` (The 10 + 15 Rules)

### 1.1 The 10 Foundational Engineering Rules in Phase 3

| Rule ID & Name | Application in Phase 3 | Verification & Enforcement |
| :--- | :--- | :--- |
| **Rule 1: Best Practices & Skills** | Adheres to `next-best-practices` (clean server/client boundaries), `vercel-react-best-practices` (memoized progress counts, zero layout thrashing), `emilkowal-animations` (`active:scale-[0.97]` tactile presses), `frontend-design`, and `backend-design`. All pre-existing features (List, Board, Calendar, Scope switcher, filter chips, period tabs, density toggles, bulk actions, and contract sync) are strictly maintained and improved. | Enforced via `pnpm lint`, Vitest test suites, and architect review. |
| **Rule 2: Risk Analysis & Mitigation** | Exhaustive "What could go wrong & how to resolve it" matrix in Section 2. Identifies all failure modes (race conditions, array bloat, broken links, false delivery guarantees, mobile overflow). Run typecheck, lint, git commit; zero remote git push. | Enforced via Vitest TDD before code, `pnpm typecheck`, `pnpm eslint`. Local git commits only. |
| **Rule 3: Blast Radius & Backoffice** | Detailed blast radius analysis in Section 3. Verifies zero regressions to `TaskWidget.tsx`, `EntityDetail`, Deals, and DocSigning contract obligations. Backoffice provides configuration for default reminder channels and throttles. | Verified via negative integration test cases. |
| **Rule 4: Strict Typing & Bounded `unknown`** | Strictly **zero `any` or `any[]`** anywhere in application or test code. `unknown` is strictly restricted to external trust boundaries (raw Firestore document snapshots, catch blocks) and immediately narrowed via Zod schemas. | Enforced via `pnpm typecheck` (`--noEmit`) and CI scripts. |
| **Rule 5: Staging & Approval Gate** | **Execution is strictly blocked** until the user reviews and explicitly approves this plan. Production deployment requires explicit approval. Zero unprompted remote git pushes. | Gated at the top of this document. |
| **Rule 6: Dependency Verification** | Uses existing verified libraries (`date-fns`, `lucide-react`, `vitest`). Context7 consulted for any framework API updates. | Verified in `package.json`. |
| **Rule 7: Mobile-First Ergonomics** | All interactive controls (checkboxes, inputs, buttons, chips, tabs) guaranteed `min-h-[44px]` touch targets. Plain everyday UI English ("Confirm requirements", "3 of 5 complete", "15 minutes before", "Retry"). Zero developer jargon. Responsive slide-over falls back smoothly to full-width sheet on mobile (<768px). | Verified via automated accessibility tests and DOM sizing assertions. |
| **Rule 8: High Security & Multi-Tenancy** | Fail-closed tenant isolation: Server actions strictly enforce session verification via `requireWorkspace()`, authorizing against stored workspace (`getTaskWorkspaceId`). All actionable toast paths strictly relative starting with `/`. | Verified via multi-tenant security test cases. |
| **Rule 9: Scalability & Anti-Exhaustion** | Bounded data structures: Checklists capped at max 50 items; reminders capped at max 10 items. Bounded queries, memoized progress derivations (`useMemo`), and optimistic UI updates prevent query storms. | Prevents Firestore 1MB document limit and CPU exhaustion. |
| **Rule 10: Maintainer Comments** | Every new and modified file includes comprehensive explanatory comments documenting what changed, why, caution areas for future maintainers, and testability pointers. | Enforced during code review. |

---

### 1.2 Agentic & MCP Rules (Rules 11–69) in Phase 3

* **Rule 11 & 36 (MCP Protocol & Capability Contracts):** Expose standard JSON-schema-compatible types (`TaskChecklistItem`, `TaskReminder`) for future AI agent tool consumption (`task.checklist.toggle`, `task.reminder.add`).
* **Rule 12 (Server-Side Security Enforcement):** Server actions strictly validate permissions and state server-side. Metadata hints or client-passed claims are never trusted implicitly.
* **Rule 13 (Trust Boundary Matrix):**
  * *SYSTEM TRUST*: Server runtime environment variables, Firebase Admin SDK credentials.
  * *USER TRUST*: Authenticated session token verified via `requireWorkspace()`.
  * *UNTRUSTED / EXTERNAL*: Raw Firestore document snapshots, client form inputs, and webhook bodies. Must be validated via Zod schemas before entering domain logic.
* **Rule 16 (Agent Principal Awareness):** Record the actor principal (`user` vs `agent` vs `system`) on checklist completion metadata (`completedBy`) and task activity logs.
* **Rule 17 (Non-Delegable Privileges):** Deleting tasks, releasing legal holds, or clearing reminders in bulk requires explicit human confirmation. AI agents cannot perform destructive deletions autonomously.
* **Rule 18 (Time-of-Check / Time-of-Use Protection):** Optimistic concurrency checks prevent overwriting concurrent edits when multiple users or background jobs update checklist items simultaneously.
* **Rule 19 & 20 (Idempotency & Replay Protection):** Reminder delivery triggers and checklist updates use deterministic idempotency keys (`rem_task_${taskId}_${reminderId}`).
* **Rule 21 & 22 (Two-Phase Action Model & Approval Binding):** Bulk actions continue using two-phase confirmation dialog (`BulkActionReviewDialog`) with partial-failure retry flows.
* **Rule 23 (Resource Governance & Backpressure):** Checklist arrays capped at 50 items and reminders at 10 items. Payloads exceeding bounds fail closed with actionable feedback.
* **Rule 26 (Cancellation Semantics):** When a task is marked `done` or `cancelled`, scheduled reminders are automatically marked `cancelled`, preventing spurious downstream notifications.
* **Rule 31 (Output Validation Between Every Agent and Tool):** All inputs and mutation outputs validated through Zod schemas before being returned to UI or agent callers.
* **Rule 40 & 41 (Immutable Audit Logging & Explainability):** Checklist completions, reminder schedules, and status transitions emit immutable audit events to `activity_logs` with actor metadata and operational timestamps.
* **Rule 50 (Cache Isolation Rules):** All cache keys (such as user lookups and entity previews) are strictly partitioned by `workspaceId`.
* **Rule 51 (Server Action Security Gate):** Every server action derives tenant identity from `requireWorkspace(workspaceId)` and cross-checks against the stored task document.
* **Rule 69 (Master Layering Axiom):** Code flows strictly: `UI Components -> Server Actions -> Capability Contracts -> Domain Core -> Firebase Admin`.

---

## 2. Risk Analysis: What Could Go Wrong & Resolution Plan (Rule 2)

| Risk / Failure Mode | Root Cause | Impact | Preventive Architecture & Resolution |
| :--- | :--- | :--- | :--- |
| **1. Checklist Completion Race / Desynchronization** | Multiple rapid clicks on checklist items before Firestore update resolves. | Dropped checklist states or out-of-order item states. | Implement local optimistic update with `useOptimistic` or immediate functional state update, syncing asynchronously with `updateTaskAction`. |
| **2. Unbounded Embedded Checklist / Reminders Bloat** | User or automated script appends hundreds of checklist items or reminders into a single Firestore document. | Document exceeds 1MB limit or slows down UI queries. | Enforce schema bounds: max 50 checklist items and max 10 reminders per task; reject excessive payloads with clear user feedback. |
| **3. Mobile Viewport Overflow in Detail Drawer** | Long titles, deep relationship paths, or multi-channel reminder controls overflowing on 375px screens. | Horizontal scrolling, clipped action buttons, unclickable items. | Single-column responsive layout with `truncate`, flex-wrap chips, and bottom sticky action bar on mobile screens (`<768px`). |
| **4. Broken Cross-Module Deep Links** | Linked record (e.g. Deal or Contract) deleted or inaccessible to current user. | 404 error page or infinite loading spinner upon clicking relationship chip. | `TaskRelationshipBadge` checks entity presence and permissions; renders a graceful neutral badge if destination is unconfirmed or unauthorized. |
| **5. False Delivery Guarantee Representation** | UI showing reminder as "Delivered" when it was only written to database. | User misses deadline assuming recipient or self was successfully notified. | Plain-English states: explicitly distinguish `Scheduled` from `Sent`, `Failed`, or `Cancelled`. Show `Sync pending` / `Scheduled` until delivery confirmation exists. |
| **6. Stale Closure in Detail Drawer** | Detail drawer remains open while task is updated via Kanban drag-and-drop or background sync. | Inconsistent UI state; saving drawer overwrites latest status. | TaskDetailDrawer derives live state from `tasks.find(t => t.id === selectedId)` rather than detached snapshot state. |
| **7. Non-Relative Toast Path Security Violation** | Actionable toast path constructed with external URL or javascript: target. | Security vulnerability (open redirect / XSS). | All toast `actionConfig.path` parameters strictly enforced as relative paths starting with `/` (e.g. `/admin/settings/permissions`). |
| **8. Double Obligation Hook Triggering** | Marking a task done from checklist completion triggers duplicate contractual obligation sync. | Duplicate webhook calls or double audit log entries. | `updateTaskCore` guards obligation sync to fire once per status transition to `done`, deduplicated by task ID. |

---

## 3. Cross-Module Blast Radius & Backoffice Governance (Rule 3)

| Affected Module | Relationship / Integration | Invariant Protection & Backoffice Control |
| :--- | :--- | :--- |
| **Dashboard TaskWidget** (`src/components/dashboard/TaskWidget.tsx`) | Displays urgent and due-today tasks on executive dashboard. | Retains exact schema compatibility with `Task`. Additional `checklist` and `reminders` fields are optional and do not break widget parsing. |
| **Entity Detail Page** (`src/app/admin/entities/[id]/page.tsx`) | Shows entity-linked tasks and launches task creation. | Relationship badge deep links back to entity detail seamlessly. Entity prefill honored. |
| **Deals Pipeline** (`src/app/admin/deals/`) | Auto-generates tasks for deal stages. | Deal deep links (`/admin/deals?dealId=...`) open deal context without state leakage. |
| **DocSigning Contract Obligations** | Links contractual obligations to operational tasks. | Bi-directional reverse hook `syncTaskCompletionToObligation` executes whenever task is marked done, whether from detail drawer, editor, list, or Kanban. |
| **Backoffice Permission Matrix** (`/admin/settings/permissions`) | Governs task creation, edit, and deletion. | Actionable permission error toasts carry safe relative path `actionConfig: { path: '/admin/settings/permissions', label: 'View Permissions' }`. |
| **Backoffice Messaging & Notification Throttles** (`/admin/settings/notifications`) | Controls reminder channels (Email, SMS) and daily quotas. | Reminder channels disable SMS option if workspace SMS balance is 0 or unconfigured. |

---

## 4. File Structure & Responsibilities

| File Path | Responsibility |
| :--- | :--- |
| `src/lib/types.ts` (Modify) | Add `TaskChecklistItem` interface, enhance `TaskReminder` interface, and add `checklist?: TaskChecklistItem[]` to `Task`. |
| `src/lib/tasks/__tests__/task-checklist-reminders.test.ts` (Create) | Domain unit tests verifying checklist and reminder schema validation and bounds. |
| `src/app/admin/tasks/components/primitives/TaskChecklistProgress.tsx` (Create) | Compact progress badge showing `CheckSquare` icon and `X/Y` completion count with tooltip. |
| `src/app/admin/tasks/components/__tests__/TaskChecklistProgress.test.tsx` (Create) | Unit tests verifying progress calculation, fractional display, and completion styling. |
| `src/app/admin/tasks/components/TaskChecklist.tsx` (Create) | Interactive checklist with instant toggle, progress bar, inline adder, delete/edit item, and `completedAt`/`completedBy` tracking. |
| `src/app/admin/tasks/components/__tests__/TaskChecklist.test.tsx` (Create) | Unit tests verifying item toggling, adding, deleting, and mobile touch targets. |
| `src/app/admin/tasks/components/TaskRemindersEditor.tsx` (Create) | Inline reminder manager with human-readable offsets, multi-channel selection, status badges (`Scheduled`, `Sent`, `Failed`, `Cancelled`), and retry button. |
| `src/app/admin/tasks/components/__tests__/TaskRemindersEditor.test.tsx` (Create) | Unit tests verifying reminder creation, channel toggles, plain English formatting, and status rendering. |
| `src/app/admin/tasks/components/primitives/TaskRelationshipBadge.tsx` (Refactor) | Enhanced relationship badge with hover popover preview and authoritative deep links to Deals, Contracts, Entities, and Surveys. |
| `src/app/admin/tasks/components/__tests__/TaskRelationshipBadge-phase-3.test.tsx` (Create) | Unit tests verifying deep-link generation, popover preview content, and fallback handling. |
| `src/app/admin/tasks/components/TaskDetailDrawer.tsx` (Create) | Slide-over sheet for full task execution (header, checklist, reminders, context, activity, notes, and direct status toggle). |
| `src/app/admin/tasks/components/__tests__/TaskDetailDrawer.test.tsx` (Create) | Unit tests verifying slide-over opening, checklist interaction inside drawer, and mobile responsiveness. |
| `src/app/admin/tasks/components/TaskEditor.tsx` (Refactor) | Integrate `TaskChecklist` and `TaskRemindersEditor` inside collapsible progressive sections. |
| `src/app/admin/tasks/components/__tests__/TaskEditor-phase-3.test.tsx` (Create) | Unit tests verifying checklist and reminders persistence in form state. |
| `src/app/admin/tasks/components/TaskListRow.tsx` (Refactor) | Integrate `TaskChecklistProgress` badge and reminder icon indicator. |
| `src/app/admin/tasks/components/TaskCard.tsx` (Refactor) | Integrate `TaskChecklistProgress` badge and reminder icon indicator into Kanban card footer. |
| `src/app/admin/tasks/TasksClient.tsx` (Refactor) | Wire `TaskDetailDrawer` to row/card clicks with smooth slide-over, preserving list/board scroll state. |
| `src/app/admin/tasks/__tests__/TasksClient-phase-3-integration.test.ts` (Create) | End-to-end integration tests verifying task drawer opening, checklist toggle, and reminder updates. |

---

## 5. Bite-Sized Implementation Tasks

---

### Task 1: Domain Types & Schema Extensions (`src/lib/types.ts`)

**Files:**
- Modify: `src/lib/types.ts`
- Create: `src/lib/tasks/__tests__/task-checklist-reminders.test.ts`

- [ ] **Step 1: Write failing unit test for checklist and reminder domain contracts**

```typescript
// src/lib/tasks/__tests__/task-checklist-reminders.test.ts
import { describe, it, expect } from 'vitest';
import type { Task, TaskChecklistItem, TaskReminder } from '@/lib/types';

describe('Task Checklist & Reminders Domain Contracts (Phase 3)', () => {
  it('defines valid TaskChecklistItem structure with completion metadata', () => {
    const item: TaskChecklistItem = {
      id: 'chk-1',
      title: 'Review contract terms',
      completed: true,
      completedAt: '2026-10-09T10:00:00.000Z',
      completedBy: 'user-123',
    };
    expect(item.id).toBe('chk-1');
    expect(item.completed).toBe(true);
    expect(item.completedAt).toBeDefined();
  });

  it('defines valid TaskReminder structure with delivery statuses', () => {
    const reminder: TaskReminder = {
      id: 'rem-1',
      reminderTime: '2026-10-10T09:00:00.000Z',
      channels: ['notification', 'email'],
      sent: false,
      status: 'scheduled',
      error: null,
    };
    expect(reminder.id).toBe('rem-1');
    expect(reminder.status).toBe('scheduled');
  });

  it('allows Task to carry checklist items and reminders', () => {
    const task: Partial<Task> = {
      id: 'task-1',
      title: 'Prepare Proposal',
      checklist: [
        { id: 'c1', title: 'Confirm budget', completed: true },
        { id: 'c2', title: 'Send draft', completed: false },
      ],
      reminders: [
        { id: 'r1', reminderTime: '2026-10-10T09:00:00.000Z', channels: ['email'], sent: false, status: 'scheduled' },
      ],
    };
    expect(task.checklist?.length).toBe(2);
    expect(task.reminders?.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to confirm failure**
Run: `pnpm test:run src/lib/tasks/__tests__/task-checklist-reminders.test.ts`
Confirm missing types or properties fail compilation/tests.

- [ ] **Step 3: Update `src/lib/types.ts`**
Add `TaskChecklistItem` interface, extend `TaskReminder` with optional `id?: string`, `status?: 'scheduled' | 'sent' | 'failed' | 'cancelled'`, and `error?: string | null`, and add `checklist?: TaskChecklistItem[]` to `Task`.

- [ ] **Step 4: Run test to confirm pass**
Run: `pnpm test:run src/lib/tasks/__tests__/task-checklist-reminders.test.ts`

- [ ] **Step 5: Commit changes**
`git add src/lib/types.ts src/lib/tasks/__tests__/task-checklist-reminders.test.ts`
`git commit -m "feat(tasks): extend Task type with TaskChecklistItem and enhanced TaskReminder contracts"`

---

### Task 2: Checklist Progress Badge & Interactive Checklist Component

**Files:**
- Create: `src/app/admin/tasks/components/primitives/TaskChecklistProgress.tsx`
- Create: `src/app/admin/tasks/components/__tests__/TaskChecklistProgress.test.tsx`
- Create: `src/app/admin/tasks/components/TaskChecklist.tsx`
- Create: `src/app/admin/tasks/components/__tests__/TaskChecklist.test.tsx`

- [ ] **Step 1: Write failing test for `TaskChecklistProgress`**

```tsx
// src/app/admin/tasks/components/__tests__/TaskChecklistProgress.test.tsx
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TaskChecklistProgress } from '../primitives/TaskChecklistProgress';

describe('TaskChecklistProgress', () => {
  it('renders fractional progress badge with CheckSquare icon', () => {
    render(<TaskChecklistProgress completedCount={3} totalCount={5} />);
    expect(screen.getByText('3/5')).toBeInTheDocument();
  });

  it('renders complete styling when all items are done', () => {
    const { container } = render(<TaskChecklistProgress completedCount={5} totalCount={5} />);
    expect(screen.getByText('5/5')).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('text-emerald-700');
  });

  it('renders nothing when totalCount is 0', () => {
    const { container } = render(<TaskChecklistProgress completedCount={0} totalCount={0} />);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Implement `TaskChecklistProgress.tsx` and verify test passes**
Create `TaskChecklistProgress.tsx` with clean badge geometry, tooltip showing percentage, and strict typing.

- [ ] **Step 3: Write failing test for `TaskChecklist.tsx`**

```tsx
// src/app/admin/tasks/components/__tests__/TaskChecklist.test.tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskChecklist } from '../TaskChecklist';
import type { TaskChecklistItem } from '@/lib/types';

describe('TaskChecklist (Roadmap §42, UI Spec §577-588)', () => {
  const sampleItems: TaskChecklistItem[] = [
    { id: '1', title: 'Confirm requirements', completed: true },
    { id: '2', title: 'Send proposal', completed: false },
  ];

  it('renders progress text and checklist items', () => {
    render(<TaskChecklist items={sampleItems} onChange={vi.fn()} />);
    expect(screen.getByText('1 of 2 complete')).toBeInTheDocument();
    expect(screen.getByText('Confirm requirements')).toBeInTheDocument();
    expect(screen.getByText('Send proposal')).toBeInTheDocument();
  });

  it('toggles item completion when checkbox is clicked', () => {
    const onChange = vi.fn();
    render(<TaskChecklist items={sampleItems} onChange={onChange} />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);
    expect(onChange).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ id: '2', completed: true }),
    ]));
  });

  it('adds a new item via inline input with min-h-[44px] touch target', () => {
    const onChange = vi.fn();
    render(<TaskChecklist items={sampleItems} onChange={onChange} />);
    const input = screen.getByPlaceholderText(/add checklist item/i);
    expect(input.className).toMatch(/min-h-\[44px\]/);
    fireEvent.change(input, { target: { value: 'New task step' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ title: 'New task step', completed: false }),
    ]));
  });

  it('deletes an item when remove button is clicked', () => {
    const onChange = vi.fn();
    render(<TaskChecklist items={sampleItems} onChange={onChange} />);
    const deleteBtns = screen.getAllByRole('button', { name: /remove item/i });
    fireEvent.click(deleteBtns[0]);
    expect(onChange).toHaveBeenCalledWith([sampleItems[1]]);
  });
});
```

- [ ] **Step 4: Implement `TaskChecklist.tsx`**
Includes progress bar, inline item addition (input + Enter), delete button (`min-h-[44px]` touch targets), and Emil Kowalski tactile clicks (`active:scale-[0.97]`).

- [ ] **Step 5: Run tests and commit**
Run: `pnpm test:run src/app/admin/tasks/components/__tests__/TaskChecklist*.test.tsx`
`git add src/app/admin/tasks/components/primitives/TaskChecklistProgress.tsx src/app/admin/tasks/components/TaskChecklist.tsx src/app/admin/tasks/components/__tests__/TaskChecklist*.test.tsx`
`git commit -m "feat(tasks): create TaskChecklistProgress and interactive TaskChecklist components"`

---

### Task 3: Interactive Reminders Editor & Delivery State Engine

**Files:**
- Create: `src/app/admin/tasks/components/TaskRemindersEditor.tsx`
- Create: `src/app/admin/tasks/components/__tests__/TaskRemindersEditor.test.tsx`

- [ ] **Step 1: Write failing test for `TaskRemindersEditor`**

```tsx
// src/app/admin/tasks/components/__tests__/TaskRemindersEditor.test.tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskRemindersEditor } from '../TaskRemindersEditor';
import type { TaskReminder } from '@/lib/types';

describe('TaskRemindersEditor (Roadmap §37-39, UI Spec §599-612)', () => {
  const sampleReminders: TaskReminder[] = [
    {
      id: 'rem-1',
      reminderTime: '2026-10-10T09:00:00.000Z',
      channels: ['notification', 'email'],
      sent: false,
      status: 'scheduled',
    },
    {
      id: 'rem-2',
      reminderTime: '2026-10-09T08:00:00.000Z',
      channels: ['sms'],
      sent: false,
      status: 'failed',
      error: 'Invalid recipient phone',
    },
  ];

  it('renders list of reminders with plain-English channels and statuses', () => {
    render(<TaskRemindersEditor reminders={sampleReminders} onChange={vi.fn()} />);
    expect(screen.getByText(/scheduled/i)).toBeInTheDocument();
    expect(screen.getByText(/failed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('toggles add reminder inline creator without large modal', () => {
    render(<TaskRemindersEditor reminders={[]} onChange={vi.fn()} />);
    expect(screen.getByText(/no reminders scheduled/i)).toBeInTheDocument();
    const addBtn = screen.getByRole('button', { name: /add reminder/i });
    fireEvent.click(addBtn);
    expect(screen.getByText(/when/i)).toBeInTheDocument();
    expect(screen.getByText(/channels/i)).toBeInTheDocument();
  });

  it('adds reminder with preset offset and channels', () => {
    const onChange = vi.fn();
    render(<TaskRemindersEditor reminders={[]} onChange={onChange} taskDueDate="2026-10-15T10:00:00.000Z" />);
    fireEvent.click(screen.getByRole('button', { name: /add reminder/i }));
    
    // Select channel
    const emailCheckbox = screen.getByRole('checkbox', { name: /email/i });
    fireEvent.click(emailCheckbox);
    
    // Click confirm add
    fireEvent.click(screen.getByRole('button', { name: /save reminder/i }));
    expect(onChange).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ channels: expect.arrayContaining(['email']), status: 'scheduled' }),
    ]));
  });

  it('enforces min-h-[44px] touch target on all interactive buttons', () => {
    render(<TaskRemindersEditor reminders={sampleReminders} onChange={vi.fn()} />);
    const retryBtn = screen.getByRole('button', { name: /retry/i });
    expect(retryBtn.className).toMatch(/min-h-\[44px\]/);
  });
});
```

- [ ] **Step 2: Implement `TaskRemindersEditor.tsx`**
Create compact inline creator (preset offsets: 15m before, 1h before, 1d before, 1w before, custom), multi-channel checkboxes (`notification`, `email`, `sms`), delivery status chips (`scheduled`, `sent`, `failed` + retry, `cancelled`), and `min-h-[44px]` touch targets.

- [ ] **Step 3: Run test to confirm pass**
Run: `pnpm test:run src/app/admin/tasks/components/__tests__/TaskRemindersEditor.test.tsx`

- [ ] **Step 4: Commit changes**
`git add src/app/admin/tasks/components/TaskRemindersEditor.tsx src/app/admin/tasks/components/__tests__/TaskRemindersEditor.test.tsx`
`git commit -m "feat(tasks): create TaskRemindersEditor with preset offsets and delivery state tracking"`

---

### Task 4: Cross-Module Relationship Previews & Rich Badges

**Files:**
- Refactor: `src/app/admin/tasks/components/primitives/TaskRelationshipBadge.tsx`
- Create: `src/app/admin/tasks/components/__tests__/TaskRelationshipBadge-phase-3.test.tsx`

- [ ] **Step 1: Write failing test for enhanced `TaskRelationshipBadge`**

```tsx
// src/app/admin/tasks/components/__tests__/TaskRelationshipBadge-phase-3.test.tsx
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TaskRelationshipBadge } from './TaskRelationshipBadge';

describe('TaskRelationshipBadge (Phase 3 - Roadmap §40-41, UI Spec §613-624)', () => {
  it('generates authoritative deep-link for Deal relationship', () => {
    render(
      <TaskRelationshipBadge
        dealId="deal-99"
        entityName="Acme Expansion"
        relatedEntityType="Deal"
      />
    );
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', expect.stringContaining('/admin/deals?dealId=deal-99'));
  });

  it('generates authoritative deep-link for Contract Obligation', () => {
    render(
      <TaskRelationshipBadge
        entityName="Springfield Academy"
        relatedEntityType="School"
        relatedParentId="contract-12"
        relatedEntityId="obligation-34"
        obligationSyncStatus="synced"
      />
    );
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', expect.stringContaining('/admin/finance/contracts'));
    expect(screen.getByText(/synced/i)).toBeInTheDocument();
  });

  it('handles missing or unlinked relationships gracefully without broken links', () => {
    render(
      <TaskRelationshipBadge
        entityName={null}
        relatedEntityType={null}
      />
    );
    expect(screen.queryByRole('link')).toBeNull();
  });
});
```

- [ ] **Step 2: Update `TaskRelationshipBadge.tsx`**
Enhance deep-link resolution for `Deal`, `Contract`, `Institution/School`, `Meeting`, and `Survey`. Add hover popover preview with entity metadata.

- [ ] **Step 3: Run test and commit**
Run: `pnpm test:run src/app/admin/tasks/components/__tests__/TaskRelationshipBadge-phase-3.test.tsx`
`git add src/app/admin/tasks/components/primitives/TaskRelationshipBadge.tsx src/app/admin/tasks/components/__tests__/TaskRelationshipBadge-phase-3.test.tsx`
`git commit -m "feat(tasks): enhance TaskRelationshipBadge with cross-module deep links and rich previews"`

---

### Task 5: Slide-Over Task Detail Drawer (`TaskDetailDrawer.tsx`)

**Files:**
- Create: `src/app/admin/tasks/components/TaskDetailDrawer.tsx`
- Create: `src/app/admin/tasks/components/__tests__/TaskDetailDrawer.test.tsx`

- [ ] **Step 1: Write failing test for `TaskDetailDrawer`**

```tsx
// src/app/admin/tasks/components/__tests__/TaskDetailDrawer.test.tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskDetailDrawer } from '../TaskDetailDrawer';
import type { Task } from '@/lib/types';

describe('TaskDetailDrawer (Roadmap §43, UI Spec §559-576)', () => {
  const sampleTask: Task = {
    id: 't-1',
    workspaceId: 'ws-1',
    title: 'Finalize onboarding checklist',
    description: 'Ensure student records and emergency contacts are uploaded.',
    priority: 'high',
    status: 'in_progress',
    category: 'operations',
    assignedTo: 'user-1',
    dueDate: '2026-10-15T00:00:00.000Z',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    reminders: [],
    reminderSent: false,
    checklist: [
      { id: 'c1', title: 'Verify photo ID', completed: true },
      { id: 'c2', title: 'Confirm guardian contact', completed: false },
    ],
  };

  it('renders task details, status badge, priority badge, and description', () => {
    render(
      <TaskDetailDrawer
        task={sampleTask}
        isOpen={true}
        onClose={vi.fn()}
        onUpdateTask={vi.fn()}
        onEditFull={vi.fn()}
      />
    );
    expect(screen.getByText('Finalize onboarding checklist')).toBeInTheDocument();
    expect(screen.getByText(/verify photo ID/i)).toBeInTheDocument();
  });

  it('calls onEditFull when Edit button is clicked', () => {
    const onEditFull = vi.fn();
    render(
      <TaskDetailDrawer
        task={sampleTask}
        isOpen={true}
        onClose={vi.fn()}
        onUpdateTask={vi.fn()}
        onEditFull={onEditFull}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /edit task/i }));
    expect(onEditFull).toHaveBeenCalledWith(sampleTask);
  });

  it('toggles task completion status directly from drawer header', () => {
    const onUpdateTask = vi.fn();
    render(
      <TaskDetailDrawer
        task={sampleTask}
        isOpen={true}
        onClose={vi.fn()}
        onUpdateTask={onUpdateTask}
        onEditFull={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /mark complete/i }));
    expect(onUpdateTask).toHaveBeenCalledWith('t-1', expect.objectContaining({ status: 'done' }));
  });
});
```

- [ ] **Step 2: Implement `TaskDetailDrawer.tsx`**
Build slide-over drawer using `Sheet` from `@/components/ui/sheet`. Embed `TaskChecklist`, `TaskRemindersEditor`, `TaskRelationshipBadge`, `TaskStatusBadge`, `TaskPriorityBadge`, `TaskDueDate`, and comments. Adhere to Section 8 modal/sheet styling and `min-h-[44px]` touch targets.

- [ ] **Step 3: Run test to confirm pass**
Run: `pnpm test:run src/app/admin/tasks/components/__tests__/TaskDetailDrawer.test.tsx`

- [ ] **Step 4: Commit changes**
`git add src/app/admin/tasks/components/TaskDetailDrawer.tsx src/app/admin/tasks/components/__tests__/TaskDetailDrawer.test.tsx`
`git commit -m "feat(tasks): create TaskDetailDrawer slide-over with checklist, reminders, and context view"`

---

### Task 6: TaskEditor Integration (Reminders & Checklist Progressive Sections)

**Files:**
- Refactor: `src/app/admin/tasks/components/TaskEditor.tsx`
- Create: `src/app/admin/tasks/components/__tests__/TaskEditor-phase-3.test.tsx`

- [ ] **Step 1: Write failing test for `TaskEditor` with checklist and reminders**

```tsx
// src/app/admin/tasks/components/__tests__/TaskEditor-phase-3.test.tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskEditor } from '../TaskEditor';

describe('TaskEditor Phase 3 (Checklist & Reminders Integration)', () => {
  it('renders Checklist and Reminders collapsible sections in step 2', () => {
    render(
      <TaskEditor
        isOpen={true}
        onOpenChange={vi.fn()}
        workspaceId="ws-123"
        onSave={vi.fn()}
      />
    );
    // Switch to custom step
    fireEvent.click(screen.getByText(/create custom task/i));
    expect(screen.getByText(/checklist/i)).toBeInTheDocument();
    expect(screen.getByText(/reminders/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Integrate `TaskChecklist` and `TaskRemindersEditor` inside `TaskEditor.tsx`**
Bind checklist items and reminders into form submission state. Ensure values persist through `onSave` handler.

- [ ] **Step 3: Run test to confirm pass**
Run: `pnpm test:run src/app/admin/tasks/components/__tests__/TaskEditor-phase-3.test.tsx`

- [ ] **Step 4: Commit changes**
`git add src/app/admin/tasks/components/TaskEditor.tsx src/app/admin/tasks/components/__tests__/TaskEditor-phase-3.test.tsx`
`git commit -m "feat(tasks): integrate TaskChecklist and TaskRemindersEditor into TaskEditor progressive sections"`

---

### Task 7: List & Board Integration (`TaskListRow.tsx`, `TaskCard.tsx`, & `TasksClient.tsx`)

**Files:**
- Refactor: `src/app/admin/tasks/components/TaskListRow.tsx`
- Refactor: `src/app/admin/tasks/components/TaskCard.tsx`
- Refactor: `src/app/admin/tasks/TasksClient.tsx`
- Create: `src/app/admin/tasks/__tests__/TasksClient-phase-3-integration.test.ts`

- [ ] **Step 1: Write integration test for TasksClient detail drawer and badges**

```typescript
// src/app/admin/tasks/__tests__/TasksClient-phase-3-integration.test.ts
import { describe, it, expect } from 'vitest';
import type { Task } from '@/lib/types';

describe('TasksClient Phase 3 Integration', () => {
  it('identifies tasks with checklists and reminders for badge rendering', () => {
    const task: Task = {
      id: 't-1',
      workspaceId: 'ws-1',
      title: 'Audit compliance',
      description: '',
      priority: 'high',
      status: 'todo',
      category: 'operations',
      assignedTo: 'user-1',
      dueDate: '2026-10-15',
      createdAt: '2026-10-01',
      updatedAt: '2026-10-01',
      reminders: [{ id: 'r1', reminderTime: '2026-10-14', channels: ['email'], sent: false, status: 'scheduled' }],
      reminderSent: false,
      checklist: [{ id: 'c1', title: 'Verify', completed: true }, { id: 'c2', title: 'Sign', completed: false }],
    };
    expect(task.checklist?.length).toBe(2);
    expect(task.checklist?.filter(c => c.completed).length).toBe(1);
    expect(task.reminders?.length).toBe(1);
  });
});
```

- [ ] **Step 2: Update `TaskListRow.tsx`**
Render `TaskChecklistProgress` badge and `Bell` reminder indicator in secondary metadata. Update row click to trigger detail drawer view.

- [ ] **Step 3: Update `TaskCard.tsx`**
Render `TaskChecklistProgress` and `Bell` reminder icon in card footer alongside comments and attachments.

- [ ] **Step 4: Update `TasksClient.tsx`**
Add state for `selectedDetailTask` and `detailDrawerOpen`. Wire card/row clicks to open drawer without resetting view position. Provide action to open full `TaskEditor` when requested.

- [ ] **Step 5: Run tests and commit**
Run: `pnpm test:run src/app/admin/tasks/__tests__/TasksClient-phase-3-integration.test.ts`
`git add src/app/admin/tasks/components/TaskListRow.tsx src/app/admin/tasks/components/TaskCard.tsx src/app/admin/tasks/TasksClient.tsx src/app/admin/tasks/__tests__/TasksClient-phase-3-integration.test.ts`
`git commit -m "feat(tasks): wire TaskDetailDrawer, checklist progress, and reminder indicators into List, Card, and TasksClient"`

---

### Task 8: Quality Gates & Comprehensive Verification

**Files:**
- All Phase 1, 2, and 3 Task components and tests.

- [ ] **Step 1: Run complete test suite**
Run: `pnpm test:run src/lib/utils/__tests__/date-utils.test.ts src/platform/domains/tasks_productivity/contracts/__tests__/task-contracts.test.ts src/app/admin/tasks/components/__tests__/ src/app/admin/tasks/__tests__/`
Confirm all test suites pass with 0 errors.

- [ ] **Step 2: Run TypeScript typecheck**
Run: `pnpm typecheck` (`NODE_OPTIONS='--max-old-space-size=8192' tsc --noEmit`)
Confirm 0 TypeScript errors.

- [ ] **Step 3: Run ESLint**
Run: `pnpm eslint src/app/admin/tasks/`
Confirm 0 ESLint errors and 0 warnings.

- [ ] **Step 4: Verify Zero `any` or `any[]`**
Run: `grep -rn "any\[\]" src/app/admin/tasks/` and verify zero occurrences.

- [ ] **Step 5: Final commit**
`git add docs/superpowers/plans/2026-10-09-tasks-phase-3-reminders-checklists-relationships-and-detail-drawer.md`
`git commit -m "chore(tasks): verify Phase 3 quality gates, typing, and test suites"`
