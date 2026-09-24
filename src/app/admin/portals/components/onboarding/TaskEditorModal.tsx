'use client';

/**
 * {{Org_name}} Experience Platform — Task Editor Modal
 *
 * Visual dialog for creating and editing actionable Member Tasks.
 * Features file upload requirement toggles, template attachment, points bounties,
 * and contact tag automation via the standardized TagSelector component.
 *
 * Conforms to:
 * - next-best-practices, vercel-react-best-practices
 * - emilkowal-animations (tactile feedback, active:scale-[0.97])
 * - Tag Selection Single Source of Truth (<TagSelector> in draft mode)
 * - Minimum 44px mobile touch targets
 * - Strict typing (0 any, 0 any[], 0 unhandled unknown)
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { TagSelector } from '@/components/tags/TagSelector';
import type { MemberTask, TaskPriority } from '@/lib/types/engagement';
import {
  ListOrdered,
  Loader2,
  Calendar,
  Award,
  Link as LinkIcon,
  UploadCloud,
  FileSpreadsheet,
  Tag as TagIcon,
} from 'lucide-react';

export interface TaskFormData {
  title: string;
  description?: string;
  priority: TaskPriority;
  dueDate?: string;
  relativeDueDays?: number;
  pointsReward: number;
  actionUrl?: string;
  requireFileUpload?: boolean;
  downloadTemplateUrl?: string;
  completionTagIds?: string[];
  order?: number;
}

interface TaskEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: MemberTask | null;
  onSave: (data: TaskFormData) => Promise<void>;
}

export function TaskEditorModal({
  open,
  onOpenChange,
  task,
  onSave,
}: TaskEditorModalProps) {
  const isEditing = Boolean(task);

  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [priority, setPriority] = React.useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = React.useState('');
  const [relativeDueDays, setRelativeDueDays] = React.useState<number | undefined>(undefined);
  const [pointsReward, setPointsReward] = React.useState(15);
  const [actionUrl, setActionUrl] = React.useState('');
  const [requireFileUpload, setRequireFileUpload] = React.useState(false);
  const [downloadTemplateUrl, setDownloadTemplateUrl] = React.useState('');
  const [completionTagIds, setCompletionTagIds] = React.useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Sync state on open / task change
  React.useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setPriority(task.priority || 'medium');
      setDueDate(task.dueDate ? task.dueDate.split('T')[0] : '');
      setRelativeDueDays(task.relativeDueDays);
      setPointsReward(task.pointsReward ?? 15);
      setActionUrl(task.actionUrl || '');
      setRequireFileUpload(Boolean(task.requireFileUpload));
      setDownloadTemplateUrl(task.downloadTemplateUrl || '');
      setCompletionTagIds(task.completionTagIds || []);
    } else {
      setTitle('');
      setDescription('');
      setPriority('medium');
      setDueDate('');
      setRelativeDueDays(undefined);
      setPointsReward(15);
      setActionUrl('');
      setRequireFileUpload(false);
      setDownloadTemplateUrl('');
      setCompletionTagIds([]);
    }
  }, [task, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        dueDate: dueDate || undefined,
        relativeDueDays: relativeDueDays !== undefined && !isNaN(relativeDueDays) ? relativeDueDays : undefined,
        pointsReward,
        actionUrl: actionUrl.trim() || undefined,
        requireFileUpload,
        downloadTemplateUrl: downloadTemplateUrl.trim() || undefined,
        completionTagIds: completionTagIds.length > 0 ? completionTagIds : undefined,
        order: task?.order ?? 1,
      });
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-3xl p-6 sm:p-8 space-y-4 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-3 border-b border-border">
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
            <ListOrdered className="w-4 h-4" />
            {isEditing ? 'Edit Action Task' : 'New Action Task'}
          </div>
          <DialogTitle className="text-xl font-black">
            {isEditing ? 'Modify Task Details' : 'Create Member Action Task'}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Configure practical assignments, due dates, review requirements, and CRM completion tags.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Task Title */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground">Task Title</Label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Audit Term 1 Overdue Fee Accounts"
              className="h-10 text-xs rounded-xl font-bold min-h-[44px]"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground">Instructions & Deliverables</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What practical steps must the member execute to achieve completion?"
              rows={3}
              className="text-xs rounded-xl resize-none"
            />
          </div>

          {/* Priority & Points */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Priority</Label>
              <Select value={priority} onValueChange={(val: TaskPriority) => setPriority(val)}>
                <SelectTrigger className="h-10 text-xs rounded-xl bg-background min-h-[44px] capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="low">🟢 Low Priority</SelectItem>
                  <SelectItem value="medium">🟡 Medium Priority</SelectItem>
                  <SelectItem value="high">🟠 High Priority</SelectItem>
                  <SelectItem value="urgent">🔴 Urgent Action</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-amber-500" /> Points Reward
              </Label>
              <Input
                type="number"
                value={pointsReward}
                onChange={e => setPointsReward(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="h-10 text-xs rounded-xl font-bold min-h-[44px]"
                min={0}
              />
            </div>
          </div>

          {/* Due Date & Relative Due Days */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" /> Fixed Due Date (Optional)
              </Label>
              <Input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="h-10 text-xs rounded-xl min-h-[44px]"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">
                Relative Due Days (Optional)
              </Label>
              <Input
                type="number"
                placeholder="e.g. 7 (days after joining)"
                value={relativeDueDays ?? ''}
                onChange={e => setRelativeDueDays(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                className="h-10 text-xs rounded-xl min-h-[44px]"
                min={1}
              />
            </div>
          </div>

          {/* Action Link */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <LinkIcon className="w-3.5 h-3.5 text-muted-foreground" /> Action / Tool URL (Optional)
            </Label>
            <Input
              value={actionUrl}
              onChange={e => setActionUrl(e.target.value)}
              placeholder="e.g. /portal/academy/learn/invoicing-fee-recovery"
              className="h-10 text-xs rounded-xl font-mono min-h-[44px]"
            />
          </div>

          {/* File Upload Requirement Toggle */}
          <div className="p-3.5 rounded-2xl border border-border/80 bg-muted/20 space-y-3">
            <div className="flex items-center space-x-2.5">
              <Checkbox
                id="requireFileUpload"
                checked={requireFileUpload}
                onCheckedChange={checked => setRequireFileUpload(Boolean(checked))}
              />
              <label
                htmlFor="requireFileUpload"
                className="text-xs font-bold text-foreground cursor-pointer select-none flex items-center gap-1.5"
              >
                <UploadCloud className="w-4 h-4 text-primary" />
                Require File / Work Submission
              </label>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed pl-6">
              Learners must upload an assignment file (PDF, Excel, Docx, or ZIP) which will appear in the Instructor Review Queue.
            </p>

            {requireFileUpload && (
              <div className="space-y-1.5 pt-1 pl-6">
                <Label className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
                  Starter Template Download Link (Optional)
                </Label>
                <Input
                  value={downloadTemplateUrl}
                  onChange={e => setDownloadTemplateUrl(e.target.value)}
                  placeholder="https://... (e.g. downloadable fee audit workbook template)"
                  className="h-9 text-xs rounded-xl font-mono min-h-[44px]"
                />
              </div>
            )}
          </div>

          {/* CRM Completion Tags (Single Source of Truth: TagSelector) */}
          <div className="space-y-2 pt-1">
            <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <TagIcon className="w-3.5 h-3.5 text-primary" /> Auto-Apply Contact Tags on Approval
            </Label>
            <p className="text-[11px] text-muted-foreground">
              These CRM tags will be automatically applied to the member's linked Contact when their submission is approved.
            </p>
            <div className="p-3 rounded-2xl border border-border/80 bg-card">
              <TagSelector
                currentTagIds={completionTagIds}
                onTagsChange={setCompletionTagIds}
                className="w-full"
              />
            </div>
          </div>

          <DialogFooter className="pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
              className="rounded-xl font-bold text-xs w-full sm:w-auto min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/90 w-full sm:w-auto min-h-[44px] active:scale-[0.97] gap-1.5 shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : isEditing ? (
                'Update Task'
              ) : (
                'Create Task'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
