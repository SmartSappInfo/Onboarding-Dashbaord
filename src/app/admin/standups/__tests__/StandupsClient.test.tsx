// @vitest-environment jsdom
/**
 * @fileOverview Integration tests for StandupsClient (Phase 4B).
 * Validates:
 * - Rendering tabs (My Standup, Team Overview, Blockers, History).
 * - Breadcrumb navigation link to /admin/tasks.
 * - Tab switching and URL parameter synchronization.
 */

import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StandupsClient from '../StandupsClient';

const mockPush = vi.fn();
const mockReplace = vi.fn();
let mockSearchParamTab: string | null = null;

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => ({
    get: (param: string) => (param === 'tab' ? mockSearchParamTab : null),
    toString: () => (mockSearchParamTab ? `tab=${mockSearchParamTab}` : ''),
  }),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
}));

vi.mock('@/components/ui/tabs', () => {
  const TabsContext = React.createContext<{ value?: string; onValueChange?: (v: string) => void }>({});
  return {
    Tabs: ({ value, onValueChange, children }: { value?: string; onValueChange?: (v: string) => void; children: React.ReactNode }) => (
      <TabsContext.Provider value={{ value, onValueChange }}>
        <div>{children}</div>
      </TabsContext.Provider>
    ),
    TabsList: ({ children }: { children: React.ReactNode }) => <div role="tablist">{children}</div>,
    TabsTrigger: ({ value, children }: { value: string; children: React.ReactNode }) => {
      const ctx = React.useContext(TabsContext);
      return (
        <button role="tab" onClick={() => ctx.onValueChange?.(value)}>
          {children}
        </button>
      );
    },
    TabsContent: ({ value, children }: { value: string; children: React.ReactNode }) => {
      const ctx = React.useContext(TabsContext);
      return ctx.value === value ? <div role="tabpanel">{children}</div> : null;
    },
  };
});

vi.mock('@/firebase', () => ({
  useFirestore: () => ({ type: 'firestore' }),
  useUser: () => ({ user: { uid: 'user-alice', email: 'alice@corp.internal' } }),
  useCollection: () => ({ data: [] }),
  useMemoFirebase: (fn: () => unknown) => fn(),
}));

vi.mock('@/hooks/use-workspace-visibility', () => ({
  useWorkspaceVisibility: () => ({
    activeWorkspaceId: 'ws-1',
    activeWorkspace: { id: 'ws-1', name: 'HQ Workspace', organizationId: 'org-1' },
  }),
}));

vi.mock('@/lib/standup-server-actions', () => ({
  saveStandupDraftAction: vi.fn().mockResolvedValue({ success: true }),
  submitStandupAction: vi.fn().mockResolvedValue({ success: true, id: 'sub-1' }),
  mutateBlockerAction: vi.fn().mockResolvedValue({ success: true }),
}));

describe('StandupsClient Integration (Phase 4B)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParamTab = null;
  });

  it('renders page title, breadcrumb, and all 4 tabs', () => {
    render(<StandupsClient />);

    expect(screen.getByText(/Daily Standups & Commitments/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Tasks & Operations/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /My Standup/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Team Overview/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Blockers/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /History/i })).toBeInTheDocument();
  });

  it('switches tabs and updates URL search params', () => {
    render(<StandupsClient />);

    const teamTab = screen.getByRole('tab', { name: /Team Overview/i });
    fireEvent.pointerDown(teamTab, { button: 0, ctrlKey: false });
    fireEvent.click(teamTab);

    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining('tab=team'),
      expect.objectContaining({ scroll: false })
    );
  });
});
