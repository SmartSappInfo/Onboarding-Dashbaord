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
    ShieldCheck, 
    Zap, 
    Loader2,
    Info,
    Settings2,
    CheckCircle2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MultiSelect } from '@/components/ui/multi-select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import StageEditor from '../components/StageEditor';
import { toTitleCase } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function PipelineSettingsClient() {
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const [selectedId, setSelectedId] = React.useState<string | null>(null);
    const [isCreating, setIsAdding] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);

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
        } else if (!isCreating) {
            setName('');
            setDescription('');
            setAccessRoles([]);
        }
    }, [selectedPipeline, isCreating]);

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
                const docRef = await addDoc(collection(firestore, 'pipelines'), {
                    ...data,
                    stageIds: [],
                    createdAt: new Date().toISOString()
                });
                toast({ title: 'New Pipeline Initialized' });
                setSelectedId(docRef.id);
                setIsAdding(false);
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!firestore || !selectedId || !confirm('Permanently purge this workflow architecture?')) return;
        try {
            await deleteDoc(doc(firestore, 'pipelines', selectedId));
            const stagesSnap = await getDocs(query(collection(firestore, 'onboardingStages'), where('pipelineId', '==', selectedId)));
            const batch = firestore ? require('firebase/firestore').writeBatch(firestore) : null;
            if (batch) {
                stagesSnap.forEach(d => batch.delete(d.ref));
                await batch.commit();
            }
            setSelectedId(null);
            toast({ title: 'Pipeline Purged' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Deletion Failed' });
        }
    };

    const roleOptions = roles?.map(r => ({ label: r.name, value: r.id })) || [];

    return (
        <div className="h-full overflow-y-auto bg-muted/5 text-left p-4 sm:p-8 md:p-12">
            <div className="max-w-5xl mx-auto space-y-10 pb-32">
                
                {/* Responsive Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-1">
                        <h1 className="text-3xl font-semibold tracking-tight text-foreground uppercase">Pipeline Configuration</h1>
                        <p className="text-sm text-muted-foreground font-medium uppercase tracking-widest">Modify Your Pipeline Stages and Access</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button 
                            variant="outline" 
                            onClick={() => { setSelectedId(null); setIsAdding(true); }}
                            className="rounded-xl font-semibold h-11 px-6 border-primary/20 text-primary bg-white shadow-sm"
                        >
                            <Plus className="mr-2 h-4 w-4" /> New Workflow
                        </Button>
                    </div>
                </div>

                {/* Top Context Switcher */}
                <Card className="rounded-2xl border-none ring-1 ring-border shadow-sm overflow-hidden bg-card">
                    <CardContent className="p-4 flex flex-col sm:flex-row items-center gap-4">
                        <div className="flex items-center gap-3 text-primary shrink-0 ml-2">
                            <Zap className="h-4 w-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Select Target</span>
                        </div>
                        <Select value={selectedId || (isCreating ? 'new' : '')} onValueChange={(val) => {
                            if (val === 'new') { setSelectedId(null); setIsAdding(true); }
                            else { setSelectedId(val); setIsAdding(false); }
                        }}>
                            <SelectTrigger className="flex-1 h-12 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-semibold text-lg">
                                <SelectValue placeholder="Choose a pipeline to modify..." />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-none shadow-2xl">
                                {pipelines?.map(p => (
                                    <SelectItem key={p.id} value={p.id} className="font-semibold py-3">{toTitleCase(p.name)}</SelectItem>
                                ))}
                                <Separator className="my-1" />
                                <SelectItem value="new" className="text-primary font-black italic">Initialize New Pipeline...</SelectItem>
                            </SelectContent>
                        </Select>
                    </CardContent>
                </Card>

                <AnimatePresence mode="wait">
                    {(selectedId || isCreating) ? (
                        <motion.div 
                            key={selectedId || 'new'} 
                            initial={{ opacity: 0, y: 10 }} 
                            animate={{ opacity: 1, y: 0 }} 
                            exit={{ opacity: 0, y: -10 }}
                            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
                        >
                            <div className="lg:col-span-2 space-y-8">
                                {/* Basic Directives */}
                                <Card className="rounded-[2rem] border-none ring-1 ring-border shadow-sm bg-white overflow-hidden">
                                    <CardHeader className="bg-muted/10 border-b p-6">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-white rounded-xl shadow-sm"><Settings2 className="h-4 w-4 text-primary" /></div>
                                            <CardTitle className="text-sm font-semibold uppercase tracking-widest">Master Directives</CardTitle>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-8 space-y-6">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground ml-1">Pipeline Label</Label>
                                            <Input 
                                                value={name} 
                                                onChange={e => setName(e.target.value)} 
                                                placeholder="e.g. Sales Pipeline" 
                                                className="h-12 rounded-xl bg-muted/20 border-none font-semibold text-lg px-4" 
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground ml-1">Scope Description</Label>
                                            <Textarea 
                                                value={description} 
                                                onChange={e => setDescription(e.target.value)} 
                                                placeholder="Brief summary of this workflow's purpose..." 
                                                className="min-h-[80px] rounded-xl bg-muted/20 border-none p-4 font-medium" 
                                            />
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Stage Architect */}
                                {selectedId && <StageEditor pipelineId={selectedId} />}
                            </div>

                            <div className="space-y-8">
                                {/* Access Control */}
                                <Card className="rounded-[2rem] border-none ring-1 ring-border shadow-sm bg-white overflow-hidden">
                                    <CardHeader className="bg-primary/5 border-b p-6">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-white rounded-xl shadow-sm"><ShieldCheck className="h-4 w-4 text-primary" /></div>
                                            <CardTitle className="text-sm font-semibold uppercase tracking-widest">Access Architecture</CardTitle>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-6 space-y-4">
                                        <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground ml-1">Authorized User Groups</Label>
                                        <MultiSelect 
                                            options={roleOptions}
                                            value={accessRoles}
                                            onChange={setAccessRoles}
                                            placeholder="Grant visibility to roles..."
                                            className="rounded-xl border-primary/10 shadow-sm"
                                        />
                                        <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 flex items-start gap-3 mt-2">
                                            <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                                            <p className="text-[9px] font-medium text-blue-800 leading-relaxed uppercase tracking-tighter">
                                                Only members of the selected roles will be able to view and manage schools in this pipeline.
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Finalize */}
                                <div className="space-y-4 pt-4 sticky top-24">
                                    <Button 
                                        onClick={handleSave} 
                                        disabled={isSaving || !name.trim()} 
                                        className="w-full h-14 rounded-2xl font-black text-sm shadow-xl uppercase tracking-[0.2em] transition-all active:scale-95 gap-2"
                                    >
                                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                        Commit Logic
                                    </Button>
                                    
                                    {selectedId && (
                                        <Button 
                                            variant="ghost" 
                                            onClick={handleDelete}
                                            className="w-full h-10 text-destructive font-semibold uppercase text-[9px] tracking-widest gap-2"
                                        >
                                            <Trash2 className="h-3 w-3" /> Purge Workflow
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        <div className="py-40 text-center opacity-20 flex flex-col items-center gap-6">
                            <Workflow size={80} />
                            <p className="text-sm font-semibold uppercase tracking-[0.3em]">No Pipeline Selected</p>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
