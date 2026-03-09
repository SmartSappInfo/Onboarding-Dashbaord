
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

## 3. Functional Status Checklist

### [x] Phase 1: Core Task Registry
- [x] **Centralized Hub**: View all tasks at `/admin/tasks`.
- [x] **Global Filtering**: Filter by Status (Pending/Completed), Priority (Critical/Low), and Assignee.
- [x] **Task Studio**: Visual editor for creating and modifying task metadata.
- [x] **Optimistic UI**: Real-time status toggling with background Firestore synchronization.
- [x] **Type Safety**: Defined `Task`, `TaskPriority`, and `TaskCategory` enums.

### [x] Phase 2: Contextual Integration
- [x] **School Console Binding**: Task registry embedded in School Detail view.
- [x] **Dashboard Pulse**: "Action Items" widget showing personal high-priority tasks.
- [x] **Manager Auto-Discovery**: Tasks automatically inherit school managers when created in context.

### [x] Phase 3: Automation Logic
- [x] **Trigger Hub Binding**: Support for `CREATE_TASK` action in the global Automation Engine.
- [x] **Dynamic Due Dates**: Support for date offsets (e.g., Create task due in 2 days).

### [ ] Phase 4: Pending Refinements (Backlog)
- [ ] **Proactive Reminders**: Logic to actually dispatch SMS/Email based on `dueDate` via a cron/worker.
- [ ] **Bulk Operations**: Select multiple tasks for bulk completion or reassignment.
- [ ] **Recurring Protocols**: Define templates for tasks that repeat weekly/monthly.
- [ ] **Rich Data Interlink**: Deep-linking from a task directly to the survey/PDF that needs attention.
- [ ] **Performance Reporting**: Visual analytics on "Average Time to Completion" per user.

## 4. Technical Architecture

- **Path**: `/tasks/{taskId}`
- **Sync Logic**: Non-blocking `updateTaskNonBlocking` utility to ensure zero-latency for field agents.
- **Audit Path**: Every task creation/completion triggers a system log in the `activities` collection.
