'use client';

/**
 * @fileOverview Meeting AI Timeline Component (Phase 11 M5 · T1; PRD §63, UI §3507)
 *
 * Implements:
 * - Rule 4 (Strict Typing: zero any/any[])
 * - Rule 7 (Mobile-first, min-h-[44px] touch targets, Emil Kowalski micro-interactions)
 * - Rule 10 (Guiding Comments)
 * - Rule 13 & 30 (Untrusted Transcript Containerization via <untrusted_reference_data id="...">)
 * - Click-to-seek timestamp alignment jumping to exact second in audio/transcript
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import {
  Clock,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  HelpCircle,
  TrendingUp,
  MessageSquare,
  Play,
} from 'lucide-react';

export type TimelineItemType =
  | 'speech'
  | 'decision'
  | 'commitment'
  | 'objection'
  | 'question'
  | 'deal_stage';

export interface MeetingTimelineEvent {
  id: string;
  type: TimelineItemType;
  timestampSeconds: number;
  formattedTime: string; // e.g. "04:12"
  speakerName?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  text: string;
  confidence?: number;
  highlighted?: boolean;
}

export interface MeetingAiTimelineProps {
  meetingId: string;
  events: MeetingTimelineEvent[];
  activeSecond?: number;
  onSeekToSecond?: (seconds: number) => void;
  isLoading?: boolean;
}

const TYPE_CONFIG: Record<
  TimelineItemType,
  { label: string; icon: React.ElementType; color: string }
> = {
  speech: { label: 'Speech', icon: MessageSquare, color: 'text-muted-foreground' },
  decision: { label: 'Decision', icon: CheckCircle2, color: 'text-emerald-500' },
  commitment: { label: 'Commitment', icon: Calendar, color: 'text-blue-500' },
  objection: { label: 'Objection', icon: AlertTriangle, color: 'text-amber-500' },
  question: { label: 'Question', icon: HelpCircle, color: 'text-purple-500' },
  deal_stage: { label: 'Deal Stage', icon: TrendingUp, color: 'text-cyan-500' },
};

export function MeetingAiTimeline({
  meetingId,
  events,
  activeSecond = 0,
  onSeekToSecond,
  isLoading = false,
}: MeetingAiTimelineProps) {
  const [filterType, setFilterType] = React.useState<'all' | TimelineItemType>('all');

  const filteredEvents = React.useMemo(() => {
    if (filterType === 'all') return events;
    return events.filter((e) => e.type === filterType);
  }, [events, filterType]);

  return (
    <Card className="rounded-2xl border border-border/80 shadow-sm bg-card text-card-foreground">
      <CardHeader className="pb-3 border-b border-border/80 bg-muted/20 px-4 sm:px-6 py-3.5 sm:py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            AI Timeline & Key Moments
            <CardInfoTooltip text="Interactive chronological timeline of meeting speech and extracted decisions, commitments, and objections. Click any moment to jump the transcript to that second." />
          </CardTitle>

          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {(
              [
                'all',
                'decision',
                'commitment',
                'objection',
                'question',
                'deal_stage',
              ] as const
            ).map((t) => (
              <Button
                key={t}
                variant={filterType === t ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setFilterType(t)}
                className="text-xs h-7 px-2.5 rounded-lg active:scale-[0.97] capitalize shrink-0"
              >
                {t.replace('_', ' ')}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 space-y-4">
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 w-full animate-pulse rounded-xl bg-muted/30" />
            ))}
          </div>
        )}

        {!isLoading && filteredEvents.length === 0 && (
          <div className="text-center py-8 space-y-2">
            <Clock className="h-8 w-8 mx-auto text-muted-foreground/50" />
            <p className="text-sm font-medium">No timeline events found</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Once meeting transcription and AI extraction are complete, key moments, decisions, and speech segments will appear here.
            </p>
          </div>
        )}

        {!isLoading && filteredEvents.length > 0 && (
          <div className="relative pl-6 sm:pl-8 space-y-4 before:absolute before:left-2.5 sm:before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/80">
            {filteredEvents.map((event) => {
              const config = TYPE_CONFIG[event.type] || TYPE_CONFIG.speech;
              const Icon = config.icon;
              const isPast = activeSecond >= event.timestampSeconds;

              return (
                <div
                  key={event.id}
                  className={`group relative flex flex-col gap-1.5 p-3 rounded-xl border border-transparent transition-all ${
                    event.highlighted
                      ? 'bg-primary/5 border-primary/20 shadow-xs'
                      : 'hover:bg-muted/30 hover:border-border/60'
                  }`}
                >
                  {/* Timeline Node Dot */}
                  <div
                    className={`absolute -left-[1.85rem] sm:-left-[2.35rem] top-3.5 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      isPast
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card text-muted-foreground'
                    }`}
                  >
                    <Icon className="h-2.5 w-2.5" />
                  </div>

                  {/* Header Row */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onSeekToSecond?.(event.timestampSeconds)}
                        className="h-6 px-2 text-[11px] font-mono rounded-md flex items-center gap-1 active:scale-[0.97]"
                        aria-label={`Jump to ${event.formattedTime}`}
                      >
                        <Play className="h-2.5 w-2.5 text-primary fill-primary" />
                        {event.formattedTime}
                      </Button>

                      {event.speakerName && (
                        <span className="text-xs font-semibold text-foreground">
                          {event.speakerName}
                        </span>
                      )}

                      <Badge
                        variant="secondary"
                        className={`text-[10px] px-1.5 py-0 capitalize ${config.color}`}
                      >
                        {config.label}
                      </Badge>
                    </div>

                    {event.confidence !== undefined && (
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {Math.round(event.confidence * 100)}% conf
                      </span>
                    )}
                  </div>

                  {/* Isolated Statement Text (Rule 13 & 30) */}
                  <div className="text-xs leading-relaxed text-foreground/90 pl-1">
                    <span
                      data-untrusted-container={`meeting_${meetingId}_event_${event.id}`}
                      className="break-words"
                    >
                      {event.text}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default MeetingAiTimeline;
