'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Synthetic Audience Simulator & Pre-Flight Friction Cockpit Modal
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Simulates cohorts of virtual respondents across 5 cognitive personas to diagnose
 *    drop-off bottlenecks, mobile friction, and estimated completion rates prior to launch.
 * 2. Adheres strictly to Theme.md Section 8 Modal Architecture:
 *    - DialogContent: max-w-4xl p-0 overflow-hidden sm:rounded-2xl border border-border/80 bg-card shadow-2xl font-figtree
 *    - DialogHeader: demarcated with min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20
 *    - Zero raw descriptions: Guidance strictly enclosed in <CardInfoTooltip text="..." /> alongside title.
 *    - Screen reader only <DialogDescription className="sr-only">.
 *    - DialogFooter: px-6 py-3.5 border-t border-border/80 bg-muted/15
 *    - Mobile touch targets >= 44px with active:scale-[0.97] tactile response.
 * 3. STRICT ZERO-`any` / ZERO-`any[]` Invariant.
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { useToast } from '@/hooks/use-toast';
import {
  Bot,
  Play,
  RotateCcw,
  Sparkles,
  Clock,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Copy,
  ChevronRight,
  ShieldAlert,
  Zap,
  Activity,
  Layers,
} from 'lucide-react';
import type { Survey, SurveyElement } from '@/lib/types';
import {
  simulateAudienceCohort,
  SYNTHETIC_PERSONAS,
  type AudienceCohortSimulationResult,
  type SyntheticPersonaType,
  type QuestionFrictionMetric,
} from '@/lib/surveys/survey-synthetic-persona-engine';
import { cn } from '@/lib/utils';

export interface SyntheticPersonaSimulatorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  survey: Survey | { elements?: SurveyElement[]; title?: string };
  onNavigateToQuestion?: (questionId: string) => void;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const rem = seconds % 60;
  return `${mins}m ${rem}s`;
}

