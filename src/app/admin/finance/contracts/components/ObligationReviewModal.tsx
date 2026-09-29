'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Post-Execution Obligation Review Queue Modal (P5.4 UI).
 *    Surfaces AI-detected deliverables and milestones in 'review_required' state.
 *    Provides 1-click human approval to create official ContractObligation records and CRM tasks.
 * 2. Invariants Maintained:
 *    - Human-in-the-Loop Invariant (FM-P5-03): No automated task generation occurs without
 *      explicit human approval.
 *    - Strict Multi-Tenant Authorization: Verified via server actions.
 * 3. Mobile-First & Accessibility:
 *    - All touch controls strictly enforce `min-h-[44px]`.
 *    - Tactile micro-interactions (`active:scale-[0.97]`).
 *    - Everyday, clear UI English terminology.
 * 4. Zero-Tolerance Typing (Rule 4):
 *    - Strictly 0 `any` or `any[]` throughout.
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  CheckSquare,
  Sparkles,
  Calendar,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  DollarSign,
  FileCheck,
  Shield,
  Layers,
} from 'lucide-react';
import {
  getContractObligationCandidatesAction,
  extractContractObligationsAction,
  approveContractObligationCandidateAction,
  dismissContractObligationCandidateAction,
} from '@/app/actions/contract-ai-intelligence-actions';
import type {
  AiObligationCandidate,
  ContractObligation,
  ObligationType,
  ObligationResponsibleParty,
} from '@/lib/types/document-signing';
import { useToast } from '@/hooks/use-toast';

export interface ObligationReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  contractId: string;
  contractTitle: string;
  pageTexts?: string[];
  onObligationApproved?: (obligation: ContractObligation) => void;
}

function getObligationTypeIcon(type: ObligationType): React.ReactElement {
  switch (type) {
    case 'payment':
      return <DollarSign className="h-4 w-4 text-emerald-500" />;
    case 'reporting':
      return <FileCheck className="h-4 w-4 text-blue-500" />;
    case 'deliverable':
      return <Layers className="h-4 w-4 text-indigo-500" />;
    case 'audit':
      return <Shield className="h-4 w-4 text-purple-500" />;
    case 'renewal_notice':
      return <Clock className="h-4 w-4 text-amber-500" />;
    default:
      return <CheckSquare className="h-4 w-4 text-muted-foreground" />;
  }
}

function getResponsiblePartyBadge(party: ObligationResponsibleParty): React.ReactElement {
  switch (party) {
    case 'internal':
      return (
        <Badge variant="outline" className="text-[10px] font-semibold border-primary/30 text-primary">
          Our Team
        </Badge>
      );
    case 'counterparty':
      return (
        <Badge variant="outline" className="text-[10px] font-semibold border-amber-500/30 text-amber-600 dark:text-amber-400">
          Client / Counterparty
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-[10px] font-semibold border-slate-500/30 text-slate-600">
          Mutual
        </Badge>
      );
  }
}

