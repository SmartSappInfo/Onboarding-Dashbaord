# Feature: Operational Task Management (CRM)

## 1. Overview
A proactive task execution layer that ensures all human interventions required during the school onboarding lifecycle are tracked, scheduled, and resolved. This module transforms the platform from a passive data repository into an active CRM.

## 2. User Stories (INVEST)

### Story 1: Manual Intervention
**As an** Administrator,  
**I want** to manually schedule site visits or follow-up calls for a specific school,  
**So that** I can ensure personalized attention is given to high-value institutions.

### Story 2: Automated Proactivity
**As an** Account Manager,  
**I want** the system to automatically generate "Signature Required" tasks for me when a parent hasn't signed a document within 3 days,  
**So that** I don't have to manually monitor document status.

### Story 3: Scale & Speed
**As an** Account Manager,
**I want** to bulk resolve multiple tasks across different schools at once,
**So that** I can maintain high operational velocity during peak enrollment periods.

## 3. Functional Status Checklist

### [x] Phase 1: Core Task Registry
- [x] **Centralized Hub**: View all tasks at `/admin/tasks`.
- [x] **Global Filtering**: Filter by Status, Priority, and Assignee.
- [x] **Task Studio**: Visual editor for task metadata.
- [x] **Optimistic UI**: Real-time status toggling.

### [x] Phase 2: Contextual Integration
- [x] **School Console Binding**: Task registry embedded in School Detail view.
- [x] **Dashboard Pulse**: "Critical Focus" widget for personal focus.

### [x] Phase 3: Automation Logic
- [x] **Trigger Hub Binding**: Support for `CREATE_TASK` action.
- [x] **Dynamic Due Dates**: Support for date offsets.

### [x] Phase 4: Proactive Refinements
- [x] **Bulk Operations**: Select and complete/delete multiple tasks via floating toolbar.
- [x] **Rich Data Interlink**: Deep-linking from tasks to specific Survey Responses or PDF Submissions.
- [x] **Performance Reporting**: Visual analytics on resolution velocity in the Intelligence Hub.
- [ ] **Proactive Reminders**: Logic to actually dispatch SMS/Email based on `dueDate` via a cron/worker.
- [ ] **Recurring Protocols**: Define templates for tasks that repeat weekly/monthly.

## 4. Technical Architecture

- **Path**: `/tasks/{taskId}`
- **Interlinking**: Uses `relatedEntityType`, `relatedEntityId`, and `relatedParentId` for deep navigation.
- **Sync Logic**: Non-blocking `updateTaskNonBlocking` utility.
- **Reporting**: Calculates difference between `createdAt` and `completedAt` for lead-time analytics.
