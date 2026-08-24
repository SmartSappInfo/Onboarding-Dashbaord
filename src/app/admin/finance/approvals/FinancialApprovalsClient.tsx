'use client';

/**
 * SmartSapp Finance 2.0 - Financial Approvals & Governance Hub
 * Managerial review queue for high-value write-offs, refunds, and void operations.
 */

import * as React from 'react';
import { 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Loader2, 
  Sliders, 
  UserCheck 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { FinancialApprovalRequest, ApprovalRequestType } from '@/lib/types';
import { decideApprovalRequestAction } from '@/lib/approval-actions';
import Link from 'next/link';

export function FinancialApprovalsClient() {
  const { user } = useUser();
  const { activeWorkspaceId, activeWorkspace } = useWorkspace();
  const { toast } = useToast();
  const firestore = useFirestore();

  const [decidingRequest, setDecidingRequest] = React.useState<{
    request: FinancialApprovalRequest;
    decision: 'approved' | 'rejected';
  } | null>(null);
  const [decisionNotes, setDecisionNotes] = React.useState<string>('');
  const [isProcessing, setIsProcessing] = React.useState<boolean>(false);

  // Query pending requests
  const requestsQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'financial_approval_requests'),
      where('workspaceIds', 'array-contains', activeWorkspaceId),
      where('status', '==', 'pending'),
      orderBy('requestedAt', 'desc')
    );
  }, [firestore, activeWorkspaceId]);

  const { data: rawRequests, isLoading } = useCollection<FinancialApprovalRequest>(requestsQuery);
  const requests = React.useMemo(() => rawRequests || [], [rawRequests]);

  const handleConfirmDecision = async () => {
    if (!decidingRequest || !user || !activeWorkspaceId) return;

    if (decidingRequest.request.requestedByUserId === user.uid) {
      toast({
        variant: 'destructive',
        title: 'Action Prohibited',
        description: 'Segregation of duties policy prohibits approving your own financial request.',
      });
      return;
    }

    setIsProcessing(true);
    const res = await decideApprovalRequestAction(
      decidingRequest.request.id,
      decidingRequest.decision,
      decisionNotes,
      activeWorkspaceId,
      user.uid,
      user.displayName || user.email || 'Finance Manager'
    );

    setIsProcessing(false);

    if (res.success) {
      toast({
        title: `Request ${decidingRequest.decision === 'approved' ? 'Approved' : 'Rejected'}`,
        description: `Decision logged and audit trail recorded.`,
      });
      setDecidingRequest(null);
      setDecisionNotes('');
    } else {
      toast({
        variant: 'destructive',
        title: 'Decision Failed',
        description: res.error || 'Failed to record decision.',
      });
    }
  };

  const getRequestTypeBadge = (type: ApprovalRequestType) => {
    switch (type) {
      case 'refund':
        return <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20 text-[10px]">Refund</Badge>;
      case 'write_off':
        return <Badge className="bg-rose-500/10 text-rose-600 border-rose-500/20 text-[10px]">Write-off</Badge>;
      case 'credit_note':
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]">Credit Note</Badge>;
      case 'void_issued_invoice':
        return <Badge className="bg-red-600 text-white text-[10px]">Void Invoice</Badge>;
    }
  };

  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
            <ShieldCheck className="h-4 w-4" />
            Financial Governance &amp; Controls
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Approvals &amp; Authorizations
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Managerial review queue for high-value write-offs, customer refunds, and void operations in {activeWorkspace?.name || activeWorkspaceId}.
          </p>
        </div>

        <Button variant="outline" size="sm" asChild className="rounded-xl h-10 min-h-[44px] text-xs font-semibold">
          <Link href="/admin/finance/settings">
            <Sliders className="h-4 w-4 mr-1.5" />
            Policy Settings
          </Link>
        </Button>
      </div>

      {/* Queue Card */}
      <Card className="rounded-2xl border shadow-sm">
        <CardHeader className="p-4 border-b flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-sm font-bold flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-amber-500" />
              Pending Signoff Queue ({requests.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Actions awaiting managerial authorization before sub-ledger settlement.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-xs font-medium">Loading approval requests...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground space-y-2">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto opacity-70" />
              <p className="text-sm font-semibold text-foreground">Queue is Clear</p>
              <p className="text-xs max-w-sm mx-auto">
                No high-value financial actions are currently pending approval.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs font-bold">Request Type</TableHead>
                    <TableHead className="text-xs font-bold">Entity / Customer</TableHead>
                    <TableHead className="text-xs font-bold">Reference #</TableHead>
                    <TableHead className="text-xs font-bold text-right">Amount</TableHead>
                    <TableHead className="text-xs font-bold">Requested By</TableHead>
                    <TableHead className="text-xs font-bold">Reason</TableHead>
                    <TableHead className="text-xs font-bold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((req) => {
                    const isSelfRequest = req.requestedByUserId === user?.uid;

                    return (
                      <TableRow key={req.id} className="hover:bg-muted/40 text-xs">
                        <TableCell>
                          {getRequestTypeBadge(req.requestType)}
                        </TableCell>

                        <TableCell className="font-semibold text-foreground">
                          {req.entityName}
                        </TableCell>

                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {req.referenceNumber || req.referenceId}
                        </TableCell>

                        <TableCell className="text-right font-mono font-bold text-foreground">
                          {req.currency} {Number(req.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>

                        <TableCell className="text-muted-foreground">
                          {req.requestedByName}
                          <span className="block text-[10px] text-muted-foreground/70">
                            {req.requestedAt.split('T')[0]}
                          </span>
                        </TableCell>

                        <TableCell className="max-w-[200px] truncate text-muted-foreground" title={req.reason}>
                          {req.reason}
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isSelfRequest}
                              onClick={() => setDecidingRequest({ request: req, decision: 'rejected' })}
                              className="rounded-xl h-8 px-2 text-xs font-bold text-rose-600 hover:bg-rose-500/10 active:scale-[0.97]"
                              title={isSelfRequest ? 'Cannot decide your own request' : 'Reject Request'}
                            >
                              <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                            </Button>

                            <Button
                              size="sm"
                              disabled={isSelfRequest}
                              onClick={() => setDecidingRequest({ request: req, decision: 'approved' })}
                              className="rounded-xl h-8 px-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.97]"
                              title={isSelfRequest ? 'Cannot decide your own request' : 'Approve Request'}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Decision Confirmation Modal */}
      {decidingRequest && (
        <Dialog open={!!decidingRequest} onOpenChange={(open) => !open && setDecidingRequest(null)}>
          <DialogContent className="sm:max-w-md rounded-2xl p-6">
            <DialogHeader className="text-left space-y-1">
              <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                <UserCheck className="h-4 w-4" />
                Managerial Authorization
              </div>
              <DialogTitle className="text-xl font-bold tracking-tight">
                {decidingRequest.decision === 'approved' ? 'Approve Financial Request' : 'Reject Financial Request'}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Confirm your decision for <strong className="text-foreground">{decidingRequest.request.entityName}</strong> ({decidingRequest.request.currency} {decidingRequest.request.amount.toLocaleString()}).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Decision Notes / Justification</Label>
                <Textarea
                  rows={3}
                  placeholder="Add optional notes for the audit record..."
                  value={decisionNotes}
                  onChange={(e) => setDecisionNotes(e.target.value)}
                  className="rounded-xl resize-none text-xs"
                />
              </div>
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDecidingRequest(null)}
                disabled={isProcessing}
                className="rounded-xl h-11 min-h-[44px] active:scale-[0.97]"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleConfirmDecision}
                disabled={isProcessing}
                className={`rounded-xl h-11 min-h-[44px] font-bold text-white shadow-md active:scale-[0.97] ${
                  decidingRequest.decision === 'approved' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Recording...
                  </>
                ) : (
                  <span>Confirm {decidingRequest.decision === 'approved' ? 'Approval' : 'Rejection'}</span>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
