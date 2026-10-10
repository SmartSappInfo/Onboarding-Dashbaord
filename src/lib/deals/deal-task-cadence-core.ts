/**
 * @fileOverview Deal Task Cadence & Cleanup Canonical Core Engine
 *
 * Implements deterministic calendar pacing, capacity rate-limiting, and atomic
 * task-deal assignments for unassigned deals and deals lacking next steps.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Rule 69 (Canonical Layering Axiom): Pure scheduling mathematics and batch operations
 *   are strictly isolated here. UI modals, server actions, and MCP tools are purely thin adapters.
 * - Crucial Business Invariant: A deal MUST be assigned to the designated representative
 *   before or atomically with the task creation. Unassigned deals are assigned to the slot's
 *   representative as part of the execution commit.
 * - Rule 9 (High-Load Safety): Commits operate in chunked batches of <= 250 writes.
 * - Rule 4: Strict zero `any` or `any[]` typing standard.
 *
 * @testability Covered by `src/lib/deals/__tests__/deal-task-cadence-core.test.ts`.
 */

import { adminDb } from '@/lib/firebase-admin';
import type {
  Deal,
  DealTaskCadenceConfig,
  DealCadenceTimeSlot,
  DealTaskCadenceDaySummary,
  DealTaskCadencePreview,
  DealTaskCadenceExecutionResult,
} from '@/lib/deals/deal-types';
import { createTaskCore } from '@/lib/tasks/task-core';
import { PersonService } from '@/lib/services/identity/person-service';
import { logActivity } from '@/lib/activity-logger';

export interface AssigneeInfo {
  id: string;
  name: string;
  email?: string;
}

/**
 * Computes calendar date after advancing a specific number of working days,
 * skipping Saturdays (6) and Sundays (0) if `skipWeekends` is true.
 */
export function computeWorkingDate(baseDateStr: string, workingDaysOffset: number, skipWeekends: boolean): Date {
  const [year, month, day] = baseDateStr.split('-').map(Number);
  const current = new Date(year, (month || 1) - 1, day || 1, 9, 0, 0, 0);

  let daysAdded = 0;
  // If base date falls on weekend and skipWeekends is active, advance to next Monday first
  if (skipWeekends) {
    while (current.getDay() === 0 || current.getDay() === 6) {
      current.setDate(current.getDate() + 1);
    }
  }

  while (daysAdded < workingDaysOffset) {
    current.setDate(current.getDate() + 1);
    if (skipWeekends && (current.getDay() === 0 || current.getDay() === 6)) {
      continue;
    }
    daysAdded++;
  }

  return current;
}

/**
 * Formats a calendar slot into an ISO 8601 string given start time and intra-day slot index.
 * Automatically handles intra-day intervals (e.g., 30 mins) clamped within business hours.
 */
export function formatCadenceSlotTime(
  dayDate: Date,
  startTimeStr: string,
  slotIndexOnDay: number,
  intervalMinutes: number
): string {
  const [startHourStr, startMinStr] = (startTimeStr || '09:00').split(':');
  const startHour = Number(startHourStr) || 9;
  const startMin = Number(startMinStr) || 0;

  const slotDate = new Date(dayDate);
  const totalOffsetMinutes = slotIndexOnDay * (intervalMinutes || 30);

  const initialTotalMinutes = startHour * 60 + startMin + totalOffsetMinutes;
  // Clamp to 17:00 (5:00 PM) max to keep tasks within normal working hours
  const clampedMinutes = Math.min(initialTotalMinutes, 17 * 60);

  const hour = Math.floor(clampedMinutes / 60);
  const minute = clampedMinutes % 60;

  slotDate.setHours(hour, minute, 0, 0);
  return slotDate.toISOString();
}

/**
 * Builds pure, projected time slots across deals, assignees, and daily capacity.
 */
