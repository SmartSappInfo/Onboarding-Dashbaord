/**
 * Test utilities for component testing
 * Provides wrappers with necessary providers (Firebase, Context, etc.)
 */

import { render, RenderOptions } from '@testing-library/react';
import { ReactElement, ReactNode } from 'react';
import { vi } from 'vitest';

// Mock Firebase context value
const mockFirebaseContext = {
  app: {} as any,
  auth: {} as any,
  db: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: vi.fn().mockResolvedValue({ exists: false, data: () => ({}) }),
        set: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
      })),
      where: vi.fn(() => ({
        get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
      })),
    })),
  } as any,
  storage: {} as any,
};

// Create a mock Firebase Provider
function MockFirebaseProvider({ children }: { children: ReactNode }) {
  // Mock the useFirebase hook to return our mock context
  return <>{children}</>;
}

// Mock the Firebase provider module before rendering
function setupFirebaseMocks() {
  vi.mock('@/firebase/provider', () => ({
    useFirebase: () => mockFirebaseContext,
    useFirestore: () => mockFirebaseContext.db,
    useAuth: () => mockFirebaseContext.auth,
    useStorage: () => mockFirebaseContext.storage,
    FirebaseProvider: MockFirebaseProvider,
  }));
}

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  withFirebase?: boolean;
}

/**
 * Custom render function that wraps components with necessary providers
 */
export function renderWithProviders(
  ui: ReactElement,
  options: CustomRenderOptions = {}
) {
  const { withFirebase = true, ...renderOptions } = options;

  if (withFirebase) {
    setupFirebaseMocks();
  }

  function Wrapper({ children }: { children: ReactNode }) {
    return <MockFirebaseProvider>{children}</MockFirebaseProvider>;
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

// Re-export everything from testing-library
export * from '@testing-library/react';
export { renderWithProviders as render };
