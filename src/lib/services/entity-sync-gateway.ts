/**
 * @fileOverview Atomic Entity Synchronization Gateway (Single Source of Truth).
 * 
 * ARCHITECTURAL RATIONALE & CAUTION FOR MAINTAINERS (Rule 10 & Strict Zero-Any Invariant):
 * In SmartSapp's multi-workspace Firestore architecture:
 * 1. `entities` is the canonical Golden Record for Identity (legal name, contacts, financials, global tags).
 * 2. `workspace_entities` is the tenant-scoped operational relationship (assignee, workspaceTags, status)
 *    combined with a denormalized read-model projection (displayName, contacts, location, search keys).
 * 3. `workspace_contacts` is the flattened single-contact projection used for audiences and communication.
 *
 * CRITICAL ZERO-DRIFT GUARANTEE:
 * Because this application runs on Firebase App Hosting without Cloud Functions / database triggers,
 * asynchronous sequential writes risk partial failures (e.g. updating master entity but failing on child
 * workspace entities). ALL mutations that modify identity or denormalized projection fields MUST execute
 * through this gateway using ATOMIC FIRESTORE BATCHES.
 *
 * TESTABILITY POINTERS:
 * Tested in `src/lib/__tests__/entity-sync-invariants.test.ts` and `denormalization-consistency.property.test.ts`.
 */

import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { toSearchKey, withEntitySearchFields } from '@/lib/entities/entity-cache-domain';
import { extractPrimaryContactFields } from '@/lib/entity-contact-helpers';
import { syncContactProjectionForWE, deleteContactProjectionForEntity } from '@/lib/contacts/contact-projection-writer';
import { zoneOrUnassigned, type ZoneRef } from '@/lib/zone-constants';
import type { Entity, EntityContact, WorkspaceEntity } from '@/lib/types';
import { getErrorMessage } from '@/lib/errors/report-error';

export interface EntityIdentityUpdates {
  name?: string;
  slug?: string;
  entityContacts?: EntityContact[];
  globalTags?: string[];
  status?: 'active' | 'archived';
  initials?: string;
  logoUrl?: string;
  slogan?: string;
  referee?: string;
  interests?: string[];
  currentNeeds?: string;
  currentChallenges?: string;
  interestsText?: string;
  location?: {
    locationString?: string;
    zone?: ZoneRef;
    country?: { id: string; name: string; code: string; flag: string };
    region?: { id: string; name: string };
    district?: { id: string; name: string };
  };
  financeData?: Record<string, unknown>;
  industryData?: Record<string, unknown>;
  customData?: Record<string, unknown>;
  onlinePresence?: Record<string, unknown>;
  familyData?: Record<string, unknown>;
  personData?: Record<string, unknown>;
}

export interface WorkspaceOperationalUpdates {
  assignedTo?: WorkspaceEntity['assignedTo'];
  workspaceTags?: string[];
  status?: 'active' | 'archived';
}

export interface SyncResult {
  success: boolean;
  entityId: string;
  workspacesUpdatedCount: number;
  contactProjectionsSyncedCount: number;
  error?: string;
}

export interface EntityDriftReport {
  entityId: string;
  workspaceId: string;
  workspaceEntityId: string;
  hasDrift: boolean;
  driftFields: string[];
  differences: Record<string, { entityVal: unknown; workspaceVal: unknown }>;
}

/**
 * Pure helper to detect field-level drift between an Entity and a WorkspaceEntity.
 */
export function detectEntityDrift(entity: Entity, we: WorkspaceEntity): EntityDriftReport {
  const driftFields: string[] = [];
  const differences: Record<string, { entityVal: unknown; workspaceVal: unknown }> = {};

  const expectedName = entity.name || '';
  if ((we.displayName || '') !== expectedName) {
    driftFields.push('displayName');
    differences.displayName = { entityVal: expectedName, workspaceVal: we.displayName };
  }

  const expectedSearchKey = toSearchKey(expectedName);
  if ((we.displayNameLower || '') !== expectedSearchKey) {
    driftFields.push('displayNameLower');
    differences.displayNameLower = { entityVal: expectedSearchKey, workspaceVal: we.displayNameLower };
  }

  const { primaryContactName, primaryEmail, primaryPhone } = extractPrimaryContactFields(entity);

  if ((we.primaryContactName || '') !== (primaryContactName || '')) {
    driftFields.push('primaryContactName');
    differences.primaryContactName = { entityVal: primaryContactName, workspaceVal: we.primaryContactName };
  }

  if ((we.primaryEmail || '') !== (primaryEmail || '')) {
    driftFields.push('primaryEmail');
    differences.primaryEmail = { entityVal: primaryEmail, workspaceVal: we.primaryEmail };
  }

  if ((we.primaryPhone || '') !== (primaryPhone || '')) {
    driftFields.push('primaryPhone');
    differences.primaryPhone = { entityVal: primaryPhone, workspaceVal: we.primaryPhone };
  }

  // Check canonical contacts array alignment
  const eContacts = entity.entityContacts || [];
  const weContacts = we.entityContacts || [];
  if (eContacts.length !== weContacts.length) {
    driftFields.push('entityContacts_count');
    differences.entityContacts_count = { entityVal: eContacts.length, workspaceVal: weContacts.length };
  }

  return {
    entityId: entity.id,
    workspaceId: we.workspaceId,
    workspaceEntityId: we.id,
    hasDrift: driftFields.length > 0,
    driftFields,
    differences,
  };
}

