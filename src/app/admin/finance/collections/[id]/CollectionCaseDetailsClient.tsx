'use client';

/**
 * SmartSapp Finance 2.0 - Collection Case Details Command Center
 * Multi-invoice debt rollup, PTP history, payment plan installments, and activity feed.
 */

import * as React from 'react';
import { 
  Building2, 
  ArrowLeft, 
  Handshake, 
  Split, 
  PhoneCall, 
  AlertTriangle, 
  Loader2, 
  FileText, 
  DollarSign, 
  MessageSquare,
  Mail,
  Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { useUser } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { 
  CollectionCase, 
  CollectionStage, 
  PromiseToPay, 
  PaymentPlan, 
  CollectionActivity,
  CollectionActivityType,
  Invoice
} from '@/lib/types';
import { 
  getCollectionCaseDetailsAction, 
  updateCaseStageAction 
} from '@/lib/collection-actions';
import { getUnpaidInvoicesForEntityAction } from '@/lib/finance-actions';
import { RecordPromiseToPayModal } from '@/components/finance/RecordPromiseToPayModal';
import { CreatePaymentPlanModal } from '@/components/finance/CreatePaymentPlanModal';
import { LogCollectionActivityModal } from '@/components/finance/LogCollectionActivityModal';
import { RecordPaymentModal } from '@/components/finance/RecordPaymentModal';
import Link from 'next/link';

export function CollectionCaseDetailsClient({ caseId }: { caseId: string }) {
  const { user } = useUser();
  const { activeWorkspaceId } = useWorkspace();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [collectionCase, setCollectionCase] = React.useState<CollectionCase | null>(null);
  const [promises, setPromises] = React.useState<PromiseToPay[]>([]);
  const [paymentPlans, setPaymentPlans] = React.useState<PaymentPlan[]>([]);
  const [activities, setActivities] = React.useState<CollectionActivity[]>([]);
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);

  // Modals state
  const [isPtpModalOpen, setIsPtpModalOpen] = React.useState<boolean>(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = React.useState<boolean>(false);
  const [isActivityModalOpen, setIsActivityModalOpen] = React.useState<boolean>(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = React.useState<boolean>(false);

  const fetchDetails = React.useCallback(async () => {
    if (!caseId || !activeWorkspaceId || !user?.uid) return;
    setIsLoading(true);

    const res = await getCollectionCaseDetailsAction(caseId, activeWorkspaceId, user.uid);
    if (res.success && res.collectionCase) {
      setCollectionCase(res.collectionCase);
      setPromises(res.promises || []);
      setPaymentPlans(res.paymentPlans || []);
      setActivities(res.activities || []);

      // Fetch open invoices for entity
      const invRes = await getUnpaidInvoicesForEntityAction(res.collectionCase.entityId, activeWorkspaceId);
      if (invRes.success && invRes.data) {
        setInvoices(invRes.data);
      }
    } else {
      toast({
        variant: 'destructive',
        title: 'Error loading case',
        description: res.error || 'Collection case could not be retrieved.',
      });
    }

    setIsLoading(false);
  }, [caseId, activeWorkspaceId, user?.uid, toast]);

  React.useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const handleStageChange = async (newStage: CollectionStage) => {
    if (!user || !activeWorkspaceId || !collectionCase) return;

    const res = await updateCaseStageAction(
      collectionCase.id,
      newStage,
      activeWorkspaceId,
      user.uid,
      user.displayName || user.email || 'Collection Officer'
    );

    if (res.success && res.collectionCase) {
      setCollectionCase(res.collectionCase);
      toast({ title: 'Stage Updated', description: `Case is now in '${newStage}'.` });
      fetchDetails();
    }
  };

  const getStageBadge = (stage: CollectionStage) => {
    switch (stage) {
      case 'upcoming': return <Badge variant="outline" className="text-muted-foreground">Upcoming</Badge>;
      case 'reminder': return <Badge className="bg-sky-500/10 text-sky-600 border-sky-500/20">Stage 1: Reminder</Badge>;
      case 'follow_up': return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Stage 2: Follow-up</Badge>;
      case 'active_collection': return <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20">Stage 3: Active</Badge>;
      case 'escalation': return <Badge className="bg-rose-500/10 text-rose-600 border-rose-500/20 font-bold">Stage 4: Escalation</Badge>;
      case 'final_notice': return <Badge className="bg-red-600 text-white font-bold">Stage 5: Final Notice</Badge>;
      case 'payment_arrangement': return <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20 font-bold">Stage 6: Arrangement</Badge>;
      case 'legal_external': return <Badge className="bg-slate-900 text-white font-bold">Stage 7: Legal</Badge>;
      case 'resolved': return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-bold">Stage 8: Resolved</Badge>;
    }
  };

  const getPtpBadge = (status: PromiseToPay['status']) => {
    switch (status) {
      case 'pending': return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Pending</Badge>;
      case 'fulfilled': return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-bold">Fulfilled</Badge>;
      case 'broken': return <Badge variant="destructive" className="font-bold">Broken</Badge>;
      case 'cancelled': return <Badge variant="outline" className="text-muted-foreground">Cancelled</Badge>;
    }
  };

  const getActivityIcon = (type: CollectionActivityType) => {
    switch (type) {
      case 'call': return <PhoneCall className="h-4 w-4 text-sky-600" />;
      case 'whatsapp': return <MessageSquare className="h-4 w-4 text-emerald-600" />;
      case 'email': return <Mail className="h-4 w-4 text-indigo-600" />;
      case 'meeting': return <Users className="h-4 w-4 text-amber-600" />;
      case 'promise_to_pay': return <Handshake className="h-4 w-4 text-purple-600" />;
      default: return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs font-semibold">Loading collection case workspace...</p>
      </div>
    );
  }

  if (!collectionCase) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
        <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
        <h2 className="text-xl font-bold">Case Not Found</h2>
        <p className="text-xs text-muted-foreground">This collection case does not exist or has been removed.</p>
        <Button asChild className="rounded-xl">
          <Link href="/admin/finance/collections">Back to Collections</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild className="h-8 px-2 rounded-lg text-xs font-semibold">
            <Link href="/admin/finance/collections">
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              Collections Pipeline
            </Link>
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-muted-foreground">{collectionCase.caseNumber}</span>
                {getStageBadge(collectionCase.stage)}
                <Badge variant={collectionCase.priority === 'critical' ? 'destructive' : 'outline'} className="text-[10px]">
                  {collectionCase.priority.toUpperCase()}
                </Badge>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {collectionCase.entityName}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Select 
              value={collectionCase.stage} 
              onValueChange={(val) => handleStageChange(val as CollectionStage)}
            >
              <SelectTrigger className="w-40 rounded-xl h-10 min-h-[44px] text-xs font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="reminder">Stage 1: Reminder</SelectItem>
                <SelectItem value="follow_up">Stage 2: Follow-up</SelectItem>
                <SelectItem value="active_collection">Stage 3: Active</SelectItem>
                <SelectItem value="escalation">Stage 4: Escalation</SelectItem>
                <SelectItem value="final_notice">Stage 5: Final Notice</SelectItem>
                <SelectItem value="payment_arrangement">Stage 6: Arrangement</SelectItem>
                <SelectItem value="legal_external">Stage 7: Legal</SelectItem>
                <SelectItem value="resolved">Stage 8: Resolved</SelectItem>
              </SelectContent>
            </Select>

            <Button
              onClick={() => setIsPaymentModalOpen(true)}
              className="rounded-xl h-10 min-h-[44px] text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md active:scale-[0.97]"
            >
              <DollarSign className="h-4 w-4 mr-1.5" />
              Record Payment
            </Button>
          </div>
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Multi-Invoice Rollup Card */}
          <Card className="rounded-2xl border shadow-sm">
            <CardHeader className="p-4 border-b pb-3">
              <CardTitle className="text-sm font-bold flex items-center justify-between">
                <span>Overdue Invoices in Case Rollup</span>
                <span className="font-mono text-xs text-rose-600 font-extrabold">
                  {collectionCase.currency} {Number(collectionCase.totalDebt || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </CardTitle>
              <CardDescription className="text-xs">
                Invoices requiring settlement under this recovery case.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-0">
              {invoices.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  No unpaid invoices found. Case may be pending resolution.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs font-bold">Invoice #</TableHead>
                      <TableHead className="text-xs font-bold">Issued Date</TableHead>
                      <TableHead className="text-xs font-bold text-right">Total Payable</TableHead>
                      <TableHead className="text-xs font-bold text-right">Balance Due</TableHead>
                      <TableHead className="text-xs font-bold text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((inv) => (
                      <TableRow key={inv.id} className="hover:bg-muted/40">
                        <TableCell className="font-mono text-xs font-bold text-foreground">
                          {inv.invoiceNumber}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {inv.issuedAt ? inv.issuedAt.split('T')[0] : 'N/A'}
                        </TableCell>
                        <TableCell className="text-right text-xs font-semibold">
                          {inv.currency || 'GHS'} {Number(inv.totalPayable || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right text-xs font-bold text-rose-600 font-mono">
                          {inv.currency || 'GHS'} {Number(inv.balanceDue ?? inv.totalPayable).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" asChild className="h-7 text-xs text-primary">
                            <Link href={`/admin/finance/invoices/${inv.id}`}>View</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Promise to Pay Timeline Card */}
          <Card className="rounded-2xl border shadow-sm">
            <CardHeader className="p-4 border-b flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                  <Handshake className="h-4 w-4 text-purple-600" />
                  Promise-to-Pay (PTP) Commitments
                </CardTitle>
                <CardDescription className="text-xs">
                  Recorded payment commitments and fulfillment audit.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPtpModalOpen(true)}
                className="rounded-xl h-8 px-2.5 text-xs font-bold active:scale-[0.97]"
              >
                + Record Promise
              </Button>
            </CardHeader>

            <CardContent className="p-4">
              {promises.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground space-y-1">
                  <p className="font-semibold">No Promises Recorded</p>
                  <p>Secure a formal commitment from the debtor to track recovery milestones.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {promises.map((p) => (
                    <div key={p.id} className="p-3 border rounded-xl bg-card space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm font-mono text-foreground">
                            {p.currency} {Number(p.promisedAmount || 0).toLocaleString()}
                          </span>
                          {getPtpBadge(p.status)}
                        </div>
                        <span className="text-[11px] text-muted-foreground font-medium">
                          Due: <strong>{p.promisedDate}</strong>
                        </span>
                      </div>
                      {p.notes && <p className="text-muted-foreground text-[11px] italic">&ldquo;{p.notes}&rdquo;</p>}
                      <div className="text-[10px] text-muted-foreground flex items-center justify-between pt-1 border-t">
                        <span>Method: {p.paymentMethod || 'bank_transfer'}</span>
                        <span>Logged {p.createdAt.split('T')[0]}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Structured Payment Plans Card */}
          <Card className="rounded-2xl border shadow-sm">
            <CardHeader className="p-4 border-b flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                  <Split className="h-4 w-4 text-amber-600" />
                  Structured Installment Plans
                </CardTitle>
                <CardDescription className="text-xs">
                  Active and historical debt restructuring arrangements.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPlanModalOpen(true)}
                className="rounded-xl h-8 px-2.5 text-xs font-bold active:scale-[0.97]"
              >
                + Create Plan
              </Button>
            </CardHeader>

            <CardContent className="p-4">
              {paymentPlans.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground">
                  No active installment payment plan configured.
                </div>
              ) : (
                <div className="space-y-4">
                  {paymentPlans.map((plan) => (
                    <div key={plan.id} className="p-3.5 border rounded-xl bg-card space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <div>
                          <span className="font-mono font-bold text-foreground">{plan.planNumber}</span>
                          <span className="text-muted-foreground text-[11px] ml-2">
                            ({plan.installmentsCount} {plan.frequency} installments)
                          </span>
                        </div>
                        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-bold uppercase text-[10px]">
                          {plan.status}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-3 gap-2 p-2 bg-muted/40 rounded-lg text-center text-xs">
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Total Debt</span>
                          <strong className="text-foreground">{plan.currency} {plan.totalDebt.toLocaleString()}</strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Down Payment</span>
                          <strong className="text-emerald-600">{plan.currency} {plan.downPayment.toLocaleString()}</strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Installment Base</span>
                          <strong className="text-primary">
                            ~{plan.currency} {Math.round((plan.remainingBalance / plan.installmentsCount) * 100) / 100}
                          </strong>
                        </div>
                      </div>

                      {/* Installments Table */}
                      <div className="space-y-1 text-xs">
                        {plan.installments.map((inst) => (
                          <div key={inst.installmentNumber} className="flex items-center justify-between py-1 border-b last:border-0 text-[11px]">
                            <span>Installment #{inst.installmentNumber} (Due: {inst.dueDate})</span>
                            <span className="font-mono font-bold text-foreground">
                              {plan.currency} {inst.amount.toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Sidebar & Activities */}
        <div className="space-y-6">
          {/* Recovery Overview Card */}
          <Card className="rounded-2xl border shadow-sm p-4 space-y-4">
            <CardTitle className="text-sm font-bold">Case Summary</CardTitle>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground">Total Delinquent Debt:</span>
                <span className="font-mono font-bold text-rose-600 text-sm">
                  {collectionCase.currency} {Number(collectionCase.totalDebt || 0).toLocaleString()}
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground">Oldest Overdue:</span>
                <span className="font-semibold text-foreground">{collectionCase.oldestInvoiceDays} days</span>
              </div>

              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground">Assigned Officer:</span>
                <span className="font-semibold text-foreground">{collectionCase.assignedToName || 'Unassigned'}</span>
              </div>

              <div className="space-y-1 pt-1">
                <span className="text-muted-foreground text-[11px] block">Next Action:</span>
                <p className="font-semibold text-foreground bg-muted/60 p-2 rounded-xl text-xs">
                  {collectionCase.nextAction || 'Outreach needed'}
                  {collectionCase.nextActionDate && (
                    <span className="block text-[10px] text-muted-foreground mt-0.5">
                      Target Date: {collectionCase.nextActionDate}
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="space-y-2 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsActivityModalOpen(true)}
                className="w-full rounded-xl h-10 min-h-[44px] justify-start text-xs font-semibold active:scale-[0.97]"
              >
                <PhoneCall className="h-4 w-4 mr-2 text-sky-600" />
                Log Outreach / Call
              </Button>

              <Button
                variant="outline"
                size="sm"
                asChild
                className="w-full rounded-xl h-10 min-h-[44px] justify-start text-xs font-semibold active:scale-[0.97]"
              >
                <Link href={`/admin/finance/accounts/${collectionCase.accountId}/statement`}>
                  <FileText className="h-4 w-4 mr-2 text-primary" />
                  View Statement of Account
                </Link>
              </Button>
            </div>
          </Card>

          {/* Collection Activity Feed Card */}
          <Card className="rounded-2xl border shadow-sm">
            <CardHeader className="p-4 border-b flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm font-bold">Activity Feed</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsActivityModalOpen(true)}
                className="h-7 text-xs text-primary font-bold"
              >
                + Log
              </Button>
            </CardHeader>

            <CardContent className="p-4">
              {activities.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground">
                  No outreach activities logged yet.
                </div>
              ) : (
                <div className="space-y-3.5">
                  {activities.map((act) => (
                    <div key={act.id} className="flex items-start gap-2.5 text-xs">
                      <div className="mt-0.5 p-1.5 rounded-lg bg-muted shrink-0">
                        {getActivityIcon(act.type)}
                      </div>
                      <div className="flex-1 space-y-0.5">
                        <p className="font-semibold text-foreground text-xs">{act.summary}</p>
                        {act.details && <p className="text-[11px] text-muted-foreground">{act.details}</p>}
                        {act.outcome && (
                          <p className="text-[11px] text-emerald-600 font-medium">Outcome: {act.outcome}</p>
                        )}
                        <span className="text-[10px] text-muted-foreground block">
                          {act.performedByName} • {act.timestamp.split('T')[0]}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modals */}
      <RecordPromiseToPayModal
        isOpen={isPtpModalOpen}
        onClose={() => setIsPtpModalOpen(false)}
        caseId={collectionCase.id}
        accountId={collectionCase.accountId}
        entityId={collectionCase.entityId}
        entityName={collectionCase.entityName}
        defaultAmount={collectionCase.totalDebt}
        currency={collectionCase.currency}
        onSuccess={fetchDetails}
      />

      <CreatePaymentPlanModal
        isOpen={isPlanModalOpen}
        onClose={() => setIsPlanModalOpen(false)}
        caseId={collectionCase.id}
        accountId={collectionCase.accountId}
        entityId={collectionCase.entityId}
        entityName={collectionCase.entityName}
        totalDebt={collectionCase.totalDebt}
        currency={collectionCase.currency}
        onSuccess={fetchDetails}
      />

      <LogCollectionActivityModal
        isOpen={isActivityModalOpen}
        onClose={() => setIsActivityModalOpen(false)}
        caseId={collectionCase.id}
        entityId={collectionCase.entityId}
        entityName={collectionCase.entityName}
        onSuccess={fetchDetails}
      />

      <RecordPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        accountId={collectionCase.accountId}
        entityId={collectionCase.entityId}
        entityName={collectionCase.entityName}
        workspaceId={activeWorkspaceId || ''}
        organizationId={collectionCase.organizationId}
        currency={collectionCase.currency}
        preselectedBalanceDue={collectionCase.totalDebt}
        onPaymentSuccess={fetchDetails}
      />
    </div>
  );
}
