import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../route';
import { PhoneHygieneRepository } from '@/lib/phone-hygiene-repository';

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

describe('verify-phone/trigger API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('verifies a request containing only valid phones successfully', async () => {
    vi.spyOn(PhoneHygieneRepository, 'isLocked').mockResolvedValue(false);
    vi.spyOn(PhoneHygieneRepository, 'setVerifyingLock').mockResolvedValue(undefined);

    const req = new Request('http://localhost/api/verify-phone/trigger', {
      method: 'POST',
      body: JSON.stringify({
        phones: ['+233244123456', '+12025550123'],
      }),
    });

    const response = await POST(req);
    const data = await (response as any).json();

    expect(response.status).toBe(202);
    expect(data.queued).toBe(true);
    expect(data.processedCount).toBe(2);
  });

  it('processes invalid phones so they can be flagged as invalid in the database instead of filtering them out', async () => {
    vi.spyOn(PhoneHygieneRepository, 'isLocked').mockResolvedValue(false);
    vi.spyOn(PhoneHygieneRepository, 'setVerifyingLock').mockResolvedValue(undefined);

    const req = new Request('http://localhost/api/verify-phone/trigger', {
      method: 'POST',
      body: JSON.stringify({
        phones: ['+233244123456', 'completely-invalid-phone', '   '],
      }),
    });

    const response = await POST(req);
    const data = await (response as any).json();

    expect(response.status).toBe(202);
    expect(data.queued).toBe(true);
    // Non-empty invalid phones are processed so they get flagged in the DB
    expect(data.processedCount).toBe(2);
  });

  it('returns a successful 200 message when only empty/blank phones are found in the request', async () => {
    const req = new Request('http://localhost/api/verify-phone/trigger', {
      method: 'POST',
      body: JSON.stringify({
        phones: ['   ', '', '   '],
      }),
    });

    const response = await POST(req);
    const data = await (response as any).json();

    expect(response.status).toBe(200);
    expect(data.queued).toBe(false);
    expect(data.skippedCount).toBe(3);
    expect(data.message).toContain('No phones found in the batch');
  });

  it('skips phones that are already locked by another worker', async () => {
    vi.spyOn(PhoneHygieneRepository, 'isLocked').mockResolvedValue(true);

    const req = new Request('http://localhost/api/verify-phone/trigger', {
      method: 'POST',
      body: JSON.stringify({
        phones: ['+233244123456'],
      }),
    });

    const response = await POST(req);
    const data = await (response as any).json();

    expect(response.status).toBe(200);
    expect(data.queued).toBe(false);
    expect(data.message).toContain('already being verified');
  });

  it('returns a 400 error if request body payload is empty or invalid structure', async () => {
    const req = new Request('http://localhost/api/verify-phone/trigger', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
  });
});
