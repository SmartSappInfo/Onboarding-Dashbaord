'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Dedicated Multi-Party Public Signing Viewport & Interactive Execution Portal (Phase 2, Task 8 & P2.5).
 * 2. Ergonomics & Mobile Defense:
 *    - Mobile Safari Zoom Lock: Form inputs enforce `text-base sm:text-sm` (16px minimum).
 *    - Touch-Target Accessibility: All interactive buttons and inputs enforce `min-h-[44px]`.
 *    - Micro-Interactions: Buttons feature Emil Kowalski spring micro-interactions (`active:scale-[0.97]`).
 * 3. Security & Transactionality:
 *    - Calls `submitRecipientSignatureAction` with ephemeral capability token.
 *    - Supports atomic decline via `declineEnvelopeAction` with audit-recorded reasoning.
 *    - Displays completion state with instant access to the cryptographic verification console.
 * 4. Strict Typing Standard (Rule 4 Zero-Tolerance Typing):
 *    Strictly zero `any` or `any[]`.
 */

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
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
  FileText,
  ShieldCheck,
  CheckCircle2,
  PenTool,
  XCircle,
  Loader2,
  Clock,
  ExternalLink,
  ChevronRight,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import type { SigningEnvelope, EnvelopeRecipient } from '@/lib/types/document-signing';
import {
  submitRecipientSignatureAction,
  declineEnvelopeAction,
} from '@/lib/documents/envelope-actions';
import SignaturePadModal from '@/components/SignaturePadModal';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import Link from 'next/link';

interface MultiPartySigningPortalProps {
  envelope: SigningEnvelope;
  currentRecipient: EnvelopeRecipient;
  rawToken: string;
}

