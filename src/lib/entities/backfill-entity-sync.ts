/**
 * @fileOverview Universal Entity Reconciliation & Resumable Backfill Engine.
 * 
 * ARCHITECTURAL PURPOSE & CAUTION FOR MAINTAINERS (Rule 10 & Single Source of Truth):
 * In SmartSapp's Firestore data architecture, `entities` acts as the Golden Record for identity,
 * while `workspace_entities` acts as the operational projection per tenant.
 * 
 * When historical data or partial writes cause denormalized fields (such as `displayName`,
 * `displayNameLower`, `primaryEmail`, `primaryPhone`, `entityContacts`, or `location`) to drift
 * between the master `entities` and child `workspace_entities`, this engine detects and repairs
 * the discrepancies atomically.
 * 
 * FEATURES:
 * 1. Resumable Cursor-Based Pagination: Scans in bounded chunks (`PAGE_SIZE`), returning `nextCursor`.
 * 2. Dry-Run Mode: Detects and reports exact field-level differences without modifying data.
 * 3. Atomic Self-Healing: Calls `EntitySyncGateway.syncEntityAndWorkspaces` to commit changes atomically.
 * 4. Lockstep Data Enrichment: Allows backfilling fields (e.g. phone normalization, default zones)
 *    across master and projections simultaneously.
 * 
 * TESTABILITY POINTERS:
 * Tested in `src/lib/__tests__/entity-sync-invariants.test.ts`.
 */

import { adminDb } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/auth/require-auth';
import { getErrorMessage } from '@/lib/errors/report-error';
import type { Entity, WorkspaceEntity } from '@/lib/types';
import { 
  EntitySyncGateway, 
  detectEntityDrift, 
  type EntityDriftReport, 
  type EntityIdentityUpdates 
} from '@/lib/services/entity-sync-gateway';
import { zoneOrUnassigned, type ZoneRef } from '@/lib/zone-constants';

const DEFAULT_PAGE_SIZE = 100;

export interface ReconcileOptions {
  /** Maximum number of master entities to scan per page (default: 100) */
  limit?: number;
  /** Document ID cursor for resumable execution */
  afterId?: string;
  /** When true, reports drift without executing writes */
  dryRun?: boolean;
  /** Optional filter to restrict checks to a specific tenant workspace */
  workspaceId?: string;
  /** Optional enrichment payload to apply uniformly across all scanned entities */
  enrichment?: {
    defaultZone?: ZoneRef;
    customData?: Record<string, unknown>;
  };
  /** Set to true when running from an administrative CLI script */
  skipAuth?: boolean;
}

export interface ReconcileResult {
  processedEntities: number;
  driftedEntitiesCount: number;
  healedEntitiesCount: number;
  healedWorkspaceEntitiesCount: number;
  driftReports: EntityDriftReport[];
  nextCursor: string | null;
  errors: Array<{ entityId: string; error: string }>;
}

/**
 * Scans master entities and reconciles all child workspace_entities into lockstep.
 */
