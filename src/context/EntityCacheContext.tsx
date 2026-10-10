'use client';

import React, {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
} from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import { chunkIds, dedupeIds } from '@/lib/entities/entity-cache-domain';
import type { WorkspaceEntity } from '@/lib/types';

/**
 * Entity **resolver** (Phase 6.6).
 *
 * The unbounded per-workspace `onSnapshot` that streamed every
 * `workspace_entities` doc to every admin browser has been REMOVED — it didn't
 * scale (≈60MB/workspace at 20K entities) and froze the UI at 50K. All consumers
 * now either:
 *   • resolve a handful of entities by id (`useEntityResolver` / `useEntityByDocId`), or
 *   • page/search server-side (`useEntitySearch` / `useContactSearch` + the
 *     `workspace_contacts` projection).
 *
 * This context retains only the on-demand, batched, cached **resolve-by-id**
 * path — O(referenced), never O(collection).
 *
 * @see docs/superpowers/specs/2026-06-16-entity-cache-scale-design.md
 */

/** Entity with its Firestore document id merged in. */
export type CachedEntity = WorkspaceEntity & { id: string };

export interface EntityCacheContextValue {
  /**
   * Resolve specific entities by their canonical `entityId` (deduped, batched
   * by chunks of 30, cached per workspace) — O(referenced), not O(collection).
   */
  resolve: (entityIds: string[]) => Promise<Map<string, CachedEntity>>;
}

const EntityCacheContext = createContext<EntityCacheContextValue | undefined>(undefined);

export function EntityCacheProvider({ children }: { children: ReactNode }) {
  const firestore = useFirestore();
  const { activeWorkspaceId } = useTenant();

  // Per-workspace by-entityId cache for `resolve`.
  // Stores CachedEntity if found, or null if queried and not found (negative caching).
  const resolveCacheRef = useRef<Map<string, CachedEntity | null>>(new Map());
  useEffect(() => {
    resolveCacheRef.current = new Map(); // reset on workspace switch
  }, [activeWorkspaceId]);

  const resolve = useCallback(
    async (entityIds: string[]): Promise<Map<string, CachedEntity>> => {
      const result = new Map<string, CachedEntity>();
      if (!firestore || !activeWorkspaceId) return result;

      const wanted = dedupeIds(entityIds);
      const missing: string[] = [];
      for (const id of wanted) {
        if (resolveCacheRef.current.has(id)) {
          const cached = resolveCacheRef.current.get(id);
          if (cached) result.set(id, cached);
          // If null, it was already queried and not found; do not re-query
        } else {
          missing.push(id);
        }
      }
      if (missing.length === 0) return result;

      // Batched `entityId in [...]` queries (≤30 per chunk), run concurrently.
      await Promise.all(
        chunkIds(missing, 30).map(async (chunk) => {
          // Pre-populate missing chunk IDs as null in the cache
          // Any documents that are returned will overwrite with the real CachedEntity.
          for (const id of chunk) {
            resolveCacheRef.current.set(id, null);
          }

          try {
            const snap = await getDocs(
              query(
                collection(firestore, 'workspace_entities'),
                where('workspaceId', '==', activeWorkspaceId),
                where('entityId', 'in', chunk),
              ),
            );
            for (const d of snap.docs) {
              const ent = { ...(d.data() as WorkspaceEntity), id: d.id } as CachedEntity;
              if (ent.entityId) {
                resolveCacheRef.current.set(ent.entityId, ent);
                result.set(ent.entityId, ent);
              }
            }
          } catch (err: unknown) {
            // If quota is exhausted or query fails, leave as null to prevent tight re-query loops
            console.warn('[EntityCache] Failed to fetch entity chunk:', err);
          }
        }),
      );
      return result;
    },
    [firestore, activeWorkspaceId],
  );

  const value = useMemo<EntityCacheContextValue>(() => ({ resolve }), [resolve]);

  return <EntityCacheContext.Provider value={value}>{children}</EntityCacheContext.Provider>;
}

/**
 * Resolve specific entities by `entityId` on demand — batched, deduped, cached —
 * without loading the whole workspace. Returns `entitiesById` (accumulated) and
 * `resolveIds(ids)` to request more.
 */
export function useEntityResolver() {
  const ctx = useContext(EntityCacheContext);
  if (!ctx) {
    throw new Error('useEntityResolver must be used within an EntityCacheProvider');
  }
  const { resolve } = ctx;
  const [entitiesById, setEntitiesById] = useState<Map<string, CachedEntity>>(new Map());

  const resolveIds = useCallback(
    async (entityIds: string[]) => {
      const resolved = await resolve(entityIds);
      if (resolved.size > 0) {
        setEntitiesById((prev) => {
          let hasNew = false;
          resolved.forEach((v, k) => {
            if (!prev.has(k) || prev.get(k) !== v) {
              hasNew = true;
            }
          });
          if (!hasNew) return prev;
          const next = new Map(prev);
          resolved.forEach((v, k) => next.set(k, v));
          return next;
        });
      }
      return resolved;
    },
    [resolve],
  );

  return { entitiesById, resolveIds };
}

/**
 * Resolve a SINGLE entity by its workspace_entities **document id**, reactively.
 * The doc-id sibling of `useEntityResolver` (which keys by `entityId`).
 */
export function useEntityByDocId(id: string | null | undefined): CachedEntity | null {
  const firestore = useFirestore();
  const [entity, setEntity] = useState<CachedEntity | null>(null);

  useEffect(() => {
    if (!firestore || !id || id === 'none') {
      setEntity(null);
      return;
    }
    let active = true;
    getDoc(doc(firestore, 'workspace_entities', id))
      .then((snap) => {
        if (active) setEntity(snap.exists() ? ({ ...(snap.data() as WorkspaceEntity), id: snap.id }) : null);
      })
      .catch(() => {
        if (active) setEntity(null);
      });
    return () => {
      active = false;
    };
  }, [firestore, id]);

  return entity;
}
