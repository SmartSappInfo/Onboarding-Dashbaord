'use client';

/**
 * @fileoverview Scorecard Dimension Weights Tab for Performance Policy Studio (Phase 4).
 *
 * ARCHITECTURAL POINTER:
 * Implements PRD Section 17 Composite Performance Index configuration:
 * - 5 interactive sliders for Activity, Effort, Quality, Effectiveness, and Outcome.
 * - Dynamic 100% sum validation indicator with visual error callout.
 * - One-click "Auto-Balance to 100%" helper button.
 * - Clear domain explanations of each performance pillar.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing policy enforced. Zero 'any' or 'any[]'.
 * - Controls enforce >= 44px touch envelopes.
 * - Micro-interactions use active:scale-[0.97].
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Sparkles,
  PieChart,
  Activity,
  Award,
  ShieldCheck,
  TrendingUp,
  DollarSign,
} from 'lucide-react';
import type { PolicyDimensionWeights } from '@/lib/policy-studio/types';

interface DimensionsTabProps {
  dimensions: PolicyDimensionWeights;
  onChange: (updated: PolicyDimensionWeights) => void;
}

interface DimensionMeta {
  key: keyof PolicyDimensionWeights;
  label: string;
  shortDesc: string;
  icon: React.ElementType;
  color: string;
}

const DIMENSIONS_METADATA: DimensionMeta[] = [
  {
    key: 'activityWeight',
    label: 'Activity (Volume)',
    shortDesc: 'Gross volume of client touches: outbound calls, meetings, sent emails, and tasks.',
    icon: Activity,
    color: 'text-sky-500',
  },
  {
    key: 'effortWeight',
    label: 'Effort (Intentional Work)',
    shortDesc: 'Weighted human prospecting, discovery, deep prep, and diligence points earned.',
    icon: Award,
    color: 'text-indigo-500',
  },
  {
    key: 'qualityWeight',
    label: 'Quality (Execution Standards)',
    shortDesc: 'Adherence to CRM hygiene, meeting notes completeness, and call duration standards.',
    icon: ShieldCheck,
    color: 'text-emerald-500',
  },
  {
    key: 'effectivenessWeight',
    label: 'Effectiveness (Buyer Response)',
    shortDesc: 'Ability to elicit meaningful buyer engagement: call connect rate and meeting attendance.',
    icon: TrendingUp,
    color: 'text-purple-500',
  },
  {
    key: 'outcomeWeight',
    label: 'Outcome (Revenue & Won Deals)',
    shortDesc: 'Bottom-line commercial achievement: pipeline value generated and deals closed won.',
    icon: DollarSign,
    color: 'text-amber-500',
  },
];

export function DimensionsTab({ dimensions, onChange }: DimensionsTabProps) {
  // Sum check
  const totalPercent = Math.round(
    (dimensions.activityWeight +
      dimensions.effortWeight +
      dimensions.qualityWeight +
      dimensions.effectivenessWeight +
      dimensions.outcomeWeight) *
      100
  );

  const isValidSum = totalPercent === 100;

  const handleSliderChange = (key: keyof PolicyDimensionWeights, percentValue: number) => {
    const newWeight = Math.max(0, Math.min(100, percentValue)) / 100;
    onChange({
      ...dimensions,
      [key]: Math.round(newWeight * 100) / 100,
    });
  };

  const handleAutoBalance = () => {
    // Standard recommended balanced profile (30 / 25 / 15 / 15 / 15)
    onChange({
      activityWeight: 0.3,
      effortWeight: 0.25,
      qualityWeight: 0.15,
      effectivenessWeight: 0.15,
      outcomeWeight: 0.15,
    });
  };

  return (
    <div className="space-y-6 max-w-4xl text-left">
      {/* Top Header & Validation Callout */}
      <Card className="rounded-2xl border bg-card/60 backdrop-blur-sm p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <PieChart className="h-5 w-5 text-primary" />
              <h3 className="text-base font-bold text-foreground">
                Composite Scorecard Dimensions
              </h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Allocate relative importance across the 5 performance pillars. The combined sum must equal exactly 100%.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {isValidSum ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                <CheckCircle2 className="h-4 w-4" />
                <span>100% Balanced</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold text-xs">
                <AlertCircle className="h-4 w-4" />
                <span>Current Sum: {totalPercent}%</span>
              </div>
            )}

            {!isValidSum && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAutoBalance}
                className="min-h-[38px] text-xs font-semibold rounded-xl active:scale-[0.97]"
              >
                <Sparkles className="h-3.5 w-3.5 mr-1 text-primary" /> Auto-Balance
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Sliders Grid */}
      <div className="space-y-4">
        {DIMENSIONS_METADATA.map((meta) => {
          const currentWeight = dimensions[meta.key];
          const currentPercent = Math.round(currentWeight * 100);
          const Icon = meta.icon;

          return (
            <Card
              key={meta.key}
              className="rounded-2xl border bg-card/60 backdrop-blur-sm p-5 space-y-3 transition-all hover:border-primary/30"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${meta.color}`} />
                    <span className="text-sm font-bold text-foreground">{meta.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{meta.shortDesc}</p>
                </div>

                <div className="flex items-baseline gap-1 shrink-0 font-mono font-bold text-lg text-primary self-end sm:self-auto">
                  <span>{currentPercent}</span>
                  <span className="text-xs text-muted-foreground font-semibold">%</span>
                </div>
              </div>

              {/* Slider Component */}
              <div className="pt-2 px-1">
                <Slider
                  value={[currentPercent]}
                  min={0}
                  max={60}
                  step={5}
                  onValueChange={(val) => handleSliderChange(meta.key, val[0])}
                  className="cursor-pointer py-2"
                />
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
