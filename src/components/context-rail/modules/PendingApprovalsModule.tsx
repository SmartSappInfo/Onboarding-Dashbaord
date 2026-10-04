'use client';

/**
 * @fileOverview Pending Approvals Module (Phase 8 Milestone 4 Task 4)
 *
 * Implements Module 6 of the Global Context Rail:
 * - Pending Human-in-the-Loop proposals requiring operator sign-off
 * - Canonical 5-tier risk taxonomy badges (L0 to L4)
 * - Rule 22: Cryptographic SHA-256 payload hash badges with truncated display & copy
 * - Operator intervention flags
 * - Rule 4 (Zero any/any[] strict typing)
 * - Rule 7 (Accessible touch targets >= 44px)
 * - Rule 68 / §81 (No Dead Ends navigation)
 */

import * as React from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Copy,
  Check,
  Lock,
  Clock,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { PendingApprovalSummary } from '@/platform/ui/context-rail';

export interface PendingApprovalsModuleProps {
  approvals: PendingApprovalSummary[];
}

export function PendingApprovalsModule({ approvals }: PendingApprovalsModuleProps) {
  const [copiedHash, setCopiedHash] = React.useState<string | null>(null);

  const handleCopyHash = async (e: React.MouseEvent, hash: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(hash);
      setCopiedHash(hash);
      setTimeout(() => setCopiedHash(null), 2000);
    } catch {
      // Fallback
    }
  };

  const getRiskBadge = (risk: PendingApprovalSummary['riskLevel']) => {
    switch (risk) {
      case 'L4_PRIVILEGED_DESTRUCTIVE':
        return (
          <Badge variant="outline" className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 text-[10px] font-mono font-semibold">
            L4 DESTRUCTIVE
          </Badge>
        );
      case 'L3_FINANCIAL_OR_COMMUNICATION':
        return (
          <Badge variant="outline" className="bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30 text-[10px] font-mono font-semibold">
            L3 FINANCIAL
          </Badge>
        );
      case 'L2_STATE_MUTATION':
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] font-mono font-semibold">
            L2 MUTATION
          </Badge>
        );
      case 'L1_REVERSIBLE':
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 text-[10px] font-mono font-semibold">
            L1 REVERSIBLE
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-mono font-semibold">
            L0 READ
          </Badge>
        );
    }
  };

  if (approvals.length === 0) {
    return (
      <div
        data-testid="context-rail-approvals-empty"
        className="p-4 rounded-xl border border-dashed border-border/80 bg-muted/10 text-center space-y-1.5"
      >
        <ShieldCheck className="h-5 w-5 text-emerald-500/70 mx-auto" />
        <p className="text-xs text-muted-foreground">All clear. No pending human approvals for this object.</p>
      </div>
    );
  }

  return (
    <div data-testid="context-rail-approvals-module" className="space-y-2.5">
      {approvals.map((proposal) => {
        const isCopied = copiedHash === proposal.payloadHash;
        const truncatedHash =
          proposal.payloadHash.length > 12
            ? `${proposal.payloadHash.slice(0, 10)}...`
            : proposal.payloadHash;

        return (
          <Link
            key={proposal.proposalId}
            href={proposal.reviewUrl}
            className="group block p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/50 transition-all active:scale-[0.98] min-h-[44px]"
          >
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-6 w-6 rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                    {proposal.actionName}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    Target: {proposal.targetEntityName}
                  </div>
                </div>
              </div>

              <div className="shrink-0">{getRiskBadge(proposal.riskLevel)}</div>
            </div>

            {/* Cryptographic SHA-256 Binding Badge (Rule 22) */}
            <div className="flex items-center justify-between p-1.5 rounded-lg bg-background/60 border border-border/50 text-[10px] font-mono my-2">
              <span className="text-muted-foreground flex items-center gap-1">
                <Lock className="h-2.5 w-2.5" />
                SHA-256: {truncatedHash}
              </span>
              <button
                type="button"
                onClick={(e) => handleCopyHash(e, proposal.payloadHash)}
                aria-label="Copy proposal payload hash"
                className="inline-flex items-center gap-0.5 text-primary hover:underline px-1 py-0.5 rounded focus:outline-none"
              >
                {isCopied ? (
                  <Check className="h-2.5 w-2.5 text-emerald-500" />
                ) : (
                  <Copy className="h-2.5 w-2.5" />
                )}
                <span>{isCopied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {/* Intervention & Review Link */}
            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/40 font-medium">
              <span className="text-amber-600 dark:text-amber-400 text-[10px] font-medium">
                {proposal.requiresOperatorIntervention ? 'Action Required' : 'Review Recommended'}
              </span>
              <span className="inline-flex items-center gap-1 text-primary group-hover:underline">
                <span>Review Proposal</span>
                <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
