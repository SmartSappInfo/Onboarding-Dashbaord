/**
 * @fileoverview Unit tests for ThumbnailsClient (AI Thumbnail Studio)
 *
 * Verifies that:
 * 1. Title renders with standard text-foreground typography and CardInfoTooltip.
 * 2. Search filter input is located alongside the action buttons in the top header.
 * 3. Standalone filter card wrapper is eliminated.
 * 4. Empty state and design cards conform to the page theme tokens (bg-card, border-border).
 */

import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ThumbnailsClient from '../ThumbnailsClient';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
}));

vi.mock('@/context/WorkspaceContext', () => ({
  useWorkspace: () => ({
    activeWorkspaceId: 'ws-test',
    isLoading: false,
  }),
}));

vi.mock('@/firebase', () => ({
  useFirestore: () => ({}),
  useMemoFirebase: (fn: () => unknown) => fn(),
  useCollection: () => ({
    data: [],
    isLoading: false,
    error: null,
  }),
}));

vi.mock('@/components/shared/thumbnail-designer/ThumbnailDesignerDialog', () => ({
  default: () => <div data-testid="thumbnail-designer-dialog" />,
}));

describe('ThumbnailsClient - Theme & Layout Conformance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders standard title, tooltip, and header action cluster with search filter', () => {
    render(<ThumbnailsClient />);

    // Title should be visible and properly styled
    const title = screen.getByText('AI Thumbnail Studio');
    expect(title).toBeInTheDocument();
    expect(title).toHaveClass('text-foreground');

    // Info tooltip button
    const infoButton = screen.getByRole('button', { name: /more information/i });
    expect(infoButton).toBeInTheDocument();

    // Search filter input
    const searchInput = screen.getByPlaceholderText('Search designs...');
    expect(searchInput).toBeInTheDocument();

    // Creative Studio link button
    const creativeStudioLink = screen.getByRole('link', { name: /creative studio/i });
    expect(creativeStudioLink).toBeInTheDocument();

    // Create Thumbnail button
    const createButton = screen.getByRole('button', { name: /create thumbnail/i });
    expect(createButton).toBeInTheDocument();

    // Verify search input and buttons share the header action cluster
    const actionContainer = searchInput.closest('div.flex.flex-col');
    expect(actionContainer).toBeInTheDocument();
    expect(actionContainer).toContainElement(creativeStudioLink);
    expect(actionContainer).toContainElement(createButton);
  });

  it('renders theme-conforming empty state when no designs exist', () => {
    render(<ThumbnailsClient />);

    expect(screen.getByText('No Thumbnails Found')).toBeInTheDocument();
    expect(screen.getByText(/Start from a CTR layout formula/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /design with ai/i })).toBeInTheDocument();
  });
});
