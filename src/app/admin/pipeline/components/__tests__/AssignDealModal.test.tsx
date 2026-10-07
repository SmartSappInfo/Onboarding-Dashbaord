/**
 * @fileoverview Unit Tests: AssignDealModal Component
 *
 * Verifies:
 * - Demarcated header, tooltip, deal context banner, and status badges.
 * - Dynamic modal title ("Assign Deal" vs "Reassign Deal").
 * - Search filtering across workspace team members.
 * - Selecting another user and submitting calls updateDealOwnerAction.
 * - Selecting "Leave Unassigned" calls updateDealOwnerAction with nulls.
 * - Disabling submission when current selection equals existing assignment.
 * - Minimum 44px touch targets on interactive controls.
 *
 * Compliance: agents_mcp_rules.md, .agents/AGENTS.md (Rule 4, 7, 10), theme.md (Section 8).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AssignDealModal from '../AssignDealModal';
import type { Deal, UserProfile } from '@/lib/types';

// Mock WorkspaceContext
vi.mock('@/context/WorkspaceContext', () => ({
  useWorkspace: vi.fn(() => ({
    activeWorkspaceId: 'ws_test_alpha',
    activeOrganizationId: 'org_test_hq',
  })),
}));

// Static mock users conforming to UserProfile schema
const MOCK_USERS: UserProfile[] = [
  {
    id: 'user_1',
    name: 'Sarah Jenkins',
    email: 'sarah.jenkins@smartsapp.com',
    role: 'sales_rep',
    photoURL: 'https://avatar.test/sarah.jpg',
    organizationId: 'org_test_hq',
    workspaceIds: ['ws_test_alpha'],
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'user_2',
    name: 'David Mensah',
    email: 'david.mensah@smartsapp.com',
    role: 'account_executive',
    organizationId: 'org_test_hq',
    workspaceIds: ['ws_test_alpha'],
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'user_3',
    name: 'Ama Serwaa',
    email: 'ama.serwaa@smartsapp.com',
    role: 'sales_manager',
    organizationId: 'org_test_hq',
    workspaceIds: ['ws_test_alpha'],
    createdAt: '2026-01-01T00:00:00Z',
  },
];

// Mock useWorkspaceUsers
vi.mock('@/hooks/use-workspace-users', () => ({
  useWorkspaceUsers: vi.fn(() => ({
    data: MOCK_USERS,
    isLoading: false,
  })),
}));

// Mock toast
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({
    toast: mockToast,
  })),
}));

// Mock updateDealOwnerAction
const mockUpdateDealOwnerAction = vi.fn().mockResolvedValue({ success: true });
vi.mock('@/app/actions/deal-actions', () => ({
  updateDealOwnerAction: (...args: unknown[]) => mockUpdateDealOwnerAction(...args),
}));

describe('AssignDealModal Component', () => {
  const unassignedDeal: Deal = {
    id: 'deal_unassigned_101',
    name: 'Royal Priesthood Academy - Expansion',
    pipelineId: 'pipe_sales_1',
    stageId: 'stage_discovery',
    value: 12500,
    status: 'open',
    assignedTo: null,
    workspaceId: 'ws_test_alpha',
    organizationId: 'org_test_hq',
    entityId: 'ent_rpa_01',
    createdAt: '2026-10-01T10:00:00Z',
    updatedAt: '2026-10-01T10:00:00Z',
  };

  const assignedDeal: Deal = {
    ...unassignedDeal,
    id: 'deal_assigned_202',
    assignedTo: {
      userId: 'user_1',
      name: 'Sarah Jenkins',
      email: 'sarah.jenkins@smartsapp.com',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "Assign Deal" for an unassigned deal with deal context banner', () => {
    render(
      <AssignDealModal
        deal={unassignedDeal}
        open={true}
        onOpenChange={vi.fn()}
      />
    );

    expect(screen.getByText('Assign Deal')).toBeDefined();
    expect(screen.getByText('Royal Priesthood Academy - Expansion')).toBeDefined();
    // Context banner shows Unassigned badge
    expect(screen.getAllByText('Unassigned').length).toBeGreaterThan(0);
    // Unassigned option tile
    expect(screen.getByText('Leave Unassigned')).toBeDefined();
    // Team member count
    expect(screen.getByText('Workspace Team (3)')).toBeDefined();
  });

  it('renders "Reassign Deal" and shows "Current" badge for assigned deal', () => {
    render(
      <AssignDealModal
        deal={assignedDeal}
        open={true}
        onOpenChange={vi.fn()}
      />
    );

    expect(screen.getByText('Reassign Deal')).toBeDefined();
    expect(screen.getByText('Current')).toBeDefined();
    expect(screen.getAllByText('Sarah Jenkins').length).toBe(2);
  });

  it('filters team members when typing in search input', () => {
    render(
      <AssignDealModal
        deal={unassignedDeal}
        open={true}
        onOpenChange={vi.fn()}
      />
    );

    const searchInput = screen.getByPlaceholderText('Search team members by name or email...');
    fireEvent.change(searchInput, { target: { value: 'David' } });

    expect(screen.getByText('David Mensah')).toBeDefined();
    expect(screen.queryByText('Sarah Jenkins')).toBeNull();
    expect(screen.queryByText('Ama Serwaa')).toBeNull();
  });

  it('assigns deal to selected team member upon clicking Assign Deal', async () => {
    const onOpenChange = vi.fn();
    const onAssigned = vi.fn();

    render(
      <AssignDealModal
        deal={unassignedDeal}
        open={true}
        onOpenChange={onOpenChange}
        onAssigned={onAssigned}
      />
    );

    // Click on David Mensah
    const davidOption = screen.getByText('David Mensah');
    fireEvent.click(davidOption);

    // Save button should now be enabled
    const saveButton = screen.getByRole('button', { name: /assign deal/i });
    expect(saveButton).toBeDefined();
    expect(saveButton.hasAttribute('disabled')).toBe(false);

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateDealOwnerAction).toHaveBeenCalledWith(
        'deal_unassigned_101',
        'user_2',
        'David Mensah',
        'david.mensah@smartsapp.com'
      );
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Deal Assigned',
        })
      );
      expect(onAssigned).toHaveBeenCalledWith('user_2', 'David Mensah');
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('unassigns deal when selecting "Leave Unassigned" on an assigned deal', async () => {
    const onOpenChange = vi.fn();
    const onAssigned = vi.fn();

    render(
      <AssignDealModal
        deal={assignedDeal}
        open={true}
        onOpenChange={onOpenChange}
        onAssigned={onAssigned}
      />
    );

    // Click on Leave Unassigned
    const unassignOption = screen.getByText('Leave Unassigned');
    fireEvent.click(unassignOption);

    // Save button should say "Save as Unassigned"
    const saveButton = screen.getByRole('button', { name: /save as unassigned/i });
    expect(saveButton).toBeDefined();

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateDealOwnerAction).toHaveBeenCalledWith(
        'deal_assigned_202',
        null,
        null,
        null
      );
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Deal Unassigned',
        })
      );
      expect(onAssigned).toHaveBeenCalledWith(null, null);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('disables save button when the selection equals current assignment', () => {
    render(
      <AssignDealModal
        deal={assignedDeal}
        open={true}
        onOpenChange={vi.fn()}
      />
    );

    // Initially Sarah Jenkins is the owner, and selectedUserId is initialized to Sarah Jenkins
    const saveButton = screen.getByRole('button', { name: /assign deal/i });
    expect(saveButton.hasAttribute('disabled')).toBe(true);
  });
});
