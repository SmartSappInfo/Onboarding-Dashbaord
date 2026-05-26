# Automations Feature Documentation

## Overview

The Automations module is a visual workflow engine for event-driven CRM logic. It provides a node-based visual builder for creating workflows triggered by system events, with support for conditional branching, delays, messaging, task creation, deal updates, webhook dispatch, and entity updates.

This document is the implementation reference for the completed app behavior.

## Core Concepts

### Automation Blueprint

A visual workflow definition consisting of:

- **Nodes**: Individual steps in the workflow (trigger, action, condition, delay, tag condition/action)
- **Edges**: Connections between nodes defining execution flow
- **Configuration**: Node-specific settings and parameters
- **Workspace Binding**: Association with one or more workspaces via `workspaceIds`

### Execution Model

- **Event-Driven**: Automations fire in response to platform activities and direct trigger calls
- **Non-Blocking**: Trigger dispatch uses async background patterns where possible
- **Stateful**: Run history and delay jobs tracked in Firestore
- **Resumable**: Delayed workflows pause and resume through heartbeat processing

## Architecture

- **Blueprints:** `automations` collection (`nodes`, `edges`, `trigger`, `workspaceIds[]`)
- **Runs:** `automation_runs` collection (run ledger per execution)
- **Jobs:** `automation_jobs` collection (delay jobs + campaign queued jobs)
- **Event Bus:** `logActivity()` in `src/lib/activity-logger.ts`
- **Orchestrator:** `triggerAutomationProtocols()` in `src/lib/automations/orchestrator.ts`
- **Engine:** `executeAutomation()` in `src/lib/automations/executor.ts`, `traverseNodes()` in `src/lib/automations/nodes/traverse.ts`
- **Barrel:** `@/lib/automation-processor` re-exports the public engine API

## Entity Model (No School Fallback)

Automations are entity-first:

- `entityId` — global entity reference
- `workspaceId` — operational scope
- `entityType` — `institution` | `family` | `person`

State mutations route to:

- `entities` for identity/global fields
- `workspace_entities` for workspace-scoped fields (pipeline, stage, assignee, tags)

Legacy trigger/action names are migrated:

- `SCHOOL_CREATED` → `ENTITY_CREATED`
- `SCHOOL_STAGE_CHANGED` → `ENTITY_STAGE_CHANGED`
- `UPDATE_SCHOOL` → `UPDATE_ENTITY`

Migration script: `scripts/migrate-automation-triggers.ts`

## Automation Triggers

### Entity Lifecycle Triggers

| Trigger | Source activity |
|---------|------------------|
| `ENTITY_CREATED` | `entity_created` |
| `ENTITY_UPDATED` | `entity_updated` |
| `ENTITY_ASSIGNED` | `entity_assigned` |
| `ENTITY_STAGE_CHANGED` | `pipeline_stage_changed` |
| `ENTITY_LINKED` | `entity_linked_to_workspace` |
| `ENTITY_UNLINKED` | `entity_unlinked_from_workspace` |
| `WORKSPACE_ENTITY_UPDATED` | `workspace_entity_updated` |

### Task / Deal / Engagement Triggers

| Trigger | Source activity |
|---------|------------------|
| `TASK_CREATED` | `task_created` |
| `TASK_COMPLETED` | `task_completed` |
| `DEAL_CREATED` | `deal_created` |
| `DEAL_STAGE_CHANGED` | `deal_stage_changed` |
| `DEAL_STATUS_CHANGED` | `deal_status_changed` |
| `DEAL_VALUE_CHANGED` | `deal_value_changed` |
| `FORM_SUBMITTED` | `form_submitted` |
| `SURVEY_SUBMITTED` | `form_submission` |
| `PDF_SIGNED` | `pdf_form_submitted` |
| `CAMPAIGN_PAGE_SUBMITTED` | `page_conversion` |

### Meetings / Tags / Campaign / Integration Triggers

| Trigger | Source activity / source path |
|---------|-------------------------------|
| `MEETING_CREATED` | `meeting_created` |
| `MEETING_REGISTRANT_ADDED` | `meeting_registrant_added` |
| `MEETING_REGISTRANT_ATTENDED` | `meeting_registrant_attended` |
| `MEETING_REGISTRANT_NO_SHOW` | `meeting_registrant_no_show` |
| `TAG_ADDED` | `tag_added` |
| `TAG_REMOVED` | `tag_removed` |
| `CAMPAIGN_DELIVERED` | campaign queue / campaign hooks |
| `CAMPAIGN_FAILED` | campaign queue / campaign hooks |
| `CAMPAIGN_OPENED` | campaign webhooks/hooks |
| `CAMPAIGN_CLICKED` | campaign webhooks/hooks |
| `CAMPAIGN_NOT_DELIVERED` | campaign queue / campaign hooks |
| `WEBHOOK_RECEIVED` | inbound webhook routes |

