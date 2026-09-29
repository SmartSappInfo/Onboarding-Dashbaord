/**
 * Public Developer REST API: /api/v1/envelopes/[id]
 *
 * GET: Retrieves envelope details by ID with sensitive recipient PII and signing tokens redacted.
 *
 * @maintainer Antigravity Pair Programming
 */

import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import {
  authenticateDeveloperRequest,
  formatSuccessResponse,
  formatErrorResponse,
} from '@/lib/documents/developer-api-helper';
import type { SigningEnvelope } from '@/lib/types/document-signing';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateDeveloperRequest(request, 'envelopes:read');
  if (!auth.authenticated) {
    return auth.response;
  }

  const { id: envelopeId } = await context.params;
  const { workspaceId } = auth.keyRecord;

  const docSnap = await adminDb
    .collection('signing_envelopes')
    .doc(envelopeId)
    .get();

  if (!docSnap.exists) {
    return formatErrorResponse(
      'NOT_FOUND',
      `Envelope ${envelopeId} not found in workspace`,
      404,
      auth.rateLimitHeaders
    );
  }

  const data = docSnap.data() as SigningEnvelope;
  if (data.workspaceId !== workspaceId) {
    return formatErrorResponse(
      'NOT_FOUND',
      `Envelope ${envelopeId} not found in workspace`,
      404,
      auth.rateLimitHeaders
    );
  }

  // Redact any raw signing tokens or internal secrets from recipient records
  const sanitizedRecipients = (data.recipients || []).map((r) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { ...safeRecipient } = r as Record<string, unknown>;
    delete safeRecipient.signingToken;
    delete safeRecipient.tokenHash;
    delete safeRecipient.otpSecret;
    return safeRecipient;
  });

  return formatSuccessResponse(
    {
      id: docSnap.id,
      title: data.title,
      status: data.status,
      routingMode: data.routingMode,
      recipients: sanitizedRecipients,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      expiresAt: data.expiresAt,
      completedAt: data.completedAt,
    },
    {},
    auth.rateLimitHeaders
  );
}
