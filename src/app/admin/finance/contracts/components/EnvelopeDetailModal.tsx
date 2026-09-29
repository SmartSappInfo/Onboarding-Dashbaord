'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Operations Dock: Live Multi-Party Envelope Tracker & Signatory Management Modal (Phase 2, Task 9 & P1.4 / P2.5).
 * 2. Real-Time Tracking & Diagnostics:
 *    - Displays step-by-step routing progress across all signatories and cohorts.
 *    - Surfaces execution diagnostics: timestamps, IP addresses, user agents, and status tags.
 * 3. Operations Capabilities:
 *    - One-click capability link regeneration/copying for stalled signers.
 *    - Direct handoff to `<ReassignRecipientModal>` for unavailable participants.
 *    - Quick link to Public Cryptographic Verification Console (`/verify/[envelopeId]`).
 * 4. Strict Typing Standard (Rule 4 Zero-Tolerance Typing):
 *    Strictly zero `any` or `any[]`.
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Users,
  CheckCircle2,
  Clock,
  Send,
  UserCheck,
  ShieldCheck,
  Copy,
  ExternalLink,
  AlertCircle,
  Loader2,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import {
  getEnvelopeAdminDetailsAction,
  regenerateRecipientLinkAction,
} from '@/lib/documents/envelope-actions';
import type {
  SigningEnvelope,
  EnvelopeRecipient,
  RecipientRole,
  RecipientStatus,
  EnvelopeStatus,
} from '@/lib/types/document-signing';
import ReassignRecipientModal from './ReassignRecipientModal';
import { format } from 'date-fns';
import Link from 'next/link';

interface EnvelopeDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  envelopeId: string | null;
  workspaceId: string;
}

