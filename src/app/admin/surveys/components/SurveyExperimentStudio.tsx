'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Survey Studio A/B Testing & Experiment Studio
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 & Strict Zero-Any Invariant):
 * 1. A/B/C Experiment Designer: Variant split allocation, phrasing overrides, and incentive testing.
 * 2. Real-Time Telemetry & Statistical Winner Detection (Two-Proportion Z-Test).
 * 3. 1-Click Winning Variant Promotion.
 * 4. Mobile Ergonomics: min-h-[44px] touch targets, active:scale-[0.97] tactile press.
 * 5. Strict Zero-Any Invariant.
 */

import * as React from 'react';
import { useFormContext } from 'react-hook-form';
import type {
  Survey,
  SurveyExperimentConfig,
  SurveyExperimentVariant,
} from '@/lib/types';
import {
  getSurveyExperimentResultsAction,
  promoteWinningVariantAction,
} from '@/lib/surveys/survey-experiment-actions';
import { useToast } from '@/hooks/use-toast';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  FlaskConical,
  Plus,
  Trash2,
  Trophy,
  CheckCircle2,
  TrendingUp,
  BarChart3,
  Percent,
  Sparkles,
  Loader2,
  Crown,
  Shuffle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SurveyExperimentStudioProps {
  surveyId: string;
  workspaceId: string;
}

