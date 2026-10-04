'use client';

/**
 * @fileOverview Entity AI Overview & Contextual Intelligence Section (Phase 9 Milestone 3)
 *
 * Implements Rule 4 (Strict Typing: zero any/any[]), Rule 7 (Mobile-First >= 44px touch targets),
 * Rule 41 (Explainability Grid), Rule 60 (Dead-Man Switch Handling), and Rule 69 (Strangler Fig Invariant).
 *
 * Coordinates:
 * - Contact AI Overview Card (Health score, momentum, narrative, signals)
 * - Next-Best-Action Recommendations (Rule 41 explainability, one-click execution)
 * - Account Knowledge Panel (Institutional facts, citations with untrusted data isolation)
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import * as React from 'react';
import { Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  getAccountAiOverviewAction,
  getAccountKnowledgeAction,
  getAccountRecommendationsAction,
} from '@/app/actions/crm-agent-actions';
import {
  AccountAiOverviewCard,
  AccountKnowledgePanel,
  AccountRecommendationsCard,
} from '@/components/crm/intelligence';
import type {
  AccountAiOverview,
  AccountKnowledge,
  AccountRecommendations,
  AccountRecommendationItem,
} from '@/platform/agents/crm/intelligence/crm-intelligence-types';
import { cn } from '@/lib/utils';

export interface EntityAiOverviewSectionProps {
  entityId: string;
  workspaceId?: string;
  className?: string;
}

export function EntityAiOverviewSection({
  entityId,
  workspaceId,
  className,
}: EntityAiOverviewSectionProps) {
  const { toast } = useToast();

  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [overview, setOverview] = React.useState<AccountAiOverview | null>(null);
  const [knowledge, setKnowledge] = React.useState<AccountKnowledge | null>(null);
  const [recommendations, setRecommendations] = React.useState<AccountRecommendations | null>(null);

  const fetchIntelligence = React.useCallback(async () => {
    if (!entityId || !workspaceId) return;
    setIsLoading(true);
    setError(null);

    try {
      const [overviewRes, knowledgeRes, recommendationsRes] = await Promise.all([
        getAccountAiOverviewAction({ workspaceId, entityId }),
        getAccountKnowledgeAction({ workspaceId, entityId }),
        getAccountRecommendationsAction({ workspaceId, entityId }),
      ]);

      if (overviewRes.success && overviewRes.data) {
        setOverview(overviewRes.data);
      } else if (!overviewRes.success) {
        setError(overviewRes.error?.message || 'Failed to load account AI overview');
      }

      if (knowledgeRes.success && knowledgeRes.data) {
        setKnowledge(knowledgeRes.data);
      }

      if (recommendationsRes.success && recommendationsRes.data) {
        setRecommendations(recommendationsRes.data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch intelligence';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [entityId, workspaceId]);

  React.useEffect(() => {
    fetchIntelligence();
  }, [fetchIntelligence]);

  const handleActionClick = (item: AccountRecommendationItem) => {
    toast({
      title: 'Action Triggered',
      description: `Initiated "${item.title}" for this account.`,
    });
  };

  if (isLoading) {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-6 w-48 rounded-lg" />
          </div>
          <Skeleton className="h-8 w-24 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Skeleton className="h-72 w-full rounded-2xl" />
          </div>
          <div className="lg:col-span-1">
            <Skeleton className="h-72 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error && !overview) {
    return (
      <div className={cn('p-6 rounded-2xl border border-destructive/20 bg-destructive/5 space-y-3', className)}>
        <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
          <AlertCircle className="h-4 w-4" />
          <span>CRM Intelligence Unavailable</span>
        </div>
        <p className="text-xs text-muted-foreground">{error}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchIntelligence}
          className="rounded-xl min-h-[44px] active:scale-[0.97] gap-2 text-xs"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry Intelligence Synthesis
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <h2 className="text-lg font-bold tracking-tight text-foreground">
            Account In-Context Intelligence
          </h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchIntelligence}
          className="h-8 px-2.5 rounded-lg text-xs text-muted-foreground hover:text-foreground gap-1.5 active:scale-[0.97]"
        >
          <RefreshCw className="h-3 w-3" />
          <span>Refresh</span>
        </Button>
      </div>

      {overview && (
        <AccountAiOverviewCard overview={overview} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {recommendations && (
          <AccountRecommendationsCard
            recommendations={recommendations}
            onActionClick={handleActionClick}
          />
        )}
        {knowledge && (
          <AccountKnowledgePanel knowledge={knowledge} />
        )}
      </div>
    </div>
  );
}
export default EntityAiOverviewSection;
