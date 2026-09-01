'use client';

/**
 * SmartSapp Forms 2.0: A/B Testing & Experiment Manager Card
 * 
 * Manages multi-variant traffic splits, real-time conversion lift,
 * statistical significance indicators, and 1-click winner promotions.
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Split,
  Trophy,
  Play,
  Pause,
  Plus,
  ArrowUpRight,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Sliders,
  DollarSign,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { Form } from '@/lib/types';
import type { FormExperiment, FormVariant } from '@/lib/forms/form-optimization-types';
import {
  createFormExperimentAction,
  updateExperimentStatusAction,
  promoteWinningVariantAction,
} from '@/lib/forms/form-optimization-actions';

interface ExperimentManagerCardProps {
  form: Form;
  experiments: FormExperiment[];
  onExperimentUpdated: () => void;
}

export default function ExperimentManagerCard({
  form,
  experiments,
  onExperimentUpdated,
}: ExperimentManagerCardProps) {
  const { toast } = useToast();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPromoting, setIsPromoting] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Form State for new experiment
  const [expName, setExpName] = useState('Headline & CTA Optimization');
  const [hypothesis, setHypothesis] = useState('Benefit-driven headline will lift demo conversion rate.');
  const [challengerHeadline, setChallengerHeadline] = useState(`${form.title} — Start Free Today`);
  const [challengerCta, setChallengerCta] = useState('Claim Your Spot Now');
  const [challengerTheme, setChallengerTheme] = useState<'minimal' | 'professional' | 'card' | 'embedded'>('professional');

  const activeExp = experiments.find(e => e.status === 'running') || experiments[0];

  const handleCreateExperiment = async () => {
    try {
      const res = await createFormExperimentAction({
        formId: form.id,
        name: expName,
        hypothesis,
        challengerVariant: {
          headlineOverride: challengerHeadline,
          ctaLabelOverride: challengerCta,
          themePresetOverride: challengerTheme,
        },
      });

      if (res.success) {
        toast({ title: 'A/B Test Launched ✨', description: 'Variant traffic split is now active at 50/50.' });
        setIsCreateModalOpen(false);
        onExperimentUpdated();
      } else {
        toast({ variant: 'destructive', title: 'Error', description: res.error });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not create experiment.' });
    }
  };

  const handleToggleStatus = async (exp: FormExperiment) => {
    setIsUpdatingStatus(true);
    try {
      const nextStatus = exp.status === 'running' ? 'paused' : 'running';
      const res = await updateExperimentStatusAction({
        formId: form.id,
        experimentId: exp.id,
        status: nextStatus,
      });

      if (res.success) {
        toast({ title: `Experiment ${nextStatus === 'running' ? 'Resumed' : 'Paused'}` });
        onExperimentUpdated();
      }
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handlePromoteWinner = async (exp: FormExperiment, variantId: string) => {
    setIsPromoting(true);
    try {
      const res = await promoteWinningVariantAction({
        formId: form.id,
        experimentId: exp.id,
        winningVariantId: variantId,
      });

      if (res.success) {
        toast({ title: 'Winner Promoted 🏆', description: res.message });
        onExperimentUpdated();
      } else {
        toast({ variant: 'destructive', title: 'Error', description: res.error });
      }
    } finally {
      setIsPromoting(false);
    }
  };

  return (
    <div className="p-6 rounded-3xl bg-card border border-border/60 shadow-xs space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-2xl bg-primary/10 text-primary">
            <Split className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">A/B Testing & Multi-Variant Experiments</h3>
            <p className="text-[11px] text-muted-foreground">Test headlines, themes, and field visibility with statistical confidence</p>
          </div>
        </div>

        <Button
          onClick={() => setIsCreateModalOpen(true)}
          size="sm"
          className="rounded-xl h-8 text-xs font-bold gap-1.5 min-h-[36px]"
        >
          <Plus className="h-3.5 w-3.5" />
          Create A/B Test
        </Button>
      </div>

      {activeExp ? (
        <div className="space-y-6">
          {/* Experiment Header Status */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-muted/20 border border-border/40">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-black text-foreground">{activeExp.name}</h4>
                <Badge
                  variant="outline"
                  className={`text-[9px] uppercase font-bold ${
                    activeExp.status === 'running'
                      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                      : activeExp.status === 'paused'
                      ? 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {activeExp.status}
                </Badge>
              </div>
              {activeExp.hypothesis && (
                <p className="text-[11px] text-muted-foreground italic">&ldquo;{activeExp.hypothesis}&rdquo;</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={() => handleToggleStatus(activeExp)}
                disabled={isUpdatingStatus || activeExp.status === 'concluded'}
                variant="outline"
                size="sm"
                className="h-8 rounded-xl text-xs font-bold gap-1.5"
              >
                {activeExp.status === 'running' ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {activeExp.status === 'running' ? 'Pause Test' : 'Resume Test'}
              </Button>
            </div>
          </div>

          {/* Statistical Lift & Confidence Bar */}
          <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  Observed Conversion Lift
                </span>
                <span className="text-lg font-black text-emerald-600 flex items-center gap-1">
                  <ArrowUpRight className="h-4 w-4" /> +{activeExp.liftPercentage}% Lift
                </span>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  Statistical Confidence
                </span>
                <span className="text-sm font-black text-primary">{activeExp.statisticalConfidence}%</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  p-Value
                </span>
                <span className="text-xs font-mono font-bold text-foreground">{activeExp.pVal}</span>
              </div>
            </div>
          </div>

          {/* 2-Column Side-by-Side Variant Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeExp.variants.map((v) => (
              <div
                key={v.id}
                className={`p-5 rounded-3xl border space-y-4 relative ${
                  v.isControl
                    ? 'bg-card border-border/60'
                    : 'bg-primary/5 border-primary/30 shadow-xs'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {v.isControl ? 'Variant A (Control)' : 'Variant B (Challenger)'}
                    </span>
                    <h4 className="text-xs font-bold text-foreground line-clamp-1">{v.headlineOverride || form.title}</h4>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-bold">
                    {v.trafficWeight}% Traffic
                  </Badge>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-background/60 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block">Visitors</span>
                    <span className="font-black text-foreground text-sm">{v.visitors}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-background/60 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block">Submissions</span>
                    <span className="font-black text-foreground text-sm">{v.submissions}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-background/60 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block">Conversion Rate</span>
                    <span className="font-black text-emerald-600 text-sm">{v.conversionRate}%</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-background/60 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block">Pipeline Value</span>
                    <span className="font-black text-purple-600 dark:text-purple-400 text-sm">${v.pipelineValueAttributed.toLocaleString()}</span>
                  </div>
                </div>

                {/* Overrides Preview */}
                <div className="p-3 rounded-xl bg-muted/30 text-[11px] space-y-1 font-mono text-muted-foreground">
                  <div>CTA: &ldquo;{v.ctaLabelOverride || 'Submit'}&rdquo;</div>
                  <div>Theme: {v.themePresetOverride || 'minimal'}</div>
                </div>

                {/* 1-Click Promote Winner */}
                {!v.isControl && activeExp.status !== 'concluded' && (
                  <Button
                    onClick={() => handlePromoteWinner(activeExp, v.id)}
                    disabled={isPromoting}
                    className="w-full h-9 rounded-xl text-xs font-bold gap-1.5 bg-gradient-to-r from-indigo-600 to-primary text-white shadow-xs"
                  >
                    {isPromoting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trophy className="h-3.5 w-3.5" />}
                    Promote Variant B as Winner
                  </Button>
                )}

                {activeExp.winnerVariantId === v.id && (
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 text-xs font-bold text-center flex items-center justify-center gap-1.5">
                    <Trophy className="h-4 w-4" /> Promoted Winner
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="py-12 text-center space-y-3">
          <Split className="h-10 w-10 text-muted-foreground/60 mx-auto" />
          <h4 className="text-xs font-bold text-foreground">No Active Experiments</h4>
          <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
            Launch an A/B test to compare new headlines, shorter layouts, or action buttons with live traffic.
          </p>
          <Button
            onClick={() => setIsCreateModalOpen(true)}
            size="sm"
            className="rounded-xl h-8 text-xs font-bold gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> Launch First Experiment
          </Button>
        </div>
      )}

      {/* Create Experiment Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-lg rounded-3xl p-6 space-y-4">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Create A/B Experiment</DialogTitle>
            <DialogDescription className="text-xs">
              Test alternative headlines, CTA labels, and themes against your live control form.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5">
            <div className="space-y-1">
              <Label className="text-xs font-bold">Experiment Name</Label>
              <Input
                value={expName}
                onChange={(e) => setExpName(e.target.value)}
                className="h-9 rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">Hypothesis</Label>
              <Input
                value={hypothesis}
                onChange={(e) => setHypothesis(e.target.value)}
                className="h-9 rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">Challenger Headline (Variant B)</Label>
              <Input
                value={challengerHeadline}
                onChange={(e) => setChallengerHeadline(e.target.value)}
                className="h-9 rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">Challenger CTA Button Text</Label>
              <Input
                value={challengerCta}
                onChange={(e) => setChallengerCta(e.target.value)}
                className="h-9 rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">Challenger Theme Style</Label>
              <Select value={challengerTheme} onValueChange={(val) => setChallengerTheme(val as typeof challengerTheme)}>
                <SelectTrigger className="h-9 rounded-xl text-xs font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="minimal">Minimalist</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="card">Card Layout</SelectItem>
                  <SelectItem value="embedded">Embedded Clean</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" size="sm" onClick={() => setIsCreateModalOpen(false)} className="rounded-xl text-xs">
              Cancel
            </Button>
            <Button onClick={handleCreateExperiment} size="sm" className="rounded-xl text-xs font-bold px-4">
              Start Experiment (50/50 Split)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
