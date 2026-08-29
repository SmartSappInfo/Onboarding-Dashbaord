'use client';

/**
 * ARCHITECTURAL POINTERS & MAINTAINER GUIDANCE (Phase 3 CRM Activity Graph - Rule 10):
 * - Upgrades the Lead Conversion console from a legacy track switcher to a full Deals 2.0 conversion engine.
 * - Bridges leads / prospects directly into first-class Deal opportunities in the chosen pipeline & stage.
 * - Preserves marketing attribution, lead score, custom fields, and stakeholder contacts.
 * - Adheres strictly to Workspace Rules: min-h-[44px] touch targets, zero 'any' typing, and actionable toast navigation.
 * 
 * Caution Areas for Future Maintainers:
 * - When targetPipelineId changes, targetStageId automatically resets to the first stage in the new pipeline.
 * - Actionable toast uses relative path (`/admin/deals/${dealId}`) allowing immediate one-click deal workspace opening.
 */

import * as React from 'react';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription, 
    DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select';
import { 
    Zap, 
    Building, 
    Check, 
    Loader2, 
    ShieldCheck, 
    Workflow, 
    DollarSign, 
    Calendar, 
    UserCheck, 
    Users, 
    FileText,
    ArrowRight
} from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { WorkspaceEntity, Pipeline, OnboardingStage, UserProfile, EntityContact } from '@/lib/types';
import { convertLeadToDealAction } from '@/app/actions/deal-actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useTerminology } from '@/hooks/use-terminology';
import { useTenant } from '@/context/TenantContext';