## Node Types

### Trigger Node

- Entry point for the workflow
- Configurable trigger selection
- For `WEBHOOK_RECEIVED`, exposes ingress URL in inspector

### Action Node

Supported action types:

- `SEND_MESSAGE`
- `CREATE_TASK`
- `UPDATE_ENTITY`
- `ASSIGN_ENTITY`
- `ADD_NOTE`
- `CREATE_DEAL`
- `UPDATE_DEAL_STAGE`
- `UPDATE_DEAL_VALUE`
- `UPDATE_DEAL_STATUS`
- `UPDATE_TASK`
- `TRIGGER_OUTBOUND_WEBHOOK`
- `RUN_AUTOMATION`

### Condition Node

Field/operator/value branching with operators:

- `equals`
- `not_equals`
- `contains`
- `greater_than`
- `less_than`

### Tag Condition Node

Branching by tag logic:

- `has_tag`
- `has_all_tags`
- `has_any_tag`
- `not_has_tag`

### Tag Action Node

Tag operations:

- `add_tags`
- `remove_tags`

Applies to `workspace_entities.workspaceTags` (entity-first model).

### Delay Node

- Queues delay job in `automation_jobs`
- Pauses current execution path
- Resumes when heartbeat processes due job

## Execution Engine

### Trigger Detection and Filtering

`triggerAutomationProtocols()`:

1. Queries active automations by trigger
2. Filters by `workspaceIds` containment of payload workspace
3. Evaluates trigger-node config (tag IDs, stage filters, form/survey IDs, meeting type)
4. Executes matching automations

### Path Traversal

`traverseNodes()` performs recursive traversal:

1. Locate outgoing edges from current node
2. Handle branch selection for condition/tag condition nodes
3. Execute action nodes
4. Queue delay node and stop current linear path
5. Continue recursion for downstream nodes

### Run Ledger

`executeAutomation()`:

- Creates `automation_runs` entry with `running`
- Stores `triggerData`
- Marks run `completed` or `failed`
- For delay-resumed runs, finalizes completion when no pending jobs remain

### Delay and Heartbeat Processing

`processScheduledJobsAction()`:

- Finds due pending jobs
- Marks each `processing`
- Resumes delay jobs via `resumeAutomationRun()`
- Handles campaign queued jobs via `runAutomationById()`
- Finalizes job status (`completed` / `failed`)

## Variable Resolution

- Variable syntax: `{{key}}`
- Resolved against trigger payload and context
- Common entity keys: `{{entity_name}}`, `{{display_name}}`
- Messaging variable registry references: `src/lib/template-variable-registry-data.ts`

## Builder UI and Admin Interface

### Automation Hub (`/admin/automations`)

- Blueprint list with active/paused state
- Run ledger with status and timing
- Manual **Pulse Engine** trigger for heartbeat

### Blueprint Editor (`/admin/automations/[id]/edit`)

- React Flow canvas
- Grouped trigger catalog in inspector
- Action config forms by action type
- Webhook endpoint copier for webhook-triggered automations

### New Blueprint Initialization (`/admin/automations/new`)

- Seeds default trigger as `ENTITY_CREATED`
- Binds to active workspace

## API Endpoints

### Webhook Ingress

- `POST /api/automations/webhook/[id]`
- `POST /api/webhooks/inbound/[id]`

### Heartbeat Cron Endpoint

- `GET /api/cron/automation-heartbeat`
- Optional `Authorization: Bearer $CRON_SECRET`

## Integration Points

### Activity Logger

- Source of automation events via `triggerMap` in `src/lib/activity-logger.ts`

### Messaging Engine

- `SEND_MESSAGE` action uses `sendMessage()`
- Supports template ID and template category/type resolution patterns

### Tasks

- `CREATE_TASK` writes task with `source: 'automation'`
- `UPDATE_TASK` supports status/assignment/priority updates

### Deals

- Deal actions delegate to `src/lib/automations/actions/deal-automation-actions.ts`

### Tags

- Tag activity emits `tag_added` / `tag_removed`
- Tag nodes evaluate and mutate workspace entity tags

### Campaign Events (Model A — dual path)

1. **Campaign hooks** — Explicit binding on a campaign runs a specific automation by ID (`runAutomationById` or queued via `automation_jobs` with `targetNodeId: __campaign_trigger__`).
2. **Blueprint triggers** — After the hook automation runs, `dispatchCampaignBlueprintTriggers` invokes `triggerAutomationProtocols` for all active automations whose top-level `trigger` matches the event (`CAMPAIGN_DELIVERED`, `CAMPAIGN_OPENED`, etc.). The hook-bound automation ID is excluded to avoid duplicate execution when the same flow is both hooked and blueprint-triggered.

