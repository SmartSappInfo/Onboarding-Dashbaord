'use client';

/**
 * @fileOverview Two-Phase Outreach Review Drawer & Sequence Inspector (Phase 10 Milestone 4 Task 5)
 *
 * Implements theme.md Section 8 (Standardized Modal & Drawer Architecture):
 * - Surface & Geometry: `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`
 * - Demarcated Header: `<DialogHeader demarcated>` (min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20 px-6 py-3.5 sm:py-4)
 * - Zero Raw Descriptions: User guidance routed through `<CardInfoTooltip text="..." />` alongside title
 * - Screen Reader AA: `<DialogDescription className="sr-only">`
 * - Single-Circle Info Tooltip elevated at `z-[10050]`
 * - Demarcated Footer: `px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-between gap-2.5 min-h-[56px]`
 * - Tactile mechanical feedback: `active:scale-[0.97]`
 *
 * Core Governance & Security Rules:
 * - Rule 4: Zero `any` or `any[]` typing.
 * - Rule 7: Mobile touch targets >= 44px with active:scale-[0.97].
 * - Rule 13 & 30: Untrusted content wrapped in `<untrusted-reference-data>`.
 * - Rule 21 & 22: Two-Phase Action Model & Cryptographic SHA-256 payloadHash binding.
 * - Rule 41: Explainability Grid (WHAT, WHY, TARGET, EXPECTED STATE CHANGE).
 * - Fields & Variables SSOT: Standardized <VariablesPanel> integration for context variable inspection.
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
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VariablesPanel } from '@/components/shared/VariablesPanel';
import type { OutreachMessageDraft } from '@/platform/agents/sales/outbound/sdr-outbound-types';
import {
  MessageSquare,
  Mail,
  Phone,
  XCircle,
  Copy,
  Check,
  ShieldCheck,
  Sparkles,
  Layers,
  Code2,
  Send,
  Loader2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

function UntrustedReferenceData({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return React.createElement('untrusted-reference-data', { id, className }, children);
}

export interface OutreachReviewDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
  workspaceId: string;
  drafts: OutreachMessageDraft[];
  actionProposalId?: string;
  payloadHash?: string;
  onApproveAndDispatch?: (
    draftId: string,
    actionProposalId: string,
    payloadHash: string
  ) => Promise<void>;
  onReject?: (actionProposalId: string, reason: string) => Promise<void>;
  readOnly?: boolean;
}

export function OutreachReviewDrawer({
  isOpen,
  onClose,
  organizationId,
  workspaceId,
  drafts,
  actionProposalId,
  payloadHash,
  onApproveAndDispatch,
  onReject,
  readOnly = false,
}: OutreachReviewDrawerProps) {
  const { toast } = useToast();
  const [selectedStepIndex, setSelectedStepIndex] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'content' | 'explainability' | 'variables'>('content');
  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedBody, setCopiedBody] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeDraft = drafts[selectedStepIndex] || drafts[0];

  const handleCopyHash = () => {
    if (payloadHash) {
      navigator.clipboard.writeText(payloadHash);
      setCopiedHash(true);
      toast({
        title: 'Cryptographic Hash Copied',
        description: 'SHA-256 payload hash copied to clipboard for verification.',
      });
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  const handleCopyBody = () => {
    if (activeDraft?.body) {
      navigator.clipboard.writeText(activeDraft.body);
      setCopiedBody(true);
      toast({
        title: 'Draft Copied',
        description: 'Outbound message draft copied to clipboard.',
      });
      setTimeout(() => setCopiedBody(false), 2000);
    }
  };

  const handleApprove = async () => {
    if (!activeDraft || !actionProposalId || !payloadHash || !onApproveAndDispatch) return;
    setIsSubmitting(true);
    try {
      await onApproveAndDispatch(activeDraft.id, actionProposalId, payloadHash);
      toast({
        title: 'Outreach Sequence Dispatched',
        description: 'Approved outbound sequence staged for transmission.',
      });
      onClose();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast({
        variant: 'destructive',
        title: 'Dispatch Failed',
        description: error.message || 'Failed to dispatch approved sequence.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!actionProposalId || !onReject) return;
    setIsSubmitting(true);
    try {
      await onReject(actionProposalId, 'Rejected by operator in Outreach Review Drawer');
      toast({
        title: 'Outreach Rejected',
        description: 'Outbound proposal cancelled and returned to draft status.',
      });
      onClose();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast({
        variant: 'destructive',
        title: 'Rejection Failed',
        description: error.message || 'Failed to reject sequence.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const renderChannelIcon = (channel: string) => {
    switch (channel) {
      case 'whatsapp':
        return <MessageSquare className="w-4 h-4 text-emerald-500" />;
      case 'email':
        return <Mail className="w-4 h-4 text-blue-500" />;
      case 'call':
      case 'phone':
        return <Phone className="w-4 h-4 text-amber-500" />;
      default:
        return <MessageSquare className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl p-0 gap-0 border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl overflow-hidden max-h-[90vh] flex flex-col font-figtree">
        {/* Header adhering to theme.md §8 */}
        <DialogHeader demarcated>
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <span>Review SDR Outbound Sequence</span>
                <Badge
                  variant="outline"
                  className="text-[10px] uppercase font-bold tracking-wider bg-primary/5 text-primary border-primary/30"
                >
                  Two-Phase Approval Gate
                </Badge>
              </DialogTitle>
              <DialogDescription className="sr-only">
                Inspect SDR outbound drafts, cryptographic SHA-256 payload binding, and Rule 41 explainability prior to transmission.
              </DialogDescription>
            </div>
          </div>
          <CardInfoTooltip text="Two-phase approval desk intercepting autonomous SDR outbound sequences. Inspect variables, channel steps, and verify cryptographic payloadHash before releasing communications." />
        </DialogHeader>

        {/* Sub-Header: Cryptographic Hash & Proposal Metadata */}
        <div className="px-6 py-2.5 bg-muted/20 border-b border-border/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground font-medium">Proposal ID:</span>
            <code className="px-2 py-0.5 rounded bg-muted font-mono font-bold text-foreground">
              {actionProposalId || 'DRAFT_PROPOSAL'}
            </code>
          </div>

          {payloadHash && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground font-medium">Payload Hash (SHA-256):</span>
              <button
                type="button"
                onClick={handleCopyHash}
                className="group flex items-center gap-1.5 px-2 py-0.5 rounded bg-muted/80 hover:bg-muted font-mono text-[11px] border border-border/60 transition-colors active:scale-[0.97]"
                title="Click to copy full SHA-256 hash"
              >
                <ShieldCheck className="w-3 h-3 text-emerald-500" />
                <span className="font-semibold text-foreground">
                  {payloadHash.slice(0, 16)}...
                </span>
                {copiedHash ? (
                  <Check className="w-3 h-3 text-emerald-500" />
                ) : (
                  <Copy className="w-3 h-3 text-muted-foreground group-hover:text-foreground" />
                )}
              </button>
            </div>
          )}
        </div>

        {/* Body Container: Split Pane for Steps and Content */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-12 min-h-[380px]">
          {/* Left: Sequence Steps Navigation (4 cols) */}
          <div className="md:col-span-4 border-r border-border/80 bg-muted/10 p-4 space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center justify-between">
              <span>Cadence Steps ({drafts.length})</span>
              <Badge variant="secondary" className="text-[10px]">
                Multi-Touch
              </Badge>
            </div>

            <div className="space-y-1.5">
              {drafts.map((draft, idx) => {
                const isSelected = idx === selectedStepIndex;
                return (
                  <button
                    key={draft.id || idx}
                    type="button"
                    onClick={() => setSelectedStepIndex(idx)}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex items-start gap-2.5 active:scale-[0.97] min-h-[44px] ${
                      isSelected
                        ? 'bg-card border-primary/50 shadow-sm text-foreground'
                        : 'bg-card/40 border-border/60 hover:bg-card/80 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <div className="mt-0.5">{renderChannelIcon(draft.channel)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span>
                          Step {draft.stepIndex || idx + 1}: Day {draft.dayOffset ?? 0}
                        </span>
                        <span className="capitalize text-[10px] text-muted-foreground font-mono">
                          {draft.channel}
                        </span>
                      </div>
                      <div className="text-[11px] truncate mt-0.5 text-muted-foreground">
                        {draft.subject || draft.body.slice(0, 35)}...
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Message Inspector & Tabs (8 cols) */}
          <div className="md:col-span-8 p-6 flex flex-col justify-between space-y-4">
            <div>
              <Tabs
                value={activeTab}
                onValueChange={(val) => setActiveTab(val as 'content' | 'explainability' | 'variables')}
                className="w-full"
              >
                <div className="flex items-center justify-between border-b border-border/80 pb-3">
                  <TabsList className="bg-muted/40 p-1 rounded-xl">
                    <TabsTrigger
                      value="content"
                      onClick={() => setActiveTab('content')}
                      className="text-xs font-semibold rounded-lg data-[state=active]:bg-card"
                    >
                      Draft Content
                    </TabsTrigger>
                    <TabsTrigger
                      value="explainability"
                      onClick={() => setActiveTab('explainability')}
                      className="text-xs font-semibold rounded-lg data-[state=active]:bg-card flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      Rule 41 Explainability
                    </TabsTrigger>
                    <TabsTrigger
                      value="variables"
                      onClick={() => setActiveTab('variables')}
                      className="text-xs font-semibold rounded-lg data-[state=active]:bg-card flex items-center gap-1.5"
                    >
                      <Code2 className="w-3 h-3 text-sky-500" />
                      Variables ({activeDraft?.variablesUsed.length || 0})
                    </TabsTrigger>
                  </TabsList>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={handleCopyBody}
                      className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground active:scale-[0.97]"
                    >
                      {copiedBody ? (
                        <>
                          <Check className="w-3.5 h-3.5 mr-1 text-emerald-500" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 mr-1" /> Copy Draft
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Tab 1: Content Preview with Untrusted Isolation */}
                <TabsContent value="content" className="space-y-4 pt-4">
                  <div className="bg-muted/15 p-3 rounded-xl border border-border/60 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-medium">Recipient:</span>
                      <span className="font-semibold text-foreground">
                        {activeDraft?.recipientName || 'Qualified Contact'} ({activeDraft?.recipientAddress})
                      </span>
                    </div>
                    {activeDraft?.subject && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground font-medium">Subject:</span>
                        <span className="font-semibold text-foreground truncate max-w-[340px]">
                          {activeDraft.subject}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Untrusted Reference Containerization (Rule 13 & 30) */}
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                      <span>Message Preview</span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        Length: {activeDraft?.body.length || 0} chars
                      </span>
                    </div>
                    <div className="p-4 rounded-xl border border-border/80 bg-background text-foreground font-mono text-xs leading-relaxed whitespace-pre-wrap selection:bg-primary/20">
                      <UntrustedReferenceData id={`draft_body_${activeDraft?.id}`}>
                        {activeDraft?.body}
                      </UntrustedReferenceData>
                    </div>
                  </div>
                </TabsContent>

                {/* Tab 2: Rule 41 Explainability Grid */}
                <TabsContent value="explainability" className="space-y-3 pt-4">
                  <div className="p-3.5 rounded-xl border border-border/80 bg-muted/15 space-y-3 text-xs">
                    <div>
                      <div className="font-bold text-foreground flex items-center gap-1.5 text-xs">
                        <span className="h-2 w-2 rounded-full bg-primary" /> WHAT (Action Objective)
                      </div>
                      <p className="text-muted-foreground mt-1 leading-relaxed pl-3.5">
                        {activeDraft?.explainability?.what}
                      </p>
                    </div>

                    <div className="border-t border-border/60 pt-2.5">
                      <div className="font-bold text-foreground flex items-center gap-1.5 text-xs">
                        <span className="h-2 w-2 rounded-full bg-amber-500" /> WHY (ICP & Tactical Grounding)
                      </div>
                      <p className="text-muted-foreground mt-1 leading-relaxed pl-3.5">
                        {activeDraft?.explainability?.why}
                      </p>
                    </div>

                    <div className="border-t border-border/60 pt-2.5">
                      <div className="font-bold text-foreground flex items-center gap-1.5 text-xs">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" /> EXPECTED STATE CHANGE
                      </div>
                      <p className="text-muted-foreground mt-1 leading-relaxed pl-3.5">
                        {activeDraft?.explainability?.expectedStateChange}
                      </p>
                    </div>
                  </div>
                </TabsContent>

                {/* Tab 3: Fields & Variables Panel Integration */}
                <TabsContent value="variables" className="space-y-3 pt-4">
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">
                      Tokens used in this message template (SSOT routing through <code className="font-bold">FieldsVariablesService</code>):
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {activeDraft?.variablesUsed.map((v) => (
                        <Badge key={v} variant="secondary" className="font-mono text-xs px-2 py-0.5">
                          {`{{${v}}}`}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-border/80 pt-3">
                    <VariablesPanel
                      workspaceId={workspaceId}
                      organizationId={organizationId}
                      className="border border-border/60 rounded-xl max-h-[220px] overflow-y-auto"
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>

        {/* Demarcated Footer adhering to theme.md §8 */}
        <DialogFooter className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-between gap-2.5 min-h-[56px]">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground active:scale-[0.97] min-h-[44px]"
          >
            Cancel & Keep Staged
          </Button>

          <div className="flex items-center gap-2">
            {!readOnly && onReject && (
              <Button
                type="button"
                variant="outline"
                onClick={handleReject}
                disabled={isSubmitting}
                className="rounded-xl text-xs font-semibold text-destructive hover:bg-destructive/10 active:scale-[0.97] min-h-[44px]"
              >
                <XCircle className="w-4 h-4 mr-1.5" />
                Reject Sequence
              </Button>
            )}

            {!readOnly && onApproveAndDispatch && (
              <Button
                type="button"
                onClick={handleApprove}
                disabled={isSubmitting}
                className="rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.97] min-h-[44px] shadow-sm gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Authorizing...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Approve & Dispatch Cadence</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
export default OutreachReviewDrawer;
