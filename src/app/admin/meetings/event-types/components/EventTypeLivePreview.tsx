'use client';

/**
 * @fileoverview Live Public Booking Preview Canvas for Event Type Builder.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Renders a real-time responsive simulation of the public booking page.
 * - Zero 'any' policy strictly enforced.
 */

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Clock, Video, Globe, Calendar, Check, Sparkles } from 'lucide-react';
import type { BookingField, MeetingLocationType } from '@/lib/meetings/types';

interface EventTypeLivePreviewProps {
  name: string;
  durationMinutes: number;
  locationType: MeetingLocationType;
  color?: string;
  description?: string;
  questions?: BookingField[];
}

export function EventTypeLivePreview({
  name,
  durationMinutes,
  locationType,
  color = '#3b82f6',
  description,
  questions = [],
}: EventTypeLivePreviewProps) {
  const [selectedSlot, setSelectedSlot] = React.useState<string | null>('10:00 AM');

  const mockSlots = ['09:00 AM', '10:00 AM', '11:30 AM', '02:00 PM', '03:30 PM'];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-purple-600" /> Public Booking Preview
        </span>
        <Badge variant="outline" className="text-[10px] font-bold">
          Live Client Canvas
        </Badge>
      </div>

      <div className="p-6 rounded-3xl bg-background border-2 border-border/80 shadow-lg overflow-hidden space-y-6 max-w-lg mx-auto">
        {/* Top Accent Strip */}
        <div className="h-2 w-full rounded-full" style={{ backgroundColor: color }} />

        {/* Header Information */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
              JA
            </div>
            <span className="text-xs font-semibold text-muted-foreground">SmartSapp Team</span>
          </div>

          <h3 className="text-lg font-bold text-foreground leading-tight">
            {name || 'Untitled Event Type'}
          </h3>

          <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium pt-1">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-primary" /> {durationMinutes} mins
            </span>
            <span className="flex items-center gap-1 capitalize">
              <Video className="w-3.5 h-3.5 text-primary" /> {locationType.replace('_', ' ')}
            </span>
            <span className="flex items-center gap-1">
              <Globe className="w-3.5 h-3.5 text-primary" /> UTC
            </span>
          </div>

          {description && (
            <p className="text-xs text-muted-foreground pt-1 leading-relaxed line-clamp-2">
              {description}
            </p>
          )}
        </div>

        {/* Date & Slot Simulation */}
        <div className="space-y-3 pt-2 border-t border-border/60">
          <div className="flex items-center justify-between text-xs font-semibold text-foreground">
            <span>Select Date & Time</span>
            <span className="text-muted-foreground font-normal">August 2026</span>
          </div>

          {/* Time Slots Grid */}
          <div className="grid grid-cols-3 gap-2">
            {mockSlots.map(slot => {
              const isSelected = selectedSlot === slot;
              return (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setSelectedSlot(slot)}
                  className={`p-2 rounded-xl text-xs font-semibold border transition-all text-center ${
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                      : 'bg-card border-border hover:border-primary/50 text-foreground'
                  }`}
                >
                  {slot}
                </button>
              );
            })}
          </div>
        </div>

        {/* Intake Questions Preview */}
        {questions.length > 0 && (
          <div className="space-y-3 pt-2 border-t border-border/60">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
              Intake Questions ({questions.length})
            </span>
            <div className="space-y-2">
              {questions.slice(0, 2).map((q, idx) => (
                <div key={idx} className="space-y-1 text-xs">
                  <label className="font-semibold text-foreground flex items-center gap-1">
                    {q.label} {q.required && <span className="text-rose-500">*</span>}
                  </label>
                  <Input
                    readOnly
                    placeholder={q.placeholder || 'Your response...'}
                    className="rounded-xl text-xs h-9 bg-muted/20"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA Button */}
        <Button className="w-full rounded-2xl min-h-[44px] text-xs font-bold shadow-sm pointer-events-none">
          Confirm Booking
        </Button>
      </div>
    </div>
  );
}
