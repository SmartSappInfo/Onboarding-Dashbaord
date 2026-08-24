'use client';

/**
 * @file src/components/page-builder/CampaignOrchestratorPanel.tsx
 * @description Studio Control Center Dashboard for Autonomous Campaign Orchestration & Closed-Loop CRM.
 * Displays cross-channel conversion funnels, revenue attribution metrics, WhatsApp/email automation statuses,
 * and 1-click autonomous campaign activation controls.
 * 
 * ARCHITECTURAL RULE COMPLIANCE:
 * - Zero `any` or `any[]` types.
 * - Mobile Touch Target Optimization (`min-h-[44px]`).
 * - Accessible focus outlines and visual active states.
 */

import React from 'react';
import type { CampaignOrchestration } from '@/lib/types';
import { Rocket, Play, Pause, Users, MessageSquare, Mail, DollarSign, ArrowRight } from 'lucide-react';

export interface CampaignOrchestratorPanelProps {
  orchestration: CampaignOrchestration | null;
  onToggleOrchestrationStatus: () => void;
  onCreateOrchestration?: () => void;
}

export const CampaignOrchestratorPanel: React.FC<CampaignOrchestratorPanelProps> = ({
  orchestration,
  onToggleOrchestrationStatus,
}) => {
  if (!orchestration) return null;

  const isRunning = orchestration.status === 'active';
  const metrics = orchestration.metrics || {
    totalVisitors: 0,
    totalLeads: 0,
    totalDeals: 0,
    totalRevenue: 0,
    conversionRate: 0,
  };

  return (
    <div className="w-full bg-background border border-border rounded-2xl p-4 space-y-4 shadow-sm">
      {/* Header & Status Toggle */}
      <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-2.5">
          <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Rocket className="w-4 h-4" />
          </span>
          <div>
            <h4 className="font-semibold text-xs text-foreground flex items-center gap-1.5">
              <span>{orchestration.name}</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] uppercase font-bold">
                ({orchestration.status})
              </span>
            </h4>
            <p className="text-[11px] text-muted-foreground">
              Closed-loop attribution model: {orchestration.attributionModel.replace('_', ' ')}
            </p>
          </div>
        </div>

        <button
          type="button"
          aria-pressed={isRunning}
          aria-label={isRunning ? 'Pause Campaign Orchestration' : 'Activate Campaign Orchestration'}
          onClick={onToggleOrchestrationStatus}
          className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold active:scale-[0.97] transition-all flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            isRunning
              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
              : 'bg-emerald-600 text-white hover:bg-emerald-700'
          }`}
        >
          {isRunning ? (
            <>
              <Pause className="w-3.5 h-3.5" /> Pause Orchestration
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5" /> Activate Orchestration
            </>
          )}
        </button>
      </div>

      {/* Cross-Channel Funnel Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <div className="p-3 rounded-xl bg-muted/40 border border-border/50 space-y-1">
          <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
            <Users className="w-3 h-3 text-blue-500" /> Total Visitors
          </span>
          <p className="text-sm font-bold text-foreground">{metrics.totalVisitors}</p>
        </div>

        <div className="p-3 rounded-xl bg-muted/40 border border-border/50 space-y-1">
          <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
            <MessageSquare className="w-3 h-3 text-purple-500" /> Total Leads
          </span>
          <p className="text-sm font-bold text-foreground">{metrics.totalLeads}</p>
        </div>

        <div className="p-3 rounded-xl bg-muted/40 border border-border/50 space-y-1">
          <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
            <Mail className="w-3 h-3 text-amber-500" /> Won Deals
          </span>
          <p className="text-sm font-bold text-foreground">{metrics.totalDeals}</p>
        </div>

        <div className="p-3 rounded-xl bg-muted/40 border border-border/50 space-y-1">
          <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
            <DollarSign className="w-3 h-3 text-emerald-500" /> Total Revenue
          </span>
          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
            ${metrics.totalRevenue.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Cross-Channel Automation Pipeline Flow */}
      <div className="p-3.5 rounded-xl bg-muted/20 border border-border/50 space-y-2">
        <h5 className="font-semibold text-xs text-foreground">Cross-Channel Automation Sequence</h5>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">
            1. Landing Page Conversion
          </span>
          <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
          <span className="px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 font-medium">
            2. Apply CRM Contact Tags
          </span>
          <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
            3. WhatsApp Outreach
          </span>
          <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
          <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
            4. Closed-Loop Revenue Attribution
          </span>
        </div>
      </div>
    </div>
  );
};
