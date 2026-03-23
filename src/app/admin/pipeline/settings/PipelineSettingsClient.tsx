'use client';

import * as React from 'react';
import { doc, updateDoc, query, collection, orderBy, where, getDocs, deleteDoc, writeBatch, addDoc } from 'firebase/firestore';
import { useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import type { Pipeline, Role } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { 
    ShieldCheck, 
    Loader2,
    Settings2,
    CheckCircle2,
    Maximize,
    Layout,
    Zap,
    Plus,
    Trash2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/multi-select';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import StageEditor from '../components/StageEditor';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Separator } from '@/components/ui/separator';
import { AnimatePresence, motion } from 'framer-motion';

interface PipelineConfigViewProps {
    pipelineId: string;
    columnWidth: number;
    onWidthChange: (width: number) => void;
}

export default function PipelineSettingsClient() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { activeWorkspaceId, allowedWorkspaces } = useWorkspace();
    
    const [selectedId, setSelectedId] = React.useState<string | null>(null);
    const [isCreating, setIsAdding] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);

    // Form State
    const [name, setName] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [accessRoles, setAccessRoles] = React.useState<string[]>([]);
    const [columnWidth, setColumnWidth] = React.useState(320);

    // Synchronized Pipeline Query
    const pipelinesQuery = useMemoFirebase(() => 
        firestore && activeWorkspaceId ? query(
            collection(firestore, 'pipelines'), 
            where('workspaceIds', 'array-contains', activeWorkspaceId),
            orderBy('createdAt', 'desc')
        ) : null, 
    [firestore, activeWorkspaceId]);
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
            if (selectedPipeline.columnWidth) setColumnWidth(selectedPipeline.columnWidth);
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
            columnWidth,
            updatedAt: new Date().toISOString()
        };

        try {
            if (selectedId) {
                await updateDoc(doc(firestore, 'pipelines', selectedId), data);
                toast({ title: 'Architecture Synchronized' });
            } else {
                const docRef = await addDoc(collection(firestore, 'pipelines'), {
                    ...data,
                    workspaceIds: [activeWorkspaceId],
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
            const batch = writeBatch(firestore);
            stagesSnap.forEach(d => batch.delete(d.ref));
            await batch.commit();
            setSelectedId(null);
            toast({ title: 'Pipeline Purged' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Deletion Failed' });
        }
    };

    const roleOptions = roles?.map(r => ({ label: r.name, value: r.id })) || [];

    if (isLoadingPipelines) return <div className="space-y-8 animate-pulse"><div className="h-64 bg-muted rounded-[2.5rem]" /><div className="h-96 bg-muted rounded-[2.5rem]" /></div>;

    return (
        <div className="h-full overflow-y-auto bg-muted/5 text-left p-4 sm:p-8 md:p-12">
            <div className="max-w-5xl mx-auto space-y-10 pb-32">
                
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-1 text-left">
                        <h1 className="text-3xl font-black tracking-tight text-foreground uppercase">Pipeline Architecture</h1>
                        <p className="text-sm text-muted-foreground font-medium uppercase tracking-widest">Modify shared stages and access rules for {activeWorkspaceId}.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button 
                            variant="outline" 
                            onClick={() => { setSelectedId(null); setIsAdding(true); }}
                            className="rounded-xl font-bold h-11 px-6 border-primary/20 text-primary bg-white shadow-sm"
                        >
                            <Plus className="mr-2 h-4 w-4" /> New Workflow
                        </Button>
                    </div>
                </div>

                <Card className="rounded-2xl border-none shadow-sm ring-1 ring-border overflow-hidden bg-card">
                    <CardContent className="p-4 flex flex-col sm:flex-row items-center gap-4">
                        <div className="flex items-center gap-3 text-primary shrink-0 ml-2">
                            <Zap className="h-4 w-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Select Target</span>
                        </div>
                        <Select value={selectedId || (isCreating ? 'new' : '')} onValueChange={(val) => {
                            if (val === 'new') { setSelectedId(null); setIsAdding(true); }
                            else { setSelectedId(val); setIsAdding(false); }
                        }}>
                            <SelectTrigger className="flex-1 h-12 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-black text-lg">
                                <SelectValue placeholder="Choose a pipeline to modify..." />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-none shadow-2xl">
                                {pipelines?.map(p => (
                                    <SelectItem key={p.id} value={p.id} className="font-black uppercase py-3 text-xs">{p.name}</SelectItem>
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
                                <Card className="rounded-[2.5rem] border-none ring-1 ring-border shadow-sm bg-white overflow-hidden">
                                    <CardHeader className="bg-muted/10 border-b p-6 px-8">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-white rounded-xl shadow-sm"><Settings2 className="h-4 w-4 text-primary" /></div>
                                            <CardTitle className="text-sm font-black uppercase tracking-widest">Master Directives</CardTitle>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-8 space-y-8 text-left">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Pipeline Label</Label>
                                            <Input 
                                                value={name} 
                                                onChange={e => setName(e.target.value)} 
                                                placeholder="e.g. Sales Pipeline" 
                                                className="h-12 rounded-xl bg-muted/20 border-none font-black text-lg px-4" 
                                            />
                                        </div>
                                        
                                        <div className="space-y-4 p-6 rounded-2xl bg-primary/[0.02] border-2 border-dashed border-primary/10">
                                            <div className="flex justify-between items-center px-1">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                                    <Maximize className="h-3.5 w-3.5" /> Stage Column Width
                                                </Label>
                                                <Badge variant="outline" className="font-mono tabular-nums text-[10px] bg-white border-primary/20 text-primary">
                                                    {columnWidth}px
                                                </Badge>
                                            </div>
                                            <Slider 
                                                value={[columnWidth]} 
                                                onValueChange={([v]) => setColumnWidth(v)}
                                                min={280}
                                                max={500}
                                                step={10}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Scope Description</Label>
                                            <Textarea 
                                                value={description} 
                                                onChange={e => setDescription(e.target.value)} 
                                                placeholder="Define the purpose..." 
                                                className="min-h-[80px] rounded-xl bg-muted/20 border-none p-4 font-medium" 
                                            />
                                        </div>
                                    </CardContent>
                                </Card>

                                {selectedId && <StageEditor pipelineId={selectedId} />}
                            </div>

                            <div className="space-y-8">
                                <Card className="rounded-[2rem] border-none ring-1 ring-border shadow-sm bg-white overflow-hidden text-left">
                                    <CardHeader className="bg-primary/5 border-b p-6 px-8">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-white rounded-xl shadow-sm"><ShieldCheck className="h-4 w-4 text-primary" /></div>
                                            <CardTitle className="text-sm font-black uppercase tracking-tight">Access Control</CardTitle>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-6 space-y-4">
                                        <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Authorized Roles</Label>
                                        <MultiSelect 
                                            options={roleOptions}
                                            value={accessRoles}
                                            onChange={setAccessRoles}
                                            placeholder="Grant visibility..."
                                            className="rounded-xl border-primary/10 shadow-sm"
                                        />
                                    </CardContent>
                                </Card>

                                <div className="space-y-4 pt-4 sticky top-24">
                                    <Button 
                                        onClick={handleSave} 
                                        disabled={isSaving || !name.trim()} 
                                        className="w-full h-14 rounded-2xl font-black text-sm shadow-xl uppercase tracking-[0.2em] transition-all active:scale-95 gap-2"
                                    >
                                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                        Commit Architecture
                                    </Button>
                                    
                                    {selectedId && (
                                        <Button 
                                            variant="ghost" 
                                            onClick={handleDelete}
                                            className="w-full h-10 text-destructive font-black uppercase text-[9px] tracking-widest gap-2"
                                        >
                                            <Trash2 className="h-3 w-3" /> Purge Workflow
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ) : null}
                </AnimatePresence>
            </div>
        </div>
    );
}
