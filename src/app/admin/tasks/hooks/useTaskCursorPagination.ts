/**
 * @fileOverview useTaskCursorPagination Hook (Phase 4A)
 *
 * Implements Rule 4 (Strict Typing), Rule 9 (Load, Throttling & Pagination),
 * Roadmap §46-48, and PRD SCL-01/02:
 * - Stable cursor-based progressive loading replacing silent 200-task limit.
 * - Deduplication by unique task ID across cursor chunks.
 * - Preserves active filter context and scroll position during page extensions.
 * - Strict typing with zero `any` or `any[]`.
 */

import * as React from 'react';
import type { Task } from '@/lib/types';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter, 
  getDocs, 
  type Firestore, 
  type DocumentSnapshot 
} from 'firebase/firestore';

export interface TaskCursorPageResult {
  tasks: Task[];
  hasMore: boolean;
  nextCursor?: string | null;
}

export type TaskCursorFetcher = (params: {
  workspaceId: string;
  pageSize: number;
  cursor?: string | null;
}) => Promise<TaskCursorPageResult>;

export interface UseTaskCursorPaginationOptions {
  workspaceId: string;
  pageSize?: number;
  firestore?: Firestore | null;
  fetcher?: TaskCursorFetcher;
  autoFetch?: boolean;
}

export interface UseTaskCursorPaginationReturn {
  tasks: Task[];
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: Error | null;
  totalLoaded: number;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  reset: () => void;
}

export function useTaskCursorPagination({
  workspaceId,
  pageSize = 50,
  firestore,
  fetcher,
  autoFetch = false,
}: UseTaskCursorPaginationOptions): UseTaskCursorPaginationReturn {
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [hasMore, setHasMore] = React.useState(true);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const cursorRef = React.useRef<string | null>(null);

  // Firestore cursor snapshot map for live firestore queries
  const snapshotMapRef = React.useRef<Map<string, DocumentSnapshot>>(new Map());

  const defaultFirestoreFetcher: TaskCursorFetcher = React.useCallback(async ({
    workspaceId: wsId,
    pageSize: size,
    cursor,
  }): Promise<TaskCursorPageResult> => {
    if (!firestore || !wsId) {
      return { tasks: [], hasMore: false, nextCursor: null };
    }

    const tasksCol = collection(firestore, 'tasks');
    let q = query(
      tasksCol,
      where('workspaceId', '==', wsId),
      orderBy('dueDate', 'asc'),
      limit(size)
    );

    if (cursor && snapshotMapRef.current.has(cursor)) {
      const snap = snapshotMapRef.current.get(cursor);
      if (snap) {
        q = query(
          tasksCol,
          where('workspaceId', '==', wsId),
          orderBy('dueDate', 'asc'),
          startAfter(snap),
          limit(size)
        );
      }
    }

    const querySnap = await getDocs(q);
    const docs = querySnap.docs;
    const fetchedTasks: Task[] = docs.map(doc => ({
      ...(doc.data() as Task),
      id: doc.id,
    }));

    let nextCursorId: string | null = null;
    if (docs.length > 0) {
      const lastDoc = docs[docs.length - 1];
      nextCursorId = lastDoc.id;
      snapshotMapRef.current.set(lastDoc.id, lastDoc);
    }

    return {
      tasks: fetchedTasks,
      hasMore: docs.length === size,
      nextCursor: nextCursorId,
    };
  }, [firestore]);

  const activeFetcher = fetcher || defaultFirestoreFetcher;

  const refresh = React.useCallback(async () => {
    if (!workspaceId) return;
    setIsLoading(true);
    setError(null);
    cursorRef.current = null;
    snapshotMapRef.current.clear();

    try {
      const result = await activeFetcher({
        workspaceId,
        pageSize,
        cursor: null,
      });

      setTasks(result.tasks);
      setHasMore(result.hasMore);
      cursorRef.current = result.nextCursor || null;
    } catch (err: unknown) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, pageSize, activeFetcher]);

  const loadMore = React.useCallback(async () => {
    if (!hasMore || isLoadingMore || isLoading || !workspaceId) return;
    setIsLoadingMore(true);
    setError(null);

    try {
      const result = await activeFetcher({
        workspaceId,
        pageSize,
        cursor: cursorRef.current,
      });

      setTasks(prev => {
        const existingIds = new Set(prev.map(t => t.id));
        const newUnique = result.tasks.filter(t => !existingIds.has(t.id));
        return [...prev, ...newUnique];
      });

      setHasMore(result.hasMore);
      cursorRef.current = result.nextCursor || null;
    } catch (err: unknown) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, isLoadingMore, isLoading, workspaceId, pageSize, activeFetcher]);

  const reset = React.useCallback(() => {
    setTasks([]);
    setHasMore(true);
    setError(null);
    cursorRef.current = null;
    snapshotMapRef.current.clear();
  }, []);

  React.useEffect(() => {
    if (autoFetch && workspaceId) {
      void refresh();
    }
  }, [autoFetch, workspaceId, refresh]);

  return {
    tasks,
    hasMore,
    isLoading,
    isLoadingMore,
    error,
    totalLoaded: tasks.length,
    loadMore,
    refresh,
    reset,
  };
}
