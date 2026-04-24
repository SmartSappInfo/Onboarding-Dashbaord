'use client';

import * as React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { REMINDER_OFFSETS, type ReminderConfig as ReminderConfigType } from '@/lib/types';

interface ReminderConfigProps {
  value?: ReminderConfigType;
  onChange: (config: ReminderConfigType) => void;
}

const TRIGGER_TYPES = [
  { value: 'before_event', label: 'Before Event' },
  { value: 'after_event',  label: 'After Event' },
  { value: 'on_deadline',  label: 'On Deadline' },
] as const;

const EVENT_TYPES = [
  { value: 'meeting',          label: 'Meeting' },
  { value: 'form_deadline',    label: 'Form Deadline' },
  { value: 'survey_deadline',  label: 'Survey Deadline' },
  { value: 'payment_due',      label: 'Payment Due' },
] as const;

const OFFSET_OPTIONS = Object.entries(REMINDER_OFFSETS).map(([key, val]) => ({
  key,
  offsetMinutes: val.offsetMinutes,
  offsetLabel: val.offsetLabel,
}));

export default function ReminderConfig({ value, onChange }: ReminderConfigProps) {
  const current: ReminderConfigType = value ?? {
    triggerType: 'before_event',
    offsetMinutes: 60,
    offsetLabel: '1 hour before',
    eventType: 'meeting',
  };

  function update(patch: Partial<ReminderConfigType>) {
    onChange({ ...current, ...patch });
  }

  function handleOffsetChange(offsetMinutes: string) {
    const opt = OFFSET_OPTIONS.find((o) => String(o.offsetMinutes) === offsetMinutes);
    if (opt) update({ offsetMinutes: opt.offsetMinutes, offsetLabel: opt.offsetLabel });
  }

  const summary = `Send ${current.offsetLabel} ${current.eventType.replace(/_/g, ' ')} (${current.triggerType.replace(/_/g, ' ')})`;

  return (
    <div className="space-y-4 rounded-xl border border-border bg-muted/30 p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Reminder Configuration</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Trigger type */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Trigger</Label>
          <Select value={current.triggerType} onValueChange={(v) => update({ triggerType: v as ReminderConfigType['triggerType'] })}>
            <SelectTrigger className="h-9 bg-muted/50 border-border text-foreground rounded-lg text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-muted border-border">
              {TRIGGER_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Offset */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Offset</Label>
          <Select value={String(current.offsetMinutes)} onValueChange={handleOffsetChange}>
            <SelectTrigger className="h-9 bg-muted/50 border-border text-foreground rounded-lg text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-muted border-border">
              {OFFSET_OPTIONS.map((o) => (
                <SelectItem key={o.key} value={String(o.offsetMinutes)}>{o.offsetLabel}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Event type */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Event Type</Label>
          <Select value={current.eventType} onValueChange={(v) => update({ eventType: v as ReminderConfigType['eventType'] })}>
            <SelectTrigger className="h-9 bg-muted/50 border-border text-foreground rounded-lg text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-muted border-border">
              {EVENT_TYPES.map((e) => (
                <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary */}
      <p className="text-xs text-muted-foreground italic">{summary}</p>
    </div>
  );
}
