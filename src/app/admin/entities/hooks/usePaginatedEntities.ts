import { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter, 
  onSnapshot,
  getCountFromServer,
  DocumentData,
  QueryDocumentSnapshot
} from 'firebase/firestore';
import type { WorkspaceEntity } from '@/lib/types';

interface UsePaginatedEntitiesProps {
  firestore: any;
  activeWorkspaceId: string | null | undefined;
  currentPage: number;
  pageSize: number;
  filterState: any;
  assignedUserId: string | null | undefined;
  tagFilteredIds: Set<string> | null;
}

export function usePaginatedEntities({
  firestore,
  activeWorkspaceId,
  currentPage,
  pageSize,
  filterState,
  assignedUserId,
  tagFilteredIds,
}: UsePaginatedEntitiesProps) {
  const [entities, setEntities] = useState<WorkspaceEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSnapshots, setPageSnapshots] = useState<QueryDocumentSnapshot<DocumentData>[]>([]);

  // 1. Get the total count for the filtered query (cheap index-only query)
  useEffect(() => {
    if (!firestore || !activeWorkspaceId) return;

    let q = query(
      collection(firestore, 'workspace_entities'),
      where('workspaceId', '==', activeWorkspaceId)
    );

    if (filterState.status && filterState.status !== 'all') {
      q = query(q, where('status', '==', filterState.status));
    }

    if (assignedUserId) {
      if (assignedUserId !== 'unassigned') {
        q = query(q, where('assignedTo.userId', '==', assignedUserId));
      }
    }

    getCountFromServer(q).then(snap => {
      setTotalCount(snap.data().count);
    }).catch(err => {
      console.error('Error fetching total count:', err);
    });
  }, [firestore, activeWorkspaceId, filterState.status, assignedUserId]);

  // 2. Fetch the paginated documents
  useEffect(() => {
    if (!firestore || !activeWorkspaceId) {
      setEntities([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    // Build query with basic indexing constraints
    let q = query(
      collection(firestore, 'workspace_entities'),
      where('workspaceId', '==', activeWorkspaceId)
    );

    if (filterState.status && filterState.status !== 'all') {
      q = query(q, where('status', '==', filterState.status));
    }

    if (assignedUserId) {
      if (assignedUserId !== 'unassigned') {
        q = query(q, where('assignedTo.userId', '==', assignedUserId));
      }
    }

    // Default order by addedAt descending
    q = query(q, orderBy('addedAt', 'desc'));

    // Apply cursor pagination
    if (currentPage > 1 && pageSnapshots[currentPage - 2]) {
      q = query(q, startAfter(pageSnapshots[currentPage - 2]));
    }

    q = query(q, limit(pageSize));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const results: WorkspaceEntity[] = [];
        snapshot.forEach((doc) => {
          results.push({ ...(doc.data() as any), id: doc.id });
        });

        // Store the last visible document snapshot of the current page for next page queries
        if (snapshot.docs.length > 0) {
          setPageSnapshots(prev => {
            const nextSnapshots = [...prev];
            nextSnapshots[currentPage - 1] = snapshot.docs[snapshot.docs.length - 1];
            return nextSnapshots;
          });
        }

        setEntities(results);
        setIsLoading(false);
      },
      (err) => {
        console.error('Pagination query error:', err);
        setError(err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [firestore, activeWorkspaceId, currentPage, pageSize, filterState.status, assignedUserId]);

  // Clear snapshots when filters or query criteria changes
  useEffect(() => {
    setPageSnapshots([]);
  }, [filterState.status, assignedUserId, activeWorkspaceId]);

  return {
    entities,
    isLoading,
    error,
    totalCount,
  };
}
