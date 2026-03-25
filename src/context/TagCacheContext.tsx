'use client';

import React, {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { Tag } from '@/lib/types';

/**
 * Shared tag cache context.
 * Maintains a single Firestore subscription per workspace and caches results
 * in memory with a configurable stale time (default 5 minutes).
 * All components that need tags should use this context instead of creating
 * their own subscriptions.
 *
 * Requirements: NFR1.3
 */

const STALE_TIME_MS = 5 * 60 * 1000; // 5 minutes

interface TagCacheEntry {
  tags: Tag[];
  fetchedAt: number;
}

// Module-level cache shared across all context instances for the same workspace
const tagCache = new Map<string, TagCacheEntry>();

interface TagCacheContextValue {
  tags: Tag[] | null;
  isLoading: boolean;
  /** Call to force-invalidate the cache for the current workspace */
  invalidate: () => void;
}

const TagCacheContext = createContext<TagCacheContextValue | undefined>(undefined);

export function TagCacheProvider({ children }: { children: ReactNode }) {
  const firestore = useFirestore();
  const { activeWorkspaceId } = useWorkspace() as any;

  const [tags, setTags] = useState<Tag[] | null>(() => {
    if (!activeWorkspaceId) return null;
    const cached = tagCache.get(activeWorkspaceId);
    if (cached && Date.now() - cached.fetchedAt < STALE_TIME_MS) {
      return cached.tags;
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(!tags);
  const invalidateCountRef = useRef(0);
  const [invalidateCount, setInvalidateCount] = useState(0);

  useEffect(() => {
    if (!firestore || !activeWorkspaceId) {
      setTags(null);
      setIsLoading(false);
      return;
    }

    // Check cache first (unless invalidated)
    const cached = tagCache.get(activeWorkspaceId);
    if (cached && Date.now() - cached.fetchedAt < STALE_TIME_MS && invalidateCount === invalidateCountRef.current) {
      setTags(cached.tags);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const q = query(
      collection(firestore, 'tags'),
      where('workspaceId', '==', activeWorkspaceId),
      orderBy('category', 'asc'),
      orderBy('name', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const result = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Tag[];

      // Update module-level cache
      tagCache.set(activeWorkspaceId, { tags: result, fetchedAt: Date.now() });

      setTags(result);
      setIsLoading(false);
    }, () => {
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [firestore, activeWorkspaceId, invalidateCount]);

  const invalidate = useMemo(() => () => {
    if (activeWorkspaceId) {
      tagCache.delete(activeWorkspaceId);
    }
    invalidateCountRef.current += 1;
    setInvalidateCount(c => c + 1);
  }, [activeWorkspaceId]);

  const value = useMemo<TagCacheContextValue>(
    () => ({ tags, isLoading, invalidate }),
    [tags, isLoading, invalidate]
  );

  return (
    <TagCacheContext.Provider value={value}>
      {children}
    </TagCacheContext.Provider>
  );
}

/**
 * Hook to access the shared tag cache.
 * Must be used within a TagCacheProvider.
 */
export function useTagCache(): TagCacheContextValue {
  const ctx = useContext(TagCacheContext);
  if (!ctx) {
    throw new Error('useTagCache must be used within a TagCacheProvider');
  }
  return ctx;
}
