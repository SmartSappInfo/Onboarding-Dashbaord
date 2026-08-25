import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DocumentLayerInspector } from '../DocumentLayerInspector';
import type { DocumentPage } from '@/lib/types/document-types';
import type { FlipbookHotspot } from '@/lib/types/flipbook-types';

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
];

const mockHotspots: FlipbookHotspot[] = [
  {
    id: 'hs_1',
    pageNumber: 1,
    x: 20,
    y: 30,
    width: 25,
    height: 10,
    type: 'link',
    title: 'Admissions Link',
    targetUrl: 'https://example.com/apply',
  },
];

describe('DocumentLayerInspector Component', () => {
  it('renders page canvas, hotspots, and handles layer selection', () => {
    const onHotspotsChange = vi.fn();

    render(
      <DocumentLayerInspector
        pages={mockPages}
        activePageNumber={1}
        onPageChange={vi.fn()}
        hotspots={mockHotspots}
        onHotspotsChange={onHotspotsChange}
      />
    );

    expect(screen.getByText('Admissions Link')).toBeDefined();

    // Click hotspot on canvas
    fireEvent.click(screen.getByText('Admissions Link'));
    expect(screen.getByText('Layer Properties')).toBeDefined();
  });

  it('adds a new link hotspot on button click', () => {
    const onHotspotsChange = vi.fn();

    render(
      <DocumentLayerInspector
        pages={mockPages}
        activePageNumber={1}
        onPageChange={vi.fn()}
        hotspots={[]}
        onHotspotsChange={onHotspotsChange}
      />
    );

    const addBtn = screen.getByRole('button', { name: /Link/i });
    fireEvent.click(addBtn);
    expect(onHotspotsChange).toHaveBeenCalled();
  });
});
