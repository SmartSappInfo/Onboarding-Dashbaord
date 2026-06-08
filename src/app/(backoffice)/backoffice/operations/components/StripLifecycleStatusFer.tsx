'use client';

import * as React from 'react';
import {
  Wrench, ShieldAlert, Loader2, CheckCircle2, AlertCircle,
  Database, RotateCcw, Clock, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { executeStripLifecycleStatusFerAction } from '@/app/actions/strip-lifecycle-status-fer-action';
import { useBackoffice } from '../../context/BackofficeProvider';

type Phase = 'idle' | 'confirm' | 'running' | 'done' | 'error';

interface RunRecord {
  ts: string;
  success: boolean;
  message: string;
  details?: any;
}

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
      <span className={`text-2xl font-bold tabular-nums ${accent ?? 'text-foreground'}`}>
        {value}
      </span>
      <span className="mt-1.5 text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">
        {label}
      </span>
      {sub && (
        <span className="mt-0.5 text-[10px] text-muted-foreground">{sub}</span>
      )}
    </div>
  );
}

export default function StripLifecycleStatusFer() {
  const { can, profile } = useBackoffice();
  const [phase, setPhase] = React.useState<Phase>('idle');
  const [lastResult, setLastResult] = React.useState<any>(null);
  const [history, setHistory] = React.useState<RunRecord[]>([]);
  const [isPending, startTransition] = React.useTransition();

  const canExecute = can('operations', 'execute');

  const handleExecute = () => {
    startTransition(async () => {
      setPhase('running');
      try {
        const executorId = profile?.id || 'system_backoffice';
        const result = await executeStripLifecycleStatusFerAction(executorId);
        setLastResult(result);
        setHistory((prev) => [
          {
            ts: new Date().toISOString(),
            success: result.success,
            message: result.message,
            details: result.details,
          },
          ...prev,
        ].slice(0, 10));
        setPhase(result.success ? 'done' : 'error');
      } catch (err: any) {
        setLastResult({ success: false, error: err.message });
        setPhase('error');
      }
    });
  };

  const reset = () => {
    setPhase('idle');
    setLastResult(null);
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 h-full overflow-hidden p-4 md:p-6 bg-background rounded-xl border border-border">
      {/* Left Panel — Action Card */}
      <div className="w-full md:w-80 shrink-0 flex flex-col gap-4">
        <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-purple-500/15">
            <div className="flex items-center gap-2 mb-1">
              <Wrench className="h-4 w-4 text-purple-400" />
              <h3 className="font-semibold text-foreground text-sm">Strip lifecycleStatus Protocol</h3>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              FER database-wide migration protocol to safely remove the deprecated{' '}
              <code className="bg-muted px-1 rounded text-[10px]">lifecycleStatus</code> field from both the{' '}
              <code className="bg-muted px-1 rounded text-[10px]">entities</code> and{' '}
              <code className="bg-muted px-1 rounded text-[10px]">workspace_entities</code> collections.
            </p>
          </div>

          <div className="p-4 space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 rounded-lg bg-muted/60 border border-border px-3 py-2">
                <Database className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-[10px] font-mono text-foreground/80">entities & workspace_entities</span>
                <Badge
                  variant="outline"
                  className="ml-auto text-[8px] h-4 px-1.5 border-purple-500/30 bg-purple-500/10 text-purple-400"
                >
                  Global
                </Badge>
              </div>
            </div>

            {/* Confirm step */}
            {phase === 'idle' && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Button
                        variant="outline"
                        className="w-full border-purple-500/40 text-purple-400 hover:bg-purple-500/10 hover:border-purple-500/60 disabled:opacity-50"
                        disabled={!canExecute}
                        onClick={() => setPhase('confirm')}
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Run Strip Migration
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
                  Are you ready to migrate?
                </p>
                <p className="text-[10px] text-muted-foreground">
                  This scans all entities and workspace entities, and deletes the `lifecycleStatus` field. This action is irreversible.
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
                    className="flex-1 h-8 text-xs bg-purple-600 hover:bg-purple-700 text-white"
                    onClick={handleExecute}
                  >
                    Yes, Execute
                  </Button>
                </div>
              </div>
            )}

            {/* Running state */}
            {phase === 'running' && (
              <div className="flex items-center gap-3 rounded-lg border border-blue-500/20 bg-blue-500/8 px-3 py-2.5">
                <Loader2 className="h-4 w-4 text-blue-400 animate-spin shrink-0" />
                <div>
                  <p className="text-xs text-blue-300 font-medium">Running migration...</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Stripping keys in batches</p>
                </div>
              </div>
            )}

            {/* Success state */}
            {phase === 'done' && lastResult?.success && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/8 px-3 py-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-xs text-emerald-300 font-medium">Protocol complete</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {((lastResult.details?.entitiesStripped ?? 0) + (lastResult.details?.workspaceEntitiesStripped ?? 0))} fields stripped
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
                    <p className="text-xs text-red-300 font-medium">Execution failed</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 break-all">
                      {lastResult?.error ?? lastResult?.message ?? 'Unknown error'}
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
      </div>

      {/* Right Panel — Results & History */}
      <div className="flex-1 flex flex-col gap-4 overflow-hidden">
        {lastResult?.success && lastResult.details ? (
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-3">
              Last Run Results
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <StatCard
                label="Entities Cleaned"
                value={`${lastResult.details.entitiesStripped} / ${lastResult.details.entitiesScanned}`}
                sub="purged / scanned"
                accent="text-indigo-400"
              />
              <StatCard
                label="Workspace Links Cleaned"
                value={`${lastResult.details.workspaceEntitiesStripped} / ${lastResult.details.workspaceEntitiesScanned}`}
                sub="purged / scanned"
                accent="text-purple-400"
              />
              <StatCard
                label="Success Rate"
                value={lastResult.details.failed === 0 ? '100%' : '0%'}
                sub="execution"
                accent="text-emerald-400"
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center rounded-xl border border-border bg-muted/20 text-center p-12">
            <Wrench className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No migration runs executed yet</p>
            <p className="text-[11px] text-muted-foreground/60 mt-1">
              Trigger the strip migration to review results here
            </p>
          </div>
        )}

        {history.length > 0 && (
          <div className="flex-1 overflow-auto">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-3">
              Migration Logs
            </p>
            <div className="space-y-2">
              {history.map((rec, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-2.5"
                >
                  {rec.success ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground font-medium">
                      {rec.success
                        ? `Stripped ${((rec.details?.entitiesStripped ?? 0) + (rec.details?.workspaceEntitiesStripped ?? 0))} fields`
                        : `Failed — ${rec.message}`}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Entities: {rec.details?.entitiesStripped ?? 0} stripped, Workspace links: {rec.details?.workspaceEntitiesStripped ?? 0} stripped
                    </p>
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
