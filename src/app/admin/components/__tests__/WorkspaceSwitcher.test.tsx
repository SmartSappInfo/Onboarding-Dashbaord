import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import WorkspaceSwitcher from '../WorkspaceSwitcher';
import { useTenant } from '@/context/TenantContext';
import type { Workspace } from '@/lib/types';

// Mock the TenantContext
vi.mock('@/context/TenantContext');

const mockUseTenant = useTenant as ReturnType<typeof vi.fn>;

describe('WorkspaceSwitcher - Scope Badges', () => {
  const mockWorkspaces: Workspace[] = [
    {
      id: 'ws-1',
      organizationId: 'org-1',
      name: 'Primary Schools',
      contactScope: 'institution',
      status: 'active',
      statuses: [],
      color: '#3B5FFF',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'ws-2',
      organizationId: 'org-1',
      name: 'Family Workspace',
      contactScope: 'family',
      status: 'active',
      statuses: [],
      color: '#FF5733',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'ws-3',
      organizationId: 'org-1',
      name: 'Individual Contacts',
      contactScope: 'person',
      status: 'active',
      statuses: [],
      color: '#33FF57',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'ws-4',
      organizationId: 'org-1',
      name: 'Legacy Workspace',
      status: 'active',
      statuses: [],
      color: '#FFC300',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.mocked(useTenant).mockReturnValue({
      activeWorkspaceId: 'ws-1',
      activeWorkspace: mockWorkspaces[0],
      setActiveWorkspace: vi.fn(),
      accessibleWorkspaces: mockWorkspaces,
      allowedWorkspaces: mockWorkspaces,
      isLoading: false,
      activeOrganizationId: 'org-1',
      activeOrganization: undefined,
      setActiveOrganization: vi.fn(),
      availableOrganizations: [],
      isSuperAdmin: false,
      hasPermission: vi.fn().mockReturnValue(true),
    });
  });

  it('displays "Schools" badge for institution scope', async () => {
    const user = userEvent.setup();
    render(<WorkspaceSwitcher />);
    
    // Open the dropdown
    const trigger = screen.getByRole('button');
    await user.click(trigger);
    
    // Check for Schools badge
    expect(await screen.findByText('Schools')).toBeInTheDocument();
  });

  it('displays "Families" badge for family scope', async () => {
    const user = userEvent.setup();
    render(<WorkspaceSwitcher />);
    
    const trigger = screen.getByRole('button');
    await user.click(trigger);
    
    expect(await screen.findByText('Families')).toBeInTheDocument();
  });

  it('displays "People" badge for person scope', async () => {
    const user = userEvent.setup();
    render(<WorkspaceSwitcher />);
    
    const trigger = screen.getByRole('button');
    await user.click(trigger);
    
    expect(await screen.findByText('People')).toBeInTheDocument();
  });

  it('does not display badge for workspace without contactScope', async () => {
    const user = userEvent.setup();
    render(<WorkspaceSwitcher />);
    
    const trigger = screen.getByRole('button');
    await user.click(trigger);
    
    // Legacy Workspace should be visible
    const legacyWorkspace = await screen.findByText('Legacy Workspace');
    expect(legacyWorkspace).toBeInTheDocument();
    
    // But it should not have a scope badge (Schools, Families, or People) next to it
    // We verify this by checking that only 3 badges exist total (one for each scoped workspace)
    const badges = screen.queryAllByText(/^(Schools|Families|People)$/);
    expect(badges).toHaveLength(3);
  });

  it('displays all three scope types correctly', async () => {
    const user = userEvent.setup();
    render(<WorkspaceSwitcher />);
    
    const trigger = screen.getByRole('button');
    await user.click(trigger);
    
    // All three scope badges should be present
    expect(await screen.findByText('Schools')).toBeInTheDocument();
    expect(await screen.findByText('Families')).toBeInTheDocument();
    expect(await screen.findByText('People')).toBeInTheDocument();
  });
});
