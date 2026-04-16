'use server';

import { adminDb } from './firebase-admin';
import type { Entity } from './types';

/**
 * @fileOverview Denormalization sync utilities for workspace_entities.
 * Ensures denormalized fields on workspace_entities stay in sync with entity source data.
 * 
 * Requirements: 22
 */

const BATCH_SIZE = 500;

interface DenormalizedFields {
  displayName?: string;
  primaryEmail?: string;
  primaryPhone?: string;
}

/**
 * Syncs denormalized fields from an entity to all its workspace_entities records.
 * Processes updates in batches of 500 to avoid Firestore batch limits.
 * 
 * This function is called whenever entity name or contacts change to ensure
 * workspace_entities records reflect the latest data.
 * 
 * Requirements: 22
 */
export async function syncDenormalizedFieldsToWorkspaceEntities(
  entityId: string,
  updates: DenormalizedFields
): Promise<{ success: boolean; updatedCount: number; error?: string }> {
  try {
    const timestamp = new Date().toISOString();

    // 1. Query all workspace_entities records for this entity
    const workspaceEntitiesSnap = await adminDb
      .collection('workspace_entities')
      .where('entityId', '==', entityId)
      .get();

    if (workspaceEntitiesSnap.empty) {
      return {
        success: true,
        updatedCount: 0,
      };
    }

    // 2. Build the update object
    const denormalizedUpdates: any = {
      updatedAt: timestamp,
    };

    if (updates.displayName !== undefined) {
      denormalizedUpdates.displayName = updates.displayName;
    }

    if (updates.primaryEmail !== undefined) {
      denormalizedUpdates.primaryEmail = updates.primaryEmail;
    }

    if (updates.primaryPhone !== undefined) {
      denormalizedUpdates.primaryPhone = updates.primaryPhone;
    }

    // 3. Process updates in batches of 500
    const docs = workspaceEntitiesSnap.docs;
    let updatedCount = 0;

    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = adminDb.batch();
      const batchDocs = docs.slice(i, i + BATCH_SIZE);

      batchDocs.forEach((doc) => {
        batch.update(doc.ref, denormalizedUpdates);
      });

      await batch.commit();
      updatedCount += batchDocs.length;
    }

    console.log(
      `>>> [DENORM_SYNC] Updated ${updatedCount} workspace_entities records for entity ${entityId}`
    );

    return {
      success: true,
      updatedCount,
    };
  } catch (e: any) {
    console.error('>>> [DENORM_SYNC] Failed:', e.message);
    return {
      success: false,
      updatedCount: 0,
      error: e.message,
    };
  }
}

/**
 * Extracts denormalized fields from an entity document.
 * Used to compute what fields need to be synced to workspace_entities.
 * 
 * FER-01: Now resolves primary contact from entityContacts via helpers.
 */
export async function extractDenormalizedFields(entity: Entity): Promise<DenormalizedFields> {
  const { extractPrimaryContactFields } = await import('./entity-contact-helpers');
  
  const { primaryContactName, primaryEmail, primaryPhone } = extractPrimaryContactFields(entity);
  
  return {
    displayName: entity.name,
    primaryEmail: primaryEmail || undefined,
    primaryPhone: primaryPhone || undefined,
  };
}

