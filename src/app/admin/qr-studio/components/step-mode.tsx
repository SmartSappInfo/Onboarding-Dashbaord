'use client';

import * as React from 'react';
import { Zap, Lock, BarChart3, Edit3, Globe, Shield } from 'lucide-react';
import type { WizardState } from './create-qr-wizard';

interface StepModeProps {
  state: WizardState;
  updateState: (patch: Partial<WizardState>) => void;
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

export default function StepMode({ state, updateState }: StepModeProps) {
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
    </div>
  );
}
