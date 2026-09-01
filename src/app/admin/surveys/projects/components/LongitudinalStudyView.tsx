'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Longitudinal Multi-Wave Analytics View
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 & Strict Zero-Any Invariant):
 * 1. Longitudinal Multi-Wave Studies: Time-series score tracking and cohort retention.
 * 2. Question-by-Question Delta Matrix with 2-Sample Z-Test Statistical Significance.
 * 3. Qualitative Thematic Drift Tracking.
 * 4. Mobile Ergonomics: min-h-[44px] touch targets, active:scale-[0.97] tactile press.
 * 5. Strict Zero-Any Invariant.
 */

import * as React from 'react';
import type {
  SurveyProject,
  SurveyWave,
  LongitudinalProjectMetrics,
  WaveDeltaComparison,
  ThematicDriftItem,
} from '@/lib/types';
import {
  getProjectLongitudinalAnalyticsAction,
  createSurveyWaveAction,
  concludeSurveyWaveAction,
} from '@/lib/surveys/survey-longitudinal-actions';
import { getWorkspaceActiveSurveysAction } from '@/lib/surveys/survey-crm-trigger-actions';
import { useToast } from '@/hooks/use-toast';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Layers,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  Calendar,
  Sparkles,
  Plus,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Loader2,
  RefreshCw,
  Clock,
  ArrowRight,
  BrainCircuit,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export interface LongitudinalStudyViewProps {
  projectId: string;
  workspaceId: string;
}

