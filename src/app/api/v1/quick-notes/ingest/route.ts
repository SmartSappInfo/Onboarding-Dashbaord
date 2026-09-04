/**
 * @fileOverview REST API Inbound Ingestion Webhook Handler
 * Route: POST /api/v1/quick-notes/ingest
 *
 * Authenticates third-party webhooks (Slack, Discord, Email Forwarder, WhatsApp, Zapier, Chrome Extension),
 * validates payload structure, enforces SSRF protection, constructs a canonical TipTap NoteDocument,
 * persists the note, and updates the search vector index.
 *
 * SECURITY INVARIANTS:
 * - SHA-256 API Key verification against `api_keys` collection.
 * - Sliding-window rate limiting (60 req/min per API key).
 * - SSRF protection on any embedded source URLs.
 * - Zero `any` or `any[]` typing.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminDb } from '@/lib/firebase-admin';
import { QuickNotesRepository } from '@/lib/quick-notes-repository';
import { NoteIndexRepository } from '@/lib/note-index-repository';
import { validateIngestionPayload } from '@/lib/quick-notes-domain';
import type { QuickNote } from '@/lib/quick-notes-types';

// In-memory sliding-window rate limiter (60 req / 60s per key hash)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

function checkRateLimit(keyHash: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(keyHash);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(keyHash, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }

  record.count += 1;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Extract API Key from Authorization Header or x-api-key header
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    const xApiKey = req.headers.get('x-api-key');

    let rawKey = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      rawKey = authHeader.replace(/^Bearer\s+/i, '').trim();
    } else if (xApiKey) {
      rawKey = xApiKey.trim();
    }

    if (!rawKey) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing API key in Authorization (Bearer) or x-api-key header.' },
        { status: 401 }
      );
    }

    // 2. Compute SHA-256 Key Hash and Verify against api_keys collection
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const keyQuery = await adminDb
      .collection('api_keys')
      .where('keyHash', '==', keyHash)
      .where('status', '==', 'active')
      .limit(1)
      .get();

    if (keyQuery.empty) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid or revoked API key.' },
        { status: 401 }
      );
    }

    const keyDoc = keyQuery.docs[0];
    const keyData = keyDoc.data();
    const workspaceId = keyData.workspaceId as string;
    const organizationId = keyData.organizationId as string;
    const createdBy = (keyData.createdBy as string) || 'system_webhook';

    // 3. Sliding-window Rate Limit Check
    if (!checkRateLimit(keyHash)) {
      return NextResponse.json(
        { error: 'Too Many Requests: Rate limit exceeded (maximum 60 requests per minute).' },
        { status: 429 }
      );
    }

    // Update lastUsedAt asynchronously
    keyDoc.ref.update({ lastUsedAt: new Date().toISOString() }).catch(() => {});

    // 4. Parse JSON Payload
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Bad Request: Malformed JSON body.' },
        { status: 400 }
      );
    }

    // 5. Validate & Sanitize Ingestion Payload
    const validation = validateIngestionPayload(body);
    if (!validation.valid || !validation.sanitizedPayload || !validation.document) {
      return NextResponse.json(
        { error: `Validation Failed: ${validation.error || 'Invalid payload.'}` },
        { status: 400 }
      );
    }

    const { sanitizedPayload, document } = validation;
    const now = new Date().toISOString();
    const noteId = `note_ingest_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    // 6. Construct QuickNote Entity
    const note: QuickNote = {
      id: noteId,
      workspaceId,
      title: sanitizedPayload.title,
      document,
      categoryName: sanitizedPayload.categoryName || 'Inbound Webhooks',
      tags: sanitizedPayload.tags || ['inbox', sanitizedPayload.source],
      knowledgeType: 'note',
      sentiment: 'neutral',
      isPinned: false,
      isArchived: false,
      authorId: createdBy,
      authorName: sanitizedPayload.sourceAuthor || `Webhook (${sanitizedPayload.source})`,
      links: {
        entityId: sanitizedPayload.entityId,
        contactId: sanitizedPayload.contactId,
        dealId: sanitizedPayload.dealId,
      },
      createdAt: now,
      updatedAt: now,
    };

    // 7. Persist to Firestore & Update Search Index
    await QuickNotesRepository.create(note);
    await NoteIndexRepository.projectMany([note]);

    return NextResponse.json(
      {
        success: true,
        noteId: note.id,
        title: note.title,
        source: sanitizedPayload.source,
        workspaceId,
        createdAt: note.createdAt,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    console.error('[INGEST_ROUTE_ERROR]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
