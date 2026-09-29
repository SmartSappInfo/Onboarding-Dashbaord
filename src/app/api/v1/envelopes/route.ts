/**
 * Public Developer REST API: /api/v1/envelopes
 *
 * GET: Lists envelopes belonging to the authenticated workspace.
 * POST: Dispatches a new signing envelope programmatically.
 *
 * Security:
 * - Scoped auth (envelopes:read for GET, envelopes:create for POST)
 * - Rate limiting enforced on all endpoints
 * - Idempotency key validation (FM-P8-11)
 *
 * @maintainer Antigravity Pair Programming
 */

import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import {
  authenticateDeveloperRequest,
  formatSuccessResponse,
  formatErrorResponse,
} from '@/lib/documents/developer-api-helper';
import {
  CreateEnvelopeApiRequestSchema,
  type SigningEnvelope,
  type EnvelopeRecipient,
} from '@/lib/types/document-signing';

const IDEMPOTENCY_KEY_REGEX = /^[A-Za-z0-9_-]{8,128}$/;

export async function GET(request: NextRequest) {
  const auth = await authenticateDeveloperRequest(request, 'envelopes:read');
  if (!auth.authenticated) {
    return auth.response;
  }

  const { workspaceId } = auth.keyRecord;
  const snapshot = await adminDb
    .collection(`workspaces/${workspaceId}/signing_envelopes`)
    .where('workspaceId', '==', workspaceId)
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get();

  const envelopes = snapshot.docs.map((doc) => {
    const data = doc.data() as SigningEnvelope;
    return {
      id: doc.id,
      title: data.title || 'Untitled Envelope',
      status: data.status,
      recipientCount: data.recipients?.length || 0,
      createdAt: data.createdAt,
    };
  });

  return formatSuccessResponse(envelopes, {}, auth.rateLimitHeaders);
}

export async function POST(request: NextRequest) {
  const auth = await authenticateDeveloperRequest(request, 'envelopes:create');
  if (!auth.authenticated) {
    return auth.response;
  }

  const { workspaceId } = auth.keyRecord;

  // Validate Idempotency Key if present
  const idempotencyKey = request.headers.get('Idempotency-Key') || request.headers.get('idempotency-key');
  if (idempotencyKey && !IDEMPOTENCY_KEY_REGEX.test(idempotencyKey)) {
    return formatErrorResponse(
      'INVALID_IDEMPOTENCY_KEY',
      'Idempotency-Key header must be between 8 and 128 characters and contain only letters, numbers, underscores, and dashes.',
      400,
      auth.rateLimitHeaders
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return formatErrorResponse(
      'INVALID_JSON',
      'Failed to parse request body as valid JSON.',
      400,
      auth.rateLimitHeaders
    );
  }

  const parseResult = CreateEnvelopeApiRequestSchema.safeParse(body);
  if (!parseResult.success) {
    return formatErrorResponse(
      'VALIDATION_FAILED',
      'Envelope creation payload validation failed.',
      400,
      auth.rateLimitHeaders,
      parseResult.error.format()
    );
  }

  const payload = parseResult.data;
  const envelopeId = `env_${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const recipients: EnvelopeRecipient[] = payload.recipients.map((r, idx) => {
    const rawToken = crypto.randomUUID();
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const recipientId = `rec_${crypto.randomUUID()}`;
    const role = (r.role === 'countersigner' ? 'countersigner' : r.role === 'approver' ? 'approver' : 'signer');
    return {
      id: recipientId,
      workspaceId,
      envelopeId,
      role,
      name: r.displayName,
      email: r.email || 'developer-api@example.com',
      phone: r.phone,
      routingOrder: r.routingOrder || idx + 1,
      status: (r.routingOrder === 1 ? 'invited' : 'pending') as 'invited' | 'pending',
      tokenHash,
      tokenExpiresAt: expiresAt,
    };
  });

  const envelopeRecord: SigningEnvelope = {
    id: envelopeId,
    workspaceId,
    title: payload.title,
    status: 'sent',
    routingMode: 'sequential',
    currentRoutingOrder: 1,
    recipients,
    documentStoragePath: `workspaces/${workspaceId}/envelopes/${envelopeId}/document.pdf`,
    preExecutionSha256: '0'.repeat(64),
    expiresAt,
    createdBy: auth.keyRecord.id,
    createdAt: now,
    updatedAt: now,
    templateId: payload.templateId,
    idempotencyKey: idempotencyKey || undefined,
  };

  await adminDb
    .collection(`workspaces/${workspaceId}/signing_envelopes`)
    .doc(envelopeId)
    .set(envelopeRecord);

  return formatSuccessResponse(
    {
      envelopeId,
      status: 'sent',
      recipients: recipients.map((rec) => ({
        recipientId: rec.id,
        role: rec.role,
        displayName: rec.name,
        email: rec.email,
        status: rec.status,
      })),
    },
    {
      requestId: `req_${crypto.randomUUID()}`,
      idempotencyKey: idempotencyKey || null,
    },
    auth.rateLimitHeaders,
    201
  );
}
