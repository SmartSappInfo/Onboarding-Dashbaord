'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc } from 'firebase/firestore';
import { useFirestore, useDoc, useMemoFirebase, useUser } from '@/firebase';
import type { Invoice, InvoiceItem, BillingProfile, PaymentAllocation } from '@/lib/types';
import { updateInvoiceAction } from '@/lib/billing-actions';
import { getInvoiceAllocationsAction } from '@/lib/finance-actions';
import { RecordPaymentModal } from '@/components/finance/RecordPaymentModal';
import { VoidInvoiceModal } from '@/components/finance/VoidInvoiceModal';
import { InvoiceSnapshotView } from '@/components/finance/InvoiceSnapshotView';
import { useToast } from '@/hooks/use-toast';
import { 
    Receipt, 
    Save, 
    Loader2, 
    Plus, 
    ArrowLeft,
    CheckCircle2, 
    Layout, 
    Calculator, 
    Zap, 
    X,
    CreditCard,
    Split,
    AlertTriangle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageContainerFluid } from '@/components/ui/page-container';

/**
 * InvoiceStudioClient - Invoice Editor UI
 * 
 * Upgraded to:
 * - SmartSapp Finance 2.0 Multi-State Lifecycle Engine (Draft, Issued, Sent, Paid, Void, Cancelled, Disputed).
 * - Immutable Point-in-time Snapshot display upon finalization.
 * - Controlled Voiding with Sub-Ledger Compensating Reversals.
 * - Integrated Sub-Ledger & Record Payment settlement modal.
 * - Strict typing with zero `any` usage.
 * - Emil Kowalski animations & 44px mobile touch targets.
 */
