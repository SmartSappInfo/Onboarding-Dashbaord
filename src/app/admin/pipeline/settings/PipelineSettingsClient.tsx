'use client';

import * as React from 'react';
import { doc, updateDoc, query, collection, orderBy, where } from 'firebase/firestore';
import { useFirestore, useMemoFirebase, useCollection, useUser } from '@/firebase';
import type { Pipeline, Role } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { clonePipelineAction, deletePipelineAction } from '@/lib/pipeline-actions';
import { 
    Loader2,
    CheckCircle2,
    Zap,
    Plus,
    Trash2,
    Copy
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import StageEditor from '../components/StageEditor';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Separator } from '@/components/ui/separator';
import { AnimatePresence, motion } from 'framer-motion';
import { useWorkspaceUsers } from '@/hooks/use-workspace-users';
import { CreatePipelineModal } from '../components/CreatePipelineModal';
import { PipelineConfigFields, type PipelineFormData } from '../components/PipelineConfigFields';

/**
 * ARCHITECTURAL NOTE (Rule 10 - Pipeline Settings Client Console):
 * Unified configuration interface for pipeline architecture in the admin settings area.
 * 
 * Key guarantees:
 * 1. Single Source of Truth: Exclusively renders <PipelineConfigFields variant="full" />,
 *    sharing form layout, inputs, and validation identically with PipelineConfigView.
 * 2. Draft-First Creation: Creation routes entirely through <CreatePipelineModal />.
 *    No premature DB writes or empty pipelines with 0 stages can ever occur.
 * 3. Server Action Security: Deletion delegates to deletePipelineAction (server-side
 *    authorization check, active lead protection, batch cascade).
 * 4. Clone Confirmation: Pipeline duplication requires explicit user confirmation.
 * 5. Strict Zero 'any' / 'any[]' compliance (Rule 5).
 */
