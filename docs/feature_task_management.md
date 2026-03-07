
# Feature: Operational Task Management (CRM)

## 1. Purpose
A proactive task execution layer that ensures all human interventions required during the school onboarding lifecycle are tracked, scheduled, and resolved.

## 2. Data Model
### Task Schema (`/tasks/{taskId}`)
```json
{
  "id": "string",
  "title": "string",
  "description": "string",
  "priority": "low" | "medium" | "high" | "critical",
  "status": "pending" | "in_progress" | "completed" | "cancelled",
  "category": "call" | "visit" | "document" | "training" | "general",
  "schoolId": "string",
  "schoolName": "string (denormalized)",
  "assignedTo": "userId",
  "dueDate": "ISO string",
  "reminderSent": "boolean",
  "source": "manual" | "automation" | "system",
  "automationId": "string (optional)",
  "createdAt": "ISO string",
  "completedAt": "ISO string (optional)"
}
```

## 3. Integration Points
- **Automation Engine**: New Action Type `CREATE_TASK` added to the global trigger hub.
- **Messaging Engine**: New Template Categories for "Task Reminders".
- **School Console**: Persistent "Tasks" tab showing history and pending items for that specific campus.
- **Operational Hub**: "Focus Mode" widget showing today's critical tasks for the logged-in admin.

## 4. Automation Logic
- **Rule**: If `PDF_SUBMISSION` is not received 3 days after `MEETING_COMPLETED` -> Create Task "Call for Signature".
- **Rule**: If `SURVEY_RESULT` is "Unqualified" -> Create Task "Escalate to Management".
- **Rule**: If `SCHOOL_STAGE` moves to "Go-Live" -> Create Task "Final Data Integrity Check".
    