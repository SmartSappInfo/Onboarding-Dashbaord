'use client';

/**
 * Embedded Signing Host Component (Phase 8 Zero-Chrome Iframe Viewport)
 *
 * Provides a dedicated, distraction-free embedded signing experience with:
 * 1. Automatic bi-directional postMessage communication (handshake, resize, signing completion).
 * 2. Emil Kowalski responsive micro-interactions (active:scale-[0.97]).
 * 3. Mobile touch targets (min-h-[44px]) and iOS Safari text zoom locks (text-base sm:text-sm).
 * 4. Anti-loop height clamping with 8px deadband via calculateClampedEmbedHeight.
 *
 * @maintainer Antigravity Pair Programming
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
} from 'lucide-react';
import type { SigningEnvelope, EnvelopeRecipient } from '@/lib/types/document-signing';
import {
  calculateClampedEmbedHeight,
  parseEmbedMessage,
} from '@/lib/documents/embedded-signing-service';
import {
  submitRecipientSignatureAction,
  declineEnvelopeAction,
} from '@/lib/documents/envelope-actions';

interface EmbeddedSigningHostProps {
  envelope: SigningEnvelope;
  recipient: EnvelopeRecipient;
  token: string;
  isAuthorizedToSign: boolean;
  waitingReason?: string;
  allowedOrigins?: string[];
}

export function EmbeddedSigningHost({
  envelope,
  recipient,
  token,
  isAuthorizedToSign,
  waitingReason,
  allowedOrigins = [],
}: EmbeddedSigningHostProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const prevHeightRef = React.useRef<number | undefined>(undefined);

  const [signatureMode, setSignatureMode] = React.useState<'draw' | 'type'>('draw');
  const [typedName, setTypedName] = React.useState(recipient.name);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isCompleted, setIsCompleted] = React.useState(recipient.status === 'signed');

  // Decline Dialog State
  const [declineOpen, setDeclineOpen] = React.useState(false);
  const [declineReason, setDeclineReason] = React.useState('');
  const [isDeclining, setIsDeclining] = React.useState(false);

  // Drawing Canvas
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = React.useState(false);
  const [hasDrawn, setHasDrawn] = React.useState(false);

  // 1. PostMessage Bi-Directional Bridge & Resize Observer
  React.useEffect(() => {
    const notifyParent = (msg: Record<string, unknown>) => {
      if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
        window.parent.postMessage(msg, '*');
      }
    };

    // Broadcast initial ready handshake
    notifyParent({
      type: 'handshake_ack',
      status: 'ready',
      allowedOrigins,
    });

    const handleMessage = (event: MessageEvent) => {
      const parsed = parseEmbedMessage(event.data);
      if (!parsed) return;

      if (parsed.type === 'handshake_init') {
        notifyParent({
          type: 'handshake_ack',
          status: 'ready',
          allowedOrigins,
        });
      }
    };

    window.addEventListener('message', handleMessage);

    // Resize Observer with 8px deadband and bounds clamp
    let observer: ResizeObserver | null = null;
    if (containerRef.current && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        if (!containerRef.current) return;
        const currentHeight = containerRef.current.offsetHeight;
        const { height: clamped, shouldUpdate } = calculateClampedEmbedHeight(
          currentHeight,
          prevHeightRef.current
        );

        if (shouldUpdate) {
          prevHeightRef.current = clamped;
          notifyParent({
            type: 'resize_request',
            height: clamped,
          });
        }
      });
      observer.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('message', handleMessage);
      if (observer) {
        observer.disconnect();
      }
    };
  }, [allowedOrigins]);

  // 2. Canvas Drawing Handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  // 3. Execution Submission Handler
  const handleSign = async () => {
    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      let signatureDataUrl = '';
      if (signatureMode === 'draw') {
        const canvas = canvasRef.current;
        if (!canvas || !hasDrawn) {
          setErrorMessage('Please provide your signature before finalizing.');
          setIsSubmitting(false);
          return;
        }
        signatureDataUrl = canvas.toDataURL('image/png');
      } else {
        if (!typedName.trim()) {
          setErrorMessage('Please type your legal name.');
          setIsSubmitting(false);
          return;
        }
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 400;
        tempCanvas.height = 120;
        const ctx = tempCanvas.getContext('2d');
        if (ctx) {
          ctx.font = '32px "Caveat", "Dancing Script", cursive, sans-serif';
          ctx.fillStyle = '#0f172a';
          ctx.fillText(typedName.trim(), 20, 70);
          signatureDataUrl = tempCanvas.toDataURL('image/png');
        }
      }

      const res = await submitRecipientSignatureAction({
        envelopeId: envelope.id,
        recipientId: recipient.id,
        rawToken: token,
        signatureBase64: signatureDataUrl,
      });

      if (!res.success) {
        setErrorMessage(res.error || 'Failed to submit signature. Please try again.');
        return;
      }

      setIsCompleted(true);

      // Notify parent iframe
      if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
        window.parent.postMessage(
          {
            type: 'recipient_signed',
            envelopeId: envelope.id,
            recipientId: recipient.id,
            timestamp: new Date().toISOString(),
          },
          '*'
        );
      }
    } catch {
      setErrorMessage('A network error occurred while submitting. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. Decline Handler
  const handleDecline = async () => {
    try {
      setIsDeclining(true);
      const res = await declineEnvelopeAction({
        envelopeId: envelope.id,
        recipientId: recipient.id,
        rawToken: token,
        reason: declineReason.trim() || 'Declined by recipient via embedded portal',
      });

      if (!res.success) {
        setErrorMessage(res.error || 'Failed to decline document.');
        return;
      }

      setDeclineOpen(false);

      if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
        window.parent.postMessage(
          {
            type: 'recipient_declined',
            envelopeId: envelope.id,
            recipientId: recipient.id,
            reason: declineReason.trim() || undefined,
            timestamp: new Date().toISOString(),
          },
          '*'
        );
      }
    } finally {
      setIsDeclining(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="w-full bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 sm:p-6 transition-all duration-200"
    >
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-semibold tracking-tight">{envelope.title}</h1>
            <p className="text-xs text-muted-foreground">
              Executing as <span className="font-medium text-foreground">{recipient.name}</span> ({recipient.role})
            </p>
          </div>
        </div>
        <Badge variant="outline" className="text-xs font-medium py-1 px-2.5">
          <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-500" />
          Secure Signing Session
        </Badge>
      </div>

      {/* Completion View */}
      {isCompleted ? (
        <div className="py-12 text-center space-y-4 max-w-md mx-auto">
          <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold">Document Executed Successfully</h2>
            <p className="text-xs text-muted-foreground">
              Your signature has been cryptographically recorded into the authoritative evidence ledger.
            </p>
          </div>
          <Button
            asChild
            variant="outline"
            className="min-h-[44px] rounded-xl active:scale-[0.97] transition-transform text-xs"
          >
            <a href={`/verify/${envelope.id}`} target="_blank" rel="noopener noreferrer">
              View Audit Verification <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
            </a>
          </Button>
        </div>
      ) : !isAuthorizedToSign ? (
        /* Waiting For Turn View */
        <div className="py-12 text-center space-y-4 max-w-md mx-auto">
          <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
            <Clock className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold">Waiting for Preceding Signatories</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {waitingReason ||
                'This agreement enforces sequential signing order. You will receive notification as soon as preceding parties complete their signatures.'}
            </p>
          </div>
        </div>
      ) : (
        /* Signature Execution Pad */
        <div className="mt-6 space-y-6 max-w-xl mx-auto">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-destructive/10 text-destructive text-xs font-medium border border-destructive/20 flex items-center gap-2">
              <XCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Mode Switcher */}
          <div className="flex items-center gap-2 border-b pb-3">
            <Button
              type="button"
              variant={signatureMode === 'draw' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSignatureMode('draw')}
              className="min-h-[38px] rounded-xl active:scale-[0.97] transition-transform text-xs font-medium"
            >
              <PenTool className="w-3.5 h-3.5 mr-1.5" />
              Draw Signature
            </Button>
            <Button
              type="button"
              variant={signatureMode === 'type' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSignatureMode('type')}
              className="min-h-[38px] rounded-xl active:scale-[0.97] transition-transform text-xs font-medium"
            >
              Type Signature
            </Button>
            {signatureMode === 'draw' && hasDrawn && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearCanvas}
                className="ml-auto text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </Button>
            )}
          </div>

          {/* Canvas / Input Container */}
          {signatureMode === 'draw' ? (
            <Card className="border-2 border-dashed rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-900/50">
              <CardContent className="p-0">
                <canvas
                  ref={canvasRef}
                  width={540}
                  height={160}
                  className="w-full h-40 touch-none cursor-crosshair"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              <Label className="text-xs font-medium">Type Your Legal Name</Label>
              <input
                type="text"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                className="w-full min-h-[44px] px-3.5 rounded-xl border bg-background text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Full Legal Name"
              />
            </div>
          )}

          {/* Action Bar */}
          <div className="pt-2 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeclineOpen(true)}
              className="w-full sm:w-auto min-h-[44px] rounded-xl active:scale-[0.97] transition-transform text-xs font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20"
            >
              Decline to Sign
            </Button>
            <Button
              type="button"
              onClick={handleSign}
              disabled={isSubmitting}
              className="w-full sm:w-auto min-h-[44px] rounded-xl active:scale-[0.97] transition-transform text-xs font-semibold px-8"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Recording Signature...
                </>
              ) : (
                'Adopt & Sign'
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Decline Confirmation Modal */}
      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-destructive">
              Decline This Agreement
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Declining halts the agreement workflow and notifies the sender. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-xs font-medium">Reason for Declining (Optional)</Label>
            <Textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Provide context or terms requiring amendment..."
              className="min-h-[80px] text-base sm:text-sm rounded-xl"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeclineOpen(false)}
              className="min-h-[44px] rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDecline}
              disabled={isDeclining}
              className="min-h-[44px] rounded-xl active:scale-[0.97] transition-transform text-xs font-semibold"
            >
              {isDeclining ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Decline'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
