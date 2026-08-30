'use client';

/**
 * Provider Health & Diagnostics Card Suite (Lead Intelligence 2.0 - Phase 14)
 * UI Spec Section 57: "Provider Management UX"
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. Visualizes live API status, latency ms, error rates, and monthly quota meters.
 * 2. Highlights circuit breaker trips and vendor quota warnings.
 * 3. Mobile-responsive card grid with touch targets >= 44px.
 * 4. Emil Kowalski active physics (active:scale-[0.97]).
 * 5. Strict Zero-`any` typing.
 */

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  WifiOff, 
  Zap, 
  Clock, 
  TrendingUp, 
  Sliders,
  ShieldCheck,
  Coins
} from 'lucide-react';
import type { ProviderHealthRecord } from '@/lib/lead-intelligence/types';
import { cn } from '@/lib/utils';

interface ProviderHealthStatusCardProps {
  providers: ProviderHealthRecord[];
  onOpenRouting?: () => void;
  className?: string;
}

export const ProviderHealthStatusCard: React.FC<ProviderHealthStatusCardProps> = ({
  providers,
  onOpenRouting,
  className
}) => {
  const getStatusIcon = (status: ProviderHealthRecord['status']) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-rose-500" />;
      case 'disconnected':
        return <WifiOff className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: ProviderHealthRecord['status']) => {
    switch (status) {
      case 'healthy':
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
            ● Healthy
          </Badge>
        );
      case 'warning':
        return (
          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[10px] font-bold">
            ▲ High Latency
          </Badge>
        );
      case 'error':
        return (
          <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-[10px] font-bold">
            ✕ Quota Tripped
          </Badge>
        );
      case 'disconnected':
        return (
          <Badge variant="outline" className="text-muted-foreground text-[10px] font-bold">
            ○ Disconnected
          </Badge>
        );
    }
  };

  return (
    <Card className={cn("bg-card border border-border/80 rounded-2xl p-5 shadow-sm space-y-4", className)}>
      {/* Header with Title and Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Activity className="h-4 w-4" />
            </div>
            <h3 className="text-base font-black text-foreground">
              Provider Health & API Diagnostics
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Continuous latency monitoring, circuit breakers, and monthly quota usage for enrichment providers.
          </p>
        </div>

        {onOpenRouting && (
          <Button
            size="sm"
            variant="outline"
            onClick={onOpenRouting}
            className="h-8 px-3 text-xs font-semibold rounded-xl flex items-center gap-1.5 active:scale-[0.97]"
          >
            <Sliders className="w-3.5 h-3.5 text-primary" />
            <span>Configure Routing</span>
          </Button>
        )}
      </div>

      {/* Grid of Providers */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
        {providers.map((p) => {
          const quotaPercent = p.monthlyQuota > 0 
            ? Math.min(100, Math.round((p.monthlyUsed / p.monthlyQuota) * 100)) 
            : 0;

          return (
            <div
              key={p.providerId}
              className="p-4 rounded-xl bg-muted/20 border border-border/60 hover:border-border transition-all space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    {getStatusIcon(p.status)}
                    <span className="text-xs font-black text-foreground">{p.name}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground block font-mono">
                    {p.costPerCall} credits / call
                  </span>
                </div>
                {getStatusBadge(p.status)}
              </div>

              {/* Latency & Success Rate */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="p-2 rounded-lg bg-background border border-border/50 space-y-0.5">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3 text-sky-500" /> Latency
                  </span>
                  <span className="text-xs font-black text-foreground font-mono">
                    {p.connected ? `${p.latencyMs}ms` : '—'}
                  </span>
                </div>

                <div className="p-2 rounded-lg bg-background border border-border/50 space-y-0.5">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-emerald-500" /> Success
                  </span>
                  <span className="text-xs font-black text-foreground font-mono">
                    {p.connected ? `${p.successRate}%` : '—'}
                  </span>
                </div>
              </div>

              {/* Monthly Quota Meter */}
              {p.monthlyQuota > 0 && (
                <div className="space-y-1 pt-0.5">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>Monthly Quota</span>
                    <span className="font-mono">{p.monthlyUsed.toLocaleString()} / {p.monthlyQuota.toLocaleString()}</span>
                  </div>
                  <Progress 
                    value={quotaPercent} 
                    className={cn(
                      "h-1.5 bg-muted",
                      quotaPercent >= 90 ? "[&>div]:bg-rose-500" :
                      quotaPercent >= 75 ? "[&>div]:bg-amber-500" :
                      "[&>div]:bg-primary"
                    )} 
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
};
