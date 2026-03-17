
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
    ArrowRight,
    Clock,
    Lock,
    Unlock,
    Info,
    Check,
    Layout,
    Share2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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

/**
 * @fileOverview Billing Cycles Management.
 * Synchronized with workspace context to support track-specific invoicing windows.
 */
export default function PeriodsClient() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { activeWorkspaceId, allowedWorkspaces } = useWorkspace();
    
    const [isAdding, setIsAdding] = React.useState(false);
    const [editingPeriod, setEditingPeriod] = React.useState<BillingPeriod | null>(null);
    const [isSaving, setIsSaving] = React.useState(false);

    // Form State
    const [workspaceIds, setWorkspaceIds] = React.useState<string[]>([activeWorkspaceId]);
    const [startDate, setStartDate] = React.useState<Date | undefined>(undefined);
    const [endDate, setEndDate] = React.useState<Date | undefined>(undefined);
    const [invoiceDate, setInvoiceDate] = React.useState<Date | undefined>(undefined);
    const [dueDate, setDueDate] = React.useState<Date | undefined>(undefined);

    const workspaceOptions = allowedWorkspaces.map(w => ({ label: w.name, value: w.id }));

    // Shared Visibility Query
    const periodsQuery = useMemoFirebase(() => 
        firestore ? query(
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
            toast({ variant: 'destructive', title: 'Incomplete Protocol', description: 'Ensure all dates and workspaces are defined.' });
            return;
        }
        
        setIsSaving(true);
        const formData = new FormData(e.currentTarget);
        
        const periodData = {
            name: String(formData.get('name')),
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
        } catch (error) {
            toast({ variant: 'destructive', title: 'Operation Failed' });
        } finally {
            setIsSaving(false);
        }
    };

    const toggleStatus = async (period: BillingPeriod) => {
        if (!firestore) return;
        const newStatus = period.status === 'open' ? 'closed' : 'open';
        try {
            await updateDoc(doc(firestore, 'billing_periods', period.id), { status: newStatus, updatedAt: new Date().toISOString() });
            toast({ title: `Cycle ${newStatus === 'open' ? 'Reopened' : 'Finalized'}` });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Update Failed' });
        }
    };

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5 text-left">
            <div className="max-w-6xl mx-auto space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight text-foreground uppercase flex items-center gap-3">
                            <Timer className="h-8 w-8 text-primary" />
                            Billing Cycles
                        </h1>
                        <p className="text-muted-foreground font-medium mt-1">Define term-based windows for the {activeWorkspaceId} track.</p>
                    </div>
                    <Button onClick={() => setIsAdding(true)} className="rounded-xl font-black uppercase tracking-widest shadow-lg h-12 px-8 transition-all active:scale-95">
                        <Plus className="mr-2 h-5 w-5" /> Initialize Cycle
                    </Button>
                </div>

                <div className="rounded-[2rem] border border-border/50 bg-card shadow-sm overflow-hidden ring-1 ring-black/5">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest pl-8 py-5">Cycle Window</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest">Visibility</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Trigger Date</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Status</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-right pr-8">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell className="pl-8"><Skeleton className="h-4 w-32" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                        <TableCell className="text-center"><Skeleton className="h-4 w-32 mx-auto" /></TableCell>
                                        <TableCell className="text-center"><Skeleton className="h-6 w-12 mx-auto rounded-full" /></TableCell>
                                        <TableCell className="text-right pr-8"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : periods?.length ? (
                                periods.map((period) => (
                                    <TableRow key={period.id} className={cn("group hover:bg-muted/30 transition-colors", period.status === 'closed' && "opacity-60")}>
                                        <TableCell className="pl-8 py-4">
                                            <p className="font-black text-foreground uppercase tracking-tight">{period.name}</p>
                                            <p className="text-[9px] font-bold text-muted-foreground uppercase opacity-60 tabular-nums">
                                                {format(new Date(period.startDate), 'MMM d')} — {format(new Date(period.endDate), 'MMM d, yyyy')}
                                            </p>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1">
                                                {period.workspaceIds?.map(wId => (
                                                    <Badge key={wId} variant="outline" className="text-[8px] font-black uppercase h-4 border-primary/20 bg-primary/5 text-primary">{wId}</Badge>
                                                )) || <Badge variant="ghost" className="text-[8px] font-bold opacity-30">Unbound</Badge>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex flex-col items-center gap-1">
                                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-primary">
                                                    <Calendar className="h-3 w-3" />
                                                    {format(new Date(period.invoiceDate), 'MMM d, yyyy')}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {period.status === 'open' ? (
                                                <Badge className="bg-emerald-500 text-white border-none text-[8px] h-5 uppercase px-2 font-black">Active</Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-[8px] h-5 uppercase px-2 font-black border-dashed">Closed</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right pr-8">
                                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => toggleStatus(period)}>
                                                    {period.status === 'open' ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setEditingPeriod(period)}>
                                                    <Pencil className="h-4 w-4 text-primary" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-64 text-center">
                                        <div className="flex flex-col items-center justify-center gap-3 opacity-20">
                                            <Clock className="h-12 w-12" />
                                            <p className="text-xs font-black uppercase tracking-widest">No cycles in this hub</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Editor Dialog */}
            <Dialog open={isAdding || !!editingPeriod} onOpenChange={(o) => { if(!o) { setIsAdding(false); setEditingPeriod(null); } }}>
                <DialogContent className="sm:max-w-2xl rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl text-left">
                    <form onSubmit={handleSave}>
                        <DialogHeader className="p-8 bg-muted/30 border-b shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-primary text-white rounded-2xl shadow-xl shadow-primary/20">
                                    <Timer className="h-6 w-6" />
                                </div>
                                <div>
                                    <DialogTitle className="text-2xl font-black uppercase tracking-tight">
                                        {editingPeriod ? 'Modify Cycle' : 'Initialize Cycle'}
                                    </DialogTitle>
                                    <DialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground text-left">Configure the invoicing window parameters</DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>
                        <div className="p-8 space-y-8 bg-background">
                            <div className="space-y-4">
                                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary ml-1 flex items-center gap-2">
                                    <Layout className="h-3 w-3" /> Shared Visibility
                                </Label>
                                <MultiSelect 
                                    options={workspaceOptions}
                                    value={workspaceIds}
                                    onChange={setWorkspaceIds}
                                    placeholder="Map to hubs..."
                                />
                            </div>

                            <Separator className="opacity-50" />

                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Internal Cycle Label</Label>
                                <Input name="name" defaultValue={editingPeriod?.name} placeholder="e.g. Term 1 (Jan - Apr 2026)" className="h-12 rounded-xl bg-muted/20 border-none font-bold text-lg shadow-inner" required />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-2 text-left">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">Cycle Start</Label>
                                    <DateTimePicker value={startDate} onChange={setStartDate} />
                                </div>
                                <div className="space-y-2 text-left">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">Cycle End</Label>
                                    <DateTimePicker value={endDate} onChange={setEndDate} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-8 pt-4 border-t border-dashed">
                                <div className="space-y-2 text-left">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Trigger Date</Label>
                                    <DateTimePicker value={invoiceDate} onChange={setInvoiceDate} />
                                    <p className="text-[8px] text-muted-foreground uppercase font-bold tracking-tighter px-1 mt-1">Automatic bill generation</p>
                                </div>
                                <div className="space-y-2 text-left">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Payment Deadline</Label>
                                    <DateTimePicker value={dueDate} onChange={setDueDate} />
                                    <p className="text-[8px] text-muted-foreground uppercase font-bold tracking-tighter px-1 mt-1">Marked as overdue after this</p>
                                </div>
                            </div>
                        </div>
                        <DialogFooter className="bg-muted/30 p-6 border-t flex justify-between gap-3 sm:justify-between">
                            <Button type="button" variant="ghost" onClick={() => { setIsAdding(false); setEditingPeriod(null); }} className="font-bold rounded-xl px-8 h-12">Cancel</Button>
                            <Button type="submit" disabled={isSaving || !startDate || !endDate || workspaceIds.length === 0} className="rounded-xl font-black px-12 shadow-2xl h-12 uppercase tracking-widest text-sm active:scale-95 transition-all">
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                                Commit Cycle
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
