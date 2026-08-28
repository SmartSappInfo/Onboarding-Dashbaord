/**
 * @fileoverview Provider Rate Limit Gauges Component
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Displays consumed quotas and resets for third-party upstream APIs.
 * - Zero `any` or `any[]` typing.
 */

'use client';

import * as React from 'react';
import { Gauge, Clock, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { RateLimitGauge } from '@/lib/backoffice/backoffice-integration-actions';

interface RateLimitGaugesProps {
  readonly rateLimits: RateLimitGauge[];
}

export default function RateLimitGauges({ rateLimits }: RateLimitGaugesProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {rateLimits.map((gauge) => {
        const isOptimal = gauge.status === 'optimal';
        const isWarning = gauge.status === 'warning';

        return (
          <Card key={gauge.service} className="rounded-2xl border border-border bg-card shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs sm:text-sm text-foreground line-clamp-1">{gauge.service}</span>
              <Badge
                className={`capitalize text-[10px] font-bold rounded-lg border ${
                  isOptimal
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                    : isWarning
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                    : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                }`}
              >
                {gauge.status}
              </Badge>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Quota Consumed</span>
                <span className="font-mono font-bold text-foreground">{gauge.consumedPercentage}%</span>
              </div>
              <Progress value={gauge.consumedPercentage} className="h-2 rounded-full bg-muted" />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs text-muted-foreground">
              <span className="font-mono font-semibold text-foreground">
                {gauge.requestsRemaining.toLocaleString()} calls left
              </span>
              <div className="flex items-center gap-1 text-[11px]">
                <Clock className="h-3 w-3" />
                <span>Resets {gauge.resetTime}</span>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
