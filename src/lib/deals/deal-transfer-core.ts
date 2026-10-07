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
import type {
  Deal,
  DealLineItem,
  Entity,
  EntityContact,
  EntityScopeConversionPolicy,
  EntityScopeConversionStrategy,
} from '@/lib/types';
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
  entityConversionStrategy: z
    .enum([
      'auto',
      'promote_primary_focal_contact',
      'promote_first_contact',
      'derive_from_company_field',
      'promote_primary_as_guardian',
      'require_human_approval',
    ])
    .optional(),
  focalContactId: z.string().optional(),
  dryRun: z.boolean().optional(),
  approvalId: z.string().optional(),
});

interface PolymorphicConversionInternalResult {
  ok: boolean;
  requiresProposal?: boolean;
  approvalId?: string;
  targetEntityId: string;
  sourceScope: string;
  targetScope: string;
  strategyUsed: EntityScopeConversionStrategy;
  wasCreated: boolean;
  promotedContactId?: string;
  auditEvidence: string;
  createdEntityDocId?: string;
  createdWeDocId?: string;
  error?: string;
}

/**
 * Resolves polymorphic entity scope adaptation across workspaces.
 * Aligned with Rule 4 (Strict Typing), Rule 21 & 22 (Two-Phase Action Model),
 * Rule 27 (Saga / Compensation), Rule 41 (Audit Trace), and Rule 61 (Backoffice Control Plane).
 */
