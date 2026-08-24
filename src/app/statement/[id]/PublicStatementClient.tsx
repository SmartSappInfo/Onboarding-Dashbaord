'use client';

/**
 * SmartSapp Finance 2.0 - Public Customer Statement Portal
 * Secure, tokenized statement viewer accessible without login.
 */

import * as React from 'react';
import { 
  Printer, 
  Loader2, 
  AlertCircle 
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
import { CustomerStatement, StatementRow } from '@/lib/types';
import { getPublicStatementAction } from '@/lib/receivables-actions';

export interface PublicStatementClientProps {
  tokenOrId: string;
}

export function PublicStatementClient({ tokenOrId }: PublicStatementClientProps) {
  const [statement, setStatement] = React.useState<CustomerStatement | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const res = await getPublicStatementAction(tokenOrId);
        if (res.success && res.statement) {
          setStatement(res.statement);
        } else {
          setError(res.error || 'Statement not found or link has expired.');
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error loading statement';
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [tokenOrId]);

  const handlePrint = () => {
    window.print();
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
      default:
        return <Badge variant="secondary" className="text-[10px] font-bold">{type}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-muted/20 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Bar */}
        <div className="flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground font-black text-sm shadow-md">
              SS
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">SmartSapp Finance</p>
              <p className="text-[11px] text-muted-foreground">Statement of Account Portal</p>
            </div>
          </div>

          <Button
            className="h-10 min-h-[40px] rounded-xl px-4 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.97]"
            onClick={handlePrint}
          >
            <Printer className="h-4 w-4 mr-1.5" /> Print / Save PDF
          </Button>
        </div>

        {isLoading ? (
          <div className="h-96 flex flex-col items-center justify-center bg-card rounded-3xl border border-border shadow-sm">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-xs font-bold text-muted-foreground mt-3">Loading Customer Statement...</p>
          </div>
        ) : error || !statement ? (
          <div className="h-96 flex flex-col items-center justify-center bg-card rounded-3xl border border-border shadow-sm p-6 text-center space-y-3">
            <AlertCircle className="h-12 w-12 text-rose-500 mx-auto" />
            <h3 className="text-base font-black text-foreground">Statement Unavailable</h3>
            <p className="text-xs text-muted-foreground max-w-sm">
              {error || 'This statement link is invalid or has expired. Please contact support.'}
            </p>
          </div>
        ) : (
          /* Statement Sheet */
          <Card className="rounded-3xl border-border bg-card shadow-lg print:shadow-none print:border-none p-6 sm:p-10 space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-border pb-6">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-foreground">
                  Statement of Account
                </h2>
                <p className="text-xs font-medium text-muted-foreground mt-1">
                  Official Record of Billing and Remittance History
                </p>
              </div>

              <div className="sm:text-right space-y-1">
                <p className="text-xs font-bold text-foreground">
                  Account #: <span className="font-mono">{statement.accountNumber}</span>
                </p>
                <p className="text-xs font-medium text-muted-foreground">
                  Period: {statement.startDate} to {statement.endDate}
                </p>
                <p className="text-[11px] font-medium text-muted-foreground">
                  Issued: {new Date(statement.generatedAt).toLocaleDateString('en-US', { dateStyle: 'medium' })}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="p-4 rounded-2xl bg-muted/30 border border-border/60 space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Account Holder</p>
                <h4 className="text-base font-black text-foreground">{statement.entityName}</h4>
              </div>

              <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Opening</p>
                  <p className="text-xs font-bold text-foreground mt-0.5">
                    {statement.currency} {statement.openingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Invoiced</p>
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
                      <TableCell colSpan={7} className="h-20 text-center text-xs font-medium text-muted-foreground">
                        No transactions recorded within this period
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

                  <TableRow className="border-t-2 border-border bg-muted/30 font-black">
                    <TableCell colSpan={4} className="text-xs py-4 uppercase tracking-wider pl-4">
                      Closing Balance Due
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

            <div className="p-5 rounded-2xl bg-muted/30 border border-border text-xs space-y-1">
              <p className="font-bold text-foreground uppercase tracking-wider text-[10px]">Payment Information</p>
              <p className="text-muted-foreground">
                Please reference your account number <strong>{statement.accountNumber}</strong> with all bank transfers.
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
