'use client';

/**
 * @fileOverview CompanyBrain 2.0 Phase 8: Swarm Mission Control & Multi-Agent Launcher
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Multi-Agent Swarm Orchestration:
 *    - Allows operators to formulate objectives, toggle participating specialists, and select modes.
 * 2. Mobile Accessibility:
 *    - Min interactive touch targets >= 44px (`min-h-[44px]`).
 * 3. Emil Kowalski Micro-Interactions:
 *    - `active:scale-[0.97]` on all buttons and chips.
 * 4. Strict Zero-`any` & Zero-`unknown` Invariant (Rule 1).
 */

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Sparkles,
  Users,
  Play,
  RotateCw,
  BookOpen,
  TrendingUp,
  Calendar,
  Target,
  CheckSquare,
  ShieldAlert,
} from 'lucide-react';
import type {
  DomainSpecialistId,
  SwarmMode,
  SwarmMissionRequest,
  SwarmRun,
} from '@/lib/agents/domain-types';
import { startSwarmMissionAction } from '@/lib/agents/actions/domain-agent-actions';
import { useToast } from '@/hooks/use-toast';

export interface SwarmMissionControlProps {
  workspaceId: string;
  organizationId: string;
  userId: string;
  onMissionCompleted: (run: SwarmRun) => void;
  initialSpecialistId?: DomainSpecialistId;
}

interface DomainPreset {
  title: string;
  objective: string;
  specialists: DomainSpecialistId[];
  mode: SwarmMode;
}

const DOMAIN_PRESETS: DomainPreset[] = [
  {
    title: 'Account Risk & Expansion Audit',
    objective: 'Evaluate historical commitments, pricing agreements, and deal velocity to identify expansion vectors or churn risks.',
    specialists: ['knowledge_specialist', 'revenue_specialist', 'governance_specialist'],
    mode: 'parallel_consensus',
  },
  {
    title: 'Executive Meeting Prep & Follow-up',
    objective: 'Synthesize past discussion lore, verify open attendee action items, and draft a 1-page executive briefing.',
    specialists: ['meeting_specialist', 'knowledge_specialist', 'operations_specialist'],
    mode: 'sequential_pipeline',
  },
  {
    title: 'Enterprise Prospect Qualification',
    objective: 'Analyze ICP fit, extract key customer onboarding pain points, and formulate personalized discovery talking points.',
    specialists: ['sdr_specialist', 'revenue_specialist', 'knowledge_specialist'],
    mode: 'parallel_consensus',
  },
];

