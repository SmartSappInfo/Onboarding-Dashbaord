// @vitest-environment jsdom
/**
 * @fileOverview Integration tests for TaskAnalyticsClient (Phase 4C).
 * Validates:
 * - Rendering page header and breadcrumbs.
 * - Rendering period filters.
 * - Rendering KPI cards and clickable drill-down links.
 * - Tab switching.
 */

import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TaskAnalyticsClient from '../TaskAnalyticsClient';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => ({
    get: () => null,
    toString: () => '',
  }),
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

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
}));

vi.mock('@/firebase', () => ({
  useFirestore: () => ({ type: 'firestore' }),
  useCollection: () => ({
    data: [
      {
        id: 'task-1',
        workspaceId: 'ws-1',
        title: 'Completed Feature',
        status: 'done',
        priority: 'high',
        category: 'engineering',
        dueDate: '2026-10-10',
        createdAt: '2026-10-01T00:00:00.000Z',
        completedAt: '2026-10-05T00:00:00.000Z',
      },
      {
        id: 'task-2',
        workspaceId: 'ws-1',
        title: 'In Progress Work',
        status: 'in_progress',
        priority: 'critical',
        category: 'design',
        dueDate: '2026-10-02', // Overdue
        createdAt: '2026-10-01T00:00:00.000Z',
      },
    ],
  }),
  useMemoFirebase: (fn: () => unknown) => fn(),
}));

vi.mock('@/hooks/use-workspace-visibility', () => ({
  useWorkspaceVisibility: () => ({
    activeWorkspaceId: 'ws-1',
    activeWorkspace: { id: 'ws-1', name: 'HQ Workspace', organizationId: 'org-1' },
  }),
}));

describe('TaskAnalyticsClient Integration (Phase 4C)', () => {
  it('renders page header, period filters, and KPI cards with drill-down links', () => {
    render(<TaskAnalyticsClient />);

    expect(screen.getByText(/Operational Insights & Analytics/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Last 7 Days/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Last 30 Days/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /All Time/i })).toBeInTheDocument();

    expect(screen.getByText('Completion Rate')).toBeInTheDocument();
    expect(screen.getByText('On-Time Delivery')).toBeInTheDocument();
    expect(screen.getByText('Overdue Tasks')).toBeInTheDocument();
    expect(screen.getByText('Active Blockers')).toBeInTheDocument();

    // Verify clickable drill-down link exists
    const completedLink = screen.getByRole('link', { name: /Completion Rate/i });
    expect(completedLink).toHaveAttribute('href', '/admin/tasks?status=done');
  });

  it('switches between analytics tabs smoothly', () => {
    render(<TaskAnalyticsClient />);

    const executionTab = screen.getByRole('tab', { name: /Execution & Velocity/i });
    fireEvent.click(executionTab);

    expect(screen.getByText(/Average Lead Time/i)).toBeInTheDocument();
  });
});
