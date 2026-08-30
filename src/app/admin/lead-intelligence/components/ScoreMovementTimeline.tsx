'use client';

/**
 * Score Movement Timeline Component (Lead Intelligence 2.0 - Phase 8)
 * UI Spec Section 35: "Score Timeline & Velocity Movement"
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. Visual step progression tracking score velocity over time.
 * 2. Clickable milestone nodes displaying the exact cause of score shifts.
 * 3. Mobile touch target compliance (min-h-[44px]).
 * 4. Emil Kowalski active physics (active:scale-[0.97]).
 * 5. Strict Zero-`any` typing.
 */

import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Flame, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  Sparkles
} from 'lucide-react';
import type { Prospect, LeadSignal, ScoreMovementEvent } from '@/lib/lead-intelligence/types';
import { ExplainableScoringEngine } from '@/lib/lead-intelligence/scoring';
import { getProspectScoreHistoryAction } from '@/app/actions/lead-intelligence-actions';
import { cn } from '@/lib/utils';

interface ScoreMovementTimelineProps {
  prospect: Prospect;
  signals?: LeadSignal[];
  className?: string;
}

export const ScoreMovementTimeline: React.FC<ScoreMovementTimelineProps> = ({
  prospect,
  signals = [],
  className
}) => {
  const [history, setHistory] = useState<ScoreMovementEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<ScoreMovementEvent | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    getProspectScoreHistoryAction(prospect.id, prospect.workspaceId)
      .then((res) => {
        if (isMounted) {
          const events = ExplainableScoringEngine.calculateScoreTimeline(
            prospect,
            signals,
            res.success ? res.history : []
          );
          setHistory(events);
          if (events.length > 0) {
            setSelectedEvent(events[events.length - 1]);
          }
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [prospect.id, prospect.workspaceId, signals.length]);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'intent':
        return <Flame className="h-3.5 w-3.5 text-rose-500" />;
      case 'technographic':
        return <Activity className="h-3.5 w-3.5 text-purple-500" />;
      case 'leadership':
        return <Sparkles className="h-3.5 w-3.5 text-sky-500" />;
      case 'compliance':
        return <AlertCircle className="h-3.5 w-3.5 text-amber-500" />;
      default:
        return <CheckCircle2 className="h-3.5 w-3.5 text-primary" />;
    }
  };

  if (history.length === 0 && !isLoading) return null;

  return (
    <div className={cn("p-4 rounded-2xl border border-border/80 bg-card shadow-sm space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
            Score Movement Timeline
          </h4>
        </div>
        <span className="text-[11px] text-muted-foreground font-mono">
          {history.length} Event{history.length !== 1 ? 's' : ''} Tracked
        </span>
      </div>

      {/* Interactive Timeline Visual Step Rail (UI Spec Section 35) */}
      <div className="relative py-2 px-1">
        {/* Connecting line */}
        <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-0.5 bg-border/80 z-0" />

        <div className="relative z-10 flex items-center justify-between gap-2 overflow-x-auto pb-1">
          {history.map((ev, idx) => {
            const isSelected = selectedEvent?.id === ev.id;
            return (
              <button
                key={ev.id || idx}
                type="button"
                onClick={() => setSelectedEvent(ev)}
                className={cn(
                  "group flex flex-col items-center gap-1 min-w-[56px] focus:outline-none transition-all cursor-pointer",
                  "active:scale-[0.97]"
                )}
              >
                <div
                  className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center border-2 transition-all font-mono font-bold text-xs shadow-sm",
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary scale-110 shadow-md ring-4 ring-primary/20"
                      : "bg-card text-foreground border-border hover:border-primary/60"
                  )}
                >
                  {ev.newScore}
                </div>

                <span className="text-[9px] text-muted-foreground font-semibold">
                  {new Date(ev.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Event Details Card */}
      {selectedEvent && (
        <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 space-y-2">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <div className="p-1.5 rounded-lg bg-background border border-border/60">
                {getCategoryIcon(selectedEvent.category)}
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-primary tracking-wider block">
                  Inflection Event
                </span>
                <h5 className="text-xs font-bold text-foreground">
                  Score Shift: {selectedEvent.oldScore} → {selectedEvent.newScore}
                </h5>
              </div>
            </div>

            <Badge 
              className={cn(
                "text-[10px] font-bold font-mono px-2 py-0.5",
                selectedEvent.change > 0 && "bg-emerald-500/20 text-emerald-600 border-emerald-500/40",
                selectedEvent.change < 0 && "bg-rose-500/20 text-rose-600 border-rose-500/40",
                selectedEvent.change === 0 && "bg-muted text-muted-foreground"
              )}
            >
              {selectedEvent.change > 0 ? `+${selectedEvent.change}` : selectedEvent.change} Points
            </Badge>
          </div>

          <p className="text-xs text-foreground/90 font-medium leading-relaxed pl-8">
            {selectedEvent.reason}
          </p>

          <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono pl-8 pt-0.5">
            <Calendar className="h-3 w-3" />
            <span>{new Date(selectedEvent.timestamp).toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
};
