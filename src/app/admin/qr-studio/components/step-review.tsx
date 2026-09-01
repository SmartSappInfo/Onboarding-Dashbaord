'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, Calendar, Clock, Hash, CornerDownRight } from 'lucide-react';
import QRPreview from './qr-preview';
import type { WizardState } from './create-qr-wizard';

interface StepReviewProps {
  state: WizardState;
  updateState: (patch: Partial<WizardState>) => void;
  validationErrors?: string[];
}

const TYPE_LABELS: Record<string, string> = {
  url: 'External URL',
  survey: 'Survey',
  form: 'Form',
  landing_page: 'Landing Page',
  portal: 'Portal',
  public_portal: 'Public Portal',
  doc_signing: 'Doc Signing',
  document: 'Document',
  meeting: 'Meeting',
  payment: 'Payment',
  invoice: 'Invoice',
  vcard: 'vCard',
  wifi: 'Wi-Fi',
  email: 'Email',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  text: 'Text',
  file: 'File',
  attendance: 'Attendance',
  event: 'Event',
  campaign: 'Campaign',
  custom: 'Custom',
};

export default function StepReview({ state, updateState, validationErrors = [] }: StepReviewProps) {
  const hasFieldError = (field: string) => validationErrors.includes(field);

  // Auto-generate name from destination if not set
  React.useEffect(() => {
    if (!state.name && state.destination.url) {
      const autoName = state.destination.resourceName || `${TYPE_LABELS[state.type] || state.type} QR`;
      updateState({ name: autoName });
    }
  }, [state.destination, state.type, state.name, updateState]);

  const qrData = state.destination.url || 'https://smartsapp.com';
  const hasLifecycle =
    state.lifecycleConfig?.startAt ||
    state.lifecycleConfig?.expiresAt ||
    state.lifecycleConfig?.maxScans ||
    state.lifecycleConfig?.fallbackUrl;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">Review & Name</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Give your QR code a name and review all routing & lifecycle settings before publishing.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Form */}
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="qr-name" className="text-sm font-semibold">
              QR Code Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="qr-name"
              placeholder="e.g. Admissions Open Day Flyer"
              value={state.name}
              onChange={(e) => updateState({ name: e.target.value })}
              className={`rounded-xl h-11 bg-muted/30 border transition-colors ${
                hasFieldError('name') ? 'border-destructive ring-1 ring-destructive/20' : 'border-transparent'
              }`}
              autoFocus={hasFieldError('name')}
            />
            {hasFieldError('name') && (
              <p className="text-[11px] text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> A name is required to create a QR code
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="qr-desc" className="text-sm font-semibold">
              Description <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="qr-desc"
              placeholder="Where will this QR code be physically placed or distributed?"
              value={state.description}
              onChange={(e) => updateState({ description: e.target.value })}
              className="rounded-xl bg-muted/30 border-none min-h-[80px]"
            />
          </div>

          {/* Summary */}
          <div className="p-4 rounded-xl bg-muted/20 space-y-3 border border-border">
            <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Configuration Summary</p>
            <div className="space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Type</span>
                <Badge variant="outline" className="text-[9px] uppercase font-bold tracking-wider rounded-lg">
                  {TYPE_LABELS[state.type] || state.type}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Mode</span>
                <Badge
                  variant="outline"
                  className={`text-[9px] uppercase font-bold tracking-wider rounded-lg ${
                    state.mode === 'dynamic'
                      ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20'
                      : 'bg-muted text-muted-foreground border-border'
                  }`}
                >
                  {state.mode}
                </Badge>
              </div>
              {state.mode === 'dynamic' && state.customShortPath && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Custom Link</span>
                  <span className="text-xs font-mono text-foreground font-semibold">/q/{state.customShortPath}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Telemetry Tracking</span>
                <Badge
                  variant="outline"
                  className={`text-[9px] uppercase font-bold tracking-wider rounded-lg ${
                    state.tracking.enabled
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                      : 'bg-muted text-muted-foreground border-border'
                  }`}
                >
                  {state.tracking.enabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>

              {hasLifecycle && (
                <div className="pt-2 border-t border-border space-y-1.5">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Lifecycle & Timing</span>
                  {state.lifecycleConfig.startAt && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Starts</span>
                      <span className="font-mono text-foreground">{new Date(state.lifecycleConfig.startAt).toLocaleString()}</span>
                    </div>
                  )}
                  {state.lifecycleConfig.expiresAt && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Expires</span>
                      <span className="font-mono text-foreground">{new Date(state.lifecycleConfig.expiresAt).toLocaleString()}</span>
                    </div>
                  )}
                  {state.lifecycleConfig.maxScans && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1"><Hash className="h-3 w-3" /> Max Scans</span>
                      <span className="font-mono text-foreground">{state.lifecycleConfig.maxScans.toLocaleString()}</span>
                    </div>
                  )}
                  {state.lifecycleConfig.fallbackUrl && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1"><CornerDownRight className="h-3 w-3" /> Fallback</span>
                      <span className="font-mono text-foreground truncate max-w-[180px]">{state.lifecycleConfig.fallbackUrl}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-2 border-t border-border">
                <span className="text-xs text-muted-foreground">Target Destination</span>
                <p className="text-xs font-mono text-foreground mt-1 break-all">
                  {state.destination.url || '—'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Preview */}
        <div className="flex flex-col items-center gap-4">
          <div className="p-6 rounded-2xl bg-white shadow-lg border border-border">
            <QRPreview data={qrData} design={state.design} size={200} />
          </div>
          <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
            Live Preview
          </p>
          <p className="text-xs text-muted-foreground text-center max-w-[240px]">
            You can further customize colors, patterns, and canvas flyer templates after creating this QR code.
          </p>
        </div>
      </div>
    </div>
  );
}
