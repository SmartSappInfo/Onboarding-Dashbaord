/**
 * Public Developer REST API: /api/v1/envelopes/[id]/void
 *
 * POST: Voids an active envelope programmatically.
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

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateDeveloperRequest(request, 'envelopes:void');
  if (!auth.authenticated) {
    return auth.response;
  }

  const { id: envelopeId } = await context.params;
  const { workspaceId } = auth.keyRecord;

  let body: { reason?: string };
  try {
    body = (await request.json()) as { reason?: string };
  } catch {
    body = {};
  }

  const reason = (body.reason || '').trim();
  if (!reason) {
    return formatErrorResponse(
      'MISSING_VOID_REASON',
      'A non-empty reason is required to void an envelope.',
      400,
      auth.rateLimitHeaders
    );
  }

  const docRef = adminDb
    .collection(`workspaces/${workspaceId}/signing_envelopes`)
    .doc(envelopeId);

  const docSnap = await docRef.get();
  if (!docSnap.exists) {
    return formatErrorResponse(
      'NOT_FOUND',
      `Envelope ${envelopeId} not found in workspace`,
      404,
      auth.rateLimitHeaders
    );
  }

  const existing = docSnap.data() as SigningEnvelope;
  if (existing.status === 'completed') {
    return formatErrorResponse(
      'INVALID_STATE',
      'Completed envelopes cannot be voided.',
      400,
      auth.rateLimitHeaders
    );
  }

  const now = new Date().toISOString();
  await docRef.update({
    status: 'voided',
    voidReason: reason,
    voidedAt: now,
    updatedAt: now,
  });

  return formatSuccessResponse(
    {
      id: envelopeId,
      status: 'voided',
      reason,
      voidedAt: now,
    },
    {},
    auth.rateLimitHeaders
  );
}
