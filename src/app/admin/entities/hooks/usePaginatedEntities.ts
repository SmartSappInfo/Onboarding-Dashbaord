import { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot
} from 'firebase/firestore';
import type { WorkspaceEntity } from '@/lib/types';

interface UsePaginatedEntitiesProps {
  firestore: any;
  activeWorkspaceId: string | null | undefined;
  currentPage: number;
  pageSize: number;
  filteredEntityIds: string[];
}

export function usePaginatedEntities({
  firestore,
  activeWorkspaceId,
  currentPage,
  pageSize,
  filteredEntityIds,
}: UsePaginatedEntitiesProps) {
  const [entities, setEntities] = useState<WorkspaceEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  // Slice the IDs that correspond to the current page
  const pageIds = useMemo(() => {
    return filteredEntityIds.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [filteredEntityIds, currentPage, pageSize]);

  // Subscribe to updates for only the documents matching pageIds
  useEffect(() => {
    if (!firestore || !activeWorkspaceId || pageIds.length === 0) {
      setEntities([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    // Split pageIds into chunks of 30 due to Firestore's 'in' query limitations
    const chunks: string[][] = [];
    for (let i = 0; i < pageIds.length; i += 30) {
      chunks.push(pageIds.slice(i, i + 30));
    }

    const unsubscribes = chunks.map((chunk, chunkIdx) => {
      const q = query(
        collection(firestore, 'workspace_entities'),
        where('__name__', 'in', chunk)
      );

      return onSnapshot(
        q,
        (snapshot) => {
          const resultsMap: Record<string, WorkspaceEntity> = {};
          snapshot.forEach((doc) => {
            resultsMap[doc.id] = { ...(doc.data() as any), id: doc.id };
          });

          setEntities(prev => {
            const merged = { 
              ...prev.reduce((acc, e) => { acc[e.id] = e; return acc; }, {} as Record<string, WorkspaceEntity>), 
              ...resultsMap 
            };
            return pageIds.map(id => merged[id]).filter(Boolean);
          });
          
          if (chunkIdx === chunks.length - 1) {
            setIsLoading(false);
          }
        },
        (err) => {
          console.error(`Page subscription chunk ${chunkIdx} error:`, err);
          setError(err);
          setIsLoading(false);
        }
      );
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }, [firestore, activeWorkspaceId, pageIds]);

  return {
    entities,
    isLoading,
    error,
    totalCount: filteredEntityIds.length,
  };
}
