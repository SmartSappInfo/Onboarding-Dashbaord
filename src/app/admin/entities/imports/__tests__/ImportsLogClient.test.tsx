import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ImportsLogClient from '../ImportsLogClient';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams({ track: 'schools' }),
}));

vi.mock('@/context/WorkspaceContext', () => ({
  useWorkspace: () => ({
    activeWorkspace: { id: 'ws-123', name: 'Acme Workspace' },
  }),
}));

vi.mock('@/firebase', () => ({
  useUser: () => ({ user: { uid: 'user-1' } }),
  useFirestore: () => ({}),
  useMemoFirebase: (fn: () => unknown) => fn(),
  useCollection: () => ({
    data: [
      {
        id: 'log-1',
        filename: 'contacts_october.csv',
        entityType: 'contacts',
        status: 'completed',
        totalCount: 100,
        successCount: 98,
        failedCount: 2,
        duplicateCount: 0,
        startedAt: new Date().toISOString(),
      },
    ],
    isLoading: false,
  }),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
}));

vi.mock('@/lib/bulk-upload-actions', () => ({
  purgeExpiredFailedImportsAction: vi.fn().mockResolvedValue({ purgedCount: 0 }),
  getFailedRowsAction: vi.fn().mockResolvedValue([]),
  updateFailedRowAction: vi.fn().mockResolvedValue({ success: true }),
  ingestBatchAction: vi.fn().mockResolvedValue({ success: true }),
  getDuplicateRowsAction: vi.fn().mockResolvedValue([]),
  cancelBulkUploadAction: vi.fn().mockResolvedValue({ success: true }),
  resumeBulkUploadAction: vi.fn().mockResolvedValue({ success: true }),
  resolveFailedRowAction: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

describe('ImportsLogClient Header & Layout Compactness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "Imports Log" page title with CardInfoTooltip and no raw description', () => {
    render(<ImportsLogClient />);

    // Title exists
    const title = screen.getByRole('heading', { level: 1, name: /Imports Log/i });
    expect(title).toBeInTheDocument();

    // Raw description paragraph must NOT be rendered as a standalone text node under title
    expect(screen.queryByText('Monitor bulk ingestion progress and resolve conflicts.', { selector: 'p' })).not.toBeInTheDocument();

    // Info tooltip button must be present next to the title
    const tooltipTrigger = screen.getByLabelText(/More information/i);
    expect(tooltipTrigger).toBeInTheDocument();
  });

  it('renders compact navigation with "Back to Directory" preserving query parameters', () => {
    render(<ImportsLogClient />);

    const backLink = screen.getByRole('link', { name: /Back to Directory/i });
    expect(backLink).toBeInTheDocument();
    expect(backLink).toHaveAttribute('href', '/admin/entities?track=schools');
  });

  it('renders "New Bulk Import" action button linking to upload portal', () => {
    render(<ImportsLogClient />);

    const importLink = screen.getByRole('link', { name: /New Bulk Import/i });
    expect(importLink).toBeInTheDocument();
    expect(importLink).toHaveAttribute('href', '/admin/entities/upload');
  });

  it('renders the "Audit Trail" card and table contents', () => {
    render(<ImportsLogClient />);

    expect(screen.getByText('Audit Trail')).toBeInTheDocument();
    expect(screen.getByText('contacts_october.csv')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });
});
