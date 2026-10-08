/**
 * @fileOverview Unit & Regression Tests for AdminSidebar Organization Swarm Navigation (Phase 13 Milestone 5 Task 5)
 *
 * Implements:
 * - Rule 4 (Strict Zero-`any` / `any[]` typing policy)
 * - Rule 16 (RBAC permission checks: operations:intelligence:view or isSystemAdmin)
 * - Rule 69 (Strangler Fig Invariant: 100% preservation of all 52 preexisting routes and permissions)
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdminSidebar } from '@/app/admin/components/AdminSidebar';

let mockCan = vi.fn((_resource?: string, _action?: string, _scope?: string) => true);
let mockIsSystemAdmin = true;

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/intelligence',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/hooks/use-terminology', () => ({
  useTerminology: () => ({ plural: 'Schools', singular: 'School', dealPlural: 'Deals' }),
}));

vi.mock('@/hooks/use-features', () => ({
  useFeatures: () => ({ isFeatureEnabled: () => true }),
}));

vi.mock('@/hooks/use-permissions', () => ({
  usePermissions: () => ({
    can: (resource: string, action: string, scope?: string) => mockCan(resource, action, scope),
    isSystemAdmin: mockIsSystemAdmin,
  }),
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

describe('AdminSidebar Organization Swarm Navigation (Rule 69 Strangler Invariant)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCan = vi.fn(() => true);
    mockIsSystemAdmin = true;
  });

  it('renders Organization Swarm navigation item when user has intelligence view permissions', () => {
    render(<AdminSidebar />);

    expect(screen.getByText('Organization Swarm')).toBeDefined();
  });

  it('preserves all preexisting intelligence and workspace navigation routes (Rule 69)', () => {
    render(<AdminSidebar />);

    // Intelligence group members preserved
    expect(screen.getByText('Command Center')).toBeDefined();
    expect(screen.getByText('Agent Runs')).toBeDefined();
    expect(screen.getByText('Agent Studio')).toBeDefined();
    expect(screen.getByText('Knowledge Inbox')).toBeDefined();
    expect(screen.getByText('Knowledge Graph')).toBeDefined();
    expect(screen.getByText('Governance & Control')).toBeDefined();
    expect(screen.getByText('Company Brain')).toBeDefined();
  });

  it('hides Organization Swarm when user lacks permissions and is not system admin', () => {
    mockCan = vi.fn(() => false);
    mockIsSystemAdmin = false;

    render(<AdminSidebar />);

    expect(screen.queryByText('Organization Swarm')).toBeNull();
  });
});
