# Automations Feature Documentation

## Overview

The Automations module is a sophisticated visual workflow engine that enables automated institutional logic and proactive task orchestration. It provides a node-based visual builder for creating complex workflows triggered by system events, with support for conditional branching, delays, messaging, task creation, and contact updates.

## Core Concepts

### Automation Blueprint
A visual workflow definition consisting of:
- **Nodes**: Individual steps in the workflow (triggers, actions, conditions, delays)
- **Edges**: Connections between nodes defining execution flow
- **Configuration**: Node-specific settings and parameters
- **Workspace Binding**: Association with one or more workspaces

### Execution Model
- **Event-Driven**: Automations fire in response to system events
- **Non-Blocking**: Execution happens asynchronously
- **Stateful**: Run history and job queue tracked in Firestore
- **Resumable**: Delayed workflows can pause and resume

## Automation Triggers

### Available Triggers

**1. SCHOOL_CREATED**
- Fires when a new institution is added to the system
- Payload: schoolId/entityId, schoolName, workspaceId, organizationId

**2. SCHOOL_STAGE_CHANGED**
- Fires when an institution moves to a different pipeline stage
- Payload: schoolId/entityId, oldStageId, newStageId, pipelineId

**3. TASK_COMPLETED**
- Fires when a CRM task is marked as done
- Payload: taskId, schoolId/entityId, completedBy, completedAt

**4. SURVEY_SUBMITTED**
- Fires when a survey form is submitted
- Payload: surveyId, responseId, schoolId/entityId, score

**5. PDF_SIGNED**
- Fires when a contract/PDF form is fully signed
- Payload: pdfId, submissionId, schoolId/entityId, signedAt

**6. MEETING_CREATED**
- Fires when a new meeting is scheduled
- Payload: meetingId, schoolId/entityId, meetingTime, meetingType

**7. TAG_ADDED**
- Fires when a tag is applied to a contact
- Payload: contactId, tagId, tagName, workspaceId, appliedBy
- Supports filtering by tag IDs, contact type, and application method

**8. TAG_REMOVED**
- Fires when a tag is removed from a contact
- Payload: contactId, tagId, tagName, workspaceId, appliedBy
- Supports same filtering as TAG_ADDED

**9. WEBHOOK_RECEIVED**
- Fires when external data is POSTed to webhook endpoint
- Payload: Custom JSON from external system
- Endpoint: `/api/automations/webhook/{automationId}`

## Node Types

### 1. Trigger Node
**Purpose**: Entry point for automation workflow

**Configuration**:
- Trigger type selection
- Webhook URL display (for WEBHOOK_RECEIVED)

**Visual**: Emerald color scheme, entry indicator

### 2. Action Node
**Purpose**: Execute functional logic

**Action Types**:

**SEND_MESSAGE**
- Send email or SMS via messaging engine
- Configuration:
  - Template selection
  - Sender profile
  - Recipient type (manager, signatory, respondent, fixed)
  - Dynamic recipient with variable support

**CREATE_TASK**
- Generate CRM task automatically
- Configuration:
  - Task title (supports variables)
  - Description
  - Priority (low, medium, high, urgent)
  - Category (call, visit, document, training, general)
  - Due date offset (days from trigger)
  - Assigned user (auto-resolve or specific)

**UPDATE_SCHOOL**
- Modify contact record fields
- Configuration:
  - Lifecycle status update
  - Pipeline stage advancement
  - Custom field updates

**Visual**: Blue color scheme, action indicator

### 3. Condition Node
**Purpose**: Logical branching based on data evaluation

**Configuration**:
- Field selection (from variable registry)
- Operator selection:
  - equals
  - not_equals
  - contains
  - greater_than
  - less_than
- Comparison value

**Outputs**: True path (emerald), False path (rose)

**Visual**: Amber color scheme, dual outputs

### 4. Tag Condition Node
**Purpose**: Branch based on contact tag presence

**Configuration**:
- Logic type:
  - has_tag: Contact has at least one selected tag
  - has_all_tags: Contact has every selected tag
  - has_any_tag: Same as has_tag
  - not_has_tag: Contact has none of the selected tags
- Tag selection (multi-select)

**Outputs**: True path (emerald), False path (rose)

**Visual**: Violet color scheme, tag indicator

### 5. Tag Action Node
**Purpose**: Apply or remove tags from contacts

**Configuration**:
- Action type:
  - add_tags: Apply selected tags
  - remove_tags: Remove selected tags
- Tag selection (multi-select)

