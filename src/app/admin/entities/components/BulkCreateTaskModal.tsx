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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ClipboardCheck } from 'lucide-react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { bulkCreateTasksAction } from '@/app/actions/bulk-task-actions';

interface BulkCreateTaskModalProps {
  entityIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

export default function BulkCreateTaskModal({
  entityIds,
  open,
  onOpenChange,
  onComplete,
}: BulkCreateTaskModalProps) {
  const { toast } = useToast();
  const { activeWorkspaceId, activeOrganizationId } = useWorkspace();

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [priority, setPriority] = React.useState<'low' | 'medium' | 'high'>('medium');
  const [category, setCategory] = React.useState('general');
  const [dueDaysOffset, setDueDaysOffset] = React.useState('3');

  React.useEffect(() => {
    if (open) {
      setTitle('');
      setDescription('');
      setPriority('medium');
      setCategory('general');
      setDueDaysOffset('3');
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || entityIds.length === 0) return;

    setIsSubmitting(true);
    try {
      const result = await bulkCreateTasksAction({
        entityIds,
        workspaceId: activeWorkspaceId!,
        organizationId: activeOrganizationId!,
        title,
        description,
        priority,
        category,
        dueDaysOffset: parseInt(dueDaysOffset, 10) || 1,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      toast({
        title: 'Bulk Tasks Assigned',
        description: `Successfully initiated ${result.count} tasks.`,
      });
      onOpenChange(false);
      onComplete?.();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Bulk Task Assignment Failed',
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] rounded-2xl p-0 border-none shadow-2xl overflow-hidden bg-card text-left">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="p-6 bg-card/50 backdrop-blur-xl border-b border-border/10 shrink-0">
            <DialogTitle className="text-xl font-bold tracking-tight">Assign Bulk CRM Tasks</DialogTitle>
            <DialogDescription className="text-xs font-bold text-muted-foreground mt-1.5">
              Distribute shared administrative duties for the{' '}
              <span className="text-primary font-mono">{entityIds.length}</span> selected records.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="task-title" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                Task Protocol Title
              </Label>
              <Input
                id="task-title"
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Conduct Secondary Document Check"
                className="h-10 rounded-xl font-bold bg-muted/20 border-primary/10 shadow-inner focus-visible:ring-1 focus-visible:ring-primary/30"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-desc" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                Description / Checklist
              </Label>
              <Textarea
                id="task-desc"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Review location profiles, verify signature completeness..."
                className="rounded-xl font-semibold bg-muted/20 border-primary/10 shadow-inner focus-visible:ring-1 focus-visible:ring-primary/30 min-h-[80px]"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="task-priority" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                  Priority
                </Label>
                <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
                  <SelectTrigger id="task-priority" className="h-10 rounded-xl font-bold bg-muted/20 border-primary/10 shadow-inner text-xs">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-xl">
                    <SelectItem value="low" className="font-bold text-xs">Low</SelectItem>
                    <SelectItem value="medium" className="font-bold text-xs">Medium</SelectItem>
                    <SelectItem value="high" className="font-bold text-xs text-rose-500">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="task-category" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                  Category
                </Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="task-category" className="h-10 rounded-xl font-bold bg-muted/20 border-primary/10 shadow-inner text-xs">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-xl">
                    <SelectItem value="general" className="font-bold text-xs">General</SelectItem>
                    <SelectItem value="tasks" className="font-bold text-xs">Tasks</SelectItem>
                    <SelectItem value="reminders" className="font-bold text-xs">Reminders</SelectItem>
                    <SelectItem value="automations" className="font-bold text-xs">Automations</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="task-offset" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                  Due In (Days)
                </Label>
                <Input
                  id="task-offset"
                  type="number"
                  min="1"
                  value={dueDaysOffset}
                  onChange={e => setDueDaysOffset(e.target.value)}
                  className="h-10 rounded-xl font-bold bg-muted/20 border-primary/10 shadow-inner focus-visible:ring-1 focus-visible:ring-primary/30 text-xs"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 bg-muted/10 border-t border-border/10 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="rounded-xl font-bold h-10 px-6 hover:bg-rose-50 hover:text-rose-600 transition-colors"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !title}
              className="rounded-xl font-bold h-10 px-8 shadow-md transition-all active:scale-95"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Assigning...
                </>
              ) : (
                <>
                  <ClipboardCheck className="mr-2 h-4 w-4" /> Assign Tasks
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
