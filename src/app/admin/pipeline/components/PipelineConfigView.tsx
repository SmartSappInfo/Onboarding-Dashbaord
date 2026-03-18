
'use client';

import * as React from 'react';
import { 
    collection, 
    query, 
    orderBy, 
    doc, 
    updateDoc,
    where
} from 'firebase/firestore';
import { useFirestore, useDoc, useCollection, useMemoFirebase, useUser } from '@/firebase';
import type { Pipeline, Role } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { 
    ShieldCheck, 
    Loader2,
    Settings2,
    CheckCircle2,
    Maximize,
    Info,
    Layout,
    Star,
    Zap
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MultiSelect } from '@/components/ui/multi-select';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import StageEditor from './StageEditor';
import { setPipelineAsDefaultAction } from '@/lib/pipeline-actions';

interface PipelineConfigViewProps {
    pipelineId: string;
    columnWidth: number;
    onWidthChange: (width: number) => void;
}

/**
 * @fileOverview Pipeline Architecture Console.
 * Upgraded with "Workspace Default" exclusive toggle logic.
 */
export default function PipelineConfigView({ pipelineId, columnWidth, onWidthChange }: PipelineConfigViewProps) {
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();
    
    const [isSaving, setIsSaving] = React.useState(false);
    const [name, setName] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [accessRoles, setAccessRoles] = React.useState<string[]>([]);
    const [isUpdatingDefault, setIsUpdatingDefault] = React.useState(false);

    const pipelineRef = useMemoFirebase(() => 
        firestore ? doc(firestore, 'pipelines', pipelineId) : null, 
    [firestore, pipelineId]);
    
    const { data: pipeline, isLoading: isPipelineLoading } = useDoc<Pipeline>(pipelineRef);

    const rolesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'roles'), orderBy('name', 'asc')) : null, 
    [firestore]);
    const { data: roles } = useCollection<Role>(rolesQuery);

    React.useEffect(() => {
        if (pipeline) {
            setName(pipeline.name);
            setDescription(pipeline.description || '');
            setAccessRoles(pipeline.accessRoles || []);
            if (pipeline.columnWidth) {
                onWidthChange(pipeline.columnWidth);
            }
        }
    }, [pipeline, onWidthChange]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !name.trim()) return;
        setIsSaving(true);

        try {
            await updateDoc(doc(firestore, 'pipelines', pipelineId), {
                name: name.trim(),
                description: description.trim(),
                accessRoles,
                columnWidth,
                updatedAt: new Date().toISOString()
            });
            
            toast({ title: 'Logic Synchronized', description: 'Pipeline architecture updated.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleDefault = async (val: boolean) => {
        if (!user || !pipeline || isUpdatingDefault) return;
        
        // If unsetting, it's a simple update. If setting, it requires the exclusive logic action.
        setIsUpdatingDefault(true);
        try {
            if (val) {
                const res = await setPipelineAsDefaultAction(pipelineId, pipeline.workspaceId, user.uid);
                if (!res.success) throw new Error(res.error);
                toast({ title: 'Default Identity Promoted', description: `This pipeline will now load by default in the "${pipeline.workspaceId}" track.` });
            } else {
                await updateDoc(doc(firestore, 'pipelines', pipelineId), { 
                    isDefault: false, 
                    updatedAt: new Date().toISOString() 
                });
                toast({ title: 'Default Status Withdrawn' });
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Action Failed', description: e.message });
        } finally {
            setIsUpdatingDefault(false);
        }
    };

    const roleOptions = roles?.map(r => ({ label: r.name, value: r.id })) || [];

    if (isPipelineLoading) {
        return (
            <div className="space-y-8 animate-pulse">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-8">
                        <div className="h-64 bg-muted rounded-[2.5rem]" />
                        <div className="h-96 bg-muted rounded-[2.5rem]" />
                    </div>
                    <div className="h-64 bg-muted rounded-[2.5rem]" />
                </div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-left animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="lg:col-span-2 space-y-8">
                {/* Master Directives */}
                <Card className="rounded-[2.5rem] border-none ring-1 ring-border shadow-sm bg-white overflow-hidden">
                    <CardHeader className="bg-muted/10 border-b p-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white rounded-xl shadow-sm"><Settings2 className="h-4 w-4 text-primary" /></div>
                                <CardTitle className="text-sm font-black uppercase tracking-tight">Master Directives</CardTitle>
                            </div>
                            {pipeline?.isDefault && (
                                <Badge className="bg-primary text-white border-none font-black text-[8px] uppercase h-5 px-2 gap-1 shadow-lg shadow-primary/20">
                                    <Star className="h-2.5 w-2.5 fill-white" /> Workspace Default
                                </Badge>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="p-8 space-y-8">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Pipeline Identity</Label>
                            <Input 
                                value={name} 
                                onChange={e => setName(e.target.value)} 
                                placeholder="e.g. Sales Pipeline" 
                                className="h-12 rounded-xl bg-muted/20 border-none font-semibold text-lg px-4 shadow-inner" 
                            />
                        </div>

                        {/* Exclusive Default Toggle */}
                        <div className={cn(
                            "p-5 rounded-2xl border-2 transition-all duration-500",
                            pipeline?.isDefault ? "bg-primary/5 border-primary/20" : "bg-muted/10 border-border/50"
                        )}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={cn(
                                        "p-2.5 rounded-xl shadow-sm transition-all",
                                        pipeline?.isDefault ? "bg-primary text-white" : "bg-white text-muted-foreground"
                                    )}>
                                        <Layout className="h-4 w-4" />
                                    </div>
                                    <div className="space-y-0.5">
                                        <Label className="text-sm font-black uppercase tracking-tight">Workspace Default</Label>
                                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">Promote this as the primary entry point</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {isUpdatingDefault && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                                    <Switch 
                                        checked={!!pipeline?.isDefault} 
                                        onCheckedChange={handleToggleDefault}
                                        disabled={isUpdatingDefault}
                                        className="scale-110"
                                    />
                                </div>
                            </div>
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
                                onValueChange={([v]) => onWidthChange(v)}
                                min={280}
                                max={500}
                                step={10}
                            />
                            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter text-center">Adjust Kanban density for optimal board navigation.</p>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Contextual Description</Label>
                            <Textarea 
                                value={description} 
                                onChange={e => setDescription(e.target.value)} 
                                placeholder="Brief summary of this workflow's purpose..." 
                                className="min-h-[80px] rounded-xl bg-muted/20 border-none p-4 font-medium shadow-inner" 
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Stage Architect */}
                <StageEditor pipelineId={pipelineId} />
            </div>

            <div className="space-y-8">
                {/* Access Architecture */}
                <Card className="rounded-[2rem] border-none ring-1 ring-border shadow-sm bg-white overflow-hidden">
                    <CardHeader className="bg-primary/5 border-b p-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white rounded-xl shadow-sm"><ShieldCheck className="h-4 w-4 text-primary" /></div>
                            <CardTitle className="text-sm font-black uppercase tracking-tight">Access Control</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Authorized User Roles</Label>
                        <MultiSelect 
                            options={roleOptions}
                            value={accessRoles}
                            onChange={setAccessRoles}
                            placeholder="Grant visibility..."
                            className="rounded-xl border-primary/10 shadow-sm"
                        />
                        <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 flex items-start gap-3 mt-2">
                            <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                            <p className="text-[9px] font-bold text-blue-800 leading-relaxed uppercase tracking-tighter text-left">
                                Restricted context: Only members of these roles can view schools in this pipeline.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Submit Container */}
                <div className="space-y-4 pt-4 sticky top-24">
                    <Button 
                        onClick={handleSave} 
                        disabled={isSaving || !name.trim()} 
                        className="w-full h-14 rounded-2xl font-black text-xs shadow-xl uppercase tracking-[0.2em] transition-all active:scale-95 gap-2 shadow-primary/20"
                    >
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Save Configuration
                    </Button>
                </div>
            </div>
        </div>
    );
}
