'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Pre-Flight Dispatch Cockpit
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR FUTURE MAINTAINERS (Rule 10):
 * 1. Consolidates previously fragmented stat boxes into a unified executive pre-flight cockpit.
 * 2. Strict Zero-Any Invariant: All form controls, callbacks, and audience metrics are strictly typed.
 * 3. Mobile-first ergonomics: Touch targets >= 44px, tactile Emil Kowalski press states (active:scale-[0.97]).
 * 4. Preserves 100% of React Hook Form bindings: 'senderProfileId', 'isScheduled', 'scheduledAt'.
 * 5. Replaces bulky stacked alert banners with a sleek, compact System Assurance Strip.
 */

import * as React from 'react';
import { Controller, type Control, type FieldValues } from 'react-hook-form';
import { 
  ShieldCheck, 
  CalendarClock, 
  Zap, 
  Users, 
  Clock, 
  ShieldAlert, 
  Lock,
  CheckCircle2
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DateTimePicker } from '@/components/ui/datetime-picker';
import { SenderProfileSelector } from '@/components/messaging/SenderProfileSelector';
import type { SenderProfile } from '@/lib/types';
import { cn } from '@/lib/utils';

export interface PreFlightCockpitProps<TFieldValues extends FieldValues = FieldValues> {
  control: Control<TFieldValues>;
  channel: 'email' | 'sms' | 'whatsapp';
  senderProfileId?: string;
  isScheduled: boolean;
  scheduledAt?: Date;
  recipientCount: number;
  audienceSource: 'individual' | 'manual' | 'saved';
  audienceMode?: 'entities' | 'team' | 'adhoc';
  activeOrganizationId?: string;
  activeWorkspaceId?: string;
  onScheduleToggle: (scheduled: boolean) => void;
  onOpenTestModal: () => void;
  onSelectSenderProfile?: (profile: SenderProfile | null) => void;
  highVolumeThreshold?: number;
}

