/**
 * @fileoverview Unit tests for FormsClient styling and layout
 *
 * Verifies that:
 * 1. KPI cards render with proper bg-card background colors and border-border/80.
 * 2. Search & filter container renders with bg-card.
 * 3. Listview table container renders with bg-card and muted header styling.
 * 4. Transparent background classes (bg-transparent) are eliminated from cards and listview.
 */

import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import FormsClient from '../FormsClient';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  getCountFromServer: vi.fn().mockResolvedValue({ data: () => ({ count: 6 }) }),
}));

vi.mock('@/firebase', () => ({
  useFirestore: () => ({}),
  useMemoFirebase: (fn: () => unknown) => fn(),
  useUser: () => ({ user: { uid: 'user-1' } }),
  useCollection: () => ({
    data: [
      {
        id: 'form-1',
        title: 'Refer Your Child\'s School',
        internalName: 'Refer Your Child\'s School',
        slug: 'refer-your-child-s-school',
        status: 'published',
        purpose: 'referral',
        contactScope: 'global',
        publishedVersionNumber: 1,
        fields: [{ id: 'f1' }, { id: 'f2' }],
        submissionCount: 6,
        createdAt: '2026-07-25T00:00:00Z',
      },
    ],
    isLoading: false,
    error: null,
  }),
}));

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({
    activeOrganizationId: 'org-test',
    activeWorkspaceId: 'ws-test',
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-permissions', () => ({
  usePermissions: () => ({
    can: () => true,
  }),
}));

describe('FormsClient - Background Colors & Surface Tokens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders stats cards with bg-card and border-border/80 surfaces', () => {
    const { container } = render(<FormsClient />);

    expect(screen.getByText('Total Forms')).toBeInTheDocument();
    expect(screen.getByText('Published')).toBeInTheDocument();
    expect(screen.getByText('Drafts')).toBeInTheDocument();
    expect(screen.getByText('Total Submissions')).toBeInTheDocument();

    // Verify none of the cards or containers contain bg-transparent
    const transparentElements = container.querySelectorAll('.bg-transparent');
    expect(transparentElements.length).toBe(0);

    // Verify stat cards have bg-card
    const totalFormsCard = screen.getByText('Total Forms').closest('[data-slot="card"]');
    expect(totalFormsCard).toHaveClass('bg-card');
    expect(totalFormsCard).toHaveClass('rounded-2xl');
  });

  it('renders search filter and listview table with bg-card surfaces', () => {
    render(<FormsClient />);

    const searchInput = screen.getByPlaceholderText('Search forms by name or slug...');
    const filterContainer = searchInput.closest('div.flex.flex-col');
    expect(filterContainer).toHaveClass('bg-card');
    expect(filterContainer).toHaveClass('rounded-2xl');

    const formLink = screen.getByText('Refer Your Child\'s School');
    const tableContainer = formLink.closest('div.rounded-2xl');
    expect(tableContainer).toHaveClass('bg-card');
    expect(tableContainer).toHaveClass('border-border/80');

    // Table header should have muted background
    const headerRow = screen.getByText('Form Name').closest('tr');
    expect(headerRow).toHaveClass('bg-muted/30');
  });
});
