'use client';

/**
 * @fileOverview Paginated, case-insensitive CONTACT search (Phase 6.2).
 *
 * Reads the `workspace_contacts` projection (one row per contact) directly from
 * the client via Firestore rules — fetching only a PAGE, never the whole set —
 * the same approach as `useEntitySearch`, but contact-level. Powers the audience
 * recipient builders.
 *
 * The filter plan comes from `contactSegmentToQuerySpec` so the client and the
 * server send-pipeline ([contact-repository.ts](src/lib/contacts/contact-repository.ts))
 * apply identical semantics. `totalCount` (opt-in) is the count() of ALL matches
 * — what "Select All Match" selects — without enumerating ids in the browser.
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
  getCountFromServer,
  type QueryConstraint,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import {
  contactSegmentToQuerySpec,
  type AudienceSegment,
  type ContactDoc,
} from '@/lib/contacts/contact-projection-domain';

export type SearchedContact = ContactDoc;

export interface UseContactSearchOptions {
  segment: AudienceSegment;
  pageSize?: number;
  enabled?: boolean;
  /** Also fetch the total match count (for the "Select All Match" badge). */
  withCount?: boolean;
}

function buildConstraints(workspaceId: string, segment: AudienceSegment): QueryConstraint[] {
  const spec = contactSegmentToQuerySpec(workspaceId, segment);
  const c: QueryConstraint[] = spec.equalities.map((e) => where(e.field, '==', e.value));
  if (spec.arrayContains) {
    c.push(where(spec.arrayContains.field, 'array-contains', spec.arrayContains.value));
  }
  if (spec.range) {
    c.push(where(spec.range.field, '>=', spec.range.prefix));
    c.push(where(spec.range.field, '<=', spec.range.prefix + ''));
  }
  c.push(orderBy(spec.orderBy));
  return c;
}

export function useContactSearch({
  segment,
  pageSize = 25,
  enabled = true,
  withCount = false,
}: UseContactSearchOptions) {
  const firestore = useFirestore();
  const { activeWorkspaceId } = useTenant();

  const [results, setResults] = useState<SearchedContact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const cursorRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);

  const segKey = JSON.stringify(segment); // stable dep for an inline object prop

  const runQuery = useCallback(
    async (reset: boolean) => {
      if (!firestore || !activeWorkspaceId || !enabled) return;
      setIsLoading(true);
      try {
        if (reset) cursorRef.current = null;
        const seg = JSON.parse(segKey) as AudienceSegment;
        const base = buildConstraints(activeWorkspaceId, seg);

        const constraints = [...base, limit(pageSize)];
        if (!reset && cursorRef.current) constraints.push(startAfter(cursorRef.current));

        const snap = await getDocs(query(collection(firestore, 'workspace_contacts'), ...constraints));
        const page = snap.docs.map((d) => d.data() as ContactDoc);
        cursorRef.current = snap.docs[snap.docs.length - 1] ?? cursorRef.current;
        setHasMore(snap.docs.length === pageSize);
        setResults((prev) => (reset ? page : [...prev, ...page]));

        if (reset && withCount) {
          try {
            const countSnap = await getCountFromServer(
              query(collection(firestore, 'workspace_contacts'), ...base),
            );
            setTotalCount(countSnap.data().count);
          } catch {
            setTotalCount(null);
          }
        }
      } finally {
        setIsLoading(false);
      }
    },
    [firestore, activeWorkspaceId, enabled, segKey, pageSize, withCount],
  );

  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => runQuery(true), 250);
    return () => clearTimeout(t);
  }, [enabled, segKey, activeWorkspaceId, runQuery]);

  const loadMore = useCallback(() => {
    if (hasMore && !isLoading) runQuery(false);
  }, [hasMore, isLoading, runQuery]);

  return { results, isLoading, hasMore, loadMore, totalCount };
}
