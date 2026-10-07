/**
 * @fileOverview Canonical Cross-Workspace Deal Transfer & Cloning Engine
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10 & Rule 69):
 * 1. Master Layering Axiom (Rule 69):
 *    - All deal transfers and duplications across workspaces, pipelines, and stages
 *      must route exclusively through `transferDealCore`.
 *    - Used by:
 *      a) Interactive UI: `transferDealAction` (Kanban / List Views via `TransferDealModal`)
 *      b) Automations Engine: `handleTransferDeal` (`TRANSFER_DEAL` workflow step)
 *      c) Governed Agents & MCP: `dealTransferCapability` / `dealTransferTool`
 * 2. Multi-Tenant Sovereignty & Trust Boundaries (Rule 4, 8 & 13):
 *    - Validates inputs at the boundary using `TransferDealInputSchema`.
 *    - Cross-workspace transfers MUST remain within the same organization (`targetOrg === sourceOrg`).
 *    - Verifies permissions via `canUser` for human users, or tenant boundary scoping for service/agent actors.
 * 3. Scoped Assignee Invariant:
 *    - If an assignee is designated, verifies they are confirmed members of `targetWorkspaceId`
 *      (`users` collection `workspaceIds` array-contains `targetWorkspaceId`).
 * 4. Cross-Workspace Entity Projection:
 *    - If `targetWorkspaceId !== sourceDeal.workspaceId`, ensures a `workspace_entities` record
 *      is projected for `sourceDeal.entityId` in the target workspace.
 * 5. TOCTOU & Idempotency Protection (Rule 18, 19 & 20):
 *    - Supports `expectedUpdatedAt` for optimistic concurrency checking.
 *    - Supports `idempotencyKey` via `deal_transfers_idempotency` collection.
 * 6. Dual Event Backbone & OpenTelemetry (Rule 39 & 40):
 *    - Emits legacy domain events via `emitDealDomainEvent`.
 *    - Emits typed platform domain events via `defaultEventBus` and `createDomainEvent`.
 *
 * @testability Covered in `src/app/actions/__tests__/deal-actions.transfer.test.ts`
 * and `src/lib/__tests__/automation-transfer-deal.test.ts`.
 */

import { z } from 'zod';
import { nanoid } from 'nanoid';
import { revalidatePath } from 'next/cache';
import { adminDb } from '@/lib/firebase-admin';
import type { Deal, DealLineItem } from '@/lib/types';
import type { TransferDealInput, TransferDealResult } from '@/lib/deals/deal-types';
import {
  type CrmActor,
  actorAttributionUid,
  loadAuthorizedDeal,
  checkDealPlacement,
  resolveWorkspaceEntityRecord,
  workspaceOrganizationId,
} from '@/lib/crm/deal-core';
import { canUser } from '@/lib/workspace-permissions';
import { calculateExpectedCloseDate } from '@/app/admin/pipeline/utils/deal-expected-close';
import { logActivity } from '@/lib/activity-logger';
import { emitDealDomainEvent } from '@/lib/deals/deal-event-bus';
import { defaultEventBus } from '@/platform/events/event-bus';
import { createDomainEvent } from '@/platform/capabilities/events/domain-event';

/**
 * Zod Schema for Deal Transfer & Cloning Input Validation (Rule 4 Boundary Enforcement)
 */
export const TransferDealInputSchema = z.object({
  dealId: z.string().min(1, 'Deal ID is required'),
  mode: z.enum(['move', 'copy']),
  sourceWorkspaceId: z.string().min(1, 'Source workspace ID is required'),
  targetWorkspaceId: z.string().min(1, 'Destination workspace ID is required'),
  targetPipelineId: z.string().min(1, 'Destination pipeline ID is required'),
  targetStageId: z.string().min(1, 'Destination stage ID is required'),
  assignedTo: z
    .object({
      userId: z.string().nullable(),
      name: z.string().nullable(),
      email: z.string().nullable(),
    })
    .nullable()
    .optional(),
  summary: z.string().optional(),
  nextStep: z
    .object({
      title: z.string(),
      type: z.enum(['task', 'meeting', 'call', 'follow_up']),
      dueDate: z.string(),
      assigneeName: z.string().optional(),
      isCompleted: z.boolean().optional(),
    })
    .nullable()
    .optional(),
  newName: z.string().optional(),
  copyLineItems: z.boolean().optional(),
  copyContacts: z.boolean().optional(),
  copyCustomFields: z.boolean().optional(),
  idempotencyKey: z.string().optional(),
  expectedUpdatedAt: z.string().optional(),
});

