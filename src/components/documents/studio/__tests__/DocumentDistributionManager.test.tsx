import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DocumentDistributionManager } from '../DocumentDistributionManager';

// Mock Server Actions
vi.mock('@/lib/documents/distribution-actions', () => ({
  listDocumentDistributionsAction: vi.fn().mockResolvedValue({
    success: true,
    distributions: [
      {
        id: 'dist_1',
        workspaceId: 'ws_1',
        documentId: 'doc_1',
        versionId: 'ver_1',
        type: 'campaign',
        campaignId: 'spring-drive-2026',
        token: 'token_abc123',
        status: 'active',
        createdAt: '2026-01-01T00:00:00Z',
      },
    ],
  }),
  createDocumentDistributionAction: vi.fn().mockResolvedValue({
    success: true,
    distribution: {
      id: 'dist_2',
      workspaceId: 'ws_1',
      documentId: 'doc_1',
      versionId: 'ver_1',
      type: 'campaign',
      campaignId: 'summer-2026',
      status: 'active',
      createdAt: '2026-02-01T00:00:00Z',
    },
  }),
  revokeDocumentDistributionAction: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock Toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

describe('DocumentDistributionManager Component', () => {
  it('renders canonical URLs and active distribution channel card', async () => {
    render(
      <DocumentDistributionManager
        workspaceId="ws_1"
        documentId="doc_1"
        versionId="ver_1"
        slug="academic-prospectus"
        title="Academic Prospectus"
      />
    );

    expect(screen.getByText(/Canonical Public URLs/i)).toBeDefined();
    expect(screen.getByText(/Universal Clean URL/i)).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText(/spring-drive-2026/i)).toBeDefined();
    });
  });

  it('opens create trackable channel dialog on button click', async () => {
    render(
      <DocumentDistributionManager
        workspaceId="ws_1"
        documentId="doc_1"
        versionId="ver_1"
        slug="academic-prospectus"
        title="Academic Prospectus"
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Create Trackable Channel/i })).toBeDefined();
    });

    const createBtn = screen.getByRole('button', { name: /Create Trackable Channel/i });
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(screen.getByText(/Channel Type/i)).toBeDefined();
      expect(screen.getByPlaceholderText(/e\.g\. spring-open-day-2026/i)).toBeDefined();
    });
  });
});
