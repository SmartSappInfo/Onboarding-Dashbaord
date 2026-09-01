'use client';

import * as React from 'react';
import { Zap, Lock, BarChart3, Edit3, Globe, Shield, Link, Calendar, Clock, Hash, CornerDownRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { WizardState } from './create-qr-wizard';

interface StepModeProps {
  state: WizardState;
  updateState: (patch: Partial<WizardState>) => void;
  validationErrors?: string[];
}

export default function StepMode({ state, updateState, validationErrors = [] }: StepModeProps) {
  const hasShortPathError = validationErrors.includes('customShortPath');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <Label className="text-sm font-bold text-foreground">Routing Type</Label>
          <p className="text-xs text-muted-foreground">
            Dynamic routes through SmartSapp to track scans, schedule campaigns, and edit links later.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-1 bg-muted/40 p-1 rounded-xl w-full sm:w-64 border border-border shrink-0">
          <button
            type="button"
            onClick={() => updateState({ mode: 'dynamic', tracking: { ...state.tracking, enabled: true } })}
            className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all text-center cursor-pointer active:scale-[0.97] ${
              state.mode === 'dynamic'
                ? 'bg-card text-foreground shadow-sm border border-border'
                : 'text-muted-foreground hover:text-foreground border border-transparent'
            }`}
          >
            Dynamic
          </button>
          <button
            type="button"
            onClick={() => updateState({ mode: 'static', tracking: { ...state.tracking, enabled: false } })}
            className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all text-center cursor-pointer active:scale-[0.97] ${
              state.mode === 'static'
                ? 'bg-card text-foreground shadow-sm border border-border'
                : 'text-muted-foreground hover:text-foreground border border-transparent'
            }`}
          >
            Static
          </button>
        </div>
      </div>

      {state.mode === 'dynamic' && (
        <div className="p-5 rounded-2xl border border-border bg-muted/10 space-y-6 animate-in slide-in-from-top-2 duration-200">
          {/* Custom Shortlink */}
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="custom-shortlink" className="text-sm font-semibold flex items-center gap-2">
                <Link className="h-4 w-4 text-primary" />
                Custom Shortlink
                <span className="text-xs font-normal text-muted-foreground ml-1">(optional)</span>
              </Label>
              <p className="text-xs text-muted-foreground">
                Customize the short URL users see when scanning. Leave blank to auto-generate.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-10 px-3 rounded-xl bg-muted border border-border flex items-center text-sm text-muted-foreground select-none shrink-0 font-mono text-xs">
                {typeof window !== 'undefined' ? window.location.host : 'go.smartsapp.com'}/q/
              </div>
              <Input
                id="custom-shortlink"
                placeholder="my-campaign-2026"
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
          </div>

          {/* Campaign Lifecycle & Scheduling */}
          <div className="space-y-3 pt-4 border-t border-border/50">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Campaign Lifecycle & Expiration
              <span className="text-xs font-normal text-muted-foreground ml-1">(optional)</span>
            </Label>
            <p className="text-xs text-muted-foreground">
              Schedule when this link becomes active or auto-expires after a date or scan threshold.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="start-at" className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Scheduled Start
                </Label>
                <Input
                  id="start-at"
                  type="datetime-local"
                  value={state.lifecycleConfig?.startAt ? state.lifecycleConfig.startAt.slice(0, 16) : ''}
                  onChange={(e) =>
                    updateState({
                      lifecycleConfig: {
                        ...state.lifecycleConfig,
                        startAt: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                      },
                    })
                  }
                  className="rounded-xl h-9 text-xs bg-background"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="expires-at" className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Expiration Date
                </Label>
                <Input
                  id="expires-at"
                  type="datetime-local"
                  value={state.lifecycleConfig?.expiresAt ? state.lifecycleConfig.expiresAt.slice(0, 16) : ''}
                  onChange={(e) =>
                    updateState({
                      lifecycleConfig: {
                        ...state.lifecycleConfig,
                        expiresAt: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                      },
                    })
                  }
                  className="rounded-xl h-9 text-xs bg-background"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="max-scans" className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <Hash className="h-3 w-3" /> Max Scans Cap
                </Label>
                <Input
                  id="max-scans"
                  type="number"
                  min={1}
                  placeholder="e.g. 500"
                  value={state.lifecycleConfig?.maxScans || ''}
                  onChange={(e) =>
                    updateState({
                      lifecycleConfig: {
                        ...state.lifecycleConfig,
                        maxScans: e.target.value ? parseInt(e.target.value, 10) : undefined,
                      },
                    })
                  }
                  className="rounded-xl h-9 text-xs bg-background"
                />
              </div>
            </div>

            <div className="space-y-1 pt-2">
              <Label htmlFor="fallback-url" className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <CornerDownRight className="h-3 w-3" /> Fallback Redirect URL
              </Label>
              <Input
                id="fallback-url"
                type="url"
                placeholder="https://example.com/expired-page (optional)"
                value={state.lifecycleConfig?.fallbackUrl || ''}
                onChange={(e) =>
                  updateState({
                    lifecycleConfig: {
                      ...state.lifecycleConfig,
                      fallbackUrl: e.target.value || undefined,
                    },
                  })
                }
                className="rounded-xl h-9 text-xs bg-background"
              />
              <p className="text-[10px] text-muted-foreground">
                Redirect users here if the link is scanned before start time, after expiration, or while paused.
              </p>
            </div>
          </div>

          {/* UTM Tracking */}
          <div className="space-y-3 pt-4 border-t border-border/50">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              UTM Campaign Parameters
              <span className="text-xs font-normal text-muted-foreground ml-1">(optional)</span>
            </Label>
            <p className="text-xs text-muted-foreground">
              Add tracking tags to your destination URL to measure attribution in your analytics.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="utm-source" className="text-xs font-semibold text-muted-foreground">
                  Source
                </Label>
                <Input
                  id="utm-source"
                  placeholder="e.g. print_flyer"
                  value={state.tracking.utmSource || ''}
                  onChange={(e) => updateState({ tracking: { ...state.tracking, utmSource: e.target.value } })}
                  className="rounded-xl h-9 text-xs bg-background"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="utm-medium" className="text-xs font-semibold text-muted-foreground">
                  Medium
                </Label>
                <Input
                  id="utm-medium"
                  placeholder="e.g. poster, table_tent"
                  value={state.tracking.utmMedium || ''}
                  onChange={(e) => updateState({ tracking: { ...state.tracking, utmMedium: e.target.value } })}
                  className="rounded-xl h-9 text-xs bg-background"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="utm-campaign" className="text-xs font-semibold text-muted-foreground">
                  Campaign
                </Label>
                <Input
                  id="utm-campaign"
                  placeholder="e.g. open_day_2026"
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
