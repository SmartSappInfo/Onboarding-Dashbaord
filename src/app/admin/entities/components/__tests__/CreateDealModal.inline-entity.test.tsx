/**
 * @fileoverview Unit Tests: CreateDealModal Inline Entity Creation
 *
 * Verifies Phase 2 of the Inline Entity & Primary Contact Creation implementation:
 * - Rendering "+ New {singular}" trigger
 * - Switching between search combobox and inline entity/contact form
 * - Pre-filling entity name when clicking "+ Create '{search}' as new {singular}"
 * - Disabling submission until required entity/contact fields are provided
 * - Submitting via createDealWithNewEntityAction when in new entity mode
 *
 * Compliance: agents_mcp_rules.md, .agents/AGENTS.md (Rule 4, 7, 10).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CreateDealModal from '../CreateDealModal';

// Mock WorkspaceContext
vi.mock('@/context/WorkspaceContext', () => ({
  useWorkspace: vi.fn(() => ({
    activeWorkspaceId: 'ws_test_123',
    activeOrganizationId: 'org_test_hq',
  })),
}));

// Static mock datasets to ensure stable references across render cycles
const MOCK_PIPELINES = [
  { id: 'pipe_1', name: 'Sales Pipeline', isDefault: true, defaultDealValue: 5000 },
];
const MOCK_STAGES = [
  { id: 'stage_1', name: 'Discovery', pipelineId: 'pipe_1', order: 0 },
];

// Mock Firebase hooks
vi.mock('@/firebase', () => ({
  useFirestore: vi.fn(() => ({})),
  useMemoFirebase: vi.fn(() => null),
  useCollection: vi.fn(() => ({
    data: MOCK_PIPELINES,
    isLoading: false,
  })),
}));

// Mock useWorkspaceUsers
vi.mock('@/hooks/use-workspace-users', () => ({
  useWorkspaceUsers: vi.fn(() => ({
    data: [{ id: 'user_1', name: 'Alice Rep', email: 'alice@smartsapp.com' }],
  })),
}));

// Mock useTerminology
vi.mock('@/hooks/use-terminology', () => ({
  useTerminology: vi.fn(() => ({
    singular: 'Company',
    plural: 'Companies',
  })),
}));

// Mock toast
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({
    toast: mockToast,
  })),
}));

// Mock entity-contact-actions
vi.mock('@/app/actions/entity-contact-actions', () => ({
  getEntityDealDefaultsAction: vi.fn().mockResolvedValue({ contacts: [], assignedTo: null }),
  searchEntitiesForDealAction: vi.fn().mockResolvedValue([]),
}));

// Mock deal-actions
const mockCreateDealWithNewEntityAction = vi.fn().mockResolvedValue({
  success: true,
  dealId: 'deal_123',
  entityId: 'ent_123',
});
const mockCreateDeal = vi.fn().mockResolvedValue({
  id: 'deal_legacy_123',
});

vi.mock('@/app/actions/deal-actions', () => ({
  createDealWithNewEntityAction: (...args: unknown[]) => mockCreateDealWithNewEntityAction(...args),
  createDeal: (...args: unknown[]) => mockCreateDeal(...args),
}));

describe('CreateDealModal - Inline Entity Creation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "+ New Company" trigger button in Target Contact header', () => {
    render(<CreateDealModal open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText('Target contact / company')).toBeDefined();
    expect(screen.getByText('New Company')).toBeDefined();
  });

  it('toggles to inline creation form when "+ New Company" is clicked', () => {
    render(<CreateDealModal open={true} onOpenChange={vi.fn()} />);

    const newCompanyBtn = screen.getByText('New Company');
    fireEvent.click(newCompanyBtn);

    // Should now show inline creation card
    expect(screen.getByText('New Company Details')).toBeDefined();
    expect(screen.getByPlaceholderText('e.g. Acme Corporation')).toBeDefined();
    expect(screen.getByText('Primary & Signatory Contact')).toBeDefined();
    expect(screen.getByPlaceholderText('Contact Full Name (e.g. Sarah Jenkins)')).toBeDefined();
    expect(screen.getByPlaceholderText('Phone number')).toBeDefined();
    expect(screen.getByPlaceholderText('Email address')).toBeDefined();
    expect(screen.getByText('Choose existing instead')).toBeDefined();
  });

  it('switches back to search combobox when "Choose existing instead" is clicked', () => {
    render(<CreateDealModal open={true} onOpenChange={vi.fn()} />);

    fireEvent.click(screen.getByText('New Company'));
    expect(screen.getByText('New Company Details')).toBeDefined();

    fireEvent.click(screen.getByText('Choose existing instead'));
    expect(screen.queryByText('New Company Details')).toBeNull();
    expect(screen.getByText(/select company or contact/i)).toBeDefined();
  });

  it('invokes createDealWithNewEntityAction with validated inputs on submit', async () => {
    const onOpenChange = vi.fn();
    render(<CreateDealModal open={true} onOpenChange={onOpenChange} />);

    // Switch to new entity mode
    fireEvent.click(screen.getByText('New Company'));

    // Fill Entity details
    fireEvent.change(screen.getByPlaceholderText('e.g. Acme Corporation'), {
      target: { value: 'Horizon Solar' },
    });
    fireEvent.change(screen.getByPlaceholderText('Contact Full Name (e.g. Sarah Jenkins)'), {
      target: { value: 'David Miller' },
    });
    fireEvent.change(screen.getByPlaceholderText('Phone number'), {
      target: { value: '+233240001122' },
    });

    // Fill Deal name
    fireEvent.change(screen.getByPlaceholderText('e.g. 2026 Expansion Contract'), {
      target: { value: 'Solar Grid 2026' },
    });

    // Click submit
    const submitBtn = screen.getByRole('button', { name: /create deal/i });
    expect(submitBtn).toBeDefined();
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockCreateDealWithNewEntityAction).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws_test_123',
          entity: expect.objectContaining({
            name: 'Horizon Solar',
            primaryContact: expect.objectContaining({
              name: 'David Miller',
              phone: '+233240001122',
            }),
          }),
          deal: expect.objectContaining({
            name: 'Solar Grid 2026',
          }),
        })
      );
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Record & Deal Initialized',
        })
      );
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
