/**
 * @fileoverview Tenant Health Card Component
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Displays multi-dimensional health scorecard (messaging, integrations, finance, workflows).
 * - Smooth hover and click transitions conforming to Emil Kowalski standards (`active:scale-[0.97]`).
 * - Zero `any` typing.
 */

'use client';

import * as React from 'react';
import { HeartPulse, Mail, Plug2, Banknote, Workflow, Users, AlertCircle, ExternalLink, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { TenantHealthScore } from '@/lib/backoffice/backoffice-types';

const STATUS_CONFIG: Record<
  TenantHealthScore['status'],
  { label: string; badgeClass: string; progressColor: string }
> = {
  healthy: {
    label: 'Healthy',
    badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    progressColor: 'bg-emerald-500',
  },
  warning: {
    label: 'Attention Needed',
    badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
    progressColor: 'bg-amber-500',
  },
  critical: {
    label: 'Critical Condition',
    badgeClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
    progressColor: 'bg-rose-500',
  },
};

interface TenantHealthCardProps {
  readonly scorecard: TenantHealthScore;
  readonly onLaunchImpersonation?: (orgId: string) => void;
}

export default function TenantHealthCard({
  scorecard,
  onLaunchImpersonation,
}: TenantHealthCardProps) {
  const config = STATUS_CONFIG[scorecard.status] || STATUS_CONFIG.healthy;

  return (
    <Card className="rounded-2xl border border-border bg-card shadow-lg hover:shadow-xl transition-all duration-200 overflow-hidden group">
      <CardHeader className="p-4 pb-3 border-b border-border/50 bg-muted/20 flex flex-row items-center justify-between space-y-0">
        <div className="space-y-0.5">
          <CardTitle className="text-sm font-bold text-foreground line-clamp-1">
            {scorecard.organizationName}
          </CardTitle>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {scorecard.activeUsersCount} users
            </span>
            {scorecard.openIssuesCount > 0 && (
              <span className="flex items-center gap-1 text-rose-500 font-semibold">
                <AlertCircle className="h-3 w-3" />
                {scorecard.openIssuesCount} issues
              </span>
            )}
          </div>
        </div>

        <Badge className={`capitalize text-[10px] font-bold rounded-lg border ${config.badgeClass}`}>
          {config.label}
        </Badge>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* Composite Score Ring / Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <HeartPulse className="h-3.5 w-3.5 text-emerald-500" />
              Composite Score
            </span>
            <span className="font-mono font-bold text-sm text-foreground">
              {scorecard.healthScore}/100
            </span>
          </div>
          <Progress value={scorecard.healthScore} className="h-2 rounded-full bg-muted" />
        </div>

        {/* 4 Pillars Breakdown Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 rounded-xl bg-muted/30 border border-border/50 space-y-1">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3 text-blue-400" />
                Messaging
              </span>
              <span className="font-bold text-foreground">{scorecard.messagingHealth}%</span>
            </div>
            <div className="w-full bg-muted/60 h-1 rounded-full overflow-hidden">
              <div
                className="bg-blue-500 h-full rounded-full"
                style={{ width: `${scorecard.messagingHealth}%` }}
              />
            </div>
          </div>

          <div className="p-2 rounded-xl bg-muted/30 border border-border/50 space-y-1">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Plug2 className="h-3 w-3 text-purple-400" />
                Integrations
              </span>
              <span className="font-bold text-foreground">{scorecard.integrationHealth}%</span>
            </div>
            <div className="w-full bg-muted/60 h-1 rounded-full overflow-hidden">
              <div
                className="bg-purple-500 h-full rounded-full"
                style={{ width: `${scorecard.integrationHealth}%` }}
              />
            </div>
          </div>

          <div className="p-2 rounded-xl bg-muted/30 border border-border/50 space-y-1">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Banknote className="h-3 w-3 text-emerald-400" />
                Finance
              </span>
              <span className="font-bold text-foreground">{scorecard.financialHealth}%</span>
            </div>
            <div className="w-full bg-muted/60 h-1 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full"
                style={{ width: `${scorecard.financialHealth}%` }}
              />
            </div>
          </div>

          <div className="p-2 rounded-xl bg-muted/30 border border-border/50 space-y-1">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Workflow className="h-3 w-3 text-amber-400" />
                Workflows
              </span>
              <span className="font-bold text-foreground">{scorecard.workflowHealth}%</span>
            </div>
            <div className="w-full bg-muted/60 h-1 rounded-full overflow-hidden">
              <div
                className="bg-amber-500 h-full rounded-full"
                style={{ width: `${scorecard.workflowHealth}%` }}
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        {onLaunchImpersonation && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onLaunchImpersonation(scorecard.organizationId)}
            className="w-full h-10 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted active:scale-[0.97] transition-all gap-1.5"
          >
            <Shield className="h-3.5 w-3.5 text-amber-500" />
            Launch Support Sandbox
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
