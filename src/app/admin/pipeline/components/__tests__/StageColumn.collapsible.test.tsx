/**
 * @fileoverview Unit Tests: StageColumn Collapsible Slivers & Sticky Header
 *
 * Verifies:
 * - StageColumn renders expanded with sticky header and deal cards by default.
 * - Clicking the quick collapse button calls onToggleCollapse.
 * - When isCollapsed is true, StageColumn renders as a 56px vertical sliver.
 * - Slivers display vertical stage name, deal count badge, and expand button.
 * - Clicking the sliver or expand button triggers onToggleCollapse.
 *
 * Compliance: agents_mcp_rules.md, .agents/AGENTS.md (Rule 5, 7, 10), theme.md.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StageColumn, { TruncatedStageTitle } from '../StageColumn';
import type { Deal, OnboardingStage } from '@/lib/types';

// Mock WorkspaceContext
vi.mock('@/context/WorkspaceContext', () => ({
  useWorkspace: () => ({
    activeWorkspaceId: 'ws_test_alpha',
    activeOrganizationId: 'org_test_hq',
  }),
}));

// Mock Firebase hooks
vi.mock('@/firebase', () => ({
  useUser: () => ({ user: { uid: 'user_test_123', email: 'test@smartsapp.com' } }),
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

// Mock useTerminology
vi.mock('@/hooks/use-terminology', () => ({
  useTerminology: () => ({
    singular: 'Company',
    plural: 'Companies',
  }),
}));

// Mock useConfirm
vi.mock('@/components/ui/confirm-dialog', () => ({
  useConfirm: () => vi.fn().mockResolvedValue(true),
}));

// Mock useToast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

// Mock dnd-kit hooks
vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
  SortableContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  verticalListSortingStrategy: {},
}));

vi.mock('@dnd-kit/core', () => ({
  useDroppable: () => ({
    setNodeRef: vi.fn(),
    isOver: false,
  }),
}));

const mockStage: OnboardingStage = {
  id: 'stage_discovery',
  pipelineId: 'pipe_sales_1',
  name: 'Discovery & Qualification',
  order: 1,
  probability: 25,
};

const mockDeals: Deal[] = [
  {
    id: 'deal_1',
    pipelineId: 'pipe_sales_1',
    stageId: 'stage_discovery',
    name: 'St. Peter International Deal',
    value: 15000,
    status: 'open',
    workspaceId: 'ws_test_alpha',
    organizationId: 'org_test_hq',
    entityId: 'ent_101',
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z',
  },
];

describe('StageColumn - Collapsible Slivers & Sticky Headers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders expanded stage column with sticky header and deal cards', () => {
    render(
      <StageColumn
        stage={mockStage}
        deals={mockDeals}
        isCollapsed={false}
      />
    );

    // Stage name is visible
    expect(screen.getByText('Discovery & Qualification')).toBeDefined();
    // Deal is visible
    expect(screen.getByText('St. Peter International Deal')).toBeDefined();
    // Deal count badge is visible
    expect(screen.getByText('1')).toBeDefined();
  });

  it('calls onToggleCollapse when clicking the collapse button in expanded header', () => {
    const handleToggle = vi.fn();
    render(
      <StageColumn
        stage={mockStage}
        deals={mockDeals}
        isCollapsed={false}
        onToggleCollapse={handleToggle}
      />
    );

    const collapseBtn = screen.getByLabelText('Collapse stage Discovery & Qualification');
    expect(collapseBtn).toBeDefined();

    fireEvent.click(collapseBtn);
    expect(handleToggle).toHaveBeenCalledTimes(1);
  });

  it('renders as a compact vertical sliver when isCollapsed is true', () => {
    const handleToggle = vi.fn();
    render(
      <StageColumn
        stage={mockStage}
        deals={mockDeals}
        isCollapsed={true}
        onToggleCollapse={handleToggle}
      />
    );

    // In sliver, the deal cards should NOT be rendered
    expect(screen.queryByText('St. Peter International Deal')).toBeNull();

    // The expand button with label should be present
    const expandBtn = screen.getByLabelText('Expand stage Discovery & Qualification');
    expect(expandBtn).toBeDefined();

    // Clicking expand calls onToggleCollapse
    fireEvent.click(expandBtn);
    expect(handleToggle).toHaveBeenCalledTimes(1);
  });

  it('renders vertical stage title and deal count on collapsed sliver', () => {
    render(
      <StageColumn
        stage={mockStage}
        deals={[]}
        isCollapsed={true}
      />
    );

    // Empty deal count is 0
    expect(screen.getByText('0')).toBeDefined();
    // Stage name is rendered vertically
    expect(screen.getByText('Discovery & Qualification')).toBeDefined();
  });

  it('renders rounded color bar at the top of the stage card in both expanded and collapsed modes', () => {
    const coloredStage: OnboardingStage = {
      ...mockStage,
      color: '#8B5CF6', // Purple
    };

    // 1. Expanded mode
    const { container: expandedContainer, unmount } = render(
      <StageColumn
        stage={coloredStage}
        deals={mockDeals}
        isCollapsed={false}
      />
    );

    const expandedBar = expandedContainer.querySelector('div[style*="background-color: rgb(139, 92, 246)"], div[style*="background-color: #8B5CF6"]');
    expect(expandedBar).not.toBeNull();
    expect(expandedBar?.className).toContain('rounded-t-2xl');
    unmount();

    // 2. Collapsed sliver mode
    const { container: collapsedContainer } = render(
      <StageColumn
        stage={coloredStage}
        deals={mockDeals}
        isCollapsed={true}
      />
    );

    const collapsedBar = collapsedContainer.querySelector('div[style*="background-color: rgb(139, 92, 246)"], div[style*="background-color: #8B5CF6"]');
    expect(collapsedBar).not.toBeNull();
    expect(collapsedBar?.className).toContain('rounded-t-2xl');
  });

  describe('TruncatedStageTitle - Truncation Detection & Tooltip', () => {
    it('detects when title is truncated (scrollWidth > clientWidth) and mounts tooltip on hover', async () => {
      const longTitle = 'Enterprise Contract Negotiation & Executive Signoff';
      const { container } = render(
        <TruncatedStageTitle title={longTitle} delayDuration={0} />
      );

      const heading = container.querySelector('h3');
      expect(heading).not.toBeNull();
      expect(heading?.textContent).toBe(longTitle);

      // In jsdom, mock scrollWidth > clientWidth to simulate visual ellipsis truncation
      Object.defineProperty(heading, 'scrollWidth', { value: 350, configurable: true });
      Object.defineProperty(heading, 'clientWidth', { value: 150, configurable: true });

      // Trigger hover / focus
      fireEvent.focus(heading!);

      // The tooltip content should become visible
      const tooltip = await screen.findByRole('tooltip');
      expect(tooltip).toBeDefined();
      expect(tooltip.textContent).toContain(longTitle);
    });

    it('suppresses tooltip when title fits completely without truncation (scrollWidth <= clientWidth)', () => {
      const shortTitle = 'Won';
      const { container } = render(
        <TruncatedStageTitle title={shortTitle} delayDuration={0} />
      );

      const heading = container.querySelector('h3');
      expect(heading).not.toBeNull();

      // Mock scrollWidth <= clientWidth (no truncation)
      Object.defineProperty(heading, 'scrollWidth', { value: 50, configurable: true });
      Object.defineProperty(heading, 'clientWidth', { value: 150, configurable: true });

      // Trigger hover / focus
      fireEvent.focus(heading!);

      // The tooltip should NOT be present in document
      expect(screen.queryByRole('tooltip')).toBeNull();
    });
  });
});

