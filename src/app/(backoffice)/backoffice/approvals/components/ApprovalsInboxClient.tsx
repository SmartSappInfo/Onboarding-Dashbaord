'use client';

import * as React from 'react';
import { CheckSquare, Check, X, Clock, ShieldAlert, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useToast } from '@/hooks/use-toast';
import { useBackoffice } from '../../context/BackofficeProvider';
import { useBackofficeToken } from '@/hooks/use-backoffice-token';
import {
  listApprovalRequests,
  decideApprovalRequest,
  cancelApprovalRequest,
} from '@/lib/backoffice/backoffice-approval-actions';
import type { ApprovalRequest, ApprovalStatus } from '@/lib/backoffice/backoffice-types';

// ─────────────────────────────────────────────────
// Approvals Inbox — four-eyes governance queue.
// Pending dangerous actions wait here for a second admin.
// ─────────────────────────────────────────────────

const STATUS_STYLES: Record<ApprovalStatus, string> = {
  pending: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  approved: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  executed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  rejected: 'bg-red-500/15 text-red-400 border-red-500/20',
  expired: 'bg-slate-500/15 text-muted-foreground border-slate-500/20',
};

export default function ApprovalsInboxClient() {
  const { can, profile } = useBackoffice();
  const getToken = useBackofficeToken();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [requests, setRequests] = React.useState<ApprovalRequest[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [decidingId, setDecidingId] = React.useState<string | null>(null);

  const canDecide = can('approvals', 'execute');

  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const idToken = await getToken();
      const res = await listApprovalRequests(idToken);
      if (res.success && res.data) {
        setRequests(res.data);
      } else if (res.error) {
        toast({ variant: 'destructive', title: 'Failed to load approvals', description: res.error });
      }
    } catch {
      // Auth not ready yet — the AuthorizationGate handles redirects.
    } finally {
      setIsLoading(false);
    }
  }, [getToken, toast]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function handleDecide(request: ApprovalRequest, decision: 'approved' | 'rejected') {
    const confirmed = await confirm({
      title: decision === 'approved' ? 'Approve and execute?' : 'Reject request?',
      description: decision === 'approved'
        ? `This will immediately execute: "${request.summary}". You are the second pair of eyes — verify the request is legitimate.`
        : `"${request.summary}" will be rejected and cannot be executed.`,
      confirmText: decision === 'approved' ? 'Approve & Execute' : 'Reject',
      variant: decision === 'approved' ? 'default' : 'destructive',
    });
    if (!confirmed) return;

    setDecidingId(request.id);
    try {
      const idToken = await getToken();
      const res = await decideApprovalRequest(request.id, decision, idToken);
      if (res.success) {
        toast({
          title: res.status === 'executed' ? 'Approved and executed' : `Request ${res.status}`,
          description: request.summary,
        });
        load();
      } else {
        toast({ variant: 'destructive', title: 'Decision failed', description: res.error });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Authentication required', description: 'Please sign in again.' });
    } finally {
      setDecidingId(null);
    }
  }

  async function handleCancel(request: ApprovalRequest) {
    if (!(await confirm({ title: 'Withdraw request?', description: `"${request.summary}" will be cancelled.`, confirmText: 'Withdraw', variant: 'destructive' }))) return;
    try {
      const idToken = await getToken();
      const res = await cancelApprovalRequest(request.id, idToken);
      if (res.success) {
        toast({ title: 'Request withdrawn', description: request.summary });
        load();
      } else {
        toast({ variant: 'destructive', title: 'Could not withdraw', description: res.error });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Authentication required', description: 'Please sign in again.' });
    }
  }

  const pending = requests.filter((r) => r.status === 'pending');
  const decided = requests.filter((r) => r.status !== 'pending');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2.5">
            <CheckSquare className="h-6 w-6 text-emerald-400" /> Approvals
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Dangerous actions wait here for a second admin (four-eyes). Requesters cannot approve their own requests.
          </p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={load}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Pending queue */}
      <div className="rounded-2xl border border-border bg-muted/40 overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-foreground">Awaiting decision</h2>
          <Badge variant="outline" className="ml-1 h-5 px-1.5 text-[10px]">{pending.length}</Badge>
        </div>

        {isLoading ? (
          <div className="p-6 space-y-3">
            {[0, 1].map((i) => <div key={i} className="h-14 bg-accent/50 rounded-xl animate-pulse" />)}
          </div>
        ) : pending.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No pending requests. Dangerous actions will appear here when requested.</p>
        ) : (
          <ul className="divide-y divide-border">
            {pending.map((request) => {
              const isOwn = request.requestedBy.userId === profile?.id;
              return (
                <li key={request.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{request.summary}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      <span className="font-mono">{request.actionKey}</span>
                      {' · '}requested by {request.requestedBy.name}
                      {' · '}expires {new Date(request.expiresAt).toLocaleString()}
                    </p>
                    {request.executionError && (
                      <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1">
                        <ShieldAlert className="h-3 w-3" /> Last execution failed: {request.executionError}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isOwn ? (
                      <>
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">Your request</Badge>
                        <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground hover:text-foreground" onClick={() => handleCancel(request)}>
                          Withdraw
                        </Button>
                      </>
                    ) : canDecide ? (
                      <>
                        <Button
                          size="sm"
                          disabled={decidingId === request.id}
                          className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => handleDecide(request, 'approved')}
                        >
                          <Check className="h-3.5 w-3.5 mr-1" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={decidingId === request.id}
                          className="h-8 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                          onClick={() => handleDecide(request, 'rejected')}
                        >
                          <X className="h-3.5 w-3.5 mr-1" /> Reject
                        </Button>
                      </>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">View only</Badge>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* History */}
      <div className="rounded-2xl border border-border bg-muted/30 overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">History</h2>
        </div>
        {decided.length === 0 ? (
          <p className="p-6 text-xs text-muted-foreground">No decided requests yet.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {decided.map((request) => (
              <li key={request.id} className="p-4 flex items-center gap-3">
                <Badge variant="outline" className={`text-[9px] uppercase px-1.5 h-5 shrink-0 ${STATUS_STYLES[request.status]}`}>
                  {request.status}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground truncate">{request.summary}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    by {request.requestedBy.name}
                    {request.decidedBy ? ` · decided by ${request.decidedBy.name}` : ''}
                    {request.decidedAt ? ` · ${new Date(request.decidedAt).toLocaleString()}` : ''}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
