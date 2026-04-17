
'use client';

import * as React from 'react';
import { collection, query, orderBy, limit, where } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { Invoice, BillingPeriod, WorkspaceEntity, BillingProfile } from '@/lib/types';
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
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { usePermissions } from '@/hooks/use-permissions';
import { useGlobalFilter } from '@/context/GlobalFilterProvider';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useTerminology } from '@/hooks/use-terminology';

/**
 * InvoicesClient - Invoice Registry UI
 * 
 * Updated to use WorkspaceEntity for institutional resolution.
 */
export default function InvoicesClient() {
    const firestore = useFirestore();
    const router = useRouter();
    const { user } = useUser();
    const { toast } = useToast();
    const { singular } = useTerminology();
    const { assignedUserId, isLoading: isLoadingFilter } = useGlobalFilter();
    const { activeWorkspaceId } = useWorkspace();

    const [searchTerm, setSearchTerm] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState('all');
    const [isAdding, setIsAdding] = React.useState(false);
    const [isGenerating, setIsGenerating] = React.useState(false);

    const { can } = usePermissions();
    const canCreate = can('finance', 'invoices', 'create');
    const canDelete = can('finance', 'invoices', 'delete');
    const canEdit = can('finance', 'invoices', 'edit');

    // Form State
    const [selectedEntityId, setSelectedEntityId] = React.useState<string | null>(null);
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

    const entitiesQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(
            collection(firestore, 'workspace_entities'), 
            where('workspaceId', '==', activeWorkspaceId),
            orderBy('displayName', 'asc')
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
    const { data: entities, isLoading: isLoadingEntities } = useCollection<WorkspaceEntity>(entitiesQuery);
    const { data: periods } = useCollection<BillingPeriod>(periodsQuery);
    const { data: profiles } = useCollection<BillingProfile>(profilesQuery);

    const handleGenerate = async () => {
        if (!selectedEntityId || !selectedPeriodId || !selectedProfileId || !user) {
            toast({ variant: 'destructive', title: 'Context Missing', description: `Institutional record (${singular}), cycle, and billing profile are mandatory.` });
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
            case 'paid': return <Badge className="bg-emerald-500 text-white border-none text-[8px] h-5 uppercase px-2 font-semibold">Paid</Badge>;
            case 'draft': return <Badge variant="secondary" className="text-[8px] h-5 uppercase px-2 font-semibold">Draft</Badge>;
            case 'sent': return <Badge className="bg-blue-500 text-white border-none text-[8px] h-5 uppercase px-2 font-semibold">Sent</Badge>;
            case 'overdue': return <Badge variant="destructive" className="text-[8px] h-5 uppercase px-2 font-semibold animate-pulse">Overdue</Badge>;
            default: return <Badge variant="outline" className="text-[8px] h-5 uppercase px-2 font-semibold">{status}</Badge>;
        }
    };

    const filteredInvoices = React.useMemo(() => {
        if (!invoices) return [];
        let temp = invoices;
        if (statusFilter !== 'all') temp = temp.filter(i => i.status === statusFilter);
        if (searchTerm) {
            const s = searchTerm.toLowerCase();
            temp = temp.filter(i => i.entityName?.toLowerCase().includes(s) || i.invoiceNumber.toLowerCase().includes(s));
        }
        return temp;
    }, [invoices, statusFilter, searchTerm]);

    const isLoading = isLoadingInvoices || isLoadingEntities || isLoadingFilter;

    return (
 <div className="h-full overflow-y-auto  bg-background text-left">
 <div className=" space-y-8">
 <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
 <div className="text-left">
 <h1 className="text-3xl font-semibold tracking-tight text-foreground flex items-center gap-3 text-left">
 <Receipt className="h-8 w-8 text-primary" />
                            Invoice Registry
                        </h1>
 <p className="text-muted-foreground font-medium mt-1 text-left">Institutional billing records for the {activeWorkspaceId} track.</p>
                    </div>
                    {canCreate && (
                        <Button onClick={() => setIsAdding(true)} className="rounded-xl font-semibold shadow-lg h-12 px-8 transition-all active:scale-95 text-left">
                            <Plus className="mr-2 h-5 w-5" /> Initialize Invoice
                        </Button>
                    )}
                </div>

 <Card className="border-none shadow-sm ring-1 ring-border rounded-2xl overflow-hidden bg-card text-left">
 <CardContent className="p-4 flex flex-wrap items-center gap-4 text-left">
 <div className="flex-grow min-w-[240px] relative text-left">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-40 text-left" />
                            <Input 
                                placeholder={`Search reference or ${singular.toLowerCase()}...`} 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
 className="pl-10 h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold text-left"
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
 <SelectTrigger className="w-[160px] h-11 rounded-xl bg-muted/20 border-none font-semibold text-[10px] text-left">
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

 <div className="rounded-[2rem] border border-border/50 bg-card shadow-sm overflow-hidden ring-1 ring-black/5 text-left">
 <Table className="text-left">
 <TableHeader className="bg-muted/30 text-left">
 <TableRow className="text-left">
 <TableHead className="text-[10px] font-semibold pl-8 py-5 text-left">Invoice Reference</TableHead>
 <TableHead className="text-[10px] font-semibold text-left">Target {singular}</TableHead>
 <TableHead className="text-[10px] font-semibold text-left">Cycle</TableHead>
 <TableHead className="text-[10px] font-semibold text-right">Total Payable</TableHead>
 <TableHead className="text-[10px] font-semibold text-center">Status</TableHead>
 <TableHead className="text-[10px] font-semibold text-right pr-8">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
 <TableBody className="text-left">
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
 <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-12 w-full" /></TableCell></TableRow>
                                ))
                            ) : filteredInvoices.length > 0 ? (
                                filteredInvoices.map((invoice) => (
 <TableRow key={invoice.id} className="group hover:bg-muted/30 transition-colors text-left">
 <TableCell className="pl-8 py-4 text-left">
 <span className="font-semibold text-foreground tracking-tight text-left">{invoice.invoiceNumber}</span>
 <p className="text-[9px] font-bold text-muted-foreground opacity-60 tabular-nums text-left">{format(new Date(invoice.createdAt), 'MMM d, yyyy')}</p>
                                        </TableCell>
 <TableCell className="text-left">
 <span className="text-xs font-semibold text-foreground/80 text-left">{invoice.entityName}</span>
                                        </TableCell>
 <TableCell className="text-[10px] font-bold text-muted-foreground text-left">{invoice.periodName}</TableCell>
 <TableCell className="text-right font-semibold text-sm tabular-nums">
                                            {invoice.currency} {invoice.totalPayable.toLocaleString()}
                                        </TableCell>
 <TableCell className="text-center">{getStatusBadge(invoice.status)}</TableCell>
 <TableCell className="text-right pr-8">
 <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
 <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" asChild>
 <Link href={`/admin/finance/invoices/${invoice.id}`}><Eye className="h-4 w-4 text-primary" /></Link>
                                                </Button>
                                                {canDelete && (
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg" onClick={() => handleDelete(invoice)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
 <TableRow className="text-left"><TableCell colSpan={6} className="h-48 text-center text-muted-foreground opacity-40">No matching records found.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Creation Dialog */}
            <Dialog open={isAdding} onOpenChange={setIsAdding}>
 <DialogContent className="sm:max-w-md rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl text-left">
                    <form onSubmit={(e) => { e.preventDefault(); handleGenerate(); }}>
 <DialogHeader className="p-8 bg-muted/30 border-b shrink-0 text-left">
 <div className="flex items-center gap-4 text-left">
 <div className="p-3 bg-primary text-white rounded-2xl shadow-xl shadow-primary/20 text-left"><Plus className="h-6 w-6" /></div>
 <div className="text-left">
 <DialogTitle className="text-2xl font-semibold tracking-tight text-left">Initialize bill</DialogTitle>
 <DialogDescription className="text-[10px] font-bold text-muted-foreground text-left">Select targets and bind financial logic</DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>
 <div className="p-8 space-y-8 text-left bg-background">
 <div className="space-y-2 text-left">
 <Label className="text-[10px] font-semibold text-muted-foreground ml-1 text-left">1. Target {singular}</Label>
                                <Select onValueChange={setSelectedEntityId} value={selectedEntityId || ''}>
 <SelectTrigger className="h-12 rounded-xl bg-muted/20 border-none shadow-none font-bold text-left"><SelectValue placeholder={`Select ${singular.toLowerCase()}...`} /></SelectTrigger>
 <SelectContent className="rounded-xl text-left">{entities?.map(s => <SelectItem key={s.id} value={s.id} className="text-left">{s.displayName}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
 <div className="space-y-2 text-left">
 <Label className="text-[10px] font-semibold text-muted-foreground ml-1 text-left">2. Billing Cycle</Label>
                                <Select onValueChange={setSelectedPeriodId} value={selectedPeriodId || ''}>
 <SelectTrigger className="h-12 rounded-xl bg-muted/20 border-none shadow-none font-bold text-left"><SelectValue placeholder="Select cycle..." /></SelectTrigger>
 <SelectContent className="rounded-xl text-left">{periods?.map(p => <SelectItem key={p.id} value={p.id} className="text-left">{p.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
 <div className="space-y-2 text-left">
 <Label className="text-[10px] font-semibold text-primary ml-1 flex items-center gap-2 text-left"><ShieldCheck className="h-3 w-3" /> 3. Financial Protocol (Profile)</Label>
                                <Select onValueChange={setSelectedProfileId} value={selectedProfileId || ''}>
 <SelectTrigger className="h-12 rounded-xl bg-primary/5 border-primary/20 shadow-sm font-semibold text-primary text-left"><SelectValue placeholder="Pick billing profile..." /></SelectTrigger>
 <SelectContent className="rounded-xl text-left">{profiles?.map(p => <SelectItem key={p.id} value={p.id} className="text-left">{p.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </div>
 <DialogFooter className="p-6 bg-muted/30 border-t flex justify-between gap-3 items-center text-left">
 <Button type="button" variant="ghost" onClick={() => setIsAdding(false)} className="font-bold rounded-xl h-12 px-8 text-left">Discard</Button>
 <Button onClick={handleGenerate} disabled={isGenerating || !selectedEntityId || !selectedPeriodId || !selectedProfileId} className="rounded-xl font-semibold h-12 px-10 shadow-2xl bg-primary text-white gap-2 text-sm text-left">
 {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />} Generate Draft
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
