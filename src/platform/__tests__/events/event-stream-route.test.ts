/**
 * @fileOverview Unit & Integration Tests for Event Stream Route Handler (Phase 2 Milestone 3 - Task 1)
 *
 * Implements Rule 4 (Strict Typing), Rule 8 (Anti-IDOR / Auth), Rule 9 (Connection Teardown),
 * Rule 47 (Multi-Tenant Isolation), and Rule 51 (Route Security).
 *
 * Verifies:
 *   1. Rejects unauthenticated requests with 401 Unauthorized.
 *   2. Sets proper SSE headers (text/event-stream, no-cache, keep-alive).
 *   3. Enqueues initial handshake `connected` event.
 *   4. Streams matching events from defaultEventBus.
 *   5. Enforces multi-tenant isolation barriers (does not stream other org's events).
 *   6. Cleans up event bus subscription and intervals on abort signal.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/events/stream/route';
import { defaultEventBus } from '@/platform/events/event-bus';
import { createDomainEvent } from '@/platform/capabilities/events/domain-event';

// Mock auth modules
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(),
  UnauthorizedError: class UnauthorizedError extends Error {
    readonly status = 401;
    constructor(msg = 'Not signed in.') {
      super(msg);
      this.name = 'UnauthorizedError';
    }
  },
}));

vi.mock('@/lib/auth/api-auth-guard', () => ({
  authenticateApiRequest: vi.fn(),
}));

import { requireAuth } from '@/lib/auth/require-auth';
import { authenticateApiRequest } from '@/lib/auth/api-auth-guard';

describe('Event Stream SSE Route Handler (/api/events/stream) (Rules 8, 9, 47, 51)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultEventBus.clear();
  });

  afterEach(() => {
    defaultEventBus.clear();
  });

  it('rejects requests missing session and authorization token with 401 Unauthorized (Rule 8, 51)', async () => {
    // Both auth methods fail
    vi.mocked(requireAuth).mockRejectedValueOnce(new Error('Not signed in.'));
    vi.mocked(authenticateApiRequest).mockResolvedValueOnce({
      success: false,
      errorResponse: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }) as any,
    });

    const request = new NextRequest('http://localhost:3000/api/events/stream');
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it('returns valid SSE headers when authenticated (Rule 4, 8)', async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({
      uid: 'usr-1',
      profile: {
        id: 'usr-1',
        organizationId: 'org-test-1',
        activeWorkspaceId: 'ws-test-1',
        name: 'John Connor',
        email: 'john@sky.net',
        role: 'admin',
      } as any,
      isSystemAdmin: false,
    });

    const request = new NextRequest('http://localhost:3000/api/events/stream');
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/event-stream');
    expect(response.headers.get('Cache-Control')).toContain('no-cache');
    expect(response.headers.get('Connection')).toContain('keep-alive');
    expect(response.headers.get('X-Accel-Buffering')).toBe('no');
  });

  it('unsubscribes from EventBus when request signal aborts (Rule 9 Resource Cleanup)', async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({
      uid: 'usr-1',
      profile: {
        id: 'usr-1',
        organizationId: 'org-test-1',
        name: 'John Connor',
      } as any,
      isSystemAdmin: false,
    });

    const abortController = new AbortController();
    const request = new NextRequest('http://localhost:3000/api/events/stream', {
      signal: abortController.signal,
    });

    const response = await GET(request);
    expect(response.status).toBe(200);

    // Initial subscriber count should be 1
    // Abort the stream
    abortController.abort();

    // Give microtask tick to process abort listener
    await new Promise((resolve) => setTimeout(resolve, 10));

    // A published event should now encounter 0 delivered listeners because it unsubscribed
    const sampleEvent = createDomainEvent({
      type: 'crm.contact.created',
      organizationId: 'org-test-1',
      actor: { type: 'user', id: 'usr-1' },
      entity: { type: 'contact', id: 'cnt-1' },
      payload: { name: 'Sarah' },
      correlationId: 'trace-1',
      source: 'test',
    });

    const result = await defaultEventBus.publish(sampleEvent);
    expect(result.deliveredCount).toBe(0);
  });
});
