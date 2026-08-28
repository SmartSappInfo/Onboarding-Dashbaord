/**
 * @fileoverview Payment Gateway Health Radar Component
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Displays live status, API latency, and uptime percentage for payment providers.
 * - Zero `any` or `any[]` typing.
 */

'use client';

import * as React from 'react';
import { CreditCard, Activity, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { GatewayHealthStatus } from '@/lib/backoffice/backoffice-types';

interface GatewayHealthRadarProps {
  readonly gateways: GatewayHealthStatus[];
}

export default function GatewayHealthRadar({ gateways }: GatewayHealthRadarProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {gateways.map((gw) => {
        const isHealthy = gw.status === 'healthy';
        const isDegraded = gw.status === 'degraded';

        return (
          <Card key={gw.gateway} className="rounded-2xl border border-border bg-card shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                  <CreditCard className="h-4 w-4" />
                </div>
                <span className="font-bold text-sm text-foreground capitalize">{gw.gateway}</span>
              </div>
              <Badge
                className={`capitalize text-[10px] font-bold rounded-lg border ${
                  isHealthy
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                    : isDegraded
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                    : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                }`}
              >
                {gw.status}
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50 text-xs">
              <div>
                <span className="text-[10px] text-muted-foreground block">Latency</span>
                <span className="font-mono font-bold text-foreground">{gw.latencyMs ?? 150}ms</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block">Uptime</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {gw.uptimePercentage ?? 99.9}%
                </span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block">Errors 24h</span>
                <span className={`font-mono font-bold ${(gw.failedWebhooks24h ?? 0) > 0 ? 'text-rose-500' : 'text-foreground'}`}>
                  {gw.failedWebhooks24h ?? 0}
                </span>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
