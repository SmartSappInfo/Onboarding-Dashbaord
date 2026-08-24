'use client';

import * as React from 'react';
import { collection, query, orderBy, limit, where } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { Invoice, BillingPeriod, BillingProfile } from '@/lib/types';
import { UnifiedEntitySelector } from '@/components/entities/UnifiedEntitySelector';
import { format } from 'date-fns';
import { 
    Receipt, 
    Plus, 
    Search, 
    Eye, 
    Trash2, 
    Loader2, 
    Building, 
    CheckCircle2, 
    Clock, 
    AlertCircle, 
    TrendingUp, 
    Zap, 
    CreditCard,
    AlertTriangle,
    FileMinus
} from 'lucide-react';
import { RecordPaymentModal } from '@/components/finance/RecordPaymentModal';
import { VoidInvoiceModal } from '@/components/finance/VoidInvoiceModal';
import { CreateCreditNoteModal } from '@/components/finance/CreateCreditNoteModal';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription, 
    DialogFooter 
} from '@/components/ui/dialog';
import { generateInvoiceAction, deleteInvoiceAction } from '@/lib/billing-actions';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { usePermissions } from '@/hooks/use-permissions';
import { useGlobalFilter } from '@/context/GlobalFilterProvider';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useTerminology } from '@/hooks/use-terminology';
import { PageContainerFluid } from '@/components/ui/page-container';

/**
 * InvoicesClient - Invoice Registry UI
 * 
 * Upgraded with:
 * - SmartSapp Finance 2.0 Multi-State Lifecycle Engine (Draft, Issued, Sent, Paid, Void, Cancelled, Disputed).
 * - Controlled Voiding with Sub-Ledger Compensating Reversals.
 * - UnifiedEntitySelector integration with full filtering & segmentation.
 * - Financial KPI Metrics Bar (Total Invoiced, Paid, Drafts, Overdue).
 * - Multi-Status Tabs (All, Drafts, Issued, Paid, Overdue, Voided).
 * - Actionable Toasts with relative navigation paths.
 * - Zero `any` usage, strict typing, Emil Kowalski animations.
 */