export function LongitudinalStudyView({ projectId, workspaceId }: LongitudinalStudyViewProps) {
  const { toast } = useToast();

  const [isLoading, setIsLoading] = React.useState(true);
  const [project, setProject] = React.useState<SurveyProject | null>(null);
  const [waves, setWaves] = React.useState<SurveyWave[]>([]);
  const [metrics, setMetrics] = React.useState<LongitudinalProjectMetrics | null>(null);
  const [questionDeltas, setQuestionDeltas] = React.useState<WaveDeltaComparison[]>([]);
  const [thematicDrift, setThematicDrift] = React.useState<ThematicDriftItem[]>([]);

  // Wave Creation Modal
  const [isAddWaveOpen, setIsAddWaveOpen] = React.useState(false);
  const [newWaveTitle, setNewWaveTitle] = React.useState('');
  const [selectedSurveyId, setSelectedSurveyId] = React.useState('');
  const [respondentGoal, setRespondentGoal] = React.useState('100');
  const [availableSurveys, setAvailableSurveys] = React.useState<Array<{ id: string; title: string }>>([]);
  const [isSubmittingWave, setIsSubmittingWave] = React.useState(false);

  const fetchAnalytics = React.useCallback(async () => {
    if (!projectId || !workspaceId) return;
    setIsLoading(true);
    try {
      const res = await getProjectLongitudinalAnalyticsAction(projectId, workspaceId);
      if (res.success) {
        setProject(res.project || null);
        setWaves(res.waves || []);
        setMetrics(res.metrics || null);
        setQuestionDeltas(res.questionDeltas || []);
        setThematicDrift(res.thematicDrift || []);
      } else {
        toast({
          variant: 'destructive',
          title: 'Analytics Error',
          description: res.error || 'Failed to load longitudinal study analytics',
        });
      }
    } catch (err) {
      console.error('[LongitudinalStudyView] fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, workspaceId, toast]);

  React.useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const loadAvailableSurveys = async () => {
    try {
      const res = await getWorkspaceActiveSurveysAction(workspaceId);
      if (res.success && res.surveys) {
        setAvailableSurveys(res.surveys.map((s) => ({ id: s.id, title: s.title })));
      }
    } catch (err) {
      console.error('[LongitudinalStudyView] survey load error:', err);
    }
  };

  const handleOpenAddWave = () => {
    loadAvailableSurveys();
    setNewWaveTitle(`Wave ${waves.length + 1}`);
    setIsAddWaveOpen(true);
  };

  const handleCreateWave = async () => {
    if (!selectedSurveyId) {
      toast({
        variant: 'destructive',
        title: 'Survey Required',
        description: 'Please select a survey to link to this wave.',
      });
      return;
    }

    setIsSubmittingWave(true);
    try {
      const res = await createSurveyWaveAction(
        projectId,
        {
          title: newWaveTitle || `Wave ${waves.length + 1}`,
          surveyId: selectedSurveyId,
          respondentGoal: Number(respondentGoal) || 100,
        },
        workspaceId
      );

      if (res.success) {
        toast({
          title: 'Study Wave Created',
          description: 'New wave added to this longitudinal research project.',
        });
        setIsAddWaveOpen(false);
        fetchAnalytics();
      } else {
        toast({
          variant: 'destructive',
          title: 'Creation Failed',
          description: res.error || 'Could not create wave',
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'An unexpected error occurred while creating wave',
      });
    } finally {
      setIsSubmittingWave(false);
    }
  };

  const handleConcludeWave = async (waveId: string) => {
    try {
      const res = await concludeSurveyWaveAction(projectId, waveId, workspaceId);
      if (res.success) {
        toast({
          title: 'Wave Concluded',
          description: 'The study wave metrics have been finalized.',
        });
        fetchAnalytics();
      }
    } catch (err) {
      console.error('[LongitudinalStudyView] conclude error:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-semibold text-muted-foreground">Calculating Longitudinal Analytics & Cohorts...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 1. Header & KPI Ribbons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-border bg-card shadow-sm p-5 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Waves</span>
            <Layers className="h-4 w-4 text-blue-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-foreground">{metrics?.totalWaves || waves.length || 0}</span>
            <Badge variant="outline" className="text-[10px] font-mono">
              Active: W{metrics?.activeWaveNumber || 1}
            </Badge>
          </div>
        </Card>

        <Card className="rounded-2xl border-border bg-card shadow-sm p-5 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Submissions</span>
            <BarChart3 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-foreground">{metrics?.totalResponses || 0}</span>
            <span className="text-xs text-muted-foreground">across all waves</span>
          </div>
        </Card>

        <Card className="rounded-2xl border-border bg-card shadow-sm p-5 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Cohort Retention Rate</span>
            <Users className="h-4 w-4 text-purple-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-purple-600">{metrics?.longitudinalRetentionRate ?? 0}%</span>
            <span className="text-xs text-muted-foreground">re-participating</span>
          </div>
        </Card>

        <Card className="rounded-2xl border-border bg-card shadow-sm p-5 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Score Progression</span>
            <TrendingUp className="h-4 w-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-foreground">
              {metrics?.compositeScoreProgression && metrics.compositeScoreProgression.length > 0
                ? `${metrics.compositeScoreProgression[metrics.compositeScoreProgression.length - 1].averageScore}%`
                : 'N/A'}
            </span>
            <span className="text-xs text-emerald-600 font-semibold flex items-center">
              <TrendingUp className="h-3 w-3 mr-0.5 inline" /> Baseline &rarr; Current
            </span>
          </div>
        </Card>
      </div>

      {/* 2. Wave Progression Roadmap */}
      <Card className="rounded-2xl border-border bg-card shadow-sm overflow-hidden">
        <CardHeader className="pb-4 border-b border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              Multi-Wave Study Roadmap & Progress
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Sequential research waves tracking the same target population across time.
            </CardDescription>
          </div>
          <Button
            size="sm"
            onClick={handleOpenAddWave}
            className="h-9 px-4 gap-1.5 text-xs font-semibold active:scale-[0.97]"
          >
            <Plus className="h-4 w-4" />
            Launch Next Wave
          </Button>
        </CardHeader>

        <CardContent className="p-6">
          {waves.length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <p className="text-sm font-bold text-foreground">No Study Waves Configured</p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Launch Wave 1 to establish baseline metrics for this longitudinal research project.
              </p>
              <Button size="sm" onClick={handleOpenAddWave} className="h-9 px-4 gap-1.5 text-xs font-semibold">
                <Plus className="h-4 w-4" />
                Create Baseline Wave 1
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {metrics?.compositeScoreProgression?.map((point, index) => (
                <div
                  key={point.waveId}
                  className={cn(
                    'p-5 rounded-2xl border transition-all space-y-4',
                    index === (metrics?.compositeScoreProgression?.length ?? 0) - 1
                      ? 'border-primary/50 bg-primary/5 shadow-sm'
                      : 'border-border bg-card'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <Badge
                      variant={index === 0 ? 'secondary' : 'default'}
                      className="text-xs font-bold uppercase tracking-wider"
                    >
                      {index === 0 ? 'Baseline (Wave 1)' : point.title}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {point.date ? format(new Date(point.date), 'MMM yyyy') : 'Scheduled'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground">Avg Satisfaction</span>
                      <p className="text-xl font-black text-foreground">{point.averageScore}%</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground">NPS Score</span>
                      <p
                        className={cn(
                          'text-xl font-black',
                          point.npsScore >= 50
                            ? 'text-emerald-600'
                            : point.npsScore >= 0
                            ? 'text-amber-600'
                            : 'text-rose-600'
                        )}
                      >
                        {point.npsScore > 0 ? `+${point.npsScore}` : point.npsScore}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/50">
                    <span>{point.responsesCount} Submissions</span>
                    {index === (metrics?.compositeScoreProgression?.length ?? 0) - 1 && (
                      <Badge variant="outline" className="text-[10px] font-semibold text-primary border-primary/30">
                        Current Wave
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Question-by-Question Wave Delta Matrix */}
      {questionDeltas.length > 0 && (
        <Card className="rounded-2xl border-border bg-card shadow-sm overflow-hidden">
          <CardHeader className="pb-4 border-b border-border/60">
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <BrainCircuit className="h-5 w-5 text-purple-600" />
              Question-by-Question Wave Delta & Statistical Significance
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Comparing question score movements between Baseline Wave and the Latest Wave ($p &lt; 0.05$ threshold).
            </CardDescription>
          </CardHeader>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs font-bold uppercase">Question & Archetype</TableHead>
                  <TableHead className="text-xs font-bold uppercase text-center">Baseline (W1)</TableHead>
                  <TableHead className="text-xs font-bold uppercase text-center">Current Wave</TableHead>
                  <TableHead className="text-xs font-bold uppercase text-center">Delta Movement</TableHead>
                  <TableHead className="text-xs font-bold uppercase text-right">Statistical Significance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {questionDeltas.map((delta) => {
                  const isPositive = delta.absoluteDelta > 0;
                  const isNegative = delta.absoluteDelta < 0;

                  return (
                    <TableRow key={delta.questionId} className="hover:bg-muted/20">
                      <TableCell className="max-w-md py-4">
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-foreground line-clamp-2">{delta.questionTitle}</p>
                          <Badge variant="outline" className="text-[10px] font-mono capitalize">
                            {delta.questionType}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-bold text-xs">
                        {delta.baselineScore}
                        <span className="text-[10px] text-muted-foreground block font-normal">
                          (N={delta.baselineResponsesCount})
                        </span>
                      </TableCell>
                      <TableCell className="text-center font-bold text-xs">
                        {delta.currentWaveScore}
                        <span className="text-[10px] text-muted-foreground block font-normal">
                          (N={delta.currentResponsesCount})
                        </span>
                      </TableCell>
                      <TableCell className="text-center font-bold text-xs">
                        <div className="flex items-center justify-center gap-1">
                          {isPositive ? (
                            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                          ) : isNegative ? (
                            <TrendingDown className="h-3.5 w-3.5 text-rose-500" />
                          ) : (
                            <Minus className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                          <span
                            className={cn(
                              isPositive ? 'text-emerald-600' : isNegative ? 'text-rose-600' : 'text-muted-foreground'
                            )}
                          >
                            {delta.absoluteDelta > 0 ? `+${delta.absoluteDelta}` : delta.absoluteDelta} ({delta.percentageDelta > 0 ? `+${delta.percentageDelta}` : delta.percentageDelta}%)
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {delta.isStatisticallySignificant ? (
                          <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 text-[10px] font-semibold border-emerald-300">
                            Significant (p &lt; {delta.pValue || 0.05})
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground font-normal">
                            Directional (p = {delta.pValue || '1.0'})
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* 4. Qualitative Thematic Drift Tracking */}
      {thematicDrift.length > 0 && (
        <Card className="rounded-2xl border-border bg-card shadow-sm overflow-hidden">
          <CardHeader className="pb-4 border-b border-border/60">
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              Longitudinal Thematic Drift (Evolving Topics Across Waves)
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Qualitative themes analyzed by Genkit NLP tracking frequency drift and sentiment evolution.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {thematicDrift.map((theme, idx) => (
                <div key={idx} className="p-4 rounded-xl border border-border bg-card space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">{theme.themeLabel}</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px] font-semibold capitalize',
                        theme.driftDirection === 'growing'
                          ? 'text-emerald-600 border-emerald-300'
                          : theme.driftDirection === 'declining'
                          ? 'text-amber-600 border-amber-300'
                          : 'text-muted-foreground'
                      )}
                    >
                      {theme.driftDirection}
                    </Badge>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>Baseline Frequency: {theme.baselinePrevalence}%</span>
                      <span className="font-bold text-foreground">Current: {theme.currentPrevalence}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden flex">
                      <div className="bg-primary/40 h-full" style={{ width: `${theme.baselinePrevalence}%` }} />
                      <div className="bg-primary h-full" style={{ width: `${Math.max(0, theme.currentPrevalence - theme.baselinePrevalence)}%` }} />
                    </div>
                  </div>

                  <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-1">
                    <span>Sentiment Shift:</span>
                    <span
                      className={cn(
                        'font-bold',
                        theme.sentimentShift > 0 ? 'text-emerald-600' : 'text-rose-600'
                      )}
                    >
                      {theme.sentimentShift > 0 ? `+${theme.sentimentShift}%` : `${theme.sentimentShift}%`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 5. Create Next Wave Modal */}
      <Dialog open={isAddWaveOpen} onOpenChange={setIsAddWaveOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">Launch Next Study Wave</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Add a sequential wave to continue tracking longitudinal sentiment over time.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Wave Title</Label>
              <Input
                value={newWaveTitle}
                onChange={(e) => setNewWaveTitle(e.target.value)}
                placeholder="e.g. Wave 2 (Q3 Check-in)"
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Linked Survey Instrument</Label>
              <Select value={selectedSurveyId} onValueChange={setSelectedSurveyId}>
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Select survey..." />
                </SelectTrigger>
                <SelectContent>
                  {availableSurveys.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-xs">
                      {s.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Target Respondent Goal</Label>
              <Input
                type="number"
                value={respondentGoal}
                onChange={(e) => setRespondentGoal(e.target.value)}
                placeholder="100"
                className="h-9 text-xs rounded-xl"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddWaveOpen(false)}
              className="h-9 px-4 text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleCreateWave}
              disabled={isSubmittingWave}
              className="h-9 px-4 text-xs font-semibold active:scale-[0.97]"
            >
              {isSubmittingWave && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Launch Wave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
