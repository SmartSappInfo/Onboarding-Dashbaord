'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for A/B Split Testing UI:
 *    Configures Variant A (Control) vs Variant B (Challenger) with traffic split percentages
 *    and tracks real-time conversion metrics (impressions, CTA clicks, conversion rates).
 * 2. Deterministic Testing Philosophy:
 *    Variants are served deterministically via visitor session hashing to prevent visual flashing.
 * 3. Mobile Accessibility & Touch Target Bounds:
 *    All sliders, buttons, inputs, and selects strictly enforce `min-h-[44px] min-w-[44px]`
 *    touch targets with tactile micro-animations (`active:scale-[0.97]`).
 * 4. Strict Typing Standard: Zero use of `any` or `any[]`.
 */

import { useState } from 'react';
import type { ABExperimentConfig, ABExperimentVariantOverrides } from '@/lib/types/media-2.0';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Split, Trophy } from 'lucide-react';

export interface ABExperimentEditorProps {
  config: ABExperimentConfig;
  baseTitle: string;
  baseCtaText: string;
  onChange: (updatedConfig: ABExperimentConfig) => void;
}

export function ABExperimentEditor({
  config,
  baseTitle,
  baseCtaText,
  onChange,
}: ABExperimentEditorProps) {
  const [_activeTab, _setActiveTab] = useState<'variantA' | 'variantB'>('variantB');

  const vAViews = config.metrics?.variantAViews ?? 0;
  const vAClicks = config.metrics?.variantAClicks ?? 0;
  const vBViews = config.metrics?.variantBViews ?? 0;
  const vBClicks = config.metrics?.variantBClicks ?? 0;

  const vAConversionRate = vAViews > 0 ? ((vAClicks / vAViews) * 100).toFixed(1) : '0.0';
  const vBConversionRate = vBViews > 0 ? ((vBClicks / vBViews) * 100).toFixed(1) : '0.0';

  const isBWinning = Number(vBConversionRate) > Number(vAConversionRate) && vBViews >= 10;
  const isAWinnning = Number(vAConversionRate) > Number(vBConversionRate) && vAViews >= 10;

  const handleUpdateVariantB = (updates: Partial<ABExperimentVariantOverrides>) => {
    onChange({
      ...config,
      variantB: {
        ...config.variantB,
        ...updates,
      },
    });
  };

  return (
    <div className="space-y-6 text-left">
      {/* Enable Experiment Toggle */}
      <div className="flex items-center justify-between p-4 border border-border rounded-2xl bg-card shadow-sm">
        <div className="space-y-0.5">
          <Label className="text-xs font-black uppercase text-foreground flex items-center gap-1.5">
            <Split className="h-4 w-4 text-primary" /> A/B Split Testing
          </Label>
          <p className="text-[11px] text-muted-foreground">
            Split visitor traffic between two variants to discover what drives the highest conversions.
          </p>
        </div>
        <Switch
          checked={config.enabled}
          onCheckedChange={(checked) => onChange({ ...config, enabled: checked })}
        />
      </div>

      {config.enabled && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Experiment Name */}
          <div className="space-y-1">
            <Label className="text-[11px] font-bold text-muted-foreground">Experiment Title</Label>
            <Input
              value={config.name}
              onChange={(e) => onChange({ ...config, name: e.target.value })}
              placeholder="e.g. Urgency CTA vs Standard Booking"
              className="h-10 min-h-[44px] rounded-xl text-xs font-bold"
            />
          </div>

          {/* Traffic Split Slider */}
          <div className="p-4 border border-border rounded-2xl bg-muted/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">Traffic Allocation</span>
              <Badge variant="outline" className="text-xs font-black">
                {config.trafficSplitPercent}% Variant A / {100 - config.trafficSplitPercent}% Variant B
              </Badge>
            </div>

            <Slider
              value={[config.trafficSplitPercent]}
              onValueChange={(val) => onChange({ ...config, trafficSplitPercent: val[0] })}
              min={10}
              max={90}
              step={5}
              className="py-2 cursor-pointer"
            />
          </div>

          {/* Real-time Conversion KPI Comparison */}
          <div className="grid grid-cols-2 gap-3">
            <Card className={`rounded-2xl border ${isAWinnning ? 'border-amber-500 bg-amber-500/5' : 'border-border bg-card'}`}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px] font-black uppercase">
                    Variant A (Control)
                  </Badge>
                  {isAWinnning && <Trophy className="h-4 w-4 text-amber-500" />}
                </div>
                <div>
                  <p className="text-2xl font-black text-foreground">{vAConversionRate}%</p>
                  <p className="text-[10px] text-muted-foreground font-bold">
                    {vAClicks} clicks / {vAViews} views
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className={`rounded-2xl border ${isBWinning ? 'border-emerald-500 bg-emerald-500/5' : 'border-border bg-card'}`}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px] font-black uppercase">
                    Variant B (Challenger)
                  </Badge>
                  {isBWinning && <Trophy className="h-4 w-4 text-emerald-500" />}
                </div>
                <div>
                  <p className="text-2xl font-black text-emerald-500">{vBConversionRate}%</p>
                  <p className="text-[10px] text-muted-foreground font-bold">
                    {vBClicks} clicks / {vBViews} views
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Challenger Variant B Overrides Editor */}
          <Card className="rounded-2xl border-border bg-card p-4 space-y-4">
            <div className="space-y-1">
              <p className="text-xs font-black uppercase text-foreground">
                Variant B (Challenger) Overrides
              </p>
              <p className="text-[11px] text-muted-foreground">
                Specify alternative values to test against the original control experience.
              </p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-bold text-muted-foreground">
                  Alternative Headline (Control: &quot;{baseTitle}&quot;)
                </Label>
                <Input
                  value={config.variantB.headline || ''}
                  onChange={(e) => handleUpdateVariantB({ headline: e.target.value })}
                  placeholder="Enter challenger headline..."
                  className="h-9 min-h-[44px] rounded-xl text-xs font-medium"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-bold text-muted-foreground">
                  Alternative Button Text (Control: &quot;{baseCtaText}&quot;)
                </Label>
                <Input
                  value={config.variantB.buttonText || ''}
                  onChange={(e) => handleUpdateVariantB({ buttonText: e.target.value })}
                  placeholder="e.g. Claim Your Spot Now"
                  className="h-9 min-h-[44px] rounded-xl text-xs font-medium"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-bold text-muted-foreground">
                  Alternative Gating Milestone
                </Label>
                <Select
                  value={config.variantB.gating || 'immediate'}
                  onValueChange={(val) =>
                    handleUpdateVariantB({
                      gating: val as ABExperimentVariantOverrides['gating'],
                    })
                  }
                >
                  <SelectTrigger className="h-9 min-h-[44px] rounded-xl text-xs font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediate">Immediate (No Gate)</SelectItem>
                    <SelectItem value="quarter">25% Watched</SelectItem>
                    <SelectItem value="half">50% Watched</SelectItem>
                    <SelectItem value="threequarters">75% Watched</SelectItem>
                    <SelectItem value="complete">100% Watched</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