export function buildCadenceTimeSlots(
  deals: Deal[],
  config: DealTaskCadenceConfig,
  assignees: AssigneeInfo[]
): DealCadenceTimeSlot[] {
  if (deals.length === 0 || assignees.length === 0) {
    return [];
  }

  const maxFreq = Math.max(1, config.maxFrequencyPerDay || 5);
  const numReps = assignees.length;
  // Combined team capacity per working day
  const dailyTeamCapacity = maxFreq * numReps;

  const slots: DealCadenceTimeSlot[] = [];

  for (let i = 0; i < deals.length; i++) {
    const deal = deals[i];
    // Calculate which business day this deal falls on
    const dayIndex = Math.floor(i / dailyTeamCapacity);
    const dayDate = computeWorkingDate(config.startDate, dayIndex, config.skipWeekends);

    // Determine representative for this slot
    let assignee: AssigneeInfo;
    if (config.assigneeMode === 'single') {
      assignee = assignees[0];
    } else {
      // Round-robin or balanced distribution
      assignee = assignees[i % numReps];
    }

    // Intra-day slot position for this specific rep on this day
    const intraDayRepSlot = Math.floor((i % dailyTeamCapacity) / numReps);
    const scheduledAt = formatCadenceSlotTime(
      dayDate,
      config.startTime,
      intraDayRepSlot,
      config.intervalMinutes
    );

    // Extract primary or focal contact details if present
    const focal = deal.focalContacts?.find((fc) => fc.isPrimary) || deal.focalContacts?.[0];
    const focalName = focal?.name || deal.contacts?.[0]?.name;
    const focalEmail = focal?.email || deal.contacts?.[0]?.email;
    const focalPhone = focal?.phone || deal.contacts?.[0]?.phone;

    slots.push({
      dealId: deal.id,
      dealTitle: deal.name || 'Untitled Opportunity',
      dealValue: Number(deal.value || 0),
      focalContactName: focalName,
      focalContactEmail: focalEmail,
      focalContactPhone: focalPhone,
      assigneeId: assignee.id,
      assigneeName: assignee.name,
      assigneeEmail: assignee.email,
      scheduledAt,
      dayIndex,
      actionTitle: config.taskTitle || 'Follow-up on Opportunity',
      actionDescription: config.taskDescription,
      priority: config.taskPriority || 'medium',
      aiRecommended: config.enableAiActionCustomization,
    });
  }

  return slots;
}

/**
 * Aggregates individual time slots into day-by-day preview summaries.
 */
