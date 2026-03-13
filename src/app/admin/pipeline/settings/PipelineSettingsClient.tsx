'use client';

import * as React from 'react';
import { 
    collection, 
    query, 
    orderBy, 
    addDoc, 
    doc, 
    deleteDoc, 
    updateDoc,
    getDocs,
    where
} from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { Pipeline, Role } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { 
    Workflow, 
    Plus, 
    Trash2, 
    Pencil, 
    Save, 
    ShieldCheck, 
    Layout, 
    Zap, 
    ChevronRight, 
    ArrowLeft,
    Loader2,
    X,
    Info,
    Check,
    Settings2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MultiSelect } from '@/components/ui/multi-select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import StageEditor from '../components/StageEditor';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * @fileOverview Pipeline Studio Client.
 * Allows administrators to architect custom multi-tenancy pipelines and define progression logic.
 */

export default function PipelineSettingsClient() {
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const [selectedId, setSelectedId] = React.useState<string | null>(null);
    const [isCreating, setIsAdding] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const [isDeletingId, setIsDeletingId] = React.useState<string | null>(null);

    // Form State
    const [name, setName] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [accessRoles, setAccessRoles] = React.useState<string[]>([]);

    const pipelinesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'pipelines'), orderBy('createdAt', 'desc')) : null, 
    [firestore]);
    const { data: pipelines, isLoading: isLoadingPipelines } = useCollection<Pipeline>(pipelinesQuery);

    const rolesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'roles'), orderBy('name', 'asc')) : null, 
    [firestore]);
    const { data: roles } = useCollection<Role>(rolesQuery);

    const selectedPipeline = React.useMemo(() => 
        pipelines?.find(p => p.id === selectedId),
    [pipelines, selectedId]);

    React.useEffect(() => {
        if (selectedPipeline) {
            setName(selectedPipeline.name);
            setDescription(selectedPipeline.description || '');
            setAccessRoles(selectedPipeline.accessRoles || []);
        } else {
            setName('');
            setDescription('');
            setAccessRoles([]);
        }
    }, [selectedPipeline]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !name.trim()) return;
        setIsSaving(true);

        const data = {
            name: name.trim(),
            description: description.trim(),
            accessRoles,
            updatedAt: new Date().toISOString()
        };

        try {
            if (selectedId) {
                await updateDoc(doc(firestore, 'pipelines', selectedId), data);
                toast({ title: 'Architecture Synchronized' });
            } else {
                await addDoc(collection(firestore, 'pipelines'), {
                    ...data,
                    stageIds: [],
                    createdAt: new Date().toISOString()
                });
                toast({ title: 'New Pipeline Initialized' });
                setIsAdding(false);
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!firestore || !confirm('Permanently purge this workflow architecture? Schools in this pipeline will be disconnected.')) return;
        setIsDeletingId(id);
        try {
            await deleteDoc(doc(firestore, 'pipelines', id));
            // Also cleanup stages
            const stagesSnap = await getDocs(query(collection(firestore, 'onboardingStages'), where('pipelineId', '==', id)));
            const batch = firestore ? require('firebase/firestore').writeBatch(firestore) : null;
            if (batch) {
                stagesSnap.forEach(d => batch.delete(d.ref));
                await batch.commit();
            }
            if (selectedId === id) setSelectedId(null);
            toast({ title: 'Pipeline Purged' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Deletion Failed' });
        } finally {
            setIsDeletingId(null);
        }
    };

    const roleOptions = roles?.map(r => ({ label: r.name, value: r.id })) || [];

    const itemTransition = { initial: { opacity: 0, x: -20 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -20 } };

    return (
        <div className="h-full overflow-hidden flex bg-muted/5 text-left">
            {/* Sidebar: Workflow Registry */}
            <aside className="w-80 border-r bg-white shrink-0 flex flex-col overflow-hidden">
                <div className="p-6 border-b bg-muted/10 shrink-0">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-xl text-primary"><Zap className="h-4 w-4" /></div>
                            <span className="text-xs font-black uppercase tracking-widest text-foreground/80">Registry</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-primary/10 text-primary" onClick={() => { setSelectedId(null); setIsAdding(true); }}>
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-relaxed">
                        Manage independent institutional lifecycles and operational progression rules.
                    </p>
                </div>

                <ScrollArea className="flex-1">
                    <div className="p-3 space-y-2">
                        {isLoadingPipelines ? (
                            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)
                        ) : pipelines?.map(p => (
                            <button
                                key={p.id}
                                onClick={() => { setSelectedId(p.id); setIsAdding(false); }}
                                className={cn(
                                    "w-full text-left p-4 rounded-2xl transition-all group flex items-center justify-between gap-3",
                                    selectedId === p.id ? "bg-primary text-white shadow-xl shadow-primary/20 scale-[1.02] z-10" : "hover:bg-muted/50 text-foreground/70"
                                )}
                            >
                                <div className="min-w-0">
                                    <p className="text-sm font-black uppercase tracking-tight truncate leading-none mb-1">{p.name}</p>
                                    <p className={cn("text-[9px] font-bold uppercase truncate opacity-60", selectedId === p.id ? "text-white" : "text-muted-foreground")}>
                                        {p.accessRoles?.length || 0} Authorized Roles
                                    </p>
                                </div>
                                <div className="flex items-center shrink-0">
                                    {selectedId === p.id ? <Check className="h-4 w-4 animate-in zoom-in" /> : <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />}
                                </div>
                            </button>
                        ))}
                    </div>
                </ScrollArea>
            </aside>

            {/* Main Studio Area */}
            <main className="flex-1 overflow-y-auto bg-muted/10 relative">
                <AnimatePresence mode="wait">
                    {(selectedId || isCreating) ? (
                        <motion.div key="editor" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="p-10 max-w-5xl mx-auto space-y-10 pb-32">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <Button variant="ghost" size="icon" onClick={() => { setSelectedId(null); setIsAdding(false); }} className="rounded-xl h-10 w-10"><ArrowLeft className="h-5 w-5" /></Button>
                                    <div>
                                        <h2 className="text-3xl font-black uppercase tracking-tight">{isCreating ? 'Initialize Pipeline' : 'Workflow Architecture'}</h2>
                                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{isCreating ? 'Blueprint Initialization Phase' : `Modifying ${selectedPipeline?.name}`}</p>
                                    </div>
                                </div>
                                {!isCreating && (
                                    <Button variant="ghost" size="icon" className="h-10 w-10 text-destructive hover:bg-destructive/10 rounded-xl" onClick={() => selectedId && handleDelete(selectedId)}>
                                        <Trash2 className="h-5 w-5" />
                                    </Button>
                                )}
                            </div>

                            <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                <div className="lg:col-span-2 space-y-8">
                                    <Card className="border-none shadow-sm ring-1 ring-border rounded-[2rem] overflow-hidden bg-white">
                                        <CardHeader className="bg-muted/30 border-b p-8">
                                            <div className="flex items-center gap-3 text-primary">
                                                <div className="p-2 bg-white rounded-xl shadow-sm"><Settings2 className="h-5 w-5" /></div>
                                                <CardTitle className="text-sm font-black uppercase tracking-widest">Master Directives</CardTitle>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="p-8 space-y-8">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Internal Pipeline Label</Label>
                                                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sales Acquisition" className="h-14 rounded-2xl bg-muted/20 border-none shadow-inner font-black text-2xl px-6" required />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">System Scope Description</Label>
                                                <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Define the operational boundaries of this workflow..." className="min-h-[120px] rounded-[1.5rem] bg-muted/20 border-none p-6 font-medium leading-relaxed shadow-inner" />
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Stages Architect - Only for existing pipelines */}
                                    {selectedId && <StageEditor pipelineId={selectedId} />}
                                </div>

                                <div className="space-y-8">
                                    <Card className="border-none shadow-sm ring-1 ring-border rounded-[2rem] overflow-hidden bg-white">
                                        <CardHeader className="bg-primary/5 border-b p-8">
                                            <div className="flex items-center gap-3 text-primary">
                                                <div className="p-2 bg-white rounded-xl shadow-sm"><ShieldCheck className="h-5 w-5" /></div>
                                                <CardTitle className="text-xs font-black uppercase tracking-widest">Authority Control</CardTitle>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="p-8 space-y-6">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Authorized Entry Groups</Label>
                                                <MultiSelect 
                                                    options={roleOptions}
                                                    value={accessRoles}
                                                    onChange={setAccessRoles}
                                                    placeholder="Grant visibility to Roles..."
                                                    className="rounded-xl border-primary/10 shadow-sm"
                                                />
                                                <p className="text-[9px] font-bold text-muted-foreground uppercase px-1 leading-relaxed mt-2 opacity-60">
                                                    Only users assigned to these roles will be able to view and manage schools in this pipeline.
                                                </p>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <div className="p-6 rounded-[2rem] bg-blue-50 border border-blue-100 flex items-start gap-4 shadow-sm">
                                        <Info className="h-6 w-6 text-blue-600 shrink-0 mt-0.5 opacity-40" />
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black uppercase text-blue-900 leading-tight">Protocol Synchronization</p>
                                            <p className="text-[9px] font-bold text-blue-700/60 leading-relaxed uppercase tracking-tighter">
                                                Pipeline changes propagate across all regional monitoring dashboards immediately.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="pt-4 sticky top-24">
                                        <Button 
                                            type="submit" 
                                            disabled={isSaving || !name.trim()} 
                                            className="w-full h-16 rounded-[1.5rem] font-black text-xl shadow-2xl shadow-primary/30 uppercase tracking-widest gap-3 transition-all active:scale-95"
                                        >
                                            {isSaving ? <Loader2 className="h-6 w-6 animate-spin" /> : <Save className="h-6 w-6" />}
                                            Commit Logic
                                        </Button>
                                    </div>
                                </div>
                            </form>
                        </motion.div>
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 opacity-20 selection:bg-transparent">
                            <Workflow size={120} className="mb-8" />
                            <h2 className="text-4xl font-black uppercase tracking-[0.2em] mb-2 leading-none">Pipeline Studio</h2>
                            <p className="text-sm font-bold uppercase tracking-widest">Select an architecture to begin reconfiguration.</p>
                        </div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
}