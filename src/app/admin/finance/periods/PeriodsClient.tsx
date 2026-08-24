'use client';

import * as React from 'react';
import { collection, query, orderBy, addDoc, doc, updateDoc, where } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { BillingPeriod } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { 
    Timer, 
    Plus, 
    Pencil, 
    Loader2, 
    Calendar,
    Lock, 
    Unlock, 
    Check, 
    Layout, 
    Search,
    Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription, 
    DialogFooter 
} from '@/components/ui/dialog';
import { DateTimePicker } from '@/components/ui/datetime-picker';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { useWorkspace } from '@/context/WorkspaceContext';
import { MultiSelect } from '@/components/ui/multi-select';
import { PageContainerFluid } from '@/components/ui/page-container';
import { ExecuteRecurringBillingModal } from '@/components/finance/ExecuteRecurringBillingModal';

/**
 * @fileOverview Billing Cycles Management.
 * Synchronized with workspace context and validated with strict date sequencing.
 */
export default function PeriodsClient() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { activeWorkspaceId, allowedWorkspaces, activeWorkspace } = useWorkspace();
    
    const [isAdding, setIsAdding] = React.useState(false);
    const [editingPeriod, setEditingPeriod] = React.useState<BillingPeriod | null>(null);
    const [isSaving, setIsSaving] = React.useState(false);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [isCycleBillingOpen, setIsCycleBillingOpen] = React.useState(false);
    const [selectedCyclePeriodId, setSelectedCyclePeriodId] = React.useState<string>('');

    // Form State
    const [workspaceIds, setWorkspaceIds] = React.useState<string[]>([activeWorkspaceId]);
    const [startDate, setStartDate] = React.useState<Date | undefined>(undefined);
    const [endDate, setEndDate] = React.useState<Date | undefined>(undefined);
    const [invoiceDate, setInvoiceDate] = React.useState<Date | undefined>(undefined);
    const [dueDate, setDueDate] = React.useState<Date | undefined>(undefined);

    const workspaceOptions = allowedWorkspaces.map((w) => ({ label: w.name, value: w.id }));

    // Shared Visibility Query
    const periodsQuery = useMemoFirebase(() => 
        firestore && activeWorkspaceId ? query(
            collection(firestore, 'billing_periods'), 
            where('workspaceIds', 'array-contains', activeWorkspaceId),
            orderBy('startDate', 'desc')
        ) : null, 
    [firestore, activeWorkspaceId]);
    
    const { data: periods, isLoading } = useCollection<BillingPeriod>(periodsQuery);

    React.useEffect(() => {
        if (editingPeriod) {
            setStartDate(new Date(editingPeriod.startDate));
            setEndDate(new Date(editingPeriod.endDate));
            setInvoiceDate(new Date(editingPeriod.invoiceDate));
            setDueDate(new Date(editingPeriod.paymentDueDate));
            setWorkspaceIds(editingPeriod.workspaceIds || [activeWorkspaceId]);
        } else {
            setStartDate(undefined);
            setEndDate(undefined);
            setInvoiceDate(undefined);
            setDueDate(undefined);
            setWorkspaceIds([activeWorkspaceId]);
        }
    }, [editingPeriod, activeWorkspaceId]);

    const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!firestore || !startDate || !endDate || !invoiceDate || !dueDate || workspaceIds.length === 0) {
            toast({ 
                variant: 'destructive', 
                title: 'Incomplete Protocol', 
                description: 'Ensure all dates and workspaces are defined.' 
            });
            return;
        }

        // Date Sequence Validation
        if (endDate < startDate) {
            toast({
                variant: 'destructive',
                title: 'Invalid Date Range',
                description: 'Cycle end date cannot be earlier than cycle start date.'
            });
            return;
        }

        if (dueDate < invoiceDate) {
            toast({
                variant: 'destructive',
                title: 'Invalid Payment Deadline',
                description: 'Payment due date cannot be earlier than invoice trigger date.'
            });
            return;
        }
        
        setIsSaving(true);
        const formData = new FormData(e.currentTarget);
        
        const periodData = {
            name: String(formData.get('name') || ''),
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            invoiceDate: invoiceDate.toISOString(),
            paymentDueDate: dueDate.toISOString(),
            status: (editingPeriod?.status || 'open') as 'open' | 'closed',
            workspaceIds,
            updatedAt: new Date().toISOString()
        };

        try {
            if (editingPeriod) {
                await updateDoc(doc(firestore, 'billing_periods', editingPeriod.id), periodData);
                toast({ title: 'Cycle Synchronized' });
            } else {
                await addDoc(collection(firestore, 'billing_periods'), {
                    ...periodData,
                    createdAt: new Date().toISOString()
                });
                toast({ title: 'Cycle Initialized' });
            }
            setIsAdding(false);
            setEditingPeriod(null);
        } catch {
            toast({ variant: 'destructive', title: 'Operation Failed' });
        } finally {
            setIsSaving(false);
        }
    };

    const toggleStatus = async (period: BillingPeriod) => {
        if (!firestore) return;
        const newStatus = period.status === 'open' ? 'closed' : 'open';
        try {
            await updateDoc(doc(firestore, 'billing_periods', period.id), { 
                status: newStatus, 
                updatedAt: new Date().toISOString() 
            });
            toast({ title: `Cycle ${newStatus === 'open' ? 'Reopened' : 'Finalized'}` });
        } catch {
            toast({ variant: 'destructive', title: 'Update Failed' });
        }
    };

    const filteredPeriods = React.useMemo(() => {
        if (!periods) return [];
        if (!searchTerm) return periods;
        const s = searchTerm.toLowerCase();
        return periods.filter((p) => p.name.toLowerCase().includes(s));
    }, [periods, searchTerm]);

    return (
        <PageContainerFluid>
            <div className="space-y-6 pb-32 w-full text-left">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex flex-col items-start">
                        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
                            <Timer className="h-8 w-8 text-primary" />
                            Billing Cycles
                        </h1>
                        <p className="text-muted-foreground text-xs mt-1">
                            Define recurring and term-based invoicing windows for {activeWorkspace?.name || activeWorkspaceId}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button 
                            variant="outline"
                            onClick={() => {
                                setSelectedCyclePeriodId('');
                                setIsCycleBillingOpen(true);
                            }} 
                            className="rounded-xl font-bold border-primary/30 text-primary hover:bg-primary/10 shadow-xs h-11 px-5 active:scale-[0.97] transition-all"
                        >
                            <Zap className="mr-2 h-4 w-4 fill-primary/20" /> Run Cycle Invoicing
                        </Button>
                        <Button 
                            onClick={() => setIsAdding(true)} 
                            className="rounded-xl font-bold shadow-sm h-11 px-6 active:scale-[0.97] transition-all text-white bg-primary hover:bg-primary/90"
                        >
                            <Plus className="mr-2 h-4 w-4" /> Initialize Cycle
                        </Button>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground opacity-50" />
                    <Input 
                        placeholder="Search billing cycles..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 h-9 bg-card border-border/80 text-foreground placeholder:text-muted-foreground rounded-xl text-xs font-medium"
                    />
                </div>

                <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden text-left">
                    <Table>
                        <TableHeader className="bg-muted/20">
                            <TableRow>
                                <TableHead className="text-[10px] font-bold uppercase tracking-wider pl-6 py-4">Cycle Window</TableHead>
                                <TableHead className="text-[10px] font-bold uppercase tracking-wider">Visibility</TableHead>
                                <TableHead className="text-[10px] font-bold uppercase tracking-wider text-center">Trigger Date</TableHead>
                                <TableHead className="text-[10px] font-bold uppercase tracking-wider text-center">Status</TableHead>
                                <TableHead className="text-[10px] font-bold uppercase tracking-wider text-right pr-6">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell className="pl-6 py-5"><Skeleton className="h-4 w-32" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                        <TableCell className="text-center"><Skeleton className="h-4 w-32 mx-auto" /></TableCell>
                                        <TableCell className="text-center"><Skeleton className="h-6 w-12 mx-auto rounded-full" /></TableCell>
                                        <TableCell className="text-right pr-6"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : filteredPeriods.length ? (
                                filteredPeriods.map((period) => (
                                    <TableRow key={period.id} className={cn('group hover:bg-muted/25 transition-colors', period.status === 'closed' && 'opacity-60')}>
                                        <TableCell className="pl-6 py-3.5">
                                            <p className="font-bold text-xs text-foreground tracking-tight">{period.name}</p>
                                            <p className="text-[10px] font-semibold text-muted-foreground tabular-nums">
                                                {format(new Date(period.startDate), 'MMM d')} — {format(new Date(period.endDate), 'MMM d, yyyy')}
                                            </p>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1">
                                                {period.workspaceIds?.map((wId) => (
                                                    <Badge key={wId} variant="outline" className="text-[8px] font-bold uppercase h-4 border-primary/20 bg-primary/5 text-primary">{wId}</Badge>
                                                )) || <Badge variant="secondary" className="text-[8px] font-bold opacity-30">Unbound</Badge>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-primary">
                                                <Calendar className="h-3.5 w-3.5 opacity-70" />
                                                {format(new Date(period.invoiceDate), 'MMM d, yyyy')}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {period.status === 'open' ? (
                                                <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[8px] h-5 uppercase px-2 font-bold">Active</Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-[8px] h-5 uppercase px-2 font-bold opacity-40">Closed</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right pr-6">
                                            <div className="flex items-center justify-end gap-1">
                                                {period.status === 'open' && (
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-8 w-8 rounded-lg text-primary hover:bg-primary/10 active:scale-[0.97]" 
                                                        onClick={() => {
                                                            setSelectedCyclePeriodId(period.id);
                                                            setIsCycleBillingOpen(true);
                                                        }}
                                                        title="Run Cycle Invoicing"
                                                    >
                                                        <Zap className="h-3.5 w-3.5 fill-primary/20" />
                                                    </Button>
                                                )}
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground active:scale-[0.97]" 
                                                    onClick={() => toggleStatus(period)}
                                                    title={period.status === 'open' ? 'Close cycle' : 'Reopen cycle'}
                                                >
                                                    {period.status === 'open' ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                                                </Button>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-8 w-8 rounded-lg text-primary hover:bg-primary/10 active:scale-[0.97]" 
                                                    onClick={() => setEditingPeriod(period)}
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-44 text-center text-muted-foreground">
                                        <Timer className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                        <p className="text-xs font-semibold">No billing cycles found.</p>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Editor Dialog */}
            <Dialog open={isAdding || !!editingPeriod} onOpenChange={(o) => { if (!o) { setIsAdding(false); setEditingPeriod(null); } }}>
                <DialogContent className="sm:max-w-xl rounded-2xl p-0 overflow-hidden border border-border shadow-2xl bg-card text-left">
                    <form onSubmit={handleSave}>
                        <DialogHeader className="p-6 bg-muted/20 border-b shrink-0 text-left">
                            <div className="flex items-center gap-3 text-left">
                                <div className="p-2.5 bg-primary text-white rounded-xl shadow-md shadow-primary/20 text-left">
                                    <Timer className="h-5 w-5" />
                                </div>
                                <div className="text-left">
                                    <DialogTitle className="text-xl font-bold tracking-tight text-left">
                                        {editingPeriod ? 'Modify Billing Cycle' : 'Initialize Billing Cycle'}
                                    </DialogTitle>
                                    <DialogDescription className="text-xs text-muted-foreground text-left">
                                        Configure the active window and payment deadlines
                                    </DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>

                        <div className="p-6 space-y-5 text-left bg-background">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-bold text-primary ml-1 flex items-center gap-1.5">
                                    <Layout className="h-3.5 w-3.5" /> Shared Workspace Visibility
                                </Label>
                                <MultiSelect 
                                    options={workspaceOptions}
                                    value={workspaceIds}
                                    onChange={setWorkspaceIds}
                                    placeholder="Map to workspaces..."
                                />
                            </div>

                            <Separator className="opacity-40" />

                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-bold text-muted-foreground ml-1">Cycle Label</Label>
                                <Input 
                                    name="name" 
                                    defaultValue={editingPeriod?.name} 
                                    placeholder="e.g. 2026 Term 1 (Jan - Apr)" 
                                    className="h-10 rounded-xl bg-background border-border text-xs font-bold shadow-xs" 
                                    required 
                                />
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5 text-left">
                                    <Label className="text-[10px] font-bold text-primary ml-1">Cycle Start</Label>
                                    <DateTimePicker value={startDate} onChange={setStartDate} />
                                </div>
                                <div className="space-y-1.5 text-left">
                                    <Label className="text-[10px] font-bold text-primary ml-1">Cycle End</Label>
                                    <DateTimePicker value={endDate} onChange={setEndDate} />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-border/50">
                                <div className="space-y-1.5 text-left">
                                    <Label className="text-[10px] font-bold text-muted-foreground ml-1">Invoice Trigger Date</Label>
                                    <DateTimePicker value={invoiceDate} onChange={setInvoiceDate} />
                                    <p className="text-[9px] text-muted-foreground font-medium px-1">Date invoice draft is triggered</p>
                                </div>
                                <div className="space-y-1.5 text-left">
                                    <Label className="text-[10px] font-bold text-muted-foreground ml-1">Payment Deadline</Label>
                                    <DateTimePicker value={dueDate} onChange={setDueDate} />
                                    <p className="text-[9px] text-muted-foreground font-medium px-1">Marked as overdue after this date</p>
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="bg-muted/20 p-4 border-t flex justify-between gap-3 items-center">
                            <Button 
                                type="button" 
                                variant="ghost" 
                                onClick={() => { setIsAdding(false); setEditingPeriod(null); }} 
                                className="font-bold rounded-xl px-5 h-10 text-xs active:scale-[0.97]"
                            >
                                Cancel
                            </Button>
                            <Button 
                                type="submit" 
                                disabled={isSaving || !startDate || !endDate || workspaceIds.length === 0} 
                                className="rounded-xl font-bold px-6 h-10 text-xs bg-primary text-white active:scale-[0.97]"
                            >
                                {isSaving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
                                Commit Cycle
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
            {/* Recurring Billing Batch Modal */}
            <ExecuteRecurringBillingModal
                isOpen={isCycleBillingOpen}
                onClose={() => setIsCycleBillingOpen(false)}
                initialPeriodId={selectedCyclePeriodId || undefined}
            />
        </PageContainerFluid>
    );
}
