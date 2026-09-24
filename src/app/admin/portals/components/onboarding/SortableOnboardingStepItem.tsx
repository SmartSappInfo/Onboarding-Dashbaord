'use client';

/**
 * {{Org_name}} Experience Platform — Sortable Onboarding Step Item
 *
 * Visual row component for an onboarding step with accessible reordering,
 * verification badges, tactile action buttons, and touch-target compliance.
 *
 * Conforms to:
 * - next-best-practices, vercel-react-best-practices
 * - emilkowal-animations (tactile feedback, active:scale-[0.97])
 * - Minimum 44px mobile touch targets
 * - Strict typing (0 any, 0 any[], 0 unhandled unknown)
 */

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Play,
  User,
  BookOpen,
  MessageSquare,
  CheckSquare,
  Calendar,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  Pencil,
  Trash2,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import type { OnboardingStep, StepType } from '@/lib/types/engagement';

interface SortableOnboardingStepItemProps {
  step: OnboardingStep;
  index: number;
  totalSteps: number;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onEdit: (step: OnboardingStep) => void;
  onDelete: (stepId: string) => void;
}

const STEP_TYPE_META: Record<
  StepType,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  welcome_video: { label: 'Orientation Video', icon: Play, color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  complete_profile: { label: 'Profile Setup', icon: User, color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  start_course: { label: 'Course Lesson', icon: BookOpen, color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' },
  community_post: { label: 'Community Post', icon: MessageSquare, color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  action_task: { label: 'Action Task', icon: CheckSquare, color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
  book_meeting: { label: 'Book Session', icon: Calendar, color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
  custom_url: { label: 'Custom Link', icon: ExternalLink, color: 'bg-slate-500/10 text-slate-600 dark:text-slate-400' },
};

export function SortableOnboardingStepItem({
  step,
  index,
  totalSteps,
  onMoveUp,
  onMoveDown,
  onEdit,
  onDelete,
}: SortableOnboardingStepItemProps) {
  const meta = STEP_TYPE_META[step.type] || STEP_TYPE_META.custom_url;
  const IconComponent = meta.icon;

  const isFirst = index === 0;
  const isLast = index === totalSteps - 1;

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl border border-border/80 bg-card/60 hover:bg-card hover:border-primary/40 transition-all duration-200 shadow-2xs group">
      {/* Step Index & Details */}
      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
        {/* Step Number Bubble */}
        <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary font-black text-xs flex items-center justify-center shrink-0">
          {index + 1}
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-bold text-sm text-foreground truncate">{step.title}</h4>
            <Badge variant="secondary" className={`text-[10px] font-bold gap-1 px-2 py-0.5 rounded-lg ${meta.color}`}>
              <IconComponent className="w-3 h-3" />
              {meta.label}
            </Badge>

            {step.isRequired && (
              <Badge variant="outline" className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-wider">
                Required
              </Badge>
            )}

            {step.autoVerificationType && step.autoVerificationType !== 'manual_confirm' && (
              <Badge variant="secondary" className="text-[10px] font-medium bg-muted/60 text-muted-foreground gap-1">
                <Sparkles className="w-2.5 h-2.5 text-amber-500" />
                {step.autoVerificationType === 'auto_watch' && 'Auto on Video Watch'}
                {step.autoVerificationType === 'has_profile' && 'Auto on Profile Saved'}
                {step.autoVerificationType === 'has_started_lesson' && 'Auto on Lesson Start'}
                {step.autoVerificationType === 'has_community_post' && 'Auto on Community Post'}
                {step.autoVerificationType === 'has_task_submission' && 'Auto on Task Submission'}
              </Badge>
            )}
          </div>

          {step.description && (
            <p className="text-xs text-muted-foreground line-clamp-1 leading-relaxed">
              {step.description}
            </p>
          )}

          {step.actionLabel && (
            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-0.5">
              <span className="font-semibold text-foreground/80">Button:</span>
              <span className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-mono text-foreground/90">
                {step.actionLabel}
              </span>
              {step.targetUrl && (
                <span className="truncate text-muted-foreground font-mono text-[10px] max-w-[200px]">
                  ({step.targetUrl})
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex items-center justify-end gap-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
        {/* Re-order Up */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={isFirst}
          onClick={() => onMoveUp(index)}
          title="Move Step Up"
          className="h-9 w-9 rounded-xl min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 text-muted-foreground hover:text-foreground active:scale-[0.95] disabled:opacity-30"
          aria-label={`Move ${step.title} up`}
        >
          <ChevronUp className="w-4 h-4" />
        </Button>

        {/* Re-order Down */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={isLast}
          onClick={() => onMoveDown(index)}
          title="Move Step Down"
          className="h-9 w-9 rounded-xl min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 text-muted-foreground hover:text-foreground active:scale-[0.95] disabled:opacity-30"
          aria-label={`Move ${step.title} down`}
        >
          <ChevronDown className="w-4 h-4" />
        </Button>

        {/* Edit Step */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onEdit(step)}
          title="Edit Step Configuration"
          className="h-9 w-9 rounded-xl min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 text-muted-foreground hover:text-primary active:scale-[0.95]"
          aria-label={`Edit ${step.title}`}
        >
          <Pencil className="w-4 h-4" />
        </Button>

        {/* Delete Step */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onDelete(step.id)}
          title="Delete Step"
          className="h-9 w-9 rounded-xl min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 text-muted-foreground hover:text-destructive active:scale-[0.95]"
          aria-label={`Delete ${step.title}`}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
