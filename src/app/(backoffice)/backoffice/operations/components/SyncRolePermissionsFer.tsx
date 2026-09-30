'use client';

/**
 * @fileoverview Backoffice FER Component: Normalize 6-Section Roles
 *
 * Provides a zero-code operator interface to scan and backfill all workspace
 * roles with full 6-section schema parity and backward compatibility backfills.
 *
 * Conforms to `.agents/AGENTS.md`, touch targets >= 44px, active:scale-[0.97],
 * and zero `any` or `any[]` typing.
 */

import * as React from 'react';
import { ShieldCheck, Loader2, CheckCircle2, AlertCircle, Eye, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  executeSyncRolePermissionsFerAction,
  type RoleSyncFerResult,
} from '@/app/actions/sync-role-permissions-fer-action';
import { useBackoffice } from '../../context/BackofficeProvider';
import { getErrorMessage } from '@/lib/errors/report-error';

type Phase = 'idle' | 'running' | 'done' | 'error';

function StatCard({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-muted/40 p-4 text-center">
      <span className={`text-2xl sm:text-3xl font-bold tabular-nums ${accent ?? 'text-foreground'}`}>{value}</span>
      <span className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</span>
    </div>
  );
}

export default function SyncRolePermissionsFer() {
  const { can } = useBackoffice();
  const [phase, setPhase] = React.useState<Phase>('idle');
  const [result, setResult] = React.useState<RoleSyncFerResult | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const canExecute = can('operations', 'execute');

  const run = (dryRun: boolean) => {
    startTransition(async () => {
      setPhase('running');
      try {
        const res = await executeSyncRolePermissionsFerAction({ dryRun });
        setResult(res);
        setPhase(res.success ? 'done' : 'error');
      } catch (err: unknown) {
        setResult({
          success: false,
          message: getErrorMessage(err) || 'Unexpected error occurred during role synchronization.',
          dryRun,
          details: { rolesScanned: 0, rolesNeedingSync: 0, rolesUpdated: 0, affectedRoleNames: [], errors: [getErrorMessage(err)] },
        });
        setPhase('error');
      }
    });
  };

  const d = result?.details;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
          <ShieldCheck className="h-5 w-5 text-emerald-500" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold flex items-center gap-2">
            FER — Normalize 6-Section Roles Architecture
            <Badge variant="outline" className="h-5 text-[9px] font-bold uppercase border-emerald-500/30 text-emerald-500">
              Authorization 2.0
            </Badge>
          </h3>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            Scans all workspace and organization roles in the database and ensures full alignment with the 6 platform
            sections (<code className="text-[10px]">operations</code>, <code className="text-[10px]">studios</code>,{' '}
            <code className="text-[10px]">finance</code>, <code className="text-[10px]">social</code>,{' '}
            <code className="text-[10px]">workforce</code>, <code className="text-[10px]">management</code>).
            Automatically backfills legacy social media and user management permissions without data loss.
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2.5">
        <Button
          variant="outline"
          size="sm"
          disabled={!canExecute || isPending}
          onClick={() => run(true)}
          className="rounded-xl font-bold text-xs gap-1.5 min-h-[44px] px-4 active:scale-[0.97] transition-transform"
        >
          {isPending && phase === 'running' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
          Dry Run Scan
        </Button>
        <Button
          size="sm"
          disabled={!canExecute || isPending || !result || !result.dryRun || !result.success || (d?.rolesNeedingSync === 0)}
          onClick={() => run(false)}
          className="rounded-xl font-bold text-xs gap-1.5 min-h-[44px] px-5 active:scale-[0.97] transition-transform bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <RefreshCw className="h-4 w-4" /> Apply 6-Section Normalization
        </Button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4 pt-2 border-t border-border/40 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            {result.success ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
            )}
            <span className="text-xs font-semibold text-foreground">{result.message}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard label="Roles Scanned" value={d?.rolesScanned ?? 0} />
            <StatCard
              label="Needing Synchronization"
              value={d?.rolesNeedingSync ?? 0}
              accent={d && d.rolesNeedingSync > 0 ? 'text-amber-500' : 'text-emerald-500'}
            />
            <StatCard
              label="Roles Updated"
              value={d?.rolesUpdated ?? 0}
              accent={d && d.rolesUpdated > 0 ? 'text-emerald-500' : 'text-muted-foreground'}
            />
          </div>

          {d && d.affectedRoleNames.length > 0 && (
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5 space-y-2">
              <span className="text-[11px] font-bold text-foreground uppercase tracking-wider block">
                Roles Identified for Synchronization ({d.affectedRoleNames.length})
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
                {d.affectedRoleNames.map((name, idx) => (
                  <Badge key={idx} variant="secondary" className="text-[10px]">
                    {name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {d && d.errors.length > 0 && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3.5 space-y-1">
              <span className="text-[11px] font-bold text-rose-500 uppercase tracking-wider block">
                Errors ({d.errors.length})
              </span>
              {d.errors.map((err, idx) => (
                <p key={idx} className="text-xs text-rose-400 font-mono">
                  {err}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
