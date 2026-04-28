/**
 * LRU cache for workspace industry lookups.
 *
 * Implements Requirements 2.1–2.6, 1.4:
 * - Caches workspace industry and scope-lock status to avoid repeated Firestore reads
 * - TTL: 5 minutes (300,000ms)
 * - Max size: 500 entries (evicts oldest on overflow)
 * - `invalidateWorkspaceCache` is called on workspace updates to keep cache consistent
 *
 * Feature: industry-scoped-entity-expansion
 */

import { adminDb } from './firebase-admin';
import type { IndustryVertical } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Cache entry shape
// ─────────────────────────────────────────────────────────────────────────────

interface WorkspaceIndustryCacheEntry {
  industry: IndustryVertical;
  industryScopeLocked: boolean;
  cachedAt: number; // Date.now() timestamp
}

// ─────────────────────────────────────────────────────────────────────────────
// LRU Cache implementation (Map-based, insertion-order eviction)
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_MAX_SIZE = 500;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Map preserves insertion order, so the first key is always the oldest entry.
 * On overflow we delete the first (oldest) key — O(1) amortised.
 */
const cache = new Map<string, WorkspaceIndustryCacheEntry>();

function isExpired(entry: WorkspaceIndustryCacheEntry): boolean {
  return Date.now() - entry.cachedAt > CACHE_TTL_MS;
}

function setEntry(workspaceId: string, entry: WorkspaceIndustryCacheEntry): void {
  // If the key already exists, delete it first so re-insertion moves it to the end
  if (cache.has(workspaceId)) {
    cache.delete(workspaceId);
  }

  // Evict oldest entry when at capacity
  if (cache.size >= CACHE_MAX_SIZE) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) {
      cache.delete(oldestKey);
    }
  }

  cache.set(workspaceId, entry);
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the industry and scope-lock status for a workspace.
 *
 * Checks the LRU cache first; on a miss (or TTL expiry) fetches from Firestore
 * and populates the cache.
 *
 * @throws Error if the workspace document does not exist or has no `industry` field.
 */
export async function getWorkspaceIndustry(
  workspaceId: string
): Promise<{ industry: IndustryVertical; industryScopeLocked: boolean }> {
  // Cache hit
  const cached = cache.get(workspaceId);
  if (cached && !isExpired(cached)) {
    return { industry: cached.industry, industryScopeLocked: cached.industryScopeLocked };
  }

  // Cache miss — fetch from Firestore
  const snap = await adminDb.collection('workspaces').doc(workspaceId).get();

  if (!snap.exists) {
    throw new Error(`Workspace "${workspaceId}" not found`);
  }

  const data = snap.data() as Record<string, unknown>;

  if (!data.industry) {
    throw new Error(`Workspace "${workspaceId}" has no industry field`);
  }

  const entry: WorkspaceIndustryCacheEntry = {
    industry: data.industry as IndustryVertical,
    industryScopeLocked: Boolean(data.industryScopeLocked),
    cachedAt: Date.now(),
  };

  setEntry(workspaceId, entry);

  return { industry: entry.industry, industryScopeLocked: entry.industryScopeLocked };
}

/**
 * Removes a workspace entry from the cache.
 *
 * Call this whenever a workspace document is updated (e.g., after locking the
 * industry scope) so the next read fetches fresh data from Firestore.
 */
export function invalidateWorkspaceCache(workspaceId: string): void {
  cache.delete(workspaceId);
}

/**
 * Exposed for testing only — clears the entire cache.
 * @internal
 */
export function _clearCacheForTesting(): void {
  cache.clear();
}