export function SurveyExperimentStudio({ surveyId, workspaceId }: SurveyExperimentStudioProps) {
  const { watch, setValue } = useFormContext();
  const { toast } = useToast();

  const expConfig: SurveyExperimentConfig = watch('experimentConfig') || {
    enabled: false,
    trafficAllocation: 100,
    variants: [
      {
        id: 'var_control',
        label: 'Control (Variant A)',
        description: 'Standard baseline questionnaire',
        weight: 50,
        isControl: true,
        metrics: { impressions: 0, starts: 0, completions: 0, completionRate: 0 },
      },
      {
        id: 'var_treatment_b',
        label: 'Variant B (Conversational Intro)',
        description: 'Engaging, warm opening copy',
        weight: 50,
        isControl: false,
        metrics: { impressions: 0, starts: 0, completions: 0, completionRate: 0 },
      },
    ],
    status: 'draft',
  };

  const [isLoadingResults, setIsLoadingResults] = React.useState(false);
  const [evaluatedVariants, setEvaluatedVariants] = React.useState<SurveyExperimentVariant[]>(expConfig.variants);
  const [winningVariantId, setWinningVariantId] = React.useState<string | undefined>(undefined);
  const [totalCompletions, setTotalCompletions] = React.useState(0);
  const [isPromoting, setIsPromoting] = React.useState(false);

  const updateConfig = (patch: Partial<SurveyExperimentConfig>) => {
    const updated = {
      ...expConfig,
      ...patch,
    };
    setValue('experimentConfig', updated, { shouldDirty: true });
  };

  const loadResults = React.useCallback(async () => {
    if (!surveyId || !workspaceId) return;
    setIsLoadingResults(true);
    try {
      const res = await getSurveyExperimentResultsAction(surveyId, workspaceId);
      if (res.success && res.evaluatedVariants) {
        setEvaluatedVariants(res.evaluatedVariants);
        setWinningVariantId(res.winningVariantId);
        setTotalCompletions(res.totalCompletions);
      }
    } catch (err) {
      console.error('[SurveyExperimentStudio] Error loading results:', err);
    } finally {
      setIsLoadingResults(false);
    }
  }, [surveyId, workspaceId]);

  React.useEffect(() => {
    if (expConfig.enabled) {
      loadResults();
    }
  }, [expConfig.enabled, loadResults]);

  const handleAddVariant = () => {
    const nextChar = String.fromCharCode(65 + expConfig.variants.length); // C, D, etc.
    const newVariant: SurveyExperimentVariant = {
      id: `var_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      label: `Variant ${nextChar}`,
      weight: Math.round(100 / (expConfig.variants.length + 1)),
      isControl: false,
      metrics: { impressions: 0, starts: 0, completions: 0, completionRate: 0 },
    };

    updateConfig({
      variants: [...expConfig.variants, newVariant],
    });

    toast({
      title: 'Variant Added',
      description: `Configured new experiment split ${newVariant.label}.`,
    });
  };

  const handleUpdateVariant = (variantId: string, patch: Partial<SurveyExperimentVariant>) => {
    const updated = expConfig.variants.map((v) => (v.id === variantId ? { ...v, ...patch } : v));
    updateConfig({ variants: updated });
  };

  const handleDeleteVariant = (variantId: string) => {
    if (expConfig.variants.length <= 2) {
      toast({
        variant: 'destructive',
        title: 'Minimum Variants Required',
        description: 'An experiment requires at least 2 variants (Control vs Treatment).',
      });
      return;
    }
    const updated = expConfig.variants.filter((v) => v.id !== variantId);
    updateConfig({ variants: updated });
  };

  const handlePromoteWinner = async (variantId: string) => {
    setIsPromoting(true);
    try {
      const res = await promoteWinningVariantAction(surveyId, variantId, workspaceId);
      if (res.success) {
        toast({
          title: 'Winner Promoted',
          description: 'The winning variant has been adopted as the primary survey configuration!',
        });
        updateConfig({ status: 'concluded', winningVariantId: variantId });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Promotion Failed',
        description: 'Failed to promote winning variant',
      });
    } finally {
      setIsPromoting(false);
    }
  };

  return (
    <Card className="rounded-2xl border-border bg-card shadow-sm overflow-hidden">
      <CardHeader className="pb-4 border-b border-border/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600">
                <FlaskConical className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  A/B Testing & Question Experiment Studio
                  <Badge variant="outline" className="text-[10px] font-mono text-purple-600 border-purple-300">
                    Phase 8
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Split respondent traffic to test different survey titles, introductory copy, and incentive framing.
                </CardDescription>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pl-3 border-l border-border">
            <Label htmlFor="ab-testing-master-toggle" className="text-xs font-semibold cursor-pointer">
              {expConfig.enabled ? 'Active' : 'Disabled'}
            </Label>
            <Switch
              id="ab-testing-master-toggle"
              checked={expConfig.enabled}
              onCheckedChange={(checked) => updateConfig({ enabled: checked, status: checked ? 'running' : 'draft' })}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {!expConfig.enabled ? (
          <div className="text-center py-10 border border-dashed border-border rounded-2xl p-6 bg-muted/10 space-y-3">
            <div className="h-10 w-10 rounded-2xl bg-purple-500/10 text-purple-600 flex items-center justify-center mx-auto">
              <FlaskConical className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-foreground">A/B Testing Disabled</p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Enable experiment mode to test variant splits, identify conversion bottlenecks, and optimize response rates with statistical confidence.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => updateConfig({ enabled: true, status: 'running' })}
              className="h-9 px-4 gap-1.5 text-xs font-semibold active:scale-[0.97]"
            >
              <FlaskConical className="h-4 w-4" />
              Enable A/B Experiment
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Live Performance Ribbon */}
            {totalCompletions > 0 && (
              <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-amber-500 shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-foreground">
                      {winningVariantId
                        ? `Winning Variant Identified: ${evaluatedVariants.find((v) => v.id === winningVariantId)?.label}`
                        : 'Experiment Running — Collecting Telemetry'}
                    </span>
                    <p className="text-[11px] text-muted-foreground">
                      {totalCompletions} total completions evaluated across {evaluatedVariants.length} variants.
                    </p>
                  </div>
                </div>

                {winningVariantId && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handlePromoteWinner(winningVariantId)}
                    disabled={isPromoting}
                    className="h-8 px-3 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 active:scale-[0.97]"
                  >
                    {isPromoting && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />}
                    <Crown className="h-3.5 w-3.5 mr-1" />
                    Adopt as Primary Survey
                  </Button>
                )}
              </div>
            )}

            {/* Variant Editor Cards */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Experiment Variants ({expConfig.variants.length})
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddVariant}
                  className="h-8 px-3 gap-1.5 text-xs font-semibold active:scale-[0.97]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Variant
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {expConfig.variants.map((variant, index) => {
                  const evalVar = evaluatedVariants.find((v) => v.id === variant.id) || variant;
                  const isWinner = variant.id === winningVariantId;

                  return (
                    <div
                      key={variant.id}
                      className={cn(
                        'p-5 rounded-2xl border transition-all space-y-4 text-left',
                        isWinner
                          ? 'border-emerald-500/50 bg-emerald-500/5 shadow-sm'
                          : 'border-border bg-card shadow-sm'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant={variant.isControl ? 'secondary' : 'default'} className="text-xs font-bold">
                            {variant.isControl ? 'Control (Baseline)' : 'Variant ' + String.fromCharCode(65 + index)}
                          </Badge>
                          {isWinner && (
                            <Badge className="bg-emerald-500/20 text-emerald-600 border-emerald-300 text-[10px] font-semibold">
                              <Crown className="h-3 w-3 mr-1 inline" /> Statistically Winning
                            </Badge>
                          )}
                        </div>

                        {!variant.isControl && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteVariant(variant.id)}
                            className="h-8 w-8 text-rose-500 hover:text-rose-700 active:scale-[0.97]"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      {/* Performance Bar */}
                      <div className="grid grid-cols-3 gap-2 bg-muted/40 p-2.5 rounded-xl text-center text-xs">
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase font-bold block">Submissions</span>
                          <span className="text-sm font-black text-foreground">{evalVar.metrics?.completions || 0}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase font-bold block">Comp. Rate</span>
                          <span className="text-sm font-black text-purple-600">{evalVar.metrics?.completionRate || 0}%</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase font-bold block">Avg Score</span>
                          <span className="text-sm font-black text-emerald-600">
                            {evalVar.metrics?.averageRating ? `${evalVar.metrics.averageRating}%` : 'N/A'}
                          </span>
                        </div>
                      </div>

                      {/* Variant Customizations */}
                      <div className="space-y-3 pt-1">
                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold text-muted-foreground">Variant Label</Label>
                          <Input
                            value={variant.label}
                            onChange={(e) => handleUpdateVariant(variant.id, { label: e.target.value })}
                            className="h-8 text-xs rounded-lg"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold text-muted-foreground">Title Override (Optional)</Label>
                          <Input
                            value={variant.titleOverride || ''}
                            onChange={(e) => handleUpdateVariant(variant.id, { titleOverride: e.target.value })}
                            placeholder="Defaults to standard survey title"
                            className="h-8 text-xs rounded-lg"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold text-muted-foreground">Introductory Copy Override</Label>
                          <Textarea
                            value={variant.introProseOverride || ''}
                            onChange={(e) => handleUpdateVariant(variant.id, { introProseOverride: e.target.value })}
                            placeholder="Defaults to standard survey description"
                            className="h-16 text-xs rounded-lg resize-none"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
