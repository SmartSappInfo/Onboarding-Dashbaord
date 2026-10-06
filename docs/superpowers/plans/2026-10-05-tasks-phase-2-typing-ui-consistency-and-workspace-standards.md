# Tasks Phase 2: Typing, UI Consistency & Workspace Standards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevate the SmartSapp Tasks UI to an enterprise-grade standard by enforcing strict typing (zero `any` / zero `any[]`), integrating workspace contact tags via the standardized `<TagSelector>` in client/draft mode, standardizing the modal architecture of `TaskEditor.tsx` strictly per `.agents/AGENTS.md`, implementing keyboard accessibility for the Kanban board (`UI-02`), and delivering a responsive, multi-attribute filter toolbar with scope tabs (`My Tasks | Team | All`) and default daily (`Today`) views, in complete compliance with `agents_mcp_rules.md`.

**Architecture:**
1. **Defensive Date Utilities (`src/lib/utils/date-utils.ts`):** Centralize date parsing and formatting (`safeParseDate`, `isValidDate`, `formatTaskDueDate`, `formatTaskDate`) with date-fns, eliminating `RangeError: Invalid time value` crashes across all task surfaces (Rule 1, Rule 47).
2. **Tag Schema & Capability Extension:** Add `tagIds?: string[]` to `Task` in `src/lib/types.ts` and propagate through `NewTaskInput`, `task-core.ts`, `task-create.contract.ts`, and `task-update.contract.ts` with strict backwards compatibility (Rule 4, Rule 31, Rule 36, Rule 69).
3. **Standardized Modal Architecture in `TaskEditor.tsx`:** Align dialog surface geometry with `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`, demarcated header (`<DialogHeader demarcated>`), descriptive guidance strictly via `<CardInfoTooltip text="..." />` alongside title, screen-reader-only description (`<DialogDescription className="sr-only">`), progressive disclosure (Title -> Details -> Work -> Schedule -> Context -> Organization -> Checklist/Reminders), draft-mode `<TagSelector>`, and demarcated footer with tactile buttons (`rounded-xl active:scale-[0.97]`) (Rule 1, Rule 7, Rule 10, Modal Single Source of Truth).
4. **Kanban Keyboard Accessibility:** Add an accessible, non-drag status switcher menu to `TaskCard.tsx` with event isolation (`onPointerDown={(e) => e.stopPropagation()}`) and optimistic UI rollback on rejection, fulfilling PRD invariant `UI-02` (Rule 7, Rule 18).
5. **View Switcher & Filter Toolbar Architecture in `TasksClient.tsx`:** Implement crisp `[ List ] [ Board ] [ Calendar ]` segmented controls, Scope Tabs (`My Tasks | Team | All`), daily default filtering (`Today`) with week/month switches, tag filtering, and a responsive mobile filter `<Sheet>` with touch targets $\ge 44\text{px}$ and memoized computations (Rule 7, Rule 9, Rule 23).

**Tech Stack:** Next.js 14/15 (App Router), React 18/19, Radix UI Dialog & Dropdown Menu & Popover, Zod v4, Tailwind CSS, Lucide React, Vitest, TypeScript (Strict zero-`any`).

---

## 1. `agents_mcp_rules.md` Compliance Matrix

| Rule # | Requirement from `agents_mcp_rules.md` | Phase 2 Implementation Guard |
| :--- | :--- | :--- |
| **Rule 1** | Conform to best-practice skills (`next-best-practices`, `vercel-react-best-practices`, `emilkowal-animations`, `frontend-design`, `backend-design`). | • Tactile micro-interactions (`active:scale-[0.97]`, `<250ms` transitions).<br>• Progressive disclosure in `TaskEditor.tsx` avoids form fatigue.<br>• Clean segmented controls for view switching.<br>• All derived filter lists strictly memoized with `React.useMemo`. |
| **Rule 2** | Pre-mortem: Analyze what could go wrong and how to resolve it before coding. Run tests, typecheck, lint, local commit only (no push to remote). | Comprehensive risk matrix in Section 2 with concrete failure handling strategies. Local git commits only. |
| **Rule 3** | Impact analysis: What other features/callers will be affected? Backoffice governance? | Analyzes impact on `TagSelector.tsx`, platform capability contracts (`task.create`, `task.update`), Kanban drag-and-drop, and entity cross-linking. |
| **Rule 4** | **Zero `any`, `any[]`, or unchecked casts**. `unknown` only at external trust boundaries, immediately narrowed with Zod schemas. | Eliminate all instances of `any` across `TaskCalendar.tsx`, `TaskEditor.tsx`, `TaskCard.tsx`, and `TasksClient.tsx`. Strongly type all callbacks, handlers, and mappings. |
| **Rule 5** | Staged validation: test, verify, no premature automated production deployment. | Verify every task with unit tests, `pnpm typecheck`, and `pnpm lint` before marking complete. |
| **Rule 6** | Dependencies & documentation: check dependencies and get latest documentation. | Reuses existing date-fns, lucide-react, and Radix UI components without adding unnecessary dependencies. |
| **Rule 7** | Mobile optimization: touch targets $\ge 44\text{px}$, responsive gestures, clear plain UI English. | All interactive inputs, buttons, and popovers maintain `min-h-[44px]`. Mobile filter triggers open a dedicated `<Sheet>`. Plain, minimal UI text ("Today", "My Tasks", "Team", "All"). |
| **Rule 8** | High security standards: eliminate open endpoints, sanitize external input, secure toast paths. | All toast navigation uses relative paths starting with a single `/`. Actionable toasts provide direct routes to `/admin/settings/permissions`. |
| **Rule 9 & 23** | Load & Resource Governance: Avoid batch overload, un-memoized regex, resource exhaustion. | Filter operations use memoized derivations (`useMemo`). Tag queries leverage existing Firestore subscription patterns. |
| **Rule 10** | Inline architectural documentation: leave clear comments explaining what changed, why, caution areas, testability pointers. | Every modified component and helper includes structured comments explaining design decisions, invariants, and cautionary notes. |
| **Rule 12** | Annotations are hints, not security controls; server-side enforcement. | Server-side authorization check in `task-core.ts` executes independently of client or caller metadata. |
| **Rule 13** | Trust Boundary Matrix: classify data entering the system. | External HTTP payloads treated as `UNTRUSTED_EXTERNAL` and parsed through Zod before domain logic. |
| **Rule 16** | Agent Identity as First-Class Security Principal (`TaskActor`). | Differentiates `{ kind: 'user', uid }` (checked via `canUser`) from `{ kind: 'system', source }` (scoped server authority). |
| **Rule 18** | TOCTOU Concurrency Protection. | Optimistic updates on status change rollback if rejected by the server action. |
| **Rule 19** | Mutating Tool Idempotency. | Task status transitions and tag updates are idempotent and safe to retry. |
| **Rule 31** | Output Validation Between Every Agent and Tool. | Capability outputs conform strictly to `TaskCreateOutputSchema` and `TaskUpdateOutputSchema`. |
| **Rule 36** | Capability Version Compatibility. | Adding `tagIds: z.array(z.string()).optional()` maintains 100% backwards compatibility with existing v1.0.0 callers. |
| **Rule 40** | Audit Log Immutability. | Status changes executed via keyboard menu or drag-and-drop invoke canonical `logActivity` in `task-core.ts`. |
| **Rule 47** | Never Trust the Model or External Input. | Defensive date parsing (`safeParseDate`) treats all external dates as `unknown` and narrows safely without throwing `RangeError: Invalid time value`. |
| **Rule 51** | Server Action / Route Handler Security Gate. | All server actions called from UI surfaces (`updateTaskAction`, `createTaskAction`) enforce session authentication, workspace containment, and RBAC. |
| **Rule 52** | Client/Server Boundary Tests. | Component and contract tests verify client/server boundaries and schema adherence. |
| **Rule 69** | The Master Layering Axiom. | Domain Core (`task-core.ts`) $\rightarrow$ Capabilities (`task.create`, `task.update`) $\rightarrow$ Presentation (`TaskEditor.tsx`, `TasksClient.tsx`, `TaskCard.tsx`). Tags exclusively route through `<TagSelector>`. |

