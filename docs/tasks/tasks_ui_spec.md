# SmartSapp CRM --- Task Management, Standups & AI Intelligence

## Comprehensive UI/UX Product Design Specification

**Document purpose:** Define the user experience, interaction patterns,
visual system, responsive behavior, accessibility standards, and
phase-by-phase UI implementation requirements for the SmartSapp CRM
Tasks upgrade.

**Product principle:** Make the next useful action obvious. Keep routine
work fast, complex work understandable, and AI optional, transparent,
and user-controlled.

**Status:** Implementation specification for design and engineering
agents\
**Scope:** Existing Tasks experience, task execution workflows,
standups, blockers, operational analytics, AI assistance, and
cross-module consistency.

------------------------------------------------------------------------

## 1. Product experience principles

### 1.1 Follow the user's model

The product must reflect how users think about work, rather than forcing
users to understand the underlying data model.

The primary user mental model is:

1.  **What needs my attention?** --- My Tasks, overdue work, blockers,
    reminders, and requests for help.
2.  **What am I working on?** --- Tasks, due dates, priorities,
    checklists, relationships, and next steps.
3.  **What does my team need?** --- Team tasks, assignments, standups,
    blockers, and decisions.
4.  **What happened and what comes next?** --- Activity history,
    carryovers, trends, and AI suggestions.
5.  **What can I do now?** --- Create, update, assign, complete, ask for
    help, or follow up.

The interface should use these concepts as the navigation and content
hierarchy. Avoid exposing internal concepts such as event envelopes,
outbox records, recurrence IDs, or integration adapters to ordinary
users.

### 1.2 Minimalism with operational clarity

-   Use a calm, light interface with white or near-white surfaces,
    neutral borders, restrained shadows, and SmartSapp blue (`#3a86ff`)
    for primary actions and meaningful emphasis.
-   Prefer typography, spacing, alignment, and clear labels over
    decorative cards, gradients, large illustrations, or excess color.
-   Use status and priority colors consistently and never communicate
    meaning through color alone.
-   Keep the primary page action obvious. Avoid multiple competing
    primary buttons.
-   Show secondary information only when it helps the user decide or
    act.
-   Use progressive disclosure: simple actions first; advanced options
    in expandable sections or contextual panels.
-   Avoid placing every field, filter, KPI, and action on the initial
    screen.
-   Preserve familiar patterns across the app. A task should look and
    behave like the same task when opened from Tasks, a CRM record, a
    deal, a meeting, or a standup.

### 1.3 Speed and predictability

-   Common tasks should be completable with minimal navigation and
    without unnecessary modal chains.
-   Preserve a user's filters, view, scroll position, and unsaved draft
    when practical.
-   Make loading, saving, success, partial failure, and permission
    denial visible.
-   Never make a UI imply that a background integration succeeded before
    it confirms success.
-   Use optimistic updates only when rollback and error recovery are
    implemented.
-   Keep keyboard, pointer, touch, and screen-reader interactions
    functionally equivalent.

### 1.4 Trust and user control

-   AI-generated content is always a suggestion or draft until the user
    confirms it.
-   Explain why an AI suggestion appears and provide source links when
    available.
-   Never silently mark a task complete, reassign work, change
    deadlines, or change priority through AI.
-   Clearly distinguish self-reported standup commitments from verified
    task state.
-   Protect private notes and show visibility labels before submission.
-   Do not turn activity counts into simplistic employee performance
    rankings.

------------------------------------------------------------------------

## 2. Primary users and jobs to be done

### Individual contributor

Needs a quick view of today's work, clear next actions, reminders, easy
completion, and a low-friction daily standup. The default experience
should prioritize personal work rather than team-wide administration.

### Team lead or supervisor

Needs to see team commitments, missing standups, blocked work, overdue
items, ownership, and requests for decisions. The UI should support
intervention without making routine task maintenance cumbersome.

### Workspace administrator

Needs to configure task types, workflow, tags, fields, reminders,
templates, permissions, and standup cadence. Configuration should be
separate from daily execution.

### CRM operator or advisor

Needs tasks connected to contacts, institutions, deals, meetings,
documents, and other CRM records. Relationship context should be
available without duplicating the entire linked record.

### Operations or executive manager

Needs reliable trends and drill-downs into backlog, throughput, overdue
work, cycle time, blockers, commitments, and team operating health.
Analytics must show definitions, date ranges, and freshness.

### AI or automation actor

Needs a governed, auditable way to propose and execute permitted
actions. Its activity must be attributable to the initiating user,
workflow, or system actor.

------------------------------------------------------------------------

## 3. Information architecture and navigation

Keep the primary navigation small and action-oriented.

### Recommended navigation

**Operations** - **Tasks** - My Tasks - Team Tasks - All Tasks (only for
users with permission) - Board - Calendar - **Standups** - My Standup -
Team Overview - Blockers - History - **Task Analytics** - Overview -
Execution - Workload - Blockers - Standups

Use the application's existing navigation shell and permission-aware
menu system. Do not create a new standalone shell for this feature.

### Navigation rules

-   Hide inaccessible destinations rather than presenting links that
    fail after navigation; where discoverability is needed, show a
    permission explanation.
-   Keep My Tasks as the default landing context for contributors.
-   Remember the last selected task view per user where consistent with
    existing app preferences.
-   Keep global search and global creation patterns consistent with the
    rest of SmartSapp.
