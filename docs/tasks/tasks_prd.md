I reviewed `Pasted markdown (20261002-001319).md` and have treated it as the source of truth for the existing Tasks implementation, its cross-module contracts, the security findings, the proposed target architecture, and the four-phase migration plan. The PRD below preserves those requirements while expanding them into an implementation-ready product and engineering specification for the upgrade.

Pasted markdown(20261002-001319).md

The central architectural decision is to evolve the existing SmartSapp CRM Tasks module into a unified operational execution platform—not build a separate task application. Existing task records, URLs, CRM relationships, contract-obligation synchronization, activity logging, automation entry points, and CompanyBrain integration must continue to work.

# SmartSapp CRM — Tasks, Team Execution & AI Copilot

Product Requirements Document

Version 1.0

Internal — Product & Engineering

Document date: 2 October 2026

Primary route: `/admin/tasks` · Additional routes: `/admin/standups`, `/admin/task-analytics`

## 1. Executive summary

SmartSapp's current Tasks module already provides List, Kanban and Calendar views, date filtering, basic CRUD through server actions, activity logging, and contract-obligation synchronization in the canonical task core. However, several workflows remain incomplete, including reminder configuration, tags, cross-module navigation, and cursor pagination. The supplied audit also identifies critical security and data-integrity problems caused by an insufficiently protected bulk-creation path and client-side Firestore mutations that bypass the canonical core.

Pasted markdown(20261002-001319).md

This project will address those issues first, then extend the module with:

* A consistent task lifecycle and workflow customization.

* Reminders, tags, checklists, subtasks and recurring tasks.

* Daily standups, commitments, carryovers, blockers and help requests.

* Operational dashboards, execution analytics and authorized reporting.

* A Genkit-powered AI Task Copilot with human-confirmed actions.

* Consistent integrations with CRM entities, Deals, DocSigning, Automations, the Activity Feed, CompanyBrain and the MCP gateway.

* Secure, tenant-scoped APIs and background processing that continue operating when the user closes the application.

### Product outcome

A user should be able to move from a CRM record or meeting to a task, assign and track the work, report progress in a standup, resolve blockers, and understand execution performance—all through the same governed task domain.

## 2. Product vision and objectives

### 2.1 Vision

Make SmartSapp Tasks the shared execution layer across SmartSapp CRM: every task has a clear owner, status, deadline, context, history and authorized relationship to the business record that generated it.

### 2.2 Objectives

1. Security and integrity: Eliminate unauthorized mutations and bypasses of task lifecycle logic.

2. Operational completeness: Deliver reminders, tags, checklists, recurring tasks and richer task relationships.

3. Team execution: Provide daily standups and a managed blocker-resolution process.

4. Visibility: Give authorized users reliable backlog, deadline, throughput and standup analytics.

5. AI assistance: Reduce task-entry and reporting effort without allowing unreviewed AI writes.

6. Platform consistency: Reuse existing SmartSapp services, permissions, background infrastructure and integrations.

7. Scalability: Remove the fixed 200-task ceiling and support cursor-based retrieval.

### 2.3 Success principles

* Existing workflows must remain functional during migration.

* Every task mutation must pass through the canonical server-side domain layer.

* A standup report is not proof that a task was completed.

* AI-generated suggestions are not authoritative records until validated and confirmed.

* Task counts alone must not be treated as a measure of employee value.

* Downstream integration failures must be observable and recoverable.

## 3. Scope

### In scope

* Existing Tasks UI, canonical core, server actions and bulk operations.

* Tenant authorization, immutable-field enforcement, event and activity consistency.

* Reminder UI and scheduling, tags, checklists and cross-module link previews.

* Cursor pagination, filters and improved mobile and keyboard accessibility.

* Daily standups, blockers, commitments, carryovers and team summaries.

* Task analytics, authorized exports and AI-assisted workflows.

* CRM, Deals, DocSigning, Automations, CompanyBrain and MCP integration.

### Out of scope for the initial release

* Replacing the CRM Entity Service, Deal Intelligence Engine or DocSigning lifecycle.

* Building a separate task database or independent vector store.

* Replacing SmartSapp's existing background scheduler with a new scheduling platform.

* Automatically changing task owners, deadlines or priorities based solely on AI predictions.

* Building a full project-management suite with advanced portfolio planning. Projects and milestones require a separate scope decision.

## 4. Existing state and requirements baseline

The following is the baseline reported by the supplied audit. It is not a claim that I independently inspected the repository.

| Area                 | Reported current state                                                          | Required outcome                                     |
| -------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Views                | List, Kanban, Calendar                                                          | Preserve and standardize all views                   |
| CRUD                 | Protected task server actions exist                                             | All mutation entry points use canonical domain logic |
| Contract obligations | Completion hook exists in `task-core.ts`                                        | Ensure every completion path triggers it             |
| Activity             | Creation and completion logging exist                                           | Consistent lifecycle events and audit history        |
| Bulk creation        | Core exported from a `'use server'` file; wrapper lacks workspace authorization | Isolate core and secure the callable action          |
| Kanban/widgets       | Direct client Firestore mutations reported                                      | Replace with authorized server actions               |
| Types                | `any` and unchecked casts reported                                              | Strict, explicit types in the Tasks UI               |
| Reminders            | Schema fields exist; editor UI is missing                                       | Configuration UI and reliable delivery               |
| Tags                 | `<TagSelector>` integration missing                                             | Persist and display tags consistently                |
| Cross-module links   | Relationship fields exist; contextual previews are missing                      | Clickable, authorized deep links                     |
| Scale                | Static `limit(200)`                                                             | Cursor pagination without silent truncation          |
| Team execution       | Standups, blockers and velocity analytics absent                                | New standup and analytics capabilities               |

