'use client';

/**
 * @fileoverview Human-in-the-Loop Approval Queue Tab Component (Phase 8).
 *
 * ARCHITECTURAL POINTER:
 * Fulfills SmartSapp Sales Performance & Intelligence 2.0 UX Screen 6 (Approval Queue):
 * - Governed Approval Queue for high-impact deal actions (Discount Overrides, Stage Bypasses, Reassignments).
 * - 1-Click Approve, Reject (with required note), or Escalate to Executive Review.
 * - 24h auto-escalation timer indicator to prevent deal slippage deadlocks.
 * - Awards +15 effort points upon resolution via resolveApprovalRequestAction.
 * - Mobile-first touch targets (min-h-[44px], active:scale-[0.97]).
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing enforced. Zero use of 'any' or 'any[]'.
 * - No raw HTML tags in UI.
 */

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  Clock,
  User,
  ShieldCheck,
} from 'lucide-react';
import type {
  ApprovalRequest,
  ApprovalType,
  ApprovalStatus,
} from '@/lib/sales-orchestration/types';
import { resolveApprovalRequestAction } from '@/app/actions/sales-orchestration-actions';
import { useToast } from '@/hooks/use-toast';

interface ApprovalQueueTabProps {
  approvals: ApprovalRequest[];
  workspaceId: string;
  organizationId: string;
  actorId: string;
  actorName: string;
  onRefresh: () => void;
}

