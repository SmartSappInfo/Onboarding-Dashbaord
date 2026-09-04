'use client';

/**
 * @fileoverview Active Plays Tab Component (Phase 8).
 *
 * ARCHITECTURAL POINTER:
 * Fulfills SmartSapp Sales Performance & Intelligence 2.0 UX Screen 3 (Active Plays):
 * - Live runtime monitor tracking active Sales Play execution instances.
 * - Progress visualization (current step / total steps), assigned rep attribution, due timers.
 * - Step execution modal for 1-click advancement, outcome logging, and +10 effort points.
 * - Mobile-first touch targets (min-h-[44px], active:scale-[0.97]).
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing enforced. Zero use of 'any' or 'any[]'.
 * - No raw HTML tags in UI.
 */

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
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
  Search,
  CheckCircle2,
  Clock,
  User,
  Zap,
  ArrowRight,
  AlertCircle,
  Play,
  RotateCw,
} from 'lucide-react';
import type { PlayExecutionInstance } from '@/lib/sales-orchestration/types';
import { executePlayStepAction } from '@/app/actions/sales-orchestration-actions';
import { useToast } from '@/hooks/use-toast';

interface ActivePlaysTabProps {
  executions: PlayExecutionInstance[];
  workspaceId: string;
  organizationId: string;
  actorId: string;
  actorName: string;
  onRefresh: () => void;
}

