/**
 * @fileoverview Aging Debt & Overdue Receivables Inspector Component
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Table for inspecting multi-tenant overdue invoices.
 * - Allows triggering manual dunning escalation via `triggerDunningEscalationAction`.
 * - Zero `any` or `any[]` typing.
 */

'use client';

import * as React from 'react';
import {
  Banknote,
  AlertTriangle,
  Send,
  Loader2,
  Search,
  CheckCircle2,
  Building2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useBackofficeToken } from '@/hooks/use-backoffice-token';
import { useToast } from '@/hooks/use-toast';
import { useBackoffice } from '../../context/BackofficeProvider';
import { triggerDunningEscalationAction } from '@/lib/backoffice/backoffice-finance-actions';
import type { OverdueInvoiceItem } from '@/lib/backoffice/backoffice-types';

interface AgingDebtInspectorProps {
  readonly overdueInvoices: OverdueInvoiceItem[];
  readonly onRefresh: () => void;
}

export default function AgingDebtInspector({
  overdueInvoices,
  onRefresh,
}: AgingDebtInspectorProps) {
  const { can } = useBackoffice();
  const getToken = useBackofficeToken();
  const { toast } = useToast();

  const [search, setSearch] = React.useState('');
  const [escalatingId, setEscalatingId] = React.useState<string | null>(null);

  const handleEscalateDunning = async (invoiceId: string) => {
    setEscalatingId(invoiceId);
    try {
      const idToken = await getToken();
      const res = await triggerDunningEscalationAction(invoiceId, idToken);

      if (res.success) {
        toast({
          title: 'Dunning Escalated',
          description: `Invoice ${invoiceId} advanced to Stage ${res.nextStage}.`,
        });
        onRefresh();
      } else {
        toast({
          variant: 'destructive',
          title: 'Escalation Failed',
          description: res.error || 'Failed to trigger dunning sequence.',
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to trigger dunning sequence.',
      });
    } finally {
      setEscalatingId(null);
    }
  };

  const filteredInvoices = React.useMemo(() => {
    return overdueInvoices.filter((inv) => {
      return (
        search === '' ||
        inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
        inv.organizationName.toLowerCase().includes(search.toLowerCase())
      );
    });
  }, [overdueInvoices, search]);

  return (
    <div className="space-y-4">
      {/* Search Toolbar */}
      <div className="relative w-full">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search overdue invoices by number or organization..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-11 rounded-xl bg-card border-border text-xs"
        />
      </div>

      {/* Invoices Table */}
      <div className="rounded-2xl border border-border bg-card shadow-xl overflow-hidden">
        {filteredInvoices.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center gap-2 text-center">
            <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <p className="text-sm font-bold text-foreground">Zero Aging Overdue Debt</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              All tenant organizations and corporate accounts are in good financial standing.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-xs font-bold uppercase tracking-wider py-4">Invoice #</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider">Tenant Organization</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider">Outstanding Amount</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider">Days Overdue</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider">Dunning Stage</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-right pr-6">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((inv) => (
                  <TableRow key={inv.id} className="border-border/60 hover:bg-muted/40 transition-colors">
                    <TableCell className="py-4 font-mono text-xs font-bold text-foreground">
                      {inv.invoiceNumber}
                    </TableCell>
                    <TableCell>
                      <span className="font-bold text-xs text-foreground">{inv.organizationName}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs font-bold text-rose-500">
                        {inv.currency} {inv.amount.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`text-[10px] font-bold rounded-lg border ${
                          inv.daysOverdue > 30
                            ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                            : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                        }`}
                      >
                        +{inv.daysOverdue} days
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-semibold text-muted-foreground">
                        Stage {inv.currentDunningStage}
                      </span>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      {can('finance_monitor', 'execute') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEscalateDunning(inv.id)}
                          disabled={escalatingId === inv.id}
                          className="h-8 px-2.5 rounded-lg text-xs font-semibold active:scale-[0.97] gap-1"
                        >
                          {escalatingId === inv.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Send className="h-3.5 w-3.5 text-amber-500" />
                          )}
                          <span>Send Dunning</span>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
