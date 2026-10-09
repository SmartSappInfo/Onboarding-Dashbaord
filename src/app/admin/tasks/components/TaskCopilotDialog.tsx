'use client';

/**
 * @fileOverview TaskCopilotDialog component (Phase 4D).
 *
 * Implements Phase 2 of the Two-Phase Action Model:
 * - Review and edit structured task proposal before committing to database.
 * - Displays and resolves detected ambiguities.
 * - Strict adherence to Section 8 Modal Architecture:
 *   - Demarcated header and footer
 *   - Single-circle CardInfoTooltip with z-[10050]
 *   - sr-only DialogDescription
 *   - min-h-[44px] touch targets on all interactive controls
 */

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { useToast } from '@/hooks/use-toast';
import { createTaskAction } from '@/lib/task-server-actions';
import type { TaskPriority, TaskCategory, TaskChecklistItem } from '@/lib/types';
import type { TaskCopilotProposal } from '@/ai/schemas/task-copilot-schemas';
import {
  Sparkles,
  AlertCircle,
  Plus,
  Trash2,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

export interface TaskCopilotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposal: TaskCopilotProposal | null;
  workspaceId: string;
  onTaskCreated?: (taskId: string) => void;
}

export function TaskCopilotDialog({
  open,
  onOpenChange,
  proposal,
  workspaceId,
  onTaskCreated,
}: TaskCopilotDialogProps) {
  const { toast } = useToast();

  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [priority, setPriority] = React.useState<TaskPriority>('medium');
  const [category, setCategory] = React.useState<TaskCategory>('general');
  const [dueDate, setDueDate] = React.useState('');
  const [checklist, setChecklist] = React.useState<string[]>([]);
  const [newStepText, setNewStepText] = React.useState('');
  const [isCreating, setIsCreating] = React.useState(false);

  React.useEffect(() => {
    if (proposal) {
      setTitle(proposal.title || '');
      setDescription(proposal.description || '');
      setPriority((proposal.priority as TaskPriority) || 'medium');
      setCategory((proposal.category as TaskCategory) || 'general');
      setDueDate(proposal.dueDate || '');
      setChecklist(proposal.suggestedChecklist || []);
      setNewStepText('');
    }
  }, [proposal]);

  const handleAddStep = () => {
    if (!newStepText.trim()) return;
    setChecklist((prev) => [...prev, newStepText.trim()]);
    setNewStepText('');
  };

  const handleRemoveStep = (index: number) => {
    setChecklist((prev) => prev.filter((_, i) => i !== index));
  };

  const handleConfirmCreate = async () => {
    if (!title.trim()) {
      toast({
        title: 'Title Required',
        description: 'Please provide a task title.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsCreating(true);

      const checklistItems: TaskChecklistItem[] = checklist.map((item, idx) => ({
        id: `chk_${Date.now()}_${idx}`,
        title: item,
        completed: false,
      }));

      const res = await createTaskAction({
        workspaceId,
        title: title.trim(),
        description: description.trim() || '',
        status: 'todo',
        priority,
        category,
        assignedTo: '',
        dueDate: dueDate || new Date().toISOString(),
        reminders: [],
        reminderSent: false,
        checklist: checklistItems.length > 0 ? checklistItems : undefined,
      });

      if (!res.success) {
        toast({
          title: 'Creation Failed',
          description: res.error || 'Failed to create task.',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Task Created Successfully',
        description: `"${title.trim()}" has been added to your task registry.`,
        actionConfig: {
          path: '/admin/tasks',
          label: 'View Tasks',
        },
      });

      onOpenChange(false);
      const createdTaskId = res.id || (res as unknown as { data?: { id?: string } }).data?.id;
      if (createdTaskId && onTaskCreated) {
        onTaskCreated(createdTaskId);
      }
    } catch (err: unknown) {
      console.error('[TASK_COPILOT] Error creating task:', err);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred while creating task.',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  if (!proposal) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 overflow-hidden sm:max-w-lg max-h-[85vh] flex flex-col font-figtree">
        <DialogHeader demarcated>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary shrink-0" />
            <DialogTitle className="text-base font-bold">Review AI Task Proposal</DialogTitle>
            <CardInfoTooltip text="Review and refine inferred task properties before confirming creation. No database records are written until you confirm." />
          </div>
          <DialogDescription className="sr-only">
            Review and edit AI task proposal before confirming creation.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Ambiguities Warning if any */}
          {proposal.detectedAmbiguities && proposal.detectedAmbiguities.length > 0 && (
            <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
                <AlertCircle className="h-4 w-4" />
                <span>Clarification Detected</span>
              </div>
              {proposal.detectedAmbiguities.map((amb, i) => (
                <p key={i} className="text-xs text-amber-900/90 dark:text-amber-200">
                  {amb.reason}: <span className="font-semibold">{amb.options.join(', ')}</span>
                </p>
              ))}
            </div>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">Task Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title..."
              className="h-11 min-h-[44px] rounded-xl text-sm"
            />
          </div>

          {/* Priority & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Priority</label>
              <Select
                value={priority}
                onValueChange={(val) => setPriority(val as TaskPriority)}
              >
                <SelectTrigger className="h-11 min-h-[44px] rounded-xl text-xs">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low Priority</SelectItem>
                  <SelectItem value="medium">Medium Priority</SelectItem>
                  <SelectItem value="high">High Priority</SelectItem>
                  <SelectItem value="urgent">Urgent / ASAP</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Category</label>
              <Select
                value={category}
                onValueChange={(val) => setCategory(val as TaskCategory)}
              >
                <SelectTrigger className="h-11 min-h-[44px] rounded-xl text-xs">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="document">Document</SelectItem>
                  <SelectItem value="sales">Sales</SelectItem>
                  <SelectItem value="design">Design</SelectItem>
                  <SelectItem value="engineering">Engineering</SelectItem>
                  <SelectItem value="compliance">Compliance</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Due Date */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">Due Date</label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="h-11 min-h-[44px] rounded-xl text-xs"
            />
          </div>

          {/* Suggested Checklist */}
          <div className="space-y-2 pt-2 border-t border-border/60">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground">
                Action Checklist ({checklist.length})
              </label>
              <span className="text-[11px] text-muted-foreground">Inferred subtasks</span>
            </div>

            <div className="space-y-1.5">
              {checklist.map((step, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-border/60 bg-muted/20 text-xs"
                >
                  <span className="truncate text-foreground">{step}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveStep(idx)}
                    className="h-9 min-h-[36px] w-9 p-0 text-muted-foreground hover:text-destructive active:scale-[0.97]"
                    aria-label="Remove step"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Add step inline */}
            <div className="flex items-center gap-2 pt-1">
              <Input
                value={newStepText}
                onChange={(e) => setNewStepText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddStep();
                  }
                }}
                placeholder="Add checklist step..."
                className="h-11 min-h-[44px] rounded-xl text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddStep}
                className="rounded-xl h-11 min-h-[44px] px-3.5 text-xs font-bold active:scale-[0.97] shrink-0"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter demarcated>
          <Button
            type="button"
            variant="outline"
            disabled={isCreating}
            onClick={() => onOpenChange(false)}
            className="rounded-xl h-11 min-h-[44px] px-4 text-xs font-bold active:scale-[0.97]"
          >
            Cancel
          </Button>

          <Button
            type="button"
            disabled={isCreating}
            onClick={handleConfirmCreate}
            className="rounded-xl h-11 min-h-[44px] px-6 text-xs font-bold active:scale-[0.97] bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            {isCreating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Creating Task...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                Confirm & Create Task
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
