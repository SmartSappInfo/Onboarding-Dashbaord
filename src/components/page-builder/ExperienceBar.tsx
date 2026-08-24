'use client';

/**
 * @file src/components/page-builder/ExperienceBar.tsx
 * @description Studio Top Bar Switcher for CRM Personalized Experiences in SmartSapp Page Builder.
 * Allows authors to switch viewports between "Default Experience" and specific target audience variations.
 * 
 * ARCHITECTURAL RULE COMPLIANCE:
 * - Zero `any` or `any[]` types.
 * - Mobile Touch Target Optimization (`min-h-[44px]`).
 * - Accessible focus outlines and visual active states.
 */

import React from 'react';
import type { ExperienceRule, Audience } from '@/lib/types';
import { Layers, Plus, Users, Eye } from 'lucide-react';

export interface ExperienceBarProps {
  rules: ExperienceRule[];
  audiencesMap: Map<string, Audience>;
  activeRuleId: string | null;
  onSelectRule: (ruleId: string | null) => void;
  onCreateRule?: () => void;
}

export const ExperienceBar: React.FC<ExperienceBarProps> = ({
  rules,
  audiencesMap,
  activeRuleId,
  onSelectRule,
  onCreateRule,
}) => {
  return (
    <div className="w-full bg-background/95 backdrop-blur border-b border-border px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
      {/* Active Mode Title & Badge */}
      <div className="flex items-center gap-2">
        <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
          <Layers className="w-4 h-4" />
        </span>
        <span className="font-semibold text-foreground">Target Experience:</span>
        <span className="px-2.5 py-1 rounded-full bg-muted font-medium text-foreground border border-border/50 flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5 text-primary" />
          {activeRuleId
            ? rules.find((r) => r.id === activeRuleId)?.name || 'Custom Experience'
            : 'Default Experience (All Visitors)'}
        </span>
      </div>

      {/* Experience Select Buttons */}
      <div className="flex items-center gap-2 overflow-x-auto py-1 no-scrollbar">
        <button
          type="button"
          onClick={() => onSelectRule(null)}
          className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-medium transition-all active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            activeRuleId === null
              ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
              : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground'
          }`}
        >
          Default Base
        </button>

        {rules.map((rule) => {
          const audience = audiencesMap.get(rule.audienceId);
          const isSelected = activeRuleId === rule.id;

          return (
            <button
              key={rule.id}
              type="button"
              onClick={() => onSelectRule(rule.id)}
              className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-medium transition-all active:scale-[0.97] flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                isSelected
                  ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                  : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>{rule.name}</span>
              {audience && (
                <span className="opacity-75 text-[10px]">({audience.name})</span>
              )}
            </button>
          );
        })}

        {onCreateRule && (
          <button
            type="button"
            onClick={onCreateRule}
            className="min-h-[44px] px-3 py-2 rounded-xl text-xs font-medium border border-dashed border-border hover:border-primary/50 text-muted-foreground hover:text-primary active:scale-[0.97] transition-all flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Plus className="w-3.5 h-3.5" /> New Experience Rule
          </button>
        )}
      </div>
    </div>
  );
};
