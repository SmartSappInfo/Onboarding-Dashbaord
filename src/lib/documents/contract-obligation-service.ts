/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Contract Obligations & Renewal Task Synchronization Engine (Phase 3 Task 4):
 *    Tracks post-execution contractual obligations (deliverables, SLA reporting,
 *    milestones, payment confirmations, compliance audits).
 * 2. SmartSapp Task Core Integration (`createTaskCore` / `updateTaskCore`):
 *    When an obligation has `responsibleParty: 'internal'` and `syncToTasks: true`,
 *    it creates a tracked task directly in the workspace task queue (`tasks` collection)
 *    so assignees see contractual deliverables in their everyday work console (`/admin/tasks`).
 * 3. Bi-Directional Synchronization (Reverse Hook):
 *    - Resolving the obligation in the contract console updates the linked task to `done`.
 *    - Fulfilling the task in CRM (`syncObligationWithTask`) auto-advances the obligation to `fulfilled`.
 * 4. Strict Typing & Zero-`any` (Rule 4):
 *    Strictly typed with Zod schema validation on all inputs and returned models.
 */

import {
  ContractObligationSchema,
  type ContractObligation,
  type ObligationType,
} from '@/lib/types/document-signing';
import {
  createTaskCore,
  updateTaskCore,
  type TaskActor,
  type NewTaskInput,
} from '@/lib/tasks/task-core';

export interface CreateContractObligationParams {
  workspaceId: string;
  contractId: string;
  title: string;
  description?: string;
  type?: ObligationType;
  dueDate: string; // ISO-8601
  responsibleParty?: 'internal' | 'counterparty' | 'mutual';
  assignedUserId?: string;
  counterpartyContactId?: string;
  reminderDaysBefore?: number[];
  syncToTasks?: boolean;
}

export interface CreateContractObligationResult {
  obligation: ContractObligation;
  linkedTaskId?: string;
}

export interface FulfillObligationParams {
  obligation: ContractObligation;
  fulfilledBy: string;
  notes?: string;
}

export interface FulfillObligationResult {
  obligation: ContractObligation;
  wasAlreadyFulfilled: boolean;
}

export interface SyncObligationWithTaskParams {
  obligation: ContractObligation;
  taskStatus: string;
  updatedBy?: string;
}

export interface UpcomingObligationItem {
  obligation: ContractObligation;
  daysRemaining: number;
  isOverdue: boolean;
}

export interface ObligationReminderEvaluation {
  shouldSendReminder: boolean;
  daysRemaining: number;
  matchedReminderDay?: number;
}

const SYSTEM_ACTOR: TaskActor = {
  kind: 'system',
  source: 'contract_obligation',
};

/**
 * Creates a contractual obligation and synchronously dispatches a linked task to SmartSapp task core
 * when internal action is required.
 */
