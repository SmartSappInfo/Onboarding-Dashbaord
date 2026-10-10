import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DashboardHeader } from '../DashboardHeader';
import type { Workspace } from '@/lib/types';

describe('DashboardHeader Component', () => {
  const baseWorkspace: Workspace = {
    id: 'ws-marketing-leads',
    organizationId: 'org-test',
    name: 'Marketing Leads',
    contactScope: 'institution',
    status: 'active',
    statuses: [],
    color: '#10B981',
    industry: 'SaaS',
    industryScopeLocked: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const defaultProps = {
    activeWorkspaceId: 'ws-marketing-leads',
    activeWorkspace: baseWorkspace,
    canManageDashboard: true,
    terminology: { singular: 'Lead', plural: 'Leads' },
    onOpenCustomizer: vi.fn(),
    onOpenTaskEditor: vi.fn(),
  };

  it('renders dynamic "{workspace name} Dashboard" title for active workspace', () => {
    render(<DashboardHeader {...defaultProps} />);

    // Assert the heading shows "Marketing Leads Dashboard"
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Marketing Leads Dashboard');
    expect(heading).not.toHaveTextContent('Intelligence Hub');
  });

  it('does not duplicate "Dashboard" if workspace name already ends with "Dashboard"', () => {
    const workspaceWithDashboardSuffix: Workspace = {
      ...baseWorkspace,
      name: 'Executive Operations Dashboard',
    };

    render(
      <DashboardHeader
        {...defaultProps}
        activeWorkspace={workspaceWithDashboardSuffix}
      />
    );

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Executive Operations Dashboard');
    expect(heading).not.toHaveTextContent('Dashboard Dashboard');
  });

  it('formats activeWorkspaceId when activeWorkspace is null', () => {
    render(
      <DashboardHeader
        {...defaultProps}
        activeWorkspace={null}
        activeWorkspaceId="sales-pipeline"
      />
    );

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('sales pipeline Dashboard');
  });

  it('falls back to "Dashboard" when neither workspace name nor id is provided', () => {
    render(
      <DashboardHeader
        {...defaultProps}
        activeWorkspace={null}
        activeWorkspaceId=""
      />
    );

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Dashboard');
  });

  it('does not render redundant workspace name badge next to the title', () => {
    const { container } = render(<DashboardHeader {...defaultProps} />);

    // Badges inside the header text area shouldn't exist
    const headingContainer = container.querySelector('h1')?.parentElement;
    expect(headingContainer).toBeTruthy();
    // Only h1 and tooltip button should be inside headingContainer
    const badges = headingContainer?.querySelectorAll('.badge, [data-slot="badge"]');
    expect(badges?.length ?? 0).toBe(0);
  });

  it('triggers task editor and customizer callbacks when clicked', () => {
    const onOpenTaskEditor = vi.fn();
    const onOpenCustomizer = vi.fn();

    render(
      <DashboardHeader
        {...defaultProps}
        onOpenTaskEditor={onOpenTaskEditor}
        onOpenCustomizer={onOpenCustomizer}
      />
    );

    const taskButton = screen.getByRole('button', { name: /task/i });
    fireEvent.click(taskButton);
    expect(onOpenTaskEditor).toHaveBeenCalledTimes(1);

    const customizerButton = screen.getByTitle('Customize Perspective');
    fireEvent.click(customizerButton);
    expect(onOpenCustomizer).toHaveBeenCalledTimes(1);
  });
});
