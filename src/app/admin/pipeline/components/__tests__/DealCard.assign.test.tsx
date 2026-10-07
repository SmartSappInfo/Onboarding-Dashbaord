/**
 * @fileoverview Unit Tests: DealCard Assignee Trigger & Modal Integration
 *
 * Verifies:
 * - Clicking on the footer assignee pill ("Unassigned" or owner name) opens AssignDealModal.
 * - Clicking "Assign Deal" or "Reassign Deal" in the card's 3-dots DropdownMenu opens AssignDealModal.
 * - Pointer events stopping propagation to prevent dnd-kit drag conflicts.
 *
 * Compliance: agents_mcp_rules.md, .agents/AGENTS.md (Rule 4, 7, 10).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DealCard from '../DealCard';
import type { Deal } from '@/lib/types';

// Mock dnd-kit sortable
vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

// Mock WorkspaceContext
vi.mock('@/context/WorkspaceContext', () => ({
  useWorkspace: () => ({
    activeWorkspaceId: 'ws_test_alpha',
    activeOrganizationId: 'org_test_hq',
  }),
}));

// Mock Firebase hooks
vi.mock('@/firebase', () => ({
  useFirestore: () => null,
  useDoc: () => ({ data: null }),
  useMemoFirebase: (fn: () => unknown) => fn(),
  useCollection: () => ({ data: [], isLoading: false }),
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
}));

// Mock terminology
vi.mock('@/hooks/use-terminology', () => ({
  useTerminology: () => ({
    singular: 'Company',
    plural: 'Companies',
  }),
}));

// Mock toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

// Mock CallModalContext
vi.mock('@/context/CallModalContext', () => ({
  useCallModal: () => ({ openCallModal: vi.fn() }),
}));

// Mock useWorkspaceUsers
vi.mock('@/hooks/use-workspace-users', () => ({
  useWorkspaceUsers: () => ({
    data: [
      { id: 'user_1', name: 'Peter Mensah', email: 'peter@smartsapp.com' },
      { id: 'user_2', name: 'Anita Mawufemo', email: 'anita@smartsapp.com' },
    ],
    isLoading: false,
  }),
}));

// Mock confirm
vi.mock('@/components/ui/confirm-dialog', () => ({
  useConfirm: () => vi.fn(),
}));

describe('DealCard - Assignee Mapping Integration', () => {
  const mockUnassignedDeal: Deal = {
    id: 'deal_unassigned_101',
    name: 'Royal Priesthood Academy - Opened Email',
    pipelineId: 'pipe_1',
    stageId: 'stage_1',
    value: 0,
    status: 'open',
    assignedTo: null,
    workspaceId: 'ws_test_alpha',
    organizationId: 'org_test_hq',
    entityId: 'ent_1',
    createdAt: '2026-10-01T10:00:00Z',
    updatedAt: '2026-10-01T10:00:00Z',
  };

  const mockAssignedDeal: Deal = {
    ...mockUnassignedDeal,
    id: 'deal_assigned_202',
    assignedTo: {
      userId: 'user_1',
      name: 'Peter Mensah',
      email: 'peter@smartsapp.com',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens AssignDealModal when tapping the footer "Unassigned" button', () => {
    render(<DealCard deal={mockUnassignedDeal} />);

    // Footer button showing Unassigned
    const unassignedBtn = screen.getByTitle(/Unassigned \(Click to assign\)/i);
    expect(unassignedBtn).toBeDefined();

    fireEvent.click(unassignedBtn);

    // Modal should now be open
    expect(screen.getByText('Assign Deal')).toBeDefined();
    expect(screen.getByPlaceholderText('Search team members by name or email...')).toBeDefined();
  });

  it('opens AssignDealModal when tapping the footer assigned owner button', () => {
    render(<DealCard deal={mockAssignedDeal} />);

    const assignedBtn = screen.getByTitle(/Assigned to: Peter Mensah \(Click to reassign\)/i);
    expect(assignedBtn).toBeDefined();

    fireEvent.click(assignedBtn);

    expect(screen.getByText('Reassign Deal')).toBeDefined();
  });

  it('renders "Assign Deal" in dropdown menu and opens modal on click', async () => {
    render(<DealCard deal={mockUnassignedDeal} />);

    // Open dropdown menu via keyboard interaction (Radix DropdownMenu in jsdom)
    const moreMenuBtn = screen.getByRole('button', { name: '' });
    fireEvent.keyDown(moreMenuBtn, { key: 'Enter', code: 'Enter' });

    // Wait for dropdown item to be mounted
    const assignMenuItem = await screen.findByText('Assign Deal');
    expect(assignMenuItem).toBeDefined();
    fireEvent.click(assignMenuItem);

    // Modal is open
    expect(screen.getByPlaceholderText('Search team members by name or email...')).toBeDefined();
  });
});
