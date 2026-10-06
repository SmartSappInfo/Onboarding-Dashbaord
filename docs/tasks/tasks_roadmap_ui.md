Below is the implementation roadmap I would hand to the AI coding agent alongside the PRD. It deliberately treats **UI as part of the architecture**, not as a cosmetic layer: every phase defines what the user should see, how the interaction should behave, what states must exist, and which behaviors are prohibited.

It is aligned to the pasted architecture specification and the PRD we just produced. 

# SmartSapp CRM — Tasks, Team Execution & AI Copilot

## `ROADMAP.md`

**Document type:** Product + UI/UX + Engineering Implementation Roadmap
**Version:** 1.0
**Status:** Implementation Blueprint
**Primary module:** Tasks
**Primary route:** `/admin/tasks`
**Additional routes:** `/admin/standups`, `/admin/task-analytics`

---

# 1. Purpose

This roadmap defines the implementation sequence for upgrading the existing SmartSapp CRM Tasks module into a secure, scalable, professional operational execution platform.

The implementation must preserve the existing Tasks domain while progressively adding:

* secure unified mutation architecture;
* professional task-management UX;
* reminders;
* tags;
* checklists;
* CRM relationship visualization;
* cursor pagination;
* daily standups;
* blockers;
* commitments and carryovers;
* operational analytics;
* AI task assistance;
* background processing;
* cross-module integration.

The roadmap is intentionally written so an AI development agent can use it as an execution specification.

---

# 2. Non-negotiable implementation principles

Before any phase begins, the AI agent must follow these rules.

## 2.1 Existing architecture is the baseline

Do not rebuild the Tasks module from scratch.

Existing functionality must be preserved unless the PRD explicitly requires changing it.

Preserve:

* `/admin/tasks`;
* List view;
* Kanban view;
* Calendar view;
* existing task IDs;
* existing task relationships;
* existing task categories;
* existing status values unless formally migrated;
* existing CRM entity relationships;
* `dealId`;
* contract-obligation relationships;
* activity logging;
* automation integration;
* CompanyBrain task-note integration;
* existing permission conventions.

The supplied audit identifies these as existing capabilities or contracts. 

---

# 3. Global UI design system

All phases must use one coherent visual language.

Do **not** design each phase as an independent product.

## 3.1 Visual direction

The Tasks experience should feel:

* professional;
* minimal;
* calm;
* information-dense without being cluttered;
* operational;
* fast;
* enterprise-grade;
* consistent with SmartSapp CRM.

Avoid:

* oversized cards;
* excessive gradients;
* excessive rounded containers;
* decorative illustrations in operational screens;
* excessive color coding;
* unnecessary modal dialogs;
* giant headings;
* dense tables with poor spacing;
* dashboard-card overload;
* animation that delays task completion.

---

# 4. Global layout architecture

All Task-related screens should use the same application shell.

```text
┌───────────────────────────────────────────────────────────────┐
│ SmartSapp Header / Workspace                                  │
├──────────────┬────────────────────────────────────────────────┤
│              │ Breadcrumb                                     │
│              │                                                │
│ Navigation   │ Page Header                                    │
│              │ ┌────────────────────────────────────────────┐ │
│              │ │ Title                 Primary Action        │ │
│              │ └────────────────────────────────────────────┘ │
│              │                                                │
│              │ Toolbar / Filters                              │
│              │                                                │
│              │ Main Content                                   │
│              │                                                │
│              │                                                │
└──────────────┴────────────────────────────────────────────────┘
```

The Tasks module should not introduce a second navigation paradigm.

---

# 5. Global page-header specification

Every primary Task page must have:

### Breadcrumb

Example:

```text
Operations / Tasks
```

Standups:

```text
Operations / Standups
```

Analytics:

```text
Operations / Task Analytics
```

### Header

```text
Tasks
Manage operational work across your workspace.

[ + New Task ] [•••]
```

The descriptive text should be subtle and short.

Avoid:

```text
Welcome to your amazing task management dashboard!
```

---

# 6. Global interaction rules

## 6.1 Primary actions

Each screen must have one visually dominant primary action.

Examples:

```text
+ New Task
```

```text
Submit Standup
```

```text
Create Task
```

Secondary actions should visually recede.

---

## 6.2 Destructive actions

Never place destructive actions beside the primary action without separation.

Use:

```text
••• → Delete
```

rather than:

```text
[Delete] [Create] [Save]
```

Deletion requires confirmation.

The confirmation must clearly identify the affected record.

---

# 7. Global loading states

