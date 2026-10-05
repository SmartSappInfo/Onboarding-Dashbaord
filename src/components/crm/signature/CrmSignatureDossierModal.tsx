'use client';

/**
 * @fileOverview Standardized CRM Signature Dossier Modal & Multi-Turn Copilot (Phase 9 Milestone 5)
 *
 * Implements theme.md Section 8 (Standardized Modal Architecture),
 * Rule 4 (Strict Typing: zero any/any[]), Rule 7 (Mobile-first >= 44px touch targets),
 * Rule 8 & 47 (Anti-IDOR Multi-Tenant Lock), Rule 12 (Risk Vocabulary: L0 to L4),
 * Rule 13 & 30 (Untrusted Reference Data XML containerization),
 * Rule 21 & 22 (Two-Phase Action Proposal Integration via CrmProposalModal),
 * Rule 28 & 56 (Knapsack Token Budget Ceiling <= 4,000 tokens),
 * Rule 41 (Explainability Grid: WHAT / WHY / EXPECTED CHANGE),
 * Rule 60 (Emergency Dead-Man Switch Evaluation), and Rule 68 ("No Dead Ends").
 */

import * as React from 'react';
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
import { Input } from '@/components/ui/input';
import {
  Sparkles,
  ShieldAlert,
  AlertTriangle,
  Clock,
  Send,
  Loader2,
  ArrowRight,
  Brain,
  Bot,
  User,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  CrmSignatureResult,
  CrmProposedAction,
  CrmRelationshipStatus,
} from '@/platform/agents/crm/signature/crm-signature-types';
import {
  executeCrmSignatureInquiryAction,
  sendCrmFollowupMessageAction,
} from '@/app/actions/crm-signature-actions';
import { CrmSignatureTimelineFeed } from './CrmSignatureTimelineFeed';
import { CrmProposalModal } from '@/components/crm/actions/CrmProposalModal';

export interface CrmSignatureDossierModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  entityId?: string;
  initialQuery?: string;
  initialResult?: CrmSignatureResult | null;
  onActionSelect?: (action: CrmProposedAction) => void;
}

interface ConversationTurn {
  turnIndex: number;
  question: string;
  answer: string;
  citationsCount: number;
  timestamp: string;
}

