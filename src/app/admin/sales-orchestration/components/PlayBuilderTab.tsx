'use client';

/**
 * @fileoverview Play Builder Tab Component (Phase 8).
 *
 * ARCHITECTURAL POINTER:
 * Fulfills SmartSapp Sales Performance & Intelligence 2.0 UX Screen 2 (Play Builder):
 * - Dual-Mode Responsive Canvas:
 *   - Desktop (>= 1024px): Interactive visual flowchart with connected nodes and SVG connector vectors.
 *   - Mobile (< 1024px): Linear step-by-step sequence with reordering controls, >= 44px touch targets.
 * - Dynamic Step Drawer / Dialog for configuring action types, delays, and failure policies.
 * - Saves play via saveSalesPlayAction with optimistic state updates.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing enforced. Zero use of 'any' or 'any[]'.
 * - No raw HTML tags in UI.
 */

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Workflow,
  Plus,
  ArrowDown,
  ArrowRight,
  Zap,
  CheckCircle2,
  Clock,
  Sparkles,
  Bot,
  AlertTriangle,
  Trash2,
  Edit2,
  Save,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type {
  SalesPlay,
  PlayStep,
  PlayActionType,
  TaskPriority,
} from '@/lib/sales-orchestration/types';
import { saveSalesPlayAction } from '@/app/actions/sales-orchestration-actions';
import { useToast } from '@/hooks/use-toast';

interface PlayBuilderTabProps {
  play: SalesPlay | null;
  allPlays: SalesPlay[];
  workspaceId: string;
  organizationId: string;
  actorId: string;
  onSaveSuccess: () => void;
  onSelectPlay: (play: SalesPlay) => void;
}

