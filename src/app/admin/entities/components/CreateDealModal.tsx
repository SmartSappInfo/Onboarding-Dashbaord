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
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus } from 'lucide-react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { createDeal } from '@/app/actions/deal-actions';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';

interface CreateDealModalProps {
    entityId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export default function CreateDealModal({ entityId, open, onOpenChange }: CreateDealModalProps) {
    const { toast } = useToast();
    const { activeWorkspaceId, activeOrganizationId } = useWorkspace();
    const firestore = useFirestore();

    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [name, setName] = React.useState('');
    const [value, setValue] = React.useState('');
    const [pipelineId, setPipelineId] = React.useState('');
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

    React.useEffect(() => {
        if (open) {
            setName('');
            setValue('');
            setAssignmentStrategy('direct');
            if (pipelines && pipelines.length > 0) {
                setPipelineId(pipelines[0].id);
            }
        }
    }, [open, pipelines]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !pipelineId) return;

        setIsSubmitting(true);
        try {
            // For now, no eligibleUserIds selection, we just create the deal.
            // If they pick round-robin, we should theoretically fetch workspace users.
            // We pass an empty array and let the server action handle default fallback.
            const result = await createDeal({
                entityId,
                workspaceId: activeWorkspaceId!,
                organizationId: activeOrganizationId!,
                pipelineId,
                name,
                value: parseFloat(value) || 0,
                assignmentStrategy,
                eligibleUserIds: [], // To be implemented with multi-select of users
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
            <DialogContent className="sm:max-w-[425px] rounded-2xl p-0 border-none shadow-2xl overflow-hidden bg-card">
                <form onSubmit={handleSubmit}>
                    <DialogHeader className="p-6 bg-card/50 backdrop-blur-xl border-b border-border/10 shrink-0 text-left">
                        <DialogTitle className="text-xl font-semibold tracking-tight">Initiate Deal</DialogTitle>
                        <DialogDescription className="text-xs font-bold text-muted-foreground mt-1.5">
                            Create a new operational track for this entity.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="p-6 space-y-6">
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
                                <Select value={pipelineId} onValueChange={setPipelineId} disabled={isLoadingPipelines}>
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

                    <DialogFooter className="p-4 bg-muted/10 border-t border-border/10 flex items-center justify-end gap-2">
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting} className="rounded-xl font-bold h-10 px-6 hover:bg-rose-50 hover:text-rose-600 transition-colors">
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting || !name || !pipelineId} className="rounded-xl font-bold h-10 px-8 shadow-md transition-all active:scale-95">
                            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</> : <><Plus className="mr-2 h-4 w-4" /> Create Deal</>}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
