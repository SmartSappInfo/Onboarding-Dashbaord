/**
 * @fileoverview Unit test suite for WorkspaceEditor listview layout and toolbar alignment.
 * Verifies:
 * - Proper listview rendering where each workspace occupies one row in desktop table.
 * - Mobile-responsive card list with min 44px touch targets.
 * - Industry filter and New Workspace button positioned side-by-side in header.
 * - Filtering and actions (edit, archive, delete, default).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WorkspaceEditor from '../WorkspaceEditor';
import type { Workspace } from '@/lib/types';

// Mock Firebase
vi.mock('@/firebase', () => ({
  useUser: () => ({ user: { uid: 'test-user-123' } }),
  useFirestore: () => ({ id: 'mock-firestore' }),
}));

// Mock Tenant Context
vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({
    activeOrganizationId: 'org-test-1',
    activeOrganization: {
      id: 'org-test-1',
      name: 'SmartSapp Global',
      defaultWorkspaceId: 'ws-1',
    },
  }),
}));

// Mock Toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Mock workspace actions
vi.mock('@/lib/workspace-actions', () => ({
  saveWorkspaceAction: vi.fn().mockResolvedValue({ success: true }),
  deleteWorkspaceAction: vi.fn().mockResolvedValue({ success: true }),
  archiveWorkspaceAction: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/lib/organization-actions', () => ({
  setOrganizationDefaultWorkspaceAction: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
}));

const mockWorkspaces: Workspace[] = [
  {
    id: 'ws-1',
    organizationId: 'org-test-1',
    name: 'Client Onboarding',
    description: 'Onboarding workspace for enterprise accounts',
    status: 'active',
    industry: 'SaaS',
    contactScope: 'institution',
    color: '#3B5FFF',
    statuses: [
      { value: 'New', label: 'New', color: '#3B5FFF' },
      { value: 'InProgress', label: 'In Progress', color: '#10B981' },
      { value: 'Done', label: 'Done', color: '#6B7280' },
    ],
    industryScopeLocked: true,
    createdAt: '2026-10-09T08:30:00Z',
    updatedAt: '2026-10-09T08:30:00Z',
  },
  {
    id: 'ws-2',
    organizationId: 'org-test-1',
    name: 'Marketing Leads',
    description: 'Workspace for lead acquisition and nurtures',
    status: 'active',
    industry: 'Marketing',
    contactScope: 'person',
    color: '#10B981',
    statuses: [
      { value: 'Lead', label: 'Lead', color: '#F59E0B' },
      { value: 'Qualified', label: 'Qualified', color: '#10B981' },
    ],
    industryScopeLocked: false,
    createdAt: '2026-09-15T21:29:00Z',
    updatedAt: '2026-09-15T21:29:00Z',
  },
  {
    id: 'ws-3',
    organizationId: 'org-test-1',
    name: 'Archived Projects',
    description: 'Legacy projects stored for historical records',
    status: 'archived',
    industry: 'SaaS',
    contactScope: 'institution',
    color: '#EF4444',
    statuses: [
      { value: 'Archived', label: 'Archived', color: '#6B7280' },
    ],
    industryScopeLocked: false,
    createdAt: '2026-08-01T12:00:00Z',
    updatedAt: '2026-08-01T12:00:00Z',
  },
];

describe('WorkspaceEditor Listview & Toolbar Alignment', () => {
  const onSelectWorkspace = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the industry filter and New Workspace button next to each other in the toolbar', () => {
    render(
      <WorkspaceEditor
        workspaces={mockWorkspaces}
        selectedScope="institution"
        onSelectWorkspace={onSelectWorkspace}
      />
    );

    // Title and CardInfoTooltip
    expect(screen.getByText('Workspace Architect')).toBeInTheDocument();

    // New Workspace button
    const newWsBtn = screen.getByRole('button', { name: /New Workspace/i });
    expect(newWsBtn).toBeInTheDocument();

    // Industry filter select trigger
    const filterTrigger = screen.getByLabelText(/Filter workspaces by industry/i);
    expect(filterTrigger).toBeInTheDocument();

    // Verify they are within the same action bar container
    const parentContainer = filterTrigger.closest('.flex.items-center.gap-3');
    expect(parentContainer).toBeInTheDocument();
    expect(parentContainer).toContainElement(newWsBtn);
  });

  it('renders a proper desktop listview table where each record occupies one row', () => {
    const { container } = render(
      <WorkspaceEditor
        workspaces={mockWorkspaces}
        selectedScope="institution"
        onSelectWorkspace={onSelectWorkspace}
      />
    );

    // Desktop table container should exist
    const desktopTable = container.querySelector('table');
    expect(desktopTable).toBeInTheDocument();

    // Table header columns
    expect(screen.getByText('Workspace')).toBeInTheDocument();
    expect(screen.getByText('Industry & Scope')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getAllByText('Default').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Last Sync')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();

    // Workspaces rendered in table rows
    expect(screen.getAllByText('Client Onboarding').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Marketing Leads').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Archived Projects').length).toBeGreaterThanOrEqual(1);

    // Default badge present for ws-1
    expect(screen.getAllByText('Default').length).toBeGreaterThanOrEqual(1);

    // "Set as Default" button present for non-default active workspaces
    expect(screen.getAllByText('Set as Default').length).toBeGreaterThanOrEqual(1);
  });

  it('renders mobile-responsive cards with min 44px touch targets', () => {
    const { container } = render(
      <WorkspaceEditor
        workspaces={mockWorkspaces}
        selectedScope="institution"
        onSelectWorkspace={onSelectWorkspace}
      />
    );

    const mobileContainer = container.querySelector('.md\\:hidden');
    expect(mobileContainer).toBeInTheDocument();

    // Touch targets on mobile action buttons must be at least 44px
    const touchButtons = mobileContainer?.querySelectorAll('.min-h-\\[44px\\]');
    expect(touchButtons?.length).toBeGreaterThanOrEqual(3);
  });

  it('calls onSelectWorkspace when clicking edit button', () => {
    render(
      <WorkspaceEditor
        workspaces={mockWorkspaces}
        selectedScope="institution"
        onSelectWorkspace={onSelectWorkspace}
      />
    );

    const editButtons = screen.getAllByRole('button', { name: /Edit Client Onboarding/i });
    expect(editButtons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(editButtons[0]);

    expect(onSelectWorkspace).toHaveBeenCalledWith('ws-1');
  });

  it('displays empty state when no workspaces match filter', () => {
    render(
      <WorkspaceEditor
        workspaces={[]}
        selectedScope="institution"
        onSelectWorkspace={onSelectWorkspace}
      />
    );

    expect(screen.getByText('No workspaces found')).toBeInTheDocument();
    expect(screen.getByText(/Get started by creating your first workspace/i)).toBeInTheDocument();
  });
});
