'use client';

/**
 * @fileOverview AI Strategic Insights Tab Component (Phase 11)
 *
 * Displays AI-generated executive organizational takeaways and strategic recommendations
 * categorized across Capacity, Security, Governance, and Onboarding.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Employs Emil Kowalski spring animations.
 * - Zero `any` or `any[]` typing.
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Shield, Layers, Users, ArrowRight } from 'lucide-react';
import type { AiStrategicInsight } from '@/lib/types';

interface AiStrategicInsightsTabProps {
  insights: AiStrategicInsight[];
}

export function AiStrategicInsightsTab({ insights }: AiStrategicInsightsTabProps) {
  const categoryIcon = (category: AiStrategicInsight['category']) => {
    switch (category) {
      case 'capacity':
      case 'workload':
        return <Layers className="w-4 h-4 text-primary" />;
      case 'security':
        return <Shield className="w-4 h-4 text-emerald-600" />;
      case 'governance':
      case 'onboarding':
      default:
        return <Users className="w-4 h-4 text-blue-600" />;
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border bg-card shadow-xs">
        <CardHeader className="p-4 pb-3 border-b bg-muted/20">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <div>
              <CardTitle className="text-sm font-bold">AI Strategic Organizational Insights</CardTitle>
              <CardDescription className="text-xs">
                Synthesized executive intelligence and structural optimization recommendations
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 space-y-4">
          {insights.map((ins) => (
            <div
              key={ins.id}
              className="p-4 border rounded-lg bg-card hover:bg-muted/10 transition-colors space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  {categoryIcon(ins.category)}
                  <h4 className="font-bold text-xs text-foreground">{ins.title}</h4>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant="secondary" className="text-[9px] uppercase font-bold">
                    {ins.category}
                  </Badge>
                  <Badge
                    variant={ins.impactLevel === 'high' ? 'destructive' : 'outline'}
                    className="text-[9px] uppercase font-bold tracking-wider"
                  >
                    Impact: {ins.impactLevel}
                  </Badge>
                </div>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">{ins.summary}</p>

              <div className="p-3 bg-muted/20 border rounded-md text-xs space-y-1">
                <span className="font-bold text-primary flex items-center gap-1 text-[11px]">
                  Strategic Recommendation <ArrowRight className="w-3 h-3" />
                </span>
                <p className="text-xs text-foreground">{ins.recommendation}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default AiStrategicInsightsTab;
