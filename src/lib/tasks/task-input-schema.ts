/**
 * @fileOverview Allowlist of Task fields a caller may write through the REST API (Round 4 item 5).
 *
 * WHY: `/api/tasks` used to spread the raw JSON body into the stored task, so a caller could set any
 * field — including tenant fields — and PATCH could re-link identifiers. Unknown keys are now stripped
 * (Zod's default), types are validated, and tenant/identity fields are never writable here:
 * - `id`, `createdAt`, `updatedAt` — owned by the store;
 * - `workspaceId` — taken from the authorized request, set by the route;
 * - `organizationId` — derived from the workspace by the task core.
 *
 * Keep this in sync with `Task` in `src/lib/types.ts`; `assertWritableFieldsMatchTask` below makes the
 * compiler fail if a schema field stops matching the Task type.
 */

import { z } from 'zod';
import type { Task } from '@/lib/types';

const TaskNoteSchema = z.object({
  id: z.string(),
  content: z.string(),
  createdAt: z.string(),
  authorName: z.string().optional(),
});

const TaskAttachmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  type: z.string(),
  createdAt: z.string(),
});

const TaskReminderSchema = z.object({
  reminderTime: z.string(),
  channels: z.array(z.enum(['notification', 'email', 'sms'])),
  sent: z.boolean(),
});

/** Every Task field a REST caller may set. All optional; routes add their own required fields. */
export const TaskWritableFieldsSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  status: z.enum(['todo', 'in_progress', 'waiting', 'review', 'done']),
  category: z.enum(['call', 'visit', 'document', 'training', 'follow_up', 'general']),
  assignedTo: z.union([z.string(), z.array(z.string())]),
  assignedToName: z.string(),
  assignedToNames: z.array(z.string()),
  entityId: z.string().nullable(),
  entityType: z.enum(['institution', 'family', 'person']),
  entityName: z.string().nullable(),
  dueDate: z.string(),
  startDate: z.string(),
  completedAt: z.string(),
  source: z.enum(['manual', 'automation', 'system']),
  automationId: z.string(),
  attachments: z.array(TaskAttachmentSchema),
  notes: z.array(TaskNoteSchema),
  reminders: z.array(TaskReminderSchema),
  reminderSent: z.boolean(),
  relatedEntityType: z.enum(['SurveyResponse', 'Submission', 'Meeting', 'School', 'Deal']).nullable(),
  relatedParentId: z.string().nullable(),
  relatedEntityId: z.string().nullable(),
  dealId: z.string().nullable(),
}).partial();

/** POST body: writable fields plus the fields the route requires. */
export const CreateTaskRequestSchema = TaskWritableFieldsSchema.extend({
  workspaceId: z.string().min(1),
  title: z.string().min(1),
  entityId: z.string().min(1),
});

/** PATCH body: writable fields minus the entity identifiers, which are preserved (Requirement 3.2). */
export const UpdateTaskRequestSchema = TaskWritableFieldsSchema.omit({ entityId: true, entityType: true });

/** Compile-time guard: parsed payloads must be assignable to Task fields (no casts needed downstream). */
function assertWritableFieldsMatchTask(fields: z.infer<typeof TaskWritableFieldsSchema>): Partial<Task> {
  return fields;
}
void assertWritableFieldsMatchTask;

/** Flattened, client-safe description of validation failures. */
export function describeTaskPayloadIssues(error: z.ZodError): string {
  return error.issues.map(issue => `${issue.path.join('.') || 'body'}: ${issue.message}`).join('; ');
}
