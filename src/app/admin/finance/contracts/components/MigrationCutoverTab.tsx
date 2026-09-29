'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * GA Cutover & Migration Console Dock in Agreements Hub (Phase 7 UI):
 * 1. Purpose (DocSigning_roadmap.md §13, §16, §17 & §18):
 *    Command & control console for General Availability cutover and legacy retirement:
 *    - Live Data Backfill Runner (bounded batches of 25, dry-run, cursor resume, quarantine counts).
 *    - Automated Data Reconciliation & Integrity Audit (parity metrics, counts, CSV/JSON export).
 *    - Staged Canary Cohort Switchboard (0% -> 10% -> 25% -> 50% -> 100% GA).
 *    - Emergency 1-Click Lossless Rollback (FM-P7-05) to instantly safeguard production signing traffic.
 * 2. Mobile Ergonomics & Accessibility:
 *    - All buttons & inputs strictly enforce `min-h-[44px]` touch targets.
 *    - Inputs lock font size at `text-base sm:text-sm` preventing iOS Safari auto-zoom.
 *    - Tactile micro-interactions (`active:scale-[0.97]`).
 * 3. Strict Multi-Tenant Scoping (Rule 5 & 8):
 *    - All operations strictly scoped by `workspaceId`.
 * 4. Zero-Tolerance Typing (Rule 4):
 *    - Strictly zero `any` or `any[]`.
 */

import * as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Rocket,
  ShieldAlert,
  RefreshCw,
  Download,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Database,
  BarChart,
} from 'lucide-react';
import {
  startMigrationRunAction,
  getMigrationStatusAction,
  runReconciliationAuditAction,
  getRolloutCohortAction,
  updateRolloutCohortAction,
  triggerEmergencyRollbackAction,
  exportReconciliationReportAction,
} from '@/app/actions/migration-cutover-actions';
import type {
  MigrationRun,
  ReconciliationReport,
  RolloutCohortConfig,
} from '@/lib/types/document-signing';

export interface MigrationCutoverTabProps {
  workspaceId: string;
}