Every async surface must have a deliberate loading state.

Do not use a blank page.

Preferred:

* skeleton rows;
* skeleton cards;
* skeleton KPI values;
* button-level loading indicators.

Avoid full-page spinners unless the entire application route cannot render.

Example:

```text
Tasks

[ Search tasks... ] [Filters] [List] [Board] [Calendar]

────────────────────────────────────
██████████████████  ███████
██████████████      █████
████████████████    ███████
```

---

# 8. Global empty states

Empty states must explain:

1. what is empty;
2. why it might be empty;
3. what the user can do next.

Example:

```text
No tasks yet

Create your first task to start tracking work
across your workspace.

[ + Create Task ]
```

Filtered empty state:

```text
No tasks match these filters.

Try changing the date, status, assignee, or search term.

[ Clear filters ]
```

Do not show generic:

```text
No data found.
```

---

# 9. Global error states

Errors must be actionable.

Example:

```text
Couldn't update this task.

Your changes were not saved.

[ Try again ]
```

Permission error:

```text
You don't have permission to perform this action.

[ View permissions ]
```

The source roadmap specifically requires actionable permission errors. 

Never silently fail.

---

# 10. Global responsive requirements

The UI must be designed for:

* desktop;
* laptop;
* tablet;
* mobile.

Do not simply shrink desktop layouts.

## Desktop

Use multi-column layouts where appropriate.

## Tablet

Collapse secondary panels.

## Mobile

Prioritize:

1. task title;
2. status;
3. due date;
4. assignee;
5. primary action.

Move secondary information into expandable sections.

All important interactive controls should target approximately:

```text
44 × 44 CSS px minimum
```

The source acceptance criteria explicitly require this for Task cards/editor controls. 

---

# 11. Global accessibility

Every phase must support:

* keyboard navigation;
* visible focus;
* semantic buttons;
* accessible labels;
* screen-reader descriptions;
* keyboard alternatives to drag-and-drop;
* sufficient text contrast;
* no information conveyed by color alone;
* confirmation for destructive actions;
* accessible dialogs;
* accessible dropdowns;
* accessible date/time controls.

---

# 12. Global task visual language

Task status should use restrained visual differentiation.

Recommended hierarchy:

| State       | UI treatment        |
| ----------- | ------------------- |
| Todo        | neutral             |
| In Progress | blue/accent         |
| Review      | secondary accent    |
| Done        | subdued success     |
| Cancelled   | muted/strikethrough |

Do not make the entire task card brightly colored.

Color should identify state, not dominate the interface.

---

# 13. PHASE 0 — Discovery, baseline and design foundation

## Objective

Before changing functionality, establish the exact existing system and create the visual foundation.

---

## 13.1 Engineering work

AI agent must inventory:

```text
src/app/admin/tasks
src/lib/tasks
src/lib/task-server-actions.ts
src/lib/task-actions.ts
src/app/actions/bulk-task-actions.ts
src/lib/automations/actions/task-actions.ts
```

Also identify:

* Firestore rules;
* task indexes;
* all task mutation callers;
* task-related components;
* CRM relationship consumers;
* DocSigning consumers;
* automation consumers;
* MCP task tools;
* CompanyBrain adapter.

The source audit explicitly identifies these areas as part of the current architecture. 

---

# 14. Phase 0 UI requirements

Do not redesign the entire application.

Create reusable primitives first.

Required primitives:

```text
<TaskStatusBadge />
<TaskPriorityBadge />
<TaskAssignee />
<TaskDueDate />
<TaskRelationshipBadge />
<TaskTags />
<TaskChecklistProgress />
<TaskSourceBadge />
<TaskCard />
<TaskListRow />
<TaskEmptyState />
<TaskErrorState />
<TaskSkeleton />
<TaskFilters />
<TaskViewSwitcher />
<TaskEditor />
<ConfirmDialog />
```

These components become the visual foundation for all later phases.

---

# 15. Phase 0 task card specification

Desktop:

```text
┌─────────────────────────────────────────────────────────┐
│ ○ Follow up with Acme regarding contract      •••       │
│                                                         │
│ Acme School     Contract Obligation                    │
│                                                         │
│ [High] [Follow Up]                                      │
│                                                         │
│ Due today · Sarah                                       │
└─────────────────────────────────────────────────────────┘
```

Do not display every field.

The card should communicate:

**What → Context → Priority → Deadline → Owner**

---

# 16. Phase 0 design tokens

The implementation must reuse SmartSapp's existing design system.

Do not introduce arbitrary colors per component.

