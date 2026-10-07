'use client';

/**
 * @fileOverview Backoffice Policy & Feature Flag Configuration Panel (Phase 11 M5 · T5)
 *
 * Implements:
 * - Rule 3 (Backoffice Management without Code Deployments)
 * - Rule 4 (Strict Typing: zero any/any[])
 * - Rule 7 (Mobile-first >= 44px touch targets, tactile compression)
 * - Rule 57 (Data Retention & Purge Configuration)
 * - Rule 64 (3-Tier Feature Flags & Policy Thresholds)
 */

import * as React from 'react';
import {
  Sliders,
  Shield,
  Clock,
  DollarSign,
  Layers,
  Save,
  CheckCircle2,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import type { BackofficeGovernanceConfig } from '@/platform/domains/knowledge_memory/contracts/knowledge-ui-types';
import { cn } from '@/lib/utils';

export interface PolicyConfigPanelProps {
  initialConfig: BackofficeGovernanceConfig;
  onSave: (config: BackofficeGovernanceConfig) => Promise<void>;
  isSaving?: boolean;
  className?: string;
}

export function PolicyConfigPanel({
  initialConfig,
  onSave,
  isSaving = false,
  className,
}: PolicyConfigPanelProps) {
  const [config, setConfig] = React.useState<BackofficeGovernanceConfig>(initialConfig);
  const [hasChanges, setHasChanges] = React.useState(false);

  // Sync when initialConfig updates from server
  React.useEffect(() => {
    setConfig(initialConfig);
    setHasChanges(false);
  }, [initialConfig]);

  const updateField = <K extends keyof BackofficeGovernanceConfig>(
    key: K,
    val: BackofficeGovernanceConfig[K]
  ) => {
    setConfig((prev) => ({ ...prev, [key]: val }));
    setHasChanges(true);
  };

  const updateQuota = (quotaKey: keyof BackofficeGovernanceConfig['quotas'], val: number) => {
    setConfig((prev) => ({
      ...prev,
      quotas: {
        ...prev.quotas,
        [quotaKey]: val,
      },
    }));
    setHasChanges(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(config);
    setHasChanges(false);
  };

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-6', className)}>
      <Card className="border border-border/80 bg-card shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-border/60 bg-muted/20 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
                <Sliders className="h-4 w-4" />
              </div>
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                Operational Policies & Feature Toggles
                <CardInfoTooltip text="Configure AI execution guardrails, quota ceilings, auto-accept thresholds, and GDPR data retention without redeploying code (Rule 3 & 64)." />
              </CardTitle>
            </div>
            {hasChanges && (
              <Badge variant="outline" className="text-xs text-amber-600 border-amber-500/30 bg-amber-500/10">
                Unsaved changes
              </Badge>
            )}
          </div>
          <CardDescription className="text-xs text-muted-foreground pt-1">
            Dynamic platform policies governed per tenant workspace.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Section 1: Auto-Accept Confidence Policy Slider */}
          <div className="rounded-xl border border-border/80 bg-muted/15 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  Auto-Accept Confidence Threshold
                </Label>
                <p className="text-xs text-muted-foreground">
                  Minimum confidence required for newly extracted knowledge candidates to bypass human review.
                </p>
              </div>
              <Badge variant="outline" className="text-sm font-mono px-3 py-1 font-bold">
                {Math.round(config.autoAcceptThreshold * 100)}%
              </Badge>
            </div>

            <Slider
              value={[config.autoAcceptThreshold * 100]}
              min={50}
              max={100}
              step={1}
              onValueChange={([val]) => updateField('autoAcceptThreshold', val / 100)}
              className="py-2"
            />

            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
              <span>Strict Human Review (50%)</span>
              <span className="text-emerald-600 font-semibold">Production Baseline (90%)</span>
              <span>Near-Autonomous (100%)</span>
            </div>
          </div>

          {/* Section 2: Daily Quotas & Ceilings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-border/80 bg-muted/15 p-4 space-y-2">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                Daily Pipeline Ingestions
              </Label>
              <Input
                type="number"
                min={1}
                max={500}
                value={config.quotas.dailyPipelines}
                onChange={(e) => updateQuota('dailyPipelines', parseInt(e.target.value) || 1)}
                className="h-10 rounded-xl text-xs bg-card"
              />
              <span className="text-[11px] text-muted-foreground block">Max audio meetings per day</span>
            </div>

            <div className="rounded-xl border border-border/80 bg-muted/15 p-4 space-y-2">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                Transcription Hours / Day
              </Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={config.quotas.dailyTranscriptionHours}
                onChange={(e) => updateQuota('dailyTranscriptionHours', parseInt(e.target.value) || 1)}
                className="h-10 rounded-xl text-xs bg-card"
              />
              <span className="text-[11px] text-muted-foreground block">Max total audio duration</span>
            </div>

            <div className="rounded-xl border border-border/80 bg-muted/15 p-4 space-y-2">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                Max Queries / Hour
              </Label>
              <Input
                type="number"
                min={10}
                max={1000}
                value={config.quotas.queriesPerHour}
                onChange={(e) => updateQuota('queriesPerHour', parseInt(e.target.value) || 10)}
                className="h-10 rounded-xl text-xs bg-card"
              />
              <span className="text-[11px] text-muted-foreground block">Rate limit per workspace</span>
            </div>
          </div>

          {/* Section 3: Cost Ceiling & Retention Policy */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border/80 bg-muted/15 p-4 space-y-2">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                Monthly Cost Ceiling (USD)
              </Label>
              <Input
                type="number"
                min={10}
                max={5000}
                value={config.costCeilingUsd}
                onChange={(e) => updateField('costCeilingUsd', parseFloat(e.target.value) || 10)}
                className="h-10 rounded-xl text-xs bg-card"
              />
              <span className="text-[11px] text-muted-foreground block">
                Automatic rate throttle when monthly AI spend reaches this limit.
              </span>
            </div>

            <div className="rounded-xl border border-border/80 bg-muted/15 p-4 space-y-2">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                Retention Days (Rule 57)
              </Label>
              <Input
                type="number"
                min={7}
                max={365}
                value={config.retentionDays}
                onChange={(e) => updateField('retentionDays', parseInt(e.target.value) || 30)}
                className="h-10 rounded-xl text-xs bg-card"
              />
              <span className="text-[11px] text-muted-foreground block">
                Auto-purge unpromoted candidates and audio artifacts after N days.
              </span>
            </div>
          </div>
        </CardContent>

        <div className="border-t border-border/60 bg-muted/10 px-6 py-3.5 flex items-center justify-end">
          <Button
            type="submit"
            disabled={isSaving || !hasChanges}
            className="min-h-[44px] px-5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.97] transition-all text-xs font-semibold flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving…' : 'Save Governance Policies'}
          </Button>
        </div>
      </Card>
    </form>
  );
}
