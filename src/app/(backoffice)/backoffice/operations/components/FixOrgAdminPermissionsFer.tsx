'use client';

import * as React from 'react';
import { ShieldAlert, Loader2, CheckCircle2, AlertCircle, Eye, ShieldCheck, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  executeFixOrgAdminPermissionsFerAction,
  type OrgAdminFerResult,
} from '@/app/actions/fix-org-admin-permissions-fer-action';
import { useBackoffice } from '../../context/BackofficeProvider';

type Phase = 'idle' | 'running' | 'done' | 'error';

function StatCard({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-muted/40 p-5 text-center">
      <span className={`text-3xl font-bold tabular-nums ${accent ?? 'text-foreground'}`}>{value}</span>
      <span className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</span>
    </div>
  );
}

/**
 * FER: Org-Admin Permission Remediation.
 * Strips the platform tokens (`system_admin` / `system_user_switch`) from
 * non-super-admin users and org-scoped roles. Dry run first, then apply.
 */
export default function FixOrgAdminPermissionsFer() {
  const { can, profile } = useBackoffice();
  const [phase, setPhase] = React.useState<Phase>('idle');
  const [result, setResult] = React.useState<OrgAdminFerResult | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const canExecute = can('operations', 'execute');

  const run = (dryRun: boolean) => {
    startTransition(async () => {
      setPhase('running');
      try {
        const executorId = profile?.id || 'system_backoffice';
        const res = await executeFixOrgAdminPermissionsFerAction(executorId, { dryRun });
        setResult(res);
        setPhase(res.success ? 'done' : 'error');
      } catch (err: any) {
        setResult({
          success: false,
          message: err.message || 'Unexpected error.',
          dryRun,
          details: { usersScanned: 0, usersAffected: [], usersFixed: 0, rolesAffected: [], rolesFixed: 0, skippedSuperAdmins: [], errors: [err.message] },
        });
        setPhase('error');
      }
    });
  };

  const d = result?.details;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/10">
          <ShieldAlert className="h-5 w-5 text-rose-500" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold flex items-center gap-2">
            FER — Org-Admin Permission Remediation
            <Badge variant="outline" className="h-5 text-[9px] font-bold uppercase border-rose-500/30 text-rose-500">Security</Badge>
          </h3>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            Strips the platform super-admin tokens (<code className="text-[10px]">system_admin</code>,{' '}
            <code className="text-[10px]">system_user_switch</code>) from organization users and org-scoped
            roles that were granted them by the legacy onboarding flow. Designated super admins
            (<code className="text-[10px]">system_config/super_admins</code>) are preserved. Run the dry run first.
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!canExecute || isPending}
          onClick={() => run(true)}
          className="rounded-xl font-bold text-xs gap-1.5"
        >
          {isPending && phase === 'running' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
          Dry Run
        </Button>
        <Button
          size="sm"
          disabled={!canExecute || isPending || !result || !result.dryRun || !result.success || (d?.usersAffected.length === 0 && d?.rolesAffected.length === 0)}
          onClick={() => run(false)}
          className="rounded-xl font-bold text-xs gap-1.5 bg-rose-600 hover:bg-rose-700 text-white"
        >
          <UserCog className="h-3.5 w-3.5" /> Apply Remediation
        </Button>
        {!canExecute && (
          <span className="text-[10px] font-semibold text-muted-foreground">Requires operations execute permission.</span>
        )}
        {result?.dryRun === false && result.success && (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600"><ShieldCheck className="h-3.5 w-3.5" /> Remediation applied</span>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground -mt-3">Apply unlocks after a successful dry run that finds something to fix.</p>

      {/* Result */}
      {result && (
        <div className="space-y-4">
          <div className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-xs ${
            result.success ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400' : 'border-rose-500/30 bg-rose-500/5 text-rose-600'
          }`}>
            {result.success ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" /> : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />}
            <span className="font-semibold">{result.dryRun ? '[Dry Run] ' : ''}{result.message}</span>
          </div>

          {d && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Users Scanned" value={d.usersScanned} />
              <StatCard label={result.dryRun ? 'Users To Fix' : 'Users Fixed'} value={result.dryRun ? d.usersAffected.length : d.usersFixed} accent="text-rose-500" />
              <StatCard label={result.dryRun ? 'Roles To Fix' : 'Roles Fixed'} value={result.dryRun ? d.rolesAffected.length : d.rolesFixed} accent="text-amber-500" />
              <StatCard label="Super Admins Kept" value={d.skippedSuperAdmins.length} accent="text-emerald-600" />
            </div>
          )}

          {d && d.usersAffected.length > 0 && (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-2 bg-muted/40 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Affected users</div>
              <div className="divide-y divide-border/50 max-h-[220px] overflow-y-auto">
                {d.usersAffected.map(u => (
                  <div key={u.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="font-bold truncate">{u.email}</p>
                      <p className="text-[10px] text-muted-foreground truncate">org: {u.organizationId}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {u.topLevel && <Badge variant="outline" className="h-4 text-[8px] font-bold border-rose-500/30 text-rose-500">global</Badge>}
                      {u.workspaces.length > 0 && <Badge variant="outline" className="h-4 text-[8px] font-bold border-amber-500/30 text-amber-600">{u.workspaces.length} ws</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {d && d.rolesAffected.length > 0 && (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-2 bg-muted/40 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Affected org roles</div>
              <div className="divide-y divide-border/50 max-h-[160px] overflow-y-auto">
                {d.rolesAffected.map(r => (
                  <div key={r.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs">
                    <p className="font-bold truncate">{r.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate shrink-0">org: {r.organizationId}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
