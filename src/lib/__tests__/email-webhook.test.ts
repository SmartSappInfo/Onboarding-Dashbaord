import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../../app/api/webhooks/email/route';
import { processUnsubscribe } from '../services/unsubscribe-service';

// Mock Svix for webhook verification
const mockVerify = vi.fn();
vi.mock('svix', () => ({
  Webhook: vi.fn(() => ({
    verify: mockVerify,
  })),
}));

// Mock unsubscribe service inside factory to avoid temporal dead zone errors
vi.mock('../services/unsubscribe-service', () => {
  const mockProcess = vi.fn();
  return {
    processUnsubscribe: mockProcess,
    generateUnsubscribeToken: vi.fn(),
    verifyUnsubscribeToken: vi.fn(),
    generateSecureUnsubscribeLink: vi.fn(),
  };
});

// Helper: Build a mock Request object matching Next.js App Router signature
function buildMockRequest(
  body: Record<string, any>,
  headers: Record<string, string> = {}
): Request {
  const bodyString = JSON.stringify(body);
  return new Request('http://localhost/api/webhooks/email', {
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

describe('POST /api/webhooks/email', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_WEBHOOK_SECRET = 'whsec_test_secret';
  });

  it('should be exported as a POST function', () => {
    expect(typeof POST).toBe('function');
  });

  it('should return 400 when signature verification fails', async () => {
    mockVerify.mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    const req = buildMockRequest({ type: 'email.bounced', data: {} });
    const response = await POST(req);

    expect(response.status).toBe(400);
  });

  it('should process email.bounced event and return 200', async () => {
    mockVerify.mockReturnValue({
      type: 'email.bounced',
      data: {
        to: ['bounced-user@example.com'],
        email_id: 'email-id-123'
      },
    });

    const req = buildMockRequest({
      type: 'email.bounced',
      data: {
        to: ['bounced-user@example.com'],
        email_id: 'email-id-123'
      },
    });
    
    const response = await POST(req);
    expect(response.status).toBe(200);
    
    // Check if processUnsubscribe was called
    expect(processUnsubscribe).toHaveBeenCalledWith(
      'bounced-user@example.com',
      expect.objectContaining({ emailStatus: 'bounced' })
    );
  });

  it('should process email.complained event and return 200', async () => {
    mockVerify.mockReturnValue({
      type: 'email.complained',
      data: {
        to: ['spam-reporter@example.com'],
        email_id: 'email-id-456'
      },
    });

    const req = buildMockRequest({
      type: 'email.complained',
      data: {
        to: ['spam-reporter@example.com'],
        email_id: 'email-id-456'
      },
    });
    
    const response = await POST(req);
    expect(response.status).toBe(200);
    
    expect(processUnsubscribe).toHaveBeenCalledWith(
      'spam-reporter@example.com',
      expect.objectContaining({ emailStatus: 'complained' })
    );
  });

  it('should process multi-recipient to array and call processUnsubscribe for each', async () => {
    mockVerify.mockReturnValue({
      type: 'email.bounced',
      data: {
        to: ['user1@example.com', 'user2@example.com'],
        email_id: 'email-id-789'
      },
    });

    const req = buildMockRequest({
      type: 'email.bounced',
      data: {
        to: ['user1@example.com', 'user2@example.com'],
        email_id: 'email-id-789'
      },
    });
    
    const response = await POST(req);
    expect(response.status).toBe(200);
    
    expect(processUnsubscribe).toHaveBeenCalledWith(
      'user1@example.com',
      expect.objectContaining({ emailStatus: 'bounced' })
    );
    expect(processUnsubscribe).toHaveBeenCalledWith(
      'user2@example.com',
      expect.objectContaining({ emailStatus: 'bounced' })
    );
  });
});
