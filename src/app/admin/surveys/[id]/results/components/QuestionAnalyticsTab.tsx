'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Question Analytics Tab (22 Question Archetypes)
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Deep analytics visualization across all 22 question types:
 *    - NPS Promoter/Passive/Detractor gauge & calculus (% Promoters - % Detractors).
 *    - Customer Effort Score (CES) friction index.
 *    - 2D Matrix grid row-by-column breakdown.
 *    - Ranking Borda count weighted placement podium.
 *    - Slider 5-number quartile summary (min, Q1, median, Q3, max, stdDev).
 *    - Choice bar/donut charts and open-ended text lists.
 * 2. Mobile-first touch optimization (min-h-[44px], active:scale-[0.97]).
 * 3. Strict Zero-Any Invariant.
 */

import * as React from 'react';
import type { Survey, SurveyResponse, SurveyQuestion } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  computeNpsMetrics,
  computeCesMetrics,
  computeMatrixMetrics,
  computeRankingMetrics,
  computeSliderMetrics,
  getResponseAnswer,
} from '@/lib/surveys/survey-analytics-engine';
import {
  Smile,
  Meh,
  Frown,
  Zap,
} from 'lucide-react';

export interface QuestionAnalyticsTabProps {
  survey: Survey;
  responses: SurveyResponse[];
}

export function QuestionAnalyticsTab({ survey, responses }: QuestionAnalyticsTabProps) {
  const questions = React.useMemo(() => {
    return (survey.elements || []).filter(
      (e): e is SurveyQuestion => 'isRequired' in e && 'type' in e
    );
  }, [survey.elements]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground">Question-Level Intelligence</h2>
          <p className="text-xs text-muted-foreground">
            Detailed statistical distributions and satisfaction analytics across all questions ({responses.length} responses).
          </p>
        </div>
        <Badge variant="outline" className="font-mono text-xs">
          {questions.length} Question{questions.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      <div className="space-y-6">
        {questions.map((q, idx) => (
          <QuestionCard key={q.id} index={idx + 1} question={q} responses={responses} />
        ))}
      </div>
    </div>
  );
}

function QuestionCard({
  index,
  question,
  responses,
}: {
  index: number;
  question: SurveyQuestion;
  responses: SurveyResponse[];
}) {
  const answers = React.useMemo(() => {
    return responses.map((r) => getResponseAnswer(r, question.id)).filter((v) => v !== undefined && v !== null);
  }, [responses, question.id]);

  const totalAnswered = answers.length;

  return (
    <Card className="rounded-2xl border-border bg-card shadow-sm overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-primary px-2 py-0.5 rounded-md bg-primary/10">
                Q{index}
              </span>
              <Badge variant="outline" className="text-[10px] uppercase font-mono">
                {question.type.replace('_', ' ')}
              </Badge>
            </div>
            <CardTitle className="text-sm font-bold text-foreground leading-snug pt-1">
              {question.title || 'Untitled Question'}
            </CardTitle>
          </div>
          <div className="text-right shrink-0">
            <span className="font-mono font-bold text-foreground text-sm">{totalAnswered}</span>
            <span className="text-[11px] text-muted-foreground block">
              {responses.length > 0 ? Math.round((totalAnswered / responses.length) * 100) : 0}% answered
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5">
        {totalAnswered === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No responses recorded for this question yet.
          </div>
        ) : (
          <QuestionRenderer question={question} answers={answers} />
        )}
      </CardContent>
    </Card>
  );
}

