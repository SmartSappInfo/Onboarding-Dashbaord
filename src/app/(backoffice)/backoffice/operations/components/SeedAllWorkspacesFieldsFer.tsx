'use client';

import * as React from 'react';
import {
  Wrench, ShieldAlert, Loader2, CheckCircle2, AlertCircle,
  Database, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { executeSeedAllWorkspacesFieldsFerAction } from '@/app/actions/seed-all-workspaces-fields-fer-action';
import { useBackoffice } from '../../context/BackofficeProvider';

type Phase = 'idle' | 'confirm' | 'running' | 'done' | 'error';

interface RunRecord {
  ts: string;
  success: boolean;
  message: string;
  details?: {
    workspacesScanned: number;
    workspacesSeeded: number;
    failed: number;
    errors: string[];
  };
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

export default function SeedAllWorkspacesFieldsFer() {
  const { can, profile } = useBackoffice();
  const [phase, setPhase] = React.useState<Phase>('idle');
  const [lastResult, setLastResult] = React.useState<{
    success: boolean;
    message: string;
    details?: {
      workspacesScanned: number;
      workspacesSeeded: number;
      failed: number;
      errors: string[];
    };
  } | null>(null);
  const [history, setHistory] = React.useState<RunRecord[]>([]);
  const [isPending, startTransition] = React.useTransition();

  const canExecute = can('operations', 'execute');

  const handleExecute = () => {
    startTransition(async () => {
      setPhase('running');
      try {
        const executorId = profile?.id || 'system_backoffice';
        const result = await executeSeedAllWorkspacesFieldsFerAction(executorId);
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
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        setLastResult({ success: false, message: errMsg });
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
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-emerald-500/15">
            <div className="flex items-center gap-2 mb-1">
              <Wrench className="h-4 w-4 text-emerald-400" />
              <h3 className="font-semibold text-foreground text-sm">Seed Workspace Fields</h3>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              FER database-wide migration protocol to safely align default native platform and industry field groups across all tenant workspaces.
            </p>
          </div>

          <div className="p-4 space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 rounded-lg bg-muted/60 border border-border px-3 py-2">
                <Database className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs font-mono text-foreground/80">workspaces</span>
                <Badge
                  variant="outline"
                  className="ml-auto text-[8px] h-4 px-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                >
                  All Tenants
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
                        className="w-full border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/60 disabled:opacity-50"
                        disabled={!canExecute}
                        onClick={() => setPhase('confirm')}
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Run Restructure Seeding
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
                  Are you ready?
                </p>
                <p className="text-[10px] text-muted-foreground">
                  This scans all active workspaces and updates their field groups/fields registry to the new platform cards structure.
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
                    className="flex-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={handleExecute}
                  >
                    Confirm & Run
                  </Button>
                </div>
              </div>
            )}

            {/* Running Step */}
            {phase === 'running' && (
              <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/8 p-3 space-y-2 text-center">
                <Loader2 className="h-5 w-5 text-indigo-400 animate-spin mx-auto" />
                <p className="text-xs text-indigo-300 font-medium">Executing seeding...</p>
                <p className="text-[9px] text-muted-foreground">Seeding native collections in Firestore</p>
              </div>
            )}

            {/* Done Step */}
            {(phase === 'done' || phase === 'error') && (
              <div className="space-y-3">
                <div
                  className={`rounded-lg border p-3 flex items-start gap-2.5 ${
                    phase === 'done'
                      ? 'border-emerald-500/30 bg-emerald-500/8 text-emerald-300'
                      : 'border-red-500/30 bg-red-500/8 text-red-300'
                  }`}
                >
                  {phase === 'done' ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
                  )}
                  <div>
                    <h4 className="text-xs font-semibold">
                      {phase === 'done' ? 'Execution Complete' : 'Execution Failed'}
                    </h4>
                    <p className="text-[10px] opacity-80 mt-0.5 leading-relaxed">
                      {lastResult?.message}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="w-full text-xs" onClick={reset}>
                  Reset State
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Panel — Stats & Execution History */}
      <div className="flex-1 min-w-0 flex flex-col gap-6">
        {/* Dynamic Live Stats */}
        {lastResult?.details && (
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Execution Statistics
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard
                label="Scanned"
                value={lastResult.details.workspacesScanned}
                sub="Total workspaces"
              />
              <StatCard
                label="Seeded"
                value={lastResult.details.workspacesSeeded}
                accent="text-emerald-400"
              />
              <StatCard
                label="Failed"
                value={lastResult.details.failed}
                accent={lastResult.details.failed > 0 ? 'text-red-400' : 'text-muted-foreground'}
              />
            </div>
            {lastResult.details.errors.length > 0 && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">
                  Execution Errors ({lastResult.details.errors.length})
                </span>
                <div className="max-h-32 overflow-y-auto space-y-1 font-mono text-[9px] text-red-300 leading-normal">
                  {lastResult.details.errors.map((err, idx) => (
                    <div key={idx} className="border-b border-red-500/10 pb-1 last:border-0 last:pb-0">
                      {err}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* History Log */}
        <div className="flex-1 flex flex-col min-h-[200px]">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Recent Runs Log
          </h4>
          <div className="flex-1 border border-border rounded-xl bg-muted/20 overflow-hidden relative">
            {history.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                <Clock className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-xs font-medium text-muted-foreground">No runs in this session yet</p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">Click &quot;Confirm & Run&quot; above to execute</p>
              </div>
            ) : (
              <div className="h-full overflow-y-auto divide-y divide-border p-4">
                {history.map((record, index) => (
                  <div key={index} className="py-2.5 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-semibold text-muted-foreground font-mono">
                        {new Date(record.ts).toLocaleTimeString()}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[8px] h-4 px-1.5 ${
                          record.success
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                            : 'border-red-500/30 bg-red-500/10 text-red-400'
                        }`}
                      >
                        {record.success ? 'SUCCESS' : 'FAILED'}
                      </Badge>
                    </div>
                    <p className="text-xs text-foreground/80 leading-normal">{record.message}</p>
                    {record.details && (
                      <div className="mt-1 flex items-center gap-4 text-[10px] text-muted-foreground">
                        <span>Scanned: {record.details.workspacesScanned}</span>
                        <span>Seeded: {record.details.workspacesSeeded}</span>
                        <span className={record.details.failed > 0 ? 'text-red-400 font-semibold' : ''}>
                          Failed: {record.details.failed}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import { Clock } from 'lucide-react';
