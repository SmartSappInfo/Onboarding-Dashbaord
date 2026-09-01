'use client';

/**
 * SmartSapp Forms 2.0: Master Form Optimization Command Center
 * 
 * Unifies A/B Testing Experiments, 7-Dimensional Health Scorecard,
 * and Proactive Anomaly Detection into an executive optimization hub.
 */

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  ArrowLeft,
  Edit,
  BarChart3,
  Inbox,
  Split,
  Activity,
  AlertTriangle,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { PageContainer } from '@/components/ui/page-container';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import type { Form } from '@/lib/types';
import type {
  FormHealthScore,
  FormAnomalyAlert,
  FormExperiment,
} from '@/lib/forms/form-optimization-types';
import { getFormExperimentsAction } from '@/lib/forms/form-optimization-actions';
import FormHealthScoreCard from './FormHealthScoreCard';
import ExperimentManagerCard from './ExperimentManagerCard';
import AnomalyAlertsBanner from './AnomalyAlertsBanner';

interface FormOptimizationClientProps {
  form: Form;
  initialHealthScore: FormHealthScore;
  initialAnomalies: FormAnomalyAlert[];
  initialExperiments: FormExperiment[];
}

export default function FormOptimizationClient({
  form,
  initialHealthScore,
  initialAnomalies,
  initialExperiments,
}: FormOptimizationClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [experiments, setExperiments] = useState<FormExperiment[]>(initialExperiments);
  const [anomalies, setAnomalies] = useState<FormAnomalyAlert[]>(initialAnomalies);

  const refreshExperiments = async () => {
    const res = await getFormExperimentsAction({ formId: form.id });
    if (res.success && res.experiments) {
      setExperiments(res.experiments);
    }
  };

  return (
    <PageContainer>
      <div className="space-y-6 pb-20">
        {/* ── Top Header Navigation & Controls ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm" className="h-8 px-2 text-xs font-bold gap-1 text-muted-foreground hover:text-foreground">
                <Link href={`/admin/forms/${form.id}`}>
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to Form
                </Link>
              </Button>
              <span className="text-muted-foreground/40">•</span>
              <Badge variant="outline" className="text-[10px] font-bold bg-primary/10 text-primary border-primary/30">
                Optimization Engine
              </Badge>
              <Badge
                variant="outline"
                className={`text-[10px] font-bold ${
                  initialHealthScore.overallScore >= 80
                    ? 'text-emerald-600 border-emerald-500/30'
                    : 'text-amber-600 border-amber-500/30'
                }`}
              >
                Health: {initialHealthScore.overallScore}/100
              </Badge>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground flex items-center gap-2.5">
              <Sparkles className="h-6 w-6 text-primary" />
              Conversion & Optimization Studio
            </h1>
            <p className="text-xs text-muted-foreground">
              A/B split testing, 7-dimensional health scoring, and automatic anomaly monitoring for {form.title || 'Form'}.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="rounded-xl h-9 text-xs font-bold gap-1.5 border-border/60 hover:bg-muted min-h-[36px]"
            >
              <Link href={`/admin/forms/${form.id}/edit`}>
                <Edit className="h-3.5 w-3.5" />
                <span>Studio</span>
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              size="sm"
              className="rounded-xl h-9 text-xs font-bold gap-1.5 border-border/60 hover:bg-muted min-h-[36px]"
            >
              <Link href={`/admin/forms/${form.id}/analytics`}>
                <BarChart3 className="h-3.5 w-3.5" />
                <span>Analytics</span>
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              size="sm"
              className="rounded-xl h-9 text-xs font-bold gap-1.5 border-border/60 hover:bg-muted min-h-[36px]"
            >
              <Link href={`/admin/forms/${form.id}/submissions`}>
                <Inbox className="h-3.5 w-3.5" />
                <span>Submissions</span>
              </Link>
            </Button>
          </div>
        </div>

        {/* ── 1. Anomaly Alerts Banner ── */}
        <AnomalyAlertsBanner anomalies={anomalies} />

        {/* ── 2. A/B Testing & Multi-Variant Experiments ── */}
        <ExperimentManagerCard
          form={form}
          experiments={experiments}
          onExperimentUpdated={refreshExperiments}
        />

        {/* ── 3. 7-Dimensional Health Scorecard ── */}
        <FormHealthScoreCard
          formId={form.id}
          initialScore={initialHealthScore}
        />
      </div>
    </PageContainer>
  );
}
