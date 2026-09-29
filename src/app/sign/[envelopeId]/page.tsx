/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Public Multi-Party Signing Route Entry Point (Phase 2, Task 8 & P2.5 UI).
 * 2. Next.js 15 Compliance:
 *    - `params` and `searchParams` are typed and resolved as Promises as required by Next.js 15.
 * 3. Security & Anti-Leakage:
 *    - Token validation is executed server-side via `getEnvelopeForSigningAction`.
 *    - Other signers' raw hashes are redacted before serialization to the browser client.
 * 4. Error & Lockout Handling:
 *    - Out-of-turn access routes directly to `<WaitingForTurnView>`.
 *    - Invalid/expired capability links display clear, non-technical recovery guidance.
 * 5. Strict Typing Standard (Rule 4 Zero-Tolerance Typing):
 *    Strictly zero `any` or `any[]`.
 */

import * as React from 'react';
import type { Metadata } from 'next';
import { getEnvelopeForSigningAction } from '@/lib/documents/envelope-actions';
import MultiPartySigningPortal from './components/MultiPartySigningPortal';
import WaitingForTurnView from './components/WaitingForTurnView';
import { Card } from '@/components/ui/card';
import { AlertCircle, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface PageProps {
  params: Promise<{ envelopeId: string }>;
  searchParams: Promise<{ token?: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ envelopeId: string }>;
}): Promise<Metadata> {
  const { envelopeId } = await params;
  return {
    title: `Sign Agreement (${envelopeId}) | SmartSapp Legal Hub`,
    description: 'Secure, legally binding document execution portal.',
    robots: { index: false, follow: false },
  };
}

export default async function SignEnvelopePage({ params, searchParams }: PageProps) {
  const { envelopeId } = await params;
  const { token } = await searchParams;

  // 1. Missing Token Check
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
        <Card className="max-w-md w-full rounded-[2.5rem] border shadow-2xl p-8 text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Lock className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">Access Link Required</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              This document requires a secure cryptographic capability token. Please use the personalized link provided in your email or SMS notification.
            </p>
          </div>
          <Button asChild variant="outline" className="w-full min-h-[44px] rounded-xl font-semibold">
            <Link href="/">Return to Home</Link>
          </Button>
        </Card>
      </div>
    );
  }

  // 2. Fetch Envelope & Verify Token
  const signingSession = await getEnvelopeForSigningAction(envelopeId, token.trim());

  if (!signingSession.success || !signingSession.envelope || !signingSession.currentRecipient) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
        <Card className="max-w-md w-full rounded-[2.5rem] border shadow-2xl p-8 text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center">
            <AlertCircle className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">Link Expired or Invalid</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {signingSession.error ||
                'This signing invitation is no longer active. It may have expired, been revoked, or already reached maximum capacity.'}
            </p>
          </div>
          <Button asChild variant="outline" className="w-full min-h-[44px] rounded-xl font-semibold">
            <Link href="/">Return to Home</Link>
          </Button>
        </Card>
      </div>
    );
  }

  // 3. Sequential Lockout Check
  if (!signingSession.isAuthorizedToSign) {
    return (
      <WaitingForTurnView
        envelope={signingSession.envelope}
        currentRecipient={signingSession.currentRecipient}
        waitingReason={signingSession.waitingReason}
      />
    );
  }

  // 4. Authorized Signing Viewport
  return (
    <MultiPartySigningPortal
      envelope={signingSession.envelope}
      currentRecipient={signingSession.currentRecipient}
      rawToken={token.trim()}
    />
  );
}
