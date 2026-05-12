'use server';

import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// ─── Types ───────────────────────────────────────────────────────
interface LeadCaptureInput {
  meetingId: string;
  workspaceId: string;
  organizationId: string;
  registrantId: string;
  /** The raw registration form data submitted by the registrant */
  registrationData: Record<string, any>;
  /** Mapping config from the meeting's lead capture settings */
  entityMapping: {
    nameField: string;           // e.g. "parent_name"
    focalPersonField?: string;   // e.g. "child_name"
    emailField?: string;         // e.g. "email"
    phoneField?: string;         // e.g. "phone"
    additionalMappings?: Array<{
      sourceField: string;
      targetProperty: string;
    }>;
  };
  /** Tag IDs to apply to the entity */
  autoTags?: string[];
  /** Automation IDs to trigger for NEW entities only */
  autoAutomations?: string[];
}

interface LeadCaptureResult {
  success: boolean;
  entityId?: string;
  isNew: boolean;
  error?: string;
}

// ─── Main Action ─────────────────────────────────────────────────
/**
 * Processes a meeting registration for CRM lead capture.
 * 
 * Flow:
 * 1. Extract identity fields from registration data using the mapping config
 * 2. Dedup: Query existing entities by email → phone → name (priority order)
 * 3. If found: Link registrant to existing entity, merge tags additively
 * 4. If not found: Create new entity, apply tags, trigger automations
 */
export async function createEntityFromRegistration(
  input: LeadCaptureInput
): Promise<LeadCaptureResult> {
  try {
    const {
      meetingId,
      workspaceId,
      organizationId,
      registrantId,
      registrationData,
      entityMapping,
      autoTags = [],
      autoAutomations = [],
    } = input;

    // ── Step 1: Extract identity from registration data ──
    const entityName = registrationData[entityMapping.nameField] || '';
    const focalPerson = entityMapping.focalPersonField
      ? registrationData[entityMapping.focalPersonField] || ''
      : '';
    const email = entityMapping.emailField
      ? (registrationData[entityMapping.emailField] || '').toString().toLowerCase().trim()
      : '';
    const phone = entityMapping.phoneField
      ? (registrationData[entityMapping.phoneField] || '').toString().trim()
      : '';

    if (!entityName) {
      return { success: false, isNew: false, error: 'Entity name field is empty.' };
    }

    // ── Step 2: Dedup — find existing entity ──
    const entitiesRef = adminDb.collection('workspace_entities');
    let existingEntityId: string | null = null;

    // Priority 1: Match by email (most reliable)
    if (email) {
      const emailSnap = await entitiesRef
        .where('workspaceId', '==', workspaceId)
        .where('contactEmail', '==', email)
        .limit(1)
        .get();
      if (!emailSnap.empty) {
        existingEntityId = emailSnap.docs[0].id;
      }
    }

    // Priority 2: Match by phone (if email didn't match)
    if (!existingEntityId && phone) {
      const phoneSnap = await entitiesRef
        .where('workspaceId', '==', workspaceId)
        .where('contactPhone', '==', phone)
        .limit(1)
        .get();
      if (!phoneSnap.empty) {
        existingEntityId = phoneSnap.docs[0].id;
      }
    }

    const now = new Date().toISOString();

    // ── Step 3a: Existing entity — link + merge tags ──
    if (existingEntityId) {
      const updatePromises: Promise<any>[] = [];

      // Link registrant to entity
      updatePromises.push(
        adminDb
          .collection('meetings')
          .doc(meetingId)
          .collection('registrants')
          .doc(registrantId)
          .update({ entityId: existingEntityId, linkedAt: now })
      );

      // Additive tag merge (never remove existing tags)
      if (autoTags.length > 0) {
        updatePromises.push(
          entitiesRef.doc(existingEntityId).update({
            tagIds: FieldValue.arrayUnion(...autoTags),
            updatedAt: now,
          })
        );
      }

      // Apply additional field mappings
      const additionalData = buildAdditionalMappings(
        entityMapping.additionalMappings,
        registrationData
      );
      if (Object.keys(additionalData).length > 0) {
        updatePromises.push(
          entitiesRef.doc(existingEntityId).update({
            ...additionalData,
            updatedAt: now,
          })
        );
      }

      await Promise.all(updatePromises);

      // NOTE: Automations are NOT re-triggered for existing entities
      return { success: true, entityId: existingEntityId, isNew: false };
    }

    // ── Step 3b: New entity — create + tags + automations ──
    const slug = entityName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60);

    const additionalData = buildAdditionalMappings(
      entityMapping.additionalMappings,
      registrationData
    );

    const newEntity: Record<string, any> = {
      displayName: entityName,
      slug,
      entityType: 'person',
      status: 'active',
      workspaceId,
      organizationId,
      contactEmail: email,
      contactPhone: phone,
      focalPersonName: focalPerson,
      tagIds: autoTags,
      source: 'meeting_registration',
      sourceMeetingId: meetingId,
      createdAt: now,
      updatedAt: now,
      ...additionalData,
    };

    const entityDoc = await entitiesRef.add(newEntity);
    const newEntityId = entityDoc.id;

    // Link registrant + trigger automations in parallel
    const postCreatePromises: Promise<any>[] = [
      adminDb
        .collection('meetings')
        .doc(meetingId)
        .collection('registrants')
        .doc(registrantId)
        .update({ entityId: newEntityId, linkedAt: now }),
    ];

    // Queue automations for new entities only
    if (autoAutomations.length > 0) {
      postCreatePromises.push(
        queueAutomations(newEntityId, autoAutomations, workspaceId, organizationId)
      );
    }

    await Promise.all(postCreatePromises);

    return { success: true, entityId: newEntityId, isNew: true };
  } catch (error: any) {
    console.error('[createEntityFromRegistration] Failed:', error);
    return { success: false, isNew: false, error: error.message };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────

/** Builds a flat update object from additional field mappings */
function buildAdditionalMappings(
  mappings: LeadCaptureInput['entityMapping']['additionalMappings'],
  registrationData: Record<string, any>
): Record<string, any> {
  if (!mappings || mappings.length === 0) return {};

  const result: Record<string, any> = {};
  for (const mapping of mappings) {
    const value = registrationData[mapping.sourceField];
    if (value !== undefined && value !== null && value !== '') {
      result[mapping.targetProperty] = value;
    }
  }
  return result;
}

/** Queues automation executions for a newly created entity */
async function queueAutomations(
  entityId: string,
  automationIds: string[],
  workspaceId: string,
  organizationId: string
): Promise<void> {
  const batch = adminDb.batch();
  const queueRef = adminDb.collection('automation_queue');

  for (const automationId of automationIds) {
    const docRef = queueRef.doc();
    batch.set(docRef, {
      automationId,
      entityId,
      workspaceId,
      organizationId,
      status: 'pending',
      trigger: 'meeting_registration',
      createdAt: new Date().toISOString(),
    });
  }

  await batch.commit();
}
