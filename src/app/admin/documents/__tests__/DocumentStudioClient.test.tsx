import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DocumentStudioClient from '../DocumentStudioClient';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({ id: 'mock_collection' })),
  query: vi.fn(() => ({ id: 'mock_query' })),
  where: vi.fn(),
  doc: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/firebase', () => ({
  useFirestore: () => ({}),
  useUser: () => ({ user: { uid: 'usr_test_123', email: 'admin@example.com' } }),
  useMemoFirebase: (fn: () => unknown) => fn(),
  useCollection: () => ({
    data: [
      {
        id: 'doc_1',
        workspaceId: 'ws_test_123',
        title: '2026 Academic Brochure',
        description: 'Undergraduate admissions brochure',
        slug: 'academic-brochure-2026',
        status: 'published',
        documentType: 'brochure',
        activeVersionId: 'doc_1_v1',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        viewsCount: 150,
        flipsCount: 420,
        leadsCount: 18,
      },
      {
        id: 'doc_2',
        workspaceId: 'ws_test_123',
        title: 'Annual Financial Report',
        description: 'Q4 2025 financial disclosures',
        slug: 'annual-report-2025',
        status: 'draft',
        documentType: 'report',
        activeVersionId: 'doc_2_v1',
        createdAt: '2026-02-01T00:00:00Z',
        updatedAt: '2026-02-01T00:00:00Z',
        viewsCount: 20,
        flipsCount: 50,
        leadsCount: 2,
      },
    ],
    isLoading: false,
  }),
}));

vi.mock('@/components/tags/TagSelector', () => ({
  TagSelector: ({ placeholder }: { placeholder?: string }) => (
    <div data-testid="tag-selector">{placeholder || 'Tags'}</div>
  ),
}));

vi.mock('@/app/admin/media/components/media-selector-dialog', () => ({
  default: () => <div data-testid="media-dialog" />,
}));

describe('DocumentStudioClient Component', () => {
  it('renders studio header and KPI metrics correctly', () => {
    render(<DocumentStudioClient />);
    expect(screen.getByText('Document Studio')).toBeDefined();
    expect(screen.getByText('2026 Academic Brochure')).toBeDefined();
    expect(screen.getByText('Annual Financial Report')).toBeDefined();
  });

  it('filters publications by search query', () => {
    render(<DocumentStudioClient />);
    const searchInput = screen.getByPlaceholderText(/search publications/i);
    fireEvent.change(searchInput, { target: { value: 'Academic' } });

    expect(screen.getByText('2026 Academic Brochure')).toBeDefined();
    expect(screen.queryByText('Annual Financial Report')).toBeNull();
  });

  it('renders category filter buttons', () => {
    render(<DocumentStudioClient />);
    expect(screen.getByText('Brochures')).toBeDefined();
    expect(screen.getByText('Reports')).toBeDefined();
    expect(screen.getByText('Prospectuses')).toBeDefined();
    expect(screen.getByText('Catalogs')).toBeDefined();
  });

  it('filters publications by category button click', () => {
    render(<DocumentStudioClient />);
    const reportBtn = screen.getByText('Reports');
    fireEvent.click(reportBtn);

    expect(screen.getByText('Annual Financial Report')).toBeDefined();
    expect(screen.queryByText('2026 Academic Brochure')).toBeNull();
  });
});
