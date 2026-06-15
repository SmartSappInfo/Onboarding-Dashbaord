'use client';

import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { CallScript, CallCampaign, CallQueueItem } from '@/lib/types';

export function useCallScripts(workspaceId: string | undefined) {
  const firestore = useFirestore();

  const scriptsQuery = useMemoFirebase(() => {
    if (!firestore || !workspaceId) return null;
    return query(
      collection(firestore, 'call_scripts'),
      where('workspaceId', '==', workspaceId),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, workspaceId]);

  const { data, isLoading, error } = useCollection<CallScript>(scriptsQuery);

  return { scripts: data || [], isLoading, error };
}

export function useCallCampaigns(workspaceId: string | undefined) {
  const firestore = useFirestore();

  const campaignsQuery = useMemoFirebase(() => {
    if (!firestore || !workspaceId) return null;
    return query(
      collection(firestore, 'call_campaigns'),
      where('workspaceId', '==', workspaceId),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, workspaceId]);

  const { data, isLoading, error } = useCollection<CallCampaign>(campaignsQuery);

  return { campaigns: data || [], isLoading, error };
}

export function useCallQueueItems(campaignId: string | undefined) {
  const firestore = useFirestore();

  const queueQuery = useMemoFirebase(() => {
    if (!firestore || !campaignId) return null;
    return query(
      collection(firestore, 'call_queue_items'),
      where('campaignId', '==', campaignId)
    );
  }, [firestore, campaignId]);

  const { data, isLoading, error } = useCollection<CallQueueItem>(queueQuery);

  return { queueItems: data || [], isLoading, error };
}
