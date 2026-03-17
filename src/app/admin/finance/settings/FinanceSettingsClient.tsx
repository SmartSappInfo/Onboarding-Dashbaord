
'use client';

import * as React from 'react';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import type { BillingSettings } from '@/lib/types';
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
    Zap
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

/**
 * @fileOverview Finance Protocol Console.
 * Bound to the active workspace to allow track-specific tax and remittance logic.
 */
export default function FinanceSettingsClient() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { activeWorkspaceId, activeWorkspace } = useWorkspace();
    
    const [isSaving, setIsSaving] = React.useState(false);
    const [isSigModalOpen, setIsSigModalOpen] = React.useState(false);
    const [isLoadingLocal, setIsLoadingLocal] = React.useState(true);

    const [localSettings, setLocalSettings] = React.useState<Partial<BillingSettings>>({});

    // Fetch workspace-specific settings
    React.useEffect(() => {
        if (!firestore || !activeWorkspaceId) return;
        
        const load = async () => {
            setIsLoadingLocal(true);
            try {
                const docRef = doc(firestore, 'billing_settings', activeWorkspaceId);
                const snap = await getDoc(docRef);
                
                if (snap.exists()) {
                    setLocalSettings(snap.data() as BillingSettings);
                } else {
                    // Fallback to global defaults
                    const globalSnap = await getDoc(doc(firestore, 'billing_settings', 'global'));
                    if (globalSnap.exists()) {
                        setLocalSettings(globalSnap.data() as BillingSettings);
                    } else {
                        setLocalSettings({
                            levyPercent: 5,
                            vatPercent: 15,
                            defaultDiscount: 0,
                            paymentInstructions: 'Please make all payments into our official SmartSapp account.',
                            signatureName: '',
                            signatureDesignation: 'Finance Director',
                        });
                    }
                }
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoadingLocal(false);
            }
        };

        load();
    }, [firestore, activeWorkspaceId]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !activeWorkspaceId) return;
        
        setIsSaving(true);
        try {
            await setDoc(doc(firestore, 'billing_settings', activeWorkspaceId), {
                ...localSettings,
                id: activeWorkspaceId,
                updatedAt: new Date().toISOString(),
            }, { merge: true });
            
            toast({ title: 'Hub Protocols Updated', description: `Financial rules for ${activeWorkspace?.name} synchronized.` });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Update Failed' });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoadingLocal) {
        return (
            <div className="p-8 space-y-8 max-w-4xl mx-auto">
                <Skeleton className="h-12 w-64 rounded-xl" />
                <Skeleton className="h-96 w-full rounded-[2.5rem]" />
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5 text-left">
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight text-foreground uppercase flex items-center gap-3">
                            <Settings2 className="h-8 w-8 text-primary" />
                            Billing Protocols
                        </h1>
                        <p className="text-muted-foreground font-medium mt-1">Configure hub-specific tax rules and authorized signatories.</p>
                    </div>
                    <Badge variant="outline" className="h-10 px-4 rounded-xl border-primary/20 bg-primary/5 text-primary font-black uppercase text-[10px] gap-2">
                        <Layout className="h-3.5 w-3.5" />
                        Target: {activeWorkspace?.name}
                    </Badge>
                </div>

                <form onSubmit={handleSave} className="space-y-8 pb-32">
                    <Card className="border-none shadow-sm ring-1 ring-border rounded-[2.5rem] overflow-hidden bg-white">
                        <CardHeader className="bg-muted/30 border-b pb-6 px-8 pt-8">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-xl">
                                    <BadgePercent className="h-5 w-5 text-primary" />
                                </div>
                                <CardTitle className="text-lg font-black uppercase tracking-tight">Tax & Levy Configuration</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="p-8 space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Educational Levy (%)</Label>
                                    <div className="relative">
                                        <Input 
                                            type="number" 
                                            value={localSettings.levyPercent} 
                                            onChange={e => setLocalSettings(p => ({ ...p, levyPercent: Number(e.target.value) }))}
                                            className="h-12 rounded-xl bg-muted/20 border-none font-black text-xl shadow-inner text-center" 
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-muted-foreground/40">%</span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">VAT Rate (%)</Label>
                                    <div className="relative">
                                        <Input 
                                            type="number" 
                                            value={localSettings.vatPercent} 
                                            onChange={e => setLocalSettings(p => ({ ...p, vatPercent: Number(e.target.value) }))}
                                            className="h-12 rounded-xl bg-muted/20 border-none font-black text-xl shadow-inner text-center" 
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-muted-foreground/40">%</span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Global Hub Discount (%)</Label>
                                    <div className="relative">
                                        <Input 
                                            type="number" 
                                            value={localSettings.defaultDiscount} 
                                            onChange={e => setLocalSettings(p => ({ ...p, defaultDiscount: Number(e.target.value) }))}
                                            className="h-12 rounded-xl bg-muted/20 border-none font-black text-xl shadow-inner text-center" 
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-muted-foreground/40">%</span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm ring-1 ring-border rounded-[2.5rem] overflow-hidden bg-white">
                        <CardHeader className="bg-muted/30 border-b pb-6 px-8 pt-8">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-xl">
                                    <CreditCard className="h-5 w-5 text-primary" />
                                </div>
                                <CardTitle className="text-lg font-black uppercase tracking-tight">Remittance Instructions</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="p-8">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Track Payment Guide</Label>
                                <Textarea 
                                    value={localSettings.paymentInstructions} 
                                    onChange={e => setLocalSettings(p => ({ ...p, paymentInstructions: e.target.value }))}
                                    placeholder="Enter bank details specific to this hub..."
                                    className="min-h-[120px] rounded-2xl bg-muted/20 border-none p-6 font-medium leading-relaxed shadow-inner"
                                />
                                <p className="text-[9px] font-bold text-muted-foreground uppercase px-1 italic">Visible on all invoices generated within the {activeWorkspaceId} track.</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm ring-1 ring-border rounded-[2.5rem] overflow-hidden bg-white">
                        <CardHeader className="bg-muted/30 border-b pb-6 px-8 pt-8">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-xl">
                                    <Signature className="h-5 w-5 text-primary" />
                                </div>
                                <CardTitle className="text-lg font-black uppercase tracking-tight">Invoice Authentication</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="p-8 space-y-10">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Authorized Hub Representative</Label>
                                        <Input 
                                            value={localSettings.signatureName} 
                                            onChange={e => setLocalSettings(p => ({ ...p, signatureName: e.target.value }))}
                                            placeholder="e.g. Kwesi Arthur" 
                                            className="h-12 rounded-xl bg-muted/20 border-none font-bold shadow-inner" 
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Track Designation</Label>
                                        <Input 
                                            value={localSettings.signatureDesignation} 
                                            onChange={e => setLocalSettings(p => ({ ...p, signatureDesignation: e.target.value }))}
                                            placeholder="e.g. Head of Onboarding" 
                                            className="h-12 rounded-xl bg-muted/20 border-none font-bold shadow-inner" 
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Identity Signature</Label>
                                    <div 
                                        onClick={() => setIsSigModalOpen(true)}
                                        className="group relative h-32 w-full rounded-2xl border-2 border-dashed border-primary/20 bg-muted/10 hover:bg-primary/5 hover:border-primary/40 transition-all cursor-pointer overflow-hidden flex flex-col items-center justify-center gap-2"
                                    >
                                        {localSettings.signatureUrl ? (
                                            <div className="relative w-full h-full p-4">
                                                <img src={localSettings.signatureUrl} alt="Signature" className="w-full h-full object-contain" />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <p className="text-white font-black text-[10px] uppercase tracking-widest">Click to Change</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="p-3 bg-white rounded-full shadow-sm text-primary group-hover:scale-110 transition-transform">
                                                    <Edit3 className="h-5 w-5" />
                                                </div>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Click to Digitally Sign</p>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="p-6 rounded-[2rem] bg-emerald-50 border border-emerald-100 flex items-start gap-5 shadow-sm">
                        <div className="p-3 bg-emerald-100 rounded-2xl text-emerald-600 shadow-sm"><ShieldCheck className="h-6 w-6" /></div>
                        <div className="space-y-1">
                            <p className="text-sm font-black uppercase tracking-tight text-emerald-900">Hub Isolation Active</p>
                            <p className="text-[10px] text-emerald-700 leading-relaxed font-bold uppercase tracking-widest opacity-80 text-left">
                                These settings are strictly bound to the **{activeWorkspace?.name}** track. You can define different tax rules and signatures for other hub perspectives.
                            </p>
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <Button 
                            type="submit" 
                            disabled={isSaving} 
                            className="h-16 px-16 rounded-2xl font-black text-xl shadow-2xl shadow-primary/20 uppercase tracking-widest active:scale-95 transition-all gap-3"
                        >
                            {isSaving ? <Loader2 className="h-6 w-6 animate-spin" /> : <Zap className="h-6 w-6" />}
                            Sync Hub Protocols
                        </Button>
                    </div>
                </form>
            </div>

            <SignaturePadModal 
                open={isSigModalOpen}
                onClose={() => setIsSigModalOpen(false)}
                onSave={(dataUrl) => {
                    setLocalSettings(p => ({ ...p, signatureUrl: dataUrl }));
                    setIsSigModalOpen(false);
                }}
            />
        </div>
    );
}
