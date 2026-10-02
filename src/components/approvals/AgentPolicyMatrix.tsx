'use client';

/**
 * @fileOverview Visual Agent Policy Matrix Editor (Phase 3 Milestone 4 - Task 3)
 *
 * Implements UI #38 (Agent Policy Editor) from `docs/agents_mcp/agents_mcp_ui.md`,
 * Rule 4 (Strict Typing), Rule 10 (Inline Architectural Docs), and Rule 38.
 *
 * Provides a clear visual matrix instead of a giant JSON document:
 * | Domain / Capability | Read | Create | Update | Execute |
 * Autonomy Modes:
 * - Autonomous: Agent executes without human checkpoint.
 * - Human Approval: Agent generates ActionProposal; requires human sign-off.
 * - Blocked: Capability denied for all agents.
 */

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { Shield, Check, Lock, AlertCircle } from 'lucide-react';

export type AutonomyMode = 'autonomous' | 'approval_required' | 'blocked';

export interface CapabilityPolicyEntry {
  domain: string;
  name: string;
  read: AutonomyMode;
  create: AutonomyMode;
  update: AutonomyMode;
  execute: AutonomyMode;
  isNonDelegable?: boolean;
}

export const CANONICAL_POLICY_MATRIX: CapabilityPolicyEntry[] = [
  { domain: 'CRM Contacts', name: 'crm_contacts', read: 'autonomous', create: 'autonomous', update: 'autonomous', execute: 'blocked' },
  { domain: 'CRM Deals', name: 'crm_deals', read: 'autonomous', create: 'autonomous', update: 'autonomous', execute: 'blocked' },
  { domain: 'Messaging & Outreach', name: 'communication_messaging', read: 'autonomous', create: 'autonomous', update: 'blocked', execute: 'approval_required' },
  { domain: 'Marketing Campaigns', name: 'social_campaigns', read: 'autonomous', create: 'autonomous', update: 'autonomous', execute: 'approval_required' },
  { domain: 'Finance & Payments', name: 'finance_subscriptions', read: 'autonomous', create: 'blocked', update: 'blocked', execute: 'approval_required' },
  { domain: 'System Administration', name: 'system_admin', read: 'blocked', create: 'blocked', update: 'blocked', execute: 'blocked', isNonDelegable: true },
];

export function AgentPolicyMatrix() {
  const [matrix] = React.useState<CapabilityPolicyEntry[]>(CANONICAL_POLICY_MATRIX);

  const renderBadge = (mode: AutonomyMode, isNonDelegable?: boolean) => {
    if (isNonDelegable) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 px-2 py-0.5 rounded-md border border-rose-500/20">
          <Lock className="h-3 w-3" />
          Non-Delegable
        </span>
      );
    }
    switch (mode) {
      case 'autonomous':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-md border border-emerald-500/20">
            <Check className="h-3 w-3" />
            Autonomous
          </span>
        );
      case 'approval_required':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-md border border-amber-500/20">
            <AlertCircle className="h-3 w-3" />
            Human Approval
          </span>
        );
      case 'blocked':
        return (
          <span className="inline-flex items-center text-[11px] font-medium text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-md">
            —
          </span>
        );
    }
  };

  return (
    <div className="rounded-2xl border border-border/80 bg-card text-card-foreground shadow-sm overflow-hidden flex flex-col">
      <div className="px-5 py-4 border-b border-border/80 bg-muted/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            Workspace Agent Policy Matrix (UI #38)
          </h3>
          <CardInfoTooltip text="Configures autonomy thresholds per domain. Non-delegable admin actions can never be authorized for automated agents." />
        </div>
        <span className="text-xs text-muted-foreground">Standard Governance Profile</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border/80 bg-muted/10 text-muted-foreground uppercase tracking-wider text-[10px]">
              <th className="py-3 px-5 font-semibold">Capability Domain</th>
              <th className="py-3 px-4 font-semibold text-center">Read</th>
              <th className="py-3 px-4 font-semibold text-center">Create</th>
              <th className="py-3 px-4 font-semibold text-center">Update</th>
              <th className="py-3 px-4 font-semibold text-center">Execute</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {matrix.map((row) => (
              <tr key={row.name} className="hover:bg-muted/10 transition-colors">
                <td className="py-3.5 px-5 font-medium text-foreground">
                  <div className="flex items-center gap-2">
                    <span>{row.domain}</span>
                    {row.isNonDelegable && (
                      <Badge variant="outline" className="text-[10px] py-0 px-1 border-rose-500/30 text-rose-600">
                        Rule 17
                      </Badge>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono block mt-0.5">
                    {row.name}
                  </span>
                </td>
                <td className="py-3.5 px-4 text-center">{renderBadge(row.read, row.isNonDelegable)}</td>
                <td className="py-3.5 px-4 text-center">{renderBadge(row.create, row.isNonDelegable)}</td>
                <td className="py-3.5 px-4 text-center">{renderBadge(row.update, row.isNonDelegable)}</td>
                <td className="py-3.5 px-4 text-center">{renderBadge(row.execute, row.isNonDelegable)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