**Visual**: Emerald (add) or Rose (remove) color scheme

### 6. Delay Node
**Purpose**: Introduce temporal wait period

**Configuration**:
- Duration value (numeric)
- Time unit (Minutes, Hours, Days)

**Behavior**:
- Creates job in `automation_jobs` collection
- Pauses workflow execution
- Resumes automatically via heartbeat processor

**Visual**: Purple color scheme, hourglass indicator

## Automation Builder

### Visual Canvas
- **ReactFlow-based**: Drag-and-drop node positioning
- **Snap-to-grid**: 15x15 pixel grid for alignment
- **Smooth edges**: Animated connections with arrow markers
- **Background**: Dotted grid pattern
- **Controls**: Zoom, pan, fit view

### Node Inspector
- **Context-sensitive**: Shows configuration for selected node
- **Real-time updates**: Changes sync immediately
- **Variable dictionary**: Browse and copy dynamic variables
- **Validation**: Form validation for required fields

### Toolbar
- Add nodes (trigger, action, condition, delay, tag nodes)
- Auto layout (planned)
- Fullscreen toggle
- Save/commit logic

## Execution Engine

### Trigger Detection
**Event Bus Integration**:
- Activity logger maps activities to automation triggers
- Tag operations fire specialized tag triggers
- Webhook endpoint accepts external triggers

**Workspace Filtering**:
- Automations filtered by `workspaceIds` array
- Only automations bound to trigger workspace execute
- Prevents cross-workspace contamination

### Node Traversal
**Execution Flow**:
1. Locate trigger node (entry point)
2. Follow outgoing edges
3. Execute node logic
4. Handle branching (conditions)
5. Queue delays (pause execution)
6. Continue recursively

**Error Handling**:
- Node failures logged to run document
- Execution stops on error
- Run marked as 'failed' with error message

### Variable Resolution
**Dynamic Variables**:
- Syntax: `{{variable_key}}`
- Resolved from trigger payload
- Available in action configurations
- Examples: `{{school_name}}`, `{{contact_email}}`

**Variable Registry**:
- Centralized variable definitions
- Categorized (general, finance, meetings, tags)
- Type-aware (string, number, date, boolean, array)
- Searchable in node inspector

### Delay Scheduling
**Job Queue** (`automation_jobs` collection):
- Job document created for each delay
- Contains: automationId, runId, targetNodeId, payload, executeAt, status
- Status: pending → processing → completed/failed

**Heartbeat Processor**:
- Scans for pending jobs with `executeAt <= now`
- Processes up to 20 jobs per pulse
- Resumes workflow from delay checkpoint
- Prevents race conditions with status locking

**Invocation**:
- Manual: "Pulse Engine" button in admin UI
- Automated: Cron job (recommended 1-minute interval)
- Function: `processScheduledJobsAction()`

## Run Ledger

### Automation Runs
**Run Document** (`automation_runs` collection):
- automationId: Blueprint reference
- automationName: Snapshot of name
- triggerData: Complete payload
- status: running | completed | failed
- startedAt: ISO timestamp
- finishedAt: ISO timestamp (when complete)
- error: Error message (if failed)

**Run Lifecycle**:
1. Created when automation triggers
2. Status set to 'running'
3. Nodes execute sequentially
4. Status updated to 'completed' or 'failed'
5. Pending jobs prevent premature completion

### Run Inspector
**Diagnostic Modal**:
- Execution metadata (start time, duration)
- Status indicator (success/failure)
- Error stack trace (if failed)
- Trigger payload (JSON viewer)
- Copy payload functionality
- Link to blueprint editor

## Multi-Workspace Support

### Workspace Binding
**Configuration**:
- Automations have `workspaceIds` array field
- Can be bound to one or multiple workspaces
- Empty array = no constraint (warning shown)

**Filtering**:
- Trigger detection filters by workspace
- Only automations with matching workspace execute
- Payload must include `workspaceId`

**Best Practices**:
- Always bind automations to specific workspaces
- Use workspace-specific naming conventions
- Test automations in isolated workspace first
- Monitor cross-workspace implications

## Entity Migration Support

### Dual-Write Pattern
**Contact Resolution**:
- Automations accept both `schoolId` and `entityId` in payloads
- Contact adapter resolves identifiers transparently
- Tasks created with both identifiers (backward compatibility)
- Updates prefer `entityId` when available

**Migration States**:
- Legacy: Only `schoolId` in payload
- Migrated: Both `schoolId` and `entityId` in payload
- Future: Only `entityId` in payload (planned)

