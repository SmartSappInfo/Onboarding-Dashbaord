'use client';

import * as React from 'react';
import { RefreshCw } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type {
  MessageResendConfig,
  MessageResendVariant,
  ResendTriggerCondition,
} from '@/lib/types';
import { HeadlineIQOptimizer } from '@/components/shared/HeadlineIQOptimizer';

const MAX_RESENDS = 5;

interface ResendConfigSectionProps {
  value: MessageResendConfig | undefined;
  channel: string | undefined;
  onChange: (next: MessageResendConfig) => void;
  templateSubject?: string;
  templatePreviewText?: string;
  workspaceFramework?: 'aida' | '4us' | 'pas';
  organizationId?: string;
}

function defaultResendConfig(): MessageResendConfig {
  return {
    enabled: true,
    maxResends: 1,
    resendDelayHours: 24,
    triggerCondition: 'no_open',
    variants: [{ title: '', previewText: '' }],
  };
}

function resizeVariants(variants: MessageResendVariant[], count: number): MessageResendVariant[] {
  const next = variants.slice(0, count);
  while (next.length < count) next.push({ title: '', previewText: '' });
  return next;
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/**
 * Resend-on-no-engagement configuration for a message step. Email-only: resend
 * relies on open/click signals, which SMS does not provide today.
 */
export function ResendConfigSection({
  value,
  channel,
  onChange,
  templateSubject = '',
  templatePreviewText = '',
  workspaceFramework = 'aida',
  organizationId,
}: ResendConfigSectionProps): React.ReactElement {
  const isEmail = (channel || 'email') === 'email';
  const cfg = value ?? defaultResendConfig();
  const enabled = !!value?.enabled;

  // Auto-populate when template changes if inputs are empty
  React.useEffect(() => {
    if (!isEmail) return;
    if (enabled && templateSubject && cfg.variants.length > 0) {
      const allEmpty = cfg.variants.every(v => !v.title.trim() && !(v.previewText || '').trim());
      if (allEmpty) {
        onChange({
          ...cfg,
          variants: cfg.variants.map(() => ({
            title: templateSubject,
            previewText: templatePreviewText
          }))
        });
      }
    }
  }, [templateSubject, templatePreviewText, enabled, isEmail, cfg, onChange]);

  if (!isEmail) {
    return (
      <div className="rounded-2xl border border-border/60 bg-muted/20 p-3 text-[10px] text-muted-foreground">
        Resend on no-engagement is available for email steps only — SMS has no open/click signal to detect engagement.
      </div>
    );
  }

  const update = (patch: Partial<MessageResendConfig>) => {
    const merged: MessageResendConfig = { ...cfg, ...patch };
    if (patch.maxResends !== undefined) {
      merged.variants = resizeVariants(merged.variants, patch.maxResends);
    }
    onChange(merged);
  };

  const updateVariant = (index: number, patch: Partial<MessageResendVariant>) => {
    onChange({
      ...cfg,
      variants: cfg.variants.map((v, i) => (i === index ? { ...v, ...patch } : v)),
    });
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <RefreshCw className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-foreground">Resend if not engaged</p>
            <p className="text-[9px] text-muted-foreground leading-relaxed">
              Hold the contact at this step and resend until they engage or attempts run out.
            </p>
          </div>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(on) => onChange(on ? {
            enabled: true,
            maxResends: 1,
            resendDelayHours: 24,
            triggerCondition: 'no_open',
            variants: [{
              title: templateSubject || '',
              previewText: templatePreviewText || ''
            }],
          } : { ...cfg, enabled: false })}
        />
      </div>

      {enabled && (
        <div className="space-y-3 pt-1 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[9px] font-bold text-muted-foreground">Resend when</Label>
              <Select
                value={cfg.triggerCondition}
                onValueChange={(v) => update({ triggerCondition: v as ResendTriggerCondition })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no_open">Not opened</SelectItem>
                  <SelectItem value="no_click">Not clicked</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[9px] font-bold text-muted-foreground">Max resends</Label>
              <Input
                type="number"
                min={1}
                max={MAX_RESENDS}
                value={cfg.maxResends}
                onChange={(e) => update({ maxResends: clamp(parseInt(e.target.value, 10), 1, MAX_RESENDS) })}
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div>
            <Label className="text-[9px] font-bold text-muted-foreground">Wait between attempts (hours)</Label>
            <Input
              type="number"
              min={1}
              value={cfg.resendDelayHours}
              onChange={(e) => update({ resendDelayHours: Math.max(1, parseInt(e.target.value, 10) || 1) })}
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[9px] font-bold text-muted-foreground">
              Resend subject &amp; preview <span className="font-normal">(message body stays the same)</span>
            </Label>
            {cfg.variants.map((variant, i) => (
              <div key={i} className="rounded-xl border border-border/50 p-2 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[9px] font-semibold text-muted-foreground">Resend #{i + 1}</p>
                  <HeadlineIQOptimizer
                    value={variant.title}
                    previewValue={variant.previewText || ''}
                    onChange={(newVal) => updateVariant(i, { title: newVal })}
                    onPreviewChange={(newPreview) => updateVariant(i, { previewText: newPreview })}
                    frameworkDefault={workspaceFramework}
                    organizationId={organizationId}
                    align="end"
                  />
                </div>
                <Input
                  placeholder="Subject"
                  value={variant.title}
                  onChange={(e) => updateVariant(i, { title: e.target.value })}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder="Preview text (optional)"
                  value={variant.previewText || ''}
                  onChange={(e) => updateVariant(i, { previewText: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
