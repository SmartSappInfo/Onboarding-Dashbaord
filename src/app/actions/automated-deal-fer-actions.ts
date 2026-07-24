'use server';

/**
 * Server Action Module: Automated Event Deal FER (Fetch, Enrich & Restore) Protocol
 *
 * ARCHITECTURAL PURPOSE & DESIGN SPECIFICATION:
 * Existing deal records created by automated message triggers (e.g. email open events)
 * were assigned generic default titles ("Automated Event Deal") and lacked contact/entity linking.
 * This module provides a production-grade FER protocol to:
 * 1. FETCH candidate deals matching "Automated Event Deal" from Firestore.
 * 2. ENRICH deal records using target WorkspaceEntity (displayName, primary contact from entity.entityContacts).
 * 3. RESTORE enriched deal documents to Firestore in chunked, safe batches (limit: 400 ops per batch).
 *
 * WORKSPACE RULES & COMPLIANCE:
 * - Single Source of Truth for contacts: Route exclusively through `entity.entityContacts` (Requirement 18 & FER-01).
 *   Deprecated `focalContacts` on WorkspaceEntity must NOT be accessed.
 * - Strict Typing: Zero `any` or `any[]` throughout.
 * - Performance & Batch Safety: Chunk writes in 400-item batches to prevent Firestore 500-op limits (Rule 9).
 * - Scoping: Supports optional `workspaceId` filtering for multi-tenant safety (Rule 8).
 * - Testability Pointer: Test `enrichDealData` independently with mock deals and entities.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { Query, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import type { Deal, WorkspaceEntity, EntityContact, DealFocalContact } from '@/lib/types';

export interface AutomatedDealFERCandidate {
  dealId: string;
  workspaceId: string;
  entityId: string;
  currentName: string;
  currentDescription?: string | null;
}

export interface EnrichedDealPayload {
  dealId: string;
  newName: string;
  description?: string | null;
  focalContacts?: DealFocalContact[];
}

export interface AutomatedDealFERResult {
  totalCandidates: number;
  succeeded: number;
  failed: number;
  skipped: number;
  enrichedDeals: Array<{
    dealId: string;
    oldName: string;
    newName: string;
    primaryContactName?: string;
  }>;
  errors: string[];
}

/**
 * FETCH STAGE:
 * Scans Firestore `deals` collection for candidate records containing "Automated Event Deal".
 *
 * CAUTION FOR MAINTAINERS:
 * When `workspaceId` is provided, queries are scoped strictly to that tenant.
 * When omitted, performs a global scan across all workspace deals.
 */
export async function fetchCandidateDealsForFER(
  workspaceId?: string
): Promise<AutomatedDealFERCandidate[]> {
  try {
    let query: Query = adminDb.collection('deals');

    if (workspaceId) {
      query = query.where('workspaceId', '==', workspaceId);
    }

    const snap = await query.get();
    const candidates: AutomatedDealFERCandidate[] = [];

    snap.forEach((docSnap: QueryDocumentSnapshot) => {
      const data = docSnap.data() as Partial<Deal>;
      const name = data.name || '';

      // Match deals with generic default names or missing entity naming
      if (name.toLowerCase().includes('automated event deal')) {
        candidates.push({
          dealId: docSnap.id,
          workspaceId: data.workspaceId || '',
          entityId: data.entityId || '',
          currentName: name,
          currentDescription: data.description || null,
        });
      }
    });

    return candidates;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch candidate deals for FER';
    console.error('❌ [FER:FETCH] Error scanning candidate deals:', msg);
    throw new Error(msg);
  }
}

/**
 * ENRICH STAGE:
 * Transforms a raw deal record by looking up its associated `WorkspaceEntity` and resolving:
 * 1. `newName`: "${entityName} - Opened Email"
 * 2. `focalContacts`: Primary contact from `entity.entityContacts` (Single Source of Truth)
 * 3. `description`: Structured email engagement summary if empty
 *
 * ARCHITECTURAL CAUTION:
 * Uses dual-key lookup (`${workspaceId}_${entityId}` as primary, `entityId` as fallback)
 * because legacy entity documents may be keyed under either convention.
 */
