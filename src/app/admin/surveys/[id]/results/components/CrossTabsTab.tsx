'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — 2D Cross-Tabulation Matrix Tab
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. 2D Contingency Matrix with Chi-Square (χ²) Statistical Independence Test.
 * 2. Visual heatmap gradient dynamically reflecting cell distribution weights.
 * 3. Mobile-first touch optimization (min-h-[44px], active:scale-[0.97]).
 * 4. Strict Zero-Any Invariant.
 */

import * as React from 'react';
import type { Survey, SurveyResponse, SurveyQuestion } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { computeCrossTabulation, type CrossTabMatrixResult } from '@/lib/surveys/survey-analytics-engine';
import { Table, Sparkles, SlidersHorizontal, BarChart3, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CrossTabsTabProps {
  survey: Survey;
  responses: SurveyResponse[];
}

export function CrossTabsTab({ survey, responses }: CrossTabsTabProps) {
  // Eligible categorical and discrete questions for Cross-Tabulation
  const eligibleQuestions = React.useMemo(() => {
    return (survey.elements || []).filter(
      (e): e is SurveyQuestion =>
        'isRequired' in e &&
        'type' in e &&
        ['single_choice', 'single-choice', 'multiple_choice', 'multiple-choice', 'dropdown', 'rating', 'nps', 'ces', 'boolean', 'yes-no', 'checkboxes'].includes(e.type)
    );
  }, [survey.elements]);

  const [rowQId, setRowQId] = React.useState<string>(eligibleQuestions[0]?.id || '');
  const [colQId, setColQId] = React.useState<string>(eligibleQuestions[1]?.id || eligibleQuestions[0]?.id || '');
  const [displayMode, setDisplayMode] = React.useState<'count' | 'rowPct' | 'colPct' | 'totalPct'>('rowPct');

  const rowQuestion = React.useMemo(() => eligibleQuestions.find((q) => q.id === rowQId), [eligibleQuestions, rowQId]);
  const colQuestion = React.useMemo(() => eligibleQuestions.find((q) => q.id === colQId), [eligibleQuestions, colQId]);

  const crossTabResult = React.useMemo(() => {
    if (!rowQuestion || !colQuestion || responses.length === 0) return null;
    return computeCrossTabulation(responses, rowQuestion, colQuestion);
  }, [responses, rowQuestion, colQuestion]);

  if (eligibleQuestions.length < 2) {
    return (
      <Card className="rounded-2xl border-border bg-card shadow-sm p-8 text-center">
        <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <CardTitle className="text-sm font-bold">Insufficient Categorical Questions</CardTitle>
        <CardDescription className="text-xs text-muted-foreground mt-1">
          Cross-tabulation requires at least two choice, rating, NPS, or CES questions in your survey blueprint.
        </CardDescription>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dimension Selector Card */}
      <Card className="rounded-2xl border-border bg-card shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Table className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold">2D Cross-Tabulation Matrix</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Compare responses to one question against another to discover demographic and behavioral patterns.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Row Dimension (Question A)</Label>
              <Select value={rowQId} onValueChange={setRowQId}>
                <SelectTrigger className="h-11 rounded-xl text-xs">
                  <SelectValue placeholder="Select row question" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleQuestions.map((q) => (
                    <SelectItem key={q.id} value={q.id} className="text-xs">
                      {q.title || q.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Column Dimension (Question B)</Label>
              <Select value={colQId} onValueChange={setColQId}>
                <SelectTrigger className="h-11 rounded-xl text-xs">
                  <SelectValue placeholder="Select column question" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleQuestions.map((q) => (
                    <SelectItem key={q.id} value={q.id} className="text-xs">
                      {q.title || q.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border/50 flex-wrap gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Display Metric:</span>
            <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl">
              {[
                { id: 'rowPct', label: 'Row %' },
                { id: 'colPct', label: 'Column %' },
                { id: 'totalPct', label: 'Total %' },
                { id: 'count', label: 'Counts' },
              ].map((m) => (
                <Button
                  key={m.id}
                  type="button"
                  variant={displayMode === m.id ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setDisplayMode(m.id as typeof displayMode)}
                  className="h-8 px-3 rounded-lg text-xs font-semibold active:scale-[0.97]"
                >
                  {m.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contingency Matrix Table */}
      {crossTabResult && (
        <Card className="rounded-2xl border-border bg-card shadow-sm overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/50 bg-muted/20 flex flex-row items-center justify-between">
            <div className="space-y-0.5">
              <CardTitle className="text-sm font-bold text-foreground">
                {crossTabResult.rowQuestionTitle} <span className="text-muted-foreground font-normal">by</span> {crossTabResult.colQuestionTitle}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Sample size: {crossTabResult.grandTotal} joint responses
              </CardDescription>
            </div>

            <Badge
              variant="outline"
              className={
                crossTabResult.isSignificant
                  ? 'bg-purple-500/10 text-purple-600 border-purple-500/30 font-bold text-xs'
                  : 'bg-muted text-muted-foreground text-xs'
              }
            >
              <Sparkles className="h-3 w-3 mr-1" />
              Chi-Square χ² = {crossTabResult.chiSquare} {crossTabResult.isSignificant ? '(p < 0.05 Significant)' : '(p ≥ 0.05)'}
            </Badge>
          </CardHeader>

          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse min-w-[500px]">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-muted-foreground">
                  <th className="py-3 px-4 font-bold text-foreground sticky left-0 bg-muted/90 backdrop-blur-sm z-10">
                    {crossTabResult.rowQuestionTitle}
                  </th>
                  {crossTabResult.colLabels.map((colLabel, cIdx) => (
                    <th key={cIdx} className="py-3 px-4 font-bold text-center">
                      {colLabel}
                    </th>
                  ))}
                  <th className="py-3 px-4 font-bold text-right bg-muted/40">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {crossTabResult.rowLabels.map((rowLabel, rIdx) => (
                  <tr key={rIdx} className="hover:bg-muted/20">
                    <td className="py-3 px-4 font-semibold text-foreground sticky left-0 bg-card/95 backdrop-blur-sm z-10">
                      {rowLabel}
                    </td>
                    {crossTabResult.matrix[rIdx].map((count, cIdx) => {
                      let cellDisplay = String(count);
                      let pct = crossTabResult.rowPercentages[rIdx][cIdx];
                      if (displayMode === 'rowPct') cellDisplay = `${crossTabResult.rowPercentages[rIdx][cIdx]}%`;
                      else if (displayMode === 'colPct') cellDisplay = `${crossTabResult.colPercentages[rIdx][cIdx]}%`;
                      else if (displayMode === 'totalPct') cellDisplay = `${crossTabResult.totalPercentages[rIdx][cIdx]}%`;

                      const opacity = Math.min(0.8, Math.max(0.05, pct / 100));

                      return (
                        <td
                          key={cIdx}
                          className="py-3 px-4 text-center font-mono font-bold text-foreground transition-all"
                          style={{ backgroundColor: `rgba(59, 130, 246, ${opacity})` }}
                        >
                          <span>{cellDisplay}</span>
                          {displayMode !== 'count' && (
                            <span className="text-[10px] text-muted-foreground/80 block font-normal font-sans">
                              (n={count})
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="py-3 px-4 text-right font-mono font-bold bg-muted/20">
                      {crossTabResult.rowTotals[rIdx]}
                    </td>
                  </tr>
                ))}
                {/* Column Totals Row */}
                <tr className="border-t-2 border-border font-bold bg-muted/30">
                  <td className="py-3 px-4 text-foreground sticky left-0 bg-muted/90 backdrop-blur-sm z-10">
                    Total
                  </td>
                  {crossTabResult.colTotals.map((colTotal, cIdx) => (
                    <td key={cIdx} className="py-3 px-4 text-center font-mono">
                      {colTotal}
                    </td>
                  ))}
                  <td className="py-3 px-4 text-right font-mono text-primary font-extrabold">
                    {crossTabResult.grandTotal}
                  </td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
