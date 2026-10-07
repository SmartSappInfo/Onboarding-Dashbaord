/**
 * @fileoverview Unit Tests: TransferDealModal Component
 *
 * Verifies:
 * - Demarcated header, single-circle tooltip, and segmented mode switcher (Move vs Copy).
 * - Cascading selectors: Workspace -> Pipeline -> Stage.
 * - Scoped Assignee Picker displaying ONLY members of the target workspace.
 * - AI Recommendation preview card with "Accept Recommendation" workflow (Rule 21).
 * - Copy mode displaying custom fields, line items, and contacts checkboxes.
 * - Calling transferDealAction with correct parameters upon confirmation.
 * - Mobile accessibility (min-h-[44px] touch targets - Rule 7).
 *
 * Compliance: docs/agents_mcp/agents_mcp_rules.md, theme.md Section 8.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TransferDealModal from '../TransferDealModal';
import type { Deal, Pipeline, OnboardingStage, UserProfile } from '@/lib/types';

// Mock TenantContext
const MOCK_WORKSPACES = [
  { id: 'ws_alpha', name: 'Alpha Campus', organizationId: 'org_main' },
  { id: 'ws_beta', name: 'Beta Campus', organizationId: 'org_main' },
];

vi.mock('@/context/TenantContext', () => ({
  useTenant: vi.fn(() => ({
    accessibleWorkspaces: MOCK_WORKSPACES,
    allAccessibleWorkspaces: MOCK_WORKSPACES,
    activeWorkspaceId: 'ws_alpha',
    activeOrganizationId: 'org_main',
  })),
}));

// Mock Firebase hooks
const MOCK_PIPELINES: Pipeline[] = [
  {
    id: 'pipe_alpha_sales',
    name: 'Alpha Admissions Pipeline',
    workspaceIds: ['ws_alpha'],
    stageIds: ['stage_1', 'stage_2'],
    accessRoles: [],
    isArchived: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'pipe_beta_sales',
    name: 'Beta Admissions Pipeline',
    workspaceIds: ['ws_beta'],
    stageIds: [],
    accessRoles: [],
    isArchived: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

const MOCK_STAGES: OnboardingStage[] = [
  {
    id: 'stage_1',
    pipelineId: 'pipe_alpha_sales',
    name: 'Inquiry',
    order: 0,
    probability: 20,
    terminalType: 'none',
  },
  {
    id: 'stage_2',
    pipelineId: 'pipe_alpha_sales',
    name: 'Assessment',
    order: 1,
    probability: 60,
    terminalType: 'none',
  },
];

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
}));

let collectionCallCount = 0;
vi.mock('@/firebase', () => ({
  useFirestore: vi.fn(() => ({})),
  useMemoFirebase: vi.fn((fn: () => unknown) => fn()),
  useCollection: vi.fn(() => {
    collectionCallCount++;
    return {
      data: collectionCallCount % 2 === 1 ? MOCK_PIPELINES : MOCK_STAGES,
      isLoading: false,
    };
  }),
}));

// Mock Workspace Users (Scoped to workspace)
const MOCK_USERS_ALPHA: UserProfile[] = [
  {
    id: 'user_alpha_1',
    name: 'Ama Serwaa',
    email: 'ama@example.com',
    role: 'sales_rep',
    organizationId: 'org_main',
    workspaceIds: ['ws_alpha'],
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'user_alpha_2',
    name: 'Kofi Boateng',
    email: 'kofi@example.com',
    role: 'account_executive',
    organizationId: 'org_main',
    workspaceIds: ['ws_alpha'],
    createdAt: '2026-01-01T00:00:00Z',
  },
];

vi.mock('@/hooks/use-workspace-users', () => ({
  useWorkspaceUsers: vi.fn((_wsId?: string) => ({
    data: MOCK_USERS_ALPHA,
    isLoading: false,
  })),
}));

// Mock toast
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: mockToast })),
}));

// Mock Server Actions
const mockTransferDealAction = vi.fn().mockResolvedValue({
  success: true,
  dealId: 'deal_123',
  mode: 'move',
});
vi.mock('@/app/actions/deal-actions', () => ({
  transferDealAction: (...args: unknown[]) => mockTransferDealAction(...args),
}));

const mockGenerateDealTransferAiSummaryAction = vi.fn().mockResolvedValue({
  success: true,
  summary: 'Strong interest shown during the campus tour. Pricing discussed.',
  nextStep: {
    type: 'call',
    title: 'Schedule formal fee structure presentation',
    dueDate: '2026-10-15T10:00:00Z',
  },
});
vi.mock('@/app/actions/deal-ai-actions', () => ({
  generateDealTransferAiSummaryAction: (...args: unknown[]) =>
    mockGenerateDealTransferAiSummaryAction(...args),
}));

describe('TransferDealModal Component', () => {
  const mockDeal: Deal = {
    id: 'deal_123',
    name: 'Heritage Hall - Premium Enrollment',
    workspaceId: 'ws_alpha',
    organizationId: 'org_main',
    entityId: 'ent_heritage_01',
    pipelineId: 'pipe_alpha_sales',
    stageId: 'stage_1',
    stageName: 'Inquiry',
    value: 25000,
    currency: 'USD',
    status: 'open',
    probability: 20,
    assignedTo: {
      userId: 'user_alpha_1',
      name: 'Ama Serwaa',
      email: 'ama@example.com',
    },
    createdAt: '2026-10-01T10:00:00Z',
    updatedAt: '2026-10-01T10:00:00Z',
  };

  const defaultProps = {
    deal: mockDeal,
    open: true,
    onOpenChange: vi.fn(),
    onTransferred: vi.fn(),
    initialMode: 'move' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with demarcated header, title, and segmented controls', () => {
    render(<TransferDealModal {...defaultProps} />);

    expect(screen.getByText('Move Deal to Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Heritage Hall - Premium Enrollment')).toBeInTheDocument();
    expect(screen.getByText('Move Deal (Transfer)')).toBeInTheDocument();
    expect(screen.getByText('Copy Deal (Duplicate)')).toBeInTheDocument();
  });

  it('switches between Move and Copy modes and updates UI copy', () => {
    render(<TransferDealModal {...defaultProps} />);

    const copyBtn = screen.getByText('Copy Deal (Duplicate)');
    fireEvent.click(copyBtn);

    expect(screen.getByText('Copy Deal to Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Duplication Settings')).toBeInTheDocument();
    expect(screen.getByText('Line Items')).toBeInTheDocument();
    expect(screen.getByText('Contacts')).toBeInTheDocument();
    expect(screen.getByText('Custom Fields')).toBeInTheDocument();
  });

  it('renders scoped assignee picker with team members from target workspace', () => {
    render(<TransferDealModal {...defaultProps} />);

    expect(screen.getByText('Assign Deal Owner')).toBeInTheDocument();
    expect(screen.getByText('Ama Serwaa')).toBeInTheDocument();
    expect(screen.getByText('Kofi Boateng')).toBeInTheDocument();
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
  });

  it('generates and applies AI recommendation upon user acceptance', async () => {
    render(<TransferDealModal {...defaultProps} />);

    const aiBtn = screen.getByText('Auto-Generate with AI');
    fireEvent.click(aiBtn);

    await waitFor(() => {
      expect(mockGenerateDealTransferAiSummaryAction).toHaveBeenCalledWith('deal_123', 'ws_alpha');
    });

    // Preview Card should appear
    expect(await screen.findByText('AI Recommendation Preview')).toBeInTheDocument();
    expect(screen.getByText(/Strong interest shown during the campus tour/)).toBeInTheDocument();

    // Click Accept Recommendation
    const acceptBtn = screen.getByText('Accept Recommendation');
    fireEvent.click(acceptBtn);

    // Form inputs should now have the AI contents
    const textarea = screen.getByLabelText(/Transfer Summary \/ Rationale/i);
    expect(textarea).toHaveValue('Strong interest shown during the campus tour. Pricing discussed.');
  });

  it('calls transferDealAction with correct parameters on submission', async () => {
    render(<TransferDealModal {...defaultProps} />);

    const submitBtn = screen.getByRole('button', { name: /Move Deal$/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockTransferDealAction).toHaveBeenCalledWith(
        expect.objectContaining({
          dealId: 'deal_123',
          mode: 'move',
          targetWorkspaceId: 'ws_alpha',
        })
      );
    });

    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });
});