-   Do not place configuration controls in the primary daily workflow.
    Link to configuration from a clearly labeled settings area.
-   Keep URL state shareable where appropriate: view, filters, search,
    date range, and selected tab should be represented in query
    parameters if the existing routing conventions support it.

------------------------------------------------------------------------

## 4. Global visual and interaction system

### 4.1 Visual tokens

Use existing SmartSapp design tokens when available. Do not introduce a
parallel design system.

-   **Primary action:** SmartSapp blue `#3a86ff`.
-   **Surface:** white and subtle neutral backgrounds.
-   **Borders:** light neutral dividers; avoid heavy outlines around
    every element.
-   **Typography:** use the existing product font system. Establish a
    clear hierarchy with page title, section title, body, metadata, and
    helper text.
-   **Radius:** modest, consistent radii. Avoid excessive pill-shaped
    containers except for compact status/priority badges where useful.
-   **Elevation:** reserve shadows for overlays, menus, and drawers.
    Most page content should use spacing and borders rather than
    floating cards.
-   **Color semantics:** use a consistent semantic palette for success,
    warning, danger, information, and neutral states. Confirm color
    contrast and avoid relying on color alone.

### 4.2 Layout and density

-   Use a consistent page container, alignment grid, and spacing scale.
-   Prefer compact but readable operational density. Do not make task
    rows unnecessarily tall.
-   Keep primary content wider than secondary metadata.
-   Use a responsive grid only when it improves scanning; avoid cards
    for every data point.
-   Use tables or list rows for high-volume operational data and cards
    for content that benefits from independent summaries.
-   Avoid nested cards and redundant section borders.
-   Provide a comfortable reading width for forms, standup answers, and
    long descriptions.

### 4.3 Buttons and actions

-   One primary action per page region, normally **New task**, **Submit
    standup**, or **Export** depending on the page.
-   Secondary actions should be visually quieter.
-   Destructive actions must be separated from routine actions and
    require confirmation when consequential.
-   Use verb-first labels: "Create task", "Assign", "Mark complete",
    "Request help", "Resolve blocker".
-   Icon-only controls require accessible names and tooltips; do not use
    ambiguous icons without labels in high-impact actions.
-   Disable controls only when necessary and explain why if the reason
    is not obvious.

### 4.4 Status, priority, and metadata

Create reusable, consistent components: - `TaskStatusBadge` -
`TaskPriorityBadge` - `TaskAssignee` - `TaskDueDate` -
`TaskRelationshipBadge` - `TaskTags` - `TaskChecklistProgress` -
`TaskSourceBadge` - `TaskCard` - `TaskListRow` - `TaskViewSwitcher` -
`TaskFilters` - `TaskEmptyState` - `TaskErrorState` - `TaskSkeleton` -
`TaskEditor` - `ConfirmDialog`

Status labels must be plain-language and consistent with workflow
configuration. Priority should be visually secondary to title and status
unless the current context is explicitly prioritization. Overdue dates
should be explicit in text, not only red.

### 4.5 Feedback and system states

Every important interaction must support: - Initial loading and skeleton
state. - Empty state with a useful next action. - Validation errors
adjacent to the affected field. - Saving state that prevents accidental
duplicate submission. - Success confirmation with an understandable
result. - Recoverable failure with a retry path where safe. -
Permission-denied state without leaking record data. - Partial-success
state for bulk actions. - Background processing state for integrations,
exports, or AI work.

Do not use a toast as the only record of a persistent failure. Important
failures should remain visible near the affected object.

------------------------------------------------------------------------

## 5. Core user journeys

### Journey A --- Create and complete a task

1.  User selects **New task** from Tasks or a CRM record.
2.  A compact editor opens with the minimum required fields visible:
    title, assignee, due date, priority, and related record when
    applicable.
3.  Advanced fields (description, tags, checklist, reminders,
    recurrence, custom fields) are available without overwhelming the
    initial form.
4.  The form validates inline and preserves entered content if a save
    fails.
5.  After creation, the task appears in the active view and a detail
    panel can be opened.
6.  The user can update status, checklist items, comments, reminders,
    and relationships from the detail view.
7.  Completing the task shows confirmation and the authoritative
    completion state. If a linked integration is still processing, show
    that separately.

### Journey B --- Review and unblock team work

1.  Team lead opens Team Overview.
2.  The page shows a concise summary of submissions, blockers, overdue
    work, and commitments requiring attention.
3.  Selecting a blocker opens its details, affected tasks, owner, age,
    and history.
4.  The lead acknowledges, assigns, escalates, or resolves the blocker
    with a short, explicit action.
5.  Affected users receive configured notifications. The UI shows
    delivery/processing status when available.

### Journey C --- Submit a daily standup

1.  Contributor opens My Standup.
2.  The page shows the reporting date and timezone and pre-populates
    eligible recent tasks as optional suggestions.
3.  The contributor confirms completed work, planned work, blockers, and
    help requests.
4.  Each section is editable; suggested items are not treated as
    confirmed facts.
5.  Private manager notes have a separate, clearly labeled field with
    visibility explained.
6.  Before submission, the user sees a compact review of what will be
    shared.
7.  After submission, the status and edit window are visible. The
    standup does not silently change task status.

### Journey D --- Use AI to prepare work

1.  User opens the AI task assistant or action-item helper.
2.  User enters a natural-language request or selects authorized source
    material.