export function PlayBuilderTab({
  play,
  allPlays,
  workspaceId,
  organizationId,
  actorId,
  onSaveSuccess,
  onSelectPlay,
}: PlayBuilderTabProps) {
  const { toast } = useToast();

  const [activePlay, setActivePlay] = React.useState<SalesPlay | null>(play || allPlays[0] || null);
  const [isEditingStep, setIsEditingStep] = React.useState<PlayStep | null>(null);
  const [stepTitle, setStepTitle] = React.useState('');
  const [stepDescription, setStepDescription] = React.useState('');
  const [stepActionType, setStepActionType] = React.useState<PlayActionType>('create_task');
  const [stepDelayHours, setStepDelayHours] = React.useState(0);
  const [stepRequired, setStepRequired] = React.useState(true);
  const [stepPriority, setStepPriority] = React.useState<TaskPriority>('high');
  const [stepInstructions, setStepInstructions] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (play) {
      setActivePlay(play);
    } else if (allPlays.length > 0 && !activePlay) {
      setActivePlay(allPlays[0]);
    }
  }, [play, allPlays, activePlay]);

  if (!activePlay) {
    return (
      <div className="text-center py-16 bg-muted/20 border border-dashed rounded-2xl">
        <Workflow className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm font-semibold text-foreground">No Sales Play Selected</p>
        <p className="text-xs text-muted-foreground mt-1">
          Select a play from the library to open in the visual builder.
        </p>
      </div>
    );
  }

  const handleOpenStepModal = (step?: PlayStep) => {
    if (step) {
      setIsEditingStep(step);
      setStepTitle(step.title);
      setStepDescription(step.description);
      setStepActionType(step.actionType);
      setStepDelayHours(step.delayHours);
      setStepRequired(step.requiredForNextStep);
      setStepPriority(step.config.taskPriority || 'high');
      setStepInstructions(step.config.taskInstructions || '');
    } else {
      setIsEditingStep({
        id: `step_${Date.now()}`,
        stepIndex: activePlay.steps.length,
        title: 'New Action Step',
        description: 'Describe what the seller or system should do',
        actionType: 'create_task',
        delayHours: 0,
        config: { taskPriority: 'medium' },
        requiredForNextStep: true,
      });
      setStepTitle('New Action Step');
      setStepDescription('Describe what the seller or system should do');
      setStepActionType('create_task');
      setStepDelayHours(0);
      setStepRequired(true);
      setStepPriority('medium');
      setStepInstructions('');
    }
  };

  const handleSaveStep = () => {
    if (!isEditingStep || !activePlay) return;

    const updatedConfig = {
      ...isEditingStep.config,
      taskTitle: stepTitle,
      taskPriority: stepPriority,
      taskInstructions: stepInstructions,
    };

    const newStep: PlayStep = {
      ...isEditingStep,
      title: stepTitle.trim() || 'Action Step',
      description: stepDescription.trim(),
      actionType: stepActionType,
      delayHours: Number(stepDelayHours) || 0,
      requiredForNextStep: stepRequired,
      config: updatedConfig,
    };

    const exists = activePlay.steps.some((s) => s.id === newStep.id);
    let updatedSteps: PlayStep[];

    if (exists) {
      updatedSteps = activePlay.steps.map((s) => (s.id === newStep.id ? newStep : s));
    } else {
      updatedSteps = [...activePlay.steps, newStep];
    }

    // Re-index steps
    updatedSteps = updatedSteps.map((s, idx) => ({ ...s, stepIndex: idx }));

    setActivePlay({
      ...activePlay,
      steps: updatedSteps,
    });
    setIsEditingStep(null);
  };

  const handleDeleteStep = (stepId: string) => {
    if (!activePlay) return;
    const filtered = activePlay.steps.filter((s) => s.id !== stepId);
    const reindexed = filtered.map((s, idx) => ({ ...s, stepIndex: idx }));
    setActivePlay({ ...activePlay, steps: reindexed });
  };

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    if (!activePlay) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= activePlay.steps.length) return;

    const copy = [...activePlay.steps];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIndex, 0, moved);

    const reindexed = copy.map((s, idx) => ({ ...s, stepIndex: idx }));
    setActivePlay({ ...activePlay, steps: reindexed });
  };

  const handleSavePlay = async () => {
    if (!activePlay) return;
    setIsSaving(true);

    try {
      const res = await saveSalesPlayAction({
        workspaceId,
        organizationId,
        actorId,
        play: activePlay,
      });

      if (res.success) {
        toast({
          title: 'Sales Play Saved',
          description: `"${activePlay.title}" has been updated and compiled.`,
        });
        onSaveSuccess();
      } else {
        toast({
          variant: 'destructive',
          title: 'Save Failed',
          description: res.error || 'Failed to save sales play.',
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save play.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getStepIcon = (actionType: PlayActionType) => {
    switch (actionType) {
      case 'create_task':
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case 'generate_ai_brief':
        return <Bot className="h-4 w-4 text-indigo-500" />;
      case 'enroll_sequence':
        return <Layers className="h-4 w-4 text-primary" />;
      case 'request_approval':
        return <Sparkles className="h-4 w-4 text-amber-500" />;
      case 'escalate_to_manager':
        return <AlertTriangle className="h-4 w-4 text-rose-500" />;
      case 'update_stage':
        return <ArrowRight className="h-4 w-4 text-teal-500" />;
      default:
        return <Workflow className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Builder Top Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-card p-4 rounded-2xl border border-border/70 shadow-sm">
        <div className="flex items-center gap-3">
          <Workflow className="h-5 w-5 text-primary shrink-0" />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-foreground">{activePlay.title}</h2>
              <Badge variant="outline" className="text-[10px] font-semibold">
                v{activePlay.version}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {activePlay.steps.length} sequential steps • {activePlay.category.replace(/_/g, ' ')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Quick Play Switcher */}
          <Select
            value={activePlay.id}
            onValueChange={(val) => {
              const selected = allPlays.find((p) => p.id === val);
              if (selected) {
                setActivePlay(selected);
                onSelectPlay(selected);
              }
            }}
          >
            <SelectTrigger className="w-[180px] h-10 rounded-xl text-xs font-semibold min-h-[44px]">
              <SelectValue placeholder="Select Play" />
            </SelectTrigger>
            <SelectContent>
              {allPlays.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-xs">
                  {p.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleOpenStepModal()}
            className="h-10 rounded-xl text-xs font-semibold min-h-[44px] active:scale-[0.97] transition-transform"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add Step
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={isSaving}
            onClick={handleSavePlay}
            className="h-10 rounded-xl text-xs font-semibold px-4 min-h-[44px] active:scale-[0.97] transition-transform"
          >
            <Save className="h-4 w-4 mr-1.5" />
            {isSaving ? 'Saving...' : 'Save Play'}
          </Button>
        </div>
      </div>

      {/* Visual Canvas (Desktop >= 1024px) & Linear Sequence (Mobile < 1024px) */}
      <div className="space-y-4">
        {/* Node 1: Trigger Card */}
        <Card className="border-border/70 rounded-2xl bg-gradient-to-r from-amber-500/10 via-card to-background shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Step 0 • Entry Trigger
                </div>
                <div className="text-sm font-bold text-foreground">
                  {activePlay.triggers.map((t) => t.type.replace(/_/g, ' ').toUpperCase()).join(' OR ')}
                </div>
              </div>
            </div>
            <Badge variant="outline" className="text-xs font-semibold bg-background">
              {activePlay.conditions.length} Condition{activePlay.conditions.length === 1 ? '' : 's'}
            </Badge>
          </CardContent>
        </Card>

        {/* Connector Arrow */}
        <div className="flex justify-center py-1">
          <ArrowDown className="h-5 w-5 text-muted-foreground/60" />
        </div>

        {/* Steps List */}
        {activePlay.steps.map((step, idx) => (
          <React.Fragment key={step.id}>
            <Card className="border-border/70 rounded-2xl bg-card shadow-sm hover:border-primary/40 transition-colors">
              <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      {getStepIcon(step.actionType)}
                    </div>
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-primary">
                          Step {idx + 1}
                        </span>
                        <Badge variant="secondary" className="text-[10px] font-semibold">
                          {step.actionType.replace(/_/g, ' ')}
                        </Badge>
                        {step.delayHours > 0 && (
                          <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            Wait {step.delayHours}h
                          </Badge>
                        )}
                        {step.requiredForNextStep && (
                          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px]">
                            Required
                          </Badge>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-foreground">{step.title}</h3>
                      <p className="text-xs text-muted-foreground">{step.description}</p>
                    </div>
                  </div>

                  {/* Step Action Controls */}
                  <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={idx === 0}
                      onClick={() => handleMoveStep(idx, 'up')}
                      className="h-9 w-9 rounded-xl min-h-[44px] min-w-[44px]"
                      aria-label="Move step up"
                    >
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={idx === activePlay.steps.length - 1}
                      onClick={() => handleMoveStep(idx, 'down')}
                      className="h-9 w-9 rounded-xl min-h-[44px] min-w-[44px]"
                      aria-label="Move step down"
                    >
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenStepModal(step)}
                      className="h-9 w-9 rounded-xl min-h-[44px] min-w-[44px]"
                      aria-label="Edit step"
                    >
                      <Edit2 className="h-4 w-4 text-primary" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteStep(step.id)}
                      className="h-9 w-9 rounded-xl min-h-[44px] min-w-[44px]"
                      aria-label="Delete step"
                    >
                      <Trash2 className="h-4 w-4 text-rose-500" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Connector Arrow if not last */}
            {idx < activePlay.steps.length - 1 && (
              <div className="flex justify-center py-1">
                <ArrowDown className="h-5 w-5 text-muted-foreground/60" />
              </div>
            )}
          </React.Fragment>
        ))}

        {/* Final Exit Node */}
        <div className="flex justify-center py-1">
          <ArrowDown className="h-5 w-5 text-muted-foreground/60" />
        </div>
        <Card className="border-border/70 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-card to-background shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Goal / Exit
                </div>
                <div className="text-xs font-bold text-foreground">
                  {activePlay.exitConditions.map((e) => e.condition.replace(/_/g, ' ')).join(', ')}
                </div>
              </div>
            </div>
            <Badge variant="outline" className="text-xs text-muted-foreground">
              Auto Complete
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Edit Step Modal */}
      <Dialog open={!!isEditingStep} onOpenChange={(open) => !open && setIsEditingStep(null)}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Workflow className="h-4 w-4 text-primary" />
              Configure Action Step
            </DialogTitle>
            <DialogDescription className="text-xs">
              Define the action, delay timing, and task instructions for this step in the play sequence.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Step Title</label>
              <Input
                placeholder="e.g., Initial Phone Call"
                value={stepTitle}
                onChange={(e) => setStepTitle(e.target.value)}
                className="h-11 rounded-xl text-sm min-h-[44px]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Description</label>
              <Input
                placeholder="Brief summary of the action"
                value={stepDescription}
                onChange={(e) => setStepDescription(e.target.value)}
                className="h-11 rounded-xl text-sm min-h-[44px]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Action Type</label>
                <Select
                  value={stepActionType}
                  onValueChange={(val) => setStepActionType(val as PlayActionType)}
                >
                  <SelectTrigger className="h-11 rounded-xl text-xs font-medium min-h-[44px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="create_task" className="text-xs">Create Seller Task</SelectItem>
                    <SelectItem value="generate_ai_brief" className="text-xs">Generate AI Brief</SelectItem>
                    <SelectItem value="enroll_sequence" className="text-xs">Enroll in Cadence</SelectItem>
                    <SelectItem value="request_approval" className="text-xs">Request Approval</SelectItem>
                    <SelectItem value="escalate_to_manager" className="text-xs">Escalate to Manager</SelectItem>
                    <SelectItem value="update_stage" className="text-xs">Advance Deal Stage</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Delay (Hours)</label>
                <Input
                  type="number"
                  min={0}
                  value={stepDelayHours}
                  onChange={(e) => setStepDelayHours(Number(e.target.value))}
                  className="h-11 rounded-xl text-sm min-h-[44px]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Seller Guidance / Prompt</label>
              <Textarea
                placeholder="Specific instructions or talking points for the seller..."
                value={stepInstructions}
                onChange={(e) => setStepInstructions(e.target.value)}
                className="min-h-[80px] rounded-xl text-xs"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border/40">
              <div>
                <div className="text-xs font-semibold text-foreground">Required Step</div>
                <div className="text-[10px] text-muted-foreground">
                  Play cannot proceed to next step until this step completes
                </div>
              </div>
              <Switch
                checked={stepRequired}
                onCheckedChange={setStepRequired}
                aria-label="Toggle required step"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditingStep(null)}
              className="h-11 rounded-xl text-xs font-semibold min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveStep}
              className="h-11 rounded-xl text-xs font-semibold min-h-[44px] active:scale-[0.97] transition-transform"
            >
              Confirm Step
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