---

## 2. Risk & Failure Mode Analysis (Pre-Mortem)

### Risk 1: Date Parsing Crashes (`RangeError: Invalid time value`)
* **Hazard:** Direct calls to `format(new Date(task.dueDate), ...)` throw fatal runtime errors if `task.dueDate` is null, undefined, empty, or malformed.
* **Mitigation:** Centralize date operations in `src/lib/utils/date-utils.ts` with `safeParseDate` and `formatTaskDueDate`, providing safe fallbacks (`—` or custom placeholder) instead of unhandled exceptions.
* **Verification:** Unit tests in `src/lib/utils/__tests__/date-utils.test.ts` testing null, undefined, invalid strings, ISO strings, and edge cases.

### Risk 2: `<TagSelector>` Mutating Non-Existent Entity Records
* **Hazard:** `<TagSelector>` by default invokes `crm.entity.add_tag` capability when `contactId` and `contactType` are passed. Since Tasks are operational records and not CRM contacts, passing a taskId as contactId would fail or corrupt CRM entity tags.
* **Mitigation:** Strictly adhere to the workspace rule in `.agents/AGENTS.md`: run `<TagSelector>` in client/draft mode by **omitting** `contactId` and `contactType`, passing `currentTagIds={field.value || []}` and `onTagsChange={(newTagIds) => field.onChange(newTagIds)}`.
* **Verification:** Automated tests verify that `<TagSelector>` renders and dispatches updates without invoking CRM entity capabilities.

### Risk 3: Radix Dialog Title / Description Screen Reader Mismatch
* **Hazard:** Removing `DialogDescription` violates Radix accessibility requirements and produces console warnings. Displaying raw description text violates `.agents/AGENTS.md` ("Zero Raw Descriptions").
* **Mitigation:** Standardize on `<DialogHeader demarcated>`, render user guidance exclusively via `<CardInfoTooltip text="..." />` next to `<DialogTitle>`, and place an accessible `<DialogDescription className="sr-only">` for screen readers.
* **Verification:** Component tests assert presence of `sr-only` description and `CardInfoTooltip`.

### Risk 4: Kanban Keyboard Inaccessibility & Drag Event Conflict
* **Hazard:** Moving tasks between Kanban columns currently requires pointer drag-and-drop (`@dnd-kit`). Users relying solely on keyboard or assistive devices cannot change task status. Furthermore, adding buttons inside a draggable card could accidentally trigger drag gestures on click.
* **Mitigation:** Add an accessible status selection menu to `TaskCard.tsx` (`<DropdownMenu>` with `min-h-[44px]` triggers) that calls `onStatusChange(taskId, newStatus)`. Attach `onPointerDown={(e) => e.stopPropagation()}` and `onClick={(e) => e.stopPropagation()}` to prevent drag-and-drop interference.
* **Verification:** Unit test in `TaskCard-keyboard.test.tsx` verifying keyboard trigger opens menu and dispatches status update without triggering drag events.

### Risk 5: Filter Bar Overflow & Mobile Breakage
* **Hazard:** The current filter row in `TasksClient.tsx` has 5 separate `<Select>` controls, a date range picker, and a search box. On mobile devices ($< 768\text{px}$), this wraps chaotically and pushes content off-screen.
* **Mitigation:** Collapse filters into a compact `[ Search... ] [ Filters (N) ]` trigger on mobile, opening a bottom `<Sheet>` containing full filter controls with touch targets $\ge 44\text{px}$. On desktop ($\ge 768\text{px}$), render the horizontal filter row.
* **Verification:** Verify responsive rendering and touch target dimensions.