3.  AI returns a structured draft with extracted fields and any
    ambiguities called out.
4.  The user reviews and edits the draft; sources are linked where
    applicable.
5.  The user explicitly confirms creation or execution.
6.  The canonical task service validates permissions and data, then
    executes.
7.  The UI reports success or failure and provides an audit/history
    reference.

------------------------------------------------------------------------

# 6. Phase-by-phase UI/UX roadmap

## Phase 0 --- Discovery, design foundation, and current-state validation

### Objective

Understand the current product and establish consistent UI rules before
changing workflows or building new screens.

### UX work

-   Map current Tasks entry points, task creation flows, task detail
    surfaces, status controls, list/board/calendar views, filters, empty
    states, and mobile behavior.
-   Inventory all ways users encounter tasks from dashboards, CRM
    records, Deals, DocSigning, meetings, surveys, forms, automations,
    and activity feeds.
-   Identify duplicate labels, inconsistent badges, broken deep links,
    unclear status transitions, hidden pagination limits, and confusing
    permission states.
-   Interview or review feedback from contributors, team leads, and
    administrators where available. Do not assume all users need the
    same default view.
-   Document the most common user journeys and their current friction
    points.
-   Establish baseline measures: time to create a task, time to find a
    task, completion success rate, filter use, mobile task completion,
    and common failure points.

### UI deliverables

-   Current-state journey map and navigation map.
-   Task design tokens and component inventory.
-   Page-level wireframes for Tasks, Task Detail, task editor, standups,
    and analytics.
-   Interaction-state inventory: loading, empty, error, permission
    denied, success, partial success, and integration pending.
-   Responsive breakpoints and accessibility checklist.
-   Visual regression baseline before implementation changes.

### Acceptance criteria

-   Every task entry point and mutation path has an owner and documented
    behavior.
-   Shared status/priority labels and component variants are defined.
-   New UI work reuses existing SmartSapp shell and design tokens.
-   Known inconsistencies and accessibility gaps are captured as tracked
    issues.
-   No new workflow is designed around unverified backend capabilities.

------------------------------------------------------------------------

## Phase 1 --- Secure canonical mutation engine and trustworthy feedback

### Objective

Make every task action reliable and permission-aware before adding more
UX complexity.

### UX treatment

The UI must make a clear distinction between an action being requested,
saved, and fully synchronized with connected systems. It must not expose
backend complexity unnecessarily, but must communicate meaningful
pending states.

### Task list and board

-   Route all create, edit, assignment, status, bulk, and completion
    operations through the canonical server-side task service.
-   Show a pending state on the affected row/card while a mutation is in
    progress.
-   If optimistic updates are used, immediately restore the previous
    state on failure and show a clear explanation.
-   For Kanban drag-and-drop, provide an equivalent keyboard-accessible
    status menu or action button.
-   Prevent duplicate submissions while the same operation is pending.
-   Bulk actions show a review step that names the action and number of
    selected tasks. For destructive actions, clearly identify the
    impact.
-   Report partial bulk failures by item or category and offer retry
    only for safe failed items.

### Task detail and integrations

-   On completion, display the task's authoritative state after server
    confirmation.
-   If a linked DocSigning obligation or other integration is pending,
    show a small "Sync pending" state and allow authorized users to
    inspect or retry according to policy.
-   Do not show "Synced" until the integration confirms success.
-   Preserve task title, form contents, filters, and current context
    after recoverable errors.

### Permission UX

-   If the user can view but not edit, keep read-only content available
    and explain the unavailable action only when relevant.
-   Do not reveal sensitive fields or linked records when the user lacks
    permission.
-   For an expired session, offer re-authentication without losing a
    recoverable draft.
-   Avoid generic "Something went wrong" messages when a safe,
    actionable explanation is available.

### Acceptance criteria

-   No task UI path writes directly to Firestore outside the approved
    mutation architecture.
-   Every mutation has loading, success, failure, and permission-denied
    states.
-   Kanban has a non-drag alternative.
-   Bulk operations clearly report full and partial outcomes.
-   Integration status reflects confirmed backend state.

------------------------------------------------------------------------

## Phase 2 --- Core Tasks experience, typing consistency, and workspace standards

### Objective

Make the main Tasks screen predictable, easy to learn, and consistent
across users and workspaces.

### Tasks landing page

**Recommended page hierarchy** 1. Page title: **Tasks** 2. Brief context
or selected scope: **My Tasks**, **Team Tasks**, or **All Tasks** 3.
Primary action: **New task** 4. View switcher: **List**, **Board**,
**Calendar** 5. Search and filters 6. Main task content 7. Pagination or
load-more control

Avoid adding KPI cards above the task list unless they answer an
immediate operational question. If summary counts are useful, use a
compact summary line or a small set of restrained metrics.

### Default experience

-   Contributors land on My Tasks.
-   Team leads can switch to Team Tasks without changing modules.
-   All Tasks is permission-controlled.
-   Remember user preferences where appropriate, but provide an obvious
    way to reset filters.
-   Keep the active scope and filters visible; avoid hidden filter
    state.

### List view

-   Use a compact, scannable list with consistent column alignment.
-   Recommended columns: task title, status, priority, assignee, due
    date, and relationship. Add tags or source only when useful for the
    user's selected context.
-   Keep row actions contextual and minimal; avoid showing every
    possible action on every row.
