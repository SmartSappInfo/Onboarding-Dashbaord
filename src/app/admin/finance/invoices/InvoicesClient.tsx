'use client';

import * as React from 'react';
import { collection, query, orderBy, limit, where } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { Invoice, BillingPeriod, School, UserProfile } from '@/lib/types';
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
    RotateCcw
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
    const [isSeeding, setIsSeeding] = React.useState(false);

    // Form State for new invoice
    const [selectedSchoolId, setSelectedSchoolId] = React.useState<string | null>(null);
    const [selectedPeriodId, setSelectedPeriodId] = React.useState<string | null>(null);

    // Data Subscriptions
    const invoicesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'invoices'), orderBy('createdAt', 'desc'), limit(100)) : null, 
    [firestore]);

    const schoolsQuery = useMemoFirebase(() => 
        firestore ? query(
            collection(firestore, 'schools'), 
            where('workspaceId', '==', activeWorkspaceId),
            orderBy('name', 'asc')
        ) : null, 
    [firestore, activeWorkspaceId]);

    const periodsQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'billing_periods'), where('status', '==', 'open'), orderBy('startDate', 'desc')) : null, 
    [firestore]);

    const usersQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'users'), orderBy('name', 'asc')) : null, 
    [firestore]);

    const { data: invoices, isLoading: isLoadingInvoices } = useCollection<Invoice>(invoicesQuery);
    const { data: schools, isLoading: isLoadingSchools } = useCollection<School>(schoolsQuery);
    const { data: periods } = useCollection<BillingPeriod>(periodsQuery);
    const { data: users, isLoading: isLoadingUsers } = useCollection<UserProfile>(usersQuery);

    const schoolAssignmentMap = React.useMemo(() => {
        if (!schools) return new Map<string, string | null>();
        return new Map(schools.map(s => [s.id, s.assignedTo?.userId || null]));
    }, [schools]);

    const filteredInvoices = React.useMemo(() => {
        if (!invoices || !schools) return [];
        
        // 1. FILTER BY WORKSPACE
        const validSchoolIds = new Set(schools.map(s => s.id));
        let temp = invoices.filter(i => validSchoolIds.has(i.schoolId));

        // 2. GLOBAL USER FILTER
        if (assignedUserId) {
            temp = temp.filter(invoice => {
                const assignedTo = schoolAssignmentMap.get(invoice.schoolId);
                if (assignedUserId === 'unassigned') return !assignedTo;
                return assignedTo === assignedUserId;
            });
        }

        if (statusFilter !== 'all') temp = temp.filter(i => i.status === statusFilter);
        if (searchTerm) {
            const s = searchTerm.toLowerCase();
            temp = temp.filter(i => i.schoolName.toLowerCase().includes(s) || i.invoiceNumber.toLowerCase().includes(s));
        }
        return temp;
    }, [invoices, schools, statusFilter, searchTerm, assignedUserId, schoolAssignmentMap]);

    const handleGenerate = async () => {
        if (!selectedSchoolId || !selectedPeriodId || !user) return;
        setIsGenerating(true);
        const result = await generateInvoiceAction(selectedSchoolId, selectedPeriodId, user.uid);
        if (result.success && result.id) {
            toast({ title: 'Invoice Initialized', description: 'Draft has been created in the registry.' });
            setIsAdding(false);
            router.push(`/admin/finance/invoices/${result.id}`);
        } else {
            toast({ variant: 'destructive', title: 'Generation Failed', description: result.error });
        }
        setIsGenerating(false);
    };

    const handleSeedData = async () => {
        if (!firestore || isSeeding) return;
        setIsSeeding(true);
        try {
            const count = await seedBillingData(firestore);
            toast({ title: 'Financial Seeding Complete', description: `Initialized settings and ${count} invoices.` });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Seeding Failed', description: e.message });
        } finally {
            setIsSeeding(false);
        }
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

    const isLoading = isLoadingInvoices || isLoadingFilter || isLoadingUsers || isLoadingSchools;

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5 text-left">
            <div className="max-w-7xl mx-auto space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight text-foreground uppercase flex items-center gap-3">
                            <Receipt className="h-8 w-8 text-primary" />
                            Invoice Registry
                        </h1>
                        <p className="text-muted-foreground font-medium mt-1">Audit, manage, and finalize institutional billing records.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button variant="outline" onClick={handleSeedData} disabled={isSeeding} className="rounded-xl font-bold h-12 px-6 border-primary/20 text-primary bg-white shadow-sm transition-all active:scale-95">
                            {isSeeding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Database className="h-4 w-4 mr-2" />}
                            Seed Sample Data
                        </Button>
                        <Button onClick={() => setIsAdding(true)} className="rounded-xl font-black uppercase tracking-widest shadow-lg h-12 px-8 transition-all active:scale-95">
                            <Plus className="mr-2 h-5 w-5" /> Create Bill
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard label="Total Expected" value={isLoading ? '...' : filteredInvoices.reduce((a,c) => a + c.totalPayable, 0).toLocaleString()} icon={TrendingUp} color="text-primary" bg="bg-primary/10" sub="" />
                    <StatCard label="Resolved (Paid)" value={isLoading ? '...' : filteredInvoices.filter(i => i.status === 'paid').length} icon={CheckCircle2} color="text-emerald-600" bg="bg-emerald-50" sub="" />
                    <StatCard label="Outstanding Drafts" value={isLoading ? '...' : filteredInvoices.filter(i => i.status === 'draft').length} icon={Clock} color="text-orange-600" bg="bg-orange-50" sub="" />
                    <StatCard label="Recovery Action" value={isLoading ? '...' : filteredInvoices.filter(i => i.status === 'overdue').length} icon={AlertCircle} color="text-rose-600" bg="bg-rose-50" sub="" />
                </div>

                <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden bg-card">
                    <CardContent className="p-4 flex flex-wrap items-center gap-4">
                        <div className="flex-grow min-w-[240px] relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-40" />
                            <Input 
                                placeholder="Search by invoice # or school..." 
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
                                <SelectItem value="draft">Drafts Only</SelectItem>
                                <SelectItem value="sent">Sent</SelectItem>
                                <SelectItem value="paid">Paid</SelectItem>
                                <SelectItem value="overdue">Overdue</SelectItem>
                            </SelectContent>
                        </Select>
                        
                        <div className="flex items-center gap-2 px-4 h-11 rounded-xl bg-primary/5 border border-primary/10">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-primary/60">Filtered For:</Label>
                            <Badge variant="outline" className="h-6 font-black uppercase text-[9px] border-primary/20 bg-white text-primary">
                                {assignedUserId === 'unassigned' ? 'Unassigned' : users?.find(u => u.id === assignedUserId)?.name || 'Everyone'}
                            </Badge>
                        </div>
                    </CardContent>
                </Card>

                <div className="rounded-[2rem] border border-border/50 bg-card shadow-sm overflow-hidden ring-1 ring-black/5">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest pl-8 py-5">Invoice Reference</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest">Campus</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest">Billing Period</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Total Payable</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Status</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-right pr-8">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell className="pl-8"><Skeleton className="h-4 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                        <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                                        <TableCell className="text-center"><Skeleton className="h-6 w-12 mx-auto rounded-full" /></TableCell>
                                        <TableCell className="text-right pr-8"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : filteredInvoices.length > 0 ? (
                                filteredInvoices.map((invoice) => (
                                    <TableRow key={invoice.id} className="group hover:bg-muted/30 transition-colors">
                                        <TableCell className="pl-8 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-black text-foreground uppercase tracking-tight">{invoice.invoiceNumber}</span>
                                                <span className="text-[9px] font-bold text-muted-foreground uppercase opacity-60 tabular-nums">{format(new Date(invoice.createdAt), 'MMM d, yyyy')}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 bg-primary/5 rounded-lg border border-primary/10 text-primary"><Building className="h-3 w-3" /></div>
                                                <span className="text-xs font-black uppercase text-foreground/80 truncate max-w-[180px]">{invoice.schoolName}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-[10px] font-bold text-muted-foreground uppercase">{invoice.periodName}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex flex-col items-end">
                                                <span className="font-black text-sm tabular-nums">{invoice.currency} {invoice.totalPayable.toLocaleString()}</span>
                                                {invoice.arrearsAdded > 0 && <span className="text-[8px] font-bold text-rose-600 uppercase tracking-tighter">Incl. Arrears</span>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">{getStatusBadge(invoice.status)}</TableCell>
                                        <TableCell className="text-right pr-8">
                                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" asChild>
                                                    <Link href={`/admin/finance/invoices/${invoice.id}`}><Eye className="h-4 w-4 text-primary" /></Link>
                                                </Button>
                                                <DropdownMenu modal={false}>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg"><MoreHorizontal className="h-4 w-4" /></Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-48 rounded-xl border-none shadow-2xl">
                                                        <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest px-3 py-2">Invoice Logic</DropdownMenuLabel>
                                                        <DropdownMenuItem className="gap-3 rounded-lg p-2.5" asChild>
                                                            <Link href={`/admin/finance/invoices/${invoice.id}`}><FileText className="h-4 w-4 text-primary" /> Open in Studio</Link>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem className="gap-3 rounded-lg p-2.5">
                                                            <Download className="h-4 w-4 text-primary" /> Download PDF
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem className="text-destructive gap-3 rounded-lg p-2.5 focus:bg-destructive/10" onClick={() => handleDelete(invoice)}>
                                                            <Trash2 className="h-4 w-4" /> Delete Draft
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-64 text-center">
                                        <div className="flex flex-col items-center justify-center gap-6 opacity-30">
                                            <div className="p-6 bg-muted/50 rounded-[2.5rem] shadow-inner">
                                                <Receipt className="h-12 w-12" />
                                            </div>
                                            <div className="space-y-4">
                                                <p className="text-xs font-black uppercase tracking-widest">Registry Clear</p>
                                                <Button onClick={handleSeedData} disabled={isSeeding} className="rounded-xl font-bold h-10 px-6 gap-2">
                                                    {isSeeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                                                    Seed Initial Invoices
                                                </Button>
                                            </div>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Creation Dialog */}
            <Dialog open={isAdding} onOpenChange={setIsAdding}>
                <DialogContent className="sm:max-w-md rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
                    <form onSubmit={(e) => { e.preventDefault(); handleGenerate(); }}>
                        <DialogHeader className="p-8 bg-muted/30 border-b shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-primary text-white rounded-2xl shadow-xl shadow-primary/20">
                                    <Plus className="h-6 w-6" />
                                </div>
                                <div>
                                    <DialogTitle className="text-2xl font-black uppercase tracking-tight text-left">Generate Bill</DialogTitle>
                                    <DialogDescription className="text-xs font-bold uppercase tracking-widest text-left">Initialize a new draft for review.</DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>
                        <div className="p-8 space-y-8 text-left">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">1. Target Institution</Label>
                                <Select onValueChange={setSelectedSchoolId} value={selectedSchoolId || ''}>
                                    <SelectTrigger className="h-12 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold">
                                        <SelectValue placeholder="Select school..." />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        {schools?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">2. Billing Period</Label>
                                <Select onValueChange={setSelectedPeriodId} value={selectedPeriodId || ''}>
                                    <SelectTrigger className="h-12 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold">
                                        <SelectValue placeholder="Select cycle..." />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        {periods?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter className="p-6 bg-muted/30 border-t flex justify-between gap-3 sm:justify-between items-center">
                            <Button type="button" variant="ghost" onClick={() => setIsAdding(false)} className="font-bold rounded-xl h-12 px-8">Discard</Button>
                            <Button 
                                onClick={handleGenerate} 
                                disabled={isGenerating || !selectedSchoolId || !selectedPeriodId}
                                className="rounded-xl font-black h-12 px-10 shadow-2xl bg-primary text-white gap-2 uppercase tracking-widest text-sm"
                            >
                                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                                Execute Logic
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function StatCard({ label, value, sub, icon: Icon, color, bg }: { label: string, value: string | number, sub: string, icon: any, color: string, bg: string }) {
    return (
        <Card className="rounded-[2rem] border-none ring-1 ring-border shadow-sm bg-white overflow-hidden group hover:ring-primary/20 transition-all text-left">
            <CardContent className="p-6 flex items-center gap-5">
                <div className={cn("p-4 rounded-2xl shrink-0 transition-transform group-hover:scale-110 shadow-inner", bg, color)}>
                    <Icon className="h-7 w-7" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground leading-none mb-1.5">{label}</p>
                    <p className="text-2xl font-black tabular-nums tracking-tighter truncate">{value}</p>
                    <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-tighter mt-1 truncate">{sub}</p>
                </div>
            </CardContent>
        </Card>
    );
}