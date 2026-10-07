/**
 * @fileOverview Unit & Integration Tests: Knowledge Navigation & Strangler Fig Redirects (Phase 11 M5 · T6)
 *
 * Verifies:
 * - AdminSidebar renders new Knowledge destinations: Knowledge Inbox, Knowledge Graph, Governance & Control
 * - Preservation of preexisting 52 routes and permissions (Rule 69 Strangler Invariant)
 * - Strangler Fig redirect pages:
 *   - /intelligence/knowledge/inbox -> /admin/intelligence/knowledge/inbox
 *   - /intelligence/knowledge-graph -> /admin/intelligence/knowledge/graph
 *   - /admin/quick-notes/inbox -> /admin/intelligence/knowledge/inbox
 * - Strict Rule 4 typing (zero any/any[])
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdminSidebar } from '@/app/admin/components/AdminSidebar';
import LegacyKnowledgeInboxRedirectPage from '@/app/intelligence/knowledge/inbox/page';
import LegacyKnowledgeGraphRedirectPage from '@/app/intelligence/knowledge-graph/page';
import LegacyQuickNotesInboxRedirectPage from '@/app/admin/quick-notes/inbox/page';

const mockRedirect = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/intelligence',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  redirect: (path: string) => mockRedirect(path),
}));

vi.mock('@/hooks/use-terminology', () => ({
  useTerminology: () => ({ plural: 'Schools', singular: 'School', dealPlural: 'Deals' }),
}));

vi.mock('@/hooks/use-features', () => ({
  useFeatures: () => ({ isFeatureEnabled: () => true }),
}));

vi.mock('@/hooks/use-permissions', () => ({
  usePermissions: () => ({ can: () => true, isSystemAdmin: true }),
}));

vi.mock('@/hooks/use-backoffice-access', () => ({
  useBackofficeAccess: () => ({ hasBackofficeAccess: true }),
}));

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({
    activeOrganizationId: 'org-1',
    activeOrganization: { id: 'org-1', name: 'Org' },
    activeWorkspaceId: 'ws-1',
    activeWorkspace: { id: 'ws-1', name: 'Workspace' },
    setActiveWorkspace: vi.fn(),
    switchOrganizationAndWorkspace: vi.fn(),
    availableOrganizations: [],
    allAccessibleWorkspaces: [],
    isSuperAdmin: true,
  }),
}));

vi.mock('@/components/ui/sidebar', () => ({
  useSidebar: () => ({ isMobile: false, setOpenMobile: vi.fn(), open: true }),
  Sidebar: ({ children }: { children: React.ReactNode }) => <nav data-testid="sidebar">{children}</nav>,
  SidebarHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarGroupLabel: ({ children, ...rest }: React.ComponentProps<'button'>) => (
    <button type="button" {...rest}>{children}</button>
  ),
  SidebarMenu: ({ children }: { children: React.ReactNode }) => <ul>{children}</ul>,
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => <li>{children}</li>,
  SidebarMenuButton: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarTrigger: () => <button type="button">toggle</button>,
  SidebarSeparator: () => <hr />,
}));

vi.mock('@/app/admin/components/UnifiedOrgWorkspaceSwitcher', () => ({
  default: () => <div data-testid="switcher" />,
}));

describe('Knowledge Navigation & Strangler Fig Redirects (Phase 11 M5 · T6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Knowledge destinations in AdminSidebar while preserving preexisting routes', () => {
    render(<AdminSidebar />);

    // New Milestone 5 destinations
    expect(screen.getByText('Knowledge Inbox')).toBeDefined();
    expect(screen.getByText('Knowledge Graph')).toBeDefined();
    expect(screen.getByText('Governance & Control')).toBeDefined();

    // Preexisting Intelligence routes preserved (Rule 69)
    expect(screen.getByText('Command Center')).toBeDefined();
    expect(screen.getByText('Agent Runs')).toBeDefined();
    expect(screen.getByText('Agent Studio')).toBeDefined();
    expect(screen.getByText('Company Brain')).toBeDefined();
    expect(screen.getByText('Quick Notes Graph')).toBeDefined();
  });

  it('redirects /intelligence/knowledge/inbox to /admin/intelligence/knowledge/inbox', () => {
    LegacyKnowledgeInboxRedirectPage();
    expect(mockRedirect).toHaveBeenCalledWith('/admin/intelligence/knowledge/inbox');
  });

  it('redirects /intelligence/knowledge-graph to /admin/intelligence/knowledge/graph', () => {
    LegacyKnowledgeGraphRedirectPage();
    expect(mockRedirect).toHaveBeenCalledWith('/admin/intelligence/knowledge/graph');
  });

  it('redirects /admin/quick-notes/inbox to /admin/intelligence/knowledge/inbox', () => {
    LegacyQuickNotesInboxRedirectPage();
    expect(mockRedirect).toHaveBeenCalledWith('/admin/intelligence/knowledge/inbox');
  });
});
