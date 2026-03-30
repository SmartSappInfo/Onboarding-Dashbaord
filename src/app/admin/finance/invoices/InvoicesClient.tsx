
'use client';

import * as React from 'react';
import { collection, query, orderBy, limit, where } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { Invoice, BillingPeriod, School, BillingProfile } from '@/lib/types';
import { format } from 'date-fns';
import { 
    Receipt, 
    Plus, 
    Search, 
    Filter, 
    MoreHorizontal, 
    Download, 
    Eye, 
    Trash2, 
    Loader2, 
    Building, 
    Calendar,
    ArrowRight,
    CheckCircle2,
    Clock,
    AlertCircle,
    FileText,
    TrendingUp,
    Zap,
    Database,
    RotateCcw,
    RefreshCw,
    ShieldCheck
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { generateInvoiceAction, deleteInvoiceAction } from '@/lib/billing-actions';
import { seedBillingData } from '@/lib/seed';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useGlobalFilter } from '@/context/GlobalFilterProvider';
import { useWorkspace } from '@/context/WorkspaceContext';

/**
 * InvoicesClient - Invoice Registry UI
 * 
 * Entity Resolution: Contact information (schoolName, entityId, entityType) is resolved
 * server-side via the Contact Adapter during invoice generation (see billing-actions.ts).
 * The UI displays the pre-resolved entity information from the invoice record.
 * 
 * Requirements: 8.3, 8.5, 23.1
 */