-   Support sorting, multi-filtering, keyboard navigation, and selection
    for bulk actions.
-   Truncate long titles predictably and show the full title on
    detail/open.
-   On narrow screens, convert rows to compact stacked summaries instead
    of compressing every column.

### Board view

-   Columns reflect configured workflow statuses and preserve their
    configured order.
-   Each card shows title, priority, due date, assignee, and one
    relevant relationship at most before overflow.
-   Avoid putting description, every tag, all metadata, and all actions
    on each card.
-   Provide an accessible status-change action separate from dragging.
-   For large boards, support column-level loading and avoid rendering
    the full workspace at once.

### Calendar view

-   Use a clear month/week/list agenda model according to existing
    product patterns.
-   Show task title and priority without overcrowding dates.
-   Make overdue tasks discoverable even if their due date is outside
    the visible range.
-   Provide an agenda/list fallback for small screens and assistive
    technologies.
-   Clearly distinguish due date from start date where both exist.

### Filters and search

-   Start with high-value filters: status, assignee, priority, due date,
    tags, task type, and related CRM record.
-   Put advanced filters behind a labeled **More filters** control.
-   Show active filters as removable chips and provide **Clear all**.
-   Keep filter application predictable. Use immediate application for
    simple filters or an explicit Apply action for complex filter
    panels, consistent with the app's existing patterns.
-   Preserve search query and filters when opening a task and returning
    to results.
-   Display a helpful no-results state that identifies active filters
    and offers to clear them.

### Task editor

-   Use a side panel or focused dialog for routine creation; use a full
    page only for workflows that genuinely need more space.
-   Keep the first screen short: title, assignee, due date, priority,
    and relationship.
-   Put description, tags, checklist, reminders, recurrence, and custom
    fields in clear secondary sections.
-   Use labels that remain visible when a field has a value; do not rely
    on placeholders as labels.
-   Group related fields and order them by typical frequency of use.
-   Allow creation from a CRM record to prefill the relationship without
    forcing users to re-select it.
-   Make required fields and validation rules explicit.

### Type and label consistency

-   Standardize status, priority, assignee, source, due date, and
    relationship components across all entry points.
-   Normalize legacy single/multiple assignee representations in the UI
    through a compatibility layer; do not expose inconsistent data
    shapes to components.
-   Use consistent empty-state language and error patterns across views.

### Acceptance criteria

-   A first-time user can identify where to view personal work and how
    to create a task without training.
-   Common task creation is possible without opening advanced options.
-   List, Board, and Calendar expose equivalent essential task
    information and actions.
-   Filters are visible, reversible, and preserved when navigating back.
-   All views are responsive and keyboard operable.

------------------------------------------------------------------------

## Phase 3 --- Complete task execution: reminders, tags, relationships, checklists, and detail

### Objective

Make tasks useful as an execution workspace, not merely a title and due
date.

### Task detail panel/page

Use a clear information hierarchy:

**Header** - Task title - Status - Priority - Primary action
(contextual: Mark complete, Reopen, or Edit) - Overflow menu for
secondary actions

**Main content** - Description - Checklist or subtasks with progress -
Comments and activity - Blocker state, if applicable

**Context panel or secondary section** - Assignees - Due date and
reminder settings - Tags - Related CRM record, deal, project, or
source - Created by, created date, and last updated metadata

On mobile, use a single-column flow with compact sections and sticky
primary action only if it does not obstruct content.

### Checklist and subtasks

-   Make checklist completion a fast, direct interaction.
-   Show progress such as "3 of 5 complete" as text and, optionally, a
    subtle progress indicator.
-   Distinguish lightweight checklist items from separately assigned
    subtasks with their own lifecycle.
-   Make parent/child relationships explicit.
-   Explain any configured rule that prevents parent completion while
    required subtasks remain open.
-   Do not create nested layouts that become unreadable on mobile.

### Tags

-   Use the shared `TagSelector` in the correct draft/client mode.
-   Show a small number of tags in list rows and cards; use overflow for
    the rest.
-   Use workspace task tag IDs, not contact tags.
-   Provide a clear way to add/remove tags and a meaningful no-tags
    state.
-   Maintain contrast and text labels even when tags use colors.

### Reminders

-   Present reminders in plain language, for example "On the due date at
    9:00 AM".
-   Make timezone explicit where ambiguity is possible.
-   Show whether a reminder is scheduled, sent, failed, or cancelled
    when the system exposes that information.
-   Allow users to edit or cancel reminders and respect workspace/user
    notification preferences and consent.
-   Avoid implying guaranteed delivery when the channel is unavailable
    or delivery is still pending.
-   Keep reminder configuration collapsed by default for routine tasks
    unless it is a frequent user action.

### CRM relationships

-   Display linked entities as compact, meaningful chips or inline links
    with type and name.
-   Use authorized deep links to open the related record.
-   Provide a small preview on demand rather than expanding a full CRM
    record inside the task.
-   If a linked record is deleted or inaccessible, show a neutral
    unavailable state without exposing private details.
-   Keep entity identity canonical; display names are presentation
    metadata.

### Comments and activity

-   Separate user discussion from system audit history.
-   Make actor and timestamp readable.
-   Group repetitive system events where this improves scanability,
    without hiding consequential changes.
-   Keep private notes visually and semantically distinct from shared
    comments.
-   Support attachments only through approved storage and permission
    flows.

### Acceptance criteria

