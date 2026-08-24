'use client';

/**
 * SmartSapp Finance 2.0 - Customer Statement of Account Studio
 * High-fidelity printable and exportable Statement of Account.
 */

import * as React from 'react';
import { 
  FileText, 
  Printer, 
  Share2, 
  ArrowLeft, 
  Loader2, 
  Check 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { CustomerStatement, StatementRow, FinancialAccount } from '@/lib/types';
import { getCustomerStatementAction } from '@/lib/receivables-actions';
import { doc, getDoc } from 'firebase/firestore';
import Link from 'next/link';

export interface StatementClientProps {
  accountId: string;
}

export function StatementClient({ accountId }: StatementClientProps) {
  const { user } = useUser();
  const { activeWorkspaceId, activeWorkspace } = useWorkspace();
  const { toast } = useToast();
  const firestore = useFirestore();

  const [statement, setStatement] = React.useState<CustomerStatement | null>(null);
  const [account, setAccount] = React.useState<FinancialAccount | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [rangePreset, setRangePreset] = React.useState<string>('all');
  const [copied, setCopied] = React.useState<boolean>(false);

  const fetchStatement = React.useCallback(async (preset: string = 'all') => {
    if (!accountId || !user?.uid || !activeWorkspaceId) return;
    setIsLoading(true);

    try {
      let startDate: string | undefined;
      const now = new Date();

      if (preset === 'ytd') {
        startDate = `${now.getFullYear()}-01-01`;
      } else if (preset === '90d') {
        const d = new Date();
        d.setDate(d.getDate() - 90);
        startDate = d.toISOString().split('T')[0];
      } else if (preset === '30d') {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        startDate = d.toISOString().split('T')[0];
      }

      const res = await getCustomerStatementAction(
        accountId,
        activeWorkspaceId,
        user.uid,
        startDate
      );

      if (res.success && res.statement) {
        setStatement(res.statement);
      } else {
        toast({
          title: 'Failed to load statement',
          description: res.error || 'Could not compile statement history.',
          variant: 'destructive',
        });
      }

      if (firestore) {
        const accSnap = await getDoc(doc(firestore, 'financial_accounts', accountId));
        if (accSnap.exists()) {
          setAccount({ id: accSnap.id, ...(accSnap.data() as Omit<FinancialAccount, 'id'>) });
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error fetching statement';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [accountId, user?.uid, activeWorkspaceId, firestore, toast]);

  React.useEffect(() => {
    fetchStatement(rangePreset);
  }, [fetchStatement, rangePreset]);

  const handlePrint = () => {
    window.print();
  };

  const handleCopyPublicLink = () => {
    const token = statement?.statementToken || account?.statementToken;
    if (!token) {
      toast({
        title: 'Share link',
        description: 'Generating secure statement link...',
      });
      return;
    }

    const url = `${window.location.origin}/statement/${token}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast({
      title: 'Link Copied',
      description: 'Customer statement link copied to clipboard.',
    });
    setTimeout(() => setCopied(false), 2500);
  };

  const getTxTypeBadge = (type: string) => {
    switch (type) {
      case 'invoice_issued':
        return <Badge variant="outline" className="text-[10px] font-bold">Invoice</Badge>;
      case 'payment_received':
      case 'payment_allocated':
        return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold text-[10px]">Payment</Badge>;
      case 'credit_note':
        return <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 font-bold text-[10px]">Credit Note</Badge>;
      case 'debit_note':
        return <Badge className="bg-purple-500/15 text-purple-700 dark:text-purple-300 font-bold text-[10px]">Debit Note</Badge>;
      case 'reversal':
        return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold text-[10px]">Reversal</Badge>;
      default:
        return <Badge variant="secondary" className="text-[10px] font-bold">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Action Toolbar (Hidden in Print) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-10 w-10 p-0 rounded-xl active:scale-[0.97]"
          >
            <Link href="/admin/finance/receivables">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              Statement of Account
            </h1>
            <p className="text-xs text-muted-foreground font-medium">
              {statement?.entityName || 'Customer Account'} ({statement?.accountNumber})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={rangePreset} onValueChange={setRangePreset}>
            <SelectTrigger className="h-10 min-h-[40px] rounded-xl text-xs font-semibold bg-card w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all" className="text-xs">All Time</SelectItem>
              <SelectItem value="ytd" className="text-xs">Year to Date</SelectItem>
              <SelectItem value="90d" className="text-xs">Last 90 Days</SelectItem>
              <SelectItem value="30d" className="text-xs">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            className="h-10 min-h-[40px] rounded-xl px-3.5 text-xs font-bold active:scale-[0.97]"
            onClick={handleCopyPublicLink}
          >
            {copied ? <Check className="h-4 w-4 mr-1.5 text-emerald-600" /> : <Share2 className="h-4 w-4 mr-1.5" />}
            {copied ? 'Copied' : 'Share'}
          </Button>

          <Button
            className="h-10 min-h-[40px] rounded-xl px-4 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.97]"
            onClick={handlePrint}
          >
            <Printer className="h-4 w-4 mr-1.5" /> Print / PDF
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="h-96 flex flex-col items-center justify-center bg-card rounded-3xl border border-border">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs font-bold text-muted-foreground mt-3">Compiling Statement of Account...</p>
        </div>
      ) : !statement ? (
        <div className="h-96 flex flex-col items-center justify-center bg-card rounded-3xl border border-border">
          <FileText className="h-12 w-12 text-muted-foreground/40" />
          <p className="text-base font-bold text-foreground mt-3">Statement Not Found</p>
          <p className="text-xs text-muted-foreground mt-1">Unable to locate account or transaction records</p>
        </div>
      ) : (
        /* Printable Statement Sheet */
        <Card className="rounded-3xl border-border bg-card shadow-lg print:shadow-none print:border-none p-6 sm:p-10 space-y-8">
          {/* Institution Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-border pb-6">
            <div>
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-black text-sm">
                  SS
                </div>
                <h2 className="text-xl font-black tracking-tight text-foreground">
                  {activeWorkspace?.name || 'SmartSapp Enterprise'}
                </h2>
              </div>
              <p className="text-xs text-muted-foreground font-medium mt-1">
                Institutional Financial Management & Billing Hub
              </p>
            </div>

            <div className="sm:text-right space-y-1">
              <h3 className="text-lg font-black uppercase tracking-wider text-primary">
                Statement of Account
              </h3>
              <p className="text-xs font-bold text-foreground">
                Account #: <span className="font-mono">{statement.accountNumber}</span>
              </p>
              <p className="text-xs font-medium text-muted-foreground">
                Statement Period: {statement.startDate} to {statement.endDate}
              </p>
              <p className="text-[11px] font-medium text-muted-foreground">
                Issued on: {new Date(statement.generatedAt).toLocaleDateString('en-US', { dateStyle: 'medium' })}
              </p>
            </div>
          </div>

          {/* Debtor Info & Summary Snapshot */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="p-4 rounded-2xl bg-muted/30 border border-border/60 space-y-1">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Statement For</p>
              <h4 className="text-base font-black text-foreground">{statement.entityName}</h4>
              <p className="text-xs font-medium text-muted-foreground">
                Institutional Account ID: {statement.accountId}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Opening</p>
                <p className="text-xs font-bold text-foreground mt-0.5">
                  {statement.currency} {statement.openingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Total Invoiced</p>
                <p className="text-xs font-bold text-foreground mt-0.5">
                  {statement.currency} {statement.totalDebits.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-primary uppercase">Balance Due</p>
                <p className="text-sm font-black text-rose-600 dark:text-rose-400 mt-0.5">
                  {statement.currency} {statement.closingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>

          {/* Statement Transaction Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="border-border">
                  <TableHead className="text-xs font-bold text-muted-foreground uppercase py-3">Date</TableHead>
                  <TableHead className="text-xs font-bold text-muted-foreground uppercase">Reference #</TableHead>
                  <TableHead className="text-xs font-bold text-muted-foreground uppercase">Type</TableHead>
                  <TableHead className="text-xs font-bold text-muted-foreground uppercase">Description</TableHead>
                  <TableHead className="text-xs font-bold text-muted-foreground uppercase text-right">Debit</TableHead>
                  <TableHead className="text-xs font-bold text-muted-foreground uppercase text-right">Credit</TableHead>
                  <TableHead className="text-xs font-bold text-muted-foreground uppercase text-right pr-4">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Opening Balance Row */}
                <TableRow className="border-border bg-muted/10 font-bold">
                  <TableCell className="text-xs py-3">{statement.startDate}</TableCell>
                  <TableCell className="text-xs font-mono">-</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px] font-bold">Opening</Badge></TableCell>
                  <TableCell className="text-xs font-semibold">Opening Balance</TableCell>
                  <TableCell className="text-xs text-right">-</TableCell>
                  <TableCell className="text-xs text-right">-</TableCell>
                  <TableCell className="text-xs font-black text-right pr-4">
                    {statement.currency} {statement.openingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>

                {statement.rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-xs font-medium text-muted-foreground">
                      No transaction entries recorded within this period
                    </TableCell>
                  </TableRow>
                ) : (
                  statement.rows.map((row: StatementRow, idx: number) => (
                    <TableRow key={idx} className="border-border hover:bg-muted/20 transition-colors">
                      <TableCell className="text-xs py-3 font-medium text-foreground">
                        {new Date(row.date).toISOString().split('T')[0]}
                      </TableCell>
                      <TableCell className="text-xs font-mono font-bold text-primary">
                        {row.referenceNumber}
                      </TableCell>
                      <TableCell>
                        {getTxTypeBadge(row.transactionType)}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-foreground">
                        {row.description}
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-foreground text-right">
                        {row.debit > 0 ? `${statement.currency} ${row.debit.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 text-right">
                        {row.credit > 0 ? `${statement.currency} ${row.credit.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell className="text-xs font-black text-foreground text-right pr-4">
                        {statement.currency} {row.runningBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))
                )}

                {/* Closing Balance Row */}
                <TableRow className="border-t-2 border-border bg-muted/30 font-black">
                  <TableCell colSpan={4} className="text-xs py-4 uppercase tracking-wider pl-4">
                    Closing Statement Balance
                  </TableCell>
                  <TableCell className="text-xs text-right">
                    {statement.currency} {statement.totalDebits.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-xs text-emerald-600 dark:text-emerald-400 text-right">
                    {statement.currency} {statement.totalCredits.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-sm font-black text-rose-600 dark:text-rose-400 text-right pr-4">
                    {statement.currency} {statement.closingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* Remittance & Payment Instructions */}
          <div className="p-5 rounded-2xl bg-muted/30 border border-border flex flex-col sm:flex-row justify-between gap-4 text-xs">
            <div>
              <p className="font-bold text-foreground uppercase tracking-wider text-[10px]">Remittance Instructions</p>
              <p className="text-muted-foreground mt-1">
                Please quote account number <strong>{statement.accountNumber}</strong> on all bank transfers and mobile money remittances.
              </p>
            </div>
            <div className="sm:text-right">
              <p className="font-bold text-foreground">Questions or Discrepancies?</p>
              <p className="text-muted-foreground mt-1">finance@smartsapp.com • support.smartsapp.com</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
