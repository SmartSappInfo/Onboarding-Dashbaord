'use client';

/**
 * @fileOverview Paginated, case-insensitive entity search (Phase 5.2).
 *
 * Replaces "load all entities, filter in memory" pickers. Runs a real Firestore
 * query that fetches only a PAGE (cursor pagination) — never the whole
 * collection — using firestore rules (no server round-trip / Admin SDK).
 *
 * Requires the denormalized `displayNameLower` field (see entity-actions write
 * path + the backfill action). Prefix range + orderBy on `displayNameLower`
 * gives case-insensitive prefix matching.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  type QueryConstraint,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import { toSearchKey } from '@/lib/entities/entity-cache-domain';
import type { WorkspaceEntity } from '@/lib/types';

export type SearchedEntity = WorkspaceEntity & { id: string };

export interface UseEntitySearchOptions {
  /** Free-text query (case-insensitive prefix). Empty = list (paginated). */
  search?: string;
  pageSize?: number;
  /** Extra equality filters, e.g. [{ field: 'status', value: 'active' }]. */
  filters?: Array<{ field: string; value: unknown }>;
  /** Set false to defer querying (e.g. until a popover opens). */
  enabled?: boolean;
}

export function useEntitySearch({
  search = '',
  pageSize = 25,
  filters = [],
  enabled = true,
}: UseEntitySearchOptions = {}) {
  const firestore = useFirestore();
  const { activeWorkspaceId } = useTenant();

  const [results, setResults] = useState<SearchedEntity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const cursorRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);

  const searchKey = toSearchKey(search);
  const filterKey = JSON.stringify(filters); // stable dep for an inline array prop

  const runQuery = useCallback(
    async (reset: boolean) => {
      if (!firestore || !activeWorkspaceId || !enabled) return;
      setIsLoading(true);
      try {
        if (reset) cursorRef.current = null;

        const constraints: QueryConstraint[] = [where('workspaceId', '==', activeWorkspaceId)];
        const parsedFilters = (JSON.parse(filterKey) as UseEntitySearchOptions['filters']) ?? [];
        for (const f of parsedFilters) {
          constraints.push(where(f.field, '==', f.value));
        }
        if (searchKey) {
          constraints.push(where('displayNameLower', '>=', searchKey));
          constraints.push(where('displayNameLower', '<=', searchKey + '\uf8ff'));
        }
        constraints.push(orderBy('displayNameLower'));
        constraints.push(limit(pageSize));
        if (!reset && cursorRef.current) constraints.push(startAfter(cursorRef.current));

        const snap = await getDocs(query(collection(firestore, 'workspace_entities'), ...constraints));
        const page = snap.docs.map((d) => ({ ...(d.data() as WorkspaceEntity), id: d.id }) as SearchedEntity);
        cursorRef.current = snap.docs[snap.docs.length - 1] ?? cursorRef.current;
        setHasMore(snap.docs.length === pageSize);
        setResults((prev) => (reset ? page : [...prev, ...page]));
      } finally {
        setIsLoading(false);
      }
    },
    [firestore, activeWorkspaceId, enabled, searchKey, filterKey, pageSize],
  );

  // Debounced re-query on search/filter/workspace change.
  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => runQuery(true), 250);
    return () => clearTimeout(t);
  }, [enabled, searchKey, filterKey, activeWorkspaceId, runQuery]);

  const loadMore = useCallback(() => {
    if (hasMore && !isLoading) runQuery(false);
  }, [hasMore, isLoading, runQuery]);

  return { results, isLoading, hasMore, loadMore };
}