interface ConvertLeadModalProps {
    entity: WorkspaceEntity;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export default function ConvertLeadModal({ entity, open, onOpenChange }: ConvertLeadModalProps) {
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();
    const { singular } = useTerminology();
    const { activeWorkspaceId, activeOrganizationId } = useTenant();

    // Form state
    const [targetPipelineId, setTargetPipelineId] = React.useState<string>('');
    const [targetStageId, setTargetStageId] = React.useState<string>('');
    const [dealName, setDealName] = React.useState<string>('');
    const [value, setValue] = React.useState<string>('');
    const [expectedCloseDate, setExpectedCloseDate] = React.useState<string>('');
    const [assignedUserId, setAssignedUserId] = React.useState<string>('');
    const [selectedFocalContactIds, setSelectedFocalContactIds] = React.useState<string[]>([]);
    const [handoverNotes, setHandoverNotes] = React.useState<string>('');
    const [isConverting, setIsConverting] = React.useState(false);

    // 1. Fetch Pipelines for this Workspace
    const pipelinesQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(
            collection(firestore, 'pipelines'),
            where('workspaceIds', 'array-contains', activeWorkspaceId),
            orderBy('name', 'asc')
        );
    }, [firestore, activeWorkspaceId]);

    const { data: rawPipelines, isLoading: isLoadingPipelines } = useCollection<Pipeline>(pipelinesQuery);

    // Fallback: If no workspace-scoped pipelines found, fetch unconstrained pipelines
    const allPipelinesQuery = useMemoFirebase(() => {
        if (!firestore || (rawPipelines && rawPipelines.length > 0)) return null;
        return query(collection(firestore, 'pipelines'), orderBy('name', 'asc'));
    }, [firestore, rawPipelines]);

    const { data: fallbackPipelines } = useCollection<Pipeline>(allPipelinesQuery);
    const pipelines = (rawPipelines && rawPipelines.length > 0) ? rawPipelines : fallbackPipelines;

    // 2. Fetch Stages for Selected Pipeline
    const stagesQuery = useMemoFirebase(() => {
        if (!firestore || !targetPipelineId) return null;
        return query(
            collection(firestore, 'onboardingStages'),
            where('pipelineId', '==', targetPipelineId),
            orderBy('order', 'asc')
        );
    }, [firestore, targetPipelineId]);

    const { data: stages, isLoading: isLoadingStages } = useCollection<OnboardingStage>(stagesQuery);

    // 3. Fetch Organization Users
    const usersQuery = useMemoFirebase(() => {
        if (!firestore || !activeOrganizationId) return null;
        return query(collection(firestore, 'users'), where('organizationId', '==', activeOrganizationId));
    }, [firestore, activeOrganizationId]);

    const { data: users } = useCollection<UserProfile>(usersQuery);

    // Initialize defaults when modal opens
    React.useEffect(() => {
        if (open && entity) {
            setDealName(entity.displayName || '');
            setValue('');
            
            // Default expected close date to +30 days
            const thirtyDaysAhead = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            setExpectedCloseDate(thirtyDaysAhead);
            
            setAssignedUserId(user?.uid || '');
            setHandoverNotes('');

            // Pre-select first contact if available
            const rawContacts: EntityContact[] = (entity.entityContacts || []) as EntityContact[];
            if (rawContacts.length > 0) {
                const firstId = rawContacts[0].id;
                if (firstId) setSelectedFocalContactIds([firstId]);
            } else {
                setSelectedFocalContactIds([]);
            }
        }
    }, [open, entity, user]);

    // Auto-select first pipeline and first stage
    React.useEffect(() => {
        if (pipelines && pipelines.length > 0 && !targetPipelineId) {
            const defaultPipeline = pipelines.find(p => p.isDefault) || pipelines[0];
            setTargetPipelineId(defaultPipeline.id);
        }
    }, [pipelines, targetPipelineId]);

    React.useEffect(() => {
        if (stages && stages.length > 0) {
            setTargetStageId(stages[0].id);
        } else {
            setTargetStageId('');
        }
    }, [stages, targetPipelineId]);

    // Toggle focal contact
    const toggleFocalContact = (contactId: string) => {
        setSelectedFocalContactIds(prev => 
            prev.includes(contactId) ? prev.filter(id => id !== contactId) : [...prev, contactId]
        );
    };

    const handleConvert = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!targetPipelineId || !user || isConverting) return;

        const effectiveWorkspaceId = activeWorkspaceId || entity.workspaceId || 'default';
        const assignedUserObj = users?.find(u => u.id === assignedUserId);

        setIsConverting(true);
        try {
            const res = await convertLeadToDealAction({
                leadEntityId: entity.entityId,
                pipelineId: targetPipelineId,
                stageId: targetStageId || undefined,
                dealName: dealName.trim() || entity.displayName,
                value: value ? parseFloat(value) : 0,
                expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate).toISOString() : null,
                assignedTo: assignedUserObj ? {
                    userId: assignedUserObj.id,
                    name: assignedUserObj.name || 'Assigned User',
                    email: assignedUserObj.email || null,
                } : null,
                focalContactIds: selectedFocalContactIds,
                notes: handoverNotes.trim() || undefined,
                userId: user.uid,
                workspaceId: effectiveWorkspaceId,
            });

            if (res.success && res.dealId) {
                const dealPath = `/admin/deals/${res.dealId}`;
                toast({
                    title: 'Lead Converted to Opportunity',
                    description: `"${dealName || entity.displayName}" is now an active opportunity.`,
                    actionConfig: {
                        path: dealPath,
                        label: 'Open Deal Workspace'
                    },
                    duration: 10000,
                });
                onOpenChange(false);
            } else {
                toast({
                    variant: 'destructive',
                    title: 'Conversion Failed',
                    description: res.error || 'Failed to convert lead to opportunity.',
                });
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
            toast({
                variant: 'destructive',
                title: 'Conversion Error',
                description: msg,
            });
        } finally {
            setIsConverting(false);
        }
    };

    const rawContacts: EntityContact[] = (entity.entityContacts || []) as EntityContact[];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl rounded-2xl p-0 overflow-hidden border bg-card shadow-2xl max-h-[90vh] flex flex-col">
                <DialogHeader className="p-6 bg-muted/20 border-b shrink-0 text-left">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-primary/10 text-primary rounded-xl shrink-0">
                            <Zap className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <div>
                            <DialogTitle className="text-lg font-bold tracking-tight text-foreground">
                                Convert Lead to Opportunity
                            </DialogTitle>
                            <DialogDescription className="text-xs font-semibold text-muted-foreground">
                                Elevate {entity.displayName} into an active pipeline deal with preserved attribution.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <form onSubmit={handleConvert} className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Target Entity Banner */}
                    <div className="flex items-center gap-3 p-3.5 rounded-xl bg-muted/20 border text-left">
                        <div className="p-2 bg-card rounded-lg shadow-sm text-primary">
                            <Building className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase">Target {singular}</p>
                            <p className="text-sm font-bold text-foreground truncate">{entity.displayName}</p>
                        </div>
                    </div>

                    {/* Deal Name & Estimated Value */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                                <FileText className="h-3.5 w-3.5 text-primary" /> Opportunity Name *
                            </Label>
                            <Input
                                required
                                value={dealName}
                                onChange={e => setDealName(e.target.value)}
                                placeholder="e.g. Acme Q3 Expansion"
                                className="rounded-xl min-h-[44px]"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                                <DollarSign className="h-3.5 w-3.5 text-primary" /> Estimated Deal Value ($)
                            </Label>
                            <Input
                                type="number"
                                min="0"
                                step="any"
                                value={value}
                                onChange={e => setValue(e.target.value)}
                                placeholder="0.00"
                                className="rounded-xl min-h-[44px]"
                            />
                        </div>
                    </div>

                    {/* Pipeline & Stage Selection */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                                <Workflow className="h-3.5 w-3.5 text-primary" /> Target Pipeline *
                            </Label>
                            {isLoadingPipelines ? (
                                <Skeleton className="h-11 w-full rounded-xl" />
                            ) : (
                                <Select value={targetPipelineId} onValueChange={setTargetPipelineId}>
                                    <SelectTrigger className="rounded-xl min-h-[44px]">
                                        <SelectValue placeholder="Select pipeline..." />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        {pipelines?.map(p => (
                                            <SelectItem key={p.id} value={p.id}>
                                                {p.name} {p.isDefault && '(Default)'}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                                <Workflow className="h-3.5 w-3.5 text-primary" /> Initial Stage
                            </Label>
                            {isLoadingStages ? (
                                <Skeleton className="h-11 w-full rounded-xl" />
                            ) : (
                                <Select value={targetStageId} onValueChange={setTargetStageId} disabled={!stages?.length}>
                                    <SelectTrigger className="rounded-xl min-h-[44px]">
                                        <SelectValue placeholder="Select initial stage..." />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        {stages?.map(s => (
                                            <SelectItem key={s.id} value={s.id}>
                                                {s.name} ({s.probability ?? 20}%)
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                    </div>

                    {/* Expected Close Date & Assigned Rep */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5 text-primary" /> Expected Close Date
                            </Label>
                            <Input
                                type="date"
                                value={expectedCloseDate}
                                onChange={e => setExpectedCloseDate(e.target.value)}
                                className="rounded-xl min-h-[44px]"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                                <UserCheck className="h-3.5 w-3.5 text-primary" /> Assigned Rep
                            </Label>
                            <Select value={assignedUserId} onValueChange={setAssignedUserId}>
                                <SelectTrigger className="rounded-xl min-h-[44px]">
                                    <SelectValue placeholder="Select rep..." />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl max-h-[220px]">
                                    <SelectItem value="unassigned">Unassigned</SelectItem>
                                    {users?.map(u => (
                                        <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Focal Stakeholder Contacts */}
                    {rawContacts.length > 0 && (
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                                <Users className="h-3.5 w-3.5 text-primary" /> Focal Stakeholder Contacts
                            </Label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[140px] overflow-y-auto p-1.5 rounded-xl bg-muted/10 border">
                                {rawContacts.map((c: EntityContact, idx: number) => {
                                    const contactId = c.id || `c_${idx}`;
                                    const isSelected = selectedFocalContactIds.includes(contactId);
                                    return (
                                        <button
                                            key={contactId}
                                            type="button"
                                            onClick={() => toggleFocalContact(contactId)}
                                            className={cn(
                                                "flex items-center gap-2 p-2.5 rounded-lg text-left transition-all min-h-[44px] cursor-pointer",
                                                isSelected ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-muted/40"
                                            )}
                                        >
                                            <span className={cn(
                                                "flex h-4 w-4 items-center justify-center rounded border shrink-0",
                                                isSelected ? "bg-primary border-primary text-white" : "border-muted-foreground/30"
                                            )}>
                                                {isSelected && <Check className="h-3 w-3" />}
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs font-bold truncate text-foreground">{c.name || 'Unnamed'}</p>
                                                <p className="text-[10px] text-muted-foreground truncate">{c.email || c.phone || 'No direct contact'}</p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Discovery & Handover Notes */}
                    <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5 text-primary" /> Handover / Discovery Notes
                        </Label>
                        <textarea
                            value={handoverNotes}
                            onChange={e => setHandoverNotes(e.target.value)}
                            placeholder="Key customer requirements, qualification insights, or deal context..."
                            className="w-full min-h-[80px] rounded-xl p-3 text-xs font-medium bg-muted/10 border border-border shadow-inner outline-none focus-visible:ring-1 focus-visible:ring-primary/40 resize-none"
                        />
                    </div>
                </form>

                <DialogFooter className="p-4 bg-muted/20 border-t flex flex-row items-center justify-between gap-3">
                    <Button 
                        type="button"
                        variant="ghost" 
                        onClick={() => onOpenChange(false)} 
                        disabled={isConverting} 
                        className="rounded-xl font-bold min-h-[44px] px-6 cursor-pointer"
                    >
                        Cancel
                    </Button>
                    <Button 
                        type="button"
                        onClick={handleConvert} 
                        disabled={isConverting || !targetPipelineId || !dealName.trim()}
                        className="rounded-xl font-bold min-h-[44px] px-8 shadow-lg cursor-pointer bg-primary text-white gap-2"
                    >
                        {isConverting ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                <span>Converting...</span>
                            </>
                        ) : (
                            <>
                                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                                <span>Execute Conversion</span>
                                <ArrowRight className="h-3.5 w-3.5" />
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

