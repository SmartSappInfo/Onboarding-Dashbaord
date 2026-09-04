'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Autonomous Experiments Console:
 *    - Implements Section 159 of `media_ux.md` providing an executive workbench for A/B testing,
 *      Multi-Armed Bandit traffic routing, variant conversion tracking, and automated winner promotion.
 * 2. Mobile Accessibility & Touch Target Bounds:
 *    - All buttons, selector triggers, and interactive cards strictly enforce `min-h-[44px] min-w-[44px]`
 *      with Emil Kowalski tactile micro-animations (`active:scale-[0.97]`).
 * 3. Strict Typing Standard: Zero use of `any` or `any[]`.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useFirestore } from '@/lib/firestore-context';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { MediaExperiment } from '@/lib/types/media-2.0';
import {
  listMediaExperimentsAction,
  pauseMediaExperimentAction,
  resumeMediaExperimentAction,
  promoteExperimentWinnerAction,
  deleteMediaExperimentAction,
} from '@/lib/media/experiment-service';
import { ExperimentBuilderModal } from './components/ExperimentBuilderModal';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  FlaskConical,
  Sparkles,
  TrendingUp,
  Award,
  Play,
  Pause,
  Trash2,
  CheckCircle2,
  Percent,
  Search,
  Plus,
  RefreshCw,
  Workflow,
  ArrowUpRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import PageContainerFluid from '@/components/page-container-fluid';