-   Users can identify task ownership, next action, due date, related
    record, and completion state at a glance.
-   Checklist progress and subtasks are understandable without technical
    explanation.
-   Reminder states are accurate and editable.
-   Related records remain permission-aware.
-   Comments, activity, and private notes are visually distinguishable.

------------------------------------------------------------------------

## Phase 4A --- Scale, pagination, and advanced task discovery

### Objective

Keep the task experience usable as workspaces grow from hundreds to
thousands or more tasks.

### UX treatment

-   Replace silent fixed-size result limits with cursor-based pagination
    or a similarly explicit progressive-loading model.
-   Show result count only when the count is reliable and affordable;
    otherwise label it as an estimate or omit it.
-   Use **Load more** or incremental scrolling only when it fits
    existing product patterns and accessibility requirements.
-   Preserve the current search, filters, sorting, and scroll position
    when loading more results.
-   Show loading feedback at the point where more records will appear.
-   Make "no more results" clear without a noisy end-of-list banner.
-   For large exports, show a queued/processing state and notify the
    user when the file is ready.
-   Use server-side filters and sorting; do not fetch the entire
    workspace and filter only in the browser.

### Empty and edge cases

-   Differentiate "No tasks exist yet" from "No tasks match these
    filters".
-   Handle deleted, archived, or inaccessible tasks without breaking the
    list.
-   If a cursor becomes invalid after a filter change, reset safely and
    explain only if necessary.
-   Avoid showing duplicate tasks during pagination or after a live
    update.

### Acceptance criteria

-   No silent 200-task ceiling.
-   Pagination does not lose user context or duplicate results.
-   Loading and empty states are consistent.
-   Large exports do not freeze the main UI.
-   Performance is validated with realistic workspace volumes.

------------------------------------------------------------------------

## Phase 4B --- Daily standups, commitments, carryovers, and blockers

### Objective

Create a lightweight daily coordination workflow that helps teams share
progress and unblock work without becoming a burdensome reporting form.

### Standups navigation

Provide four simple destinations: - **My Standup** --- create or amend
today's report. - **Team Overview** --- see submission state,
commitments, and needs for help. - **Blockers** --- manage impediments
through resolution. - **History** --- review prior reports and
carryovers.

### My Standup

Use a short, vertically ordered form with four core prompts:

1.  **Completed** --- What did you finish since your last update?
2.  **Planned** --- What will you work on next?
3.  **Blocked** --- What is preventing progress?
4.  **Help needed** --- Do you need a decision, access, or support?

-   Pre-fill optional task suggestions only when the data is authorized
    and relevant.
-   Mark suggestions as "Suggested from your tasks" and require user
    confirmation.
-   Let users link existing tasks and authorized CRM records.
-   Allow free-text entries for work that is not represented by a task.
-   Make it easy to remove an irrelevant suggestion.
-   Keep the form short; use expandable detail for optional context.
-   Save drafts safely and indicate when the draft is saved.
-   Clearly label the private-to-manager note, who can read it, and
    whether it is included in summaries.
-   Before submission, provide a compact review of shared content.
-   Show submission date/time, timezone, edit policy, and current state.

### Team Overview

The team view should prioritize exceptions and decisions over a wall of
text.

Recommended hierarchy: 1. Submission status summary: submitted, not yet
submitted, and exempt if configured. 2. Blockers and help requests
requiring attention. 3. Commitments due or carried over. 4. Team member
updates, with concise expandable details. 5. Links to relevant tasks and
records.

-   Missing submission must be distinct from a submitted report with no
    blockers.
-   Use clear labels such as "Awaiting submission" rather than
    interpreting absence as failure.
-   Provide a filter by team/date/status when the user has permission.
-   Respect team membership and visibility settings.
-   Do not show private manager notes to the broader team.

### Blocker lifecycle

A blocker should display: - Short summary and category - Severity where
configured - Affected tasks/records - Owner and person who raised it -
Date raised and age - Current status - Latest action and history

Actions should be explicit: **Acknowledge**, **Assign owner**,
**Escalate**, **Add update**, **Resolve**.

-   Resolution requires a brief resolution note when configured.
-   Keep resolved blockers searchable in history.
-   Do not rely on red color alone to identify a blocker.
-   Explain the difference between a task being marked as blocked and a
    blocker record being managed through a lifecycle.

### Carryovers and commitments

-   Link carried-over commitments to the original standup entry and task
    where applicable.
-   Clearly label a carryover as a continuation, not a newly completed
    or newly created task.
-   Let users update the commitment and explain the reason for carryover
    when required.
-   Avoid presenting carryovers as an employee score.
-   Show aggregate carryover patterns only with appropriate context and
    permission.

### AI summaries

-   Show the summary as an AI-generated synthesis, not a replacement for
    source reports.
-   Link statements to the source standup/task where possible.
-   Identify missing information and uncertainty.
-   Exclude private notes from team-facing summaries unless the
    configured policy explicitly permits their use for a restricted
    manager summary.
-   Offer retry or refresh for a failed summary without blocking access
    to original reports.

### Acceptance criteria

-   A contributor can submit a routine standup quickly without
    navigating multiple screens.
-   Suggestions are never submitted without user review.
-   Team leads can identify blockers and help requests without reading
    every full report.
-   Private notes are protected and their visibility is obvious.
-   Carryovers retain links to their original commitments.
-   Standup submission never silently changes task completion state.

------------------------------------------------------------------------

