'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Trash2, Clock, Mail, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MessagingTemplateSelector } from '@/app/admin/components/MessagingTemplateSelector';
import type { MeetingReminderSlot } from '@/lib/types';

// ─── Offset Presets ──────────────────────────────────────────────
const OFFSET_PRESETS = [
  { label: '15 min before', value: 15 },
  { label: '30 min before', value: 30 },
  { label: '1 hour before', value: 60 },
  { label: '2 hours before', value: 120 },
  { label: '1 day before', value: 1440 },
  { label: '2 days before', value: 2880 },
  { label: 'At meeting time', value: 0 },
] as const;

// ─── Props ───────────────────────────────────────────────────────
interface ReminderSlotRowProps {
  slot: MeetingReminderSlot;
  index: number;
  onChange: (index: number, updated: MeetingReminderSlot) => void;
  onRemove: (index: number) => void;
}

// ─── Component ───────────────────────────────────────────────────
export default function ReminderSlotRow({ slot, index, onChange, onRemove }: ReminderSlotRowProps) {
  const updateField = React.useCallback(<K extends keyof MeetingReminderSlot>(
    key: K,
    value: MeetingReminderSlot[K]
  ) => {
    onChange(index, { ...slot, [key]: value });
  }, [slot, index, onChange]);

  const toggleChannel = React.useCallback((channel: 'email' | 'sms') => {
    const current = new Set(slot.channels);
    if (current.has(channel)) {
      current.delete(channel);
    } else {
      current.add(channel);
    }
    onChange(index, { ...slot, channels: Array.from(current) as ('email' | 'sms')[] });
  }, [slot, index, onChange]);

  return (
    <div className={cn(
      "p-4 rounded-xl border transition-all",
      slot.enabled ? "bg-background ring-1 ring-border" : "bg-muted/20 opacity-50"
    )}>
      <div className="flex items-center gap-3 mb-3">
        <Switch
          checked={slot.enabled}
          onCheckedChange={(v) => updateField('enabled', v)}
          className="scale-90"
        />

        <div className="flex items-center gap-1.5 flex-1">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <Select
            value={String(slot.offsetMinutes)}
            onValueChange={(v) => {
              const preset = OFFSET_PRESETS.find(p => String(p.value) === v);
              onChange(index, {
                ...slot,
                offsetMinutes: Number(v),
                offsetLabel: preset?.label || `${v} min before`,
              });
            }}
          >
            <SelectTrigger className="h-8 w-40 rounded-lg bg-card border text-[10px] font-bold">
              <SelectValue placeholder="Select timing..." />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {OFFSET_PRESETS.map((p) => (
                <SelectItem key={p.value} value={String(p.value)}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Channel toggles */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => toggleChannel('email')}
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              slot.channels.includes('email') ? "bg-blue-500/10 text-blue-600" : "text-muted-foreground/30 hover:text-muted-foreground"
            )}
            title="Email"
          >
            <Mail className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => toggleChannel('sms')}
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              slot.channels.includes('sms') ? "bg-green-500/10 text-green-600" : "text-muted-foreground/30 hover:text-muted-foreground"
            )}
            title="SMS"
          >
            <Smartphone className="h-3.5 w-3.5" />
          </button>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onRemove(index)}
          className="h-7 w-7 p-0 shrink-0 text-destructive/40 hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      {/* Template pickers (only when enabled) */}
      {slot.enabled && slot.channels.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-10">
          {slot.channels.includes('email') && (
            <div className="space-y-1">
              <span className="text-[9px] font-bold text-muted-foreground/60 flex items-center gap-1">
                <Mail className="h-2.5 w-2.5" /> Email Template
              </span>
              <MessagingTemplateSelector
                category="meetings"
                recipientType="external_alert"
                channel="email"
                templateTypePrefix={slot.offsetMinutes === 0 ? 'meeting_time_up' : 'meeting_reminder'}
                value={slot.emailTemplateId || ''}
                onValueChange={(v) => updateField('emailTemplateId', v)}
                placeholder="Select email template..."
                className="h-8 rounded-lg text-[10px] font-bold"
              />
            </div>
          )}
          {slot.channels.includes('sms') && (
            <div className="space-y-1">
              <span className="text-[9px] font-bold text-muted-foreground/60 flex items-center gap-1">
                <Smartphone className="h-2.5 w-2.5" /> SMS Template
              </span>
              <MessagingTemplateSelector
                category="meetings"
                recipientType="external_alert"
                channel="sms"
                templateTypePrefix={slot.offsetMinutes === 0 ? 'meeting_time_up' : 'meeting_reminder'}
                value={slot.smsTemplateId || ''}
                onValueChange={(v) => updateField('smsTemplateId', v)}
                placeholder="Select SMS template..."
                className="h-8 rounded-lg text-[10px] font-bold"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