export async function reconcileEntitiesAndWorkspaces(
  opts?: ReconcileOptions
): Promise<ReconcileResult> {
  // SECURITY: Require authenticated admin or service context unless running from trusted CLI script
  if (!opts?.skipAuth) {
    await requireAuth();
  }

  const pageSize = opts?.limit ?? DEFAULT_PAGE_SIZE;
  const isDryRun = opts?.dryRun ?? false;

  let query = adminDb.collection('entities').orderBy('__name__').limit(pageSize) as FirebaseFirestore.Query;
  if (opts?.afterId) {
    query = query.startAfter(opts.afterId);
  }

  const entitiesSnap = await query.get();
  if (entitiesSnap.empty) {
    return {
      processedEntities: 0,
      driftedEntitiesCount: 0,
      healedEntitiesCount: 0,
      healedWorkspaceEntitiesCount: 0,
      driftReports: [],
      nextCursor: null,
      errors: [],
    };
  }

  const driftReports: EntityDriftReport[] = [];
  const errors: Array<{ entityId: string; error: string }> = [];
  let healedEntitiesCount = 0;
  let healedWorkspaceEntitiesCount = 0;

  // 1. High-speed batch query: pre-fetch workspace_entities for the entire page in chunks of 30
  const entityIds = entitiesSnap.docs.map((d) => d.id);
  const weByEntityId = new Map<string, WorkspaceEntity[]>();

  const CHUNK_SIZE = 30;
  for (let i = 0; i < entityIds.length; i += CHUNK_SIZE) {
    const chunk = entityIds.slice(i, i + CHUNK_SIZE);
    let weQuery = adminDb.collection('workspace_entities').where('entityId', 'in', chunk);
    if (opts?.workspaceId) {
      weQuery = weQuery.where('workspaceId', '==', opts.workspaceId);
    }
    const weSnap = await weQuery.get();
    weSnap.docs.forEach((doc) => {
      const we = { id: doc.id, ...doc.data() } as WorkspaceEntity;
      const list = weByEntityId.get(we.entityId) || [];
      list.push(we);
      weByEntityId.set(we.entityId, list);
    });
  }

  for (const entityDoc of entitiesSnap.docs) {
    const entity = { id: entityDoc.id, ...entityDoc.data() } as Entity;

    try {
      const linkedWEs = weByEntityId.get(entity.id) || [];

      let entityHasDrift = false;
      const entityDrifts: EntityDriftReport[] = [];

      linkedWEs.forEach((we) => {
        const drift = detectEntityDrift(entity, we);
        if (drift.hasDrift) {
          entityHasDrift = true;
          entityDrifts.push(drift);
          driftReports.push(drift);
        }
      });

      // Also verify if workspaceIds array on master entity is missing any linked workspace
      const linkedWorkspaceIds = linkedWEs.map((we) => we.workspaceId);
      const existingWorkspaceIds = new Set(entity.workspaceIds || []);
      const missingWorkspaceIds = linkedWorkspaceIds.filter((wsId) => !existingWorkspaceIds.has(wsId));

      const needsEnrichment = Boolean(
        (opts?.enrichment?.defaultZone && !entity.location?.zone) ||
        opts?.enrichment?.customData
      );

      if ((entityHasDrift || needsEnrichment) && !isDryRun) {
        // Construct identity update payload to heal projections
        const healingUpdates: EntityIdentityUpdates = {
          name: entity.name,
          entityContacts: entity.entityContacts || [],
          globalTags: entity.globalTags || [],
          status: entity.status || 'active',
          location: entity.location,
        };

        if (opts?.enrichment?.defaultZone && !entity.location?.zone) {
          healingUpdates.location = {
            ...entity.location,
            zone: zoneOrUnassigned(opts.enrichment.defaultZone),
          };
        }

        if (opts?.enrichment?.customData) {
          healingUpdates.customData = {
            ...(entity.customData || {}),
            ...opts.enrichment.customData,
          };
        }

        // Apply atomic synchronization via EntitySyncGateway
        const syncRes = await EntitySyncGateway.syncEntityAndWorkspaces(entity.id, healingUpdates);

        if (syncRes.success) {
          healedEntitiesCount++;
          healedWorkspaceEntitiesCount += syncRes.workspacesUpdatedCount;
        } else {
          errors.push({
            entityId: entity.id,
            error: syncRes.error || 'Failed to heal entity projections',
          });
        }
      }

      // If master entity was missing workspaceIds, patch it directly without heavy projection rewrite
      if (missingWorkspaceIds.length > 0 && !isDryRun) {
        const updatedWorkspaceIds = Array.from(new Set([...(entity.workspaceIds || []), ...missingWorkspaceIds]));
        await entityDoc.ref.update({
          workspaceIds: updatedWorkspaceIds,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error(`[ReconcileEntities] Error processing entity ${entity.id}:`, getErrorMessage(err));
      errors.push({
        entityId: entity.id,
        error: getErrorMessage(err),
      });
    }
  }

  const nextCursor = entitiesSnap.size === pageSize
    ? entitiesSnap.docs[entitiesSnap.docs.length - 1].id
    : null;

  return {
    processedEntities: entitiesSnap.size,
    driftedEntitiesCount: new Set(driftReports.map((d) => d.entityId)).size,
    healedEntitiesCount,
    healedWorkspaceEntitiesCount,
    driftReports,
    nextCursor,
    errors,
  };
}
