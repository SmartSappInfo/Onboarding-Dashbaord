'use client';

/**
 * {{Org_name}} Experience Platform — Onboarding Step Editor Modal
 *
 * Visual configuration dialog for an Onboarding Step supporting Orientation Video,
 * Profile Setup, Lesson Launch, Community Post, Action Tasks, Bookings, and Custom Links.
 *
 * Conforms to:
 * - next-best-practices, vercel-react-best-practices
 * - emilkowal-animations (tactile feedback, active:scale-[0.97])
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
import type {
  OnboardingStep,
  StepType,
  AutoVerificationType,
  MemberTask,
} from '@/lib/types/engagement';
import {
  Sparkles,
  Play,
  User,
  BookOpen,
  MessageSquare,
  CheckSquare,
  Calendar,
  ExternalLink,
} from 'lucide-react';

interface OnboardingStepEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  step: OnboardingStep | null;
  onSave: (step: OnboardingStep) => void;
  availableTasks?: MemberTask[];
}

export function OnboardingStepEditorModal({
  open,
  onOpenChange,
  step,
  onSave,
  availableTasks = [],
}: OnboardingStepEditorModalProps) {
  const isEditing = Boolean(step);

  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [type, setType] = React.useState<StepType>('welcome_video');
  const [actionLabel, setActionLabel] = React.useState('');
  const [autoVerificationType, setAutoVerificationType] = React.useState<AutoVerificationType>('auto_watch');
  const [videoUrl, setVideoUrl] = React.useState('');
  const [targetUrl, setTargetUrl] = React.useState('');
  const [targetEntityId, setTargetEntityId] = React.useState('');
  const [isRequired, setIsRequired] = React.useState(true);

  // Sync state when step changes or dialog opens
  React.useEffect(() => {
    if (step) {
      setTitle(step.title || '');
      setDescription(step.description || '');
      setType(step.type || 'welcome_video');
      setActionLabel(step.actionLabel || '');
      setAutoVerificationType(step.autoVerificationType || 'manual_confirm');
      setVideoUrl(step.videoUrl || '');
      setTargetUrl(step.targetUrl || '');
      setTargetEntityId(step.targetEntityId || '');
      setIsRequired(step.isRequired ?? true);
    } else {
      setTitle('');
      setDescription('');
      setType('welcome_video');
      setActionLabel('');
      setAutoVerificationType('auto_watch');
      setVideoUrl('');
      setTargetUrl('');
      setTargetEntityId('');
      setIsRequired(true);
    }
  }, [step, open]);

  // Adjust default autoVerificationType when type changes
  const handleTypeChange = (newType: StepType) => {
    setType(newType);
    if (!step) {
      if (newType === 'welcome_video') {
        setAutoVerificationType('auto_watch');
        setActionLabel('Watch Orientation');
      } else if (newType === 'complete_profile') {
        setAutoVerificationType('has_profile');
        setActionLabel('Complete Profile');
      } else if (newType === 'start_course') {
        setAutoVerificationType('has_started_lesson');
        setActionLabel('Start First Lesson');
      } else if (newType === 'community_post') {
        setAutoVerificationType('has_community_post');
        setActionLabel('Say Hello in Community');
      } else if (newType === 'action_task') {
        setAutoVerificationType('has_task_submission');
        setActionLabel('Submit Assignment');
      } else if (newType === 'book_meeting') {
        setAutoVerificationType('manual_confirm');
        setActionLabel('Book 1-on-1 Session');
      } else {
        setAutoVerificationType('manual_confirm');
        setActionLabel('Open Link');
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const savedStep: OnboardingStep = {
      id: step ? step.id : `step_${Date.now()}`,
      title: title.trim(),
      description: description.trim(),
      type,
      actionLabel: actionLabel.trim() || undefined,
      autoVerificationType,
      videoUrl: type === 'welcome_video' ? videoUrl.trim() || undefined : undefined,
      targetUrl: (type === 'custom_url' || type === 'book_meeting') ? targetUrl.trim() || undefined : undefined,
      targetEntityId: type === 'action_task' ? targetEntityId.trim() || undefined : undefined,
      isRequired,
      order: step?.order ?? 1,
    };

    onSave(savedStep);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-3xl p-6 sm:p-8 space-y-4 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-3 border-b border-border">
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-amber-500" />
            {isEditing ? 'Edit Step Configuration' : 'New Onboarding Step'}
          </div>
          <DialogTitle className="text-xl font-black">
            {isEditing ? 'Configure Step' : 'Create Onboarding Step'}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Configure how learners experience and automatically verify this onboarding milestone.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Step Type */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground">Step Type</Label>
            <Select value={type} onValueChange={(val: StepType) => handleTypeChange(val)}>
              <SelectTrigger className="h-10 text-xs rounded-xl bg-background min-h-[44px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                <SelectItem value="welcome_video" className="text-xs">
                  <div className="flex items-center gap-2">
                    <Play className="w-3.5 h-3.5 text-blue-500" /> Orientation Video
                  </div>
                </SelectItem>
                <SelectItem value="complete_profile" className="text-xs">
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-emerald-500" /> Profile Setup
                  </div>
                </SelectItem>
                <SelectItem value="start_course" className="text-xs">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-indigo-500" /> Course Lesson
                  </div>
                </SelectItem>
                <SelectItem value="community_post" className="text-xs">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5 text-amber-500" /> Community Post
                  </div>
                </SelectItem>
                <SelectItem value="action_task" className="text-xs">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="w-3.5 h-3.5 text-purple-500" /> Action Task Submission
                  </div>
                </SelectItem>
                <SelectItem value="book_meeting" className="text-xs">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-rose-500" /> Book 1-on-1 Session
                  </div>
                </SelectItem>
                <SelectItem value="custom_url" className="text-xs">
                  <div className="flex items-center gap-2">
                    <ExternalLink className="w-3.5 h-3.5 text-slate-500" /> Custom Link / Action
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground">Step Title</Label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Watch Orientation & Welcome Message"
              className="h-10 text-xs rounded-xl font-bold min-h-[44px]"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground">Instructions / Description</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Provide context or guidance on how to accomplish this step..."
              rows={2}
              className="text-xs rounded-xl resize-none"
            />
          </div>

          {/* Auto-Verification Mode */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground">Auto-Verification Trigger</Label>
            <Select
              value={autoVerificationType}
              onValueChange={(val: AutoVerificationType) => setAutoVerificationType(val)}
            >
              <SelectTrigger className="h-10 text-xs rounded-xl bg-background min-h-[44px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                <SelectItem value="auto_watch" className="text-xs">
                  Auto on Video Completion (≥90% watched)
                </SelectItem>
                <SelectItem value="has_profile" className="text-xs">
                  Auto on Profile Save (Bio & Avatar set)
                </SelectItem>
                <SelectItem value="has_started_lesson" className="text-xs">
                  Auto on Lesson Playback
                </SelectItem>
                <SelectItem value="has_community_post" className="text-xs">
                  Auto on First Discussion Post
                </SelectItem>
                <SelectItem value="has_task_submission" className="text-xs">
                  Auto on Action Task File Submission
                </SelectItem>
                <SelectItem value="manual_confirm" className="text-xs">
                  Manual Confirmation by Member
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Conditional Inputs Based on Type */}
          {type === 'welcome_video' && (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Orientation Video URL</Label>
              <Input
                value={videoUrl}
                onChange={e => setVideoUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=... or Loom embed URL"
                className="h-10 text-xs rounded-xl font-mono min-h-[44px]"
              />
              <p className="text-[11px] text-muted-foreground">
                Supports YouTube, Loom, Vimeo, and direct MP4 URLs.
              </p>
            </div>
          )}

          {type === 'action_task' && (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Target Action Task</Label>
              {availableTasks.length > 0 ? (
                <Select
                  value={targetEntityId}
                  onValueChange={setTargetEntityId}
                >
                  <SelectTrigger className="h-10 text-xs rounded-xl bg-background min-h-[44px]">
                    <SelectValue placeholder="Select an existing task..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    {availableTasks.map(t => (
                      <SelectItem key={t.id} value={t.id} className="text-xs">
                        {t.title} ({t.priority} priority, +{t.pointsReward} pts)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={targetEntityId}
                  onChange={e => setTargetEntityId(e.target.value)}
                  placeholder="Task ID or create tasks in the Tasks tab"
                  className="h-10 text-xs rounded-xl font-mono min-h-[44px]"
                />
              )}
            </div>
          )}

          {(type === 'custom_url' || type === 'book_meeting') && (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Target URL / External Link</Label>
              <Input
                value={targetUrl}
                onChange={e => setTargetUrl(e.target.value)}
                placeholder="https://calendly.com/... or relative portal path"
                className="h-10 text-xs rounded-xl font-mono min-h-[44px]"
              />
            </div>
          )}

          {/* Action Label */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground">Action Button Label</Label>
            <Input
              value={actionLabel}
              onChange={e => setActionLabel(e.target.value)}
              placeholder="e.g. Open Orientation"
              className="h-10 text-xs rounded-xl min-h-[44px]"
            />
          </div>

          {/* Required Checkbox */}
          <div className="flex items-center space-x-2 pt-2">
            <Checkbox
              id="isRequired"
              checked={isRequired}
              onCheckedChange={checked => setIsRequired(Boolean(checked))}
            />
            <label
              htmlFor="isRequired"
              className="text-xs font-semibold text-foreground cursor-pointer select-none"
            >
              Required Step (Member cannot achieve 100% completion without this)
            </label>
          </div>

          <DialogFooter className="pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl font-bold text-xs w-full sm:w-auto min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/90 w-full sm:w-auto min-h-[44px] active:scale-[0.97]"
            >
              {isEditing ? 'Save Changes' : 'Add Step'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
