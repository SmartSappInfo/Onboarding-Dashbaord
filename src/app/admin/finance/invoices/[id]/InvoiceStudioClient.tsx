'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc } from 'firebase/firestore';
import { useFirestore, useDoc, useMemoFirebase, useUser } from '@/firebase';
import type { Invoice, InvoiceItem, BillingProfile, PaymentAllocation } from '@/lib/types';
import { updateInvoiceAction } from '@/lib/billing-actions';
import { getInvoiceAllocationsAction } from '@/lib/finance-actions';
import { RecordPaymentModal } from '@/components/finance/RecordPaymentModal';
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
    ShieldCheck,
    CreditCard,
    Split
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
 * - Bind tax & levy calculations directly to the invoice's selected `billingProfileId`
 *   (from `billing_profiles` collection), deprecating legacy global doc fallback.
 * - Integrated SmartSapp Finance 2.0 Sub-Ledger & Record Payment settlement modal.
 * - Enforce strict typing with zero `any` usage.
 * - Emil Kowalski animation and mobile accessibility compliance.
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
        const calculatedTotal = subtotal + levyAmount + vatAmount + (Number(localArrears) || 0) - (Number(localCredit) || 0) - (Number(localDiscount) || 0);
        const totalPayable = Math.max(0, Math.round(calculatedTotal * 100) / 100);

        return { 
            subtotal: Math.round(subtotal * 100) / 100, 
            levyPercent, 
            vatPercent, 
            levyAmount, 
            vatAmount, 
            totalPayable 
        };
    }, [localItems, profile, invoice, localArrears, localCredit, localDiscount]);

    const addItem = () => {
        const newItem: InvoiceItem = { 
            name: 'Additional Service', 
            description: '', 
            quantity: 1, 
            unitPrice: 0, 
            amount: 0 
        };
        setLocalItems((prev) => [...prev, newItem]);
    };

    const updateItem = (index: number, updates: Partial<InvoiceItem>) => {
        setLocalItems((prev) => {
            const next = [...prev];
            const current = next[index];
            const updated = { ...current, ...updates };
            const qty = Number(updated.quantity) || 0;
            const price = Number(updated.unitPrice) || 0;
            updated.amount = Math.round(qty * price * 100) / 100;
            next[index] = updated;
            return next;
        });
    };

    const removeItem = (index: number) => {
        setLocalItems((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSave = async (status: Invoice['status'] = 'draft') => {
        if (!user || !invoice) return;
        setIsSaving(true);

        const updateData: Partial<Invoice> = {
            items: localItems,
            discount: Number(localDiscount) || 0,
            arrearsAdded: Number(localArrears) || 0,
            creditDeducted: Number(localCredit) || 0,
            subtotal: totals.subtotal,
            levyAmount: totals.levyAmount,
            vatAmount: totals.vatAmount,
            totalPayable: totals.totalPayable,
            status,
            updatedAt: new Date().toISOString()
        };

        const result = await updateInvoiceAction(invoiceId, updateData, user.uid);
        if (result.success) {
            toast({ 
                title: 'Logic Synchronized', 
                description: status === 'draft' 
                    ? 'Draft changes saved successfully.' 
                    : status === 'paid'
                        ? 'Invoice marked as Paid.'
                        : 'Invoice finalized and published.' 
            });
            if (status !== 'draft') {
                router.push('/admin/finance/invoices');
            }
        } else {
            toast({ variant: 'destructive', title: 'Sync Failed', description: result.error });
        }
        setIsSaving(false);
    };

    if (isLoadingInvoice) {
        return (
            <div className="p-16 flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-xs font-semibold text-muted-foreground">Loading Invoice Studio...</p>
            </div>
        );
    }

    if (!invoice) {
        return (
            <div className="p-16 text-center space-y-3">
                <Receipt className="h-10 w-10 mx-auto text-muted-foreground opacity-40" />
                <p className="text-sm font-bold">Invoice not found.</p>
                <Button 
                    variant="outline" 
                    onClick={() => router.push('/admin/finance/invoices')}
                    className="h-9 px-4 rounded-xl text-xs font-semibold active:scale-[0.97]"
                >
                    Return to Registry
                </Button>
            </div>
        );
    }

    const isFinalized = invoice.status !== 'draft';
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

                        <div className="flex items-center gap-2.5">
                            {isFinalized && balanceDue > 0 && (
                                <Button 
                                    onClick={() => setIsRecordPaymentOpen(true)} 
                                    className="rounded-xl font-bold text-xs h-10 px-5 shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.97]"
                                >
                                    <CreditCard className="mr-1.5 h-3.5 w-3.5" /> Record Payment
                                </Button>
                            )}
                            <Button 
                                variant="outline" 
                                onClick={() => handleSave('draft')} 
                                disabled={isSaving || isFinalized} 
                                className="rounded-xl font-bold text-xs h-10 px-4 border-primary/20 text-primary active:scale-[0.97]"
                            >
                                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                                Save Draft
                            </Button>
                            <Button 
                                onClick={() => handleSave('sent')} 
                                disabled={isSaving || isFinalized} 
                                className="rounded-xl font-bold text-xs h-10 px-5 shadow-sm text-white bg-primary hover:bg-primary/90 active:scale-[0.97]"
                            >
                                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Finalize & Sync
                            </Button>
                        </div>
                    </div>

                    {/* Main Layout Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Line Items Editor */}
                        <Card className="lg:col-span-2 rounded-2xl border border-border bg-card shadow-xs overflow-hidden text-left">
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
                                    <Button 
                                        size="sm" 
                                        variant="outline" 
                                        onClick={addItem} 
                                        disabled={isFinalized} 
                                        className="rounded-lg font-bold text-xs h-8 border-dashed border-2 active:scale-[0.97]"
                                    >
                                        <Plus className="h-3.5 w-3.5 mr-1" /> Add Item
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader className="bg-muted/10">
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead className="text-xs font-bold text-muted-foreground pl-6">Service / Item</TableHead>
                                            <TableHead className="text-xs font-bold text-muted-foreground w-24 text-center">Qty / Head</TableHead>
                                            <TableHead className="text-xs font-bold text-muted-foreground w-28 text-right">Rate ({invoice.currency})</TableHead>
                                            <TableHead className="text-xs font-bold text-muted-foreground w-36 text-right pr-6">Amount ({invoice.currency})</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {localItems.map((item, idx) => (
                                            <TableRow key={idx} className="group hover:bg-muted/5 transition-colors">
                                                <TableCell className="pl-6 py-4">
                                                    <div className="space-y-1">
                                                        <Input 
                                                            value={item.name} 
                                                            onChange={(e) => updateItem(idx, { name: e.target.value })}
                                                            disabled={isFinalized}
                                                            placeholder="Service Name"
                                                            className="h-8 font-bold text-xs rounded-lg bg-transparent border-none focus-visible:bg-muted/40 transition-colors p-0" 
                                                        />
                                                        <Input 
                                                            value={item.description || ''} 
                                                            onChange={(e) => updateItem(idx, { description: e.target.value })}
                                                            disabled={isFinalized}
                                                            placeholder="Description or billing metrics..."
                                                            className="h-6 text-[11px] text-muted-foreground rounded-md bg-transparent border-none focus-visible:bg-muted/40 transition-colors p-0" 
                                                        />
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Input 
                                                        type="number" 
                                                        min="1"
                                                        value={item.quantity} 
                                                        onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
                                                        disabled={isFinalized}
                                                        className="h-8 w-16 mx-auto rounded-lg bg-muted/20 border-none font-bold text-center text-xs shadow-inner" 
                                                    />
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end">
                                                        <Input 
                                                            type="number" 
                                                            step="0.01" 
                                                            value={item.unitPrice} 
                                                            onChange={(e) => updateItem(idx, { unitPrice: Number(e.target.value) })}
                                                            disabled={isFinalized}
                                                            className="h-8 w-20 rounded-lg bg-muted/20 border-none font-bold text-right text-xs shadow-inner" 
                                                        />
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right pr-6">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <span className="font-bold text-xs tabular-nums text-foreground">
                                                            {(Number(item.quantity) * Number(item.unitPrice)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </span>
                                                        {!isFinalized && localItems.length > 1 && (
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                onClick={() => removeItem(idx)} 
                                                                className="h-6 w-6 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all rounded-md"
                                                            >
                                                                <X className="h-3 w-3" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        {/* Summary & Adjustments Panel */}
                        <div className="space-y-5 text-left">
                            {/* Settlement & Balance Card */}
                            <Card className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
                                <CardHeader className="bg-muted/20 border-b p-5 flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle className="text-xs font-bold text-foreground flex items-center gap-2">
                                            <CreditCard className="h-4 w-4 text-primary" /> Settlement State
                                        </CardTitle>
                                        <CardDescription className="text-[11px] text-muted-foreground">
                                            Live collection & sub-ledger sync
                                        </CardDescription>
                                    </div>
                                    <Badge 
                                        variant="outline" 
                                        className={`rounded-lg text-[10px] font-bold uppercase px-2 py-0.5 ${
                                            paymentStatus === 'paid' 
                                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                                : paymentStatus === 'partially_paid'
                                                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                                        }`}
                                    >
                                        {paymentStatus === 'paid' ? 'Paid in Full' : paymentStatus === 'partially_paid' ? 'Partially Paid' : 'Unpaid'}
                                    </Badge>
                                </CardHeader>
                                <CardContent className="p-5 space-y-3.5">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-muted-foreground font-medium">Total Billed</span>
                                        <span className="font-bold tabular-nums text-foreground">
                                            {invoice.currency} {totals.totalPayable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-muted-foreground font-medium">Amount Settled</span>
                                        <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                                            {invoice.currency} {amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                    <div className="pt-2 border-t flex justify-between items-center">
                                        <span className="text-xs font-bold text-foreground">Balance Due</span>
                                        <span className={`text-xl font-black tabular-nums ${balanceDue > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600'}`}>
                                            {invoice.currency} {balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>

                                    {/* Allocations Breakdown */}
                                    {allocations.length > 0 && (
                                        <div className="pt-2 border-t space-y-1.5">
                                            <div className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                                                <Split className="h-3 w-3 text-primary" /> Remittance History
                                            </div>
                                            <div className="space-y-1 max-h-28 overflow-y-auto divide-y divide-border/40 text-[11px]">
                                                {allocations.map((alloc) => (
                                                    <div key={alloc.id} className="py-1 flex justify-between items-center">
                                                        <span className="text-muted-foreground">{new Date(alloc.allocatedAt).toLocaleDateString()}</span>
                                                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                                            +{alloc.currency} {alloc.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {isFinalized && balanceDue > 0 && (
                                        <Button 
                                            onClick={() => setIsRecordPaymentOpen(true)} 
                                            className="w-full rounded-xl font-bold text-xs h-9 shadow-xs text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.97] mt-1"
                                        >
                                            <CreditCard className="mr-1.5 h-3.5 w-3.5" /> Record Payment
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Logic Reconciliation Card */}
                            <Card className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
                                <CardHeader className="bg-primary/5 border-b p-5">
                                    <CardTitle className="text-xs font-bold text-primary flex items-center gap-2">
                                        <Calculator className="h-4 w-4" /> Logic Reconciliation
                                    </CardTitle>
                                    {profile?.name && (
                                        <p className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1 mt-0.5">
                                            <ShieldCheck className="h-3 w-3 text-primary" />
                                            Bound to: {profile.name}
                                        </p>
                                    )}
                                </CardHeader>
                                <CardContent className="p-5 space-y-4 text-left">
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center border-b pb-2">
                                            <span className="text-xs font-medium text-muted-foreground">Base Subtotal</span>
                                            <span className="text-sm font-bold tabular-nums">
                                                {invoice.currency} {totals.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center border-b pb-2">
                                            <span className="text-xs font-medium text-muted-foreground">
                                                Levy ({totals.levyPercent}%)
                                            </span>
                                            <span className="text-xs font-bold tabular-nums text-foreground/80">
                                                {totals.levyAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center border-b pb-2">
                                            <span className="text-xs font-medium text-muted-foreground">
                                                VAT ({totals.vatPercent}%)
                                            </span>
                                            <span className="text-xs font-bold tabular-nums text-foreground/80">
                                                {totals.vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="space-y-3 pt-2">
                                        <div className="space-y-1">
                                            <Label className="text-[10px] font-bold text-rose-600 ml-1">Arrears Addition (+)</Label>
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
                                        Once finalized, the invoice amounts are locked and posted to the customer ledger. The public invoice view will be immediately available.
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
        </PageContainerFluid>
    );
}