Use existing SmartSapp brand tokens, with the established SmartSapp blue as the primary accent.

Spacing should follow a consistent scale.

Suggested baseline:

```text
4
8
12
16
20
24
32
40
48
64
```

Typography must use the application's existing font system rather than introducing a new font.

---

# 17. Phase 0 exit criteria

* [ ] Existing Tasks screens mapped.
* [ ] All mutation entry points mapped.
* [ ] Existing UI components identified.
* [ ] Shared Task UI primitives established.
* [ ] No feature behavior changed.
* [ ] Desktop/tablet/mobile layout baseline documented.
* [ ] Existing Task UI passes visual regression baseline.

---

# 18. PHASE 1 — Security & Unified Mutation Engine

## Objective

Make the task architecture trustworthy before expanding functionality.

The source audit identifies this as the highest-risk phase because of the bulk-action endpoint and direct client Firestore mutations. 

---

# 19. Phase 1 engineering requirements

### Required changes

Create:

```text
src/lib/tasks/task-bulk-core.ts
```

Move reusable bulk logic there.

Server actions should become guarded entry points.

Route all mutations through:

```text
Task UI
   ↓
Server Action
   ↓
Authorization
   ↓
Task Core
   ↓
Firestore
   ↓
Domain Events
```

Never:

```text
Task UI
   ↓
Firestore
```

---

# 20. Phase 1 UI requirements

The user should experience this phase primarily as **greater reliability**, not a visual redesign.

## Kanban

Dragging:

```text
IN PROGRESS
      ↓
     DONE
```

must show a brief transition state.

Example:

```text
Saving…
```

Then:

```text
✓ Completed
```

If the server rejects the change:

```text
Couldn't update task.

The task was not moved.

[ Try again ]
```

The card must not remain visually in the wrong column.

---

# 21. Optimistic UI requirement

Optimistic UI may be used only if rollback is reliable.

For example:

```text
User drags card
       ↓
UI temporarily moves card
       ↓
Server mutation
       ↓
Success → retain
Failure → return card
```

Never permanently display an optimistic mutation that the server rejected.

---

# 22. Phase 1 completion behavior

When a task moves to Done:

```text
Task
 ↓
Completion mutation
 ↓
completedAt
 ↓
Activity event
 ↓
Contract obligation synchronization if applicable
```

UI should display completion immediately after authoritative success.

For contract tasks:

```text
✓ Task completed
Contract obligation updated
```

If obligation synchronization is asynchronous:

```text
✓ Task completed
Contract obligation sync pending
```

Never claim the obligation is fulfilled until the integration confirms it.

---

# 23. Phase 1 permission UX

When unauthorized:

```text
You don't have permission to edit this task.

[ View permissions ]
```

Do not expose:

* internal authorization logic;
* workspace IDs;
* security implementation details;
* stack traces.

---

# 24. Phase 1 bulk-action UX

Bulk selection:

```text
☐ Select all

12 tasks selected

[ Change status ]
[ Assign ]
[ Delete ]
[ Clear selection ]
```

After selection:

```text
12 tasks selected
```

not a huge persistent toolbar.

Bulk destructive action:

```text
Delete 12 tasks?

This action cannot be undone.

[ Cancel ] [ Delete tasks ]
```

For partial failures:

```text
9 tasks updated
3 tasks could not be updated

[ Review failures ]
```

Never display:

```text
Success
```

when only part of the operation succeeded.

---

# 25. Phase 1 exit criteria

* [ ] No client task mutation bypass remains.
* [ ] Bulk operation is secured.
* [ ] Kanban rollback works.
* [ ] Dashboard completion uses canonical mutation.
* [ ] Entity-page completion uses canonical mutation.
* [ ] Contract completion synchronization is preserved.
* [ ] Bulk partial failures are represented accurately.
* [ ] Security regression tests pass.

---

# 26. PHASE 2 — Typing, UI consistency and workspace standards

## Objective

Turn the existing Tasks UI into a consistent professional product surface.

---

# 27. Phase 2 UI architecture

The main `/admin/tasks` screen should evolve toward:

