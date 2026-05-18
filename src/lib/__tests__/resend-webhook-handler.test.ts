// Generated with: resend-webhooks skill
// https://github.com/hookdeck/webhook-skills
// @ts-nocheck
/**
 * Resend Webhook Handler Tests — Phase 0 (RED)
 *
 * These tests verify the POST /api/messaging/webhooks/resend route that will:
 *
 * 1. Verify Svix signatures using resend.webhooks.verify().
 * 2. Parse the event type and route to the correct handler.
 * 3. Map email_id back to a MessageTask and update its externalStatus.
 * 4. Handle duplicate events idempotently.
 * 5. Return 400 for invalid signatures.
 * 6. Return 200 immediately for valid events (respond quickly pattern).
 *
 * TDD: These tests must FAIL before implementation exists.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock Firestore
const mockTaskQueryResult: any[] = [];
const mockTaskUpdateCalls: any[] = [];

vi.mock('../../lib/firebase-admin', () => ({
  adminDb: {
    collectionGroup: vi.fn(() => ({
      where: vi.fn().mockReturnThis(),
      limit: vi.fn(() => ({
        get: vi.fn(async () => ({
          empty: mockTaskQueryResult.length === 0,
          docs: [...mockTaskQueryResult],
        })),
      })),
    })),
  },
}));

// Mock Svix for webhook verification
const mockVerify = vi.fn();
vi.mock('svix', () => ({
  Webhook: vi.fn(() => ({
    verify: mockVerify,
  })),
}));

// ---------------------------------------------------------------------------
// Helper: Build a mock Request object matching Next.js App Router signature
// ---------------------------------------------------------------------------
function buildMockRequest(
  body: Record<string, any>,
  headers: Record<string, string> = {}
): Request {
  const bodyString = JSON.stringify(body);
  return new Request('http://localhost/api/messaging/webhooks/resend', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'svix-id': 'msg_test123',
      'svix-timestamp': Math.floor(Date.now() / 1000).toString(),
      'svix-signature': 'v1,test-signature',
      ...headers,
    },
    body: bodyString,
  });
}

// Import the route handler — this will fail until we create it
import { POST } from '../../app/api/messaging/webhooks/resend/route';

describe('POST /api/messaging/webhooks/resend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTaskQueryResult.length = 0;
    mockTaskUpdateCalls.length = 0;
    // Set the webhook secret so the route doesn't early-return with 500
    process.env.RESEND_WEBHOOK_SECRET = 'whsec_test_secret';
  });

  // ── Test 1: The route handler exists and is callable ─────────────────
  it('should be exported as a POST function', () => {
    expect(typeof POST).toBe('function');
  });

  // ── Test 2: Rejects requests with invalid signatures ─────────────────
  it('should return 400 when signature verification fails', async () => {
    mockVerify.mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    const req = buildMockRequest({ type: 'email.sent', data: {} });
    const response = await POST(req);

    expect(response.status).toBe(400);
  });

  // ── Test 3: Returns 200 for valid verified events ────────────────────
  it('should return 200 for a valid email.delivered event', async () => {
    mockVerify.mockReturnValue({
      type: 'email.delivered',
      data: { email_id: 'resend-id-123' },
    });

    // Simulate finding the matching task
    const taskRef = { update: vi.fn() };
    mockTaskQueryResult.push({
      id: 'task-abc',
      ref: taskRef,
      data: () => ({
        providerId: 'resend-id-123',
        status: 'sent',
        externalStatus: undefined,
      }),
    });

    const req = buildMockRequest({
      type: 'email.delivered',
      data: { email_id: 'resend-id-123' },
    });
    const response = await POST(req);

    expect(response.status).toBe(200);
  });

  // ── Test 4: Updates MessageTask externalStatus on delivery ───────────
  it('should update the MessageTask externalStatus to "delivered"', async () => {
    mockVerify.mockReturnValue({
      type: 'email.delivered',
      data: { email_id: 'resend-id-456' },
    });

    const taskRef = { update: vi.fn() };
    mockTaskQueryResult.push({
      id: 'task-def',
      ref: taskRef,
      data: () => ({
        providerId: 'resend-id-456',
        status: 'sent',
      }),
    });

    const req = buildMockRequest({
      type: 'email.delivered',
      data: { email_id: 'resend-id-456' },
    });
    await POST(req);

    expect(taskRef.update).toHaveBeenCalledWith(
      expect.objectContaining({
        externalStatus: 'delivered',
      })
    );
  });

  // ── Test 5: Updates externalStatus on bounce ─────────────────────────
  it('should update externalStatus to "bounced" for email.bounced events', async () => {
    mockVerify.mockReturnValue({
      type: 'email.bounced',
      data: { email_id: 'resend-id-789' },
    });

    const taskRef = { update: vi.fn() };
    mockTaskQueryResult.push({
      id: 'task-ghi',
      ref: taskRef,
      data: () => ({
        providerId: 'resend-id-789',
        status: 'sent',
      }),
    });

    const req = buildMockRequest({
      type: 'email.bounced',
      data: { email_id: 'resend-id-789' },
    });
    await POST(req);

    expect(taskRef.update).toHaveBeenCalledWith(
      expect.objectContaining({
        externalStatus: 'bounced',
      })
    );
  });

  // ── Test 6: Handles duplicate events idempotently ────────────────────
  it('should not update a task that already has the same externalStatus', async () => {
    mockVerify.mockReturnValue({
      type: 'email.delivered',
      data: { email_id: 'resend-id-dup' },
    });

    const taskRef = { update: vi.fn() };
    mockTaskQueryResult.push({
      id: 'task-dup',
      ref: taskRef,
      data: () => ({
        providerId: 'resend-id-dup',
        status: 'sent',
        externalStatus: 'delivered', // Already set
      }),
    });

    const req = buildMockRequest({
      type: 'email.delivered',
      data: { email_id: 'resend-id-dup' },
    });
    await POST(req);

    // Should NOT update since externalStatus is already 'delivered'
    expect(taskRef.update).not.toHaveBeenCalled();
  });

  // ── Test 7: Handles unknown email_id gracefully ──────────────────────
  it('should return 200 even when no matching task is found', async () => {
    mockVerify.mockReturnValue({
      type: 'email.delivered',
      data: { email_id: 'resend-id-unknown' },
    });

    // No matching tasks
    mockTaskQueryResult.length = 0;

    const req = buildMockRequest({
      type: 'email.delivered',
      data: { email_id: 'resend-id-unknown' },
    });
    const response = await POST(req);

    // Should still return 200 (webhook best practice: respond quickly)
    expect(response.status).toBe(200);
  });
});