---

## 3. Impact Analysis & Caller Inventory

| Component / File | Changes & Responsibilities | Upstream / Downstream Callers |
| :--- | :--- | :--- |
| `src/lib/utils/date-utils.ts` | **NEW FILE:** Defensive date parsing & formatting helpers. | `TaskCard.tsx`, `TaskCalendar.tsx`, `TaskEditor.tsx`, `TasksClient.tsx`, `TaskWidget.tsx`. |
| `src/lib/types.ts` | Add `tagIds?: string[]` to `Task`. | All task consumers, `task-core.ts`, capability contracts. |
| `src/platform/domains/tasks_productivity/contracts/task-create.contract.ts` | Add `tagIds: z.array(z.string()).optional()` to input schema. | Platform capability callers, AI agents, MCP tools. |
| `src/platform/domains/tasks_productivity/contracts/task-update.contract.ts` | Add `tagIds: z.array(z.string()).optional()` to input schema. | Platform capability callers, AI agents, MCP tools. |
| `src/app/admin/tasks/components/TaskEditor.tsx` | Standardize modal architecture, eliminate `any`, integrate draft `<TagSelector>`, progressive disclosure layout. | `TasksClient.tsx`, entity detail pages. |
| `src/app/admin/tasks/components/TaskCard.tsx` | Add keyboard status changer menu, eliminate date crashes with `formatTaskDueDate`. | `TaskColumn.tsx`, `TaskBoard.tsx`. |
| `src/app/admin/tasks/components/TaskColumn.tsx` | Forward `onStatusChange` to `TaskCard`. | `TaskBoard.tsx`. |
| `src/app/admin/tasks/components/TaskBoard.tsx` | Wire `onStatusChange` to `updateTaskAction` with optimistic rollback and actionable error toasts. | `TasksClient.tsx`. |
| `src/app/admin/tasks/components/TaskCalendar.tsx` | Eliminate `any` in `PRIORITY_ICONS`, use safe date parsing. | `TasksClient.tsx`. |
| `src/app/admin/tasks/TasksClient.tsx` | Scope tabs (`My Tasks | Team | All`), crisp view switcher (`[ List ] [ Board ] [ Calendar ]`), tag filter, mobile filter sheet, daily default (`Today`). | Primary route `/admin/tasks`. |

---

## 4. Implementation Tasks

### Task 1: Shared Defensive Date Utilities (`date-utils.ts`)

**Rules Enforced:** Rule 1 (Best Practices), Rule 4 (Strict Typing), Rule 10 (Inline Architectural Guidance), Rule 47 (Never Trust External Data).

**Files:**
- Create: `src/lib/utils/date-utils.ts`
- Create: `src/lib/utils/__tests__/date-utils.test.ts`

- [ ] **Step 1: Write the failing tests for date utilities**

```typescript
// src/lib/utils/__tests__/date-utils.test.ts
import { describe, it, expect } from 'vitest';
import { safeParseDate, isValidDate, formatTaskDueDate, formatTaskDate } from '../date-utils';

describe('date-utils defensive helpers', () => {
  describe('isValidDate', () => {
    it('returns true for valid Date instances', () => {
      expect(isValidDate(new Date())).toBe(true);
      expect(isValidDate(new Date('2026-10-06T12:00:00Z'))).toBe(true);
    });

    it('returns false for invalid Date instances and non-dates', () => {
      expect(isValidDate(new Date('invalid-date'))).toBe(false);
      expect(isValidDate(null)).toBe(false);
      expect(isValidDate(undefined)).toBe(false);
      expect(isValidDate('2026-10-06')).toBe(false);
      expect(isValidDate(123456789)).toBe(false);
    });
  });

  describe('safeParseDate', () => {
    it('parses valid ISO strings into Date objects', () => {
      const parsed = safeParseDate('2026-10-06T14:30:00Z');
      expect(parsed).toBeInstanceOf(Date);
      expect(parsed?.toISOString()).toBe('2026-10-06T14:30:00.000Z');
    });

    it('returns Date object as-is if already valid', () => {
      const original = new Date('2026-10-06T14:30:00Z');
      const parsed = safeParseDate(original);
      expect(parsed).toBe(original);
    });

    it('parses numeric epoch timestamps', () => {
      const epoch = 1791207921203;
      const parsed = safeParseDate(epoch);
      expect(parsed).toBeInstanceOf(Date);
      expect(parsed?.getTime()).toBe(epoch);
    });

    it('returns null safely for null, undefined, empty strings, and malformed values', () => {
      expect(safeParseDate(null)).toBeNull();
      expect(safeParseDate(undefined)).toBeNull();
      expect(safeParseDate('')).toBeNull();
      expect(safeParseDate('   ')).toBeNull();
      expect(safeParseDate('not-a-date')).toBeNull();
      expect(safeParseDate({})).toBeNull();
      expect(safeParseDate([])).toBeNull();
    });
  });

  describe('formatTaskDueDate', () => {
    it('formats a valid date string with default pattern MMM d', () => {
      const formatted = formatTaskDueDate('2026-10-06T12:00:00Z');
      expect(formatted).toBe('Oct 6');
    });

    it('formats a valid date string with custom pattern', () => {
      const formatted = formatTaskDueDate('2026-10-06T12:00:00Z', 'yyyy-MM-dd');
      expect(formatted).toBe('2026-10-06');
    });

    it('returns fallback string when date is invalid or missing', () => {
      expect(formatTaskDueDate(null)).toBe('No due date');
      expect(formatTaskDueDate(undefined)).toBe('No due date');
      expect(formatTaskDueDate('', 'MMM d', 'None')).toBe('None');
      expect(formatTaskDueDate('invalid', 'MMM d', 'TBD')).toBe('TBD');
    });
  });

  describe('formatTaskDate', () => {
    it('formats general task dates with safe fallbacks', () => {
      expect(formatTaskDate('2026-10-06T12:00:00Z', 'MMM d, yyyy')).toBe('Oct 6, 2026');
      expect(formatTaskDate(null, 'MMM d, yyyy', '—')).toBe('—');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run src/lib/utils/__tests__/date-utils.test.ts`
