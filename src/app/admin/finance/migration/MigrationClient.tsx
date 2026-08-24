'use client';

/**
 * SmartSapp Finance 2.0 - Migration & Data Parity Studio
 * Backward-compatibility control center for legacy entity provisioning and ledger backfill.
 */

import * as React from 'react';
import { 
  Database, 
  CheckCircle2, 
  RefreshCw, 
  Loader2, 
  ShieldCheck, 
  Activity 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { MigrationParityResult, MigrationProgressPayload } from '@/lib/types';
import { 
  getMigrationParityStatusAction, 
  executeFinanceMigrationAction, 
  recalibrateSummaryAction 
} from '@/lib/migration-actions';

export function MigrationClient() {
  const { user } = useUser();
  const { activeWorkspaceId, activeWorkspace } = useWorkspace();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [isMigrating, setIsMigrating] = React.useState<boolean>(false);
  const [isRecalibrating, setIsRecalibrating] = React.useState<boolean>(false);
  const [parity, setParity] = React.useState<MigrationParityResult | null>(null);
  const [lastProgress, setLastProgress] = React.useState<MigrationProgressPayload | null>(null);

  const loadParity = React.useCallback(async () => {
    if (!activeWorkspaceId || !user?.uid) return;
    setIsLoading(true);
    try {
      const res = await getMigrationParityStatusAction(activeWorkspaceId, user.uid);
      if (res.success && res.parity) {
        setParity(res.parity);
      }
    } catch (e) {
      console.error('[MIGRATION] Parity error:', e);
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspaceId, user?.uid]);

  React.useEffect(() => {
    loadParity();
  }, [loadParity]);

  const handleExecuteMigration = async () => {
    if (!activeWorkspaceId || !user?.uid) return;
    setIsMigrating(true);

    try {
      const res = await executeFinanceMigrationAction(
        activeWorkspaceId,
        user.uid,
        user.displayName || user.email || 'Finance Administrator'
      );

      if (res.success && res.progress) {
        setLastProgress(res.progress);
        toast({
          title: 'Migration Complete',
          description: `Successfully provisioned ${res.progress.migratedEntities} accounts and backfilled ${res.progress.migratedInvoices} ledger transactions.`,
          actionConfig: {
            label: 'View Reports',
            path: '/admin/finance/reports',
          },
          duration: 8000,
        });
        loadParity();
      } else {
        toast({
          variant: 'destructive',
          title: 'Migration Failed',
          description: res.error || 'Failed to complete migration process.',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Migration error';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: msg,
      });
    } finally {
      setIsMigrating(false);
    }
  };

  const handleRecalibrate = async () => {
    if (!activeWorkspaceId || !user?.uid) return;
    setIsRecalibrating(true);

    try {
      const res = await recalibrateSummaryAction(activeWorkspaceId, user.uid);
      if (res.success) {
        toast({
          title: 'Summaries Recalibrated',
          description: 'Workspace financial summary synchronized with live sub-ledger.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Recalibration Failed',
          description: res.error || 'Failed to recalibrate summaries.',
        });
      }
    } finally {
      setIsRecalibrating(false);
    }
  };

  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
            <Database className="h-4 w-4" />
            Data Parity &amp; Sub-Ledger Migration
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Financial Migration Studio
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Automated migration engine provisioning financial accounts and backfilling historical ledger debits in {activeWorkspace?.name || activeWorkspaceId}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadParity}
            disabled={isLoading || isMigrating}
            className="rounded-xl h-10 min-h-[44px] text-xs font-semibold active:scale-[0.97]"
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Check Parity
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRecalibrate}
            disabled={isRecalibrating || isMigrating}
            className="rounded-xl h-10 min-h-[44px] text-xs font-semibold active:scale-[0.97]"
          >
            <Activity className={`h-4 w-4 mr-1.5 ${isRecalibrating ? 'animate-spin' : ''}`} />
            Recalibrate Summaries
          </Button>
        </div>
      </div>

      {/* Parity Health Score */}
      <Card className="rounded-2xl border shadow-sm p-6 bg-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <h2 className="text-lg font-bold text-foreground">Sub-Ledger Parity Health Score</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Percentage of CRM entities and legacy invoices linked to authoritative financial accounts and immutable transactions.
            </p>
          </div>

          <div className="text-left sm:text-right">
            <div className="text-3xl font-black text-foreground font-mono">
              {parity?.parityScore ?? 100}%
            </div>
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              {parity?.parityScore === 100 ? 'Complete Parity' : 'Migration Pending'}
            </span>
          </div>
        </div>

        <Progress value={parity?.parityScore ?? 100} className="h-3 rounded-full" />

        {/* Breakdown Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          <div className="p-3 rounded-xl border bg-muted/30 space-y-1">
            <span className="text-[11px] font-bold text-muted-foreground uppercase">Legacy Entities</span>
            <div className="text-xl font-bold font-mono text-foreground">{parity?.totalLegacyEntities ?? 0}</div>
            <span className="text-[11px] text-muted-foreground">{parity?.unprovisionedEntitiesCount ?? 0} unprovisioned</span>
          </div>

          <div className="p-3 rounded-xl border bg-muted/30 space-y-1">
            <span className="text-[11px] font-bold text-muted-foreground uppercase">Provisioned Accounts</span>
            <div className="text-xl font-bold font-mono text-emerald-600">{parity?.entitiesWithAccounts ?? 0}</div>
            <span className="text-[11px] text-muted-foreground">Active sub-ledger accounts</span>
          </div>

          <div className="p-3 rounded-xl border bg-muted/30 space-y-1">
            <span className="text-[11px] font-bold text-muted-foreground uppercase">Legacy Invoices</span>
            <div className="text-xl font-bold font-mono text-foreground">{parity?.totalLegacyInvoices ?? 0}</div>
            <span className="text-[11px] text-muted-foreground">{parity?.unmigratedInvoicesCount ?? 0} unmigrated debits</span>
          </div>

          <div className="p-3 rounded-xl border bg-muted/30 space-y-1">
            <span className="text-[11px] font-bold text-muted-foreground uppercase">Ledger Debits</span>
            <div className="text-xl font-bold font-mono text-primary">{parity?.invoicesWithLedgerDebit ?? 0}</div>
            <span className="text-[11px] text-muted-foreground">Immutable posted transactions</span>
          </div>
        </div>
      </Card>

      {/* Migration Action Card */}
      <Card className="rounded-2xl border shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-foreground">Execute Data Migration</h3>
            <p className="text-xs text-muted-foreground max-w-xl">
              Provisions missing financial accounts for legacy CRM entities with standard numbering (<code>ACC-XXXXXX</code>), backfills missing debit transactions, and recalculates exact customer ledger balances.
            </p>
          </div>

          <Button
            size="lg"
            onClick={handleExecuteMigration}
            disabled={isMigrating || isLoading}
            className="rounded-xl h-11 min-h-[44px] text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md active:scale-[0.97]"
          >
            {isMigrating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Migrating Records...
              </>
            ) : (
              <>
                <Database className="h-4 w-4 mr-2" />
                Execute Migration
              </>
            )}
          </Button>
        </div>

        {lastProgress && (
          <div className="p-4 rounded-xl border bg-emerald-500/5 border-emerald-500/20 text-xs space-y-2">
            <div className="flex items-center gap-1.5 text-emerald-600 font-bold">
              <CheckCircle2 className="h-4 w-4" />
              Migration Completed Successfully
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-muted-foreground">
              <div>Accounts Provisioned: <strong className="text-foreground">{lastProgress.migratedEntities}</strong></div>
              <div>Debits Backfilled: <strong className="text-foreground">{lastProgress.migratedInvoices}</strong></div>
              <div>Balances Recalculated: <strong className="text-foreground">{lastProgress.reconciledBalanceCount}</strong></div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
