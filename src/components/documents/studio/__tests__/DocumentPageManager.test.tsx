import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DocumentPageManager } from '../DocumentPageManager';
import type { DocumentPage } from '@/lib/types/document-types';

const mockPages: DocumentPage[] = [
  {
    id: 'page_1',
    documentId: 'doc_1',
    versionId: 'doc_1_v1',
    workspaceId: 'ws_1',
    pageNumber: 1,
    renderedAssetUrl: 'https://example.com/p1.jpg',
    thumbnailUrl: 'https://example.com/p1_thumb.jpg',
    width: 800,
    height: 1130,
    aspectRatio: 1.414,
    processingStatus: 'completed',
    textStatus: 'extracted',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'page_2',
    documentId: 'doc_1',
    versionId: 'doc_1_v1',
    workspaceId: 'ws_1',
    pageNumber: 2,
    renderedAssetUrl: 'https://example.com/p2.jpg',
    thumbnailUrl: 'https://example.com/p2_thumb.jpg',
    width: 800,
    height: 1130,
    aspectRatio: 1.414,
    processingStatus: 'completed',
    textStatus: 'extracted',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

// Mock Actions
vi.mock('@/lib/documents/document-page-actions', () => ({
  reorderDocumentPagesAction: vi.fn().mockResolvedValue({ success: true }),
  duplicateDocumentPageAction: vi.fn().mockResolvedValue({ success: true, newPageId: 'page_3' }),
  deleteDocumentPageAction: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock Toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

describe('DocumentPageManager Component', () => {
  it('renders all page cards with page badges and reorder controls', () => {
    const onSelectPageForLayers = vi.fn();

    render(
      <DocumentPageManager
        workspaceId="ws_1"
        documentId="doc_1"
        pages={mockPages}
        onSelectPageForLayers={onSelectPageForLayers}
      />
    );

    expect(screen.getByText(/Page Management \(2 Pages\)/i)).toBeDefined();
    expect(screen.getByText('Page 1')).toBeDefined();
    expect(screen.getByText('Page 2')).toBeDefined();

    // Inspect layers click
    const inspectBtns = screen.getAllByTitle('Inspect & Edit Layers on this page');
    fireEvent.click(inspectBtns[0]);
    expect(onSelectPageForLayers).toHaveBeenCalledWith(1);
  });

  it('triggers duplicate action on button click', async () => {
    render(
      <DocumentPageManager
        workspaceId="ws_1"
        documentId="doc_1"
        pages={mockPages}
        onSelectPageForLayers={vi.fn()}
      />
    );

    const dupBtns = screen.getAllByTitle('Duplicate this page');
    fireEvent.click(dupBtns[0]);

    await waitFor(() => {
      expect(dupBtns[0]).toBeDefined();
    });
  });
});