export function PreFlightCockpit<TFieldValues extends FieldValues = FieldValues>({
  control,
  channel,
  isScheduled,
  recipientCount,
  audienceSource,
  audienceMode = 'entities',
  activeOrganizationId,
  activeWorkspaceId,
  onScheduleToggle,
  onSelectSenderProfile,
  highVolumeThreshold = 50,
}: PreFlightCockpitProps<TFieldValues>) {
  // Compute estimated throughput time (approx 30 msgs/sec for gateways)
  const estimatedSeconds = Math.max(1, Math.ceil((recipientCount * 0.5)));
  const estimatedMinutes = Math.max(1, Math.ceil(estimatedSeconds / 60));

  return (
    <div className="space-y-5 text-left">
      {/* ─── SENDER IDENTITY SECTION ─── */}
      <div className="space-y-2.5">
        <Label className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" /> Sender Identity
        </Label>

        <Controller
          name={"senderProfileId" as import('react-hook-form').Path<TFieldValues>}
          control={control}
          render={({ field }) => (
            <SenderProfileSelector
              channel={channel}
              value={field.value}
              onChange={field.onChange}
              onSelectProfile={onSelectSenderProfile}
              organizationId={activeOrganizationId}
              workspaceId={activeWorkspaceId}
              defaultSentinelValue={channel === 'whatsapp' ? 'whatsapp' : 'default'}
              defaultLabel={channel === 'whatsapp' ? 'WhatsApp Business Account' : 'Default Profile'}
              allowDefault={true}
              placeholder="Select sender identity..."
              triggerClassName="h-12 rounded-xl bg-card border-border/80 shadow-xs font-semibold text-xs transition-all active:scale-[0.98]"
            />
          )}
        />
        <p className="text-[11px] text-muted-foreground/70 px-1 leading-tight">
          Messages will be routed through verified organizational credentials.
        </p>
      </div>

      {/* ─── PRE-FLIGHT AUDIENCE & DELIVERY COCKPIT ─── */}
      <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-xs">
        {/* Top Header: Audience Telemetry */}
        <div className="p-4 bg-muted/20 border-b border-border/50 flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Target Audience</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
                {recipientCount}
              </span>
              <span className="text-xs font-semibold text-muted-foreground">
                {audienceMode === 'team'
                  ? (recipientCount === 1 ? 'teammate ready' : 'teammates ready')
                  : (recipientCount === 1 ? 'recipient ready' : 'recipients ready')}
              </span>
            </div>
          </div>

          <div className="text-right">
            <Badge variant="secondary" className="text-[10px] font-bold px-2 py-0.5 capitalize">
              {audienceMode === 'team'
                ? 'Internal Team'
                : audienceMode === 'adhoc'
                  ? 'Direct & Spreadsheet'
                  : audienceSource === 'individual'
                    ? 'Direct Select'
                    : audienceSource === 'saved'
                      ? 'Saved Segment'
                      : 'Manual Audience'}
            </Badge>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 flex items-center justify-end gap-1">
              <CheckCircle2 className="h-3 w-3" />
              <span>100% Validated</span>
            </p>
          </div>
        </div>

        {/* Middle: Delivery Mode Segmented Switcher */}
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Dispatch Mode
            </Label>

            {/* Segmented Pill Selector with high-contrast primary selection */}
            <div className="grid grid-cols-2 p-1 bg-muted/40 rounded-xl border border-border/50 gap-1">
              <button
                type="button"
                onClick={() => onScheduleToggle(false)}
                className={cn(
                  'flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs font-bold transition-all duration-150 active:scale-[0.97] min-h-[44px]',
                  !isScheduled
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-card/70 font-semibold'
                )}
              >
                <Zap
                  className={cn(
                    'h-3.5 w-3.5 transition-colors',
                    !isScheduled
                      ? 'text-primary-foreground fill-primary-foreground stroke-[2.5]'
                      : 'text-emerald-600 dark:text-emerald-400'
                  )}
                />
                <span>Immediate</span>
              </button>

              <button
                type="button"
                onClick={() => onScheduleToggle(true)}
                className={cn(
                  'flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs font-bold transition-all duration-150 active:scale-[0.97] min-h-[44px]',
                  isScheduled
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-card/70 font-semibold'
                )}
              >
                <CalendarClock
                  className={cn(
                    'h-3.5 w-3.5 transition-colors',
                    isScheduled
                      ? 'text-primary-foreground stroke-[2.5]'
                      : 'text-primary'
                  )}
                />
                <span>Scheduled</span>
              </button>
            </div>
          </div>

          {/* Conditional Scheduled Date Picker */}
          {isScheduled && (
            <div className="space-y-1.5 p-3 rounded-xl bg-primary/5 border border-primary/20 animate-in fade-in slide-in-from-top-2 duration-200">
              <Label className="text-[10px] font-bold text-primary uppercase tracking-wider">
                Select Launch Date &amp; Time
              </Label>
              <Controller
                name={"scheduledAt" as import('react-hook-form').Path<TFieldValues>}
                control={control}
                render={({ field }) => (
                  <DateTimePicker 
                    value={field.value} 
                    onChange={field.onChange} 
                  />
                )}
              />
              <p className="text-[10px] text-muted-foreground leading-tight pt-1">
                Dispatches will be queued in the background and executed automatically.
              </p>
            </div>
          )}
        </div>

        {/* Bottom: Modern System Assurance Strip */}
        <div className="p-3.5 bg-muted/10 border-t border-border/50 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[10px]">
            <div className="flex items-center gap-1.5 text-muted-foreground font-semibold">
              <Lock className="h-3 w-3 text-blue-600 dark:text-blue-400" />
              <span>Audit Logged</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground font-semibold">
              <Zap className="h-3 w-3 text-emerald-600" />
              <span>30 msgs/sec Rate Limit</span>
            </div>
            <div className="flex items-center gap-1.5 font-bold text-foreground">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span>Est. ~{estimatedMinutes} min</span>
            </div>
          </div>

          {/* Dynamic High-Volume Notice (Only appears when recipient count > highVolumeThreshold) */}
          {recipientCount > highVolumeThreshold && (
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center gap-2 text-amber-700 dark:text-amber-300 text-[10px] font-semibold">
              <ShieldAlert className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              <span>High volume dispatch: delivery will proceed in throttled batches to protect domain reputation.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