Expected: FAIL ("Cannot find module '../date-utils'")

- [ ] **Step 3: Implement `src/lib/utils/date-utils.ts`**

```typescript
// src/lib/utils/date-utils.ts
/**
 * @fileOverview Shared Defensive Date Utilities
 *
 * ARCHITECTURAL GUIDANCE (Rule 10 Maintainer Guidance):
 * - Centralizes safe parsing, validation, and formatting for all task, calendar, and activity dates.
 * - Prevents unhandled `RangeError: Invalid time value` crashes caused by null, undefined, or malformed date inputs.
 * - Strictly typed: Zero `any` or `any[]`.
 */

import { format, isValid } from 'date-fns';

/**
 * Checks whether an unknown value is a valid Date instance.
 */
export function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !isNaN(value.getTime()) && isValid(value);
}

/**
 * Safely parses any unknown date representation into a valid Date object or null.
 * Never throws RangeError.
 */
export function safeParseDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  if (isValidDate(value)) return value;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = new Date(trimmed);
    return isValidDate(parsed) ? parsed : null;
  }

  if (typeof value === 'number') {
    if (isNaN(value) || !isFinite(value)) return null;
    const parsed = new Date(value);
    return isValidDate(parsed) ? parsed : null;
  }

  return null;
}

/**
 * Formats a task due date with a specified pattern, returning a safe fallback on error or absence.
 */
export function formatTaskDueDate(
  value: unknown,
  pattern = 'MMM d',
  fallback = 'No due date'
): string {
  const date = safeParseDate(value);
  if (!date) return fallback;
  try {
    return format(date, pattern);
  } catch {
    return fallback;
  }
}

/**
 * Formats any general task date (createdAt, completedAt, etc.) with a safe fallback.
 */
export function formatTaskDate(
  value: unknown,
  pattern = 'MMM d, yyyy',
  fallback = '—'
): string {
  const date = safeParseDate(value);
  if (!date) return fallback;
  try {
    return format(date, pattern);
  } catch {
    return fallback;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:run src/lib/utils/__tests__/date-utils.test.ts`
Expected: PASS (All 4 test suites, 10 assertions pass)

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/date-utils.ts src/lib/utils/__tests__/date-utils.test.ts
git commit -m "feat(tasks): create defensive date utilities with safe parsing and formatting"
```

---

### Task 2: Task Tag Schema & Platform Capability Expansion

**Rules Enforced:** Rule 4 (Strict Typing), Rule 10 (Inline Architectural Documentation), Rule 31 (Output Validation), Rule 36 (Capability Version Compatibility), Rule 69 (Master Layering Axiom).

**Files:**
- Modify: `src/lib/types.ts:4751-4783`
- Modify: `src/platform/domains/tasks_productivity/contracts/task-create.contract.ts:21-40`
- Modify: `src/platform/domains/tasks_productivity/contracts/task-update.contract.ts:19-35`
- Create: `src/platform/domains/tasks_productivity/contracts/__tests__/task-contracts.test.ts`

- [ ] **Step 1: Write the failing tests for task contracts with `tagIds`**

```typescript
// src/platform/domains/tasks_productivity/contracts/__tests__/task-contracts.test.ts
import { describe, it, expect } from 'vitest';
import { TaskCreateInputSchema } from '../task-create.contract';
import { TaskUpdateInputSchema } from '../task-update.contract';

