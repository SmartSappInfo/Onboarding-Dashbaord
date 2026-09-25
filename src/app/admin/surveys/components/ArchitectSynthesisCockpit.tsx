'use client';

/**
 * @fileoverview SmartSapp Survey Intelligence 2.0 — Architect Synthesis Cockpit
 *
 * ARCHITECTURAL GUIDELINES (Rule 10 & Strict Zero-Any Invariant):
 * 1. Zero Layout Shift: Smoothly occupies the studio view during AI synthesis without pushing controls off-screen.
 * 2. Visual Synthesis Radar: Displays animated stages (Blueprint -> Questions -> Logic -> Saving) with live elapsed timer.
 * 3. Graceful Failure Recovery: Allows non-destructive 1-click retry resuming from intermediate cached checkpoints.
 * 4. Micro-Interactions: Smooth pulse animations, active:scale-[0.97] tactile press, WCAG accessible colors.
 * 5. Strict Zero-Any Invariant: Completely typed state and handlers.
 */

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles,
  Loader2,
  Check,
  X,
  RotateCcw,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type SynthesisPhaseId = 'blueprint' | 'questions' | 'logic' | 'saving';
export type SynthesisPhaseStatus = 'idle' | 'running' | 'complete' | 'failed';

export interface SynthesisPhaseState {
  id: SynthesisPhaseId;
  label: string;
  description: string;
  status: SynthesisPhaseStatus;
  error?: string;
  icon: React.ElementType;
}

export interface ArchitectSynthesisCockpitProps {
  phases: SynthesisPhaseState[];
  isGenerating: boolean;
  onRetry: () => void | Promise<void>;
  onCancel?: () => void;
  className?: string;
}

export function ArchitectSynthesisCockpit({
  phases,
  isGenerating,
  onRetry,
  onCancel,
  className,
}: ArchitectSynthesisCockpitProps) {
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0);

  // Live timer while generating
  React.useEffect(() => {
    if (!isGenerating) return;

    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isGenerating]);

  const activePhase = phases.find((p) => p.status === 'running');
  const failedPhase = phases.find((p) => p.status === 'failed');
  const completedCount = phases.filter((p) => p.status === 'complete').length;
  const progressPercentage = Math.round((completedCount / phases.length) * 100);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card
      className={cn(
        'max-w-3xl mx-auto shadow-2xl border border-border/80 bg-card/70 backdrop-blur-xl rounded-[2.25rem] overflow-hidden p-6 sm:p-10 transition-all duration-300',
        className
      )}
    >
      <CardContent className="p-0 space-y-8 text-center">
        {/* Top Radar & Pulse Halo */}
        <div className="relative flex flex-col items-center justify-center">
          <div className="relative">
            {/* Pulsing Backlight Halo */}
            <div
              className={cn(
                'absolute -inset-4 rounded-full blur-xl transition-all duration-700 opacity-60',
                failedPhase
                  ? 'bg-rose-500/20'
                  : 'bg-gradient-to-r from-primary/30 via-purple-500/20 to-blue-500/30 animate-pulse'
              )}
            />

            {/* Central Stage Radar Orb */}
            <div
              className={cn(
                'relative w-20 h-20 rounded-full flex items-center justify-center border-2 shadow-2xl transition-all duration-500',
                failedPhase
                  ? 'bg-destructive/10 border-destructive text-destructive'
                  : 'bg-card border-primary/40 text-primary shadow-primary/20'
              )}
            >
              {failedPhase ? (
                <AlertTriangle className="h-9 w-9 text-destructive animate-bounce" />
              ) : isGenerating ? (
                <Loader2 className="h-9 w-9 text-primary animate-spin" />
              ) : (
                <Sparkles className="h-9 w-9 text-emerald-500 animate-pulse" />
              )}
            </div>
          </div>

          <div className="mt-5 space-y-1.5">
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              {failedPhase
                ? `Synthesis Paused at ${failedPhase.label}`
                : isGenerating
                ? activePhase?.description || 'Synthesizing Survey Architecture...'
                : 'Survey Architecture Complete!'}
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
              {failedPhase
                ? failedPhase.error || 'An unexpected issue occurred. Click retry to resume from this step.'
                : 'Our neural architect is assembling multi-channel question blocks, scoring thresholds, and outcome logic.'}
            </p>
          </div>

          {/* Live Telemetry Badge Strip */}
          <div className="mt-4 flex items-center justify-center gap-3">
            <Badge
              variant="outline"
              className="text-[11px] font-mono font-semibold px-2.5 py-1 rounded-xl bg-background/80 border-border/80 flex items-center gap-1.5"
            >
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span>Elapsed: {formatTimer(elapsedSeconds)}</span>
            </Badge>

            <Badge
              variant="outline"
              className="text-[11px] font-mono font-semibold px-2.5 py-1 rounded-xl bg-background/80 border-border/80 text-primary"
            >
              {progressPercentage}% Complete
            </Badge>
          </div>
        </div>

        {/* 4-Stage Step Indicators */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          {phases.map((phase) => {
            const Icon = phase.icon;
            const isRunning = phase.status === 'running';
            const isComplete = phase.status === 'complete';
            const isFailed = phase.status === 'failed';

            return (
              <div
                key={phase.id}
                className={cn(
                  'p-4 rounded-2xl border text-center flex flex-col items-center transition-all duration-300',
                  isComplete && 'bg-emerald-500/[0.06] border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
                  isRunning && 'bg-primary/[0.08] border-primary/40 text-primary ring-2 ring-primary/20',
                  isFailed && 'bg-destructive/[0.08] border-destructive/40 text-destructive',
                  !isComplete && !isRunning && !isFailed && 'bg-background/40 border-border/60 text-muted-foreground opacity-60'
                )}
              >
                <div
                  className={cn(
                    'w-9 h-9 rounded-xl flex items-center justify-center border transition-all mb-2',
                    isComplete && 'bg-emerald-500 border-emerald-500 text-white shadow-sm',
                    isRunning && 'bg-primary border-primary text-white shadow-md animate-pulse',
                    isFailed && 'bg-destructive border-destructive text-white',
                    !isComplete && !isRunning && !isFailed && 'bg-muted border-border text-muted-foreground'
                  )}
                >
                  {isComplete ? (
                    <Check className="h-4 w-4" />
                  ) : isRunning ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isFailed ? (
                    <X className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>

                <span className="text-xs font-bold tracking-tight block">{phase.label}</span>
                <span className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                  {isFailed ? 'Error' : phase.description}
                </span>
              </div>
            );
          })}
        </div>

        {/* Retry or Failure Recovery Action Bar */}
        {failedPhase && (
          <div className="pt-4 border-t border-border/50 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              type="button"
              variant="default"
              onClick={onRetry}
              disabled={isGenerating}
              className="h-11 px-6 rounded-xl font-bold text-xs gap-2 active:scale-[0.97] transition-all shadow-md w-full sm:w-auto"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Retry from {failedPhase.label}</span>
            </Button>

            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isGenerating}
                className="h-11 px-4 rounded-xl font-semibold text-xs active:scale-[0.97] w-full sm:w-auto"
              >
                Return to Studio
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ArchitectSynthesisCockpit;
