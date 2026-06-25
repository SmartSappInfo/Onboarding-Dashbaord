/**
 * @fileOverview Pure helpers for the entity cache / resolver (no I/O).
 * Foundation for Phase 5 of the dashboard scale work — see
 * docs/superpowers/specs/2026-06-16-entity-cache-scale-design.md.
 */

/** Unique, truthy ids in first-seen order. */
export function dedupeIds(ids: Array<string | null | undefined>): string[] {
  return [...new Set(ids.filter((x): x is string => !!x))];
}

/**
 * Canonical search key for an entity name — used BOTH to denormalize
 * `displayNameLower` on write and to normalize the user's query, so
 * case-insensitive prefix search matches. Trim + lowercase + collapse spaces.
 */
export function toSearchKey(name: string | null | undefined): string {
  return (name ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Stamps the denormalized search field(s) onto a `workspace_entities` write
 * payload, derived from its `displayName`. Every path that writes a WE doc's
 * `displayName` MUST funnel through this so `displayNameLower` can never drift
 * out of sync again — that drift left ~5% of entities invisible to the
 * paginated entity search (see backfill-display-name-lower).
 *
 * Pure + isomorphic (no I/O), so it's safe in both client and Admin SDK write
 * paths, and in direct `.set`/`.add` as well as batched writes. Returns a new
 * object; never mutates the input.
 */
export function withEntitySearchFields<T extends { displayName?: string | null }>(
  doc: T,
): T & { displayNameLower: string } {
  return { ...doc, displayNameLower: toSearchKey(doc.displayName) };
}

/** Dedupe then split into chunks (default 30 — Firestore `in` limit). */
export function chunkIds(ids: Array<string | null | undefined>, size = 30): string[][] {
  const unique = dedupeIds(ids);
  const out: string[][] = [];
  for (let i = 0; i < unique.length; i += size) {
    out.push(unique.slice(i, i + size));
  }
  return out;
}

interface IndexableEntity {
  id: string;
  entityId?: string;
  [k: string]: unknown;
}

/** Build `byId` (doc id) and `byEntityId` (canonical entity id) lookup maps. */
export function buildEntityMaps<T extends IndexableEntity>(
  entities: T[],
): { byId: Map<string, T>; byEntityId: Map<string, T> } {
  const byId = new Map<string, T>();
  const byEntityId = new Map<string, T>();
  for (const e of entities) {
    byId.set(e.id, e);
    if (e.entityId) byEntityId.set(e.entityId, e);
  }
  return { byId, byEntityId };
}
