'use client';

/**
 * @fileOverview Structured Approval Review Card & 6-Section Explainability Grid (Phase 8 Milestone 3)
 *
 * Implements:
 * - Rule 4: Zero `any` / zero `any[]`.
 * - Rule 7: Mobile-first touch targets >= 44px with active:scale-[0.97].
 * - Rule 12: Canonical Risk Taxonomy (server-computed L0 to L4 badges).
 * - Rule 13 & 30: Untrusted reference data containerization (`<UntrustedReferenceData>`).
 * - Rule 20 & 39: Distributed tracing badges with copy affordances.
 * - Rule 22: Cryptographic SHA-256 payload hash display with copy button.
 * - Rule 41: Explainability Standard (WHAT, WHY, AFFECTED, BLAST RADIUS, EVIDENCE, EXPECTED CHANGE).
 * - Rule 64: Zero raw HTML/CSS leakage.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Eye,
  Copy,
  Check,
  ShieldAlert,
  AlertTriangle,
  Clock,
  Layers,
  Sparkles,
  DollarSign,
  Users,
  FileText,
  Activity,
  ArrowRight,
} from 'lucide-react';
import type { ApprovalView } from '@/platform/policy/approval-view';

// ============================================================================
// 1. UNTRUSTED REFERENCE DATA ISOLATION (Rule 13 & 30)
// ============================================================================

function UntrustedReferenceData({
  id,
  children,
  className,
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return React.createElement('untrusted_reference_data', { id, className }, children);
}

// ============================================================================
// 2. PROPS & RISK STYLING (Rule 4 & 12)
// ============================================================================

export interface ApprovalReviewCardProps {
  proposal: ApprovalView;
  onApprove: (proposal: ApprovalView) => void;
  onReject: (proposal: ApprovalView) => void;
  onInspect: (proposal: ApprovalView) => void;
  isProcessing?: boolean;
}

function getRiskBadge(riskLevel?: string) {
  switch (riskLevel) {
    case 'L4_PRIVILEGED_DESTRUCTIVE':
      return {
        label: 'L4_PRIVILEGED_DESTRUCTIVE',
        bg: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30',
        icon: ShieldAlert,
      };
    case 'L3_EXTERNAL_COMMUNICATION_FINANCE':
      return {
        label: 'L3_EXTERNAL_COMMUNICATION_FINANCE',
        bg: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
        icon: AlertTriangle,
      };
    case 'L2_STATE_MUTATION':
      return {
        label: 'L2_STATE_MUTATION',
        bg: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30',
        icon: Activity,
      };
    case 'L1_TENANT_READ':
    case 'L0_READ':
    default:
      return {
        label: riskLevel || 'L0_READ',
        bg: 'bg-muted/30 text-muted-foreground border-border/80',
        icon: Activity,
      };
  }
}

// ============================================================================
// 3. MAIN COMPONENT (Rule 41)
// ============================================================================

export function ApprovalReviewCard({
  proposal,
  onApprove,
  onReject,
  onInspect,
  isProcessing = false,
}: ApprovalReviewCardProps) {
  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedTrace, setCopiedTrace] = useState(false);

  const riskBadge = getRiskBadge(proposal.blastRadius?.riskLevel);
  const RiskIcon = riskBadge.icon;
  const truncatedHash = proposal.payloadHash.slice(0, 16);

  const handleCopyHash = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(proposal.payloadHash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    } catch (err) {
      console.error('Failed to copy payload hash:', err);
    }
  };

  const handleCopyTrace = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const traceId = proposal.toolInvocationId || proposal.delegationId || proposal.proposalId;
      await navigator.clipboard.writeText(traceId);
      setCopiedTrace(true);
      setTimeout(() => setCopiedTrace(false), 2000);
    } catch (err) {
      console.error('Failed to copy trace ID:', err);
    }
  };

  // Expiration calculation
  const expiresDate = new Date(proposal.expiresAt);
  const isExpired = expiresDate.getTime() < Date.now();
  const timeRemainingMinutes = Math.max(0, Math.round((expiresDate.getTime() - Date.now()) / 60000));

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-5 text-card-foreground shadow-sm transition-all hover:border-border hover:shadow-md">
      {/* Top Metadata Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Agent Persona badge */}
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            {proposal.agentPersonaId ?? (proposal.workflowRef ? 'workflow' : 'request')}
          </span>

          {/* Provenance / Delegation Hop (Rule 20 & 39) */}
          {proposal.delegationChain && proposal.delegationChain.length > 1 && (
            <span className="inline-flex items-center gap-1 rounded-lg border border-border/80 bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground">
              <Layers className="h-3.5 w-3.5" />
              Hop {proposal.delegationChain.length - 1}
            </span>
          )}

          {/* Trace ID */}
          {proposal.toolInvocationId && (
            <button
              type="button"
              onClick={handleCopyTrace}
              className="inline-flex items-center gap-1 rounded-lg border border-border/80 bg-muted/20 px-2 py-0.5 text-xs text-muted-foreground transition hover:bg-muted"
              title="Click to copy invocation trace ID"
            >
              <span className="font-mono">{proposal.toolInvocationId}</span>
              {copiedTrace ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
            </button>
          )}

          {/* Risk Level Chip (Rule 12) */}
          <span
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${riskBadge.bg}`}
          >
            <RiskIcon className="h-3.5 w-3.5" />
            {riskBadge.label}
          </span>
        </div>

        {/* Expiration Timer & Hash Bar */}
        <div className="flex items-center gap-2 text-xs">
          <div
            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 font-medium ${
              isExpired
                ? 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                : 'border-border/80 bg-muted/20 text-muted-foreground'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            {isExpired ? 'Expired' : `${timeRemainingMinutes}m remaining`}
          </div>

          {/* Cryptographic SHA-256 Payload Hash (Rule 22) */}
          <button
            type="button"
            aria-label="Copy Hash"
            onClick={handleCopyHash}
            className="inline-flex items-center gap-1 rounded-lg border border-border/80 bg-muted/30 px-2 py-1 font-mono text-xs text-muted-foreground transition hover:bg-muted active:scale-[0.97]"
            title="Click to copy full SHA-256 payload hash"
          >
            <span>{truncatedHash}...</span>
            {copiedHash ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* 6-Section Explainability Grid (Rule 41) */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* 1. WHAT: Action Summary */}
        <div className="rounded-xl border border-border/60 bg-muted/10 p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <FileText className="h-3.5 w-3.5 text-primary" />
            <span>1. What</span>
          </div>
          <p className="mt-1 text-sm font-medium leading-snug text-foreground">
            {proposal.what}
          </p>
        </div>

        {/* 2. WHY: Business Justification & Grounding */}
        <div className="rounded-xl border border-border/60 bg-muted/10 p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span>2. Why</span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {proposal.why}
          </p>
        </div>

        {/* 3. AFFECTED ENTITIES: Target Count & Scope */}
        <div className="rounded-xl border border-border/60 bg-muted/10 p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Users className="h-3.5 w-3.5 text-blue-500" />
            <span>3. Affected Entities</span>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-base font-bold text-foreground">
              {proposal.blastRadius?.entityCount ?? 1}{' '}
              <span className="text-xs font-normal text-muted-foreground">
                {proposal.blastRadius?.entityType || 'entities'}
              </span>
            </span>
          </div>
          {proposal.blastRadius?.targetSummary && (
            <p className="mt-0.5 text-xs text-muted-foreground truncate">
              {proposal.blastRadius.targetSummary}
            </p>
          )}
        </div>

        {/* 4. BLAST RADIUS: Exposure, Cost & Impact */}
        <div className="rounded-xl border border-border/60 bg-muted/10 p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
            <span>4. Blast Radius</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {proposal.blastRadius?.estimatedCostUsd !== undefined && (
              <span className="text-sm font-semibold text-foreground">
                ${proposal.blastRadius.estimatedCostUsd.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              {proposal.blastRadius?.targetSummary || 'Local workspace scope'}
            </span>
          </div>
        </div>

        {/* 5. EVIDENCE: Data Citations wrapped in UntrustedReferenceData (Rule 13 & 30) */}
        <div className="rounded-xl border border-border/60 bg-muted/10 p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Layers className="h-3.5 w-3.5 text-indigo-500" />
            <span>5. Evidence</span>
          </div>
          <UntrustedReferenceData id={`evidence_${proposal.proposalId}`} className="block mt-1">
            {proposal.evidence ? (
              <div className="space-y-0.5 text-xs font-mono text-muted-foreground">
                {Object.entries(proposal.evidence)
                  .slice(0, 3)
                  .map(([key, val]) => (
                    <div key={key} className="truncate">
                      <span className="text-foreground/70">{key}:</span> {String(val)}
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">Standard policy trigger</p>
            )}
          </UntrustedReferenceData>
        </div>

        {/* 6. EXPECTED CHANGE: Target Capability & Output Preview */}
        <div className="rounded-xl border border-border/60 bg-muted/10 p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <ArrowRight className="h-3.5 w-3.5 text-teal-500" />
            <span>6. Expected Change</span>
          </div>
          <UntrustedReferenceData id={`payload_preview_${proposal.proposalId}`} className="block mt-1">
            <p className="text-xs font-mono font-medium text-foreground truncate">
              {proposal.capabilityId}
            </p>
            <p className="text-xs text-muted-foreground">
              Version {proposal.capabilityVersion} • {Object.keys(proposal.payload).length} payload fields
            </p>
          </UntrustedReferenceData>
        </div>
      </div>

      {/* Action Buttons (Rule 7: >= 44px touch target & tactile feedback) */}
      <div className="mt-5 flex flex-wrap items-center justify-end gap-2.5 border-t border-border/60 pt-4">
        {/* Review Details Drawer Button */}
        <button
          type="button"
          onClick={() => onInspect(proposal)}
          disabled={isProcessing}
          className="min-h-[44px] rounded-xl border border-border/80 bg-background px-4 py-2 text-sm font-medium text-foreground transition-all hover:bg-muted active:scale-[0.97] disabled:opacity-50 inline-flex items-center gap-2"
        >
          <Eye className="h-4 w-4 text-muted-foreground" />
          Review Details
        </button>

        {proposal.needsReproposal ? (
          <span className="text-xs text-muted-foreground">Made before approvals were updated. Ask for it again.</span>
        ) : !proposal.canDecide ? (
          // Hidden for people who can't decide; the server refuses them anyway (M0 · T2).
          <span className="text-xs text-muted-foreground">
            {proposal.requiredApprovals > 1 ? `${proposal.approvalsCount} of ${proposal.requiredApprovals} approvals · ` : ''}Waiting for an approver
          </span>
        ) : (
          <>
        {/* Reject Proposal Button */}
        <button
          type="button"
          onClick={() => onReject(proposal)}
          disabled={isProcessing || isExpired}
          className="min-h-[44px] rounded-xl border border-rose-500/40 bg-rose-500/5 px-4 py-2 text-sm font-medium text-rose-600 dark:text-rose-400 transition-all hover:bg-rose-500/10 active:scale-[0.97] disabled:opacity-50 inline-flex items-center gap-2"
        >
          <XCircle className="h-4 w-4" />
          Reject
        </button>

        {/* Approve Proposal Button */}
        <button
          type="button"
          onClick={() => onApprove(proposal)}
          disabled={isProcessing || isExpired}
          className="min-h-[44px] rounded-xl bg-emerald-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-[0.97] disabled:opacity-50 inline-flex items-center gap-2"
        >
          <CheckCircle2 className="h-4 w-4" />
          Approve
        </button>
          </>
        )}
      </div>
    </div>
  );
}