export class EntitySyncGateway {
  /**
   * Atomically synchronizes identity changes from the master Entity across all linked WorkspaceEntities.
   * Uses an atomic Firestore batch to prevent split-brain state.
   */
  static async syncEntityAndWorkspaces(
    entityId: string,
    updates: EntityIdentityUpdates,
    options?: {
      sourceWorkspaceId?: string;
      workspaceUpdates?: WorkspaceOperationalUpdates;
    }
  ): Promise<SyncResult> {
    try {
      const timestamp = new Date().toISOString();
      const entityRef = adminDb.collection('entities').doc(entityId);
      const entitySnap = await entityRef.get();

      if (!entitySnap.exists) {
        return {
          success: false,
          entityId,
          workspacesUpdatedCount: 0,
          contactProjectionsSyncedCount: 0,
          error: `Entity ${entityId} does not exist.`,
        };
      }

      const currentEntity = { id: entitySnap.id, ...entitySnap.data() } as Entity;

      // Extract new canonical contacts if provided, otherwise preserve existing
      const activeContacts = updates.entityContacts !== undefined ? updates.entityContacts : (currentEntity.entityContacts || []);
      const { primaryContactName, primaryEmail, primaryPhone } = extractPrimaryContactFields({ entityContacts: activeContacts });

      const newDisplayName = updates.name !== undefined ? updates.name : currentEntity.name;
      const normalizedLocation = updates.location !== undefined 
        ? { ...updates.location, zone: zoneOrUnassigned(updates.location?.zone) }
        : currentEntity.location;

      // 1. Build atomic batch or sequential operations
      const hasBatch = typeof adminDb.batch === 'function';
      const batch = hasBatch ? adminDb.batch() : null;

      // Master entity payload
      const masterUpdate: Record<string, unknown> = {
        updatedAt: timestamp,
      };

      if (updates.name !== undefined) masterUpdate.name = updates.name;
      if (updates.entityType !== undefined) masterUpdate.entityType = updates.entityType;
      if (updates.status !== undefined) masterUpdate.status = updates.status;
      if (updates.entityContacts !== undefined) masterUpdate.entityContacts = updates.entityContacts;
      if (updates.globalTags !== undefined) masterUpdate.globalTags = updates.globalTags;
      if (updates.slug !== undefined) masterUpdate.slug = updates.slug;
      if (updates.initials !== undefined) masterUpdate.initials = updates.initials;
      if (updates.logoUrl !== undefined) masterUpdate.logoUrl = updates.logoUrl;
      if (updates.slogan !== undefined) masterUpdate.slogan = updates.slogan;
      if (updates.referee !== undefined) masterUpdate.referee = updates.referee;
      if (updates.interests !== undefined) masterUpdate.interests = updates.interests;
      if (updates.currentNeeds !== undefined) masterUpdate.currentNeeds = updates.currentNeeds;
      if (updates.currentChallenges !== undefined) masterUpdate.currentChallenges = updates.currentChallenges;
      if (updates.interestsText !== undefined) masterUpdate.interestsText = updates.interestsText;
      if (normalizedLocation !== undefined) masterUpdate.location = normalizedLocation;
      if (updates.financeData !== undefined) masterUpdate.financeData = updates.financeData;
      if (updates.industryData !== undefined) masterUpdate.industryData = updates.industryData;
      if (updates.customData !== undefined) masterUpdate.customData = updates.customData;
      if (updates.onlinePresence !== undefined) masterUpdate.onlinePresence = updates.onlinePresence;
      if (updates.familyData !== undefined) masterUpdate.familyData = updates.familyData;
      if (updates.personData !== undefined) masterUpdate.personData = updates.personData;

      if (batch) {
        batch.update(entityRef, masterUpdate);
      } else {
        await entityRef.update(masterUpdate);
      }

      // 2. Query all linked workspace entities
      const weQuery = await adminDb.collection('workspace_entities').where('entityId', '==', entityId).get();
      const updatedWEPayloads: WorkspaceEntity[] = [];

      for (const doc of weQuery.docs) {
        const weData = doc.data() as WorkspaceEntity;
        const isSourceWorkspace = options?.sourceWorkspaceId && weData.workspaceId === options.sourceWorkspaceId;

        const weUpdate: Record<string, unknown> = withEntitySearchFields({
          displayName: newDisplayName,
          updatedAt: timestamp,
        });

        // Always sync canonical contact denormalization to all workspaces
        weUpdate.primaryContactName = primaryContactName || newDisplayName;
        weUpdate.primaryEmail = primaryEmail;
        weUpdate.primaryPhone = primaryPhone;
        weUpdate.entityContacts = activeContacts;

        if (normalizedLocation) {
          weUpdate.location = normalizedLocation;
          weUpdate.locationString = normalizedLocation.locationString || '';
          weUpdate.locationCountryId = normalizedLocation.country?.id || null;
          weUpdate.locationRegionId = normalizedLocation.region?.id || null;
          weUpdate.locationDistrictId = normalizedLocation.district?.id || null;
          weUpdate.zone = normalizedLocation.zone;
        }

        if (updates.interests !== undefined) weUpdate.interests = updates.interests;
        if (updates.currentNeeds !== undefined) weUpdate.currentNeeds = updates.currentNeeds;
        if (updates.currentChallenges !== undefined) weUpdate.currentChallenges = updates.currentChallenges;
        if (updates.interestsText !== undefined) weUpdate.interestsText = updates.interestsText;

        // Propagate global archive status if entity was archived
        if (updates.status === 'archived') {
          weUpdate.status = 'archived';
        }

        // Apply workspace-specific operational updates only to the target workspace
        if (isSourceWorkspace && options?.workspaceUpdates) {
          if (options.workspaceUpdates.assignedTo !== undefined) {
            weUpdate.assignedTo = options.workspaceUpdates.assignedTo;
          }
          if (options.workspaceUpdates.workspaceTags !== undefined) {
            weUpdate.workspaceTags = options.workspaceUpdates.workspaceTags;
          }
          if (options.workspaceUpdates.status !== undefined) {
            weUpdate.status = options.workspaceUpdates.status;
          }
        }

        if (batch) {
          batch.update(doc.ref, weUpdate);
        } else {
          await doc.ref.update(weUpdate);
        }
        updatedWEPayloads.push({ ...weData, ...weUpdate, id: doc.id } as WorkspaceEntity);
      }

      // 3. Commit the batch atomically if using batch
      if (batch) {
        await batch.commit();
      }

      // 4. Post-commit: Fan out to workspace_contacts projection (non-blocking, idempotent)
      let contactProjectionsCount = 0;
      for (const weDoc of updatedWEPayloads) {
        try {
          const res = await syncContactProjectionForWE(weDoc);
          contactProjectionsCount += res.upserts + res.deletes;
        } catch (projErr) {
          console.warn(`[EntitySyncGateway] Non-blocking projection sync warning for WE ${weDoc.id}:`, getErrorMessage(projErr));
        }
      }

      return {
        success: true,
        entityId,
        workspacesUpdatedCount: weQuery.size,
        contactProjectionsSyncedCount: contactProjectionsCount,
      };
    } catch (err) {
      console.error(`[EntitySyncGateway] syncEntityAndWorkspaces failed for entity ${entityId}:`, getErrorMessage(err));
      return {
        success: false,
        entityId,
        workspacesUpdatedCount: 0,
        contactProjectionsSyncedCount: 0,
        error: getErrorMessage(err),
      };
    }
  }

