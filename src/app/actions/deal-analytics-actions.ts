/**
 * @fileoverview Deals Platform 2.0 Revenue Targets & Quota Server Actions
 *
 * ARCHITECTURAL PURPOSE & DESIGN SPECIFICATION (PRD Section 124 & Sections 48, 52):
 * - Manages monthly and quarterly pipeline revenue targets / quotas (`pipeline_targets` collection).
 * - Enforces multi-tenant workspace isolation and RBAC via `canUser()`.
 * - Records immutable audit entries in `logActivity()`.
 * - Revalidates pipeline and analytics views.
 *
 * WORKSPACE RULES & COMPLIANCE (Rule 10, Rule 9, Rule 5):
 * - Strict zero 'any' / zero 'any[]'.
 * - Scoped by `workspaceId`.
 * - Safe numeric validations preventing negative quotas.
 *
 * TESTABILITY POINTER:
 * Tested in `src/app/actions/__tests__/deal-analytics-actions.test.ts`.
 */

'use server';

import { adminDb } from '@/lib/firebase-admin';
import { canUser } from '@/lib/workspace-permissions';
import { logActivity } from '@/lib/activity-logger';
import { revalidatePath } from 'next/cache';
import type { PipelineTarget } from '@/lib/types';

export interface SavePipelineTargetInput {
  workspaceId: string;
  pipelineId?: string | null;
  period: string; // e.g. '2026-08', '2026-Q3', '2026'
  targetAmount: number;
  currency?: string;
}

/**
 * Upserts a monthly or quarterly revenue target for a pipeline or workspace.
 */
export async function savePipelineTargetAction(
  input: SavePipelineTargetInput,
  userId: string
): Promise<{ success: boolean; target?: PipelineTarget; error?: string }> {
  try {
    if (!input.workspaceId || !input.period || !userId) {
      return { success: false, error: 'Missing required parameters (workspaceId, period, userId).' };
    }

    if (typeof input.targetAmount !== 'number' || !Number.isFinite(input.targetAmount) || input.targetAmount < 0) {
      return { success: false, error: 'Target amount must be a valid positive number.' };
    }

    // RBAC Authorization check
    const permission = await canUser(userId, 'operations', 'pipeline', 'edit', input.workspaceId);
    if (!permission.granted) {
      return { success: false, error: permission.reason || 'Permission denied to modify pipeline targets.' };
    }

    if (!adminDb) {
      return { success: false, error: 'Firebase Admin Database is not initialized.' };
    }

    const cleanPeriod = input.period.trim();
    const cleanPipelineId = input.pipelineId || null;
    const currency = input.currency || 'GHS';
    const now = new Date().toISOString();

    // Check if target already exists for this workspace, pipeline, and period
    const targetsRef = adminDb.collection('pipeline_targets');
    let q = targetsRef
      .where('workspaceId', '==', input.workspaceId)
      .where('period', '==', cleanPeriod);

    if (cleanPipelineId) {
      q = q.where('pipelineId', '==', cleanPipelineId);
    } else {
      q = q.where('pipelineId', '==', null);
    }

    const snapshot = await q.limit(1).get();

    let targetId: string;
    let targetPayload: PipelineTarget;

    if (!snapshot.empty) {
      const existingDoc = snapshot.docs[0];
      targetId = existingDoc.id;
      const prevData = existingDoc.data() as PipelineTarget;

      targetPayload = {
        ...prevData,
        targetAmount: input.targetAmount,
        currency,
        updatedAt: now,
      };

      await targetsRef.doc(targetId).update({
        targetAmount: input.targetAmount,
        currency,
        updatedAt: now,
      });

      // Audit Log
      await logActivity({
        userId,
        workspaceId: input.workspaceId,
        organizationId: input.workspaceId,
        source: 'pipeline_analytics',
        type: 'deal_updated',
        entityId: targetId,
        entityName: `Revenue Target (${cleanPeriod})`,
        description: `Updated revenue quota for period ${cleanPeriod} to ${currency} ${input.targetAmount.toLocaleString()}`,
        metadata: {
          period: cleanPeriod,
          pipelineId: cleanPipelineId,
          targetAmount: input.targetAmount,
          currency,
          previousTarget: prevData.targetAmount,
        },
      });
    } else {
      const newDocRef = targetsRef.doc();
      targetId = newDocRef.id;

      targetPayload = {
        id: targetId,
        workspaceId: input.workspaceId,
        pipelineId: cleanPipelineId,
        period: cleanPeriod,
        targetAmount: input.targetAmount,
        currency,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      };

      await newDocRef.set(targetPayload);

      // Audit Log
      await logActivity({
        userId,
        workspaceId: input.workspaceId,
        organizationId: input.workspaceId,
        source: 'pipeline_analytics',
        type: 'deal_created',
        entityId: targetId,
        entityName: `Revenue Target (${cleanPeriod})`,
        description: `Created revenue quota for period ${cleanPeriod} of ${currency} ${input.targetAmount.toLocaleString()}`,
        metadata: {
          period: cleanPeriod,
          pipelineId: cleanPipelineId,
          targetAmount: input.targetAmount,
          currency,
        },
      });
    }

    revalidatePath('/admin/pipeline');
    return { success: true, target: targetPayload };
  } catch (error: unknown) {
    console.error('Error saving pipeline target:', error);
    const msg = error instanceof Error ? error.message : 'Failed to save revenue target.';
    return { success: false, error: msg };
  }
}

