'use client';

/**
 * @fileOverview Agent Test Lab Drawer/Dialog (Phase 8 Milestone 5 Task 4)
 *
 * Implements theme.md Section 8 (Standardized Modal & Dialog Architecture):
 * - Surface & Geometry: `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`
 * - Demarcated Header: `<DialogHeader demarcated>` with min-h-[52px] sm:min-h-[56px]
 * - Zero Raw Descriptions: routed exclusively through `<CardInfoTooltip text="..." />`
 * - Accessible Screen Reader: `<DialogDescription className="sr-only">`
 * - Single-Circle Info Tooltip elevated at `z-[10050]`
 * - Demarcated Footer: `px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5`
 * - Tactile mechanical feedback: `rounded-xl active:scale-[0.97]`
 *
 * Rules:
 * - Rule 4: Zero `any` / Zero `any[]` strict typing.
 * - Rule 7: Mobile-first touch targets >= 44px with Emil Kowalski mechanical feel.
 * - Rule 42: Shadow Mode simulation execution verifying 0 live database mutations.
 * - Rule 60: Emergency Dead-Man Switch warning.
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
import {
  FlaskConical,
  Play,
  RotateCcw,
  Sparkles,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import type {
  CustomAgentPersona,
  AgentTestLabResult,
} from '@/platform/ui/builder/agent-builder-types';
import { BlastRadiusReportCard } from './BlastRadiusReportCard';
import { testAgentPersonaAction } from '@/app/actions/agent-builder-actions';

export interface AgentTestLabProps {
  persona: CustomAgentPersona | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SAMPLE_GOALS = [
  'Analyze deals stalled over 14 days and synthesize win strategy',
  'Enrich incoming leads and draft personalized follow-up outreach',
  'Search company brain memory and summarize key architecture decisions',
  'Audit contact communication logs and propose next best steps',
];

export function AgentTestLab({ persona, open, onOpenChange }: AgentTestLabProps) {
  const [goalPrompt, setGoalPrompt] = React.useState('');
  const [isSimulating, setIsSimulating] = React.useState(false);
  const [simulationResult, setSimulationResult] = React.useState<AgentTestLabResult | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Set default prompt when persona changes
  React.useEffect(() => {
    if (persona && !goalPrompt) {
      if (persona.capabilities.allowedDomains.includes('deals_revenue')) {
        setGoalPrompt(SAMPLE_GOALS[0]);
      } else if (persona.capabilities.allowedDomains.includes('lead_intelligence')) {
        setGoalPrompt(SAMPLE_GOALS[1]);
      } else {
        setGoalPrompt(SAMPLE_GOALS[2]);
      }
    }
  }, [persona, goalPrompt]);

  const handleRunSimulation = async () => {
    if (!persona || !goalPrompt.trim()) return;

    setIsSimulating(true);
    setErrorMessage(null);
    setSimulationResult(null);

    try {
      const res = await testAgentPersonaAction({
        personaId: persona.id,
        goalPrompt: goalPrompt.trim(),
        organizationId: persona.organizationId,
        workspaceId: persona.workspaceId,
        dryRun: true, // Rule 42 invariant
      });

      if (res.success && res.data) {
        setSimulationResult(res.data);
      } else {
        setErrorMessage(res.error?.message || 'Simulation execution failed');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unknown simulation error');
    } finally {
      setIsSimulating(false);
    }
  };

  const handleReset = () => {
    setSimulationResult(null);
    setErrorMessage(null);
  };

  if (!persona) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl p-0 overflow-hidden">
        {/* 1. Demarcated Header (theme.md §8) */}
        <DialogHeader demarcated className="min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20 px-6 py-3.5 sm:py-4">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary shrink-0" />
            <DialogTitle className="text-base sm:text-lg font-semibold tracking-tight text-foreground">
              Test Lab: {persona.identity.name}
            </DialogTitle>
            <CardInfoTooltip text="Execute Shadow Mode simulations (Rule 42) in a secure sandbox. Mutating operations are intercepted to verify zero database side-effects." />
          </div>
          <DialogDescription className="sr-only">
            Test Lab sandbox for validating agent execution in shadow simulation mode.
          </DialogDescription>
        </DialogHeader>

        {/* 2. Modal Body */}
        <div className="px-6 py-5 max-h-[70vh] overflow-y-auto space-y-4">
          {/* Quick Preset Goal Chips */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Sample Test Goals
              </span>
              <Badge variant="outline" className="font-mono text-[10px]">
                Shadow Mode Sandbox
              </Badge>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {SAMPLE_GOALS.map((goal, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setGoalPrompt(goal)}
                  className="rounded-xl border border-border/70 bg-muted/20 px-3 py-1.5 text-xs text-foreground/80 transition-all hover:bg-muted/40 hover:text-foreground active:scale-[0.97]"
                >
                  <Sparkles className="inline-block h-3 w-3 mr-1 text-primary" />
                  {goal}
                </button>
              ))}
            </div>
          </div>

          {/* Goal Prompt Input */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">
              Goal & Instructions Prompt
            </label>
            <textarea
              value={goalPrompt}
              onChange={(e) => setGoalPrompt(e.target.value)}
              placeholder="Describe the objective or task for this agent to execute..."
              rows={3}
              className="w-full rounded-xl border border-input bg-background/50 px-3.5 py-2.5 text-xs font-normal text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent resize-y"
            />
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-destructive text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Simulation Error:</span>
                <p className="mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Blast Radius Report Display */}
          {simulationResult && (
            <BlastRadiusReportCard
              blastRadius={simulationResult.blastRadius}
              trace={simulationResult.trace}
            />
          )}
        </div>

        {/* 3. Demarcated Footer (theme.md §8) */}
        <div className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-between gap-2.5">
          <div>
            {simulationResult && (
              <Button
                variant="ghost"
                size="sm"
                className="rounded-xl active:scale-[0.97] min-h-[44px] text-xs gap-1.5"
                onClick={handleReset}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset Sandbox
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="rounded-xl active:scale-[0.97] min-h-[44px] text-xs"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>

            <Button
              className="rounded-xl active:scale-[0.97] min-h-[44px] text-xs font-medium gap-1.5"
              onClick={handleRunSimulation}
              disabled={isSimulating || !goalPrompt.trim()}
            >
              {isSimulating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Simulating Shadow Execution...
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 fill-current" />
                  Run Shadow Simulation
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