### Adapter Integration
**Contact Adapter Layer**:
- `resolveContact()` function handles identifier resolution
- Returns unified contact object
- Supports both legacy schools and new entities
- Maintains backward compatibility

## Tag-Based Automations

### Tag Trigger Configuration
**TagTriggerConfig**:
- `tagIds`: Array of tag IDs to watch (empty = any tag)
- `contactType`: Filter by 'school' or 'prospect'
- `appliedBy`: Filter by 'manual' or 'automatic'

**Use Cases**:
- Auto-assign tasks when "hot-lead" tag applied
- Send welcome email when "new-customer" tag added
- Escalate when "billing-issue" tag applied
- Remove from campaign when "unsubscribed" tag added

### Tag Condition Nodes
**Logic Types**:
- `has_tag`: Contact has at least one selected tag
- `has_all_tags`: Contact has every selected tag
- `has_any_tag`: Alias for has_tag
- `not_has_tag`: Contact has none of the selected tags

**Branching**:
- True path: Condition matches
- False path: Condition doesn't match

### Tag Action Nodes
**Operations**:
- `add_tags`: Apply selected tags to contact
- `remove_tags`: Remove selected tags from contact

**Execution**:
- Tags applied/removed immediately
- Changes reflected in contact record
- Can trigger subsequent TAG_ADDED/TAG_REMOVED automations

## Admin Interface

### Automation Hub (`/admin/automations`)

**Blueprints Tab**:
- Grid view of all automations
- Search/filter functionality
- Status indicators (active/paused)
- Workspace scope display
- Quick actions: Toggle status, Edit, Delete

**Run Ledger Tab**:
- Real-time execution stream
- Last 100 runs displayed
- Status indicators (completed/failed/running)
- Duration tracking
- Run inspector modal

**Pulse Engine**:
- Manual heartbeat trigger
- Processes pending delayed jobs
- Shows count of resumed protocols
- Non-blocking operation

### Blueprint Editor (`/admin/automations/[id]/edit`)

**Canvas**:
- Visual workflow builder
- Node palette (left sidebar)
- Node inspector (right sidebar)
- Auto-save functionality
- Test flow button (planned)

**Header**:
- Automation name display
- Save/commit button
- Back navigation
- Workspace warning (if unbound)

## API Endpoints

### Webhook Ingress
**Endpoint**: `POST /api/automations/webhook/{automationId}`

**Request**:
- Content-Type: application/json
- Body: Custom JSON payload

**Response**:
```json
{
  "status": "accepted",
  "receivedAt": "2024-01-01T00:00:00Z",
  "ingressId": "automation_id"
}
```

**Validation**:
- Automation must exist
- Automation must be active
- Automation trigger must be WEBHOOK_RECEIVED

**Payload Handling**:
- JSON keys become dynamic variables
- Example: `{"customer_name": "John"}` → `{{customer_name}}`

## Integration Points

### Activity Logger
**Event Bus**:
- All activities trigger automation protocols
- Mapping: activity type → automation trigger
- Non-blocking (fire and forget)
- Includes workspace context

**Trigger Mapping**:
- `school_created` → SCHOOL_CREATED
- `pipeline_stage_changed` → SCHOOL_STAGE_CHANGED
- `pdf_form_submitted` → PDF_SIGNED
- `form_submission` → SURVEY_SUBMITTED
- `task_completed` → TASK_COMPLETED
- `meeting_created` → MEETING_CREATED

### Messaging Engine
**Integration**:
- SEND_MESSAGE action uses `sendMessage()` function
- Template-based messaging
- Variable substitution
- Sender profile selection
- Recipient resolution

### Task System
**Integration**:
- CREATE_TASK action uses `createTaskNonBlocking()` function
- Dual-write pattern (schoolId + entityId)
- Source field set to 'automation'
- automationId tracked for audit

### Tag System
**Integration**:
- TAG_ADDED/TAG_REMOVED triggers via `fireTagTrigger()`
- Tag condition nodes evaluate contact tags
- Tag action nodes modify contact tags
- Workspace-scoped tag operations

## Data Model

### Automation Document
```typescript
interface Automation {
  id: string;
  workspaceIds: string[]; // Multi-workspace binding
  name: string;
  description?: string;
  trigger: AutomationTrigger;
  nodes: Node[]; // Visual workflow nodes
  edges: Edge[]; // Connections between nodes
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
  schoolId?: string; // Legacy
  entityId?: string; // New
  entityType?: EntityType;
}
```

