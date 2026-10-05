import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import type { Workspace } from '@/lib/types';
import WorkspaceRegionalTab from '../WorkspaceRegionalTab';

vi.mock('@/firebase', () => ({
  useUser: () => ({ user: { uid: 'usr_admin_1' } }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

const mockSaveWorkspaceAction = vi.fn().mockResolvedValue({ success: true });
vi.mock('@/lib/workspace-actions', () => ({
  saveWorkspaceAction: (...args: unknown[]) => mockSaveWorkspaceAction(...args),
}));

describe('WorkspaceRegionalTab Tri-Domain Visibility', () => {
  const mockWorkspace: Workspace = {
    id: 'ws_test',
    organizationId: 'org_1',
    name: 'Test WS',
    slug: 'test-ws',
    description: 'Test WS Description',
    status: 'active',
    statuses: [{ value: 'Active', label: 'Active', color: '#10b981' }],
    contactScope: 'institution',
    scopeLocked: false,
    industry: 'SaaS',
    industryScopeLocked: false,
    capabilities: {
      billing: true,
      admissions: true,
      children: true,
      contracts: true,
      messaging: true,
      automations: true,
      tasks: true,
    },
    restrictVisibilityToAssigned: true,
    restrictDealsVisibilityToAssigned: true,
    restrictTasksVisibilityToAssigned: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  it('renders all three visibility scope sections: Entities, Deals, and Tasks', () => {
    render(<WorkspaceRegionalTab workspace={mockWorkspace} onSaveSuccess={vi.fn()} />);

    expect(screen.getByText('Entity Visibility Scope')).toBeDefined();
    expect(screen.getByText('Deals Visibility Scope')).toBeDefined();
    expect(screen.getByText('Tasks Visibility Scope')).toBeDefined();
  });

  it('submits updated Deals and Tasks visibility scopes when saved', async () => {
    const onSaveSuccess = vi.fn();
    render(<WorkspaceRegionalTab workspace={mockWorkspace} onSaveSuccess={onSaveSuccess} />);

    // Click "All Deals"
    const allDealsButton = screen.getByText('All Deals').closest('button');
    expect(allDealsButton).not.toBeNull();
    if (allDealsButton) {
      fireEvent.click(allDealsButton);
    }

    // Click "All Tasks"
    const allTasksButton = screen.getByText('All Tasks').closest('button');
    expect(allTasksButton).not.toBeNull();
    if (allTasksButton) {
      fireEvent.click(allTasksButton);
    }

    // Submit form
    const saveButton = screen.getByRole('button', { name: /save localization/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockSaveWorkspaceAction).toHaveBeenCalledWith(
        'ws_test',
        expect.objectContaining({
          restrictVisibilityToAssigned: true,
          restrictDealsVisibilityToAssigned: false,
          restrictTasksVisibilityToAssigned: false,
        }),
        'usr_admin_1'
      );
    });
  });
});