/**
 * Executes a deal transfer (move) or clone (copy) across workspaces and pipelines.
 */
export async function transferDealCore(
  actor: CrmActor,
  input: TransferDealInput
): Promise<TransferDealResult> {
  const userId = actorAttributionUid(actor);

  try {
    const parsed = TransferDealInputSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid transfer input' };
    }
    const validated = parsed.data;

    // 0. Idempotency Check (Rule 19 & 20)
    if (validated.idempotencyKey) {
      try {
        const idemDocRef = adminDb
          .collection('deal_transfers_idempotency')
          .doc(`${validated.targetWorkspaceId}_${validated.idempotencyKey}`);
        const idemSnap = await idemDocRef.get();
        if (idemSnap.exists) {
          const idemData = idemSnap.data();
          if (idemData?.dealId) {
            return { success: true, dealId: idemData.dealId };
          }
        }
      } catch {
        // Fallback gracefully in testing / offline environments
      }
    }

    // 1. Authorize access to source deal
    const sourceLoaded = await loadAuthorizedDeal(
      actor,
      validated.dealId,
      validated.mode === 'move' ? 'edit' : 'view'
    );
    if (!sourceLoaded.ok) return { success: false, error: sourceLoaded.error };
    const sourceDeal = sourceLoaded.deal;

    // 2. TOCTOU Optimistic Concurrency Check (Rule 18)
    if (validated.expectedUpdatedAt && sourceDeal.updatedAt) {
      if (sourceDeal.updatedAt !== validated.expectedUpdatedAt) {
        return {
          success: false,
          error: 'CONCURRENCY_CONFLICT: Deal was modified by another actor after planning. Please refresh.',
        };
      }
    }

    // 3. Multi-Tenant Sovereignty: Validate Destination Workspace & Organization (Rule 8)
    const targetOrgId = await workspaceOrganizationId(validated.targetWorkspaceId);
    if (sourceDeal.organizationId && targetOrgId && sourceDeal.organizationId !== targetOrgId) {
      return { success: false, error: 'Cross-organization transfers are strictly prohibited.' };
    }

    // 4. Authorize create/edit permissions in destination workspace
    if (actor.kind === 'user') {
      const destPerm = await canUser(actor.uid, 'operations', 'pipeline', 'create', validated.targetWorkspaceId);
      if (!destPerm.granted) {
        return { success: false, error: destPerm.reason || 'Permission denied in target workspace' };
      }
    } else if (actor.kind === 'service') {
      // Service actor must either be allowed in the target workspace or operate cross-workspace
      const isAllowedTarget =
        actor.workspaceId === validated.targetWorkspaceId ||
        (Array.isArray(actor.allowedWorkspaceIds) && actor.allowedWorkspaceIds.includes(validated.targetWorkspaceId));
      if (!isAllowedTarget && sourceDeal.organizationId && targetOrgId && sourceDeal.organizationId !== targetOrgId) {
        return { success: false, error: 'Service actor is not permitted in target workspace.' };
      }
    }

    // 5. Verify target pipeline and stage belong to target workspace
    const placement = await checkDealPlacement(validated.targetWorkspaceId, {
      pipelineId: validated.targetPipelineId,
      stageId: validated.targetStageId,
    });
    if (!placement.granted) return { success: false, error: placement.reason };

    // 6. Scoped Assignee Access Enforcement (Target Workspace)
    let resolvedAssignee: Deal['assignedTo'] = null;
    if (validated.assignedTo !== undefined) {
      if (validated.assignedTo?.userId) {
        const assigneeSnap = await adminDb.collection('users').doc(validated.assignedTo.userId).get();
        if (!assigneeSnap.exists) {
          return { success: false, error: 'Selected assignee not found.' };
        }
        const assigneeData = assigneeSnap.data();
        const assigneeWorkspaces: unknown = assigneeData?.workspaceIds;
        if (!Array.isArray(assigneeWorkspaces) || !assigneeWorkspaces.includes(validated.targetWorkspaceId)) {
          return { success: false, error: 'Selected assignee does not have access to the destination workspace.' };
        }
        resolvedAssignee = {
          userId: validated.assignedTo.userId,
          name: validated.assignedTo.name || assigneeData?.name || 'Assigned User',
          email: validated.assignedTo.email || assigneeData?.email || '',
        };
      } else {
        resolvedAssignee = null;
      }
    } else {
      // Unspecified assignee: preserve existing owner if staying in the same workspace
      if (validated.targetWorkspaceId === sourceDeal.workspaceId) {
        resolvedAssignee = sourceDeal.assignedTo || null;
      } else {
        resolvedAssignee = null;
      }
    }

    // 7. Fetch target stage and pipeline metadata
    let targetStageName = 'Stage';
    let targetStageProbability: number | undefined;
    let targetStageTerminalType: string | undefined;

    try {
      const stageDoc = await adminDb.collection('onboardingStages').doc(validated.targetStageId).get();
      if (stageDoc.exists) {
        const sData = stageDoc.data();
        targetStageName = sData?.name || targetStageName;
        targetStageProbability = typeof sData?.defaultProbability === 'number' ? sData.defaultProbability : undefined;
        targetStageTerminalType = sData?.terminalType;
      }
    } catch {
      // Non-blocking fallback
    }

    // Fetch target pipeline name and calculate close date
    let targetPipelineName = 'Pipeline';
    let expectedCloseDate = sourceDeal.expectedCloseDate;
    try {
      const pipelineDoc = await adminDb.collection('pipelines').doc(validated.targetPipelineId).get();
      if (pipelineDoc.exists) {
        const pData = pipelineDoc.data();
        targetPipelineName = pData?.name || targetPipelineName;
        const calculated = calculateExpectedCloseDate(pData, sourceDeal.expectedCloseDate);
        if (calculated) expectedCloseDate = calculated;
      }
    } catch {
      // Non-blocking fallback
    }

    const now = new Date().toISOString();

    // 8. Ensure Entity Projection in target workspace (Cross-Workspace Entity Invariant)
    if (validated.targetWorkspaceId !== sourceDeal.workspaceId && sourceDeal.entityId) {
      const targetWe = await resolveWorkspaceEntityRecord(validated.targetWorkspaceId, sourceDeal.entityId);
      if (!targetWe) {
        const entitySnap = await adminDb.collection('entities').doc(sourceDeal.entityId).get();
        if (entitySnap.exists) {
          const eData = entitySnap.data();
          const targetWeId = `${validated.targetWorkspaceId}_${sourceDeal.entityId}`;
          await adminDb
            .collection('workspace_entities')
            .doc(targetWeId)
            .set({
              id: targetWeId,
              entityId: sourceDeal.entityId,
              workspaceId: validated.targetWorkspaceId,
              organizationId: sourceDeal.organizationId || targetOrgId || '',
              displayName: eData?.name || sourceDeal.name,
              displayNameLower: (eData?.name || sourceDeal.name).toLowerCase(),
              primaryContactName: eData?.primaryContactName || eData?.name || '',
              primaryEmail: eData?.primaryEmail || '',
              primaryPhone: eData?.primaryPhone || '',
              entityContacts: eData?.entityContacts || [],
              status: 'active',
              createdAt: now,
              updatedAt: now,
            });
        }
      }
    }

    const resolvedProbability =
      targetStageProbability !== undefined ? targetStageProbability : (sourceDeal.probability ?? 20);
    const resolvedValue = Number.isFinite(sourceDeal.value) ? sourceDeal.value : 0;
    const weightedValue = (resolvedValue * resolvedProbability) / 100;
    const resolvedStatus =
      targetStageTerminalType === 'won' ? 'won' : targetStageTerminalType === 'lost' ? 'lost' : 'open';

    const actorSource = actor.kind === 'service' ? actor.service : 'user';

    // 9. Execute based on Mode ('move' vs 'copy')
    if (validated.mode === 'move') {
      // Update stage history: close current stage entry
      const currentHistory = Array.isArray(sourceDeal.stageHistory) ? [...sourceDeal.stageHistory] : [];
      if (currentHistory.length > 0) {
        const lastIdx = currentHistory.length - 1;
        const lastEntry = { ...currentHistory[lastIdx] };
        if (!lastEntry.exitedAt) {
          lastEntry.exitedAt = now;
          const enteredTime = new Date(lastEntry.enteredAt).getTime();
          const nowTime = new Date(now).getTime();
          if (!isNaN(enteredTime) && nowTime >= enteredTime) {
            lastEntry.durationSeconds = Math.round((nowTime - enteredTime) / 1000);
          }
          currentHistory[lastIdx] = lastEntry;
        }
      }

      // Append new stage history entry
      currentHistory.push({
        stageId: validated.targetStageId,
        stageName: targetStageName,
        enteredAt: now,
        exitedAt: null,
        durationSeconds: null,
        changedByUserId: userId || 'system',
        notes: validated.summary
          ? `Transferred to ${targetPipelineName} (${targetStageName}): ${validated.summary}`
          : `Transferred from pipeline ${sourceDeal.pipelineId} to ${targetPipelineName}`,
      });

      const updatedDealData: Partial<Deal> = {
        workspaceId: validated.targetWorkspaceId,
        pipelineId: validated.targetPipelineId,
        stageId: validated.targetStageId,
        stageName: targetStageName,
        stageEnteredAt: now,
        stageHistory: currentHistory,
        probability: resolvedProbability,
        weightedValue,
        status: resolvedStatus,
        assignedTo: resolvedAssignee,
        expectedCloseDate: expectedCloseDate || null,
        description: validated.summary?.trim() || sourceDeal.description || null,
        updatedAt: now,
      };

      if (validated.nextStep) {
        updatedDealData.nextStep = validated.nextStep;
      }

      await sourceLoaded.ref.update(updatedDealData);

      // Audit activity log
      await logActivity({
        organizationId: sourceDeal.organizationId || targetOrgId || '',
        entityId: sourceDeal.entityId || null,
        dealId: sourceDeal.id,
        userId: userId || null,
        workspaceId: validated.targetWorkspaceId,
        type: 'deal_transferred',
        source: actorSource,
        description: `Transferred deal "${sourceDeal.name}" to pipeline "${targetPipelineName}" (Stage: ${targetStageName})`,
        metadata: {
          dealId: sourceDeal.id,
          sourceWorkspaceId: sourceDeal.workspaceId,
          targetWorkspaceId: validated.targetWorkspaceId,
          sourcePipelineId: sourceDeal.pipelineId,
          targetPipelineId: validated.targetPipelineId,
          targetStageId: validated.targetStageId,
          actorKind: actor.kind,
        },
      });

      // Legacy deal domain event
      await emitDealDomainEvent('deal.moved', {
        dealId: sourceDeal.id,
        dealName: sourceDeal.name,
        workspaceId: validated.targetWorkspaceId,
        organizationId: sourceDeal.organizationId || targetOrgId || '',
        pipelineId: validated.targetPipelineId,
        stageId: validated.targetStageId,
        previousStageId: sourceDeal.stageId,
        actorUserId: userId || 'system',
        metadata: {
          fromPipelineId: sourceDeal.pipelineId,
          toPipelineId: validated.targetPipelineId,
          actorKind: actor.kind,
        },
      });

      // Platform typed domain event (Rule 39 & 40)
      try {
        const platformEvent = createDomainEvent({
          type: 'crm.deal.moved',
          source: `crm:${actorSource}:deal_transfer`,
          correlationId: validated.idempotencyKey || `trans_${sourceDeal.id}_${Date.now()}`,
          actor: {
            type: actor.kind === 'user' ? 'user' : actor.kind === 'service' && actor.service === 'automations' ? 'automation' : 'api',
            id: userId || 'system',
            agentVersion: actor.kind === 'service' ? actor.agentVersion : undefined,
          },
          entity: {
            type: 'deal',
            id: sourceDeal.id,
          },
          workspaceId: validated.targetWorkspaceId,
          organizationId: sourceDeal.organizationId || targetOrgId || '',
          idempotencyKey: validated.idempotencyKey,
          payload: {
            dealId: sourceDeal.id,
            mode: 'move',
            sourceWorkspaceId: sourceDeal.workspaceId,
            targetWorkspaceId: validated.targetWorkspaceId,
            pipelineId: validated.targetPipelineId,
            stageId: validated.targetStageId,
            stageName: targetStageName,
          },
        });
        await defaultEventBus.publish(platformEvent);
      } catch {
        // Non-blocking event bus dispatch
      }

      // Record Idempotency Result
      if (validated.idempotencyKey) {
        try {
          await adminDb
            .collection('deal_transfers_idempotency')
            .doc(`${validated.targetWorkspaceId}_${validated.idempotencyKey}`)
            .set({
              dealId: sourceDeal.id,
              targetWorkspaceId: validated.targetWorkspaceId,
              idempotencyKey: validated.idempotencyKey,
              createdAt: now,
              actorKind: actor.kind,
            });
        } catch {
          // Non-blocking
        }
      }

      try {
        revalidatePath('/admin/pipeline');
        revalidatePath(`/admin/deals/${sourceDeal.id}`);
      } catch {
        // Context may be non-HTTP
      }

      return { success: true, dealId: sourceDeal.id };
    } else {
      // COPY (Duplicate) MODE
      const clonedLineItems: DealLineItem[] =
        validated.copyLineItems !== false && Array.isArray(sourceDeal.lineItems)
          ? sourceDeal.lineItems.map((item) => ({ ...item, id: nanoid() }))
          : [];

      const clonedDealData: Omit<Deal, 'id'> = {
        organizationId: sourceDeal.organizationId || targetOrgId || '',
        workspaceId: validated.targetWorkspaceId,
        entityId: sourceDeal.entityId,
        pipelineId: validated.targetPipelineId,
        stageId: validated.targetStageId,
        stageName: targetStageName,
        name: validated.newName?.trim() || `${sourceDeal.name} (Copy)`,
        value: resolvedValue,
        currency: sourceDeal.currency || 'USD',
        status: resolvedStatus,
        probability: resolvedProbability,
        forecastCategory: sourceDeal.forecastCategory || 'pipeline',
        weightedValue,
        healthStatus: 'healthy',
        stageEnteredAt: now,
        stageHistory: [
          {
            stageId: validated.targetStageId,
            stageName: targetStageName,
            enteredAt: now,
            exitedAt: null,
            durationSeconds: null,
            changedByUserId: userId || 'system',
            notes: validated.summary
              ? `Deal cloned from "${sourceDeal.name}": ${validated.summary}`
              : `Deal cloned from "${sourceDeal.name}"`,
          },
        ],
        lineItems: clonedLineItems,
        mrr: validated.copyLineItems !== false ? sourceDeal.mrr || 0 : 0,
        arr: validated.copyLineItems !== false ? sourceDeal.arr || 0 : 0,
        acv: validated.copyLineItems !== false ? sourceDeal.acv || 0 : 0,
        tcv: validated.copyLineItems !== false ? sourceDeal.tcv || 0 : 0,
        oneTimeValue: validated.copyLineItems !== false ? sourceDeal.oneTimeValue || 0 : 0,
        recurringValue: validated.copyLineItems !== false ? sourceDeal.recurringValue || 0 : 0,
        contractTermMonths: sourceDeal.contractTermMonths || 12,
        priceBookId: sourceDeal.priceBookId || null,
        contractStatus: 'none',
        contacts: validated.copyContacts !== false ? sourceDeal.contacts || [] : [],
        focalContacts: validated.copyContacts !== false ? sourceDeal.focalContacts || [] : [],
        assignedTo: resolvedAssignee,
        expectedCloseDate: expectedCloseDate || null,
        description: validated.summary?.trim() || sourceDeal.description || null,
        nextStep: validated.nextStep || null,
        source: 'manual',
        customFields: validated.copyCustomFields !== false ? sourceDeal.customFields || {} : {},
        tags: sourceDeal.tags || [],
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      };

      const newDocRef = await adminDb.collection('deals').add(clonedDealData);

      await logActivity({
        organizationId: sourceDeal.organizationId || targetOrgId || '',
        entityId: sourceDeal.entityId || null,
        dealId: newDocRef.id,
        userId: userId || null,
        workspaceId: validated.targetWorkspaceId,
        type: 'deal_created',
        source: actorSource,
        description: `Cloned deal "${sourceDeal.name}" into pipeline "${targetPipelineName}" as "${clonedDealData.name}"`,
        metadata: {
          originalDealId: sourceDeal.id,
          newDealId: newDocRef.id,
          targetWorkspaceId: validated.targetWorkspaceId,
          actorKind: actor.kind,
        },
      });

      await emitDealDomainEvent('deal.created', {
        dealId: newDocRef.id,
        dealName: clonedDealData.name,
        workspaceId: validated.targetWorkspaceId,
        organizationId: sourceDeal.organizationId || targetOrgId || '',
        pipelineId: validated.targetPipelineId,
        stageId: validated.targetStageId,
        value: clonedDealData.value,
        actorUserId: userId || 'system',
      });

      // Platform typed domain event (Rule 39 & 40)
      try {
        const platformEvent = createDomainEvent({
          type: 'crm.deal.created',
          source: `crm:${actorSource}:deal_transfer`,
          correlationId: validated.idempotencyKey || `clone_${newDocRef.id}_${Date.now()}`,
          actor: {
            type: actor.kind === 'user' ? 'user' : actor.kind === 'service' && actor.service === 'automations' ? 'automation' : 'api',
            id: userId || 'system',
            agentVersion: actor.kind === 'service' ? actor.agentVersion : undefined,
          },
          entity: {
            type: 'deal',
            id: newDocRef.id,
          },
          workspaceId: validated.targetWorkspaceId,
          organizationId: sourceDeal.organizationId || targetOrgId || '',
          idempotencyKey: validated.idempotencyKey,
          payload: {
            dealId: newDocRef.id,
            originalDealId: sourceDeal.id,
            mode: 'copy',
            name: clonedDealData.name,
            targetWorkspaceId: validated.targetWorkspaceId,
            pipelineId: validated.targetPipelineId,
            stageId: validated.targetStageId,
            value: clonedDealData.value,
          },
        });
        await defaultEventBus.publish(platformEvent);
      } catch {
        // Non-blocking
      }

      // Record Idempotency Result
      if (validated.idempotencyKey) {
        try {
          await adminDb
            .collection('deal_transfers_idempotency')
            .doc(`${validated.targetWorkspaceId}_${validated.idempotencyKey}`)
            .set({
              dealId: newDocRef.id,
              targetWorkspaceId: validated.targetWorkspaceId,
              idempotencyKey: validated.idempotencyKey,
              createdAt: now,
              actorKind: actor.kind,
            });
        } catch {
          // Non-blocking
        }
      }

      try {
        revalidatePath('/admin/pipeline');
      } catch {
        // Non-blocking outside HTTP context
      }

      return { success: true, dealId: newDocRef.id };
    }
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : 'Failed to transfer deal';
    console.error('❌ [transferDealCore] Failed to transfer deal:', error);
    return { success: false, error };
  }
}
