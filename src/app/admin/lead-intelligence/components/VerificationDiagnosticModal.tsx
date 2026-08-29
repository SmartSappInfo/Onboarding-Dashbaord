'use client';

/**
 * Verification Forensic Diagnostic Modal (Lead Intelligence 2.0 - Phase 5)
 * UI Spec Section 25: "Verification Inspector: Obvious statuses, MX provider, and live handshake"
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. 5-Stage Visual Verification: Syntax, Disposable, DNS/MX, SMTP Socket, Catch-All.
 * 2. Mobile Ergonomics: Optimized responsive dialog with min-h-[44px] touch controls.
 * 3. Emil Kowalski Motion: Smooth spring physics and tactile action feedback.
 * 4. Strict Zero-`any` typing.
 */

import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  Server, 
  Globe, 
  Clock,
  Loader2,
  Copy,
  Check
} from 'lucide-react';
import type { EmailDeliverabilityResult } from '@/lib/lead-intelligence/types';
import { verifyProspectEmailAction } from '@/app/actions/lead-intelligence-actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface VerificationDiagnosticModalProps {
  prospectId: string;
  workspaceId: string;
  deliverability: EmailDeliverabilityResult | null;
  isOpen: boolean;
  onClose: () => void;
  onVerificationUpdated?: (result: EmailDeliverabilityResult) => void;
}

export const VerificationDiagnosticModal: React.FC<VerificationDiagnosticModalProps> = ({
  prospectId,
  workspaceId,
  deliverability,
  isOpen,
  onClose,
  onVerificationUpdated
}) => {
  const { toast } = useToast();
  const [isReverifying, setIsReverifying] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  if (!deliverability) return null;

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(deliverability.email);
    setCopiedEmail(true);
    toast({ title: 'Copied ✓', description: 'Email address copied to clipboard!' });
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const handleReverify = async () => {
    if (!prospectId || !workspaceId || isReverifying) return;
    setIsReverifying(true);
    try {
      const res = await verifyProspectEmailAction(prospectId, deliverability.email, workspaceId);
      if (res.success && res.deliverability) {
        toast({
          title: 'Verification Complete',
          description: `Deliverability score: ${res.deliverability.deliverabilityScore}% (${res.deliverability.status.toUpperCase()})`
        });
        if (onVerificationUpdated) {
          onVerificationUpdated(res.deliverability);
        }
      } else {
        toast({
          variant: 'destructive',
          title: 'Verification Failed',
          description: res.error || 'Failed to re-verify email address.'
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Network Error',
        description: 'Failed to communicate with verification engine.'
      });
    } finally {
      setIsReverifying(false);
    }
  };

  const score = deliverability.deliverabilityScore;
  const isVerified = deliverability.status === 'verified';
  const isRisky = deliverability.status === 'risky';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md w-[95vw] p-0 bg-card border-border/80 shadow-2xl rounded-2xl overflow-hidden z-[10001]">
        {/* Header */}
        <DialogHeader className="p-5 border-b bg-muted/20 space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <DialogTitle className="text-sm font-bold text-foreground">
                Email Deliverability Diagnostics
              </DialogTitle>
            </div>
            <Badge 
              className={cn(
                "text-xs font-bold font-mono px-2.5 py-0.5",
                isVerified && "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
                isRisky && "bg-amber-500/10 text-amber-600 border-amber-500/30",
                !isVerified && !isRisky && "bg-rose-500/10 text-rose-600 border-rose-500/30"
              )}
            >
              {deliverability.status.toUpperCase()} ({score}%)
            </Badge>
          </div>
          <DialogDescription className="text-xs text-muted-foreground flex items-center justify-between pt-1">
            <span className="font-mono text-foreground font-semibold truncate max-w-[260px]">
              {deliverability.email}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCopyEmail}
              className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              {copiedEmail ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
              <span>{copiedEmail ? 'Copied' : 'Copy'}</span>
            </Button>
          </DialogDescription>
        </DialogHeader>

        {/* Body Content */}
        <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
          {/* Deliverability Progress Bar */}
          <div className="space-y-1.5 bg-muted/20 p-3 rounded-xl border border-border/60">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground">Overall Confidence Score</span>
              <span className="font-bold font-mono text-primary">{score}/100</span>
            </div>
            <Progress value={score} className="h-2 rounded-full bg-muted" />
          </div>

          {/* 5-Stage Forensic Checklist */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
              5-Stage Pipeline Verification
            </span>

            <div className="divide-y divide-border/40 rounded-xl border bg-background/50">
              {deliverability.stages.map((stage, idx) => (
                <div key={idx} className="p-3 flex items-start justify-between gap-3 text-xs">
                  <div className="flex items-start gap-2.5 min-w-0">
                    {stage.passed ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-0.5 min-w-0">
                      <span className="font-bold text-foreground block capitalize">
                        {stage.stage.replace('_', ' ')}
                      </span>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {stage.details}
                      </p>
                    </div>
                  </div>
                  {typeof stage.latencyMs === 'number' && (
                    <span className="text-[10px] font-mono text-muted-foreground shrink-0 mt-0.5 flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" /> {stage.latencyMs}ms
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Infrastructure Specs */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-xl border bg-muted/20 space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                <Server className="h-3 w-3 text-sky-400" /> MX Provider
              </span>
              <p className="font-semibold text-foreground truncate capitalize">
                {deliverability.mxProvider.replace('_', ' ')}
              </p>
            </div>

            <div className="p-2.5 rounded-xl border bg-muted/20 space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                <Globe className="h-3 w-3 text-purple-400" /> Primary Host
              </span>
              <p className="font-semibold text-foreground truncate font-mono text-[11px]">
                {deliverability.primaryMxHost || 'None'}
              </p>
            </div>
          </div>

          {/* Recommendation Banner */}
          <div className={cn(
            "p-3 rounded-xl border text-xs leading-relaxed flex items-start gap-2.5",
            isVerified && "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300",
            isRisky && "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300",
            !isVerified && !isRisky && "bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-300"
          )}>
            {isVerified ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
            ) : isRisky ? (
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
            ) : (
              <XCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
            )}
            <div>
              <strong className="block font-bold">Campaign Recommendation:</strong>
              <span>{deliverability.recommendation}</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <DialogFooter className="p-4 bg-muted/20 border-t flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="rounded-xl min-h-[44px] text-xs font-semibold"
          >
            Close
          </Button>

          <Button
            type="button"
            onClick={handleReverify}
            disabled={isReverifying}
            className="rounded-xl min-h-[44px] text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-1.5 active:scale-[0.97] transition-transform"
          >
            {isReverifying ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Probing Mailbox...</span>
              </>
            ) : (
              <>
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Re-Verify Mailbox</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