export default function InvoiceStudioClient() {
    const params = useParams();
    const router = useRouter();
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();
    const invoiceId = (params?.id as string) || '';

    const [isSaving, setIsSaving] = React.useState(false);
    const [isRecordPaymentOpen, setIsRecordPaymentOpen] = React.useState(false);
    const [isVoidModalOpen, setIsVoidModalOpen] = React.useState(false);
    const [allocations, setAllocations] = React.useState<PaymentAllocation[]>([]);
    const [localItems, setLocalItems] = React.useState<InvoiceItem[]>([]);
    const [localDiscount, setLocalDiscount] = React.useState(0);
    const [localArrears, setLocalArrears] = React.useState(0);
    const [localCredit, setLocalCredit] = React.useState(0);

    const invoiceRef = useMemoFirebase(
        () => (firestore && invoiceId ? doc(firestore, 'invoices', invoiceId) : null),
        [firestore, invoiceId]
    );
    const { data: invoice, isLoading: isLoadingInvoice } = useDoc<Invoice>(invoiceRef);

    // Profile Reference: Bind directly to the profile attached to this invoice
    const profileRef = useMemoFirebase(
        () => (firestore && invoice?.billingProfileId ? doc(firestore, 'billing_profiles', invoice.billingProfileId) : null),
        [firestore, invoice?.billingProfileId]
    );
    const { data: profile } = useDoc<BillingProfile>(profileRef);

    React.useEffect(() => {
        if (invoice) {
            setLocalItems(invoice.items || []);
            setLocalDiscount(invoice.discount || 0);
            setLocalArrears(invoice.arrearsAdded || 0);
            setLocalCredit(invoice.creditDeducted || 0);
        }
    }, [invoice]);

    React.useEffect(() => {
        if (invoiceId) {
            getInvoiceAllocationsAction(invoiceId).then((res) => {
                if (res.success && res.data) {
                    setAllocations(res.data);
                }
            });
        }
    }, [invoiceId, invoice?.amountPaid]);

    const totals = React.useMemo(() => {
        const subtotal = localItems.reduce((acc, item) => acc + ((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)), 0);
        
        // Rate resolution hierarchy: Profile doc -> Invoice snapshot -> Default 0
        const levyPercent = profile?.levyPercent !== undefined 
            ? profile.levyPercent 
            : invoice?.subtotal && invoice.levyAmount 
                ? (invoice.levyAmount / invoice.subtotal) * 100 
                : 5;

        const vatPercent = profile?.vatPercent !== undefined 
            ? profile.vatPercent 
            : invoice?.subtotal && invoice.vatAmount 
                ? (invoice.vatAmount / invoice.subtotal) * 100 
                : 15;
        
        const levyAmount = Math.round(((subtotal * levyPercent) / 100) * 100) / 100;
        const vatAmount = Math.round(((subtotal * vatPercent) / 100) * 100) / 100;
        
        const totalPayable = Math.max(0, Math.round((subtotal + levyAmount + vatAmount + localArrears - localCredit - localDiscount) * 100) / 100);

        return {
            subtotal: Math.round(subtotal * 100) / 100,
            levyAmount,
            vatAmount,
            levyPercent,
            vatPercent,
            totalPayable
        };
    }, [localItems, profile, invoice, localArrears, localCredit, localDiscount]);

    const handleItemChange = (index: number, field: keyof InvoiceItem, value: string | number) => {
        const next = [...localItems];
        const current = { ...next[index], [field]: value };
        current.amount = Math.round(((Number(current.quantity) || 0) * (Number(current.unitPrice) || 0)) * 100) / 100;
        next[index] = current;
        setLocalItems(next);
    };

    const addItem = () => {
        setLocalItems(prev => [
            ...prev,
            { name: 'Additional Service / Assessment', description: '', quantity: 1, unitPrice: 0, amount: 0 }
        ]);
    };

    const removeItem = (index: number) => {
        setLocalItems(prev => prev.filter((_, i) => i !== index));
    };

    const handleSave = async (statusOverride?: Invoice['status']) => {
        if (!invoice || !user) return;
        setIsSaving(true);
        try {
            const res = await updateInvoiceAction(invoice.id, {
                items: localItems,
                discount: localDiscount,
                arrearsAdded: localArrears,
                creditDeducted: localCredit,
                subtotal: totals.subtotal,
                levyAmount: totals.levyAmount,
                vatAmount: totals.vatAmount,
                totalPayable: totals.totalPayable,
                status: statusOverride || invoice.status
            }, user.uid);

            if (res.success) {
                toast({
                    title: statusOverride === 'sent' ? 'Invoice Finalized & Issued' : 'Draft Saved',
                    description: statusOverride === 'sent'
                        ? 'Invoice posted to ledger and immutable snapshot captured.'
                        : 'Draft updates saved successfully.'
                });
            } else {
                toast({
                    variant: 'destructive',
                    title: 'Save Failed',
                    description: res.error || 'Could not update invoice.'
                });
            }
        } catch {
            toast({
                variant: 'destructive',
                title: 'Operation Failed',
                description: 'An unexpected error occurred.'
            });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoadingInvoice) {
        return (
            <PageContainerFluid>
                <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm font-semibold text-muted-foreground animate-pulse">Loading Invoice Studio...</p>
                </div>
            </PageContainerFluid>
        );
    }

    if (!invoice) {
        return (
            <PageContainerFluid>
                <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                    <Receipt className="h-12 w-12 text-muted-foreground" />
                    <p className="text-base font-bold text-foreground">Invoice Document Not Found</p>
                    <Button onClick={() => router.push('/admin/finance/invoices')} variant="outline" className="rounded-xl active:scale-[0.97]">
                        Return to Invoices
                    </Button>
                </div>
            </PageContainerFluid>
        );
    }

    const isFinalized = invoice.status !== 'draft';
    const isVoided = invoice.status === 'void' || invoice.lifecycleStatus === 'void';
    const amountPaid = Number(invoice.amountPaid || 0);
    const balanceDue = Number(invoice.balanceDue ?? Math.max(0, totals.totalPayable - amountPaid));
    const paymentStatus = invoice.paymentStatus || (invoice.status === 'paid' ? 'paid' : amountPaid > 0 ? 'partially_paid' : 'unpaid');

    return (
        <PageContainerFluid>
            <div className="h-full overflow-y-auto w-full">
                <div className="max-w-5xl mx-auto space-y-6 pb-32">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => router.push('/admin/finance/invoices')} 
                                className="rounded-xl h-10 w-10 text-muted-foreground hover:text-primary active:scale-[0.97]"
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
                                    <Receipt className="h-7 w-7 text-primary" />
                                    Invoice Studio
                                </h1>
                                <p className="text-muted-foreground text-xs mt-0.5">
                                    Reviewing <span className="font-bold text-foreground">{invoice.invoiceNumber}</span> for <span className="font-bold text-foreground">{invoice.entityName}</span>
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5">
                            {isFinalized && !isVoided && balanceDue > 0 && (
                                <Button 
                                    onClick={() => setIsRecordPaymentOpen(true)} 
                                    className="rounded-xl font-bold text-xs h-11 min-h-[44px] px-5 shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.97]"
                                >
                                    <CreditCard className="mr-1.5 h-4 w-4" /> Record Payment
                                </Button>
                            )}

                            {isFinalized && !isVoided && (
                                <Button 
                                    variant="outline" 
                                    onClick={() => setIsVoidModalOpen(true)} 
                                    className="rounded-xl font-bold text-xs h-11 min-h-[44px] px-4 border-rose-500/30 text-rose-600 hover:bg-rose-500/10 active:scale-[0.97]"
                                >
                                    <AlertTriangle className="mr-1.5 h-4 w-4" /> Void Invoice
                                </Button>
                            )}

                            {!isFinalized && (
                                <>
                                    <Button 
                                        variant="outline" 
                                        onClick={() => handleSave('draft')} 
                                        disabled={isSaving} 
                                        className="rounded-xl font-bold text-xs h-11 min-h-[44px] px-4 border-primary/20 text-primary active:scale-[0.97]"
                                    >
                                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
                                        Save Draft
                                    </Button>
                                    <Button 
                                        onClick={() => handleSave('sent')} 
                                        disabled={isSaving} 
                                        className="rounded-xl font-bold text-xs h-11 min-h-[44px] px-5 shadow-sm text-white bg-primary hover:bg-primary/90 active:scale-[0.97]"
                                    >
                                        <CheckCircle2 className="mr-1.5 h-4 w-4" /> Finalize & Issue
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Voided Banner */}
                    {isVoided && (
                        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between text-left">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-rose-500/20 text-rose-600 rounded-xl">
                                    <AlertTriangle className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-rose-700 dark:text-rose-300">Invoice Voided</h3>
                                    <p className="text-xs text-muted-foreground">
                                        {invoice.voidAudit?.voidReason || 'This invoice has been voided and ledger debit reversed.'}
                                    </p>
                                </div>
                            </div>
                            <Badge variant="destructive" className="uppercase font-bold text-xs">Void</Badge>
                        </div>
                    )}

                    {/* Main Layout Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Line Items Editor & Snapshot Panel */}
                        <div className="lg:col-span-2 space-y-6">
                            <Card className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden text-left">
                                <CardHeader className="bg-muted/20 border-b p-5">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="p-2 bg-primary/10 text-primary rounded-xl">
                                                <Layout className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <CardTitle className="text-sm font-bold tracking-tight">Invoice Architecture</CardTitle>
                                                <CardDescription className="text-xs text-muted-foreground">Modify services, student headcount, or custom line items.</CardDescription>
                                            </div>
                                        </div>
                                        {!isFinalized && (
                                            <Button 
                                                size="sm" 
                                                variant="outline" 
                                                onClick={addItem} 
                                                className="rounded-lg font-bold text-xs h-8 border-dashed border-2 active:scale-[0.97]"
                                            >
                                                <Plus className="h-3.5 w-3.5 mr-1" /> Add Item
                                            </Button>
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <Table>
                                        <TableHeader className="bg-muted/10">
                                            <TableRow>
                                                <TableHead className="w-[45%] text-xs font-bold">Service / Line Item</TableHead>
                                                <TableHead className="w-[20%] text-xs font-bold text-center">Qty</TableHead>
                                                <TableHead className="w-[25%] text-xs font-bold text-right">Unit Rate ({invoice.currency || 'GHS'})</TableHead>
                                                {!isFinalized && <TableHead className="w-[10%] text-xs font-bold text-center">Action</TableHead>}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {localItems.map((item, idx) => (
                                                <TableRow key={idx} className="hover:bg-muted/5">
                                                    <TableCell className="space-y-1">
                                                        <Input 
                                                            value={item.name} 
                                                            onChange={(e) => handleItemChange(idx, 'name', e.target.value)} 
                                                            placeholder="Item title" 
                                                            disabled={isFinalized}
                                                            className="h-8 font-bold text-xs rounded-lg"
                                                        />
                                                        <Input 
                                                            value={item.description || ''} 
                                                            onChange={(e) => handleItemChange(idx, 'description', e.target.value)} 
                                                            placeholder="Additional notes / scope" 
                                                            disabled={isFinalized}
                                                            className="h-7 text-[11px] text-muted-foreground rounded-lg"
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input 
                                                            type="number" 
                                                            value={item.quantity} 
                                                            onChange={(e) => handleItemChange(idx, 'quantity', Number(e.target.value))} 
                                                            disabled={isFinalized}
                                                            className="h-8 text-center font-bold text-xs rounded-lg"
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input 
                                                            type="number" 
                                                            step="0.01" 
                                                            value={item.unitPrice} 
                                                            onChange={(e) => handleItemChange(idx, 'unitPrice', Number(e.target.value))} 
                                                            disabled={isFinalized}
                                                            className="h-8 text-right font-bold text-xs rounded-lg"
                                                        />
                                                    </TableCell>
                                                    {!isFinalized && (
                                                        <TableCell className="text-center">
                                                            <Button 
                                                                size="icon" 
                                                                variant="ghost" 
                                                                onClick={() => removeItem(idx)} 
                                                                className="h-8 w-8 text-muted-foreground hover:text-destructive rounded-lg active:scale-[0.97]"
                                                            >
                                                                <X className="h-4 w-4" />
                                                            </Button>
                                                        </TableCell>
                                                    )}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>

                            {/* Snapshot View when Finalized */}
                            {isFinalized && (
                                <InvoiceSnapshotView
                                    snapshot={invoice.snapshot}
                                    voidAudit={invoice.voidAudit}
                                    currency={invoice.currency}
                                />
                            )}
                        </div>

                        {/* Financial Ledger & Breakdown Sidebar */}
                        <div className="space-y-6">
                            {/* Settlement Status Card */}
                            {isFinalized && (
                                <Card className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden text-left">
                                    <CardHeader className="bg-muted/20 border-b p-5">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Split className="h-4 w-4 text-primary" />
                                                <CardTitle className="text-xs font-bold uppercase tracking-wider">
                                                    Settlement State
                                                </CardTitle>
                                            </div>
                                            <Badge
                                                variant={
                                                    isVoided
                                                        ? 'destructive'
                                                        : paymentStatus === 'paid'
                                                        ? 'default'
                                                        : paymentStatus === 'partially_paid'
                                                        ? 'secondary'
                                                        : 'outline'
                                                }
                                                className="text-[10px] uppercase font-bold"
                                            >
                                                {isVoided ? 'Voided' : paymentStatus}
                                            </Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-5 space-y-4">
                                        <div className="grid grid-cols-2 gap-3 text-center">
                                            <div className="p-3 bg-muted/40 rounded-xl border">
                                                <div className="text-[10px] text-muted-foreground uppercase font-bold">Paid to Date</div>
                                                <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                                    {invoice.currency || 'GHS'} {amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </div>
                                            </div>
                                            <div className="p-3 bg-primary/5 rounded-xl border border-primary/20">
                                                <div className="text-[10px] text-primary uppercase font-bold">Balance Due</div>
                                                <div className="text-sm font-bold text-primary">
                                                    {invoice.currency || 'GHS'} {balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </div>
                                            </div>
                                        </div>

                                        {allocations.length > 0 && (
                                            <div className="space-y-2 pt-2 border-t text-xs">
                                                <div className="text-[11px] font-bold text-muted-foreground uppercase">
                                                    Remittance Allocations ({allocations.length})
                                                </div>
                                                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                                                    {allocations.map((a) => (
                                                        <div key={a.id} className="flex justify-between items-center p-2 rounded-lg bg-muted/30 text-[11px]">
                                                            <span className="font-medium text-foreground">
                                                                {a.allocatedAt ? new Date(a.allocatedAt).toLocaleDateString() : 'Settled'}
                                                            </span>
                                                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                                                +{invoice.currency || 'GHS'} {a.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            )}

                            {/* Statutory Calculations Card */}
                            <Card className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden text-left">
                                <CardHeader className="bg-muted/20 border-b p-5">
                                    <div className="flex items-center gap-2.5">
                                        <div className="p-2 bg-primary/10 text-primary rounded-xl">
                                            <Calculator className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-sm font-bold tracking-tight">Statutory Calculations</CardTitle>
                                            <CardDescription className="text-xs text-muted-foreground">
                                                Profile: <span className="font-semibold text-foreground">{profile?.name || 'Default Profile'}</span>
                                            </CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-5 space-y-3.5">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-muted-foreground">Subtotal:</span>
                                        <span className="font-bold">{invoice.currency || 'GHS'} {totals.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                                        <span>Levy Profile ({totals.levyPercent}%):</span>
                                        <span className="font-medium">+{invoice.currency || 'GHS'} {totals.levyAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                                        <span>VAT Profile ({totals.vatPercent}%):</span>
                                        <span className="font-medium">+{invoice.currency || 'GHS'} {totals.vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </div>

                                    <div className="pt-3 border-t border-border flex justify-between items-center">
                                        <span className="text-sm font-bold text-foreground">Total Invoiced:</span>
                                        <span className="text-base font-extrabold text-primary tabular-nums">
                                            {invoice.currency || 'GHS'} {totals.totalPayable.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>

                                    {/* Manual Modifiers Grid */}
                                    <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                                        <div className="space-y-1">
                                            <Label className="text-[10px] font-bold text-rose-600 ml-1">Arrears (+)</Label>
                                            <Input 
                                                type="number" 
                                                step="0.01" 
                                                value={localArrears} 
                                                onChange={(e) => setLocalArrears(Number(e.target.value))} 
                                                disabled={isFinalized} 
                                                className="h-9 rounded-xl bg-rose-500/10 border-rose-500/20 font-bold text-xs text-rose-700 dark:text-rose-400" 
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] font-bold text-emerald-600 ml-1">Credit Deduction (-)</Label>
                                            <Input 
                                                type="number" 
                                                step="0.01" 
                                                value={localCredit} 
                                                onChange={(e) => setLocalCredit(Number(e.target.value))} 
                                                disabled={isFinalized} 
                                                className="h-9 rounded-xl bg-emerald-500/10 border-emerald-500/20 font-bold text-xs text-emerald-700 dark:text-emerald-400" 
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] font-bold text-primary ml-1">Manual Discount (-)</Label>
                                            <Input 
                                                type="number" 
                                                step="0.01" 
                                                value={localDiscount} 
                                                onChange={(e) => setLocalDiscount(Number(e.target.value))} 
                                                disabled={isFinalized} 
                                                className="h-9 rounded-xl bg-primary/5 border-primary/20 font-bold text-xs text-primary" 
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3.5">
                                <Zap className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                                <div className="space-y-0.5 text-left">
                                    <p className="text-xs font-bold text-amber-900 dark:text-amber-300">Finalization Protocol</p>
                                    <p className="text-[10px] text-amber-800 dark:text-amber-400 leading-relaxed font-medium">
                                        Once finalized, the invoice amounts are locked, sequential numbering is assigned, and immutable snapshots are captured.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Record Payment Modal */}
            {invoice && (
                <RecordPaymentModal
                    isOpen={isRecordPaymentOpen}
                    onClose={() => setIsRecordPaymentOpen(false)}
                    entityId={invoice.entityId || ''}
                    entityName={invoice.entityName || 'Organization'}
                    workspaceId={invoice.workspaceIds?.[0] || 'default'}
                    organizationId={invoice.organizationId || 'default'}
                    accountId={invoice.accountId || ''}
                    currency={invoice.currency || 'GHS'}
                    preselectedInvoiceId={invoice.id}
                    preselectedInvoiceNumber={invoice.invoiceNumber}
                    preselectedBalanceDue={balanceDue}
                    onPaymentSuccess={() => {
                        toast({ title: 'Payment Synchronized', description: 'Ledger and invoice balances updated.' });
                    }}
                />
            )}

            {/* Void Invoice Modal */}
            {invoice && (
                <VoidInvoiceModal
                    isOpen={isVoidModalOpen}
                    onClose={() => setIsVoidModalOpen(false)}
                    invoice={invoice}
                    onVoidSuccess={() => {
                        toast({ title: 'Invoice Voided', description: 'Compensating ledger reversal posted.' });
                    }}
                />
            )}
        </PageContainerFluid>
    );
}