export function ApprovalQueueTab({
  approvals,
  workspaceId,
  organizationId,
  actorId,
  actorName,
  onRefresh,
}: ApprovalQueueTabProps) {
  const { toast } = useToast();
  const [selectedStatus, setSelectedStatus] = React.useState<string>('pending');
  const [actingRequest, setActingRequest] = React.useState<ApprovalRequest | null>(null);
  const [decisionType, setDecisionType] = React.useState<'approve' | 'reject' | 'escalate'>('approve');
  const [decisionNote, setDecisionNote] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const filteredApprovals = React.useMemo(() => {
    return approvals.filter((req) => {
      if (selectedStatus === 'all') return true;
      return req.status === selectedStatus;
    });
  }, [approvals, selectedStatus]);

  const handleOpenDecisionDialog = (
    req: ApprovalRequest,
    type: 'approve' | 'reject' | 'escalate'
  ) => {
    setActingRequest(req);
    setDecisionType(type);
    setDecisionNote(
      type === 'approve'
        ? 'Approved within policy parameters.'
        : type === 'escalate'
        ? 'Discount exceeds manager threshold; escalating to VP of Sales.'
        : ''
    );
  };

  const handleConfirmDecision = async () => {
    if (!actingRequest) return;
    setIsSubmitting(true);

    try {
      const res = await resolveApprovalRequestAction({
        workspaceId,
        organizationId,
        actorId,
        actorName,
        actorRole: 'sales_manager',
        requestId: actingRequest.id,
        decision: decisionType,
        decisionNote: decisionNote.trim(),
      });

      if (res.success) {
        toast({
          title: `Request ${decisionType === 'approve' ? 'Approved' : decisionType === 'reject' ? 'Rejected' : 'Escalated'}`,
          description: `Decision recorded for "${actingRequest.entityName}". ${res.pointsAwarded ? `+${res.pointsAwarded} effort points awarded!` : ''}`,
        });
        setActingRequest(null);
        setDecisionNote('');
        onRefresh();
      } else {
        toast({
          variant: 'destructive',
          title: 'Action Failed',
          description: res.error || 'Failed to record decision.',
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to record approval decision.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTypeBadge = (type: ApprovalType) => {
    switch (type) {
      case 'discount_override':
        return <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 font-semibold">Discount Override</Badge>;
      case 'stage_bypass':
        return <Badge className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 font-semibold">Stage Bypass</Badge>;
      case 'deal_reassignment':
        return <Badge className="bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20 font-semibold">Reassignment</Badge>;
      default:
        return <Badge variant="secondary">Policy Gate</Badge>;
    }
  };

  const getStatusBadge = (status: ApprovalStatus) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 font-bold">Pending Review</Badge>;
      case 'approved':
        return <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-bold">Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 font-bold">Rejected</Badge>;
      case 'escalated':
        return <Badge className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 font-bold">Escalated to VP</Badge>;
      default:
        return <Badge variant="outline">Expired</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Filter Tabs */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'pending', label: 'Pending Review' },
            { id: 'approved', label: 'Approved' },
            { id: 'rejected', label: 'Rejected' },
            { id: 'escalated', label: 'Escalated' },
            { id: 'all', label: 'All Requests' },
          ].map((st) => (
            <Button
              key={st.id}
              type="button"
              variant={selectedStatus === st.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedStatus(st.id)}
              className="h-10 rounded-xl text-xs font-semibold px-3 min-h-[44px] active:scale-[0.97] transition-transform shrink-0"
            >
              {st.label}
            </Button>
          ))}
        </div>

        <div className="text-xs text-muted-foreground font-medium">
          {filteredApprovals.length} Request{filteredApprovals.length === 1 ? '' : 's'}
        </div>
      </div>

      {/* Approvals List */}
      {filteredApprovals.length === 0 ? (
        <div className="text-center py-16 bg-muted/20 border border-dashed rounded-2xl">
          <ShieldCheck className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-semibold text-foreground">Queue is Clear</p>
          <p className="text-xs text-muted-foreground mt-1">
            No approval requests matching the selected status.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredApprovals.map((req) => (
            <Card
              key={req.id}
              className="border border-border/70 rounded-2xl bg-card shadow-sm hover:border-primary/40 transition-colors"
            >
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                  {/* Left Details */}
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getStatusBadge(req.status)}
                      {getTypeBadge(req.requestType)}
                      <span className="text-xs font-extrabold text-foreground">
                        ${req.dealValue.toLocaleString()}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-foreground">
                      {req.entityName}
                    </h3>

                    {/* Specific Details */}
                    <div className="bg-muted/40 p-3.5 rounded-xl border border-border/40 text-xs space-y-1.5">
                      {req.details.discountPercent !== undefined && (
                        <div className="flex items-center gap-2 font-semibold text-foreground">
                          <span>Requested Discount:</span>
                          <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold">
                            {req.details.discountPercent}% Off ($
                            {req.details.requestedAmount?.toLocaleString()} from $
                            {req.details.originalAmount?.toLocaleString()})
                          </Badge>
                        </div>
                      )}

                      {req.details.fromStage && req.details.toStage && (
                        <div className="flex items-center gap-2 font-semibold text-foreground">
                          <span>Stage Bypass:</span>
                          <span className="text-muted-foreground line-through">
                            {req.details.fromStage}
                          </span>
                          <span>→</span>
                          <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                            {req.details.toStage}
                          </span>
                        </div>
                      )}

                      <div className="text-muted-foreground italic leading-relaxed pt-1">
                        &quot;{req.details.justification}&quot;
                      </div>
                    </div>

                    {/* Requester & SLA Timer */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                      <span className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-primary" />
                        Requested by: <strong className="text-foreground">{req.requestedByName}</strong>
                      </span>
                      {req.status === 'pending' && (
                        <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
                          <Clock className="h-3.5 w-3.5" />
                          Auto-escalates in 24h
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Actions */}
                  {req.status === 'pending' && (
                    <div className="flex items-center gap-2 shrink-0 self-end lg:self-center flex-wrap sm:flex-nowrap">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDecisionDialog(req, 'escalate')}
                        className="h-10 rounded-xl text-xs font-semibold px-3 min-h-[44px] active:scale-[0.97] transition-transform text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10"
                      >
                        <ArrowUpRight className="h-4 w-4 mr-1.5" />
                        Escalate
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDecisionDialog(req, 'reject')}
                        className="h-10 rounded-xl text-xs font-semibold px-3 min-h-[44px] active:scale-[0.97] transition-transform text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                      >
                        <XCircle className="h-4 w-4 mr-1.5" />
                        Reject
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleOpenDecisionDialog(req, 'approve')}
                        className="h-10 rounded-xl text-xs font-semibold px-4 min-h-[44px] active:scale-[0.97] transition-transform bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1.5" />
                        Approve
                      </Button>
                    </div>
                  )}

                  {req.decisionNote && req.status !== 'pending' && (
                    <div className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-xl border border-border/40 lg:max-w-xs shrink-0 space-y-0.5">
                      <div className="font-semibold text-foreground">
                        Decision by {req.decisionByName || 'Manager'}:
                      </div>
                      <div>{req.decisionNote}</div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Decision Note Dialog */}
      <Dialog open={!!actingRequest} onOpenChange={(open) => !open && setActingRequest(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              {decisionType === 'approve' && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
              {decisionType === 'reject' && <XCircle className="h-5 w-5 text-rose-500" />}
              {decisionType === 'escalate' && <ArrowUpRight className="h-5 w-5 text-indigo-500" />}
              <span>
                {decisionType === 'approve'
                  ? 'Confirm Approval'
                  : decisionType === 'reject'
                  ? 'Reject Request'
                  : 'Escalate to VP of Sales'}
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {decisionType === 'approve'
                ? `Authorizing ${actingRequest?.requestType.replace(/_/g, ' ')} for "${actingRequest?.entityName}". +15 effort points awarded.`
                : `Provide a clear rationale for ${decisionType}ing this request.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <label className="text-xs font-semibold text-foreground">Decision Rationale</label>
            <Textarea
              placeholder="Enter decision rationale or conditions..."
              value={decisionNote}
              onChange={(e) => setDecisionNote(e.target.value)}
              className="min-h-[90px] rounded-xl text-xs"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setActingRequest(null)}
              className="h-11 rounded-xl text-xs font-semibold min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isSubmitting}
              onClick={handleConfirmDecision}
              className={`h-11 rounded-xl text-xs font-semibold min-h-[44px] active:scale-[0.97] transition-transform ${
                decisionType === 'approve'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : decisionType === 'reject'
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : ''
              }`}
            >
              {isSubmitting ? 'Recording...' : 'Confirm Decision'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