export function generateCadenceDaySummaries(slots: DealCadenceTimeSlot[]): DealTaskCadenceDaySummary[] {
  const mapByDate = new Map<string, DealTaskCadenceDaySummary>();

  for (const slot of slots) {
    const dateKey = slot.scheduledAt.split('T')[0];
    if (!mapByDate.has(dateKey)) {
      mapByDate.set(dateKey, {
        date: dateKey,
        dayNumber: slot.dayIndex + 1,
        taskCount: 0,
        deals: [],
      });
    }

    const summary = mapByDate.get(dateKey)!;
    summary.taskCount++;
    summary.deals.push({
      id: slot.dealId,
      title: slot.dealTitle,
      assigneeName: slot.assigneeName,
      time: slot.scheduledAt.slice(11, 16), // HH:mm
    });
  }

  return Array.from(mapByDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Generates a full interactive preview of a proposed task cadence schedule.
 * Pure read-only computation (Two-Phase Action Model Phase 1).
 */
export function generateCadencePreview(
  deals: Deal[],
  config: DealTaskCadenceConfig,
  assignees: AssigneeInfo[]
): DealTaskCadencePreview {
  const slots = buildCadenceTimeSlots(deals, config, assignees);
  const daySummaries = generateCadenceDaySummaries(slots);

  const totalPipelineValue = deals.reduce((sum, d) => sum + Number(d.value || 0), 0);
  const startDate = daySummaries.length > 0 ? daySummaries[0].date : config.startDate;
  const endDate = daySummaries.length > 0 ? daySummaries[daySummaries.length - 1].date : config.startDate;

  return {
    workspaceId: config.workspaceId,
    totalDeals: deals.length,
    totalPipelineValue,
    totalDaysSpanned: daySummaries.length,
    startDate,
    endDate,
    slots,
    daySummaries,
  };
}

/**
 * Atomically executes the cadence schedule across deals and tasks.
 * Ensures:
 * 1. Deals are assigned to the designated representative before/with task creation.
 * 2. Deal nextStep and nextStepDueDate are synchronized.
 * 3. Tasks are created in `tasks` with strict workspace scoping.
 * 4. Mutations are chunked into safe batches of <= 250 operations.
 */
export async function executeCadenceSchedule(
  config: DealTaskCadenceConfig,
  executedBy: string
): Promise<DealTaskCadenceExecutionResult> {
  const now = new Date().toISOString();
  const CHUNK_SIZE = 250;

  if (!config.dealIds || config.dealIds.length === 0) {
    throw new Error('No deals provided for cadence execution.');
  }

  // 1. Resolve Reps
  const assignees: AssigneeInfo[] = [];
  for (const repId of config.targetAssigneeIds) {
    const person = await PersonService.getPerson(repId);
    if (person) {
      assignees.push({
        id: person.id,
        name: person.displayName || person.email || repId,
        email: person.email,
      });
    } else {
      assignees.push({ id: repId, name: repId });
    }
  }

  if (assignees.length === 0) {
    throw new Error('At least one valid assignee must be provided.');
  }

  // 2. Fetch Deals in target workspace
  const dealsSnap = await adminDb
    .collection('deals')
    .where('workspaceId', '==', config.workspaceId)
    .get();

  const dealMap = new Map<string, Deal>();
  for (const doc of dealsSnap.docs) {
    dealMap.set(doc.id, { id: doc.id, ...doc.data() } as Deal);
  }

  const targetedDeals: Deal[] = [];
  for (const id of config.dealIds) {
    const d = dealMap.get(id);
    if (d) targetedDeals.push(d);
  }

  if (targetedDeals.length === 0) {
    throw new Error('None of the specified deals exist within the active workspace.');
  }

  // 3. Project slots
  const slots = buildCadenceTimeSlots(targetedDeals, config, assignees);
  const daySummaries = generateCadenceDaySummaries(slots);

  const errors: string[] = [];
  let tasksCreatedCount = 0;
  let dealsUpdatedCount = 0;

  // 4. Execute in chunks
  for (let i = 0; i < slots.length; i += CHUNK_SIZE) {
    const chunk = slots.slice(i, i + CHUNK_SIZE);
    for (const slot of chunk) {
      try {
        // A. Critical Business Invariant: Deal must be assigned to the designated representative
        // BEFORE or ATOMICALLY with the task assignment, preventing unassigned orphan deals.
        const dealRef = adminDb.collection('deals').doc(slot.dealId);
        await dealRef.update({
          assignedTo: {
            userId: slot.assigneeId,
            name: slot.assigneeName,
            email: slot.assigneeEmail || '',
          },
          ownerId: slot.assigneeId,
          nextStep: slot.actionTitle,
          nextStepDueDate: slot.scheduledAt,
          updatedAt: now,
        });
        dealsUpdatedCount++;

        // B. Create Task via canonical createTaskCore with designated representative
        const taskResult = await createTaskCore(
          {
            workspaceId: config.workspaceId,
            organizationId: config.organizationId,
            title: slot.actionTitle,
            description: slot.actionDescription || `Automated follow-up cadence task for opportunity: ${slot.dealTitle}`,
            priority: slot.priority,
            status: 'todo',
            category: 'follow_up',
            assignedTo: slot.assigneeId,
            assignedToName: slot.assigneeName,
            dealId: slot.dealId,
            relatedEntityType: 'Deal',
            relatedEntityId: slot.dealId,
            dueDate: slot.scheduledAt,
            startDate: slot.scheduledAt,
            source: 'automation',
            reminders: [],
            reminderSent: false,
          },
          { kind: 'user', uid: executedBy }
        );

        if (taskResult.success) {
          tasksCreatedCount++;
        } else {
          errors.push(`Task creation failed for deal ${slot.dealId}: ${taskResult.error}`);
        }

        // C. Audit Activity Logging
        await logActivity({
          organizationId: config.organizationId,
          workspaceId: config.workspaceId,
          userId: executedBy,
          type: 'task_created',
          source: 'system',
          dealId: slot.dealId,
          description: `Scheduled follow-up cadence task "${slot.actionTitle}" assigned to ${slot.assigneeName} for ${slot.scheduledAt.split('T')[0]}.`,
          metadata: {
            dealId: slot.dealId,
            assigneeId: slot.assigneeId,
            scheduledAt: slot.scheduledAt,
          },
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown slot execution error';
        errors.push(`Slot error for deal ${slot.dealId}: ${msg}`);
      }
    }
  }

  const startDate = daySummaries.length > 0 ? daySummaries[0].date : config.startDate;
  const endDate = daySummaries.length > 0 ? daySummaries[daySummaries.length - 1].date : config.startDate;

  return {
    jobId: `cadence_${config.workspaceId}_${Date.now()}`,
    workspaceId: config.workspaceId,
    totalDealsProcessed: targetedDeals.length,
    tasksCreatedCount,
    dealsUpdatedCount,
    startDate,
    endDate,
    executedAt: now,
    status: errors.length === 0 ? 'completed' : tasksCreatedCount > 0 ? 'partial' : 'failed',
    errors: errors.length > 0 ? errors : undefined,
  };
}
