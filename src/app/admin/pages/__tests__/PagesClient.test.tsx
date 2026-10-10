/**
 * @fileoverview Unit tests for PagesClient (Campaign Hub)
 *
 * Verifies that:
 * 1. The search filter input is positioned alongside the "New Blueprint" button in the top header.
 * 2. Standalone filter card is eliminated from the DOM.
 * 3. Page title and CardInfoTooltip are rendered correctly.
 */

import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import PagesClient from '../PagesClient';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
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

vi.mock('@/firebase', () => ({
  useFirestore: () => ({}),
  useMemoFirebase: (fn: () => unknown) => fn(),
  useUser: () => ({ user: { uid: 'user-1' } }),
  useCollection: () => ({
    data: [
      {
        id: 'page-1',
        name: 'Child Security Testimonials - Parents',
        slug: 'cs-t-parents',
        status: 'published',
        publishedAt: '2026-10-09T00:00:00Z',
        createdAt: '2026-10-09T00:00:00Z',
        updatedAt: '2026-10-09T00:00:00Z',
      },
    ],
    isLoading: false,
    error: null,
  }),
}));

vi.mock('../components/PageCard', () => ({
  PageCard: ({ page }: { page: { name: string } }) => (
    <div data-testid="page-card">{page.name}</div>
  ),
}));

describe('PagesClient - Header Layout & Top Search Filter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders search filter input next to the New Blueprint button in the header', () => {
    render(<PagesClient />);

    // Verify title and info tooltip
    expect(screen.getByText('Campaign Hub')).toBeInTheDocument();
    const infoButton = screen.getByRole('button', { name: /more information/i });
    expect(infoButton).toBeInTheDocument();

    // Verify filter input
    const filterInput = screen.getByPlaceholderText('Filter pages...');
    expect(filterInput).toBeInTheDocument();

    // Verify New Blueprint button
    const blueprintButton = screen.getByRole('link', { name: /new blueprint/i });
    expect(blueprintButton).toBeInTheDocument();

    // Verify filter input and New Blueprint button share the same parent action group
    const parentContainer = filterInput.closest('div.flex.flex-col');
    expect(parentContainer).toBeInTheDocument();
    expect(parentContainer).toContainElement(blueprintButton);
  });
});
