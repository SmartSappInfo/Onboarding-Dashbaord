'use client';

/**
 * Geographic Territory Intelligence Matrix (Lead Intelligence 2.0 - Phase 11)
 * UI Spec Section 49: "Territory Intelligence UX"
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. Regional density and market penetration analytics.
 * 2. Mobile-responsive card grid with touch targets >= 44px.
 * 3. Emil Kowalski active physics (active:scale-[0.97]).
 * 4. Strict Zero-`any` typing.
 */

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  MapPin, 
  Target, 
  Flame, 
  PieChart 
} from 'lucide-react';
import type { TerritoryIntelligenceMetric } from '@/lib/lead-intelligence/types';
import { cn } from '@/lib/utils';

interface TerritoryIntelligenceMatrixProps {
  territories: TerritoryIntelligenceMetric[];
  className?: string;
}

export const TerritoryIntelligenceMatrix: React.FC<TerritoryIntelligenceMatrixProps> = ({
  territories,
  className
}) => {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-extrabold text-foreground tracking-tight flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            <span>Geographic Territory Intelligence & Penetration</span>
          </h4>
          <p className="text-xs text-muted-foreground pt-0.5">
            Regional market density and target account distribution across key economic zones.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {territories.map((t) => (
          <Card
            key={t.region}
            className="bg-card border-border/70 shadow-xs hover:border-primary/40 transition-all rounded-2xl p-4 space-y-3 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <h5 className="text-xs font-bold text-foreground truncate flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span>{t.region}</span>
                </h5>
                <Badge variant="outline" className="text-[10px] font-mono font-bold">
                  {t.penetrationRate}% Density
                </Badge>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">Regional Share</span>
                  <span className="font-bold text-foreground">{t.prospectsCount} Prospects</span>
                </div>
                <Progress value={t.penetrationRate} className="h-1.5" />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                <div className="p-2 rounded-xl bg-muted/20 border border-border/60 space-y-0.5">
                  <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                    <Target className="h-3 w-3 text-purple-500" /> Qualified
                  </span>
                  <p className="font-extrabold text-foreground font-mono">
                    {t.qualifiedCount} leads
                  </p>
                </div>

                <div className="p-2 rounded-xl bg-muted/20 border border-border/60 space-y-0.5">
                  <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                    <Flame className="h-3 w-3 text-rose-500" /> High Intent
                  </span>
                  <p className="font-extrabold text-foreground font-mono">
                    {t.highIntentCount} accounts
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border/50 text-[10px] text-muted-foreground">
              <span>Strategic Priority</span>
              <span className={cn(
                "font-bold uppercase",
                t.highIntentCount > 5 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
              )}>
                {t.highIntentCount > 5 ? 'High Priority Zone' : 'Standard Outreach'}
              </span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
