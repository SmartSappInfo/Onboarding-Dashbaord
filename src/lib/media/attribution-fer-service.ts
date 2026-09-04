/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Attribution FER (Fetch-Enrich-Restore) Engine:
 *    - Recomputes workspace attribution records across deals and media engagement telemetry.
 *    - Persists normalized multi-touch records into the `media_attributions` collection.
 * 2. High Load & Chunked Batch Write Safety:
 *    - Firestore batch writes are strictly capped at 150 operations per commit (well below 500 limit).
 * 3. Idempotent & Self-Healing:
 *    - Uses deterministic document IDs `attr_${dealId}_${assetId}` to enable safe idempotent recomputation.
 * 4. Strict Typing Standard:
 *    - Zero use of `any` or `any[]`.
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  writeBatch,
  query,
  where,
  limit,
  type Firestore,
} from 'firebase/firestore';
import type {
  AttributionModelType,
  MediaAttribution,
  EvidenceReference,
} from '../types/media-2.0';
import type { Deal, MediaAsset } from '../types';
import {
  calculateAttributionWeights,
  getAttributionGovernanceConfigAction,
  type AttributionTouchpoint,
} from './attribution-service';

export interface AttributionRecomputeSummary {
  totalDealsScanned: number;
  totalDealsInfluenced: number;
  totalAttributionsComputed: number;
  totalBatchesCommitted: number;
  success: boolean;
  errorMessage?: string;
}

interface RawEventDoc {
  id: string;
  shareId?: string;
  assetId?: string;
  type?: string;
  contactId?: string;
  progressPercent?: number;
  sessionTimeSeconds?: number;
  createdAt?: string;
  timestamp?: string;
  workspaceId?: string;
}

const CHUNK_SIZE = 150;

/**
 * Recomputes and persists attribution records across all workspace deals.
 * Enforces chunked batch writes of at most 150 operations per batch.
 */
