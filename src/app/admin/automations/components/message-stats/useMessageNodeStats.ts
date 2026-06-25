'use client';

import * as React from 'react';
import type { MessageNodeStats } from '@/lib/types';
import { getMessageNodeStatsAction } from '@/lib/automation-actions';

export interface UseMessageNodeStatsResult {
  stats: MessageNodeStats | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Loads a message-step node's denormalized delivery counters once on mount and
 * exposes a manual `refresh`. No automatic polling — the user pulls the latest
 * via the refresh control, keeping Firestore reads bounded.
 */
export function useMessageNodeStats(
  automationId: string | undefined,
  nodeId: string | undefined
): UseMessageNodeStatsResult {
  const [stats, setStats] = React.useState<MessageNodeStats | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (!automationId || automationId === 'new' || !nodeId) {
        setIsLoading(false);
        return;
      }
      if (mode === 'refresh') setIsRefreshing(true);
      else setIsLoading(true);
      try {
        const result = await getMessageNodeStatsAction(automationId, nodeId);
        setStats(result);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load statistics');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [automationId, nodeId]
  );

  React.useEffect(() => {
    void load('initial');
  }, [load]);

  const refresh = React.useCallback(() => load('refresh'), [load]);

  return { stats, isLoading, isRefreshing, error, refresh };
}
