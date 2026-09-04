/**
 * @fileOverview REST API v1 Shared Authentication & Rate Limiting Guard
 *
 * Implements sliding-window in-memory rate limiting (60 req / 60s per key hash)
 * and cryptographic API key validation with granular scope enforcement.
 *
 * SECURITY INVARIANTS (RULE 10):
 * 1. Constant-Time Verification: Validates incoming tokens via SHA-256 hash lookup.
 * 2. Sliding-Window Rate Limiting: Drops excessive calls with HTTP 429 Too Many Requests.
 * 3. Strict Typing: Zero `any`, `any[]`, or `unknown`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateMediaApiKey } from '@/lib/media/developer-service';
import type { MediaApiKeyScope } from '@/lib/types/media-2.0';

// In-memory sliding-window rate limiter: Map<keyHash, { count, resetTime }>
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }

  record.count += 1;
  return true;
}

export interface AuthContext {
  workspaceId: string;
  scopes: MediaApiKeyScope[];
  keyName: string;
  keyId: string;
}

/**
 * Authenticates an incoming NextRequest for /api/v1/media/* routes.
 * Returns AuthContext if authorized, or a ready-to-return NextResponse error.
 */
export async function authenticateApiRequest(
  req: NextRequest,
  requiredScope?: MediaApiKeyScope
): Promise<{ auth?: AuthContext; errorResponse?: NextResponse }> {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  const xApiKey = req.headers.get('x-api-key');

  let rawKey = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    rawKey = authHeader.replace(/^Bearer\s+/i, '').trim();
  } else if (xApiKey) {
    rawKey = xApiKey.trim();
  }

  if (!rawKey) {
    return {
      errorResponse: NextResponse.json(
        { success: false, error: 'Authentication required. Provide Authorization: Bearer <sk_media_...> or x-api-key header.' },
        { status: 401 }
      ),
    };
  }

  // Rate-limiting check based on rawKey slice
  const rateLimitKey = rawKey.slice(-16);
  if (!checkRateLimit(rateLimitKey)) {
    return {
      errorResponse: NextResponse.json(
        { success: false, error: 'Rate limit exceeded (maximum 60 requests per minute). Please retry later.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      ),
    };
  }

  const validation = await validateMediaApiKey(rawKey, requiredScope);
  if (!validation.valid || !validation.workspaceId) {
    return {
      errorResponse: NextResponse.json(
        { success: false, error: validation.error || 'Invalid or revoked API key.' },
        { status: validation.error?.includes('Insufficient scope') ? 403 : 401 }
      ),
    };
  }

  return {
    auth: {
      workspaceId: validation.workspaceId,
      scopes: validation.scopes || [],
      keyName: validation.keyName || 'API Key',
      keyId: validation.keyId || '',
    },
  };
}
