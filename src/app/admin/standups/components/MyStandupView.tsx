'use client';

/**
 * @fileOverview MyStandupView component (Phase 4B).
 *
 * Implements:
 * - 4-part daily standup flow:
 *   1. Accomplishments (Completed Work)
 *   2. Commitments (Planned Work)
 *   3. Blockers & Dependencies
 *   4. Help Needed / Discussion points
 * - Confidential Manager Note card (Strictly excluded from team overview)
 * - Task Picker Modal integration for fast task linking
 * - Debounced auto-save draft mechanism with live status indicator
 * - Touch targets >= 44px on all controls and Emil Kowalski active:scale-[0.97]
 */

import * as React from 'react';
import { format } from 'date-fns';
import {
  CheckCircle2,
  Calendar,
  AlertTriangle,
  HelpCircle,
  Lock,
  Plus,
  Trash2,
  ListPlus,
  Cloud,
  Loader2,
  Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { useToast } from '@/hooks/use-toast';
import {
  saveStandupDraftAction,
  submitStandupAction,
} from '@/lib/standup-server-actions';
import type {
  StandupSubmission,
  StandupWorkItem,
  StandupBlockerItem,
  BlockerSeverity,
  BlockerCategory,
  Task,
} from '@/lib/types';
import { StandupTaskPickerModal } from './StandupTaskPickerModal';

export interface MyStandupViewProps {
  workspaceId: string;
  initialDraft?: Partial<StandupSubmission> | null;
  tasks?: Task[];
  onSubmitted?: (submissionId: string) => void;
}

export function MyStandupView({
  workspaceId,
  initialDraft,
  tasks = [],
  onSubmitted,
}: MyStandupViewProps) {
  const { toast } = useToast();
  const todayStr = React.useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  const [date] = React.useState<string>(initialDraft?.date || todayStr);
  const [completedWork, setCompletedWork] = React.useState<StandupWorkItem[]>(
    initialDraft?.completedWork || []
  );
  const [plannedWork, setPlannedWork] = React.useState<StandupWorkItem[]>(
    initialDraft?.plannedWork || []
  );
  const [blockers, setBlockers] = React.useState<StandupBlockerItem[]>(
    initialDraft?.blockers || []
  );
  const [helpNeeded, setHelpNeeded] = React.useState<string>(
    initialDraft?.helpNeeded || ''
  );
  const [privateManagerNote, setPrivateManagerNote] = React.useState<string>(
    initialDraft?.privateManagerNote || ''
  );

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSavingDraft, setIsSavingDraft] = React.useState(false);
  const [lastSavedTime, setLastSavedTime] = React.useState<string | null>(null);

  // Task picker state
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [pickerTarget, setPickerTarget] = React.useState<'completed' | 'planned'>('completed');

  // Inline adder state
  const [newCompletedText, setNewCompletedText] = React.useState('');
  const [newPlannedText, setNewPlannedText] = React.useState('');

  // Blocker form state
  const [blockerSummary, setBlockerSummary] = React.useState('');
  const [blockerSeverity, setBlockerSeverity] = React.useState<BlockerSeverity>('medium');
  const [blockerCategory, setBlockerCategory] = React.useState<BlockerCategory>('technical');
  const [blockerAction, setBlockerAction] = React.useState('');

  // Auto-save debounce effect
  const isInitialMount = React.useRef(true);
  React.useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSavingDraft(true);
        const res = await saveStandupDraftAction(workspaceId, {
          date,
          completedWork,
          plannedWork,
          blockers,
          helpNeeded,
          privateManagerNote,
        });
        if (res.success) {
          setLastSavedTime(
            new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          );
        }
      } catch (err: unknown) {
        console.warn('[STANDUP] Auto-save draft failed:', err);
      } finally {
        setIsSavingDraft(false);
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [workspaceId, date, completedWork, plannedWork, blockers, helpNeeded, privateManagerNote]);

  const handleAddCompleted = () => {
    if (!newCompletedText.trim()) return;
    const newItem: StandupWorkItem = {
      id: `comp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'commitment',
      title: newCompletedText.trim(),
    };
    setCompletedWork((prev) => [...prev, newItem]);
    setNewCompletedText('');
  };

  const handleAddPlanned = () => {
    if (!newPlannedText.trim()) return;
    const newItem: StandupWorkItem = {
      id: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'commitment',
      title: newPlannedText.trim(),
    };
    setPlannedWork((prev) => [...prev, newItem]);
    setNewPlannedText('');
  };

  const handleAddBlocker = () => {
    if (!blockerSummary.trim()) return;
    const newBlocker: StandupBlockerItem = {
      id: `blk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      summary: blockerSummary.trim(),
      category: blockerCategory,
      severity: blockerSeverity,
      neededAction: blockerAction.trim() || undefined,
    };
    setBlockers((prev) => [...prev, newBlocker]);
    setBlockerSummary('');
    setBlockerAction('');
    setBlockerSeverity('medium');
    setBlockerCategory('technical');
  };

  const handleTaskPicked = (task: Task) => {
    const item: StandupWorkItem = {
      id: `task_${task.id}`,
      type: 'task',
      title: task.title,
      taskId: task.id,
      taskStatus: task.status,
    };
    if (pickerTarget === 'completed') {
      setCompletedWork((prev) => [...prev, item]);
    } else {
      setPlannedWork((prev) => [...prev, item]);
    }
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      const idempotencyKey = crypto.randomUUID();
      const res = await submitStandupAction(workspaceId, {
        date,
        completedWork,
        plannedWork,
        blockers,
        helpNeeded: helpNeeded.trim() || undefined,
        privateManagerNote: privateManagerNote.trim() || undefined,
        idempotencyKey,
      });

      if (!res.success) {
        toast({
          title: 'Submission Failed',
          description: res.error || 'Failed to submit daily standup.',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Standup Submitted',
        description: 'Your daily update has been published to the team overview.',
        actionConfig: {
          path: '/admin/standups?tab=team',
          label: 'View Team',
        },
      });

      if (res.id && onSubmitted) {
        onSubmitted(res.id);
      }
    } catch (err: unknown) {
      console.error('[STANDUP] Submit error:', err);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred while submitting.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12 font-figtree">
      {/* Top Banner / Date & Save status */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl border border-border/80 bg-card shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">
              {format(new Date(date + 'T12:00:00'), 'EEEE, MMMM d, yyyy')}
            </h2>
            <p className="text-xs text-muted-foreground">Daily Standup Update</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground self-end sm:self-center">
          {isSavingDraft ? (
            <span className="inline-flex items-center gap-1.5 text-primary">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Saving draft...
            </span>
          ) : lastSavedTime ? (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Cloud className="h-4 w-4 text-emerald-600" />
              Draft saved at {lastSavedTime}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <Cloud className="h-4 w-4 text-muted-foreground/60" />
              Auto-save enabled
            </span>
          )}
        </div>
      </div>

      {/* SECTION 1: Completed Work */}
      <div className="p-5 rounded-2xl border border-border/80 bg-card shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                What did you accomplish since yesterday?
              </h3>
              <p className="text-xs text-muted-foreground">
                Completed tasks, delivered features, or milestones hit
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setPickerTarget('completed');
              setPickerOpen(true);
            }}
            className="rounded-xl h-11 min-h-[44px] px-3.5 text-xs font-bold active:scale-[0.97]"
          >
            <ListPlus className="h-4 w-4 mr-1.5 text-primary" />
            Link Task
          </Button>
        </div>

        {/* Existing Items */}
        <div className="space-y-2">
          {completedWork.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-2 p-3 rounded-xl border border-border/60 bg-muted/20"
            >
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="text-sm text-foreground truncate">{item.title}</span>
                {item.taskId && (
                  <Badge variant="secondary" className="text-[10px] py-0 px-1.5 shrink-0">
                    Linked
                  </Badge>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setCompletedWork((prev) => prev.filter((i) => i.id !== item.id))
                }
                className="rounded-xl h-11 min-h-[44px] w-11 p-0 text-muted-foreground hover:text-destructive active:scale-[0.97]"
                aria-label="Remove item"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        {/* Inline Add */}
        <div className="flex items-center gap-2 pt-1">
          <Input
            value={newCompletedText}
            onChange={(e) => setNewCompletedText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddCompleted();
              }
            }}
            placeholder="Add completed achievement or task..."
            className="h-11 min-h-[44px] rounded-xl text-sm"
          />
          <Button
            type="button"
            onClick={handleAddCompleted}
            className="rounded-xl h-11 min-h-[44px] px-4 text-xs font-bold active:scale-[0.97] shrink-0"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Item
          </Button>
        </div>
      </div>

      {/* SECTION 2: Planned Work */}
      <div className="p-5 rounded-2xl border border-border/80 bg-card shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                What are you committing to today?
              </h3>
              <p className="text-xs text-muted-foreground">
                Focus priorities and targeted deliverables for today
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setPickerTarget('planned');
              setPickerOpen(true);
            }}
            className="rounded-xl h-11 min-h-[44px] px-3.5 text-xs font-bold active:scale-[0.97]"
          >
            <ListPlus className="h-4 w-4 mr-1.5 text-primary" />
            Link Task
          </Button>
        </div>

        {/* Existing Items */}
        <div className="space-y-2">
          {plannedWork.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-2 p-3 rounded-xl border border-border/60 bg-muted/20"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                <span className="text-sm text-foreground truncate">{item.title}</span>
                {item.taskId && (
                  <Badge variant="secondary" className="text-[10px] py-0 px-1.5 shrink-0">
                    Linked
                  </Badge>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setPlannedWork((prev) => prev.filter((i) => i.id !== item.id))
                }
                className="rounded-xl h-11 min-h-[44px] w-11 p-0 text-muted-foreground hover:text-destructive active:scale-[0.97]"
                aria-label="Remove item"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        {/* Inline Add */}
        <div className="flex items-center gap-2 pt-1">
          <Input
            value={newPlannedText}
            onChange={(e) => setNewPlannedText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddPlanned();
              }
            }}
            placeholder="Add today's planned commitment..."
            className="h-11 min-h-[44px] rounded-xl text-sm"
          />
          <Button
            type="button"
            onClick={handleAddPlanned}
            className="rounded-xl h-11 min-h-[44px] px-4 text-xs font-bold active:scale-[0.97] shrink-0"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Item
          </Button>
        </div>
      </div>

      {/* SECTION 3: Blockers */}
      <div className="p-5 rounded-2xl border border-border/80 bg-card shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-600">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">
              Any blockers or dependencies?
            </h3>
            <p className="text-xs text-muted-foreground">
              Obstacles requiring leadership unblocking, external input, or access
            </p>
          </div>
        </div>

        {/* Existing Blockers */}
        <div className="space-y-2">
          {blockers.map((blk) => (
            <div
              key={blk.id}
              className="flex items-start justify-between gap-3 p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/5"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-bold uppercase tracking-wider ${
                      blk.severity === 'critical'
                        ? 'border-rose-600 text-rose-600'
                        : blk.severity === 'high'
                        ? 'border-amber-600 text-amber-600'
                        : 'border-slate-500 text-slate-500'
                    }`}
                  >
                    {blk.severity}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px] capitalize">
                    {blk.category}
                  </Badge>
                </div>
                <p className="text-sm font-semibold text-foreground">{blk.summary}</p>
                {blk.neededAction && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Action needed:</span>{' '}
                    {blk.neededAction}
                  </p>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setBlockers((prev) => prev.filter((b) => b.id !== blk.id))}
                className="rounded-xl h-11 min-h-[44px] w-11 p-0 text-muted-foreground hover:text-destructive active:scale-[0.97] shrink-0"
                aria-label="Remove blocker"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        {/* Add Blocker Box */}
        <div className="p-4 rounded-xl border border-border/70 bg-muted/15 space-y-3">
          <Input
            value={blockerSummary}
            onChange={(e) => setBlockerSummary(e.target.value)}
            placeholder="Describe what is blocking you..."
            className="h-11 min-h-[44px] rounded-xl text-sm"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              value={blockerSeverity}
              onValueChange={(val) => setBlockerSeverity(val as BlockerSeverity)}
            >
              <SelectTrigger className="h-11 min-h-[44px] rounded-xl text-xs">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low Severity</SelectItem>
                <SelectItem value="medium">Medium Severity</SelectItem>
                <SelectItem value="high">High Severity</SelectItem>
                <SelectItem value="critical">Critical (Stop Ship)</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={blockerCategory}
              onValueChange={(val) => setBlockerCategory(val as BlockerCategory)}
            >
              <SelectTrigger className="h-11 min-h-[44px] rounded-xl text-xs">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="technical">Technical / Bug</SelectItem>
                <SelectItem value="external">External Dependency</SelectItem>
                <SelectItem value="access">Permissions / Access</SelectItem>
                <SelectItem value="review">Waiting on Review</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Input
            value={blockerAction}
            onChange={(e) => setBlockerAction(e.target.value)}
            placeholder="Recommended unblocking action (e.g., approval from security lead)..."
            className="h-11 min-h-[44px] rounded-xl text-xs"
          />

          <Button
            type="button"
            variant="outline"
            onClick={handleAddBlocker}
            className="rounded-xl h-11 min-h-[44px] px-4 text-xs font-bold active:scale-[0.97] w-full sm:w-auto"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add Blocker
          </Button>
        </div>
      </div>

      {/* SECTION 4: Help Needed */}
      <div className="p-5 rounded-2xl border border-border/80 bg-card shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600">
            <HelpCircle className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Help needed / Discussion points</h3>
            <p className="text-xs text-muted-foreground">
              Anything you would like feedback or pairing on today
            </p>
          </div>
        </div>
        <Textarea
          value={helpNeeded}
          onChange={(e) => setHelpNeeded(e.target.value)}
          placeholder="Need input, review, or pairing on..."
          className="min-h-[80px] rounded-xl text-sm"
        />
      </div>

      {/* SECTION 5: Private Manager Note */}
      <div className="p-5 rounded-2xl border border-amber-500/30 bg-amber-500/5 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-700 dark:text-amber-400">
              <Lock className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                Private Manager Note
              </h3>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
                Visible strictly to your manager and organization administrators
              </p>
            </div>
          </div>
          <CardInfoTooltip text="This note is completely omitted from team overview and peer feeds. Use it for workload alerts, personal updates, or private context." />
        </div>
        <Textarea
          value={privateManagerNote}
          onChange={(e) => setPrivateManagerNote(e.target.value)}
          placeholder="Confidential context for your manager (e.g., workload pressure, personal appointments, upcoming PTO)..."
          className="min-h-[80px] rounded-xl text-sm bg-background/80 border-amber-500/30 focus-visible:ring-amber-500/40"
        />
      </div>

      {/* Submission Actions */}
      <div className="flex items-center justify-end gap-3 pt-4">
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="rounded-xl h-11 min-h-[44px] px-8 text-sm font-bold active:scale-[0.97] bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Submit Standup
            </>
          )}
        </Button>
      </div>

      {/* Task Picker Modal */}
      <StandupTaskPickerModal
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        tasks={tasks}
        onSelectTask={handleTaskPicked}
        title={pickerTarget === 'completed' ? 'Link Completed Task' : 'Link Planned Task'}
      />
    </div>
  );
}
