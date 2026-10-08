'use client';

/**
 * @fileOverview Standardized Agent Persona Detail Modal (Phase 15 Milestone 4 Task 6)
 *
 * Implements theme.md Section 8 (Standardized Modal & Dialog Architecture):
 * - Surface & Geometry: `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`
 * - Demarcated Header: `<DialogHeader demarcated>` with `px-6 py-3.5 sm:py-4 min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20`
 * - Single-Circle Info Tooltip: `<CardInfoTooltip text="..." />` alongside title at `z-[10050]`
 * - Zero Raw Descriptions: `<DialogDescription className="sr-only">`
 * - Demarcated Footer: `px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5`
 * - Tactile mechanical feedback: `rounded-xl active:scale-[0.97]` with `min-h-[44px]` touch targets
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
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
  Bot,
  ShieldCheck,
  Clock,
  Coins,
  Wrench,
  Lock,
  Layers,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AgentPersonaSummary } from '@/platform/registry/contracts/registry-types';

export interface AgentPersonaDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  persona: AgentPersonaSummary | null;
}

export function AgentPersonaDetailModal({
  open,
  onOpenChange,
  persona,
}: AgentPersonaDetailModalProps) {
  if (!persona) return null;

  const getRiskBadgeColor = (level: string) => {
    switch (level) {
      case 'L0_READ':
        return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
      case 'L1_INTERNAL_DRAFT':
        return 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400';
      case 'L2_STATE_MUTATION':
        return 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400';
      case 'L3_EXTERNAL_COMMUNICATION_FINANCE':
        return 'border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400';
      case 'L4_PRIVILEGED_DESTRUCTIVE':
        return 'border-destructive/30 bg-destructive/10 text-destructive';
      default:
        return 'border-muted text-muted-foreground';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl p-0 gap-0 overflow-hidden">
        {/* Demarcated Header strictly adhering to theme.md §8 */}
        <DialogHeader
          demarcated
          className="px-6 py-3.5 sm:py-4 min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                <Bot className="h-4 w-4" />
              </div>
              <DialogTitle className="text-base font-semibold tracking-tight text-foreground">
                {persona.name}
              </DialogTitle>
              <CardInfoTooltip text="Enterprise agent persona definition with deterministic resource ceilings, domain namespaces, and immutable risk governance boundaries." />
            </div>
            <Badge variant="outline" className="text-xs font-mono text-muted-foreground">
              v{persona.version}
            </Badge>
          </div>
          <DialogDescription className="sr-only">
            Inspect canonical persona role, domain authorizations, risk ceiling, and execution budgets.
          </DialogDescription>
        </DialogHeader>

        {/* Modal Body */}
        <div className="p-6 max-h-[65vh] overflow-y-auto space-y-5">
          {/* Identity & Role Card */}
          <div className="rounded-xl border border-border/60 bg-muted/10 p-4 space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={cn('text-xs font-mono', getRiskBadgeColor(persona.maxAutonomousRiskLevel))}>
                Risk Ceiling: {persona.maxAutonomousRiskLevel}
              </Badge>
              <span className="text-xs font-mono text-muted-foreground">ID: {persona.id}</span>
            </div>
            <div className="text-xs font-semibold text-primary uppercase tracking-wider">
              {persona.role}
            </div>
            <p className="text-sm text-foreground/90 leading-relaxed">
              {persona.description}
            </p>
          </div>

          {/* Resource & Execution Budgets */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Autonomous Resource Budgets (Rule 23)
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-border/60 bg-muted/10 p-3 space-y-1">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Max Duration
                </span>
                <div className="font-semibold text-sm">
                  {Math.round(persona.maxDurationMs / 1000)}s
                </div>
              </div>

              <div className="rounded-xl border border-border/60 bg-muted/10 p-3 space-y-1">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Coins className="h-3 w-3" /> Max Tokens
                </span>
                <div className="font-semibold text-sm">
                  {persona.maxTokens.toLocaleString()}
                </div>
              </div>

              <div className="rounded-xl border border-border/60 bg-muted/10 p-3 space-y-1">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Wrench className="h-3 w-3" /> Max Tool Calls
                </span>
                <div className="font-semibold text-sm">
                  {persona.maxToolCalls}
                </div>
              </div>
            </div>
          </div>

          {/* Domain Namespaces */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5" />
              Authorized Domain Namespaces
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {persona.allowedDomains.map((domain) => (
                <span
                  key={domain}
                  className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-mono bg-muted/70 text-foreground border border-border/60"
                >
                  {domain}
                </span>
              ))}
            </div>
          </div>

          {/* Governance Non-Negotiables */}
          <div className="rounded-xl border border-border/60 bg-amber-500/5 p-3.5 text-xs space-y-1 text-muted-foreground">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-amber-500" />
              Non-Delegable Governance Boundary (Rule 17)
            </div>
            <p className="leading-relaxed">
              This persona cannot configure its own budgets, mutate root platform identities, or bypass multi-tenant isolation boundaries. All state mutations require two-phase proposal interceptors.
            </p>
          </div>
        </div>

        {/* Demarcated Footer strictly adhering to theme.md §8 */}
        <div className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl active:scale-[0.97] min-h-[44px] px-5"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
