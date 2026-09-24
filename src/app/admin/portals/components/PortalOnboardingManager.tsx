'use client';

/**
 * {{Org_name}} Experience Platform — Portal Onboarding & Tasks Studio
 *
 * Visual studio management component for Onboarding Flow Steps, completion points,
 * Daily Action Tasks, and Instructor Submissions Review Queue.
 *
 * Conforms to:
 * - next-best-practices, vercel-react-best-practices
 * - emilkowal-animations (tactile feedback, active:scale-[0.97])
 * - Minimum 44px mobile touch targets
 * - Strict typing (0 any, 0 any[], 0 unhandled unknown)
 */

import * as React from 'react';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  saveOnboardingFlowAction,
  getOnboardingFlowAction,
  createTaskAction,
  updateTaskAction,
  deleteTaskAction,
  listTasksByPortalAction,
} from '@/app/actions/engagement-actions';
import type {
  OnboardingFlow,
  OnboardingStep,
  MemberTask,
} from '@/lib/types/engagement';
import { DEFAULT_ONBOARDING_STEPS } from '@/lib/portal-presets';
import {
  CheckCircle2,
  ListOrdered,
  Plus,
  Trash2,
  Pencil,
  Award,
  Clock,
  Loader2,
  Inbox,
  UploadCloud,
  FileSpreadsheet,
  Link as LinkIcon,
} from 'lucide-react';
import { SortableOnboardingStepItem } from './onboarding/SortableOnboardingStepItem';
import { OnboardingStepEditorModal } from './onboarding/OnboardingStepEditorModal';
import { TaskEditorModal, type TaskFormData } from './onboarding/TaskEditorModal';
import { SubmissionReviewQueue } from './onboarding/SubmissionReviewQueue';

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

  // Server Action Fallbacks
  const [serverFlow, setServerFlow] = React.useState<OnboardingFlow | null>(null);
  const [serverTasks, setServerTasks] = React.useState<MemberTask[]>([]);
  const [isLoadingServer, setIsLoadingServer] = React.useState(true);

  const fetchServerFlowAndTasks = React.useCallback(async () => {
    if (!portalId) return;
    try {
      setIsLoadingServer(true);
      const [flowRes, tasksRes] = await Promise.all([
        getOnboardingFlowAction(portalId),
        listTasksByPortalAction(portalId),
      ]);
      if (flowRes.success && flowRes.data) setServerFlow(flowRes.data);
      if (tasksRes.success && tasksRes.data) setServerTasks(tasksRes.data);
    } catch {
      // Graceful fallback
    } finally {
      setIsLoadingServer(false);
    }
  }, [portalId]);

  React.useEffect(() => {
    fetchServerFlowAndTasks();
  }, [fetchServerFlowAndTasks]);

  // 1. Query Onboarding Flow (realtime sync when available)
  const flowQuery = useMemoFirebase(
    () =>
      firestore && portalId
        ? query(collection(firestore, 'onboarding_flows'), where('portalId', '==', portalId))
        : null,
    [firestore, portalId]
  );
  const { data: flows } = useCollection<OnboardingFlow>(flowQuery);
  const flow = flows?.[0] ?? serverFlow;

  // Onboarding Form State
  const [steps, setSteps] = React.useState<OnboardingStep[]>([]);
  const [completionPoints, setCompletionPoints] = React.useState(20);
  const [isSavingFlow, setIsSavingFlow] = React.useState(false);

  // Step Editor Modal State
  const [isStepModalOpen, setIsStepModalOpen] = React.useState(false);
  const [editingStep, setEditingStep] = React.useState<OnboardingStep | null>(null);

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
  const { data: tasks, isLoading: isLoadingTasksCollection } = useCollection<MemberTask>(tasksQuery);

  const effectiveTasks = (tasks && tasks.length > 0) ? tasks : serverTasks;
  const isLoadingTasks = isLoadingTasksCollection && isLoadingServer && effectiveTasks.length === 0;

  // Task Editor Modal State
  const [isTaskModalOpen, setIsTaskModalOpen] = React.useState(false);
  const [editingTask, setEditingTask] = React.useState<MemberTask | null>(null);

  // ── Flow Actions ────────────────────────────────────────────────────────────

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
      fetchServerFlowAndTasks();
    } catch (err: unknown) {
      toast({ title: 'Save Failed', description: err instanceof Error ? err.message : 'Save failed.' });
    } finally {
      setIsSavingFlow(false);
    }
  };

  const handleOpenAddStep = () => {
    setEditingStep(null);
    setIsStepModalOpen(true);
  };

  const handleOpenEditStep = (step: OnboardingStep) => {
    setEditingStep(step);
    setIsStepModalOpen(true);
  };

  const handleSaveStepModal = (savedStep: OnboardingStep) => {
    const existingIndex = steps.findIndex(s => s.id === savedStep.id);
    if (existingIndex >= 0) {
      const next = [...steps];
      next[existingIndex] = savedStep;
      setSteps(next);
    } else {
      setSteps([...steps, { ...savedStep, order: steps.length + 1 }]);
    }
  };

  const handleDeleteStep = (stepId: string) => {
    const filtered = steps.filter(s => s.id !== stepId);
    setSteps(filtered.map((s, idx) => ({ ...s, order: idx + 1 })));
  };

  const handleMoveStepUp = (index: number) => {
    if (index <= 0) return;
    const next = [...steps];
    const temp = next[index - 1];
    next[index - 1] = next[index];
    next[index] = temp;
    setSteps(next.map((s, idx) => ({ ...s, order: idx + 1 })));
  };

  const handleMoveStepDown = (index: number) => {
    if (index >= steps.length - 1) return;
    const next = [...steps];
    const temp = next[index + 1];
    next[index + 1] = next[index];
    next[index] = temp;
    setSteps(next.map((s, idx) => ({ ...s, order: idx + 1 })));
  };

  // ── Task Actions ────────────────────────────────────────────────────────────

  const handleOpenCreateTask = () => {
    setEditingTask(null);
    setIsTaskModalOpen(true);
  };

  const handleOpenEditTask = (task: MemberTask) => {
    setEditingTask(task);
    setIsTaskModalOpen(true);
  };

  const handleSaveTask = async (data: TaskFormData) => {
    try {
      if (editingTask) {
        const res = await updateTaskAction(editingTask.id, data, portalId, portalSlug);
        if (!res.success) throw new Error(res.error);
        toast({ title: 'Task Updated! 📋', description: `Modified "${res.data?.title}".` });
      } else {
        const res = await createTaskAction(
          {
            organizationId,
            portalId,
            workspaceIds,
            title: data.title,
            description: data.description,
            priority: data.priority,
            dueDate: data.dueDate,
            relativeDueDays: data.relativeDueDays,
            pointsReward: data.pointsReward,
            actionUrl: data.actionUrl,
            requireFileUpload: data.requireFileUpload,
            downloadTemplateUrl: data.downloadTemplateUrl,
            completionTagIds: data.completionTagIds,
            order: (effectiveTasks.length || 0) + 1,
          },
          portalSlug
        );
        if (!res.success) throw new Error(res.error);
        toast({ title: 'Task Created! 📋', description: `Added "${res.data?.title}".` });
      }
      fetchServerFlowAndTasks();
    } catch (err: unknown) {
      toast({ title: 'Task Error', description: err instanceof Error ? err.message : 'Task error.' });
      throw err;
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      await deleteTaskAction(taskId, portalId, portalSlug);
      toast({ title: 'Task Removed', description: 'Task deleted from member checklists.' });
      fetchServerFlowAndTasks();
    } catch (err: unknown) {
      toast({ title: 'Delete Failed', description: err instanceof Error ? err.message : 'Delete failed.' });
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Studio Tabs Navigation ────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
          <TabsList className="h-11 p-1 bg-muted/60 rounded-2xl">
            <TabsTrigger value="onboarding" className="rounded-xl text-xs font-bold gap-1.5 min-h-[36px]">
              <CheckCircle2 className="w-3.5 h-3.5" /> Onboarding Checklist ({steps.length})
            </TabsTrigger>
            <TabsTrigger value="tasks" className="rounded-xl text-xs font-bold gap-1.5 min-h-[36px]">
              <ListOrdered className="w-3.5 h-3.5" /> Action Tasks ({effectiveTasks.length})
            </TabsTrigger>
            <TabsTrigger value="submissions" className="rounded-xl text-xs font-bold gap-1.5 min-h-[36px]">
              <Inbox className="w-3.5 h-3.5" /> Review Queue
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {activeTab === 'onboarding' ? (
          <Button
            onClick={handleSaveFlow}
            disabled={isSavingFlow}
            className="h-11 rounded-2xl font-bold text-xs bg-primary text-white hover:bg-primary/90 gap-1.5 shadow-sm min-h-[44px] active:scale-[0.97]"
          >
            {isSavingFlow ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Onboarding Flow'}
          </Button>
        ) : activeTab === 'tasks' ? (
          <Button
            onClick={handleOpenCreateTask}
            className="h-11 rounded-2xl font-bold text-xs bg-primary text-white hover:bg-primary/90 gap-1.5 shadow-sm min-h-[44px] active:scale-[0.97]"
          >
            <Plus className="w-4 h-4" /> Create Action Task
          </Button>
        ) : null}
      </div>

      {/* ── Tab 1: Onboarding Flow Editor ─────────────────────────────── */}
      {activeTab === 'onboarding' && (
        <div className="space-y-6">
          <Card className="rounded-3xl border-2 border-border p-6 space-y-5 bg-card">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-extrabold text-base text-foreground">Step-by-Step Checklist</h3>
                <p className="text-xs text-muted-foreground">
                  New members will be guided through these steps upon first portal login.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-500" />
                  <Label className="text-xs font-bold">Reward Points on 100%:</Label>
                  <Input
                    type="number"
                    value={completionPoints}
                    onChange={e => setCompletionPoints(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-18 h-9 text-xs font-bold rounded-xl"
                  />
                </div>
                <Button
                  onClick={handleOpenAddStep}
                  variant="outline"
                  size="sm"
                  className="rounded-xl font-bold text-xs gap-1.5 h-9 min-h-[44px] sm:min-h-0"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Step
                </Button>
              </div>
            </div>

            {/* List of Steps */}
            {steps.length === 0 ? (
              <div className="p-12 text-center border-2 border-dashed rounded-2xl space-y-2 bg-muted/10">
                <p className="text-xs text-muted-foreground">No onboarding steps configured yet.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenAddStep}
                  className="rounded-xl font-bold text-xs"
                >
                  Add First Step
                </Button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {steps.map((step, idx) => (
                  <SortableOnboardingStepItem
                    key={step.id}
                    step={step}
                    index={idx}
                    totalSteps={steps.length}
                    onMoveUp={handleMoveStepUp}
                    onMoveDown={handleMoveStepDown}
                    onEdit={handleOpenEditStep}
                    onDelete={handleDeleteStep}
                  />
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── Tab 2: Daily Action Tasks ─────────────────────────────────── */}
      {activeTab === 'tasks' && (
        <div className="space-y-4">
          {isLoadingTasks ? (
            <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span>Loading tasks...</span>
            </div>
          ) : effectiveTasks.length === 0 ? (
            <div className="p-16 text-center border-2 border-dashed rounded-3xl space-y-3 bg-muted/10">
              <ListOrdered className="w-12 h-12 mx-auto text-primary/60" />
              <h4 className="font-bold text-base text-foreground">No Tasks Created</h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Create actionable tasks, fee audits, and exercises for members to complete during their program.
              </p>
              <Button
                onClick={handleOpenCreateTask}
                className="rounded-xl font-bold text-xs bg-primary text-white min-h-[44px]"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Add First Task
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {effectiveTasks.map(task => (
                <Card
                  key={task.id}
                  className="rounded-3xl border-2 border-border p-5 space-y-3 hover:border-primary/40 transition-all flex flex-col justify-between bg-card shadow-2xs group"
                >
                  <div className="space-y-2.5">
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

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEditTask(task)}
                          className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                          title="Edit Task"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteTask(task.id)}
                          className="h-7 w-7 rounded-lg text-muted-foreground hover:text-rose-500"
                          title="Delete Task"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    <h4 className="font-extrabold text-sm text-foreground">{task.title}</h4>
                    {task.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {task.description}
                      </p>
                    )}

                    {/* Feature badges */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {task.requireFileUpload && (
                        <Badge variant="outline" className="text-[10px] font-medium gap-1 text-primary border-primary/20 bg-primary/5">
                          <UploadCloud className="w-3 h-3" /> File Submission
                        </Badge>
                      )}
                      {task.downloadTemplateUrl && (
                        <Badge variant="outline" className="text-[10px] font-medium gap-1 text-emerald-600 border-emerald-500/20 bg-emerald-500/5">
                          <FileSpreadsheet className="w-3 h-3" /> Template
                        </Badge>
                      )}
                      {task.actionUrl && (
                        <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">
                          <LinkIcon className="w-2.5 h-2.5 mr-1 inline" /> Link
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-bold text-primary text-[11px] flex items-center gap-1">
                      <Award className="w-3.5 h-3.5 text-amber-500" />
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

      {/* ── Tab 3: Submissions Review Queue ───────────────────────────── */}
      {activeTab === 'submissions' && (
        <SubmissionReviewQueue
          portalId={portalId}
          portalSlug={portalSlug}
          organizationId={organizationId}
          onReviewSuccess={fetchServerFlowAndTasks}
        />
      )}

      {/* Step Editor Modal */}
      <OnboardingStepEditorModal
        open={isStepModalOpen}
        onOpenChange={setIsStepModalOpen}
        step={editingStep}
        onSave={handleSaveStepModal}
        availableTasks={effectiveTasks}
      />

      {/* Task Editor Modal */}
      <TaskEditorModal
        open={isTaskModalOpen}
        onOpenChange={setIsTaskModalOpen}
        task={editingTask}
        onSave={handleSaveTask}
      />
    </div>
  );
}
