
'use client';

import * as React from 'react';
import { doc, updateDoc, query, collection, orderBy, where } from 'firebase/firestore';
import { useFirestore, useDoc, useMemoFirebase, useCollection, useUser } from '@/firebase';
import type { Pipeline, Role } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { archivePipelineAction, deletePipelineAction } from '@/lib/pipeline-actions';
import { 
    Loader2,
    CheckCircle2,
    AlertTriangle,
    Archive,
    Trash2,
    RefreshCw,
    Copy
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import StageEditor from './StageEditor';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useWorkspaceUsers } from '@/hooks/use-workspace-users';
import { PipelineConfigFields, type PipelineFormData } from './PipelineConfigFields';

interface PipelineConfigViewProps {
    pipelineId: string;
    columnWidth: number;
    onWidthChange: (width: number) => void;
    onPipelineSelect?: (pipelineId: string) => void;
}

export default function PipelineConfigView({ pipelineId, columnWidth, onWidthChange, onPipelineSelect }: PipelineConfigViewProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const confirm = useConfirm();
    const { user } = useUser();
    const { activeWorkspaceId, allowedWorkspaces, activeOrganizationId } = useWorkspace();
    
    const [isSaving, setIsSaving] = React.useState(false);
    const [isArchiving, setIsArchiving] = React.useState(false);
    const [isDeleting, setIsDeleting] = React.useState(false);
    const [isCloning, setIsCloning] = React.useState(false);

    // Controlled form state adhering to single source of truth (PipelineConfigFields)
    const [formData, setFormData] = React.useState<PipelineFormData>({
        name: '',
        description: '',
        type: 'sales',
        defaultProbability: 50,
        workspaceIds: [],
        columnWidth: columnWidth || 320,
        showDealTotals: false,
        defaultPresetViewId: 'preset_all_deals',
        accessRoles: [],
        assignmentStrategy: 'direct',
        assignmentUserIds: [],
        defaultCloseDateOffsetValue: '',
        defaultCloseDateOffsetUnit: 'days',
    });

    const updateField = React.useCallback(<K extends keyof PipelineFormData>(key: K, value: PipelineFormData[K]) => {
        setFormData(prev => ({ ...prev, [key]: value }));
        if (key === 'columnWidth' && typeof value === 'number') {
            onWidthChange(value);
        }
    }, [onWidthChange]);

    const handleArchive = async () => {
        if (!user) return;
        const approved = await confirm({
            title: 'Archive Pipeline?',
            description: 'This will hide the pipeline from the active selection. You can restore it later.',
            confirmText: 'Archive',
            variant: 'destructive'
        });
        if (!approved) return;

        setIsArchiving(true);
        try {
            const res = await archivePipelineAction(pipelineId, true, user.uid);
            if (res.success) {
                toast({ title: 'Pipeline Archived' });
            } else {
                throw new Error(res.error || 'Failed to archive pipeline');
            }
        } catch (e: unknown) {
            const error = e instanceof Error ? e.message : 'Unknown error';
            toast({ variant: 'destructive', title: 'Archive Failed', description: error });
        } finally {
            setIsArchiving(false);
        }
    };

    const handleRestore = async () => {
        if (!user) return;
        const approved = await confirm({
            title: 'Restore Pipeline?',
            description: 'This will return the pipeline to the active selection list.',
            confirmText: 'Restore',
        });
        if (!approved) return;

        setIsArchiving(true);
        try {
            const res = await archivePipelineAction(pipelineId, false, user.uid);
            if (res.success) {
                toast({ title: 'Pipeline Restored' });
            } else {
                throw new Error(res.error || 'Failed to restore pipeline');
            }
        } catch (e: unknown) {
            const error = e instanceof Error ? e.message : 'Unknown error';
            toast({ variant: 'destructive', title: 'Restore Failed', description: error });
        } finally {
            setIsArchiving(false);
        }
    };

    const handleDelete = async () => {
        if (!user) return;
        const approved = await confirm({
            title: 'Permanently Delete Pipeline?',
            description: 'This action cannot be undone. All stage configurations will be removed.',
            confirmText: 'Delete',
            variant: 'destructive'
        });
        if (!approved) return;

        setIsDeleting(true);
        try {
            const res = await deletePipelineAction(pipelineId, user.uid);
            if (res.success) {
                toast({ title: 'Pipeline Terminated' });
            } else {
                throw new Error(res.error || 'Failed to delete pipeline');
            }
        } catch (e: unknown) {
            const error = e instanceof Error ? e.message : 'Unknown error';
            toast({ variant: 'destructive', title: 'Delete Failed', description: error });
        } finally {
            setIsDeleting(false);
        }
    };

    const handleClone = async () => {
        if (!user || !pipelineId) return;
        setIsCloning(true);
        try {
            const { clonePipelineAction } = await import('@/lib/pipeline-actions');
            const res = await clonePipelineAction(pipelineId, user.uid);
            if (res.success && res.id) {
                toast({
                    title: 'Pipeline Cloned Successfully',
                    description: 'Stages and configurations have been duplicated.',
                    actionConfig: {
                        path: '/admin/pipeline',
                        label: 'View Pipeline',
                    },
                });
                if (onPipelineSelect) {
                    onPipelineSelect(res.id);
                }
            } else {
                throw new Error(res.error || 'Failed to clone pipeline');
            }
        } catch (e: unknown) {
            const error = e instanceof Error ? e.message : 'Unknown error';
            toast({ variant: 'destructive', title: 'Clone Failed', description: error });
        } finally {
            setIsCloning(false);
        }
    };

    const pipelineRef = useMemoFirebase(() => 
        firestore && pipelineId ? doc(firestore, 'pipelines', pipelineId) : null,
    [firestore, pipelineId]);
    const { data: pipeline, isLoading } = useDoc<Pipeline>(pipelineRef);

    const { data: workspaceUsers } = useWorkspaceUsers(activeWorkspaceId);

    const rolesQuery = useMemoFirebase(() => 
        firestore && activeOrganizationId ? query(
            collection(firestore, 'roles'), 
            where('organizationId', '==', activeOrganizationId),
            orderBy('name', 'asc')
        ) : null, 
    [firestore, activeOrganizationId]);
    const { data: rawRoles } = useCollection<Role>(rolesQuery);

    const roles = React.useMemo(() => {
        if (!rawRoles) return [];
        
        // Gather all role IDs assigned to users in the current workspace
        const activeWorkspaceUserRoleIds = new Set<string>();
        if (workspaceUsers) {
            workspaceUsers.forEach(u => {
                const wsRoles = u.workspaceRoles?.[activeWorkspaceId];
                if (Array.isArray(wsRoles)) {
                    wsRoles.forEach(rId => activeWorkspaceUserRoleIds.add(rId));
                }
                if (!wsRoles && Array.isArray(u.roles)) {
                    u.roles.forEach(rId => activeWorkspaceUserRoleIds.add(rId));
                }
            });
        }

        // Filter roles: relevant to the current workspace, OR already assigned to the pipeline
        const filtered = rawRoles.filter(role => 
            activeWorkspaceUserRoleIds.has(role.id) ||
            (role.workspaceIds && role.workspaceIds.includes(activeWorkspaceId)) ||
            (pipeline?.accessRoles && pipeline.accessRoles.includes(role.id))
        );
        return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    }, [rawRoles, activeWorkspaceId, workspaceUsers, pipeline?.accessRoles]);

    React.useEffect(() => {
        if (pipeline) {
            setFormData({
                name: pipeline.name,
                description: pipeline.description || '',
                type: pipeline.type || 'sales',
                defaultProbability: typeof pipeline.defaultProbability === 'number' ? pipeline.defaultProbability : 50,
                showDealTotals: Boolean(pipeline.showDealTotals),
                defaultPresetViewId: pipeline.defaultPresetViewId || 'preset_all_deals',
                accessRoles: pipeline.accessRoles || [],
                workspaceIds: pipeline.workspaceIds || [],
                columnWidth: pipeline.columnWidth || 320,
                assignmentStrategy: pipeline.assignmentStrategy || 'direct',
                assignmentUserIds: pipeline.assignmentUserIds || [],
                defaultCloseDateOffsetValue: pipeline.defaultCloseDateOffsetValue ?? '',
                defaultCloseDateOffsetUnit: pipeline.defaultCloseDateOffsetUnit ?? 'days',
            });
            if (pipeline.columnWidth) onWidthChange(pipeline.columnWidth);
        }
    }, [pipeline, onWidthChange]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !formData.name.trim() || formData.workspaceIds.length === 0) {
            if (formData.workspaceIds.length === 0) toast({ variant: 'destructive', title: 'Constraint Alert', description: 'Pipeline must belong to at least one workspace.' });
            return;
        }
        setIsSaving(true);

        const numOffset = typeof formData.defaultCloseDateOffsetValue === 'number' && formData.defaultCloseDateOffsetValue > 0 ? formData.defaultCloseDateOffsetValue : null;
        const unitOffset = numOffset ? formData.defaultCloseDateOffsetUnit : null;

        try {
            await updateDoc(doc(firestore, 'pipelines', pipelineId), {
                name: formData.name.trim(),
                description: formData.description.trim(),
                type: formData.type,
                defaultProbability: Math.min(100, Math.max(0, formData.defaultProbability)),
                showDealTotals: Boolean(formData.showDealTotals),
                defaultPresetViewId: formData.defaultPresetViewId || 'preset_all_deals',
                accessRoles: formData.accessRoles,
                workspaceIds: formData.workspaceIds,
                columnWidth: formData.columnWidth,
                assignmentStrategy: formData.assignmentStrategy,
                assignmentUserIds: formData.assignmentUserIds,
                defaultCloseDateOffsetValue: numOffset,
                defaultCloseDateOffsetUnit: unitOffset,
                updatedAt: new Date().toISOString()
            });
            toast({ title: 'Architecture Synchronized' });
        } catch (error: unknown) {
            const err = error instanceof Error ? error.message : 'Save failed';
            toast({ variant: 'destructive', title: 'Save Failed', description: err });
        } finally {
            setIsSaving(false);
        }
    };

    const roleOptions = roles?.map(r => ({ label: r.name, value: r.id })) || [];
    const workspaceUserOptions = workspaceUsers?.map(u => ({ label: u.name || u.email || 'Workspace User', value: u.id })) || [];
    const workspaceOptions = allowedWorkspaces.map(w => ({ label: w.name, value: w.id }));

    if (isLoading) return <div className="space-y-8 animate-pulse"><div className="h-64 bg-muted rounded-2xl" /><div className="h-96 bg-muted rounded-2xl" /></div>;

    return (
        <form onSubmit={handleSave} className="space-y-8 text-left">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <PipelineConfigFields
                        variant="full"
                        formData={formData}
                        onChange={updateField}
                        workspaceOptions={workspaceOptions}
                        roleOptions={roleOptions}
                        workspaceUserOptions={workspaceUserOptions}
                        disabled={isSaving}
                    />

                    <StageEditor pipelineId={pipelineId} />
                </div>

                <div className="space-y-8">
                    {/* Danger Zone Card */}
                    <Card className="rounded-2xl border border-destructive/20 bg-destructive/5 shadow-sm overflow-hidden">
                        <CardHeader className="p-6 pb-2">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-destructive/10 text-destructive shrink-0">
                                    <AlertTriangle size={18} />
                                </div>
                                <CardTitle className="text-sm font-semibold tracking-tight text-destructive">Danger Zone</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                            <div className="flex flex-col gap-3">
                                <Button 
                                    type="button"
                                    variant="outline" 
                                    onClick={handleClone} 
                                    disabled={isCloning} 
                                    className="w-full h-9 rounded-xl font-bold text-xs border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 transition-all gap-2 flex items-center justify-center bg-transparent"
                                >
                                    {isCloning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4 text-indigo-500" />}
                                    <span>Clone Pipeline Settings & Stages</span>
                                </Button>
                                {pipeline?.isArchived ? (
                                    <Button 
                                        variant="outline" 
                                        onClick={handleRestore} 
                                        disabled={isArchiving} 
                                        className="w-full h-9 rounded-xl font-bold text-xs border-primary/20 text-primary hover:bg-primary/5 transition-all gap-2 flex items-center justify-center bg-transparent"
                                    >
                                        {isArchiving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                        Restore Pipeline
                                    </Button>
                                ) : (
                                    <Button 
                                        variant="outline" 
                                        onClick={handleArchive} 
                                        disabled={isArchiving} 
                                        className="w-full h-9 rounded-xl font-bold text-xs border-amber-500/20 text-amber-600 hover:bg-amber-500/5 transition-all gap-2 flex items-center justify-center bg-transparent"
                                    >
                                        {isArchiving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
                                        Archive Pipeline
                                    </Button>
                                )}
                                <Button 
                                    variant="destructive" 
                                    onClick={handleDelete} 
                                    disabled={isDeleting} 
                                    className="w-full h-9 rounded-xl font-bold text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-all gap-2 flex items-center justify-center"
                                >
                                    {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                    Delete Pipeline
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="pt-4 sticky top-24">
                        <Button type="submit" disabled={isSaving || !formData.name.trim()} className="w-full h-10 rounded-xl font-bold text-xs bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all active:scale-[0.98] gap-2 flex items-center justify-center">
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                            Save Configuration
                        </Button>
                    </div>
                </div>
            </div>
        </form>
    );
}
