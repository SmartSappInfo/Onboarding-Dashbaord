'use client';

/**
 * @fileOverview Standardized Autonomous Supervisor Mission Modal (Phase 13 Milestone 5 Task 1)
 *
 * Implements theme.md Section 8 (Standardized Modal & Dialog Architecture):
 * - Surface & Geometry: `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`
 * - Demarcated Header: `<DialogHeader demarcated>` with `px-6 py-3.5 sm:py-4 min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20`
 * - Single-Circle Info Tooltip: `<CardInfoTooltip text="..." />` alongside title at `z-[10050]`
 * - Zero Raw Descriptions: `<DialogDescription className="sr-only">`
 * - Demarcated Footer: `px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5`
 * - Tactile mechanical feedback: `rounded-xl active:scale-[0.97]` with `min-h-[44px]` touch targets
 *
 * Rules:
 * - Rule 4: Zero `any` / Zero `any[]` strict typing.
 * - Rule 7: Mobile-first responsive touch targets >= 44px.
 * - Rule 8 & 47: Anti-IDOR tenant scoping.
 * - Rule 19: Deterministic idempotency keys.
 * - Rule 28 & 56: Knapsack token budgeting <= 50,000.
 * - Rule 42: Shadow Mode simulation reporting 0 live database mutations.
 * - Rule 51: Next.js 15 Server Actions integration.
 * - Rule 60: Emergency Dead-Man Switch evaluation.
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Network,
  ShieldCheck,
  Zap,
  Loader2,
  AlertCircle,
  Eye,
  Play,
  Scale,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import type {
  SupervisorPriorityLevel,
  SupervisorGoalInputRaw,
  SupervisorSynthesisResult,
} from '@/platform/agents/supervisor/supervisor-types';
import {
  executeSupervisorMissionAction,
  simulateSupervisorShadowGoalAction,
} from '@/app/actions/supervisor-actions';
import type { SupervisorShadowRunResult } from '@/platform/agents/supervisor/evaluation/supervisor-shadow-mode';

export interface SupervisorMissionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  workspaceId: string;
  defaultGoal?: string;
  onMissionStarted?: (
    missionId: string,
    result: SupervisorSynthesisResult | SupervisorShadowRunResult
  ) => void;
  executeAction?: typeof executeSupervisorMissionAction;
  simulateAction?: typeof simulateSupervisorShadowGoalAction;
}

const PRIORITY_OPTIONS: {
  level: SupervisorPriorityLevel;
  label: string;
  color: string;
}[] = [
  { level: 'LOW', label: 'LOW', color: 'border-muted text-muted-foreground hover:bg-muted/50' },
  { level: 'MEDIUM', label: 'MEDIUM', color: 'border-primary/40 text-primary hover:bg-primary/10' },
  { level: 'HIGH', label: 'HIGH', color: 'border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10' },
  { level: 'CRITICAL', label: 'CRITICAL', color: 'border-destructive/40 text-destructive hover:bg-destructive/10' },
];

export function SupervisorMissionModal({
  open,
  onOpenChange,
  organizationId,
  workspaceId,
  defaultGoal = '',
  onMissionStarted,
  executeAction = executeSupervisorMissionAction,
  simulateAction = simulateSupervisorShadowGoalAction,
}: SupervisorMissionModalProps): React.JSX.Element {
  const [goal, setGoal] = React.useState<string>(defaultGoal);
  const [priorityLevel, setPriorityLevel] = React.useState<SupervisorPriorityLevel>('MEDIUM');
  const [budgetCapTokens, setBudgetCapTokens] = React.useState<number>(40000);
  const [targetSubject, setTargetSubject] = React.useState<string>('');
  const [isShadowMode, setIsShadowMode] = React.useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (defaultGoal) {
      setGoal(defaultGoal);
    }
  }, [defaultGoal]);

  const isGoalValid = goal.trim().length >= 10;

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!isGoalValid || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const input: SupervisorGoalInputRaw = {
        organizationId,
        workspaceId,
        goal: goal.trim(),
        priorityLevel,
        budgetCapTokens: Math.min(Math.max(1000, budgetCapTokens), 30000),
        entityId: targetSubject.trim() ? targetSubject.trim() : undefined,
      };

      if (isShadowMode) {
        const res = await simulateAction(input);
        if (!res.success || !res.data) {
          toast({
            title: 'Simulation Error',
            description: res.error || 'Failed to simulate mission in shadow mode.',
            variant: 'destructive',
            actionConfig: {
              path: '/admin/intelligence/organization',
              label: 'View Missions',
            },
          });
          return;
        }

        toast({
          title: 'Simulation Complete',
          description: 'Simulation completed: 0 live database mutations.',
          actionConfig: {
            path: '/admin/intelligence/organization',
            label: 'View Missions',
          },
        });

        if (onMissionStarted) {
          onMissionStarted(res.data.missionId, res.data);
        }
        onOpenChange(false);
      } else {
        const res = await executeAction(input);
        if (!res.success || !res.data) {
          toast({
            title: 'Launch Failed',
            description: res.error || 'Failed to launch supervisor mission.',
            variant: 'destructive',
            actionConfig: {
              path: '/admin/intelligence/organization',
              label: 'View Missions',
            },
          });
          return;
        }

        toast({
          title: 'Mission Launched',
          description: `Supervisor mission ${res.data.missionId} executed successfully`,
          actionConfig: {
            path: '/admin/intelligence/organization',
            label: 'View Missions',
          },
        });

        if (onMissionStarted) {
          onMissionStarted(res.data.missionId, res.data);
        }
        onOpenChange(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      toast({
        title: 'Unexpected Error',
        description: message,
        variant: 'destructive',
        actionConfig: {
          path: '/admin/intelligence/organization',
          label: 'View Missions',
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl p-0 gap-0 overflow-hidden">
        {/* Demarcated Header strictly adhering to theme.md §8 */}
        <DialogHeader
          demarcated
          className="px-6 py-3.5 sm:py-4 min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                <Network className="h-4 w-4" />
              </div>
              <DialogTitle className="text-base font-semibold tracking-tight text-foreground">
                Launch Autonomous Supervisor Mission
              </DialogTitle>
              <CardInfoTooltip text="Decompose high-level organizational goals across topological waves to coordinate specialized domain agents with mathematical authority intersection." />
            </div>
            <Badge
              variant="outline"
              className={cn(
                'text-xs font-mono font-medium',
                isShadowMode
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : 'border-primary/30 bg-primary/10 text-primary'
              )}
            >
              {isShadowMode ? 'Shadow Simulation' : 'Live Autonomous Mode'}
            </Badge>
          </div>
          <DialogDescription className="sr-only">
            Decompose high-level organizational goals across topological waves to coordinate specialized domain agents with mathematical authority intersection.
          </DialogDescription>
        </DialogHeader>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
            {/* Goal Input Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="supervisor-goal" className="text-sm font-medium text-foreground">
                  Operational Goal <span className="text-destructive">*</span>
                </Label>
                <span
                  className={cn(
                    'text-xs font-mono',
                    goal.length >= 10 ? 'text-muted-foreground' : 'text-amber-500 font-medium'
                  )}
                >
                  {goal.length} chars (min 10)
                </span>
              </div>
              <Textarea
                id="supervisor-goal"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="Describe the high-level objective (e.g., Audit all overdue invoices and reconcile bank settlements across campus accounts)..."
                rows={4}
                className="w-full resize-none text-sm font-sans"
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                The Supervisor will analyze this goal, construct a directed acyclic graph (DAG), and dispatch subagents.
              </p>
            </div>

            {/* Priority Level Selector */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">
                Priority Level
              </Label>
              <div className="grid grid-cols-4 gap-2">
                {PRIORITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.level}
                    type="button"
                    onClick={() => setPriorityLevel(opt.level)}
                    disabled={isSubmitting}
                    className={cn(
                      'flex items-center justify-center py-2 px-3 text-xs font-semibold rounded-lg border transition-all active:scale-[0.97] min-h-[38px]',
                      priorityLevel === opt.level
                        ? cn('ring-2 ring-primary/40 bg-accent text-foreground font-bold shadow-sm', opt.color)
                        : 'border-border/60 text-muted-foreground hover:bg-muted/40'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Budget Cap & Target Subject */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="token-budget" className="text-sm font-medium text-foreground">
                  Token Budget Cap (max 50,000)
                </Label>
                <div className="relative">
                  <Input
                    id="token-budget"
                    type="number"
                    min={1000}
                    max={50000}
                    step={1000}
                    value={budgetCapTokens}
                    onChange={(e) => setBudgetCapTokens(Number(e.target.value))}
                    disabled={isSubmitting}
                    className="h-10 pr-12 font-mono text-sm"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">
                    tokens
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Cumulative token budget allocated across all subagent steps (Rule 28).
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="target-subject" className="text-sm font-medium text-foreground">
                  Target Subject / Entity (Optional)
                </Label>
                <Input
                  id="target-subject"
                  type="text"
                  placeholder="e.g., entity_campus_accra or all"
                  value={targetSubject}
                  onChange={(e) => setTargetSubject(e.target.value)}
                  disabled={isSubmitting}
                  className="h-10 text-sm font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Restricts DAG operations to a designated entity or account scope.
                </p>
              </div>
            </div>

            {/* Shadow Simulation Toggle Banner (Rule 42) */}
            <div
              className={cn(
                'rounded-xl border p-4 transition-all',
                isShadowMode
                  ? 'border-amber-500/40 bg-amber-500/5'
                  : 'border-border/60 bg-muted/10'
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <label
                      htmlFor="shadow-mode-toggle"
                      className="text-sm font-medium text-foreground cursor-pointer"
                    >
                      Run in Shadow Mode (0 Live Mutations)
                    </label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Synthesizes the DAG and generates subagent plans without executing any live database writes or outbound communications (Rule 42).
                    </p>
                  </div>
                </div>
                <input
                  id="shadow-mode-toggle"
                  type="checkbox"
                  role="checkbox"
                  aria-label="Run in Shadow Mode"
                  checked={isShadowMode}
                  onChange={(e) => setIsShadowMode(e.target.checked)}
                  disabled={isSubmitting}
                  className="mt-1 h-5 w-5 rounded border-border text-primary focus:ring-primary/20 cursor-pointer"
                />
              </div>

              {isShadowMode && (
                <div className="mt-3 pt-3 border-t border-amber-500/20 flex items-center justify-between text-xs text-amber-600 dark:text-amber-400">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Eye className="h-3.5 w-3.5" />
                    Simulated execution producing Blast Radius Report
                  </span>
                  <Badge variant="outline" className="text-[10px] border-amber-500/30 bg-amber-500/10">
                    0 Live Mutations
                  </Badge>
                </div>
              )}
            </div>
          </div>

          {/* Demarcated Footer strictly adhering to theme.md §8 */}
          <div className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="min-h-[44px] rounded-xl active:scale-[0.97] border-border/80 text-foreground"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !isGoalValid}
              className={cn(
                'min-h-[44px] rounded-xl font-medium transition-all active:scale-[0.97] flex items-center gap-2',
                isShadowMode
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'bg-primary hover:bg-primary/90 text-primary-foreground'
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{isShadowMode ? 'Simulating...' : 'Launching...'}</span>
                </>
              ) : isShadowMode ? (
                <>
                  <Eye className="h-4 w-4" />
                  <span>Simulate in Shadow Mode</span>
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 fill-current" />
                  <span>Launch Mission</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