## Phase 4C --- Task analytics and operational insights

### Objective

Provide reliable, interpretable operational insights with direct paths
to action.

### Analytics navigation and hierarchy

Use tabs or a compact secondary navigation: - **Overview** -
**Execution** - **Workload** - **Blockers** - **Standups**

Avoid presenting every metric on a single dashboard. Each tab should
answer a distinct question.

### Overview

Answer: "Is work moving, and where should I look?" - Created
vs. completed trend - Open backlog and overdue trend - Current blocked
work - On-time completion or SLA measure where defined - Standup
submission status when relevant

### Execution

Answer: "How does work flow through the system?" - Throughput - Cycle
time and lead time with definitions - Status distribution - Overdue and
on-time trend - Drill-down to tasks behind a metric

### Workload

Answer: "How is work distributed?" - Open work by assignee/team -
Due-date concentration - Priority distribution - Workload trend -
Contextual comparison rather than simplistic leaderboard ranking

### Blockers

Answer: "What is stopping progress?" - Active blockers by
category/severity - Blocker age and time to resolution - Affected
tasks/teams - Repeated blocker patterns where data supports the
conclusion

### Standups

Answer: "Are commitments and requests being followed through?" -
Submission rate - Commitment completion and carryover trends - Help
requests and blocker trends - Clear distinction between self-reported
and task-system-derived metrics

### Interaction requirements

-   Every chart includes a meaningful title, date range, metric
    definition, and accessible text alternative.
-   Use filters for date range, team, assignee, task type, priority,
    entity/deal/project, and status where relevant.
-   Keep filters visible and show when a filter changes the
    interpretation.
-   Clicking a metric should open the corresponding permission-filtered
    task/report list.
-   Use consistent units and date/timezone conventions.
-   Show data freshness and explain when aggregation is delayed.
-   Distinguish zero from unavailable, incomplete, or not yet
    calculated.
-   Exports must be permission-scoped and audited. Large exports should
    be asynchronous.
-   Do not use visualizations that imply causation when only correlation
    is available.
-   Avoid ranking employees by raw task count or standup length.

### Acceptance criteria

-   Each metric has a documented definition and source.
-   Users can drill from summary to authorized records.
-   Missing or stale data is labeled clearly.
-   Charts are accessible and understandable without color
    interpretation.
-   Exports respect workspace and record-level permissions.

------------------------------------------------------------------------

## Phase 4D --- AI task copilot and action intelligence

### Objective

Make AI reduce effort while preserving user agency, data provenance, and
system reliability.

### Entry points

-   A compact **Ask AI** or **Draft with AI** entry point in Tasks.
-   An optional AI action in the task editor.
-   A contextual action-item extractor in authorized
    meeting/document/CRM surfaces.
-   AI summaries within Standups and Analytics only where they provide
    clear value.

Do not put a large AI panel on every page by default. The task
experience must remain complete and useful when AI is disabled.

### Natural-language task creation

-   Accept requests such as "Create a follow-up task for the school next
    Tuesday and assign it to the regional lead".
-   Parse title, description, assignee, date/time, timezone, priority,
    category, reminder, and CRM relationship when available.
-   Present a structured editable draft, not a chat response that must
    be manually re-entered.
-   Resolve relative dates using an explicit workspace/user timezone.
-   Ask a focused clarification question when the date, assignee, or
    related record is ambiguous.
-   Show unresolved fields and assumptions clearly.
-   Require explicit confirmation before creating the task.

### AI-generated draft presentation

-   Label AI-created content.
-   Make every proposed field editable.
-   Provide a compact "Why this was suggested" explanation where useful.
-   Link to source material and show only authorized source content.
-   Distinguish inferred fields from fields directly found in source
    content.
-   Allow users to dismiss or revise the draft without losing their
    original work.

### Task decomposition and action extraction

-   Present proposed subtasks in a reviewable checklist.
-   Let the user remove, edit, reorder, or accept proposed items.
-   For extracted meeting/document actions, include source title and
    link, with relevant excerpt or timestamp only when authorized and
    supported.
-   Detect likely duplicates where reliable; show the possible duplicate
    rather than silently merging.
-   Do not create tasks from untrusted document instructions without
    user confirmation.

### Risk insights

-   Use careful, non-authoritative language such as "May be at risk
    because the due date is approaching and the task remains blocked."
-   Explain the observable signals used.
-   Provide links to the affected task and recommended next action.
-   Never automatically change assignee, priority, or due date.
-   Do not present a risk signal as a guaranteed outcome or employee
    performance score.

### AI states

Support: idle, drafting, needs clarification, draft ready, executing,
completed, failed, and cancelled. - AI generation failure must not
prevent manual task creation. - Execution must go through the canonical
task service. - Keep the proposal and execution outcome
distinguishable. - Provide an audit trail without logging secrets or
unnecessary sensitive source text.

### Acceptance criteria

-   No AI write occurs before explicit confirmation.
-   AI suggestions are editable and provenance-aware.
-   Ambiguity triggers clarification rather than invented details.
-   AI respects the same workspace and record permissions as the user.
-   Manual workflows remain fully functional without AI.

------------------------------------------------------------------------

## Phase 5 --- Integration consistency and cross-module experience

### Objective

Make task behavior consistent wherever tasks appear across SmartSapp
CRM.

### Surfaces to audit

