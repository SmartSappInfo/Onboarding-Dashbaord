'use client';

import * as React from 'react';
import { collection, query, where, orderBy, doc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { BillingProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { 
    Settings2, 
    ShieldCheck, 
    Save, 
    Loader2, 
    BadgePercent, 
    Signature, 
    CreditCard,
    Info,
    Edit3,
    Layout,
    Plus,
    Trash2,
    CheckCircle2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import SignaturePadModal from '@/components/SignaturePadModal';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Badge } from '@/components/ui/badge';
import { MultiSelect } from '@/components/ui/multi-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

/**
 * @fileOverview Billing Profile Architect.
 * Allows managing multiple financial setups per organization.
 */
export default function FinanceSettingsClient() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { activeWorkspaceId, allowedWorkspaces } = useWorkspace();
    const { user } = useUser();
    
    const [isEditing, setIsEditing] = React.useState(false);
    const [activeProfile, setActiveProfile] = React.useState<BillingProfile | null>(null);
    const [isSaving, setIsSaving] = React.useState(false);
    const [isSigModalOpen, setIsSigModalOpen] = React.useState(false);

    // Form State
    const [name, setName] = React.useState('');
    const [levyPercent, setLevyPercent] = React.useState(5);
    const [vatPercent, setVatPercent] = React.useState(15);
    const [defaultDiscount, setDefaultDiscount] = React.useState(0);
    const [paymentInstructions, setPaymentInstructions] = React.useState('');
    const [signatureName, setSignatureName] = React.useState('');
    const [signatureDesignation, setSignatureDesignation] = React.useState('');
    const [signatureUrl, setSignatureUrl] = React.useState('');
    const [workspaceIds, setWorkspaceIds] = React.useState<string[]>([]);

    const profilesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        // Fetch all profiles shared with current workspace
        return query(
            collection(firestore, 'billing_profiles'),
            where('workspaceIds', 'array-contains', activeWorkspaceId)
        );
    }, [firestore, activeWorkspaceId]);

    const { data: profiles, isLoading } = useCollection<BillingProfile>(profilesQuery);

    const handleOpenEdit = (p?: BillingProfile) => {
        if (p) {
            setActiveProfile(p);
            setName(p.name);
            setLevyPercent(p.levyPercent);
            setVatPercent(p.vatPercent);
            setDefaultDiscount(p.defaultDiscount);
            setPaymentInstructions(p.paymentInstructions);
            setSignatureName(p.signatureName);
            setSignatureDesignation(p.signatureDesignation);
            setSignatureUrl(p.signatureUrl || '');
            setWorkspaceIds(p.workspaceIds || []);
        } else {
            setActiveProfile(null);
            setName('');
            setLevyPercent(5);
            setVatPercent(15);
            setDefaultDiscount(0);
            setPaymentInstructions('');
            setSignatureName('');
            setSignatureDesignation('');
            setSignatureUrl('');
            setWorkspaceIds([activeWorkspaceId]);
        }
        setIsEditing(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !name.trim() || workspaceIds.length === 0) return;
        
        setIsSaving(true);
        const timestamp = new Date().toISOString();
        const payload = {
            name: name.trim(),
            levyPercent,
            vatPercent,
            defaultDiscount,
            paymentInstructions,
            signatureName,
            signatureDesignation,
            signatureUrl,
            workspaceIds,
            updatedAt: timestamp
        };

        try {
            if (activeProfile) {
                await updateDoc(doc(firestore, 'billing_profiles', activeProfile.id), payload);
                toast({ title: 'Profile Synchronized' });
            } else {
                await addDoc(collection(firestore, 'billing_profiles'), {
                    ...payload,
                    createdAt: timestamp
                });
                toast({ title: 'Profile Initialized' });
            }
            setIsEditing(false);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Save Failed' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Purge this financial profile? This may affect historical integrity if used by existing invoices.')) return;
        await deleteDoc(doc(firestore, 'billing_profiles', id));
        toast({ title: 'Profile Removed' });
    };

    const workspaceOptions = allowedWorkspaces.map(w => ({ label: w.name, value: w.id }));

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5 text-left">
            <div className="max-w-5xl mx-auto space-y-8 pb-32">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight text-foreground uppercase flex items-center gap-3">
                            <Settings2 className="h-8 w-8 text-primary" />
                            Billing Protocols
                        </h1>
                        <p className="text-muted-foreground font-medium mt-1">Define financial templates for institutional remittance.</p>
                    </div>
                    <Button onClick={() => handleOpenEdit()} className="rounded-xl font-black h-11 px-6 shadow-lg gap-2">
                        <Plus size={18} /> New Profile
                    </Button>
                </div>

                <div className="rounded-[2rem] border border-border/50 bg-card shadow-sm overflow-hidden ring-1 ring-black/5">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest pl-8 py-5">Profile Name</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Tax (Levy+VAT)</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest">Shared With</TableHead>
                                <TableHead className="text-right pr-8 text-[10px] font-black uppercase tracking-widest">Management</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <TableRow key={i}><TableCell colSpan={4}><Skeleton className="h-12 w-full" /></TableCell></TableRow>
                                ))
                            ) : profiles?.length ? (
                                profiles.map(p => (
                                    <TableRow key={p.id} className="group hover:bg-muted/30 transition-colors">
                                        <TableCell className="pl-8 py-4">
                                            <p className="font-black text-sm uppercase text-foreground">{p.name}</p>
                                            <p className="text-[9px] font-bold text-muted-foreground uppercase opacity-60 italic">{p.signatureName}</p>
                                        </TableCell>
                                        <TableCell className="text-center font-black text-xs">
                                            {p.levyPercent}% + {p.vatPercent}%
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1">
                                                {p.workspaceIds.map(wId => (
                                                    <Badge key={wId} variant="outline" className="text-[8px] font-black uppercase border-primary/20 text-primary">{wId}</Badge>
                                                ))}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right pr-8">
                                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleOpenEdit(p)}><Edit3 size={16} /></Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg" onClick={() => handleDelete(p.id)}><Trash2 size={16} /></Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow><TableCell colSpan={4} className="h-48 text-center text-muted-foreground opacity-40">No profiles defined for this hub.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <Dialog open={isEditing} onOpenChange={setIsEditing}>
                <DialogContent className="sm:max-w-2xl h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl rounded-[2.5rem]">
                    <form onSubmit={handleSave} className="flex flex-col h-full text-left">
                        <DialogHeader className="p-8 bg-muted/30 border-b shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-primary text-white rounded-2xl shadow-xl shadow-primary/20"><CreditCard size={24} /></div>
                                <div>
                                    <DialogTitle className="text-xl font-black uppercase tracking-tight">{activeProfile ? 'Modify Protocol' : 'Initialize Profile'}</DialogTitle>
                                    <DialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Define tax rules and remittance signatures.</DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>

                        <div className="flex-1 overflow-hidden relative bg-background">
                            <ScrollArea className="h-full">
                                <div className="p-8 space-y-10">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Profile Identity</Label>
                                        <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Standard VAT Registered" className="h-12 rounded-xl bg-muted/20 border-none font-bold text-lg" required />
                                    </div>

                                    <div className="space-y-4 pt-4 border-t">
                                        <Label className="text-[10px] font-black uppercase text-primary ml-1 flex items-center gap-2"><Layout size={14} /> Shared Workspace Visibility</Label>
                                        <MultiSelect options={workspaceOptions} value={workspaceIds} onChange={setWorkspaceIds} />
                                    </div>

                                    <div className="grid grid-cols-3 gap-6">
                                        <div className="space-y-2 text-left">
                                            <Label className="text-[9px] font-black uppercase">Ed. Levy (%)</Label>
                                            <Input type="number" value={levyPercent} onChange={e => setLevyPercent(Number(e.target.value))} className="h-11 rounded-xl bg-muted/20 border-none font-black text-center" />
                                        </div>
                                        <div className="space-y-2 text-left">
                                            <Label className="text-[9px] font-black uppercase">VAT (%)</Label>
                                            <Input type="number" value={vatPercent} onChange={e => setVatPercent(Number(e.target.value))} className="h-11 rounded-xl bg-muted/20 border-none font-black text-center" />
                                        </div>
                                        <div className="space-y-2 text-left">
                                            <Label className="text-[9px] font-black uppercase">Def. Discount (%)</Label>
                                            <Input type="number" value={defaultDiscount} onChange={e => setDefaultDiscount(Number(e.target.value))} className="h-11 rounded-xl bg-muted/20 border-none font-black text-center" />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Payment Instructions</Label>
                                        <Textarea value={paymentInstructions} onChange={e => setPaymentInstructions(e.target.value)} placeholder="Enter bank details..." className="min-h-[100px] rounded-2xl bg-muted/20 border-none p-4 font-medium" />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t">
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <Label className="text-[9px] font-black uppercase text-muted-foreground ml-1">Authorized Signatory Name</Label>
                                                <Input value={signatureName} onChange={e => setSignatureName(e.target.value)} placeholder="e.g. Ama Serwaa" className="h-11 rounded-xl bg-muted/20 border-none font-bold" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[9px] font-black uppercase text-muted-foreground ml-1">Designation</Label>
                                                <Input value={signatureDesignation} onChange={e => setSignatureDesignation(e.target.value)} placeholder="e.g. Finance Director" className="h-11 rounded-xl bg-muted/20 border-none font-bold" />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[9px] font-black uppercase text-muted-foreground ml-1">Digital Identity Signature</Label>
                                            <div 
                                                onClick={() => setIsSigModalOpen(true)}
                                                className="h-32 w-full rounded-2xl border-2 border-dashed border-primary/20 bg-muted/10 hover:bg-primary/5 transition-all cursor-pointer flex items-center justify-center relative overflow-hidden"
                                            >
                                                {signatureUrl ? (
                                                    <img src={signatureUrl} alt="Signature" className="h-full w-full object-contain p-4" />
                                                ) : (
                                                    <div className="flex flex-col items-center gap-2 opacity-40"><Edit3 size={24} /><span className="text-[8px] font-black uppercase">Apply Ink</span></div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </ScrollArea>
                        </div>

                        <DialogFooter className="p-6 bg-muted/30 border-t shrink-0 flex justify-between">
                            <Button type="button" variant="ghost" onClick={() => setIsEditing(false)} className="rounded-xl font-bold px-8">Cancel</Button>
                            <Button type="submit" disabled={isSaving || !name.trim() || workspaceIds.length === 0} className="rounded-xl font-black px-12 shadow-2xl bg-primary text-white uppercase text-xs">
                                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                                <span className="ml-2">Commit Logic</span>
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <SignaturePadModal 
                open={isSigModalOpen} 
                onClose={() => setIsSigModalOpen(false)} 
                onSave={(url) => { setSignatureUrl(url); setIsSigModalOpen(false); }} 
            />
        </div>
    );
}
