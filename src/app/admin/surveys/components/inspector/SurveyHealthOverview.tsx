'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Survey Health & Architecture Overview Hub
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Default view in the right inspector when no specific block is selected.
 * 2. Displays:
 *    - Live Architecture Metrics: Total questions, sections, logic nodes, est. completion time.
 *    - Logic Graph Health: Runs pure validateSurveyLogicGraph for cycle and reachability checks.
 *    - 1-Click Launchers for Visual Logic Studio, AI Quality Auditor, and Question Bank.
 * 3. Strict Zero-Any Invariant.
 * 4. Touch targets >= 44px with active:scale-[0.97] tactile compression.
 */

import * as React from 'react';
import {
  Activity,
  Layers,
  Split,
  Clock,
  Sparkles,
  Library,
  History,
  CheckCircle2,
  AlertTriangle,
  FileQuestion,
  Award,
  Plus,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn, stripHtml } from '@/lib/utils';
import { validateSurveyLogicGraph, type LogicValidationResult } from '@/lib/surveys/survey-logic-graph';
import type { SurveyElement, SurveyQuestion, SurveyLayoutBlock, SurveyLogicBlock } from '@/lib/types';

interface SurveyHealthOverviewProps {
  elements: SurveyElement[];
  surveyTitle?: string;
  currentVersionNumber?: number;
  onOpenLogicStudio?: () => void;
  onOpenQualityAuditor?: () => void;
  onOpenQuestionBank?: () => void;
  onOpenVersionHistory?: () => void;
  onAddQuestion?: (type?: SurveyQuestion['type']) => void;
}