-   Tasks
-   Dashboards
-   CRM entity pages
-   Deals
-   DocSigning
-   Meetings
-   Surveys
-   Forms
-   Automations
-   Activity feeds
-   CompanyBrain/AI surfaces
-   Notifications and search results

### Cross-module UI rules

-   Reuse the same task title, status, priority, due date, assignee, and
    relationship components.
-   Show enough context to identify the task without duplicating the
    full task detail view.
-   Deep links must open the task or related record only when the user
    is authorized.
-   Use consistent labels and icons for source types.
-   If an integration is pending or failed, communicate the actual state
    and provide an authorized retry or support path.
-   Preserve source attribution, for example "Created from meeting" or
    "Created by automation", without making system-generated tasks look
    like user-authored content.
-   Avoid multiple competing copies of task status in different modules;
    use the canonical task state.
-   If the relationship is no longer available, use a neutral fallback
    state.

### Acceptance criteria

-   A task has consistent visual and behavioral semantics across all
    modules.
-   Deep links are permission-aware and do not expose inaccessible
    content.
-   Integration errors are visible and recoverable where possible.
-   There is one authoritative source of task status.

------------------------------------------------------------------------

## Phase 6 --- Production readiness, polish, accessibility, and adoption

### Objective

Validate the experience end-to-end, reduce friction, and ensure the
product is ready for real operational use.

### UI quality assurance

-   Test desktop, tablet, and mobile at representative widths.
-   Validate keyboard navigation, visible focus, screen-reader labels,
    color contrast, and zoom/reflow.
-   Verify that all icon-only actions have accessible names.
-   Test long task titles, long names, many tags, empty descriptions,
    missing relationships, and unusual dates/timezones.
-   Test empty, loading, error, retry, permission-denied, pending
    integration, and partial-success states.
-   Confirm modals and drawers have correct focus management and escape
    behavior.
-   Confirm no critical action is available only through drag-and-drop
    or hover.
-   Review layout density for both high-volume users and less frequent
    users.

### Performance and resilience UX

-   Keep primary task interactions responsive under realistic data
    volumes.
-   Avoid blocking the entire page while a secondary widget loads.
-   Use skeletons that match final content shape.
-   For long-running exports, AI summaries, or integrations, use a
    persistent status surface rather than a frozen button.
-   Explain when data is refreshing or stale.
-   Preserve recoverable input on transient failure.

### Adoption

-   Use brief contextual guidance only where users need it.
-   Avoid a mandatory tour that blocks the work.
-   Provide clear empty-state actions, concise helper text, and optional
    examples.
-   Use sensible defaults and templates.
-   Instrument key journeys with privacy-aware analytics: create-task
    completion, form abandonment, time to first task, standup
    completion, blocker resolution, and use of filters/views.
-   Use feedback to remove friction rather than add more UI.

### Acceptance criteria

-   Critical workflows pass end-to-end tests on supported screen sizes.
-   No critical task action requires hover or drag alone.
-   Users can recover from common failures without losing work.
-   Product analytics measure adoption and friction without collecting
    unnecessary sensitive content.
-   Product, engineering, security, and accessibility reviewers sign
    off.

------------------------------------------------------------------------

## 7. Responsive behavior

### Desktop

-   Use the available width for list/table scanning and contextual
    detail panels.
-   Keep primary actions and view controls near the page heading.
-   Use a side drawer for task detail when it preserves the list
    context.
-   Keep filter controls visible without consuming excessive vertical
    space.
-   Allow team/analytics pages to use multi-column layouts where
    comparison is meaningful.

### Tablet

-   Reduce visible metadata before shrinking text.
-   Keep primary actions reachable and avoid hover-only menus.
-   Use collapsible filter panels and a compact view switcher.
-   Ensure board columns remain navigable; provide a list/agenda
    fallback.

### Mobile

-   Prioritize My Tasks, task creation, task updates, standup
    submission, and blocker actions.
-   Use a single-column layout with compact summaries.
-   Put secondary metadata inside task detail rather than forcing it
    into list rows.
-   Use full-width primary actions where appropriate.
-   Keep touch targets approximately 44 × 44 CSS pixels where practical.
-   Use bottom sheets or full-screen forms for complex editing only when
    consistent with the application.
-   Do not rely on drag-and-drop for board status changes.
-   Avoid sticky controls that cover form fields, error messages, or the
    on-screen keyboard.

------------------------------------------------------------------------

## 8. Accessibility and inclusive interaction

Target WCAG 2.2 AA where applicable and verify against the product's
supported accessibility standard.

-   All workflows must be keyboard operable.
-   Focus order must follow visual and semantic order.
-   Focus indicators must be visible against all surfaces.
-   Inputs need persistent labels, instructions where needed, and
    programmatically associated error messages.
-   Status and priority must include text, not only color.
-   Charts require summaries or tabular alternatives.
-   Drag-and-drop must have a non-drag alternative.
-   Dialogs and drawers must manage focus and return it to the
    initiating control.
-   Screen-reader announcements should identify meaningful async state
    changes without excessive noise.
-   Respect reduced-motion preferences.
-   Ensure contrast for text, controls, badges, focus rings, and
    disabled states.
-   Avoid time-sensitive interactions that cannot be paused or extended
    unless essential.

------------------------------------------------------------------------

## 9. Content design and microcopy

Use concise, plain-language, action-oriented text. Avoid internal
engineering terminology.

