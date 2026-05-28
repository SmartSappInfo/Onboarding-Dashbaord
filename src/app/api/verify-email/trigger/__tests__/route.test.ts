import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../route';
import { ContactHygieneRepository } from '@/lib/hygiene-repository';

vi.mock('@/lib/firebase-admin', () => {
  const mockDoc = {
    get: vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({}),
      id: 'mock-id',
    }),
    set: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  };

  const mockCollection = {
    doc: vi.fn().mockReturnValue(mockDoc),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    get: vi.fn().mockResolvedValue({
      docs: [],
      empty: true,
      size: 0,
    }),
    add: vi.fn().mockResolvedValue(mockDoc),
  };

  const mockDb = {
    collection: vi.fn().mockReturnValue(mockCollection),
    doc: vi.fn().mockReturnValue(mockDoc),
    runTransaction: vi.fn().mockImplementation((callback) => callback({
      get: vi.fn().mockResolvedValue(mockDoc),
      set: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    })),
    batch: vi.fn().mockReturnValue({
      set: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    }),
  };

  return { adminDb: mockDb };
});

vi.mock('next/server', () => {
  return {
    NextResponse: {
      json: vi.fn((data, options) => ({
        status: options?.status || 200,
        json: async () => data,
      })),
    },
    after: vi.fn((cb) => cb()),
  };
});

describe('verify-email/trigger API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('verifies a request containing only valid emails successfully', async () => {
    vi.spyOn(ContactHygieneRepository, 'isLocked').mockResolvedValue(false);
    vi.spyOn(ContactHygieneRepository, 'setVerifyingLock').mockResolvedValue(undefined);

    const req = new Request('http://localhost/api/verify-email/trigger', {
      method: 'POST',
      body: JSON.stringify({
        emails: ['john.doe@example.com', 'jane.doe@example.com'],
      }),
    });

    const response = await POST(req);
    const data = await (response as any).json();

    expect(response.status).toBe(202);
    expect(data.queued).toBe(true);
    expect(data.processedCount).toBe(2);
  });

  it('gracefully filters out completely invalid emails and verifies valid ones without returning a 400 error', async () => {
    vi.spyOn(ContactHygieneRepository, 'isLocked').mockResolvedValue(false);
    vi.spyOn(ContactHygieneRepository, 'setVerifyingLock').mockResolvedValue(undefined);

    const req = new Request('http://localhost/api/verify-email/trigger', {
      method: 'POST',
      body: JSON.stringify({
        emails: ['john.doe@example.com', 'completely-invalid-email-address', '   '],
      }),
    });

    const response = await POST(req);
    const data = await (response as any).json();

    expect(response.status).toBe(202);
    expect(data.queued).toBe(true);
    // Only the single valid email 'john.doe@example.com' should be accepted for processing
    expect(data.processedCount).toBe(1);
  });

  it('returns a successful 200 message when no valid emails are found in the request', async () => {
    const req = new Request('http://localhost/api/verify-email/trigger', {
      method: 'POST',
      body: JSON.stringify({
        emails: ['not-an-email', '   ', 'another-invalid-one'],
      }),
    });

    const response = await POST(req);
    const data = await (response as any).json();

    expect(response.status).toBe(200);
    expect(data.queued).toBe(false);
    expect(data.skippedCount).toBe(3);
    expect(data.message).toContain('No valid emails found');
  });

  it('returns a 400 error if request body payload is empty or invalid structure', async () => {
    const req = new Request('http://localhost/api/verify-email/trigger', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
  });
});
