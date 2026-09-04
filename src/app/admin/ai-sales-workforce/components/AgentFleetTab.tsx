'use client';

/**
 * @fileoverview Agent Fleet Tab Component (Phase 9).
 *
 * ARCHITECTURAL POINTER:
 * Fulfills SmartSapp Sales Performance & Intelligence 2.0 UX Screen 1 (Agent Fleet):
 * - Roster of all 8 specialized AI Sales Agents (Prioritization, Deal, Coaching, Conversation, CRM Hygiene, Workload, Forecast, Manager).
 * - Autonomy maturity level indicators (Level 0: Observe to Level 4: Autonomous).
 * - Model assignment badges, accuracy meters, and execution counters.
 * - Interactive dialog to configure autonomy levels with detailed permission explanations.
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Sparkles,
  Compass,
  GraduationCap,
  MessageSquare,
  ShieldCheck,
  Users,
  TrendingUp,
  ShieldAlert,
  Bot,
  Cpu,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Eye,
  FileText,
  Lock,
} from 'lucide-react';
import type {
  AiAgentProfile,
  AiAutonomyLevel,
} from '@/lib/ai-sales-workforce/types';
import { updateAgentAutonomyLevelAction } from '@/app/actions/ai-sales-workforce-actions';
import { useToast } from '@/hooks/use-toast';

interface AgentFleetTabProps {
  agents: AiAgentProfile[];
  workspaceId: string;
  organizationId: string;
  actorId: string;
  onRefresh: () => void;
}

export function AgentFleetTab({
  agents,
  workspaceId,
  organizationId,
  actorId,
  onRefresh,
}: AgentFleetTabProps) {
  const { toast } = useToast();
  const [selectedAgent, setSelectedAgent] = React.useState<AiAgentProfile | null>(null);
  const [targetLevel, setTargetLevel] = React.useState<AiAutonomyLevel>(1);
  const [isUpdating, setIsUpdating] = React.useState(false);

  const getAgentIcon = (type: string) => {
    switch (type) {
      case 'prioritization':
        return <Sparkles className="h-5 w-5 text-amber-500" />;
      case 'deal_intelligence':
        return <Compass className="h-5 w-5 text-blue-500" />;
      case 'coaching':
        return <GraduationCap className="h-5 w-5 text-emerald-500" />;
      case 'conversation':
        return <MessageSquare className="h-5 w-5 text-purple-500" />;
      case 'crm_hygiene':
        return <ShieldCheck className="h-5 w-5 text-cyan-500" />;
      case 'workload':
        return <Users className="h-5 w-5 text-indigo-500" />;
      case 'forecast':
        return <TrendingUp className="h-5 w-5 text-rose-500" />;
      case 'manager':
        return <ShieldAlert className="h-5 w-5 text-orange-500" />;
      default:
        return <Bot className="h-5 w-5 text-primary" />;
    }
  };

  const getAutonomyBadge = (level: AiAutonomyLevel) => {
    switch (level) {
      case 0:
        return <Badge variant="secondary" className="text-xs font-semibold gap-1"><Eye className="h-3 w-3" /> Level 0: Observe</Badge>;
      case 1:
        return <Badge className="bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20 text-xs font-semibold gap-1"><AlertCircle className="h-3 w-3" /> Level 1: Recommend</Badge>;
      case 2:
        return <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-xs font-semibold gap-1"><FileText className="h-3 w-3" /> Level 2: Prepare</Badge>;
      case 3:
        return <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 text-xs font-semibold gap-1"><Lock className="h-3 w-3" /> Level 3: Approve</Badge>;
      case 4:
        return <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs font-semibold gap-1"><CheckCircle2 className="h-3 w-3" /> Level 4: Autonomous</Badge>;
    }
  };

  const handleOpenConfig = (agent: AiAgentProfile) => {
    setSelectedAgent(agent);
    setTargetLevel(agent.currentAutonomyLevel);
  };

  const handleSaveLevel = async () => {
    if (!selectedAgent) return;
    try {
      setIsUpdating(true);
      const res = await updateAgentAutonomyLevelAction({
        workspaceId,
        organizationId,
        actorId,
        agentId: selectedAgent.id,
        newLevel: targetLevel,
      });

      if (res.success) {
        toast({
          title: 'Autonomy Level Updated',
          description: `${selectedAgent.name} is now operating at Autonomy Level ${targetLevel}.`,
        });
        setSelectedAgent(null);
        onRefresh();
      } else {
        toast({
          title: 'Update Failed',
          description: res.error || 'Could not update agent autonomy.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to update agent autonomy.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Specialized AI Agent Swarm (8 Agents)
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Role-specialized autonomous agents executing governed intelligence workflows across your CRM.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {agents.map((agent) => (
          <Card
            key={agent.id}
            className="border-border/70 rounded-2xl bg-card shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
          >
            <CardHeader className="pb-3 px-5 pt-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-xl bg-muted/60 border border-border/50">
                    {getAgentIcon(agent.type)}
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold text-foreground">
                      {agent.name}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {agent.roleTitle}
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                {agent.description}
              </p>

              <div className="flex items-center gap-1.5 flex-wrap">
                {getAutonomyBadge(agent.currentAutonomyLevel)}
                <Badge variant="outline" className="text-2xs text-muted-foreground gap-1">
                  <Cpu className="h-3 w-3" />
                  {agent.defaultModel.split('/').pop() || 'gemini'}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="px-5 pb-5 pt-0 space-y-4">
              <div className="p-3 rounded-xl bg-muted/30 border border-border/40 grid grid-cols-2 gap-2 text-center">
                <div>
                  <div className="text-2xs text-muted-foreground">Accuracy</div>
                  <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {agent.accuracyScore}%
                  </div>
                </div>
                <div>
                  <div className="text-2xs text-muted-foreground">Executions</div>
                  <div className="text-xs font-bold text-foreground mt-0.5">
                    {agent.totalExecutions.toLocaleString()}
                  </div>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleOpenConfig(agent)}
                className="w-full h-10 rounded-xl text-xs font-semibold min-h-[44px] active:scale-[0.97] transition-transform gap-1.5"
              >
                <Sliders className="h-3.5 w-3.5 text-primary" />
                <span>Configure Autonomy</span>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Autonomy Level Configuration Dialog */}
      {selectedAgent && (
        <Dialog open={!!selectedAgent} onOpenChange={(open) => !open && setSelectedAgent(null)}>
          <DialogContent className="max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Sliders className="h-5 w-5 text-primary" />
                Configure Autonomy: {selectedAgent.name}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Govern how freely this agent can execute operations within your workspace.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-3">
              {([0, 1, 2, 3, 4] as AiAutonomyLevel[]).map((level) => (
                <div
                  key={level}
                  onClick={() => setTargetLevel(level)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start justify-between gap-3 ${
                    targetLevel === level
                      ? 'border-primary bg-primary/5 shadow-xs'
                      : 'border-border/60 hover:border-border hover:bg-muted/40'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-foreground flex items-center gap-2">
                      {getAutonomyBadge(level)}
                    </div>
                    <p className="text-2xs text-muted-foreground mt-1">
                      {level === 0 && 'AI monitors trends silently; no outward recommendations or actions.'}
                      {level === 1 && 'AI surfaces prioritized recommendations on dashboards for review.'}
                      {level === 2 && 'AI prepares draft emails, tasks, and notes ready for 1-click seller review.'}
                      {level === 3 && 'AI creates pending approval requests requiring explicit human sign-off.'}
                      {level === 4 && 'AI autonomously executes actions when confidence is >= 85% within policy bounds.'}
                    </p>
                  </div>
                  <div
                    className={`h-4 w-4 rounded-full border flex items-center justify-center shrink-0 mt-1 ${
                      targetLevel === level
                        ? 'border-primary bg-primary'
                        : 'border-muted-foreground/40'
                    }`}
                  >
                    {targetLevel === level && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </div>
                </div>
              ))}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedAgent(null)}
                disabled={isUpdating}
                className="h-10 rounded-xl text-xs font-semibold min-h-[44px]"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveLevel}
                disabled={isUpdating}
                className="h-10 rounded-xl text-xs font-semibold min-h-[44px] active:scale-[0.97]"
              >
                {isUpdating ? 'Saving...' : 'Apply Autonomy Level'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
