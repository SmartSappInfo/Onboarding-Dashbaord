'use client';

import { collection, query, where } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { UserProfile } from '@/lib/types';

/**
 * Members of a workspace, for owner/assignee pickers.
 *
 * Single source of truth for the `users where workspaceIds array-contains ws`
 * query that the pipeline filter bar, the create-deal modal, and the deal
 * detail page all need — avoids duplicating the query (and its scoping rules)
 * across components.
 *
 * `orderBy` is intentionally omitted (array-contains + orderBy needs a
 * composite index); callers sort client-side if display order matters.
 */
export function useWorkspaceUsers(workspaceId: string | null | undefined) {
  const firestore = useFirestore();
  const usersQuery = useMemoFirebase(
    () =>
      firestore && workspaceId
        ? query(collection(firestore, 'users'), where('workspaceIds', 'array-contains', workspaceId))
        : null,
    [firestore, workspaceId]
  );
  return useCollection<UserProfile>(usersQuery);
}