describe('Task Capability Contracts — tagIds schema support (Phase 2)', () => {
  describe('TaskCreateInputSchema', () => {
    it('accepts valid input with optional tagIds array', () => {
      const parsed = TaskCreateInputSchema.parse({
        workspaceId: 'ws_test_123',
        title: 'Complete onboarding walkthrough',
        tagIds: ['tag_urgent', 'tag_customer'],
      });
      expect(parsed.tagIds).toEqual(['tag_urgent', 'tag_customer']);
    });

    it('accepts input without tagIds (backwards compatibility for v1 callers)', () => {
      const parsed = TaskCreateInputSchema.parse({
        workspaceId: 'ws_test_123',
        title: 'Review proposal',
      });
      expect(parsed.tagIds).toBeUndefined();
    });

    it('rejects non-string array for tagIds', () => {
      expect(() =>
        TaskCreateInputSchema.parse({
          workspaceId: 'ws_test_123',
          title: 'Review proposal',
          tagIds: [123, true],
        })
      ).toThrow();
    });
  });

  describe('TaskUpdateInputSchema', () => {
    it('accepts valid update with tagIds', () => {
      const parsed = TaskUpdateInputSchema.parse({
        workspaceId: 'ws_test_123',
        taskId: 'task_abc_456',
        tagIds: ['tag_vip'],
      });
      expect(parsed.tagIds).toEqual(['tag_vip']);
    });

    it('accepts empty tagIds array to clear tags', () => {
      const parsed = TaskUpdateInputSchema.parse({
        workspaceId: 'ws_test_123',
        taskId: 'task_abc_456',
        tagIds: [],
      });
      expect(parsed.tagIds).toEqual([]);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run src/platform/domains/tasks_productivity/contracts/__tests__/task-contracts.test.ts`
Expected: FAIL (`tagIds` unrecognized in schema)

- [ ] **Step 3: Update `src/lib/types.ts`, `task-create.contract.ts`, and `task-update.contract.ts`**

In `src/lib/types.ts`:
Add `tagIds?: string[];` to `interface Task` (around line 4782):
```typescript
  dealId?: string | null;
  createdBy?: string;
  tagIds?: string[];
}
```

In `src/platform/domains/tasks_productivity/contracts/task-create.contract.ts`:
```typescript
export const TaskCreateInputSchema = z.object({
  workspaceId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium').optional(),
  dueDate: z.string().optional(),
  entityId: z.string().optional(),
  category: z.string().default('follow_up').optional(),
  tagIds: z.array(z.string()).optional(),
});
```

In `src/platform/domains/tasks_productivity/contracts/task-update.contract.ts`:
```typescript
export const TaskUpdateInputSchema = z.object({
  workspaceId: z.string().min(1),
  taskId: z.string().min(1),
  title: z.string().optional(),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  dueDate: z.string().optional(),
  status: z.enum(['todo', 'in_progress', 'completed', 'blocked']).optional(),
  tagIds: z.array(z.string()).optional(),
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:run src/platform/domains/tasks_productivity/contracts/__tests__/task-contracts.test.ts`
Expected: PASS (All assertions pass)

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/platform/domains/tasks_productivity/contracts/task-create.contract.ts src/platform/domains/tasks_productivity/contracts/task-update.contract.ts src/platform/domains/tasks_productivity/contracts/__tests__/task-contracts.test.ts
git commit -m "feat(tasks): add tagIds to Task interface and platform capability schemas"
```

---

### Task 3: Standardize Modal Architecture & `<TagSelector>` in `TaskEditor.tsx`

**Rules Enforced:** Rule 1 (Best Practices & Tactile Easing), Rule 4 (Zero `any`), Rule 7 (Mobile & Accessibility First), Rule 10 (Inline Architectural Documentation), Rule 69 (Tag Selection Single Source of Truth, Modal Single Source of Truth).

**Files:**
- Modify: `src/app/admin/tasks/components/TaskEditor.tsx`
- Create: `src/app/admin/tasks/components/__tests__/TaskEditor-standards.test.tsx`

- [ ] **Step 1: Write the failing tests for `TaskEditor` modal standards**

```typescript
// src/app/admin/tasks/components/__tests__/TaskEditor-standards.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as React from 'react';
import TaskEditor from '../TaskEditor';

// Mock Firebase & Workspace Context
vi.mock('@/firebase', () => ({
  useFirestore: () => ({}),
  useUser: () => ({ user: { uid: 'usr_test_1', displayName: 'Test User' } }),
  useMemoFirebase: (fn: () => unknown) => fn(),
  useCollection: () => ({ data: [] }),
}));

vi.mock('@/context/WorkspaceContext', () => ({
  useWorkspace: () => ({ activeWorkspaceId: 'ws_123', activeOrganizationId: 'org_123' }),
}));

vi.mock('@/hooks/use-terminology', () => ({
  useTerminology: () => ({ entityName: 'Campus', entityNamePlural: 'Campuses' }),
}));

vi.mock('@/components/tags/TagSelector', () => ({
  TagSelector: ({ currentTagIds, onTagsChange }: { currentTagIds: string[]; onTagsChange?: (ids: string[]) => void }) => (
    <div data-testid="standard-tag-selector" data-tag-count={currentTagIds.length}>
      <button type="button" onClick={() => onTagsChange?.([...currentTagIds, 'tag_new'])}>Add Test Tag</button>
    </div>
  ),
}));

describe('TaskEditor Modal & Architecture Standards (Phase 2)', () => {
  it('renders demarcated header with CardInfoTooltip and sr-only description', () => {
    render(
      <TaskEditor
        open={true}
        onOpenChange={vi.fn()}
        onSave={vi.fn().mockResolvedValue(undefined)}
        isSaving={false}
      />
    );

    // Assert screen reader description is present and sr-only
    const srDesc = document.querySelector('.sr-only');
    expect(srDesc).toBeTruthy();

    // Assert CardInfoTooltip info icon button is present with z-[10050] tooltip capability
    const tooltipTrigger = screen.getByTestId('card-info-tooltip');
    expect(tooltipTrigger).toBeTruthy();
  });

  it('renders TagSelector in client/draft mode without contactId or contactType', () => {
    render(
      <TaskEditor
        open={true}
        onOpenChange={vi.fn()}
        onSave={vi.fn().mockResolvedValue(undefined)}
        isSaving={false}
        task={{ id: 'task_1', title: 'Existing Task', tagIds: ['tag_1', 'tag_2'] }}
      />
    );

    const tagSelector = screen.getByTestId('standard-tag-selector');
    expect(tagSelector).toBeTruthy();
    expect(tagSelector.getAttribute('data-tag-count')).toBe('2');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run src/app/admin/tasks/components/__tests__/TaskEditor-standards.test.tsx`
Expected: FAIL (card-info-tooltip or standard-tag-selector not found)

- [ ] **Step 3: Refactor `src/app/admin/tasks/components/TaskEditor.tsx`**

Implement the following updates:
1. **Strict Typing:**
   - Change `onSave: (data: any) => Promise<void>` to:
     ```typescript
     export type TaskSavePayload = Omit<NewTaskInput, 'startDate' | 'dueDate' | 'reminders'> & {
       startDate?: string;
       dueDate: string;
       reminders: Array<{
         reminderTime: string;
         channels: ('notification' | 'email' | 'sms')[];
         sent: boolean;
       }>;
       tagIds?: string[];
     };

     interface TaskEditorProps {
       open: boolean;
       onOpenChange: (open: boolean) => void;
       task?: Partial<Task> | null;
       onSave: (data: TaskSavePayload) => Promise<void>;
       isSaving: boolean;
       disableEntitySelect?: boolean;
       preFilledEntityName?: string;
     }
     ```
   - Update `taskSchema` to include `tagIds: z.array(z.string()).default([])`.
   - Replace `normalizeAssignees(val: any)` with:
     ```typescript
     const normalizeAssignees = (val: unknown): string[] => {
       if (Array.isArray(val)) {
         return val.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
       }
       if (typeof val === 'string' && val.trim().length > 0) {
         return [val.trim()];
       }
       return [];
     };
     ```
   - Replace `(task.entityType as any)` with typed casting against `EntityType`.
2. **Modal Architecture per `.agents/AGENTS.md`:**
   - In Step 1:
     ```tsx
     <DialogHeader demarcated>
       <div className="flex items-center gap-3">
         <div className="p-2 bg-primary/10 text-primary rounded-xl">
           <Layout className="h-5 w-5" />
         </div>
         <div className="flex items-center gap-2">
           <DialogTitle className="text-lg font-bold text-foreground">Select a Task Template</DialogTitle>
           <CardInfoTooltip text="Choose a pre-configured template or start from scratch to initialize your task." />
         </div>
       </div>
       <DialogDescription className="sr-only">Choose a pre-configured template or start from scratch.</DialogDescription>
     </DialogHeader>
     ```
   - In Step 2:
     ```tsx
     <DialogHeader demarcated>
       <div className="flex items-center gap-3">
         {(!task || !task.id) && (
           <Button
             type="button"
             variant="ghost"
             onClick={() => setActiveStep(1)}
             className="h-9 w-9 p-0 rounded-xl border border-border bg-background text-muted-foreground hover:bg-muted/30 hover:text-foreground active:scale-[0.97]"
           >
             <ChevronLeft className="h-4 w-4" />
           </Button>
         )}
         <div className="flex items-center gap-2">
           <DialogTitle className="text-lg font-bold text-foreground">
             {task?.id ? 'Edit Task Details' : 'Configure Task Details'}
           </DialogTitle>
           <CardInfoTooltip text="Specify title, owners, schedule, context, and organizational tags." />
         </div>
       </div>
       <DialogDescription className="sr-only">Fill in the fields below to customize your task.</DialogDescription>
     </DialogHeader>
     ```
3. **Demarcated Footer:**
   - Standardize dialog footer:
     ```tsx
     <DialogFooter className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5">
       <Button
         type="button"
         variant="outline"
         onClick={() => onOpenChange(false)}
         className="rounded-xl font-semibold h-11 min-h-[44px] px-6 active:scale-[0.97]"
       >
         Cancel
       </Button>
       <Button
         type="submit"
         disabled={isSaving}
         className="rounded-xl font-semibold h-11 min-h-[44px] px-8 bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.97]"
       >
         {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
         {task?.id ? 'Save Changes' : 'Create Task'}
       </Button>
     </DialogFooter>
     ```
4. **Draft-Mode `<TagSelector>` Integration:**
   - In the form, add the Organization / Tags section:
     ```tsx
     <div className="space-y-2 text-left">
       <Label className="text-xs font-semibold text-foreground/90 ml-1">Workspace Tags</Label>
       <Controller
         name="tagIds"
         control={control}
         render={({ field }) => (
           <TagSelector
             currentTagIds={field.value || []}
             onTagsChange={(newTagIds) => field.onChange(newTagIds)}
           />
         )}
       />
     </div>
     ```
5. **Defensive Date Usage:**
   - Use `safeParseDate` from `@/lib/utils/date-utils` when populating `startDate` and `dueDate` in `reset(...)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:run src/app/admin/tasks/components/__tests__/TaskEditor-standards.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/tasks/components/TaskEditor.tsx src/app/admin/tasks/components/__tests__/TaskEditor-standards.test.tsx
git commit -m "feat(tasks): standardize TaskEditor modal architecture, draft TagSelector, and zero-any"
```

---

### Task 4: Zero-`any` & Keyboard Navigation in Kanban & Calendar (`TaskCalendar.tsx`, `TaskCard.tsx`, `TaskColumn.tsx`, `TaskBoard.tsx`)

**Rules Enforced:** Rule 4 (Zero `any`), Rule 7 (Mobile & Accessibility First), Rule 10 (Inline Architectural Documentation), Rule 18 (TOCTOU Concurrency Protection).

**Files:**
- Modify: `src/app/admin/tasks/components/TaskCalendar.tsx`
- Modify: `src/app/admin/tasks/components/TaskCard.tsx`
- Modify: `src/app/admin/tasks/components/TaskColumn.tsx`
- Modify: `src/app/admin/tasks/components/TaskBoard.tsx`
- Create: `src/app/admin/tasks/components/__tests__/TaskCard-keyboard.test.tsx`

- [ ] **Step 1: Write failing test for `TaskCard` keyboard status change**

```typescript
// src/app/admin/tasks/components/__tests__/TaskCard-keyboard.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as React from 'react';
import TaskCard from '../TaskCard';
import type { Task } from '@/lib/types';

// Mock dnd-kit
vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

const mockTask: Task = {
  id: 'task_kb_1',
  workspaceId: 'ws_1',
  title: 'Audit user security permissions',
  description: 'Annual security check',
  priority: 'high',
  status: 'todo',
  category: 'follow_up',
  assignedTo: ['usr_1'],
  dueDate: '2026-10-15T10:00:00Z',
  createdAt: '2026-10-01T10:00:00Z',
  updatedAt: '2026-10-01T10:00:00Z',
  reminders: [],
  reminderSent: false,
};

describe('TaskCard Keyboard Accessibility (Phase 2 - UI-02)', () => {
  it('renders an accessible status switcher trigger for keyboard users', () => {
    const onStatusChange = vi.fn();
    render(<TaskCard task={mockTask} onStatusChange={onStatusChange} />);

    const menuTrigger = screen.getByRole('button', { name: /change status/i });
    expect(menuTrigger).toBeTruthy();
  });

  it('triggers onStatusChange when selecting a new status', () => {
    const onStatusChange = vi.fn();
    render(<TaskCard task={mockTask} onStatusChange={onStatusChange} />);

    const menuTrigger = screen.getByRole('button', { name: /change status/i });
    fireEvent.click(menuTrigger);

    const inProgressOption = screen.getByRole('menuitem', { name: /in progress/i });
    fireEvent.click(inProgressOption);

    expect(onStatusChange).toHaveBeenCalledWith('task_kb_1', 'in_progress');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run src/app/admin/tasks/components/__tests__/TaskCard-keyboard.test.tsx`
Expected: FAIL (button with accessible name "change status" not found)

- [ ] **Step 3: Implement Zero-`any` and Keyboard Status Menu**

1. In `src/app/admin/tasks/components/TaskCalendar.tsx`:
   - Replace `const PRIORITY_ICONS: Record<TaskPriority, any> = {` with:
     `const PRIORITY_ICONS: Record<TaskPriority, LucideIcon> = {`
   - Use `safeParseDate` for date parsing to avoid `RangeError: Invalid time value`.
2. In `src/app/admin/tasks/components/TaskCard.tsx`:
   - Add prop `onStatusChange?: (taskId: string, newStatus: TaskStatus) => void`.
   - Import `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuTrigger` from `@/components/ui/dropdown-menu` and `ArrowRightLeft` from `lucide-react`.
   - Add status dropdown with `aria-label="Change status"`, `min-h-[44px]` (or `h-7 w-7` button with sufficient touch padding), and `onPointerDown={(e) => e.stopPropagation()}` to prevent dragging interference.
   - Use `formatTaskDueDate(task.dueDate)` instead of raw `format(new Date(task.dueDate), 'MMM d')`.
3. In `src/app/admin/tasks/components/TaskColumn.tsx`:
   - Add prop `onStatusChange?: (taskId: string, newStatus: TaskStatus) => void` and forward it to `TaskCard`.
4. In `src/app/admin/tasks/components/TaskBoard.tsx`:
   - Pass `onStatusChange={handleStatusChangeDirect}` to `TaskColumn`.
   - Implement `handleStatusChangeDirect(taskId: string, targetStatus: TaskStatus)` using `updateTaskAction` with optimistic update and rollback on failure (matching `handleDragEnd` behavior).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:run src/app/admin/tasks/components/__tests__/TaskCard-keyboard.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/tasks/components/TaskCalendar.tsx src/app/admin/tasks/components/TaskCard.tsx src/app/admin/tasks/components/TaskColumn.tsx src/app/admin/tasks/components/TaskBoard.tsx src/app/admin/tasks/components/__tests__/TaskCard-keyboard.test.tsx
git commit -m "feat(tasks): add keyboard status switcher to Kanban and eliminate any in TaskCalendar"
```

---

### Task 5: Refactor View Switcher, Filter Toolbar & Scope Tabs in `TasksClient.tsx`

**Rules Enforced:** Rule 1 (Tactile Easing & Next Best Practices), Rule 7 (Mobile First & Accessible Touch Targets), Rule 9 & 23 (Backpressure & Memoized Computation), Rule 10 (Inline Architectural Documentation).

**Files:**
- Modify: `src/app/admin/tasks/TasksClient.tsx`
- Create: `src/app/admin/tasks/__tests__/TasksClient-toolbar-filters.test.ts`

- [ ] **Step 1: Write failing test for Scope & Tag filtering logic**

```typescript
// src/app/admin/tasks/__tests__/TasksClient-toolbar-filters.test.ts
import { describe, it, expect } from 'vitest';
import type { Task } from '@/lib/types';

describe('TasksClient Scope & Filter Filtering Invariants (Phase 2)', () => {
  const currentUserId = 'user_current';
  const mockTasks: Task[] = [
    {
      id: 'task_1',
      workspaceId: 'ws_1',
      title: 'My personal task',
      description: '',
      priority: 'high',
      status: 'todo',
      category: 'general',
      assignedTo: [currentUserId],
      dueDate: '2026-10-06T12:00:00Z',
      createdAt: '2026-10-01T12:00:00Z',
      updatedAt: '2026-10-01T12:00:00Z',
      reminders: [],
      reminderSent: false,
      tagIds: ['tag_urgent'],
    },
    {
      id: 'task_2',
      workspaceId: 'ws_1',
      title: 'Teammate task',
      description: '',
      priority: 'medium',
      status: 'in_progress',
      category: 'general',
      assignedTo: ['user_teammate'],
      dueDate: '2026-10-06T12:00:00Z',
      createdAt: '2026-10-01T12:00:00Z',
      updatedAt: '2026-10-01T12:00:00Z',
      reminders: [],
      reminderSent: false,
      tagIds: ['tag_marketing'],
    },
    {
      id: 'task_3',
      workspaceId: 'ws_1',
      title: 'Unassigned task',
      description: '',
      priority: 'low',
      status: 'todo',
      category: 'general',
      assignedTo: [],
      dueDate: '2026-10-06T12:00:00Z',
      createdAt: '2026-10-01T12:00:00Z',
      updatedAt: '2026-10-01T12:00:00Z',
      reminders: [],
      reminderSent: false,
      tagIds: [],
    },
  ];

  function filterTasks(
    tasks: Task[],
    scope: 'my' | 'team' | 'all',
    selectedTagId: string | 'all',
    userId: string
  ): Task[] {
    return tasks.filter((task) => {
      // Scope filter
      let matchesScope = true;
      const assignees = Array.isArray(task.assignedTo)
        ? task.assignedTo
        : task.assignedTo
        ? [task.assignedTo]
        : [];

      if (scope === 'my') {
        matchesScope = assignees.includes(userId);
      } else if (scope === 'team') {
        matchesScope = assignees.length > 0;
      }

      // Tag filter
      const matchesTag =
        selectedTagId === 'all' || (Boolean(task.tagIds) && task.tagIds!.includes(selectedTagId));

      return matchesScope && matchesTag;
    });
  }

  it('filters by "my" scope', () => {
    const result = filterTasks(mockTasks, 'my', 'all', currentUserId);
    expect(result.map((t) => t.id)).toEqual(['task_1']);
  });

  it('filters by "team" scope', () => {
    const result = filterTasks(mockTasks, 'team', 'all', currentUserId);
    expect(result.map((t) => t.id)).toEqual(['task_1', 'task_2']);
  });

  it('filters by "all" scope', () => {
    const result = filterTasks(mockTasks, 'all', 'all', currentUserId);
    expect(result.length).toBe(3);
  });

  it('filters by specific tagId', () => {
    const result = filterTasks(mockTasks, 'all', 'tag_marketing', currentUserId);
    expect(result.map((t) => t.id)).toEqual(['task_2']);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `pnpm test:run src/app/admin/tasks/__tests__/TasksClient-toolbar-filters.test.ts`
Expected: PASS

- [ ] **Step 3: Update `src/app/admin/tasks/TasksClient.tsx`**

Implement the following in `TasksClient.tsx`:
1. **Scope Tabs (`My Tasks | Team | All`):**
   - Add state `const [taskScope, setTaskScope] = React.useState<'my' | 'team' | 'all'>('all');`
   - Incorporate `taskScope` into `filteredTasks` memo:
     ```typescript
     let matchesScope = true;
     if (taskScope === 'my') {
       const uid = currentUser?.uid;
       matchesScope = uid ? (Array.isArray(task.assignedTo) ? task.assignedTo.includes(uid) : task.assignedTo === uid) : true;
     } else if (taskScope === 'team') {
       matchesScope = Array.isArray(task.assignedTo) ? task.assignedTo.length > 0 : Boolean(task.assignedTo);
     }
     ```
   - Render segmented scope tab controls:
     ```tsx
     <div className="inline-flex items-center p-1 bg-muted/40 rounded-xl border border-border">
       {(['all', 'my', 'team'] as const).map((scope) => (
         <button
           key={scope}
           type="button"
           onClick={() => setTaskScope(scope)}
           className={cn(
             "px-4 py-2 rounded-lg text-xs font-semibold capitalize transition-all active:scale-[0.97]",
             taskScope === scope
               ? "bg-card text-foreground shadow-sm"
               : "text-muted-foreground hover:text-foreground"
           )}
         >
           {scope === 'all' ? 'All Tasks' : scope === 'my' ? 'My Tasks' : 'Team Tasks'}
         </button>
       ))}
     </div>
     ```
2. **Refined View Switcher (`[ List ] [ Board ] [ Calendar ]`):**
   - Clean, tactile segmented control with Lucide icons (`LayoutList`, `Layers`, `Calendar`), minimum height 44px, and high-contrast active state.
3. **Tag Filter Dropdown:**
   - Add `const [selectedTagId, setSelectedTagId] = React.useState<string>('all');`
   - Incorporate `matchesTag` check into `filteredTasks`.
4. **Mobile Filter Sheet (`<Sheet>`):**
   - For viewports below `md` breakpoint, show `[ Search... ] [ Filters (activeFilterCount) ]` button with `min-h-[44px]`.
   - On click, open responsive bottom sheet containing Status, Priority, Scope, Assignee, Tag, and Date selectors with touch targets $\ge 44\text{px}$.
5. **Defensive Date Formatting:**
   - Replace any raw `format(new Date(task.dueDate), ...)` with `formatTaskDueDate(task.dueDate, ...)`.

- [ ] **Step 4: Run test suite to verify no regressions**

Run: `pnpm test:run src/app/admin/tasks/__tests__/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/tasks/TasksClient.tsx src/app/admin/tasks/__tests__/TasksClient-toolbar-filters.test.ts
git commit -m "feat(tasks): refactor view switcher, scope tabs, tag filtering, and mobile filter sheet"
```

---

### Task 6: Verification, Typecheck, Lint & Quality Gates

**Rules Enforced:** Rule 2 (Pre-Mortem Verification), Rule 4 (Zero `any`), Rule 5 (Staged Deployment Guard).

**Files:**
- Verify all modified files across the workspace.

- [ ] **Step 1: Run all task and date unit test suites**

Run: `pnpm test:run src/lib/utils/__tests__/date-utils.test.ts src/platform/domains/tasks_productivity/contracts/__tests__/task-contracts.test.ts src/app/admin/tasks/components/__tests__/ src/app/admin/tasks/__tests__/`
Expected: PASS (All test suites pass)

- [ ] **Step 2: Run TypeScript typecheck**

Run: `pnpm typecheck`
Expected: `tsc --noEmit` exits with 0 errors.

- [ ] **Step 3: Run ESLint**

Run: `pnpm lint`
Expected: 0 errors, warnings $\le 670$.

- [ ] **Step 4: Verify Zero-`any` across Tasks Domain**

Run: `grep -rn "any" src/app/admin/tasks/components/ src/lib/utils/date-utils.ts`
Expected: 0 occurrences of `any` in TypeScript types/casts (excluding plain comments/placeholders).

- [ ] **Step 5: Commit verification**

```bash
git commit --allow-empty -m "chore(tasks): verify Phase 2 quality gates, typing, and test suites"
```

---

## 5. Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-10-05-tasks-phase-2-typing-ui-consistency-and-workspace-standards.md`.

Two execution options:
1. **Subagent-Driven (recommended)** - Fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints.
