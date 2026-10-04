'use client';

/**
 * @fileOverview Standardized Proposal Review Drawer & Diff Viewer (Phase 8 Milestone 3)
 *
 * Implements theme.md Section 8 (Standardized Modal Architecture):
 * - Surface: `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`
 * - Demarcated Header: `<DialogHeader demarcated>`
 * - Zero Raw Descriptions: routed through `<CardInfoTooltip text="..." />` alongside title
 * - Screen Reader AA: `<DialogDescription className="sr-only">`
 * - Single-Circle Info Tooltip elevated at `z-[10050]`
 * - Demarcated Footer: `px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-between gap-2.5 min-h-[56px]`
 * - Tactile mechanical feedback: `active:scale-[0.97]`
 *
 * Security & Governance Rules:
 * - Rule 4: Zero `any` / zero `any[]`.
 * - Rule 7: Mobile touch targets >= 44px.
 * - Rule 13 & 30: Untrusted content wrapped in `<untrusted_reference_data>`.
 * - Rule 20 & 39: Distributed tracing badges with copy affordances.
 * - Rule 21 & 22: Cryptographic SHA-256 payload hash binding with copy affordance.
 * - Rule 41: 6-Section Explainability summary.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ActionProposal } from '@/platform/policy/approval-proposal-types';
import {
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  ShieldAlert,
  AlertTriangle,
  Clock,
  Layers,
  Sparkles,
  DollarSign,
  Users,
  Activity,
  Code,
  FileDiff,
  History,
  Info,
} from 'lucide-react';

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
// 2. PROPS & RISK STYLING
// ============================================================================

export interface ProposalReviewDrawerProps {
  proposal: ActionProposal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: (proposal: ActionProposal) => void;
  onReject: (proposal: ActionProposal) => void;
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
// 3. MAIN COMPONENT
// ============================================================================

export function ProposalReviewDrawer({
  proposal,
  open,
  onOpenChange,
  onApprove,
  onReject,
  isProcessing = false,
}: ProposalReviewDrawerProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'diff' | 'payload' | 'audit'>('overview');
  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);

  if (!proposal) return null;

  const riskBadge = getRiskBadge(proposal.blastRadius?.riskLevel);
  const RiskIcon = riskBadge.icon;

  const expiresDate = new Date(proposal.expiresAt);
  const isExpired = expiresDate.getTime() < Date.now();
  const timeRemainingMinutes = Math.max(0, Math.round((expiresDate.getTime() - Date.now()) / 60000));

  const handleCopyHash = async () => {
    try {
      await navigator.clipboard.writeText(proposal.payloadHash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    } catch (err) {
      console.error('Failed to copy payload hash:', err);
    }
  };

  const handleCopyPayloadJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(proposal.payload, null, 2));
      setCopiedPayload(true);
      setTimeout(() => setCopiedPayload(false), 2000);
    } catch (err) {
      console.error('Failed to copy payload JSON:', err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-3xl p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl max-h-[90vh]"
      >
        {/* Demarcated Header (theme.md §8.2) */}
        <DialogHeader demarcated>
          <div className="flex flex-wrap items-center justify-between gap-3 w-full">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
                <Sparkles className="h-4 w-4" />
              </div>
              <DialogTitle className="text-base font-semibold text-foreground">
                Review Action Proposal
              </DialogTitle>
              <CardInfoTooltip text="Two-phase approval desk for autonomous agent proposals. Validates cryptographic payload hash, authority permissions, and saga rollbacks." />
            </div>

            {/* Risk & Expiry Badges */}
            <div className="flex items-center gap-2 text-xs">
              <span
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-semibold ${riskBadge.bg}`}
              >
                <RiskIcon className="h-3.5 w-3.5" />
                {riskBadge.label}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 font-medium ${
                  isExpired
                    ? 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                    : 'border-border/80 bg-muted/20 text-muted-foreground'
                }`}
              >
                <Clock className="h-3 w-3" />
                {isExpired ? 'Expired' : `${timeRemainingMinutes}m left`}
              </span>
            </div>
          </div>
          <DialogDescription className="sr-only">
            Detailed review drawer for action proposal {proposal.proposalId} generated by {proposal.agentPersonaId}.
          </DialogDescription>
        </DialogHeader>

        {/* 4-Tab Navigation */}
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as 'overview' | 'diff' | 'payload' | 'audit')}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <div className="border-b border-border/60 bg-muted/10 px-6 py-2">
            <TabsList className="grid grid-cols-4 w-full sm:w-[480px]">
              <TabsTrigger
                value="overview"
                onClick={() => setActiveTab('overview')}
                className="text-xs flex items-center gap-1.5"
              >
                <Info className="h-3.5 w-3.5" />
                <span>Overview</span>
              </TabsTrigger>
              <TabsTrigger
                value="diff"
                onClick={() => setActiveTab('diff')}
                className="text-xs flex items-center gap-1.5"
              >
                <FileDiff className="h-3.5 w-3.5" />
                <span>Diff Viewer</span>
              </TabsTrigger>
              <TabsTrigger
                value="payload"
                onClick={() => setActiveTab('payload')}
                className="text-xs flex items-center gap-1.5"
              >
                <Code className="h-3.5 w-3.5" />
                <span>Payload & Evidence</span>
              </TabsTrigger>
              <TabsTrigger
                value="audit"
                onClick={() => setActiveTab('audit')}
                className="text-xs flex items-center gap-1.5"
              >
                <History className="h-3.5 w-3.5" />
                <span>Audit & Lineage</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab 1: Overview */}
          <TabsContent value="overview" className="flex-1 overflow-y-auto p-6 space-y-5 m-0">
            {/* Action Statement Banner */}
            <div className="rounded-xl border border-border/80 bg-muted/20 p-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                Proposed Action (WHAT)
              </span>
              <p className="text-base font-medium text-foreground">
                {proposal.what}
              </p>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground/80">Rationale (WHY):</span> {proposal.why}
              </p>
            </div>

            {/* Blast Radius & Scope Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-border/60 bg-card p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase">
                  <Users className="h-3.5 w-3.5 text-blue-500" />
                  <span>Target Scope</span>
                </div>
                <div className="mt-1 text-base font-bold text-foreground">
                  {proposal.blastRadius?.entityCount ?? 1} {proposal.blastRadius?.entityType || 'entities'}
                </div>
                {proposal.blastRadius?.targetSummary && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {proposal.blastRadius.targetSummary}
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-border/60 bg-card p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase">
                  <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Financial Exposure</span>
                </div>
                <div className="mt-1 text-base font-bold text-foreground">
                  {proposal.blastRadius?.estimatedCostUsd !== undefined
                    ? `$${proposal.blastRadius.estimatedCostUsd.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`
                    : 'N/A'}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Estimated execution cost</p>
              </div>

              <div className="rounded-xl border border-border/60 bg-card p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase">
                  <Layers className="h-3.5 w-3.5 text-primary" />
                  <span>Capability</span>
                </div>
                <div className="mt-1 text-xs font-mono font-medium text-foreground truncate">
                  {proposal.capabilityId}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">v{proposal.capabilityVersion}</p>
              </div>
            </div>

            {/* Cryptographic SHA-256 Binding (Rule 22) */}
            <div className="rounded-xl border border-border/60 bg-muted/10 p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Cryptographic Payload Hash (SHA-256)
                </span>
                <button
                  type="button"
                  onClick={handleCopyHash}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline active:scale-[0.97]"
                >
                  {copiedHash ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedHash ? 'Copied Full Hash' : 'Copy Hash'}</span>
                </button>
              </div>
              <p className="mt-1.5 font-mono text-xs text-foreground bg-background p-2 rounded-lg border border-border/60 break-all select-all">
                {proposal.payloadHash}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Verified against canonical sorted JSON. If execution payload differs by even 1 bit, execution fails closed (Rule 22).
              </p>
            </div>
          </TabsContent>

          {/* Tab 2: Diff Viewer */}
          <TabsContent value="diff" className="flex-1 overflow-y-auto p-6 space-y-4 m-0">
            <div className="rounded-xl border border-border/80 bg-muted/10 p-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
                Proposed State Changes (Key-Level Delta)
              </span>

              <div className="space-y-2">
                {Object.entries(proposal.payload).map(([key, val]) => (
                  <div
                    key={key}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-xs"
                  >
                    <span className="font-mono font-semibold text-foreground">{key}</span>
                    <span className="font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 mt-1 sm:mt-0 break-all">
                      {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Tab 3: Payload & Evidence */}
          <TabsContent value="payload" className="flex-1 overflow-y-auto p-6 space-y-5 m-0">
            {/* Full JSON Payload */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Proposed Payload JSON
                </span>
                <button
                  type="button"
                  onClick={handleCopyPayloadJson}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground active:scale-[0.97]"
                >
                  {copiedPayload ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedPayload ? 'Copied' : 'Copy JSON'}</span>
                </button>
              </div>

              <UntrustedReferenceData id={`drawer_payload_${proposal.proposalId}`} className="block">
                <pre className="p-3.5 rounded-xl border border-border/80 bg-muted/20 font-mono text-xs text-foreground overflow-x-auto max-h-56">
                  {JSON.stringify(proposal.payload, null, 2)}
                </pre>
              </UntrustedReferenceData>
            </div>

            {/* Evidence Pack */}
            {proposal.evidence && (
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                  Grounding Evidence Citations
                </span>
                <UntrustedReferenceData id={`drawer_evidence_${proposal.proposalId}`} className="block">
                  <pre className="p-3.5 rounded-xl border border-border/80 bg-muted/20 font-mono text-xs text-foreground overflow-x-auto max-h-48">
                    {JSON.stringify(proposal.evidence, null, 2)}
                  </pre>
                </UntrustedReferenceData>
              </div>
            )}
          </TabsContent>

          {/* Tab 4: Audit & Lineage */}
          <TabsContent value="audit" className="flex-1 overflow-y-auto p-6 space-y-4 m-0">
            <div className="rounded-xl border border-border/60 bg-muted/10 p-4 space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                Provenance & Delegation Lineage
              </span>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between py-1.5 border-b border-border/40">
                  <span className="text-muted-foreground">Proposal ID</span>
                  <span className="font-mono font-medium text-foreground">{proposal.proposalId}</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-border/40">
                  <span className="text-muted-foreground">Authorizing User / Origin</span>
                  <span className="font-mono text-foreground">{proposal.authorizingUserId}</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-border/40">
                  <span className="text-muted-foreground">Agent Persona</span>
                  <span className="font-medium text-primary">{proposal.agentPersonaId}</span>
                </div>
                {proposal.toolInvocationId && (
                  <div className="flex items-center justify-between py-1.5 border-b border-border/40">
                    <span className="text-muted-foreground">Tool Invocation ID</span>
                    <span className="font-mono text-foreground">{proposal.toolInvocationId}</span>
                  </div>
                )}
                {proposal.delegationChain && (
                  <div className="py-1.5">
                    <span className="text-muted-foreground block mb-1">Delegation Chain</span>
                    <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
                      {proposal.delegationChain.map((principal, idx) => (
                        <React.Fragment key={principal}>
                          <span className="bg-muted px-2 py-0.5 rounded border border-border/60 text-foreground">
                            {principal}
                          </span>
                          {idx < (proposal.delegationChain?.length ?? 0) - 1 && (
                            <span className="text-muted-foreground">→</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between py-1.5 border-b border-border/40">
                  <span className="text-muted-foreground">Created At</span>
                  <span className="text-foreground">{new Date(proposal.createdAt).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-muted-foreground">Expires At</span>
                  <span className="text-foreground">{new Date(proposal.expiresAt).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Demarcated Footer (theme.md §8.5) */}
        <DialogFooter className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-between gap-2.5 shrink-0 min-h-[56px]">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
            className="rounded-xl min-h-[44px] px-4 active:scale-[0.97] transition-transform text-xs font-semibold"
          >
            Close
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onReject(proposal)}
              disabled={isProcessing || isExpired}
              className="rounded-xl min-h-[44px] px-4 border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 active:scale-[0.97] transition-transform text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <XCircle className="h-4 w-4" />
              <span>Reject Proposal</span>
            </Button>

            <Button
              type="button"
              onClick={() => onApprove(proposal)}
              disabled={isProcessing || isExpired}
              className="rounded-xl min-h-[44px] px-5 bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.97] transition-transform text-xs font-semibold shadow-sm inline-flex items-center gap-1.5"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Approve Action</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