export function SyntheticPersonaSimulatorModal({
  open,
  onOpenChange,
  survey,
  onNavigateToQuestion,
}: SyntheticPersonaSimulatorModalProps) {
  const { toast } = useToast();
  const [cohortSize, setCohortSize] = React.useState<number>(50);
  const [isSimulating, setIsSimulating] = React.useState<boolean>(false);
  const [simulationResult, setSimulationResult] = React.useState<AudienceCohortSimulationResult | null>(null);
  const [selectedPersonaFilter, setSelectedPersonaFilter] = React.useState<SyntheticPersonaType | 'all'>('all');

  // Automatically run initial simulation when opened if not yet populated
  React.useEffect(() => {
    if (open && !simulationResult) {
      handleRunSimulation();
    }
  }, [open]);

  const handleRunSimulation = React.useCallback(() => {
    setIsSimulating(true);
    // Smooth micro-delay to render animated radar state
    setTimeout(() => {
      try {
        const result = simulateAudienceCohort(survey, cohortSize);
        setSimulationResult(result);
      } catch (err: unknown) {
        toast({
          title: 'Simulation Error',
          description: err instanceof Error ? err.message : 'Unable to complete audience simulation.',
          variant: 'destructive',
        });
      } finally {
        setIsSimulating(false);
      }
    }, 450);
  }, [survey, cohortSize, toast]);

  const handleExportSummary = React.useCallback(() => {
    if (!simulationResult) return;

    const summaryText = [
      `=== SmartSapp AI Pre-Flight Cockpit Simulation Summary ===`,
      `Survey: ${survey.title || 'Untitled Survey'}`,
      `Total Cohort Simulated: ${simulationResult.totalSimulated} virtual agents`,
      `Predicted Completion Rate: ${simulationResult.completionRate}% (${simulationResult.completedCount}/${simulationResult.totalSimulated})`,
      `Average Duration: ${formatDuration(simulationResult.averageDurationSeconds)} (Median: ${formatDuration(simulationResult.medianDurationSeconds)})`,
      `Overall Survey Health Score: ${simulationResult.overallHealthScore}/100`,
      `Predicted NPS: ${simulationResult.predictedNps !== undefined ? simulationResult.predictedNps : 'N/A'}`,
      `Predicted CSAT: ${simulationResult.predictedCsat !== undefined ? `${simulationResult.predictedCsat}/5` : 'N/A'}`,
      `High/Critical Friction Points: ${simulationResult.frictionPointsCount}`,
      ``,
      `--- Question Friction Breakdown ---`,
      ...simulationResult.questionFrictionAnalysis.map(
        (q, idx) =>
          `${idx + 1}. [${q.riskLevel.toUpperCase()}] "${q.questionTitle}" (${q.questionType}): Drop-off: ${q.dropOffRate}% | Dwell: ${q.avgDwellTimeSeconds}s | Friction Score: ${q.frictionScore}/100\n   Advice: ${q.actionableRecommendation}`
      ),
      ``,
      `--- Critical Pre-Flight Alerts ---`,
      ...(simulationResult.criticalAlerts.length > 0
        ? simulationResult.criticalAlerts.map((a) => `• ${a}`)
        : ['No critical risks detected. Safe to publish!']),
    ].join('\n');

    navigator.clipboard.writeText(summaryText);
    toast({
      title: 'Simulation Report Copied',
      description: 'Audit summary and actionable advice copied to clipboard.',
    });
  }, [simulationResult, survey.title, toast]);

  const personaList: SyntheticPersonaType[] = ['speeder', 'thorough', 'fatigued', 'skeptic', 'promoter'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden sm:rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl font-figtree flex flex-col max-h-[90vh] sm:max-h-[85vh]">
        {/* DEMARCATED HEADER */}
        <DialogHeader demarcated className="px-6 py-3.5 sm:py-4 min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
              <Bot className="h-5 w-5" />
            </div>
            <div className="flex items-center gap-1.5">
              <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
                Synthetic Audience Simulator & Pre-Flight Friction Cockpit
              </DialogTitle>
              <CardInfoTooltip text="Simulate 50 virtual respondents across 5 cognitive personas to detect question friction, drop-offs, and estimated completion rates before publishing." />
            </div>
          </div>
          <DialogDescription className="sr-only">
            Simulate virtual respondent cohorts across cognitive personas to evaluate drop-off risks and friction points before publishing.
          </DialogDescription>
        </DialogHeader>

        {/* MODAL BODY */}
        <ScrollArea className="flex-1 p-6 overflow-y-auto">
          <div className="space-y-6">
            {/* PERSONA OVERVIEW & SIMULATION CONTROLS */}
            <div className="p-4 rounded-xl border border-border/70 bg-muted/10 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <Layers className="h-3.5 w-3.5 text-primary" />
                    <span>Cognitive Audience Personas</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Virtual agents model speed, cognitive fatigue, privacy skepticism, and completion resilience.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center rounded-lg border border-border/80 bg-background p-0.5 text-xs font-semibold">
                    <span className="px-2 text-muted-foreground">Agents:</span>
                    {[25, 50, 100].map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setCohortSize(size)}
                        className={cn(
                          'px-2.5 py-1 rounded-md transition-all active:scale-[0.97]',
                          cohortSize === size
                            ? 'bg-primary text-primary-foreground shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {size}
                      </button>
                    ))}
                  </div>

                  <Button
                    type="button"
                    onClick={handleRunSimulation}
                    disabled={isSimulating}
                    size="sm"
                    className="h-8 gap-1.5 rounded-lg text-xs font-semibold active:scale-[0.97]"
                  >
                    {isSimulating ? (
                      <>
                        <RotateCcw className="h-3.5 w-3.5 animate-spin" />
                        <span>Simulating...</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-3.5 w-3.5" />
                        <span>Run Simulation</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Persona Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                {personaList.map((pKey) => {
                  const pConfig = SYNTHETIC_PERSONAS[pKey];
                  const pStats = simulationResult?.personaBreakdown[pKey];
                  const isFiltered = selectedPersonaFilter === pKey;

                  return (
                    <button
                      key={pKey}
                      type="button"
                      onClick={() => setSelectedPersonaFilter(isFiltered ? 'all' : pKey)}
                      className={cn(
                        'p-2.5 rounded-xl border text-left transition-all active:scale-[0.97] flex flex-col justify-between min-h-[44px]',
                        isFiltered
                          ? 'border-primary bg-primary/10 shadow-xs'
                          : 'border-border/70 bg-card hover:border-border hover:bg-muted/30'
                      )}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-base" role="img" aria-label={pConfig.name}>
                          {pConfig.avatar}
                        </span>
                        {pStats && (
                          <span
                            className={cn(
                              'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                              pStats.completionRate >= 80
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : pStats.completionRate >= 50
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                            )}
                          >
                            {pStats.completionRate}%
                          </span>
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-foreground leading-tight">{pConfig.name}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{pConfig.behaviorTraits[0]}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* SIMULATING PULSE RADAR BANNER */}
            {isSimulating && (
              <div className="p-6 rounded-xl border border-primary/40 bg-primary/5 flex flex-col items-center justify-center gap-3 text-center animate-pulse">
                <div className="p-3 rounded-full bg-primary/20 text-primary">
                  <Activity className="h-6 w-6 animate-spin" />
                </div>
                <div>
                  <div className="text-sm font-bold text-foreground">
                    Simulating {cohortSize} Synthetic Personas Across Survey Graph...
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Analyzing question cognitive load, dwell time variance, and drop-off tipping points.
                  </div>
                </div>
              </div>
            )}

            {/* DASHBOARD RESULTS */}
            {!isSimulating && simulationResult && (
              <div className="space-y-6">
                {/* 4 TOP-LEVEL KPI TILES */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* KPI 1: Predicted Completion Rate */}
                  <div className="p-4 rounded-xl border border-border/80 bg-card shadow-xs">
                    <div className="flex items-center justify-between text-xs font-medium text-muted-foreground mb-1">
                      <span>Predicted Completion</span>
                      <CheckCircle2
                        className={cn(
                          'h-4 w-4',
                          simulationResult.completionRate >= 75
                            ? 'text-emerald-500'
                            : simulationResult.completionRate >= 50
                            ? 'text-amber-500'
                            : 'text-rose-500'
                        )}
                      />
                    </div>
                    <div className="text-2xl font-black text-foreground">
                      {simulationResult.completionRate}%
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {simulationResult.completedCount} of {simulationResult.totalSimulated} finished
                    </div>
                  </div>

                  {/* KPI 2: Average Completion Time */}
                  <div className="p-4 rounded-xl border border-border/80 bg-card shadow-xs">
                    <div className="flex items-center justify-between text-xs font-medium text-muted-foreground mb-1">
                      <span>Est. Duration</span>
                      <Clock className="h-4 w-4 text-sky-500" />
                    </div>
                    <div className="text-2xl font-black text-foreground">
                      {formatDuration(simulationResult.averageDurationSeconds)}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      Median: {formatDuration(simulationResult.medianDurationSeconds)}
                    </div>
                  </div>

                  {/* KPI 3: Friction Index & Health */}
                  <div className="p-4 rounded-xl border border-border/80 bg-card shadow-xs">
                    <div className="flex items-center justify-between text-xs font-medium text-muted-foreground mb-1">
                      <span>Friction Index</span>
                      <Zap className="h-4 w-4 text-amber-500" />
                    </div>
                    <div className="text-2xl font-black text-foreground">
                      {simulationResult.overallHealthScore}
                      <span className="text-xs font-normal text-muted-foreground">/100</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {simulationResult.frictionPointsCount === 0
                        ? '0 bottlenecks detected'
                        : `${simulationResult.frictionPointsCount} friction points`}
                    </div>
                  </div>

                  {/* KPI 4: Predicted NPS & Sentiment */}
                  <div className="p-4 rounded-xl border border-border/80 bg-card shadow-xs">
                    <div className="flex items-center justify-between text-xs font-medium text-muted-foreground mb-1">
                      <span>Predicted NPS</span>
                      <TrendingUp className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div className="text-2xl font-black text-foreground">
                      {simulationResult.predictedNps !== undefined
                        ? `${simulationResult.predictedNps > 0 ? '+' : ''}${simulationResult.predictedNps}`
                        : 'N/A'}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      CSAT: {simulationResult.predictedCsat !== undefined ? `${simulationResult.predictedCsat}/5` : 'N/A'}
                    </div>
                  </div>
                </div>

                {/* CRITICAL ALERTS BANNER */}
                {simulationResult.criticalAlerts.length > 0 && (
                  <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400">
                      <ShieldAlert className="h-4 w-4 shrink-0" />
                      <span>Pre-Launch Friction Observations ({simulationResult.criticalAlerts.length})</span>
                    </div>
                    <ul className="space-y-1 text-xs text-amber-800 dark:text-amber-300 pl-6 list-disc">
                      {simulationResult.criticalAlerts.map((alert, i) => (
                        <li key={i}>{alert}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* QUESTION-BY-QUESTION FRICTION & DROP-OFF RADAR */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-foreground">
                        Question-by-Question Friction & Drop-Off Radar
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Dwell time, drop-off rates, and algorithmic recommendations to elevate completion.
                      </p>
                    </div>
                    {selectedPersonaFilter !== 'all' && (
                      <Badge
                        variant="secondary"
                        className="text-xs gap-1 cursor-pointer"
                        onClick={() => setSelectedPersonaFilter('all')}
                      >
                        Filter: {SYNTHETIC_PERSONAS[selectedPersonaFilter].name} ✕
                      </Badge>
                    )}
                  </div>

                  {simulationResult.questionFrictionAnalysis.length === 0 ? (
                    <div className="p-8 text-center border border-dashed border-border/80 rounded-xl text-xs text-muted-foreground">
                      No question blocks available to analyze. Add questions to the canvas to view pre-flight telemetry.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {simulationResult.questionFrictionAnalysis.map((metric: QuestionFrictionMetric, idx: number) => {
                        const isCritical = metric.riskLevel === 'critical';
                        const isHigh = metric.riskLevel === 'high';
                        const isMed = metric.riskLevel === 'medium';

                        return (
                          <div
                            key={metric.questionId}
                            className={cn(
                              'p-3.5 rounded-xl border transition-all',
                              isCritical
                                ? 'border-rose-500/40 bg-rose-500/5'
                                : isHigh
                                ? 'border-amber-500/40 bg-amber-500/5'
                                : isMed
                                ? 'border-blue-500/30 bg-blue-500/5'
                                : 'border-border/70 bg-card hover:border-border'
                            )}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                              <div className="flex items-start gap-2.5">
                                <span className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-muted text-muted-foreground font-mono text-xs font-bold shrink-0">
                                  {idx + 1}
                                </span>
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-bold text-foreground">
                                      {metric.questionTitle}
                                    </span>
                                    <Badge variant="outline" className="text-[10px] uppercase font-mono py-0">
                                      {metric.questionType}
                                    </Badge>
                                  </div>

                                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                    <span>
                                      Avg Dwell: <strong className="text-foreground">{metric.avgDwellTimeSeconds}s</strong>
                                    </span>
                                    <span>•</span>
                                    <span>
                                      Drop-offs:{' '}
                                      <strong
                                        className={cn(
                                          metric.dropOffCount > 0 ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-foreground'
                                        )}
                                      >
                                        {metric.dropOffCount} ({metric.dropOffRate}%)
                                      </strong>
                                    </span>
                                    <span>•</span>
                                    <span>
                                      Friction Score:{' '}
                                      <strong className="text-foreground">{metric.frictionScore}/100</strong>
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                                <Badge
                                  className={cn(
                                    'text-[10px] uppercase font-bold tracking-wider',
                                    isCritical
                                      ? 'bg-rose-500 text-white'
                                      : isHigh
                                      ? 'bg-amber-500 text-white'
                                      : isMed
                                      ? 'bg-sky-500 text-white'
                                      : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                  )}
                                >
                                  {metric.riskLevel} risk
                                </Badge>

                                {onNavigateToQuestion && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onNavigateToQuestion(metric.questionId)}
                                    className="h-7 text-xs px-2 gap-1 rounded-lg active:scale-[0.97]"
                                  >
                                    <span>Edit</span>
                                    <ChevronRight className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </div>

                            {/* Actionable recommendation */}
                            <div className="mt-2.5 pt-2 border-t border-border/50 flex items-start gap-1.5 text-xs text-muted-foreground">
                              <Sparkles className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                              <span>{metric.actionableRecommendation}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* DEMARCATED FOOTER */}
        <DialogFooter className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-between gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportSummary}
            disabled={!simulationResult}
            className="text-xs gap-1.5 rounded-xl min-h-[44px] active:scale-[0.97]"
          >
            <Copy className="h-3.5 w-3.5" />
            <span>Export Summary</span>
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs rounded-xl min-h-[44px] active:scale-[0.97]"
            >
              Close Cockpit
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
