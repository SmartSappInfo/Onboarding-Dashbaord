/**
 * @fileOverview Server-only data access for dashboard widgets.
 *
 * Replaces the previous "fetch all entities, reduce in JS" pattern (which read
 * and transferred every full `workspace_entities` document — catastrophic at
 * 50k) with:
 *   • `count()` / `sum()` aggregation queries — zero document transfer;
 *   • a **field projection** (`.select(...)`) for the group-by widgets — exact
 *     same aggregation semantics on a payload ~10-50× smaller than full docs;
 *   • `getEntitiesByIds` — resolve only the handful of entities a widget
 *     actually references (e.g. the activity feed), never the whole collection.
 *
 * All reads are wrapped in `React.cache` for per-request dedup across widgets.
 * Materialized rollups (O(1)) are the planned next step — see
 * docs/superpowers/specs/2026-06-16-dashboard-scale-optimization-design.md.
 */

import { adminDb } from '../firebase-admin';
import { AggregateField } from 'firebase-admin/firestore';
import { cache } from 'react';

const COLLECTION = 'workspace_entities';

/**
 * The only fields the dashboard aggregations read. Projecting these avoids
 * transferring the large embedded structures (entityContacts[], location, …).
 */
const AGG_FIELDS = [
  'entityId',
  'displayName',
  'nominalRoll', // denormalized capacity (see entity-actions: capacity write-through)
  'zone',
  'assignedTo',
  'modules',
  'addedAt',
  'createdAt',
  'stageId',
  'status',
] as const;

/** A lightweight projection of an entity — only the fields dashboard widgets read. */
export interface EntityProjection {
  id: string;
  entityId?: string;
  displayName?: string;
  nominalRoll?: number; // denormalized capacity
  zone?: { id?: string; name?: string } | null;
  assignedTo?: { userId?: string } | null;
  modules?: Array<{ id: string; name: string; abbreviation: string }>;
  addedAt?: string;
  createdAt?: string;
  stageId?: string;
  status?: string;
}

function activeEntitiesQuery(workspaceId: string) {
  return adminDb
    .collection(COLLECTION)
    .where('workspaceId', '==', workspaceId)
    .where('status', '!=', 'archived');
}

/** Total active entities — server-side `count()`, no document reads. */
export const countActiveEntities = cache(async (workspaceId: string): Promise<number> => {
  const snap = await activeEntitiesQuery(workspaceId).count().get();
  return snap.data().count;
});

/** Total capacity across active entities — server-side `sum()`, no document reads. */
export const sumActiveCapacity = cache(async (workspaceId: string): Promise<number> => {
  try {
    const snap = await activeEntitiesQuery(workspaceId)
      .aggregate({ total: AggregateField.sum('nominalRoll') })
      .get();
    return snap.data().total ?? 0;
  } catch (error) {
    console.warn("sumActiveCapacity aggregate query failed, falling back to in-memory calculation:", error);
    const entities = await getEntityProjections(workspaceId);
    return entities.reduce((sum, we) => sum + (we.nominalRoll || 0), 0);
  }
});

/**
 * Active entities projected to the aggregation fields only. Same rows the old
 * `getWorkspaceEntities` returned, but without the heavy embedded payloads —
 * group-by widgets keep identical semantics at a fraction of the transfer cost.
 */
export const getEntityProjections = cache(async (workspaceId: string): Promise<EntityProjection[]> => {
  const snap = await activeEntitiesQuery(workspaceId)
    .select(...AGG_FIELDS)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as EntityProjection);
});

/**
 * Resolve only the entities referenced by ids (deduped). Used by the activity
 * feed instead of loading and serializing the whole collection to the client.
 */
export const getEntitiesByIds = async (ids: string[]): Promise<EntityProjection[]> => {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return [];
  const refs = unique.map((id) => adminDb.collection(COLLECTION).doc(id));
  const docs = await adminDb.getAll(...refs);
  return docs
    .filter((d) => d.exists)
    .map((d) => ({ id: d.id, ...d.data() }) as EntityProjection);
};
