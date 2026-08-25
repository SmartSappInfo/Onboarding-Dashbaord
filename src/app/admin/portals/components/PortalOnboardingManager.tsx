'use client';

/**
 * {{Org_name}} Experience Platform — Portal Onboarding & Tasks Studio
 *
 * Visual studio management component for Onboarding Flow Steps, completion points,
 * and Daily Action Tasks.
 */

import * as React from 'react';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  saveOnboardingFlowAction,
  createTaskAction,
  deleteTaskAction,
} from '@/app/actions/engagement-actions';
import type {
  OnboardingFlow,
  OnboardingStep,
  MemberTask,
  StepType,
  TaskPriority,
} from '@/lib/types/engagement';
import { DEFAULT_ONBOARDING_STEPS } from '@/lib/portal-presets';
import {
  CheckCircle2,
  ListOrdered,
  Plus,
  Trash2,
  Sparkles,
  Award,
  Clock,
  Layers,
  ArrowRight,
  ExternalLink,
  Loader2,
  Calendar,
} from 'lucide-react';

interface PortalOnboardingManagerProps {
  portalId: string;
  portalSlug: string;
  organizationId: string;
  workspaceIds?: string[];
}

export function PortalOnboardingManager({
  portalId,
  portalSlug,
  organizationId,
  workspaceIds = ['onboarding'],
}: PortalOnboardingManagerProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = React.useState('onboarding');

  // 1. Query Onboarding Flow
  const flowQuery = useMemoFirebase(
    () =>
      firestore && portalId
        ? query(collection(firestore, 'onboarding_flows'), where('portalId', '==', portalId))
        : null,
    [firestore, portalId]
  );
  const { data: flows, isLoading: isLoadingFlow } = useCollection<OnboardingFlow>(flowQuery);
  const flow = flows?.[0] ?? null;

  // Onboarding Form State
  const [steps, setSteps] = React.useState<OnboardingStep[]>([]);
  const [completionPoints, setCompletionPoints] = React.useState(20);
  const [isSavingFlow, setIsSavingFlow] = React.useState(false);

  React.useEffect(() => {
    if (flow) {
      setSteps(flow.steps || []);
      setCompletionPoints(flow.completionPoints || 20);
    } else {
      setSteps(DEFAULT_ONBOARDING_STEPS);
      setCompletionPoints(20);
    }
  }, [flow]);

  // 2. Query Tasks
  const tasksQuery = useMemoFirebase(
    () =>
      firestore && portalId
        ? query(
            collection(firestore, 'member_tasks'),
            where('portalId', '==', portalId),
            where('isArchived', '==', false),
            orderBy('order', 'asc')
          )
        : null,
    [firestore, portalId]
  );
  const { data: tasks, isLoading: isLoadingTasks } = useCollection<MemberTask>(tasksQuery);

  // Create Task Modal State
  const [isCreateTaskOpen, setIsCreateTaskOpen] = React.useState(false);
  const [taskTitle, setTaskTitle] = React.useState('');
  const [taskDescription, setTaskDescription] = React.useState('');
  const [taskPriority, setTaskPriority] = React.useState<TaskPriority>('medium');
  const [taskDueDate, setTaskDueDate] = React.useState('');
  const [taskPoints, setTaskPoints] = React.useState(15);
  const [taskActionUrl, setTaskActionUrl] = React.useState('');
  const [isSubmittingTask, setIsSubmittingTask] = React.useState(false);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleSaveFlow = async () => {
    setIsSavingFlow(true);
    try {
      const res = await saveOnboardingFlowAction(
        {
          organizationId,
          portalId,
          workspaceIds,
          title: 'Member Onboarding Program',
          description: 'Step-by-step orientation checklist for new members.',
          steps,
          isEnabled: true,
          completionPoints,
        },
        portalSlug
      );

      if (!res.success) throw new Error(res.error);
      toast({ title: 'Onboarding Flow Saved! ✨', description: 'Checklist updated for all members.' });
    } catch (err: any) {
      toast({ title: 'Save Failed', description: err?.message });
    } finally {
      setIsSavingFlow(false);
    }
  };

  const handleAddStep = () => {
    const newStep: OnboardingStep = {
      id: `step_${Date.now()}`,
      title: 'New Action Step',
      description: 'Step instructions...',
      type: 'custom_url',
      order: steps.length + 1,
      isRequired: true,
    };
    setSteps([...steps, newStep]);
  };

  const handleUpdateStep = (idx: number, updates: Partial<OnboardingStep>) => {
    const next = [...steps];
    next[idx] = { ...next[idx], ...updates };
    setSteps(next);
  };

  const handleDeleteStep = (idx: number) => {
    setSteps(steps.filter((_, i) => i !== idx));
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    setIsSubmittingTask(true);
    try {
      const res = await createTaskAction(
        {
          organizationId,
          portalId,
          workspaceIds,
          title: taskTitle.trim(),
          description: taskDescription.trim(),
          priority: taskPriority,
          dueDate: taskDueDate || undefined,
          pointsReward: taskPoints,
          actionUrl: taskActionUrl.trim() || undefined,
          order: (tasks?.length || 0) + 1,
        },
        portalSlug
      );

      if (!res.success) throw new Error(res.error);
      toast({ title: 'Task Created! 📋', description: `Added "${res.data?.title}".` });
      setTaskTitle('');
      setTaskDescription('');
      setTaskActionUrl('');
      setTaskDueDate('');
      setIsCreateTaskOpen(false);
    } catch (err: any) {
      toast({ title: 'Task Error', description: err?.message });
    } finally {
      setIsSubmittingTask(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      await deleteTaskAction(taskId, portalId, portalSlug);
      toast({ title: 'Task Removed', description: 'Task deleted from member checklists.' });
    } catch (err: any) {
      toast({ title: 'Delete Failed', description: err?.message });
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Tabs ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
          <TabsList className="h-10 p-1 bg-muted/60 rounded-2xl">
            <TabsTrigger value="onboarding" className="rounded-xl text-xs font-bold gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> Onboarding Checklist ({steps.length} Steps)
            </TabsTrigger>
            <TabsTrigger value="tasks" className="rounded-xl text-xs font-bold gap-1.5">
              <ListOrdered className="w-3.5 h-3.5" /> Daily Action Tasks ({tasks?.length || 0})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {activeTab === 'onboarding' ? (
          <Button
            onClick={handleSaveFlow}
            disabled={isSavingFlow}
            className="h-10 rounded-2xl font-bold text-xs bg-primary text-white hover:bg-primary/90 gap-1.5 shadow-sm"
          >
            {isSavingFlow ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Onboarding Flow'}
          </Button>
        ) : (
          <Button
            onClick={() => setIsCreateTaskOpen(true)}
            className="h-10 rounded-2xl font-bold text-xs bg-primary text-white hover:bg-primary/90 gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" /> Create Daily Task
          </Button>
        )}
      </div>

      {/* ── Tab 1: Onboarding Flow Builder ────────────────────────────── */}
      {activeTab === 'onboarding' && (
        <div className="space-y-6">
          <Card className="rounded-3xl border-2 border-border p-6 space-y-4 bg-card shadow-xs">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h4 className="font-bold text-sm text-foreground">Guided Onboarding Sequence</h4>
                <p className="text-xs text-muted-foreground">
                  New members see this checklist when they join to guide them toward high activation.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground">Completion Reward:</span>
                <Input
                  type="number"
                  value={completionPoints}
                  onChange={e => setCompletionPoints(Number(e.target.value) || 0)}
                  className="w-20 h-8 text-xs font-bold text-center rounded-xl"
                />
                <span className="text-xs font-bold text-primary">pts</span>
              </div>
            </div>

            <div className="space-y-3">
              {steps.map((step, idx) => (
                <div
                  key={step.id || idx}
                  className="p-4 rounded-2xl border-2 border-border bg-muted/20 space-y-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary font-bold text-xs flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <Input
                        value={step.title}
                        onChange={e => handleUpdateStep(idx, { title: e.target.value })}
                        className="h-8 text-xs font-bold rounded-xl max-w-sm"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Select
                        value={step.type}
                        onValueChange={(val: StepType) => handleUpdateStep(idx, { type: val })}
                      >
                        <SelectTrigger className="h-8 text-[11px] font-semibold rounded-xl w-36 capitalize">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="welcome_video">🎥 Welcome Video</SelectItem>
                          <SelectItem value="complete_profile">👤 Profile Setup</SelectItem>
                          <SelectItem value="start_course">🎓 First Course</SelectItem>
                          <SelectItem value="community_post">💬 Community Post</SelectItem>
                          <SelectItem value="book_meeting">📅 Book Meeting</SelectItem>
                          <SelectItem value="custom_url">🔗 Custom Link</SelectItem>
                        </SelectContent>
                      </Select>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteStep(idx)}
                        className="h-8 w-8 rounded-xl text-muted-foreground hover:text-rose-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  <Input
                    placeholder="Short description / guidance for member..."
                    value={step.description || ''}
                    onChange={e => handleUpdateStep(idx, { description: e.target.value })}
                    className="h-8 text-xs rounded-xl"
                  />
                </div>
              ))}
            </div>

            <Button
              variant="outline"
              onClick={handleAddStep}
              className="w-full rounded-2xl font-bold text-xs gap-1.5 h-10 border-dashed"
            >
              <Plus className="w-3.5 h-3.5" /> Add Another Onboarding Step
            </Button>
          </Card>
        </div>
      )}

      {/* ── Tab 2: Daily Action Tasks ─────────────────────────────────── */}
      {activeTab === 'tasks' && (
        <div className="space-y-4">
          {isLoadingTasks ? (
            <div className="p-12 text-center text-xs text-muted-foreground">Loading tasks...</div>
          ) : (!tasks || tasks.length === 0) ? (
            <div className="p-16 text-center border-2 border-dashed rounded-3xl space-y-3 bg-muted/10">
              <ListOrdered className="w-12 h-12 mx-auto text-primary/60" />
              <h4 className="font-bold text-base text-foreground">No Daily Tasks Created</h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Create actionable bursary tasks for members to complete during their program.
              </p>
              <Button
                onClick={() => setIsCreateTaskOpen(true)}
                className="rounded-xl font-bold text-xs bg-primary text-white"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Add First Task
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {tasks.map(task => (
                <Card
                  key={task.id}
                  className="rounded-3xl border-2 border-border p-5 space-y-3 hover:border-primary/40 transition-all flex flex-col justify-between bg-card shadow-xs"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <Badge
                        variant="secondary"
                        className={`text-[9px] font-bold uppercase capitalize ${
                          task.priority === 'urgent'
                            ? 'bg-rose-500/10 text-rose-600'
                            : task.priority === 'high'
                            ? 'bg-amber-500/10 text-amber-600'
                            : ''
                        }`}
                      >
                        {task.priority} Priority
                      </Badge>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteTask(task.id)}
                        className="h-7 w-7 rounded-xl text-muted-foreground hover:text-rose-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    <h4 className="font-extrabold text-sm text-foreground">{task.title}</h4>
                    {task.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {task.description}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-bold text-primary text-[11px]">
                      +{task.pointsReward} Points
                    </span>
                    {task.dueDate && (
                      <span className="flex items-center gap-1 text-[10px]">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        {new Date(task.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Create Task Modal ─────────────────────────────────────────── */}
      <Dialog open={isCreateTaskOpen} onOpenChange={setIsCreateTaskOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 sm:p-8 space-y-4">
          <DialogHeader className="pb-3 border-b border-border">
            <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
              <ListOrdered className="w-4 h-4" /> Task Creator Studio
            </div>
            <DialogTitle className="text-xl font-bold">Create Action Task</DialogTitle>
            <DialogDescription className="text-xs">
              Assign practical tasks and fee collection drills to members.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateTask} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Task Title</Label>
              <Input
                placeholder="e.g. Audit Term 1 Overdue Fee Accounts"
                value={taskTitle}
                onChange={e => setTaskTitle(e.target.value)}
                className="h-10 text-xs rounded-xl font-bold"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Description & Action Instructions</Label>
              <Textarea
                placeholder="What should the bursar or student execute?"
                value={taskDescription}
                onChange={e => setTaskDescription(e.target.value)}
                rows={3}
                className="text-xs rounded-xl resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Priority</Label>
                <Select value={taskPriority} onValueChange={(val: TaskPriority) => setTaskPriority(val)}>
                  <SelectTrigger className="h-10 text-xs rounded-xl capitalize">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="low">🟢 Low Priority</SelectItem>
                    <SelectItem value="medium">🟡 Medium Priority</SelectItem>
                    <SelectItem value="high">🟠 High Priority</SelectItem>
                    <SelectItem value="urgent">🔴 Urgent Action</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Points Reward</Label>
                <Input
                  type="number"
                  value={taskPoints}
                  onChange={e => setTaskPoints(Number(e.target.value) || 0)}
                  className="h-10 text-xs rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Action Link / Tool URL (Optional)</Label>
              <Input
                placeholder="e.g. /portal/academy/learn/invoicing-fee-recovery"
                value={taskActionUrl}
                onChange={e => setTaskActionUrl(e.target.value)}
                className="h-10 text-xs rounded-xl"
              />
            </div>

            <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateTaskOpen(false)}
                className="rounded-xl font-bold text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmittingTask}
                className="rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/90 gap-1.5 shadow-sm"
              >
                {isSubmittingTask ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Task'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