export default function InvoicesClient() {
    const firestore = useFirestore();
    const router = useRouter();
    const { user } = useUser();
    const { toast } = useToast();
    const confirm = useConfirm();
    const { singular } = useTerminology();
    const { isLoading: isLoadingFilter } = useGlobalFilter();
    const { activeWorkspaceId, activeWorkspace } = useWorkspace();

    const [searchTerm, setSearchTerm] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<string>('all');
    const [isAdding, setIsAdding] = React.useState(false);
    const [isGenerating, setIsGenerating] = React.useState(false);
    const [payingInvoice, setPayingInvoice] = React.useState<Invoice | null>(null);
    const [voidingInvoice, setVoidingInvoice] = React.useState<Invoice | null>(null);
    const [creditingInvoice, setCreditingInvoice] = React.useState<Invoice | null>(null);

    const { can } = usePermissions();
    const canCreate = can('finance', 'invoices', 'create');
    const canDelete = can('finance', 'invoices', 'delete');

    // Form State
    const [selectedEntityId, setSelectedEntityId] = React.useState<string | null>(null);
    const [selectedPeriodId, setSelectedPeriodId] = React.useState<string | null>(null);
    const [selectedProfileId, setSelectedProfileId] = React.useState<string | null>(null);

    // Filtered Invoices query scoped by active workspace
    const invoicesQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(
            collection(firestore, 'invoices'), 
            where('workspaceIds', 'array-contains', activeWorkspaceId),
            orderBy('createdAt', 'desc'), 
            limit(150)
        );
    }, [firestore, activeWorkspaceId]);

    const { data: invoices, isLoading: isLoadingInvoices } = useCollection<Invoice>(invoicesQuery);

    // Periods query
    const periodsQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(
            collection(firestore, 'billing_periods'), 
            where('workspaceIds', 'array-contains', activeWorkspaceId),
            limit(50)
        );
    }, [firestore, activeWorkspaceId]);
    const { data: periods } = useCollection<BillingPeriod>(periodsQuery);

    // Profiles query
    const profilesQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(
            collection(firestore, 'billing_profiles'), 
            where('workspaceIds', 'array-contains', activeWorkspaceId),
            limit(50)
        );
    }, [firestore, activeWorkspaceId]);
    const { data: profiles } = useCollection<BillingProfile>(profilesQuery);

    // Set defaults when opening modal
    React.useEffect(() => {
        if (isAdding) {
            if (periods && periods.length > 0 && !selectedPeriodId) {
                const active = periods.find(p => p.status === 'open') || periods[0];
                setSelectedPeriodId(active.id);
            }
            if (profiles && profiles.length > 0 && !selectedProfileId) {
                setSelectedProfileId(profiles[0].id);
            }
        }
    }, [isAdding, periods, profiles, selectedPeriodId, selectedProfileId]);

    // Financial KPI Metrics
    const kpiMetrics = React.useMemo(() => {
        if (!invoices) return { totalInvoiced: 0, totalPaid: 0, totalDraft: 0, totalOverdue: 0, count: 0 };
        return invoices.reduce(
            (acc, inv) => {
                if (inv.status === 'void' || inv.lifecycleStatus === 'void') {
                    return acc; // Voided invoices are excluded from gross invoiced KPIs
                }
                acc.count++;
                acc.totalInvoiced += Number(inv.totalPayable) || 0;
                acc.totalPaid += Number(inv.amountPaid) || 0;
                if (inv.status === 'draft') {
                    acc.totalDraft += Number(inv.totalPayable) || 0;
                }
                if (inv.status === 'overdue') {
                    acc.totalOverdue += Number(inv.balanceDue ?? inv.totalPayable) || 0;
                }
                return acc;
            },
            { totalInvoiced: 0, totalPaid: 0, totalDraft: 0, totalOverdue: 0, count: 0 }
        );
    }, [invoices]);

    // Status Tab Counts
    const statusCounts = React.useMemo(() => {
        const counts: Record<string, number> = { all: 0, draft: 0, issued: 0, sent: 0, paid: 0, overdue: 0, void: 0 };
        if (!invoices) return counts;
        counts.all = invoices.length;
        invoices.forEach((i) => {
            if (i.status === 'void' || i.lifecycleStatus === 'void') {
                counts.void = (counts.void || 0) + 1;
            } else if (i.status === 'issued') {
                counts.issued = (counts.issued || 0) + 1;
            } else if (i.status === 'sent') {
                counts.sent = (counts.sent || 0) + 1;
            } else if (i.status === 'paid') {
                counts.paid = (counts.paid || 0) + 1;
            } else if (i.status === 'draft') {
                counts.draft = (counts.draft || 0) + 1;
            } else if (i.status === 'overdue') {
                counts.overdue = (counts.overdue || 0) + 1;
            }
        });
        return counts;
    }, [invoices]);

    const handleGenerate = async () => {
        if (!selectedEntityId || !selectedPeriodId || !selectedProfileId) {
            toast({
                variant: 'destructive',
                title: 'Missing Context',
                description: `Please select a target ${singular.toLowerCase()}, billing cycle, and billing profile.`
            });
            return;
        }

        if (!user) {
            toast({
                variant: 'destructive',
                title: 'Authentication Required',
                description: 'You must be logged in to initialize billing.'
            });
            return;
        }

        setIsGenerating(true);
        const result = await generateInvoiceAction(
            selectedEntityId, 
            selectedPeriodId, 
            selectedProfileId, 
            user.uid,
            activeWorkspaceId
        );

        if (result.success && result.id) {
            toast({ 
                title: 'Invoice Initialized',
                description: 'Draft invoice created with financial logic bound.'
            });
            setIsAdding(false);
            setSelectedEntityId(null);
            router.push(`/admin/finance/invoices/${result.id}`);
        } else {
            toast({ 
                variant: 'destructive', 
                title: 'Generation Failed', 
                description: result.error 
            });
        }
        setIsGenerating(false);
    };

    const handleDelete = async (invoice: Invoice) => {
        if (!user) return;
        if (!(await confirm({ 
            title: 'Delete draft invoice?', 
            description: `${invoice.invoiceNumber} will be permanently removed.`, 
            confirmText: 'Delete', 
            variant: 'destructive' 
        }))) return;

        const result = await deleteInvoiceAction(invoice.id, invoice.invoiceNumber, user.uid);
        if (result.success) {
            toast({ title: 'Draft Removed' });
        } else {
            toast({ variant: 'destructive', title: 'Deletion Failed', description: result.error });
        }
    };

    const getStatusBadge = (invoice: Invoice) => {
        const status = invoice.status;
        const isVoid = status === 'void' || invoice.lifecycleStatus === 'void';
        if (isVoid) {
            return <Badge variant="destructive" className="bg-rose-500/10 text-rose-600 border border-rose-500/20 text-[9px] h-5 uppercase px-2 font-bold">Void</Badge>;
        }
        if (invoice.collectionStatus === 'disputed') {
            return <Badge className="bg-purple-500/10 text-purple-600 border border-purple-500/20 text-[9px] h-5 uppercase px-2 font-bold">Disputed</Badge>;
        }
        switch (status) {
            case 'paid': 
                return <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[9px] h-5 uppercase px-2 font-bold">Paid</Badge>;
            case 'draft': 
                return <Badge variant="secondary" className="text-[9px] h-5 uppercase px-2 font-bold">Draft</Badge>;
            case 'issued': 
            case 'sent': 
                return <Badge className="bg-blue-500/10 text-blue-600 border border-blue-500/20 text-[9px] h-5 uppercase px-2 font-bold">Issued</Badge>;
            case 'partial':
                return <Badge className="bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[9px] h-5 uppercase px-2 font-bold">Partial</Badge>;
            case 'overdue': 
                return <Badge variant="destructive" className="text-[9px] h-5 uppercase px-2 font-bold animate-pulse">Overdue</Badge>;
            default: 
                return <Badge variant="outline" className="text-[9px] h-5 uppercase px-2 font-bold">{status}</Badge>;
        }
    };

    const filteredInvoices = React.useMemo(() => {
        if (!invoices) return [];
        let temp = invoices;
        if (statusFilter !== 'all') {
            if (statusFilter === 'void') {
                temp = temp.filter((i) => i.status === 'void' || i.lifecycleStatus === 'void');
            } else if (statusFilter === 'issued') {
                temp = temp.filter((i) => (i.status === 'issued' || i.status === 'sent') && i.lifecycleStatus !== 'void');
            } else {
                temp = temp.filter((i) => i.status === statusFilter);
            }
        }
        if (searchTerm) {
            const s = searchTerm.toLowerCase();
            temp = temp.filter((i) => 
                i.entityName?.toLowerCase().includes(s) || 
                i.invoiceNumber.toLowerCase().includes(s) ||
                i.periodName?.toLowerCase().includes(s)
            );
        }
        return temp;
    }, [invoices, statusFilter, searchTerm]);

    const isLoading = isLoadingInvoices || isLoadingFilter;
    const defaultCurrency = invoices?.[0]?.currency || 'GHS';

    return (
        <PageContainerFluid>
            <div className="h-full overflow-y-auto w-full">
                <div className="space-y-6 pb-32 w-full">
                    {/* Header Row */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex flex-col items-start text-left">
                            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
                                <Receipt className="h-8 w-8 text-primary" />
                                Invoice Registry
                            </h1>
                            <p className="text-muted-foreground text-xs mt-1">
                                Institutional billing records & financial cycles for {activeWorkspace?.name || activeWorkspaceId}
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            {canCreate && (
                                <Button 
                                    onClick={() => setIsAdding(true)} 
                                    className="rounded-xl font-bold shadow-sm h-11 px-6 active:scale-[0.97] transition-all text-white bg-primary hover:bg-primary/90"
                                >
                                    <Plus className="mr-2 h-4 w-4" /> Initialize Invoice
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* KPI Metrics Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                        <Card className="rounded-2xl border border-border/70 shadow-xs bg-card/60 p-4 space-y-2 text-left">
                            <div className="flex items-center justify-between text-muted-foreground">
                                <span className="text-[10px] font-bold uppercase tracking-wider">Total Invoiced</span>
                                <TrendingUp className="h-4 w-4 text-primary" />
                            </div>
                            <p className="text-xl font-black text-foreground tabular-nums">
                                {defaultCurrency} {kpiMetrics.totalInvoiced.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                            <p className="text-[10px] text-muted-foreground font-medium">Across {kpiMetrics.count} active records</p>
                        </Card>

                        <Card className="rounded-2xl border border-border/70 shadow-xs bg-card/60 p-4 space-y-2 text-left">
                            <div className="flex items-center justify-between text-muted-foreground">
                                <span className="text-[10px] font-bold uppercase tracking-wider">Settled & Paid</span>
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            </div>
                            <p className="text-xl font-black text-emerald-600 tabular-nums">
                                {defaultCurrency} {kpiMetrics.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                            <p className="text-[10px] text-muted-foreground font-medium">Realized revenue</p>
                        </Card>

                        <Card className="rounded-2xl border border-border/70 shadow-xs bg-card/60 p-4 space-y-2 text-left">
                            <div className="flex items-center justify-between text-muted-foreground">
                                <span className="text-[10px] font-bold uppercase tracking-wider">Draft Volume</span>
                                <Clock className="h-4 w-4 text-amber-500" />
                            </div>
                            <p className="text-xl font-black text-foreground tabular-nums">
                                {defaultCurrency} {kpiMetrics.totalDraft.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                            <p className="text-[10px] text-muted-foreground font-medium">Unfinalized drafts</p>
                        </Card>

                        <Card className="rounded-2xl border border-border/70 shadow-xs bg-card/60 p-4 space-y-2 text-left">
                            <div className="flex items-center justify-between text-muted-foreground">
                                <span className="text-[10px] font-bold uppercase tracking-wider">Overdue</span>
                                <AlertCircle className="h-4 w-4 text-destructive" />
                            </div>
                            <p className="text-xl font-black text-destructive tabular-nums">
                                {defaultCurrency} {kpiMetrics.totalOverdue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                            <p className="text-[10px] text-muted-foreground font-medium">Outstanding balances</p>
                        </Card>
                    </div>

                    {/* Filter & Tab Controls Bar */}
                    <Card className="border border-border shadow-xs rounded-2xl overflow-hidden bg-card/40 text-left">
                        <CardContent className="p-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-left">
                            {/* Status Pills */}
                            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                                {[
                                    { id: 'all', label: 'All Invoices' },
                                    { id: 'draft', label: 'Drafts' },
                                    { id: 'issued', label: 'Issued' },
                                    { id: 'paid', label: 'Paid' },
                                    { id: 'overdue', label: 'Overdue' },
                                    { id: 'void', label: 'Voided' },
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setStatusFilter(tab.id)}
                                        className={cn(
                                            'px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap active:scale-[0.97]',
                                            statusFilter === tab.id
                                                ? 'bg-primary text-white shadow-xs'
                                                : 'bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/60'
                                        )}
                                    >
                                        {tab.label}
                                        <span className={cn(
                                            'text-[9px] px-1.5 py-0.2 rounded-full font-extrabold',
                                            statusFilter === tab.id ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
                                        )}>
                                            {statusCounts[tab.id] || 0}
                                        </span>
                                    </button>
                                ))}
                            </div>

                            {/* Search Input */}
                            <div className="relative min-w-[240px] max-w-sm">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground opacity-50" />
                                <Input 
                                    placeholder={`Search reference or ${singular.toLowerCase()}...`} 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9 h-11 min-h-[44px] bg-background border-border/80 text-foreground placeholder:text-muted-foreground rounded-xl text-xs font-medium"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Table View */}
                    <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden text-left">
                        <Table className="text-left">
                            <TableHeader className="bg-muted/20 text-left">
                                <TableRow className="text-left">
                                    <TableHead className="text-[10px] font-bold uppercase tracking-wider pl-6 py-4 text-left">Invoice Reference</TableHead>
                                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-left">Target {singular}</TableHead>
                                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-left">Billing Cycle</TableHead>
                                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-right">Total Billed</TableHead>
                                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-right">Balance Due</TableHead>
                                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-center">Status</TableHead>
                                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-right pr-6">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody className="text-left">
                                {isLoading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <TableRow key={i}>
                                             <TableCell colSpan={7} className="py-4 px-6">
                                                <Skeleton className="h-10 w-full rounded-xl" />
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : filteredInvoices.length > 0 ? (
                                    filteredInvoices.map((invoice) => {
                                        const isVoid = invoice.status === 'void' || invoice.lifecycleStatus === 'void';
                                        const amountPaid = Number(invoice.amountPaid || 0);
                                        const balanceDue = Number(invoice.balanceDue ?? Math.max(0, invoice.totalPayable - amountPaid));

                                        return (
                                            <TableRow key={invoice.id} className="group hover:bg-muted/25 transition-colors text-left">
                                                <TableCell className="pl-6 py-3.5 text-left">
                                                    <span className="font-bold text-xs text-foreground tracking-tight block text-left">
                                                        {invoice.invoiceNumber}
                                                    </span>
                                                    <span className="text-[10px] font-semibold text-muted-foreground tabular-nums text-left">
                                                        {format(new Date(invoice.createdAt), 'MMM d, yyyy')}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-left">
                                                    <span className="text-xs font-bold text-foreground text-left block">
                                                        {invoice.entityName}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-[11px] font-semibold text-muted-foreground text-left">
                                                    {invoice.periodName}
                                                </TableCell>
                                                <TableCell className="text-right font-black text-xs tabular-nums text-foreground">
                                                    {invoice.currency} {invoice.totalPayable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="text-right">
                                                        <div className="font-bold text-xs tabular-nums">
                                                            {isVoid ? (
                                                                <span className="text-muted-foreground line-through">
                                                                    {invoice.currency} {invoice.totalPayable.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                </span>
                                                            ) : balanceDue > 0 ? (
                                                                <span className="text-rose-600 dark:text-rose-400">
                                                                    {invoice.currency} {balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </span>
                                                            ) : (
                                                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                                                    Settled
                                                                </span>
                                                            )}
                                                        </div>
                                                        {!isVoid && amountPaid > 0 && balanceDue > 0 && (
                                                            <div className="text-[10px] text-muted-foreground tabular-nums">
                                                                Paid: {invoice.currency} {amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {getStatusBadge(invoice)}
                                                </TableCell>
                                                <TableCell className="text-right pr-6">
                                                    <div className="flex items-center justify-end gap-1">
                                                        {!isVoid && invoice.status !== 'draft' && balanceDue > 0 && (
                                                            <Button 
                                                                variant="ghost" 
                                                                size="sm" 
                                                                className="h-8 px-2 rounded-lg text-xs font-bold text-emerald-600 hover:bg-emerald-500/10 active:scale-[0.97]" 
                                                                onClick={() => setPayingInvoice(invoice)}
                                                                title="Record Payment"
                                                            >
                                                                <CreditCard className="h-3.5 w-3.5 mr-1" /> Pay
                                                            </Button>
                                                        )}
                                                        <Button 
                                                            variant="ghost" 
                                                            size="sm" 
                                                            className="h-8 px-2.5 rounded-lg text-xs font-bold text-primary hover:bg-primary/10 active:scale-[0.97]" 
                                                            asChild
                                                        >
                                                            <Link href={`/admin/finance/invoices/${invoice.id}`}>
                                                                <Eye className="h-3.5 w-3.5 mr-1" /> View
                                                            </Link>
                                                        </Button>
                                                        {!isVoid && invoice.status !== 'draft' && Number(invoice.balanceDue ?? invoice.totalPayable ?? 0) > 0 && (
                                                            <Button 
                                                                variant="ghost" 
                                                                size="sm" 
                                                                className="h-8 px-2 rounded-lg text-xs font-bold text-rose-600 hover:bg-rose-500/10 active:scale-[0.97]" 
                                                                onClick={() => setCreditingInvoice(invoice)}
                                                                title="Issue Credit Note"
                                                            >
                                                                <FileMinus className="h-3.5 w-3.5 mr-1" /> Credit
                                                            </Button>
                                                        )}
                                                        {!isVoid && invoice.status !== 'draft' && canDelete && (
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                className="h-8 w-8 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 rounded-lg active:scale-[0.97]" 
                                                                onClick={() => setVoidingInvoice(invoice)}
                                                                title="Void Invoice"
                                                            >
                                                                <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                                                            </Button>
                                                        )}
                                                        {invoice.status === 'draft' && canDelete && (
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg active:scale-[0.97]" 
                                                                onClick={() => handleDelete(invoice)}
                                                                title="Delete Draft"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                ) : (
                                    <TableRow className="text-left">
                                        <TableCell colSpan={7} className="h-44 text-center text-muted-foreground">
                                            <Building className="h-7 w-7 mx-auto mb-2 opacity-30" />
                                            <p className="text-xs font-semibold">No invoice records found.</p>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Initialize Invoice Dialog */}
                    <Dialog open={isAdding} onOpenChange={setIsAdding}>
                        <DialogContent className="sm:max-w-lg rounded-2xl p-0 overflow-hidden border border-border shadow-2xl text-left bg-card">
                            <form onSubmit={(e) => { e.preventDefault(); handleGenerate(); }}>
                                <DialogHeader className="p-6 bg-muted/20 border-b shrink-0 text-left">
                                    <DialogTitle className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                                        <Receipt className="h-5 w-5 text-primary" /> Initialize Billing Record
                                    </DialogTitle>
                                    <DialogDescription className="text-xs text-muted-foreground">
                                        Select target {singular.toLowerCase()} and binding profile. Rate, headcount, and taxes will be applied automatically.
                                    </DialogDescription>
                                </DialogHeader>

                                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                                    {/* Unified Entity Selector */}
                                    <div className="space-y-1.5 text-left">
                                        <Label className="text-xs font-bold text-foreground">
                                            Target {singular} *
                                        </Label>
                                        <UnifiedEntitySelector
                                            value={selectedEntityId}
                                            onChange={(val) => setSelectedEntityId(val || null)}
                                            valueKey="id"
                                            placeholder={`Select target ${singular.toLowerCase()}...`}
                                        />
                                    </div>

                                    {/* Billing Cycle */}
                                    <div className="space-y-1.5 text-left">
                                        <Label className="text-xs font-bold text-foreground">Billing Cycle / Period *</Label>
                                        <Select value={selectedPeriodId || ''} onValueChange={setSelectedPeriodId}>
                                            <SelectTrigger className="rounded-xl h-11 min-h-[44px] bg-background font-semibold text-xs text-foreground">
                                                <SelectValue placeholder="Select Cycle" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl">
                                                {periods?.map((period) => (
                                                    <SelectItem key={period.id} value={period.id} className="text-xs">
                                                        {period.name} {period.status === 'open' ? '(Current)' : ''}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Billing Profile */}
                                    <div className="space-y-1.5 text-left">
                                        <Label className="text-xs font-bold text-foreground">Billing Protocol / Tax Profile *</Label>
                                        <Select value={selectedProfileId || ''} onValueChange={setSelectedProfileId}>
                                            <SelectTrigger className="rounded-xl h-11 min-h-[44px] bg-background font-semibold text-xs text-foreground">
                                                <SelectValue placeholder="Select Profile" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl">
                                                {profiles?.map((profile) => (
                                                    <SelectItem key={profile.id} value={profile.id} className="text-xs">
                                                        {profile.name} (VAT: {profile.vatPercent}%, Levy: {profile.levyPercent}%)
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <DialogFooter className="p-4 bg-muted/20 border-t flex flex-col-reverse sm:flex-row items-center justify-end gap-2 shrink-0">
                                    <Button 
                                        type="button" 
                                        variant="outline" 
                                        onClick={() => setIsAdding(false)} 
                                        className="rounded-xl h-11 min-h-[44px] px-5 text-xs font-semibold active:scale-[0.97]"
                                    >
                                        Cancel
                                    </Button>
                                    <Button 
                                        type="submit" 
                                        onClick={handleGenerate} 
                                        disabled={isGenerating || !selectedEntityId || !selectedPeriodId || !selectedProfileId} 
                                        className="rounded-xl font-bold h-11 min-h-[44px] px-6 shadow-md bg-primary text-white gap-2 text-xs text-left active:scale-[0.97]"
                                    >
                                        {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />} 
                                        Generate Draft
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>

                    {/* Record Payment Settlement Modal */}
                    {payingInvoice && (
                        <RecordPaymentModal
                            isOpen={!!payingInvoice}
                            onClose={() => setPayingInvoice(null)}
                            entityId={payingInvoice.entityId || ''}
                            entityName={payingInvoice.entityName || 'Organization'}
                            workspaceId={payingInvoice.workspaceIds?.[0] || activeWorkspaceId}
                            organizationId={payingInvoice.organizationId || 'default'}
                            accountId={payingInvoice.accountId || ''}
                            currency={payingInvoice.currency || 'GHS'}
                            preselectedInvoiceId={payingInvoice.id}
                            preselectedInvoiceNumber={payingInvoice.invoiceNumber}
                            preselectedBalanceDue={Number(payingInvoice.balanceDue ?? Math.max(0, payingInvoice.totalPayable - (payingInvoice.amountPaid || 0)))}
                            onPaymentSuccess={() => {
                                toast({ title: 'Payment Synchronized', description: 'Ledger and invoice balances updated.' });
                            }}
                        />
                    )}

                    {/* Void Invoice Modal */}
                    {voidingInvoice && (
                        <VoidInvoiceModal
                            isOpen={!!voidingInvoice}
                            onClose={() => setVoidingInvoice(null)}
                            invoice={voidingInvoice}
                            onVoidSuccess={() => {
                                toast({ title: 'Invoice Voided', description: 'Compensating ledger reversal posted.' });
                            }}
                        />
                    )}

                    {/* Create Credit Note Modal */}
                    {creditingInvoice && (
                        <CreateCreditNoteModal
                            isOpen={!!creditingInvoice}
                            onClose={() => setCreditingInvoice(null)}
                            invoice={creditingInvoice}
                            onSuccess={() => {
                                toast({ title: 'Credit Note Applied', description: 'Invoice balance and sub-ledger updated.' });
                            }}
                        />
                    )}
                </div>
            </div>
        </PageContainerFluid>
    );
}