async function resolvePolymorphicEntityConversion(params: {
  sourceDeal: Deal;
  targetWorkspaceId: string;
  targetPipelineId: string;
  organizationId: string;
  strategyOverride?: EntityScopeConversionStrategy;
  focalContactId?: string;
  dryRun?: boolean;
  approvalId?: string;
  pipelinePolicy?: EntityScopeConversionPolicy;
}): Promise<PolymorphicConversionInternalResult> {
  const {
    sourceDeal,
    targetWorkspaceId,
    organizationId,
    strategyOverride,
    focalContactId,
    dryRun,
    approvalId,
    pipelinePolicy,
  } = params;

  const now = new Date().toISOString();

  // 1. Resolve Target Workspace Contact Scope
  let targetScope = 'institution';
  try {
    const wsSnap = await adminDb.collection('workspaces').doc(targetWorkspaceId).get();
    if (wsSnap.exists) {
      targetScope = (wsSnap.data()?.contactScope as string) || 'institution';
    }
  } catch {
    // Fail-safe default
  }

  // 2. Fetch Source Entity
  let sourceEntity: Entity | undefined;
  let sourceScope = 'institution';
  if (sourceDeal.entityId) {
    try {
      const entitySnap = await adminDb.collection('entities').doc(sourceDeal.entityId).get();
      if (entitySnap.exists) {
        sourceEntity = entitySnap.data() as Entity;
        sourceScope = sourceEntity.entityType || 'institution';
      }
    } catch {
      // Fallback
    }
  }

  // 3. Evaluate Scope Compatibility
  const isCompatible = sourceScope === targetScope || targetScope === 'mixed';

  if (isCompatible) {
    // Same scope or mixed: direct projection
    const targetWeId = `${targetWorkspaceId}_${sourceDeal.entityId}`;
    if (!dryRun) {
      try {
        const existingWe = await resolveWorkspaceEntityRecord(targetWorkspaceId, sourceDeal.entityId);
        if (!existingWe && sourceEntity) {
          const primaryContact = sourceEntity.entityContacts?.find((c) => c.isPrimary) || sourceEntity.entityContacts?.[0];
          await adminDb.collection('workspace_entities').doc(targetWeId).set({
            id: targetWeId,
            entityId: sourceDeal.entityId,
            workspaceId: targetWorkspaceId,
            organizationId,
            entityType: sourceScope,
            displayName: sourceEntity.name || sourceDeal.name,
            displayNameLower: (sourceEntity.name || sourceDeal.name).toLowerCase(),
            primaryContactName: primaryContact?.name || sourceEntity.name || '',
            primaryEmail: primaryContact?.email || '',
            primaryPhone: primaryContact?.phone || '',
            entityContacts: sourceEntity.entityContacts || [],
            workspaceTags: [],
            status: 'active',
            addedAt: now,
            updatedAt: now,
          });
        }
      } catch {
        // Fallback
      }
    }

    return {
      ok: true,
      targetEntityId: sourceDeal.entityId,
      sourceScope,
      targetScope,
      strategyUsed: 'auto',
      wasCreated: false,
      auditEvidence: `Entity scope "${sourceScope}" is directly compatible with target workspace scope "${targetScope}". Global entity projection linked.`,
    };
  }

  // 4. Scope Mismatch: Determine Conversion Strategy (Rule 61)
  let effectiveStrategy: EntityScopeConversionStrategy = strategyOverride || 'auto';
  if (effectiveStrategy === 'auto' && pipelinePolicy) {
    if (sourceScope === 'institution' && targetScope === 'person') {
      effectiveStrategy = pipelinePolicy.institutionToPersonStrategy || 'promote_primary_focal_contact';
    } else if (sourceScope === 'person' && targetScope === 'institution') {
      effectiveStrategy = pipelinePolicy.personToInstitutionStrategy || 'derive_from_company_field';
    } else if (targetScope === 'family') {
      effectiveStrategy = pipelinePolicy.toFamilyStrategy || 'promote_primary_as_guardian';
    }
  }
  if (effectiveStrategy === 'auto') {
    if (sourceScope === 'institution' && targetScope === 'person') {
      effectiveStrategy = 'promote_primary_focal_contact';
    } else if (sourceScope === 'person' && targetScope === 'institution') {
      effectiveStrategy = 'derive_from_company_field';
    } else if (targetScope === 'family') {
      effectiveStrategy = 'promote_primary_as_guardian';
    }
  }

  // Two-Phase Approval Requirement Check (Rule 21 & 22)
  const mandatesApproval =
    pipelinePolicy?.requireApprovalForCrossScope === true ||
    effectiveStrategy === 'require_human_approval';

  if ((mandatesApproval && !approvalId) || dryRun) {
    const generatedProposalId = approvalId || nanoid();
    return {
      ok: true,
      requiresProposal: true,
      approvalId: generatedProposalId,
      targetEntityId: sourceDeal.entityId,
      sourceScope,
      targetScope,
      strategyUsed: effectiveStrategy,
      wasCreated: false,
      auditEvidence: `Scope mismatch (${sourceScope} -> ${targetScope}) requires Two-Phase human review per pipeline configuration. Proposal generated for sign-off.`,
    };
  }

  // 5. Execute Polymorphic Conversion Strategy
  if (sourceScope === 'institution' && targetScope === 'person') {
    // Find focal contact to promote
    let chosenContact: EntityContact | undefined;
    if (Array.isArray(sourceDeal.focalContacts) && sourceDeal.focalContacts.length > 0) {
      const match = focalContactId
        ? sourceDeal.focalContacts.find((c) => c.id === focalContactId)
        : (sourceDeal.focalContacts.find((c) => c.isPrimary) || sourceDeal.focalContacts[0]);
      if (match) {
        chosenContact = {
          id: match.id,
          name: match.name,
          email: match.email || '',
          phone: match.phone || '',
          typeKey: 'primary',
          typeLabel: match.role || 'Focal Contact',
          isPrimary: true,
          isSignatory: false,
          order: 0,
        };
      }
    }

    if (!chosenContact && Array.isArray(sourceEntity?.entityContacts) && sourceEntity.entityContacts.length > 0) {
      chosenContact =
        sourceEntity.entityContacts.find((c) => (focalContactId ? c.id === focalContactId : c.isPrimary)) ||
        (effectiveStrategy === 'promote_first_contact'
          ? sourceEntity.entityContacts[0]
          : sourceEntity.entityContacts.find((c) => c.isPrimary) || sourceEntity.entityContacts[0]);
    }

    const contactName = chosenContact?.name || sourceDeal.name;
    const contactEmail = chosenContact?.email || '';
    const contactPhone = chosenContact?.phone || '';
    const contactRole = chosenContact?.typeLabel || 'Focal Contact';

    // Check if an existing person entity matches this email in the organization
    if (contactEmail) {
      try {
        const existingPersonSnap = await adminDb
          .collection('workspace_entities')
          .where('organizationId', '==', organizationId)
          .where('entityType', '==', 'person')
          .where('primaryEmail', '==', contactEmail)
          .limit(1)
          .get();

        if (!existingPersonSnap.empty) {
          const matchedDoc = existingPersonSnap.docs[0];
          const matchedPersonId = (matchedDoc.data().entityId as string) || matchedDoc.id;
          const targetWeId = `${targetWorkspaceId}_${matchedPersonId}`;
          await adminDb.collection('workspace_entities').doc(targetWeId).set(
            {
              id: targetWeId,
              entityId: matchedPersonId,
              workspaceId: targetWorkspaceId,
              organizationId,
              entityType: 'person',
              displayName: contactName,
              displayNameLower: contactName.toLowerCase(),
              primaryContactName: contactName,
              primaryEmail: contactEmail,
              primaryPhone: contactPhone,
              entityContacts: chosenContact ? [chosenContact] : [],
              workspaceTags: [],
              status: 'active',
              addedAt: now,
              updatedAt: now,
            },
            { merge: true }
          );

          return {
            ok: true,
            targetEntityId: matchedPersonId,
            sourceScope,
            targetScope,
            strategyUsed: effectiveStrategy,
            wasCreated: false,
            promotedContactId: chosenContact?.id,
            auditEvidence: `Promoted focal contact "${contactName}" matched existing Person entity "${matchedPersonId}". Linked directly.`,
          };
        }
      } catch {
        // Fallback to creation
      }
    }

    // Create new Person Entity
    const newPersonId = nanoid();
    const targetWeId = `${targetWorkspaceId}_${newPersonId}`;
    const nameParts = contactName.trim().split(/\s+/);
    const firstName = nameParts[0] || contactName;
    const lastName = nameParts.slice(1).join(' ') || '';

    await adminDb.collection('entities').doc(newPersonId).set({
      id: newPersonId,
      organizationId,
      entityType: 'person',
      name: contactName,
      personData: {
        firstName,
        lastName,
        jobTitle: contactRole,
        company: sourceEntity?.name || '',
      },
      entityContacts: chosenContact ? [chosenContact] : [],
      globalTags: sourceEntity?.globalTags || [],
      relatedEntityIds: [sourceDeal.entityId], // Bi-directional provenance (Rule 41)
      workspaceIds: [targetWorkspaceId],
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });

    await adminDb.collection('workspace_entities').doc(targetWeId).set({
      id: targetWeId,
      entityId: newPersonId,
      workspaceId: targetWorkspaceId,
      organizationId,
      entityType: 'person',
      displayName: contactName,
      displayNameLower: contactName.toLowerCase(),
      primaryContactName: contactName,
      primaryEmail: contactEmail,
      primaryPhone: contactPhone,
      entityContacts: chosenContact ? [chosenContact] : [],
      workspaceTags: [],
      status: 'active',
      addedAt: now,
      updatedAt: now,
    });

    return {
      ok: true,
      targetEntityId: newPersonId,
      sourceScope,
      targetScope,
      strategyUsed: effectiveStrategy,
      wasCreated: true,
      promotedContactId: chosenContact?.id,
      createdEntityDocId: newPersonId,
      createdWeDocId: targetWeId,
      auditEvidence: `Promoted focal contact "${contactName}" (${contactRole}) from Institution "${sourceEntity?.name || sourceDeal.name}" into new Person entity "${newPersonId}".`,
    };
  } else if (sourceScope === 'person' && targetScope === 'institution') {
    const primaryContact = sourceEntity?.entityContacts?.find((c) => c.isPrimary) || sourceEntity?.entityContacts?.[0];
    const companyName = sourceEntity?.personData?.company || `${sourceDeal.name} (Organization)`;
    const newInstitutionId = nanoid();
    const targetWeId = `${targetWorkspaceId}_${newInstitutionId}`;

    await adminDb.collection('entities').doc(newInstitutionId).set({
      id: newInstitutionId,
      organizationId,
      entityType: 'institution',
      name: companyName,
      entityContacts: [
        {
          id: nanoid(),
          name: sourceEntity?.name || sourceDeal.name,
          email: primaryContact?.email || '',
          phone: primaryContact?.phone || '',
          typeKey: 'primary',
          typeLabel: sourceEntity?.personData?.jobTitle || 'Primary Contact',
          isPrimary: true,
          isSignatory: true,
          order: 0,
        },
      ],
      globalTags: sourceEntity?.globalTags || [],
      relatedEntityIds: [sourceDeal.entityId],
      workspaceIds: [targetWorkspaceId],
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });

    await adminDb.collection('workspace_entities').doc(targetWeId).set({
      id: targetWeId,
      entityId: newInstitutionId,
      workspaceId: targetWorkspaceId,
      organizationId,
      entityType: 'institution',
      displayName: companyName,
      displayNameLower: companyName.toLowerCase(),
      primaryContactName: sourceEntity?.name || sourceDeal.name,
      primaryEmail: primaryContact?.email || '',
      primaryPhone: primaryContact?.phone || '',
      entityContacts: [],
      workspaceTags: [],
      status: 'active',
      addedAt: now,
      updatedAt: now,
    });

    return {
      ok: true,
      targetEntityId: newInstitutionId,
      sourceScope,
      targetScope,
      strategyUsed: effectiveStrategy,
      wasCreated: true,
      createdEntityDocId: newInstitutionId,
      createdWeDocId: targetWeId,
      auditEvidence: `Derived Institution entity "${companyName}" from Person "${sourceEntity?.name || sourceDeal.name}". Linked person as primary stakeholder.`,
    };
  } else if (targetScope === 'family') {
    const primaryContact = sourceEntity?.entityContacts?.find((c) => c.isPrimary) || sourceEntity?.entityContacts?.[0];
    const familyName = `${sourceDeal.name} Family`;
    const newFamilyId = nanoid();
    const targetWeId = `${targetWorkspaceId}_${newFamilyId}`;

    await adminDb.collection('entities').doc(newFamilyId).set({
      id: newFamilyId,
      organizationId,
      entityType: 'family',
      name: familyName,
      familyData: {
        familyName,
        primaryGuardianName: sourceEntity?.name || sourceDeal.name,
        primaryGuardianPhone: primaryContact?.phone || '',
        primaryGuardianEmail: primaryContact?.email || '',
      },
      entityContacts: [],
      globalTags: sourceEntity?.globalTags || [],
      relatedEntityIds: [sourceDeal.entityId],
      workspaceIds: [targetWorkspaceId],
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });

    await adminDb.collection('workspace_entities').doc(targetWeId).set({
      id: targetWeId,
      entityId: newFamilyId,
      workspaceId: targetWorkspaceId,
      organizationId,
      entityType: 'family',
      displayName: familyName,
      displayNameLower: familyName.toLowerCase(),
      primaryContactName: sourceEntity?.name || sourceDeal.name,
      primaryEmail: primaryContact?.email || '',
      primaryPhone: primaryContact?.phone || '',
      entityContacts: [],
      workspaceTags: [],
      status: 'active',
      addedAt: now,
      updatedAt: now,
    });

    return {
      ok: true,
      targetEntityId: newFamilyId,
      sourceScope,
      targetScope,
      strategyUsed: effectiveStrategy,
      wasCreated: true,
      createdEntityDocId: newFamilyId,
      createdWeDocId: targetWeId,
      auditEvidence: `Converted entity "${sourceDeal.name}" into Family entity "${familyName}".`,
    };
  }

  // Fallback direct link
  return {
    ok: true,
    targetEntityId: sourceDeal.entityId,
    sourceScope,
    targetScope,
    strategyUsed: 'auto',
    wasCreated: false,
    auditEvidence: `Scope conversion defaulted to direct projection.`,
  };
}

