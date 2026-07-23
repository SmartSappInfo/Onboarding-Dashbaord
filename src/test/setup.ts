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