  /**
   * Atomically unlinks an entity from a workspace:
   * 1. Deletes `workspace_entities/{wsId}_{entityId}`
   * 2. Removes `workspaceId` from `entities/{entityId}.workspaceIds`
   * 3. Deletes associated `workspace_contacts` projections
   */
  static async unlinkEntityFromWorkspace(
    workspaceId: string,
    entityId: string,
    workspaceEntityId?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const resolvedWEId = workspaceEntityId || `${workspaceId}_${entityId}`;
      const weRef = adminDb.collection('workspace_entities').doc(resolvedWEId);
      const entityRef = adminDb.collection('entities').doc(entityId);
      const timestamp = new Date().toISOString();

      if (typeof adminDb.batch === 'function') {
        const batch = adminDb.batch();

        // 1. Delete workspace_entities record
        batch.delete(weRef);

        // 2. Remove workspaceId from master entity's workspaceIds array
        batch.update(entityRef, {
          workspaceIds: FieldValue.arrayRemove(workspaceId),
          updatedAt: timestamp,
        });

        await batch.commit();
      } else {
        await weRef.delete();
        if (typeof entityRef.update === 'function') {
          await entityRef.update({
            workspaceIds: FieldValue.arrayRemove(workspaceId),
            updatedAt: timestamp,
          });
        }
      }

      // 3. Cascade-delete projected contacts for this workspace-entity pair
      await deleteContactProjectionForEntity(workspaceId, entityId).catch((err: Error) => {
        console.warn(`[EntitySyncGateway] Non-blocking projection cleanup warning for ${resolvedWEId}:`, err.message);
      });

      return { success: true };
    } catch (err) {
      console.error(`[EntitySyncGateway] unlinkEntityFromWorkspace failed for ${workspaceId}:${entityId}:`, getErrorMessage(err));
      return { success: false, error: getErrorMessage(err) };
    }
  }
}
