import '@testing-library/jest-dom';

// Configure test environment & GCP metadata suppressions for Vitest
// CAUTION: Setting FIRESTORE_EMULATOR_HOST unconditionally causes gRPC ECONNREFUSED timeouts
// in unit tests when no local emulator process is active. Only set when USE_EMULATOR is true.
if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
  process.env.NO_GCP_METADATA = 'true';
  process.env.GCP_METADATA_HOST = '127.0.0.1:9999';
  process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'test-project';
  process.env.K_SERVICE = process.env.K_SERVICE || '';

  if (process.env.USE_EMULATOR === 'true' && !process.env.FIRESTORE_EMULATOR_HOST) {
    process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
    process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
  }
}

// Mock ResizeObserver for Radix UI components (ScrollArea, etc.)
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

import { vi } from 'vitest';

vi.mock('@/ai/genkit', () => ({
  ai: {
    definePrompt: () => vi.fn(),
    defineFlow: () => vi.fn(),
    defineTool: () => vi.fn(),
    generate: vi.fn(),
  },
  getModel: vi.fn(),
}));

// Default mock for firebase-admin to prevent un-mocked Firestore gRPC calls in unit tests
vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: vi.fn().mockResolvedValue({ exists: false, data: vi.fn().mockReturnValue(null) }),
        set: vi.fn().mockResolvedValue(true),
        update: vi.fn().mockResolvedValue(true),
      })),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ docs: [], empty: true, forEach: vi.fn() }),
    })),
    batch: vi.fn(() => ({
      set: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      commit: vi.fn().mockResolvedValue(true),
    })),
  },
  adminAuth: {
    verifyIdToken: vi.fn().mockResolvedValue({ uid: 'test-uid' }),
  },
}));

// Default mock for the server-side session guard (audit F2, Phase 4).
//
// Server Actions now resolve the caller with requireAuth()/requireWorkspace(), which read
// the `__session` cookie via next/headers. In unit tests there is no request scope, so
// `cookies()` throws. Defaulting the guard to an authenticated caller keeps existing tests
// testing what they were written to test.
//
// A test that wants to assert the guard itself should override this locally, e.g.
//   vi.mock('@/lib/auth/require-auth', () => ({ requireWorkspace: vi.fn().mockRejectedValue(...) }))
// and then assert that no write occurred.
const testProfile = {
  id: 'test-user',
  name: 'Test User',
  displayName: 'Test User',
  email: 'test@example.com',
  organizationId: 'test-org',
  workspaceIds: ['test-workspace'],
  permissions: [] as string[],
  isAuthorized: true,
};

vi.mock('@/lib/auth/require-auth', () => {
  class UnauthorizedError extends Error {}
  class ForbiddenError extends Error {}
  const ctx = { uid: 'test-user', profile: testProfile, isSystemAdmin: false };
  return {
    SESSION_COOKIE_NAME: '__session',
    UnauthorizedError,
    ForbiddenError,
    requireAuth: vi.fn(async () => ctx),
    requireWorkspace: vi.fn(async () => ctx),
    requireSystemAdmin: vi.fn(async () => ({ ...ctx, isSystemAdmin: true })),
    requireOrganization: vi.fn(async () => ({ ...ctx, organizationId: 'test-org' })),
  };
});

// Default mock for the outbound messaging kill switch (backoffice isolation).
//
// The guard reads platform_config/messaging_controls before every send. Suites that mock
// adminDb by call ORDER (mockResolvedValueOnce chains) would otherwise have that extra
// read consume one of their queued responses. Defaulting the guard to "allowed" keeps
// existing messaging tests testing what they were written to test.
//
// A test that wants to assert the switch should override this locally, as
// src/lib/platform/__tests__/outbound-boundaries.test.ts does.
vi.mock('@/lib/platform/outbound-guard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/platform/outbound-guard')>();
  return {
    ...actual,
    assertOutboundAllowed: vi.fn(async () => undefined),
    isOutboundAllowed: vi.fn(async () => true),
  };
});