export function ActivePlaysTab({
  executions,
  workspaceId,
  organizationId,
  actorId,
  actorName,
  onRefresh,
}: ActivePlaysTabProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedStatus, setSelectedStatus] = React.useState<string>('all');
  const [advancingInstance, setAdvancingInstance] = React.useState<PlayExecutionInstance | null>(null);
  const [stepStatus, setStepStatus] = React.useState<'completed' | 'skipped' | 'failed'>('completed');
  const [outcomeNote, setOutcomeNote] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const filteredExecutions = React.useMemo(() => {
    return executions.filter((ex) => {
      const matchesSearch =
        ex.playTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ex.entityName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ex.assignedToName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = selectedStatus === 'all' || ex.status === selectedStatus;
      return matchesSearch && matchesStatus;
    });
  }, [executions, searchQuery, selectedStatus]);

  const handleAdvanceStep = async () => {
    if (!advancingInstance) return;
    setIsSubmitting(true);

    try {
      const res = await executePlayStepAction({
        workspaceId,
        organizationId,
        actorId,
        actorName,
        executionId: advancingInstance.id,
        stepId: `step_${advancingInstance.currentStepIndex}`,
        status: stepStatus,
        outcomeNote: outcomeNote.trim() || undefined,
      });

      if (res.success) {
        toast({
          title: 'Step Recorded',
          description: `Play execution advanced. ${res.pointsAwarded ? `+${res.pointsAwarded} effort points awarded!` : ''}`,
        });
        setAdvancingInstance(null);
        setOutcomeNote('');
        onRefresh();
      } else {
        toast({
          variant: 'destructive',
          title: 'Execution Failed',
          description: res.error || 'Failed to advance step.',
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to record step outcome.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: PlayExecutionInstance['status']) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">Active</Badge>;
      case 'completed':
        return <Badge className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20">Completed</Badge>;
      case 'failed':
        return <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20">Failed</Badge>;
      case 'paused':
        return <Badge variant="secondary">Paused</Badge>;
      default:
        return <Badge variant="outline">Cancelled</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Search & Filter Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search active plays by deal or rep..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-11 rounded-xl text-sm min-h-[44px]"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'All Instances' },
            { id: 'active', label: 'Active' },
            { id: 'completed', label: 'Completed' },
            { id: 'failed', label: 'Failed' },
          ].map((st) => (
            <Button
              key={st.id}
              type="button"
              variant={selectedStatus === st.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedStatus(st.id)}
              className="h-10 rounded-xl text-xs font-semibold px-3 min-h-[44px] active:scale-[0.97] transition-transform shrink-0"
            >
              {st.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Execution Instances List */}
      {filteredExecutions.length === 0 ? (
        <div className="text-center py-16 bg-muted/20 border border-dashed rounded-2xl">
          <Workflow className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-semibold text-foreground">No Play Executions Found</p>
          <p className="text-xs text-muted-foreground mt-1">
            Active play instances will appear here when inbound leads or buyer signals trigger plays.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredExecutions.map((ex) => {
            const progressPercent = Math.min(
              100,
              Math.round(((ex.currentStepIndex + (ex.status === 'completed' ? 1 : 0)) / Math.max(1, ex.totalSteps)) * 100)
            );

            return (
              <Card
                key={ex.id}
                className="border border-border/70 rounded-2xl bg-card shadow-sm hover:border-primary/40 transition-colors"
              >
                <CardHeader className="pb-3 px-6 pt-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getStatusBadge(ex.status)}
                        <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                          <Zap className="h-3.5 w-3.5 text-amber-500" />
                          {ex.triggerType.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <CardTitle className="text-base font-bold text-foreground">
                        {ex.entityName}
                      </CardTitle>
                      <div className="text-xs font-semibold text-primary">
                        {ex.playTitle}
                      </div>
                    </div>

                    {ex.entityValue !== undefined && (
                      <div className="text-right shrink-0">
                        <div className="text-sm font-extrabold text-foreground">
                          ${ex.entityValue.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-muted-foreground">Deal Value</div>
                      </div>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="px-6 pb-5 space-y-4">
                  {/* Step Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">
                        Step {ex.currentStepIndex + 1} of {ex.totalSteps}
                      </span>
                      <span className="text-muted-foreground">{progressPercent}%</span>
                    </div>
                    <Progress value={progressPercent} className="h-2 rounded-full" />
                  </div>

                  {/* Metadata Row */}
                  <div className="bg-muted/40 rounded-xl p-3 border border-border/40 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-primary" />
                        Assigned To:
                      </span>
                      <strong className="text-foreground">{ex.assignedToName}</strong>
                    </div>

                    {ex.nextStepDueAt && ex.status === 'active' && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-indigo-500" />
                          Next Step Due:
                        </span>
                        <strong className="text-foreground">
                          {new Date(ex.nextStepDueAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </strong>
                      </div>
                    )}
                  </div>

                  {/* Step History Snippet */}
                  {ex.stepHistory.length > 0 && (
                    <div className="text-xs text-muted-foreground space-y-1 border-t border-border/40 pt-2">
                      <div className="font-semibold text-[11px] text-foreground">Last Action:</div>
                      <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">
                          {ex.stepHistory[ex.stepHistory.length - 1]?.stepTitle}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Advance Button */}
                  {ex.status === 'active' && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setAdvancingInstance(ex);
                        setStepStatus('completed');
                        setOutcomeNote('');
                      }}
                      className="w-full h-10 rounded-xl text-xs font-semibold min-h-[44px] active:scale-[0.97] transition-transform"
                    >
                      <ArrowRight className="h-4 w-4 mr-1.5" />
                      Execute Current Step
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Advance Step Dialog */}
      <Dialog open={!!advancingInstance} onOpenChange={(open) => !open && setAdvancingInstance(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Workflow className="h-4 w-4 text-primary" />
              Advance Step: {advancingInstance?.entityName}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Log the outcome of Step {advancingInstance ? advancingInstance.currentStepIndex + 1 : 1}. Successfully completing the step awards +10 effort points.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Step Outcome</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'completed', label: 'Completed' },
                  { id: 'skipped', label: 'Skip' },
                  { id: 'failed', label: 'Failed' },
                ].map((s) => (
                  <Button
                    key={s.id}
                    type="button"
                    variant={stepStatus === s.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStepStatus(s.id as 'completed' | 'skipped' | 'failed')}
                    className="h-10 rounded-xl text-xs font-semibold min-h-[44px]"
                  >
                    {s.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Execution Outcome Note</label>
              <Input
                placeholder="e.g., Connected with buyer, agreed to Thursday demo."
                value={outcomeNote}
                onChange={(e) => setOutcomeNote(e.target.value)}
                className="h-11 rounded-xl text-sm min-h-[44px]"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAdvancingInstance(null)}
              className="h-11 rounded-xl text-xs font-semibold min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isSubmitting}
              onClick={handleAdvanceStep}
              className="h-11 rounded-xl text-xs font-semibold min-h-[44px] active:scale-[0.97] transition-transform"
            >
              {isSubmitting ? 'Recording...' : 'Confirm Step Outcome'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