/**
 * Executes a deal transfer (move) or clone (copy) across workspaces and pipelines.
 */
export async function transferDealCore(
  actor: CrmActor,
  input: TransferDealInput
): Promise<TransferDealResult> {
  const userId = actorAttributionUid(actor);
  let activeConversion: PolymorphicConversionInternalResult | null = null;

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
    let targetPipelinePolicy: EntityScopeConversionPolicy | undefined;
    try {
      const pipelineDoc = await adminDb.collection('pipelines').doc(validated.targetPipelineId).get();
      if (pipelineDoc.exists) {
        const pData = pipelineDoc.data();
        targetPipelineName = pData?.name || targetPipelineName;
        targetPipelinePolicy = pData?.entityScopeConversionPolicy as EntityScopeConversionPolicy | undefined;
        const calculated = calculateExpectedCloseDate(pData, sourceDeal.expectedCloseDate);
        if (calculated) expectedCloseDate = calculated;
      }
    } catch {
      // Non-blocking fallback
    }

    const now = new Date().toISOString();

    // 7.1 Dead-Man Controls (Rule 60): Enforce disableAutonomousTransfers for non-human service/agent actors
    if (targetPipelinePolicy?.disableAutonomousTransfers && actor.kind === 'service' && !validated.dryRun) {
      return {
        success: false,
        error: 'Autonomous cross-workspace deal transfers are disabled for destination pipeline per Backoffice governance policy (Rule 60).',
      };
    }

    // 8. Polymorphic Entity Scope Conversion & Projection (Rule 69, Rule 61 & ScopeGuard)
    const conversion = await resolvePolymorphicEntityConversion({
      sourceDeal,
      targetWorkspaceId: validated.targetWorkspaceId,
      targetPipelineId: validated.targetPipelineId,
      organizationId: sourceDeal.organizationId || targetOrgId || '',
      strategyOverride: validated.entityConversionStrategy,
      focalContactId: validated.focalContactId,
      dryRun: validated.dryRun,
      approvalId: validated.approvalId,
      pipelinePolicy: targetPipelinePolicy,
    });

    if (!conversion.ok) {
      return { success: false, error: conversion.error || 'Failed to resolve entity scope conversion' };
    }

    activeConversion = conversion;

    // Two-Phase Proposal or Dry-Run Interception (Rule 21, 22, 42)
    if (conversion.requiresProposal || validated.dryRun) {
      if (conversion.approvalId) {
        try {
          await adminDb.collection('deal_transfer_proposals').doc(conversion.approvalId).set({
            approvalId: conversion.approvalId,
            dealId: sourceDeal.id,
            mode: validated.mode,
            sourceWorkspaceId: sourceDeal.workspaceId,
            targetWorkspaceId: validated.targetWorkspaceId,
            targetPipelineId: validated.targetPipelineId,
            targetStageId: validated.targetStageId,
            entityResolution: {
              sourceEntityId: sourceDeal.entityId,
              targetEntityId: conversion.targetEntityId,
              sourceScope: conversion.sourceScope,
              targetScope: conversion.targetScope,
              strategyUsed: conversion.strategyUsed,
              wasCreated: false,
              promotedContactId: conversion.promotedContactId,
              auditEvidence: conversion.auditEvidence,
            },
            actorKind: actor.kind,
            actorId: userId || 'system',
            createdAt: now,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          });
        } catch {
          // Non-blocking in testing
        }
      }

      // Emit proposal domain event (Rule 39)
      try {
        await emitDealDomainEvent('deal.transfer.proposal_created', {
          dealId: sourceDeal.id,
          dealName: sourceDeal.name,
          workspaceId: validated.targetWorkspaceId,
          sourceWorkspaceId: sourceDeal.workspaceId,
          targetWorkspaceId: validated.targetWorkspaceId,
          sourcePipelineId: sourceDeal.pipelineId,
          targetPipelineId: validated.targetPipelineId,
          sourceEntityType: conversion.sourceScope,
          targetEntityType: conversion.targetScope,
          conversionStrategy: conversion.strategyUsed,
          proposalId: conversion.approvalId,
          actorType: actor.kind === 'service' ? 'agent' : 'user',
          actorUserId: userId || 'system',
          metadata: {
            evidence: conversion.auditEvidence,
          },
        });
      } catch {}

      return {
        success: true,
        phase: 'PROPOSAL',
        requiresProposal: true,
        approvalId: conversion.approvalId,
        entityResolution: {
          sourceEntityId: sourceDeal.entityId,
          targetEntityId: conversion.targetEntityId,
          sourceScope: conversion.sourceScope,
          targetScope: conversion.targetScope,
          strategyUsed: conversion.strategyUsed,
          wasCreated: false,
          promotedContactId: conversion.promotedContactId,
          auditEvidence: conversion.auditEvidence,
        },
      };
    }

    const resolvedEntityId = conversion.targetEntityId;

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
        entityId: resolvedEntityId, // Link adapted polymorphic entity (Rule 69)
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

      // Synchronize focal contact on move when promoted to person entity
      if (conversion.targetScope === 'person' && conversion.promotedContactId) {
        const promotedFocal = sourceDeal.focalContacts?.find((c) => c.id === conversion.promotedContactId);
        if (promotedFocal) {
          updatedDealData.focalContacts = [{ ...promotedFocal, isPrimary: true }];
        }
      }

      await sourceLoaded.ref.update(updatedDealData);

      // Audit activity log
      await logActivity({
        organizationId: sourceDeal.organizationId || targetOrgId || '',
        entityId: resolvedEntityId || null,
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
          sourceEntityId: sourceDeal.entityId,
          targetEntityId: resolvedEntityId,
          conversionStrategy: conversion.strategyUsed,
        },
      });

      // Legacy deal domain event
      await emitDealDomainEvent('deal.transferred', {
        dealId: sourceDeal.id,
        dealName: sourceDeal.name,
        workspaceId: validated.targetWorkspaceId,
        sourceWorkspaceId: sourceDeal.workspaceId,
        targetWorkspaceId: validated.targetWorkspaceId,
        sourcePipelineId: sourceDeal.pipelineId,
        targetPipelineId: validated.targetPipelineId,
        stageId: validated.targetStageId,
        previousStageId: sourceDeal.stageId,
        sourceEntityId: sourceDeal.entityId,
        targetEntityId: resolvedEntityId,
        sourceEntityType: conversion.sourceScope,
        targetEntityType: conversion.targetScope,
        conversionStrategy: conversion.strategyUsed,
        actorType: actor.kind === 'service' ? 'agent' : 'user',
        actorUserId: userId || 'system',
        metadata: {
          fromPipelineId: sourceDeal.pipelineId,
          toPipelineId: validated.targetPipelineId,
          actorKind: actor.kind,
          evidence: conversion.auditEvidence,
        },
      });

      if (conversion.wasCreated) {
        try {
          await emitDealDomainEvent('deal.entity_scope_converted', {
            dealId: sourceDeal.id,
            dealName: sourceDeal.name,
            workspaceId: validated.targetWorkspaceId,
            sourceWorkspaceId: sourceDeal.workspaceId,
            targetWorkspaceId: validated.targetWorkspaceId,
            sourceEntityId: sourceDeal.entityId,
            targetEntityId: resolvedEntityId,
            sourceEntityType: conversion.sourceScope,
            targetEntityType: conversion.targetScope,
            conversionStrategy: conversion.strategyUsed,
            promotedContactId: conversion.promotedContactId,
            actorType: actor.kind === 'service' ? 'agent' : 'user',
            actorUserId: userId || 'system',
            metadata: { evidence: conversion.auditEvidence },
          });
        } catch {}
      }

      // Platform typed domain event (Rule 39 & 40)
      try {
        const platformEvent = createDomainEvent({
          type: 'crm.deal.transferred',
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
            sourceEntityId: sourceDeal.entityId,
            targetEntityId: resolvedEntityId,
            conversionStrategy: conversion.strategyUsed,
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

      return {
        success: true,
        dealId: sourceDeal.id,
        phase: 'COMMITTED',
        entityResolution: {
          sourceEntityId: sourceDeal.entityId,
          targetEntityId: resolvedEntityId,
          sourceScope: conversion.sourceScope,
          targetScope: conversion.targetScope,
          strategyUsed: conversion.strategyUsed,
          wasCreated: conversion.wasCreated,
          promotedContactId: conversion.promotedContactId,
          auditEvidence: conversion.auditEvidence,
        },
      };
    } else {
      // COPY (Duplicate) MODE
      const clonedLineItems: DealLineItem[] =
        validated.copyLineItems !== false && Array.isArray(sourceDeal.lineItems)
          ? sourceDeal.lineItems.map((item) => ({ ...item, id: nanoid() }))
          : [];

      const clonedDealData: Omit<Deal, 'id'> = {
        organizationId: sourceDeal.organizationId || targetOrgId || '',
        workspaceId: validated.targetWorkspaceId,
        entityId: resolvedEntityId, // Link adapted polymorphic entity (Rule 69)
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
        focalContacts:
          conversion.targetScope === 'person' && conversion.promotedContactId
            ? [
                {
                  ...(sourceDeal.focalContacts?.find((c) => c.id === conversion.promotedContactId) || {
                    id: conversion.promotedContactId,
                    name: sourceDeal.name,
                    role: 'Primary Contact',
                  }),
                  isPrimary: true,
                },
              ]
            : validated.copyContacts !== false
            ? sourceDeal.focalContacts || []
            : [],
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
        entityId: resolvedEntityId || null,
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
          sourceEntityId: sourceDeal.entityId,
          targetEntityId: resolvedEntityId,
          conversionStrategy: conversion.strategyUsed,
        },
      });

      await emitDealDomainEvent('deal.duplicated', {
        dealId: newDocRef.id,
        dealName: clonedDealData.name,
        workspaceId: validated.targetWorkspaceId,
        sourceWorkspaceId: sourceDeal.workspaceId,
        targetWorkspaceId: validated.targetWorkspaceId,
        sourcePipelineId: sourceDeal.pipelineId,
        targetPipelineId: validated.targetPipelineId,
        stageId: validated.targetStageId,
        sourceEntityId: sourceDeal.entityId,
        targetEntityId: resolvedEntityId,
        sourceEntityType: conversion.sourceScope,
        targetEntityType: conversion.targetScope,
        conversionStrategy: conversion.strategyUsed,
        value: clonedDealData.value,
        actorType: actor.kind === 'service' ? 'agent' : 'user',
        actorUserId: userId || 'system',
      });

      if (conversion.wasCreated) {
        try {
          await emitDealDomainEvent('deal.entity_scope_converted', {
            dealId: newDocRef.id,
            dealName: clonedDealData.name,
            workspaceId: validated.targetWorkspaceId,
            sourceWorkspaceId: sourceDeal.workspaceId,
            targetWorkspaceId: validated.targetWorkspaceId,
            sourceEntityId: sourceDeal.entityId,
            targetEntityId: resolvedEntityId,
            sourceEntityType: conversion.sourceScope,
            targetEntityType: conversion.targetScope,
            conversionStrategy: conversion.strategyUsed,
            promotedContactId: conversion.promotedContactId,
            actorType: actor.kind === 'service' ? 'agent' : 'user',
            actorUserId: userId || 'system',
            metadata: { evidence: conversion.auditEvidence },
          });
        } catch {}
      }

      // Platform typed domain event (Rule 39 & 40)
      try {
        const platformEvent = createDomainEvent({
          type: 'crm.deal.duplicated',
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
            sourceEntityId: sourceDeal.entityId,
            targetEntityId: resolvedEntityId,
            conversionStrategy: conversion.strategyUsed,
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

      return {
        success: true,
        dealId: newDocRef.id,
        phase: 'COMMITTED',
        entityResolution: {
          sourceEntityId: sourceDeal.entityId,
          targetEntityId: resolvedEntityId,
          sourceScope: conversion.sourceScope,
          targetScope: conversion.targetScope,
          strategyUsed: conversion.strategyUsed,
          wasCreated: conversion.wasCreated,
          promotedContactId: conversion.promotedContactId,
          auditEvidence: conversion.auditEvidence,
        },
      };
    }
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : 'Failed to transfer deal';
    console.error('❌ [transferDealCore] Failed to transfer deal:', error);

    // Rule 27: Saga Compensation Rollback
    if (activeConversion?.createdWeDocId) {
      try {
        await adminDb.collection('workspace_entities').doc(activeConversion.createdWeDocId).delete();
      } catch {}
    }
    if (activeConversion?.createdEntityDocId) {
      try {
        await adminDb.collection('entities').doc(activeConversion.createdEntityDocId).delete();
      } catch {}
    }
    try {
      await emitDealDomainEvent('deal.transfer.compensated', {
        dealId: input.dealId,
        workspaceId: input.targetWorkspaceId,
        metadata: {
          rolledBackEntityId: activeConversion?.createdEntityDocId,
          error,
        },
      });
    } catch {}

    return { success: false, error };
  }
}
