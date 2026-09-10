'use client';

/**
 * @fileoverview Human-in-the-Loop AI Approvals Tab Component (Phase 9).
 *
 * ARCHITECTURAL POINTER:
 * Fulfills SmartSapp Sales Performance & Intelligence 2.0 UX Screen 4 (AI Approvals):
 * - Governed Human-in-the-Loop review queue for Level 3 sensitive actions (discount overrides, stage skips, mass edits).
 * - Side-by-side comparison of original state vs. proposed AI state.
 * - 1-click Approve or Reject actions with persistent resolution and effort points.
 * - Mobile-first touch targets (min-h-[44px], active:scale-[0.97]).
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing enforced. Zero use of 'any' or 'any[]'.
 * - No raw HTML tags in UI.
 */

import * as React from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Lock,
  Building2,
  Sparkles,
} from 'lucide-react';
import type { AiSalesApproval } from '@/lib/ai-sales-workforce/types';
import { resolveAiApprovalAction } from '@/app/actions/ai-sales-workforce-actions';
import { useToast } from '@/hooks/use-toast';

interface AiApprovalsTabProps {
  approvals: AiSalesApproval[];
  workspaceId: string;
  organizationId: string;
  actorId: string;
  actorName: string;
  onRefresh: () => void;
}

export function AiApprovalsTab({
  approvals,
  workspaceId,
  organizationId,
  actorId,
  actorName,
  onRefresh,
}: AiApprovalsTabProps) {
  const { toast } = useToast();
  const [resolvingId, setResolvingId] = React.useState<string | null>(null);

  const handleResolve = async (
    approvalId: string,
    decision: 'approved' | 'rejected' | 'escalated',
    entityName: string
  ) => {
    try {
      setResolvingId(approvalId);
      const res = await resolveAiApprovalAction({
        workspaceId,
        organizationId,
        actorId,
        actorName,
        approvalId,
        decision,
        reviewNote: `Resolved as ${decision} by ${actorName}`,
      });

      if (res.success) {
        toast({
          title: decision === 'approved' ? 'Action Approved' : 'Action Rejected',
          description: `AI proposal for "${entityName}" was ${decision}. ${
            decision === 'approved' ? '+10 effort points recorded.' : ''
          }`,
        });
        onRefresh();
      } else {
        toast({
          title: 'Resolution Failed',
          description: res.error || 'Could not resolve approval request.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to resolve approval.',
        variant: 'destructive',
      });
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Lock className="h-5 w-5 text-purple-500" />
            Human-in-the-Loop Governance Queue ({approvals.length})
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sensitive commercial operations prepared by AI that strictly require human authorization before execution.
          </p>
        </div>
      </div>

      {approvals.length === 0 ? (
        <Card className="border-border/70 rounded-2xl bg-card p-10 text-center shadow-xs">
          <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-foreground">No Pending Approvals</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            All sensitive AI proposals have been reviewed and resolved.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {approvals.map((app) => (
            <Card
              key={app.id}
              className="border-purple-500/30 rounded-2xl bg-card shadow-xs overflow-hidden"
            >
              <CardHeader className="bg-purple-500/5 pb-3 px-6 pt-5 border-b border-purple-500/20">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 font-bold text-xs">
                      {app.actionType.replace('_', ' ').toUpperCase()}
                    </Badge>
                    <Badge variant="outline" className="text-2xs font-mono gap-1">
                      <Sparkles className="h-3 w-3 text-primary" />
                      {app.requestedBy}
                    </Badge>
                    <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-2xs">
                      {app.confidenceScore}% Confidence
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    Requested {new Date(app.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6 space-y-4">
                <div className="space-y-1">
                  <div className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    {app.entityName}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <span className="font-semibold text-foreground">AI Rationale: </span>
                    {app.reason}
                  </p>
                </div>

                {/* State Diff Preview */}
                <div className="p-4 rounded-xl bg-muted/40 border border-border/50 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <div className="text-2xs font-bold text-muted-foreground uppercase tracking-wider">
                      Current State
                    </div>
                    <pre className="p-2.5 rounded-lg bg-card border border-border/40 font-mono text-2xs text-muted-foreground overflow-x-auto">
                      {JSON.stringify(app.originalState, null, 2)}
                    </pre>
                  </div>
                  <div className="space-y-1">
                    <div className="text-2xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      Proposed AI State
                    </div>
                    <pre className="p-2.5 rounded-lg bg-card border border-purple-500/30 font-mono text-2xs text-foreground overflow-x-auto">
                      {JSON.stringify(app.proposedState, null, 2)}
                    </pre>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleResolve(app.id, 'rejected', app.entityName)}
                    disabled={resolvingId === app.id}
                    className="h-10 rounded-xl text-xs font-semibold px-4 min-h-[44px] active:scale-[0.97] transition-transform text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                  >
                    <XCircle className="h-4 w-4 mr-1.5" />
                    Reject Proposal
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleResolve(app.id, 'approved', app.entityName)}
                    disabled={resolvingId === app.id}
                    className="h-10 rounded-xl text-xs font-semibold px-5 min-h-[44px] active:scale-[0.97] transition-transform bg-purple-600 hover:bg-purple-700 text-white shadow-xs"
                  >
                    <CheckCircle2 className={`h-4 w-4 mr-1.5 ${resolvingId === app.id ? 'animate-spin' : ''}`} />
                    {resolvingId === app.id ? 'Approving...' : 'Approve & Execute'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