export function enrichDealData(
  candidate: AutomatedDealFERCandidate,
  entity: WorkspaceEntity
): EnrichedDealPayload {
  // 1. Dynamic Entity Name Resolution
  const entityName =
    entity.displayName ||
    (entity as unknown as Record<string, string>).name ||
    (entity as unknown as Record<string, string>).entityName ||
    'Entity';

  const newName = `${entityName} - Opened Email`;

  // 2. Primary Contact Resolution (Canonical entity.entityContacts)
  let resolvedFocalContacts: DealFocalContact[] = [];
  const entityContacts: EntityContact[] = entity.entityContacts || [];

  if (entityContacts.length > 0) {
    const primaryContact = entityContacts.find((c) => c.isPrimary) || entityContacts[0];
    resolvedFocalContacts = [
      {
        id: primaryContact.id,
        name: primaryContact.name,
        role: primaryContact.typeLabel || undefined,
        email: primaryContact.email || undefined,
        phone: primaryContact.phone || undefined,
      },
    ];
  }

  // 3. Description Enrichment
  let description = candidate.currentDescription || null;
  if (!description) {
    description = 'Opened Email: "Automated Email Engagement"';
  }

  return {
    dealId: candidate.dealId,
    newName,
    description,
    ...(resolvedFocalContacts.length > 0 ? { focalContacts: resolvedFocalContacts } : {}),
  };
}

/**
 * RESTORE STAGE & FULL EXECUTION:
 * Runs the full Fetch, Enrich & Restore (FER) protocol:
 * 1. Fetches candidate deals.
 * 2. Fetches matching entities via batched dual-key lookups.
 * 3. Enriches deal properties.
 * 4. Restores enriched deal documents to Firestore in batches of 400.
 */
export async function runAutomatedDealFERProtocol(
  workspaceId?: string
): Promise<AutomatedDealFERResult> {
  const result: AutomatedDealFERResult = {
    totalCandidates: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    enrichedDeals: [],
    errors: [],
  };

  try {
    console.log('🚀 [FER:START] Initiating Automated Deal FER Protocol...');
    const candidates = await fetchCandidateDealsForFER(workspaceId);
    result.totalCandidates = candidates.length;

    console.log(`📊 [FER:FETCH] Found ${candidates.length} candidate deals matching FER criteria.`);

    if (candidates.length === 0) {
      console.log('✅ [FER:DONE] No candidate deals require enrichment.');
      return result;
    }

    const chunkLimit = 400; // Safety boundary below Firestore's 500 ops per batch limit

    for (let i = 0; i < candidates.length; i += chunkLimit) {
      const chunk = candidates.slice(i, i + chunkLimit);

      // Gather entity references using dual-key strategy
      const primaryEntityRefs = chunk.map((c) =>
        adminDb.collection('workspace_entities').doc(`${c.workspaceId}_${c.entityId}`)
      );

      const entitySnapshots = await adminDb.getAll(...primaryEntityRefs);
      const batch = adminDb.batch();

      for (let idx = 0; idx < chunk.length; idx++) {
        const candidate = chunk[idx];
        let entitySnap = entitySnapshots[idx];

        // Dual-key fallback lookup
        if (!entitySnap || !entitySnap.exists) {
          try {
            const fallbackSnap = await adminDb
              .collection('workspace_entities')
              .doc(candidate.entityId)
              .get();
            if (fallbackSnap.exists) {
              entitySnap = fallbackSnap;
            } else {
              result.skipped++;
              result.errors.push(
                `Entity ${candidate.entityId} not found for deal ${candidate.dealId}`
              );
              continue;
            }
          } catch (e: unknown) {
            result.skipped++;
            const errStr = e instanceof Error ? e.message : 'Fallback entity fetch failed';
            result.errors.push(`Deal ${candidate.dealId} entity lookup error: ${errStr}`);
            continue;
          }
        }

        const entity = entitySnap.data() as WorkspaceEntity;
        const enriched = enrichDealData(candidate, entity);

        const dealRef = adminDb.collection('deals').doc(candidate.dealId);
        const updatePayload: Record<string, unknown> = {
          name: enriched.newName,
          updatedAt: new Date().toISOString(),
        };

        if (enriched.description) {
          updatePayload.description = enriched.description;
        }

        if (enriched.focalContacts && enriched.focalContacts.length > 0) {
          updatePayload.focalContacts = enriched.focalContacts;
        }

        batch.update(dealRef, updatePayload);
        result.succeeded++;
        result.enrichedDeals.push({
          dealId: candidate.dealId,
          oldName: candidate.currentName,
          newName: enriched.newName,
          primaryContactName: enriched.focalContacts?.[0]?.name,
        });
      }

      await batch.commit();
      console.log(`💾 [FER:RESTORE] Committed batch ${Math.floor(i / chunkLimit) + 1}`);
    }

    console.log(`🎉 [FER:DONE] Successfully enriched ${result.succeeded} deals.`);
    return result;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Automated Deal FER protocol failed';
    console.error('❌ [FER:FATAL] Protocol execution failed:', msg);
    result.failed++;
    result.errors.push(msg);
    return result;
  }
}
