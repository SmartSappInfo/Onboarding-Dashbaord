'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc } from 'firebase/firestore';
import { useFirestore, useDoc, useMemoFirebase, useUser } from '@/firebase';
import type { Invoice, InvoiceItem, BillingSettings } from '@/lib/types';
import { updateInvoiceAction } from '@/lib/billing-actions';
import { useToast } from '@/hooks/use-toast';
import { 
    Receipt, 
    Save, 
    Loader2, 
    Plus, 
    Trash2, 
    ArrowLeft,
    CheckCircle2,
    Layout,
    Calculator,
    Zap,
    X
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

/**
 * InvoiceStudioClient - Invoice Editor UI
 * 
 * Entity Resolution: Contact information is resolved server-side via the Contact Adapter
 * during invoice generation. The UI displays and preserves the entity information
 * (schoolName, entityId, entityType) from the invoice record.
 * 
 * Requirements: 8.2, 8.3, 23.1
 */
export default function InvoiceStudioClient() {
    const params = useParams();
    const router = useRouter();
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();
    const invoiceId = params.id as string;

    const [isSaving, setIsSaving] = React.useState(false);
    const [localItems, setLocalItems] = React.useState<InvoiceItem[]>([]);
    const [localDiscount, setLocalDiscount] = React.useState(0);
    const [localArrears, setLocalArrears] = React.useState(0);
    const [localCredit, setLocalCredit] = React.useState(0);

    const invoiceRef = useMemoFirebase(() => firestore ? doc(firestore, 'invoices', invoiceId) : null, [firestore, invoiceId]);
    const { data: invoice, isLoading } = useDoc<Invoice>(invoiceRef);

    const settingsRef = useMemoFirebase(() => firestore ? doc(firestore, 'billing_settings', 'global') : null, [firestore]);
    const { data: settings } = useDoc<BillingSettings>(settingsRef);

    React.useEffect(() => {
        if (invoice) {
            setLocalItems(invoice.items || []);
            setLocalDiscount(invoice.discount || 0);
            setLocalArrears(invoice.arrearsAdded || 0);
            setLocalCredit(invoice.creditDeducted || 0);
        }
    }, [invoice]);

    const totals = React.useMemo(() => {
        const subtotal = localItems.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
        const levyPercent = settings?.levyPercent || 5;
        const vatPercent = settings?.vatPercent || 15;
        
        const levyAmount = (subtotal * levyPercent) / 100;
        const vatAmount = (subtotal * vatPercent) / 100;
        const totalPayable = subtotal + levyAmount + vatAmount + localArrears - localCredit - localDiscount;

        return { subtotal, levyAmount, vatAmount, totalPayable };
    }, [localItems, settings, localArrears, localCredit, localDiscount]);

    const addItem = () => {
        const newItem: InvoiceItem = { name: 'Additional Service', description: '', quantity: 1, unitPrice: 0, amount: 0 };
        setLocalItems([...localItems, newItem]);
    };

    const updateItem = (index: number, updates: Partial<InvoiceItem>) => {
        const next = [...localItems];
        next[index] = { ...next[index], ...updates };
        next[index].amount = next[index].quantity * next[index].unitPrice;
        setLocalItems(next);
    };

    const removeItem = (index: number) => {
        setLocalItems(localItems.filter((_, i) => i !== index));
    };

    const handleSave = async (status: Invoice['status'] = 'draft') => {
        if (!user || !invoice) return;
        setIsSaving(true);

        const updateData = {
            items: localItems,
            discount: localDiscount,
            arrearsAdded: localArrears,
            creditDeducted: localCredit,
            subtotal: totals.subtotal,
            levyAmount: totals.levyAmount,
            vatAmount: totals.vatAmount,
            totalPayable: totals.totalPayable,
            status,
            updatedAt: new Date().toISOString()
        };

        const result = await updateInvoiceAction(invoiceId, updateData, user.uid);
        if (result.success) {
            toast({ title: 'Logic Synchronized', description: 'Institutional record updated successfully.' });
            if (status !== 'draft') router.push('/admin/finance/invoices');
        } else {
            toast({ variant: 'destructive', title: 'Sync Failed', description: result.error });
        }
        setIsSaving(false);
    };

    if (isLoading) return <div className="p-8 flex items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
    if (!invoice) return <div className="p-8 text-center"><p>Invoice not found.</p></div>;

    const isFinalized = invoice.status !== 'draft';

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5 text-left">
            <div className="max-w-6xl mx-auto space-y-8 pb-32">
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" onClick={() => router.push('/admin/finance/invoices')} className="rounded-xl h-10 w-10 p-0"><ArrowLeft className="h-5 w-5" /></Button>
                        <div>
                            <h1 className="text-3xl font-black tracking-tight text-foreground uppercase flex items-center gap-3">
                                <Receipt className="h-8 w-8 text-primary" />
                                Invoice Studio
                            </h1>
                            <p className="text-muted-foreground font-medium mt-1">Reviewing {invoice.invoiceNumber} for {invoice.schoolName}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button variant="outline" onClick={() => handleSave('draft')} disabled={isSaving || isFinalized} className="rounded-xl font-bold h-11 border-primary/20 text-primary">
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                            Save Draft
                        </Button>
                        <Button onClick={() => handleSave('sent')} disabled={isSaving || isFinalized} className="rounded-xl font-black h-11 px-8 shadow-xl shadow-primary/20 uppercase tracking-widest text-xs">
                            <CheckCircle2 className="mr-2 h-4 w-4" /> Finalize & Sync
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Line Items Editor */}
                    <Card className="lg:col-span-2 rounded-[2.5rem] border-none ring-1 ring-border shadow-sm overflow-hidden bg-white">
                        <CardHeader className="bg-muted/30 border-b p-8">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-primary text-white rounded-xl shadow-lg shadow-primary/20"><Layout className="h-5 w-5" /></div>
                                    <div>
                                        <CardTitle className="text-lg font-black uppercase tracking-tight">Invoice Architecture</CardTitle>
                                        <CardDescription className="text-xs font-bold uppercase tracking-widest">Review and modify line items.</CardDescription>
                                    </div>
                                </div>
                                <Button size="sm" variant="outline" onClick={addItem} disabled={isFinalized} className="rounded-lg font-black uppercase text-[10px] tracking-widest border-dashed border-2">
                                    <Plus className="h-3 w-3 mr-1.5" /> Add Service
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader className="bg-muted/10">
                                    <TableRow>
                                        <TableHead className="pl-8 text-[10px] font-black uppercase py-4">Item Detail</TableHead>
                                        <TableHead className="w-24 text-[10px] font-black uppercase text-center">Qty</TableHead>
                                        <TableHead className="w-32 text-[10px] font-black uppercase text-right">Rate</TableHead>
                                        <TableHead className="w-32 text-[10px] font-black uppercase text-right pr-8">Subtotal</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {localItems.map((item, idx) => (
                                        <TableRow key={idx} className="group transition-colors">
                                            <TableCell className="pl-8 py-6">
                                                <div className="space-y-1.5">
                                                    <Input 
                                                        value={item.name} 
                                                        onChange={e => updateItem(idx, { name: e.target.value })} 
                                                        disabled={isFinalized}
                                                        className="font-black text-sm uppercase tracking-tight border-none shadow-none p-0 h-auto bg-transparent focus-visible:ring-0" 
                                                    />
                                                    <Input 
                                                        value={item.description} 
                                                        onChange={e => updateItem(idx, { description: e.target.value })} 
                                                        disabled={isFinalized}
                                                        placeholder="Add specific details..."
                                                        className="text-[10px] font-bold text-muted-foreground border-none shadow-none p-0 h-auto bg-transparent focus-visible:ring-0" 
                                                    />
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Input 
                                                    type="number" 
                                                    value={item.quantity} 
                                                    onChange={e => updateItem(idx, { quantity: Number(e.target.value) })}
                                                    disabled={isFinalized}
                                                    className="h-9 rounded-lg bg-muted/20 border-none font-black text-center shadow-inner" 
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1.5 justify-end">
                                                    <span className="text-[10px] font-black opacity-30">{invoice.currency}</span>
                                                    <Input 
                                                        type="number" 
                                                        step="0.01" 
                                                        value={item.unitPrice} 
                                                        onChange={e => updateItem(idx, { unitPrice: Number(e.target.value) })}
                                                        disabled={isFinalized}
                                                        className="h-9 w-24 rounded-lg bg-muted/20 border-none font-black text-right shadow-inner" 
                                                    />
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right pr-8">
                                                <div className="flex items-center justify-end gap-3">
                                                    <span className="font-black text-sm tabular-nums">{(item.quantity * item.unitPrice).toLocaleString()}</span>
                                                    <Button variant="ghost" size="icon" onClick={() => removeItem(idx)} disabled={isFinalized} className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition-all">
                                                        <X className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    {/* Summary & Adjustments */}
                    <div className="space-y-8">
                        <Card className="rounded-[2rem] border-none ring-1 ring-border shadow-sm overflow-hidden bg-white">
                            <CardHeader className="bg-primary/5 border-b p-8">
                                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                    <Calculator className="h-4 w-4" /> Logic Reconciliation
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-8 space-y-6 text-left">
                                <div className="space-y-4">
                                    <div className="flex justify-between items-end border-b pb-3">
                                        <span className="text-[10px] font-black uppercase text-muted-foreground">Base Subtotal</span>
                                        <span className="text-xl font-black tabular-nums">{invoice.currency} {totals.subtotal.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-end border-b pb-3">
                                        <span className="text-[10px] font-black uppercase text-muted-foreground">Ed. Levy ({settings?.levyPercent}%)</span>
                                        <span className="text-sm font-bold tabular-nums text-foreground/60">{totals.levyAmount.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-end border-b pb-3">
                                        <span className="text-[10px] font-black uppercase text-muted-foreground">VAT ({settings?.vatPercent}%)</span>
                                        <span className="text-sm font-bold tabular-nums text-foreground/60">{totals.vatAmount.toLocaleString()}</span>
                                    </div>
                                </div>

                                <div className="space-y-4 pt-4">
                                    <div className="space-y-2">
                                        <Label className="text-[9px] font-black uppercase text-rose-600 ml-1">Arrears Adjustment</Label>
                                        <Input type="number" step="0.01" value={localArrears} onChange={e => setLocalArrears(Number(e.target.value))} disabled={isFinalized} className="h-10 rounded-xl bg-rose-50 border-none font-black text-rose-700 shadow-inner" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[9px] font-black uppercase text-emerald-600 ml-1">Credit Deduction</Label>
                                        <Input type="number" step="0.01" value={localCredit} onChange={e => setLocalCredit(Number(e.target.value))} disabled={isFinalized} className="h-10 rounded-xl bg-emerald-50 border-none font-black text-emerald-700 shadow-inner" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[9px] font-black uppercase text-primary ml-1">Manual Discount</Label>
                                        <Input type="number" step="0.01" value={localDiscount} onChange={e => setLocalDiscount(Number(e.target.value))} disabled={isFinalized} className="h-10 rounded-xl bg-primary/5 border-none font-black text-primary shadow-inner" />
                                    </div>
                                </div>

                                <div className="pt-6 border-t-4 border-double border-primary/20">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-black uppercase text-primary tracking-[0.2em]">Total Due</span>
                                        <span className="text-3xl font-black tracking-tighter text-foreground tabular-nums">{invoice.currency} {totals.totalPayable.toLocaleString()}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="p-6 rounded-[2rem] bg-amber-50 border border-amber-100 flex items-start gap-5 shadow-sm">
                            <div className="p-3 bg-amber-100 rounded-2xl text-amber-600 shadow-sm"><Zap className="h-6 w-6" /></div>
                            <div className="space-y-1">
                                <p className="text-sm font-black uppercase tracking-tight text-amber-900">Finalization Policy</p>
                                <p className="text-[9px] text-amber-700 leading-relaxed font-bold uppercase tracking-widest opacity-80 text-left">
                                    Once finalized, the invoice is locked for historical integrity. A unique public portal URL will be generated for the campus finance officer.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
