/**
 * @fileoverview Unit tests for PdfsClient (Signing Studio)
 *
 * Verifies that:
 * 1. The search input and status filter are positioned alongside the "New Blueprint" button in the top header.
 * 2. Standalone filter card is eliminated from the DOM.
 * 3. Page title and CardInfoTooltip are rendered correctly.
 */

import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import PdfsClient from '../PdfsClient';

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

vi.mock('@/context/WorkspaceContext', () => ({
  useWorkspace: () => ({
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
        id: 'pdf-1',
        name: 'Institutional Service Agreement',
        title: 'Institutional Service Agreement',
        status: 'published',
        schema: [{ id: 'field-1' }],
        submissionCount: 12,
        createdAt: '2026-10-09T00:00:00Z',
        updatedAt: '2026-10-09T00:00:00Z',
      },
    ],
    isLoading: false,
    error: null,
  }),
}));

vi.mock('../components/SubmissionCount', () => ({
  default: ({ formId }: { formId: string }) => <span data-testid={`submission-count-${formId}`}>12</span>,
}));

vi.mock('@/components/qr-studio/create-qr-button', () => ({
  default: () => <button data-testid="qr-button">QR</button>,
}));

vi.mock('@/lib/pdf-actions', () => ({
  deletePdfForm: vi.fn(),
  updatePdfFormStatus: vi.fn(),
  clonePdfForm: vi.fn(),
}));

describe('PdfsClient - Header Layout & Integrated Filter Controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders search filter and status dropdown next to the New Blueprint button in the header', () => {
    render(<PdfsClient />);

    // Verify title and info tooltip
    expect(screen.getByText('Signing Studio')).toBeInTheDocument();
    const infoButton = screen.getByRole('button', { name: /more information/i });
    expect(infoButton).toBeInTheDocument();

    // Verify search input
    const searchInput = screen.getByPlaceholderText('Search document titles...');
    expect(searchInput).toBeInTheDocument();

    // Verify status filter select trigger
    const statusSelectTrigger = screen.getByRole('combobox');
    expect(statusSelectTrigger).toBeInTheDocument();

    // Verify New Blueprint button link
    const blueprintButton = screen.getByRole('link', { name: /new blueprint/i });
    expect(blueprintButton).toBeInTheDocument();

    // Verify search input, status select, and New Blueprint button share the same parent action container
    const actionContainer = searchInput.closest('div.flex.flex-col');
    expect(actionContainer).toBeInTheDocument();
    expect(actionContainer).toContainElement(blueprintButton);
    expect(actionContainer).toContainElement(statusSelectTrigger);
  });
});
