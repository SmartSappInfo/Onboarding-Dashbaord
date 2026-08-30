'use client';

/**
 * RevOps Provider Performance & Credit Efficiency Card (Lead Intelligence 2.0 - Phase 11)
 * UI Spec Section 46: "Provider Performance"
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. Tracks API credit efficiency, cost per contact, and latency across providers.
 * 2. Mobile-responsive card grid with touch targets >= 44px.
 * 3. Emil Kowalski active physics (active:scale-[0.97]).
 * 4. Strict Zero-`any` typing.
 */

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Server, 
  Coins, 
  Clock, 
  CheckCircle2, 
  Zap 
} from 'lucide-react';
import type { ProviderPerformanceMetric } from '@/lib/lead-intelligence/types';
import { cn } from '@/lib/utils';

interface ProviderPerformanceCardProps {
  providers: ProviderPerformanceMetric[];
  className?: string;
}

export const ProviderPerformanceCard: React.FC<ProviderPerformanceCardProps> = ({
  providers,
  className
}) => {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-extrabold text-foreground tracking-tight flex items-center gap-2">
            <Server className="h-4 w-4 text-primary" />
            <span>Enrichment Provider Performance & Credits</span>
          </h4>
          <p className="text-xs text-muted-foreground pt-0.5">
            RevOps audit tracking vendor latency, success rate, and credit consumption efficiency.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {providers.map((p) => (
          <Card
            key={p.providerName}
            className="bg-card border-border/70 shadow-xs hover:border-primary/40 transition-all rounded-2xl space-y-3 p-4 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <h5 className="text-xs font-bold text-foreground truncate">{p.providerName}</h5>
                <Badge className="bg-emerald-500/20 text-emerald-600 border-emerald-500/40 text-[10px] font-bold">
                  {p.successRate}% Success
                </Badge>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">Request Success Yield</span>
                  <span className="font-bold text-foreground">{p.successfulRequests} / {p.totalRequests}</span>
                </div>
                <Progress value={p.successRate} className="h-1.5" />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                <div className="p-2 rounded-xl bg-muted/20 border border-border/60 space-y-0.5">
                  <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                    <Coins className="h-3 w-3" /> Cost / Contact
                  </span>
                  <p className="font-extrabold text-foreground font-mono">
                    {p.costPerValidContact} cr
                  </p>
                </div>

                <div className="p-2 rounded-xl bg-muted/20 border border-border/60 space-y-0.5">
                  <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Avg Latency
                  </span>
                  <p className="font-extrabold text-foreground font-mono">
                    {p.avgLatencyMs} ms
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
              <span>Total Credits Used</span>
              <span className="font-bold font-mono text-primary">{p.creditsUsed} Credits</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
