'use client';

/**
 * @fileOverview Contact & Account AI Overview Card Component (Phase 9 Milestone 3)
 *
 * Implements Rule 4 (Strict Typing: zero any/any[]), Rule 7 (Mobile-First >= 44px touch targets),
 * Rule 41 (Explainability), and `theme.md` §8 (Standardized Modal & Dialog System Architecture).
 *
 * Displays:
 * - Health Score (0–100 gauge) & Health Status Badge (HEALTHY, ATTENTION_NEEDED, AT_RISK, DORMANT)
 * - Executive narrative summary
 * - Active Momentum indicator (ACCELERATING, STEADY, SLOWING, STALLED)
 * - Stakeholder pills with primary contact indication
 * - Key risk tags and alert chips
 * - Recent activity signal stream
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import * as React from 'react';
import {
  TrendingUp,
  Minus,
  TrendingDown,
  AlertOctagon,
  RefreshCw,
  Sparkles,
  Users,
  Activity,
  ShieldAlert,
  Calendar,
  Handshake,
  Receipt,
  FileText,
  MessageSquare,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { cn } from '@/lib/utils';
import type { AccountAiOverview } from '@/platform/agents/crm/intelligence/crm-intelligence-types';

export interface AccountAiOverviewCardProps {
  overview: AccountAiOverview;
  isLoading?: boolean;
  onRefresh?: () => void;
  className?: string;
}

export function AccountAiOverviewCard({
  overview,
  isLoading = false,
  onRefresh,
  className,
}: AccountAiOverviewCardProps) {
  // Health Status Styling
  const getStatusBadge = (status: AccountAiOverview['healthStatus']) => {
    switch (status) {
      case 'HEALTHY':
        return {
          label: 'HEALTHY',
          className: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-semibold',
        };
      case 'ATTENTION_NEEDED':
        return {
          label: 'ATTENTION NEEDED',
          className: 'bg-amber-500/10 text-amber-500 border-amber-500/20 font-semibold',
        };
      case 'AT_RISK':
        return {
          label: 'AT RISK',
          className: 'bg-rose-500/10 text-rose-500 border-rose-500/20 font-semibold',
        };
      case 'DORMANT':
      default:
        return {
          label: 'DORMANT',
          className: 'bg-muted/40 text-muted-foreground border-border/80 font-semibold',
        };
    }
  };

  // Momentum Icon & Styling
  const getMomentumDetails = (momentum: AccountAiOverview['activeMomentum']) => {
    switch (momentum) {
      case 'ACCELERATING':
        return {
          icon: TrendingUp,
          label: 'Accelerating Momentum',
          color: 'text-emerald-500',
        };
      case 'STEADY':
        return {
          icon: Minus,
          label: 'Steady Momentum',
          color: 'text-blue-500',
        };
      case 'SLOWING':
        return {
          icon: TrendingDown,
          label: 'Slowing Momentum',
          color: 'text-amber-500',
        };
      case 'STALLED':
        return {
          icon: AlertOctagon,
          label: 'Stalled Momentum',
          color: 'text-rose-500',
        };
    }
  };

  // Signal Icon Mapping
  const getSignalIcon = (type: AccountAiOverview['recentSignals'][number]['type']) => {
    switch (type) {
      case 'MEETING':
        return Calendar;
      case 'DEAL':
        return Handshake;
      case 'BILLING':
        return Receipt;
      case 'NOTE':
        return FileText;
      case 'COMMUNICATION':
        return MessageSquare;
      case 'TASK':
      default:
        return Activity;
    }
  };

  const statusBadge = getStatusBadge(overview.healthStatus);
  const momentumDetails = getMomentumDetails(overview.activeMomentum || 'STEADY');
  const MomentumIcon = momentumDetails.icon;

  return (
    <Card className={cn('rounded-2xl border border-border/80 bg-card text-card-foreground shadow-sm', className)}>
      <CardHeader className="min-h-[56px] border-b border-border/80 bg-muted/20 px-6 py-4 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold tracking-tight">AI Account Overview</CardTitle>
            <CardInfoTooltip text="Synthesized intelligence derived from chronological account timeline, active deals, meetings, and financial aging." />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className={cn('text-xs px-2.5 py-0.5 rounded-full', statusBadge.className)}>
            {statusBadge.label}
          </Badge>
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
              aria-label="Refresh overview"
              className="min-h-[44px] sm:min-h-[36px] px-3 rounded-xl border-border/80 hover:bg-muted/40 active:scale-[0.97]"
            >
              <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', isLoading && 'animate-spin')} />
              <span>Refresh</span>
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Top Intelligence Grid: Health Score & Momentum & Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
          {/* Health Score Pill */}
          <div className="md:col-span-1 p-4 rounded-xl border border-border/80 bg-muted/10 flex flex-col items-center justify-center text-center">
            <span className="text-xs uppercase font-medium tracking-wider text-muted-foreground mb-1">Health Score</span>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-extrabold tracking-tight text-foreground">{overview.healthScore}</span>
              <span className="text-sm font-medium text-muted-foreground">/100</span>
            </div>
            <div className={cn('flex items-center gap-1.5 mt-2 text-xs font-medium', momentumDetails.color)}>
              <MomentumIcon className="h-3.5 w-3.5" />
              <span>{momentumDetails.label}</span>
            </div>
          </div>

          {/* Executive Narrative */}
          <div className="md:col-span-3 space-y-3">
            <span className="text-xs uppercase font-bold tracking-wider text-muted-foreground">Executive Narrative</span>
            <p className="text-sm text-foreground/90 leading-relaxed font-normal bg-muted/5 p-3.5 rounded-xl border border-border/50">
              {overview.executiveSummary}
            </p>
          </div>
        </div>

        {/* Key Risks Section (if any) */}
        {overview.keyRisks.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-rose-500" />
              <span className="text-xs uppercase font-bold tracking-wider text-muted-foreground">Identified Risks</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {overview.keyRisks.map((risk) => (
                <div
                  key={risk.id}
                  className="p-3 rounded-xl border border-rose-500/20 bg-rose-500/5 flex items-start gap-2.5 text-left"
                >
                  <Badge variant="outline" className="text-[10px] uppercase font-bold bg-rose-500/10 text-rose-500 border-rose-500/30 shrink-0">
                    {risk.severity}
                  </Badge>
                  <p className="text-xs text-foreground/80 leading-snug">{risk.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stakeholders & Recent Signals Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-border/60">
          {/* Stakeholders Column */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-xs uppercase font-bold tracking-wider text-muted-foreground">Key Stakeholders</span>
            </div>
            <div className="space-y-2">
              {overview.stakeholders.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No stakeholders mapped yet.</p>
              ) : (
                overview.stakeholders.map((contact) => (
                  <div
                    key={contact.contactId}
                    className="p-2.5 rounded-xl border border-border/70 bg-card flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center font-bold text-[11px] text-muted-foreground shrink-0">
                        {contact.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-foreground truncate">{contact.name}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{contact.role || 'Stakeholder'}</div>
                      </div>
                    </div>
                    {contact.isPrimary && (
                      <Badge variant="outline" className="text-[10px] font-semibold bg-primary/10 text-primary border-primary/20 shrink-0">
                        Primary
                      </Badge>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Signals Column */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <span className="text-xs uppercase font-bold tracking-wider text-muted-foreground">Recent Signals</span>
            </div>
            <div className="space-y-2">
              {overview.recentSignals.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No recent timeline signals recorded.</p>
              ) : (
                overview.recentSignals.map((signal) => {
                  const SignalIcon = getSignalIcon(signal.type);
                  return (
                    <div
                      key={signal.id}
                      className="p-2.5 rounded-xl border border-border/70 bg-card flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-6 w-6 rounded-lg bg-muted/60 flex items-center justify-center text-muted-foreground shrink-0">
                          <SignalIcon className="h-3.5 w-3.5" />
                        </div>
                        <span className="font-medium text-foreground truncate">{signal.title}</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {new Date(signal.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
