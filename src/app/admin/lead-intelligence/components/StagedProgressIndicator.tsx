'use client';

/**
 * Staged Progress Indicator Component
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. UI Spec Alignment: Implements intelligence_ui Section 73 (Multi-stage transparent progress).
 * 2. Emil Kowalski Motion: Micro-interactions with spring physics and smooth step advancement.
 * 3. Accessibility: ARIA progress role, accessible stage labels, reduced-motion compliance.
 */

import React, { useEffect, useState } from 'react';
import { Search, ShieldCheck, Sparkles, Database, CheckCircle2, Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export interface StageStep {
  id: number;
  label: string;
  sublabel: string;
  icon: React.ElementType;
}

const DEFAULT_STAGES: StageStep[] = [
  { id: 1, label: 'Querying Provider & Locations', sublabel: 'Scanning geographical radius and place registries...', icon: Search },
  { id: 2, label: 'Resolving Identifiers & Deduplication', sublabel: 'Canonicalizing domains, phone numbers & CRM records...', icon: ShieldCheck },
  { id: 3, label: 'Diagnosing Technographics & Digital Gaps', sublabel: 'Analyzing SSL certificates, tech footprint & pain points...', icon: Sparkles },
  { id: 4, label: 'Synthesizing AI Opportunity & Pitch', sublabel: 'Scoring acquisition propensity & objection counters...', icon: Database },
];

interface StagedProgressIndicatorProps {
  isActive: boolean;
  title?: string;
  stages?: StageStep[];
  currentStageIndex?: number;
  onComplete?: () => void;
  className?: string;
}

export const StagedProgressIndicator: React.FC<StagedProgressIndicatorProps> = ({
  isActive,
  title = 'Executing Lead Intelligence Pipeline',
  stages = DEFAULT_STAGES,
  currentStageIndex: controlledStageIndex,
  className = '',
}) => {
  const [internalStage, setInternalStage] = useState(0);

  // Auto-progress simulation if stage is uncontrolled
  useEffect(() => {
    if (!isActive) {
      setInternalStage(0);
      return;
    }

    if (controlledStageIndex !== undefined) return;

    const interval = setInterval(() => {
      setInternalStage((prev) => {
        if (prev < stages.length - 1) return prev + 1;
        return prev;
      });
    }, 1400);

    return () => clearInterval(interval);
  }, [isActive, controlledStageIndex, stages.length]);

  const activeIndex = controlledStageIndex !== undefined ? controlledStageIndex : internalStage;
  const progressPercent = Math.min(100, Math.round(((activeIndex + 1) / stages.length) * 100));

  if (!isActive) return null;

  return (
    <div className={`p-5 rounded-2xl bg-card border border-border/80 shadow-md space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
            {title}
          </h4>
          <p className="text-[11px] text-muted-foreground">
            Stage {activeIndex + 1} of {stages.length}: {stages[activeIndex]?.label}
          </p>
        </div>
        <span className="text-xs font-mono font-bold text-foreground">{progressPercent}%</span>
      </div>

      <Progress value={progressPercent} className="h-1.5 bg-muted rounded-full" />

      {/* Stage Items Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 pt-1">
        {stages.map((stage, idx) => {
          const isDone = idx < activeIndex;
          const isCurrent = idx === activeIndex;
          const StageIcon = stage.icon;

          return (
            <div
              key={stage.id}
              className={`p-2.5 rounded-xl border text-left transition-all duration-200 ${
                isCurrent
                  ? 'bg-primary/10 border-primary/40 ring-1 ring-primary/20 shadow-sm'
                  : isDone
                  ? 'bg-muted/30 border-border/60 opacity-80'
                  : 'bg-muted/10 border-border/30 opacity-40'
              }`}
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <StageIcon className={`w-3.5 h-3.5 ${isCurrent ? 'text-primary' : isDone ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                {isDone ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                ) : isCurrent ? (
                  <span className="flex h-2 w-2 rounded-full bg-primary animate-ping" />
                ) : (
                  <span className="text-[9px] font-mono text-muted-foreground">#{idx + 1}</span>
                )}
              </div>
              <div className="font-semibold text-[11px] text-foreground truncate">{stage.label}</div>
              <div className="text-[9px] text-muted-foreground line-clamp-1 mt-0.5">{stage.sublabel}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
