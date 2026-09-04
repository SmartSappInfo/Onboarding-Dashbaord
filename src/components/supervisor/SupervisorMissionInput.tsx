'use client';

/**
 * @fileOverview CompanyBrain 2.0 Phase 7: Supervisor Mission Input Form
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Mobile & Touch Target Compliance:
 *    - All interactive elements maintain >= 44px min-height (`min-h-[44px]`).
 * 2. Emil Kowalski Micro-Interactions:
 *    - Tactile buttons with `active:scale-[0.97]`.
 * 3. Strict Zero-`any` & Zero-`unknown` Standard:
 *    - Props and state strictly typed.
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sparkles,
  Bot,
  Sliders,
  Play,
  Loader2,
  Building2,
  Briefcase,
  ListTodo,
  Users,
} from 'lucide-react';

export interface SupervisorMissionInputProps {
  onLaunch: (params: {
    objective: string;
    subjectId?: string;
    subjectType?: 'entity' | 'deal' | 'task' | 'meeting' | 'ticket';
    executionMode: 'autonomous' | 'step_by_step';
    maxSteps: number;
  }) => Promise<void>;
  isLoading: boolean;
  defaultSubjectId?: string;
  defaultSubjectType?: 'entity' | 'deal' | 'task' | 'meeting' | 'ticket';
}

const PRESET_MISSIONS = [
  {
    title: 'Commercial Risk & Renewal Audit',
    objective: 'Audit accounts at risk of churning, check recent customer notes for pricing complaints, and propose retention tasks.',
    subjectType: 'deal' as const,
  },
  {
    title: 'Knowledge Contradiction Scan',
    objective: 'Search institutional knowledge for conflicting pricing or fee policies and summarize active disputes.',
    subjectType: 'entity' as const,
  },
  {
    title: 'Account Opportunity Brief',
    objective: 'Assemble full context dossier, evaluate recent engagement signals, and generate executive talking points.',
    subjectType: 'entity' as const,
  },
];

export function SupervisorMissionInput({
  onLaunch,
  isLoading,
  defaultSubjectId = '',
  defaultSubjectType,
}: SupervisorMissionInputProps) {
  const [objective, setObjective] = React.useState('');
  const [subjectId, setSubjectId] = React.useState(defaultSubjectId);
  const [subjectType, setSubjectType] = React.useState<
    'entity' | 'deal' | 'task' | 'meeting' | 'ticket' | 'none'
  >(defaultSubjectType || 'none');
  const [executionMode, setExecutionMode] = React.useState<'autonomous' | 'step_by_step'>('autonomous');
  const [maxSteps, setMaxSteps] = React.useState(5);
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const handlePresetClick = (preset: typeof PRESET_MISSIONS[number]) => {
    setObjective(preset.objective);
    setSubjectType(preset.subjectType);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!objective.trim() || isLoading) return;

    await onLaunch({
      objective: objective.trim(),
      subjectId: subjectType !== 'none' && subjectId.trim() ? subjectId.trim() : undefined,
      subjectType: subjectType !== 'none' ? subjectType : undefined,
      executionMode,
      maxSteps,
    });
  };

  return (
    <Card className="border-border/80 shadow-sm overflow-hidden">
      <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Bot className="w-5 h-5 text-indigo-600" />
              <span>Launch Supervisor Mission</span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              State your business goal. The Supervisor will assemble context, decompose tasks, and execute governed MCP tools.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 space-y-4">
        {/* Mission Presets */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Quick Mission Presets
          </span>
          <div className="flex flex-wrap gap-2">
            {PRESET_MISSIONS.map((preset) => (
              <button
                key={preset.title}
                type="button"
                onClick={() => handlePresetClick(preset)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-200 text-xs text-slate-700 font-medium transition-all active:scale-[0.97] min-h-[44px] sm:min-h-[38px] text-left"
              >
                <Sparkles className="w-3 h-3 text-indigo-500 inline mr-1.5" />
                {preset.title}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Objective Textarea */}
          <div className="space-y-1.5">
            <Label htmlFor="mission-objective" className="text-xs font-semibold text-slate-800">
              Objective & Instructions
            </Label>
            <Textarea
              id="mission-objective"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="e.g. Investigate deal progress for Acme School, check customer notes for discount promises, and create an action item if stalled..."
              rows={3}
              className="text-sm bg-white border-slate-200 focus-visible:ring-indigo-500 min-h-[90px] rounded-xl resize-none"
              disabled={isLoading}
            />
          </div>

          {/* Target Subject Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="subject-type" className="text-xs font-semibold text-slate-800">
                Target Subject (Optional)
              </Label>
              <select
                id="subject-type"
                value={subjectType}
                onChange={(e) =>
                  setSubjectType(
                    e.target.value as 'entity' | 'deal' | 'task' | 'meeting' | 'ticket' | 'none'
                  )
                }
                className="w-full min-h-[44px] border border-slate-200 rounded-lg px-3 text-xs bg-white text-slate-800"
                disabled={isLoading}
              >
                <option value="none">General Workspace Objective</option>
                <option value="entity">Organization / Account</option>
                <option value="deal">Pipeline Deal</option>
                <option value="task">Operational Task</option>
                <option value="meeting">Client Meeting</option>
              </select>
            </div>

            {subjectType !== 'none' && (
              <div className="space-y-1.5">
                <Label htmlFor="subject-id" className="text-xs font-semibold text-slate-800">
                  Subject Identifier (ID)
                </Label>
                <Input
                  id="subject-id"
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  placeholder={`Enter ${subjectType} ID...`}
                  className="min-h-[44px] text-xs bg-white border-slate-200"
                  disabled={isLoading}
                />
              </div>
            )}
          </div>

          {/* Advanced Controls Toggle */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 min-h-[44px] sm:min-h-[36px]"
            >
              <Sliders className="w-3.5 h-3.5" />
              {showAdvanced ? 'Hide Advanced Options' : 'Show Advanced Execution Limits'}
            </button>

            {showAdvanced && (
              <div className="p-3.5 mt-2 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="max-steps" className="text-xs font-semibold text-slate-700">
                    Step Budget Limit ({maxSteps} Steps Max)
                  </Label>
                  <input
                    id="max-steps"
                    type="range"
                    min={1}
                    max={10}
                    value={maxSteps}
                    onChange={(e) => setMaxSteps(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                  <span className="text-[11px] text-slate-400">Caps agent execution steps (1 to 10).</span>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="exec-mode" className="text-xs font-semibold text-slate-700">
                    Autonomy Mode
                  </Label>
                  <select
                    id="exec-mode"
                    value={executionMode}
                    onChange={(e) => setExecutionMode(e.target.value as 'autonomous' | 'step_by_step')}
                    className="w-full min-h-[44px] border border-slate-200 rounded-lg px-2.5 text-xs bg-white text-slate-800"
                  >
                    <option value="autonomous">Autonomous (Auto-run read-only tools)</option>
                    <option value="step_by_step">Step-by-Step (Plan only, wait for click)</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="pt-2 flex justify-end">
            <Button
              type="submit"
              disabled={!objective.trim() || isLoading}
              className="min-h-[44px] px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl active:scale-[0.97] transition-all gap-2 shadow-sm"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Planning Mission...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>Execute Mission</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
