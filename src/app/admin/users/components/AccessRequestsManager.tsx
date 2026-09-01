'use client';

/**
 * @fileOverview Access Requests & Approval Queue Manager (Workforce 2.0)
 *
 * Provides a real-time administrative queue for inspecting self-service role/workspace
 * access requests, member justifications, and 1-click approval/rejection cascades.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Approving a request provisions workspace memberships and executes projection sync.
 * - Conforms to `.agents/AGENTS.md` and zero `any` or `any[]` typing.
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useUser } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  Building,
  User,
  MessageSquare,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import type { AccessRequest } from '@/lib/types';
import {
  listAccessRequestsAction,
  resolveAccessRequestAction,
} from '@/app/actions/workforce-actions';

interface AccessRequestsManagerProps {
  onRefreshParent?: () => void;
}

export function AccessRequestsManager({ onRefreshParent }: AccessRequestsManagerProps) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const { user: authUser } = useUser();
  const { activeOrganizationId } = useTenant();

  const [requests, setRequests] = React.useState<AccessRequest[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [resolvingId, setResolvingId] = React.useState<string | null>(null);

  // Reject Modal State
  const [rejectModalOpen, setRejectModalOpen] = React.useState(false);
  const [selectedRequest, setSelectedRequest] = React.useState<AccessRequest | null>(null);
  const [rejectReason, setRejectReason] = React.useState('');

  const loadRequests = React.useCallback(async () => {
    if (!authUser || !activeOrganizationId) return;
    setIsLoading(true);
    try {
      const idToken = await authUser.getIdToken();
      const res = await listAccessRequestsAction({
        idToken,
        organizationId: activeOrganizationId,
      });

      if (res.success) {
        setRequests(res.requests);
      }
    } catch (err: unknown) {
      console.warn('[AccessRequestsManager] Failed to load requests:', err);
    } finally {
      setIsLoading(false);
    }
  }, [authUser, activeOrganizationId]);

  React.useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleApprove = async (req: AccessRequest) => {
    if (!authUser || !activeOrganizationId) return;

    const ok = await confirm({
      title: 'Approve Access Request?',
      description: `Grant requested roles to ${req.personName} for ${req.workspaceName || 'workspace'}?`,
      confirmText: 'Approve & Provision',
    });
    if (!ok) return;

    setResolvingId(req.id);
    try {
      const idToken = await authUser.getIdToken();
      const res = await resolveAccessRequestAction({
        idToken,
        organizationId: activeOrganizationId,
        requestId: req.id,
        resolution: 'approved',
      });

      if (res.success) {
        toast({
          title: 'Access Granted',
          description: `Roles granted to ${req.personName} successfully.`,
        });
        loadRequests();
        if (onRefreshParent) onRefreshParent();
      } else {
        throw new Error(res.error || 'Approval failed');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Approval error';
      toast({ title: 'Resolution Failed', description: msg, variant: 'destructive' });
    } finally {
      setResolvingId(null);
    }
  };

  const handleOpenRejectModal = (req: AccessRequest) => {
    setSelectedRequest(req);
    setRejectReason('');
    setRejectModalOpen(true);
  };

  const handleConfirmReject = async () => {
    if (!authUser || !activeOrganizationId || !selectedRequest) return;

    setResolvingId(selectedRequest.id);
    try {
      const idToken = await authUser.getIdToken();
      const res = await resolveAccessRequestAction({
        idToken,
        organizationId: activeOrganizationId,
        requestId: selectedRequest.id,
        resolution: 'rejected',
        reviewNote: rejectReason.trim() || undefined,
      });

      if (res.success) {
        toast({ title: 'Request Rejected' });
        setRejectModalOpen(false);
        loadRequests();
        if (onRefreshParent) onRefreshParent();
      } else {
        throw new Error(res.error || 'Rejection failed');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Rejection error';
      toast({ title: 'Rejection Failed', description: msg, variant: 'destructive' });
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Bar */}
      <div className="flex items-center justify-between bg-card p-3 rounded-xl border">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-primary" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Self-Service Access Requests</h3>
            <p className="text-xs text-muted-foreground">
              Review and approve member privilege escalation and workspace requests
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={loadRequests}
          disabled={isLoading}
          className="text-xs h-8 px-3 active:scale-[0.97]"
        >
          <RefreshCw className={cn('w-3.5 h-3.5 mr-1.5', isLoading && 'animate-spin')} /> Refresh
        </Button>
      </div>

      {/* Requests Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isLoading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} className="border p-4 space-y-3">
              <div className="h-6 w-1/3 bg-muted/40 animate-pulse rounded-md" />
              <div className="h-16 w-full bg-muted/20 animate-pulse rounded-md" />
            </Card>
          ))
        ) : requests.length > 0 ? (
          requests.map((req) => (
            <Card key={req.id} className="border bg-card shadow-xs hover:border-primary/40 transition-all">
              <CardHeader className="p-4 pb-3 flex flex-row items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-primary shrink-0" />
                    <CardTitle className="text-sm font-bold text-foreground">{req.personName}</CardTitle>
                  </div>
                  <CardDescription className="text-xs">{req.personEmail}</CardDescription>
                </div>

                <Badge variant="outline" className="text-[9px] bg-blue-500/10 text-blue-600 border-blue-500/30 gap-1">
                  <Clock className="w-3 h-3" /> Pending Review
                </Badge>
              </CardHeader>

              <CardContent className="p-4 pt-0 space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-muted/20 border space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                      Target Workspace
                    </span>
                    <span className="font-semibold text-foreground">{req.workspaceName || 'Global'}</span>
                  </div>

                  <div className="space-y-1 pt-1 border-t border-border/40">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                      Requested Roles
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {req.requestedRoleNames?.map((rn, i) => (
                        <Badge key={i} variant="secondary" className="text-[9px]">
                          {rn}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold block flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" /> Business Justification
                  </span>
                  <p className="text-xs text-foreground bg-card p-2 rounded-lg border leading-relaxed">
                    &quot;{req.justification}&quot;
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenRejectModal(req)}
                    disabled={resolvingId === req.id}
                    className="text-xs h-8 px-3 text-rose-600 hover:bg-rose-500/10 active:scale-[0.97]"
                  >
                    <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleApprove(req)}
                    disabled={resolvingId === req.id}
                    className="text-xs h-8 px-4 font-semibold active:scale-[0.97]"
                  >
                    {resolvingId === req.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve & Grant
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full p-12 text-center border rounded-xl bg-muted/10 text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-500/60" />
            <p className="font-semibold text-foreground">No Pending Access Requests</p>
            <p className="text-muted-foreground">All member access and privilege escalation requests have been resolved.</p>
          </div>
        )}
      </div>

      {/* Modal: Reject Request */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden bg-card border shadow-2xl">
          <DialogHeader className="p-5 pb-4 border-b bg-muted/20">
            <DialogTitle className="text-base font-semibold">Reject Access Request</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Provide feedback for {selectedRequest?.personName} regarding this decision
            </DialogDescription>
          </DialogHeader>

          <div className="p-5 space-y-3">
            <Label className="text-xs font-semibold">Rejection Feedback (Optional)</Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Please check with your team lead before requesting financial ledger permissions..."
              className="text-xs min-h-[80px]"
            />
          </div>

          <DialogFooter className="p-4 border-t bg-muted/20 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRejectModalOpen(false)}
              className="text-xs h-9 px-4 active:scale-[0.97]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleConfirmReject}
              disabled={resolvingId !== null}
              className="text-xs h-9 px-4 font-semibold active:scale-[0.97]"
            >
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AccessRequestsManager;
