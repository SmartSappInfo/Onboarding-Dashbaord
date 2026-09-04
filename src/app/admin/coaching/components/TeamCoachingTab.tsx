'use client';

/**
 * @fileoverview Manager Team Coaching & Competency Heatmap Cockpit (Phase 5).
 *
 * ARCHITECTURAL POINTER:
 * Fulfills PRD Section 42 & UI Specification Section 34:
 * 1. Team Macro Competency Benchmark: Team-wide averages across 5 skill pillars.
 * 2. Team Skill Matrix Heatmap: Rep-by-rep inspection of strengths, gaps, and drill velocity.
 * 3. High-Priority Coaching Opportunity Cards: Flagging reps needing immediate intervention.
 * 4. Assign Practice Drill Modal: Assigns scenarios to reps, directly updating their coaching profile
 *    and surfacing in Phase 2 "My Day" action queues.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strictly typed (zero 'any' or 'any[]').
 * - Touch targets maintain >= 44px height (min-h-[44px]) for mobile accessibility.
 * - Tactile micro-interactions use active:scale-[0.97] (emilkowal-animations).
 */

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  AlertTriangle,
  Send,
  Loader2,
  ArrowUpRight,
} from 'lucide-react';
import type {
  TeamCoachingOverview,
  PracticeLabScenario,
} from '@/lib/conversation-coaching/types';
import { assignCoachingDrillAction } from '@/app/actions/conversation-coaching-actions';

interface TeamCoachingTabProps {
  workspaceId: string;
  organizationId: string;
  overview: TeamCoachingOverview;
  scenarios: PracticeLabScenario[];
  currentUserId: string;
  currentUserName: string;
  onRefreshTeam?: () => void;
}