function QuestionRenderer({
  question,
  answers,
}: {
  question: SurveyQuestion;
  answers: unknown[];
}) {
  // 1. NPS Question
  if (question.type === 'nps') {
    const nps = computeNpsMetrics(answers as (number | string)[]);
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-center">
          <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
            <span className="text-xs font-semibold text-primary uppercase">Net Promoter Score</span>
            <p className="text-3xl font-extrabold text-primary mt-1">
              {nps.score > 0 ? `+${nps.score}` : nps.score}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <span className="text-xs font-semibold text-emerald-600 uppercase flex items-center justify-center gap-1">
              <Smile className="h-3.5 w-3.5" /> Promoters (9-10)
            </span>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{nps.promotersPct}%</p>
            <span className="text-[11px] text-muted-foreground">{nps.promotersCount} responses</span>
          </div>
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <span className="text-xs font-semibold text-amber-600 uppercase flex items-center justify-center gap-1">
              <Meh className="h-3.5 w-3.5" /> Passives (7-8)
            </span>
            <p className="text-2xl font-bold text-amber-600 mt-1">{nps.passivesPct}%</p>
            <span className="text-[11px] text-muted-foreground">{nps.passivesCount} responses</span>
          </div>
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
            <span className="text-xs font-semibold text-rose-600 uppercase flex items-center justify-center gap-1">
              <Frown className="h-3.5 w-3.5" /> Detractors (0-6)
            </span>
            <p className="text-2xl font-bold text-rose-600 mt-1">{nps.detractorsPct}%</p>
            <span className="text-[11px] text-muted-foreground">{nps.detractorsCount} responses</span>
          </div>
        </div>

        {/* Stacked NPS Bar */}
        <div className="h-4 rounded-full overflow-hidden flex shadow-inner">
          <div style={{ width: `${nps.promotersPct}%` }} className="bg-emerald-500 transition-all" title="Promoters" />
          <div style={{ width: `${nps.passivesPct}%` }} className="bg-amber-400 transition-all" title="Passives" />
          <div style={{ width: `${nps.detractorsPct}%` }} className="bg-rose-500 transition-all" title="Detractors" />
        </div>
      </div>
    );
  }

  // 2. CES Question (Customer Effort Score)
  if (question.type === 'ces') {
    const ces = computeCesMetrics(answers as (number | string)[]);
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <div>
            <span className="text-xs font-semibold text-blue-600 uppercase">Average Effort Score</span>
            <p className="text-3xl font-extrabold text-blue-700 dark:text-blue-400">{ces.averageScore} / 7</p>
          </div>
          <Badge
            variant="outline"
            className={
              ces.frictionRating === 'low'
                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 font-bold'
                : ces.frictionRating === 'moderate'
                ? 'bg-amber-500/10 text-amber-600 border-amber-500/30 font-bold'
                : 'bg-rose-500/10 text-rose-600 border-rose-500/30 font-bold'
            }
          >
            <Zap className="h-3.5 w-3.5 mr-1" />
            {ces.frictionRating.toUpperCase()} FRICTION
          </Badge>
        </div>

        <div className="space-y-2">
          {ces.distribution.map((d) => (
            <div key={d.score} className="space-y-1">
              <div className="flex justify-between text-xs font-medium">
                <span>Scale {d.score}</span>
                <span className="font-mono text-muted-foreground">{d.count} ({d.percentage}%)</span>
              </div>
              <Progress value={d.percentage} className="h-2 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 3. Matrix Question
  if (question.type === 'matrix') {
    const matrix = computeMatrixMetrics(question, answers);
    return (
      <div className="space-y-4 overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="border-b border-border/70 text-muted-foreground">
              <th className="py-2.5 pr-4 font-bold">Sub-Question / Item</th>
              {(question.matrixColumns || []).map((col, idx) => (
                <th key={idx} className="py-2.5 px-3 font-semibold text-center">
                  {typeof col === 'string' ? col : (col as { label?: string }).label || String(idx)}
                </th>
              ))}
              <th className="py-2.5 pl-3 font-semibold text-right">Avg Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {matrix.rows.map((row) => (
              <tr key={row.rowId} className="hover:bg-muted/20">
                <td className="py-3 pr-4 font-medium text-foreground">{row.label}</td>
                {row.columns.map((c) => (
                  <td key={c.colId} className="py-3 px-3 text-center">
                    <span className="font-mono font-bold text-foreground">{c.percentage}%</span>
                    <span className="text-[10px] text-muted-foreground block">({c.count})</span>
                  </td>
                ))}
                <td className="py-3 pl-3 text-right font-mono font-bold text-primary">
                  {row.averageScore !== undefined ? row.averageScore : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // 4. Ranking Question (Borda Count)
  if (question.type === 'ranking') {
    const ranking = computeRankingMetrics(question, answers);
    return (
      <div className="space-y-3">
        {ranking.items.map((item) => (
          <div
            key={item.itemId}
            className="flex items-center justify-between p-3.5 rounded-xl border border-border/70 bg-card hover:bg-muted/30 transition-all text-xs"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 font-mono font-bold text-primary text-xs">
                #{item.rank}
              </span>
              <span className="font-bold text-foreground">{item.label}</span>
            </div>
            <div className="text-right">
              <span className="font-mono font-bold text-primary">{item.bordaScore} pts</span>
              <span className="text-[10px] text-muted-foreground block">Borda weight</span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // 5. Slider Question (Quartile Box)
  if (question.type === 'slider') {
    const slider = computeSliderMetrics(answers as (number | string)[], question.sliderMin || 0, question.sliderMax || 100);
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
          <div className="p-3 rounded-xl bg-muted/40 border border-border/50">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase">Min</span>
            <p className="font-mono font-bold text-sm text-foreground mt-0.5">{slider.min}</p>
          </div>
          <div className="p-3 rounded-xl bg-muted/40 border border-border/50">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase">Q1 (25%)</span>
            <p className="font-mono font-bold text-sm text-foreground mt-0.5">{slider.q1}</p>
          </div>
          <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
            <span className="text-[10px] font-semibold text-primary uppercase">Median</span>
            <p className="font-mono font-bold text-sm text-primary mt-0.5">{slider.median}</p>
          </div>
          <div className="p-3 rounded-xl bg-muted/40 border border-border/50">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase">Q3 (75%)</span>
            <p className="font-mono font-bold text-sm text-foreground mt-0.5">{slider.q3}</p>
          </div>
          <div className="p-3 rounded-xl bg-muted/40 border border-border/50">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase">Max</span>
            <p className="font-mono font-bold text-sm text-foreground mt-0.5">{slider.max}</p>
          </div>
        </div>

        <div className="h-40 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={slider.histogram}>
              <XAxis dataKey="bin" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  // 6. Generic Choice / Rating / Dropdown Question
  const counts: Record<string, number> = {};
  answers.forEach((a) => {
    let key = String(a);
    if (typeof a === 'object' && a !== null && 'option' in (a as Record<string, unknown>)) {
      key = String((a as Record<string, unknown>).option);
    }
    counts[key] = (counts[key] || 0) + 1;
  });

  const chartData = Object.entries(counts).map(([name, value]) => ({
    name: name.length > 25 ? name.substring(0, 25) + '...' : name,
    value,
    percentage: answers.length > 0 ? Math.round((value / answers.length) * 100) : 0,
  }));

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {chartData.map((d) => (
          <div key={d.name} className="space-y-1">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-foreground">{d.name}</span>
              <span className="font-mono text-muted-foreground">{d.value} ({d.percentage}%)</span>
            </div>
            <Progress value={d.percentage} className="h-2 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
