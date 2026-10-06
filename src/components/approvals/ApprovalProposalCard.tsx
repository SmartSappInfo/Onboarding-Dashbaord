'use client';

/**
 * @fileOverview Transparent Action Proposal Card Component (Phase 3 Milestone 4)
 *
 * Implements Rule 4 (Zero any), Rule 7 (Plain English), Rule 10 (Inline Architectural Docs),
 * Rule 16 (Provenance Display), Rule 21 & 41 (WHAT/WHY/WHO/BLAST RADIUS/EVIDENCE),
 * Rule 22 (Cryptographic Hash Badge), and Rule 64 (Tactile Micro-Interactions).
 */

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Loader2,
  Shield,
  Sparkles,
  Users,
} from 'lucide-react';
import { RejectApprovalModal } from './RejectApprovalModal';
import type { ApprovalView } from '@/platform/policy/approval-view';
import { cn } from '@/lib/utils';

export interface ApprovalProposalCardProps {
  proposal: ApprovalView;
  /** `version` is the record version shown, sent back so a concurrent decision is refused (Rule 18). */
  onApprove: (proposalId: string, version: number) => Promise<void>;
  onReject: (proposalId: string, reason: string, notes: string | undefined, version: number) => Promise<void>;
  isSubmitting?: boolean;
}