export default function EnvelopeDetailModal({
  isOpen,
  onClose,
  envelopeId,
  workspaceId,
}: EnvelopeDetailModalProps) {
  const { toast } = useToast();

  const [envelope, setEnvelope] = React.useState<SigningEnvelope | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [regeneratingId, setRegeneratingId] = React.useState<string | null>(null);
  const [reassignRecipient, setReassignRecipient] = React.useState<EnvelopeRecipient | null>(null);

  const fetchDetails = React.useCallback(async () => {
    if (!envelopeId) return;

    try {
      setIsLoading(true);
      const res = await getEnvelopeAdminDetailsAction(envelopeId, workspaceId);
      if (res.success && res.envelope) {
        setEnvelope(res.envelope);
      } else {
        toast({
          title: 'Failed to Load Envelope',
          description: res.error || 'Could not retrieve envelope details.',
          variant: 'destructive',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to retrieve envelope.';
      toast({
        title: 'Error',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [envelopeId, workspaceId, toast]);

  React.useEffect(() => {
    if (isOpen && envelopeId) {
      fetchDetails();
    } else {
      setEnvelope(null);
    }
  }, [isOpen, envelopeId, fetchDetails]);

  const handleRegenerateLink = async (recipient: EnvelopeRecipient) => {
    if (!envelope) return;

    try {
      setRegeneratingId(recipient.id);
      const res = await regenerateRecipientLinkAction({
        workspaceId,
        envelopeId: envelope.id,
        recipientId: recipient.id,
      });

      if (res.success && res.signingUrl) {
        navigator.clipboard.writeText(res.signingUrl);
        toast({
          title: 'Fresh Link Copied',
          description: `Active capability token for ${recipient.name} copied to clipboard.`,
        });
        fetchDetails();
      } else {
        toast({
          title: 'Regeneration Failed',
          description: res.error || 'Failed to regenerate signing link.',
          variant: 'destructive',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error generating link.';
      toast({
        title: 'Error',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setRegeneratingId(null);
    }
  };

  const getRoleBadge = (role: RecipientRole) => {
    switch (role) {
      case 'signer':
        return (
          <Badge variant="outline" className="bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20 text-[10px]">
            Signer
          </Badge>
        );
      case 'approver':
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 text-[10px]">
            Approver
          </Badge>
        );
      case 'countersigner':
        return (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-[10px]">
            Countersigner
          </Badge>
        );
      case 'viewer':
        return (
          <Badge variant="outline" className="bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20 text-[10px]">
            Viewer
          </Badge>
        );
    }
  };

  const getStatusBadge = (status: RecipientStatus) => {
    switch (status) {
      case 'signed':
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-[10px] gap-1">
            <CheckCircle2 className="h-3 w-3" /> Signed
          </Badge>
        );
      case 'invited':
        return (
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20 text-[10px] gap-1">
            <Send className="h-3 w-3" /> Invited
          </Badge>
        );
      case 'opened':
        return (
          <Badge className="bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/20 text-[10px] gap-1">
            <Clock className="h-3 w-3" /> Viewed
          </Badge>
        );
      case 'declined':
        return (
          <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/20 text-[10px] gap-1">
            <XCircle className="h-3 w-3" /> Declined
          </Badge>
        );
      case 'reassigned':
        return (
          <Badge variant="secondary" className="text-[10px] gap-1">
            <UserCheck className="h-3 w-3" /> Reassigned
          </Badge>
        );
      case 'pending':
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground text-[10px] gap-1">
            <Clock className="h-3 w-3" /> Queued
          </Badge>
        );
    }
  };

  const getEnvelopeStatusBadge = (status: EnvelopeStatus) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-emerald-600 text-white font-semibold">Fully Executed</Badge>;
      case 'in_progress':
        return <Badge className="bg-amber-600 text-white font-semibold">In Progress</Badge>;
      case 'sent':
        return <Badge className="bg-blue-600 text-white font-semibold">Sent</Badge>;
      case 'declined':
        return <Badge variant="destructive">Declined</Badge>;
      case 'voided':
        return <Badge variant="secondary">Voided</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 border shadow-2xl space-y-4">
          <DialogHeader className="space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold tracking-tight">
                    {envelope?.title || 'Document Envelope'}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Multi-party routing sequence, participant status, and audit trail.
                  </DialogDescription>
                </div>
              </div>
              {envelope && getEnvelopeStatusBadge(envelope.status)}
            </div>
          </DialogHeader>

          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-xs font-semibold">Loading envelope participants...</p>
            </div>
          ) : envelope ? (
            <div className="space-y-6">
              {/* Envelope Meta Rail */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-muted/30 rounded-2xl border text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                    Routing Mode
                  </span>
                  <span className="font-semibold capitalize text-foreground">
                    {envelope.routingMode}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                    Current Order
                  </span>
                  <span className="font-semibold text-foreground">
                    Stage {envelope.currentRoutingOrder}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                    Signatories
                  </span>
                  <span className="font-semibold text-foreground">
                    {envelope.recipients.filter((r) => r.status === 'signed').length} of {envelope.recipients.filter((r) => r.role !== 'viewer').length}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                    Expires
                  </span>
                  <span className="font-semibold text-foreground">
                    {envelope.expiresAt ? format(new Date(envelope.expiresAt), 'MMM d, yyyy') : 'No Expiry'}
                  </span>
                </div>
              </div>

              {/* Recipient Sequencing Rail */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Signatory Routing Timeline
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={fetchDetails}
                    className="h-7 text-[11px] gap-1 font-semibold rounded-lg text-primary hover:bg-primary/5"
                  >
                    <RefreshCw className="h-3 w-3" /> Refresh
                  </Button>
                </div>

                <div className="space-y-2.5">
                  {envelope.recipients
                    .sort((a, b) => a.routingOrder - b.routingOrder)
                    .map((rec) => {
                      const isCurrentStage = envelope.currentRoutingOrder === rec.routingOrder && rec.status !== 'signed';
                      const canReassign = rec.status !== 'signed' && rec.status !== 'reassigned';

                      return (
                        <div
                          key={rec.id}
                          className={`p-3.5 rounded-2xl border transition-all ${
                            isCurrentStage
                              ? 'bg-primary/5 border-primary/30 ring-1 ring-primary/20'
                              : 'bg-card/50 border-border/60 hover:bg-muted/30'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                                {rec.routingOrder}
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-sm text-foreground">{rec.name}</span>
                                  {getRoleBadge(rec.role)}
                                  {getStatusBadge(rec.status)}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  <span>{rec.email}</span>
                                  {rec.phone && <span> • {rec.phone}</span>}
                                </div>
                                {rec.signedAt && (
                                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                                    Signed on {format(new Date(rec.signedAt), 'PPpp')}
                                    {rec.ipAddress && ` (IP: ${rec.ipAddress})`}
                                  </div>
                                )}
                                {rec.declineReason && (
                                  <div className="text-[10px] text-rose-600 dark:text-rose-400 font-medium">
                                    Reason: {rec.declineReason}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                              {rec.status !== 'signed' && rec.status !== 'reassigned' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRegenerateLink(rec)}
                                  disabled={regeneratingId === rec.id}
                                  className="h-8 text-xs rounded-xl font-semibold gap-1.5 active:scale-[0.97] transition-transform"
                                >
                                  {regeneratingId === rec.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                  )}
                                  Copy Link
                                </Button>
                              )}

                              {canReassign && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setReassignRecipient(rec)}
                                  className="h-8 text-xs rounded-xl font-semibold text-muted-foreground hover:text-foreground active:scale-[0.97] transition-transform"
                                >
                                  Reassign
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Action Verification Footer */}
              <div className="pt-2 border-t flex flex-wrap items-center justify-between gap-3 text-xs">
                <Button asChild variant="outline" size="sm" className="rounded-xl font-semibold gap-1.5 min-h-[40px]">
                  <Link href={`/verify/${envelope.id}`} target="_blank" rel="noopener noreferrer">
                    <ShieldCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    Open Public Audit Portal
                    <ExternalLink className="h-3 w-3 ml-1 opacity-60" />
                  </Link>
                </Button>

                <Button
                  onClick={onClose}
                  className="rounded-xl font-semibold min-h-[40px] px-6 active:scale-[0.97] transition-transform"
                >
                  Close
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground text-xs">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-40 text-destructive" />
              Unable to locate envelope record.
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reassign Recipient Modal Child */}
      {envelope && (
        <ReassignRecipientModal
          isOpen={!!reassignRecipient}
          onClose={() => setReassignRecipient(null)}
          envelopeId={envelope.id}
          workspaceId={workspaceId}
          targetRecipient={reassignRecipient}
          onReassigned={() => {
            setReassignRecipient(null);
            fetchDetails();
          }}
        />
      )}
    </>
  );
}