export function SwarmMissionControl({
  workspaceId,
  organizationId,
  userId,
  onMissionCompleted,
  initialSpecialistId,
}: SwarmMissionControlProps) {
  const { toast } = useToast();

  const [objective, setObjective] = React.useState('');
  const [selectedSpecialists, setSelectedSpecialists] = React.useState<DomainSpecialistId[]>(
    initialSpecialistId
      ? [initialSpecialistId, 'knowledge_specialist']
      : ['knowledge_specialist', 'revenue_specialist', 'governance_specialist']
  );
  const [mode, setMode] = React.useState<SwarmMode>('parallel_consensus');
  const [isRunning, setIsRunning] = React.useState(false);

  const availableSpecialists: { id: DomainSpecialistId; name: string; icon: React.ReactNode }[] = [
    { id: 'knowledge_specialist', name: 'Knowledge', icon: <BookOpen className="w-3.5 h-3.5" /> },
    { id: 'revenue_specialist', name: 'Revenue', icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { id: 'meeting_specialist', name: 'Meeting', icon: <Calendar className="w-3.5 h-3.5" /> },
    { id: 'sdr_specialist', name: 'SDR', icon: <Target className="w-3.5 h-3.5" /> },
    { id: 'operations_specialist', name: 'Operations', icon: <CheckSquare className="w-3.5 h-3.5" /> },
    { id: 'governance_specialist', name: 'Governance', icon: <ShieldAlert className="w-3.5 h-3.5" /> },
  ];

  const handleToggleSpecialist = (id: DomainSpecialistId) => {
    if (selectedSpecialists.includes(id)) {
      if (selectedSpecialists.length === 1) {
        toast({
          title: 'Specialist Required',
          description: 'A swarm mission requires at least one participating specialist.',
          variant: 'destructive',
        });
        return;
      }
      setSelectedSpecialists(selectedSpecialists.filter((s) => s !== id));
    } else {
      setSelectedSpecialists([...selectedSpecialists, id]);
    }
  };

  const handleApplyPreset = (preset: DomainPreset) => {
    setObjective(preset.objective);
    setSelectedSpecialists(preset.specialists);
    setMode(preset.mode);
  };

  const handleLaunchMission = async () => {
    if (!objective.trim()) {
      toast({
        title: 'Objective Required',
        description: 'Please describe the objective for the agent swarm.',
        variant: 'destructive',
      });
      return;
    }

    setIsRunning(true);
    try {
      const request: SwarmMissionRequest = {
        workspaceId,
        organizationId,
        actor: {
          type: 'user',
          id: userId,
        },
        objective: objective.trim(),
        specialistIds: selectedSpecialists,
        mode,
      };

      const res = await startSwarmMissionAction(request);

      if (res.success && res.data) {
        toast({
          title: 'Swarm Mission Completed',
          description: `Consulted ${res.data.specialistIds.length} specialists. Consensus generated.`,
          actionConfig: {
            path: '/admin/companybrain/agents',
            label: 'View Results',
          },
        });
        onMissionCompleted(res.data);
      } else {
        toast({
          title: 'Mission Encountered Error',
          description: res.error || 'Failed to complete swarm mission.',
          variant: 'destructive',
          actionConfig: {
            path: '/admin/companybrain/agents',
            label: 'Review',
          },
        });
      }
    } catch (err) {
      toast({
        title: 'Execution Exception',
        description: err instanceof Error ? err.message : 'Unknown exception occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 shadow-sm space-y-6">
      {/* Title & Presets */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-900/50">
              <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Swarm Collaboration Console
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Assemble multi-specialist swarms for high-stakes analysis and consensus
              </p>
            </div>
          </div>
        </div>

        {/* Preset chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] font-semibold text-slate-500 mr-1">
            Quick Templates:
          </span>
          {DOMAIN_PRESETS.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleApplyPreset(p)}
              className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-purple-950/40 text-[11px] font-medium text-slate-700 dark:text-slate-300 transition-all active:scale-[0.97] min-h-[44px] sm:min-h-[36px] flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3 text-purple-500" />
              <span>{p.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Objective Input */}
      <div className="space-y-2">
        <label htmlFor="swarm-obj" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          Swarm Mission Objective
        </label>
        <textarea
          id="swarm-obj"
          rows={3}
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          placeholder="e.g. Conduct comprehensive commercial and compliance audit for Acme Health, verify past contract handshake agreements, and identify deal acceleration actions..."
          className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-inner"
        />
      </div>

      {/* Specialist Selection Chips */}
      <div className="space-y-2">
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          Select Participating Specialists ({selectedSpecialists.length} active)
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          {availableSpecialists.map((spec) => {
            const isSelected = selectedSpecialists.includes(spec.id);
            return (
              <button
                key={spec.id}
                type="button"
                onClick={() => handleToggleSpecialist(spec.id)}
                className={`p-2.5 rounded-xl border text-xs font-medium flex flex-col items-center justify-center gap-1.5 transition-all min-h-[52px] active:scale-[0.97] ${
                  isSelected
                    ? 'border-purple-600 bg-purple-50/70 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 font-semibold shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400'
                }`}
              >
                {spec.icon}
                <span>{spec.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Collaboration Mode Toggle */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Execution Mode:
          </span>
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setMode('parallel_consensus')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all min-h-[38px] active:scale-[0.97] ${
                mode === 'parallel_consensus'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm font-semibold'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Parallel Consensus
            </button>
            <button
              type="button"
              onClick={() => setMode('sequential_pipeline')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all min-h-[38px] active:scale-[0.97] ${
                mode === 'sequential_pipeline'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm font-semibold'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Sequential Pipeline
            </button>
          </div>
        </div>

        {/* Launch Button */}
        <Button
          onClick={handleLaunchMission}
          disabled={isRunning || !objective.trim()}
          className="w-full sm:w-auto min-h-[44px] px-6 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl shadow-md transition-all active:scale-[0.97] flex items-center justify-center gap-2"
        >
          {isRunning ? (
            <>
              <RotateCw className="w-4 h-4 animate-spin" />
              <span>Coordinating Swarm...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Launch Swarm Mission</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
