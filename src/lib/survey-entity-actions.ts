'use server';

/**
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 
 * 1. Single Source of Truth for Tags & Pipelines:
 *    - All tag operations route through TagSelector in the UI; server actions here mutate Firestore
 *      documents (`workspace_entities` and `contacts`) using atomic `FieldValue.arrayUnion`.
 * 2. Multi-Tenant Security & Isolation:
 *    - `workspaceId` is strictly required and enforced on every Firestore query (`where('workspaceId', '==', workspaceId)`).
 *    - Never mutate records across tenant boundaries.
 * 3. High-Load Batch Scalability & Chunking:
 *    - Cloud Firestore strictly limits 'in' query filter comparisons to max 30 items.
 *    - Slicing `entityIds` into sub-chunks of 30 prevents INVALID_ARGUMENT crashes under high volume.
 *    - Commits are executed safely within batch limits.
 * 4. Testability:
 *    - Validated in `src/lib/__tests__/survey-entity-actions.test.ts`.
 */

import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { canUser } from '@/lib/workspace-permissions';
import { requireWorkspace } from '@/lib/auth/require-auth';
// SECURITY (audit F9): report detail server-side; return an opaque message + ref.
import { toClientErrorMessage } from '@/lib/errors/report-error';
import { emitDealDomainEvent } from '@/lib/deals/deal-event-bus';
import { logActivity } from '@/lib/activity-logger';
import type { 
  Deal, 
  DealFocalContact, 
  DealStageHistory, 
  EntityContact, 
  OnboardingStage, 
  WorkspaceEntity, 
  Entity 
} from '@/lib/types';
import { stripHtml } from '@/lib/utils';

export interface BulkApplyTagsToSurveyEntitiesParams {
  workspaceId: string;
  entityIds: string[];
  tagIds: string[];
  userId?: string;
}

export interface BulkMoveSurveyEntitiesStageParams {
  workspaceId: string;
  entityIds: string[];
  pipelineId: string;
  stageId: string;
  userId?: string;
  // Contact-centric pipeline deal targeting (PRD Section 122 & Rules 5, 10)
  targetContactId?: string;
  targetContactName?: string;
  targetContactEmail?: string;
  targetContactPhone?: string;
  targetContactRole?: string;
  responseId?: string;
}

export interface SurveyEntityActionResult {
  success: boolean;
  updatedCount: number;
  error?: string;
}

/**
 * Atomically applies workspace tags to selected survey identified entities and contacts in Firestore.
 */
export async function bulkApplyTagsToSurveyEntitiesAction(
  params: BulkApplyTagsToSurveyEntitiesParams
): Promise<SurveyEntityActionResult> {
  const { workspaceId, entityIds, tagIds } = params;

  if (!workspaceId) {
    return { success: false, updatedCount: 0, error: 'Workspace context is required.' };
  }
  if (!entityIds || entityIds.length === 0) {
    return { success: false, updatedCount: 0, error: 'No entity records selected.' };
  }
  if (!tagIds || tagIds.length === 0) {
    return { success: false, updatedCount: 0, error: 'No tags selected to apply.' };
  }

  // SECURITY (audit F2 / Rule 9): Verify active session and workspace tenant membership
  const auth = await requireWorkspace(workspaceId);
  const perm = await canUser(auth.uid, 'operations', 'contacts', 'edit', workspaceId);
  if (!perm.granted) {
    return { success: false, updatedCount: 0, error: perm.reason || 'Permission denied.' };
  }

  const cleanEntityIds = [...new Set(entityIds.filter(Boolean))];
  const cleanTagIds = [...new Set(tagIds.filter(Boolean))];
  let updatedCount = 0;

  try {
    const FIRESTORE_IN_LIMIT = 30;
    for (let i = 0; i < cleanEntityIds.length; i += FIRESTORE_IN_LIMIT) {
      const chunk = cleanEntityIds.slice(i, i + FIRESTORE_IN_LIMIT);
      const batch = adminDb.batch();
      const updatedRefPaths = new Set<string>();

      // Run lookups across entities and contacts concurrently
      const [
        entityByDocId,
        entityByEntityId,
        entityByCode,
        contactByDocId,
        contactByEntityId,
      ] = await Promise.all([
        adminDb.collection('workspace_entities').where('workspaceId', '==', workspaceId).where('__name__', 'in', chunk).get(),
        adminDb.collection('workspace_entities').where('workspaceId', '==', workspaceId).where('entityId', 'in', chunk).get(),
        adminDb.collection('workspace_entities').where('workspaceId', '==', workspaceId).where('code', 'in', chunk).get(),
        adminDb.collection('contacts').where('workspaceId', '==', workspaceId).where('__name__', 'in', chunk).get(),
        adminDb.collection('contacts').where('workspaceId', '==', workspaceId).where('entityId', 'in', chunk).get(),
      ]);

      const applyTagUpdate = (docSnap: FirebaseFirestore.QueryDocumentSnapshot) => {
        if (!updatedRefPaths.has(docSnap.ref.path)) {
          updatedRefPaths.add(docSnap.ref.path);
          batch.update(docSnap.ref, {
            tagIds: FieldValue.arrayUnion(...cleanTagIds),
            workspaceTags: FieldValue.arrayUnion(...cleanTagIds),
            updatedAt: new Date().toISOString(),
          });
          updatedCount++;
        }
      };

      entityByDocId.docs.forEach(applyTagUpdate);
      entityByEntityId.docs.forEach(applyTagUpdate);
      entityByCode.docs.forEach(applyTagUpdate);
      contactByDocId.docs.forEach(applyTagUpdate);
      contactByEntityId.docs.forEach(applyTagUpdate);

      if (updatedRefPaths.size > 0) {
        await batch.commit();
      }
    }

    return { success: true, updatedCount };
  } catch (err) {
    console.error('[bulkApplyTagsToSurveyEntitiesAction] Error applying tags:', err);
    return {
      success: false,
      updatedCount,
      error: toClientErrorMessage('survey-entity-actions', err, undefined, 'Failed to update entity tags.'),
    };
  }
}

