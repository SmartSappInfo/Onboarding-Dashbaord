'use client';

/**
 * @fileOverview CompanyBrain 2.0 Phase 8: Domain Specialist Roster Grid
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Persona Discovery:
 *    - Renders visual status cards for all domain specialists with capabilities & tools.
 * 2. Mobile Accessibility:
 *    - Responsive grid (1 col mobile, 2 col tablet, 3 col desktop) with >= 44px touch targets.
 * 3. Emil Kowalski Micro-Interactions:
 *    - `active:scale-[0.97]` on all buttons, smooth hover borders.
 * 4. Strict Zero-`any` & Zero-`unknown` Invariant (Rule 1).
 */

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  BookOpen,
  TrendingUp,
  Calendar,
  Target,
  CheckSquare,
  ShieldAlert,
  Sliders,
  Play,
  Wrench,
  Bot,
} from 'lucide-react';
import type { SpecialistDescriptor, DomainSpecialistId } from '@/lib/agents/domain-types';

export interface SpecialistRosterGridProps {
  specialists: SpecialistDescriptor[];
  onSelectSpecialist: (specialist: SpecialistDescriptor) => void;
  onQuickDispatch?: (specialistId: DomainSpecialistId) => void;
}

export function SpecialistRosterGrid({
  specialists,
  onSelectSpecialist,
  onQuickDispatch,
}: SpecialistRosterGridProps) {
  const getIcon = (id: string) => {
    switch (id) {
      case 'knowledge_specialist':
        return <BookOpen className="w-5 h-5 text-violet-600" />;
      case 'revenue_specialist':
        return <TrendingUp className="w-5 h-5 text-emerald-600" />;
      case 'meeting_specialist':
        return <Calendar className="w-5 h-5 text-blue-600" />;
      case 'sdr_specialist':
        return <Target className="w-5 h-5 text-amber-600" />;
      case 'operations_specialist':
        return <CheckSquare className="w-5 h-5 text-cyan-600" />;
      case 'governance_specialist':
        return <ShieldAlert className="w-5 h-5 text-rose-600" />;
      default:
        return <Bot className="w-5 h-5 text-indigo-600" />;
    }
  };

  const getThemeBg = (id: string) => {
    switch (id) {
      case 'knowledge_specialist':
        return 'bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-900/50';
      case 'revenue_specialist':
        return 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50';
      case 'meeting_specialist':
        return 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/50';
      case 'sdr_specialist':
        return 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50';
      case 'operations_specialist':
        return 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-200 dark:border-cyan-900/50';
      case 'governance_specialist':
        return 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/50';
      default:
        return 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900/50';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {specialists.map((spec) => (
        <div
          key={spec.id}
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
        >
          <div className="space-y-3">
            {/* Header: Avatar, Name & Category */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl border ${getThemeBg(spec.id)}`}>
                  {getIcon(spec.id)}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {spec.name}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {spec.roleTitle}
                  </p>
                </div>
              </div>
              <Badge
                variant="outline"
                className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 bg-slate-50 dark:bg-slate-800"
              >
                {spec.category}
              </Badge>
            </div>

            {/* Description */}
            <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
              {spec.personaDescription}
            </p>

            {/* Capabilities badges */}
            <div className="flex flex-wrap gap-1">
              {spec.capabilities.slice(0, 3).map((cap) => (
                <span
                  key={cap}
                  className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                >
                  {cap.replace('_', ' ')}
                </span>
              ))}
              {spec.capabilities.length > 3 && (
                <span className="px-1.5 py-0.5 rounded-md text-[10px] text-slate-400">
                  +{spec.capabilities.length - 3}
                </span>
              )}
            </div>
          </div>

          {/* Footer: Tools Count & Action Buttons */}
          <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Wrench className="w-3.5 h-3.5 text-slate-400" />
                <span>{spec.allowedTools.length} Allowed Tools</span>
              </span>
              <span className="capitalize text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {spec.defaultAutonomy.replace('_', ' ')}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSelectSpecialist(spec)}
                className="min-h-[44px] text-xs font-medium rounded-xl border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[0.97] transition-all flex items-center justify-center gap-1.5"
              >
                <Sliders className="w-3.5 h-3.5 text-slate-500" />
                <span>Configure</span>
              </Button>

              {onQuickDispatch && (
                <Button
                  size="sm"
                  onClick={() => onQuickDispatch(spec.id)}
                  className="min-h-[44px] text-xs font-medium rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 active:scale-[0.97] transition-all flex items-center justify-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Dispatch</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