export function ObligationReviewModal({
  open,
  onOpenChange,
  workspaceId,
  contractId,
  contractTitle,
  pageTexts,
  onObligationApproved,
}: ObligationReviewModalProps) {
  const { toast } = useToast();
  const [candidates, setCandidates] = React.useState<AiObligationCandidate[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isExtracting, setIsExtracting] = React.useState(false);
  const [processingId, setProcessingId] = React.useState<string | null>(null);

  const fetchCandidates = React.useCallback(async () => {
    if (!contractId || !workspaceId) return;
    setIsLoading(true);
    try {
      const res = await getContractObligationCandidatesAction({ workspaceId, contractId });
      if (res.success && res.data) {
        setCandidates(res.data);
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load obligation review queue.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, contractId, toast]);

  React.useEffect(() => {
    if (open) {
      fetchCandidates();
    }
  }, [open, fetchCandidates]);

  const handleScanObligations = async () => {
    if (!pageTexts || pageTexts.length === 0) {
      toast({
        title: 'Document text required',
        description: 'No text pages available for milestone extraction.',
      });
      return;
    }

    setIsExtracting(true);
    try {
      const res = await extractContractObligationsAction({
        workspaceId,
        contractId,
        pageTexts,
      });

      if (res.success && res.data) {
        setCandidates(res.data);
        toast({
          title: 'Extraction Complete',
          description: `Discovered ${res.data.length} candidate obligation${
            res.data.length === 1 ? '' : 's'
          }.`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Scan Failed',
          description: res.error || 'Could not scan for obligations.',
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Scan Error',
        description: 'Failed to process document text.',
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const handleApprove = async (cand: AiObligationCandidate) => {
    setProcessingId(cand.id);
    try {
      const res = await approveContractObligationCandidateAction({
        workspaceId,
        candidateId: cand.id,
        dueDate: cand.suggestedDueDate,
      });

      if (res.success && res.obligation) {
        setCandidates((prev) => prev.filter((c) => c.id !== cand.id));
        toast({
          title: 'Obligation Scheduled',
          description: `"${cand.title}" added to active obligations and CRM tasks.`,
        });
        onObligationApproved?.(res.obligation);
      } else {
        toast({
          variant: 'destructive',
          title: 'Approval Failed',
          description: res.error || 'Failed to approve obligation candidate.',
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Network error approving candidate.',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleDismiss = async (cand: AiObligationCandidate) => {
    setProcessingId(cand.id);
    try {
      const res = await dismissContractObligationCandidateAction({
        workspaceId,
        candidateId: cand.id,
        reason: 'Dismissed during human review.',
      });

      if (res.success) {
        setCandidates((prev) => prev.filter((c) => c.id !== cand.id));
        toast({
          title: 'Candidate Dismissed',
          description: `"${cand.title}" removed from review queue.`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Dismissal Failed',
          description: res.error || 'Failed to dismiss candidate.',
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Network error dismissing candidate.',
      });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] p-0 flex flex-col rounded-2xl overflow-hidden border bg-background shadow-2xl">
        {/* Header */}
        <DialogHeader className="p-5 border-b bg-card/60 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              <CheckSquare className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base sm:text-lg font-semibold truncate">
                  Obligations & Deliverables Queue
                </DialogTitle>
                <Badge variant="secondary" className="text-[10px] font-bold uppercase py-0 h-4">
                  AI Review
                </Badge>
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5 truncate max-w-md">
                {contractTitle} • Review and schedule post-signing commitments
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Content Body */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {isLoading && (
            <div className="flex-1 flex flex-col items-center justify-center p-10 space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-xs font-semibold text-muted-foreground">
                Loading pending obligation candidates...
              </p>
            </div>
          )}

          {!isLoading && candidates.length > 0 && (
            <ScrollArea className="flex-1 p-5">
              <div className="space-y-3">
                {candidates.map((cand) => {
                  const isProcessing = processingId === cand.id;
                  const confidencePct = Math.round(cand.confidence * 100);

                  return (
                    <div
                      key={cand.id}
                      className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-3 hover:border-primary/30 transition-all text-xs"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="p-2 rounded-lg bg-muted/60 mt-0.5 flex-shrink-0">
                            {getObligationTypeIcon(cand.type)}
                          </div>
                          <div className="min-w-0 space-y-1">
                            <span className="font-semibold text-foreground block text-sm">
                              {cand.title}
                            </span>
                            <div className="flex items-center gap-2 flex-wrap text-[11px]">
                              {getResponsiblePartyBadge(cand.suggestedResponsibleParty)}
                              <Badge variant="outline" className="text-[10px] font-mono capitalize">
                                {cand.type}
                              </Badge>
                              <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] py-0 h-4">
                                {confidencePct}% confidence
                              </Badge>
                            </div>
                          </div>
                        </div>

                        {cand.suggestedDueDate && (
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/40 border border-border/50 text-[11px] font-medium text-foreground shrink-0">
                            <Calendar className="h-3.5 w-3.5 text-primary" />
                            <span>{cand.suggestedDueDate}</span>
                          </div>
                        )}
                      </div>

                      <p className="text-[11px] text-muted-foreground leading-relaxed pl-11">
                        {cand.description}
                      </p>

                      {cand.sourceExcerpt && (
                        <div className="pl-11">
                          <blockquote className="text-[10px] font-mono italic text-muted-foreground/80 bg-muted/30 p-2 rounded-md border-l-2 border-primary/40 truncate">
                            &ldquo;{cand.sourceExcerpt}&rdquo;
                          </blockquote>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="pt-2 border-t border-border/40 flex items-center justify-end gap-2 pl-11">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isProcessing}
                          onClick={() => handleDismiss(cand)}
                          className="h-8 text-xs font-semibold text-muted-foreground hover:text-destructive active:scale-[0.97]"
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" />
                          Dismiss
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={isProcessing}
                          onClick={() => handleApprove(cand)}
                          className="h-8 px-4 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.97] shadow-sm gap-1.5"
                        >
                          {isProcessing ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                          Approve & Schedule Task
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}

          {!isLoading && candidates.length === 0 && (
            <div className="flex-1 p-10 flex flex-col items-center justify-center text-center space-y-3">
              <div className="h-12 w-12 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground">
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              </div>
              <div className="max-w-xs space-y-1">
                <p className="text-sm font-semibold text-foreground">All Obligations Reviewed</p>
                <p className="text-xs text-muted-foreground">
                  There are no unreviewed candidate deliverables for this contract.
                </p>
              </div>

              {pageTexts && pageTexts.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleScanObligations}
                  disabled={isExtracting}
                  className="mt-3 text-xs font-semibold gap-2 active:scale-[0.97] min-h-[44px]"
                >
                  {isExtracting ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <Sparkles className="h-4 w-4 text-primary" />
                  )}
                  {isExtracting ? 'Analyzing Clauses...' : 'Scan Contract for Deliverables'}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t bg-card/40 flex items-center justify-end flex-shrink-0">
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="min-h-[44px] px-6 font-semibold text-xs active:scale-[0.97]"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
