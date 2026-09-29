/**
 * Embedded Document Signing Host Page (Phase 8)
 *
 * Dedicated zero-chrome route for partner iframe embedding.
 * Validates signing tokens server-side, manages postMessage messaging,
 * and restricts iframe framing to authorized workspace origins (FM-P8-05, FM-P8-06).
 *
 * Next.js 15 Compliance:
 * - `params` and `searchParams` are resolved as Promises.
 *
 * @maintainer Antigravity Pair Programming
 */

import * as React from 'react';
import type { Metadata } from 'next';
import { getEnvelopeForSigningAction } from '@/lib/documents/envelope-actions';
import { EmbeddedSigningHost } from './components/EmbeddedSigningHost';
import { adminDb } from '@/lib/firebase-admin';
import { Card } from '@/components/ui/card';
import { AlertCircle, Lock } from 'lucide-react';

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ envelopeId?: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  return {
    title: `Embedded Sign Document | SmartSapp Legal Hub`,
    description: 'Secure embedded document signing portal.',
    robots: { index: false, follow: false },
    other: {
      'signing-session': token.slice(0, 8),
    },
  };
}

export default async function EmbeddedSignPage({ params, searchParams }: PageProps) {
  const { token: rawParamToken } = await params;
  const { envelopeId: queryEnvelopeId } = await searchParams;

  // Resolve envelopeId and rawToken:
  // If token is in composite format 'env_123:tok_abc' or query param provides envelopeId
  let envelopeId = queryEnvelopeId || '';
  let token = rawParamToken;

  if (rawParamToken.includes(':')) {
    const parts = rawParamToken.split(':');
    envelopeId = parts[0];
    token = parts.slice(1).join(':');
  }

  // 1. Missing Identifier Check
  if (!token || !envelopeId) {
    return (
      <div className="min-h-[400px] flex items-center justify-center p-4 bg-background">
        <Card className="max-w-sm w-full p-6 text-center space-y-4 border shadow-sm rounded-2xl">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
            <Lock className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold">Signing Link Required</h2>
            <p className="text-xs text-muted-foreground">
              Missing envelope reference or valid access token for embedded signing.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // 2. Fetch Envelope and Verify Token
  const signingSession = await getEnvelopeForSigningAction(envelopeId, token.trim());

  if (!signingSession.success || !signingSession.envelope || !signingSession.currentRecipient) {
    return (
      <div className="min-h-[400px] flex items-center justify-center p-4 bg-background">
        <Card className="max-w-sm w-full p-6 text-center space-y-4 border shadow-sm rounded-2xl">
          <div className="w-12 h-12 rounded-xl bg-destructive/10 text-destructive mx-auto flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold">Session Invalid or Expired</h2>
            <p className="text-xs text-muted-foreground">
              {signingSession.error || 'This signing capability link is invalid or has expired.'}
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // 3. Load workspace embed settings for allowedOrigins
  let allowedOrigins: string[] = [];
  try {
    const settingsDoc = await adminDb
      .doc(`workspaces/${signingSession.envelope.workspaceId}/settings/embedded_signing`)
      .get();
    if (settingsDoc.exists) {
      const data = settingsDoc.data();
      if (Array.isArray(data?.allowedEmbedOrigins)) {
        allowedOrigins = data.allowedEmbedOrigins as string[];
      }
    }
  } catch {
    // Non-fatal fallback to empty
  }

  return (
    <EmbeddedSigningHost
      envelope={signingSession.envelope}
      recipient={signingSession.currentRecipient}
      token={token}
      isAuthorizedToSign={Boolean(signingSession.isAuthorizedToSign)}
      waitingReason={signingSession.waitingReason}
      allowedOrigins={allowedOrigins}
    />
  );
}
