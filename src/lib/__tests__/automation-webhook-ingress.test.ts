import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../../app/api/automations/webhook/[id]/route';
import { adminDb } from '../firebase-admin';
import { triggerAutomationProtocols } from '../automation-processor';

const mockUpdate = vi.fn();
const mockGet = vi.fn();

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: mockGet,
        update: mockUpdate,
      })),
    })),
  },
}));

vi.mock('@/lib/automation-processor', () => ({
  triggerAutomationProtocols: vi.fn().mockResolvedValue(undefined),
}));

// Mock Next.js "after" utility to run immediately for simple testing
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return {
    ...actual,
    NextResponse: actual.NextResponse,
    after: vi.fn((cb) => cb()),
  };
});

describe('Webhook Ingress API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('successfully parses JSON body, filters headers, and updates Firestore when automation is active', async () => {
    // Mock active automation blueprint
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({
        trigger: 'WEBHOOK_RECEIVED',
        isActive: true,
        workspaceIds: ['ws-test-123'],
        organizationId: 'org-test-456',
      }),
    });

    const requestBody = { customer: { name: 'Alice', email: 'alice@example.com' } };
    const req = new Request('http://localhost:9002/api/automations/webhook/auto-123?utm_source=ad', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-test-header': 'hello-world',
        'x-cf-connecting-ip': '1.1.1.1', // should be filtered out
      },
      body: JSON.stringify(requestBody),
    });

    const params = Promise.resolve({ id: 'auto-123' });
    const res = await POST(req, { params });
    const jsonResponse = await res.json();

    expect(res.status).toBe(200);
    expect(jsonResponse.status).toBe('accepted');

    // Verify database update
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        latestCapturedWebhook: expect.objectContaining({
          body: requestBody,
          headers: expect.objectContaining({
            'x-test-header': 'hello-world',
          }),
          query: { utm_source: 'ad' },
        }),
      })
    );

    // Verify internal CF headers are filtered
    const updateArg = mockUpdate.mock.calls[0][0] as any;
    expect(updateArg.latestCapturedWebhook.headers['x-cf-connecting-ip']).toBeUndefined();

    // Verify automation processor triggers flow
    expect(triggerAutomationProtocols).toHaveBeenCalledWith(
      'WEBHOOK_RECEIVED',
      expect.objectContaining({
        'customer.name': 'Alice',
        'customer.email': 'alice@example.com',
        workspaceId: 'ws-test-123',
        organizationId: 'org-test-456',
        ingressId: 'auto-123',
        source: 'external_webhook',
      })
    );
  });

  it('returns captured status and skips triggering flow if automation is inactive', async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({
        trigger: 'WEBHOOK_RECEIVED',
        isActive: false,
        workspaceIds: ['ws-test-123'],
        organizationId: 'org-test-456',
      }),
    });

    const requestBody = { status: 'testing' };
    const req = new Request('http://localhost:9002/api/automations/webhook/auto-123', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const params = Promise.resolve({ id: 'auto-123' });
    const res = await POST(req, { params });
    const jsonResponse = await res.json();

    expect(res.status).toBe(200);
    expect(jsonResponse.status).toBe('captured');

    // DB should still be updated with captured response
    expect(mockUpdate).toHaveBeenCalled();
    // Inactive automation should not trigger protocols
    expect(triggerAutomationProtocols).not.toHaveBeenCalled();
  });

  it('handles multipart/form-data with text fields and file attachments metadata extraction', async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({
        trigger: 'WEBHOOK_RECEIVED',
        isActive: true,
        workspaceIds: ['ws-test-123'],
        organizationId: 'org-test-456',
      }),
    });

    const req = new Request('http://localhost:9002/api/automations/webhook/auto-123', {
      method: 'POST',
      headers: { 'content-type': 'multipart/form-data' },
    });

    req.formData = async () => {
      const fd = new FormData();
      fd.append('username', 'bob_builder');
      
      const fileBlob = new Blob(['file content'], { type: 'image/png' });
      Object.defineProperty(fileBlob, 'name', { value: 'avatar.png' });
      Object.defineProperty(fileBlob, 'size', { value: 1024 });
      
      fd.append('profile_pic', fileBlob as any, 'avatar.png');
      return fd;
    };

    const params = Promise.resolve({ id: 'auto-123' });
    const res = await POST(req, { params });
    expect(res.status).toBe(200);

    const updateArg = mockUpdate.mock.calls[0][0] as any;
    expect(updateArg.latestCapturedWebhook.body).toEqual({ username: 'bob_builder' });
    expect(updateArg.latestCapturedWebhook.files).toHaveLength(1);
    expect(updateArg.latestCapturedWebhook.files[0]).toMatchObject({
      name: 'avatar.png',
      type: 'image/png',
    });
  });

  it('returns 404 if automation blueprint does not exist', async () => {
    mockGet.mockResolvedValue({ exists: false });

    const req = new Request('http://localhost:9002/api/automations/webhook/auto-missing', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });

    const params = Promise.resolve({ id: 'auto-missing' });
    const res = await POST(req, { params });
    const jsonResponse = await res.json();

    expect(res.status).toBe(404);
    expect(jsonResponse.error).toBe('Automation blueprint not found');
  });

  it('returns 400 if automation is not configured for webhook ingress', async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({
        trigger: 'TAG_ADDED', // not WEBHOOK_RECEIVED
        isActive: true,
        workspaceIds: ['ws-test-123'],
      }),
    });

    const req = new Request('http://localhost:9002/api/automations/webhook/auto-tag', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });

    const params = Promise.resolve({ id: 'auto-tag' });
    const res = await POST(req, { params });
    const jsonResponse = await res.json();

    expect(res.status).toBe(400);
    expect(jsonResponse.error).toBe('This automation is not configured for webhook ingress');
  });
});