/**
 * Retrieves all revenue targets for a workspace and optionally filtered by pipeline.
 */
export async function getPipelineTargetsAction(
  workspaceId: string,
  pipelineId?: string | null
): Promise<{ success: boolean; targets?: PipelineTarget[]; error?: string }> {
  try {
    if (!workspaceId) {
      return { success: false, error: 'workspaceId is required.' };
    }

    if (!adminDb) {
      return { success: false, error: 'Firebase Admin Database is not initialized.' };
    }

    const targetsRef = adminDb.collection('pipeline_targets');
    let q = targetsRef.where('workspaceId', '==', workspaceId);

    if (pipelineId) {
      q = q.where('pipelineId', 'in', [pipelineId, null]);
    }

    const snapshot = await q.get();
    const targets: PipelineTarget[] = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        workspaceId: data.workspaceId,
        pipelineId: data.pipelineId || null,
        period: data.period || '',
        targetAmount: typeof data.targetAmount === 'number' ? data.targetAmount : 0,
        currency: data.currency || 'GHS',
        createdBy: data.createdBy || '',
        createdAt: data.createdAt || '',
        updatedAt: data.updatedAt || '',
      };
    });

    return { success: true, targets };
  } catch (error: unknown) {
    console.error('Error fetching pipeline targets:', error);
    const msg = error instanceof Error ? error.message : 'Failed to fetch pipeline targets.';
    return { success: false, error: msg };
  }
}

/**
 * Deletes a revenue target by ID.
 */
export async function deletePipelineTargetAction(
  targetId: string,
  workspaceId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!targetId || !workspaceId || !userId) {
      return { success: false, error: 'targetId, workspaceId, and userId are required.' };
    }

    const permission = await canUser(userId, 'operations', 'pipeline', 'edit', workspaceId);
    if (!permission.granted) {
      return { success: false, error: permission.reason || 'Permission denied.' };
    }

    if (!adminDb) {
      return { success: false, error: 'Firebase Admin Database is not initialized.' };
    }

    await adminDb.collection('pipeline_targets').doc(targetId).delete();

    await logActivity({
      userId,
      workspaceId,
      organizationId: workspaceId,
      source: 'pipeline_analytics',
      type: 'deal_deleted',
      entityId: targetId,
      entityName: 'Revenue Target',
      description: 'Deleted revenue target quota',
    });

    revalidatePath('/admin/pipeline');
    return { success: true };
  } catch (error: unknown) {
    console.error('Error deleting pipeline target:', error);
    const msg = error instanceof Error ? error.message : 'Failed to delete revenue target.';
    return { success: false, error: msg };
  }
}
