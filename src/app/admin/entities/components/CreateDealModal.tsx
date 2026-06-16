'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Check, X, UserCircle2, Users } from 'lucide-react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { createDeal, type AssignmentStrategy } from '@/app/actions/deal-actions';
import { getEntityDealDefaultsAction, type EntityAssignee } from '@/app/actions/entity-contact-actions';
import { useWorkspaceUsers } from '@/hooks/use-workspace-users';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useEntitySearch } from '@/hooks/use-entity-search';
import { cn } from '@/lib/utils';
import type { EntityContact, DealFocalContact } from '@/lib/types';
import { useTerminology } from '@/hooks/use-terminology';

interface CreateDealModalProps {
    entityId?: string;
    initialStageId?: string;
    initialPipelineId?: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export default function CreateDealModal({ entityId, initialStageId, initialPipelineId, open, onOpenChange }: CreateDealModalProps) {
    const { toast } = useToast();
    const { activeWorkspaceId, activeOrganizationId } = useWorkspace();
    const firestore = useFirestore();
    const { singular, plural } = useTerminology();

    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [name, setName] = React.useState('');
    const [value, setValue] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [pipelineId, setPipelineId] = React.useState('');
    const [stageId, setStageId] = React.useState('');
    const [selectedEntityId, setSelectedEntityId] = React.useState('');
    const [entitySearchOpen, setEntitySearchOpen] = React.useState(false);

    // Owner: 'auto' = inherit the entity's assignee via the server 'direct'
    // strategy, 'unassigned' = explicitly none, otherwise a specific user id.
    // ('auto' rather than '' because Radix SelectItem forbids empty values.)
    const [ownerUserId, setOwnerUserId] = React.useState<string>('auto');
    const [entityAssignee, setEntityAssignee] = React.useState<EntityAssignee>(null);
    const { data: workspaceUsers } = useWorkspaceUsers(activeWorkspaceId);

    // Focal contacts — persons selected from the deal's own entity
    const [entityContacts, setEntityContacts] = React.useState<EntityContact[]>([]);
    const [isLoadingContacts, setIsLoadingContacts] = React.useState(false);
    const [selectedFocalContactIds, setSelectedFocalContactIds] = React.useState<string[]>([]);
    

    // Fetch pipelines for current workspace
    const pipelinesQuery = useMemoFirebase(() => 
        firestore && activeWorkspaceId ? query(
            collection(firestore, 'pipelines'), 
            where('workspaceIds', 'array-contains', activeWorkspaceId),
            orderBy('createdAt', 'desc')
        ) : null, 
    [firestore, activeWorkspaceId]);
    const { data: pipelines, isLoading: isLoadingPipelines } = useCollection<any>(pipelinesQuery);

    // Fetch stages for pipeline filtering
    const stagesQuery = useMemoFirebase(() => 
        firestore && activeWorkspaceId ? query(
            collection(firestore, 'onboardingStages'),
            orderBy('order', 'asc')
        ) : null, 
    [firestore, activeWorkspaceId]);
    const { data: stages } = useCollection<any>(stagesQuery);

    // Server-side, paginated entity search (Phase 5.2) — only when picking an
    // entity for a global deal (no contact context). Never loads the whole set.
    const [entitySearch, setEntitySearch] = React.useState('');
    const { results: entities, hasMore, loadMore } = useEntitySearch({
        search: entitySearch,
        enabled: open && !entityId,
        pageSize: 25,
    });

    React.useEffect(() => {
        if (open) {
            setName('');
            setValue('');
            setDescription('');
            setOwnerUserId('auto');
            setEntityAssignee(null);
            setSelectedFocalContactIds([]);
            setEntityContacts([]);

            if (entityId) {
                setSelectedEntityId(entityId);
            } else {
                setSelectedEntityId('');
            }
            
            if (initialStageId && stages) {
                const initStage = stages.find((s: any) => s.id === initialStageId);
                if (initStage) {
                    setPipelineId(initStage.pipelineId);
                    setStageId(initialStageId);
                }
            } else if (initialPipelineId) {
                setPipelineId(initialPipelineId);
                setStageId('');
            } else if (pipelines && pipelines.length > 0) {
                setPipelineId(pipelines[0].id);
                setStageId('');
            }
        }
    }, [open, entityId, initialStageId, initialPipelineId, pipelines, stages]);



    // Load the entity's focal contacts AND its workspace owner (one round-trip)
    // so we can pre-fill the deal's default assignee from the entity.
    const focalEntityId = entityId || selectedEntityId;
    React.useEffect(() => {
        if (!open || !focalEntityId || !activeWorkspaceId) {
            setEntityContacts([]);
            setEntityAssignee(null);
            return;
        }
        let cancelled = false;
        setIsLoadingContacts(true);
        setSelectedFocalContactIds([]);
        setOwnerUserId('auto'); // reset to Auto (inherit) when the entity changes
        getEntityDealDefaultsAction(focalEntityId, activeWorkspaceId)
            .then(({ contacts, assignedTo }) => {
                if (cancelled) return;
                setEntityContacts(contacts);
                setEntityAssignee(assignedTo);
            })
            .finally(() => { if (!cancelled) setIsLoadingContacts(false); });
        return () => { cancelled = true; };
    }, [open, focalEntityId, activeWorkspaceId]);

    const toggleFocalContact = (id: string) => {
        setSelectedFocalContactIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const finalEntityId = entityId || selectedEntityId;
        if (!finalEntityId || !name || !pipelineId) {
            toast({ variant: 'destructive', title: 'Validation Error', description: 'Please fill in all required fields.' });
            return;
        }

        // Resolve the owner choice into a server assignment instruction.
        // '' → Auto: let the server 'direct' strategy inherit the entity owner.
        // 'unassigned' → explicitly none. Otherwise → explicit user (overrides).
        let assignmentStrategy: AssignmentStrategy = 'direct';
        let explicitAssignedTo: { userId: string | null; name: string | null; email: string | null } | undefined;
        if (ownerUserId === 'unassigned') {
            assignmentStrategy = 'unassigned';
        } else if (ownerUserId !== 'auto') {
            const u = workspaceUsers?.find(x => x.id === ownerUserId);
            explicitAssignedTo = { userId: ownerUserId, name: u?.name || u?.email || null, email: u?.email || null };
        }

        setIsSubmitting(true);
        try {
            const result = await createDeal({
                entityId: finalEntityId,
                workspaceId: activeWorkspaceId!,
                organizationId: activeOrganizationId!,
                pipelineId,
                stageId: stageId || undefined,
                name,
                value: parseFloat(value) || 0,
                description: description || null,
                assignmentStrategy,
                ...(explicitAssignedTo !== undefined ? { assignedTo: explicitAssignedTo } : {}),
                eligibleUserIds: [],
                focalContacts: selectedFocalContactIds
                    .map<DealFocalContact | null>(id => {
                        const c = entityContacts.find(ec => ec.id === id);
                        if (!c) return null;
                        return { id: c.id, name: c.name, email: c.email, phone: c.phone, role: c.typeLabel };
                    })
                    .filter((c): c is DealFocalContact => c !== null),
            });

            if (result.error) {
                throw new Error(result.error);
            }

            toast({ title: 'Deal Created', description: `Deal "${name}" successfully initiated.` });
            onOpenChange(false);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Deal Creation Failed', description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const getAutoLabel = () => {
        const selectedPipelineObj = pipelines?.find((p: any) => p.id === pipelineId);
        const strategy = selectedPipelineObj?.assignmentStrategy || 'direct';
        if (strategy === 'round-robin') return 'Auto — Round Robin';
        if (strategy === 'value-based') return 'Auto — Value-based Routing';
        if (strategy === 'unassigned') return 'Auto — Leave Unassigned';
        return `Auto — ${entityAssignee?.name || `${singular} owner`}`;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[450px] rounded-2xl p-0 border border-border/50 shadow-2xl overflow-hidden bg-white dark:bg-zinc-900 z-[150]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader className="p-6 border-b border-border/50 shrink-0 text-left bg-white dark:bg-zinc-900">
                        <DialogTitle className="text-xl font-semibold tracking-tight text-foreground">Add new deal</DialogTitle>
                        <DialogDescription className="text-xs font-medium text-muted-foreground mt-1.5">
                            Create a new deal for a {singular.toLowerCase()} in the pipeline.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
                        {!entityId && (
                            <div className="space-y-2 flex flex-col">
                                <Label className="text-xs font-semibold text-muted-foreground ml-1">Target contact / {singular.toLowerCase()}</Label>
                                <Popover open={entitySearchOpen} onOpenChange={setEntitySearchOpen} modal={true}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={entitySearchOpen}
                                            className="w-full justify-between h-10 rounded-xl font-bold border border-border bg-background shadow-sm text-xs text-muted-foreground hover:bg-muted/50"
                                        >
                                            {selectedEntityId
                                                ? ((entities?.find((e: any) => e.entityId === selectedEntityId) as any)?.name || entities?.find((e: any) => e.entityId === selectedEntityId)?.displayName || `Select ${singular}...`)
                                                : `Select ${singular}...`}
                                            <Plus className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent data-scroll-lock-scrollable className="w-[var(--radix-popover-trigger-width)] p-0 border border-border shadow-2xl rounded-xl overflow-hidden bg-background z-[200]" align="start">
                                        <Command shouldFilter={false}>
                                            <CommandInput
                                                placeholder={`Search ${plural.toLowerCase()}...`}
                                                value={entitySearch}
                                                onValueChange={setEntitySearch}
                                            />
                                            <CommandList data-scroll-lock-scrollable className="max-h-[220px] overflow-y-auto overflow-x-hidden scrollbar-thin">
                                                <CommandEmpty>No {singular.toLowerCase()} found.</CommandEmpty>
                                                <CommandGroup>
                                                    {entities.map((e: any) => (
                                                        <CommandItem
                                                            key={e.id}
                                                            value={e.name || e.displayName}
                                                            onSelect={() => {
                                                                setSelectedEntityId(e.entityId);
                                                                setEntitySearchOpen(false);
                                                            }}
                                                            className="font-bold text-xs p-3 cursor-pointer"
                                                        >
                                                            <div className="flex flex-col">
                                                                <span>{e.name || e.displayName}</span>
                                                                <span className="text-[9px] text-muted-foreground font-normal">{e.email || e.primaryEmail || 'No Email'} • {e.entityType || singular.toLowerCase()}</span>
                                                            </div>
                                                        </CommandItem>
                                                    ))}
                                                    {hasMore && (
                                                        <CommandItem
                                                            value="__load_more__"
                                                            onSelect={() => loadMore()}
                                                            className="justify-center text-[10px] font-bold text-primary cursor-pointer"
                                                        >
                                                            Load more…
                                                        </CommandItem>
                                                    )}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label className="text-xs font-semibold text-muted-foreground ml-1">Deal name</Label>
                            <Input 
                                required
                                value={name} 
                                onChange={e => setName(e.target.value)} 
                                placeholder="e.g. 2026 Expansion Contract" 
                                className="h-10 rounded-xl font-bold border border-border bg-background shadow-sm focus-visible:ring-1 focus-visible:ring-primary/20 text-xs"
                            />
                        </div>

                        {focalEntityId && (
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-muted-foreground ml-1 flex items-center gap-1.5">
                                    <Users className="h-3 w-3" /> Focal contacts (optional)
                                </Label>
                                {isLoadingContacts ? (
                                    <div className="flex items-center gap-2 h-10 px-3 rounded-xl border border-border bg-background/50">
                                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                                        <span className="text-[10px] font-bold text-muted-foreground">Loading contacts…</span>
                                    </div>
                                ) : entityContacts.length === 0 ? (
                                    <p className="text-[10px] font-semibold text-muted-foreground px-3 py-2 rounded-xl border border-dashed border-border bg-background/50">
                                        No contacts found on this {singular.toLowerCase()}.
                                    </p>
                                ) : (
                                    <>
                                        <div className="flex flex-col gap-1.5 max-h-[140px] overflow-y-auto p-1.5 rounded-xl border border-border bg-background/50 shadow-sm">
                                            {entityContacts.map(c => {
                                                const selected = selectedFocalContactIds.includes(c.id);
                                                return (
                                                    <button
                                                        key={c.id}
                                                        type="button"
                                                        onClick={() => toggleFocalContact(c.id)}
                                                        className={cn(
                                                            "flex items-center gap-2 p-2 rounded-lg text-left transition-colors",
                                                            selected ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-muted/60"
                                                        )}
                                                    >
                                                        <span className={cn(
                                                            "flex h-4 w-4 items-center justify-center rounded-md border shrink-0 transition-colors",
                                                            selected ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/30"
                                                        )}>
                                                            {selected && <Check className="h-3 w-3" />}
                                                        </span>
                                                        <UserCircle2 className="h-3.5 w-3.5 text-primary/40 shrink-0" />
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-[11px] font-bold truncate leading-tight">{c.name || 'Unnamed'}</p>
                                                            <p className="text-[8px] font-semibold text-muted-foreground truncate">
                                                                {[c.typeLabel, c.email].filter(Boolean).join(' • ') || 'No details'}
                                                            </p>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {selectedFocalContactIds.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 pt-1">
                                                {selectedFocalContactIds.map(id => {
                                                    const c = entityContacts.find(ec => ec.id === id);
                                                    if (!c) return null;
                                                    return (
                                                        <span key={id} className="inline-flex items-center gap-1 bg-primary/10 text-primary rounded-full pl-2 pr-1 py-0.5 text-[9px] font-bold">
                                                            {c.name}
                                                            <button type="button" onClick={() => toggleFocalContact(id)} className="hover:bg-primary/20 rounded-full p-0.5">
                                                                <X className="h-2.5 w-2.5" />
                                                            </button>
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-muted-foreground ml-1">Estimated value ($)</Label>
                                <Input 
                                    type="number"
                                    min="0"
                                    value={value} 
                                    onChange={e => setValue(e.target.value)} 
                                    placeholder="0" 
                                    className="h-10 rounded-xl font-bold border border-border bg-background shadow-sm focus-visible:ring-1 focus-visible:ring-primary/20 text-xs"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-muted-foreground ml-1">Pipeline</Label>
                                <Select value={pipelineId} onValueChange={(val) => { setPipelineId(val); setStageId(''); }} disabled={isLoadingPipelines}>
                                    <SelectTrigger className="h-10 rounded-xl font-bold border border-border bg-background shadow-sm text-xs hover:bg-muted/10 transition-colors">
                                        <SelectValue placeholder="Select Pipeline" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-none shadow-xl">
                                        {pipelines?.map((p: any) => (
                                            <SelectItem key={p.id} value={p.id} className="font-bold text-xs">{p.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-muted-foreground ml-1">Stage (optional)</Label>
                                <Select value={stageId} onValueChange={setStageId} disabled={!pipelineId}>
                                    <SelectTrigger className="h-10 rounded-xl font-bold border border-border bg-background shadow-sm text-xs hover:bg-muted/10 transition-colors">
                                        <SelectValue placeholder="First stage (default)" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-none shadow-xl">
                                        {stages?.filter((s: any) => s.pipelineId === pipelineId).map((s: any) => (
                                            <SelectItem key={s.id} value={s.id} className="font-bold text-xs">{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-muted-foreground ml-1">Owner</Label>
                                <Select value={ownerUserId} onValueChange={setOwnerUserId}>
                                    <SelectTrigger className="h-10 rounded-xl font-bold border border-border bg-background shadow-sm text-xs hover:bg-muted/10 transition-colors">
                                        <SelectValue placeholder="Select owner" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-none shadow-xl max-h-[240px]">
                                        <SelectItem value="auto" className="font-bold text-xs">
                                            {getAutoLabel()}
                                        </SelectItem>
                                        <SelectItem value="unassigned" className="font-bold text-xs text-muted-foreground">Leave Unassigned</SelectItem>
                                        {workspaceUsers?.map(u => (
                                            <SelectItem key={u.id} value={u.id} className="font-bold text-xs">{u.name || u.email}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-semibold text-muted-foreground ml-1">Description</Label>
                            <textarea 
                                value={description} 
                                onChange={e => setDescription(e.target.value)} 
                                placeholder="Describe the deal context, opportunity details, etc." 
                                className="w-full min-h-[80px] rounded-xl p-3 text-xs font-bold border border-border bg-background shadow-sm focus-visible:ring-1 focus-visible:ring-primary/20 outline-none resize-none"
                            />
                        </div>
                    </div>

                    <DialogFooter className="p-4 bg-muted/5 dark:bg-zinc-900/50 border-t border-border/50 flex items-center justify-end gap-2 shrink-0">
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting} className="rounded-xl font-bold h-10 px-6 hover:bg-rose-50 hover:text-rose-600 transition-colors">
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting || !name || !pipelineId || (!entityId && !selectedEntityId)} className="rounded-xl font-bold h-10 px-8 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all">
                            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</> : <><Plus className="mr-2 h-4 w-4" /> Create Deal</>}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
