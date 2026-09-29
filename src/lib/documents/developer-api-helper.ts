/**
 * Developer REST API Helper & Security Interceptor
 *
 * Provides standardized Bearer token authentication, scope checks,
 * token-bucket rate limiting enforcement, and RFC-compliant JSON response wrappers.
 *
 * Security Invariants:
 * 1. Rejects missing, malformed, or unapproved API keys with HTTP 401/403.
 * 2. Injects standard rate limit headers (X-RateLimit-*) on every response.
 * 3. Never leaks internal stack traces, private Cloud Storage paths, or raw secrets.
 *
 * @maintainer Antigravity Pair Programming
 */

import { NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/documents/api-key-auth-service';
import { checkApiRateLimit } from '@/lib/documents/api-rate-limiter-service';
import type { ApiKeyRecord, ApiKeyScope } from '@/lib/types/document-signing';

export interface DeveloperAuthContext {
  authenticated: true;
  keyRecord: ApiKeyRecord;
  rateLimitHeaders: Record<string, string>;
}

export interface DeveloperAuthFailure {
  authenticated: false;
  response: NextResponse;
}

export type DeveloperAuthResult = DeveloperAuthContext | DeveloperAuthFailure;

/**
 * Standardized success response envelope for Developer REST API.
 */
export function formatSuccessResponse<T>(
  data: T,
  meta: Record<string, unknown> = {},
  headers: Record<string, string> = {},
  status = 200
): NextResponse {
  const requestId = (meta.requestId as string) || `req_${crypto.randomUUID()}`;
  return NextResponse.json(
    {
      data,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        ...meta,
      },
    },
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    }
  );
}

/**
 * Standardized error response envelope for Developer REST API.
 */
export function formatErrorResponse(
  code: string,
  message: string,
  status: number,
  headers: Record<string, string> = {},
  details?: unknown
): NextResponse {
  const requestId = `err_${crypto.randomUUID()}`;
  return NextResponse.json(
    {
      error: {
        code,
        message,
        status,
        requestId,
        details: details || null,
      },
    },
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    }
  );
}

/**
 * Authenticates an incoming developer HTTP request and enforces rate limits.
 */
export async function authenticateDeveloperRequest(
  request: Request,
  requiredScope?: ApiKeyScope
): Promise<DeveloperAuthResult> {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      authenticated: false,
      response: formatErrorResponse(
        'UNAUTHORIZED',
        'Missing or malformed Authorization header. Expected Bearer token.',
        401
      ),
    };
  }

  const rawKey = authHeader.replace(/^Bearer\s+/i, '').trim();
  const authRes = await authenticateApiKey(rawKey, requiredScope);

  if (!authRes.authenticated || !authRes.keyRecord) {
    const isScopeError = authRes.reason?.includes('Insufficient scope');
    return {
      authenticated: false,
      response: formatErrorResponse(
        isScopeError ? 'FORBIDDEN' : 'UNAUTHORIZED',
        authRes.reason || 'Authentication failed',
        isScopeError ? 403 : 401
      ),
    };
  }

  // Enforce Rate Limiting
  const rateLimitRes = checkApiRateLimit(
    authRes.keyRecord.id,
    authRes.keyRecord.rateLimitTier
  );

  if (!rateLimitRes.isAllowed) {
    return {
      authenticated: false,
      response: formatErrorResponse(
        'RATE_LIMIT_EXCEEDED',
        `API rate limit exceeded. Please retry after ${rateLimitRes.retryAfterSeconds} seconds.`,
        429,
        rateLimitRes.headers
      ),
    };
  }

  return {
    authenticated: true,
    keyRecord: authRes.keyRecord,
    rateLimitHeaders: rateLimitRes.headers,
  };
}