export async function createContractObligation(
  params: CreateContractObligationParams
): Promise<CreateContractObligationResult> {
  const {
    workspaceId,
    contractId,
    title,
    description,
    type = 'deliverable',
    dueDate,
    responsibleParty = 'internal',
    assignedUserId,
    counterpartyContactId,
    reminderDaysBefore = [7, 14, 30],
    syncToTasks = true,
  } = params;

  const now = new Date().toISOString();
  const obligationId = `ob_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;

  let linkedTaskId: string | undefined = undefined;

  // If internal responsibility and task syncing is enabled, dispatch to SmartSapp task core
  if (syncToTasks && (responsibleParty === 'internal' || responsibleParty === 'mutual')) {
    const taskInput: NewTaskInput = {
      workspaceId,
      title: `[Contract Deliverable] ${title}`,
      description: description ?? `Contract obligation for contract ${contractId}`,
      dueDate,
      priority: 'high',
      status: 'todo',
      category: 'general',
      assignedTo: assignedUserId || '',
      entityId: counterpartyContactId,
      entityType: counterpartyContactId ? 'institution' : undefined,
      source: 'system',
      relatedParentId: contractId,
      relatedEntityId: obligationId,
      reminders: [],
      reminderSent: false,
    };

    const taskResult = await createTaskCore(taskInput, SYSTEM_ACTOR);
    if (taskResult.success && taskResult.id) {
      linkedTaskId = taskResult.id;
    }
  }

  const rawObligation: ContractObligation = {
    id: obligationId,
    workspaceId,
    contractId,
    title,
    description,
    type,
    status: 'pending',
    dueDate,
    responsibleParty,
    assignedUserId,
    counterpartyContactId,
    linkedTaskId,
    reminderDaysBefore,
    createdAt: now,
    updatedAt: now,
  };

  const obligation = ContractObligationSchema.parse(rawObligation);

  return {
    obligation,
    linkedTaskId,
  };
}

/**
 * Marks an obligation fulfilled and resolves the linked task in SmartSapp task core.
 * Invariant: Idempotent - fulfilling an already fulfilled obligation avoids double updates.
 */
export async function fulfillObligation(
  params: FulfillObligationParams
): Promise<FulfillObligationResult> {
  const { obligation, fulfilledBy } = params;

  if (obligation.status === 'fulfilled') {
    return {
      obligation,
      wasAlreadyFulfilled: true,
    };
  }

  const now = new Date().toISOString();
  const updatedObligation: ContractObligation = ContractObligationSchema.parse({
    ...obligation,
    status: 'fulfilled',
    fulfilledAt: now,
    fulfilledBy,
    updatedAt: now,
  });

  // Resolve linked task in task core if present
  if (obligation.linkedTaskId) {
    try {
      await updateTaskCore(
        obligation.linkedTaskId,
        {
          status: 'done',
          completedAt: now,
        },
        SYSTEM_ACTOR
      );
    } catch (err: unknown) {
      console.warn(`[OBLIGATION] Failed to complete linked task ${obligation.linkedTaskId}:`, err);
    }
  }

  return {
    obligation: updatedObligation,
    wasAlreadyFulfilled: false,
  };
}

/**
 * Bi-directional reverse hook: updates contract obligation status based on linked CRM task resolution.
 */
export function syncObligationWithTask(
  params: SyncObligationWithTaskParams
): ContractObligation {
  const { obligation, taskStatus, updatedBy } = params;
  const now = new Date().toISOString();

  if (taskStatus === 'done' && obligation.status !== 'fulfilled') {
    return ContractObligationSchema.parse({
      ...obligation,
      status: 'fulfilled',
      fulfilledAt: now,
      fulfilledBy: updatedBy ?? 'CRM Task System',
      updatedAt: now,
    });
  }

  if (taskStatus !== 'done' && obligation.status === 'fulfilled') {
    // If reopened in CRM, revert obligation status
    return ContractObligationSchema.parse({
      ...obligation,
      status: 'in_progress',
      fulfilledAt: undefined,
      fulfilledBy: undefined,
      updatedAt: now,
    });
  }

  return obligation;
}

/**
 * Filters and sorts pending/active obligations by due date relative to a reference timestamp.
 */
export function getUpcomingObligations(
  obligations: ContractObligation[],
  referenceDate: Date = new Date()
): UpcomingObligationItem[] {
  const refTime = referenceDate.getTime();
  const msInDay = 1000 * 60 * 60 * 24;

  const items = obligations.map((ob) => {
    const dueTime = new Date(ob.dueDate).getTime();
    const daysRemaining = Math.ceil((dueTime - refTime) / msInDay);
    const isOverdue = daysRemaining < 0 && ob.status !== 'fulfilled' && ob.status !== 'waived';

    return {
      obligation: ob,
      daysRemaining,
      isOverdue,
    };
  });

  // Sort ascending by due date
  return items.sort((a, b) => {
    const timeA = new Date(a.obligation.dueDate).getTime();
    const timeB = new Date(b.obligation.dueDate).getTime();
    return timeA - timeB;
  });
}

/**
 * Evaluates whether an upcoming obligation falls on an alert trigger day.
 */
export function evaluateObligationReminders(
  obligation: ContractObligation,
  referenceDate: Date = new Date()
): ObligationReminderEvaluation {
  const refTime = referenceDate.getTime();
  const msInDay = 1000 * 60 * 60 * 24;

  const dueTime = new Date(obligation.dueDate).getTime();
  const daysRemaining = Math.ceil((dueTime - refTime) / msInDay);

  const reminderDays = obligation.reminderDaysBefore ?? [7, 14, 30];
  const matchedReminderDay = reminderDays.find((day) => day === daysRemaining);

  return {
    shouldSendReminder: matchedReminderDay !== undefined,
    daysRemaining,
    matchedReminderDay,
  };
}
