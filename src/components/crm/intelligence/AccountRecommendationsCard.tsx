'use client';

/**
 * @fileOverview Account Recommendations Card Component (Phase 9 Milestone 3)
 *
 * Implements Rule 4 (Strict Typing: zero any/any[]), Rule 7 (Mobile-First >= 44px touch targets),
 * Rule 41 (Explainability Grid: WHAT, WHY, IMPACT), and `theme.md` §8.
 *
 * Displays:
 * - Prioritized Next-Best-Action chips (URGENT, HIGH, MEDIUM, LOW)
 * - 3-part explainability grid (WHAT, WHY, IMPACT)
 * - One-click execution trigger buttons with tactile compression (active:scale-[0.97])
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import * as React from 'react';
import {
  Lightbulb,
  ArrowRight,
  Sparkles,
  Calendar,
  Mail,
  CheckSquare,
  Search,
  FileEdit,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { cn } from '@/lib/utils';
import type {
  AccountRecommendations,
  AccountRecommendationItem,
} from '@/platform/agents/crm/intelligence/crm-intelligence-types';

export interface AccountRecommendationsCardProps {
  recommendations: AccountRecommendations;
  isLoading?: boolean;
  onActionClick?: (item: AccountRecommendationItem) => void;
  className?: string;
}

export function AccountRecommendationsCard({
  recommendations,
  isLoading = false,
  onActionClick,
  className,
}: AccountRecommendationsCardProps) {
  const getPriorityBadge = (priority: AccountRecommendationItem['priority']) => {
    switch (priority) {
      case 'URGENT':
        return 'bg-rose-500/10 text-rose-500 border-rose-500/20 font-bold';
      case 'HIGH':
        return 'bg-amber-500/10 text-amber-500 border-amber-500/20 font-bold';
      case 'MEDIUM':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20 font-medium';
      case 'LOW':
      default:
        return 'bg-muted/40 text-muted-foreground border-border/80 font-medium';
    }
  };

  const getActionTypeLabel = (actionType: AccountRecommendationItem['actionType']) => {
    switch (actionType) {
      case 'SCHEDULE_MEETING':
        return { label: 'Schedule Meeting', icon: Calendar };
      case 'DRAFT_EMAIL':
        return { label: 'Draft Email', icon: Mail };
      case 'CREATE_TASK':
        return { label: 'Create Task', icon: CheckSquare };
      case 'LAUNCH_RESEARCH':
        return { label: 'Launch Research', icon: Search };
      case 'ADD_NOTE':
        return { label: 'Add Note', icon: FileEdit };
      case 'UPDATE_STAGE':
      default:
        return { label: 'Update Stage', icon: TrendingUp };
    }
  };

  return (
    <Card className={cn('rounded-2xl border border-border/80 bg-card text-card-foreground shadow-sm', className)}>
      <CardHeader className="min-h-[56px] border-b border-border/80 bg-muted/20 px-6 py-4 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <Lightbulb className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold tracking-tight">Next-Best-Actions</CardTitle>
            <CardInfoTooltip text="Autonomous, prioritized recommendations synthesized from chronological timeline signals and account commitments." />
          </div>
        </div>
        <Badge variant="outline" className="text-xs px-2.5 py-0.5 rounded-full font-medium">
          {recommendations.items.length} Actionable
        </Badge>
      </CardHeader>

      <CardContent className="p-6 space-y-4">
        {recommendations.items.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-border/70 rounded-xl space-y-2">
            <Sparkles className="h-8 w-8 text-muted-foreground/60 mx-auto" />
            <p className="text-sm font-medium text-foreground">No urgent actions pending</p>
            <p className="text-xs text-muted-foreground">Account health is steady with all commitments satisfied.</p>
          </div>
        ) : (
          recommendations.items.map((item) => {
            const actionDetails = getActionTypeLabel(item.actionType);
            const ActionIcon = actionDetails.icon;

            return (
              <div
                key={item.id}
                className="p-4 rounded-xl border border-border/80 bg-card hover:border-primary/40 transition-all space-y-3 text-left"
              >
                {/* Header: Title + Priority + Category */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <Badge variant="outline" className={cn('text-[10px] px-2 py-0.5 rounded-md uppercase', getPriorityBadge(item.priority))}>
                      {item.priority}
                    </Badge>
                    <span className="font-semibold text-sm text-foreground">{item.title}</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] text-muted-foreground self-start sm:self-auto uppercase">
                    {item.category}
                  </Badge>
                </div>

                <p className="text-xs text-foreground/80 leading-relaxed font-normal">{item.description}</p>

                {/* Rule 41 Explainability Grid: WHAT, WHY, IMPACT */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
                  <div className="p-2.5 rounded-lg bg-muted/15 border border-border/60 space-y-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">What</span>
                    <p className="text-xs text-foreground/90 font-medium">{item.explainability.what}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/15 border border-border/60 space-y-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">Why</span>
                    <p className="text-xs text-foreground/90 font-medium">{item.explainability.why}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/15 border border-border/60 space-y-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">Impact</span>
                    <p className="text-xs text-foreground/90 font-medium">{item.explainability.impact}</p>
                  </div>
                </div>

                {/* Footer Action Trigger */}
                <div className="flex items-center justify-end pt-1">
                  <Button
                    size="sm"
                    onClick={() => onActionClick?.(item)}
                    disabled={isLoading}
                    className="min-h-[44px] sm:min-h-[36px] px-4 rounded-xl font-medium text-xs gap-1.5 active:scale-[0.97]"
                  >
                    <ActionIcon className="h-3.5 w-3.5" />
                    <span>{actionDetails.label}</span>
                    <ArrowRight className="h-3.5 w-3.5 ml-0.5" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
