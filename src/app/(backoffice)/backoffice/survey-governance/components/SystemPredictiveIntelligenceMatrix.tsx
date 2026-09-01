'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Phase 9: Backoffice Global Predictive Intelligence Matrix
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 & Strict Zero-Any Invariant):
 * 1. Control-Plane Predictive Model Weights: Survey, CRM, Messaging, Meetings signal weights.
 * 2. Risk & Conversion thresholds.
 * 3. Mobile Ergonomics: min-h-[44px] touch targets, active:scale-[0.97] tactile press.
 * 4. Strict Zero-Any Invariant.
 */

import * as React from 'react';
import type { SystemPredictiveWeightsConfig } from '@/lib/types';
import {
  getSystemPredictiveWeightsAction,
  saveSystemPredictiveWeightsAction,
} from '@/lib/surveys/survey-predictive-actions';
import { useToast } from '@/hooks/use-toast';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  BrainCircuit,
  Save,
  CheckCircle2,
  Sparkles,
  Sliders,
  Flame,
  TrendingUp,
  Loader2,
  Layers,
} from 'lucide-react';

export function SystemPredictiveIntelligenceMatrix() {
  const { toast } = useToast();

  const [config, setConfig] = React.useState<SystemPredictiveWeightsConfig>({
    surveyWeight: 40,
    crmWeight: 30,
    messagingWeight: 20,
    meetingsWeight: 10,
    churnAlertThreshold: 70,
    conversionHighThreshold: 80,
    autoCreateDetractorTasks: true,
  });

  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);

  const fetchConfig = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getSystemPredictiveWeightsAction();
      if (res.success && res.config) {
        setConfig(res.config);
      }
    } catch (err) {
      console.error('[SystemPredictiveIntelligenceMatrix] Fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await saveSystemPredictiveWeightsAction(config);
      if (res.success) {
        toast({
          title: 'Predictive Weights Saved',
          description: 'Global signal weights and predictive model thresholds updated.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Save Failed',
          description: res.error || 'Failed to update predictive weights',
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'An unexpected error occurred while saving weights.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-3">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground font-semibold">Loading Predictive Intelligence Weights...</p>
      </div>
    );
  }

  const totalWeight =
    config.surveyWeight + config.crmWeight + config.messagingWeight + config.meetingsWeight;

  return (
    <Card className="rounded-2xl border-border bg-card shadow-sm overflow-hidden text-left">
      <CardHeader className="pb-4 border-b border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600">
              <BrainCircuit className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                Predictive Intelligence Signal Weights & Churn Matrix
                <Badge variant="outline" className="text-[10px] font-mono text-indigo-600 border-indigo-300">
                  Phase 9 (Apex)
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Control the cross-system weighting distribution for Churn Forecasting, Account Health & Next-Best-Action logic.
              </CardDescription>
            </div>
          </div>
        </div>

        <Button
          size="sm"
          onClick={handleSave}
          disabled={isSaving}
          className="h-9 px-4 gap-1.5 text-xs font-semibold active:scale-[0.97] bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save Predictive Weights
        </Button>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Signal Weight Distribution */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders className="h-4 w-4 text-indigo-600" />
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                Signal Weight Distribution ({totalWeight}%)
              </span>
            </div>
            {totalWeight !== 100 && (
              <Badge variant="destructive" className="text-[10px]">
                Total weights should ideally sum to 100%
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-border bg-card space-y-1.5">
              <Label className="text-xs font-semibold">Survey Feedback (%)</Label>
              <Input
                type="number"
                value={config.surveyWeight}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, surveyWeight: Number(e.target.value) || 0 }))
                }
                className="h-9 text-xs rounded-xl"
              />
              <p className="text-[10px] text-muted-foreground">CSAT, NPS & Sentiment</p>
            </div>

            <div className="p-4 rounded-xl border border-border bg-card space-y-1.5">
              <Label className="text-xs font-semibold">CRM Deals & Pipeline (%)</Label>
              <Input
                type="number"
                value={config.crmWeight}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, crmWeight: Number(e.target.value) || 0 }))
                }
                className="h-9 text-xs rounded-xl"
              />
              <p className="text-[10px] text-muted-foreground">Won / Lost / Open Deals</p>
            </div>

            <div className="p-4 rounded-xl border border-border bg-card space-y-1.5">
              <Label className="text-xs font-semibold">Messaging Velocity (%)</Label>
              <Input
                type="number"
                value={config.messagingWeight}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, messagingWeight: Number(e.target.value) || 0 }))
                }
                className="h-9 text-xs rounded-xl"
              />
              <p className="text-[10px] text-muted-foreground">Response frequency</p>
            </div>

            <div className="p-4 rounded-xl border border-border bg-card space-y-1.5">
              <Label className="text-xs font-semibold">Meeting Attendance (%)</Label>
              <Input
                type="number"
                value={config.meetingsWeight}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, meetingsWeight: Number(e.target.value) || 0 }))
                }
                className="h-9 text-xs rounded-xl"
              />
              <p className="text-[10px] text-muted-foreground">Completed vs No-Shows</p>
            </div>
          </div>
        </div>

        {/* Predictive Alert Thresholds & Automations */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          <div className="p-5 rounded-2xl border border-border bg-card space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
              <Flame className="h-4 w-4 text-rose-600" />
              <span>Churn Risk & Conversion Thresholds</span>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Critical Churn Alert Threshold (%)</Label>
                <Input
                  type="number"
                  value={config.churnAlertThreshold}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, churnAlertThreshold: Number(e.target.value) || 70 }))
                  }
                  className="h-9 text-xs rounded-xl"
                />
                <p className="text-[11px] text-muted-foreground">
                  Accounts exceeding this churn risk percentage will trigger proactive Next-Best-Action alerts.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">High-Propensity Lead Threshold (%)</Label>
                <Input
                  type="number"
                  value={config.conversionHighThreshold}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      conversionHighThreshold: Number(e.target.value) || 80,
                    }))
                  }
                  className="h-9 text-xs rounded-xl"
                />
              </div>
            </div>
          </div>

          <div className="p-5 rounded-2xl border border-border bg-card space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
              <Sparkles className="h-4 w-4 text-indigo-600" />
              <span>Autonomous Prescriptive Interventions</span>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold cursor-pointer">
                    Auto-Generate CRM Tasks on Detractor Feedback
                  </Label>
                  <p className="text-[10px] text-muted-foreground">
                    Automatically create a high-priority executive follow-up task when a customer rates below 50%.
                  </p>
                </div>
                <Switch
                  checked={config.autoCreateDetractorTasks}
                  onCheckedChange={(checked) =>
                    setConfig((prev) => ({ ...prev, autoCreateDetractorTasks: checked }))
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
