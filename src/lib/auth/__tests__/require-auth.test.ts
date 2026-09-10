/**
 * Unit tests for the server-side session helper (audit F14, Phase 3).
 *
 * These pin the failure modes, because every one of them is a case where the old
 * code would have proceeded with a caller-supplied `userId` and no verification at all.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// src/test/setup.ts installs a default mock of this module so the rest of the suite can
// call guarded actions. This file tests the real implementation, so opt out of that.
vi.unmock('@/lib/auth/require-auth');

const mockGet = vi.fn();
const mockVerifySessionCookie = vi.fn();
const mockUserGet = vi.fn();

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: mockGet }),
}));

vi.mock('@/lib/firebase-admin', () => ({
  adminAuth: {
    verifySessionCookie: (...args: unknown[]) => mockVerifySessionCookie(...args),
  },
  adminDb: {
    collection: () => ({
      doc: () => ({ get: () => mockUserGet() }),
    }),
  },
}));

import {
  requireAuth,
  requireWorkspace,
  requireSystemAdmin,
  UnauthorizedError,
  ForbiddenError,
} from '@/lib/auth/require-auth';

/** A signed-in, approved, workspace-scoped user. */
function profile(overrides: Record<string, unknown> = {}) {
  return {
    exists: true,
    id: 'user-1',
    data: () => ({
      isAuthorized: true,
      organizationId: 'org-A',
      workspaceIds: ['ws-A'],
      permissions: [],
      email: 'user@example.com',
      name: 'Test User',
      ...overrides,
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockReturnValue({ value: 'valid-cookie' });
  mockVerifySessionCookie.mockResolvedValue({ uid: 'user-1' });
  mockUserGet.mockResolvedValue(profile());
});

describe('requireAuth', () => {
  it('returns the verified identity for an approved user', async () => {
    const ctx = await requireAuth();
    expect(ctx.uid).toBe('user-1');
    expect(ctx.profile.organizationId).toBe('org-A');
    expect(ctx.isSystemAdmin).toBe(false);
  });

  it('throws Unauthorized when the cookie is missing', async () => {
    mockGet.mockReturnValue(undefined);
    await expect(requireAuth()).rejects.toThrow(UnauthorizedError);
    // Never reaches Firebase — no cookie, no lookup.
    expect(mockVerifySessionCookie).not.toHaveBeenCalled();
  });

  it('throws Unauthorized when the session is expired', async () => {
    mockVerifySessionCookie.mockRejectedValue(new Error('auth/session-cookie-expired'));
    await expect(requireAuth()).rejects.toThrow(UnauthorizedError);
  });

  it('throws Unauthorized when the session has been revoked', async () => {
    mockVerifySessionCookie.mockRejectedValue(new Error('auth/session-cookie-revoked'));
    await expect(requireAuth()).rejects.toThrow(UnauthorizedError);
  });

  it('verifies with checkRevoked so a disabled account loses access immediately', async () => {
    await requireAuth();
    expect(mockVerifySessionCookie).toHaveBeenCalledWith('valid-cookie', true);
  });

  it('throws Unauthorized when the user has no profile document', async () => {
    mockUserGet.mockResolvedValue({ exists: false, id: 'user-1', data: () => undefined });
    await expect(requireAuth()).rejects.toThrow(UnauthorizedError);
  });

  it('throws Forbidden when the account is not yet approved', async () => {
    mockUserGet.mockResolvedValue(profile({ isAuthorized: false }));
    await expect(requireAuth()).rejects.toThrow(ForbiddenError);
  });

  it('treats a missing isAuthorized field as unapproved', async () => {
    mockUserGet.mockResolvedValue(profile({ isAuthorized: undefined }));
    await expect(requireAuth()).rejects.toThrow(ForbiddenError);
  });

  it('reports system admins', async () => {
    mockUserGet.mockResolvedValue(profile({ permissions: ['system_admin'] }));
    expect((await requireAuth()).isSystemAdmin).toBe(true);
  });
});

describe('requireWorkspace', () => {
  it('allows a member of the workspace', async () => {
    await expect(requireWorkspace('ws-A')).resolves.toMatchObject({ uid: 'user-1' });
  });

  it('denies a non-member', async () => {
    await expect(requireWorkspace('ws-B')).rejects.toThrow(ForbiddenError);
  });

  it('lets a system admin through any workspace', async () => {
    mockUserGet.mockResolvedValue(profile({ permissions: ['system_admin'], workspaceIds: [] }));
    await expect(requireWorkspace('ws-B')).resolves.toMatchObject({ isSystemAdmin: true });
  });

  it('denies when the profile has no workspaces at all', async () => {
    mockUserGet.mockResolvedValue(profile({ workspaceIds: undefined }));
    await expect(requireWorkspace('ws-A')).rejects.toThrow(ForbiddenError);
  });
});

describe('requireSystemAdmin', () => {
  it('denies an ordinary approved user', async () => {
    await expect(requireSystemAdmin()).rejects.toThrow(ForbiddenError);
  });

  it('allows a system admin', async () => {
    mockUserGet.mockResolvedValue(profile({ permissions: ['system_admin'] }));
    await expect(requireSystemAdmin()).resolves.toMatchObject({ isSystemAdmin: true });
  });

  it('still requires a session first', async () => {
    mockGet.mockReturnValue(undefined);
    await expect(requireSystemAdmin()).rejects.toThrow(UnauthorizedError);
  });
});
