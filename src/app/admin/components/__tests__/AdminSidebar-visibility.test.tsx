import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';

// Setup window.matchMedia mock
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock dependencies
vi.mock('next/navigation', () => ({
  usePathname: () => '/admin',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({
    activeWorkspaceId: 'ws_1',
    activeOrganizationId: 'org_1',
    isSuperAdmin: false,
    accessibleWorkspaces: [],
    allAccessibleWorkspaces: [],
    allowedWorkspaces: [],
    availableOrganizations: [],
  }),
}));

vi.mock('@/hooks/use-permissions', () => ({
  usePermissions: () => ({
    can: (section: string, feature: string) => {
      // Mock that user only has permission for dashboard and tasks, but NOT campuses/entities or pipeline
      if (feature === 'dashboard' || feature === 'tasks') return true;
      return false;
    },
    hasPermission: () => false,
    isSystemAdmin: false,
    isLoading: false,
  }),
}));

vi.mock('@/hooks/use-features', () => ({
  useFeatures: () => ({
    isFeatureEnabled: () => true,
  }),
}));

vi.mock('@/hooks/use-terminology', () => ({
  useTerminology: () => ({ plural: 'Schools', dealPlural: 'Deals' }),
}));

vi.mock('@/hooks/use-backoffice-access', () => ({
  useBackofficeAccess: () => ({ hasBackofficeAccess: false }),
}));

vi.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('AdminSidebar Visibility Hiding', () => {
  it('does NOT render unaccessible items with padlocks or disabled state, but conceals them entirely', async () => {
    const { AdminSidebar } = await import('../AdminSidebar');
    render(
      <SidebarProvider>
        <AdminSidebar />
      </SidebarProvider>
    );

    // Dashboard and Tasks should be visible
    expect(screen.queryByText('Dashboard')).not.toBeNull();
    expect(screen.queryByText('Tasks')).not.toBeNull();

    // Schools and Deals should NOT be visible anywhere in the DOM
    expect(screen.queryByText('Schools')).toBeNull();
    expect(screen.queryByText('Deals')).toBeNull();
  });
});
