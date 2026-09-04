'use client';

/**
 * @fileoverview Target Center Component for Sales Performance & Intelligence 2.0 (Phase 1).
 *
 * ARCHITECTURAL POINTER:
 * Implements PRD Section 27 and UI/UX Sections 45 & 46:
 * - Real-time target attainment % and progress bar visualization.
 * - Required daily pace calculation (e.g. "GHS 110k/day" or "1.4 meetings/day").
 * - Target creation dialog with period, metric, owner type, and goal validation.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Zero 'any' policy strictly enforced.
 * - Minimum 44px touch targets on mobile controls.
 */

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  Target, 
  Plus, 
  Clock, 
  Trash2, 
  Loader2,
  Sparkles,
  Zap
} from 'lucide-react';
import type { SalesTarget, TargetMetric, TargetPeriod, TargetOwnerType } from '@/lib/sales-performance/types';
import { createOrUpdateTargetAction, deleteTargetAction } from '@/app/actions/sales-performance-actions';

interface TargetCenterTabProps {
  workspaceId: string;
  organizationId: string;
  targets: SalesTarget[];
  currentUserId?: string;
  onRefresh: () => void;
}

export function TargetCenterTab({
  workspaceId,
  organizationId,
  targets,
  currentUserId,
  onRefresh,
}: TargetCenterTabProps) {
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  // Form state
  const [metric, setMetric] = React.useState<TargetMetric>('meetings');
  const [period, setPeriod] = React.useState<TargetPeriod>('monthly');
  const [ownerType, setOwnerType] = React.useState<TargetOwnerType>('workspace');
  const [targetValue, setTargetValue] = React.useState<string>('20');
  const [ownerName, setOwnerName] = React.useState<string>('Entire Workspace');

  const handleCreateTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(targetValue);
    if (isNaN(val) || val <= 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid Target',
        description: 'Target goal must be a positive number.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const now = new Date();
      const startDate = now.toISOString();
      const endDateObj = new Date(now);

      if (period === 'daily') {
        endDateObj.setDate(now.getDate() + 1);
      } else if (period === 'weekly') {
        endDateObj.setDate(now.getDate() + 7);
      } else if (period === 'monthly') {
        endDateObj.setDate(now.getDate() + 30);
      } else if (period === 'quarterly') {
        endDateObj.setDate(now.getDate() + 90);
      }

      const res = await createOrUpdateTargetAction({
        workspaceId,
        organizationId,
        targetData: {
          workspaceId,
          organizationId,
          ownerType,
          ownerId: ownerType === 'workspace' ? workspaceId : currentUserId || 'unassigned',
          ownerName: ownerType === 'workspace' ? 'Workspace Team' : ownerName,
          metric,
          period,
          targetValue: val,
          actualValue: 0,
          startDate,
          endDate: endDateObj.toISOString(),
          status: 'active',
        },
      });

      if (res.success) {
        toast({
          title: 'Target Created',
          description: `Successfully set ${period} quota of ${val} ${metric}.`,
        });
        setIsDialogOpen(false);
        onRefresh();
      } else {
        throw new Error(res.error || 'Failed to create target');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ variant: 'destructive', title: 'Error', description: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTarget = async (targetId: string) => {
    setDeletingId(targetId);
    try {
      const res = await deleteTargetAction({ workspaceId, targetId });
      if (res.success) {
        toast({ title: 'Target Removed', description: 'Quota deleted successfully.' });
        onRefresh();
      } else {
        throw new Error(res.error || 'Failed to delete target');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ variant: 'destructive', title: 'Delete Error', description: msg });
    } finally {
      setDeletingId(null);
    }
  };

  const getPaceBadge = (status: SalesTarget['paceStatus']) => {
    switch (status) {
      case 'achieved':
        return <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-bold">Achieved</Badge>;
      case 'on_track':
        return <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30 text-[10px] font-bold">On Track</Badge>;
      case 'at_risk':
        return <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] font-bold">At Risk</Badge>;
      case 'behind':
        return <Badge className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 text-[10px] font-bold">Behind Pace</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Add Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-extrabold tracking-tight flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" /> Target & Quota Center
          </h3>
          <p className="text-xs text-muted-foreground">
            Track real-time attainment progress and required daily operational velocity.
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl active:scale-[0.97] transition-all min-h-[44px] sm:min-h-[38px] flex items-center gap-2 font-bold shadow-sm">
              <Plus className="h-4 w-4" /> Set New Target
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl max-w-md">
            <form onSubmit={handleCreateTarget}>
              <DialogHeader>
                <DialogTitle className="text-base font-extrabold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-yellow-500 fill-current" /> Create Performance Target
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Configure operational goals and quotas for representatives or the team.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Metric</Label>
                  <Select value={metric} onValueChange={(val: TargetMetric) => setMetric(val)}>
                    <SelectTrigger className="rounded-xl text-xs font-semibold h-10">
                      <SelectValue placeholder="Select metric" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="meetings">Completed Meetings</SelectItem>
                      <SelectItem value="calls">Logged Calls</SelectItem>
                      <SelectItem value="deals">Opportunities Created</SelectItem>
                      <SelectItem value="tasks">Completed Tasks</SelectItem>
                      <SelectItem value="revenue">Closed Revenue</SelectItem>
                      <SelectItem value="points">Effort Points</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Period</Label>
                    <Select value={period} onValueChange={(val: TargetPeriod) => setPeriod(val)}>
                      <SelectTrigger className="rounded-xl text-xs font-semibold h-10">
                        <SelectValue placeholder="Period" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Scope</Label>
                    <Select value={ownerType} onValueChange={(val: TargetOwnerType) => setOwnerType(val)}>
                      <SelectTrigger className="rounded-xl text-xs font-semibold h-10">
                        <SelectValue placeholder="Scope" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="workspace">Workspace Team</SelectItem>
                        <SelectItem value="agent">Individual Rep</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {ownerType === 'agent' && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Representative Name</Label>
                    <Input
                      type="text"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      placeholder="e.g. Alex Morgan"
                      className="rounded-xl text-xs font-semibold h-10"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Target Goal Value</Label>
                  <Input
                    type="number"
                    min="1"
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    required
                    className="rounded-xl font-mono text-xs font-bold h-10"
                    placeholder="e.g. 25"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  className="rounded-xl text-xs font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl text-xs font-bold active:scale-[0.97]"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                  Save Target
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Target Cards Grid */}
      {targets.length === 0 ? (
        <Card className="rounded-2xl border-dashed border-border/60 bg-muted/5 p-12 text-center">
          <Target className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-foreground">No active targets configured</h4>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
            Set quarterly or monthly quotas to guide sales representatives and track daily required pacing.
          </p>
          <Button
            onClick={() => setIsDialogOpen(true)}
            variant="outline"
            className="rounded-xl text-xs font-bold active:scale-[0.97]"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Configure First Target
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {targets.map((t) => {
            const isDeleting = deletingId === t.id;
            return (
              <Card
                key={t.id}
                className="rounded-2xl border-border/40 bg-card/45 backdrop-blur-md shadow-sm p-5 space-y-4 hover:border-primary/30 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {t.period} Quota
                      </span>
                      {getPaceBadge(t.paceStatus)}
                    </div>
                    <h4 className="text-sm font-extrabold text-foreground capitalize">
                      {t.metric.replace('_', ' ')}
                    </h4>
                    <span className="text-[10px] font-medium text-muted-foreground block">
                      {t.ownerName}
                    </span>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteTarget(t.id)}
                    disabled={isDeleting}
                    className="h-8 w-8 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 active:scale-[0.97]"
                  >
                    {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </Button>
                </div>

                {/* Progress bar and attainment */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono font-bold">
                    <span className="text-foreground">
                      {t.actualValue} / {t.targetValue}
                    </span>
                    <span className="text-primary font-black">
                      {t.attainmentPercent}%
                    </span>
                  </div>
                  <Progress value={Math.min(100, t.attainmentPercent)} className="h-2 rounded-full" />
                </div>

                {/* Pace Details Footer */}
                <div className="pt-2 border-t border-border/30 flex items-center justify-between text-[11px] text-muted-foreground font-medium">
                  <span className="flex items-center gap-1">
                    <Zap className="h-3 w-3 text-amber-500" />
                    Need: <strong className="text-foreground font-mono">{t.requiredDailyPace}/day</strong>
                  </span>
                  <span className="flex items-center gap-1 text-[10px] font-mono">
                    <Clock className="h-2.5 w-2.5" />
                    Due: {new Date(t.endDate).toLocaleDateString()}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
