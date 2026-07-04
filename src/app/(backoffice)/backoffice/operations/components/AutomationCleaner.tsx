'use client';

import * as React from 'react';
import {
  Trash2, ShieldAlert, Loader2, CheckCircle2, AlertCircle,
  Database, RotateCcw, Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { clearAutomationData, type ClearAutomationResult } from '@/lib/backoffice/backoffice-job-actions';
import { getErrorMessage } from '@/lib/backoffice/backoffice-errors';
import { useBackoffice } from '../../context/BackofficeProvider';
import { useAuth } from '@/firebase';

// ─────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────

type Phase = 'idle' | 'confirm' | 'running' | 'done' | 'error';

interface RunRecord {
  ts: string;
  result: ClearAutomationResult;
}

// ─────────────────────────────────────────────────
// Stat Card
// ─────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: number | string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-muted/40 p-5 text-center">
      <span className={`text-3xl font-bold tabular-nums ${accent ?? 'text-foreground'}`}>
        {value}
      </span>
      <span className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
        {label}
      </span>
      {sub && (
        <span className="mt-0.5 text-[10px] text-muted-foreground">{sub}</span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────

export default function AutomationCleaner() {
  const { can } = useBackoffice();
  const auth = useAuth();

  const [phase, setPhase] = React.useState<Phase>('idle');
  const [lastResult, setLastResult] = React.useState<ClearAutomationResult | null>(null);
  const [history, setHistory] = React.useState<RunRecord[]>([]);
  const [isPending, startTransition] = React.useTransition();

  const canExecute = can('operations', 'execute');

  const getIdToken = React.useCallback(async (): Promise<string> => {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    return user.getIdToken();
  }, [auth]);

  const handleClear = () => {
    startTransition(async () => {
      setPhase('running');
      try {
        const token = await getIdToken();
        const result = await clearAutomationData(token);
        setLastResult(result);
        setHistory((prev) => [{ ts: new Date().toISOString(), result }, ...prev].slice(0, 10));
        setPhase(result.success ? 'done' : 'error');
      } catch (err: unknown) {
        setLastResult({ success: false, error: getErrorMessage(err) });
        setPhase('error');
      }
    });
  };

  const reset = () => {
    setPhase('idle');
    setLastResult(null);
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 h-full overflow-hidden">

      {/* ══════════════════════════════════════
          Left Panel — Action Card
          ══════════════════════════════════════ */}
      <div className="w-full md:w-80 shrink-0 flex flex-col gap-4">

        {/* Danger Zone Card */}
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-red-500/15">
            <div className="flex items-center gap-2 mb-1">
              <Trash2 className="h-4 w-4 text-red-400" />
              <h3 className="font-semibold text-foreground text-sm">Clear Automation Data</h3>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Permanently removes <strong className="text-foreground">all documents</strong> from{' '}
              <code className="bg-muted px-1 rounded text-[10px]">automation_runs</code> and{' '}
              <code className="bg-muted px-1 rounded text-[10px]">automation_jobs</code>.
              This action is irreversible.
            </p>
          </div>

          <div className="p-4 space-y-3">
            {/* Collections targeted */}
            <div className="space-y-1.5">
              {['automation_runs', 'automation_jobs'].map((col) => (
                <div
                  key={col}
                  className="flex items-center gap-2 rounded-lg bg-muted/60 border border-border px-3 py-2"
                >
                  <Database className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs font-mono text-foreground/80">{col}</span>
                  <Badge
                    variant="outline"
                    className="ml-auto text-[8px] h-4 px-1.5 border-red-500/30 bg-red-500/10 text-red-400"
                  >
                    ALL DOCS
                  </Badge>
                </div>
              ))}
            </div>

            {/* Confirm step */}
            {phase === 'idle' && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Button
                        variant="outline"
                        className="w-full border-red-500/40 text-red-400 hover:bg-red-500/10 hover:border-red-500/60 disabled:opacity-50"
                        disabled={!canExecute}
                        onClick={() => setPhase('confirm')}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Clear All Automation Data
                      </Button>
                    </div>
                  </TooltipTrigger>
                  {!canExecute && (
                    <TooltipContent side="top" className="bg-red-950 border-red-500/30 text-red-300 max-w-[240px]">
                      <div className="flex items-start gap-2">
                        <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold">Insufficient Permissions</p>
                          <p className="text-[10px] mt-1 opacity-80">
                            Requires <code className="bg-red-500/20 px-1 rounded">operations:execute</code>. Contact a Super Admin.
                          </p>
                        </div>
                      </div>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Confirmation step */}
            {phase === 'confirm' && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/8 p-3 space-y-3">
                <p className="text-xs text-amber-300 font-medium flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  Are you absolutely sure?
                </p>
                <p className="text-[10px] text-muted-foreground">
                  This will permanently delete every document in both collections with no undo.
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="flex-1 h-8 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setPhase('idle')}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 h-8 text-xs bg-red-600 hover:bg-red-700 text-white"
                    onClick={handleClear}
                  >
                    Yes, Delete
                  </Button>
                </div>
              </div>
            )}

            {/* Running state */}
            {phase === 'running' && (
              <div className="flex items-center gap-3 rounded-lg border border-blue-500/20 bg-blue-500/8 px-3 py-2.5">
                <Loader2 className="h-4 w-4 text-blue-400 animate-spin shrink-0" />
                <div>
                  <p className="text-xs text-blue-300 font-medium">Clearing data...</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Batch-deleting documents</p>
                </div>
              </div>
            )}

            {/* Success state */}
            {phase === 'done' && lastResult?.success && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/8 px-3 py-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-xs text-emerald-300 font-medium">Cleanup complete</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {lastResult.deleted?.total ?? 0} documents deleted
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-8 text-xs text-muted-foreground hover:text-foreground"
                  onClick={reset}
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  Reset
                </Button>
              </div>
            )}

            {/* Error state */}
            {phase === 'error' && (
              <div className="space-y-2">
                <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-2.5">
                  <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-red-300 font-medium">Operation failed</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 break-all">
                      {lastResult?.error ?? 'Unknown error'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-8 text-xs text-muted-foreground hover:text-foreground"
                  onClick={reset}
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  Try Again
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Info note */}
        <div className="rounded-xl border border-border bg-muted/30 p-4 text-[10px] text-muted-foreground leading-relaxed space-y-1.5">
          <p className="text-xs font-semibold text-foreground">When to use this</p>
          <p>• Pre-launch reset — clear test data before going live</p>
          <p>• Staging refresh — clean slate for new QA cycles</p>
          <p>• Debug reset — clear stale runs after engine changes</p>
          <p className="pt-1 text-amber-400/70 font-medium">⚠ Never run on a live production environment with active users.</p>
        </div>
      </div>

      {/* ══════════════════════════════════════
          Right Panel — Results & History
          ══════════════════════════════════════ */}
      <div className="flex-1 flex flex-col gap-4 overflow-hidden">

        {/* Last run stats */}
        {lastResult?.success && lastResult.deleted ? (
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-3">
              Last Run Results
            </p>
            <div className="grid grid-cols-3 gap-3">
              <StatCard
                label="Runs Deleted"
                value={lastResult.deleted.automation_runs}
                sub="automation_runs"
                accent="text-red-400"
              />
              <StatCard
                label="Jobs Deleted"
                value={lastResult.deleted.automation_jobs}
                sub="automation_jobs"
                accent="text-orange-400"
              />
              <StatCard
                label="Total Cleared"
                value={lastResult.deleted.total}
                sub="documents"
                accent="text-emerald-400"
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center rounded-xl border border-border bg-muted/20 text-center p-12">
            <Database className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No cleanup runs recorded yet</p>
            <p className="text-[11px] text-muted-foreground/60 mt-1">
              Run a cleanup to see deletion stats here
            </p>
          </div>
        )}

        {/* Session history */}
        {history.length > 0 && (
          <div className="flex-1 overflow-auto">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-3">
              Session History
            </p>
            <div className="space-y-2">
              {history.map((rec, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-2.5"
                >
                  {rec.result.success ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground font-medium">
                      {rec.result.success
                        ? `Cleared ${rec.result.deleted?.total ?? 0} documents`
                        : `Failed — ${rec.result.error}`}
                    </p>
                    {rec.result.success && rec.result.deleted && (
                      <p className="text-[10px] text-muted-foreground">
                        {rec.result.deleted.automation_runs} runs · {rec.result.deleted.automation_jobs} jobs
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                    <Clock className="h-3 w-3" />
                    {new Date(rec.ts).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
