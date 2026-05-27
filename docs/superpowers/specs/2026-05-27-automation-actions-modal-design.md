# Design Spec: Categorized Automation Elements Selection Modal

High-fidelity design specification for adding a unified Trigger & Action Bento Card modal in the SmartSapp Automation Builder.

## 1. Goal & Objectives
- Add a new "Add Element..." button to the left quick-action toolbar of the visual automation builder.
- Trigger a centered, modern Bento Grid Modal that categorizes all Triggers, Actions, Conditions, and Delays.
- Pre-configure nodes (e.g., specific trigger events or action types) upon selection rather than inserting blank nodes.
- Implement Smart Insertion: automatically place and link the new node below the currently selected node.

## 2. Element Classifications
The modal sidebar contains the following categories, mapping directly to specific node configurations:

### Triggers (Start Triggers)
Adds a `triggerNode` with a specific event field `data.trigger`:
- **Entity Events**: `ENTITY_CREATED`, `ENTITY_UPDATED`, `ENTITY_ASSIGNED`, `ENTITY_STAGE_CHANGED`, `ENTITY_FIELD_CHANGED`, `DATE_REACHED`, `SCORE_CHANGED`, `ENTITY_INACTIVE`
- **Deals & Pipelines**: `DEAL_CREATED`, `DEAL_STAGE_CHANGED`, `DEAL_STATUS_CHANGED`, `DEAL_VALUE_CHANGED`, `DEAL_OWNER_CHANGED`
- **Engagement**: `FORM_SUBMITTED`, `SURVEY_SUBMITTED`, `PDF_SIGNED`, `CAMPAIGN_PAGE_SUBMITTED`, `WEBPAGE_VISITED`, `EVENT_RECORDED`
- **Meetings**: `MEETING_CREATED`, `MEETING_REGISTRANT_ADDED`, `MEETING_REGISTRANT_ATTENDED`, `MEETING_REGISTRANT_NO_SHOW`
- **Tasks & Tags**: `TASK_CREATED`, `TASK_COMPLETED`, `TASK_OVERDUE`, `TAG_ADDED`, `TAG_REMOVED`
- **Campaigns**: `CAMPAIGN_DELIVERED`, `CAMPAIGN_FAILED`, `CAMPAIGN_OPENED`, `CAMPAIGN_CLICKED`, `EMAIL_BOUNCED`
- **Integrations**: `WEBHOOK_RECEIVED`

### Actions & Logic (Middle-Flow Elements)
Instantiates nodes pre-configured with their respective properties:

#### Sending Options
Adds an `actionNode` pre-configured for message channels:
- **Send Email**: `data.actionType = 'SEND_MESSAGE'`, `data.config.channel = 'email'`
- **Send SMS**: `data.actionType = 'SEND_MESSAGE'`, `data.config.channel = 'sms'`

#### Conditions and Workflow
Adds logic control nodes:
- **Temporal Delay**: Instantiates `delayNode` with `data.config = { value: 5, unit: 'Minutes' }`
- **If/Else Condition**: Instantiates `conditionNode`
- **Tag Condition**: Instantiates `tagConditionNode`
- **Chain Automation**: Instantiates `actionNode` with `data.actionType = 'RUN_AUTOMATION'`

#### Contacts & Data
Adds tag and field modification nodes:
- **Add Tag**: Instantiates `tagActionNode` with `data.action = 'ADD'`
- **Remove Tag**: Instantiates `tagActionNode` with `data.action = 'REMOVE'`
- **Update Entity**: Instantiates `actionNode` with `data.actionType = 'UPDATE_ENTITY'`
- **Assign Entity**: Instantiates `actionNode` with `data.actionType = 'ASSIGN_ENTITY'`
- **Add Note**: Instantiates `actionNode` with `data.actionType = 'ADD_NOTE'`

#### CRM & Sales
Adds deal and task management nodes:
- **Create Deal**: Instantiates `actionNode` with `data.actionType = 'CREATE_DEAL'`
- **Update Deal Stage**: Instantiates `actionNode` with `data.actionType = 'UPDATE_DEAL_STAGE'`
- **Update Deal Value**: Instantiates `actionNode` with `data.actionType = 'UPDATE_DEAL_VALUE'`
- **Update Deal Status**: Instantiates `actionNode` with `data.actionType = 'UPDATE_DEAL_STATUS'`
- **Create Task**: Instantiates `actionNode` with `data.actionType = 'CREATE_TASK'`
- **Update Task**: Instantiates `actionNode` with `data.actionType = 'UPDATE_TASK'`

#### Integrations
Adds third-party webhook connection nodes:
- **Call Webhook**: Instantiates `actionNode` with `data.actionType = 'TRIGGER_OUTBOUND_WEBHOOK'`

## 3. UI Component Architecture

### A. Add Library Button
- Located at the top/bottom of the quick actions card in `AutomationBuilder.tsx`.
- Uses a primary color theme (e.g. violet or blue glow) with a `Plus` or `Grid` icon.
- Tooltip: `"Open Elements Library"`.

### B. Element Library Modal (`ElementLibraryModal.tsx`)
A new React component using shadcn/ui `Dialog`. Contains:
1. **Search Input**:
   - Matches search text against title, subtitle, descriptions, and tags.
   - Clears category selection on typing, or filters inside the active category.
2. **Category Sidebar**:
   - Vertically stacked lists with active highlights.
3. **Bento Card Area**:
   - Grid layout showing options with icons, metadata, and custom colors:
     - Sending Options: Blue
     - Workflow/Delays: Purple
     - CRM/Sales: Orange/Amber
     - Data/Tags: Green
     - Integrations: Teal
4. **Smart Placement/Connection Logic**:
   - Reads the currently selected node ID.
   - Finds its position: $x = \text{node.position.x}$, $y = \text{node.position.y}$.
   - Calculates target position: $x = \text{parent.x}$, $y = \text{parent.y} + 140$ (offset to avoid overlapping).
   - If no node is selected, places it near the canvas center.
   - Automatically appends a new edge connecting `selectedNodeId` to `newNodeId`.

## 4. Verification Plan
- **Mock Canvas Flow**: Add multiple triggers and actions via the modal and verify coordinates are offset correctly.
- **Edge Creation**: Confirm ReactFlow edge connects parent to child node and renders with primary colors and arrows.
- **Payload Inspection**: Click the added node to open the Logic Inspector (`NodeInspector.tsx`) and confirm it loads the selected action type and configs automatically.