export default function InvoicesClient() {
    const firestore = useFirestore();
    const router = useRouter();
    const { user } = useUser();
    const { toast } = useToast();
    const { assignedUserId, isLoading: isLoadingFilter } = useGlobalFilter();
    const { activeWorkspaceId } = useWorkspace();

    const [searchTerm, setSearchTerm] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState('all');
    const [isAdding, setIsAdding] = React.useState(false);
    const [isGenerating, setIsGenerating] = React.useState(false);

    // Form State
    const [selectedSchoolId, setSelectedSchoolId] = React.useState<string | null>(null);
    const [selectedPeriodId, setSelectedPeriodId] = React.useState<string | null>(null);
    const [selectedProfileId, setSelectedProfileId] = React.useState<string | null>(null);

    // Filtered Invoices via array-contains
    const invoicesQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(
            collection(firestore, 'invoices'), 
            where('workspaceIds', 'array-contains', activeWorkspaceId),
            orderBy('createdAt', 'desc'), 
            limit(100)
        );
    }, [firestore, activeWorkspaceId]);

    const schoolsQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(
            collection(firestore, 'schools'), 
            where('workspaceIds', 'array-contains', activeWorkspaceId),
            orderBy('name', 'asc')
        );
    }, [firestore, activeWorkspaceId]);

    const periodsQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(
            collection(firestore, 'billing_periods'), 
            where('status', '==', 'open'), 
            where('workspaceIds', 'array-contains', activeWorkspaceId),
            orderBy('startDate', 'desc')
        );
    }, [firestore, activeWorkspaceId]);

    const profilesQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(
            collection(firestore, 'billing_profiles'),
            where('workspaceIds', 'array-contains', activeWorkspaceId),
            orderBy('name', 'asc')
        );
    }, [firestore, activeWorkspaceId]);

    const { data: invoices, isLoading: isLoadingInvoices } = useCollection<Invoice>(invoicesQuery);
    const { data: schools, isLoading: isLoadingSchools } = useCollection<School>(schoolsQuery);
    const { data: periods } = useCollection<BillingPeriod>(periodsQuery);
    const { data: profiles } = useCollection<BillingProfile>(profilesQuery);

    const handleGenerate = async () => {
        if (!selectedSchoolId || !selectedPeriodId || !selectedProfileId || !user) {
            toast({ variant: 'destructive', title: 'Context Missing', description: 'Institutional record, cycle, and billing profile are mandatory.' });
            return;
        }
        setIsGenerating(true);
        const result = await generateInvoiceAction(
            selectedSchoolId, 
            selectedPeriodId, 
            selectedProfileId,
            user.uid, 
            activeWorkspaceId
        );
        if (result.success && result.id) {
            toast({ title: 'Invoice Initialized' });
            setIsAdding(false);
            router.push(`/admin/finance/invoices/${result.id}`);
        } else {
            toast({ variant: 'destructive', title: 'Generation Failed', description: result.error });
        }
        setIsGenerating(false);
    };

    const handleDelete = async (invoice: Invoice) => {
        if (!user || !confirm(`Permanently delete ${invoice.invoiceNumber}?`)) return;
        const result = await deleteInvoiceAction(invoice.id, invoice.invoiceNumber, user.uid);
        if (result.success) toast({ title: 'Invoice Removed' });
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'paid': return <Badge className="bg-emerald-500 text-white border-none text-[8px] h-5 uppercase px-2 font-black">Paid</Badge>;
            case 'draft': return <Badge variant="secondary" className="text-[8px] h-5 uppercase px-2 font-black">Draft</Badge>;
            case 'sent': return <Badge className="bg-blue-500 text-white border-none text-[8px] h-5 uppercase px-2 font-black">Sent</Badge>;
            case 'overdue': return <Badge variant="destructive" className="text-[8px] h-5 uppercase px-2 font-black animate-pulse">Overdue</Badge>;
            default: return <Badge variant="outline" className="text-[8px] h-5 uppercase px-2 font-black">{status}</Badge>;
        }
    };

    const filteredInvoices = React.useMemo(() => {
        if (!invoices) return [];
        let temp = invoices;
        if (statusFilter !== 'all') temp = temp.filter(i => i.status === statusFilter);
        if (searchTerm) {
            const s = searchTerm.toLowerCase();
            temp = temp.filter(i => i.schoolName?.toLowerCase().includes(s) || i.invoiceNumber.toLowerCase().includes(s));
        }
        return temp;
    }, [invoices, statusFilter, searchTerm]);

    const isLoading = isLoadingInvoices || isLoadingSchools || isLoadingFilter;

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5 text-left">
            <div className="max-w-7xl mx-auto space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight text-foreground uppercase flex items-center gap-3">
                            <Receipt className="h-8 w-8 text-primary" />
                            Invoice Registry
                        </h1>
                        <p className="text-muted-foreground font-medium mt-1">Institutional billing records for the {activeWorkspaceId} track.</p>
                    </div>
                    <Button onClick={() => setIsAdding(true)} className="rounded-xl font-black uppercase tracking-widest shadow-lg h-12 px-8 transition-all active:scale-95">
                        <Plus className="mr-2 h-5 w-5" /> Initialize Invoice
                    </Button>
                </div>

                <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden bg-card">
                    <CardContent className="p-4 flex flex-wrap items-center gap-4">
                        <div className="flex-grow min-w-[240px] relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-40" />
                            <Input 
                                placeholder="Search reference or school..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-10 h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold"
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[160px] h-11 rounded-xl bg-muted/20 border-none font-black uppercase text-[10px] tracking-widest">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="all">Global View</SelectItem>
                                <SelectItem value="draft">Drafts</SelectItem>
                                <SelectItem value="sent">Sent</SelectItem>
                                <SelectItem value="paid">Paid</SelectItem>
                                <SelectItem value="overdue">Overdue</SelectItem>
                            </SelectContent>
                        </Select>
                    </CardContent>
                </Card>

                <div className="rounded-[2rem] border border-border/50 bg-card shadow-sm overflow-hidden ring-1 ring-black/5">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest pl-8 py-5">Invoice Reference</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest">Institution</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest">Cycle</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Total Payable</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Status</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-right pr-8">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-12 w-full" /></TableCell></TableRow>
                                ))
                            ) : filteredInvoices.length > 0 ? (
                                filteredInvoices.map((invoice) => (
                                    <TableRow key={invoice.id} className="group hover:bg-muted/30 transition-colors">
                                        <TableCell className="pl-8 py-4">
                                            <span className="font-black text-foreground uppercase tracking-tight">{invoice.invoiceNumber}</span>
                                            <p className="text-[9px] font-bold text-muted-foreground uppercase opacity-60 tabular-nums">{format(new Date(invoice.createdAt), 'MMM d, yyyy')}</p>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-xs font-black uppercase text-foreground/80">{invoice.schoolName}</span>
                                        </TableCell>
                                        <TableCell className="text-[10px] font-bold text-muted-foreground uppercase">{invoice.periodName}</TableCell>
                                        <TableCell className="text-right font-black text-sm tabular-nums">
                                            {invoice.currency} {invoice.totalPayable.toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-center">{getStatusBadge(invoice.status)}</TableCell>
                                        <TableCell className="text-right pr-8">
                                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" asChild>
                                                    <Link href={`/admin/finance/invoices/${invoice.id}`}><Eye className="h-4 w-4 text-primary" /></Link>
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg" onClick={() => handleDelete(invoice)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow><TableCell colSpan={6} className="h-48 text-center text-muted-foreground opacity-40">No matching records found.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Creation Dialog */}
            <Dialog open={isAdding} onOpenChange={setIsAdding}>
                <DialogContent className="sm:max-w-md rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
                    <form onSubmit={(e) => { e.preventDefault(); handleGenerate(); }}>
                        <DialogHeader className="p-8 bg-muted/30 border-b shrink-0 text-left">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-primary text-white rounded-2xl shadow-xl shadow-primary/20"><Plus className="h-6 w-6" /></div>
                                <div>
                                    <DialogTitle className="text-2xl font-black uppercase tracking-tight">Initialize bill</DialogTitle>
                                    <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Select targets and bind financial logic</DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>
                        <div className="p-8 space-y-8 text-left bg-background">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">1. Target Institution</Label>
                                <Select onValueChange={setSelectedSchoolId} value={selectedSchoolId || ''}>
                                    <SelectTrigger className="h-12 rounded-xl bg-muted/20 border-none shadow-none font-bold"><SelectValue placeholder="Select school..." /></SelectTrigger>
                                    <SelectContent className="rounded-xl">{schools?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">2. Billing Cycle</Label>
                                <Select onValueChange={setSelectedPeriodId} value={selectedPeriodId || ''}>
                                    <SelectTrigger className="h-12 rounded-xl bg-muted/20 border-none shadow-none font-bold"><SelectValue placeholder="Select cycle..." /></SelectTrigger>
                                    <SelectContent className="rounded-xl">{periods?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1 flex items-center gap-2"><ShieldCheck className="h-3 w-3" /> 3. Financial Protocol (Profile)</Label>
                                <Select onValueChange={setSelectedProfileId} value={selectedProfileId || ''}>
                                    <SelectTrigger className="h-12 rounded-xl bg-primary/5 border-primary/20 shadow-sm font-black text-primary"><SelectValue placeholder="Pick billing profile..." /></SelectTrigger>
                                    <SelectContent className="rounded-xl">{profiles?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter className="p-6 bg-muted/30 border-t flex justify-between gap-3 items-center">
                            <Button type="button" variant="ghost" onClick={() => setIsAdding(false)} className="font-bold rounded-xl h-12 px-8">Discard</Button>
                            <Button onClick={handleGenerate} disabled={isGenerating || !selectedSchoolId || !selectedPeriodId || !selectedProfileId} className="rounded-xl font-black h-12 px-10 shadow-2xl bg-primary text-white gap-2 uppercase tracking-widest text-sm">
                                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />} Generate Draft
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
