'use client';

/**
 * @fileOverview Zone 3 Agent Health Data Grid for 26 Canonical Personas (Phase 14 Milestone 5 Task 4)
 *
 * Implements:
 * - Rule 4: Strict Typing Protocol (Zero `any` or `any[]`).
 * - Rule 7: Mobile-first responsive touch targets, tactile feedback (`active:scale-[0.97]`).
 * - Rule 10: Inline Architectural Documentation.
 * - Rule 11: Mathematical Determinism (Integer health scores 0–100).
 * - Rule 12: Canonical Risk Vocabulary.
 * - Rule 17: Non-Delegable Actions (Manual circuit breaker reset trigger).
 * - Rule 24: Dynamic Circuit Breakers (`CLOSED`, `DEGRADED`, `OPEN`, `HALF_OPEN`).
 * - Rule 42: Shadow Mode Badge (0 Live Mutations).
 * - `docs/agents_mcp/agents_mcp_ui.md` (3616–3630).
 * - `theme.md` §8 (Standardized Button & Status Architecture).
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  RotateCcw,
  Eye,
  Bot,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AgentHealthScorecard } from '@/platform/verification/health/health-types';
import type { AgentHealthDomainFilter } from '@/platform/verification/ui/verification-ui-types';

export interface AgentHealthTableProps {
  scorecards: AgentHealthScorecard[];
  onInspectPersona: (scorecard: AgentHealthScorecard) => void;
  onResetPersona: (scorecard: AgentHealthScorecard) => void;
  statusFilter: string;
  domainFilter: AgentHealthDomainFilter;
  searchQuery: string;
}

export function getPersonaDomain(personaId: string): AgentHealthDomainFilter {
  if (
    personaId.startsWith('crm') ||
    personaId === 'deal_coach' ||
    personaId === 'portal_guide' ||
    personaId === 'deal_strategist' ||
    personaId === 'lead_analyst' ||
    personaId === 'task_coordinator' ||
    personaId === 'knowledge_analyst'
  ) {
    return 'CRM';
  }
  if (
    personaId.startsWith('prospecting') ||
    personaId.startsWith('enrichment') ||
    personaId.startsWith('qualification') ||
    personaId === 'lead_sdr' ||
    personaId === 'lead_researcher'
  ) {
    return 'SALES';
  }
  if (personaId.startsWith('meeting')) {
    return 'MEETINGS';
  }
  if (personaId.startsWith('knowledge')) {
    return 'KNOWLEDGE';
  }
  if (
    personaId.startsWith('billing') ||
    personaId.startsWith('collections') ||
    personaId.startsWith('reconciliation') ||
    personaId.startsWith('revenue') ||
    personaId.startsWith('invoice') ||
    personaId.startsWith('finance')
  ) {
    return 'FINANCE';
  }
  if (
    personaId.startsWith('school') ||
    personaId.startsWith('attendance') ||
    personaId.startsWith('fee_collection')
  ) {
    return 'SCHOOL';
  }
  if (personaId === 'supervisor') {
    return 'SUPERVISOR';
  }
  return 'CRM';
}

export function formatPersonaName(personaId: string): string {
  return personaId
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function AgentHealthTable({
  scorecards,
  onInspectPersona,
  onResetPersona,
  statusFilter,
  domainFilter,
  searchQuery,
}: AgentHealthTableProps): React.JSX.Element {
  const filteredScorecards = React.useMemo(() => {
    return scorecards.filter((sc) => {
      const domain = getPersonaDomain(sc.personaId);

      // Domain filter
      if (domainFilter !== 'ALL' && domain !== domainFilter) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'HEALTHY' && sc.status !== 'HEALTHY') return false;
        if (statusFilter === 'DEGRADED' && sc.status !== 'DEGRADED') return false;
        if (statusFilter === 'TRIPPED' && sc.circuitState !== 'OPEN') return false;
        if (
          statusFilter === 'SHADOW_MODE' &&
          sc.degradationMode !== 'SHADOW_MODE'
        ) {
          return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = formatPersonaName(sc.personaId).toLowerCase().includes(query);
        const matchesId = sc.personaId.toLowerCase().includes(query);
        const matchesDomain = domain.toLowerCase().includes(query);
        if (!matchesName && !matchesId && !matchesDomain) return false;
      }

      return true;
    });
  }, [scorecards, statusFilter, domainFilter, searchQuery]);

  const getScoreBadge = (score: number) => {
    if (score >= 80) {
      return (
        <Badge
          variant="outline"
          className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 font-mono text-xs font-semibold"
        >
          {score} / 100
        </Badge>
      );
    }
    if (score >= 60) {
      return (
        <Badge
          variant="outline"
          className="border-amber-500/30 text-amber-500 bg-amber-500/10 font-mono text-xs font-semibold"
        >
          {score} / 100
        </Badge>
      );
    }
    return (
      <Badge variant="destructive" className="font-mono text-xs font-semibold">
        {score} / 100
      </Badge>
    );
  };

  const getCircuitBadge = (sc: AgentHealthScorecard) => {
    const state = sc.circuitState;
    if (state === 'OPEN') {
      return (
        <div className="flex flex-col items-start gap-1">
          <Badge variant="destructive" className="text-[10px] font-mono uppercase">
            OPEN (Tripped)
          </Badge>
          <span className="text-[10px] text-amber-500 font-medium">
            Shadow Mode (0 writes)
          </span>
        </div>
      );
    }
    if (state === 'DEGRADED') {
      return (
        <Badge
          variant="outline"
          className="border-amber-500/30 text-amber-500 bg-amber-500/10 text-[10px] font-mono uppercase"
        >
          DEGRADED
        </Badge>
      );
    }
    if (state === 'HALF_OPEN') {
      return (
        <Badge
          variant="outline"
          className="border-blue-500/30 text-blue-500 bg-blue-500/10 text-[10px] font-mono uppercase"
        >
          HALF_OPEN (Probing)
        </Badge>
      );
    }
    return (
      <Badge
        variant="outline"
        className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 text-[10px] font-mono uppercase"
      >
        CLOSED (Healthy)
      </Badge>
    );
  };

  return (
    <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border/80 bg-muted/20 text-muted-foreground font-semibold">
              <th className="py-3.5 px-4 font-medium">Persona</th>
              <th className="py-3.5 px-4 font-medium">Domain</th>
              <th className="py-3.5 px-4 font-medium">Health Score</th>
              <th className="py-3.5 px-4 font-medium">Circuit State</th>
              <th className="py-3.5 px-4 font-medium">Success Rate</th>
              <th className="py-3.5 px-4 font-medium">Recovery Rate</th>
              <th className="py-3.5 px-4 font-medium">Avg Latency</th>
              <th className="py-3.5 px-4 font-medium">Errors (Window)</th>
              <th className="py-3.5 px-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {filteredScorecards.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-muted-foreground text-xs">
                  No agent personas match the selected filters.
                </td>
              </tr>
            ) : (
              filteredScorecards.map((sc) => {
                const domain = getPersonaDomain(sc.personaId);
                const isTripped = sc.circuitState === 'OPEN';

                return (
                  <tr
                    key={sc.personaId}
                    className={cn(
                      'transition-colors hover:bg-muted/50 even:bg-muted/30 dark:even:bg-muted/15',
                      isTripped && 'bg-destructive/5 even:bg-destructive/10'
                    )}
                  >
                    {/* 1. Persona */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-muted/50 border border-border flex items-center justify-center shrink-0">
                          <Bot className="w-3.5 h-3.5 text-foreground" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground text-xs">
                            {formatPersonaName(sc.personaId)}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {sc.personaId}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* 2. Domain */}
                    <td className="py-3.5 px-4">
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {domain}
                      </Badge>
                    </td>

                    {/* 3. Health Score */}
                    <td className="py-3.5 px-4">{getScoreBadge(sc.healthScore)}</td>

                    {/* 4. Circuit State */}
                    <td className="py-3.5 px-4">{getCircuitBadge(sc)}</td>

                    {/* 5. Success Rate */}
                    <td className="py-3.5 px-4 font-mono font-medium">
                      <span
                        className={
                          sc.successRate >= 85
                            ? 'text-foreground'
                            : 'text-destructive font-semibold'
                        }
                      >
                        {sc.successRate}%
                      </span>
                    </td>

                    {/* 6. Recovery Rate */}
                    <td className="py-3.5 px-4 font-mono font-medium text-foreground">
                      {sc.recoveryRate}%
                    </td>

                    {/* 7. Avg Latency */}
                    <td className="py-3.5 px-4 font-mono text-muted-foreground">
                      {sc.avgDurationMs}ms
                    </td>

                    {/* 8. Errors Count */}
                    <td className="py-3.5 px-4 font-mono">
                      <span
                        className={
                          sc.consecutiveFailures > 0
                            ? 'text-destructive font-semibold'
                            : 'text-muted-foreground'
                        }
                      >
                        {sc.consecutiveFailures}
                      </span>
                    </td>

                    {/* 9. Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => onInspectPersona(sc)}
                          className="h-8 px-2.5 text-xs rounded-xl active:scale-[0.97]"
                          title="Inspect latest execution verification"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                          Inspect
                        </Button>

                        <Button
                          type="button"
                          size="sm"
                          variant={isTripped ? 'destructive' : 'outline'}
                          onClick={() => onResetPersona(sc)}
                          className={cn(
                            'h-8 px-2.5 text-xs rounded-xl active:scale-[0.97]',
                            !isTripped && 'text-muted-foreground'
                          )}
                          title="Manual Circuit Breaker Reset (Human Only)"
                        >
                          <RotateCcw className="w-3.5 h-3.5 mr-1" />
                          Reset
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
