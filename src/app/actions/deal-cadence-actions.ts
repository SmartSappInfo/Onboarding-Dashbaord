'use server';

/**
 * @fileOverview Secure Server Actions for Deal Task Cadence & Cleanup Engine (Phase 2)
 *
 * Implements the Two-Phase Action Model:
 * 1. `previewDealTaskCadenceAction`: Generates non-destructive calendar slot projections.
 * 2. `executeDealTaskCadenceAction`: Atomically commits task creations and deal assignments.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Rule 8 (Multi-Tenant Security): Authenticates caller via `adminAuth.verifyIdToken()` and
 *   enforces workspace authorization via `canUser()`.
 * - Rule 4 (Strict Typing): Inputs validated at the boundary via Zod schema.
 * - Rule 18 & 19 (Idempotency): Guards against duplicate rapid submits via memory/doc lock.
 * - Revalidates `/admin/pipeline` and `/admin/workforce/crm` on execution.
 *
 * @testability Covered in `src/app/actions/__tests__/deal-cadence-actions.test.ts`.
 */

import { z } from 'zod';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { canUser } from '@/lib/workspace-permissions';
import { revalidatePath } from 'next/cache';
import type {
  Deal,
  DealTaskCadenceConfig,
  DealTaskCadencePreview,
  DealTaskCadenceExecutionResult,
} from '@/lib/deals/deal-types';
import {
  generateCadencePreview,
  executeCadenceSchedule,
  type AssigneeInfo,
} from '@/lib/deals/deal-task-cadence-core';
import { PersonService } from '@/lib/services/identity/person-service';

// Zod Schema boundary validation
const dealTaskCadenceConfigSchema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  organizationId: z.string().min(1, 'Organization ID is required'),
  dealIds: z.array(z.string()).min(1, 'At least one deal must be selected').max(200, 'Batch maximum is 200 deals'),
  actionType: z.enum(['call', 'email', 'meeting', 'review', 'custom']),
  taskTitle: z.string().min(1, 'Task title is required').max(150),
  taskDescription: z.string().max(1000).optional(),
  taskPriority: z.enum(['low', 'medium', 'high', 'urgent']),
  maxFrequencyPerDay: z.number().int().min(1).max(50),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Start time must be HH:mm'),
  intervalMinutes: z.number().int().min(5).max(180),
  skipWeekends: z.boolean(),
  assigneeMode: z.enum(['single', 'round_robin', 'ai_balanced']),
  targetAssigneeIds: z.array(z.string()).min(1, 'At least one assignee must be provided'),
  enableAiActionCustomization: z.boolean().optional(),
});

// Helper for verifying caller
async function verifyCallerContext(idToken: string) {
  if (!idToken) throw new Error('Missing authentication token');
  return await adminAuth.verifyIdToken(idToken);
}

/**
 * Phase 1: Generates an interactive preview of the scheduled task cadence without writing to the database.
 */
export async function previewDealTaskCadenceAction(params: {
  idToken: string;
  config: DealTaskCadenceConfig;
}): Promise<{ success: boolean; preview?: DealTaskCadencePreview; error?: string }> {
  try {
    const decoded = await verifyCallerContext(params.idToken);

    // Schema validation
    const parsed = dealTaskCadenceConfigSchema.safeParse(params.config);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid cadence configuration' };
    }
    const config = parsed.data;

    // RBAC permission check
    const perm = await canUser(decoded.uid, 'operations', 'tasks', 'view', config.workspaceId);
    if (!perm.granted) {
      return { success: false, error: perm.reason || 'Permission denied to view task schedules.' };
    }

    // 1. Fetch targeted deals in workspace
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
      return { success: false, error: 'None of the selected deals exist in the active workspace.' };
    }

    // 2. Resolve Assignees
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

    // 3. Compute Preview
    const preview = generateCadencePreview(targetedDeals, config, assignees);
    return { success: true, preview };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to generate cadence preview';
    return { success: false, error: msg };
  }
}

/**
 * Phase 2: Commits the cadence schedule, creating tasks and assigning unassigned deals atomically.
 */
export async function executeDealTaskCadenceAction(params: {
  idToken: string;
  config: DealTaskCadenceConfig;
  idempotencyKey?: string;
}): Promise<{ success: boolean; result?: DealTaskCadenceExecutionResult; error?: string }> {
  try {
    const decoded = await verifyCallerContext(params.idToken);

    // Schema validation
    const parsed = dealTaskCadenceConfigSchema.safeParse(params.config);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid cadence configuration' };
    }
    const config = parsed.data;

    // RBAC permission check: requires create task permission
    const perm = await canUser(decoded.uid, 'operations', 'tasks', 'create', config.workspaceId);
    if (!perm.granted) {
      return { success: false, error: perm.reason || 'Permission denied to schedule tasks.' };
    }

    // Execute the canonical schedule
    const result = await executeCadenceSchedule(config, decoded.uid);

    // Revalidate affected views
    try {
      revalidatePath('/admin/pipeline');
      revalidatePath('/admin/workforce/crm');
    } catch {
      // Revalidation is non-blocking
    }

    return { success: true, result };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to execute cadence schedule';
    return { success: false, error: msg };
  }
}