```text
┌─────────────────────────────────────────────────────────────┐
│ Tasks                                  [+ New Task]          │
│ Manage operational work across your workspace               │
├─────────────────────────────────────────────────────────────┤
│ My Tasks | Team | All                                       │
├─────────────────────────────────────────────────────────────┤
│ Search...  Status  Priority  Assignee  Due  Tags  More      │
├─────────────────────────────────────────────────────────────┤
│ List   Board   Calendar                                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Task content                                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

# 28. View switcher

Use three clear controls:

```text
[ List ] [ Board ] [ Calendar ]
```

The active view must be obvious.

Do not use large decorative tabs.

---

# 29. Filter architecture

Desktop:

```text
[ Search tasks... ]
[ Status ]
[ Priority ]
[ Assignee ]
[ Due date ]
[ Tags ]
[ More ]
```

Mobile:

```text
[ Search... ] [ Filters 3 ]
```

Opening Filters should use a bottom sheet or modal appropriate to the application's existing mobile patterns.

---

# 30. Saved filter state

The architecture should allow future saved views, but do not build a complex saved-view system unless included in the approved scope.

At minimum, preserve:

* current view;
* active filters;
* date range.

---

# 31. Task editor UX

The Task Editor is one of the most important screens.

It should not feel like a long CRM form.

Recommended structure:

```text
Create task

Title
[ Follow up with Acme                         ]

Details
[ Description...                              ]

Work
[ Status ] [ Priority ] [ Assignee ]

Schedule
[ Start ] [ Due ]

Context
[ Company ] [ Deal ] [ Related record ]

Organization
[ Tags ]

Checklist
☐ Confirm pricing
☐ Send proposal
+ Add item

Reminders
+ Add reminder

                       [ Cancel ] [ Create task ]
```

---

# 32. Task editor principles

### Required fields first

Title should dominate the form.

### Progressive disclosure

Advanced options should remain collapsed until needed.

For example:

```text
Advanced
⌄
```

contains less frequently used metadata.

### Never overwhelm

Do not put every possible field into the initial viewport.

---

# 33. TagSelector

Use the existing `<TagSelector>` rather than implementing another tag picker.

Interaction:

```text
Tags
[ Sales ] [ Priority ] [+ Add tag]
```

Tag selection must support:

* search;
* existing tag selection;
* creation only if workspace policy allows it;
* keyboard navigation;
* removal.

---

# 34. Toast system

Use consistent toast behavior.

Success:

```text
Task created
```

Error:

```text
Task couldn't be created
[ Try again ]
```

Permission:

```text
You don't have permission to create tasks
[ View permissions ]
```

Do not create custom notification designs for each phase.

---

# 35. Phase 2 exit criteria

* [ ] Zero `any` in approved task UI scope.
* [ ] TagSelector integrated.
* [ ] Task editor has clear information hierarchy.
* [ ] Responsive behavior implemented.
* [ ] 44px minimum interaction target applied.
* [ ] Keyboard alternative exists for Kanban.
* [ ] Shared visual components used across all views.

---

# 36. PHASE 3 — Task execution completeness

## Objective

Complete the everyday task-management experience with reminders, relationships and checklists.

---

# 37. Phase 3 reminder UX

Inside Task Editor:

```text
Reminders

No reminders

+ Add reminder
```

After adding:

```text
Reminders

🔔 15 minutes before
   In-app notification                         [•••]

✉ 1 day before
   Email                                       [•••]

+ Add reminder
```

---

# 38. Reminder creation interaction

Use a compact row:

```text
When
[ 1 day before ]

Channels
☑ Notification
☐ Email
☐ SMS

[ Cancel ] [ Add reminder ]
```

Avoid a large modal for simple reminder creation.

---

# 39. Reminder states

The UI should distinguish:

```text
Scheduled
Sent
Failed
Cancelled
```

Example:

```text
🔔 Tomorrow at 9:00 AM
   Scheduled
```

Failure:

```text
⚠ Email reminder failed

