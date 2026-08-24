'use client';

/**
 * SmartSapp Finance 2.0 - Gateway Reconciliation Studio
 * Reconciles external gateway webhooks & bank transactions against internal sub-ledger allocations.
 */

import * as React from 'react';
import { 
  Scale, 
  RefreshCw, 
  Loader2, 
  FileCheck,
  Download 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ReportExportService } from '@/lib/services/report-export-service';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { ReconciliationItem, ReconciliationStatus } from '@/lib/types';
import { 
  getReconciliationReportAction, 
  resolveReconciliationDiscrepancyAction 
} from '@/lib/reconciliation-actions';

export function ReconciliationClient() {
  const { user } = useUser();
  const { activeWorkspaceId, activeWorkspace } = useWorkspace();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [channel, setChannel] = React.useState<string>('all');
  const [items, setItems] = React.useState<ReconciliationItem[]>([]);
  const [matchedCount, setMatchedCount] = React.useState<number>(0);
  const [unmatchedCount, setUnmatchedCount] = React.useState<number>(0);
  const [totalDiscrepancy, setTotalDiscrepancy] = React.useState<number>(0);
  const [matchedAmount, setMatchedAmount] = React.useState<number>(0);

  // Resolution modal state
  const [resolvingItem, setResolvingItem] = React.useState<ReconciliationItem | null>(null);
  const [resolutionNotes, setResolutionNotes] = React.useState<string>('');
  const [isResolving, setIsResolving] = React.useState<boolean>(false);

  const loadReport = React.useCallback(async () => {
    if (!activeWorkspaceId || !user?.uid) return;
    setIsLoading(true);

    try {
      const res = await getReconciliationReportAction(
        activeWorkspaceId,
        channel,
        undefined,
        undefined,
        user.uid
      );

      if (res.success && res.report) {
        setItems(res.report.items);
        setMatchedCount(res.report.matchedCount);
        setUnmatchedCount(res.report.unmatchedCount);
        setTotalDiscrepancy(res.report.totalDiscrepancyAmount);
        setMatchedAmount(res.report.matchedAmount);
      }
    } catch (e) {
      console.error('[RECONCILIATION] Report error:', e);
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspaceId, user?.uid, channel]);

  React.useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handleResolveDiscrepancy = async () => {
    if (!resolvingItem || !user || !activeWorkspaceId) return;

    setIsResolving(true);
    const res = await resolveReconciliationDiscrepancyAction(
      resolvingItem.id,
      resolutionNotes,
      activeWorkspaceId,
      user.uid,
      user.displayName || user.email || 'Finance Officer'
    );

    setIsResolving(false);

    if (res.success) {
      toast({
        title: 'Discrepancy Resolved',
        description: 'Payment reconciliation status updated and audit logged.',
      });
      setResolvingItem(null);
      setResolutionNotes('');
      loadReport();
    } else {
      toast({
        variant: 'destructive',
        title: 'Resolution Failed',
        description: res.error || 'Failed to update record.',
      });
    }
  };

  const getStatusBadge = (status: ReconciliationStatus) => {
    switch (status) {
      case 'matched':
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">Matched</Badge>;
      case 'unmatched_in_gateway':
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]">Unmatched</Badge>;
      case 'unmatched_in_ledger':
        return <Badge className="bg-rose-500/10 text-rose-600 border-rose-500/20 text-[10px]">Missing Ledger</Badge>;
      case 'amount_mismatch':
        return <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20 text-[10px]">Variance</Badge>;
    }
  };

  const handleExportCsv = () => {
    if (items.length === 0) return;
    ReportExportService.exportToCsv({
      filename: `payment_reconciliation_${activeWorkspaceId}_${new Date().toISOString().split('T')[0]}`,
      title: 'Payment Gateway Reconciliation Report',
      headers: ['Reference #', 'Channel', 'Date', 'Ledger Amount (GHS)', 'Gateway Amount (GHS)', 'Discrepancy (GHS)', 'Status', 'Customer'],
      rows: items.map((i) => [
        i.reference,
        i.channel,
        i.transactionDate,
        i.ledgerAmount ?? 0,
        i.gatewayAmount ?? 0,
        i.discrepancy,
        i.status,
        i.customerName || '',
      ]),
    });
  };

  const totalTransactions = matchedCount + unmatchedCount;
  const matchRate = totalTransactions > 0 ? Math.round((matchedCount / totalTransactions) * 100) : 100;

  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
            <Scale className="h-4 w-4" />
            Gateway &amp; Bank Settlement Parity
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Payment Reconciliation Studio
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Compare external gateway logs and bank settlement batches against sub-ledger payment allocations in {activeWorkspace?.name || activeWorkspaceId}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={items.length === 0}
            className="rounded-xl h-10 min-h-[44px] text-xs font-semibold active:scale-[0.97]"
          >
            <Download className="h-4 w-4 mr-1.5" />
            Export CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={loadReport}
            disabled={isLoading}
            className="rounded-xl h-10 min-h-[44px] text-xs font-semibold active:scale-[0.97]"
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Report
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border bg-card p-4 shadow-sm space-y-1.5 border-l-4 border-l-emerald-500">
          <span className="text-[11px] font-bold text-muted-foreground uppercase">Reconciled Cash</span>
          <div className="text-2xl font-black text-emerald-600 font-mono">
            GHS {matchedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-muted-foreground">{matchedCount} verified transactions</p>
        </Card>

        <Card className="rounded-2xl border bg-card p-4 shadow-sm space-y-1.5 border-l-4 border-l-primary">
          <span className="text-[11px] font-bold text-muted-foreground uppercase">Match Rate</span>
          <div className="text-2xl font-black text-primary font-mono">{matchRate}%</div>
          <p className="text-xs text-muted-foreground">Gateway vs Ledger alignment</p>
        </Card>

        <Card className="rounded-2xl border bg-card p-4 shadow-sm space-y-1.5 border-l-4 border-l-amber-500">
          <span className="text-[11px] font-bold text-muted-foreground uppercase">Unmatched Items</span>
          <div className="text-2xl font-black text-amber-600 font-mono">{unmatchedCount}</div>
          <p className="text-xs text-muted-foreground">Awaiting gateway confirmation</p>
        </Card>

        <Card className="rounded-2xl border bg-card p-4 shadow-sm space-y-1.5 border-l-4 border-l-rose-500">
          <span className="text-[11px] font-bold text-muted-foreground uppercase">Variance Exposure</span>
          <div className="text-2xl font-black text-rose-600 font-mono">
            GHS {totalDiscrepancy.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-muted-foreground">Discrepancy value</p>
        </Card>
      </div>

      {/* Filter and Table Card */}
      <Card className="rounded-2xl border shadow-sm">
        <CardHeader className="p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3">
          <div>
            <CardTitle className="text-sm font-bold flex items-center gap-1.5">
              <FileCheck className="h-4 w-4 text-primary" />
              Reconciliation Items ({items.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Transaction matches, variances, and pending bank settlement receipts.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger className="w-[160px] rounded-xl h-9 min-h-[44px] text-xs font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Channels</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="mobile_money">Mobile Money</SelectItem>
                <SelectItem value="cash">Cash / Cheque</SelectItem>
                <SelectItem value="manual">Manual Settlement</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-xs font-medium">Loading reconciliation items...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-xs font-medium">
              No transactions logged for this reconciliation period.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs font-bold">Reference #</TableHead>
                    <TableHead className="text-xs font-bold">Channel</TableHead>
                    <TableHead className="text-xs font-bold">Date</TableHead>
                    <TableHead className="text-xs font-bold text-right">Ledger Amount</TableHead>
                    <TableHead className="text-xs font-bold text-right">Gateway Amount</TableHead>
                    <TableHead className="text-xs font-bold text-center">Status</TableHead>
                    <TableHead className="text-xs font-bold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id} className="hover:bg-muted/40 text-xs">
                      <TableCell className="font-mono font-bold text-primary">
                        {item.reference}
                      </TableCell>

                      <TableCell className="capitalize text-muted-foreground">
                        {item.channel.replace('_', ' ')}
                      </TableCell>

                      <TableCell className="font-mono text-muted-foreground">
                        {item.transactionDate}
                      </TableCell>

                      <TableCell className="text-right font-mono font-semibold text-foreground">
                        GHS {Number(item.ledgerAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>

                      <TableCell className="text-right font-mono text-muted-foreground">
                        GHS {Number(item.gatewayAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>

                      <TableCell className="text-center">
                        {getStatusBadge(item.status)}
                      </TableCell>

                      <TableCell className="text-right">
                        {item.status !== 'matched' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setResolvingItem(item)}
                            className="rounded-xl h-8 px-2 text-xs font-bold active:scale-[0.97]"
                          >
                            Resolve
                          </Button>
                        ) : (
                          <span className="text-[11px] text-emerald-600 font-semibold">Verified</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resolution Dialog */}
      {resolvingItem && (
        <Dialog open={!!resolvingItem} onOpenChange={(open) => !open && setResolvingItem(null)}>
          <DialogContent className="sm:max-w-md rounded-2xl p-6">
            <DialogHeader className="text-left space-y-1">
              <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                <Scale className="h-4 w-4" />
                Discrepancy Resolution
              </div>
              <DialogTitle className="text-xl font-bold tracking-tight">
                Resolve Discrepancy: {resolvingItem.reference}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Document reason and authorization for manually marking this payment as reconciled.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 pt-2">
              <div className="p-3 rounded-xl border bg-muted/40 text-xs space-y-1 font-mono">
                <div>Ledger Amount: <strong>GHS {resolvingItem.ledgerAmount}</strong></div>
                <div>Discrepancy: <strong className="text-rose-600">GHS {resolvingItem.discrepancy}</strong></div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Resolution Notes</Label>
                <Textarea
                  rows={3}
                  placeholder="Explain resolution (e.g. Bank slip verified manually, gateway fee deduction approved)..."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  className="rounded-xl resize-none text-xs"
                />
              </div>
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setResolvingItem(null)}
                disabled={isResolving}
                className="rounded-xl h-11 min-h-[44px] active:scale-[0.97]"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleResolveDiscrepancy}
                disabled={isResolving || !resolutionNotes.trim()}
                className="rounded-xl h-11 min-h-[44px] font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md active:scale-[0.97]"
              >
                {isResolving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <span>Confirm Resolution</span>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
