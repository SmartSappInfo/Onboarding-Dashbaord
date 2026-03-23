'use client';

import * as React from 'react';
import { collection, query, orderBy, addDoc, doc, updateDoc, deleteDoc, where } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { SubscriptionPackage } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { 
    Package, 
    Plus, 
    Pencil, 
    Trash2, 
    Check, 
    X, 
    Loader2, 
    BadgeCheck, 
    AlertCircle,
    Info,
    Wallet,
    Layout,
    Share2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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

/**
 * @fileOverview Pricing Tiers Hub.
 * Upgraded to support shared visibility across multiple workspaces.
 */
export default function PackagesClient() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { activeWorkspaceId, allowedWorkspaces } = useWorkspace();
    
    const [isAdding, setIsAdding] = React.useState(false);
    const [editingPackage, setEditingPackage] = React.useState<SubscriptionPackage | null>(null);
    const [isSaving, setIsSaving] = React.useState(false);

    // Form Local State
    const [workspaceIds, setWorkspaceIds] = React.useState<string[]>([activeWorkspaceId]);

    const workspaceOptions = allowedWorkspaces.map(w => ({ label: w.name, value: w.id }));

    // Shared Visibility Query
    const packagesQuery = useMemoFirebase(() => 
        firestore ? query(
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
            name: String(formData.get('name')),
            description: String(formData.get('description')),
            ratePerStudent: Number(formData.get('rate')),
            billingTerm: String(formData.get('term')) as any,
            currency: String(formData.get('currency')),
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
        } catch (error) {
            toast({ variant: 'destructive', title: 'Operation Failed' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!firestore || !confirm('Permanently delete this pricing tier? Schools using this package will require manual reassignment.')) return;
        try {
            await deleteDoc(doc(firestore, 'subscription_packages', id));
            toast({ title: 'Package Purged' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Deletion Failed' });
        }
    };

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5 text-left">
            <div className="max-w-6xl mx-auto space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight text-foreground uppercase flex items-center gap-3">
                            <Package className="h-8 w-8 text-primary" />
                            Pricing Tiers
                        </h1>
                        <p className="text-muted-foreground font-medium mt-1">Manage institutional subscription levels for the {activeWorkspaceId} hub.</p>
                    </div>
                    <Button onClick={() => { setIsAdding(true); setWorkspaceIds([activeWorkspaceId]); }} className="rounded-xl font-black uppercase tracking-widest shadow-lg h-12 px-8">
                        <Plus className="mr-2 h-4 w-4" /> New Package
                    </Button>
                </div>

                <div className="rounded-[2rem] border border-border/50 bg-card shadow-sm overflow-hidden ring-1 ring-black/5">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest pl-8 py-5">Package Name</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest">Rate (Per Student)</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Visibility</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Status</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-right pr-8">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell className="pl-8 py-6"><Skeleton className="h-4 w-32" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                        <TableCell className="text-center"><Skeleton className="h-4 w-20 mx-auto" /></TableCell>
                                        <TableCell className="text-center"><Skeleton className="h-6 w-12 mx-auto rounded-full" /></TableCell>
                                        <TableCell className="text-right pr-8"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : packages?.length ? (
                                packages.map((pkg) => (
                                    <TableRow key={pkg.id} className="group hover:bg-muted/30 transition-colors">
                                        <TableCell className="pl-8 py-4">
                                            <div>
                                                <p className="font-black text-foreground uppercase tracking-tight">{pkg.name}</p>
                                                <p className="text-[10px] text-muted-foreground truncate max-w-[250px] font-bold uppercase tracking-tighter">{pkg.billingTerm} cycle</p>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1.5 font-black text-sm">
                                                <span className="text-[10px] opacity-40">{pkg.currency}</span>
                                                {pkg.ratePerStudent.toFixed(2)}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex flex-wrap gap-1 justify-center">
                                                {pkg.workspaceIds?.map(wId => (
                                                    <Badge key={wId} variant="outline" className="text-[8px] font-black uppercase h-4 border-primary/20 bg-primary/5 text-primary">{wId}</Badge>
                                                )) || <Badge variant="secondary" className="text-[8px] font-bold opacity-30">Unbound</Badge>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {pkg.isActive ? (
                                                <Badge className="bg-emerald-50 text-white border-none text-[8px] h-5 uppercase px-2 font-black">Active</Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-[8px] h-5 uppercase px-2 font-black opacity-40">Inactive</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right pr-8">
                                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => { setEditingPackage(pkg); setWorkspaceIds(pkg.workspaceIds || [activeWorkspaceId]); }}>
                                                    <Pencil className="h-4 w-4 text-primary" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg" onClick={() => handleDelete(pkg.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-64 text-center">
                                        <div className="flex flex-col items-center justify-center gap-3 opacity-20">
                                            <Package className="h-12 w-12" />
                                            <p className="text-xs font-black uppercase tracking-widest">No tiers in this hub</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Editor Dialog */}
            <Dialog open={isAdding || !!editingPackage} onOpenChange={(o) => { if(!o) { setIsAdding(false); setEditingPackage(null); } }}>
                <DialogContent className="sm:max-w-md rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
                    <form onSubmit={handleSave}>
                        <DialogHeader className="p-8 bg-muted/30 border-b shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-primary text-white rounded-2xl shadow-xl shadow-primary/20">
                                    <Wallet className="h-6 w-6" />
                                </div>
                                <div>
                                    <DialogTitle className="text-2xl font-black uppercase tracking-tight text-left">
                                        {editingPackage ? 'Sync Pricing' : 'Initialize Tier'}
                                    </DialogTitle>
                                    <DialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground text-left">Define student-based subscription logic</DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>
                        <div className="p-8 space-y-8 text-left bg-background">
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
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Package Name</Label>
                                <Input name="name" defaultValue={editingPackage?.name} placeholder="e.g. Premium Hub" className="h-12 rounded-xl bg-muted/20 border-none font-bold shadow-inner" required />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Rate per student</Label>
                                    <Input name="rate" type="number" step="0.01" defaultValue={editingPackage?.ratePerStudent} className="h-12 rounded-xl bg-muted/20 border-none font-black text-lg pl-4 shadow-inner" required />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Currency</Label>
                                    <Input name="currency" defaultValue={editingPackage?.currency || 'GHS'} className="h-12 rounded-xl bg-muted/20 border-none font-black text-center shadow-inner uppercase" required />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Billing cycle (Term)</Label>
                                <Select name="term" defaultValue={editingPackage?.billingTerm || 'term'}>
                                    <SelectTrigger className="h-12 rounded-xl bg-muted/20 border-none font-bold shadow-inner"><SelectValue /></SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="term">Per Term</SelectItem>
                                        <SelectItem value="semester">Per Semester</SelectItem>
                                        <SelectItem value="year">Per Academic Year</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-center justify-between p-4 rounded-2xl border bg-muted/10">
                                <div className="space-y-0.5">
                                    <Label className="text-sm font-bold uppercase tracking-tight">Active for Selection</Label>
                                    <p className="text-[9px] text-muted-foreground uppercase">Enable this tier in the onboarding flow</p>
                                </div>
                                <Switch name="isActive" defaultChecked={editingPackage ? editingPackage.isActive : true} />
                            </div>
                        </div>
                        <DialogFooter className="bg-muted/30 p-6 border-t flex justify-between gap-3 sm:justify-between">
                            <Button type="button" variant="ghost" onClick={() => { setIsAdding(false); setEditingPackage(null); }} className="font-bold rounded-xl px-8 h-12">Cancel</Button>
                            <Button type="submit" disabled={isSaving || workspaceIds.length === 0} className="rounded-xl font-black px-12 shadow-2xl h-12 uppercase tracking-widest text-sm">
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BadgeCheck className="mr-2 h-4 w-4" />}
                                Commit Package
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