export default function PipelineSettingsClient() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const confirm = useConfirm();
    const { user } = useUser();
    const { activeWorkspaceId, allowedWorkspaces, activeOrganizationId } = useWorkspace();
    
    const [selectedId, setSelectedId] = React.useState<string | null>(null);
    const [isSaving, setIsSaving] = React.useState(false);
    const [isCloning, setIsCloning] = React.useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);

    // Form State (Single source of truth matching PipelineFormData)
    const [formData, setFormData] = React.useState<PipelineFormData>({
        name: '',
        description: '',
        type: 'sales',
        defaultProbability: 50,
        workspaceIds: activeWorkspaceId ? [activeWorkspaceId] : [],
        columnWidth: 320,
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
    }, []);

    // Synchronized Pipeline Query
    const pipelinesQuery = useMemoFirebase(() => 
        firestore && activeWorkspaceId ? query(
            collection(firestore, 'pipelines'), 
            where('workspaceIds', 'array-contains', activeWorkspaceId),
            orderBy('createdAt', 'desc')
        ) : null, 
    [firestore, activeWorkspaceId]);
    const { data: pipelines, isLoading: isLoadingPipelines } = useCollection<Pipeline>(pipelinesQuery);

    // Auto-select first pipeline if none selected
    React.useEffect(() => {
        if (!selectedId && pipelines && pipelines.length > 0) {
            setSelectedId(pipelines[0].id);
        }
    }, [selectedId, pipelines]);

    const selectedPipeline = React.useMemo(() => 
        pipelines?.find(p => p.id === selectedId),
    [pipelines, selectedId]);

    const handleClone = async () => {
        if (!user || !selectedId) return;
        const targetPipeline = pipelines?.find(p => p.id === selectedId);
        const approved = await confirm({
            title: `Clone "${targetPipeline?.name || 'Pipeline'}"?`,
            description: 'This will duplicate all stages, SLA thresholds, and blueprint rules under a new pipeline. Existing deals, contacts, and activity logs will NOT be copied.',
            confirmText: 'Clone Pipeline',
        });
        if (!approved) return;

        setIsCloning(true);
        try {
            const res = await clonePipelineAction(selectedId, user.uid);
            if (res.success && res.id) {
                setSelectedId(res.id);
                toast({
                    title: 'Pipeline Cloned Successfully',
                    description: 'Stages and settings duplicated. Content & deals were not copied.',
                    actionConfig: {
                        path: '/admin/pipeline',
                        label: 'View Pipeline',
                    },
                });
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
        return rawRoles.filter(role => 
            activeWorkspaceUserRoleIds.has(role.id) ||
            (role.workspaceIds && role.workspaceIds.includes(activeWorkspaceId)) ||
            (selectedPipeline?.accessRoles && selectedPipeline.accessRoles.includes(role.id))
        );
    }, [rawRoles, activeWorkspaceId, workspaceUsers, selectedPipeline?.accessRoles]);

    React.useEffect(() => {
        if (selectedPipeline) {
            setFormData({
                name: selectedPipeline.name || '',
                description: selectedPipeline.description || '',
                type: selectedPipeline.type || 'sales',
                defaultProbability: typeof selectedPipeline.defaultProbability === 'number' ? selectedPipeline.defaultProbability : 50,
                workspaceIds: selectedPipeline.workspaceIds || (activeWorkspaceId ? [activeWorkspaceId] : []),
                columnWidth: selectedPipeline.columnWidth || 320,
                showDealTotals: Boolean(selectedPipeline.showDealTotals),
                defaultPresetViewId: selectedPipeline.defaultPresetViewId || 'preset_all_deals',
                accessRoles: selectedPipeline.accessRoles || [],
                assignmentStrategy: selectedPipeline.assignmentStrategy || 'direct',
                assignmentUserIds: selectedPipeline.assignmentUserIds || [],
                defaultCloseDateOffsetValue: selectedPipeline.defaultCloseDateOffsetValue ?? '',
                defaultCloseDateOffsetUnit: selectedPipeline.defaultCloseDateOffsetUnit ?? 'days',
            });
        }
    }, [selectedPipeline, activeWorkspaceId]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !selectedId || !formData.name.trim()) return;
        setIsSaving(true);

        const numOffset = typeof formData.defaultCloseDateOffsetValue === 'number' && formData.defaultCloseDateOffsetValue > 0 ? formData.defaultCloseDateOffsetValue : null;
        const unitOffset = numOffset ? formData.defaultCloseDateOffsetUnit : null;

        const data = {
            name: formData.name.trim(),
            description: formData.description.trim(),
            type: formData.type,
            defaultProbability: Math.min(100, Math.max(0, formData.defaultProbability)),
            accessRoles: formData.accessRoles,
            workspaceIds: formData.workspaceIds.length > 0 ? formData.workspaceIds : (activeWorkspaceId ? [activeWorkspaceId] : []),
            columnWidth: formData.columnWidth,
            showDealTotals: Boolean(formData.showDealTotals),
            defaultPresetViewId: formData.defaultPresetViewId || 'preset_all_deals',
            assignmentStrategy: formData.assignmentStrategy,
            assignmentUserIds: formData.assignmentUserIds,
            defaultCloseDateOffsetValue: numOffset,
            defaultCloseDateOffsetUnit: unitOffset,
            updatedAt: new Date().toISOString()
        };

        try {
            await updateDoc(doc(firestore, 'pipelines', selectedId), data);
            toast({ title: 'Architecture Synchronized' });
        } catch (error: unknown) {
            const err = error instanceof Error ? error.message : 'Save failed';
            toast({ variant: 'destructive', title: 'Save Failed', description: err });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!user || !selectedId) return;
        const approved = await confirm({ 
            title: 'Delete pipeline?', 
            description: 'This workflow architecture will be permanently purged. Pipelines with active leads cannot be deleted.', 
            confirmText: 'Delete', 
            variant: 'destructive' 
        });
        if (!approved) return;

        try {
            const res = await deletePipelineAction(selectedId, user.uid);
            if (res.success) {
                setSelectedId(null);
                toast({ title: 'Pipeline Purged' });
            } else {
                throw new Error(res.error || 'Failed to delete pipeline');
            }
        } catch (error: unknown) {
            const err = error instanceof Error ? error.message : 'Deletion failed';
            toast({ variant: 'destructive', title: 'Deletion Failed', description: err });
        }
    };

    const roleOptions = React.useMemo(() => roles?.map(r => ({ label: r.name, value: r.id })) || [], [roles]);
    const workspaceUserOptions = React.useMemo(() => (
        workspaceUsers?.map(u => ({ 
            label: u.name || u.email || 'Workspace User', 
            value: u.id,
            sublabel: u.name && u.email ? u.email : undefined,
            keywords: [u.name || '', u.email || ''].filter(Boolean),
        })) || []
    ), [workspaceUsers]);
    const workspaceOptions = React.useMemo(() => allowedWorkspaces.map(w => ({ label: w.name, value: w.id })), [allowedWorkspaces]);

    if (isLoadingPipelines) return <div className="space-y-8 animate-pulse"><div className="h-64 bg-muted rounded-[2.5rem]" /><div className="h-96 bg-muted rounded-[2.5rem]" /></div>;

    return (
        <div className="h-full overflow-y-auto text-left">
            <div className="max-w-5xl mx-auto space-y-10">
                
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-1 text-left">
                        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Pipeline Architecture</h1>
                        <p className="text-sm text-muted-foreground font-medium">Modify shared stages and access rules for {activeWorkspaceId}.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        {selectedId && (
                            <Button 
                                variant="outline" 
                                onClick={handleClone}
                                disabled={isCloning}
                                className="rounded-xl font-bold h-11 px-5 border-indigo-500/30 text-indigo-600 dark:text-indigo-400 bg-card shadow-sm hover:bg-indigo-500/10 active:scale-[0.97] transition-all"
                            >
                                {isCloning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4 text-indigo-500" />}
                                Clone Pipeline
                            </Button>
                        )}
                        <Button 
                            variant="outline" 
                            onClick={() => setIsCreateModalOpen(true)}
                            className="rounded-xl font-bold h-11 px-6 border-primary/20 text-primary bg-card shadow-sm active:scale-[0.97] transition-all"
                        >
                            <Plus className="mr-2 h-4 w-4" /> New Workflow
                        </Button>
                    </div>
                </div>

                <Card className="rounded-2xl border-none shadow-sm ring-1 ring-border overflow-hidden bg-card">
                    <CardContent className="p-4 flex flex-col sm:flex-row items-center gap-4">
                        <div className="flex items-center gap-3 text-primary shrink-0 ml-2">
                            <Zap className="h-4 w-4" />
                            <span className="text-[10px] font-semibold ">Select Target</span>
                        </div>
                        <Select 
                            value={selectedId || ''} 
                            onValueChange={(val) => {
                                if (val === 'new') { 
                                    setIsCreateModalOpen(true);
                                } else { 
                                    setSelectedId(val); 
                                }
                            }}
                        >
                            <SelectTrigger className="flex-1 h-12 rounded-xl bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/40 focus:outline-none font-semibold text-lg">
                                <SelectValue placeholder="Choose a pipeline to modify..." />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-none shadow-2xl">
                                {pipelines?.map(p => (
                                    <SelectItem key={p.id} value={p.id} className="font-semibold py-3 text-xs">{p.name}</SelectItem>
                                ))}
                                <Separator className="my-1" />
                                <SelectItem value="new" className="text-primary font-semibold italic">Initialize New Pipeline...</SelectItem>
                            </SelectContent>
                        </Select>
                    </CardContent>
                </Card>

                <AnimatePresence mode="wait">
                    {selectedId ? (
                        <motion.div 
                            key={selectedId} 
                            initial={{ opacity: 0, y: 10 }} 
                            animate={{ opacity: 1, y: 0 }} 
                            exit={{ opacity: 0, y: -10 }}
                            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
                        >
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

                                <StageEditor pipelineId={selectedId} />
                            </div>

                            <div className="space-y-8">
                                <div className="space-y-4 pt-4 sticky top-24">
                                    <Button 
                                        onClick={handleSave} 
                                        disabled={isSaving || !formData.name.trim()} 
                                        className="w-full h-14 rounded-2xl font-semibold text-sm shadow-xl transition-all active:scale-95 gap-2"
                                    >
                                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                        Commit Architecture
                                    </Button>
                                    
                                    <Button 
                                        variant="ghost" 
                                        onClick={handleDelete}
                                        className="w-full h-10 text-destructive font-semibold text-xs gap-2 hover:bg-destructive/10 hover:text-destructive"
                                    >
                                        <Trash2 className="h-4 w-4" /> Purge Workflow
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    ) : null}
                </AnimatePresence>
            </div>

            {/* Draft-First Create Pipeline Modal */}
            <CreatePipelineModal
                open={isCreateModalOpen}
                onOpenChange={setIsCreateModalOpen}
                activeWorkspaceId={activeWorkspaceId || ''}
                allowedWorkspaces={allowedWorkspaces || []}
                onPipelineCreated={(newId) => {
                    setSelectedId(newId);
                }}
            />
        </div>
    );
}