export default function MigrationCutoverTab({ workspaceId }: MigrationCutoverTabProps) {
  const { toast } = useToast();

  // State
  const [isLoading, setIsLoading] = React.useState(false);
  const [migrationRun, setMigrationRun] = React.useState<MigrationRun | null>(null);
  const [quarantineCount, setQuarantineCount] = React.useState<number>(0);
  const [reconciliationReport, setReconciliationReport] = React.useState<ReconciliationReport | null>(null);
  const [cohortConfig, setCohortConfig] = React.useState<RolloutCohortConfig | null>(null);

  // Dialog State
  const [isRollbackDialogOpen, setIsRollbackDialogOpen] = React.useState(false);
  const [rollbackReason, setRollbackReason] = React.useState('');
  const [isPromoteGaDialogOpen, setIsPromoteGaDialogOpen] = React.useState(false);

  // Initial Data Fetching
  const loadConsoleData = React.useCallback(async () => {
    if (!workspaceId) return;
    setIsLoading(true);
    try {
      const [statusRes, cohortRes] = await Promise.all([
        getMigrationStatusAction(workspaceId),
        getRolloutCohortAction(workspaceId),
      ]);

      if (statusRes.success && statusRes.data) {
        setMigrationRun(statusRes.data.latestRun);
        setQuarantineCount(statusRes.data.quarantineCount);
      }
      if (cohortRes.success && cohortRes.data) {
        setCohortConfig(cohortRes.data);
      }
    } catch {
      toast({
        title: 'Console Synchronization Error',
        description: 'Failed to load live cutover data for this workspace.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, toast]);

  React.useEffect(() => {
    loadConsoleData();
  }, [loadConsoleData]);

  // Handler: Start Migration
  const handleStartMigration = async (dryRun: boolean, resume = false) => {
    if (!workspaceId) return;
    setIsLoading(true);
    try {
      const res = await startMigrationRunAction({
        workspaceId,
        batchSize: 25,
        dryRun,
        resumeFromCursor: resume && migrationRun?.lastProcessedCursor ? migrationRun.lastProcessedCursor : undefined,
      });

      if (res.success && res.data) {
        setMigrationRun(res.data);
        toast({
          title: dryRun ? 'Dry-Run Backfill Complete' : 'Live Backfill Batch Finished',
          description: `Processed ${res.data.counts.totalContracts} contracts. Quarantined: ${res.data.counts.quarantinedCount}.`,
        });
        loadConsoleData();
      } else {
        toast({
          title: 'Migration Batch Failed',
          description: res.error || 'Unknown error occurred.',
          variant: 'destructive',
        });
      }
    } catch (err: unknown) {
      toast({
        title: 'Execution Error',
        description: err instanceof Error ? err.message : 'Failed to execute batch.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handler: Run Reconciliation Audit
  const handleRunReconciliation = async () => {
    if (!workspaceId) return;
    setIsLoading(true);
    try {
      const res = await runReconciliationAuditAction({ workspaceId, checkArtifactHashes: true });
      if (res.success && res.data) {
        setReconciliationReport(res.data);
        toast({
          title: 'Reconciliation Audit Complete',
          description: `Parity Score: ${res.data.parityPercentage}%. Discrepancies: ${res.data.discrepancies.length}.`,
        });
      } else {
        toast({
          title: 'Audit Failed',
          description: res.error || 'Failed to complete parity audit.',
          variant: 'destructive',
        });
      }
    } catch (err: unknown) {
      toast({
        title: 'Audit Error',
        description: err instanceof Error ? err.message : 'Audit failed.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handler: Update Cohort Percentage
  const handleUpdateCohort = async (percentage: number) => {
    if (!workspaceId) return;
    setIsLoading(true);
    try {
      const res = await updateRolloutCohortAction({
        workspaceId,
        cohortPercentage: percentage,
        legacyDualWriteEnabled: percentage < 100, // Dual write sunsets at 100% GA
        shadowReadsEnabled: percentage < 100,
      });

      if (res.success && res.data) {
        setCohortConfig(res.data);
        toast({
          title: 'Rollout Cohort Promoted',
          description: `Workspace routing updated to ${percentage}% canary.`,
        });
      } else {
        toast({
          title: 'Update Failed',
          description: res.error || 'Failed to update cohort percentage.',
          variant: 'destructive',
        });
      }
    } catch (err: unknown) {
      toast({
        title: 'Update Error',
        description: err instanceof Error ? err.message : 'Cohort update failed.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setIsPromoteGaDialogOpen(false);
    }
  };

  // Handler: Trigger Emergency Rollback
  const handleTriggerRollback = async () => {
    if (!workspaceId || !rollbackReason.trim()) return;
    setIsLoading(true);
    try {
      const res = await triggerEmergencyRollbackAction({
        workspaceId,
        reason: rollbackReason.trim(),
      });

      if (res.success && res.data) {
        setCohortConfig(res.data);
        toast({
          title: 'Emergency Rollback Activated',
          description: '100% of signing traffic is now routing to legacy compatibility adapter.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Rollback Failed',
          description: res.error || 'Failed to trigger rollback.',
          variant: 'destructive',
        });
      }
    } catch (err: unknown) {
      toast({
        title: 'Rollback Error',
        description: err instanceof Error ? err.message : 'Emergency rollback failed.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setIsRollbackDialogOpen(false);
      setRollbackReason('');
    }
  };

  // Handler: Resume Normal Rollout (Disable Emergency Rollback)
  const handleResumeRollout = async () => {
    if (!workspaceId || !cohortConfig) return;
    setIsLoading(true);
    try {
      const res = await updateRolloutCohortAction({
        workspaceId,
        cohortPercentage: cohortConfig.cohortPercentage,
        legacyDualWriteEnabled: true,
        shadowReadsEnabled: true,
      });

      if (res.success && res.data) {
        setCohortConfig(res.data);
        toast({
          title: 'Rollout Resumed',
          description: 'Emergency rollback cleared. Canary cohort routing active.',
        });
      }
    } catch (err: unknown) {
      toast({
        title: 'Resume Error',
        description: err instanceof Error ? err.message : 'Failed to clear rollback.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handler: Export Reconciliation Report
  const handleExportReport = async (format: 'csv' | 'json') => {
    if (!workspaceId || !reconciliationReport) return;
    try {
      const res = await exportReconciliationReportAction({
        workspaceId,
        reportId: reconciliationReport.reportId,
        format,
      });

      if (res.success && res.data) {
        const blob = new Blob([res.data.payload], {
          type: format === 'csv' ? 'text/csv;charset=utf-8;' : 'application/json;charset=utf-8;',
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', res.data.filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast({
          title: 'Export Downloaded',
          description: `Downloaded ${res.data.filename} successfully.`,
        });
      }
    } catch {
      toast({
        title: 'Export Failed',
        description: 'Failed to generate download payload.',
        variant: 'destructive',
      });
    }
  };

  const isEmergencyActive = Boolean(cohortConfig?.isEmergencyRollbackActive);
  const currentPercentage = cohortConfig?.cohortPercentage ?? 0;

  return (
    <div className="space-y-6">
      {/* Emergency Rollback Banner */}
      {isEmergencyActive && (
        <Card className="border-2 border-destructive bg-destructive/10 text-destructive-foreground">
          <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-6 w-6 text-destructive shrink-0" />
              <div>
                <p className="font-bold text-sm text-destructive">
                  EMERGENCY ROLLBACK IN EFFECT (FM-P7-05)
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  All signing operations are forced back to the legacy compatibility adapter. Modern routing paused.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResumeRollout}
              disabled={isLoading}
              className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground min-h-[44px] active:scale-[0.97] transition-all font-semibold text-xs"
            >
              <RotateCcw className="h-4 w-4 mr-1.5" />
              Clear Rollback & Resume Canary
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Grid of Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 1: Live Migration Runner */}
        <Card className="rounded-2xl border border-border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                <CardTitle className="text-base font-bold">Live Data Backfill Engine</CardTitle>
              </div>
              {migrationRun && (
                <Badge
                  variant={migrationRun.status === 'completed' ? 'default' : 'secondary'}
                  className="uppercase text-[9px] font-bold"
                >
                  {migrationRun.status}
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs">
              Zero-downtime bounded batches (25/chunk) migrating legacy PDF forms & contracts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {migrationRun ? (
              <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-medium">Last Run ID:</span>
                  <span className="font-mono text-[11px] font-semibold">{migrationRun.runId}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center pt-1">
                  <div className="p-2 rounded-lg bg-background border border-border/40">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Contracts</p>
                    <p className="text-base font-extrabold text-foreground">
                      {migrationRun.counts.migratedContracts} / {migrationRun.counts.totalContracts}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-background border border-border/40">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Quarantined</p>
                    <p className="text-base font-extrabold text-amber-500">
                      {migrationRun.counts.quarantinedCount}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-background border border-border/40">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Mode</p>
                    <p className="text-xs font-bold uppercase mt-1">
                      {migrationRun.isDryRun ? 'Dry-Run' : 'Live'}
                    </p>
                  </div>
                </div>
                {migrationRun.lastProcessedCursor && (
                  <p className="text-[10px] text-muted-foreground truncate">
                    Cursor: <span className="font-mono">{migrationRun.lastProcessedCursor}</span>
                  </p>
                )}
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
                No historical migration runs found for this workspace.
              </div>
            )}

            {/* Quarantine Indicator */}
            {quarantineCount > 0 && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-xs font-semibold">
                    {quarantineCount} Orphaned Record{quarantineCount > 1 ? 's' : ''} Quarantined
                  </span>
                </div>
                <span className="text-[10px] font-medium opacity-80">Isolated (FM-P7-03)</span>
              </div>
            )}

            {/* Runner Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleStartMigration(true)}
                disabled={isLoading}
                className="rounded-xl font-bold text-xs h-10 px-3 min-h-[44px] active:scale-[0.97] transition-all flex-1"
              >
                <Layers className="h-3.5 w-3.5 mr-1 text-primary" />
                Dry-Run Batch
              </Button>
              <Button
                size="sm"
                onClick={() => handleStartMigration(false)}
                disabled={isLoading}
                className="rounded-xl font-bold text-xs h-10 px-3 min-h-[44px] active:scale-[0.97] transition-all flex-1"
              >
                <Play className="h-3.5 w-3.5 mr-1" />
                Start Live Backfill
              </Button>
              {migrationRun?.lastProcessedCursor && migrationRun.status === 'in_progress' && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleStartMigration(false, true)}
                  disabled={isLoading}
                  className="rounded-xl font-bold text-xs h-10 px-3 min-h-[44px] active:scale-[0.97] transition-all"
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                  Resume Batch
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Canary Cohort Switchboard */}
        <Card className="rounded-2xl border border-border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Rocket className="h-5 w-5 text-primary" />
                <CardTitle className="text-base font-bold">Staged Canary Switchboard</CardTitle>
              </div>
              <Badge variant="outline" className="font-bold text-xs text-primary border-primary/30">
                {currentPercentage}% Modern Cohort
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Deterministic hash routing (MD5 mod 100) ensuring agreement session persistence.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Stepped Rollout Controls */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-muted-foreground">Promotion Stages:</span>
                <span className="text-primary font-bold">
                  {currentPercentage === 100 ? '100% General Availability' : `${currentPercentage}% Canary`}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1.5 pt-1">
                {[0, 10, 25, 50, 100].map((pct) => (
                  <Button
                    key={pct}
                    variant={currentPercentage === pct ? 'default' : 'outline'}
                    size="sm"
                    disabled={isLoading || isEmergencyActive}
                    onClick={() => {
                      if (pct === 100) {
                        setIsPromoteGaDialogOpen(true);
                      } else {
                        handleUpdateCohort(pct);
                      }
                    }}
                    className="flex flex-col items-center justify-center p-2 h-14 rounded-xl min-h-[44px] active:scale-[0.97] transition-all"
                  >
                    <span className="text-xs font-extrabold">{pct}%</span>
                    <span className="text-[8px] uppercase tracking-tighter opacity-70">
                      {pct === 0 ? 'Internal' : pct === 100 ? 'GA' : 'Canary'}
                    </span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Invariants & State Status */}
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Dual-Write Active:</span>
                <Badge variant={cohortConfig?.legacyDualWriteEnabled ? 'secondary' : 'outline'} className="text-[10px]">
                  {cohortConfig?.legacyDualWriteEnabled ? 'Enabled' : 'Sunset (100% GA)'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Shadow Reads:</span>
                <Badge variant={cohortConfig?.shadowReadsEnabled ? 'secondary' : 'outline'} className="text-[10px]">
                  {cohortConfig?.shadowReadsEnabled ? 'Active Telemetry' : 'Disabled'}
                </Badge>
              </div>
            </div>

            {/* Emergency Rollback Trigger Button */}
            <div className="pt-2">
              <Button
                variant="destructive"
                size="sm"
                disabled={isLoading || isEmergencyActive}
                onClick={() => setIsRollbackDialogOpen(true)}
                className="w-full rounded-xl font-bold text-xs h-10 min-h-[44px] active:scale-[0.97] transition-all gap-1.5"
              >
                <ShieldAlert className="h-4 w-4" />
                Emergency 1-Click Rollback (FM-P7-05)
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Section 3: Data Reconciliation & Parity Auditor */}
      <Card className="rounded-2xl border border-border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <BarChart className="h-5 w-5 text-primary" />
                <CardTitle className="text-base font-bold">
                  Data Reconciliation & Cryptographic Parity Audit
                </CardTitle>
              </div>
              <CardDescription className="text-xs mt-1">
                Audits legacy vs modern contracts, templates, and signing envelopes for 100% parity.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRunReconciliation}
                disabled={isLoading}
                className="rounded-xl font-bold text-xs h-10 px-3 min-h-[44px] active:scale-[0.97] transition-all"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Run Parity Audit
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {reconciliationReport ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-border/60 bg-muted/20 flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Parity Score</span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-3xl font-extrabold text-foreground">
                      {reconciliationReport.parityPercentage}%
                    </span>
                    <Badge
                      className={
                        reconciliationReport.status === 'perfect_parity'
                          ? 'bg-emerald-500 text-white'
                          : 'bg-amber-500 text-white'
                      }
                    >
                      {reconciliationReport.status === 'perfect_parity' ? 'Perfect Parity' : 'Discrepancies'}
                    </Badge>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-border/60 bg-muted/20">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Legacy Source Counts</span>
                  <div className="mt-2 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Contracts:</span>
                      <span className="font-bold">{reconciliationReport.sourceCounts.contracts}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Templates:</span>
                      <span className="font-bold">{reconciliationReport.sourceCounts.templates}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Submissions:</span>
                      <span className="font-bold">{reconciliationReport.sourceCounts.submissions}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-border/60 bg-muted/20">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Modern Target Counts</span>
                  <div className="mt-2 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Contracts:</span>
                      <span className="font-bold">{reconciliationReport.targetCounts.contracts}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Templates:</span>
                      <span className="font-bold">{reconciliationReport.targetCounts.templates}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Envelopes:</span>
                      <span className="font-bold">{reconciliationReport.targetCounts.envelopes}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Discrepancy Table */}
              {reconciliationReport.discrepancies.length > 0 ? (
                <div className="rounded-xl border border-border overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="text-xs">Record ID</TableHead>
                        <TableHead className="text-xs">Entity</TableHead>
                        <TableHead className="text-xs">Discrepancy</TableHead>
                        <TableHead className="text-xs">Expected</TableHead>
                        <TableHead className="text-xs">Actual</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reconciliationReport.discrepancies.map((d, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono text-xs">{d.recordId}</TableCell>
                          <TableCell className="text-xs uppercase font-semibold">{d.entityType}</TableCell>
                          <TableCell className="text-xs text-amber-500 font-bold">{d.discrepancyType}</TableCell>
                          <TableCell className="text-xs">{d.expected}</TableCell>
                          <TableCell className="text-xs">{d.actual}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  <span className="text-xs font-semibold">
                    100.0% Cryptographic Parity. Zero discrepancies or orphaned entities detected.
                  </span>
                </div>
              )}

              {/* Export Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExportReport('csv')}
                  className="rounded-xl font-bold text-xs h-9 min-h-[44px] active:scale-[0.97] transition-all"
                >
                  <Download className="h-3.5 w-3.5 mr-1" />
                  Export Audit CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExportReport('json')}
                  className="rounded-xl font-bold text-xs h-9 min-h-[44px] active:scale-[0.97] transition-all"
                >
                  <Download className="h-3.5 w-3.5 mr-1" />
                  Export Audit JSON
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
              Click &apos;Run Parity Audit&apos; to execute full cryptographic reconciliation against legacy collections.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog: Emergency Rollback Confirmation */}
      <AlertDialog open={isRollbackDialogOpen} onOpenChange={setIsRollbackDialogOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              Confirm Emergency Rollback
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              This will immediately force 100% of e-signing traffic to the legacy compatibility adapter.
              No signing sessions or data will be lost (FM-P7-05).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <label className="text-xs font-bold text-foreground">Incident Reason (Required)</label>
            <Input
              placeholder="e.g. Downstream CRM webhook latency degradation..."
              value={rollbackReason}
              onChange={(e) => setRollbackReason(e.target.value)}
              className="mt-1 h-11 text-base sm:text-sm rounded-xl"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl min-h-[44px]">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleTriggerRollback}
              disabled={!rollbackReason.trim() || isLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl min-h-[44px]"
            >
              Trigger Rollback Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Promote to 100% GA Confirmation */}
      <AlertDialog open={isPromoteGaDialogOpen} onOpenChange={setIsPromoteGaDialogOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-primary" />
              Promote to 100% General Availability
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Promoting to 100% GA activates hard cutover: legacy dual-write will sunset, and direct legacy mutations
              will be permanently retired. Ensure reconciliation parity is 100.0% before proceeding.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl min-h-[44px]">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleUpdateCohort(100)}
              disabled={isLoading}
              className="rounded-xl min-h-[44px]"
            >
              Confirm 100% GA Cutover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
