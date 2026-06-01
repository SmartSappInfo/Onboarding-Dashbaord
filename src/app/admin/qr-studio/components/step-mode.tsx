'use client';

import * as React from 'react';
import { Zap, Lock, BarChart3, Edit3, Globe, Shield, Link } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { WizardState } from './create-qr-wizard';

interface StepModeProps {
  state: WizardState;
  updateState: (patch: Partial<WizardState>) => void;
  validationErrors?: string[];
}

const MODE_OPTIONS = [
  {
    value: 'dynamic' as const,
    label: 'Dynamic QR Code',
    tagline: 'Recommended',
    description: 'Scans route through SmartSapp so you can track analytics, change the destination later, and pause/resume the code without reprinting.',
    features: [
      { icon: BarChart3, text: 'Track scans, devices, and locations' },
      { icon: Edit3, text: 'Change destination after printing' },
      { icon: Zap, text: 'Pause, resume, or redirect anytime' },
    ],
  },
  {
    value: 'static' as const,
    label: 'Static QR Code',
    tagline: 'Simple',
    description: 'The destination URL is encoded directly into the QR image. No tracking, no redirect — the QR works even if SmartSapp is offline.',
    features: [
      { icon: Globe, text: 'Works independently — no server needed' },
      { icon: Lock, text: 'Permanent, unchangeable destination' },
      { icon: Shield, text: 'Best for Wi-Fi, vCard, plain text' },
    ],
  },
];

export default function StepMode({ state, updateState, validationErrors = [] }: StepModeProps) {
  const hasShortPathError = validationErrors.includes('customShortPath');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">Static or Dynamic?</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Choose whether your QR code should be trackable and editable, or permanently fixed.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {MODE_OPTIONS.map((option) => {
          const isSelected = state.mode === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => updateState({ mode: option.value, tracking: { ...state.tracking, enabled: option.value === 'dynamic' } })}
              className={`text-left p-6 rounded-xl border transition-all duration-200 cursor-pointer ${
                isSelected
                  ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10 ring-1 ring-primary/20'
                  : 'border-border bg-card hover:border-primary/30 hover:bg-muted/20'
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <h3 className={`text-base font-bold ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                  {option.label}
                </h3>
                {option.tagline && (
                  <span className={`text-[9px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full ${
                    option.value === 'dynamic'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {option.tagline}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-4">{option.description}</p>
              <div className="space-y-2">
                {option.features.map((f, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <f.icon className={`h-4 w-4 shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className="text-sm text-foreground">{f.text}</span>
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {state.mode === 'dynamic' && (
        <div className="p-5 rounded-xl border border-border bg-muted/10 space-y-3 animate-in slide-in-from-top-2 duration-200">
          <div className="space-y-1">
            <Label htmlFor="custom-shortlink" className="text-sm font-semibold flex items-center gap-2">
              <Link className="h-4 w-4 text-primary" />
              Custom Shortlink
              <span className="text-xs font-normal text-muted-foreground ml-1">(optional)</span>
            </Label>
            <p className="text-xs text-muted-foreground">
              Customize the URL users will see. Leave blank to generate a random one.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-10 px-3 rounded-xl bg-muted border border-border flex items-center text-sm text-muted-foreground select-none shrink-0">
              {typeof window !== 'undefined' ? window.location.host : 'go.smartsapp.com'}/q/
            </div>
            <Input
              id="custom-shortlink"
              placeholder="my-campaign-2024"
              value={state.customShortPath || ''}
              onChange={(e) => {
                const val = e.target.value.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
                updateState({ customShortPath: val });
              }}
              className={`flex-1 h-10 rounded-xl bg-background ${
                hasShortPathError ? 'border-destructive ring-1 ring-destructive/20' : ''
              }`}
              maxLength={30}
            />
          </div>
          {hasShortPathError && (
            <p className="text-[11px] text-destructive">Invalid shortlink or already in use.</p>
          )}

          <div className="space-y-3 pt-4 mt-2 border-t border-border/50">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              UTM Parameters
              <span className="text-xs font-normal text-muted-foreground ml-1">(optional)</span>
            </Label>
            <p className="text-xs text-muted-foreground">
              Add tracking tags to your destination URL to measure campaign performance.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="utm-source" className="text-xs font-semibold text-muted-foreground">Source</Label>
                <Input
                  id="utm-source"
                  placeholder="e.g. facebook"
                  value={state.tracking.utmSource || ''}
                  onChange={(e) => updateState({ tracking: { ...state.tracking, utmSource: e.target.value } })}
                  className="rounded-xl h-9 text-xs bg-background"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="utm-medium" className="text-xs font-semibold text-muted-foreground">Medium</Label>
                <Input
                  id="utm-medium"
                  placeholder="e.g. social, print"
                  value={state.tracking.utmMedium || ''}
                  onChange={(e) => updateState({ tracking: { ...state.tracking, utmMedium: e.target.value } })}
                  className="rounded-xl h-9 text-xs bg-background"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="utm-campaign" className="text-xs font-semibold text-muted-foreground">Campaign</Label>
                <Input
                  id="utm-campaign"
                  placeholder="e.g. summer_sale"
                  value={state.tracking.utmCampaign || ''}
                  onChange={(e) => updateState({ tracking: { ...state.tracking, utmCampaign: e.target.value } })}
                  className="rounded-xl h-9 text-xs bg-background"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
