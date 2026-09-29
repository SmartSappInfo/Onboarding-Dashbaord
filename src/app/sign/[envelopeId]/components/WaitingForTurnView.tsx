'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Sequential Out-of-Order Lockout Screen (Phase 2, FM-P2-01 & Task 8).
 * 2. UX & Interaction Standards:
 *    - Renders an informative, friendly zero-state when a recipient accesses their capability
 *      link prior to preceding signatories completing their turn in the sequential chain.
 *    - Minimal Everyday English: Avoids technical jargon like "currentRoutingOrder mismatch"
 *      in favor of clear conversational progress guidance.
 *    - Touch & Ergonomics: Re-check button strictly enforces `min-h-[44px]` touch target
 *      and Emil Kowalski tactile spring interaction (`active:scale-[0.97]`).
 * 3. Strict Typing Standard (Rule 4 Zero-Tolerance Typing):
 *    Strictly zero `any` or `any[]`.
 */

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Shield, RefreshCw, Mail } from 'lucide-react';
import type { SigningEnvelope, EnvelopeRecipient } from '@/lib/types/document-signing';
import { useRouter } from 'next/navigation';

interface WaitingForTurnViewProps {
  envelope: SigningEnvelope;
  currentRecipient: EnvelopeRecipient;
  waitingReason?: string;
}

export default function WaitingForTurnView({
  envelope,
  currentRecipient,
  waitingReason,
}: WaitingForTurnViewProps) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  // Find who is holding the active routing order
  const activeSigner = envelope.recipients.find(
    (r) => r.routingOrder === envelope.currentRoutingOrder && r.status !== 'signed' && r.role !== 'viewer'
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-slate-50 dark:bg-slate-950">
      <Card className="max-w-lg w-full rounded-[2.5rem] border border-border/60 shadow-2xl overflow-hidden bg-card">
        {/* Top Visual Header */}
        <div className="p-8 sm:p-10 bg-amber-500/10 text-center relative overflow-hidden border-b border-amber-500/20">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-lg border border-amber-500/30 mb-4">
            <Clock className="h-8 w-8 animate-pulse" />
          </div>

          <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 font-semibold text-xs px-3 py-1 rounded-full uppercase tracking-wider mb-2">
            Sequential Signing Chain
          </Badge>

          <h2 className="text-2xl font-bold tracking-tight text-foreground">Waiting for Previous Signatory</h2>
          <p className="text-xs text-muted-foreground mt-1">
            This agreement executes in a secure, sequential order.
          </p>
        </div>

        <CardContent className="p-8 sm:p-10 space-y-6">
          {/* Document & Recipient Identification */}
          <div className="p-4 rounded-2xl bg-muted/40 border space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Document:</span>
              <span className="font-semibold text-foreground truncate max-w-[200px]">{envelope.title}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Your Assigned Role:</span>
              <Badge variant="outline" className="capitalize text-[11px] font-semibold">
                {currentRecipient.role} (Step {currentRecipient.routingOrder})
              </Badge>
            </div>
          </div>

          {/* Current Bottleneck Guidance */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Current Status</h4>
            <div className="p-4 rounded-2xl border border-primary/20 bg-primary/5 flex items-start gap-3">
              <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="space-y-1 text-left">
                <p className="text-sm font-semibold text-foreground">
                  {activeSigner
                    ? `Currently awaiting signature from ${activeSigner.name}`
                    : waitingReason || 'Awaiting completion of earlier signing steps.'}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  You are scheduled for <span className="font-semibold text-foreground">Step {currentRecipient.routingOrder}</span>. As soon as the preceding parties complete their review, your link will unlock immediately.
                </p>
              </div>
            </div>
          </div>

          {/* Reassurance Banner */}
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-left">
            <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-900 dark:text-blue-200 leading-relaxed font-medium">
              No need to stay on this page. We will automatically send you an email and SMS alert as soon as it is your turn.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              type="button"
              variant="default"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex-1 min-h-[48px] rounded-2xl font-semibold text-sm active:scale-[0.97] transition-all gap-2"
            >
              <RefreshCw className={isRefreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
              {isRefreshing ? 'Checking Status...' : 'Check If It’s My Turn'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
