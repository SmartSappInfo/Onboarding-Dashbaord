
'use client';

import * as React from 'react';
import { doc, updateDoc, query, collection, orderBy, where } from 'firebase/firestore';
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
    Users
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
import StageEditor from './StageEditor';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useWorkspaceUsers } from '@/hooks/use-workspace-users';

interface PipelineConfigViewProps {
    pipelineId: string;
    columnWidth: number;
    onWidthChange: (width: number) => void;
}

export default function PipelineConfigView({ pipelineId, columnWidth, onWidthChange }: PipelineConfigViewProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { activeWorkspaceId, allowedWorkspaces } = useWorkspace();
    
    const [isSaving, setIsSaving] = React.useState(false);
    const [name, setName] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [accessRoles, setAccessRoles] = React.useState<string[]>([]);
    const [workspaceIds, setWorkspaceIds] = React.useState<string[]>([]);
    const [assignmentStrategy, setAssignmentStrategy] = React.useState<'direct' | 'round-robin' | 'value-based' | 'unassigned'>('direct');
    const [assignmentUserIds, setAssignmentUserIds] = React.useState<string[]>([]);

    const pipelineRef = useMemoFirebase(() => 
        firestore ? doc(firestore, 'pipelines', pipelineId) : null, 
    [firestore, pipelineId]);
    const { data: pipeline, isLoading } = useDoc<Pipeline>(pipelineRef);

    const { data: workspaceUsers } = useWorkspaceUsers(activeWorkspaceId);

    const rolesQuery = useMemoFirebase(() => 
        firestore && activeWorkspaceId ? query(
            collection(firestore, 'roles'), 
            where('workspaceIds', 'array-contains', activeWorkspaceId)
        ) : null, 
    [firestore, activeWorkspaceId]);
    const { data: rawRoles } = useCollection<Role>(rolesQuery);

    const roles = React.useMemo(() => {
        if (!rawRoles) return [];
        return [...rawRoles].sort((a, b) => a.name.localeCompare(b.name));
    }, [rawRoles]);

    React.useEffect(() => {
        if (pipeline) {
            setName(pipeline.name);
            setDescription(pipeline.description || '');
            setAccessRoles(pipeline.accessRoles || []);
            setWorkspaceIds(pipeline.workspaceIds || []);
            setAssignmentStrategy(pipeline.assignmentStrategy || 'direct');
            setAssignmentUserIds(pipeline.assignmentUserIds || []);
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
                assignmentStrategy,
                assignmentUserIds,
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
    const workspaceUserOptions = workspaceUsers?.map(u => ({ label: u.name || u.email || 'Workspace User', value: u.id })) || [];
    const workspaceOptions = allowedWorkspaces.map(w => ({ label: w.name, value: w.id }));

    if (isLoading) return <div className="space-y-8 animate-pulse"><div className="h-64 bg-muted rounded-2xl" /><div className="h-96 bg-muted rounded-2xl" /></div>;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-left">
            <div className="lg:col-span-2 space-y-8">
                <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                    <CardHeader className="p-6 pb-2">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-primary/5 text-primary shrink-0"><Settings2 size={18} /></div>
                            <CardTitle className="text-sm font-semibold tracking-tight text-foreground">Master Blueprint</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="p-8 space-y-8">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold text-muted-foreground ml-1">Pipeline Label</Label>
                            <Input value={name} onChange={e => setName(e.target.value)} className="h-10 rounded-xl border border-border bg-background shadow-sm text-sm px-4 focus:ring-1 focus:ring-primary/20 transition-all font-medium" />
                        </div>

                        <div className="space-y-4">
                            <Label className="text-[10px] font-semibold text-primary ml-1 flex items-center gap-2"><Layout size={14} /> Shared Workspace Context</Label>
                            <MultiSelect options={workspaceOptions} value={workspaceIds} onChange={setWorkspaceIds} placeholder="Assign to hubs..." className="rounded-xl border-border shadow-sm text-xs" />
                        </div>
                        
                        <div className="space-y-4 p-5 rounded-2xl bg-muted/10 border border-border/60">
                            <div className="flex justify-between items-center px-1">
                                <Label className="text-[10px] font-semibold text-primary">Column Density</Label>
                                <Badge variant="outline" className="font-mono text-[10px] bg-background border-primary/20 text-primary rounded-lg">{columnWidth}px</Badge>
                            </div>
                            <Slider value={[columnWidth]} onValueChange={([v]) => onWidthChange(v)} min={280} max={500} step={10} />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold text-muted-foreground ml-1">Scope Description</Label>
                            <Textarea value={description} onChange={e => setDescription(e.target.value)} className="min-h-[80px] rounded-xl border border-border bg-background shadow-sm text-sm p-4 focus:ring-1 focus:ring-primary/20 transition-all font-medium" />
                        </div>
                    </CardContent>
                </Card>

                <StageEditor pipelineId={pipelineId} />
            </div>

            <div className="space-y-8">
                <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                    <CardHeader className="p-6 pb-2">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-primary/5 text-primary shrink-0"><ShieldCheck size={18} /></div>
                            <CardTitle className="text-sm font-semibold tracking-tight text-foreground">Access Architecture</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                        <Label className="text-[10px] font-bold text-muted-foreground ml-1">Authorized User Roles</Label>
                        <MultiSelect options={roleOptions} value={accessRoles} onChange={setAccessRoles} placeholder="Grant visibility..." className="rounded-xl border-border shadow-sm text-xs" />
                    </CardContent>
                </Card>

                <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                    <CardHeader className="p-6 pb-2">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-primary/5 text-primary shrink-0">
                                <Users size={18} />
                            </div>
                            <CardTitle className="text-sm font-semibold tracking-tight text-foreground">Deal Assignment Rules</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold text-muted-foreground ml-1">Routing Strategy</Label>
                            <Select 
                                value={assignmentStrategy} 
                                onValueChange={(val: any) => setAssignmentStrategy(val)}
                            >
                                <SelectTrigger className="w-full h-10 rounded-xl bg-background border border-border px-3 text-sm focus:ring-1 focus:ring-primary/20">
                                    <SelectValue placeholder="Select strategy..." />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border border-border shadow-lg bg-popover text-popover-foreground">
                                    <SelectItem value="direct" className="text-xs">Manual (Inherit from Entity owner)</SelectItem>
                                    <SelectItem value="round-robin" className="text-xs">Round Robin (Equal distribution)</SelectItem>
                                    <SelectItem value="value-based" className="text-xs">Round Robin based on Deal Value</SelectItem>
                                    <SelectItem value="unassigned" className="text-xs">Leave Unassigned</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {(assignmentStrategy === 'round-robin' || assignmentStrategy === 'value-based') && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                <Label className="text-[10px] font-bold text-muted-foreground ml-1">Assignee Pool</Label>
                                <MultiSelect 
                                    options={workspaceUserOptions} 
                                    value={assignmentUserIds} 
                                    onChange={setAssignmentUserIds} 
                                    placeholder="Select eligible team members..." 
                                    className="rounded-xl border border-border shadow-sm text-xs" 
                                />
                                <p className="text-[10px] text-muted-foreground ml-1 italic leading-normal">
                                    Deals will be routed dynamically among the selected pool.
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="pt-4 sticky top-24">
                    <Button onClick={handleSave} disabled={isSaving || !name.trim()} className="w-full h-10 rounded-xl font-bold text-xs bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all active:scale-[0.98] gap-2 flex items-center justify-center">
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Save Configuration
                    </Button>
                </div>
            </div>
        </div>
    );
}
