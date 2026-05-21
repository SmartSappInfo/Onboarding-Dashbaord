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
import { Loader2, Plus, Check } from 'lucide-react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { createDeal } from '@/app/actions/deal-actions';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';

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

    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [name, setName] = React.useState('');
    const [value, setValue] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [pipelineId, setPipelineId] = React.useState('');
    const [stageId, setStageId] = React.useState('');
    const [selectedEntityId, setSelectedEntityId] = React.useState('');
    const [entitySearchOpen, setEntitySearchOpen] = React.useState(false);
    const [assignmentStrategy, setAssignmentStrategy] = React.useState<'direct' | 'round-robin' | 'value-based' | 'unassigned'>('direct');
    
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

    // Fetch workspace entities when creating a global deal without contact context
    const entitiesQuery = useMemoFirebase(() => 
        firestore && activeWorkspaceId && !entityId ? query(
            collection(firestore, 'workspace_entities'), 
            where('workspaceId', '==', activeWorkspaceId),
            orderBy('name', 'asc')
        ) : null, 
    [firestore, activeWorkspaceId, entityId]);
    const { data: entities } = useCollection<any>(entitiesQuery);

    React.useEffect(() => {
        if (open) {
            setName('');
            setValue('');
            setDescription('');
            setAssignmentStrategy('direct');
            
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const finalEntityId = entityId || selectedEntityId;
        if (!finalEntityId || !name || !pipelineId) {
            toast({ variant: 'destructive', title: 'Validation Error', description: 'Please fill in all required fields.' });
            return;
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
                eligibleUserIds: [], 
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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[450px] rounded-2xl p-0 border-none shadow-2xl overflow-hidden bg-card">
                <form onSubmit={handleSubmit}>
                    <DialogHeader className="p-6 bg-card/50 backdrop-blur-xl border-b border-border/10 shrink-0 text-left">
                        <DialogTitle className="text-xl font-semibold tracking-tight">Initiate Deal</DialogTitle>
                        <DialogDescription className="text-xs font-bold text-muted-foreground mt-1.5">
                            Create a new operational track for an entity in the pipeline.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
                        {!entityId && (
                            <div className="space-y-2 flex flex-col">
                                <Label className="text-[9px] font-semibold text-muted-foreground ml-1 uppercase tracking-wider">Target Contact / Entity</Label>
                                <Popover open={entitySearchOpen} onOpenChange={setEntitySearchOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={entitySearchOpen}
                                            className="w-full justify-between h-10 rounded-xl font-bold bg-muted/20 border-primary/10 shadow-inner"
                                        >
                                            {selectedEntityId
                                                ? entities?.find((e: any) => e.id === selectedEntityId)?.name || "Select Entity..."
                                                : "Select Entity..."}
                                            <Plus className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[400px] p-0 border-none shadow-2xl rounded-xl overflow-hidden bg-card">
                                        <Command>
                                            <CommandInput placeholder="Search entities..." />
                                            <CommandList>
                                                <CommandEmpty>No entity found.</CommandEmpty>
                                                <CommandGroup>
                                                    {entities?.map((e: any) => (
                                                        <CommandItem
                                                            key={e.id}
                                                            value={e.name}
                                                            onSelect={() => {
                                                                setSelectedEntityId(e.id);
                                                                setEntitySearchOpen(false);
                                                            }}
                                                            className="font-bold text-xs p-3 cursor-pointer"
                                                        >
                                                            <div className="flex flex-col">
                                                                <span>{e.name}</span>
                                                                <span className="text-[9px] text-muted-foreground font-normal">{e.email || 'No Email'} • {e.entityType || 'person'}</span>
                                                            </div>
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label className="text-[9px] font-semibold text-muted-foreground ml-1 uppercase tracking-wider">Deal Name</Label>
                            <Input 
                                required
                                value={name} 
                                onChange={e => setName(e.target.value)} 
                                placeholder="e.g. 2026 Expansion Contract" 
                                className="h-10 rounded-xl font-bold bg-muted/20 border-primary/10 shadow-inner focus-visible:ring-1 focus-visible:ring-primary/30"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[9px] font-semibold text-muted-foreground ml-1 uppercase tracking-wider">Estimated Value ($)</Label>
                                <Input 
                                    type="number"
                                    min="0"
                                    value={value} 
                                    onChange={e => setValue(e.target.value)} 
                                    placeholder="0" 
                                    className="h-10 rounded-xl font-bold bg-muted/20 border-primary/10 shadow-inner focus-visible:ring-1 focus-visible:ring-primary/30"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[9px] font-semibold text-muted-foreground ml-1 uppercase tracking-wider">Pipeline</Label>
                                <Select value={pipelineId} onValueChange={(val) => { setPipelineId(val); setStageId(''); }} disabled={isLoadingPipelines}>
                                    <SelectTrigger className="h-10 rounded-xl font-bold bg-muted/20 border-primary/10 shadow-inner">
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
                                <Label className="text-[9px] font-semibold text-muted-foreground ml-1 uppercase tracking-wider">Stage (Optional)</Label>
                                <Select value={stageId} onValueChange={setStageId} disabled={!pipelineId}>
                                    <SelectTrigger className="h-10 rounded-xl font-bold bg-muted/20 border-primary/10 shadow-inner">
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
                                <Label className="text-[9px] font-semibold text-muted-foreground ml-1 uppercase tracking-wider">Assignment Routing</Label>
                                <Select value={assignmentStrategy} onValueChange={(v: any) => setAssignmentStrategy(v)}>
                                    <SelectTrigger className="h-10 rounded-xl font-bold bg-muted/20 border-primary/10 shadow-inner">
                                        <SelectValue placeholder="Select Routing Logic" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-none shadow-xl">
                                        <SelectItem value="direct" className="font-bold text-xs">Direct (Match Entity Owner)</SelectItem>
                                        <SelectItem value="round-robin" className="font-bold text-xs">Round-Robin (Least Active Deals)</SelectItem>
                                        <SelectItem value="value-based" className="font-bold text-xs">Value-Based (Lowest Pipeline Value)</SelectItem>
                                        <SelectItem value="unassigned" className="font-bold text-xs">Leave Unassigned</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[9px] font-semibold text-muted-foreground ml-1 uppercase tracking-wider">Description</Label>
                            <textarea 
                                value={description} 
                                onChange={e => setDescription(e.target.value)} 
                                placeholder="Describe the deal context, opportunity details, etc." 
                                className="w-full min-h-[80px] rounded-xl p-3 text-sm font-semibold bg-muted/20 border border-primary/10 shadow-inner focus-visible:ring-1 focus-visible:ring-primary/30 outline-none resize-none"
                            />
                        </div>
                    </div>

                    <DialogFooter className="p-4 bg-muted/10 border-t border-border/10 flex items-center justify-end gap-2 shrink-0">
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting} className="rounded-xl font-bold h-10 px-6 hover:bg-rose-50 hover:text-rose-600 transition-colors">
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting || !name || !pipelineId || (!entityId && !selectedEntityId)} className="rounded-xl font-bold h-10 px-8 shadow-md transition-all active:scale-95">
                            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</> : <><Plus className="mr-2 h-4 w-4" /> Create Deal</>}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