export default function MultiPartySigningPortal({
  envelope: initialEnvelope,
  currentRecipient,
  rawToken,
}: MultiPartySigningPortalProps) {
  const { toast } = useToast();
  const [envelope, setEnvelope] = React.useState<SigningEnvelope>(initialEnvelope);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = React.useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Decline Dialog State
  const [isDeclineModalOpen, setIsDeclineModalOpen] = React.useState(false);
  const [declineReason, setDeclineReason] = React.useState('');
  const [isDeclining, setIsDeclining] = React.useState(false);

  // Terminal Completion State
  const [isCompleted, setIsCompleted] = React.useState(
    envelope.status === 'completed' || currentRecipient.status === 'signed'
  );
  const [isDeclined, setIsDeclined] = React.useState(
    envelope.status === 'declined' || currentRecipient.status === 'declined'
  );

  const handleSaveSignature = (dataUrl: string) => {
    setSignatureDataUrl(dataUrl);
    setIsSignatureModalOpen(false);
  };

  const handleSubmitSignature = async () => {
    if (!signatureDataUrl) {
      toast({
        variant: 'destructive',
        title: 'Signature Required',
        description: 'Please apply your signature before executing this document.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await submitRecipientSignatureAction({
        envelopeId: envelope.id,
        recipientId: currentRecipient.id,
        rawToken,
        signatureBase64: signatureDataUrl,
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'Browser Client',
      });

      if (result.success) {
        if (result.envelope) {
          setEnvelope(result.envelope);
        }
        setIsCompleted(true);
        toast({
          title: result.isTerminal ? 'Agreement Fully Executed!' : 'Signature Successfully Recorded',
          description: result.isTerminal
            ? 'All parties have signed. Cryptographic certificate sealed.'
            : 'Your signature has been registered and the next party has been invited.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Execution Error',
          description: result.error || 'Failed to submit signature.',
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Execution failed';
      toast({
        variant: 'destructive',
        title: 'Submission Failed',
        description: message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDecline = async () => {
    if (!declineReason.trim()) {
      toast({
        variant: 'destructive',
        title: 'Reason Required',
        description: 'Please provide a brief reason for declining.',
      });
      return;
    }

    setIsDeclining(true);
    try {
      const result = await declineEnvelopeAction({
        envelopeId: envelope.id,
        recipientId: currentRecipient.id,
        rawToken,
        reason: declineReason.trim(),
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'Browser Client',
      });

      if (result.success) {
        if (result.envelope) {
          setEnvelope(result.envelope);
        }
        setIsDeclined(true);
        setIsDeclineModalOpen(false);
        toast({
          title: 'Agreement Declined',
          description: 'The agreement has been formally declined and all parties notified.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Decline Error',
          description: result.error || 'Failed to decline agreement.',
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Decline action failed';
      toast({
        variant: 'destructive',
        title: 'Decline Failed',
        description: message,
      });
    } finally {
      setIsDeclining(false);
    }
  };

  // ── Render Completed State ──────────────────────────────────────────────────
  if (isCompleted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-slate-50 dark:bg-slate-950">
        <Card className="max-w-lg w-full rounded-[2.5rem] border border-border/60 shadow-2xl overflow-hidden bg-card text-left">
          <div className="p-8 sm:p-10 bg-emerald-500 text-white text-center relative overflow-hidden">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-white/20 text-white flex items-center justify-center shadow-lg border border-white/30 mb-4">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Signature Registered</h2>
            <p className="text-xs text-white/80 mt-1 uppercase tracking-wider font-semibold">
              {envelope.status === 'completed' ? 'Agreement Fully Executed' : 'Step Completed Successfully'}
            </p>
          </div>

          <CardContent className="p-8 sm:p-10 space-y-6">
            <div className="p-4 rounded-2xl bg-muted/40 border space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Document:</span>
                <span className="font-semibold text-foreground truncate max-w-[200px]">{envelope.title}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Signatory:</span>
                <span className="font-semibold text-foreground">{currentRecipient.name}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Status:</span>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-[10px] uppercase font-bold">
                  {envelope.status === 'completed' ? 'Completed' : 'In Progress (Next Party Invited)'}
                </Badge>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-semibold text-blue-900 dark:text-blue-200">
                  Cryptographic Audit Trail Sealed
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Your signing action has been stamped into the tamper-evident audit ledger and authenticated with SHA-256 digests.
                </p>
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-3">
              <Button
                asChild
                variant="default"
                className="w-full min-h-[48px] rounded-2xl font-semibold text-sm active:scale-[0.97] transition-all gap-2"
              >
                <Link href={`/verify/${envelope.id}`} target="_blank">
                  <ExternalLink className="h-4 w-4" />
                  View Cryptographic Audit Certificate
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Render Declined State ───────────────────────────────────────────────────
  if (isDeclined) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-slate-50 dark:bg-slate-950">
        <Card className="max-w-lg w-full rounded-[2.5rem] border border-border/60 shadow-2xl overflow-hidden bg-card text-left">
          <div className="p-8 sm:p-10 bg-destructive/10 text-center relative overflow-hidden border-b border-destructive/20">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-destructive/20 text-destructive flex items-center justify-center shadow-lg mb-4">
              <XCircle className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Agreement Declined</h2>
            <p className="text-xs text-muted-foreground mt-1">This signing session has ended.</p>
          </div>

          <CardContent className="p-8 sm:p-10 space-y-6">
            <div className="p-4 rounded-2xl bg-muted/40 border space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Document:</span>
                <span className="font-semibold text-foreground truncate max-w-[200px]">{envelope.title}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Reason Recorded:</span>
                <span className="font-medium text-foreground italic">
                  {currentRecipient.declineReason || declineReason || 'Declined by recipient'}
                </span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed text-center">
              The sender and other signatories have been notified. No further action is required on your part.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Render Active Signing Viewport ──────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4 sm:px-6 flex flex-col items-center">
      <div className="max-w-4xl w-full space-y-6">
        {/* Navigation Breadcrumb & Stepper Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-card border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-foreground">{envelope.title}</h1>
              <p className="text-xs text-muted-foreground">
                Step {currentRecipient.routingOrder} of {Math.max(...envelope.recipients.map((r) => r.routingOrder))} • Review & Sign
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs px-3 py-1 font-semibold capitalize">
              Role: {currentRecipient.role}
            </Badge>
            <Badge variant="outline" className="text-xs px-3 py-1 font-semibold text-muted-foreground">
              {currentRecipient.name}
            </Badge>
          </div>
        </div>

        {/* Stepper Rail (Sequential / Mixed Routing) */}
        <div className="p-4 rounded-2xl bg-card border shadow-sm">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            {envelope.recipients.map((rec, idx) => (
              <React.Fragment key={rec.id}>
                {idx > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                <div
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold shrink-0 transition-all',
                    rec.id === currentRecipient.id
                      ? 'bg-primary/10 text-primary border-primary/30 shadow-sm'
                      : rec.status === 'signed'
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                      : 'bg-muted/40 text-muted-foreground border-transparent'
                  )}
                >
                  {rec.status === 'signed' ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  ) : rec.id === currentRecipient.id ? (
                    <PenTool className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span>
                    Step {rec.routingOrder}: {rec.name}
                  </span>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Document Metadata & Review Canvas */}
        <Card className="rounded-[2rem] border shadow-sm overflow-hidden bg-card text-left">
          <div className="p-6 border-b bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold tracking-tight">Legal Execution Document</h3>
              <p className="text-xs text-muted-foreground">
                Review the document terms thoroughly prior to executing.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] font-mono font-semibold text-muted-foreground">
                <Lock className="h-3 w-3 mr-1" /> SHA-256 Protected
              </Badge>
            </div>
          </div>

          <CardContent className="p-6 sm:p-8 space-y-6">
            {/* Signature Capture Card */}
            <div className="p-6 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <Label className="text-sm font-bold text-foreground">Signatory Execution</Label>
                  <p className="text-xs text-muted-foreground">
                    Click below to sign with your stylus, finger, or webcam-scanned ink.
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => setIsSignatureModalOpen(true)}
                  className="rounded-xl min-h-[44px] px-6 font-semibold active:scale-[0.97] transition-all gap-2"
                >
                  <PenTool className="h-4 w-4" />
                  {signatureDataUrl ? 'Change Signature' : 'Apply Legal Signature'}
                </Button>
              </div>

              {signatureDataUrl && (
                <div className="p-4 rounded-xl bg-card border flex items-center justify-between">
                  <div className="relative h-16 w-48 bg-white rounded-lg border overflow-hidden">
                    <Image
                      src={signatureDataUrl}
                      alt="Signature Preview"
                      fill
                      className="object-contain p-1"
                    />
                  </div>
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-xs font-semibold gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Signature Ready
                  </Badge>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsDeclineModalOpen(true)}
                disabled={isSubmitting}
                className="text-xs font-semibold text-destructive hover:bg-destructive/10 min-h-[44px] px-4 rounded-xl active:scale-[0.97]"
              >
                Decline to Sign
              </Button>

              <Button
                type="button"
                onClick={handleSubmitSignature}
                disabled={isSubmitting || !signatureDataUrl}
                className="w-full sm:w-auto min-h-[48px] px-10 rounded-2xl font-semibold shadow-lg active:scale-[0.97] transition-all gap-2"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm & Sign Document
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Signature Pad Modal */}
      <SignaturePadModal
        open={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        onSave={handleSaveSignature}
        mode="signature"
      />

      {/* Decline Confirmation Dialog */}
      <Dialog open={isDeclineModalOpen} onOpenChange={setIsDeclineModalOpen}>
        <DialogContent className="max-w-md rounded-[2rem]">
          <DialogHeader>
            <div className="mx-auto w-12 h-12 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center mb-2">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <DialogTitle className="text-xl font-bold text-center">Decline to Sign Agreement?</DialogTitle>
            <DialogDescription className="text-xs text-center text-muted-foreground">
              Declining this document will cancel the agreement for all signatories and notify the sender immediately.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-left">
            <Label className="text-xs font-semibold">Reason for Declining (Required)</Label>
            <Textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Please provide details on why you are declining..."
              className="min-h-[100px] text-base sm:text-sm rounded-xl"
            />
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsDeclineModalOpen(false)}
              className="rounded-xl min-h-[44px] active:scale-[0.97]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDecline}
              disabled={isDeclining || !declineReason.trim()}
              className="rounded-xl min-h-[44px] active:scale-[0.97] gap-2"
            >
              {isDeclining && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm Decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
