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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Link2, Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { createKnowledgeRelationAction } from '@/lib/quick-notes-graph-actions';
import {
  KNOWLEDGE_RELATION_TYPES,
  type KnowledgeRelationType,
  type GraphNode,
} from '@/lib/quick-notes-types';
import { getRelationDisplayLabel } from '@/lib/quick-notes-domain';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUser } from '@/firebase';

interface CreateRelationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceNodeId: string | null;
  nodes: GraphNode[];
  onRelationCreated: () => void;
}

export function CreateRelationDialog({
  open,
  onOpenChange,
  sourceNodeId,
  nodes,
  onRelationCreated,
}: CreateRelationDialogProps) {
  const { toast } = useToast();
  const { activeWorkspaceId } = useWorkspace();
  const { user } = useUser();

  const [targetId, setTargetId] = React.useState<string>('');
  const [relationType, setRelationType] = React.useState<KnowledgeRelationType>('related_to');
  const [searchTarget, setSearchTarget] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const sourceNode = React.useMemo(
    () => nodes.find((n) => n.id === sourceNodeId),
    [nodes, sourceNodeId]
  );

  const candidateNodes = React.useMemo(() => {
    return nodes
      .filter((n) => n.id !== sourceNodeId)
      .filter((n) =>
        searchTarget.trim() ? n.label.toLowerCase().includes(searchTarget.toLowerCase().trim()) : true
      )
      .slice(0, 30);
  }, [nodes, sourceNodeId, searchTarget]);

  React.useEffect(() => {
    if (!open) {
      setTargetId('');
      setRelationType('related_to');
      setSearchTarget('');
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspaceId || !user || !sourceNodeId || !targetId) {
      toast({
        variant: 'destructive',
        title: 'Selection required',
        description: 'Please select a valid target knowledge object.',
      });
      return;
    }

    const targetNode = nodes.find((n) => n.id === targetId);
    if (!targetNode) return;

    setIsSubmitting(true);
    try {
      const res = await createKnowledgeRelationAction(
        activeWorkspaceId,
        user.uid,
        user.displayName || 'User',
        {
          fromObjectId: sourceNodeId,
          fromObjectType: sourceNode?.type || 'note',
          toObjectId: targetId,
          toObjectType: targetNode.type,
          relationType,
          confidence: 1.0,
          source: 'user',
        }
      );

      if (!res.success) {
        toast({
          variant: 'destructive',
          title: 'Failed to create link',
          description: res.error,
        });
        return;
      }

      toast({
        title: 'Connection created',
        description: `Linked "${sourceNode?.label}" as ${getRelationDisplayLabel(relationType)} "${targetNode.label}"`,
        actionConfig: {
          path: `/admin/quick-notes/graph?focus=${encodeURIComponent(sourceNodeId)}`,
          label: 'View in Graph',
        },
      });

      onRelationCreated();
      onOpenChange(false);
    } catch (err) {
      console.error('[CreateRelationDialog] Error:', err);
      toast({
        variant: 'destructive',
        title: 'Unexpected error',
        description: 'Failed to establish relationship.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <Link2 className="w-5 h-5 text-blue-500" />
              Add Knowledge Relationship
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Connect <strong className="text-foreground">{sourceNode?.label}</strong> to another note,
              idea, or CRM record with a typed semantic link.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Relationship Type Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Relationship Type</Label>
              <Select
                value={relationType}
                onValueChange={(val) => setRelationType(val as KnowledgeRelationType)}
              >
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Select relationship type" />
                </SelectTrigger>
                <SelectContent className="max-h-60 rounded-xl">
                  {KNOWLEDGE_RELATION_TYPES.map((type) => (
                    <SelectItem key={type} value={type} className="text-xs">
                      {getRelationDisplayLabel(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Target Object Search & Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Target Knowledge Object</Label>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={searchTarget}
                  onChange={(e) => setSearchTarget(e.target.value)}
                  placeholder="Filter candidate objects…"
                  className="pl-8 h-8 text-xs rounded-lg"
                />
              </div>

              <div className="max-h-48 overflow-y-auto border border-border rounded-xl divide-y divide-border/60 bg-muted/20">
                {candidateNodes.length === 0 ? (
                  <p className="p-3 text-xs text-muted-foreground text-center italic">
                    No matching objects found.
                  </p>
                ) : (
                  candidateNodes.map((n) => (
                    <label
                      key={n.id}
                      className={`flex items-center justify-between p-2.5 text-xs cursor-pointer hover:bg-muted/50 transition-colors ${
                        targetId === n.id ? 'bg-primary/10 font-semibold' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <input
                          type="radio"
                          name="targetObjectRadio"
                          checked={targetId === n.id}
                          onChange={() => setTargetId(n.id)}
                          className="text-primary focus:ring-primary h-3.5 w-3.5"
                        />
                        <span className="truncate">{n.label}</span>
                      </div>
                      <span className="text-[10px] uppercase font-semibold text-muted-foreground shrink-0">
                        {n.type}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="rounded-xl h-9 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !targetId}
              className="rounded-xl h-9 text-xs font-medium shadow-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Connecting…
                </>
              ) : (
                'Create Connection'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