export function ApprovalProposalCard({
  proposal,
  onApprove,
  onReject,
  isSubmitting = false,
}: ApprovalProposalCardProps) {
  const [rejectModalOpen, setRejectModalOpen] = React.useState<boolean>(false);
  const [payloadOpen, setPayloadOpen] = React.useState<boolean>(false);
  const [copiedHash, setCopiedHash] = React.useState<boolean>(false);

  const copyHashToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(proposal.payloadHash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    } catch {
      // Fallback
    }
  };

  const { formattedExpiresAt, isExpiringSoon, isExpired } = React.useMemo(() => {
    const expiresMs = Date.parse(proposal.expiresAt);
    if (Number.isNaN(expiresMs)) return { formattedExpiresAt: 'Unknown', isExpiringSoon: false, isExpired: false };
    const remainingSec = Math.max(0, Math.floor((expiresMs - Date.now()) / 1000));
    if (remainingSec === 0) return { formattedExpiresAt: 'Expired', isExpiringSoon: false, isExpired: true };
    const hours = Math.floor(remainingSec / 3600);
    const minutes = Math.floor((remainingSec % 3600) / 60);
    return {
      formattedExpiresAt: `${hours}h ${minutes}m remaining`,
      isExpiringSoon: remainingSec < 600, // Under 10 minutes
      isExpired: false,
    };
  }, [proposal.expiresAt]);

  const riskBadgeColor = React.useMemo(() => {
    switch (proposal.blastRadius?.riskLevel) {
      case 'L4_PRIVILEGED_DESTRUCTIVE':
        return 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400';
      case 'L3_EXTERNAL_COMMUNICATION_FINANCE':
        return 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400';
      default:
        return 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400';
    }
  }, [proposal.blastRadius?.riskLevel]);

  return (
    <>
      <div className="rounded-2xl border border-border/80 bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
        {/* Header Strip: Persona, Provenance & Risk Badge */}
        <div className="px-5 py-3.5 border-b border-border/80 bg-muted/20 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                  {proposal.agentPersonaId ? proposal.agentPersonaId.replace(/_/g, ' ') : proposal.workflowRef ? 'Workflow' : 'Request'}
                </span>
                {proposal.needsReproposal && (
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 text-amber-600 border-amber-500/40 font-normal">
                    Needs re-proposal
                  </Badge>
                )}
                {!proposal.needsReproposal && !proposal.executable && (
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 text-muted-foreground font-normal">
                    Recommendation
                  </Badge>
                )}
                {proposal.requiredApprovals > 1 && (
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 text-muted-foreground font-normal">
                    {proposal.approvalsCount} of {proposal.requiredApprovals} approvals
                  </Badge>
                )}
                {proposal.delegationChain && proposal.delegationChain.length > 1 && (
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 text-muted-foreground font-normal">
                    Hop {proposal.delegationChain.length - 1}
                  </Badge>
                )}
              </div>
              <span className="text-[11px] text-muted-foreground font-mono">
                {proposal.capabilityId} (v{proposal.capabilityVersion})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${riskBadgeColor}`}>
              {proposal.riskLevel ?? proposal.blastRadius?.riskLevel ?? 'L3_APPROVAL_REQUIRED'}
            </div>
            <div
              className={cn(
                'flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border transition-colors',
                isExpired
                  ? 'bg-rose-500/10 text-rose-600 border-rose-500/30 dark:text-rose-400'
                  : isExpiringSoon
                    ? 'bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400 animate-pulse'
                    : 'text-muted-foreground bg-background border-border/60'
              )}
            >
              <Clock className="h-3 w-3" />
              <span>{formattedExpiresAt}</span>
            </div>
          </div>
        </div>

        {/* Card Body: Rule 41 WHAT, WHY, BLAST RADIUS, EVIDENCE */}
        <div className="p-5 space-y-4 flex-1">
          {/* WHAT (Headline Description) */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 block mb-1">
              Action Proposal (WHAT)
            </span>
            <h3 className="text-base font-semibold text-foreground leading-snug">
              {proposal.what}
            </h3>
          </div>

          {/* WHY (Agent Reasoning) */}
          <div className="p-3 rounded-xl bg-muted/30 border border-border/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 block mb-1">
              Agent Reasoning (WHY)
            </span>
            <p className="text-xs text-foreground/90 leading-relaxed">
              {proposal.why}
            </p>
          </div>

          {/* BLAST RADIUS & AFFECTED ENTITIES */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div className="p-2.5 rounded-xl border border-border/60 bg-background">
              <span className="text-[10px] text-muted-foreground uppercase font-medium block">Affected Entities</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Users className="h-3.5 w-3.5 text-primary" />
                <span className="text-sm font-bold text-foreground">
                  {proposal.blastRadius?.entityCount ?? 1} {proposal.blastRadius?.entityType ?? 'entity'}
                </span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl border border-border/60 bg-background">
              <span className="text-[10px] text-muted-foreground uppercase font-medium block">Financial Impact</span>
              <span className="text-sm font-bold text-foreground mt-0.5 block">
                {proposal.blastRadius?.estimatedCostUsd !== undefined
                  ? `$${proposal.blastRadius.estimatedCostUsd.toFixed(2)}`
                  : 'Zero'}
              </span>
            </div>

            <div className="p-2.5 rounded-xl border border-border/60 bg-background col-span-2 sm:col-span-1">
              <span className="text-[10px] text-muted-foreground uppercase font-medium block">Authorizing Lineage</span>
              <span className="text-xs font-mono text-muted-foreground truncate block mt-0.5" title={proposal.delegationChain?.join(' -> ')}>
                {proposal.delegationChain?.join(' → ') ?? proposal.authorizingUserId}
              </span>
            </div>
          </div>

          {/* Collapsible Cryptographic Payload Viewer (Rule 22) */}
          <div className="border border-border/60 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setPayloadOpen(!payloadOpen)}
              className="w-full px-3 py-2 text-xs font-medium bg-muted/20 hover:bg-muted/40 transition-colors flex items-center justify-between text-muted-foreground"
            >
              <div className="flex items-center gap-2">
                <Shield className="h-3.5 w-3.5 text-emerald-500" />
                <span>SHA-256: <code className="font-mono">{proposal.payloadHash.slice(0, 16)}...</code></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px]">{payloadOpen ? 'Hide Payload' : 'Inspect Payload'}</span>
                {payloadOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </div>
            </button>

            {payloadOpen && (
              <div className="p-3 bg-muted/10 border-t border-border/60 text-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-muted-foreground">Full Hash: {proposal.payloadHash}</span>
                  <button
                    type="button"
                    onClick={copyHashToClipboard}
                    className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                  >
                    {copiedHash ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedHash ? 'Copied' : 'Copy Hash'}</span>
                  </button>
                </div>
                <pre className="max-h-40 overflow-y-auto p-2 rounded-lg bg-background border border-border/60 font-mono text-[11px] text-foreground">
                  {JSON.stringify(proposal.payload, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions: Tactile Approve & Reject */}
        <div className="px-5 py-3.5 border-t border-border/80 bg-muted/15 flex items-center justify-end gap-2.5">
          {proposal.needsReproposal ? (
            <p className="text-xs text-muted-foreground">This request was made before approvals were updated. Ask for it again.</p>
          ) : !proposal.canDecide ? (
            // Buttons are hidden for people who can't decide; the server refuses them anyway.
            <p className="text-xs text-muted-foreground">Waiting for an approver.</p>
          ) : (
          <>
          <Button
            type="button"
            variant="outline"
            onClick={() => setRejectModalOpen(true)}
            disabled={isSubmitting}
            className="rounded-xl min-h-[44px] px-4 active:scale-[0.97] transition-transform text-xs font-semibold text-destructive hover:bg-destructive/10 border-border/80"
          >
            Reject Proposal
          </Button>

          <Button
            type="button"
            onClick={() => onApprove(proposal.proposalId, proposal.version)}
            disabled={isSubmitting}
            className="rounded-xl min-h-[44px] px-5 active:scale-[0.97] transition-transform text-xs font-semibold bg-primary text-primary-foreground shadow-sm flex items-center gap-1.5"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Approving...</span>
              </>
            ) : (
              <span>Approve Action</span>
            )}
          </Button>
          </>
          )}
        </div>
      </div>

      <RejectApprovalModal
        open={rejectModalOpen}
        onOpenChange={setRejectModalOpen}
        proposalId={proposal.proposalId}
        proposalTitle={proposal.what}
        onConfirmReject={(reason, notes) => onReject(proposal.proposalId, reason, notes, proposal.version)}
        isSubmitting={isSubmitting}
      />
    </>
  );
}
