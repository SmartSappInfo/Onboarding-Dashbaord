'use client';

import * as React from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';

interface PendingJobsContextValue {
  pendingJobs: Record<string, unknown>[];
  countsBySourceNodeId: Record<string, number>;
  isLoading: boolean;
}

const PendingJobsContext = React.createContext<PendingJobsContextValue>({
  pendingJobs: [],
  countsBySourceNodeId: {},
  isLoading: false,
});

export function AutomationPendingJobsProvider({
  automationId,
  workspaceId,
  children,
}: {
  automationId: string;
  workspaceId: string | null;
  children: React.ReactNode;
}) {
  const firestore = useFirestore();

  const jobsQuery = useMemoFirebase(() => {
    if (!firestore || !automationId || !workspaceId) return null;
    return query(
      collection(firestore, 'automation_jobs'),
      where('automationId', '==', automationId),
      where('workspaceId', '==', workspaceId),
      where('status', '==', 'pending')
    );
  }, [firestore, automationId, workspaceId]);

  const { data: jobs, isLoading } = useCollection<Record<string, unknown>>(jobsQuery);

  const countsBySourceNodeId = React.useMemo(() => {
    const counts: Record<string, number> = {};
    if (jobs) {
      for (const job of jobs) {
        const sourceId = job.sourceNodeId as string;
        if (sourceId) {
          counts[sourceId] = (counts[sourceId] || 0) + 1;
        }
      }
    }
    return counts;
  }, [jobs]);

  return (
    <PendingJobsContext.Provider value={{ pendingJobs: jobs || [], countsBySourceNodeId, isLoading }}>
      {children}
    </PendingJobsContext.Provider>
  );
}

export function usePendingJobs() {
  return React.useContext(PendingJobsContext);
}