- Bulk cohort events: hooks enqueue jobs into `automation_jobs`; heartbeat runs hook + blueprint dispatch.
- Real-time events (open/click): immediate hook run + blueprint dispatch when `delayMinutes` is zero.

## Data Model

### Automation Document

```typescript
interface Automation {
  id: string;
  workspaceIds: string[];
  name: string;
  description?: string;
  trigger: AutomationTrigger;
  nodes: any[];
  edges: any[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}
```

### Automation Run Document

```typescript
interface AutomationRun {
  id: string;
  automationId: string;
  automationName: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  finishedAt?: string;
  triggerData: Record<string, any>;
  error?: string;
  entityId?: string | null;
  entityType?: EntityType;
}
```

### Automation Job Document

```typescript
interface AutomationJob {
  id: string;
  automationId: string;
  runId: string;
  targetNodeId: string;
  payload: Record<string, any>;
  executeAt: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}
```

## Permissions and Safety

- Workspace binding prevents cross-workspace execution leakage
- Trigger payload must include workspace context
- Automation chaining (`RUN_AUTOMATION`) uses max depth protection

## Best Practices

1. Keep workflows focused and readable
2. Use explicit trigger filters to reduce accidental fan-out
3. Ensure heartbeat cron is healthy before relying on delays
4. Validate templates and webhook IDs before activation
5. Monitor run failures and retriable job patterns

## Troubleshooting

### Automation not firing

- Check `isActive`
- Verify workspace match
- Confirm trigger mapping exists in `activity-logger.ts`

### Delay not resuming

- Verify heartbeat endpoint/cron execution
- Check `automation_jobs` status and `executeAt`

### Message action failures

- Ensure template exists and is active
- Confirm recipient resolution inputs in payload

### Tag action failures

- Ensure contact resolves to valid `workspaceEntityId`

## Testing

Primary automation tests:

- `src/lib/__tests__/automation-workspace-awareness.test.ts`
- `src/lib/__tests__/unified-tag-automation.test.ts`
- `src/lib/__tests__/automation-trigger-catalog.test.ts`
- `src/lib/__tests__/automation-blueprint.test.ts` — save trigger sync (P5-1)
- `src/lib/__tests__/automation-payload.test.ts` — payload contract (P5-5)
- `src/lib/__tests__/automation-trigger-config.test.ts` — trigger filters
- `src/lib/__tests__/automation-condition.test.ts` — condition nodes (P5-2)
- `src/lib/__tests__/meeting-registrant-automation.test.ts` — meeting → bus (P5-3)
- `src/lib/__tests__/automation-heartbeat-campaign.test.ts` — campaign jobs (P5-4)
- `src/lib/__tests__/automation-validation.test.ts` — save-time validation
- `src/lib/__tests__/campaign-automation-dispatch.test.ts` — Model A dispatch

## Implementation status

| Area | Status | Notes |
|------|--------|-------|
| Event bus (`activity-logger`) | Done | `buildAutomationPayload`, `after()` from Next.js |
| Trigger save sync | Done | `serializeBlueprint` on save |
| Campaign Model A | Done | Hooks + blueprint `CAMPAIGN_*` orchestrator |
| Builder inspectors | Done | Trigger, action, condition, delay, tag nodes |
| Save validation & permissions | Done | `automation-validation`, `automation-permissions` |
| Cron heartbeat | Done | Cloud Scheduler + `/api/cron/automation-heartbeat` (see [deploy checklist](./automations_deploy_checklist.md)) |
| Firestore indexes | Done | `trigger+isActive`, `status+executeAt` |
| Data migration | Ready | Run `scripts/migrate-automation-triggers.ts` (see [deploy checklist](./automations_deploy_checklist.md)) |
| Builder polish | Done | Test Flow, channel picker, run entity summary |
| Engine refactor | Done | Split under `src/lib/automations/` (orchestrator, executor, actions, nodes) |

Tracker: [automations_implementation.md](./automations_implementation.md)

### Backend architecture

| Layer | Location | Responsibility |
|-------|----------|----------------|
| Server actions | `automation-actions.ts` | Thin boundary for Next.js |
| Service | `automations/service.ts` | Auth, validation, orchestration |
| Repository | `automations/repository.ts` | Firestore reads/writes, job claims |
| Errors | `automations/errors.ts` | Typed errors + safe client messages |
| Engine | `automations/processor.ts` (+ `automation-processor.ts` barrel) | Runtime execution & heartbeat |
