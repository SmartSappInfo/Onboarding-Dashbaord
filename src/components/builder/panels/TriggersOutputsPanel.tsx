'use client';

/**
 * @fileOverview Panel 6: Triggers & Outputs Configuration (Phase 8 Milestone 5 Task 5)
 *
 * Implements:
 * - Rule 4: Zero `any` / Zero `any[]` strict typing.
 * - Rule 34: Outbound SSRF guard notes and URL constraints.
 * - Multi-channel notification delivery.
 */

import * as React from 'react';
import { Input } from '@/components/ui/input';
import {
  type TriggersOutputsConfig,
  type TriggerType,
} from '@/platform/ui/builder/agent-builder-types';
import { Play, Radio, Clock, Globe, Bell, Mail, MessageSquare, ShieldAlert } from 'lucide-react';

export interface TriggersOutputsPanelProps {
  value: TriggersOutputsConfig;
  onChange: (value: TriggersOutputsConfig) => void;
  isBuiltIn?: boolean;
}

const TRIGGER_TYPES: Array<{
  id: TriggerType;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'manual', label: 'Manual Launch', desc: 'Triggered explicitly by operators via ⌘K or UI', icon: Play },
  { id: 'event', label: 'Event Subscription', desc: 'Runs reactively when platform domain events fire', icon: Radio },
  { id: 'cron', label: 'Cron Schedule', desc: 'Runs periodically on a defined cron schedule', icon: Clock },
  { id: 'webhook', label: 'Incoming Webhook', desc: 'Triggered via authenticated HTTP webhooks', icon: Globe },
];

export function TriggersOutputsPanel({
  value,
  onChange,
  isBuiltIn = false,
}: TriggersOutputsPanelProps) {
  const handleTriggerTypeChange = (type: TriggerType) => {
    if (isBuiltIn) return;
    onChange({
      ...value,
      triggerType: type,
    });
  };

  const toggleChannel = (channel: 'in_app' | 'email' | 'slack') => {
    if (isBuiltIn) return;
    const exists = value.enabledNotificationChannels.includes(channel);
    let updated: Array<'in_app' | 'email' | 'slack'>;
    if (exists) {
      if (value.enabledNotificationChannels.length <= 1) return;
      updated = value.enabledNotificationChannels.filter((c) => c !== channel);
    } else {
      updated = [...value.enabledNotificationChannels, channel];
    }
    onChange({
      ...value,
      enabledNotificationChannels: updated,
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. Trigger Type Selection */}
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
          Invocation Trigger Mechanism
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {TRIGGER_TYPES.map((t) => {
            const isSelected = value.triggerType === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                disabled={isBuiltIn}
                onClick={() => handleTriggerTypeChange(t.id)}
                className={`flex flex-col items-start gap-1 rounded-xl border p-3 min-h-[44px] text-left transition-all active:scale-[0.97] ${
                  isSelected
                    ? 'border-primary bg-primary/10 text-primary font-medium shadow-sm'
                    : 'border-border/70 bg-card hover:bg-muted/30 text-muted-foreground'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <span className="text-xs font-semibold text-foreground">{t.label}</span>
                </div>
                <span className="text-[11px] text-muted-foreground mt-0.5 leading-normal">
                  {t.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Trigger Parameter Inputs */}
      {value.triggerType === 'cron' && (
        <div className="border-t border-border/60 pt-5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">
            Cron Schedule Expression
          </label>
          <Input
            value={value.cronSchedule || ''}
            onChange={(e) =>
              onChange({
                ...value,
                cronSchedule: e.target.value,
              })
            }
            disabled={isBuiltIn}
            placeholder="0 9 * * 1-5 (Every weekday at 09:00 UTC)"
            className="rounded-xl min-h-[44px] text-xs font-mono"
          />
          <span className="text-[11px] text-muted-foreground mt-1 block">
            Standard 5-part cron syntax: minute hour day-of-month month day-of-week.
          </span>
        </div>
      )}

      {value.triggerType === 'webhook' && (
        <div className="border-t border-border/60 pt-5">
          <div className="flex items-center gap-2 mb-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              External Webhook Callback URL (Rule 34 SSRF Protected)
            </label>
            <ShieldAlert className="h-4 w-4 text-amber-500" />
          </div>
          <Input
            type="url"
            value={value.webhookUrl || ''}
            onChange={(e) =>
              onChange({
                ...value,
                webhookUrl: e.target.value,
              })
            }
            disabled={isBuiltIn}
            placeholder="https://api.yourdomain.com/webhooks/agent"
            className="rounded-xl min-h-[44px] text-xs font-mono"
          />
          <span className="text-[11px] text-muted-foreground mt-1 block">
            Validated against GCP metadata server (169.254.169.254), loopback, and RFC-1918 private subnets.
          </span>
        </div>
      )}

      {/* 3. Output Notification Channels */}
      <div className="border-t border-border/60 pt-5">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
          Enabled Output Notification Channels
        </label>

        <div className="flex flex-wrap gap-3">
          {[
            { id: 'in_app' as const, label: 'In-App Toast & Activity Stream', icon: Bell },
            { id: 'email' as const, label: 'Operator Email Digest', icon: Mail },
            { id: 'slack' as const, label: 'Slack Webhook Broadcast', icon: MessageSquare },
          ].map((channel) => {
            const isChecked = value.enabledNotificationChannels.includes(channel.id);
            const Icon = channel.icon;
            return (
              <button
                key={channel.id}
                type="button"
                disabled={isBuiltIn}
                onClick={() => toggleChannel(channel.id)}
                className={`flex items-center gap-2 rounded-xl border p-3 min-h-[44px] text-xs transition-all active:scale-[0.97] ${
                  isChecked
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-border/70 bg-card hover:bg-muted/30 text-muted-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{channel.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
