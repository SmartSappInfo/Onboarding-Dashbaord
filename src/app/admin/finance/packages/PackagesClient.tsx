'use client';

import * as React from 'react';
import { collection, query, orderBy, addDoc, doc, updateDoc, deleteDoc, where } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { SubscriptionPackage } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { 
    Package, 
    Plus, 
    Pencil, 
    Trash2, 
    Loader2, 
    Wallet, 
    Layout, 
    Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useWorkspace } from '@/context/WorkspaceContext';
import { MultiSelect } from '@/components/ui/multi-select';
import { Separator } from '@/components/ui/separator';
import { PageContainerFluid } from '@/components/ui/page-container';
import { useTerminology } from '@/hooks/use-terminology';

/**
 * @fileOverview Pricing Tiers Hub.
 * Upgraded with dynamic multi-industry terminology, search filters, and strict typing.
 */
export default function PackagesClient() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const confirm = useConfirm();
    const { singular } = useTerminology();
    const { activeWorkspaceId, allowedWorkspaces } = useWorkspace();
    
    const [isAdding, setIsAdding] = React.useState(false);
    const [editingPackage, setEditingPackage] = React.useState<SubscriptionPackage | null>(null);
    const [isSaving, setIsSaving] = React.useState(false);
    const [searchTerm, setSearchTerm] = React.useState('');

    // Form Local State
    const [workspaceIds, setWorkspaceIds] = React.useState<string[]>([activeWorkspaceId]);

    const workspaceOptions = allowedWorkspaces.map((w) => ({ label: w.name, value: w.id }));

    // Shared Visibility Query
    const packagesQuery = useMemoFirebase(() => 
        firestore && activeWorkspaceId ? query(
            collection(firestore, 'subscription_packages'), 
            where('workspaceIds', 'array-contains', activeWorkspaceId),
            orderBy('name', 'asc')
        ) : null, 
    [firestore, activeWorkspaceId]);
    
    const { data: packages, isLoading } = useCollection<SubscriptionPackage>(packagesQuery);

    const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!firestore || workspaceIds.length === 0) {
            toast({ variant: 'destructive', title: 'Workspace Required' });
            return;
        }
        
        setIsSaving(true);
        const formData = new FormData(e.currentTarget);
        
        const packageData = {
            name: String(formData.get('name') || ''),
            description: String(formData.get('description') || ''),
            ratePerStudent: Number(formData.get('rate')) || 0,
            billingTerm: (String(formData.get('term') || 'termly')) as SubscriptionPackage['billingTerm'],
            currency: String(formData.get('currency') || 'GHS'),
            isActive: formData.get('isActive') === 'on',
            workspaceIds,
            updatedAt: new Date().toISOString()
        };

        try {
            if (editingPackage) {
                await updateDoc(doc(firestore, 'subscription_packages', editingPackage.id), packageData);
                toast({ title: 'Package Updated' });
            } else {
                await addDoc(collection(firestore, 'subscription_packages'), {
                    ...packageData,
                    createdAt: new Date().toISOString()
                });
                toast({ title: 'Package Created' });
            }
            setIsAdding(false);
            setEditingPackage(null);
            setWorkspaceIds([activeWorkspaceId]);
        } catch {
            toast({ variant: 'destructive', title: 'Operation Failed' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!firestore) return;
        if (!(await confirm({ 
            title: 'Delete pricing tier?', 
            description: 'Records using this package will require manual reassignment.', 
            confirmText: 'Delete', 
            variant: 'destructive' 
        }))) return;

        try {
            await deleteDoc(doc(firestore, 'subscription_packages', id));
            toast({ title: 'Package Purged' });
        } catch {
            toast({ variant: 'destructive', title: 'Deletion Failed' });
        }
    };

    const filteredPackages = React.useMemo(() => {
        if (!packages) return [];
        if (!searchTerm) return packages;
        const s = searchTerm.toLowerCase();
        return packages.filter((p) => p.name.toLowerCase().includes(s) || p.description?.toLowerCase().includes(s));
    }, [packages, searchTerm]);

    return (
        <PageContainerFluid>
            <div className="space-y-6 pb-32 w-full text-left">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex flex-col items-start">
                        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
                            <Package className="h-8 w-8 text-primary" />
                            Pricing Tiers
                        </h1>
                        <p className="text-muted-foreground text-xs mt-1">
                            Subscription tiers and rate protocols for {singular.toLowerCase()} enrollment
                        </p>
                    </div>
                    <Button 
                        onClick={() => { setIsAdding(true); setWorkspaceIds([activeWorkspaceId]); }} 
                        className="rounded-xl font-bold shadow-sm h-11 px-6 active:scale-[0.97] transition-all text-white bg-primary hover:bg-primary/90"
                    >
                        <Plus className="mr-2 h-4 w-4" /> New Package
                    </Button>
                </div>

                {/* Search Bar */}
                <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground opacity-50" />
                    <Input 
                        placeholder="Search pricing tiers..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 h-9 bg-card border-border/80 text-foreground placeholder:text-muted-foreground rounded-xl text-xs font-medium"
                    />
                </div>

                <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden text-left">
                    <Table>
                        <TableHeader className="bg-muted/20">
                            <TableRow>
                                <TableHead className="text-[10px] font-bold uppercase tracking-wider pl-6 py-4">Package Name</TableHead>
                                <TableHead className="text-[10px] font-bold uppercase tracking-wider">Rate (Per {singular})</TableHead>
                                <TableHead className="text-[10px] font-bold uppercase tracking-wider text-center">Visibility</TableHead>
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
                                        <TableCell className="text-center"><Skeleton className="h-4 w-20 mx-auto" /></TableCell>
                                        <TableCell className="text-center"><Skeleton className="h-6 w-12 mx-auto rounded-full" /></TableCell>
                                        <TableCell className="text-right pr-6"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : filteredPackages.length ? (
                                filteredPackages.map((pkg) => (
                                    <TableRow key={pkg.id} className="group hover:bg-muted/25 transition-colors">
                                        <TableCell className="pl-6 py-3.5">
                                            <div>
                                                <p className="font-bold text-xs text-foreground tracking-tight">{pkg.name}</p>
                                                <p className="text-[10px] text-muted-foreground truncate max-w-[250px] font-semibold">{pkg.billingTerm} cycle</p>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1.5 font-black text-xs">
                                                <span className="text-[10px] opacity-40">{pkg.currency}</span>
                                                {pkg.ratePerStudent.toFixed(2)}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex flex-wrap gap-1 justify-center">
                                                {pkg.workspaceIds?.map((wId) => (
                                                    <Badge key={wId} variant="outline" className="text-[8px] font-bold uppercase h-4 border-primary/20 bg-primary/5 text-primary">{wId}</Badge>
                                                )) || <Badge variant="secondary" className="text-[8px] font-bold opacity-30">Unbound</Badge>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {pkg.isActive ? (
                                                <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[8px] h-5 uppercase px-2 font-bold">Active</Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-[8px] h-5 uppercase px-2 font-bold opacity-40">Inactive</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right pr-6">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-8 w-8 rounded-lg text-primary hover:bg-primary/10 active:scale-[0.97]" 
                                                    onClick={() => { setEditingPackage(pkg); setWorkspaceIds(pkg.workspaceIds || [activeWorkspaceId]); }}
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg active:scale-[0.97]" 
                                                    onClick={() => handleDelete(pkg.id)}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-44 text-center text-muted-foreground">
                                        <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                        <p className="text-xs font-semibold">No pricing packages found.</p>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Editor Dialog */}
            <Dialog open={isAdding || !!editingPackage} onOpenChange={(o) => { if (!o) { setIsAdding(false); setEditingPackage(null); } }}>
                <DialogContent className="sm:max-w-md rounded-2xl p-0 overflow-hidden border border-border shadow-2xl bg-card text-left">
                    <form onSubmit={handleSave}>
                        <DialogHeader className="p-6 bg-muted/20 border-b shrink-0 text-left">
                            <div className="flex items-center gap-3 text-left">
                                <div className="p-2.5 bg-primary text-white rounded-xl shadow-md shadow-primary/20 text-left">
                                    <Wallet className="h-5 w-5" />
                                </div>
                                <div className="text-left">
                                    <DialogTitle className="text-xl font-bold tracking-tight text-left">
                                        {editingPackage ? 'Sync Pricing Tier' : 'Initialize Pricing Tier'}
                                    </DialogTitle>
                                    <DialogDescription className="text-xs text-muted-foreground text-left">
                                        Define unit-based subscription logic
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
                                <Label className="text-[10px] font-bold text-muted-foreground ml-1">Package Name</Label>
                                <Input 
                                    name="name" 
                                    defaultValue={editingPackage?.name} 
                                    placeholder="e.g. Standard Tier" 
                                    className="h-10 rounded-xl bg-background border-border text-xs font-semibold" 
                                    required 
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-bold text-muted-foreground ml-1">Description</Label>
                                <Textarea 
                                    name="description" 
                                    defaultValue={editingPackage?.description} 
                                    placeholder="Brief outline of features..." 
                                    className="rounded-xl bg-background border-border text-xs font-medium" 
                                    rows={2} 
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-bold text-muted-foreground ml-1">Rate (Per {singular})</Label>
                                    <Input 
                                        name="rate" 
                                        type="number" 
                                        step="0.01" 
                                        defaultValue={editingPackage?.ratePerStudent ?? 0} 
                                        className="h-10 rounded-xl bg-background border-border text-xs font-bold" 
                                        required 
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-bold text-muted-foreground ml-1">Currency</Label>
                                    <Input 
                                        name="currency" 
                                        defaultValue={editingPackage?.currency || 'GHS'} 
                                        className="h-10 rounded-xl bg-background border-border text-xs font-bold" 
                                        required 
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-bold text-muted-foreground ml-1">Billing Cycle Term</Label>
                                <Select name="term" defaultValue={editingPackage?.billingTerm || 'termly'}>
                                    <SelectTrigger className="h-10 rounded-xl bg-background border-border text-xs font-semibold">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="monthly" className="text-xs">Monthly</SelectItem>
                                        <SelectItem value="termly" className="text-xs">Termly / Quarter</SelectItem>
                                        <SelectItem value="annually" className="text-xs">Annually</SelectItem>
                                        <SelectItem value="custom" className="text-xs">Custom</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/60">
                                <div>
                                    <p className="text-xs font-bold">Active Tier</p>
                                    <p className="text-[10px] text-muted-foreground">Allow new invoices to bind this tier</p>
                                </div>
                                <Switch name="isActive" defaultChecked={editingPackage ? editingPackage.isActive : true} />
                            </div>
                        </div>

                        <DialogFooter className="p-4 bg-muted/20 border-t flex justify-between gap-3 items-center">
                            <Button 
                                type="button" 
                                variant="ghost" 
                                onClick={() => { setIsAdding(false); setEditingPackage(null); }}
                                className="font-bold rounded-xl h-10 px-5 text-xs active:scale-[0.97]"
                            >
                                Discard
                            </Button>
                            <Button 
                                type="submit" 
                                disabled={isSaving} 
                                className="rounded-xl font-bold h-10 px-6 bg-primary text-white text-xs active:scale-[0.97]"
                            >
                                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                                Save Tier
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </PageContainerFluid>
    );
}