export async function recomputeAttributionAction(
  firestore: Firestore,
  workspaceId: string,
  targetModel?: AttributionModelType
): Promise<AttributionRecomputeSummary> {
  if (!firestore || !workspaceId) {
    return {
      totalDealsScanned: 0,
      totalDealsInfluenced: 0,
      totalAttributionsComputed: 0,
      totalBatchesCommitted: 0,
      success: false,
      errorMessage: 'Missing firestore instance or workspaceId',
    };
  }

  try {
    // 1. Fetch Governance Config to resolve active attribution model & lookback
    const config = await getAttributionGovernanceConfigAction(firestore, workspaceId);
    const activeModel = targetModel || config.defaultModel || 'LINEAR';
    const lookbackDays = config.defaultLookbackDays || 90;
    const lookbackThresholdMs = Date.now() - lookbackDays * 24 * 60 * 60 * 1000;

    // 2. Fetch Assets in Workspace
    const assetsQuery = query(
      collection(firestore, 'media'),
      where('workspaceId', '==', workspaceId),
      limit(500)
    );
    const assetsSnap = await getDocs(assetsQuery);
    const assetMetaMap = new Map<string, { title: string; type: MediaAsset['type'] }>();
    assetsSnap.docs.forEach((docSnap) => {
      const d = docSnap.data();
      assetMetaMap.set(docSnap.id, {
        title: (d.title as string) || (d.name as string) || 'Untitled Asset',
        type: (d.type as MediaAsset['type']) || 'video',
      });
    });

    // 3. Fetch Workspace Deals
    const dealsQuery = query(
      collection(firestore, 'deals'),
      where('workspaceId', '==', workspaceId),
      limit(500)
    );
    const dealsSnap = await getDocs(dealsQuery);
    const deals: Deal[] = dealsSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Deal[];

    // 4. Fetch Workspace Media Events
    let rawEvents: RawEventDoc[] = [];
    try {
      const eventsQuery = query(
        collection(firestore, 'media_events'),
        where('workspaceId', '==', workspaceId),
        limit(2500)
      );
      const eventsSnap = await getDocs(eventsQuery);
      rawEvents = eventsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as RawEventDoc[])
        .filter((e) => {
          const t = e.createdAt || e.timestamp;
          return !t || new Date(t).getTime() >= lookbackThresholdMs;
        });
    } catch {
      rawEvents = [];
    }

    // 5. Build Contact to Touchpoints HashMap
    const contactTouchpointsMap = new Map<string, AttributionTouchpoint[]>();
    const contactEventsMap = new Map<string, RawEventDoc[]>();

    for (const ev of rawEvents) {
      if (ev.contactId && ev.assetId) {
        if (!contactTouchpointsMap.has(ev.contactId)) {
          contactTouchpointsMap.set(ev.contactId, []);
          contactEventsMap.set(ev.contactId, []);
        }
        contactEventsMap.get(ev.contactId)!.push(ev);

        const assetInfo = assetMetaMap.get(ev.assetId);
        contactTouchpointsMap.get(ev.contactId)!.push({
          assetId: ev.assetId,
          assetTitle: assetInfo?.title,
          assetType: assetInfo?.type,
          timestamp: ev.createdAt || ev.timestamp || new Date().toISOString(),
          type: ev.type || 'view',
          progressPercent: ev.progressPercent,
          durationSeconds: ev.sessionTimeSeconds,
        });
      }
    }

    // 6. Compute Attributions per Deal
    const attributionsToSave: MediaAttribution[] = [];
    let influencedDealsCount = 0;

    for (const deal of deals) {
      const associatedContacts: string[] = [];
      if (deal.contacts && Array.isArray(deal.contacts)) {
        deal.contacts.forEach((c) => {
          if (c.contactId) associatedContacts.push(c.contactId);
        });
      }
      if (deal.focalContacts && Array.isArray(deal.focalContacts)) {
        deal.focalContacts.forEach((c) => {
          if (c.contactId) associatedContacts.push(c.contactId);
        });
      }

      const dealTouchpoints: AttributionTouchpoint[] = [];
      const dealRawEvents: RawEventDoc[] = [];

      associatedContacts.forEach((cId) => {
        const tps = contactTouchpointsMap.get(cId) || [];
        dealTouchpoints.push(...tps);
        const evs = contactEventsMap.get(cId) || [];
        dealRawEvents.push(...evs);
      });

      if (dealTouchpoints.length === 0) continue;

      influencedDealsCount++;
      const dealAmount = Number(deal.value) || 0;
      const isClosedWon = deal.status === 'won';

      const weightsMap = calculateAttributionWeights(
        dealTouchpoints,
        activeModel,
        deal.contractSignedAt || undefined
      );

      weightsMap.forEach((calc, assetId) => {
        const meta = assetMetaMap.get(assetId);
        const docId = `attr_${deal.id}_${assetId}`;

        // Find relevant evidence events for this asset
        const evidence: EvidenceReference[] = dealRawEvents
          .filter((e) => e.assetId === assetId)
          .slice(0, 5)
          .map((e) => ({
            eventId: e.id,
            timestamp: e.createdAt || e.timestamp || new Date().toISOString(),
            type: e.type || 'view',
            progressPercent: e.progressPercent,
          }));

        attributionsToSave.push({
          id: docId,
          workspaceId,
          assetId,
          assetTitle: meta?.title || 'Unknown Media Asset',
          assetType: meta?.type || 'video',
          contactId: associatedContacts[0],
          dealId: deal.id,
          dealTitle: deal.name || 'Untitled Deal',
          dealAmount,
          dealCurrency: deal.currency || config.currencySymbol || 'GH₵',
          dealStage: deal.stageName || deal.status,
          isClosedWon,
          attributionType: calc.attributionType,
          model: activeModel,
          weight: calc.weight,
          attributedRevenue: Math.round(calc.weight * dealAmount * 100) / 100,
          evidence,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      });
    }

    // 7. Commit Records to Firestore with Chunked Batching (<= 150 ops)
    let currentBatch = writeBatch(firestore);
    let batchOpCount = 0;
    let totalBatchesCommitted = 0;

    for (const attr of attributionsToSave) {
      const docRef = doc(firestore, 'media_attributions', attr.id);
      currentBatch.set(docRef, attr, { merge: true });
      batchOpCount++;

      if (batchOpCount >= CHUNK_SIZE) {
        await currentBatch.commit();
        totalBatchesCommitted++;
        currentBatch = writeBatch(firestore);
        batchOpCount = 0;
      }
    }

    if (batchOpCount > 0) {
      await currentBatch.commit();
      totalBatchesCommitted++;
    }

    return {
      totalDealsScanned: deals.length,
      totalDealsInfluenced: influencedDealsCount,
      totalAttributionsComputed: attributionsToSave.length,
      totalBatchesCommitted,
      success: true,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown recompute error';
    console.error('[recomputeAttributionAction] Error:', err);
    return {
      totalDealsScanned: 0,
      totalDealsInfluenced: 0,
      totalAttributionsComputed: 0,
      totalBatchesCommitted: 0,
      success: false,
      errorMessage: message,
    };
  }
}
