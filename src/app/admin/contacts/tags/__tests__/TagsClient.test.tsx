/**
 * @fileoverview Unit tests for TagsClient (Tags Hub)
 *
 * Verifies that:
 * 1. Title renders with CardInfoTooltip and zero raw description below it.
 * 2. Main navigation tabs are rendered in the header alongside the Create Tag button.
 * 3. Tag categories are exposed as a Select dropdown list next to the search input.
 * 4. Tags are displayed using a Table listview.
 */

import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import TagsClient from '../TagsClient';

vi.mock('@/firebase', () => ({
  useUser: () => ({ user: { uid: 'user-1', displayName: 'Admin' } }),
}));

vi.mock('@/context/WorkspaceContext', () => ({
  useWorkspace: () => ({
    activeWorkspaceId: 'ws-test',
    activeOrganizationId: 'org-test',
    isLoading: false,
  }),
}));

const mockTags = [
  {
    id: 'tag-1',
    name: '14K List',
    description: "Elijah's 14k list",
    category: 'custom' as const,
    color: '#3B82F6',
    usageCount: 0,
    workspaceId: 'ws-test',
    createdAt: '2026-10-09T00:00:00Z',
    updatedAt: '2026-10-09T00:00:00Z',
  },
  {
    id: 'tag-2',
    name: 'Cold Call Done',
    description: 'Contacts that have been called',
    category: 'custom' as const,
    color: '#10B981',
    usageCount: 264,
    workspaceId: 'ws-test',
    createdAt: '2026-10-09T00:00:00Z',
    updatedAt: '2026-10-09T00:00:00Z',
  },
];

vi.mock('@/context/TagCacheContext', () => ({
  TagCacheProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useTagCache: () => ({
    tags: mockTags,
    isLoading: false,
    invalidate: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/lib/tag-actions', () => ({
  createTagAction: vi.fn(),
  updateTagAction: vi.fn(),
  deleteTagAction: vi.fn(),
}));

vi.mock('@/components/tags/AssignContactsToTagDialog', () => ({
  AssignContactsToTagDialog: () => <div data-testid="assign-dialog" />,
}));

vi.mock('@/components/tags/TagUsageDashboard', () => ({
  TagUsageDashboard: () => <div data-testid="usage-dashboard" />,
}));

vi.mock('@/components/tags/TagCleanupTools', () => ({
  TagCleanupTools: () => <div data-testid="cleanup-tools" />,
}));

vi.mock('@/components/tags/TagAuditLogViewer', () => ({
  TagAuditLogViewer: () => <div data-testid="audit-log-viewer" />,
}));

describe('TagsClient - Layout, Header Tabs, Dropdown Filter, and ListView Table', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders header with title, info tooltip, and navigation tabs co-located next to Create Tag', () => {
    render(<TagsClient />);

    // Title and Info Tooltip
    expect(screen.getByText('Tags Hub')).toBeInTheDocument();
    const infoButton = screen.getByRole('button', { name: /more information/i });
    expect(infoButton).toBeInTheDocument();

    // Verify tabs in the header
    const tagRegistryTab = screen.getByRole('tab', { name: /tag registry/i });
    const analyticsTab = screen.getByRole('tab', { name: /analytics hub/i });
    const cleanupTab = screen.getByRole('tab', { name: /schema cleanup/i });
    const auditTab = screen.getByRole('tab', { name: /audit ledger/i });

    expect(tagRegistryTab).toBeInTheDocument();
    expect(analyticsTab).toBeInTheDocument();
    expect(cleanupTab).toBeInTheDocument();
    expect(auditTab).toBeInTheDocument();

    // Verify Create Tag button
    const createButton = screen.getByRole('button', { name: /create tag/i });
    expect(createButton).toBeInTheDocument();

    // Verify tabs and create button share the same header action container
    const headerContainer = createButton.closest('div.flex');
    expect(headerContainer).toContainElement(tagRegistryTab);
  });

  it('renders category filter as a Select dropdown next to the search input', () => {
    render(<TagsClient />);

    // Search input
    const searchInput = screen.getByPlaceholderText(/search the tag index/i);
    expect(searchInput).toBeInTheDocument();

    // Dropdown select trigger for categories
    const selectTrigger = screen.getByRole('combobox');
    expect(selectTrigger).toBeInTheDocument();

    // Confirm search input and select trigger share the same filter row
    const filterRow = searchInput.closest('div.flex.flex-col');
    expect(filterRow).toBeInTheDocument();
    expect(filterRow).toContainElement(selectTrigger);
  });

  it('renders tags inside a Table listview instead of a card grid', () => {
    render(<TagsClient />);

    // Table element
    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();

    // Table column headers
    expect(screen.getByRole('columnheader', { name: /tag name/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /category/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /usage/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /description/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /actions/i })).toBeInTheDocument();

    // Tags list rows inside the table
    const tableScope = within(table);
    expect(tableScope.getByText('14K List')).toBeInTheDocument();
    expect(tableScope.getByText('Cold Call Done')).toBeInTheDocument();
    expect(tableScope.getByText('264')).toBeInTheDocument();
  });
});
