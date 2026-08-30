'use client';

/**
 * Data Quality & Hygiene Card with Remediation (Lead Intelligence 2.0 - Phase 11)
 * UI Spec Section 47: "Data Quality Dashboard"
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. Evaluates 5 dimensions of workspace lead health.
 * 2. 1-Click automated remediation triggers executing safe chunked actions.
 * 3. Mobile-responsive layout with touch targets >= 44px.
 * 4. Emil Kowalski active physics (active:scale-[0.97]).
 * 5. Strict Zero-`any` typing.
 */

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { 
  ShieldCheck, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Loader2 
} from 'lucide-react';
import type { DataQualityAudit } from '@/lib/lead-intelligence/types';
import { executeDataRemediationAction } from '@/app/actions/lead-intelligence-actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface DataQualityHygieneCardProps {
  audit: DataQualityAudit;
  workspaceId: string;
  onRemediated?: () => void;
  className?: string;
}

export const DataQualityHygieneCard: React.FC<DataQualityHygieneCardProps> = ({
  audit,
  workspaceId,
  onRemediated,
  className
}) => {
  const { toast } = useToast();
  const [remediatingType, setRemediatingType] = useState<string | null>(null);

  const handleRemediate = async (type: 'verify_emails' | 'enrich_stale') => {
    try {
      setRemediatingType(type);
      const res = await executeDataRemediationAction(type, workspaceId);
      if (res.success) {
        toast({
          title: 'Remediation Executed ✓',
          description: `Successfully remediated ${res.remediatedCount || 0} lead records.`
        });
        onRemediated?.();
      } else {
        toast({
          variant: 'destructive',
          title: 'Remediation Failed',
          description: res.error || 'Failed to execute remediation task.'
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Execution Error',
        description: 'Server error during remediation.'
      });
    } finally {
      setRemediatingType(null);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-emerald-600 dark:text-emerald-400';
    if (score >= 70) return 'text-amber-600 dark:text-amber-400';
    return 'text-rose-600 dark:text-rose-400';
  };

  const dimensions = [
    { label: 'Completeness', score: audit.completenessScore, desc: 'Contact names, domains & phones' },
    { label: 'Accuracy', score: audit.accuracyScore, desc: 'Valid SSL & ratings' },
    { label: 'Freshness', score: audit.freshnessScore, desc: 'Audited in last 30 days' },
    { label: 'Uniqueness', score: audit.uniquenessScore, desc: 'Collision deduplication' },
    { label: 'Deliverability', score: audit.verificationScore, desc: 'SMTP verified mailboxes' }
  ];

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-extrabold text-foreground tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span>Workspace Data Quality & Hygiene</span>
          </h4>
          <p className="text-xs text-muted-foreground pt-0.5">
            5-Dimension health evaluation of your lead intelligence records.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-semibold hidden sm:inline">Overall Health:</span>
          <Badge className={cn("text-xs font-black px-2.5 py-1", getScoreColor(audit.overallScore), "bg-muted border-border")}>
            {audit.overallScore} / 100
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 5-Dimension Scorecard */}
        <Card className="lg:col-span-2 bg-card border-border/70 shadow-xs rounded-2xl p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {dimensions.map((d) => (
              <div key={d.label} className="p-3 rounded-xl bg-muted/20 border border-border/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">{d.label}</span>
                  <span className={cn("text-xs font-black font-mono", getScoreColor(d.score))}>
                    {d.score}%
                  </span>
                </div>
                <Progress value={d.score} className="h-1.5" />
                <p className="text-[10px] text-muted-foreground">{d.desc}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* 1-Click Remediation Actions */}
        <Card className="bg-card border-border/70 shadow-xs rounded-2xl p-5 space-y-3 flex flex-col justify-between">
          <div className="space-y-3">
            <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span>Remediation Actions</span>
            </h5>

            {audit.remediationSuggestions.length === 0 ? (
              <div className="py-6 text-center text-xs text-emerald-600 dark:text-emerald-400 space-y-1">
                <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500 opacity-80" />
                <p className="font-bold">Data Quality Optimized</p>
                <p className="text-[11px] text-muted-foreground">All lead records meet verification and freshness criteria.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {audit.remediationSuggestions.map((rem) => {
                  const isRunning = remediatingType === rem.type;
                  return (
                    <div
                      key={rem.id}
                      className="p-3 rounded-xl bg-muted/30 border border-border/60 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <span className="text-xs font-bold text-foreground block">{rem.title}</span>
                          <span className="text-[11px] text-muted-foreground block line-clamp-2">{rem.description}</span>
                        </div>
                        <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                          {rem.affectedCount} leads
                        </Badge>
                      </div>

                      <Button
                        size="sm"
                        disabled={isRunning}
                        onClick={() => handleRemediate(rem.type as 'verify_emails' | 'enrich_stale')}
                        className="w-full h-8 text-xs font-bold bg-primary text-primary-foreground active:scale-[0.97]"
                      >
                        {isRunning ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                            Remediating...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                            {rem.actionLabel}
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