/**
 * ARCHITECTURAL GUIDANCE (PRD Section 122 & Rule 10):
 * CONTACT-CENTRIC PIPELINE DEAL MODEL:
 * 1. Deals represent commercial and engagement lifecycles attached to specific Contacts,
 *    with the Entity serving as the parent institutional account.
 * 2. Multi-Deal Architecture: A single entity can have multiple concurrent deals in the same
 *    pipeline as long as they are attached to distinct contacts.
 * 3. Lifecycle Routing:
 *    - If an active deal already exists for the specified contact in the target pipeline,
 *      it is transitioned to the destination stage with full stage history, SLA duration,
 *      and domain events (`deal.stage.changed`).
 *    - If no deal exists for this contact in the pipeline, a new deal is instantiated
 *      in the target stage, pinned to the contact (`primaryContactId`, `focalContacts`),
 *      emitting `deal.created`.
 * 4. Backward Compatibility: Operational stage metadata is also synchronized onto
 *    `workspace_entities` and `contacts` collections for backward-compatible lookups.
 * 5. Security & Isolation: Enforces `requireAuth()`, validates permissions via `canUser`,
 *    and confines all operations within `workspaceId`.
 */
export async function bulkMoveSurveyEntitiesStageAction(
  params: BulkMoveSurveyEntitiesStageParams
): Promise<SurveyEntityActionResult> {
  const { 
    workspaceId, 
    entityIds, 
    pipelineId, 
    stageId, 
    targetContactId,
    targetContactName,
    targetContactEmail,
    targetContactPhone,
    targetContactRole,
    responseId,
  } = params;

  if (!workspaceId) {
    return { success: false, updatedCount: 0, error: 'Workspace context is required.' };
  }
  if (!entityIds || entityIds.length === 0) {
    return { success: false, updatedCount: 0, error: 'No entity records selected.' };
  }
  if (!pipelineId || !stageId) {
    return { success: false, updatedCount: 0, error: 'Pipeline and stage selection are required.' };
  }

  // SECURITY (audit F2 / Rule 9): Verify active session and workspace tenant membership
  const auth = await requireWorkspace(workspaceId);
  const perm = await canUser(auth.uid, 'operations', 'pipeline', 'edit', workspaceId);
  if (!perm.granted) {
    return { success: false, updatedCount: 0, error: perm.reason || 'Permission denied.' };
  }
  const currentUserId = auth.uid;

  const cleanEntityIds = [...new Set(entityIds.filter(Boolean))];
  let updatedCount = 0;

  try {
    // 1. Resolve Target Stage Name, Terminal Status & Probability
    const stageSnap = await adminDb.collection('onboardingStages').doc(stageId).get();
    const stageData = stageSnap.exists ? (stageSnap.data() as OnboardingStage) : null;
    const stageName = stageData?.name || stageId;
    const resolvedStatus: 'open' | 'won' | 'lost' = stageData?.isWon ? 'won' : stageData?.isLost ? 'lost' : 'open';
    const stageProbability = typeof stageData?.probability === 'number' ? stageData.probability : null;

    // 2. Process each selected entity through the Contact-Centric Deal Lifecycle
    for (const rawEntityId of cleanEntityIds) {
      const cleanId = rawEntityId.startsWith(`${workspaceId}_`)
        ? rawEntityId.slice(workspaceId.length + 1)
        : rawEntityId;

      // Look up workspace entity and global entity
      const [wsDoc, globalDoc] = await Promise.all([
        adminDb.collection('workspace_entities').doc(`${workspaceId}_${cleanId}`).get(),
        adminDb.collection('entities').doc(cleanId).get(),
      ]);

      const wsData = wsDoc.exists ? (wsDoc.data() as WorkspaceEntity) : null;
      const globalData = globalDoc.exists ? (globalDoc.data() as Entity) : null;

      const rawEntityName =
        wsData?.displayName ||
        globalData?.name ||
        (wsData as unknown as Record<string, string>)?.name ||
        'Entity';
      const entityDisplayName = stripHtml(rawEntityName);
      const organizationId = wsData?.organizationId || globalData?.organizationId || '';
      const entityContacts: EntityContact[] =
        globalData?.entityContacts ||
        (wsData as unknown as { entityContacts?: EntityContact[] })?.entityContacts ||
        [];

      // Resolve contact to associate with this deal
      let resolvedContact: {
        id: string;
        name: string;
        email?: string;
        phone?: string;
        role?: string;
      } | null = null;

      if (targetContactId) {
        const found = entityContacts.find((c) => c.id === targetContactId);
        if (found) {
          resolvedContact = {
            id: found.id,
            name: stripHtml(found.name),
            email: found.email,
            phone: found.phone,
            role: found.typeLabel || found.typeKey || 'Contact',
          };
        } else {
          resolvedContact = {
            id: targetContactId,
            name: stripHtml(targetContactName || 'Contact'),
            email: targetContactEmail,
            phone: targetContactPhone,
            role: targetContactRole || 'Contact',
          };
        }
      } else if (targetContactEmail || targetContactPhone) {
        const emailLower = targetContactEmail?.trim().toLowerCase();
        const phoneDigits = targetContactPhone?.replace(/\D/g, '');
        const found = entityContacts.find((c) => {
          if (emailLower && c.email && c.email.trim().toLowerCase() === emailLower) return true;
          if (phoneDigits && c.phone && c.phone.replace(/\D/g, '') === phoneDigits) return true;
          return false;
        });

        if (found) {
          resolvedContact = {
            id: found.id,
            name: stripHtml(found.name),
            email: found.email,
            phone: found.phone,
            role: found.typeLabel || found.typeKey || 'Contact',
          };
        } else {
          resolvedContact = {
            id: `contact_${Date.now()}`,
            name: stripHtml(targetContactName || 'Contact'),
            email: targetContactEmail,
            phone: targetContactPhone,
            role: targetContactRole || 'Contact',
          };
        }
      } else if (targetContactName) {
        const found = entityContacts.find(
          (c) => c.name.trim().toLowerCase() === targetContactName.trim().toLowerCase()
        );
        if (found) {
          resolvedContact = {
            id: found.id,
            name: stripHtml(found.name),
            email: found.email,
            phone: found.phone,
            role: found.typeLabel || found.typeKey || 'Contact',
          };
        } else {
          resolvedContact = {
            id: `contact_${Date.now()}`,
            name: stripHtml(targetContactName),
            role: targetContactRole || 'Contact',
          };
        }
      } else {
        // Fallback to designated primary contact on the entity
        const primary = entityContacts.find((c) => c.isPrimary) || entityContacts[0];
        if (primary) {
          resolvedContact = {
            id: primary.id,
            name: stripHtml(primary.name),
            email: primary.email,
            phone: primary.phone,
            role: primary.typeLabel || primary.typeKey || 'Primary Contact',
          };
        } else {
          resolvedContact = {
            id: `contact_${cleanId}`,
            name: entityDisplayName,
            role: 'Primary Contact',
          };
        }
      }

      // Query active deals for this entity in the specified pipeline
      const dealsSnap = await adminDb
        .collection('deals')
        .where('workspaceId', '==', workspaceId)
        .where('pipelineId', '==', pipelineId)
        .where('entityId', '==', cleanId)
        .get();

      // Find if a deal exists specifically matching this contact
      // Find if a deal exists specifically matching this contact
      let matchingDealDoc = dealsSnap.docs.find((doc) => {
        const d = doc.data() as Deal;
        if (d.isArchived) return false;
        if (resolvedContact?.id && d.primaryContactId === resolvedContact.id) return true;
        if (resolvedContact?.id && d.focalContacts?.some((fc) => fc.id === resolvedContact!.id)) return true;
        if (
          resolvedContact?.email &&
          d.focalContacts?.some(
            (fc) => fc.email && fc.email.trim().toLowerCase() === resolvedContact!.email!.trim().toLowerCase()
          )
        ) {
          return true;
        }
        if (
          resolvedContact?.phone &&
          d.focalContacts?.some(
            (fc) => fc.phone && fc.phone.replace(/\D/g, '') === resolvedContact!.phone!.replace(/\D/g, '')
          )
        ) {
          return true;
        }
        return false;
      });

      // ARCHITECTURAL SAFEGUARD (Important Issue 5): Legacy deal adoption.
      // If no deal matches this contact specifically, but exactly one unassigned legacy deal exists,
      // adopt that deal instead of spawning a duplicate deal for the entity.
      if (!matchingDealDoc && dealsSnap.docs.length === 1) {
        const singleDeal = dealsSnap.docs[0].data() as Deal;
        if (
          !singleDeal.isArchived &&
          !singleDeal.primaryContactId &&
          (!singleDeal.focalContacts || singleDeal.focalContacts.length === 0)
        ) {
          matchingDealDoc = dealsSnap.docs[0];
        }
      }

      const now = new Date().toISOString();

      if (matchingDealDoc) {
        // BRANCH A: Existing deal for this contact -> Move to target stage
        const existingDeal = matchingDealDoc.data() as Deal;
        const dealId = matchingDealDoc.id;
        const oldStageId = existingDeal.stageId;
        const oldStageName = existingDeal.stageName || oldStageId;

        const lastEntered = existingDeal.stageEnteredAt || existingDeal.createdAt || now;
        const lastEnteredTime = new Date(lastEntered).getTime();
        const durationSeconds = !isNaN(lastEnteredTime)
          ? Math.max(0, Math.floor((new Date(now).getTime() - lastEnteredTime) / 1000))
          : 0;

        const previousHistory = Array.isArray(existingDeal.stageHistory)
          ? existingDeal.stageHistory
          : [];
        const updatedHistory: DealStageHistory[] =
          oldStageId !== stageId
            ? [
                ...previousHistory,
                {
                  stageId: oldStageId,
                  stageName: oldStageName,
                  enteredAt: lastEntered,
                  exitedAt: now,
                  durationSeconds,
                  changedByUserId: currentUserId,
                  notes: responseId ? `Moved from Survey Response (${responseId})` : 'Moved from Survey Results',
                },
              ]
            : previousHistory;

        const updatePayload: Record<string, unknown> = {
          stageId,
          stageName,
          status: resolvedStatus,
          stageEnteredAt: now,
          stageHistory: updatedHistory,
          updatedAt: now,
        };

        if (stageProbability !== null) {
          updatePayload.probability = stageProbability;
        }

        if (!existingDeal.primaryContactId && resolvedContact?.id) {
          updatePayload.primaryContactId = resolvedContact.id;
        }

        if ((!existingDeal.focalContacts || existingDeal.focalContacts.length === 0) && resolvedContact) {
          updatePayload.focalContacts = [
            {
              id: resolvedContact.id,
              name: resolvedContact.name,
              email: resolvedContact.email,
              phone: resolvedContact.phone,
              role: resolvedContact.role || 'Primary Contact',
              isPrimary: true,
            },
          ];
        }

        await adminDb.collection('deals').doc(dealId).update(updatePayload);

        emitDealDomainEvent('deal.stage.changed', {
          dealId,
          workspaceId,
          organizationId,
          entityId: cleanId,
          pipelineId,
          stageId,
          previousStageId: oldStageId,
        });

        await logActivity({
          organizationId,
          workspaceId,
          entityId: cleanId,
          dealId,
          userId: currentUserId,
          type: 'deal_stage_changed',
          source: 'survey_response',
          description: `Moved deal for ${resolvedContact?.name || entityDisplayName} to ${stageName} from survey response`,
          metadata: {
            pipelineId,
            stageId,
            stageName,
            contactId: resolvedContact?.id,
            contactName: resolvedContact?.name,
            responseId,
          },
        });

        updatedCount++;
      } else {
        // BRANCH B: No deal exists for this contact in this pipeline -> Create new deal!
        const dealRef = adminDb.collection('deals').doc();
        const dealName = resolvedContact?.name
          ? `${entityDisplayName} - ${resolvedContact.name}`
          : entityDisplayName;

        const focalContactEntry: DealFocalContact = {
          id: resolvedContact?.id || `contact_${cleanId}`,
          name: resolvedContact?.name || entityDisplayName,
          email: resolvedContact?.email,
          phone: resolvedContact?.phone,
          role: resolvedContact?.role || 'Primary Contact',
          isPrimary: true,
        };

        const newDealData: Omit<Deal, 'id'> = {
          organizationId,
          workspaceId,
          entityId: cleanId,
          pipelineId,
          stageId,
          stageName,
          name: dealName,
          value: 0,
          status: resolvedStatus,
          probability: stageProbability !== null ? stageProbability : undefined,
          isArchived: false,
          assignedTo: wsData?.assignedTo || null,
          primaryContactId: focalContactEntry.id,
          focalContacts: [focalContactEntry],
          source: 'survey_response',
          stageEnteredAt: now,
          stageHistory: [
            {
              stageId,
              stageName,
              enteredAt: now,
              durationSeconds: 0,
              changedByUserId: currentUserId,
              notes: responseId ? `Created from Survey Response (${responseId})` : 'Created from Survey Results',
            },
          ],
          createdAt: now,
          updatedAt: now,
        };

        await dealRef.set(newDealData);

        emitDealDomainEvent('deal.created', {
          dealId: dealRef.id,
          workspaceId,
          organizationId,
          entityId: cleanId,
          pipelineId,
          stageId,
        });

        await logActivity({
          organizationId,
          workspaceId,
          entityId: cleanId,
          dealId: dealRef.id,
          userId: currentUserId,
          type: 'deal_created',
          source: 'survey_response',
          description: `Created new deal for ${resolvedContact?.name || entityDisplayName} in ${stageName} from survey response`,
          metadata: {
            pipelineId,
            stageId,
            stageName,
            contactId: resolvedContact?.id,
            contactName: resolvedContact?.name,
            responseId,
          },
        });

        updatedCount++;
      }
    }

    // 3. Backward Compatibility: Also update pipelineId and stageId on workspace_entities and contacts collections
    const FIRESTORE_IN_LIMIT = 30;
    for (let i = 0; i < cleanEntityIds.length; i += FIRESTORE_IN_LIMIT) {
      const chunk = cleanEntityIds.slice(i, i + FIRESTORE_IN_LIMIT);
      const batch = adminDb.batch();
      const updatedRefPaths = new Set<string>();

      const [
        entityByDocId,
        entityByEntityId,
        entityByCode,
        contactByDocId,
        contactByEntityId,
      ] = await Promise.all([
        adminDb.collection('workspace_entities').where('workspaceId', '==', workspaceId).where('__name__', 'in', chunk).get(),
        adminDb.collection('workspace_entities').where('workspaceId', '==', workspaceId).where('entityId', 'in', chunk).get(),
        adminDb.collection('workspace_entities').where('workspaceId', '==', workspaceId).where('code', 'in', chunk).get(),
        adminDb.collection('contacts').where('workspaceId', '==', workspaceId).where('__name__', 'in', chunk).get(),
        adminDb.collection('contacts').where('workspaceId', '==', workspaceId).where('entityId', 'in', chunk).get(),
      ]);

      const applyStageUpdate = (docSnap: FirebaseFirestore.QueryDocumentSnapshot) => {
        if (!updatedRefPaths.has(docSnap.ref.path)) {
          updatedRefPaths.add(docSnap.ref.path);
          batch.update(docSnap.ref, {
            pipelineId,
            stageId,
            updatedAt: new Date().toISOString(),
          });
        }
      };

      entityByDocId.docs.forEach(applyStageUpdate);
      entityByEntityId.docs.forEach(applyStageUpdate);
      entityByCode.docs.forEach(applyStageUpdate);

      // ARCHITECTURAL SAFEGUARD (Important Issue 3): Avoid overwriting other contacts under this entity.
      // If targetContactId was provided, only update the contact document matching that contactId.
      if (targetContactId) {
        const matchingContactDocs = [...contactByDocId.docs, ...contactByEntityId.docs].filter(
          (doc) => doc.id === targetContactId || (doc.data() as { contactId?: string }).contactId === targetContactId
        );
        matchingContactDocs.forEach(applyStageUpdate);
      } else {
        contactByDocId.docs.forEach(applyStageUpdate);
        contactByEntityId.docs.forEach(applyStageUpdate);
      }

      if (updatedRefPaths.size > 0) {
        await batch.commit();
      }
    }

    return { success: true, updatedCount };
  } catch (err) {
    console.error('[bulkMoveSurveyEntitiesStageAction] Error moving pipeline stage:', err);
    return {
      success: false,
      updatedCount,
      error: toClientErrorMessage('survey-entity-actions', err, undefined, 'Failed to update pipeline stage.'),
    };
  }
}