Preferred labels: - "My Tasks" - "Team Tasks" - "New task" - "Mark
complete" - "Request help" - "Acknowledge blocker" - "Resolve blocker" -
"Submit standup" - "Awaiting submission" - "Sync pending" - "Try
again" - "Clear filters"

Avoid: - Ambiguous one-word buttons such as "Process" or "Execute" where
the outcome is unclear. - Blaming language such as "You failed to
submit". - Unsupported certainty in AI messages. - "Success" to describe
a request that has only been queued. - Technical error messages that
expose implementation details.

Error messages should state: 1. What happened. 2. What remains
unchanged, if important. 3. What the user can do next.

Example: "This task wasn't updated. Your changes are still in the form.
Check your connection and try again."

------------------------------------------------------------------------

## 10. UX governance and component rules for AI coding agents

1.  Inspect existing components, tokens, routes, permissions, and
    established interaction patterns before creating new ones.
2.  Reuse the current SmartSapp application shell and design system.
3.  Do not create duplicate task state, permission, validation, or
    mutation logic in UI components.
4.  Never bypass the canonical Task Core to make a screen appear
    functional.
5.  Keep business rules and authorization on the server; UI permission
    checks are for presentation, not security.
6.  Every visible state must be backed by an authoritative data source
    or explicitly labeled as a draft/estimate.
7.  Never fabricate analytics, AI results, integration success, reminder
    delivery, or task state.
8.  Preserve user input and navigation context where possible.
9.  Do not introduce modal chains for routine actions.
10. Prefer progressive disclosure to long forms and overloaded pages.
11. Avoid unnecessary animation, gradients, decorative icons, nested
    cards, and oversized KPI panels.
12. Ensure empty, loading, error, disabled, and permission-denied states
    are designed---not left to default rendering.
13. Keep the core task experience useful when AI is unavailable or
    disabled.
14. AI proposals must be distinguishable from confirmed data and must
    require user approval for consequential writes.
15. Every new interaction must work with keyboard and touch, not just
    mouse hover.
16. Do not add a new UI library without confirming the repository's
    existing component strategy and bundle implications.
17. Do not change unrelated routes or visual conventions as part of a
    task feature phase without documenting the reason.
18. Add component tests and visual regression coverage for shared
    components.
19. Validate desktop, tablet, and mobile layouts before marking a phase
    complete.
20. Document any deviation from this specification and explain the user
    benefit.

------------------------------------------------------------------------

## 11. UX measurement plan

Track outcomes that indicate usability and adoption, not just feature
usage.

### Task execution

-   Time to create a valid task.
-   Task creation completion rate.
-   Task editor abandonment and validation-error rate.
-   Time to find and open a task.
-   Completion action failure rate.
-   Filter and view usage.
-   Percentage of tasks with valid ownership and due-date data where
    required.

### Standups and blockers

-   Standup completion rate and median completion time.
-   Draft abandonment rate.
-   Blocker acknowledgement and resolution time.
-   Percentage of blockers with an owner.
-   Carryover rate with contextual interpretation.
-   User feedback on reporting burden.

### AI assistance

-   Draft acceptance, edit, and dismissal rates.
-   Clarification frequency.
-   AI action execution failure rate.
-   Percentage of AI-created tasks with confirmed source/relationship
    data where applicable.
-   User-reported usefulness and correction rate.

### Accessibility and reliability

-   Critical workflow success by device class.
-   Keyboard-only completion of core journeys.
-   Recoverable failure rate and successful retry rate.
-   UI error rate by route and action.
-   Performance at realistic task volumes.

Metrics should be interpreted in context. Do not use task counts,
standup word counts, or AI usage as standalone measures of employee
value.

------------------------------------------------------------------------

## 12. Cross-phase definition of done

A phase is not complete merely because the screen renders. It is
complete when:

-   The user can finish the intended workflow from beginning to end.
-   Loading, empty, error, success, permission, and pending states are
    implemented.
-   The UI uses the canonical domain services and authoritative state.
-   Workspace isolation and record-level permissions are enforced
    server-side.
-   Keyboard and touch interactions are supported.
-   Desktop, tablet, and mobile behavior is reviewed.
-   Visual consistency with SmartSapp is maintained.
-   Data is not fabricated or misleadingly presented.
-   Relevant unit, integration, end-to-end, accessibility, and visual
    regression tests pass.
-   User-facing copy is understandable to non-technical users.
-   The implementation is documented and any known limitation is
    explicit.

## 13. Recommended implementation order

1.  **Phase 0:** Validate current state and establish UI foundations.
2.  **Phase 1:** Secure canonical mutation paths and trustworthy
    feedback.
3.  **Phase 2:** Stabilize the core Tasks landing page and common
    interactions.
4.  **Phase 3:** Complete task detail and execution features.
5.  **Phase 4A:** Scale discovery and pagination.
6.  **Phase 4B:** Add standups, blockers, and carryovers.
7.  **Phase 4C:** Add operational analytics and drill-downs.
8.  **Phase 4D:** Add AI drafts, action extraction, and risk insights.
9.  **Phase 5:** Harmonize cross-module experiences.
10. **Phase 6:** Run production readiness, accessibility, performance,
    and adoption validation.

**Non-negotiable sequence:** secure mutation architecture → reliable
task lifecycle → consistent UI primitives → complete task execution →
scalable discovery → standups and blockers → analytics → AI assistance →
cross-module polish.
