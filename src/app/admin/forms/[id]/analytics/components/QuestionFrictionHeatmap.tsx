'use client';

/**
 * SmartSapp Forms 2.0: Question Friction & Drop-Off Heatmap
 * 
 * Provides field-level analytics displaying completion rate, drop-off rate,
 * average dwell time, and AI-assessed friction status for each question.
 */

import React, { useState } from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  HelpCircle, 
  Clock, 
  Search, 
  Flame, 
  Sparkles,
  ArrowUpDown
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { QuestionFrictionMetric } from '@/lib/forms/form-analytics-types';

interface QuestionFrictionHeatmapProps {
  questions: QuestionFrictionMetric[];
}

export default function QuestionFrictionHeatmap({ questions = [] }: QuestionFrictionHeatmapProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'dropOff' | 'dwell' | 'completions'>('dropOff');

  const filtered = questions.filter(q => 
    q.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.variableName.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => {
    if (sortBy === 'dropOff') return b.dropOffRate - a.dropOffRate;
    if (sortBy === 'dwell') return b.avgDwellSeconds - a.avgDwellSeconds;
    return b.completions - a.completions;
  });

  return (
    <Card className="rounded-3xl border border-border/60 shadow-sm overflow-hidden">
      <CardHeader className="bg-muted/10 border-b border-border/40 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Flame className="h-4 w-4 text-rose-500" />
              Question Friction & Drop-Off Heatmap
            </CardTitle>
            <CardDescription className="text-xs">
              Identify high-abandonment questions and dwell time bottlenecks across your form.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-48">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search questions..."
                className="h-8 pl-8 text-xs rounded-xl bg-background"
              />
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/5">
              <TableRow className="border-border/40 text-[11px] font-bold uppercase tracking-wider">
                <TableHead className="w-[300px]">Question & Variable</TableHead>
                <TableHead className="text-right">Completions</TableHead>
                <TableHead className="text-right">Drop-Offs</TableHead>
                <TableHead className="text-right">Drop-Off %</TableHead>
                <TableHead className="text-right">Avg. Dwell</TableHead>
                <TableHead className="text-center">Friction Assessment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border/30">
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-xs text-muted-foreground">
                    No questions found matching search criteria.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((q) => {
                  const isHigh = q.status === 'high_friction';
                  const isMod = q.status === 'moderate';

                  return (
                    <TableRow key={q.fieldId} className="hover:bg-muted/20 transition-colors">
                      <TableCell className="font-medium text-xs">
                        <div className="space-y-0.5">
                          <span className="font-bold text-foreground block">{q.label}</span>
                          <code className="text-[10px] text-muted-foreground font-mono">
                            {`{{${q.variableName}}}`} • <span className="uppercase text-[9px]">{q.type}</span>
                          </code>
                        </div>
                        {q.recommendation && (
                          <div className="mt-1.5 flex items-start gap-1 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg">
                            <Sparkles className="h-3 w-3 shrink-0 mt-0.5" />
                            <span>{q.recommendation}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs font-semibold">
                        {q.completions.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-xs font-semibold text-rose-500">
                        {q.dropOffs.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        <span className={cn(
                          "font-bold px-1.5 py-0.5 rounded-md",
                          isHigh ? "bg-rose-500/10 text-rose-600" : isMod ? "bg-amber-500/10 text-amber-600" : "text-foreground"
                        )}>
                          {q.dropOffRate}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-xs font-semibold">
                        {q.avgDwellSeconds}s
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider",
                            isHigh && "bg-rose-500/10 text-rose-600 border-rose-500/20",
                            isMod && "bg-amber-500/10 text-amber-600 border-amber-500/20",
                            !isHigh && !isMod && "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                          )}
                        >
                          {isHigh ? 'High Friction' : isMod ? 'Moderate' : 'Optimal'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
