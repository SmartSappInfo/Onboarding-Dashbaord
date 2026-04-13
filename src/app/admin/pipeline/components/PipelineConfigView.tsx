
'use client';

import * as React from 'react';
import { doc, updateDoc, query, collection, orderBy } from 'firebase/firestore';
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
import StageEditor from './StageEditor';
import { useWorkspace } from '@/context/WorkspaceContext';

interface PipelineConfigViewProps {
    pipelineId: string;
    columnWidth: number;
    onWidthChange: (width: number) => void;
}

export default function PipelineConfigView({ pipelineId, columnWidth, onWidthChange }: PipelineConfigViewProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { allowedWorkspaces } = useWorkspace();
    
    const [isSaving, setIsSaving] = React.useState(false);
    const [name, setName] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [accessRoles, setAccessRoles] = React.useState<string[]>([]);
    const [workspaceIds, setWorkspaceIds] = React.useState<string[]>([]);

    const pipelineRef = useMemoFirebase(() => 
        firestore ? doc(firestore, 'pipelines', pipelineId) : null, 
    [firestore, pipelineId]);
    const { data: pipeline, isLoading } = useDoc<Pipeline>(pipelineRef);

    const rolesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'roles'), orderBy('name', 'asc')) : null, 
    [firestore]);
    const { data: roles } = useCollection<Role>(rolesQuery);

    React.useEffect(() => {
        if (pipeline) {
            setName(pipeline.name);
            setDescription(pipeline.description || '');
            setAccessRoles(pipeline.accessRoles || []);
            setWorkspaceIds(pipeline.workspaceIds || []);
            if (pipeline.columnWidth) onWidthChange(pipeline.columnWidth);
        }
    }, [pipeline, onWidthChange]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !name.trim() || workspaceIds.length === 0) {
            if (workspaceIds.length === 0) toast({ variant: 'destructive', title: 'Constraint Alert', description: 'Pipeline must belong to at least one workspace.' });
            return;
        }
        setIsSaving(true);

        try {
            await updateDoc(doc(firestore, 'pipelines', pipelineId), {
                name: name.trim(),
                description: description.trim(),
                accessRoles,
                workspaceIds,
                columnWidth,
                updatedAt: new Date().toISOString()
            });
            toast({ title: 'Architecture Synchronized' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    const roleOptions = roles?.map(r => ({ label: r.name, value: r.id })) || [];
    const workspaceOptions = allowedWorkspaces.map(w => ({ label: w.name, value: w.id }));

 if (isLoading) return <div className="space-y-8 animate-pulse"><div className="h-64 bg-muted rounded-[2.5rem]" /><div className="h-96 bg-muted rounded-[2.5rem]" /></div>;

    return (
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-left">
 <div className="lg:col-span-2 space-y-8">
 <Card className="rounded-[2.5rem] border-none ring-1 ring-border shadow-sm bg-white overflow-hidden">
 <CardHeader className="bg-muted/10 border-b p-6">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-white rounded-xl shadow-sm text-primary"><Settings2 size={18} /></div>
 <CardTitle className="text-sm font-semibold tracking-tight">Master Blueprint</CardTitle>
                        </div>
                    </CardHeader>
 <CardContent className="p-8 space-y-8">
 <div className="space-y-2">
 <Label className="text-[10px] font-bold text-muted-foreground ml-1">Pipeline Label</Label>
 <Input value={name} onChange={e => setName(e.target.value)} className="h-12 rounded-xl bg-muted/20 border-none font-semibold text-lg px-4 shadow-inner" />
                        </div>

 <div className="space-y-4">
 <Label className="text-[10px] font-semibold text-primary ml-1 flex items-center gap-2"><Layout size={14} /> Shared Workspace Context</Label>
                            <MultiSelect options={workspaceOptions} value={workspaceIds} onChange={setWorkspaceIds} placeholder="Assign to hubs..." />
                        </div>
                        
 <div className="space-y-4 p-6 rounded-2xl bg-primary/[0.02] border-2 border-dashed border-primary/10">
 <div className="flex justify-between items-center px-1">
 <Label className="text-[10px] font-semibold text-primary">Column Density</Label>
                                <Badge variant="outline" className="font-mono text-[10px] bg-white border-primary/20 text-primary">{columnWidth}px</Badge>
                            </div>
                            <Slider value={[columnWidth]} onValueChange={([v]) => onWidthChange(v)} min={280} max={500} step={10} />
                        </div>

 <div className="space-y-2">
 <Label className="text-[10px] font-bold text-muted-foreground ml-1">Scope Description</Label>
 <Textarea value={description} onChange={e => setDescription(e.target.value)} className="min-h-[80px] rounded-xl bg-muted/20 border-none p-4 font-medium" />
                        </div>
                    </CardContent>
                </Card>

                <StageEditor pipelineId={pipelineId} />
            </div>

 <div className="space-y-8">
 <Card className="rounded-[2rem] border-none ring-1 ring-border shadow-sm bg-white overflow-hidden">
 <CardHeader className="bg-primary/5 border-b p-6">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-white rounded-xl shadow-sm text-primary"><ShieldCheck size={18} /></div>
 <CardTitle className="text-sm font-semibold tracking-tight">Access Architecture</CardTitle>
                        </div>
                    </CardHeader>
 <CardContent className="p-6 space-y-4">
 <Label className="text-[10px] font-bold text-muted-foreground ml-1">Authorized User Roles</Label>
                        <MultiSelect options={roleOptions} value={accessRoles} onChange={setAccessRoles} placeholder="Grant visibility..." />
                    </CardContent>
                </Card>

 <div className="pt-4 sticky top-24">
 <Button onClick={handleSave} disabled={isSaving || !name.trim()} className="w-full h-14 rounded-2xl font-semibold text-xs shadow-xl transition-all active:scale-95 gap-2">
 {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Save Configuration
                    </Button>
                </div>
            </div>
        </div>
    );
}