### Automation Job Document
```typescript
interface AutomationJob {
  id: string;
  automationId: string;
  runId: string;
  targetNodeId: string; // Resume point
  payload: Record<string, any>;
  executeAt: string; // ISO timestamp
  status: 'pending' | 'processing' | 'completed' | 'failed';
}
```

## Testing

### Unit Tests
**File**: `src/lib/__tests__/automations-module-unit.test.ts`
- Trigger detection with entityId
- Task creation with dual-write
- Contact updates using entityId
- Backward compatibility with schoolId

### Property-Based Tests
**File**: `src/lib/__tests__/automation-dual-write.property.test.ts`
- Automation dual-write pattern
- Entity operations
- Trigger compatibility
- 50+ test runs per property

### Integration Tests
**File**: `src/lib/__tests__/adapter-automation-integration.test.ts`
- Automation with adapter layer
- Legacy schools support
- Migrated entities support
- Task creation scenarios

## User Permissions

**Required Permissions**:
- `system_admin` - Full automation management
- `schools_edit` - Trigger automations on school changes
- `tasks_manage` - Create tasks via automations
- `meetings_manage` - Trigger on meeting events

## Best Practices

### Automation Design
1. **Keep workflows simple**: Avoid overly complex branching
2. **Use descriptive names**: Clear naming for nodes and automations
3. **Test thoroughly**: Use test workspace before production
4. **Document logic**: Add descriptions to complex automations
5. **Monitor runs**: Check run ledger regularly for failures

### Workspace Binding
1. **Always bind to workspaces**: Avoid unbound automations
2. **Use specific workspaces**: Don't bind to all workspaces unless necessary
3. **Consider cross-workspace**: Think about shared contacts
4. **Test in isolation**: Use dedicated test workspace

### Delay Usage
1. **Set up heartbeat**: Ensure cron job is running
2. **Use reasonable delays**: Avoid very short delays (< 5 minutes)
3. **Monitor job queue**: Check for stuck jobs
4. **Handle failures**: Plan for delay job failures

### Variable Usage
1. **Use variable dictionary**: Browse available variables
2. **Test variable resolution**: Verify variables populate correctly
3. **Handle missing values**: Plan for null/undefined variables
4. **Use fallbacks**: Provide default values when possible

### Error Handling
1. **Monitor run ledger**: Check for failed runs
2. **Review error messages**: Understand failure causes
3. **Fix and retry**: Update automation and re-trigger
4. **Log activities**: Ensure proper activity logging

## Performance Considerations

### Execution Efficiency
- Automations execute asynchronously (non-blocking)
- Node traversal is recursive but optimized
- Firestore queries use indexes for workspace filtering
- Delay jobs processed in batches (20 per pulse)

### Scalability
- Run history grows over time (consider archival strategy)
- Job queue should be monitored for backlog
- Webhook endpoints can handle high volume
- Variable resolution is cached per run

### Optimization Tips
1. Minimize node count in workflows
2. Use conditions to filter early
3. Batch similar automations
4. Archive old run history
5. Monitor Firestore usage

## Troubleshooting

### Common Issues

**Automation Not Triggering**:
- Check automation is active
- Verify workspace binding matches trigger workspace
- Confirm trigger type matches event
- Review activity logger for event firing

**Delay Not Resuming**:
- Verify heartbeat processor is running
- Check job status in `automation_jobs` collection
- Ensure `executeAt` timestamp is in past
- Review job processing logs

**Variable Not Resolving**:
- Confirm variable key matches payload
- Check variable syntax: `{{key}}`
- Verify payload includes expected data
- Review trigger data in run inspector

**Task Not Creating**:
- Check contact resolution (schoolId/entityId)
- Verify workspace context
- Review task creation permissions
- Check for validation errors

**Message Not Sending**:
- Verify template exists and is active
- Check recipient resolution
- Confirm sender profile configured
- Review messaging engine logs

## Future Enhancements

### Planned Features
- Visual flow testing/simulation
- Automation templates library
- Version control for blueprints
- A/B testing for workflows
- Advanced analytics dashboard
- Automation marketplace
- Conditional delays (wait until condition)
- Parallel execution paths
- Sub-automation calls
- Loop/iteration support

### Under Consideration
- Visual debugging tools
- Automation performance metrics
- Cost tracking per automation
- Approval workflows
- Rollback functionality
- Automation cloning
- Import/export blueprints
- Collaboration features
- Audit trail enhancements
- Machine learning integration