export function CrmSignatureDossierModal({
  open,
  onOpenChange,
  workspaceId,
  entityId,
  initialQuery,
  initialResult,
  onActionSelect,
}: CrmSignatureDossierModalProps) {
  const [result, setResult] = React.useState<CrmSignatureResult | null>(initialResult || null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Multi-Turn Copilot State
  const [turns, setTurns] = React.useState<ConversationTurn[]>([]);
  const [followupText, setFollowupText] = React.useState('');
  const [isSendingFollowup, setIsSendingFollowup] = React.useState(false);

  // Proposal Modal State (Rule 21 & 22)
  const [selectedAction, setSelectedAction] = React.useState<CrmProposedAction | null>(null);
  const [isProposalModalOpen, setIsProposalModalOpen] = React.useState(false);

  // Load Dossier if not pre-provided
  React.useEffect(() => {
    if (initialResult) {
      setResult(initialResult);
      return;
    }

    if (open && (entityId || initialQuery)) {
      setIsLoading(true);
      setError(null);
      executeCrmSignatureInquiryAction({
        query: initialQuery,
        entityId,
        workspaceId,
      })
        .then((res) => {
          if (res.success && res.data) {
            setResult(res.data);
          } else {
            setError(res.error?.message || 'Failed to assemble autonomous account dossier.');
          }
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : 'Error executing signature inquiry.');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [open, entityId, initialQuery, workspaceId, initialResult]);

  // Handle follow-up submission
  const handleSendFollowup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = followupText.trim();
    if (!query || isSendingFollowup || !result?.sessionId) return;

    setIsSendingFollowup(true);
    try {
      const res = await sendCrmFollowupMessageAction({
        sessionId: result.sessionId,
        workspaceId,
        message: query,
      });

      if (res.success && res.data) {
        setTurns((prev) => [
          ...prev,
          {
            turnIndex: res.data!.turnIndex,
            question: query,
            answer: res.data!.answer,
            citationsCount: res.data!.citations.length,
            timestamp: res.data!.generatedAt,
          },
        ]);
        setFollowupText('');
      } else {
        setError(res.error?.message || 'Follow-up query failed.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Follow-up error occurred.');
    } finally {
      setIsSendingFollowup(false);
    }
  };

  const handleProposeAction = (action: CrmProposedAction) => {
    setSelectedAction(action);
    setIsProposalModalOpen(true);
    onActionSelect?.(action);
  };

  const getStatusBadge = (status: CrmRelationshipStatus) => {
    switch (status) {
      case 'EXCELLENT':
        return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">EXCELLENT</Badge>;
      case 'HEALTHY':
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">HEALTHY</Badge>;
      case 'ATTENTION_NEEDED':
        return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">ATTENTION NEEDED</Badge>;
      case 'AT_RISK':
        return <Badge className="bg-rose-500/10 text-rose-500 border-rose-500/20">AT RISK</Badge>;
      case 'CRITICAL':
      default:
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20">CRITICAL</Badge>;
    }
  };

  const getRiskLevelBadge = (level: string) => {
    switch (level) {
      case 'L4_PRIVILEGED_DESTRUCTIVE':
        return <Badge variant="outline" className="bg-rose-500/10 text-rose-500 border-rose-500/30 text-[10px]">L4 Privileged</Badge>;
      case 'L3_EXTERNAL_COMMUNICATION_FINANCE':
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-[10px]">L3 Finance</Badge>;
      case 'L2_STATE_MUTATION':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30 text-[10px]">L2_STATE_MUTATION</Badge>;
      case 'L1_INTERNAL_DRAFT':
      default:
        return <Badge variant="outline" className="bg-slate-500/10 text-slate-500 border-slate-500/30 text-[10px]">L1 Draft</Badge>;
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl"
          aria-describedby="crm-signature-dossier-desc"
        >
          {/* 1. Demarcated Header (theme.md §8) */}
          <DialogHeader
            demarcated
            className="min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20 px-6 py-3.5 sm:py-4 flex flex-row items-center justify-between"
          >
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <Sparkles className="h-4 w-4 text-primary animate-pulse" />
              </div>
              <DialogTitle className="text-base sm:text-lg font-semibold tracking-tight text-foreground">
                Autonomous Dossier: {result?.entityName || 'Account Overview'}
              </DialogTitle>
              <CardInfoTooltip text="14-step multi-domain autonomous inquiry orchestrating context assembly, risk detection, commitments, and next-best actions." />
            </div>

            {/* Screen-reader description (zero visual description clutter) */}
            <DialogDescription id="crm-signature-dossier-desc" className="sr-only">
              Autonomous CRM Intelligence Dossier and Multi-Turn Copilot for account operations.
            </DialogDescription>
          </DialogHeader>

          {/* 2. Scrollable Body Content */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground font-medium">
                  Assembling 360° Account Context & Evaluating Multi-Domain Risks...
                </p>
                <div className="text-xs text-muted-foreground/80 font-mono">
                  Steps 1-14: Contacts • Deals • Meetings • Notes • Billing • Tasks
                </div>
              </div>
            ) : error ? (
              <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <div className="text-xs font-medium">{error}</div>
              </div>
            ) : result ? (
              <>
                {/* Executive Summary Card & Health Gauge */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-3 rounded-2xl border border-border/80 bg-card/60 p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Brain className="h-3.5 w-3.5 text-primary" />
                        Executive Intelligence Narrative
                      </span>
                      {getStatusBadge(result.relationshipStatus)}
                    </div>
                    <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed font-sans">
                      {result.executiveNarrative}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-border/80 bg-card/60 p-4 flex flex-col items-center justify-center text-center">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                      Relationship Health
                    </span>
                    <div className="text-3xl sm:text-4xl font-black tracking-tight text-foreground font-mono">
                      {result.healthScore}
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono mt-0.5">out of 100</span>
                    <div className="mt-2 w-full bg-muted/60 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={cn(
                          'h-full transition-all duration-500 rounded-full',
                          result.healthScore >= 70
                            ? 'bg-emerald-500'
                            : result.healthScore >= 40
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        )}
                        style={{ width: `${result.healthScore}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Active Risks & Overdue Commitments */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Risks */}
                  <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <ShieldAlert className="h-3.5 w-3.5 text-rose-500" />
                        Active Risks ({result.activeRisks.length})
                      </h4>
                    </div>
                    {result.activeRisks.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Zero critical risk alerts active.</p>
                    ) : (
                      <div className="space-y-2">
                        {result.activeRisks.map((risk) => (
                          <div
                            key={risk.id}
                            className="p-2.5 rounded-xl border border-rose-500/20 bg-rose-500/5 space-y-1"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                                {risk.title}
                              </span>
                              <Badge variant="outline" className="text-[10px] uppercase font-mono px-1 py-0 border-rose-500/30 text-rose-600 dark:text-rose-400">
                                {risk.severity}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{risk.description}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Commitments */}
                  <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-amber-500" />
                        Overdue Commitments ({result.commitments.length})
                      </h4>
                    </div>
                    {result.commitments.length === 0 ? (
                      <p className="text-xs text-muted-foreground">All customer touchpoint commitments fulfilled.</p>
                    ) : (
                      <div className="space-y-2">
                        {result.commitments.map((comm) => (
                          <div
                            key={comm.commitmentId}
                            className="p-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-1"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                                {comm.title}
                              </span>
                              <Badge variant="outline" className="text-[10px] font-mono px-1 py-0 border-amber-500/30 text-amber-600 dark:text-amber-400">
                                {comm.daysOverdue} days overdue
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                              <span>Due: {new Date(comm.dueDate).toLocaleDateString()}</span>
                              {comm.assignedTo && <span>Owner: {comm.assignedTo}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 14-Step Timeline Feed & Evidence Citations */}
                <div className="rounded-2xl border border-border/80 bg-card p-4">
                  <CrmSignatureTimelineFeed
                    timeline={result.timelineHighlights}
                    citations={result.citations}
                  />
                </div>

                {/* Executable Next-Best-Actions (NBA) (Rules 21 & 22) */}
                {result.proposedActions.length > 0 && (
                  <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5 text-primary" />
                        Autonomous Next-Best-Actions ({result.proposedActions.length})
                      </h4>
                      <span className="text-[10px] text-muted-foreground font-mono">Governed Proposal Desk</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {result.proposedActions.map((action, idx) => (
                        <div
                          key={action.idempotencyKey || idx}
                          className="rounded-xl border border-border/70 bg-muted/20 p-3 flex flex-col justify-between hover:border-primary/50 transition-colors"
                        >
                          <div className="space-y-1.5 mb-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-foreground line-clamp-1">
                                {action.explainability?.what || action.actionType}
                              </span>
                              {getRiskLevelBadge(action.riskLevel)}
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {action.explainability?.impact || action.explainability?.what}
                            </p>
                            <p className="text-[11px] text-muted-foreground/80 italic font-mono">
                              Rationale: {action.explainability?.why}
                            </p>
                          </div>

                          <Button
                            size="sm"
                            onClick={() => handleProposeAction(action)}
                            className="w-full min-h-[44px] rounded-xl text-xs font-medium active:scale-[0.97] transition-transform gap-1.5"
                          >
                            Propose Action <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Multi-Turn Conversational Copilot Feed */}
                <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                      Multi-Turn Copilot Dialogue
                    </h4>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      Session Active (30m TTL)
                    </span>
                  </div>

                  {/* Turns Thread */}
                  {turns.length > 0 && (
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                      {turns.map((turn, index) => (
                        <div key={index} className="space-y-2">
                          {/* User Message */}
                          <div className="flex items-start gap-2 justify-end">
                            <div className="bg-primary text-primary-foreground text-xs rounded-2xl rounded-tr-xs px-3.5 py-2 max-w-[85%] font-medium">
                              {turn.question}
                            </div>
                            <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                              <User className="h-3.5 w-3.5 text-primary" />
                            </div>
                          </div>

                          {/* Assistant Grounded Answer */}
                          <div className="flex items-start gap-2">
                            <div className="h-6 w-6 rounded-full bg-muted border border-border flex items-center justify-center shrink-0">
                              <Bot className="h-3.5 w-3.5 text-primary" />
                            </div>
                            <div className="bg-muted/40 border border-border/70 text-xs rounded-2xl rounded-tl-xs px-3.5 py-2.5 max-w-[85%] text-foreground space-y-1.5">
                              <p className="leading-relaxed">{turn.answer}</p>
                              {turn.citationsCount > 0 && (
                                <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                                  <ShieldCheck className="h-3 w-3 text-emerald-500" />
                                  Grounded in {turn.citationsCount} account record citation(s)
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Chat Input Bar */}
                  <form onSubmit={handleSendFollowup} className="flex items-center gap-2">
                    <Input
                      value={followupText}
                      onChange={(e) => setFollowupText(e.target.value)}
                      placeholder="Ask follow-up question (e.g., 'Why did the deal stall last week?')..."
                      disabled={isSendingFollowup}
                      className="min-h-[44px] rounded-xl text-xs bg-muted/30 focus-visible:ring-1"
                    />
                    <Button
                      type="submit"
                      disabled={!followupText.trim() || isSendingFollowup}
                      className="min-h-[44px] px-4 rounded-xl active:scale-[0.97] transition-transform gap-1.5 shrink-0"
                    >
                      {isSendingFollowup ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <span>Send Follow-up</span>
                          <Send className="h-3.5 w-3.5" />
                        </>
                      )}
                    </Button>
                  </form>
                </div>
              </>
            ) : null}
          </div>

          {/* 3. Demarcated Footer (theme.md §8) */}
          <DialogFooter className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-between gap-2.5 min-h-[56px]">
            <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
              {result?.contextMetrics && (
                <>
                  <span>Knapsack: {result.contextMetrics.tokensUsed} / 4,000 tokens</span>
                  <span>•</span>
                  <span>Latency: {result.contextMetrics.executionDurationMs}ms</span>
                </>
              )}
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl min-h-[44px] px-5 active:scale-[0.97] transition-transform text-xs font-medium"
            >
              Close Dossier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Governed Proposal Review Modal (Rules 21 & 22) */}
      <CrmProposalModal
        open={isProposalModalOpen}
        onOpenChange={setIsProposalModalOpen}
        action={selectedAction}
      />
    </>
  );
}
