'use client';

import * as React from 'react';
import { collection, query, where, doc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { BillingProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { 
    Settings2, 
    ShieldCheck, 
    Loader2, 
    CreditCard, 
    Edit3, 
    Layout, 
    Plus, 
    Trash2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import SignaturePadModal from '@/components/SignaturePadModal';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Badge } from '@/components/ui/badge';
import { MultiSelect } from '@/components/ui/multi-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from '@/components/ui/dialog';
import { PageContainerFluid } from '@/components/ui/page-container';
import Image from 'next/image';

/**
 * @fileOverview Billing Profile Architect.
 * Allows managing multiple financial setups per organization.
 */
export default function FinanceSettingsClient() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const confirm = useConfirm();
    const { activeWorkspaceId, allowedWorkspaces, activeWorkspace } = useWorkspace();
    
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
        if (!firestore || !activeWorkspaceId) return null;
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

    const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
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
        } catch {
            toast({ variant: 'destructive', title: 'Save Failed' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!(await confirm({ 
            title: 'Delete financial profile?', 
            description: 'This may affect historical integrity if used by existing invoices.', 
            confirmText: 'Delete', 
            variant: 'destructive' 
        }))) return;
        
        if (!firestore) return;
        await deleteDoc(doc(firestore, 'billing_profiles', id));
        toast({ title: 'Profile Removed' });
    };

    const workspaceOptions = allowedWorkspaces.map((w) => ({ label: w.name, value: w.id }));

    return (
        <PageContainerFluid>
            <div className="space-y-6 pb-32 w-full text-left">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex flex-col items-start">
                        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
                            <Settings2 className="h-8 w-8 text-primary" />
                            Billing Protocols
                        </h1>
                        <p className="text-muted-foreground text-xs mt-1">
                            Define tax rules, remittance instructions, and digital signatures for {activeWorkspace?.name || activeWorkspaceId}
                        </p>
                    </div>
                    <Button 
                        onClick={() => handleOpenEdit()} 
                        className="rounded-xl font-bold shadow-sm h-11 px-6 active:scale-[0.97] transition-all text-white bg-primary hover:bg-primary/90"
                    >
                        <Plus className="mr-2 h-4 w-4" /> New Protocol
                    </Button>
                </div>

                <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden text-left">
                    <Table>
                        <TableHeader className="bg-muted/20">
                            <TableRow>
                                <TableHead className="text-[10px] font-bold uppercase tracking-wider pl-6 py-4">Profile Name</TableHead>
                                <TableHead className="text-[10px] font-bold uppercase tracking-wider text-center">Tax (Levy + VAT)</TableHead>
                                <TableHead className="text-[10px] font-bold uppercase tracking-wider">Shared Workspaces</TableHead>
                                <TableHead className="text-right pr-6 text-[10px] font-bold uppercase tracking-wider">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell colSpan={4} className="py-4 px-6"><Skeleton className="h-10 w-full" /></TableCell>
                                    </TableRow>
                                ))
                            ) : profiles?.length ? (
                                profiles.map((p) => (
                                    <TableRow key={p.id} className="group hover:bg-muted/25 transition-colors">
                                        <TableCell className="pl-6 py-3.5">
                                            <p className="font-bold text-xs text-foreground">{p.name}</p>
                                            <p className="text-[10px] text-muted-foreground font-medium">{p.signatureName} ({p.signatureDesignation || 'Authorized Signatory'})</p>
                                        </TableCell>
                                        <TableCell className="text-center font-bold text-xs">
                                            {p.levyPercent}% Levy + {p.vatPercent}% VAT
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1">
                                                {p.workspaceIds.map((wId) => (
                                                    <Badge key={wId} variant="outline" className="text-[8px] font-bold uppercase border-primary/20 bg-primary/5 text-primary">{wId}</Badge>
                                                ))}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right pr-6">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-8 w-8 rounded-lg text-primary hover:bg-primary/10 active:scale-[0.97]" 
                                                    onClick={() => handleOpenEdit(p)}
                                                >
                                                    <Edit3 className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg active:scale-[0.97]" 
                                                    onClick={() => handleDelete(p.id)}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-44 text-center text-muted-foreground">
                                        <Settings2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                        <p className="text-xs font-semibold">No billing profiles defined for this workspace.</p>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <Dialog open={isEditing} onOpenChange={setIsEditing}>
                <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden border border-border shadow-2xl rounded-2xl bg-card">
                    <form onSubmit={handleSave} className="flex flex-col h-full text-left">
                        <DialogHeader className="p-6 bg-muted/20 border-b shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-primary text-white rounded-xl shadow-md shadow-primary/20">
                                    <CreditCard className="h-5 w-5" />
                                </div>
                                <div>
                                    <DialogTitle className="text-xl font-bold tracking-tight">
                                        {activeProfile ? 'Modify Billing Protocol' : 'Initialize Billing Protocol'}
                                    </DialogTitle>
                                    <DialogDescription className="text-xs text-muted-foreground">
                                        Define tax rules and remittance signatures
                                    </DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-background">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-bold text-muted-foreground ml-1">Profile Name</Label>
                                <Input 
                                    value={name} 
                                    onChange={(e) => setName(e.target.value)} 
                                    placeholder="e.g. Standard VAT Profile" 
                                    className="h-10 rounded-xl bg-background border-border text-xs font-bold" 
                                    required 
                                />
                            </div>

                            <div className="space-y-1.5 pt-2 border-t border-border/50">
                                <Label className="text-[10px] font-bold text-primary ml-1 flex items-center gap-1.5">
                                    <Layout className="h-3.5 w-3.5" /> Shared Workspace Visibility
                                </Label>
                                <MultiSelect options={workspaceOptions} value={workspaceIds} onChange={setWorkspaceIds} />
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1 text-left">
                                    <Label className="text-[9px] font-bold text-muted-foreground ml-1">Levy (%)</Label>
                                    <Input 
                                        type="number" 
                                        step="0.1" 
                                        value={levyPercent} 
                                        onChange={(e) => setLevyPercent(Number(e.target.value))} 
                                        className="h-9 rounded-xl bg-background border-border font-bold text-center text-xs" 
                                    />
                                </div>
                                <div className="space-y-1 text-left">
                                    <Label className="text-[9px] font-bold text-muted-foreground ml-1">VAT (%)</Label>
                                    <Input 
                                        type="number" 
                                        step="0.1" 
                                        value={vatPercent} 
                                        onChange={(e) => setVatPercent(Number(e.target.value))} 
                                        className="h-9 rounded-xl bg-background border-border font-bold text-center text-xs" 
                                    />
                                </div>
                                <div className="space-y-1 text-left">
                                    <Label className="text-[9px] font-bold text-muted-foreground ml-1">Default Discount (%)</Label>
                                    <Input 
                                        type="number" 
                                        step="0.1" 
                                        value={defaultDiscount} 
                                        onChange={(e) => setDefaultDiscount(Number(e.target.value))} 
                                        className="h-9 rounded-xl bg-background border-border font-bold text-center text-xs" 
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-bold text-muted-foreground ml-1">Payment Instructions</Label>
                                <Textarea 
                                    value={paymentInstructions} 
                                    onChange={(e) => setPaymentInstructions(e.target.value)} 
                                    placeholder="Bank details, Account Name, Number, Mobile Money, etc..." 
                                    className="min-h-[80px] rounded-xl bg-background border-border p-3 text-xs font-medium" 
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border/50">
                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <Label className="text-[9px] font-bold text-muted-foreground ml-1">Signatory Name</Label>
                                        <Input 
                                            value={signatureName} 
                                            onChange={(e) => setSignatureName(e.target.value)} 
                                            placeholder="e.g. John Doe" 
                                            className="h-9 rounded-xl bg-background border-border text-xs font-semibold" 
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[9px] font-bold text-muted-foreground ml-1">Signatory Designation</Label>
                                        <Input 
                                            value={signatureDesignation} 
                                            onChange={(e) => setSignatureDesignation(e.target.value)} 
                                            placeholder="e.g. Finance Officer" 
                                            className="h-9 rounded-xl bg-background border-border text-xs font-semibold" 
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[9px] font-bold text-muted-foreground ml-1">Digital Signature</Label>
                                    <div 
                                        onClick={() => setIsSigModalOpen(true)}
                                        className="h-24 w-full rounded-xl border-2 border-dashed border-primary/20 bg-background hover:bg-primary/5 transition-all cursor-pointer flex items-center justify-center relative overflow-hidden"
                                    >
                                        {signatureUrl ? (
                                            <Image src={signatureUrl} alt="Signature" fill className="object-contain p-2" />
                                        ) : (
                                            <div className="flex flex-col items-center gap-1 opacity-40">
                                                <Edit3 className="h-4 w-4" />
                                                <span className="text-[9px] font-bold">Apply Digital Ink</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="p-4 bg-muted/20 border-t shrink-0 flex justify-between gap-3 items-center">
                            <Button 
                                type="button" 
                                variant="ghost" 
                                onClick={() => setIsEditing(false)} 
                                className="rounded-xl font-bold px-5 h-10 text-xs active:scale-[0.97]"
                            >
                                Cancel
                            </Button>
                            <Button 
                                type="submit" 
                                disabled={isSaving || !name.trim() || workspaceIds.length === 0} 
                                className="rounded-xl font-bold px-6 h-10 text-xs bg-primary text-white active:scale-[0.97]"
                            >
                                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />}
                                Commit Protocol
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
        </PageContainerFluid>
    );
}
