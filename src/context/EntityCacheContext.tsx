'use client';

import React, {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  type FirestoreError,
} from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { WorkspaceEntity } from '@/lib/types';

/**
 * Centralized workspace entity cache.
 *
 * Maintains a single Firestore `onSnapshot` subscription per workspace,
 * shared by all consumers. Eliminates 27+ redundant subscriptions across
 * messaging, campaigns, meetings, surveys, tasks, deals, finance, and
 * other modules.
 *
 * Architecture follows TagCacheContext pattern enhanced with:
 * - Module-level Map cache with LRU eviction (max 3 workspaces)
 * - Workspace switch guard to discard stale snapshot callbacks
 * - Error propagation matching useCollection's errorEmitter pattern
 * - Split hooks for selective re-rendering (§5.9)
 * - O(1) lookup Maps built in single iteration (§7.6, §7.13)
 *
 * @see TagCacheContext.tsx — sibling implementation for tags
 */

// ── Types ────────────────────────────────────────────────────────────────────

/** Entity with Firestore document ID merged in, matching useCollection's WithId<T> shape. */
export type CachedEntity = WorkspaceEntity & { id: string };

interface EntityCacheEntry {
  entities: CachedEntity[];
  fetchedAt: number;
}

export interface EntityCacheContextValue {
  /** All workspace entities for the active workspace, or null if not yet loaded. */
  entities: CachedEntity[] | null;
  /** True while the initial snapshot is loading. */
  isLoading: boolean;
  /** Firestore error, if the subscription failed (e.g. permission denied). */
  error: FirestoreError | Error | null;
  /** Force-invalidate the cache and re-subscribe. Use after batch mutations. */
  invalidate: () => void;
}

// ── Module-level cache (§8.1: init once, §7.4: cache function results) ───────

const STALE_TIME_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_ENTRIES = 3;

/**
 * Module-level cache shared across all provider instances.
 * Bounded to MAX_CACHE_ENTRIES to prevent memory bloat across workspace switches.
 * At 20K entities × ~3KB each = ~60MB per entry, so 3 entries = ~180MB ceiling.
 */
const entityCache = new Map<string, EntityCacheEntry>();

/** LRU eviction — remove oldest entry when cache exceeds max. */
function setCacheEntry(workspaceId: string, entry: EntityCacheEntry): void {
  // If this key already exists, delete it first so re-insertion moves it to the end (newest)
  if (entityCache.has(workspaceId)) {
    entityCache.delete(workspaceId);
  }
  entityCache.set(workspaceId, entry);

  // Evict oldest (first) entry if over capacity
  if (entityCache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = entityCache.keys().next().value;
    if (oldestKey !== undefined) {
      entityCache.delete(oldestKey);
    }
  }
}

// ── Context ──────────────────────────────────────────────────────────────────

const EntityCacheContext = createContext<EntityCacheContextValue | undefined>(
  undefined,
);

// ── Provider ─────────────────────────────────────────────────────────────────