[ Retry ]
```

---

# 40. Cross-module relationship UX

Tasks should communicate context without duplicating CRM data.

Example:

```text
Acme International School
Contract Obligation
```

Clickable relationship chip:

```text
[ Contract · Obligation #204 ]
```

Deal:

```text
[ Deal · Acme Expansion ]
```

Meeting:

```text
[ Meeting · Pricing Review ]
```

These must deep-link to the authoritative record.

---

# 41. Relationship previews

Hover or focus may reveal:

```text
Contract Obligation #204
Acme International School
Due 14 Oct 2026

Open obligation →
```

Do not create an entirely separate copy of the linked CRM record.

---

# 42. Checklist UX

Inside task detail:

```text
Checklist

3 of 5 complete

☑ Confirm requirements
☑ Review pricing
☑ Prepare proposal
☐ Internal approval
☐ Send proposal

+ Add checklist item
```

Completion should feel lightweight.

Do not open a modal for every checkbox.

---

# 43. Task detail drawer

Desktop task detail should preferably open in a side panel or dedicated route according to the application's existing navigation model.

Recommended:

```text
┌──────────────────────────────────────┐
│ Task                         •••     │
│                                      │
│ Follow up with Acme                  │
│                                      │
│ [In Progress] [High]                │
│                                      │
│ Owner                                │
│ Sarah                                │
│                                      │
│ Due                                  │
│ Today                                │
│                                      │
│ Context                              │
│ [Acme School] [Contract]             │
│                                      │
│ Checklist                            │
│ ...                                  │
│                                      │
│ Activity                             │
│ ...                                  │
└──────────────────────────────────────┘
```

---

# 44. Phase 3 exit criteria

* [ ] Reminders can be created and edited.
* [ ] Reminder delivery state is represented accurately.
* [ ] Cross-module links are visible and usable.
* [ ] Checklist functionality works without unnecessary navigation.
* [ ] Existing task relationships remain intact.
* [ ] DocSigning synchronization is preserved.
* [ ] Mobile task detail remains usable.

---

# 45. PHASE 4 — Scale, Standups and AI Copilot

This is the largest product phase.

It should be implemented as three coordinated experiences:

```text
Tasks
Standups
Analytics
```

with AI operating across them.

---

# 46. Phase 4A — Scalable Tasks

## Cursor pagination UX

Do not expose pagination as an engineering limitation.

Preferred:

```text
Showing 50 tasks

[ Load more ]
```

or controlled infinite scroll.

Avoid:

```text
Page 1 of 37
```

unless users demonstrably need explicit page navigation.

---

# 47. Loading more

Use:

```text
Loading more tasks…
```

at the bottom.

Do not replace the entire task list when fetching the next cursor.

---

# 48. Large-workspace behavior

For large workspaces:

* filters should execute server-side;
* search should not download the entire task collection;
* sorting must use supported indexes;
* selected filters must remain visible;
* result counts should not require expensive full collection scans.

---

# 49. Phase 4B — Standups

## New route

```text
/admin/standups
```

Primary navigation:

```text
My Standup
Team
Blockers
History
```

---

# 50. Standup home

Recommended:

```text
Standup

Monday, 5 October

How's your day going?

Completed
────────────────────────
What did you complete?

[ + Add completed work ]

Planned
────────────────────────
What are you working on?

[ + Add planned work ]

Blockers
────────────────────────
Anything preventing progress?

[ + Add blocker ]

Need help?
────────────────────────

[ + Request help ]

                     [ Save draft ]
                     [ Submit standup ]
```

The interface should feel significantly lighter than a formal report.

---

# 51. Standup interaction model

A standup should be quick to complete.

The user should be able to select existing tasks:

```text
Completed

☑ Prepare Acme proposal
☑ Review contract
```

rather than rewriting information that already exists.

---

# 52. Standup task linking

Selecting:

```text
+ Add completed work
```

opens:

```text
Your tasks

[ Search tasks... ]

○ Prepare proposal
○ Review contract
○ Client follow-up
○ Internal approval
```

The user can link a task.

The UI must clearly indicate:

```text
Linked task
```

rather than implying that the standup itself changed task state.

---

# 53. Planned work

Allow:

```text
[ Existing task ]
[ New task ]
[ Free-text commitment ]
```

This distinction is important.

Example:

```text
Tomorrow's planned work

[Task] Follow up with Acme
[Task] Review contract

[Commitment] Prepare internal pricing analysis
```

---

# 54. Blocker UX

Blocker creation should be simple.

```text
What's blocking you?

[ Waiting for client response                 ]

Severity
[ Medium ▾ ]

Affected task
[ Follow up with Acme ▾ ]

What do you need?
[ Decision / Help / Information ▾ ]

[ Cancel ] [ Raise blocker ]
```

---

# 55. Blocker display

Team view:

```text
Open blockers

⚠ Waiting for client response
   Sarah · Acme Deal
   2 days old
   Medium

   [ Assign ] [ Resolve ]
```

Do not turn every blocker into an alarming red UI.

Severity should control emphasis.

---

# 56. Standup submission state

Before submission:

```text
Draft
```

After submission:

```text
Submitted · 9:04 AM
```

If amended:

```text
Amended · 11:32 AM
```

The history must remain available according to the configured amendment policy.

---

# 57. Team standup dashboard

Desktop:

```text
Team standup

Monday, 5 October

12 / 14 submitted

────────────────────────────────────────────

Team progress

Completed       Planned        Blocked
    28             34              4

────────────────────────────────────────────

People

Sarah       ✓ Submitted   3 completed   1 blocker
Daniel      ✓ Submitted   2 completed   —
Michael     ○ Missing     —              —

────────────────────────────────────────────

Open blockers

...
```

Keep this operational rather than decorative.

---

# 58. Privacy requirements

Private notes should never appear in the standard team overview.

Where appropriate:

```text
Private manager note
Visible only to authorized managers
```

Use explicit privacy indicators rather than relying on hidden behavior.

---

# 59. AI standup summary

The AI summary should look like:

```text
AI team summary

Generated 9:12 AM

Progress
The team completed 28 tracked tasks...

Blockers
4 active blockers were reported...

Attention needed
2 blockers have remained open for more than 2 days.

Suggested actions
• Review the Acme dependency
• Assign an owner to the pricing approval blocker

[ View sources ]
```

Important:

The interface must distinguish:

```text
Verified data
```

from:

```text
AI interpretation
```

---

# 60. AI source transparency

Every AI-derived insight should allow:

```text
Why am I seeing this?
```

or:

```text
View sources
```

Example:

```text
Based on:
• 6 standup submissions
• 4 open blockers
• 18 task records
```

Do not expose information the user could not independently access.

---

# 61. Phase 4C — Task Analytics

Route:

```text
/admin/task-analytics
```

---

# 62. Analytics UI architecture

```text
Task Analytics

[ Period ] [ Team ] [ Assignee ] [ Status ] [ Export ]

Overview
────────────────────────────────────────

Completed       Open        Overdue
  126            84            12

────────────────────────────────────────

Created vs Completed

       chart

────────────────────────────────────────

Backlog trend

       chart

────────────────────────────────────────

Execution

Cycle time       Throughput       On-time
...
```

Avoid the common dashboard mistake of displaying 12–20 unrelated KPI cards.

---

# 63. Analytics visual hierarchy

Use three levels.

### Level 1 — KPIs

Only the most important metrics.

### Level 2 — Trends

Charts showing change over time.

### Level 3 — Investigation

Tables and drill-downs.

This keeps the dashboard useful for both executives and operational managers.

---

# 64. Analytics drill-down

A chart should be actionable.

Example:

```text
Overdue tasks: 12
```

Clicking it:

```text
Tasks
Filter:
Status ≠ Done
Due date < Today

12 results
```

The analytics page should not become a dead-end reporting screen.

---

# 65. Employee/team analytics UX

Avoid:

```text
Top employees
1. Sarah — 87 tasks
2. Daniel — 72 tasks
3. Michael — 61 tasks
```

This can encourage undesirable behavior and misrepresent work complexity.

Prefer:

```text
Team execution

Assignee      Open   Completed   Overdue   Cycle time
Sarah          8       21          1       2.4 days
Daniel         6       18          0       2.1 days
Michael        9       16          2       3.2 days
```

Provide contextual interpretation rather than simplistic rankings.

---

# 66. Export UX

Export action:

```text
[ Export ]
```

opens:

```text
Export task report

Format
○ CSV
○ XLSX

Scope
● Current filters
○ Entire permitted dataset

[ Cancel ] [ Export ]
```

Large exports should become asynchronous jobs.

Example:

```text
Your export is being prepared.

We'll notify you when it's ready.
```

---

# 67. Phase 4D — AI Task Copilot

## Entry point

Place a compact AI entry point above the task list.

Example:

```text
✨ Describe a task...
```

Placeholder:

```text
e.g. Follow up with Sarah on Friday at 10am
```

Do not make the AI bar visually dominate the page.

---

# 68. AI draft interaction

User enters:

```text
Follow up with Sarah on Friday at 10am
```

AI returns:

```text
Create task

Follow up with Sarah
────────────────────────

Due
Friday · 10:00 AM
Timezone: Africa/Accra

Assignee
Sarah

Category
Follow Up

────────────────────────

[ Edit ]                 [ Create task ]
```

If ambiguity exists:

```text
I found two people named Sarah.

Which one do you mean?

○ Sarah Mensah — Acme School
○ Sarah Owusu — Finance

[ Cancel ]
```

Never silently guess when ambiguity is material.

---

# 69. AI confirmation rule

This is mandatory.

Never:

```text
User prompt
 ↓
AI
 ↓
Firestore write
```

Required:

```text
User prompt
 ↓
AI structured proposal
 ↓
Validation
 ↓
Preview
 ↓
User confirmation
 ↓
Task Core
 ↓
Firestore
```

This follows the source specification's human-in-the-loop requirement. 

---

# 70. AI loading state

Use a subtle inline state:

```text
✨ Thinking…
```

not a full-screen loading screen.

---

# 71. AI error state

```text
I couldn't turn that into a task.

Try including a person, action, or due date.

[ Try again ]
```

Do not expose model errors to ordinary users.

---

# 72. AI task decomposition

On Task Detail:

```text
✨ Suggest steps
```

AI response:

```text
Suggested checklist

☐ Review current pricing
☐ Confirm internal approval
☐ Prepare client proposal
☐ Send proposal
```

Buttons:

```text
[ Add all ] [ Edit ]
```

Do not automatically add them.

---

# 73. AI action-item extraction

From an authorized meeting:

```text
Suggested tasks

3 actions identified

☐ Send revised proposal
   Owner: Sarah
   Due: Friday

☐ Schedule follow-up
   Owner: Daniel
   Due: Next Tuesday

☐ Review contract
   Owner: Unassigned

[ Review all ]
```

Every task must retain source attribution.

---

# 74. AI risk insights

Example:

```text
Execution insight

3 tasks may be at risk of missing their deadlines.

Why?
• Due within 24 hours
• Still in Todo
• No recent activity

[ Review tasks ]
```

Avoid authoritative language such as:

```text
Sarah will fail to complete this task.
```

Use probabilistic/observational language.

---

# 75. PHASE 5 — Integration hardening and production optimization

Although the source roadmap ends at Phase 4, the production roadmap should include a stabilization phase before the upgrade is considered complete.

---

# 76. Phase 5 UI audit

Perform a complete cross-module UX audit.

Verify task appearance in:

* `/admin/tasks`;
* dashboard Task Widget;
* CRM entity pages;
* Deals;
* DocSigning;
* Meetings;
* Surveys;
* Forms;
* Automation;
* activity feeds;
* AI interfaces.

A task should look and behave consistently wherever it appears.

---

# 77. Cross-module task card standard

Any embedded task should use the same compact information model:

```text
Task title
Status · Priority
Due date · Assignee
Relationship
```

Example:

```text
Follow up with Acme
In Progress · High
Due today · Sarah
Acme School
```

Do not create separate task-card designs for each module.

---

# 78. Phase 5 integration failure UX

If a downstream system fails:

```text
Task completed

Contract synchronization is pending.

[ View synchronization status ]
```

If permanently failed:

```text
Task completed

Contract obligation could not be synchronized.

[ Retry synchronization ]
```

This is materially better than silently failing or falsely showing fulfillment.

---

# 79. PHASE 6 — Production readiness

Before production rollout, the AI agent must produce a checklist report.

## Security

* [ ] Cross-tenant authorization tested.
* [ ] Direct endpoint invocation tested.
* [ ] Bulk operations tested.
* [ ] MCP authorization tested.
* [ ] AI permissions tested.
* [ ] Export permissions tested.
* [ ] Private standup information tested.

## UI

* [ ] Desktop.
* [ ] Tablet.
* [ ] Mobile.
* [ ] Keyboard.
* [ ] Screen reader.
* [ ] Empty states.
* [ ] Loading states.
* [ ] Error states.
* [ ] Permission states.
* [ ] Long titles.
* [ ] Large datasets.
* [ ] Long names.
* [ ] Multiple assignees where supported.
* [ ] No-data dashboards.

## Performance

* [ ] 500 tasks.
* [ ] 5,000 tasks.
* [ ] 50,000 tasks.
* [ ] Large filter result sets.
* [ ] Large exports.
* [ ] Concurrent mutations.
* [ ] Background reminder processing.

## Data integrity

* [ ] Task completion.
* [ ] Reopening.
* [ ] Contract obligation synchronization.
* [ ] Automation-generated tasks.
* [ ] AI-created tasks.
* [ ] Standup links.
* [ ] Carryovers.
* [ ] Analytics reconciliation.

---

# 80. AI coding-agent execution rules

The following section should be treated as an instruction contract for AI development agents.

## Rule 1 — Inspect before modifying

Before modifying a component, inspect:

* its imports;
* its consumers;
* its server actions;
* its types;
* its data source;
* its existing styling;
* related components.

Never rewrite a component based solely on its filename.

---

## Rule 2 — Do not duplicate services

If an existing service already resolves:

* entities;
* permissions;
* users;
* tags;
* activities;
* relationships;
* variables;
* notifications;

reuse it.

Do not create:

```text
newTaskPermissionService
newEntityLookupService
newTagService
```

without establishing that the existing service cannot satisfy the requirement.

---

# 81. Rule 3 — UI must never become the business-logic layer

Do not put:

* authorization;
* contract fulfillment;
* workspace validation;
* state transition rules;
* integration logic;

inside React components.

Components request operations.

Domain services enforce them.

---

# 82. Rule 4 — Never bypass the canonical Task Core

Forbidden:

```typescript
updateDoc(taskRef, ...)
```

from a Task UI component.

Preferred:

```text
Component
 → Server Action
 → Task Core
 → Firestore
```

The source architecture explicitly identifies direct client Firestore mutations as a critical defect. 

---

# 83. Rule 5 — Do not introduce UI states without defining their source

Every displayed state must correspond to an authoritative state.

For example:

Bad:

```text
Contract fulfilled
```

when only the task has been completed.

Good:

```text
Task completed
Contract synchronization pending
```

until DocSigning confirms fulfillment.

---

# 84. Rule 6 — Do not hide errors

Every mutation requires:

```text
loading
success
failure
```

behavior.

Every async background operation requires an observable operational state.

---

# 85. Rule 7 — Avoid modal overload

Use:

* inline editing;
* drawers;
* popovers;
* contextual menus;

where appropriate.

Reserve modal dialogs for:

* destructive confirmation;
* complex focused workflows;
* explicit user decisions.

---

# 86. Rule 8 — Avoid visual noise

Do not add a card merely because a component needs a container.

Prefer:

```text
section
────────────
content
```

over:

```text
┌──────────────────────────────┐
│ ┌──────────────────────────┐ │
│ │ ┌──────────────────────┐ │ │
│ │ │      content        │ │ │
│ │ └──────────────────────┘ │ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

---

# 87. Rule 9 — Preserve user context

After:

* saving a task;
* changing status;
* applying filters;
* loading more;
* completing a checklist item;

do not unnecessarily navigate the user away from the current context.

---

# 88. Rule 10 — Do not create fake intelligence

AI should never invent:

* people;
* CRM entities;
* deadlines;
* task completion;
* contract status;
* blockers;
* performance results.

When uncertain, ask.

---

# 89. Rule 11 — AI suggestions are visually distinct

AI-generated information should use a subtle AI indicator:

```text
✨ AI suggestion
```

but must not be styled as more authoritative than system data.

---

# 90. Rule 12 — Every feature must work without AI

AI must enhance the task system.

It must never become a dependency for:

* creating a task;
* editing a task;
* completing a task;
* submitting a standup;
* resolving a blocker;
* viewing analytics.

---

# 91. Recommended final navigation

Once the upgrade is complete:

```text
Operations
│
├── Tasks
│   ├── My Tasks
│   ├── Team Tasks
│   ├── All Tasks
│   ├── Board
│   └── Calendar
│
├── Standups
│   ├── My Standup
│   ├── Team
│   ├── Blockers
│   └── History
│
└── Task Analytics
    ├── Overview
    ├── Execution
    ├── Workload
    ├── Blockers
    └── Standups
```

The exact navigation placement should follow SmartSapp's existing global navigation rather than introducing a separate Tasks application shell.

---

# 92. Final implementation sequence

```text
PHASE 0
Discovery + Design Foundation
        │
        ▼
PHASE 1
Security + Canonical Mutation Engine
        │
        ▼
PHASE 2
UI Hardening + Typing + Workspace Standards
        │
        ▼
PHASE 3
Reminders + Tags + Relationships + Checklists
        │
        ▼
PHASE 4
Pagination + Standups + Blockers + AI
        │
        ▼
PHASE 5
Analytics + Cross-Module Integration Hardening
        │
        ▼
PHASE 6
Security + Performance + Accessibility + Production Readiness
```

## Critical dependency

**Do not allow the AI coding agent to jump directly to Phase 4 because the AI Copilot is visually attractive.**

The correct dependency chain is:

```text
Secure mutation architecture
        ↓
Reliable task lifecycle
        ↓
Consistent UI primitives
        ↓
Complete task execution
        ↓
Scalable data access
        ↓
Standups / analytics
        ↓
AI assistance
```

That ordering is particularly important for SmartSapp because the current audit already identifies a situation where different UI entry points can mutate the same task through different paths, bypassing authorization, activity logging and the DocSigning obligation hook. 

**The end state should therefore not merely be a better-looking Tasks page. It should be one governed operational execution system whose UI, server actions, CRM integrations, automation engine, background workers, analytics and AI all operate on the same canonical task domain.**
