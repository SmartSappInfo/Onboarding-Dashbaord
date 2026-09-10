'use client';

/**
 * @fileoverview CRM Data Hygiene & Auto-Repair Tab Component (Phase 9).
 *
 * ARCHITECTURAL POINTER:
 * Fulfills SmartSapp Sales Performance & Intelligence 2.0 UX Screen 5 (CRM Hygiene):
 * - Live pipeline data quality scanner powered by CleanSweep CRM Custodian Agent.
 * - Identifies stale deals (>14d inactive), missing next step dates, single-threaded deals ($>=$10k with 1 stakeholder), and unassigned hot leads.
 * - 1-click "Run Hygiene Scan" and atomic "Execute Repair" awarding +15 effort points.
 * - Mobile-first touch targets (min-h-[44px], active:scale-[0.97]).
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing enforced. Zero use of 'any' or 'any[]'.
 * - No raw HTML tags in UI.
 */

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ShieldCheck,
  RotateCw,
  CheckCircle2,
  Wrench,
  Building2,
} from 'lucide-react';
import type {
  AiCrmHygieneIssue,
  AiCrmHygieneSeverity,
} from '@/lib/ai-sales-workforce/types';
import {
  runCrmHygieneScanAction,
  executeCrmHygieneRepairAction,
} from '@/app/actions/ai-sales-workforce-actions';
import { useToast } from '@/hooks/use-toast';

interface CrmHygieneTabProps {
  hygieneIssues: AiCrmHygieneIssue[];
  workspaceId: string;
  organizationId: string;
  actorId: string;
  actorName: string;
  onRefresh: () => void;
}

export function CrmHygieneTab({
  hygieneIssues,
  workspaceId,
  organizationId,
  actorId,
  actorName,
  onRefresh,
}: CrmHygieneTabProps) {
  const { toast } = useToast();
  const [isScanning, setIsScanning] = React.useState(false);
  const [repairingId, setRepairingId] = React.useState<string | null>(null);

  const getSeverityBadge = (sev: AiCrmHygieneSeverity) => {
    switch (sev) {
      case 'critical':
        return <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 font-bold text-xs">Critical</Badge>;
      case 'high':
        return <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 font-semibold text-xs">High</Badge>;
      case 'medium':
        return <Badge className="bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20 font-semibold text-xs">Medium</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">Low</Badge>;
    }
  };

  const handleRunScan = async () => {
    try {
      setIsScanning(true);
      const res = await runCrmHygieneScanAction({
        workspaceId,
        organizationId,
        actorId,
      });

      if (res.success) {
        toast({
          title: 'Pipeline Scan Complete',
          description: `CleanSweep identified ${res.detectedCount} pipeline data quality discrepancies.`,
        });
        onRefresh();
      } else {
        toast({
          title: 'Scan Failed',
          description: res.error || 'Could not complete hygiene scan.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Scan error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleRepair = async (issue: AiCrmHygieneIssue) => {
    try {
      setRepairingId(issue.id);
      const res = await executeCrmHygieneRepairAction({
        workspaceId,
        organizationId,
        actorId,
        actorName,
        issueId: issue.id,
      });

      if (res.success) {
        toast({
          title: 'Hygiene Issue Repaired',
          description: `Repaired "${issue.fieldName}" on ${issue.entityName}. +${res.pointsAwarded ?? 15} effort points awarded!`,
        });
        onRefresh();
      } else {
        toast({
          title: 'Repair Failed',
          description: res.error || 'Could not apply hygiene repair.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to repair hygiene issue.',
        variant: 'destructive',
      });
    } finally {
      setRepairingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-cyan-500" />
            CRM Pipeline Data Hygiene ({hygieneIssues.length} Discrepancies)
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Automated quality auditing that prevents stalled opportunities, missing next steps, and single-threaded deal risks.
          </p>
        </div>

        <Button
          type="button"
          size="sm"
          onClick={handleRunScan}
          disabled={isScanning}
          className="h-10 rounded-xl text-xs font-semibold px-4 min-h-[44px] active:scale-[0.97] transition-transform gap-1.5"
        >
          <RotateCw className={`h-3.5 w-3.5 ${isScanning ? 'animate-spin' : ''}`} />
          <span>{isScanning ? 'Scanning Pipeline...' : 'Run Hygiene Scan'}</span>
        </Button>
      </div>

      {hygieneIssues.length === 0 ? (
        <Card className="border-border/70 rounded-2xl bg-card p-10 text-center shadow-xs">
          <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-foreground">CRM Data Pristine</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Zero stale deals, missing dates, or unassigned high-intent leads detected.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {hygieneIssues.map((issue) => (
            <Card
              key={issue.id}
              className="border-border/70 rounded-2xl bg-card shadow-xs hover:border-border transition-colors"
            >
              <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-2 flex-grow">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getSeverityBadge(issue.severity)}
                    <Badge variant="outline" className="text-2xs font-mono">
                      {issue.issueType.replace('_', ' ').toUpperCase()}
                    </Badge>
                    <span className="text-xs font-bold text-foreground flex items-center gap-1">
                      <Building2 className="h-3 w-3 text-muted-foreground" />
                      {issue.entityName}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {issue.repairRationale}
                  </p>

                  <div className="p-3 rounded-xl bg-muted/40 border border-border/40 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Current Value: </span>
                      <span className="font-mono text-2xs text-rose-600 dark:text-rose-400">
                        {String(issue.currentValue ?? 'None / Missing')}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Suggested Fix: </span>
                      <span className="font-mono text-2xs text-emerald-600 dark:text-emerald-400 font-semibold">
                        {String(issue.suggestedValue)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleRepair(issue)}
                    disabled={repairingId === issue.id}
                    className="h-10 rounded-xl text-xs font-semibold px-4 min-h-[44px] active:scale-[0.97] transition-transform gap-1.5"
                  >
                    <Wrench className={`h-3.5 w-3.5 ${repairingId === issue.id ? 'animate-spin' : ''}`} />
                    <span>{repairingId === issue.id ? 'Repairing...' : 'Execute Repair'}</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
