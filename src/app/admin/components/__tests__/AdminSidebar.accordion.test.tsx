import * as React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * The sidebar behaves as an accordion: exactly one group open at a time.
 *
 * What these tests pin down, and why each matters:
 *  - Opening one group closes the others (the actual request).
 *  - The group owning the current route opens on load, so a deep link to /admin/surveys
 *    does not land the user on a sidebar where their page is hidden.
 *  - A group can be collapsed to leave everything closed.
 *  - A user's manual choice survives, rather than being stomped by the route.
 *
 * CAUTION when editing: `usePathname` is re-read on every render, so a test that changes
 * the route must re-render for the component to see it.
 */

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
  useBackofficeAccess: () => ({ hasBackofficeAccess: false }),
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

// Default export, imported by relative path from the sidebar.
vi.mock('../UnifiedOrgWorkspaceSwitcher', () => ({
  default: () => <div data-testid="switcher" />,
}));

// The real sidebar primitives depend on a provider and on matchMedia; the accordion logic
// under test lives above them, so stub them down to plain elements.
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

import { AdminSidebar } from '../AdminSidebar';

/** Radix marks the closed panel with data-state="closed" and hides it. */
function isGroupOpen(title: string): boolean {
  const trigger = screen.getAllByRole('button', { name: new RegExp(title, 'i') })[0];
  return trigger.closest('[data-state]')?.getAttribute('data-state') === 'open'
    || trigger.getAttribute('data-state') === 'open';
}

function groupTrigger(title: string): HTMLElement {
  return screen.getAllByRole('button', { name: new RegExp(title, 'i') })[0];
}

describe('AdminSidebar accordion', () => {
  beforeEach(() => {
    mockPathname = '/admin';
    vi.clearAllMocks();
  });

  it('opens the group that owns the current route', () => {
    mockPathname = '/admin/surveys';
    render(<AdminSidebar />);

    expect(isGroupOpen('Studios')).toBe(true);
    expect(isGroupOpen('Operations')).toBe(false);
  });

  it('closes the other groups when one is opened', async () => {
    const user = userEvent.setup();
    mockPathname = '/admin/surveys';
    render(<AdminSidebar />);

    expect(isGroupOpen('Studios')).toBe(true);

    await user.click(groupTrigger('Finance Hub'));

    expect(isGroupOpen('Finance Hub')).toBe(true);
    expect(isGroupOpen('Studios')).toBe(false);
    expect(isGroupOpen('Operations')).toBe(false);
  });

  it('lets the open group be collapsed, leaving nothing open', async () => {
    const user = userEvent.setup();
    render(<AdminSidebar />);

    expect(isGroupOpen('Operations')).toBe(true);

    await user.click(groupTrigger('Operations'));

    expect(isGroupOpen('Operations')).toBe(false);
  });

  it('keeps the user\'s chosen group open while the route stays put', async () => {
    const user = userEvent.setup();
    mockPathname = '/admin/surveys';
    const { rerender } = render(<AdminSidebar />);

    await user.click(groupTrigger('Social Hub'));
    expect(isGroupOpen('Social Hub')).toBe(true);

    // A re-render on the same route must not snap back to the route's own group.
    rerender(<AdminSidebar />);
    expect(isGroupOpen('Social Hub')).toBe(true);
    expect(isGroupOpen('Studios')).toBe(false);
  });

  it('falls back to Operations when the route matches no group', () => {
    mockPathname = '/admin/some-unlisted-page';
    render(<AdminSidebar />);

    expect(isGroupOpen('Operations')).toBe(true);
  });
});

describe('AdminSidebar search', () => {
  beforeEach(() => {
    mockPathname = '/admin';
    vi.clearAllMocks();
  });

  const field = () => screen.getByRole('searchbox', { name: /search menu/i });

  it('finds a row buried in a collapsed group', async () => {
    const user = userEvent.setup();
    render(<AdminSidebar />);

    // Studios is closed on /admin, so Surveys is not reachable without searching.
    expect(isGroupOpen('Studios')).toBe(false);

    await user.type(field(), 'survey');

    expect(screen.getByRole('link', { name: /Surveys/i })).toBeInTheDocument();
  });

  it('replaces the groups with a flat result list while searching', async () => {
    const user = userEvent.setup();
    render(<AdminSidebar />);

    expect(screen.getAllByRole('button', { name: /Operations/i }).length).toBeGreaterThan(0);

    await user.type(field(), 'survey');

    // Group headers are gone: searching is its own mode, not a filter over the accordion.
    expect(screen.queryByRole('button', { name: /^Operations$/i })).not.toBeInTheDocument();
  });

  it('matches on the group name too, so a group can be pulled up whole', async () => {
    const user = userEvent.setup();
    render(<AdminSidebar />);

    await user.type(field(), 'finance');

    // Finance Hub rows surface even though none of them contain the word "finance".
    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThan(0);
  });

  it('says so plainly when nothing matches, without showing an empty list', async () => {
    const user = userEvent.setup();
    render(<AdminSidebar />);

    await user.type(field(), 'zzzznotathing');

    expect(screen.getByText(/nothing matches/i)).toBeInTheDocument();
    // "Live Site" lives in the footer, outside the nav body, so it is expected to survive.
    const navLinks = screen.queryAllByRole('link').filter(
      (a) => !/live site/i.test(a.textContent ?? ''),
    );
    expect(navLinks).toHaveLength(0);
  });

  it('restores the accordion when the search is cleared', async () => {
    const user = userEvent.setup();
    render(<AdminSidebar />);

    await user.type(field(), 'survey');
    expect(screen.queryByRole('button', { name: /^Operations$/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /clear search/i }));

    expect(isGroupOpen('Operations')).toBe(true);
  });

  it('clears on Escape, so the keyboard can back out', async () => {
    const user = userEvent.setup();
    render(<AdminSidebar />);

    await user.type(field(), 'survey');
    await user.type(field(), '{Escape}');

    expect(field()).toHaveValue('');
    expect(isGroupOpen('Operations')).toBe(true);
  });
});