export function SurveyHealthOverview({
  elements,
  surveyTitle = 'Survey',
  currentVersionNumber = 1,
  onOpenLogicStudio,
  onOpenQualityAuditor,
  onOpenQuestionBank,
  onOpenVersionHistory,
  onAddQuestion,
}: SurveyHealthOverviewProps) {
  // 1. Metric Calculations
  const questions = React.useMemo(
    () =>
      elements.filter(
        (el) =>
          !['heading', 'description', 'divider', 'image', 'video', 'section', 'logic'].includes(el.type)
      ) as SurveyQuestion[],
    [elements]
  );

  const sections = React.useMemo(
    () => elements.filter((el) => el.type === 'section') as SurveyLayoutBlock[],
    [elements]
  );

  const logicBlocks = React.useMemo(
    () => elements.filter((el) => el.type === 'logic') as SurveyLogicBlock[],
    [elements]
  );

  const requiredCount = React.useMemo(
    () => questions.filter((q) => q.isRequired).length,
    [questions]
  );

  const totalPoints = React.useMemo(() => {
    return questions.reduce((sum, q) => {
      if (q.enableScoring && q.points) return sum + q.points;
      return sum;
    }, 0);
  }, [questions]);

  // Estimate completion time (~15s per standard question, ~30s for open/matrix)
  const estMinutes = React.useMemo(() => {
    if (questions.length === 0) return 0;
    const totalSeconds = questions.reduce((acc, q) => {
      if (['long-text', 'matrix', 'ranking'].includes(q.type)) return acc + 30;
      return acc + 15;
    }, 15);
    return Math.max(1, Math.round((totalSeconds / 60) * 10) / 10);
  }, [questions]);

  // 2. Logic Graph Health Validation
  const logicValidation: LogicValidationResult = React.useMemo(() => {
    return validateSurveyLogicGraph(elements);
  }, [elements]);

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 space-y-5 select-none animate-in fade-in duration-300">
      {/* Header Hub Title */}
      <div className="flex items-center justify-between pb-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-primary/10 rounded-xl text-primary shrink-0">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Survey Architecture
            </h3>
            <p className="text-[10px] text-muted-foreground truncate max-w-[180px]">
              {stripHtml(surveyTitle)}
            </p>
          </div>
        </div>

        <Badge variant="outline" className="text-[9px] font-mono font-bold bg-primary/5 text-primary border-primary/20">
          v{currentVersionNumber}
        </Badge>
      </div>

      {/* 4-Metric Grid */}
      <div className="grid grid-cols-2 gap-2">
        <Card className="rounded-xl border border-border/60 bg-muted/20 p-2.5 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-medium">Questions</span>
            <FileQuestion className="h-3.5 w-3.5 text-blue-500" />
          </div>
          <div className="text-lg font-extrabold text-foreground">{questions.length}</div>
          <span className="text-[9px] text-muted-foreground block truncate">
            {requiredCount} required
          </span>
        </Card>

        <Card className="rounded-xl border border-border/60 bg-muted/20 p-2.5 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-medium">Est. Duration</span>
            <Clock className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <div className="text-lg font-extrabold text-foreground">~{estMinutes}m</div>
          <span className="text-[9px] text-muted-foreground block truncate">
            {questions.length > 8 ? 'Moderate pace' : 'Fast completion'}
          </span>
        </Card>

        <Card className="rounded-xl border border-border/60 bg-muted/20 p-2.5 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-medium">Sections</span>
            <Layers className="h-3.5 w-3.5 text-purple-500" />
          </div>
          <div className="text-lg font-extrabold text-foreground">{sections.length}</div>
          <span className="text-[9px] text-muted-foreground block truncate">
            {sections.length > 1 ? 'Multi-page' : 'Single flow'}
          </span>
        </Card>

        <Card className="rounded-xl border border-border/60 bg-muted/20 p-2.5 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-medium">Logic Nodes</span>
            <Split className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <div className="text-lg font-extrabold text-foreground">{logicBlocks.length}</div>
          <span className="text-[9px] text-muted-foreground block truncate">
            {logicValidation.isValid ? 'Valid branching' : 'Needs review'}
          </span>
        </Card>
      </div>

      {/* Logic & Quality Health Status Banner */}
      <div className="space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Health & Diagnostics
        </span>

        {logicValidation.isValid ? (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 flex items-start gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
            <div className="space-y-0.5 text-xs">
              <span className="font-bold block">Logic Graph Intact</span>
              <p className="text-[11px] opacity-80 leading-tight">
                No circular loops or broken branch targets detected.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div className="space-y-0.5 text-xs">
                <span className="font-bold block">Logic Attention Required</span>
                <p className="text-[11px] opacity-90 leading-tight">
                  {logicValidation.errors[0]?.message || 'Review branching rules in Logic Studio.'}
                </p>
              </div>
            </div>
            {onOpenLogicStudio && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onOpenLogicStudio}
                className="w-full h-7 text-[10px] font-bold rounded-lg border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 active:scale-[0.97]"
              >
                Open Logic Studio
              </Button>
            )}
          </div>
        )}

        {totalPoints > 0 && (
          <div className="p-2.5 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-primary" />
              <span className="font-semibold text-foreground">Scoring Enabled</span>
            </div>
            <Badge variant="secondary" className="font-mono text-[10px]">
              {totalPoints} pts total
            </Badge>
          </div>
        )}
      </div>

      <Separator className="bg-border/60" />

      {/* Quick Launchers */}
      <div className="space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Studio Launchers
        </span>

        <div className="space-y-1.5">
          {onOpenQualityAuditor && (
            <Button
              type="button"
              variant="outline"
              onClick={onOpenQualityAuditor}
              className="w-full h-11 justify-between rounded-xl px-3 bg-card hover:bg-primary/5 hover:border-primary/40 transition-all active:scale-[0.97] group"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-primary/10 text-primary group-hover:scale-105 transition-transform">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="text-left">
                  <span className="text-xs font-bold text-foreground block">AI Quality Auditor</span>
                  <span className="text-[10px] text-muted-foreground block">
                    Pre-publish clarity & fatigue audit
                  </span>
                </div>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
            </Button>
          )}

          {onOpenLogicStudio && (
            <Button
              type="button"
              variant="outline"
              onClick={onOpenLogicStudio}
              className="w-full h-11 justify-between rounded-xl px-3 bg-card hover:bg-amber-500/5 hover:border-amber-500/40 transition-all active:scale-[0.97] group"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 group-hover:scale-105 transition-transform">
                  <Split className="h-4 w-4" />
                </div>
                <div className="text-left">
                  <span className="text-xs font-bold text-foreground block">Visual Logic Studio</span>
                  <span className="text-[10px] text-muted-foreground block">
                    Conditional branching & skips
                  </span>
                </div>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-amber-600 transition-colors" />
            </Button>
          )}

          {onOpenQuestionBank && (
            <Button
              type="button"
              variant="outline"
              onClick={onOpenQuestionBank}
              className="w-full h-11 justify-between rounded-xl px-3 bg-card hover:bg-muted/60 transition-all active:scale-[0.97] group"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-muted text-muted-foreground group-hover:scale-105 transition-transform">
                  <Library className="h-4 w-4" />
                </div>
                <div className="text-left">
                  <span className="text-xs font-bold text-foreground block">Question Library Bank</span>
                  <span className="text-[10px] text-muted-foreground block">
                    Standardized templates & blocks
                  </span>
                </div>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
            </Button>
          )}

          {onOpenVersionHistory && (
            <Button
              type="button"
              variant="outline"
              onClick={onOpenVersionHistory}
              className="w-full h-11 justify-between rounded-xl px-3 bg-card hover:bg-muted/60 transition-all active:scale-[0.97] group"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-muted text-muted-foreground group-hover:scale-105 transition-transform">
                  <History className="h-4 w-4" />
                </div>
                <div className="text-left">
                  <span className="text-xs font-bold text-foreground block">Version History</span>
                  <span className="text-[10px] text-muted-foreground block">
                    Snapshots & publication log
                  </span>
                </div>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
            </Button>
          )}
        </div>
      </div>

      {/* Direct Add Prompt */}
      {onAddQuestion && (
        <div className="pt-2">
          <Button
            type="button"
            onClick={() => onAddQuestion('multiple-choice')}
            className="w-full h-10 rounded-xl font-bold text-xs gap-1.5 shadow-sm active:scale-[0.97]"
          >
            <Plus className="h-4 w-4" />
            <span>Add New Question</span>
          </Button>
        </div>
      )}
    </div>
  );
}