export const TeamCoachingTab: React.FC<TeamCoachingTabProps> = ({
  workspaceId,
  organizationId,
  overview,
  scenarios,
  currentUserId,
  currentUserName,
  onRefreshTeam,
}) => {
  const { toast } = useToast();

  // Assign Drill Modal State
  const [isAssignModalOpen, setIsAssignModalOpen] = React.useState<boolean>(false);
  const [targetRepId, setTargetRepId] = React.useState<string>('');
  const [targetScenarioId, setTargetScenarioId] = React.useState<string>(scenarios[0]?.id || '');
  const [instructions, setInstructions] = React.useState<string>('');
  const [deadlineDate, setDeadlineDate] = React.useState<string>(
    new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
  );
  const [isAssigning, setIsAssigning] = React.useState<boolean>(false);

  const avg = overview.averageSkillScores || overview.teamAverageSkills;
  const repMatrix = overview.repSkillMatrix || [];
  const highPriorityOpps = overview.highPriorityOpportunities || [];
  const totalRepsCount = overview.repsCount ?? repMatrix.length;

  const handleOpenAssignModal = (repId?: string, scenarioId?: string) => {
    if (repId) setTargetRepId(repId);
    else if (repMatrix[0]) setTargetRepId(repMatrix[0].repId);

    if (scenarioId) setTargetScenarioId(scenarioId);
    else if (scenarios[0]) setTargetScenarioId(scenarios[0].id);

    setIsAssignModalOpen(true);
  };

  const handleAssignDrill = async () => {
    if (!targetRepId || !targetScenarioId) return;

    try {
      setIsAssigning(true);
      const selectedScen = scenarios.find((s) => s.id === targetScenarioId) || scenarios[0];

      const res = await assignCoachingDrillAction({
        workspaceId,
        organizationId,
        repId: targetRepId,
        scenarioId: selectedScen.id,
        scenarioTitle: selectedScen.title,
        scenarioCategory: selectedScen.category,
        instructions: instructions.trim() || undefined,
        deadlineDate,
        assignedById: currentUserId,
        assignedByName: currentUserName,
      });

      if (!res.success) {
        throw new Error(res.error || 'Failed to assign practice drill');
      }

      toast({
        title: 'Practice Drill Assigned',
        description: `Successfully assigned "${selectedScen.title}". It will surface in their My Day action queue.`,
      });

      setIsAssignModalOpen(false);
      setInstructions('');
      if (onRefreshTeam) onRefreshTeam();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        title: 'Assignment Failed',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-foreground">Team Coaching & Skill Heatmap</h3>
            <Badge variant="outline" className="text-xs uppercase font-mono">
              Manager Command
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Aggregate competency performance across {totalRepsCount} sales representatives.
          </p>
        </div>

        <Button
          onClick={() => handleOpenAssignModal()}
          className="min-h-[44px] active:scale-[0.97] transition-all duration-150 font-semibold"
        >
          <Send className="w-4 h-4 mr-2" />
          Assign Practice Drill
        </Button>
      </div>

      {/* 2. Team Macro Benchmark Gauges */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-4 bg-card space-y-1">
          <span className="text-[11px] text-muted-foreground">Discovery Probing</span>
          <div className="text-xl font-bold text-foreground font-mono">{avg.discovery}%</div>
          <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
            <div className="bg-blue-500 h-full rounded-full" style={{ width: `${avg.discovery}%` }} />
          </div>
        </Card>

        <Card className="p-4 bg-card space-y-1">
          <span className="text-[11px] text-muted-foreground">Objection Handling</span>
          <div className="text-xl font-bold text-foreground font-mono">{avg.objectionHandling}%</div>
          <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
            <div className="bg-amber-500 h-full rounded-full" style={{ width: `${avg.objectionHandling}%` }} />
          </div>
        </Card>

        <Card className="p-4 bg-card space-y-1">
          <span className="text-[11px] text-muted-foreground">Closing & Terms</span>
          <div className="text-xl font-bold text-foreground font-mono">{avg.closing}%</div>
          <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
            <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${avg.closing}%` }} />
          </div>
        </Card>

        <Card className="p-4 bg-card space-y-1">
          <span className="text-[11px] text-muted-foreground">Product Knowledge</span>
          <div className="text-xl font-bold text-foreground font-mono">{avg.productKnowledge}%</div>
          <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
            <div className="bg-purple-500 h-full rounded-full" style={{ width: `${avg.productKnowledge}%` }} />
          </div>
        </Card>

        <Card className="p-4 bg-card space-y-1 col-span-2 md:col-span-1">
          <span className="text-[11px] text-muted-foreground">Call Control</span>
          <div className="text-xl font-bold text-foreground font-mono">{avg.callControl}%</div>
          <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
            <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${avg.callControl}%` }} />
          </div>
        </Card>
      </div>

      {/* 3. High-Priority Coaching Opportunity Alerts */}
      {highPriorityOpps.length > 0 && (
        <Card className="p-5 border-amber-300/40 bg-amber-500/5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <h4 className="text-sm font-bold text-foreground">Coaching Opportunities Requiring Intervention</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {highPriorityOpps.map((opp) => (
              <div
                key={opp.id}
                className="rounded-lg border bg-card p-3.5 flex items-start justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-foreground">{opp.repName}</span>
                    <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 capitalize">
                      {opp.riskType.replace('_', ' ')}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{opp.description}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleOpenAssignModal(opp.repId, opp.suggestedScenarioId)}
                  className="min-h-[44px] shrink-0 active:scale-[0.97] text-xs font-semibold"
                >
                  Assign Drill
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 4. Team Skill Matrix Table */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h4 className="text-base font-bold text-foreground">Representative Competency Matrix</h4>
            <p className="text-xs text-muted-foreground">
              Individual skill scores across live calls and practice simulations
            </p>
          </div>
          <span className="text-xs text-muted-foreground">{repMatrix.length} Sellers</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="border-b text-muted-foreground font-semibold">
              <tr>
                <th className="py-2.5 px-3">Representative</th>
                <th className="py-2.5 px-3">Discovery</th>
                <th className="py-2.5 px-3">Objection</th>
                <th className="py-2.5 px-3">Closing</th>
                <th className="py-2.5 px-3">Knowledge</th>
                <th className="py-2.5 px-3">Control</th>
                <th className="py-2.5 px-3">Completed Drills</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {repMatrix.map((rep) => (
                <tr key={rep.repId} className="hover:bg-muted/20 transition-colors">
                  <td className="py-3 px-3">
                    <div className="font-semibold text-foreground">{rep.repName}</div>
                    <div className="text-[11px] text-muted-foreground">{rep.repEmail}</div>
                  </td>
                  <td className="py-3 px-3 font-mono font-bold">{rep.skillScores.discovery}%</td>
                  <td className="py-3 px-3 font-mono font-bold">
                    <span
                      className={
                        rep.skillScores.objectionHandling < 70 ? 'text-amber-600 dark:text-amber-400' : ''
                      }
                    >
                      {rep.skillScores.objectionHandling}%
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono font-bold">{rep.skillScores.closing}%</td>
                  <td className="py-3 px-3 font-mono font-bold">{rep.skillScores.productKnowledge}%</td>
                  <td className="py-3 px-3 font-mono font-bold">{rep.skillScores.callControl}%</td>
                  <td className="py-3 px-3">
                    <Badge variant="secondary" className="font-mono text-[11px]">
                      {rep.completedDrillsCount} Drills
                    </Badge>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleOpenAssignModal(rep.repId, rep.recommendedDrill?.id)}
                      className="min-h-[44px] active:scale-[0.97] text-xs font-semibold text-primary hover:bg-primary/10"
                    >
                      Assign Drill
                      <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 5. Assign Practice Drill Modal Dialog */}
      <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Practice Lab Drill</DialogTitle>
            <DialogDescription>
              Assign a targeted objection scenario to sharpen sales execution. This will appear in their My Day queue.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            {/* Rep Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Select Representative</label>
              <select
                aria-label="Target representative"
                value={targetRepId}
                onChange={(e) => setTargetRepId(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-xs min-h-[44px] text-foreground focus:ring-1 focus:ring-primary"
              >
                {repMatrix.map((r) => (
                  <option key={r.repId} value={r.repId}>
                    {r.repName} ({r.lowestSkillArea}: {r.lowestScore}%)
                  </option>
                ))}
              </select>
            </div>

            {/* Scenario Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Select Practice Scenario</label>
              <select
                aria-label="Target practice scenario"
                value={targetScenarioId}
                onChange={(e) => setTargetScenarioId(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-xs min-h-[44px] text-foreground focus:ring-1 focus:ring-primary"
              >
                {scenarios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} ({s.category} • {s.difficulty})
                  </option>
                ))}
              </select>
            </div>

            {/* Deadline Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Completion Deadline</label>
              <input
                type="date"
                value={deadlineDate}
                onChange={(e) => setDeadlineDate(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-xs min-h-[44px] text-foreground focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Coaching Instructions */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Coaching Instructions</label>
              <Textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Specific guidance for the seller (e.g. emphasize ROI payback period instead of giving discounts)..."
                rows={3}
                className="text-xs resize-none"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setIsAssignModalOpen(false)}
              className="min-h-[44px] active:scale-[0.97]"
            >
              Cancel
            </Button>
            <Button
              disabled={isAssigning || !targetRepId || !targetScenarioId}
              onClick={handleAssignDrill}
              className="min-h-[44px] active:scale-[0.97] font-semibold"
            >
              {isAssigning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Confirm Assignment
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
