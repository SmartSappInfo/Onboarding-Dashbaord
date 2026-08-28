import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { authenticateApiRequest } from '../api-auth-guard';

vi.mock('@/lib/firebase-admin', () => ({
  adminAuth: {
    verifyIdToken: vi.fn(),
  },
  adminDb: {
    collection: vi.fn(),
  },
}));

import { adminAuth, adminDb } from '@/lib/firebase-admin';

describe('API Auth Guard (authenticateApiRequest)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects requests missing the Authorization header with 401', async () => {
    const req = new NextRequest('https://example.com/api/contacts', {
      method: 'GET',
    });

    const res = await authenticateApiRequest(req);
    expect(res.success).toBe(false);
    expect(res.errorResponse?.status).toBe(401);
  });

  it('rejects invalid or expired tokens with 401', async () => {
    vi.mocked(adminAuth.verifyIdToken).mockRejectedValueOnce(new Error('Firebase ID token has expired.'));

    const req = new NextRequest('https://example.com/api/contacts', {
      method: 'GET',
      headers: {
        authorization: 'Bearer expired-token',
      },
    });

    const res = await authenticateApiRequest(req);
    expect(res.success).toBe(false);
    expect(res.errorResponse?.status).toBe(401);
  });

  it('rejects unauthorized/inactive user accounts with 403', async () => {
    vi.mocked(adminAuth.verifyIdToken).mockResolvedValueOnce({
      uid: 'user-123',
      email: 'user@test.com',
    } as any);

    vi.mocked(adminDb.collection).mockReturnValueOnce({
      doc: vi.fn().mockReturnValueOnce({
        get: vi.fn().mockResolvedValueOnce({
          exists: true,
          id: 'user-123',
          data: () => ({
            isAuthorized: false,
            workspaceIds: ['ws-1'],
          }),
        }),
      }),
    } as any);

    const req = new NextRequest('https://example.com/api/contacts', {
      method: 'GET',
      headers: {
        authorization: 'Bearer valid-token',
      },
    });

    const res = await authenticateApiRequest(req);
    expect(res.success).toBe(false);
    expect(res.errorResponse?.status).toBe(403);
  });

  it('rejects users without required workspace membership with 403', async () => {
    vi.mocked(adminAuth.verifyIdToken).mockResolvedValueOnce({
      uid: 'user-123',
      email: 'user@test.com',
    } as any);

    vi.mocked(adminDb.collection).mockReturnValueOnce({
      doc: vi.fn().mockReturnValueOnce({
        get: vi.fn().mockResolvedValueOnce({
          exists: true,
          id: 'user-123',
          data: () => ({
            isAuthorized: true,
            permissions: ['user'],
            workspaceIds: ['ws-other'],
          }),
        }),
      }),
    } as any);

    const req = new NextRequest('https://example.com/api/contacts', {
      method: 'GET',
      headers: {
        authorization: 'Bearer valid-token',
      },
    });

    const res = await authenticateApiRequest(req, { requiredWorkspaceId: 'ws-target' });
    expect(res.success).toBe(false);
    expect(res.errorResponse?.status).toBe(403);
  });

  it('allows authorized users with matching workspace membership', async () => {
    vi.mocked(adminAuth.verifyIdToken).mockResolvedValueOnce({
      uid: 'user-123',
      email: 'user@test.com',
    } as any);

    vi.mocked(adminDb.collection).mockReturnValueOnce({
      doc: vi.fn().mockReturnValueOnce({
        get: vi.fn().mockResolvedValueOnce({
          exists: true,
          id: 'user-123',
          data: () => ({
            isAuthorized: true,
            permissions: ['contacts_edit'],
            workspaceIds: ['ws-target'],
            organizationId: 'org-1',
          }),
        }),
      }),
    } as any);

    const req = new NextRequest('https://example.com/api/contacts', {
      method: 'GET',
      headers: {
        authorization: 'Bearer valid-token',
      },
    });

    const res = await authenticateApiRequest(req, { requiredWorkspaceId: 'ws-target' });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.user.uid).toBe('user-123');
      expect(res.user.isSystemAdmin).toBe(false);
    }
  });

  it('allows system admins to access any workspace', async () => {
    vi.mocked(adminAuth.verifyIdToken).mockResolvedValueOnce({
      uid: 'admin-123',
      email: 'admin@smartsapp.com',
    } as any);

    vi.mocked(adminDb.collection).mockReturnValueOnce({
      doc: vi.fn().mockReturnValueOnce({
        get: vi.fn().mockResolvedValueOnce({
          exists: true,
          id: 'admin-123',
          data: () => ({
            isAuthorized: true,
            permissions: ['system_admin'],
            workspaceIds: [],
            organizationId: 'smartsapp-hq',
          }),
        }),
      }),
    } as any);

    const req = new NextRequest('https://example.com/api/contacts', {
      method: 'GET',
      headers: {
        authorization: 'Bearer admin-token',
      },
    });

    const res = await authenticateApiRequest(req, { requiredWorkspaceId: 'any-workspace' });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.user.isSystemAdmin).toBe(true);
    }
  });
});