export default function ExperimentsConsolePage() {
  const firestore = useFirestore();
  const { activeWorkspaceId } = useWorkspace();
  const { toast } = useToast();

  const [experiments, setExperiments] = useState<MediaExperiment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);

  const loadExperiments = useCallback(async () => {
    if (!firestore || !activeWorkspaceId) return;
    setIsLoading(true);
    try {
      const data = await listMediaExperimentsAction(firestore, activeWorkspaceId);
      setExperiments(data);
    } catch (err) {
      console.error('[ExperimentsConsolePage] Error loading experiments:', err);
      toast({
        title: 'Failed to load experiments',
        description: 'Please check your connection and try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [firestore, activeWorkspaceId, toast]);

  useEffect(() => {
    loadExperiments();
  }, [loadExperiments]);

  const handleTogglePause = async (exp: MediaExperiment) => {
    if (!firestore || !activeWorkspaceId) return;
    const isPaused = exp.status === 'PAUSED';
    const success = isPaused
      ? await resumeMediaExperimentAction(firestore, activeWorkspaceId, exp.id)
      : await pauseMediaExperimentAction(firestore, activeWorkspaceId, exp.id);

    if (success) {
      toast({
        title: isPaused ? 'Experiment Resumed' : 'Experiment Paused',
        description: `"${exp.name}" traffic routing is now ${isPaused ? 'active' : 'halted'}.`,
      });
      loadExperiments();
    }
  };

  const handlePromoteWinner = async (expId: string, variantId: string, variantName: string) => {
    if (!firestore || !activeWorkspaceId) return;
    const success = await promoteExperimentWinnerAction(firestore, activeWorkspaceId, expId, variantId);
    if (success) {
      toast({
        title: 'Variant Promoted as Winner',
        description: `"${variantName}" now receives 100% of production traffic.`,
      });
      loadExperiments();
    }
  };

  const handleDelete = async (expId: string) => {
    if (!firestore || !activeWorkspaceId) return;
    const success = await deleteMediaExperimentAction(firestore, activeWorkspaceId, expId);
    if (success) {
      toast({
        title: 'Experiment Deleted',
        description: 'Experiment configuration has been removed.',
      });
      loadExperiments();
    }
  };

  // Filtered experiments
  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return experiments;
    const term = searchTerm.toLowerCase();
    return experiments.filter((e) => e.name.toLowerCase().includes(term) || e.type.toLowerCase().includes(term));
  }, [experiments, searchTerm]);

  // Aggregate Metrics
  const activeCount = experiments.filter((e) => e.status === 'RUNNING').length;
  const autoPromotedCount = experiments.filter((e) => e.status === 'AUTO_PROMOTED').length;
  const avgLift = useMemo(() => {
    const list = experiments.filter((e) => e.variants.length >= 2);
    if (list.length === 0) return 0;
    const total = list.reduce((acc, curr) => {
      const c = curr.variants.find((v) => v.isControl) || curr.variants[0];
      const ch = curr.variants.find((v) => !v.isControl) || curr.variants[1];
      if (c && ch && c.conversionRate > 0) {
        return acc + ((ch.conversionRate - c.conversionRate) / c.conversionRate) * 100;
      }
      return acc;
    }, 0);
    return parseFloat((total / list.length).toFixed(1));
  }, [experiments]);

  return (
    <PageContainerFluid>
      <div className="space-y-6 text-left">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-foreground">
                Autonomous Experiments Console
              </h1>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-black uppercase">
                Phase 8
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Multi-armed bandit routing, automated winner promotion, and continuous conversion lift optimization.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={loadExperiments}
              disabled={isLoading}
              className="rounded-xl h-10 px-3 min-h-[44px] gap-1.5 text-xs font-bold active:scale-[0.97]"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
              <span>Refresh</span>
            </Button>

            <Button
              size="sm"
              onClick={() => setIsBuilderOpen(true)}
              className="rounded-xl h-10 px-4 min-h-[44px] gap-2 text-xs font-bold active:scale-[0.97] shadow-sm shadow-primary/25"
            >
              <Plus className="h-4 w-4" />
              <span>New Experiment</span>
            </Button>
          </div>
        </div>

        {/* 4 Hero KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="rounded-2xl border-border bg-card shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase text-muted-foreground">Active Experiments</p>
                <p className="text-2xl font-black text-foreground">{activeCount}</p>
              </div>
              <FlaskConical className="h-6 w-6 text-primary" />
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border bg-card shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase text-muted-foreground">Avg Conversion Lift</p>
                <p className="text-2xl font-black text-emerald-500">
                  {avgLift > 0 ? `+${avgLift}%` : `${avgLift}%`}
                </p>
              </div>
              <TrendingUp className="h-6 w-6 text-emerald-500" />
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border bg-card shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase text-muted-foreground">Auto-Promoted Winners</p>
                <p className="text-2xl font-black text-amber-500">{autoPromotedCount}</p>
              </div>
              <Award className="h-6 w-6 text-amber-500" />
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border bg-card shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase text-muted-foreground">MAB Exploration Ratio</p>
                <p className="text-xl font-black text-primary">90% Exploit / 10% Explore</p>
              </div>
              <Workflow className="h-6 w-6 text-primary" />
            </CardContent>
          </Card>
        </div>

        {/* Toolbar & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-muted/20 border border-border rounded-2xl">
          <div className="relative w-full sm:w-80 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-40 group-focus-within:text-primary group-focus-within:opacity-100 transition-all" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search experiments by name or type..."
              className="h-10 pl-9 rounded-xl text-xs font-bold bg-card border-none"
            />
          </div>

          <span className="text-xs font-bold text-muted-foreground">
            Showing {filtered.length} of {experiments.length} experiments
          </span>
        </div>

        {/* Experiments List */}
        {isLoading ? (
          <div className="py-20 text-center space-y-4">
            <Sparkles className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="text-xs font-bold text-muted-foreground">Loading Experiment Results...</p>
          </div>
        ) : filtered.length > 0 ? (
          <div className="space-y-4">
            {filtered.map((exp) => {
              const control = exp.variants.find((v) => v.isControl) || exp.variants[0];
              const challenger = exp.variants.find((v) => !v.isControl) || exp.variants[1];

              let lift = 0;
              if (control && challenger && control.conversionRate > 0) {
                lift = parseFloat((((challenger.conversionRate - control.conversionRate) / control.conversionRate) * 100).toFixed(1));
              }

              return (
                <Card key={exp.id} className="rounded-2xl border-border bg-card shadow-sm hover:border-primary/20 transition-all">
                  <CardHeader className="p-5 pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-primary/10 text-primary">
                          <FlaskConical className="h-4 w-4" />
                        </div>
                        <div>
                          <CardTitle className="text-sm font-black text-foreground">
                            {exp.name}
                          </CardTitle>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            ID: <span className="font-mono">{exp.id}</span> • Created {new Date(exp.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[9px] font-black uppercase px-2 py-0.5',
                            exp.status === 'RUNNING' && 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
                            exp.status === 'AUTO_PROMOTED' && 'bg-amber-500/10 text-amber-600 border-amber-500/30',
                            exp.status === 'PAUSED' && 'bg-muted text-muted-foreground',
                            exp.status === 'CONCLUDED' && 'bg-blue-500/10 text-blue-600 border-blue-500/30'
                          )}
                        >
                          {exp.status.replace('_', ' ')}
                        </Badge>

                        <Badge variant="outline" className="text-[9px] font-black uppercase">
                          {exp.algorithm === 'EPSILON_GREEDY' ? '90/10 MAB' : 'Static 50/50'}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-5 pt-2 space-y-4">
                    {/* Variants Comparison Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {exp.variants.map((v) => (
                        <div
                          key={v.id}
                          className={cn(
                            'p-4 rounded-2xl border transition-all space-y-3',
                            v.isWinner
                              ? 'border-emerald-500/40 bg-emerald-500/5'
                              : v.isControl
                              ? 'border-border bg-muted/10'
                              : 'border-primary/20 bg-primary/5'
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-foreground">{v.name}</span>
                              {v.isWinner && (
                                <Badge className="bg-emerald-500 text-white text-[9px] font-black uppercase gap-1">
                                  <Award className="h-3 w-3" /> Winner
                                </Badge>
                              )}
                              {v.isControl && (
                                <Badge variant="outline" className="text-[9px] font-black uppercase">
                                  Control
                                </Badge>
                              )}
                            </div>

                            <span className="text-xs font-black font-mono">
                              {v.weight}% Traffic
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-left">
                            <div className="p-2 rounded-xl bg-background border border-border/50">
                              <span className="text-[9px] font-black uppercase text-muted-foreground block">Impressions</span>
                              <span className="text-sm font-black text-foreground">{v.impressions.toLocaleString()}</span>
                            </div>
                            <div className="p-2 rounded-xl bg-background border border-border/50">
                              <span className="text-[9px] font-black uppercase text-muted-foreground block">Conversions</span>
                              <span className="text-sm font-black text-foreground">{v.conversions.toLocaleString()}</span>
                            </div>
                            <div className="p-2 rounded-xl bg-background border border-border/50">
                              <span className="text-[9px] font-black uppercase text-muted-foreground block">CVR %</span>
                              <span className="text-sm font-black text-primary">{(v.conversionRate * 100).toFixed(1)}%</span>
                            </div>
                          </div>

                          {/* Quick promote button if active */}
                          {exp.status === 'RUNNING' && !v.isWinner && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handlePromoteWinner(exp.id, v.id, v.name)}
                              className="w-full rounded-xl text-[11px] font-bold min-h-[44px] gap-1.5 active:scale-[0.97]"
                            >
                              <Award className="h-3.5 w-3.5 text-primary" /> Lock 100% Traffic to Variant
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Statistical Confidence & Controls Bar */}
                    <div className="pt-2 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-muted-foreground">
                          Statistical Confidence: <span className="font-bold text-foreground">{exp.confidenceScore}%</span>
                        </span>
                        <span>•</span>
                        <span className="font-semibold text-muted-foreground">
                          p-value: <span className="font-mono font-bold text-foreground">{exp.pValue}</span>
                        </span>
                        {lift !== 0 && (
                          <>
                            <span>•</span>
                            <span className={cn('font-bold', lift > 0 ? 'text-emerald-500' : 'text-rose-500')}>
                              {lift > 0 ? `+${lift}% Lift` : `${lift}% Drop`}
                            </span>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {(exp.status === 'RUNNING' || exp.status === 'PAUSED') && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleTogglePause(exp)}
                            className="rounded-xl px-3 min-h-[44px] text-xs font-bold gap-1.5 active:scale-[0.97]"
                          >
                            {exp.status === 'PAUSED' ? (
                              <>
                                <Play className="h-3.5 w-3.5 text-emerald-500" /> Resume
                              </>
                            ) : (
                              <>
                                <Pause className="h-3.5 w-3.5 text-amber-500" /> Pause
                              </>
                            )}
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(exp.id)}
                          className="rounded-xl p-0 min-h-[44px] min-w-[44px] text-muted-foreground hover:text-destructive active:scale-[0.97]"
                          aria-label="Delete experiment"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="py-24 border border-dashed rounded-3xl bg-muted/10 text-center space-y-3">
            <FlaskConical className="h-8 w-8 text-muted-foreground/40 mx-auto" />
            <p className="text-xs font-black text-foreground">No Experiments Created Yet</p>
            <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
              Launch multi-armed bandit tests on CTA gates, headlines, or thumbnails to automatically route traffic to the highest-converting variants.
            </p>
            <Button
              size="sm"
              onClick={() => setIsBuilderOpen(true)}
              className="rounded-xl h-10 px-4 min-h-[44px] gap-2 text-xs font-bold active:scale-[0.97]"
            >
              <Plus className="h-4 w-4" /> Create Your First Experiment
            </Button>
          </div>
        )}
      </div>

      {/* Builder Modal */}
      <ExperimentBuilderModal
        isOpen={isBuilderOpen}
        onClose={() => setIsBuilderOpen(false)}
        workspaceId={activeWorkspaceId || ''}
        onCreated={() => {
          setIsBuilderOpen(false);
          loadExperiments();
        }}
      />
    </PageContainerFluid>
  );
}
