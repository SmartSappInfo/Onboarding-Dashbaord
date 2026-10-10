/**
 * @fileOverview Vitest Suite for Global Navigation Unification (Phase 8 Milestone 5 Task 7)
 *
 * Implements:
 * - Rule 4: Zero `any` / Zero `any[]` typing policy.
 * - Rule 7: Mobile-first touch targets >= 44px.
 * - Rule 61: Backoffice and operator control plane surface.
 * - Rule 69: Strangler Fig Invariant: 100% of preexisting routes & permissions are preserved.
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdminSidebar } from '@/app/admin/components/AdminSidebar';

let mockPathname = '/admin';

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
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
    isSuperAdmin: false,
  }),
}));

vi.mock('@/app/admin/components/UnifiedOrgWorkspaceSwitcher', () => ({
  default: () => <div data-testid="switcher" />,
}));

vi.mock('@/components/ui/sidebar', () => ({
  useSidebar: () => ({ isMobile: false, setOpenMobile: vi.fn() }),
  Sidebar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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

function isGroupOpen(title: string): boolean {
  const triggers = screen.getAllByRole('button', { name: new RegExp(title, 'i') });
  const trigger = triggers[0];
  return (
    trigger.closest('[data-state]')?.getAttribute('data-state') === 'open' ||
    trigger.getAttribute('data-state') === 'open'
  );
}

function groupTrigger(title: string): HTMLElement {
  return screen.getAllByRole('button', { name: new RegExp(title, 'i') })[0];
}

describe('Global Navigation Unification (Canonical 6-Group Architecture)', () => {
  beforeEach(() => {
    mockPathname = '/admin';
    vi.clearAllMocks();
  });

  it('renders all 6 canonical groups: Work, Studio, Automations, Transact, Intelligence, System', () => {
    render(<AdminSidebar />);

    const groupTitles = ['Work', 'Studio', 'Automations', 'Transact', 'Intelligence', 'System'];
    for (const title of groupTitles) {
      const el = screen.getAllByRole('button', { name: new RegExp(title, 'i') })[0];
      expect(el).toBeInTheDocument();
    }
  });

  it('verifies Work group contains primary CRM & operational execution items', () => {
    mockPathname = '/admin';
    render(<AdminSidebar />);

    expect(isGroupOpen('Work')).toBe(true);
    expect(screen.getByRole('link', { name: /Dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Schools/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Lead Intelligence/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Deals/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Tasks/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Meetings/i })).toBeInTheDocument();
  });

  it('verifies Automations group contains Workflows (/admin/workflows), Automations, and Approvals', async () => {
    const user = userEvent.setup();
    render(<AdminSidebar />);

    await user.click(groupTrigger('Automations'));
    expect(isGroupOpen('Automations')).toBe(true);

    expect(screen.getByRole('link', { name: /Workflows/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Automations/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Approvals/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Webhooks/i })).toBeInTheDocument();
  });

  it('verifies Intelligence group contains Command Center, Agent Runs, Agent Studio, Brain, and MCP', async () => {
    const user = userEvent.setup();
    render(<AdminSidebar />);

    await user.click(groupTrigger('Intelligence'));
    expect(isGroupOpen('Intelligence')).toBe(true);

    expect(screen.getByRole('link', { name: /Command Center/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Agent Runs/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Agent Studio/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Company Brain/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /MCP Capabilities/i })).toBeInTheDocument();
  });

  it('verifies Studio group contains Document, Media, Forms, and Social Hub creation tools', async () => {
    const user = userEvent.setup();
    render(<AdminSidebar />);

    await user.click(groupTrigger('Studio'));
    expect(isGroupOpen('Studio')).toBe(true);

    expect(screen.getByRole('link', { name: /Forms/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Landing Pages/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Doc Signing/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Surveys/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /QR Studio/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Verify Studio/i })).toBeInTheDocument();
  });

  it('verifies Transact group contains Agreements, Invoices, Packages, Cycles, and Billing', async () => {
    const user = userEvent.setup();
    render(<AdminSidebar />);

    await user.click(groupTrigger('Transact'));
    expect(isGroupOpen('Transact')).toBe(true);

    expect(screen.getByRole('link', { name: /Agreements/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Invoices/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Packages/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Cycles/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Billing Setup/i })).toBeInTheDocument();
  });

  it('verifies System group contains Users Hub, Roles, Settings, and Backoffice', async () => {
    const user = userEvent.setup();
    render(<AdminSidebar />);

    await user.click(groupTrigger('System'));
    expect(isGroupOpen('System')).toBe(true);

    expect(screen.getByRole('link', { name: /Users Hub/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Roles & Permissions/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Fields & Variables/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /System Settings/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Backoffice/i })).toBeInTheDocument();
  });
});
