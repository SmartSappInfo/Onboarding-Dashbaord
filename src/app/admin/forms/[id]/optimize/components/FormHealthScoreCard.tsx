'use client';

/**
 * SmartSapp Forms 2.0: 7-Dimensional Form Health Scorecard Component
 * 
 * Displays overall form health gauge (0-100), 7 category progress meters,
 * diagnostic audits, and 1-click AI optimization recommendations.
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  RefreshCw,
  Zap,
  Shield,
  Layers,
  Database,
  BarChart,
  Eye,
  Sliders,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import type { FormHealthScore, FormHealthCategories } from '@/lib/forms/form-optimization-types';
import { computeFormHealthScoreAction } from '@/lib/forms/form-optimization-actions';

interface FormHealthScoreCardProps {
  formId: string;
  initialScore: FormHealthScore;
}

const CATEGORY_ICONS: Record<keyof FormHealthCategories, React.ReactNode> = {
  conversion: <Zap className="h-3.5 w-3.5 text-emerald-500" />,
  ux: <Sliders className="h-3.5 w-3.5 text-primary" />,
  accessibility: <Eye className="h-3.5 w-3.5 text-cyan-500" />,
  logic: <Layers className="h-3.5 w-3.5 text-indigo-500" />,
  crm: <Database className="h-3.5 w-3.5 text-purple-500" />,
  analytics: <BarChart className="h-3.5 w-3.5 text-amber-500" />,
  security: <Shield className="h-3.5 w-3.5 text-rose-500" />,
};

const CATEGORY_LABELS: Record<keyof FormHealthCategories, string> = {
  conversion: 'Conversion Rate',
  ux: 'UX & Step Pacing',
  accessibility: 'Accessibility (a11y)',
  logic: 'Branching & Logic',
  crm: 'CRM Field Mapping',
  analytics: 'Analytics Telemetry',
  security: 'Security & Spam',
};

export default function FormHealthScoreCard({
  formId,
  initialScore,
}: FormHealthScoreCardProps) {
  const { toast } = useToast();
  const [score, setScore] = useState<FormHealthScore>(initialScore);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await computeFormHealthScoreAction({ formId, forceRefresh: true });
      if (res.success && res.healthScore) {
        setScore(res.healthScore);
        toast({ title: 'Health Score Updated', description: 'Recomputed all 7 diagnostic dimensions.' });
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const getScoreColor = (val: number) => {
    if (val >= 85) return 'text-emerald-500';
    if (val >= 70) return 'text-amber-500';
    return 'text-rose-500';
  };

  return (
    <div className="p-6 rounded-3xl bg-card border border-border/60 shadow-xs space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-2xl bg-emerald-500/10 text-emerald-500">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">7-Dimensional Form Health Scorecard</h3>
            <p className="text-[11px] text-muted-foreground">Comprehensive conversion, UX, accessibility, and CRM diagnostic audit</p>
          </div>
        </div>

        <Button
          onClick={handleRefresh}
          disabled={isRefreshing}
          variant="outline"
          size="sm"
          className="rounded-xl h-8 text-xs font-bold gap-1.5 border-border/60 hover:bg-muted min-h-[36px]"
        >
          {isRefreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Re-Audit
        </Button>
      </div>

      {/* Main Score Gauge & Category Progress Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        {/* Central Circular Gauge */}
        <div className="p-6 rounded-2xl bg-muted/20 border border-border/40 text-center space-y-2 flex flex-col items-center justify-center">
          <div className="relative flex items-center justify-center">
            <svg className="w-28 h-28 transform -rotate-90">
              <circle
                cx="56"
                cy="56"
                r="46"
                stroke="currentColor"
                strokeWidth="8"
                className="text-muted"
                fill="transparent"
              />
              <circle
                cx="56"
                cy="56"
                r="46"
                stroke="currentColor"
                strokeWidth="8"
                className={getScoreColor(score.overallScore)}
                fill="transparent"
                strokeDasharray={289}
                strokeDashoffset={289 - (289 * score.overallScore) / 100}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className={`text-3xl font-black ${getScoreColor(score.overallScore)}`}>
                {score.overallScore}
              </span>
              <span className="text-[10px] text-muted-foreground font-bold uppercase">/ 100</span>
            </div>
          </div>

          <Badge
            variant="outline"
            className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 ${
              score.grade === 'excellent'
                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                : score.grade === 'good'
                ? 'bg-primary/10 text-primary border-primary/30'
                : 'bg-amber-500/10 text-amber-600 border-amber-500/30'
            }`}
          >
            {score.grade.replace(/_/g, ' ')}
          </Badge>
          <span className="text-[10px] text-muted-foreground block">
            Audited {new Date(score.calculatedAt).toLocaleDateString('en-GB')}
          </span>
        </div>

        {/* 7 Category Progress Bars */}
        <div className="md:col-span-2 space-y-2.5">
          {(Object.keys(score.categories) as Array<keyof FormHealthCategories>).map((cat) => {
            const val = score.categories[cat];
            return (
              <div key={cat} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="flex items-center gap-1.5 text-foreground">
                    {CATEGORY_ICONS[cat]}
                    {CATEGORY_LABELS[cat]}
                  </span>
                  <span className={`text-xs font-bold ${getScoreColor(val)}`}>{val}%</span>
                </div>
                <Progress value={val} className="h-1.5 rounded-full" />
              </div>
            );
          })}
        </div>
      </div>

      {/* Diagnostic Findings List */}
      <div className="space-y-2.5 pt-2 border-t border-border/40">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
          Diagnostic Audit Findings ({score.diagnostics.length})
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {score.diagnostics.map((diag) => (
            <div
              key={diag.id}
              className="p-3 rounded-2xl bg-muted/20 border border-border/40 flex items-start gap-2.5"
            >
              <div className="mt-0.5 shrink-0">
                {diag.type === 'pass' && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                {diag.type === 'warning' && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                {diag.type === 'suggestion' && <Lightbulb className="h-4 w-4 text-primary" />}
              </div>

              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs font-bold text-foreground truncate">{diag.title}</h4>
                  <Badge variant="outline" className="text-[8px] px-1 py-0 uppercase">
                    {diag.category}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-2">{diag.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