Pasted markdown(20261002-001319).md

## 5. Users and permissions

The platform must support these user groups without assuming every workspace uses the same role names.

| User type                      | Primary needs                                          | Access boundary                                    |
| ------------------------------ | ------------------------------------------------------ | -------------------------------------------------- |
| Individual contributor         | Personal tasks, reminders, standups, blockers          | Own tasks and explicitly authorized shared records |
| Team lead / supervisor         | Assign work, review progress, resolve blockers         | Assigned teams and permitted task actions          |
| Workspace administrator        | Configure workflows, templates and team access         | Authorized workspace configuration                 |
| CRM operator / advisor         | Work linked to entities, deals, contracts and meetings | Relevant CRM records and task permissions          |
| Executive / operations manager | Cross-team operational reporting                       | Explicit analytics and export permissions          |
| Automation / AI actor          | Create or update approved tasks and prepare summaries  | Scoped service capability and workspace context    |

### 5.1 Authorization requirements

* Authenticate and authorize every Server Action and Route Handler independently. Treat these as callable endpoints, not as trusted merely because the UI hides them. This follows Next.js security guidance.

  ![](https://www.google.com/s2/favicons?domain=https://nextjs.org\&sz=32)

  Next.js

  +1

* Use the established `requireWorkspace(workspaceId)` and `canUser(uid, 'operations', 'tasks', action, workspaceId)` patterns.

* For updates and deletions, load the stored record and verify its actual workspace before changing it.

* For bulk operations, authorize the requested workspace and validate every target record.

* AI and MCP calls must inherit the user's effective permissions or use a narrowly defined, auditable service capability.

* Do not return private standup notes to users who lack permission to view them.

* Keep client-side visibility checks as a usability feature, never as the security boundary.

## 6. Target architecture

The application should retain its current Next.js and Firebase deployment model initially. Introduce clearer module boundaries within the existing application rather than creating a new service without a measured need.

### Presentation layer

Tasks · Standups · Analytics · Shared TaskEditor / TaskCard / TagSelector

### Authorized entry points

Server Actions · REST API · MCP · Automation adapters

Authentication · Workspace authorization · Input validation

### Canonical Task Domain

`task-core.ts` · Bulk core · State transitions · Permissions · Standup services

Typed schemas · Idempotency · Lifecycle invariants

### Events and integration handlers

Activity Feed · DocSigning · Deals · Entities · Automation · CompanyBrain · Notifications

### Persistence and background execution

Firestore · Cloud Tasks / existing scheduler · Cloud Storage where needed · Analytics aggregates

### 6.1 Architectural invariants

1. `src/lib/tasks/task-core.ts` remains the canonical task mutation engine.

2. Move bulk implementation logic to `src/lib/tasks/task-bulk-core.ts`, outside the `'use server'` action module.

3. Keep Server Action files limited to intended callable actions and their input/output contracts.

4. Remove direct client-side Firestore writes for task mutations.

5. Server Actions, REST, MCP and automation must call the same domain services.

6. Validate authorization at the domain/data-access boundary, including record-level workspace ownership.

7. Use strict types and runtime validation for all externally supplied input.

8. Make integration handlers idempotent and observable.

9. Separate task persistence from asynchronous side effects.

10. Never report an external integration as successful merely because the task document was updated.

## 7. Functional requirements

### 7.1 Task workspace and views

Requirements

* Preserve List, Kanban and Calendar.

* Retain existing date filters: Today, Tomorrow, This Week, Next Week, Overdue and custom ranges.

* Add filters for status, priority, assignee, creator, category, tags, CRM entity, deal, source, blocker, and due-date range.

* Provide personal and team views, subject to permissions.

* Support search, sorting, pagination and refresh without silently truncating results.

* Provide a task detail surface showing description, ownership, status, due date, reminders, tags, checklist, relationships and activity history.

* Render contextual badges for contract obligations, Deals, survey responses and other supported related records.

* Use `getTaskInterlinkUrl` or the existing shared routing abstraction rather than scattering route construction throughout components.

* Preserve existing task IDs and route compatibility.

Acceptance criteria

* List, Kanban and Calendar display consistent task status and due-date values.

* Cursor pagination retrieves records beyond the first 200 without duplicates or skipped records under stable ordering.

* Changing a task's status in any view invokes the same authorized mutation path.

* Failed mutations produce actionable feedback and do not leave the UI falsely displaying a confirmed server update.

### 7.2 Task creation and editing

The editor must support the existing core fields and the additional requirements below.

| Field          | Requirement                                                   |
| -------------- | ------------------------------------------------------------- |
| Title          | Required, validated and length-limited                        |
| Description    | Optional text                                                 |
| Status         | Valid configured status                                       |
| Priority       | Low, medium, high, urgent                                     |
| Category       | Existing categories plus supported workspace configuration    |
| Assignee       | Valid user in the workspace                                   |
| Due date       | Valid date/time, interpreted in workspace or user timezone    |
| CRM entity     | Optional, workspace-validated reference                       |
| Deal           | Optional, workspace-validated reference                       |
| Related record | Supported relationship type and authorized destination        |
| Tags           | `tags: string[]`, selected using `<TagSelector>`              |
| Checklist      | Add, edit and complete checklist items                        |
| Reminders      | Time and channel configuration                                |
| Source         | Manual, automation, system or AI attribution where applicable |

The editor must prevent ordinary updates from changing immutable identity fields such as `id`, `workspaceId`, `organizationId` and `createdAt`. The server should strip or reject attempts to change these fields according to the existing core contract; the behavior must be explicit and tested.

### 7.3 Task lifecycle

The supplied document defines the core statuses as `todo`, `in_progress`, `review`, `done` and `cancelled`. The upgrade should preserve these values for compatibility. A `waiting` status may be introduced only if product and engineering approve its use and the migration plan covers existing consumers.

| Transition                      | Required behavior                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| Create → `todo`                 | Set server-owned creation/update timestamps; emit creation event                      |
| `todo` → `in_progress`          | Update status and history                                                             |
| `in_progress` → `review`        | Update status and history                                                             |
| Any permitted state → `done`    | Set `completedAt`, record activity and trigger obligation synchronization when linked |
| `done` → `todo` / `in_progress` | Clear `completedAt`; record reopening                                                 |
| Any state → `cancelled`         | Record cancellation without counting as completed work                                |
| Invalid transition              | Reject with a stable validation/state error                                           |

Exact transition permissions and any review requirements must be configurable or explicitly defined before implementation. A status transition must be atomic at the domain level, with side effects dispatched through a recoverable mechanism.

Critical invariant: marking a task complete from Kanban, a dashboard widget, an entity page, an API, MCP or an automation must produce the same lifecycle effects.

### 7.4 Checklists and subtasks

* Add and edit checklist items.

* Track completion, completion time and completing user.

* Support parent-task relationships for structured subtasks if approved in the delivery scope.

* Define whether parent completion requires all checklist items or subtasks to be completed; default behavior must be explicit.

* Prevent cyclic parent relationships.

* Avoid placing unbounded comments, history or reminder-delivery attempts inside the main task document.

### 7.5 Tags

* Integrate `<TagSelector>` in the task editor.

* Persist the selected tags as `tags: string[]` to maintain compatibility with the supplied schema.

* Ensure tags can be filtered and displayed on task cards.

* Do not reuse contact-tag semantics without validating that the tag model supports task usage.

* Ensure the CompanyBrain task-note adapter receives the expected task tags where supported.

### 7.6 Reminders and notifications

The existing schema reportedly supports `reminderTime`, `channels` and `sent`, but the editor does not expose reminder configuration. The upgrade must connect the UI to reliable delivery.

Pasted markdown(20261002-001319).md

Editor requirements

* Add one or more reminders to a task.

* Support preset offsets such as 15 minutes, 1 hour, 1 day and 1 week, plus a custom time.

* Support the existing channel types: `notification`, `email` and `sms`, subject to provisioned services, workspace configuration, consent and user preferences.

* Display reminder status and allow authorized users to edit or remove scheduled reminders.

Processing requirements

* Use Cloud Tasks or SmartSapp's existing scheduling infrastructure after confirming the established implementation.

* Schedule and cancel reminders when the task deadline or reminder configuration changes.

* Use idempotency keys so retries do not send duplicate notifications.

* Record delivery attempts, outcomes and failures in a durable job/delivery record.

* Define behavior for completed, cancelled and archived tasks.

* Apply the configured timezone when calculating offsets and delivery time.

The task's reminder definition is not proof of delivery; delivery status must come from the notification workflow.

### 7.7 Cross-module relationships

Tasks must retain their existing relationship fields and foreign-key semantics.

CRM Entity Service

* Store `entityId` as the authoritative relationship.

* Resolve entity display data through the existing service.

* Do not duplicate authoritative entity profile data in the task.

* When an entity is deleted, apply an approved archive or orphan-handling policy without blocking entity management.

DocSigning

* Preserve `relatedEntityType`, `relatedParentId` and `relatedEntityId` for contract-obligation tasks.

* On completion, invoke `syncTaskCompletionToObligation` with the stored relationship identifiers.

* Prevent standard users from forging or modifying protected linkage fields.

* Make retries idempotent and surface synchronization failures for reconciliation.

Deals

* Preserve `dealId`.

* Emit a completion event for the Deal Intelligence Engine to evaluate.

* Do not embed deal-stage progression rules inside the Tasks module.

Automation

* Route task creation through `createTaskFromAutomation(data, orgId)` or its approved canonical equivalent.

* Use `{ kind: 'system', source: 'automation' }` and preserve workspace context.

* Prevent recursive triggers by carrying automation/source metadata and checking the current trigger identity.

Activity Feed and CompanyBrain

* Maintain task activity through the existing logging infrastructure.

* Continue using `task-note-adapter.ts` for task-note indexing; do not introduce a separate task vector database.

## 8. Daily standup platform

### 8.1 Objective

Introduce a dedicated standup workflow that lets team members report progress, commitments, blockers and requests for help without treating a narrative report as the authoritative task record.

Route: `/admin/standups`

Storage: `standup_entries` as proposed by the source document.

### 8.2 Standup submission

A standup must support:

1. Work completed since the previous report.

2. Planned work for the current reporting period.

3. Blockers and reasons work cannot progress.

4. Requests for help or a decision.

5. Links to existing tasks and authorized CRM records.

6. An optional private note visible only to explicitly authorized managers.

Users must be able to save a draft and submit it. Editing after submission must follow a configurable amendment policy and preserve history.

### 8.3 Standup-to-task behavior

* Users can link an existing task to a standup item.

* Users can create a task from a planned-work item or help request.

* Created tasks must record their standup source reference.

* Linking or mentioning a task in a standup must not silently change its status.

* A reported completion must not automatically mark a task `done`.

* Carryovers must link to the original commitment and, where applicable, its associated task.

### 8.4 Blocker lifecycle

A blocker is a managed operational record, not just a boolean flag on a task.

Minimum fields: workspace, reporting user, description/reason, severity, affected task IDs, owner, status, raised time, resolution time and source standup.

Required lifecycle:

`open → acknowledged → assigned / in_progress → resolved`

A blocker may be closed only through an authorized action. Reopening must retain history.

The existing task fields `isBlocker` and `blockerReason` may be retained as compatibility or display fields, but the dedicated blocker record should be the authoritative source for blocker lifecycle and resolution analytics.

### 8.5 Team overview

The team view should display:

* Submission status for the selected reporting period.

* Completed work and planned commitments.

* Carryovers.

* Open blockers and help requests.

* Blocker owner, age and current status.

* Team summary with links to the source standups.

* Relevant task and CRM links.

Missing submission and a submitted standup with no blockers are different states and must be displayed separately.

### 8.6 Standup configuration

Workspace administrators should be able to configure, subject to permissions:

* Reporting cadence and timezone.

* Submission window.

* Team membership and reporting scope.

* Prompt fields and required fields.

* Reminder schedule.

* Standup visibility and private-note permissions.

* Amendment window and retention policy.

Mandatory daily submission, management visibility and retention defaults are product decisions to confirm before development; they should not be silently imposed by engineering.

## 9. Task analytics and reporting

Route: `/admin/task-analytics`

The analytics module must distinguish work performed, current workload, overdue work and self-reported progress. Metrics must be defined before charts are implemented.

### 9.1 Core metrics

| Metric                     | Proposed definition                                                                                       |
| -------------------------- | --------------------------------------------------------------------------------------------------------- |
| Tasks created              | Tasks created in the selected period                                                                      |
| Tasks completed            | Tasks transitioned to `done` in the selected period                                                       |
| Open backlog               | Tasks not in a terminal state at the reporting cutoff                                                     |
| Overdue tasks              | Open tasks whose due date is before the reporting cutoff                                                  |
| On-time completion rate    | Completed tasks finished on or before their due date, divided by eligible completed tasks with a due date |
| Cycle time                 | Time between starting work and completion                                                                 |
| Lead time                  | Time between creation and completion                                                                      |
| Throughput                 | Number of completed tasks per reporting interval                                                          |
| Blocker age                | Elapsed time from blocker creation until the reporting cutoff or resolution                               |
| Blocker resolution time    | Elapsed time from blocker creation to resolution                                                          |
| Standup submission rate    | Submitted standups divided by expected submissions under the configured schedule                          |
| Commitment completion rate | Eligible standup commitments completed by the agreed deadline, under a documented attribution rule        |
| Carryover rate             | Eligible commitments carried into a later reporting period divided by eligible commitments                |

Metric definitions must specify treatment of reopened tasks, cancelled tasks, missing deadlines, deleted records, timezone boundaries and amended standups. Historical metrics should not be silently reinterpreted after a definition changes.

### 9.2 Dashboards

Provide the following dashboard sections:

* Overview: created, completed, open, overdue and on-time work.

* Backlog: status distribution, aging and trend.

* Execution: throughput, cycle time and lead time.

* Blockers: open blocker count, age and resolution time.

* Standups: submission rate, commitments and carryovers.

* Workload: open tasks and due dates by authorized assignee/team.

Filters should include date range, team, assignee, status, priority, category and relevant CRM relationships.

### 9.3 Reporting controls

* Enforce workspace and analytics permissions on the server.

* Require explicit export permission.

* Audit exports and include the selected filters and reporting period.

* Use cursor-based queries or aggregates appropriate to the data volume.

* Show data freshness when metrics depend on asynchronous aggregation.

* Support reconciliation against source task records.

* Do not use a single task-count metric to rank employees or infer individual performance without context.

The initial implementation can compute simple views from source records where feasible. Introduce materialized aggregates only where measured query cost, latency or volume justifies them.

## 10. AI Task Copilot

### 10.1 Objective

Use the existing Genkit infrastructure to reduce task-entry, decomposition and standup-summary effort while keeping humans in control of consequential changes.

### 10.2 Natural-language task creation

Example input:

> Follow up with Sarah on Friday at 10am.

The copilot should prepare a structured draft containing:

* Title and description.

* Category and priority, if supplied or safely inferable.

* Assignee, if resolvable.

* Due date/time and timezone.

* Related entity or deal, if resolvable.

* Reminder suggestions, where appropriate.

* Source attribution and validation warnings.

Required interaction: parse → validate → show preview → user edits/confirms → canonical task creation.

No task may be written to Firestore during draft generation. Ambiguous dates, people or entities must trigger clarification rather than a fabricated resolution.

### 10.3 Other AI capabilities

* Task decomposition: suggest a checklist or subtasks for a selected task.

* Meeting action-item extraction: propose tasks from meetings or authorized notes, with links to the source and user confirmation.

* Standup summaries: generate asynchronous summaries from permitted submissions, retaining source links.

* Blocker insights: summarize recurring blockers and suggest follow-up actions.

* Deadline-risk signals: identify potentially at-risk work using due dates, status, age and dependencies where available.

* CRM-aware suggestions: suggest follow-up actions using authorized entity, deal and CompanyBrain context.

AI should identify the evidence supporting a recommendation and distinguish observed facts from inferred suggestions. It must not independently change task ownership, priority, deadline or completion status.

### 10.4 AI governance

Every AI proposal or execution should capture appropriate metadata:

* Workspace and requesting user.

* Action type and source reference.

* Prompt/configuration version and model/provider.

* Proposed fields and validation outcome.

* User decision: accepted, edited, rejected or cancelled.

* Execution result and correlation/job ID.

* Latency, error and usage/cost metadata where available.

Do not store secrets or unnecessary sensitive source text in logs. Retrieval and summarization must enforce source-record permissions. Treat meeting content, notes and documents as untrusted input, including instructions embedded inside them.

### 10.5 MCP integration

Extend the existing task tools, preserving current `task.list` and `task.create` contracts where feasible.

Proposed tools:

* `task.list`

* `task.get`

* `task.create`

* `task.update`

* `task.complete`

* `task.create_from_template`

* `standup.submit_draft`

* `standup.summarize`

* `task.suggest_actions`

Separate read and write authorization, validate every tool input, and audit writes. Consequential operations must use the same domain service and approval rules as UI operations.

## 11. Data model and persistence

The source document proposes extending the existing `Task` model without breaking legacy fields. The implementation must first reconcile the schema below with the actual `src/lib/types.ts` and Firestore documents.

### 11.1 Canonical task contract

TypeScript

```
export type TaskStatus =
  | 'todo'
  | 'in_progress'
  | 'review'
  | 'done'
  | 'cancelled';

export type TaskPriority =
  | 'low'
  | 'medium'
  | 'high'
  | 'urgent';

export interface TaskReminder {
  id: string;
  reminderTime: string; // ISO 8601
  channels: ('notification' | 'email' | 'sms')[];
  sent: boolean;
}

export interface TaskChecklistItem {
  id: string;
  title: string;
  completed: boolean;
  completedAt?: string | null;
  completedBy?: string | null;
}

export interface CanonicalTask {
  id: string;
  workspaceId: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;

  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  category: string;
  dueDate: string;
  completedAt?: string | null;

  assignedTo?: string | null;
  assignedToEmail?: string | null;
  assignedToName?: string | null;
  createdBy?: string;

  entityId?: string | null;
  entityName?: string | null;
  entityType?: 'institution' | 'family' | 'person' | null;
  dealId?: string | null;

  relatedEntityType?:
    | 'SurveyResponse'
    | 'Submission'
    | 'Meeting'
    | 'School'
    | 'Deal'
    | null;
  relatedParentId?: string | null;
  relatedEntityId?: string | null;

  tags: string[];
  checklist: TaskChecklistItem[];
  reminders: TaskReminder[];
  reminderSent: boolean;

  isBlocker?: boolean;
  blockerReason?: string | null;
}
```

This is a compatibility-oriented contract derived from the supplied specification, not authorization to overwrite the existing type definitions blindly. Any additional fields needed for source attribution, schema versioning, recurrence, parent tasks or analytics must be introduced through an explicit schema migration.

### 11.2 Supporting records

Use separate, workspace-scoped records where independent lifecycle, querying or history is needed.

| Record                      | Purpose                                           |
| --------------------------- | ------------------------------------------------- |
| `tasks`                     | Existing authoritative task documents             |
| `standup_entries`           | Standup drafts, submissions and amendments        |
| Blocker records             | Blocker lifecycle, ownership and resolution       |
| Task comments/activity      | Comments and detailed history                     |
| Reminder jobs               | Scheduled delivery, retries and outcomes          |
| Recurrence records          | Series configuration and generation state         |
| Task templates              | Reusable task definitions                         |
| Task workflow configuration | Workspace-specific settings                       |
| Task analytics aggregates   | Derived reporting data when required              |
| AI action records           | Proposals, confirmations and execution provenance |
| Domain event/outbox records | Durable downstream dispatch and recovery          |

### 11.3 Firestore requirements

* Every tenant-owned record must carry or be unambiguously scoped to a `workspaceId`.

* Define composite indexes for the approved query patterns, including workspace + status + due date and workspace + assignee + due date.

* Use cursor pagination with a stable ordering and a unique tie-breaker.

* Validate inputs at runtime using the project's established schema-validation library.

* Keep Admin SDK access behind the authorized domain/data-access layer.

* Add schema versioning and migration compatibility.

* Define retention, deletion and archival rules for standups, activity, attachments, AI provenance and background jobs.

## 12. API and domain service contract

All entry points must call the same domain layer. These are proposed command/query contracts, not a requirement to expose every operation as a public REST endpoint.

### 12.1 Task commands and queries

* `createTask`

* `getTask`

* `listTasks`

* `updateTask`

* `transitionTask`

* `assignTask`

* `bulkUpdateTasks`

* `bulkDeleteTasks`

* `addTaskComment`

* `updateChecklistItem`

* `createTaskFromTemplate`

* `createRecurringTaskSeries`

### 12.2 Standup commands and queries

* `getStandupConfig`

* `saveStandupDraft`

* `submitStandup`

* `amendStandup`

* `listStandups`

* `createBlocker`

* `updateBlocker`

* `resolveBlocker`

* `generateStandupSummary`

### 12.3 Analytics queries

* `getTaskOverview`

* `getTaskThroughput`

* `getTaskCycleTime`

* `getOverdueAndSlaMetrics`

* `getWorkloadDistribution`

* `getStandupCompliance`

* `getCommitmentAndCarryoverMetrics`

* `exportTaskReport`

### 12.4 Error contract

Use consistent, machine-readable error codes:

`UNAUTHENTICATED`, `WORKSPACE_ACCESS_DENIED`, `PERMISSION_DENIED`, `VALIDATION_FAILED`, `NOT_FOUND`, `CONFLICT`, `INVALID_STATE_TRANSITION`, `RATE_LIMITED`, `INTEGRATION_PENDING`, `INTEGRATION_FAILED`, `INTERNAL_ERROR`.

A dependency-cycle error should be added if task dependencies are included in the approved scope.

## 13. Migration strategy

Migration must be incremental and designed to avoid downtime, data corruption and broken integrations. The source specifies four principal implementation phases; the expanded delivery plan below adds an explicit discovery gate and production rollout controls.

## 0

### Discovery and baseline

Inventory task callers, Firestore rules, task schemas, permissions, indexes, integration hooks and current production data. Confirm every audit finding against the repository before changing code.

Gate: signed-off baseline, test plan and rollback plan.

## 1

### Security and unified mutation engine

Isolate the bulk core, enforce workspace and task-level permissions, route Kanban/widgets/entity-page mutations through the canonical core, and migrate automation updates.

Release blocker

Gate: security and contract tests pass; no known mutation bypass remains.

## 2

### Typing and UI invariants

Remove `any` from the specified task components, integrate `<TagSelector>`, standardize errors and ensure mobile touch targets.

Gate: `pnpm typecheck` passes and existing task workflows remain functional.

## 3

### Task form parity and relationships

Deliver reminder configuration, cross-module badges, checklists and reliable reminder scheduling.

Gate: delivery, navigation and contract synchronization tests pass.

## 4

### Scale, standups and AI Copilot

Add cursor pagination, standups, blockers, team summaries and confirmed AI task creation.

Gate: performance, privacy, retry and AI-confirmation tests pass.

## 5

### Analytics and controlled rollout

Release metric definitions, dashboards, authorized exports and the selected rollout cohort. Monitor errors and reconcile data before retiring legacy paths.

Gate: product, engineering and security sign-off.

### 13.1 Migration controls

* Introduce changes behind feature flags where appropriate.

* Keep legacy fields readable until all callers are migrated.

* Do not rename or delete existing task IDs.

* Use dry runs, bounded batches and resumable jobs for data migrations.

* Record migration version, run ID, workspace, counts, failures and reconciliation results.

* Compare old and new behavior in shadow mode where practical.

* Canary new workflows before enabling them broadly.

* Define rollback and forward-recovery procedures before release.

* Do not remove the legacy mutation path until all consumers have migrated and rollback dependencies are understood.

## 14. Acceptance criteria and test verification matrix

The following criteria extend the source document's original SEC, MUT, AUT, TYP, TAG, MOB, REM, LNK, SCL, STN and AI tests. The original criteria should remain traceable in the implementation tickets.

Pasted markdown(20261002-001319).md

### 14.1 Phase 1 — Security and mutation engine

* SEC-01: `bulkCreateTasksActionCore` is not exported from any file marked `'use server'`.

* SEC-02: A bulk-create request targeting a workspace outside the caller's membership fails with a workspace-access error.

* SEC-03: Every task ID in bulk updates/deletions is validated against the authorized workspace.

* SEC-04: Unauthorized reads, updates, deletions and exports fail closed.

* MUT-01: Kanban drag-and-drop calls the canonical server action; completion updates `updatedAt` and records the completion activity.

* MUT-02: Completing a linked contract-obligation task triggers `syncTaskCompletionToObligation`.

* MUT-03: Dashboard widgets and entity pages use the same authorized mutation path.

* AUT-01: Attempts to change immutable fields cannot alter the stored identity fields.

* AUT-02: Automation-created and automation-updated tasks pass through the canonical core and have recursion protection.

* EVT-01: Retries do not create duplicate logical completion events or duplicate contract fulfillment effects.

### 14.2 Phase 2 — Typing and UI invariants

* TYP-01: `pnpm typecheck` passes with zero errors.

* TYP-02: There is no `any` in the agreed Tasks feature scope unless a documented exception is approved.

* TAG-01: Tags selected in `TaskEditor.tsx` persist as `tags: string[]` and use `<TagSelector>`.

* MOB-01: Task cards and editor controls satisfy the source requirement of `min-h-[44px]` touch targets.

* UI-01: Permission errors provide actionable, permission-aware feedback.

* UI-02: Keyboard users have a non-drag way to change task status.

### 14.3 Phase 3 — Reminders and relationships

* REM-01: Reminder configuration persists valid reminder times and channels.

* REM-02: Rescheduling or cancelling a reminder prevents stale delivery.

* REM-03: Retries do not duplicate successful deliveries.

* LNK-01: Tasks linked to supported records render clickable navigation badges.

* LNK-02: Link destinations are generated by the shared routing helper and respect authorization.

* CHK-01: Checklist item changes persist and record the correct completion metadata.

* DSG-01: A failed DocSigning synchronization is visible and can be retried without duplicate fulfillment.

### 14.4 Phase 4 — Scale, standups and AI

* SCL-01: Workspaces with more than 500 tasks load the first page within the approved p95 target under the defined test environment.

* SCL-02: Cursor pagination retrieves later pages without silent truncation, duplicate records or skipped records under stable ordering.

* STN-01: Submitting a standup can link tasks and generate an asynchronous summary without changing task completion states.

* STN-02: A standup commitment and its carryover retain the appropriate source linkage.

* STN-03: Missing submission and submitted-with-no-blockers states are distinguishable.

* STN-04: Private manager notes are inaccessible to unauthorized users.

* BLK-01: Blockers can be acknowledged, assigned, resolved and audited under the permission model.

* AI-01: “Follow up with Sarah on Friday at 10am” produces a validated draft with title, category and resolved due date/time where the reference date and timezone are available.

* AI-02: AI draft generation does not write to Firestore before user confirmation.

* AI-03: Confirmed AI writes pass through the canonical core and inherit the caller's permissions.

* AI-04: AI summaries link to their source records and do not expose unauthorized content.

### 14.5 Analytics and integration criteria

* AN-01: Each metric has a documented definition and tested edge-case behavior.

* AN-02: Cancelled tasks are not counted as completed tasks.

* AN-03: Analytics queries and exports enforce workspace and permission scope.

* AN-04: Dashboard freshness is visible when metrics are asynchronously aggregated.

* INT-01: Entity, Deals, DocSigning, Automation, Activity Feed and CompanyBrain integration tests pass.

* OPS-01: Failed background jobs can be retried or reconciled without duplicating side effects.

* OPS-02: The migration can be resumed after failure, and rollback/forward recovery is documented and tested.


## 15. Non-functional requirements

The numerical performance targets below are proposed engineering targets, not measurements of current production performance. They must be validated against representative data and the production environment.

| Area               | Requirement                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------------- |
| Security           | No cross-workspace access; server-side authorization on every mutation and protected query   |
| Performance        | Initial target: task-list first page p95 under 800 ms                                        |
| Task detail        | Initial target: p95 under 500 ms, excluding external calls and large attachment retrieval    |
| Mutation latency   | Initial target: p95 under 800 ms, excluding asynchronous downstream effects                  |
| Standup submission | Initial target: p95 under 800 ms for persistence and acknowledgement                         |
| Scalability        | Load-test workspaces with 500, 5,000 and 50,000 tasks                                        |
| Reliability        | Idempotent reminder, recurrence and integration processing                                   |
| Accessibility      | Keyboard navigation, visible focus, labels, sufficient contrast and mobile-friendly controls |
| Observability      | Structured logs, failure metrics, correlation IDs, retry visibility and operational alerts   |
| Compatibility      | Preserve task IDs, existing relationships and legacy reads during migration                  |
| Maintainability    | Strict types, validated schemas, isolated domain logic and documented service contracts      |

For performance tests, define the hardware/runtime, test data, concurrency, query patterns and measurement window. A target is not accepted merely because it passes in a small local development dataset.

## 16. Observability and operations

The implementation must make it possible for engineering and operations to understand what failed, where it failed and how to recover.

Monitor:

* Task creation, update and completion failures.

* Authorization denials and suspicious cross-workspace attempts.

* Bulk-operation latency and partial failures.

* DocSigning obligation synchronization failures.

* Reminder delivery success, retries and oldest pending job.

* Background job retries, queue age and dead-letter counts.

* Standup submission and summary-generation failures.

* Analytics aggregation lag and reconciliation differences.

* AI latency, validation failures, user acceptance/edit/rejection and usage cost.

Each operation should have a correlation ID where applicable. Logs must not contain secrets or unnecessary private standup content.

Required operational procedures include failed task mutations, stuck reminders, failed contract synchronization, background job replay, analytics rebuild and migration recovery.

## 17. Test strategy

Use the existing project's testing tools and conventions; select specific frameworks during Phase 0 rather than introducing overlapping test infrastructure.

### Unit tests

Schemas, state transitions, immutable fields, permissions, timezone calculations, metrics, dependency validation, idempotency and AI proposal validation.

### Integration tests

Firestore Emulator, workspace isolation, server actions, DocSigning synchronization, automation, reminder delivery, standup/blocker lifecycle, MCP and REST authorization.

### End-to-end tests

Create and complete tasks from each view, filter and paginate, configure reminders, navigate CRM links, submit standups, resolve blockers and confirm AI-generated drafts.

### Security and resilience tests

Anonymous requests, forged workspace IDs, unauthorized task IDs, direct endpoint invocation, replayed jobs, prompt injection, cross-tenant retrieval, provider outages and migration rollback.

## 18. Dependencies and implementation constraints

Before implementation, confirm the following from the actual repository:

* The exact current `Task` interface and Zod/schema definitions.

* Firestore rules for `/tasks/{taskId}` and any related collections.

* All call sites of `updateTaskNonBlocking`, `completeTaskNonBlocking` and the bulk creation functions.

* Existing authorization semantics for `create`, `edit`, `delete` and analytics/export actions.

* The real implementation and failure behavior of `syncTaskCompletionToObligation`.

* Existing Cloud Tasks, reminder and scheduler infrastructure.

* The current MCP task-tool schemas and authentication mechanism.

* The existing CompanyBrain task-note adapter contract.

* Firestore indexes, expected workspace data volume and existing activity-event conventions.

Important implementation distinction: the supplied audit reports that `bulkCreateTasksActionCore` is exposed from a `'use server'` file. The remediation should be based on verifying that exact code path, then moving reusable implementation logic into a non-action module and securing the callable wrapper. This avoids treating the source audit as a substitute for a fresh security test.

## 19. Product decisions required before development

These decisions affect schemas, permissions and acceptance criteria. Resolve them during Phase 0 or before the relevant phase begins.

1. Standup policy

Should daily standups be mandatory, optional or configurable by workspace?

Configurable by workspace

Mandatory

Optional

2. Standup visibility

Who should see individual submissions and private notes?

Team visibility; private notes restricted

Managers only

Workspace-wide visibility

3. Task assignment

Should tasks support one assignee or multiple assignees?

Single assignee

Multiple assignees

4. Project management scope

Should projects, milestones and task dependencies be included in this release?

Defer to a later release

Include projects and milestones

Include projects, milestones and dependencies

5. Reminder channels

Which channels should be enabled initially, subject to existing provider support?

In-app notifications only

In-app and email

In-app, email and SMS

6. Analytics access

Who should be allowed to view team analytics and export reports?

Permission-controlled by role

Workspace administrators only

All workspace members

7. Advanced feature access

Should standups, analytics and AI capabilities use the existing entitlement system?

Yes, enforce existing entitlements

No additional entitlement checks

Submit decisions

Other decisions to confirm include standup retention, amendment windows, custom task-field types, workspace workflow configuration and final production performance targets.

## 20. Definition of done

The upgrade is complete when all of the following are true:

* Security defects identified in the source audit are remediated and regression-tested.

* All task mutation paths use the canonical domain layer.

* Existing task records, IDs, routes and integrations remain compatible.

* Strict typing and the agreed runtime validation requirements pass.

* Reminders, tags, cross-module links and checklists meet their acceptance criteria.

* Cursor pagination and performance tests pass at the agreed targets.

* Standup submission, blocker management, privacy and carryover behavior pass their tests.

* Analytics definitions, calculations, access control and exports are verified.

* AI actions require confirmation and have source attribution and auditability.

* Background processing is idempotent, observable and recoverable.

* Migration and rollback/forward-recovery procedures have been tested.

* Product, engineering and security owners approve release readiness.

## 21. Recommended implementation order

The recommended order follows the dependency structure of the source document: secure and unify the task engine before introducing new workflows that depend on it.

P0

Secure the mutation engine

Bulk-core isolation, workspace authorization, canonical mutations, DocSigning and automation regression tests.

P1

Stabilize the existing Tasks experience

Strict types, tag integration, errors, mobile accessibility and cross-module navigation.

P2

Complete task execution workflows

Reminders, delivery jobs and checklists; introduce subtasks or recurrence only after scope confirmation.

P3

Introduce standups and blockers

Submission, team overview, blocker lifecycle, commitments and carryovers.

P4

Deliver analytics and AI

Metric definitions, dashboards, exports, AI task drafts and asynchronous summaries.

Final architecture invariant: Every human, automation, API and AI task mutation must pass through the same authorization-enforcing domain services, and every downstream effect must be observable, idempotent and recoverable.

The immediate engineering starting point is Phase 0 followed by Phase 1. Do not begin with the AI Copilot or standup UI while the canonical mutation path and workspace authorization remain unverified.