export function EntityCacheProvider({ children }: { children: ReactNode }) {
  const firestore = useFirestore();
  // §5.7: narrow dep to primitive (activeWorkspaceId), not the full tenant object
  const { activeWorkspaceId } = useTenant();

  // §5.12: lazy state init — read cache only on first render
  const [entities, setEntities] = useState<CachedEntity[] | null>(() => {
    if (!activeWorkspaceId) return null;
    const cached = entityCache.get(activeWorkspaceId);
    if (cached && Date.now() - cached.fetchedAt < STALE_TIME_MS) {
      return cached.entities;
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState<boolean>(!entities);
  const [error, setError] = useState<FirestoreError | Error | null>(null);

  // Invalidation counter — increment to force re-subscription
  const invalidateCountRef = useRef(0);
  const [invalidateCount, setInvalidateCount] = useState(0);

  // Workspace switch guard — discard callbacks from stale subscriptions
  const activeWorkspaceRef = useRef(activeWorkspaceId);
  activeWorkspaceRef.current = activeWorkspaceId;

  useEffect(() => {
    if (!firestore || !activeWorkspaceId) {
      setEntities(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Check cache first (unless force-invalidated)
    const cached = entityCache.get(activeWorkspaceId);
    if (
      cached &&
      Date.now() - cached.fetchedAt < STALE_TIME_MS &&
      invalidateCount === invalidateCountRef.current
    ) {
      setEntities(cached.entities);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    // Single subscription — shared by ALL consumers (§4.3: dedup principle)
    // No orderBy — sorting is consumer-specific via useSortedEntities()
    const q = query(
      collection(firestore, 'workspace_entities'),
      where('workspaceId', '==', activeWorkspaceId),
    );

    // Track whether this is the initial snapshot (full download)
    let isInitialSnapshot = true;

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        // Workspace switch guard: discard if the active workspace changed
        // between when this subscription started and when the callback fired
        if (activeWorkspaceRef.current !== activeWorkspaceId) {
          return;
        }

        let result: CachedEntity[];

        if (isInitialSnapshot) {
          // First snapshot: build full array from all docs
          result = snapshot.docs.map((doc) => ({
            ...(doc.data() as WorkspaceEntity),
            id: doc.id,
          }));
          isInitialSnapshot = false;
        } else {
          // Subsequent snapshots: use docChanges() for incremental updates
          // Start from the current cached array and apply changes
          const currentEntities = entityCache.get(activeWorkspaceId)?.entities;
          if (!currentEntities) {
            // Fallback to full rebuild if cache was evicted
            result = snapshot.docs.map((doc) => ({
              ...(doc.data() as WorkspaceEntity),
              id: doc.id,
            }));
          } else {
            // Build a mutable Map from current entities for efficient patching
            const entityMap = new Map<string, CachedEntity>();
            for (const entity of currentEntities) {
              entityMap.set(entity.id, entity);
            }

            // Apply incremental changes
            for (const change of snapshot.docChanges()) {
              const docId = change.doc.id;
              if (change.type === 'removed') {
                entityMap.delete(docId);
              } else {
                // 'added' or 'modified' — upsert
                entityMap.set(docId, {
                  ...(change.doc.data() as WorkspaceEntity),
                  id: docId,
                });
              }
            }

            result = Array.from(entityMap.values());
          }
        }

        // Update module-level cache with LRU eviction
        setCacheEntry(activeWorkspaceId, {
          entities: result,
          fetchedAt: Date.now(),
        });

        setEntities(result);
        setError(null);
        setIsLoading(false);
      },
      (firestoreError: FirestoreError) => {
        // Workspace switch guard
        if (activeWorkspaceRef.current !== activeWorkspaceId) {
          return;
        }

        // Replicate useCollection's error propagation pattern
        const contextualError = new FirestorePermissionError({
          operation: 'list',
          path: `workspace_entities`,
        });

        setError(contextualError);
        setEntities(null);
        setIsLoading(false);

        // Trigger global error propagation (matches useCollection behavior)
        errorEmitter.emit('permission-error', contextualError);
      },
    );

    return () => unsubscribe();
  }, [firestore, activeWorkspaceId, invalidateCount]);

  // §5.11: functional setState for stable callback
  const invalidate = useMemo(
    () => () => {
      if (activeWorkspaceId) {
        entityCache.delete(activeWorkspaceId);
      }
      invalidateCountRef.current += 1;
      setInvalidateCount((c) => c + 1);
    },
    [activeWorkspaceId],
  );

  // Memoize context value to prevent unnecessary consumer re-renders
  const value = useMemo<EntityCacheContextValue>(
    () => ({ entities, isLoading, error, invalidate }),
    [entities, isLoading, error, invalidate],
  );

  return (
    <EntityCacheContext.Provider value={value}>
      {children}
    </EntityCacheContext.Provider>
  );
}

// ── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Primary hook: raw entity list + loading/error state + invalidation.
 * Use this when you need the full entity array without sorting/filtering.
 *
 * Must be used within an EntityCacheProvider.
 */
export function useEntityCache(): EntityCacheContextValue {
  const ctx = useContext(EntityCacheContext);
  if (!ctx) {
    throw new Error(
      'useEntityCache must be used within an EntityCacheProvider',
    );
  }
  return ctx;
}

/**
 * Derived hook: O(1) lookup Maps keyed by document `id` and `entityId`.
 * Built in a single iteration (§7.6: combine iterations, §7.13: Set/Map for lookups).
 *
 * Split from primary hook (§5.9) — consumers who only need lookups
 * don't re-render on entity array changes unless the Map entries change.
 */
export function useEntityLookup() {
  const { entities } = useEntityCache();

  // §5.1: derived state during render, not useEffect
  const { byId, byEntityId } = useMemo(() => {
    const byId = new Map<string, CachedEntity>();
    const byEntityId = new Map<string, CachedEntity>();

    if (entities) {
      // §7.6: single iteration builds both maps
      for (const entity of entities) {
        byId.set(entity.id, entity);
        if (entity.entityId) {
          byEntityId.set(entity.entityId, entity);
        }
      }
    }

    return { byId, byEntityId };
  }, [entities]);

  return { byId, byEntityId, entities };
}

/**
 * Derived hook: entities sorted by displayName (ascending).
 * Replaces queries that used `orderBy('displayName', 'asc')`.
 *
 * For dropdowns, selectors, and any UI that needs alphabetical order.
 */
export function useSortedEntities() {
  const { entities, isLoading, error } = useEntityCache();

  const sortedEntities = useMemo(
    () =>
      entities
        ?.toSorted((a, b) =>
          (a.displayName || '').localeCompare(b.displayName || ''),
        ) ?? null,
    [entities],
  );

  return { sortedEntities, isLoading, error };
}

/**
 * Derived hook: only entities with status === 'active'.
 * Pre-filtered to avoid repeated .filter() calls in consumers.
 *
 * §5.10: subscribe to derived state (active status), not raw values.
 */
export function useActiveEntities() {
  const { entities, isLoading, error } = useEntityCache();

  const activeEntities = useMemo(
    () => entities?.filter((e) => e.status === 'active') ?? null,
    [entities],
  );

  return { activeEntities, isLoading, error };
}

// ── Test Utilities ───────────────────────────────────────────────────────────

/**
 * Test-only provider that bypasses Firestore entirely.
 * Accepts pre-populated entity data for unit testing consumers.
 *
 * @example
 * ```tsx
 * render(
 *   <EntityCacheTestProvider value={{ entities: mockEntities, isLoading: false, error: null, invalidate: vi.fn() }}>
 *     <ComponentUnderTest />
 *   </EntityCacheTestProvider>
 * );
 * ```
 */
export function EntityCacheTestProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: Partial<EntityCacheContextValue>;
}) {
  const defaultValue: EntityCacheContextValue = {
    entities: null,
    isLoading: false,
    error: null,
    invalidate: () => {},
    ...value,
  };

  return (
    <EntityCacheContext.Provider value={defaultValue}>
      {children}
    </EntityCacheContext.Provider>
  );
}

/**
 * Factory function for creating mock EntityCacheContextValues in tests.
 *
 * @example
 * ```tsx
 * const mockValue = createMockEntityCacheValue({
 *   entities: [{ id: '1', displayName: 'Test', ... }],
 * });
 * ```
 */
export function createMockEntityCacheValue(
  overrides: Partial<EntityCacheContextValue> = {},
): EntityCacheContextValue {
  return {
    entities: null,
    isLoading: false,
    error: null,
    invalidate: () => {},
    ...overrides,
  };
}
