'use client';

/**
 * SmartSapp Finance 2.0 - Entity Financial Health Card
 * Embeddable CRM widget displaying an institution's debt standing, aging risk, and statement shortcuts.
 */

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, limit } from 'firebase/firestore';
import { FinancialAccount, AgingBucket } from '@/lib/types';
import { RecordPaymentModal } from './RecordPaymentModal';
import { CreateCreditNoteModal } from './CreateCreditNoteModal';
import { 
  Building2, 
  FileText, 
  CreditCard, 
  FileMinus 
} from 'lucide-react';
import Link from 'next/link';

export interface EntityFinancialHealthCardProps {
  entityId: string;
  workspaceId: string;
  entityName?: string;
  onRefresh?: () => void;
}

export function EntityFinancialHealthCard({
  entityId,
  workspaceId,
  entityName = 'Organization',
}: EntityFinancialHealthCardProps) {
  const firestore = useFirestore();
  const [isPaymentModalOpen, setIsPaymentModalOpen] = React.useState<boolean>(false);
  const [isCreditNoteModalOpen, setIsCreditNoteModalOpen] = React.useState<boolean>(false);

  // Query Financial Account
  const accountQuery = useMemoFirebase(() => {
    if (!firestore || !entityId || !workspaceId) return null;
    return query(
      collection(firestore, 'financial_accounts'),
      where('entityId', '==', entityId),
      where('workspaceId', '==', workspaceId),
      limit(1)
    );
  }, [firestore, entityId, workspaceId]);
  const { data: accounts, isLoading } = useCollection<FinancialAccount>(accountQuery);

  const account = accounts && accounts.length > 0 ? accounts[0] : null;

  const currentBalance = Number(account?.currentBalance || 0);
  const totalInvoiced = Number(account?.totalInvoiced || 0);
  const totalPaid = Number(account?.totalPaid || 0);
  const availableCredit = Number(account?.availableCredit || 0);
  const currency = account?.currency || 'GHS';

  const getAgingBadge = (bucket: AgingBucket = 'current') => {
    switch (bucket) {
      case '90_plus':
        return <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 font-bold text-[10px]">90+ Days Overdue (High Risk)</Badge>;
      case '61_90':
        return <Badge className="bg-orange-500/15 text-orange-700 dark:text-orange-300 font-bold text-[10px]">61-90 Days</Badge>;
      case '31_60':
        return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold text-[10px]">31-60 Days</Badge>;
      case '1_30':
        return <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 font-bold text-[10px]">1-30 Days</Badge>;
      default:
        return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold text-[10px]">Current / In Good Standing</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card className="rounded-3xl border-border bg-card shadow-sm p-4 animate-pulse">
        <div className="h-20 bg-muted/40 rounded-2xl" />
      </Card>
    );
  }

  if (!account) {
    return (
      <Card className="rounded-3xl border-border bg-card shadow-sm">
        <CardContent className="p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">No Financial Account</p>
              <p className="text-[11px] font-medium text-muted-foreground">Account provisioned automatically upon first invoice or agreement</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="rounded-3xl border-border bg-card shadow-sm overflow-hidden">
        <CardContent className="p-5 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Financial Standing</p>
                <h4 className="text-sm font-black text-foreground">{account.accountNumber} • {account.accountName || entityName}</h4>
              </div>
            </div>
            {currentBalance > 0 ? getAgingBadge('1_30') : getAgingBadge('current')}
          </div>

          {/* Metric Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
            <div className="p-3 rounded-2xl bg-muted/40 border border-border/40">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Outstanding Due</p>
              <p className={`text-base font-black truncate mt-0.5 ${currentBalance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {currency} {currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-muted/40 border border-border/40">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Total Invoiced</p>
              <p className="text-base font-black text-foreground truncate mt-0.5">
                {currency} {totalInvoiced.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-muted/40 border border-border/40">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Total Paid</p>
              <p className="text-base font-black text-emerald-600 dark:text-emerald-400 truncate mt-0.5">
                {currency} {totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-muted/40 border border-border/40">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Available Credit</p>
              <p className="text-base font-black text-primary truncate mt-0.5">
                {currency} {availableCredit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-9 min-h-[36px] rounded-xl text-xs font-bold active:scale-[0.97]"
            >
              <Link href={`/admin/finance/accounts/${account.id}/statement`}>
                <FileText className="h-3.5 w-3.5 mr-1.5" /> View Statement
              </Link>
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="h-9 min-h-[36px] rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-500/10 active:scale-[0.97]"
              onClick={() => setIsCreditNoteModalOpen(true)}
            >
              <FileMinus className="h-3.5 w-3.5 mr-1.5" /> Credit Note
            </Button>

            <Button
              size="sm"
              className="h-9 min-h-[36px] rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.97]"
              onClick={() => setIsPaymentModalOpen(true)}
            >
              <CreditCard className="h-3.5 w-3.5 mr-1.5" /> Record Payment
            </Button>
          </div>
        </CardContent>
      </Card>

      <RecordPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        account={account}
      />

      <CreateCreditNoteModal
        isOpen={isCreditNoteModalOpen}
        onClose={() => setIsCreditNoteModalOpen(false)}
        account={account}
      />
    </>
  );
}
